import { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface LeaderboardEntry {
  user_id: string;
  name: string;
  position: string;
  party_number: number;
  constituency: string;
  state: string;
  city: string;
  photo_url?: string;
  preevent_scores: number;
  jury_average_score: number;
  jury_converted_score: number;
  final_total_score: number;
  assessment_count: number;
  jury_count_submitted: number;
  award_ids: string[];
  serial_number: number;
  original_rank: number;
  missing_jury_assessments?: string[];
  organizer_manual_score?: number;
  session_names?: string[];
}

interface JuryMember {
  user_id: string;
  name: string;
}

interface Award {
  id: string;
  name: string;
  description: string;
}

interface AwardVote {
  award_id: string;
  student_id: string;
  jury_id: string;
  award_name: string;
}

// Stores the student_awards row id (for deletion) alongside the award definition id and name
interface StudentAwardEntry {
  recordId: string;
  awardId: string;
  name: string;
}

// ── Design helpers ─────────────────────────────────────────────────────────────
const PARTY_COLORS: Record<number, string> = {
  0: 'bg-error-container text-on-error-container',
  1: 'bg-primary-fixed text-on-primary-fixed-variant',
  2: 'bg-secondary-fixed text-on-secondary-fixed-variant',
  3: 'bg-tertiary-fixed/30 text-tertiary-container',
  4: 'bg-primary-fixed-dim/30 text-on-primary-fixed-variant',
};
const partyColor = (n: number) => PARTY_COLORS[n] ?? 'bg-surface-container text-on-surface-variant';
const partyLabel = (n: number) => (['No Party', 'A', 'B', 'C', 'D', 'E'] as const)[n] ?? String(n);
const isSpecialRole = (position: string) =>
  position.toLowerCase().includes('admin') || position.toLowerCase().includes('journalist');

const ITEMS_PER_PAGE = 20;

// ── FilterPill ─────────────────────────────────────────────────────────────────
const FilterPill = ({
  active, onClick, icon, label,
}: {
  active: boolean; onClick: () => void; icon?: string; label: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[11px] font-black font-headline uppercase tracking-wide transition-all ${
      active
        ? 'bg-gradient-to-r from-primary to-primary-container text-white shadow-[0_2px_8px_rgba(19,41,143,0.25)]'
        : 'bg-surface-container-lowest border border-outline-variant/20 hover:border-primary/20 hover:text-primary text-on-surface-variant'
    }`}
  >
    {icon && <span className="material-symbols-outlined text-[12px]">{icon}</span>}
    {label}
  </button>
);

// ── PodiumCard ─────────────────────────────────────────────────────────────────
const PODIUM_CONFIG = {
  1: {
    icon: 'workspace_premium', iconColor: 'text-amber-500', animate: true,
    ring: 'ring-4 ring-amber-300/70', bg: 'bg-gradient-to-b from-amber-50 to-white',
    border: 'border-2 border-amber-200', scoreBg: 'bg-gradient-to-r from-amber-500 to-orange-400',
    label: '1st Place', labelColor: 'text-amber-600', cardScale: 'scale-105 z-10',
  },
  2: {
    icon: 'military_tech', iconColor: 'text-slate-400', animate: false,
    ring: 'ring-2 ring-slate-200', bg: 'bg-gradient-to-b from-slate-50 to-white',
    border: 'border border-slate-200', scoreBg: 'bg-gradient-to-r from-slate-500 to-slate-400',
    label: '2nd Place', labelColor: 'text-slate-500', cardScale: '',
  },
  3: {
    icon: 'emoji_events', iconColor: 'text-orange-600', animate: false,
    ring: 'ring-2 ring-orange-200', bg: 'bg-gradient-to-b from-orange-50 to-white',
    border: 'border border-orange-200', scoreBg: 'bg-gradient-to-r from-orange-600 to-amber-500',
    label: '3rd Place', labelColor: 'text-orange-600', cardScale: '',
  },
} as const;

const PodiumCard = ({
  entry, rank, awards, onAwardClick,
}: {
  entry: LeaderboardEntry;
  rank: 1 | 2 | 3;
  awards: StudentAwardEntry[];
  onAwardClick: () => void;
}) => {
  const cfg = PODIUM_CONFIG[rank];
  const initials = entry.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className={`${cfg.cardScale} ${cfg.bg} ${cfg.border} rounded-[2rem] p-6 flex flex-col items-center text-center shadow-sm`}>
      <span
        className={`material-symbols-outlined ${cfg.iconColor} ${cfg.animate ? 'animate-bounce' : ''}`}
        style={{ fontSize: '2.5rem', fontVariationSettings: "'FILL' 1" }}
      >
        {cfg.icon}
      </span>

      <div className={`mt-3 w-20 h-20 rounded-[1.5rem] overflow-hidden ${cfg.ring} shrink-0`}>
        {entry.photo_url ? (
          <img src={entry.photo_url} alt={entry.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-primary/10 flex items-center justify-center">
            <span className="text-xl font-headline font-bold text-primary">{initials}</span>
          </div>
        )}
      </div>

      <h3 className="mt-3 text-base font-headline font-black text-on-surface leading-tight">{entry.name}</h3>
      <p className="text-[11px] text-on-surface-variant font-body mt-0.5">{entry.position}</p>

      <span className={`mt-2 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest rounded-md font-headline ${partyColor(entry.party_number)}`}>
        Party {partyLabel(entry.party_number)}
      </span>

      {entry.constituency && (
        <p className="mt-1.5 text-[10px] text-on-surface-variant/60 font-body flex items-center gap-1">
          <span className="material-symbols-outlined text-[11px]">location_on</span>
          {entry.constituency}
        </p>
      )}

      <div className={`mt-4 ${cfg.scoreBg} text-white rounded-2xl px-6 py-2 shadow-sm`}>
        <span className="text-2xl font-headline font-black tabular-nums">{entry.final_total_score?.toFixed(1) || '0.0'}</span>
        <span className="text-[11px] ml-1 opacity-80">/ 100</span>
      </div>
      <p className={`mt-1.5 text-[10px] font-black uppercase tracking-widest font-headline ${cfg.labelColor}`}>{cfg.label}</p>

      {/* Assigned awards */}
      {awards.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1 justify-center">
          {awards.slice(0, 2).map(award => (
            <span key={award.recordId} className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[9px] font-black uppercase tracking-wide rounded-full font-headline">
              ★ {award.name}
            </span>
          ))}
          {awards.length > 2 && (
            <span className="px-2 py-0.5 bg-surface-container text-on-surface-variant text-[9px] font-black rounded-full font-headline">
              +{awards.length - 2}
            </span>
          )}
        </div>
      )}

      {/* Award action */}
      <button
        type="button"
        onClick={e => { e.stopPropagation(); onAwardClick(); }}
        className="mt-3 flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[11px] font-black font-headline uppercase tracking-wide bg-surface-container-lowest border border-outline-variant/20 hover:border-primary/20 hover:text-primary text-on-surface-variant transition-all"
      >
        <span className="material-symbols-outlined text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }}>workspace_premium</span>
        Manage Awards
      </button>
    </div>
  );
};

// ── Main ───────────────────────────────────────────────────────────────────────
export const OrganizerLeaderboard = () => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [awards, setAwards] = useState<Award[]>([]);
  const [awardVotes, setAwardVotes] = useState<AwardVote[]>([]);
  const [studentAwards, setStudentAwards] = useState<Record<string, StudentAwardEntry[]>>({});
  const [juryMembers, setJuryMembers] = useState<JuryMember[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [partyFilter, setPartyFilter] = useState('');
  const [positionFilter, setPositionFilter] = useState('');
  const [assessmentStatusFilter, setAssessmentStatusFilter] = useState('');
  const [sessionFilter, setSessionFilter] = useState('');
  const [sessionOptions, setSessionOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [specialRoleIds, setSpecialRoleIds] = useState<Set<string>>(new Set());

  // Award modal state
  const [awardModalStudent, setAwardModalStudent] = useState<LeaderboardEntry | null>(null);
  const [isAssigningAward, setIsAssigningAward] = useState(false);
  const [orgSelectedAwardId, setOrgSelectedAwardId] = useState<string>('');

  // Filter panel visibility
  const [showFilters, setShowFilters] = useState(false);

  const { toast } = useToast();

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, cityFilter, partyFilter, positionFilter, assessmentStatusFilter, sessionFilter]);

  // ESC to close award modal + reset selection on open
  useEffect(() => {
    setOrgSelectedAwardId('');
    if (!awardModalStudent) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setAwardModalStudent(null); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [awardModalStudent]);

  useEffect(() => {
    fetchData();
    setupRealtimeSubscriptions();
  }, []);

  const fetchData = async () => {
    try {
      const { data: leaderboardData, error: leaderboardError } = await supabase
        .from('organizer_leaderboard')
        .select('*');
      if (leaderboardError) throw leaderboardError;

      const { data: manualScoreData, error: manualScoreError } = await supabase
        .from('profiles')
        .select('user_id, organizer_manual_score')
        .in('user_id', leaderboardData?.map(entry => entry.user_id) || []);
      if (manualScoreError) throw manualScoreError;

      const manualScoreMap = new Map();
      manualScoreData?.forEach(profile => {
        manualScoreMap.set(profile.user_id, profile.organizer_manual_score);
      });

      const { data: juryData, error: juryError } = await supabase
        .from('profiles')
        .select('user_id, name')
        .eq('user_type', 'jury');
      if (juryError) throw juryError;
      setJuryMembers(juryData || []);

      const studentIds = leaderboardData?.map(entry => entry.user_id) || [];
      const { data: assessmentsData, error: assessmentsError } = await supabase
        .from('assessments')
        .select('student_id, jury_id, status, session_id')
        .in('student_id', studentIds);
      if (assessmentsError) throw assessmentsError;

      const { data: sessionsData, error: sessionsError } = await supabase
        .from('session_items')
        .select('id, title');
      if (sessionsError) throw sessionsError;

      const { data: sessionSubmissionsData, error: sessionSubmissionsError } = await supabase
        .from('assessments')
        .select('session_id')
        .not('session_id', 'is', null);
      if (sessionSubmissionsError) throw sessionSubmissionsError;

      const uniqueSessionIds = [...new Set(sessionSubmissionsData?.map(a => a.session_id))];
      const sessionTitleMap = new Map<string, string>();
      sessionsData?.forEach(session => { sessionTitleMap.set(session.id, session.title); });

      const sessionsWithSubmissions = uniqueSessionIds
        .map(id => sessionTitleMap.get(id))
        .filter(Boolean) as string[];
      setSessionOptions(sessionsWithSubmissions.sort());

      const studentSessionsMap = new Map<string, Set<string>>();
      assessmentsData?.forEach(assessment => {
        if (assessment.session_id) {
          const sessionName = sessionTitleMap.get(assessment.session_id);
          if (sessionName) {
            if (!studentSessionsMap.has(assessment.student_id)) {
              studentSessionsMap.set(assessment.student_id, new Set<string>());
            }
            studentSessionsMap.get(assessment.student_id)!.add(sessionName);
          }
        }
      });

      const userIds = leaderboardData?.map(entry => entry.user_id) || [];
      const { data: serialData, error: serialError } = await supabase
        .from('profiles')
        .select('user_id, serial_number')
        .in('user_id', userIds);
      if (serialError) throw serialError;

      const serialNumberMap = new Map();
      serialData?.forEach(profile => { serialNumberMap.set(profile.user_id, profile.serial_number); });

      const submittedAssessments = new Set();
      assessmentsData?.forEach(assessment => {
        if (assessment.status === 'submitted') {
          submittedAssessments.add(`${assessment.student_id}-${assessment.jury_id}`);
        }
      });

      const sortedLeaderboard = leaderboardData?.sort((a, b) => (b.final_total_score || 0) - (a.final_total_score || 0)) || [];
      const processedLeaderboard = sortedLeaderboard.map((entry, index) => {
        const missingJuryAssessments = juryData?.filter(jury =>
          !submittedAssessments.has(`${entry.user_id}-${jury.user_id}`)
        ).map(jury => jury.name) || [];
        return {
          ...entry,
          original_rank: index + 1,
          missing_jury_assessments: missingJuryAssessments,
          organizer_manual_score: manualScoreMap.get(entry.user_id) || 0,
          session_names: Array.from(studentSessionsMap.get(entry.user_id) || new Set<string>()),
        };
      });
      setLeaderboard(processedLeaderboard);

      const { data: specialIds } = await supabase.rpc('get_non_scoreable_student_ids');
      setSpecialRoleIds(new Set<string>((specialIds as string[] | null) || []));

      const { data: awardsData, error: awardsError } = await supabase
        .from('awards').select('*').order('name');
      if (awardsError) throw awardsError;

      const { data: votesData, error: votesError } = await supabase
        .from('award_votes')
        .select('award_id, student_id, jury_id, awards (name)');
      if (votesError) throw votesError;

      // Fetch student_awards with both the record id, award_id, and award name
      const { data: studentAwardsData, error: studentAwardsError } = await supabase
        .from('student_awards')
        .select('id, award_id, student_id, awards (id, name)');
      if (studentAwardsError) throw studentAwardsError;

      setAwards(awardsData || []);
      setAwardVotes(votesData?.map(vote => ({
        award_id: vote.award_id,
        student_id: vote.student_id,
        jury_id: vote.jury_id,
        award_name: (vote.awards as any)?.name || '',
      })) || []);

      // Build studentAwards with recordId, awardId, and name for each assignment
      const groupedAwards: Record<string, StudentAwardEntry[]> = {};
      studentAwardsData?.forEach(sa => {
        if (!groupedAwards[sa.student_id]) groupedAwards[sa.student_id] = [];
        groupedAwards[sa.student_id].push({
          recordId: sa.id,
          awardId: sa.award_id,
          name: (sa.awards as any)?.name || '',
        });
      });
      setStudentAwards(groupedAwards);

    } catch (error) {
      console.error('Error fetching data:', error);
      toast({ title: 'Error', description: 'Failed to load leaderboard data', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscriptions = () => {
    const channel = supabase
      .channel('organizer-leaderboard-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assessments' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'award_votes' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'student_awards' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'awards' }, fetchData)
      .subscribe();
    return () => supabase.removeChannel(channel);
  };

  const getVoteCount = (awardId: string, studentId: string) =>
    awardVotes.filter(v => v.award_id === awardId && v.student_id === studentId).length;

  const getAssessmentStatus = (entry: LeaderboardEntry) => {
    const totalJury = juryMembers.length;
    if (entry.assessment_count === 0) return 'not-assessed';
    if (entry.assessment_count < totalJury) return 'partially-assessed';
    return 'fully-assessed';
  };

  // ── Award actions ─────────────────────────────────────────────────────────────
  const assignAwardToStudent = async (studentId: string, awardId: string) => {
    const alreadyAssigned = (studentAwards[studentId] || []).some(a => a.awardId === awardId);
    if (alreadyAssigned) return;
    setIsAssigningAward(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('student_awards').insert([{
        award_id: awardId,
        student_id: studentId,
        assigned_by_jury_consensus: false,
        assigned_by_organizer: true,
        assigned_by_user_id: user?.id,
      }]);
      if (error) throw error;
      toast({ title: 'Award Assigned', description: 'Award assigned successfully' });
      await fetchData();
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Failed to assign award', variant: 'destructive' });
    } finally {
      setIsAssigningAward(false);
    }
  };

  const removeAwardFromStudent = async (recordId: string) => {
    try {
      const { error } = await supabase.from('student_awards').delete().eq('id', recordId);
      if (error) throw error;
      toast({ title: 'Award Removed', description: 'Award assignment removed' });
      await fetchData();
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Failed to remove award', variant: 'destructive' });
    }
  };

  // ── Derived values ────────────────────────────────────────────────────────────
  // Normalize positions so "Delegate" and "Member of Parliament" merge into one bucket
  // and any admin-role position shows as "Admin Student"
  const normalizePosition = (pos: string) => {
    const p = (pos || '').toLowerCase().trim();
    if (p === 'delegate' || p === 'member of parliament' || p === 'mp') return 'Member of Parliament';
    if (p.includes('admin')) return 'Admin Student';
    return pos;
  };

  const getDisplayPosition = (entry: LeaderboardEntry) =>
    specialRoleIds.has(entry.user_id) ? 'Admin Student' : normalizePosition(entry.position);

  // Normalize city: trim + title-case so "madurai" and "Madurai" merge into one bucket
  const normalizeCity = (city: string) =>
    (city || '').trim().replace(/\b\w/g, c => c.toUpperCase());

  const uniqueCities = [...new Set(leaderboard.map(e => normalizeCity(e.city)).filter(Boolean))].sort();
  const uniqueParties = [...new Set(leaderboard.map(e => e.party_number))].sort((a, b) => a - b);
  const uniquePositions = [...new Set(leaderboard.map(e => getDisplayPosition(e)))].sort();
  const hasRealScores = leaderboard.some(e => (e.final_total_score ?? 0) > 0);

  const filteredLeaderboard = leaderboard.filter(entry => {
    const q = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm || (
      entry.name.toLowerCase().includes(q) ||
      entry.position.toLowerCase().includes(q) ||
      entry.constituency?.toLowerCase().includes(q) ||
      entry.city?.toLowerCase().includes(q) ||
      entry.serial_number.toString().includes(q)
    );
    const matchesCity = !cityFilter || normalizeCity(entry.city) === cityFilter;
    const matchesParty = !partyFilter || entry.party_number.toString() === partyFilter;
    const matchesPosition = !positionFilter || getDisplayPosition(entry) === positionFilter;
    const matchesSession = !sessionFilter || (entry.session_names && entry.session_names.includes(sessionFilter));
    const matchesStatus = !assessmentStatusFilter || getAssessmentStatus(entry) === assessmentStatusFilter;
    return matchesSearch && matchesCity && matchesParty && matchesPosition && matchesSession && matchesStatus;
  });

  const totalStudents = leaderboard.length;
  const topScore = leaderboard.length > 0 ? Math.round(leaderboard[0].final_total_score) : 0;
  const avgPerformance = leaderboard.length > 0
    ? (leaderboard.reduce((s, e) => s + e.final_total_score, 0) / leaderboard.length).toFixed(1)
    : '—';
  const awardsGiven = Object.values(studentAwards).reduce((s, a) => s + a.length, 0);

  const top3 = filteredLeaderboard.slice(0, 3);
  const totalPages = Math.ceil(filteredLeaderboard.length / ITEMS_PER_PAGE);
  const paginatedLeaderboard = filteredLeaderboard.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  const hasActiveFilters = !!(searchTerm || cityFilter || partyFilter || positionFilter || assessmentStatusFilter || sessionFilter);
  const activeFilterCount = [cityFilter, partyFilter, positionFilter, assessmentStatusFilter, sessionFilter].filter(Boolean).length;
  const clearFilters = () => {
    setSearchTerm(''); setCityFilter(''); setPartyFilter('');
    setPositionFilter(''); setAssessmentStatusFilter(''); setSessionFilter('');
  };

  const statusBadge = (status: string) => {
    if (status === 'fully-assessed') return 'bg-tertiary-fixed/30 text-on-tertiary-fixed-variant';
    if (status === 'partially-assessed') return 'bg-secondary-fixed/30 text-on-secondary-fixed-variant';
    return 'bg-error-container/30 text-on-error-container';
  };
  const statusLabel = (status: string) => {
    if (status === 'fully-assessed') return 'Validated';
    if (status === 'partially-assessed') return 'Partial';
    return 'Pending';
  };

  // ── Loading ───────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-4">
          <div className="w-14 h-14 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-on-surface-variant font-headline font-black uppercase tracking-widest">Loading Leaderboard…</p>
        </div>
      </div>
    );
  }

  // ── Export functions ─────────────────────────────────────────────────────────
  const exportToCSV = () => {
    const exportData = filteredLeaderboard.map(entry => ({
      Rank: hasRealScores ? entry.original_rank : '',
      Name: entry.name,
      Position: entry.position,
      Party: `Party ${entry.party_number}`,
      'Pre-Event Score (60)': entry.preevent_scores?.toFixed(2) || '0.00',
      'Jury Score (40)': entry.jury_converted_score?.toFixed(2) || '0.00',
      'Final Total (100)': entry.final_total_score?.toFixed(2) || '0.00',
      'Jury Average (100 scale)': entry.jury_average_score?.toFixed(2) || '0.00',
      'Assessment Count': entry.assessment_count,
      'Juries Submitted': `${entry.jury_count_submitted || 0} / ${juryMembers.length}`,
      Constituency: entry.constituency || '',
      State: entry.state || '',
      'Home City': entry.city || '',
      Awards: (studentAwards[entry.user_id] || []).map(a => a.name).join(', ') || 'No awards',
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Leaderboard');
    XLSX.writeFile(wb, `leaderboard-${new Date().toISOString().split('T')[0]}.xlsx`);
    toast({ title: 'Export Successful', description: 'Leaderboard data exported to Excel file' });
  };

  const exportToPDF = () => {
    const pdf = new jsPDF('p', 'mm', 'a4');
    pdf.setFontSize(18);
    pdf.text('Student Leaderboard Report', 14, 16);
    pdf.setFontSize(11);
    pdf.text(`Generated on: ${new Date().toLocaleString()}`, 14, 24);
    pdf.text(`Total Students: ${leaderboard.length}`, 14, 30);
    pdf.text(`Filtered Results: ${filteredLeaderboard.length}`, 14, 36);
    const body = filteredLeaderboard.map(entry => [
      hasRealScores ? entry.original_rank.toString() : '—',
      entry.name,
      entry.position,
      `Party ${entry.party_number}`,
      entry.preevent_scores?.toFixed(1) || '0',
      entry.jury_converted_score?.toFixed(1) || '0',
      entry.final_total_score?.toFixed(1) || '0',
      (studentAwards[entry.user_id]?.length || 0).toString(),
    ]);
    autoTable(pdf, {
      head: [['Rank', 'Name', 'Position', 'Party', 'Pre(60)', 'Jury(40)', 'Total', 'Awards']],
      body,
      startY: 42,
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [19, 41, 143] },
      theme: 'striped',
      margin: { left: 14, right: 14 },
      columnStyles: {
        0: { cellWidth: 12 }, 1: { cellWidth: 45 }, 2: { cellWidth: 32 },
        3: { cellWidth: 22 }, 4: { cellWidth: 18, halign: 'right' },
        5: { cellWidth: 18, halign: 'right' }, 6: { cellWidth: 18, halign: 'right' },
        7: { cellWidth: 18, halign: 'right' },
      },
    });
    pdf.save(`leaderboard-${new Date().toISOString().split('T')[0]}.pdf`);
    toast({ title: 'Export Successful', description: 'Leaderboard report exported to PDF' });
  };

  // Award modal student's current awards
  const modalStudentAwards = awardModalStudent ? (studentAwards[awardModalStudent.user_id] || []) : [];

  return (
    <div className="space-y-8 animate-in fade-in duration-700">

      {/* ── Search + Export ── */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-4 py-3 bg-surface-container-lowest rounded-2xl border border-outline-variant/20 flex-1 shadow-sm">
          <span className="material-symbols-outlined text-outline text-[20px]">search</span>
          <input
            type="text"
            className="flex-1 bg-transparent border-none outline-none text-sm font-medium font-body text-on-surface placeholder:text-on-surface-variant/40"
            placeholder="Search by name, position, constituency, city, serial..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button type="button" onClick={() => setSearchTerm('')} className="text-outline hover:text-on-surface transition-colors">
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={exportToCSV}
          className="flex items-center gap-2 px-5 py-3 bg-surface-container-lowest border border-outline-variant/20 rounded-2xl text-sm font-bold font-headline text-on-surface-variant hover:border-primary/20 hover:text-primary transition-all shadow-sm shrink-0"
        >
          <span className="material-symbols-outlined text-[18px]">table_view</span>
          CSV
        </button>
        <button
          type="button"
          onClick={exportToPDF}
          className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-primary to-primary-container text-white rounded-2xl text-sm font-bold font-headline shadow-[0_4px_12px_rgba(19,41,143,0.2)] hover:shadow-[0_6px_16px_rgba(19,41,143,0.3)] transition-all active:scale-95 shrink-0"
        >
          <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
          PDF
        </button>
      </div>

      {/* ── Filter bar (compact collapsible) ── */}
      <div className="bg-surface-container-low rounded-[1.5rem] overflow-hidden">

        {/* ── Toggle row (always visible) ── */}
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={() => setShowFilters(f => !f)}
            className="flex items-center gap-2 shrink-0 hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined text-[18px] text-on-surface-variant">filter_list</span>
            <span className="text-xs font-black font-headline uppercase tracking-wide text-on-surface-variant">Filters</span>
            {activeFilterCount > 0 && (
              <span className="px-1.5 py-0.5 bg-primary text-on-primary text-[9px] font-black rounded-full font-headline leading-none">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Active chips (collapsed view only) */}
          {!showFilters && activeFilterCount > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto flex-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {partyFilter && (
                <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 bg-primary/10 text-primary rounded-full text-[10px] font-black font-headline uppercase tracking-wide">
                  Party {partyLabel(Number(partyFilter))}
                  <button type="button" onClick={() => setPartyFilter('')} className="hover:text-error transition-colors"><span className="material-symbols-outlined text-[11px]">close</span></button>
                </span>
              )}
              {assessmentStatusFilter && (
                <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 bg-primary/10 text-primary rounded-full text-[10px] font-black font-headline uppercase tracking-wide">
                  {assessmentStatusFilter === 'fully-assessed' ? 'Validated' : assessmentStatusFilter === 'partially-assessed' ? 'Partial' : 'Pending'}
                  <button type="button" onClick={() => setAssessmentStatusFilter('')} className="hover:text-error transition-colors"><span className="material-symbols-outlined text-[11px]">close</span></button>
                </span>
              )}
              {cityFilter && (
                <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 bg-primary/10 text-primary rounded-full text-[10px] font-black font-headline uppercase tracking-wide">
                  {cityFilter}
                  <button type="button" onClick={() => setCityFilter('')} className="hover:text-error transition-colors"><span className="material-symbols-outlined text-[11px]">close</span></button>
                </span>
              )}
              {positionFilter && (
                <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 bg-primary/10 text-primary rounded-full text-[10px] font-black font-headline uppercase tracking-wide">
                  {positionFilter}
                  <button type="button" onClick={() => setPositionFilter('')} className="hover:text-error transition-colors"><span className="material-symbols-outlined text-[11px]">close</span></button>
                </span>
              )}
              {sessionFilter && (
                <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 bg-primary/10 text-primary rounded-full text-[10px] font-black font-headline uppercase tracking-wide">
                  {sessionFilter}
                  <button type="button" onClick={() => setSessionFilter('')} className="hover:text-error transition-colors"><span className="material-symbols-outlined text-[11px]">close</span></button>
                </span>
              )}
            </div>
          )}

          <div className="ml-auto flex items-center gap-2 shrink-0">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-[11px] font-bold font-headline text-primary hover:underline flex items-center gap-0.5 transition-all"
              >
                <span className="material-symbols-outlined text-[12px]">filter_list_off</span>
                Clear
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowFilters(f => !f)}
              className="p-1 rounded-lg hover:bg-surface-container transition-colors"
            >
              <span
                className="material-symbols-outlined text-[20px] text-on-surface-variant transition-transform duration-200 block"
                style={{ transform: showFilters ? 'rotate(180deg)' : 'rotate(0deg)' }}
              >
                expand_more
              </span>
            </button>
          </div>
        </div>

        {/* ── Expandable filter rows ── */}
        {showFilters && (
          <div className="px-4 pb-4 space-y-4 border-t border-outline-variant/10 pt-4">

            {/* Party */}
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-outline font-headline mb-2">Party</p>
              <div className="flex items-center gap-2 flex-wrap">
                <FilterPill active={!partyFilter} onClick={() => setPartyFilter('')} icon="flag" label="All Parties" />
                {uniqueParties.map(party => (
                  <FilterPill
                    key={party}
                    active={partyFilter === party.toString()}
                    onClick={() => setPartyFilter(party.toString())}
                    label={`Party ${partyLabel(party)}`}
                  />
                ))}
              </div>
            </div>

            {/* Assessment Status */}
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-outline font-headline mb-2">Assessment Status</p>
              <div className="flex items-center gap-2 flex-wrap">
                {([
                  { value: '', label: 'All', icon: 'grading' },
                  { value: 'fully-assessed', label: 'Validated', icon: 'verified' },
                  { value: 'partially-assessed', label: 'Partial', icon: 'pending' },
                  { value: 'not-assessed', label: 'Pending', icon: 'schedule' },
                ] as const).map(opt => (
                  <FilterPill
                    key={opt.value}
                    active={assessmentStatusFilter === opt.value}
                    onClick={() => setAssessmentStatusFilter(opt.value)}
                    icon={opt.icon}
                    label={opt.label}
                  />
                ))}
              </div>
            </div>

            {/* City */}
            {uniqueCities.length > 0 && (
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-outline font-headline mb-2">City</p>
                <div className="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <FilterPill active={!cityFilter} onClick={() => setCityFilter('')} icon="location_on" label="All Cities" />
                  {uniqueCities.map(city => (
                    <FilterPill key={city} active={cityFilter === city} onClick={() => setCityFilter(city)} label={city} />
                  ))}
                </div>
              </div>
            )}

            {/* Position */}
            {uniquePositions.length > 0 && (
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-outline font-headline mb-2">Position</p>
                <div className="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <FilterPill active={!positionFilter} onClick={() => setPositionFilter('')} icon="badge" label="All Positions" />
                  {uniquePositions.map(pos => (
                    <FilterPill key={pos} active={positionFilter === pos} onClick={() => setPositionFilter(pos)} label={pos} />
                  ))}
                </div>
              </div>
            )}

            {/* Session */}
            {sessionOptions.length > 0 && (
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-outline font-headline mb-2">Session</p>
                <div className="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <FilterPill active={!sessionFilter} onClick={() => setSessionFilter('')} icon="event" label="All Sessions" />
                  {sessionOptions.map(session => (
                    <FilterPill key={session} active={sessionFilter === session} onClick={() => setSessionFilter(session)} label={session} />
                  ))}
                </div>
              </div>
            )}

            {hasActiveFilters && (
              <div className="pt-1 border-t border-outline-variant/20">
                <span className="text-xs text-outline font-body">
                  Showing <span className="font-bold text-on-surface">{filteredLeaderboard.length}</span> of{' '}
                  <span className="font-bold text-on-surface">{leaderboard.length}</span> students
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Stats bento ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-surface-container-lowest p-6 rounded-[2rem] shadow-sm flex flex-col justify-between border-b-4 border-primary/10">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-black uppercase tracking-widest text-outline font-headline">Total Students</span>
            <span className="material-symbols-outlined text-primary/30" style={{ fontVariationSettings: "'FILL' 1" }}>group</span>
          </div>
          <div className="mt-4">
            <span className="text-4xl font-extrabold text-primary font-headline">{String(totalStudents).padStart(2, '0')}</span>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-6 rounded-[2rem] shadow-sm flex flex-col justify-between border-b-4 border-amber-500/20">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-black uppercase tracking-widest text-outline font-headline">Top Score</span>
            <span className="material-symbols-outlined text-amber-500/40" style={{ fontVariationSettings: "'FILL' 1" }}>emoji_events</span>
          </div>
          <div className="mt-4">
            <span className="text-4xl font-extrabold text-amber-600 font-headline">{topScore}</span>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-6 rounded-[2rem] shadow-sm flex flex-col justify-between border-b-4 border-secondary-container/20">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-black uppercase tracking-widest text-outline font-headline">Avg Performance</span>
            <span className="material-symbols-outlined text-secondary/30" style={{ fontVariationSettings: "'FILL' 1" }}>insights</span>
          </div>
          <div className="mt-4">
            <span className="text-4xl font-extrabold text-secondary font-headline">{avgPerformance}</span>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-6 rounded-[2rem] shadow-sm flex flex-col justify-between border-b-4 border-tertiary-fixed-dim/20">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-black uppercase tracking-widest text-outline font-headline">Awards Given</span>
            <span className="material-symbols-outlined text-tertiary-fixed-dim/40" style={{ fontVariationSettings: "'FILL' 1" }}>workspace_premium</span>
          </div>
          <div className="mt-4">
            <span className="text-4xl font-extrabold text-tertiary-container font-headline">{String(awardsGiven).padStart(2, '0')}</span>
          </div>
        </div>
      </div>

      {/* ── Top Performers Podium ── */}
      {hasRealScores && top3.length >= 1 && (
        <div>
          <div className="flex items-center gap-3 mb-5">
            <span className="material-symbols-outlined text-primary text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>workspace_premium</span>
            <h2 className="text-2xl font-headline font-black text-on-surface -tracking-[0.02em]">Top Performers</h2>
          </div>
          {/* Podium: [2nd] [1st] [3rd] */}
          <div className="grid grid-cols-3 gap-4 items-end">
            <div>
              {top3[1] && (
                <PodiumCard
                  entry={top3[1]}
                  rank={2}
                  awards={studentAwards[top3[1].user_id] || []}
                  onAwardClick={() => setAwardModalStudent(top3[1])}
                />
              )}
            </div>
            <div>
              {top3[0] && (
                <PodiumCard
                  entry={top3[0]}
                  rank={1}
                  awards={studentAwards[top3[0].user_id] || []}
                  onAwardClick={() => setAwardModalStudent(top3[0])}
                />
              )}
            </div>
            <div>
              {top3[2] && (
                <PodiumCard
                  entry={top3[2]}
                  rank={3}
                  awards={studentAwards[top3[2].user_id] || []}
                  onAwardClick={() => setAwardModalStudent(top3[2])}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── General Ranking Table ── */}
      <div className="bg-surface-container-lowest rounded-3xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 flex items-center gap-3 border-b border-outline-variant/10">
          <span className="material-symbols-outlined text-primary text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>leaderboard</span>
          <h2 className="text-xl font-headline font-black text-on-surface">General Ranking</h2>
          <span className="px-2.5 py-0.5 bg-primary/8 text-primary text-[10px] font-black uppercase tracking-widest rounded-full font-headline border border-primary/15">
            {filteredLeaderboard.length} students
          </span>
        </div>

        {filteredLeaderboard.length === 0 ? (
          <div className="py-20 text-center">
            <span className="material-symbols-outlined text-[48px] text-on-surface-variant/20 block mb-3" style={{ fontVariationSettings: "'FILL' 1" }}>manage_search</span>
            <p className="text-sm text-on-surface-variant/50 font-body">No students match your filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-surface-container-low/50">
                  <th className="px-5 py-3 text-left text-[11px] font-black uppercase tracking-widest text-outline font-headline w-16">Rank</th>
                  <th className="px-5 py-3 text-left text-[11px] font-black uppercase tracking-widest text-outline font-headline">Student</th>
                  <th className="px-5 py-3 text-left text-[11px] font-black uppercase tracking-widest text-outline font-headline">Constituency</th>
                  <th className="px-5 py-3 text-left text-[11px] font-black uppercase tracking-widest text-outline font-headline">City</th>
                  <th className="px-5 py-3 text-right text-[11px] font-black uppercase tracking-widest text-outline font-headline">Pre (60)</th>
                  <th className="px-5 py-3 text-right text-[11px] font-black uppercase tracking-widest text-outline font-headline">Jury (40)</th>
                  <th className="px-5 py-3 text-right text-[11px] font-black uppercase tracking-widest text-outline font-headline">
                    <span className="flex items-center justify-end gap-1">
                      <span className="material-symbols-outlined text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }}>electric_bolt</span>
                      Live
                    </span>
                  </th>
                  <th className="px-5 py-3 text-right text-[11px] font-black uppercase tracking-widest text-outline font-headline">Total</th>
                  <th className="px-5 py-3 text-center text-[11px] font-black uppercase tracking-widest text-outline font-headline">Status</th>
                  <th className="px-5 py-3 text-center text-[11px] font-black uppercase tracking-widest text-outline font-headline">Awards</th>
                </tr>
              </thead>
              <tbody>
                {paginatedLeaderboard.map(entry => {
                  const initials = entry.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                  const status = getAssessmentStatus(entry);
                  const special = isSpecialRole(entry.position);
                  const entryAwards = studentAwards[entry.user_id] || [];

                  return (
                    <tr
                      key={entry.user_id}
                      className="hover:bg-surface-container-low/30 border-b border-outline-variant/5 transition-colors"
                    >
                      {/* Rank */}
                      <td className="px-5 py-3.5">
                        {hasRealScores ? (
                          entry.original_rank <= 3 ? (
                            <span
                              className="material-symbols-outlined"
                              style={{
                                fontSize: '22px',
                                fontVariationSettings: "'FILL' 1",
                                color: entry.original_rank === 1 ? '#f59e0b'
                                  : entry.original_rank === 2 ? '#94a3b8' : '#ea580c',
                              }}
                            >
                              {entry.original_rank === 1 ? 'emoji_events'
                                : entry.original_rank === 2 ? 'military_tech' : 'workspace_premium'}
                            </span>
                          ) : (
                            <span className="text-sm font-headline font-black text-on-surface-variant/40">#{entry.original_rank}</span>
                          )
                        ) : (
                          <span className="text-sm font-headline font-black text-on-surface-variant/30">—</span>
                        )}
                      </td>

                      {/* Student */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="shrink-0">
                            {entry.photo_url ? (
                              <img src={entry.photo_url} alt={entry.name} className="w-9 h-9 rounded-xl object-cover bg-surface-container" />
                            ) : (
                              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                                <span className="text-xs font-headline font-bold text-primary">{initials}</span>
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-headline font-bold text-sm text-on-surface">{entry.name}</span>
                              <span className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-widest rounded-md font-headline ${partyColor(entry.party_number)}`}>
                                Party {partyLabel(entry.party_number)}
                              </span>
                            </div>
                            <p className="text-[11px] text-outline font-body mt-0.5">
                              {entry.position} · #{entry.serial_number}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Constituency */}
                      <td className="px-5 py-3.5">
                        <span className="text-sm font-body text-on-surface-variant">{entry.constituency || '—'}</span>
                      </td>

                      {/* City */}
                      <td className="px-5 py-3.5">
                        <span className="text-sm font-body text-on-surface-variant">{entry.city ? normalizeCity(entry.city) : '—'}</span>
                      </td>

                      {/* Pre (60) */}
                      <td className="px-5 py-3.5 text-right">
                        <span className="text-sm font-headline font-black tabular-nums text-on-surface">
                          {entry.preevent_scores?.toFixed(1) || '0.0'}
                        </span>
                      </td>

                      {/* Jury (40) */}
                      <td className="px-5 py-3.5 text-right">
                        {!special ? (
                          <span className="text-sm font-headline font-black tabular-nums text-on-surface">
                            {entry.jury_converted_score?.toFixed(1) || '0.0'}
                          </span>
                        ) : (
                          <span className="text-sm text-on-surface-variant/30 font-body">—</span>
                        )}
                      </td>

                      {/* Live (organizer_manual_score for admins/journalists) */}
                      <td className="px-5 py-3.5 text-right">
                        {special ? (
                          <span className="text-sm font-headline font-black tabular-nums text-on-surface">
                            {entry.organizer_manual_score?.toFixed(1) || '0.0'}
                          </span>
                        ) : (
                          <span className="text-sm text-on-surface-variant/30 font-body">—</span>
                        )}
                      </td>

                      {/* Total Score */}
                      <td className="px-5 py-3.5 text-right">
                        <span className="inline-block bg-primary text-on-primary font-headline font-black text-sm tabular-nums rounded-lg px-3 py-1">
                          {entry.final_total_score?.toFixed(1) || '0.0'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-3.5 text-center">
                        {special ? (
                          <span className="px-3 py-1 bg-primary-fixed/30 text-on-primary-fixed-variant text-[10px] font-black uppercase tracking-wide rounded-full font-headline">
                            Manual
                          </span>
                        ) : (
                          <span className={`px-3 py-1 text-[10px] font-black uppercase tracking-wide rounded-full font-headline ${statusBadge(status)}`}>
                            {statusLabel(status)}
                          </span>
                        )}
                      </td>

                      {/* Awards */}
                      <td className="px-5 py-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => setAwardModalStudent(entry)}
                          className="group/aw inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-amber-50 hover:border-amber-200 border border-outline-variant/20 bg-surface-container transition-all"
                        >
                          <span
                            className="material-symbols-outlined text-[16px] text-amber-500"
                            style={{ fontVariationSettings: entryAwards.length > 0 ? "'FILL' 1" : "'FILL' 0" }}
                          >
                            workspace_premium
                          </span>
                          <span className="text-xs font-headline font-black text-on-surface-variant group-hover/aw:text-amber-700 transition-colors">
                            {entryAwards.length > 0 ? entryAwards.length : '+'}
                          </span>
                        </button>
                        {/* Jury nomination count */}
                        {(() => {
                          const nominations = awardVotes.filter(v => v.student_id === entry.user_id);
                          if (nominations.length === 0) return null;
                          const totalJury = juryMembers.length || 1;
                          const isConsensus = nominations.length >= totalJury && totalJury > 1;
                          return (
                            <div className={`mt-1 text-[10px] font-bold font-body ${isConsensus ? 'text-[#2bb87c]' : 'text-primary/60'}`}>
                              {nominations.length}/{totalJury} jury
                            </div>
                          );
                        })()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-outline-variant/10 flex items-center justify-between">
            <span className="text-xs text-outline font-body">
              Page <span className="font-bold text-on-surface">{currentPage}</span> of{' '}
              <span className="font-bold text-on-surface">{totalPages}</span>
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="size-8 rounded-lg border border-outline-variant/30 flex items-center justify-center text-on-surface-variant hover:border-primary/20 hover:text-primary transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-[16px]">chevron_left</span>
              </button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                let page: number;
                if (totalPages <= 7) page = i + 1;
                else if (currentPage <= 4) page = i + 1;
                else if (currentPage >= totalPages - 3) page = totalPages - 6 + i;
                else page = currentPage - 3 + i;
                return (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setCurrentPage(page)}
                    className={`size-8 rounded-lg text-xs font-black font-headline transition-all ${
                      currentPage === page
                        ? 'bg-primary text-on-primary'
                        : 'border border-outline-variant/30 text-on-surface-variant hover:border-primary/20 hover:text-primary'
                    }`}
                  >
                    {page}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="size-8 rounded-lg border border-outline-variant/30 flex items-center justify-center text-on-surface-variant hover:border-primary/20 hover:text-primary transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Award Modal ── */}
      {awardModalStudent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => setAwardModalStudent(null)}
        >
          <div
            className="bg-surface-container-lowest w-full max-w-2xl max-h-[90vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-7 pb-5 border-b border-outline-variant/10 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-2xl bg-[#FFD700]/20 flex items-center justify-center shrink-0">
                  <span
                    className="material-symbols-outlined text-[22px] text-[#A67C00]"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >workspace_premium</span>
                </div>
                <div>
                  <h2 className="font-headline font-extrabold text-lg text-on-surface">Manage Awards</h2>
                  <p className="text-xs text-on-surface-variant/60 font-body mt-0.5">
                    for <span className="font-bold text-primary">{awardModalStudent.name}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAwardModalStudent(null)}
                className="p-2 rounded-full hover:bg-surface-container transition-colors"
              >
                <span className="material-symbols-outlined text-on-surface-variant">close</span>
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-7 space-y-6" style={{ scrollbarWidth: 'none' }}>

              {/* Award selection grid */}
              <div>
                <p className="text-[10px] font-bold text-on-surface-variant/50 uppercase tracking-widest mb-3 font-body">
                  Select Award to Assign
                </p>
                {awards.length === 0 ? (
                  <p className="text-sm text-on-surface-variant/50 font-body py-2">No awards created yet.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {awards.map(award => {
                      const isAssigned = modalStudentAwards.some(a => a.awardId === award.id);
                      const isSelected = orgSelectedAwardId === award.id;
                      return (
                        <button
                          key={award.id}
                          type="button"
                          onClick={() => setOrgSelectedAwardId(isSelected ? '' : award.id)}
                          disabled={isAssigningAward}
                          className={`flex items-start gap-3 p-3.5 rounded-2xl text-left transition-all border ${
                            isAssigned
                              ? 'bg-[#FFD700]/10 border-[#FFD700]/40'
                              : isSelected
                              ? 'bg-primary/8 border-primary/30'
                              : 'bg-surface-container-low border-outline-variant/15 hover:border-primary/20 hover:bg-primary/5'
                          }`}
                        >
                          <span
                            className={`material-symbols-outlined text-[18px] shrink-0 mt-0.5 ${
                              isAssigned ? 'text-[#A67C00]' : isSelected ? 'text-primary' : 'text-on-surface-variant/40'
                            }`}
                            style={(isAssigned || isSelected) ? { fontVariationSettings: "'FILL' 1" } : undefined}
                          >workspace_premium</span>
                          <div className="flex-1 min-w-0">
                            <div className={`text-sm font-bold font-headline leading-tight ${
                              isAssigned ? 'text-[#A67C00]' : isSelected ? 'text-primary' : 'text-on-surface'
                            }`}>
                              {award.name}
                            </div>
                            {award.description && (
                              <div className="text-[11px] text-on-surface-variant/50 font-body mt-0.5 leading-relaxed line-clamp-2">
                                {award.description}
                              </div>
                            )}
                            {isAssigned && (
                              <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold text-[#A67C00] font-body">
                                <span className="material-symbols-outlined text-[11px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                                Assigned
                              </span>
                            )}
                            {(() => {
                              const vc = getVoteCount(award.id, awardModalStudent.user_id);
                              if (!vc || isAssigned) return null;
                              return (
                                <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold text-primary/70 font-body">
                                  <span className="material-symbols-outlined text-[11px]">how_to_vote</span>
                                  {vc} jury vote{vc !== 1 ? 's' : ''}
                                </span>
                              );
                            })()}
                          </div>
                          {isSelected && !isAssigned && (
                            <span
                              className="material-symbols-outlined text-primary text-[18px] shrink-0"
                              style={{ fontVariationSettings: "'FILL' 1" }}
                            >check_circle</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Jury Nominations */}
              {juryMembers.length > 0 && (() => {
                const studentVotes = awardVotes.filter(v => v.student_id === awardModalStudent.user_id);
                const totalJury = juryMembers.length;
                return (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[10px] font-bold text-on-surface-variant/50 uppercase tracking-widest font-body">
                        Jury Nominations
                      </p>
                      <span className={`text-[11px] font-bold font-body px-2 py-0.5 rounded-full ${
                        studentVotes.length === totalJury && totalJury > 1
                          ? 'bg-[#42d59a]/15 text-[#2bb87c]'
                          : studentVotes.length > 0
                          ? 'bg-primary/10 text-primary'
                          : 'bg-surface-container text-on-surface-variant/50'
                      }`}>
                        {studentVotes.length}/{totalJury} juries
                      </span>
                    </div>
                    <div className="space-y-2">
                      {juryMembers.map(member => {
                        const vote = studentVotes.find(v => v.jury_id === member.user_id);
                        const initials = member.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
                        return (
                          <div
                            key={member.user_id}
                            className="flex items-center justify-between px-4 py-3 rounded-2xl bg-surface-container-low border border-transparent"
                          >
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-outline-variant/20 flex items-center justify-center text-[11px] font-bold font-headline text-on-surface-variant shrink-0">
                                {initials}
                              </div>
                              <span className="text-sm font-bold font-headline text-on-surface">{member.name}</span>
                            </div>
                            {vote ? (
                              <span className="flex items-center gap-1 text-[11px] font-bold font-body text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                                <span className="material-symbols-outlined text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }}>workspace_premium</span>
                                <span className="truncate max-w-[160px]">{vote.award_name}</span>
                              </span>
                            ) : (
                              <span className="text-[11px] font-body text-on-surface-variant/30 italic">Not nominated</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Footer */}
            <div className="px-7 py-5 border-t border-outline-variant/10 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={async () => {
                  if (!orgSelectedAwardId) return;
                  const entry = modalStudentAwards.find(a => a.awardId === orgSelectedAwardId);
                  if (entry) {
                    await removeAwardFromStudent(entry.recordId);
                    setOrgSelectedAwardId('');
                  }
                }}
                disabled={!orgSelectedAwardId || !modalStudentAwards.some(a => a.awardId === orgSelectedAwardId)}
                className="text-sm font-bold text-error/70 hover:text-error transition-colors disabled:opacity-30 font-body flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">remove_circle</span>
                Remove Award
              </button>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setAwardModalStudent(null)}
                  className="px-5 py-2 rounded-full text-sm font-bold text-on-surface-variant hover:bg-surface-container font-body transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!orgSelectedAwardId) return;
                    await assignAwardToStudent(awardModalStudent.user_id, orgSelectedAwardId);
                    setOrgSelectedAwardId('');
                  }}
                  disabled={
                    !orgSelectedAwardId ||
                    modalStudentAwards.some(a => a.awardId === orgSelectedAwardId) ||
                    isAssigningAward
                  }
                  className="px-6 py-2 bg-primary text-on-primary rounded-full text-sm font-bold font-body shadow-[0_4px_12px_rgba(19,41,143,0.25)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {isAssigningAward && (
                    <span className="w-3.5 h-3.5 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
                  )}
                  Assign Award
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
