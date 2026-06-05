import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AssessmentForm, ComponentScore } from "./AssessmentForm";
import { toast } from "@/hooks/use-toast";

const PARTY_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const PAGE_SIZE = 10;
const AVATAR_COLORS = [
  'bg-primary/10 text-primary',
  'bg-secondary/10 text-secondary',
  'bg-tertiary/10 text-tertiary-container',
  'bg-[#42d59a]/10 text-[#42d59a]',
];

interface Student {
  id: string;
  user_id: string;
  name: string;
  position: string;
  party_number: number;
  party_name?: string;
  serial_number: number;
  party_alignment?: string;
  constituency?: string;
  state?: string;
  city?: string;
  photo_url?: string;
  user_type: string;
}

interface Assessment {
  id: string;
  student_id: string;
  scores: any;
  total_score: number;
  status: 'draft' | 'submitted' | 'locked';
  notes?: string;
  updated_at: string;
  session_id?: string;
}

interface Session {
  id: string;
  title: string;
  description?: string;
  session_date?: string;
  status?: string;
}

interface Award {
  id: string;
  name: string;
  description?: string;
}

interface AwardVote {
  id: string;
  award_id: string;
  student_id: string;
  jury_id: string;
  created_at: string;
}

interface JuryMember {
  user_id: string;
  name: string;
  position?: string;
}

interface JuryStudentListProps {
  juryId: string;
}

export const JuryStudentList = ({ juryId }: JuryStudentListProps) => {
  const [students, setStudents]                   = useState<Student[]>([]);
  const [sessions, setSessions]                   = useState<Session[]>([]);
  const [allAssessments, setAllAssessments]       = useState<Assessment[]>([]);
  const [filteredStudents, setFilteredStudents]   = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent]     = useState<Student | null>(null);
  const [searchTerm, setSearchTerm]               = useState("");
  const [statusFilter, setStatusFilter]           = useState<'all' | 'not_started' | 'in_progress' | 'scored'>('all');
  const [partyFilter, setPartyFilter]             = useState<number | 'all'>('all');
  const [isLockedByOrganizer, setIsLockedByOrganizer] = useState(false);
  const [loading, setLoading]                     = useState(true);
  const [page, setPage]                           = useState(1);

  // Award nomination state
  const [awards, setAwards]                       = useState<Award[]>([]);
  const [allAwardVotes, setAllAwardVotes]         = useState<AwardVote[]>([]);
  const [juryMembers, setJuryMembers]             = useState<JuryMember[]>([]);
  const [nominatingStudent, setNominatingStudent] = useState<Student | null>(null);
  const [selectedAwardId, setSelectedAwardId]     = useState<string>('');
  const [nominationLoading, setNominationLoading] = useState(false);

  useEffect(() => {
    fetchStudents();
    fetchSessions();
    fetchAllAssessments();
    fetchAwards();
    fetchAllAwardVotes();
    fetchJuryMembers();
  }, [juryId]);

  useEffect(() => {
    const checkJuryLock = async () => {
      const { data } = await supabase
        .from('assessment_locks').select('id')
        .eq('jury_id', juryId).eq('is_global_lock', false).limit(1);
      setIsLockedByOrganizer((data?.length ?? 0) > 0);
    };
    checkJuryLock();
    const ch = supabase.channel(`jury-lock-${juryId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assessment_locks' }, checkJuryLock)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [juryId]);

  useEffect(() => {
    const aCh = supabase.channel('jury-assessments-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assessments', filter: `jury_id=eq.${juryId}` }, fetchAllAssessments)
      .subscribe();
    const pCh = supabase.channel('jury-profiles-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `user_type=eq.student` }, fetchStudents)
      .subscribe();
    const vCh = supabase.channel('award-votes-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'award_votes' }, fetchAllAwardVotes)
      .subscribe();
    return () => {
      supabase.removeChannel(aCh);
      supabase.removeChannel(pCh);
      supabase.removeChannel(vCh);
    };
  }, [juryId]);

  useEffect(() => {
    let filtered = students;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(s =>
        s.name.toLowerCase().includes(term) ||
        s.serial_number.toString().includes(term) ||
        s.position.toLowerCase().includes(term) ||
        (s.constituency?.toLowerCase().includes(term) ?? false)
      );
    }
    if (partyFilter !== 'all') {
      filtered = filtered.filter(s => s.party_number === partyFilter);
    }
    if (statusFilter !== 'all') {
      filtered = filtered.filter(s => getOverallStatus(s.user_id) === statusFilter);
    }
    setFilteredStudents(filtered);
    setPage(1);
  }, [students, searchTerm, partyFilter, statusFilter, allAssessments]);

  const fetchStudents = async () => {
    try {
      const [{ data, error }, { data: specialIds }] = await Promise.all([
        supabase.from('profiles').select('*')
          .eq('user_type', 'student')
          .order('party_number', { ascending: true })
          .order('serial_number', { ascending: true }),
        supabase.rpc('get_non_scoreable_student_ids'),
      ]);
      if (error) throw error;
      const excludedIds = new Set<string>((specialIds as string[] | null) || []);
      setStudents((data || []).filter(s => {
        if (excludedIds.has(s.user_id)) return false;
        const pos = s.position?.toLowerCase() || '';
        return !pos.includes('admin') && !pos.includes('journalist');
      }));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const fetchSessions = async () => {
    try {
      const { data, error } = await supabase.from('session_items')
        .select('id, title, description, session_date, status')
        .order('session_date', { ascending: true })
        .order('sort_order', { ascending: true });
      if (error) throw error;
      setSessions(data || []);
    } catch (err) {
      console.error(err);
      toast({ title: "Error Loading Sessions", description: "Failed to load sessions.", variant: "destructive" });
    }
  };

  const fetchAllAssessments = async () => {
    try {
      const { data, error } = await supabase.from('assessments').select('*').eq('jury_id', juryId);
      if (error) throw error;
      setAllAssessments((data || []) as Assessment[]);
    } catch (err) { console.error(err); }
  };

  const fetchAwards = async () => {
    try {
      const { data } = await supabase.from('awards').select('id, name, description').order('name');
      setAwards(data || []);
    } catch (err) { console.error(err); }
  };

  const fetchAllAwardVotes = async () => {
    try {
      const { data } = await supabase.from('award_votes').select('*');
      setAllAwardVotes((data || []) as AwardVote[]);
    } catch (err) { console.error(err); }
  };

  const fetchJuryMembers = async () => {
    try {
      const { data } = await supabase.rpc('get_jury_directory');
      setJuryMembers((data || []) as JuryMember[]);
    } catch (err) { console.error(err); }
  };

  const getStudentAssessments = (userId: string) =>
    allAssessments.filter(a => a.student_id === userId);

  const getSubmittedAssessments = (userId: string) =>
    getStudentAssessments(userId).filter(a => a.status === 'submitted');

  const getAvgScore = (userId: string): number | null => {
    // One assessment row per student (session_id = null) — total is already out of 100
    const row = getSubmittedAssessments(userId).find(a => !a.session_id)
      ?? getSubmittedAssessments(userId)[0];
    if (!row) return null;
    return Math.round(row.total_score * 10) / 10;
  };

  const getOverallStatus = (userId: string): 'not_started' | 'in_progress' | 'scored' => {
    const all = getStudentAssessments(userId);
    if (!all.length) return 'not_started';
    if (all.some(a => a.status === 'submitted')) return 'scored';
    return 'in_progress';
  };

  // Rank computed across ALL students (not filtered/paginated)
  const studentRanks = useMemo(() => {
    const getAvg = (userId: string) => {
      const sub = allAssessments.filter(a => a.student_id === userId && a.status === 'submitted');
      if (!sub.length) return null;
      const row = sub.find(a => !a.session_id) ?? sub[0];
      return row.total_score ?? 0;
    };
    const scored = students
      .map(s => ({ userId: s.user_id, avg: getAvg(s.user_id) }))
      .filter(s => s.avg !== null)
      .sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0));

    const ranks: Record<string, number> = {};
    let currentRank = 1;
    for (let i = 0; i < scored.length; i++) {
      if (i > 0 && scored[i].avg !== scored[i - 1].avg) currentRank = i + 1;
      ranks[scored[i].userId] = currentRank;
    }
    return ranks;
  }, [students, allAssessments]);

  const getMyAwardVote = (userId: string) =>
    allAwardVotes.find(v => v.student_id === userId && v.jury_id === juryId);

  const getStudentAwardVotes = (userId: string) =>
    allAwardVotes.filter(v => v.student_id === userId);

  const getSeatRole = (position: string) => {
    const pos = position?.toLowerCase() || '';
    if (pos.includes('speaker') && pos.includes('deputy')) return 'deputy_speaker';
    if (pos.includes('speaker')) return 'speaker';
    return 'mp';
  };

  const getPartyLabel = (s: Student) => {
    if (s.party_name) return s.party_name;
    return `Party ${PARTY_LETTERS[(s.party_number - 1) % PARTY_LETTERS.length] || s.party_number}`;
  };

  const handleAssessmentSubmit = async (
    componentScores: ComponentScore[],
    notes: string,
    status: 'draft' | 'submitted'
  ) => {
    if (!selectedStudent || componentScores.length === 0) {
      toast({ title: "Nothing to save", description: "Enter at least one score.", variant: "destructive" });
      return;
    }
    const pos = selectedStudent.position?.toLowerCase() || '';
    if (pos.includes('admin') || pos.includes('journalist')) {
      toast({ title: "Not allowed", description: "Admin and Journalist roles cannot be scored.", variant: "destructive" });
      return;
    }
    try {
      // Build scores JSON: { component_key: score, ... }
      const scoresJson: Record<string, number> = {};
      let totalScore = 0;
      componentScores.forEach(({ component, score }) => {
        scoresJson[component] = score;
        totalScore += score;
      });
      totalScore = Math.min(totalScore, 100);

      // Single row per jury × student (session_id = null)
      const existing = allAssessments.find(
        a => a.student_id === selectedStudent.user_id && !a.session_id
      );

      if (existing) {
        const { error } = await supabase.from('assessments').update({
          scores: scoresJson,
          total_score: totalScore,
          seat_role: getSeatRole(selectedStudent.position),
          status,
          notes,
          submitted_at: status === 'submitted' ? new Date().toISOString() : null,
        }).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('assessments').insert({
          jury_id: juryId,
          student_id: selectedStudent.user_id,
          session_id: null,
          seat_role: getSeatRole(selectedStudent.position),
          scores: scoresJson,
          total_score: totalScore,
          status,
          notes,
          submitted_at: status === 'submitted' ? new Date().toISOString() : null,
        });
        if (error) throw error;
      }

      toast({
        title: status === 'submitted' ? "Scores Submitted" : "Draft Saved",
        description: `${status === 'submitted' ? 'All scores submitted' : 'Draft saved'} for ${selectedStudent.name}`,
      });
      await fetchAllAssessments();
      if (status === 'submitted') setSelectedStudent(null);
    } catch (err: any) {
      toast({ title: "Submission Failed", description: err?.message || "Failed to save.", variant: "destructive" });
    }
  };

  const openNominationModal = (student: Student) => {
    const myVote = getMyAwardVote(student.user_id);
    setSelectedAwardId(myVote?.award_id || '');
    setNominatingStudent(student);
  };

  const handleNominateAward = async () => {
    if (!nominatingStudent) return;
    setNominationLoading(true);
    try {
      const existing = getMyAwardVote(nominatingStudent.user_id);
      if (existing) {
        await supabase.from('award_votes').delete().eq('id', existing.id);
      }
      if (selectedAwardId) {
        const { error } = await supabase.from('award_votes').insert({
          award_id: selectedAwardId,
          student_id: nominatingStudent.user_id,
          jury_id: juryId,
        });
        if (error) throw error;
        toast({ title: 'Award nomination saved' });
      } else {
        toast({ title: 'Nomination removed' });
      }
      await fetchAllAwardVotes();
      setNominatingStudent(null);
      setSelectedAwardId('');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to save nomination', variant: 'destructive' });
    } finally {
      setNominationLoading(false);
    }
  };

  const paginatedStudents = filteredStudents.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.ceil(filteredStudents.length / PAGE_SIZE);
  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const rankStyle = (rank: number) => {
    if (rank === 1) return 'bg-[#FFD700]/20 text-[#A67C00] border border-[#FFD700]/40';
    if (rank === 2) return 'bg-zinc-100 text-zinc-500 border border-zinc-200';
    if (rank === 3) return 'bg-[#CD7F32]/15 text-[#A0522D] border border-[#CD7F32]/30';
    return 'bg-surface-container text-on-surface-variant/60 border border-outline-variant/20';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* Search */}
      <div className="relative">
        <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant/40 pointer-events-none">
          search
        </span>
        <input
          type="text"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Search by name, serial, role, or constituency..."
          className="w-full h-11 pl-10 pr-24 bg-surface-container-high rounded-2xl border-none text-on-surface font-body text-sm placeholder:text-on-surface-variant/30 focus:outline-none focus:ring-2 focus:ring-primary/15 transition-shadow"
        />
        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-on-surface-variant/40 font-body">
          {filteredStudents.length} students
        </div>
      </div>

      {/* ── Pill filters ── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Status pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {([
            { key: 'all',         label: 'All',         icon: 'groups' },
            { key: 'not_started', label: 'Pending',     icon: 'pending' },
            { key: 'in_progress', label: 'In Progress', icon: 'hourglass_empty' },
            { key: 'scored',      label: 'Scored',      icon: 'task_alt' },
          ] as const).map(f => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold font-body transition-all ${
                statusFilter === f.key
                  ? 'bg-primary text-on-primary shadow-[0_2px_8px_rgba(19,41,143,0.25)]'
                  : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              <span className="material-symbols-outlined text-[13px]">{f.icon}</span>
              {f.label}
            </button>
          ))}
        </div>

        {/* Divider */}
        {(() => {
          const parties = [...new Set(students.map(s => s.party_number).filter(Boolean))].sort();
          return parties.length > 0 ? (
            <>
              <div className="w-px h-5 bg-outline-variant/30" />
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => setPartyFilter('all')}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold font-body transition-all ${
                    partyFilter === 'all'
                      ? 'bg-surface-container-highest text-on-surface shadow-sm'
                      : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                  }`}
                >
                  All Parties
                </button>
                {parties.map(pNum => (
                  <button
                    key={pNum}
                    onClick={() => setPartyFilter(pNum)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold font-body transition-all ${
                      partyFilter === pNum
                        ? 'bg-primary/15 text-primary border border-primary/20'
                        : 'bg-surface-container text-on-surface-variant hover:bg-primary/5 hover:text-primary'
                    }`}
                  >
                    Party {PARTY_LETTERS[(pNum - 1) % PARTY_LETTERS.length]}
                  </button>
                ))}
              </div>
            </>
          ) : null;
        })()}

        {/* Clear filters */}
        {(statusFilter !== 'all' || partyFilter !== 'all') && (
          <button
            onClick={() => { setStatusFilter('all'); setPartyFilter('all'); }}
            className="ml-auto flex items-center gap-1 text-xs text-on-surface-variant/50 hover:text-error transition-colors font-body"
          >
            <span className="material-symbols-outlined text-[14px]">close</span>
            Clear filters
          </button>
        )}
      </div>

      {filteredStudents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <span className="material-symbols-outlined text-[52px] text-on-surface-variant/20 mb-3">search_off</span>
          <div className="font-headline font-bold text-on-surface-variant/50">No students match your search</div>
          <button onClick={() => setSearchTerm('')} className="mt-3 text-xs font-bold text-primary underline underline-offset-2">
            Clear search
          </button>
        </div>
      ) : (
        <div className="bg-surface-container-lowest rounded-3xl overflow-hidden shadow-[0_4px_24px_-4px_rgba(19,41,143,0.06)] border border-outline-variant/10">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-surface-container-low/50 border-b border-outline-variant/20">
                  <th className="text-left px-5 py-3.5 text-[11px] font-bold text-on-surface-variant/50 uppercase tracking-widest font-body whitespace-nowrap">Student</th>
                  <th className="text-center px-4 py-3.5 text-[11px] font-bold text-on-surface-variant/50 uppercase tracking-widest font-body">Rank</th>
                  <th className="text-left px-4 py-3.5 text-[11px] font-bold text-on-surface-variant/50 uppercase tracking-widest font-body">Serial</th>
                  <th className="text-left px-4 py-3.5 text-[11px] font-bold text-on-surface-variant/50 uppercase tracking-widest font-body whitespace-nowrap">Party & Role</th>
                  <th className="text-left px-4 py-3.5 text-[11px] font-bold text-on-surface-variant/50 uppercase tracking-widest font-body hidden lg:table-cell">Constituency</th>
                  <th className="text-center px-4 py-3.5 text-[11px] font-bold text-on-surface-variant/50 uppercase tracking-widest font-body whitespace-nowrap">Avg Score</th>
                  <th className="text-center px-4 py-3.5 text-[11px] font-bold text-on-surface-variant/50 uppercase tracking-widest font-body">Status</th>
                  <th className="text-center px-4 py-3.5 text-[11px] font-bold text-on-surface-variant/50 uppercase tracking-widest font-body">Award</th>
                  <th className="text-right px-5 py-3.5 text-[11px] font-bold text-on-surface-variant/50 uppercase tracking-widest font-body">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {paginatedStudents.map((student, idx) => {
                  const status   = getOverallStatus(student.user_id);
                  const avgScore = getAvgScore(student.user_id);
                  const rank     = studentRanks[student.user_id];
                  const myVote   = getMyAwardVote(student.user_id);
                  const allVotes = getStudentAwardVotes(student.user_id);
                  const myAwardName = myVote ? awards.find(a => a.id === myVote.award_id)?.name : null;
                  const totalJury = juryMembers.length || 1;

                  // Build consensus info: group votes by award_id, find top award
                  const votesByAward: Record<string, number> = {};
                  allVotes.forEach(v => { votesByAward[v.award_id] = (votesByAward[v.award_id] || 0) + 1; });
                  const topAwardId = Object.keys(votesByAward).sort((a, b) => votesByAward[b] - votesByAward[a])[0];
                  const topAwardCount = topAwardId ? votesByAward[topAwardId] : 0;
                  const topAwardName = topAwardId ? awards.find(a => a.id === topAwardId)?.name : null;
                  const isConsensus = topAwardCount >= totalJury && totalJury > 1;

                  return (
                    <tr key={student.id} className="hover:bg-surface-container-low/30 transition-colors">
                      {/* Student */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold font-headline shrink-0 ${AVATAR_COLORS[idx % AVATAR_COLORS.length]}`}>
                            {getInitials(student.name)}
                          </div>
                          <div>
                            <div className="font-headline font-bold text-on-surface text-sm whitespace-nowrap">{student.name}</div>
                            {student.state && <div className="text-xs text-on-surface-variant/50 font-body">{student.state}</div>}
                          </div>
                        </div>
                      </td>

                      {/* Rank */}
                      <td className="px-4 py-3.5 text-center">
                        {rank !== undefined ? (
                          <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-extrabold font-headline ${rankStyle(rank)}`}>
                            {rank}
                          </span>
                        ) : (
                          <span className="text-xs text-on-surface-variant/20 font-body">—</span>
                        )}
                      </td>

                      {/* Serial */}
                      <td className="px-4 py-3.5">
                        <span className="text-sm font-bold text-on-surface-variant font-body">{student.serial_number}</span>
                      </td>

                      {/* Party & Role */}
                      <td className="px-4 py-3.5">
                        <div className="space-y-1">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-primary/10 text-primary font-body whitespace-nowrap">
                            {getPartyLabel(student)}
                          </span>
                          <div className="text-xs text-on-surface-variant/60 font-body truncate max-w-[140px]">{student.position}</div>
                        </div>
                      </td>

                      {/* Constituency */}
                      <td className="px-4 py-3.5 hidden lg:table-cell">
                        <span className="text-sm text-on-surface-variant font-body">{student.constituency || '—'}</span>
                      </td>

                      {/* Avg Score */}
                      <td className="px-4 py-3.5 text-center">
                        {avgScore !== null ? (
                          <div className="inline-flex flex-col items-center">
                            <span className="text-lg font-extrabold font-headline text-[#42d59a]">{avgScore.toFixed(1)}</span>
                            <span className="text-[10px] text-on-surface-variant/40 font-body">/ 100</span>
                          </div>
                        ) : <span className="text-xs italic text-on-surface-variant/30 font-body">—</span>}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5 text-center">
                        {status === 'scored' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#42d59a]/10 text-[#42d59a] font-body whitespace-nowrap">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#42d59a] shrink-0" />Scored
                          </span>
                        )}
                        {status === 'in_progress' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-primary/8 text-primary font-body whitespace-nowrap">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shrink-0" />In Progress
                          </span>
                        )}
                        {status === 'not_started' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-surface-container text-on-surface-variant/50 font-body whitespace-nowrap">
                            <span className="w-1.5 h-1.5 rounded-full bg-outline-variant shrink-0" />Pending
                          </span>
                        )}
                      </td>

                      {/* Award */}
                      <td className="px-4 py-3.5 text-center">
                        <button
                          onClick={() => openNominationModal(student)}
                          title={myAwardName ? `You nominated: ${myAwardName}` : 'Nominate an award'}
                          className="flex flex-col items-center gap-0.5 mx-auto group"
                        >
                          {myVote ? (
                            <div className="flex flex-col items-center gap-0.5">
                              <span
                                className="material-symbols-outlined text-[20px] text-primary group-hover:scale-110 transition-transform"
                                style={{ fontVariationSettings: "'FILL' 1" }}
                              >workspace_premium</span>
                              {topAwardCount > 0 && (
                                <span className={`text-[10px] font-bold font-body px-1.5 py-0.5 rounded-full ${
                                  isConsensus
                                    ? 'bg-[#42d59a]/15 text-[#2bb87c]'
                                    : topAwardCount >= Math.ceil(totalJury / 2)
                                    ? 'bg-primary/10 text-primary'
                                    : 'bg-outline-variant/20 text-on-surface-variant'
                                }`}>
                                  {topAwardCount}/{totalJury}
                                </span>
                              )}
                            </div>
                          ) : allVotes.length > 0 ? (
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="material-symbols-outlined text-[20px] text-on-surface-variant/40 group-hover:text-primary transition-colors">workspace_premium</span>
                              <span className="text-[10px] font-bold font-body px-1.5 py-0.5 rounded-full bg-outline-variant/20 text-on-surface-variant/60">
                                {allVotes.length}/{totalJury}
                              </span>
                            </div>
                          ) : (
                            <span className="material-symbols-outlined text-[20px] text-on-surface-variant/25 group-hover:text-primary transition-colors">workspace_premium</span>
                          )}
                        </button>
                      </td>

                      {/* Action */}
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() => setSelectedStudent(student)}
                          className={`px-4 py-1.5 rounded-full text-xs font-bold font-body transition-all whitespace-nowrap ${
                            status === 'scored'
                              ? 'border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container hover:text-primary'
                              : status === 'in_progress'
                              ? 'bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15'
                              : 'bg-primary text-on-primary hover:bg-primary/90 shadow-[0_2px_8px_rgba(19,41,143,0.2)]'
                          }`}
                        >
                          {status === 'scored' ? 'Review' : status === 'in_progress' ? 'Resume' : 'Begin'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="bg-surface-container-low/30 border-t border-outline-variant/10 px-5 py-3 flex items-center justify-between">
              <span className="text-xs text-on-surface-variant/50 font-body">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredStudents.length)} of {filteredStudents.length}
              </span>
              <div className="flex gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-on-surface-variant disabled:opacity-30 hover:bg-surface-container transition-colors">
                  <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <button key={p} onClick={() => setPage(p)}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold transition-colors ${p === page ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container'}`}>
                    {p}
                  </button>
                ))}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-on-surface-variant disabled:opacity-30 hover:bg-surface-container transition-colors">
                  <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Scoring Modal ── */}
      {selectedStudent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setSelectedStudent(null); }}
        >
          <div className="bg-surface-container-lowest w-full max-w-4xl max-h-[90vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden relative">

            {/* Close */}
            <button
              onClick={() => setSelectedStudent(null)}
              className="absolute top-5 right-5 p-2 rounded-full hover:bg-surface-container transition-colors z-20"
            >
              <span className="material-symbols-outlined text-on-surface-variant">close</span>
            </button>

            {/* Student header */}
            <div className="p-8 pb-5 border-b border-outline-variant/20 flex items-center gap-5 shrink-0">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold font-headline text-xl shrink-0">
                {getInitials(selectedStudent.name)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="font-headline font-extrabold text-2xl text-primary tracking-tight truncate">
                    {selectedStudent.name}
                  </h2>
                  <span className="material-symbols-outlined text-primary text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    verified
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 items-center">
                  <span className="flex items-center gap-1.5 text-on-surface-variant font-semibold text-sm font-body">
                    <span className="material-symbols-outlined text-sm">badge</span>
                    {selectedStudent.position}
                  </span>
                  {selectedStudent.constituency && (
                    <>
                      <span className="w-1 h-1 bg-outline-variant rounded-full" />
                      <span className="flex items-center gap-1.5 text-on-surface-variant text-sm font-body">
                        <span className="material-symbols-outlined text-sm">location_on</span>
                        {selectedStudent.constituency}
                      </span>
                    </>
                  )}
                  <span className="w-1 h-1 bg-outline-variant rounded-full" />
                  <span className="text-secondary font-bold text-[10px] uppercase tracking-widest font-body">
                    ID: YIP-{selectedStudent.serial_number}
                  </span>
                </div>
              </div>
            </div>

            {/* Form body + footer */}
            <AssessmentForm
              student={selectedStudent}
              existingAssessments={getStudentAssessments(selectedStudent.user_id)}
              onSubmit={handleAssessmentSubmit}
              isLocked={isLockedByOrganizer}
              onCancel={() => setSelectedStudent(null)}
            />
          </div>
        </div>
      )}

      {/* ── Award Nomination Modal ── */}
      {nominatingStudent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setNominatingStudent(null); }}
        >
          <div className="bg-surface-container-lowest w-full max-w-2xl max-h-[90vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden">

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
                  <h2 className="font-headline font-extrabold text-lg text-on-surface">Nominate Award</h2>
                  <p className="text-xs text-on-surface-variant/60 font-body mt-0.5">
                    for <span className="font-bold text-primary">{nominatingStudent.name}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setNominatingStudent(null)}
                className="p-2 rounded-full hover:bg-surface-container transition-colors"
              >
                <span className="material-symbols-outlined text-on-surface-variant">close</span>
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-7 space-y-6" style={{ scrollbarWidth: 'none' }}>

              {/* Award selection */}
              <div>
                <p className="text-[10px] font-bold text-on-surface-variant/50 uppercase tracking-widest mb-3 font-body">
                  Select Award to Nominate
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {awards.map(award => (
                    <button
                      key={award.id}
                      onClick={() => setSelectedAwardId(selectedAwardId === award.id ? '' : award.id)}
                      className={`flex items-start gap-3 p-3.5 rounded-2xl text-left transition-all border ${
                        selectedAwardId === award.id
                          ? 'bg-primary/8 border-primary/30 text-primary'
                          : 'bg-surface-container-low border-outline-variant/15 text-on-surface-variant hover:border-primary/20 hover:bg-primary/5'
                      }`}
                    >
                      <span
                        className={`material-symbols-outlined text-[18px] shrink-0 mt-0.5 ${selectedAwardId === award.id ? 'text-primary' : 'text-on-surface-variant/40'}`}
                        style={selectedAwardId === award.id ? { fontVariationSettings: "'FILL' 1" } : undefined}
                      >workspace_premium</span>
                      <div>
                        <div className={`text-sm font-bold font-headline leading-tight ${selectedAwardId === award.id ? 'text-primary' : 'text-on-surface'}`}>
                          {award.name}
                        </div>
                        {award.description && (
                          <div className="text-[11px] text-on-surface-variant/50 font-body mt-0.5 leading-relaxed">
                            {award.description}
                          </div>
                        )}
                      </div>
                      {selectedAwardId === award.id && (
                        <span
                          className="material-symbols-outlined text-primary text-[18px] shrink-0 ml-auto"
                          style={{ fontVariationSettings: "'FILL' 1" }}
                        >check_circle</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* All jury nominations for this student */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-bold text-on-surface-variant/50 uppercase tracking-widest font-body">
                    Jury Nominations
                  </p>
                  {(() => {
                    const allVotes = getStudentAwardVotes(nominatingStudent.user_id);
                    const total = juryMembers.length;
                    const nominated = allVotes.length;
                    if (total === 0) return null;
                    return (
                      <span className={`text-[11px] font-bold font-body px-2 py-0.5 rounded-full ${
                        nominated === total && total > 1
                          ? 'bg-[#42d59a]/15 text-[#2bb87c]'
                          : nominated > 0
                          ? 'bg-primary/10 text-primary'
                          : 'bg-surface-container text-on-surface-variant/50'
                      }`}>
                        {nominated}/{total} juries
                      </span>
                    );
                  })()}
                </div>
                <div className="space-y-2">
                  {juryMembers.map(member => {
                    const vote = allAwardVotes.find(v => v.student_id === nominatingStudent.user_id && v.jury_id === member.user_id);
                    const awardName = vote ? awards.find(a => a.id === vote.award_id)?.name : null;
                    const isMe = member.user_id === juryId;
                    return (
                      <div
                        key={member.user_id}
                        className={`flex items-center justify-between px-4 py-3 rounded-2xl ${
                          isMe
                            ? 'bg-primary/5 border border-primary/15'
                            : 'bg-surface-container-low border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold font-headline shrink-0 ${isMe ? 'bg-primary/15 text-primary' : 'bg-outline-variant/20 text-on-surface-variant'}`}>
                            {getInitials(member.name)}
                          </div>
                          <div>
                            <span className="text-sm font-bold text-on-surface font-headline">
                              {member.name}
                              {isMe && <span className="ml-1.5 text-[10px] font-bold text-primary/70 font-body">(You)</span>}
                            </span>
                            {member.position && (
                              <div className="text-[11px] text-on-surface-variant/50 font-body">{member.position}</div>
                            )}
                          </div>
                        </div>
                        {awardName ? (
                          <span className="flex items-center gap-1 text-[11px] font-bold font-body text-primary bg-primary/10 px-2 py-1 rounded-full">
                            <span
                              className="material-symbols-outlined text-[13px]"
                              style={{ fontVariationSettings: "'FILL' 1" }}
                            >workspace_premium</span>
                            <span className="truncate max-w-[140px]">{awardName}</span>
                          </span>
                        ) : (
                          <span className="text-[11px] font-body text-on-surface-variant/30 italic">Not nominated</span>
                        )}
                      </div>
                    );
                  })}
                  {juryMembers.length === 0 && (
                    <p className="text-xs text-on-surface-variant/40 font-body text-center py-3">
                      No jury members found
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-7 py-5 border-t border-outline-variant/10 flex items-center justify-between shrink-0">
              <button
                onClick={() => { setSelectedAwardId(''); }}
                disabled={!selectedAwardId}
                className="text-sm font-bold text-error/70 hover:text-error transition-colors disabled:opacity-30 font-body flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">remove_circle</span>
                Remove Nomination
              </button>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setNominatingStudent(null)}
                  className="px-5 py-2 rounded-full text-sm font-bold text-on-surface-variant hover:bg-surface-container font-body transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleNominateAward}
                  disabled={nominationLoading}
                  className="px-6 py-2 bg-primary text-on-primary rounded-full text-sm font-bold font-body shadow-[0_4px_12px_rgba(19,41,143,0.25)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {nominationLoading && (
                    <span className="w-3.5 h-3.5 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
                  )}
                  {nominationLoading ? 'Saving…' : 'Save Nomination'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
