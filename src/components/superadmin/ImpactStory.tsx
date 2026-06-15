import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { ZONES, ZoneId, getZoneId } from '@/lib/regions';
import { Pencil, Check, X, Camera, Download, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface EventRow {
  id: string;
  name: string;
  level: string;
  city: string | null;
  state: string | null;
  zone: string | null;
  status: string;
  participant_count: number;
  created_at: string;
}

interface MotionRow {
  id: string;
  event_id: string | null;
  subject: string;
  details: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'discussed';
  updated_at: string;
}

interface Settings {
  hero_photo_url: string | null;
  baseline_year: number;
  baseline_hubs: number;
  baseline_students: number;
}

interface StudentAwardRow {
  student_id: string;
  award_id: string;
  event_id: string | null;
}

interface SpeechRow {
  id: string;
  student_id: string;
  notes: string | null;
  session_info: string | null;
  recorded_at: string;
  event_id: string | null;
}

const LEVELS = ['city', 'regional', 'national'] as const;
type LevelKey = typeof LEVELS[number];
const LEVEL_META: Record<LevelKey, { label: string; icon: string; pillCls: string; chipCls: string }> = {
  city:     { label: 'City Hubs', icon: 'location_city', pillCls: 'bg-primary-fixed text-on-primary-fixed',     chipCls: 'bg-primary/5 text-primary' },
  regional: { label: 'Regional',  icon: 'map',           pillCls: 'bg-secondary-fixed text-on-secondary-fixed', chipCls: 'bg-secondary/5 text-secondary' },
  national: { label: 'National',  icon: 'flag',          pillCls: 'bg-tertiary-fixed text-on-tertiary-fixed',   chipCls: 'bg-tertiary/5 text-tertiary' },
};

const ZONE_IDS = new Set<string>(ZONES.map(z => z.id));
const resolveZoneId = (ev: EventRow): ZoneId | null =>
  (ev.zone && ZONE_IDS.has(ev.zone) ? (ev.zone as ZoneId) : null) ?? getZoneId(ev.state);

const STATUS_DISPLAY: Record<string, { label: string; pillCls: string; icon: string; iconBg: string; iconText: string }> = {
  approved:  { label: 'Passed',       pillCls: 'bg-tertiary-fixed text-on-tertiary-fixed',   icon: 'verified',    iconBg: 'bg-tertiary/10',  iconText: 'text-tertiary' },
  pending:   { label: 'Under Review', pillCls: 'bg-secondary-fixed text-on-secondary-fixed', icon: 'history_edu', iconBg: 'bg-secondary/10', iconText: 'text-secondary' },
  discussed: { label: 'Discussed',    pillCls: 'bg-primary-fixed text-on-primary-fixed',     icon: 'forum',       iconBg: 'bg-primary/10',   iconText: 'text-primary' },
  rejected:  { label: 'Rejected',     pillCls: 'bg-error-container text-error',              icon: 'cancel',      iconBg: 'bg-error/10',     iconText: 'text-error' },
};

const DEFAULT_SETTINGS: Settings = {
  hero_photo_url: null,
  baseline_year: 2014,
  baseline_hubs: 12,
  baseline_students: 500,
};

const DEFAULT_HERO_IMAGE = '/lovable-uploads/acb05533-0bc0-4094-9302-9f7621f49697.png';

export const ImpactStory = () => {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [totalSchools, setTotalSchools] = useState(0);
  const [motions, setMotions] = useState<MotionRow[]>([]);
  const [sessionsCompleted, setSessionsCompleted] = useState(0);
  const [totalSessions, setTotalSessions] = useState(0);
  const [totalPolls, setTotalPolls] = useState(0);
  const [totalSpeeches, setTotalSpeeches] = useState(0);
  const [studentAwards, setStudentAwards] = useState<StudentAwardRow[]>([]);
  const [winnerNameMap, setWinnerNameMap] = useState<Map<string, string>>(new Map());
  const [totalVotes, setTotalVotes] = useState(0);
  const [totalAssessments, setTotalAssessments] = useState(0);
  const [avgJuryScore, setAvgJuryScore] = useState(0);
  const [totalParties, setTotalParties] = useState(0);
  const [totalCommittees, setTotalCommittees] = useState(0);
  const [statesRepresented, setStatesRepresented] = useState(0);
  const [constituenciesRepresented, setConstituenciesRepresented] = useState(0);
  const [organizerCount, setOrganizerCount] = useState(0);
  const [juryCount, setJuryCount] = useState(0);
  const [totalChatMessages, setTotalChatMessages] = useState(0);
  const [speechHighlights, setSpeechHighlights] = useState<SpeechRow[]>([]);
  const [speechStudentNameMap, setSpeechStudentNameMap] = useState<Map<string, string>>(new Map());
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [editingBaseline, setEditingBaseline] = useState(false);
  const [baselineDraft, setBaselineDraft] = useState({ year: 2014, hubs: 12, students: 500 });

  const reportRef = useRef<HTMLDivElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const load = async () => {
      const [
        { data: eventData, error: eventError },
        { count: schoolCount },
        { count: studentCount },
        { data: motionData },
        { data: sessionData },
        { data: settingsData },
        { count: pollCount },
        { count: speechCount },
        { data: studentAwardsData },
        { data: assessmentData },
        { count: voteCount },
        { data: partyData },
        { data: committeeData },
        { data: studentDemographics },
        { count: organizerCountRes },
        { count: juryCountRes },
        { count: chatMessageCount },
        { data: speechData },
      ] = await Promise.all([
        supabase.rpc('list_events_for_super_admin'),
        supabase.from('event_schools' as any).select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('user_type', 'student'),
        supabase.from('motions' as any).select('id, event_id, subject, details, status, updated_at'),
        supabase.from('session_items').select('id, status'),
        supabase.from('impact_story_settings' as any).select('*').maybeSingle(),
        supabase.from('polls' as any).select('id', { count: 'exact', head: true }),
        supabase.from('student_speeches' as any).select('id', { count: 'exact', head: true }),
        supabase.from('student_awards' as any).select('student_id, award_id, event_id'),
        supabase.from('assessments' as any).select('total_score, status'),
        supabase.from('poll_votes' as any).select('id', { count: 'exact', head: true }),
        supabase.from('event_parties' as any).select('name'),
        supabase.from('event_committees' as any).select('name'),
        supabase.from('profiles').select('state, constituency').eq('user_type', 'student'),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('user_type', 'organizer'),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('user_type', 'jury'),
        supabase.from('civic_chat_messages' as any).select('id', { count: 'exact', head: true }),
        supabase.from('student_speeches' as any)
          .select('id, student_id, notes, session_info, recorded_at, event_id')
          .not('notes', 'is', null)
          .order('recorded_at', { ascending: false })
          .limit(10),
      ]);

      if (!eventError && eventData) setEvents(eventData as EventRow[]);
      setTotalSchools(schoolCount || 0);
      setTotalStudents(studentCount || 0);
      if (motionData) setMotions(motionData as unknown as MotionRow[]);
      if (sessionData) {
        setTotalSessions(sessionData.length);
        setSessionsCompleted((sessionData as any[]).filter(s => s.status === 'completed').length);
      }
      setTotalPolls(pollCount || 0);
      setTotalSpeeches(speechCount || 0);

      const awardsArr = (studentAwardsData as unknown as StudentAwardRow[] | null) || [];
      setStudentAwards(awardsArr);
      if (awardsArr.length > 0) {
        const studentIds = Array.from(new Set(awardsArr.map(sa => sa.student_id)));
        const { data: winnerProfiles } = await supabase.from('profiles').select('user_id, name').in('user_id', studentIds);
        setWinnerNameMap(new Map((winnerProfiles || []).map(p => [p.user_id, p.name])));
      }

      const submittedAssessments = ((assessmentData as unknown as { total_score: number; status: string }[] | null) || []).filter(a => a.status === 'submitted');
      setTotalAssessments(submittedAssessments.length);
      setAvgJuryScore(
        submittedAssessments.length > 0
          ? Math.round((submittedAssessments.reduce((s, a) => s + (a.total_score || 0), 0) / submittedAssessments.length) * 10) / 10
          : 0
      );

      setTotalVotes(voteCount || 0);

      const partyNames = new Set(((partyData as unknown as { name: string }[] | null) || []).map(p => p.name));
      setTotalParties(partyNames.size);
      const committeeNames = new Set(((committeeData as unknown as { name: string }[] | null) || []).map(c => c.name));
      setTotalCommittees(committeeNames.size);

      const demographics = studentDemographics || [];
      setStatesRepresented(new Set(demographics.map(d => d.state).filter(Boolean)).size);
      setConstituenciesRepresented(new Set(demographics.map(d => d.constituency).filter(Boolean)).size);

      setOrganizerCount(organizerCountRes || 0);
      setJuryCount(juryCountRes || 0);
      setTotalChatMessages(chatMessageCount || 0);

      const speechesArr = ((speechData as unknown as SpeechRow[] | null) || []).filter(s => s.notes && s.notes.trim().length > 0);
      const topSpeeches = speechesArr.slice(0, 3);
      setSpeechHighlights(topSpeeches);
      if (topSpeeches.length > 0) {
        const speechStudentIds = Array.from(new Set(topSpeeches.map(s => s.student_id)));
        const { data: speechProfiles } = await supabase.from('profiles').select('user_id, name').in('user_id', speechStudentIds);
        setSpeechStudentNameMap(new Map((speechProfiles || []).map(p => [p.user_id, p.name])));
      }

      if (settingsData) {
        const s = settingsData as unknown as Settings;
        setSettings(s);
        setBaselineDraft({ year: s.baseline_year, hubs: s.baseline_hubs, students: s.baseline_students });
      } else {
        setBaselineDraft({ year: DEFAULT_SETTINGS.baseline_year, hubs: DEFAULT_SETTINGS.baseline_hubs, students: DEFAULT_SETTINGS.baseline_students });
      }
      setLoading(false);
    };
    load();
  }, []);

  const cityEvents     = useMemo(() => events.filter(e => e.level === 'city'), [events]);
  const regionalEvents = useMemo(() => events.filter(e => e.level === 'regional'), [events]);
  const nationalEvents = useMemo(() => events.filter(e => e.level === 'national'), [events]);
  const cities         = useMemo(() => new Set(cityEvents.map(e => e.city).filter(Boolean)).size, [cityEvents]);
  const activeZones    = useMemo(() => ZONES.filter(z => events.some(e => resolveZoneId(e) === z.id)).length, [events]);
  const totalDelegates = useMemo(() => events.reduce((s, e) => s + (e.participant_count || 0), 0), [events]);

  const approvedMotions = useMemo(() => motions.filter(m => m.status === 'approved').length, [motions]);
  const rejectedMotions = useMemo(() => motions.filter(m => m.status === 'rejected').length, [motions]);
  const approvalRate    = useMemo(() => motions.length > 0 ? Math.round((approvedMotions / motions.length) * 100) : 0, [motions, approvedMotions]);
  const resolvedMotions = approvedMotions + rejectedMotions;
  const passRate        = resolvedMotions > 0 ? Math.round((approvedMotions / resolvedMotions) * 100) : 0;
  const failRate        = resolvedMotions > 0 ? 100 - passRate : 0;

  const voterTurnout = useMemo(() => {
    const maxPossible = totalPolls * totalStudents;
    return maxPossible > 0 ? Math.min(100, Math.round((totalVotes / maxPossible) * 100)) : 0;
  }, [totalVotes, totalPolls, totalStudents]);

  const participantsByLevel = useMemo(() => ({
    city: cityEvents.reduce((s, e) => s + (e.participant_count || 0), 0),
    regional: regionalEvents.reduce((s, e) => s + (e.participant_count || 0), 0),
    national: nationalEvents.reduce((s, e) => s + (e.participant_count || 0), 0),
  }), [cityEvents, regionalEvents, nationalEvents]);

  const eventLevelMap = useMemo(() => new Map(events.map(e => [e.id, e.level])), [events]);

  const winnersByLevel = useMemo(() => {
    const levels: Record<LevelKey, { count: number; names: string[] }> = {
      city: { count: 0, names: [] },
      regional: { count: 0, names: [] },
      national: { count: 0, names: [] },
    };
    const seen: Record<LevelKey, Set<string>> = { city: new Set(), regional: new Set(), national: new Set() };
    for (const sa of studentAwards) {
      if (!sa.event_id) continue;
      const level = eventLevelMap.get(sa.event_id) as LevelKey | undefined;
      if (level !== 'city' && level !== 'regional' && level !== 'national') continue;
      if (seen[level].has(sa.student_id)) continue;
      seen[level].add(sa.student_id);
      levels[level].count += 1;
      const name = winnerNameMap.get(sa.student_id);
      if (name) levels[level].names.push(name);
    }
    return levels;
  }, [studentAwards, eventLevelMap, winnerNameMap]);

  const eventNameMap = useMemo(() => new Map(events.map(e => [e.id, e.name])), [events]);
  const recentMotions = useMemo(
    () => [...motions].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()).slice(0, 2),
    [motions]
  );
  const pendingMotions = useMemo(() => motions.filter(m => m.status === 'pending' || m.status === 'discussed').length, [motions]);

  const zoneSpotlight = useMemo(() => {
    const stats = ZONES.map(zone => {
      const zoneEvents = events.filter(e => resolveZoneId(e) === zone.id);
      const zoneEventIds = new Set(zoneEvents.map(e => e.id));
      const zoneMotions = motions.filter(m => m.event_id && zoneEventIds.has(m.event_id));
      const approved = zoneMotions.filter(m => m.status === 'approved').length;
      return {
        zone,
        participants: zoneEvents.reduce((s, e) => s + (e.participant_count || 0), 0),
        rate: zoneMotions.length > 0 ? Math.round((approved / zoneMotions.length) * 100) : 0,
        motionsCount: zoneMotions.length,
      };
    });
    const topResolution = [...stats].filter(s => s.motionsCount > 0).sort((a, b) => b.rate - a.rate)[0] || null;
    const topTurnout     = [...stats].filter(s => s.participants > 0).sort((a, b) => b.participants - a.participants)[0] || null;
    return { topResolution, topTurnout };
  }, [events, motions]);

  const currentHubs    = cityEvents.length;
  const maxHubs        = Math.max(currentHubs, settings.baseline_hubs, 1);
  const maxStudents    = Math.max(totalStudents, settings.baseline_students, 1);
  const currentYear    = new Date().getFullYear();

  const onPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Invalid file', description: 'Please upload an image file.', variant: 'destructive' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Please upload an image under 5MB.', variant: 'destructive' });
      return;
    }
    setUploadingPhoto(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `hero.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('impact-story')
        .upload(path, file, { cacheControl: '3600', upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('impact-story').getPublicUrl(path);
      const publicUrl = `${data.publicUrl}?t=${Date.now()}`;

      const { error: dbError } = await supabase
        .from('impact_story_settings' as any)
        .upsert({ id: 1, hero_photo_url: publicUrl, updated_at: new Date().toISOString() });
      if (dbError) throw dbError;

      setSettings(prev => ({ ...prev, hero_photo_url: publicUrl }));
      toast({ title: 'Hero photo updated' });
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  const saveBaseline = async () => {
    const { error } = await supabase
      .from('impact_story_settings' as any)
      .upsert({ id: 1, baseline_year: baselineDraft.year, baseline_hubs: baselineDraft.hubs, baseline_students: baselineDraft.students, updated_at: new Date().toISOString() });
    if (error) {
      toast({ title: 'Could not save baseline', description: error.message, variant: 'destructive' });
      return;
    }
    setSettings(prev => ({ ...prev, baseline_year: baselineDraft.year, baseline_hubs: baselineDraft.hubs, baseline_students: baselineDraft.students }));
    setEditingBaseline(false);
  };

  const exportToPDF = async () => {
    const container = reportRef.current;
    if (!container) return;
    setExportingPdf(true);
    try {
      const hideEls = container.querySelectorAll<HTMLElement>('.export-hide');
      hideEls.forEach(el => { el.style.visibility = 'hidden'; });

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const margin = 8;
      const usableWidth = pdfWidth - margin * 2;
      const pageContentHeight = pdfHeight - margin * 2;
      const sectionGap = 4;

      // Capture each top-level section separately so cards/sections never
      // get sliced in half across a page boundary.
      const sections = Array.from(container.children) as HTMLElement[];
      let y = margin;

      for (const section of sections) {
        const canvas = await html2canvas(section, { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false });
        const imgHeight = (canvas.height * usableWidth) / canvas.width;

        if (imgHeight > pageContentHeight) {
          // Section taller than a full page — slice it across pages.
          if (y > margin) { pdf.addPage(); y = margin; }
          const pxPerMM = canvas.width / usableWidth;
          const pageHeightPx = pageContentHeight * pxPerMM;
          let renderedPx = 0;
          while (renderedPx < canvas.height) {
            const sliceHeightPx = Math.min(pageHeightPx, canvas.height - renderedPx);
            const sliceCanvas = document.createElement('canvas');
            sliceCanvas.width = canvas.width;
            sliceCanvas.height = sliceHeightPx;
            sliceCanvas.getContext('2d')?.drawImage(canvas, 0, renderedPx, canvas.width, sliceHeightPx, 0, 0, canvas.width, sliceHeightPx);
            const sliceHeightMM = sliceHeightPx / pxPerMM;
            pdf.addImage(sliceCanvas.toDataURL('image/png'), 'PNG', margin, margin, usableWidth, sliceHeightMM);
            renderedPx += sliceHeightPx;
            y = margin + sliceHeightMM;
            if (renderedPx < canvas.height) { pdf.addPage(); y = margin; }
          }
          y += sectionGap;
        } else {
          if (y > margin && y + imgHeight > pdfHeight - margin) {
            pdf.addPage();
            y = margin;
          }
          pdf.addImage(canvas.toDataURL('image/png'), 'PNG', margin, y, usableWidth, imgHeight);
          y += imgHeight + sectionGap;
        }
      }

      hideEls.forEach(el => { el.style.visibility = ''; });

      pdf.save(`yip-impact-story-${new Date().toISOString().split('T')[0]}.pdf`);
      toast({ title: 'Impact Story exported', description: 'PDF downloaded successfully.' });
    } catch (err: any) {
      container.querySelectorAll<HTMLElement>('.export-hide').forEach(el => { el.style.visibility = ''; });
      toast({ title: 'Export failed', description: err?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setExportingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const foundationStats = [
    { label: 'Schools Reached',     value: totalSchools,                          icon: 'school' },
    { label: 'Students Empowered',  value: totalStudents,                         icon: 'groups' },
    { label: 'City Chapters',       value: cities,                                icon: 'location_city' },
    { label: 'Zones Active',        value: `${activeZones}/${ZONES.length}`,      icon: 'map' },
    { label: 'Sessions Completed',  value: sessionsCompleted,                     icon: 'event_available' },
  ];

  const diversityStats = [
    { label: 'Political Parties Formed',     value: totalParties,            icon: 'groups' },
    { label: 'Parliamentary Committees',     value: totalCommittees,         icon: 'account_balance' },
    { label: 'States Represented',           value: statesRepresented,       icon: 'public' },
    { label: 'Constituencies Represented',   value: constituenciesRepresented, icon: 'location_on' },
  ];

  const capacityStats = [
    { label: 'Organizer Volunteers',     value: organizerCount,     icon: 'manage_accounts' },
    { label: 'Jury Members',             value: juryCount,          icon: 'gavel' },
    { label: 'Assessments Completed',    value: totalAssessments,   icon: 'fact_check' },
    { label: 'Avg. Jury Score',          value: avgJuryScore,       icon: 'star' },
  ];

  const journeySteps = [
    {
      icon: 'location_city',
      title: 'City Hubs',
      desc: 'Local chapters where students debate constituency-level issues and elect their first representatives.',
      badge: `${currentHubs} Active Hub${currentHubs !== 1 ? 's' : ''}`,
    },
    {
      icon: 'map',
      title: 'Regional Chapters',
      desc: `Winners advance through ${regionalEvents.length} regional assembl${regionalEvents.length !== 1 ? 'ies' : 'y'}, refining motions for state-level impact.`,
      badge: `${ZONES.length} Major Zones`,
    },
    {
      icon: 'flag',
      title: 'National Summit',
      desc: 'Top delegates converge for the National Summit to debate and vote on resolutions that shape the whole network.',
      badge: nationalEvents.length > 0 ? `${nationalEvents.length} National Event${nationalEvents.length !== 1 ? 's' : ''}` : 'Annual Event',
    },
  ];

  return (
    <div className="space-y-8">

      {/* Header */}
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold font-headline tracking-tight text-primary">
            Impact <span className="text-secondary">Story</span>
          </h1>
          <p className="text-[10px] text-on-surface-variant/40 font-black uppercase tracking-[0.4em] mt-3 flex items-center gap-2 font-headline">
            <span className="material-symbols-outlined text-[12px]">auto_stories</span>
            Live National Impact — Built From Real Data
          </p>
        </div>
        <button
          onClick={exportToPDF}
          disabled={exportingPdf}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-primary text-white font-headline font-bold text-sm shrink-0 hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {exportingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {exportingPdf ? 'Exporting…' : 'Download PDF'}
        </button>
      </header>

      {/* Exportable storyboard */}
      <div ref={reportRef} className="space-y-10 bg-white p-1">

        {/* ── Hero ── */}
        <div className="relative rounded-[2.5rem] bg-gradient-to-br from-primary to-primary-container p-8 md:p-16 shadow-[0_4px_32px_0_rgba(19,41,143,0.15)]">
          <div className="flex flex-col md:flex-row items-center gap-12">
            {/* Text */}
            <div className="flex-1 space-y-6 md:space-y-8">
              <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-secondary-container/20 border border-secondary-container/30 text-secondary-container text-[10px] font-black uppercase tracking-widest font-headline">
                <span className="w-2 h-2 rounded-full bg-secondary-container animate-pulse" />
                Live National Impact
              </div>
              <h2 className="font-headline text-3xl md:text-6xl font-black text-white leading-[1.1] tracking-tight">
                {totalStudents.toLocaleString()}+ Future Leaders{' '}
                <span className="text-tertiary-fixed-dim">Empowered</span>
              </h2>
              <p className="text-white/80 text-sm md:text-lg max-w-xl leading-relaxed font-medium font-body">
                Across <span className="font-bold text-white">{totalSchools} schools</span> and{' '}
                <span className="font-bold text-white">{cities} cities</span>, YIP Parliament gives young Indians
                a real chamber to debate, legislate, and lead — from city hubs all the way to the National Summit.
              </p>
              <div className="flex flex-wrap gap-4">
                <div className="px-5 py-4 md:px-6 md:py-5 bg-white/10 backdrop-blur-md rounded-3xl border border-white/10 shadow-xl">
                  <span className="block text-2xl md:text-4xl font-black text-white font-headline leading-none">{motions.length}</span>
                  <span className="text-white/60 text-[10px] font-bold uppercase tracking-wider font-headline mt-1 block">Bills Documented</span>
                </div>
                <div className="px-5 py-4 md:px-6 md:py-5 bg-white/10 backdrop-blur-md rounded-3xl border border-white/10 shadow-xl">
                  <span className="block text-2xl md:text-4xl font-black text-white font-headline leading-none">{approvedMotions}</span>
                  <span className="text-white/60 text-[10px] font-bold uppercase tracking-wider font-headline mt-1 block">Bills Passed</span>
                </div>
                <div className="px-5 py-4 md:px-6 md:py-5 bg-white/10 backdrop-blur-md rounded-3xl border border-white/10 shadow-xl">
                  <span className="block text-2xl md:text-4xl font-black text-white font-headline leading-none">{approvalRate}%</span>
                  <span className="text-white/60 text-[10px] font-bold uppercase tracking-wider font-headline mt-1 block">Approval Rate</span>
                </div>
              </div>
            </div>

            {/* Photo */}
            <div className="flex-1 relative w-full max-w-sm md:max-w-none">
              <div className="aspect-square w-full rounded-[2.5rem] overflow-hidden border-8 border-white/10 bg-white/5 shadow-2xl">
                {settings.hero_photo_url ? (
                  <img src={settings.hero_photo_url} alt="Impact Story" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-white/10 p-10">
                    <img src={DEFAULT_HERO_IMAGE} alt="YIP mascot" className="w-full h-full object-contain opacity-90" />
                  </div>
                )}
              </div>

              <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={onPhotoChange} />
              <button
                onClick={() => photoInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="export-hide absolute top-4 right-4 w-10 h-10 rounded-full bg-white text-primary flex items-center justify-center shadow-lg hover:bg-white/90 transition-colors disabled:opacity-50"
                title="Upload hero photo"
              >
                {uploadingPhoto ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* ── Foundation (the data everything above is built from) ── */}
        <div className="bg-surface-container-lowest rounded-[2rem] shadow-[0_4px_32px_0_rgba(19,41,143,0.06)] border border-outline-variant/10 p-8">
          <p className="font-headline font-bold text-on-surface">The Foundation</p>
          <p className="text-xs text-on-surface-variant font-body mt-0.5 mb-6">
            Every number above is built from these — updated live as new events, students and sessions are added.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {foundationStats.map(stat => (
              <div key={stat.label} className="bg-surface-container/40 rounded-2xl p-5 border border-outline-variant/10 flex flex-col gap-2">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>{stat.icon}</span>
                </div>
                <div>
                  <p className="text-2xl font-black font-headline text-on-surface leading-none">{stat.value}</p>
                  <p className="text-[10px] text-on-surface-variant font-body mt-1">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Reach Across the Network ── */}
        <div>
          <div className="text-center mb-10">
            <h3 className="font-headline text-2xl md:text-4xl font-extrabold text-primary mb-3">Reach Across the Network</h3>
            <div className="h-1 w-24 bg-secondary-container rounded-full mx-auto" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-[2rem] p-8 bg-surface-container-lowest border border-outline-variant/10 shadow-[0_4px_32px_0_rgba(19,41,143,0.06)]">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
                <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>location_city</span>
              </div>
              <p className="text-3xl md:text-4xl font-black font-headline text-on-surface leading-none">{participantsByLevel.city.toLocaleString()}</p>
              <p className="text-[10px] text-on-surface-variant font-black uppercase tracking-wider font-headline mt-2">Delegates · City Hubs</p>
              <p className="text-xs text-on-surface-variant/50 font-body mt-3">{cityEvents.length} event{cityEvents.length !== 1 ? 's' : ''} across {cities} cit{cities !== 1 ? 'ies' : 'y'}</p>
            </div>
            <div className="rounded-[2rem] p-8 bg-surface-container-lowest border border-outline-variant/10 shadow-[0_4px_32px_0_rgba(19,41,143,0.06)]">
              <div className="w-12 h-12 rounded-2xl bg-secondary/10 flex items-center justify-center mb-5">
                <span className="material-symbols-outlined text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>map</span>
              </div>
              <p className="text-3xl md:text-4xl font-black font-headline text-on-surface leading-none">{participantsByLevel.regional.toLocaleString()}</p>
              <p className="text-[10px] text-on-surface-variant font-black uppercase tracking-wider font-headline mt-2">Delegates · Regional</p>
              <p className="text-xs text-on-surface-variant/50 font-body mt-3">{regionalEvents.length} regional assembl{regionalEvents.length !== 1 ? 'ies' : 'y'}</p>
            </div>
            <div className="rounded-[2rem] p-8 bg-surface-container-lowest border border-outline-variant/10 shadow-[0_4px_32px_0_rgba(19,41,143,0.06)]">
              <div className="w-12 h-12 rounded-2xl bg-tertiary/10 flex items-center justify-center mb-5">
                <span className="material-symbols-outlined text-tertiary" style={{ fontVariationSettings: "'FILL' 1" }}>flag</span>
              </div>
              <p className="text-3xl md:text-4xl font-black font-headline text-on-surface leading-none">{participantsByLevel.national.toLocaleString()}</p>
              <p className="text-[10px] text-on-surface-variant font-black uppercase tracking-wider font-headline mt-2">Delegates · National</p>
              <p className="text-xs text-on-surface-variant/50 font-body mt-3">{nationalEvents.length} national event{nationalEvents.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
        </div>

        {/* ── Diversity & Representation ── */}
        <div>
          <div className="text-center mb-10">
            <h3 className="font-headline text-2xl md:text-4xl font-extrabold text-primary mb-3">Diversity &amp; Representation</h3>
            <div className="h-1 w-24 bg-secondary-container rounded-full mx-auto" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {diversityStats.map(stat => (
              <div key={stat.label} className="bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant/10 shadow-[0_4px_32px_0_rgba(19,41,143,0.06)] flex flex-col gap-2">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>{stat.icon}</span>
                </div>
                <div>
                  <p className="text-2xl font-black font-headline text-on-surface leading-none">{stat.value}</p>
                  <p className="text-[10px] text-on-surface-variant font-body mt-1">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Impact Journey ── */}
        <div>
          <div className="text-center mb-10">
            <h3 className="font-headline text-2xl md:text-4xl font-extrabold text-primary mb-3">The Impact Journey</h3>
            <div className="h-1 w-24 bg-secondary-container rounded-full mx-auto" />
          </div>
          <div className="relative grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-8">
            <div className="hidden md:block absolute top-12 left-0 w-full h-0.5 border-t-2 border-dashed border-primary/20" />
            {journeySteps.map((step, i) => (
              <div key={step.title} className="relative flex flex-col items-center text-center px-2">
                <div className={`relative z-10 w-20 h-20 md:w-24 md:h-24 rounded-full shadow-xl flex items-center justify-center mb-6 border-4 ${i === 1 ? 'bg-primary border-primary-container' : 'bg-white border-surface-container'}`}>
                  <span
                    className={`material-symbols-outlined text-3xl md:text-4xl ${i === 1 ? 'text-on-primary' : i === 2 ? 'text-secondary' : 'text-primary'}`}
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    {step.icon}
                  </span>
                </div>
                <h4 className="font-headline text-lg md:text-xl font-bold mb-2 text-on-surface">{step.title}</h4>
                <p className="text-on-surface-variant text-sm leading-relaxed max-w-xs">{step.desc}</p>
                <div className={`mt-5 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider font-headline ${i === 1 ? 'bg-primary-container text-on-primary-container' : i === 2 ? 'bg-secondary-fixed text-on-secondary-fixed' : 'bg-surface-container text-primary'}`}>
                  {step.badge}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Bento grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Inside the Chamber */}
          <div className="lg:col-span-7 relative overflow-hidden bg-surface-container-lowest rounded-[2rem] shadow-[0_4px_32px_0_rgba(19,41,143,0.06)] border border-outline-variant/10 p-8 md:p-10">
            <div className="absolute top-0 right-0 p-6 pointer-events-none">
              <span className="material-symbols-outlined text-[120px] text-primary opacity-10" style={{ fontVariationSettings: "'FILL' 1" }}>gavel</span>
            </div>
            <div className="relative z-10">
              <h3 className="font-headline text-xl md:text-2xl font-extrabold text-primary mb-1">Inside the Chamber</h3>
              <p className="text-xs text-on-surface-variant font-body mb-6">Motions raised and debated, and the voices behind them</p>

              {/* Stat strip */}
              <div className="grid grid-cols-4 gap-3 mb-6">
                <div className="rounded-xl bg-surface p-3 text-center border border-outline-variant/10">
                  <p className="text-lg md:text-xl font-black font-headline text-on-surface leading-none">{motions.length}</p>
                  <p className="text-[9px] text-on-surface-variant font-black uppercase tracking-wider font-headline mt-1">Total Motions</p>
                </div>
                <div className="rounded-xl bg-surface p-3 text-center border border-outline-variant/10">
                  <p className="text-lg md:text-xl font-black font-headline text-tertiary leading-none">{approvedMotions}</p>
                  <p className="text-[9px] text-on-surface-variant font-black uppercase tracking-wider font-headline mt-1">Passed</p>
                </div>
                <div className="rounded-xl bg-surface p-3 text-center border border-outline-variant/10">
                  <p className="text-lg md:text-xl font-black font-headline text-secondary leading-none">{pendingMotions}</p>
                  <p className="text-[9px] text-on-surface-variant font-black uppercase tracking-wider font-headline mt-1">Under Review</p>
                </div>
                <div className="rounded-xl bg-surface p-3 text-center border border-outline-variant/10">
                  <p className="text-lg md:text-xl font-black font-headline text-error leading-none">{rejectedMotions}</p>
                  <p className="text-[9px] text-on-surface-variant font-black uppercase tracking-wider font-headline mt-1">Rejected</p>
                </div>
              </div>

              <div className="space-y-4">
                {recentMotions.length === 0 ? (
                  <p className="text-sm text-on-surface-variant/60 font-body text-center py-6">
                    No motions raised yet — resolutions will appear here as students raise them.
                  </p>
                ) : recentMotions.map(m => {
                  const display = STATUS_DISPLAY[m.status] ?? STATUS_DISPLAY.pending;
                  return (
                    <div key={m.id} className="flex gap-4 items-start p-5 rounded-2xl bg-surface hover:bg-surface-container-low transition-colors border border-transparent hover:border-primary/10">
                      <div className={`w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center shrink-0 ${display.iconBg} ${display.iconText}`}>
                        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>{display.icon}</span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h5 className="font-headline font-bold text-sm md:text-base text-on-surface truncate">{m.subject}</h5>
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider font-headline ${display.pillCls}`}>
                            {display.label}
                          </span>
                        </div>
                        <p className="text-on-surface-variant text-xs md:text-sm leading-relaxed line-clamp-2">
                          {m.details || `Raised in ${eventNameMap.get(m.event_id || '') || 'an event'} — awaiting committee review.`}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Voices from the Floor */}
              <div className="mt-6 pt-6 border-t border-outline-variant/10">
                <h4 className="font-headline text-sm font-extrabold text-on-surface mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px] text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>record_voice_over</span>
                  Voices from the Floor
                </h4>
                {speechHighlights.length === 0 ? (
                  <p className="text-sm text-on-surface-variant/60 font-body py-2">
                    No speech highlights recorded yet — notable remarks will appear here.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {speechHighlights.map(s => (
                      <div key={s.id} className="p-4 rounded-2xl bg-surface border border-transparent hover:border-secondary/10 transition-colors">
                        <p className="text-on-surface text-xs md:text-sm leading-relaxed italic line-clamp-2">"{s.notes}"</p>
                        <p className="text-[10px] text-on-surface-variant font-black uppercase tracking-wider font-headline mt-2">
                          — {speechStudentNameMap.get(s.student_id) || 'A delegate'}
                          {s.session_info ? `, ${s.session_info}` : ''}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Regional Spotlight */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            <div className="flex-1 relative overflow-hidden bg-primary text-on-primary rounded-[2rem] p-6 md:p-8">
              <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-on-primary/10 rounded-full blur-3xl" />
              <div className="relative z-10 flex flex-col h-full justify-between gap-6">
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-xs font-bold uppercase tracking-widest opacity-70 font-headline">
                      {zoneSpotlight.topResolution?.zone.shortLabel || '—'}
                    </span>
                    <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                  </div>
                  <h4 className="text-xl md:text-2xl font-black font-headline mb-2">Highest Resolution Rate</h4>
                  <p className="text-on-primary-container/80 text-sm leading-relaxed">
                    {zoneSpotlight.topResolution
                      ? `${zoneSpotlight.topResolution.zone.name} leads with a ${zoneSpotlight.topResolution.rate}% motion approval rate across ${zoneSpotlight.topResolution.motionsCount} motion${zoneSpotlight.topResolution.motionsCount !== 1 ? 's' : ''}.`
                      : 'No zone has decided motions yet.'}
                  </p>
                </div>
                <div className="text-3xl font-black font-headline">{zoneSpotlight.topResolution?.rate ?? 0}%</div>
              </div>
            </div>
            <div className="flex-1 bg-surface-container-highest rounded-[2rem] p-6 md:p-8 border border-outline-variant/30">
              <div className="flex justify-between items-start mb-4">
                <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant font-headline">
                  {zoneSpotlight.topTurnout?.zone.shortLabel || '—'}
                </span>
                <div className="p-2 bg-primary/5 rounded-xl text-primary">
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>groups</span>
                </div>
              </div>
              <h4 className="text-xl md:text-2xl font-black font-headline text-primary mb-2">Largest Youth Turnout</h4>
              <p className="text-on-surface-variant text-sm leading-relaxed">
                {zoneSpotlight.topTurnout
                  ? `${zoneSpotlight.topTurnout.zone.name} leads with ${zoneSpotlight.topTurnout.participants} registered delegates.`
                  : 'No delegates registered yet.'}
              </p>
              <div className="mt-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-tertiary-fixed-dim" />
                <span className="text-xs font-bold font-headline text-on-surface-variant">{zoneSpotlight.topTurnout?.participants ?? 0} Delegates</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Civic Engagement ── */}
        <div>
          <div className="text-center mb-10">
            <h3 className="font-headline text-2xl md:text-4xl font-extrabold text-primary mb-3">Civic Engagement in Numbers</h3>
            <div className="h-1 w-24 bg-secondary-container rounded-full mx-auto" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
            <div className="rounded-2xl p-5 bg-surface-container-lowest border border-outline-variant/10 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[18px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>event_available</span>
              </div>
              <div>
                <p className="text-xl md:text-2xl font-black font-headline text-on-surface leading-none">
                  {sessionsCompleted}<span className="text-on-surface-variant/40 text-sm font-bold">/{totalSessions}</span>
                </p>
                <p className="text-[9px] text-on-surface-variant font-black uppercase tracking-wider font-headline mt-1">Sessions Conducted</p>
              </div>
            </div>
            <div className="rounded-2xl p-5 bg-surface-container-lowest border border-outline-variant/10 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[18px] text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>poll</span>
              </div>
              <div>
                <p className="text-xl md:text-2xl font-black font-headline text-on-surface leading-none">{totalPolls}</p>
                <p className="text-[9px] text-on-surface-variant font-black uppercase tracking-wider font-headline mt-1">Polls Run</p>
              </div>
            </div>
            <div className="rounded-2xl p-5 bg-surface-container-lowest border border-outline-variant/10 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-tertiary/10 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[18px] text-tertiary" style={{ fontVariationSettings: "'FILL' 1" }}>how_to_vote</span>
              </div>
              <div>
                <p className="text-xl md:text-2xl font-black font-headline text-on-surface leading-none">{voterTurnout}%</p>
                <p className="text-[9px] text-on-surface-variant font-black uppercase tracking-wider font-headline mt-1">Voter Turnout</p>
                <p className="text-[9px] text-on-surface-variant/40 font-body mt-0.5">{totalVotes.toLocaleString()} votes cast</p>
              </div>
            </div>
            <div className="rounded-2xl p-5 bg-surface-container-lowest border border-outline-variant/10 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[18px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>record_voice_over</span>
              </div>
              <div>
                <p className="text-xl md:text-2xl font-black font-headline text-on-surface leading-none">{totalSpeeches}</p>
                <p className="text-[9px] text-on-surface-variant font-black uppercase tracking-wider font-headline mt-1">Speeches Recorded</p>
              </div>
            </div>
            <div className="rounded-2xl p-5 bg-surface-container-lowest border border-outline-variant/10 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[18px] text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>forum</span>
              </div>
              <div>
                <p className="text-xl md:text-2xl font-black font-headline text-on-surface leading-none">{totalChatMessages}</p>
                <p className="text-[9px] text-on-surface-variant font-black uppercase tracking-wider font-headline mt-1">Civic Square Messages</p>
              </div>
            </div>
          </div>

          {/* Resolutions: Passed vs Failed */}
          <div className="rounded-[2rem] p-8 bg-surface-container-lowest border border-outline-variant/10">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div>
                <h4 className="font-headline text-lg md:text-xl font-extrabold text-on-surface">Resolutions: Passed vs Failed</h4>
                <p className="text-xs text-on-surface-variant font-body mt-1">
                  {resolvedMotions > 0 ? `Outcomes of all ${resolvedMotions} decided motions` : 'No motions decided yet'}
                </p>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-2xl md:text-3xl font-black font-headline text-tertiary leading-none">{approvedMotions}</p>
                  <p className="text-[10px] text-on-surface-variant font-black uppercase tracking-wider font-headline mt-1">Passed</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl md:text-3xl font-black font-headline text-error leading-none">{rejectedMotions}</p>
                  <p className="text-[10px] text-on-surface-variant font-black uppercase tracking-wider font-headline mt-1">Failed</p>
                </div>
              </div>
            </div>
            <div className="w-full h-2.5 bg-surface-container rounded-full overflow-hidden flex">
              <div className="h-full bg-tertiary" style={{ width: `${passRate}%` }} />
              <div className="h-full bg-error" style={{ width: `${failRate}%` }} />
            </div>
          </div>
        </div>

        {/* ── Program Capacity & Rigor ── */}
        <div>
          <div className="text-center mb-10">
            <h3 className="font-headline text-2xl md:text-4xl font-extrabold text-primary mb-3">Program Capacity &amp; Rigor</h3>
            <div className="h-1 w-24 bg-secondary-container rounded-full mx-auto" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {capacityStats.map(stat => (
              <div key={stat.label} className="bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant/10 shadow-[0_4px_32px_0_rgba(19,41,143,0.06)] flex flex-col gap-2">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>{stat.icon}</span>
                </div>
                <div>
                  <p className="text-2xl font-black font-headline text-on-surface leading-none">{stat.value}</p>
                  <p className="text-[10px] text-on-surface-variant font-body mt-1">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Award Winners by Segment ── */}
        <div>
          <div className="text-center mb-10">
            <h3 className="font-headline text-2xl md:text-4xl font-extrabold text-primary mb-3">Award Winners by Segment</h3>
            <div className="h-1 w-24 bg-secondary-container rounded-full mx-auto" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {LEVELS.map(level => {
              const meta = LEVEL_META[level];
              const data = winnersByLevel[level];
              return (
                <div key={level} className="rounded-[2rem] p-6 bg-surface-container-lowest border border-outline-variant/10 flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-on-surface-variant/40" style={{ fontVariationSettings: "'FILL' 1" }}>{meta.icon}</span>
                      <span className="text-xs font-black uppercase tracking-wider font-headline text-on-surface-variant/50">{meta.label}</span>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider font-headline ${meta.pillCls}`}>
                      {data.count} Winner{data.count !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {data.names.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {data.names.slice(0, 8).map((name, i) => (
                        <span key={i} className={`px-3 py-1 rounded-full text-xs font-bold ${meta.chipCls}`}>{name}</span>
                      ))}
                      {data.names.length > 8 && (
                        <span className="px-3 py-1 rounded-full text-xs font-bold text-on-surface-variant/50">+{data.names.length - 8} more</span>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-on-surface-variant/60 font-body py-4">No award winners yet.</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Growth Narrative ── */}
        <div className="relative overflow-hidden bg-on-surface text-surface-container-lowest rounded-[3rem] p-8 md:p-12">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-transparent pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row items-stretch justify-between gap-10 md:gap-12">
            {/* Left */}
            <div className="md:w-1/3 flex flex-col justify-center">
              <h3 className="font-headline text-2xl md:text-4xl font-extrabold mb-4 leading-tight">The Evolution of Voice</h3>
              <p className="text-surface-container-lowest/70 text-sm md:text-base leading-relaxed font-body">
                From a simple dialogue forum to a nationwide policy-driving powerhouse — {totalDelegates} delegates trained
                across {events.length} event{events.length !== 1 ? 's' : ''} to date.
              </p>
              {!editingBaseline && (
                <button
                  onClick={() => setEditingBaseline(true)}
                  className="export-hide mt-6 self-start flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-surface-container-lowest text-xs font-bold uppercase tracking-widest font-headline transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit Baseline
                </button>
              )}

              {editingBaseline && (
                <div className="export-hide mt-6 flex flex-wrap items-end gap-3 bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/10">
                  <label className="flex flex-col gap-1 text-[10px] font-black uppercase tracking-widest text-surface-container-lowest/50 font-headline">
                    Baseline Year
                    <input
                      type="number"
                      value={baselineDraft.year}
                      onChange={e => setBaselineDraft(d => ({ ...d, year: Number(e.target.value) }))}
                      className="text-sm font-bold font-headline text-on-surface bg-white rounded-lg px-2 py-1.5 w-24 outline-none border border-white/20 focus:border-primary"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-[10px] font-black uppercase tracking-widest text-surface-container-lowest/50 font-headline">
                    Baseline Hubs
                    <input
                      type="number"
                      value={baselineDraft.hubs}
                      onChange={e => setBaselineDraft(d => ({ ...d, hubs: Number(e.target.value) }))}
                      className="text-sm font-bold font-headline text-on-surface bg-white rounded-lg px-2 py-1.5 w-24 outline-none border border-white/20 focus:border-primary"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-[10px] font-black uppercase tracking-widest text-surface-container-lowest/50 font-headline">
                    Baseline Students
                    <input
                      type="number"
                      value={baselineDraft.students}
                      onChange={e => setBaselineDraft(d => ({ ...d, students: Number(e.target.value) }))}
                      className="text-sm font-bold font-headline text-on-surface bg-white rounded-lg px-2 py-1.5 w-28 outline-none border border-white/20 focus:border-primary"
                    />
                  </label>
                  <div className="flex items-center gap-2 pb-1.5">
                    <button onClick={() => setEditingBaseline(false)} className="text-surface-container-lowest/70 hover:text-error"><X className="w-4 h-4" /></button>
                    <button onClick={saveBaseline} className="text-tertiary-fixed-dim hover:text-tertiary-fixed"><Check className="w-4 h-4" /></button>
                  </div>
                </div>
              )}
            </div>

            {/* Right */}
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Then */}
              <div className="bg-white/5 backdrop-blur-md rounded-[2rem] p-6 md:p-8 border border-white/10">
                <span className="text-secondary-fixed font-bold text-xs uppercase tracking-widest font-headline">
                  Initial Phase ({settings.baseline_year})
                </span>
                <div className="mt-6 space-y-5">
                  <div>
                    <div className="flex justify-between items-end mb-1.5">
                      <span className="text-2xl md:text-3xl font-black text-white font-headline leading-none">{settings.baseline_hubs}</span>
                      <span className="text-[10px] opacity-60 font-headline uppercase tracking-wider">Hubs</span>
                    </div>
                    <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-white/40" style={{ width: `${Math.min(100, (settings.baseline_hubs / maxHubs) * 100)}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between items-end mb-1.5">
                      <span className="text-2xl md:text-3xl font-black text-white font-headline leading-none">{settings.baseline_students}</span>
                      <span className="text-[10px] opacity-60 font-headline uppercase tracking-wider">Students</span>
                    </div>
                    <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-white/40" style={{ width: `${Math.min(100, (settings.baseline_students / maxStudents) * 100)}%` }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Now */}
              <div className="bg-primary/20 backdrop-blur-md rounded-[2rem] p-6 md:p-8 border border-primary/30">
                <span className="text-primary-fixed-dim font-bold text-xs uppercase tracking-widest font-headline">
                  Present Day ({currentYear})
                </span>
                <div className="mt-6 space-y-5">
                  <div>
                    <div className="flex justify-between items-end mb-1.5">
                      <span className="text-2xl md:text-3xl font-black text-white font-headline leading-none">{currentHubs}+</span>
                      <span className="text-[10px] opacity-60 font-headline uppercase tracking-wider">Hubs</span>
                    </div>
                    <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-tertiary-fixed-dim" style={{ width: `${Math.min(100, (currentHubs / maxHubs) * 100)}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between items-end mb-1.5">
                      <span className="text-2xl md:text-3xl font-black text-white font-headline leading-none">{totalStudents.toLocaleString()}+</span>
                      <span className="text-[10px] opacity-60 font-headline uppercase tracking-wider">Students</span>
                    </div>
                    <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-tertiary-fixed-dim" style={{ width: `${Math.min(100, (totalStudents / maxStudents) * 100)}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
