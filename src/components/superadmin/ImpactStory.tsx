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
  const posterRef = useRef<HTMLDivElement>(null);
  const pdfRef    = useRef<HTMLDivElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [exportingPoster, setExportingPoster] = useState(false);

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
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('user_type', 'student').not('event_id', 'is', null),
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

      // Normalize states: trim + case-insensitive dedup
      setStatesRepresented(
        new Set(demographics.map(d => (d.state || '').toString().trim().toLowerCase()).filter(Boolean)).size
      );

      // Normalize constituencies: trim + case dedup, then absorb shorter names that are
      // a leading-word prefix of a longer name (e.g. "Delhi" subsumed by "Delhi North").
      const normCons = [
        ...new Set(demographics.map(d => (d.constituency || '').toString().trim().toLowerCase()).filter(Boolean)),
      ].sort((a, b) => a.length - b.length);
      const uniqueCons = normCons.filter(
        (c, i) => !normCons.slice(i + 1).some(longer => longer.startsWith(c + ' '))
      );
      setConstituenciesRepresented(uniqueCons.length);

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
    const container = pdfRef.current;
    if (!container) return;
    setExportingPdf(true);
    try {
      const pdf  = new jsPDF('p', 'mm', 'a4');
      const pdfW = pdf.internal.pageSize.getWidth();   // 210 mm
      const pdfH = pdf.internal.pageSize.getHeight();  // 297 mm
      const headerH = 12; // mm — branded strip at top of every page
      const margin  = 12; // mm side / bottom margin
      const usableW = pdfW - margin * 2;
      const usableH = pdfH - headerH - margin;

      // Dedicated PDF layout captured at scale 2 — 2200px wide canvas, ~300 DPI on A4
      const fullCanvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        allowTaint: false,
      });

      const pxPerMM = fullCanvas.width / usableW;
      const pageHpx = usableH * pxPerMM;
      let renderedPx = 0;
      let pageNum    = 0;

      while (renderedPx < fullCanvas.height) {
        if (pageNum > 0) pdf.addPage();

        // Branded header bar on every page
        pdf.setFillColor(19, 41, 143);
        pdf.rect(0, 0, pdfW, headerH, 'F');
        // Rainbow accent line at very top
        const rainbowSegs = [
          [245, 158, 11], [239, 68, 68], [139, 92, 246], [6, 182, 212],
        ] as [number, number, number][];
        const segW = pdfW / rainbowSegs.length;
        rainbowSegs.forEach(([r, g, b], i) => {
          pdf.setFillColor(r, g, b);
          pdf.rect(i * segW, 0, segW, 1.5, 'F');
        });
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'bold');
        pdf.text('YOUNG INDIANS PARLIAMENT', margin, 8.5);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7);
        const dateStr = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
        pdf.text(`National Impact Report · ${dateStr} · Page ${pageNum + 1}`, pdfW - margin, 8.5, { align: 'right' });

        const sliceH = Math.min(pageHpx, fullCanvas.height - renderedPx);
        const slice  = document.createElement('canvas');
        slice.width  = fullCanvas.width;
        slice.height = sliceH;
        slice.getContext('2d')!.drawImage(
          fullCanvas, 0, renderedPx, fullCanvas.width, sliceH,
          0, 0, fullCanvas.width, sliceH
        );
        pdf.addImage(slice.toDataURL('image/png'), 'PNG', margin, headerH, usableW, sliceH / pxPerMM);
        renderedPx += sliceH;
        pageNum++;
      }

      pdf.save(`yip-impact-story-${new Date().toISOString().split('T')[0]}.pdf`);
      toast({ title: 'Impact Story exported', description: 'PDF downloaded successfully.' });
    } catch (err: any) {
      toast({ title: 'Export failed', description: err?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setExportingPdf(false);
    }
  };

  const exportPoster = async () => {
    const container = posterRef.current;
    if (!container) return;
    setExportingPoster(true);
    try {
      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#13298f',
        logging: false,
        width: 1080,
        height: 1350,
        windowWidth: 1080,
        windowHeight: 1350,
      });
      const link = document.createElement('a');
      link.download = `yip-impact-poster-${new Date().toISOString().split('T')[0]}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast({ title: 'Poster downloaded!', description: 'Share it on Instagram, WhatsApp or socials.' });
    } catch (err: any) {
      toast({ title: 'Export failed', description: err?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setExportingPoster(false);
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
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={exportPoster}
            disabled={exportingPoster}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-secondary text-on-secondary font-headline font-bold text-sm hover:bg-secondary/90 transition-colors disabled:opacity-50"
          >
            {exportingPoster ? <Loader2 className="w-4 h-4 animate-spin" /> : <span className="material-symbols-outlined text-[18px]">image</span>}
            {exportingPoster ? 'Generating…' : 'Download Poster'}
          </button>
          <button
            onClick={exportToPDF}
            disabled={exportingPdf}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-primary text-white font-headline font-bold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {exportingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {exportingPdf ? 'Exporting…' : 'Download PDF'}
          </button>
        </div>
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

      {/* ── Off-screen shareable poster (1080×1350 Instagram portrait) ── */}
      {/* All children use position:absolute with explicit px coords to avoid     */}
      {/* html2canvas miscomputing height:100% for fixed off-screen containers.   */}
      <div
        ref={posterRef}
        aria-hidden="true"
        style={{
          position: 'fixed', left: '-9999px', top: 0,
          width: '1080px', height: '1350px',
          overflow: 'hidden',
          background: 'linear-gradient(145deg, #0c1b6e 0%, #13298f 40%, #190e68 100%)',
          fontFamily: "'Plus Jakarta Sans', 'Manrope', system-ui, sans-serif",
        }}
      >
        {/* Decorative blobs */}
        <div style={{ position: 'absolute', top: -130, right: -110, width: 480, height: 480, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
        <div style={{ position: 'absolute', bottom: 80, left: -160, width: 540, height: 540, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
        <div style={{ position: 'absolute', top: 500, right: 80, width: 180, height: 180, borderRadius: '50%', background: 'rgba(251,191,36,0.07)' }} />

        {/* Rainbow top bar */}
        <div style={{ position: 'absolute', top: 0, left: 0, width: 1080, height: 7, background: 'linear-gradient(90deg,#f59e0b,#ef4444,#8b5cf6,#06b6d4)' }} />

        {/* Brand — left */}
        <div style={{ position: 'absolute', top: 55, left: 80 }}>
          <div style={{ color: '#fff', fontWeight: 900, fontSize: 28, letterSpacing: '0.05em', lineHeight: 1.1 }}>YOUNG INDIANS</div>
          <div style={{ color: '#fff', fontWeight: 900, fontSize: 28, letterSpacing: '0.05em', lineHeight: 1.1 }}>PARLIAMENT</div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, letterSpacing: '0.35em', fontWeight: 700, marginTop: 6, textTransform: 'uppercase' }}>National Impact Report</div>
        </div>

        {/* Brand — right */}
        <div style={{ position: 'absolute', top: 62, right: 80, textAlign: 'right' }}>
          <div style={{ color: '#fbbf24', fontSize: 12, fontWeight: 800, letterSpacing: '0.28em', textTransform: 'uppercase' }}>#YIPParliament</div>
          <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 6 }}>Debate · Legislate · Lead</div>
        </div>

        {/* Divider */}
        <div style={{ position: 'absolute', top: 192, left: 80, width: 920, height: 1, background: 'rgba(255,255,255,0.12)' }} />

        {/* Hero label */}
        <div style={{ position: 'absolute', top: 218, left: 80, width: 920, textAlign: 'center', color: 'rgba(255,255,255,0.45)', fontSize: 13, fontWeight: 700, letterSpacing: '0.35em', textTransform: 'uppercase' }}>
          Empowering India's Future Leaders
        </div>

        {/* Hero number */}
        <div style={{ position: 'absolute', top: 248, left: 80, width: 920, textAlign: 'center', color: '#fff', fontSize: 138, fontWeight: 900, lineHeight: 1, letterSpacing: '-0.03em' }}>
          {totalStudents.toLocaleString()}
        </div>

        {/* "Students Empowered" subtitle */}
        <div style={{ position: 'absolute', top: 400, left: 80, width: 920, textAlign: 'center', color: '#fbbf24', fontSize: 34, fontWeight: 800, letterSpacing: '0.01em' }}>
          Students Empowered
        </div>

        {/* Stats row 1 — Schools & Cities */}
        <div style={{ position: 'absolute', top: 478, left: 80, width: 452, height: 185, background: 'rgba(255,255,255,0.07)', borderRadius: 28, borderTop: '3px solid #60a5fa', padding: '32px 36px', boxSizing: 'border-box' }}>
          <div style={{ color: '#60a5fa', fontSize: 60, fontWeight: 900, lineHeight: 1, letterSpacing: '-0.02em' }}>{totalSchools.toLocaleString()}</div>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: 700, marginTop: 8, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Schools Reached</div>
        </div>
        <div style={{ position: 'absolute', top: 478, left: 548, width: 452, height: 185, background: 'rgba(255,255,255,0.07)', borderRadius: 28, borderTop: '3px solid #34d399', padding: '32px 36px', boxSizing: 'border-box' }}>
          <div style={{ color: '#34d399', fontSize: 60, fontWeight: 900, lineHeight: 1, letterSpacing: '-0.02em' }}>{cities.toLocaleString()}</div>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: 700, marginTop: 8, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Cities Covered</div>
        </div>

        {/* Stats row 2 — Bills */}
        <div style={{ position: 'absolute', top: 681, left: 80, width: 452, height: 185, background: 'rgba(255,255,255,0.07)', borderRadius: 28, borderTop: '3px solid #f472b6', padding: '32px 36px', boxSizing: 'border-box' }}>
          <div style={{ color: '#f472b6', fontSize: 60, fontWeight: 900, lineHeight: 1, letterSpacing: '-0.02em' }}>{motions.length.toLocaleString()}</div>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: 700, marginTop: 8, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Bills Documented</div>
        </div>
        <div style={{ position: 'absolute', top: 681, left: 548, width: 452, height: 185, background: 'rgba(255,255,255,0.07)', borderRadius: 28, borderTop: '3px solid #fbbf24', padding: '32px 36px', boxSizing: 'border-box' }}>
          <div style={{ color: '#fbbf24', fontSize: 60, fontWeight: 900, lineHeight: 1, letterSpacing: '-0.02em' }}>{approvedMotions.toLocaleString()}</div>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: 700, marginTop: 8, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Bills Passed</div>
        </div>

        {/* Secondary strip — 4 equal boxes (each ≈ 219px, 14px gaps, 80px margins) */}
        {[
          { label: 'States',        value: statesRepresented  },
          { label: 'Sessions Done', value: sessionsCompleted  },
          { label: 'Approval Rate', value: `${approvalRate}%` },
          { label: 'City Chapters', value: cities             },
        ].map((s, i) => (
          <div key={s.label} style={{
            position: 'absolute', top: 898,
            left: 80 + i * 233,
            width: 219, height: 112,
            background: 'rgba(255,255,255,0.06)', borderRadius: 20,
            border: '1px solid rgba(255,255,255,0.08)',
            textAlign: 'center', boxSizing: 'border-box', padding: '18px 10px',
          }}>
            <div style={{ color: '#fff', fontSize: 32, fontWeight: 900, lineHeight: 1 }}>{s.value}</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 700, marginTop: 6, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{s.label}</div>
          </div>
        ))}

        {/* Tagline */}
        <div style={{ position: 'absolute', top: 1060, left: 80, width: 920, textAlign: 'center', color: 'rgba(255,255,255,0.22)', fontSize: 18, fontWeight: 800, letterSpacing: '0.25em', textTransform: 'uppercase' }}>
          DEBATE &nbsp;·&nbsp; LEGISLATE &nbsp;·&nbsp; LEAD
        </div>

        {/* Footer divider */}
        <div style={{ position: 'absolute', top: 1268, left: 80, width: 920, height: 1, background: 'rgba(255,255,255,0.1)' }} />

        {/* Footer left */}
        <div style={{ position: 'absolute', top: 1287, left: 80, color: 'rgba(255,255,255,0.35)', fontSize: 12, fontWeight: 600, letterSpacing: '0.06em' }}>
          Young Indians Parliament · CII
        </div>

        {/* Footer right */}
        <div style={{ position: 'absolute', top: 1291, right: 80, display: 'flex', alignItems: 'center', gap: 7 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e' }} />
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600 }}>Live Data</div>
        </div>
      </div>

      {/* ── Off-screen PDF layout (1100px fixed width, no Tailwind — all inline styles) ─────────
           Normal flow layout so html2canvas derives height from content, not percentage.
           Captured by exportToPDF(); sliced into A4 pages with a jsPDF header overlay.        */}
      <div
        ref={pdfRef}
        aria-hidden="true"
        style={{
          position: 'fixed', left: '-9999px', top: 0,
          width: '1100px',
          backgroundColor: '#ffffff',
          fontFamily: "'Plus Jakarta Sans', 'Manrope', system-ui, sans-serif",
        }}
      >
        {/* ── Hero ── */}
        <div style={{ background: 'linear-gradient(135deg, #081552 0%, #13298f 55%, #1e40af 100%)', padding: '52px 56px 44px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 44 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 14px', borderRadius: 100, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.08)', marginBottom: 20 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} />
                <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.25em' }}>Live National Impact</span>
              </div>
              <div style={{ color: '#ffffff', fontSize: 50, fontWeight: 900, lineHeight: 1.05, letterSpacing: '-0.02em', marginBottom: 20 }}>
                {totalStudents.toLocaleString()}+<br />
                <span style={{ color: '#86efac' }}>Future Leaders</span><br />
                Empowered
              </div>
              <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 14, fontWeight: 500, lineHeight: 1.7, maxWidth: 420 }}>
                Across{' '}
                <span style={{ color: '#fff', fontWeight: 700 }}>{totalSchools} schools</span>
                {' '}and{' '}
                <span style={{ color: '#fff', fontWeight: 700 }}>{cities} cities</span>,
                {' '}YIP Parliament gives young Indians a real chamber to debate, legislate, and lead — from city hubs to the National Summit.
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 8 }}>
              {[
                { v: motions.length.toLocaleString(), l: 'Bills Documented', c: '#93c5fd' },
                { v: approvedMotions.toLocaleString(), l: 'Bills Passed', c: '#86efac' },
                { v: `${approvalRate}%`, l: 'Approval Rate', c: '#fbbf24' },
              ].map(s => (
                <div key={s.l} style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 18, padding: '20px 28px', border: '1px solid rgba(255,255,255,0.15)', minWidth: 192 }}>
                  <div style={{ color: s.c, fontSize: 34, fontWeight: 900, lineHeight: 1 }}>{s.v}</div>
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', marginTop: 8 }}>{s.l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Foundation Stats ── */}
        <div style={{ padding: '28px 56px', background: '#f2f4f6', borderBottom: '1px solid #e0e3e5' }}>
          <div style={{ display: 'flex', gap: 14 }}>
            {foundationStats.map(s => (
              <div key={s.label} style={{ flex: 1, background: '#ffffff', borderRadius: 14, padding: '20px 22px', border: '1px solid #e6e8ea' }}>
                <div style={{ fontSize: 28, fontWeight: 900, color: '#13298f', lineHeight: 1, marginBottom: 7 }}>{s.value}</div>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: '#757684', textTransform: 'uppercase', letterSpacing: '0.09em' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Reach Across the Network ── */}
        <div style={{ padding: '40px 56px', background: '#ffffff' }}>
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 21, fontWeight: 800, color: '#13298f', letterSpacing: '-0.01em' }}>Reach Across the Network</div>
            <div style={{ width: 48, height: 3, borderRadius: 2, background: '#ac3509', marginTop: 8 }} />
          </div>
          <div style={{ display: 'flex', gap: 18 }}>
            {[
              { value: participantsByLevel.city,     label: 'City Hub Delegates',   sub: `${cityEvents.length} events across ${cities} cities`, c: '#13298f', bg: '#e8ecf8', bc: '#c7d0ef' },
              { value: participantsByLevel.regional,  label: 'Regional Delegates',   sub: `${regionalEvents.length} regional assemblies`,         c: '#ac3509', bg: '#fdf0ec', bc: '#f4c5b5' },
              { value: participantsByLevel.national,  label: 'National Delegates',   sub: `${nationalEvents.length} national events`,             c: '#003e29', bg: '#e8f5ee', bc: '#b5ddc7' },
            ].map(col => (
              <div key={col.label} style={{ flex: 1, borderRadius: 18, padding: '28px 28px', background: col.bg, border: `1px solid ${col.bc}` }}>
                <div style={{ fontSize: 42, fontWeight: 900, color: col.c, lineHeight: 1 }}>{col.value.toLocaleString()}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: col.c, textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 12, marginBottom: 8 }}>{col.label}</div>
                <div style={{ fontSize: 11, color: '#454653', fontWeight: 500 }}>{col.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Civic Engagement in Numbers ── */}
        <div style={{ padding: '40px 56px', background: '#f7f9fb' }}>
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 21, fontWeight: 800, color: '#13298f', letterSpacing: '-0.01em' }}>Civic Engagement in Numbers</div>
            <div style={{ width: 48, height: 3, borderRadius: 2, background: '#ac3509', marginTop: 8 }} />
          </div>
          <div style={{ display: 'flex', gap: 14 }}>
            {[
              { v: `${sessionsCompleted}/${totalSessions}`, l: 'Sessions Conducted', c: '#13298f' },
              { v: totalPolls,                              l: 'Polls Run',           c: '#ac3509' },
              { v: `${voterTurnout}%`,                     l: 'Voter Turnout',       c: '#003e29' },
              { v: totalSpeeches,                          l: 'Speeches Recorded',   c: '#13298f' },
              { v: totalChatMessages,                      l: 'Civic Square Msgs',   c: '#ac3509' },
            ].map(s => (
              <div key={s.l} style={{ flex: 1, background: '#ffffff', borderRadius: 14, padding: '20px 18px', border: '1px solid #e6e8ea', textAlign: 'center' }}>
                <div style={{ fontSize: 26, fontWeight: 900, color: s.c, lineHeight: 1, marginBottom: 8 }}>{s.v}</div>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: '#757684', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Inside the Chamber ── */}
        <div style={{ padding: '40px 56px', background: '#ffffff' }}>
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 21, fontWeight: 800, color: '#13298f', letterSpacing: '-0.01em' }}>Inside the Chamber</div>
            <div style={{ width: 48, height: 3, borderRadius: 2, background: '#ac3509', marginTop: 8 }} />
          </div>
          <div style={{ display: 'flex', gap: 14, marginBottom: 24 }}>
            {[
              { v: motions.length,   l: 'Total Motions', c: '#191c1e' },
              { v: approvedMotions,  l: 'Passed',        c: '#003e29' },
              { v: pendingMotions,   l: 'Under Review',  c: '#ac3509' },
              { v: rejectedMotions,  l: 'Rejected',      c: '#ba1a1a' },
            ].map(s => (
              <div key={s.l} style={{ flex: 1, background: '#f7f9fb', borderRadius: 14, padding: '18px 20px', border: '1px solid #e6e8ea', textAlign: 'center' }}>
                <div style={{ fontSize: 30, fontWeight: 900, color: s.c, lineHeight: 1, marginBottom: 6 }}>{s.v}</div>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: '#757684', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.l}</div>
              </div>
            ))}
          </div>
          <div style={{ background: '#f2f4f6', borderRadius: 12, padding: '20px 24px', marginBottom: recentMotions.length > 0 ? 20 : 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#191c1e' }}>Resolutions: Passed vs Failed</div>
              <div style={{ display: 'flex', gap: 20 }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 20, fontWeight: 900, color: '#003e29', lineHeight: 1 }}>{approvedMotions}</div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: '#757684', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 2 }}>Passed</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 20, fontWeight: 900, color: '#ba1a1a', lineHeight: 1 }}>{rejectedMotions}</div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: '#757684', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 2 }}>Failed</div>
                </div>
              </div>
            </div>
            <div style={{ height: 10, borderRadius: 5, overflow: 'hidden', background: '#e0e3e5', display: 'flex' }}>
              <div style={{ height: '100%', background: '#003e29', width: `${passRate}%` }} />
              <div style={{ height: '100%', background: '#ba1a1a', width: `${failRate}%` }} />
            </div>
          </div>
          {recentMotions.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#454653', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Recent Motions</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {recentMotions.map(m => {
                  const display = STATUS_DISPLAY[m.status] ?? STATUS_DISPLAY.pending;
                  return (
                    <div key={m.id} style={{ background: '#f7f9fb', borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#191c1e', marginBottom: 4 }}>{m.subject}</div>
                        <div style={{ fontSize: 11, color: '#757684', lineHeight: 1.5 }}>
                          {m.details ? m.details.slice(0, 120) + (m.details.length > 120 ? '…' : '') : 'Raised in an event — awaiting committee review.'}
                        </div>
                      </div>
                      <div style={{ flexShrink: 0, padding: '4px 10px', borderRadius: 6, background: '#e8ecf8', fontSize: 9, fontWeight: 700, color: '#13298f', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        {display.label}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Diversity & Representation ── */}
        <div style={{ padding: '40px 56px', background: '#f7f9fb' }}>
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 21, fontWeight: 800, color: '#13298f', letterSpacing: '-0.01em' }}>Diversity & Representation</div>
            <div style={{ width: 48, height: 3, borderRadius: 2, background: '#ac3509', marginTop: 8 }} />
          </div>
          <div style={{ display: 'flex', gap: 14 }}>
            {diversityStats.map(s => (
              <div key={s.label} style={{ flex: 1, background: '#ffffff', borderRadius: 14, padding: '20px 22px', border: '1px solid #e6e8ea' }}>
                <div style={{ fontSize: 28, fontWeight: 900, color: '#13298f', lineHeight: 1, marginBottom: 7 }}>{s.value}</div>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: '#757684', textTransform: 'uppercase', letterSpacing: '0.09em' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Program Capacity & Rigor ── */}
        <div style={{ padding: '40px 56px', background: '#ffffff' }}>
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 21, fontWeight: 800, color: '#13298f', letterSpacing: '-0.01em' }}>Program Capacity & Rigor</div>
            <div style={{ width: 48, height: 3, borderRadius: 2, background: '#ac3509', marginTop: 8 }} />
          </div>
          <div style={{ display: 'flex', gap: 14 }}>
            {capacityStats.map(s => (
              <div key={s.label} style={{ flex: 1, background: '#f7f9fb', borderRadius: 14, padding: '20px 22px', border: '1px solid #e6e8ea' }}>
                <div style={{ fontSize: 28, fontWeight: 900, color: '#13298f', lineHeight: 1, marginBottom: 7 }}>{s.value}</div>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: '#757684', textTransform: 'uppercase', letterSpacing: '0.09em' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Award Winners by Segment ── */}
        <div style={{ padding: '40px 56px', background: '#f7f9fb' }}>
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 21, fontWeight: 800, color: '#13298f', letterSpacing: '-0.01em' }}>Award Winners by Segment</div>
            <div style={{ width: 48, height: 3, borderRadius: 2, background: '#ac3509', marginTop: 8 }} />
          </div>
          <div style={{ display: 'flex', gap: 18 }}>
            {LEVELS.map(level => {
              const meta  = LEVEL_META[level];
              const data  = winnersByLevel[level];
              const lc: Record<string, string> = { city: '#13298f', regional: '#ac3509', national: '#003e29' };
              const lbg: Record<string, string> = { city: '#e8ecf8', regional: '#fdf0ec', national: '#e8f5ee' };
              return (
                <div key={level} style={{ flex: 1, background: '#ffffff', borderRadius: 18, padding: '24px 24px', border: '1px solid #e6e8ea' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#454653', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{meta.label}</div>
                    <div style={{ padding: '3px 10px', borderRadius: 100, background: lbg[level], fontSize: 10, fontWeight: 700, color: lc[level] }}>
                      {data.count} Winner{data.count !== 1 ? 's' : ''}
                    </div>
                  </div>
                  {data.names.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {data.names.slice(0, 6).map((name, i) => (
                        <span key={i} style={{ padding: '4px 10px', borderRadius: 100, background: lbg[level], fontSize: 11, fontWeight: 600, color: lc[level] }}>{name}</span>
                      ))}
                      {data.names.length > 6 && (
                        <span style={{ padding: '4px 10px', borderRadius: 100, background: '#f2f4f6', fontSize: 11, fontWeight: 600, color: '#757684' }}>+{data.names.length - 6} more</span>
                      )}
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: '#757684' }}>No award winners yet.</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Growth Narrative ── */}
        <div style={{ background: '#0f172a', padding: '40px 56px' }}>
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 21, fontWeight: 800, color: '#ffffff', letterSpacing: '-0.01em' }}>The Evolution of Voice</div>
            <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, fontWeight: 500, marginTop: 8, lineHeight: 1.6 }}>
              From a dialogue forum to a nationwide policy-driving powerhouse — {totalDelegates} delegates trained across {events.length} event{events.length !== 1 ? 's' : ''}.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 20 }}>
            <div style={{ flex: 1, background: 'rgba(255,255,255,0.07)', borderRadius: 18, padding: '24px 28px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: 20 }}>Initial Phase ({settings.baseline_year})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                {[
                  { val: settings.baseline_hubs,     label: 'Hubs',     pct: Math.min(100, (settings.baseline_hubs / maxHubs) * 100) },
                  { val: settings.baseline_students,  label: 'Students', pct: Math.min(100, (settings.baseline_students / maxStudents) * 100) },
                ].map(row => (
                  <div key={row.label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 }}>
                      <span style={{ fontSize: 32, fontWeight: 900, color: '#fff', lineHeight: 1 }}>{row.val}</span>
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase' }}>{row.label}</span>
                    </div>
                    <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', background: 'rgba(255,255,255,0.4)', width: `${row.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ flex: 1, background: 'rgba(19,41,143,0.4)', borderRadius: 18, padding: '24px 28px', border: '1px solid rgba(99,130,255,0.25)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#86efac', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: 20 }}>Present Day ({currentYear})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                {[
                  { val: `${currentHubs}+`,                   label: 'Hubs',     pct: Math.min(100, (currentHubs / maxHubs) * 100) },
                  { val: `${totalStudents.toLocaleString()}+`, label: 'Students', pct: Math.min(100, (totalStudents / maxStudents) * 100) },
                ].map(row => (
                  <div key={row.label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 }}>
                      <span style={{ fontSize: 32, fontWeight: 900, color: '#fff', lineHeight: 1 }}>{row.val}</span>
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase' }}>{row.label}</span>
                    </div>
                    <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', background: '#86efac', width: `${row.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div style={{ padding: '20px 56px', background: '#13298f', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: 700 }}>Young Indians Parliament · CII</div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>
            Generated from live data · {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e' }} />
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 600 }}>Live Data</div>
          </div>
        </div>
      </div>

    </div>
  );
};
