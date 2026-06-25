
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

// ── Types ──────────────────────────────────────────────────────────────────────
interface Scores {
  leadership?: number;
  mupi?: number;
  question_hour?: number;
  zero_hour?: number;
  political_acumen?: number;
  committee?: number;
  bill_presentation?: number;
}

interface StudentProfile {
  user_id: string;
  name: string;
  position: string;
  party_alignment: string;
  party_number: number;
  party_name?: string | null;
  photo_url?: string | null;
  serial_number: number;
}

type AccentKey = 'primary' | 'secondary' | 'tertiary' | 'error';

interface AwardDef {
  key: string;
  name: string;
  icon: string;
  accent: AccentKey;
  basis: string;
  formula: (scores: Scores, total: number) => number;
  maxScore: number;
  constraint: ((p: StudentProfile) => boolean) | null;
  constraintLabel?: string;
}

const sc = (s: Scores, k: keyof Scores) => s[k] ?? 0;
const isLeadershipRole = (pos: string) =>
  /speaker|prime minister|minister|party leader|coalition leader|leader of opposition/i.test(pos || '');

// ── 15 Award definitions — names match DB exactly ────────────────────────────
const AWARD_DEFS: AwardDef[] = [
  { key: 'best_parliamentarian',  name: 'Best Parliamentarian Award',               icon: 'emoji_events',    accent: 'primary',   basis: 'Highest overall score', formula: (_s, t) => t, maxScore: 100, constraint: null },
  { key: 'best_speaker',          name: 'Best Speaker Award',                        icon: 'gavel',           accent: 'primary',   basis: 'Highest total — Speaker role only', formula: (_s, t) => t, maxScore: 100, constraint: p => /speaker/i.test(p.position), constraintLabel: 'Speaker only' },
  { key: 'leadership_excellence', name: 'Leadership Excellence Award',               icon: 'star',            accent: 'secondary', basis: 'Overall score — leadership roles only', formula: (_s, t) => t, maxScore: 100, constraint: p => isLeadershipRole(p.position), constraintLabel: 'Leadership roles' },
  { key: 'best_member_ruling',    name: 'Best Member — Ruling Bench Award',          icon: 'account_balance', accent: 'tertiary',  basis: 'Highest total — Ruling Party members', formula: (_s, t) => t, maxScore: 100, constraint: p => p.party_alignment === 'ruling_party', constraintLabel: 'Ruling Party' },
  { key: 'best_member_opposition',name: 'Best Member — Opposition Bench Award',      icon: 'record_voice_over',accent: 'error',   basis: 'Highest total — Opposition members', formula: (_s, t) => t, maxScore: 100, constraint: p => p.party_alignment === 'opposition', constraintLabel: 'Opposition' },
  { key: 'best_debater',          name: 'Best Debater Award',                        icon: 'forum',           accent: 'primary',   basis: 'MUPI (40%) + Question Hour (60%)', formula: s => sc(s, 'mupi') / 15 * 40 + sc(s, 'question_hour') / 20 * 60, maxScore: 100, constraint: null },
  { key: 'most_persuasive',       name: 'Most Persuasive Policy Advocate',           icon: 'campaign',        accent: 'secondary', basis: 'Political Acumen (50%) + MUPI (50%)', formula: s => sc(s, 'political_acumen') / 10 * 50 + sc(s, 'mupi') / 15 * 50, maxScore: 100, constraint: null },
  { key: 'best_research',         name: 'Best Research & Presentation Award',        icon: 'auto_stories',    accent: 'primary',   basis: 'MUPI (40%) + Bill Presentation (30%) + Committee (30%)', formula: s => sc(s, 'mupi') / 15 * 40 + sc(s, 'bill_presentation') / 15 * 30 + sc(s, 'committee') / 15 * 30, maxScore: 100, constraint: null },
  { key: 'innovative_ideas',      name: 'Innovative Ideas Award',                    icon: 'lightbulb',       accent: 'tertiary',  basis: 'Zero Hour (60%) + Committee (40%)', formula: s => sc(s, 'zero_hour') / 15 * 60 + sc(s, 'committee') / 15 * 40, maxScore: 100, constraint: null },
  { key: 'community_impact',      name: 'Community Impact Award',                    icon: 'diversity_3',     accent: 'tertiary',  basis: 'MUPI (40%) + Zero Hour (30%) + Bill Presentation (30%)', formula: s => sc(s, 'mupi') / 15 * 40 + sc(s, 'zero_hour') / 15 * 30 + sc(s, 'bill_presentation') / 15 * 30, maxScore: 100, constraint: null },
  { key: 'mvp',                   name: 'Most Valuable Participant (MVP) Award',     icon: 'military_tech',   accent: 'primary',   basis: 'Average of all 6 session scores (most consistent)', formula: s => (sc(s,'mupi')/15 + sc(s,'question_hour')/20 + sc(s,'zero_hour')/15 + sc(s,'political_acumen')/10 + sc(s,'committee')/15 + sc(s,'bill_presentation')/15) / 6 * 100, maxScore: 100, constraint: null },
  { key: 'team_spirit',           name: 'Team Spirit Award',                         icon: 'handshake',       accent: 'secondary', basis: 'Committee Discussions & Bill Drafting score', formula: s => sc(s, 'committee') / 15 * 100, maxScore: 100, constraint: null },
  { key: 'exemplary_decorum',     name: 'Exemplary Parliamentary Decorum Award',     icon: 'verified',        accent: 'primary',   basis: 'MUPI (34%) + Zero Hour (33%) + Bill Presentation (33%)', formula: s => sc(s, 'mupi') / 15 * 34 + sc(s, 'zero_hour') / 15 * 33 + sc(s, 'bill_presentation') / 15 * 33, maxScore: 100, constraint: null },
  { key: 'independent_voice',     name: 'Independent Voice of the House Award',      icon: 'person_raised_hand',accent: 'secondary',basis: 'MUPI + Zero Hour + Question Hour — Non-aligned', formula: s => sc(s, 'mupi') / 15 * 34 + sc(s, 'zero_hour') / 15 * 33 + sc(s, 'question_hour') / 20 * 33, maxScore: 100, constraint: p => p.party_alignment === 'non_aligned', constraintLabel: 'Non-aligned' },
  { key: 'best_constituency_rep', name: 'Best Constituency Representative Award',    icon: 'location_on',     accent: 'tertiary',  basis: 'MUPI (50%) + Question Hour (30%) + Zero Hour (20%)', formula: s => sc(s, 'mupi') / 15 * 50 + sc(s, 'question_hour') / 20 * 30 + sc(s, 'zero_hour') / 15 * 20, maxScore: 100, constraint: null },
];

// ── Props ──────────────────────────────────────────────────────────────────────
interface AwardIntelligenceDashboardProps {
  juryId?: string;
  isOrganizer?: boolean;
}

// ── Component ──────────────────────────────────────────────────────────────────
export const AwardIntelligenceDashboard = ({ juryId, isOrganizer }: AwardIntelligenceDashboardProps) => {
  const { profile } = useAuth();
  const [profiles, setProfiles] = useState<StudentProfile[]>([]);
  const [assessments, setAssessments] = useState<{ student_id: string; scores: Record<string, number>; total_score: number; jury_id: string }[]>([]);
  const [awards, setAwards] = useState<{ id: string; name: string }[]>([]);
  const [awardVotes, setAwardVotes] = useState<{ id: string; award_id: string; student_id: string; jury_id: string }[]>([]);
  const [studentAwards, setStudentAwards] = useState<{ id: string; award_id: string; student_id: string }[]>([]);
  const [nominating, setNominating] = useState<string | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [juryCount, setJuryCount] = useState(0);
  const [activeAwardIdx, setActiveAwardIdx] = useState(0);
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null);

  // ── Data Fetching ──
  // assessments, award_votes, and student_awards do NOT have an event_id column —
  // we scope them by the event's student IDs fetched first.
  const fetchAll = async () => {
    const eventId = profile?.event_id ?? '';

    // Step 1: get event students
    const profilesRes = await supabase
      .from('profiles')
      .select('user_id,name,position,party_alignment,party_number,party_name,photo_url,serial_number')
      .eq('user_type', 'student').eq('is_active', true).eq('event_id', eventId);
    if (profilesRes.data) setProfiles(profilesRes.data as StudentProfile[]);

    const studentIds = (profilesRes.data || []).map(p => p.user_id);

    // Step 2: fetch remaining data in parallel, scoped by student IDs
    const [assessRes, awardsRes, votesRes, juryRes, studentAwardsRes] = await Promise.all([
      studentIds.length > 0
        ? supabase.from('assessments').select('student_id,scores,total_score,jury_id')
            .in('student_id', studentIds)
            .in('status', ['submitted', 'draft']) // include draft so locked sessions count
            .is('session_id', null)
        : { data: [] as any[] },
      supabase.from('awards').select('id,name'),
      studentIds.length > 0
        ? supabase.from('award_votes').select('id,award_id,student_id,jury_id').in('student_id', studentIds)
        : { data: [] as any[] },
      supabase.from('profiles').select('user_id', { count: 'exact', head: true }).eq('user_type', 'jury').eq('event_id', eventId),
      studentIds.length > 0
        ? supabase.from('student_awards').select('id,award_id,student_id').in('student_id', studentIds)
        : { data: [] as any[] },
    ]);
    if (assessRes.data) setAssessments(assessRes.data as typeof assessments);
    if (awardsRes.data) setAwards(awardsRes.data);
    if (votesRes.data) setAwardVotes(votesRes.data as typeof awardVotes);
    if (juryRes.count !== null) setJuryCount(juryRes.count);
    if (studentAwardsRes.data) setStudentAwards(studentAwardsRes.data);
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
    const ch = supabase.channel('award-intelligence-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assessments' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'award_votes' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'student_awards' }, fetchAll)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  // ── Computed Data ──
  const SESSION_KEYS = ['mupi', 'question_hour', 'zero_hour', 'political_acumen', 'committee', 'bill_presentation'] as const;

  const studentScores = useMemo(() => {
    const map: Record<string, { scores: Scores; total: number; count: number }> = {};
    assessments.forEach(a => {
      const s = (a.scores || {}) as Record<string, number>;
      // Skip assessments where all session scores are 0 — these are reset/cleared entries.
      // The total_score may still be non-zero (leadership bonus) but there's nothing real to rank.
      const hasRealScores = SESSION_KEYS.some(k => (s[k] || 0) > 0);
      if (!hasRealScores) return;

      if (!map[a.student_id]) map[a.student_id] = { scores: {}, total: 0, count: 0 };
      const entry = map[a.student_id];
      SESSION_KEYS.forEach(k => { (entry.scores as Record<string, number>)[k] = ((entry.scores as Record<string, number>)[k] || 0) + (s[k] || 0); });
      entry.total += a.total_score || 0;
      entry.count += 1;
    });
    Object.values(map).forEach(entry => {
      SESSION_KEYS.forEach(k => { (entry.scores as Record<string, number>)[k] /= entry.count; });
      entry.total /= entry.count;
    });
    return map;
  }, [assessments]);

  const top3 = useMemo(() => {
    const result: Record<string, { profile: StudentProfile; awardScore: number }[]> = {};
    AWARD_DEFS.forEach(award => {
      result[award.key] = profiles
        .filter(p => !award.constraint || award.constraint(p))
        .map(p => {
          const entry = studentScores[p.user_id];
          if (!entry || entry.count === 0) return null;
          return { profile: p, awardScore: award.formula(entry.scores, entry.total) };
        })
        .filter((c): c is NonNullable<typeof c> => c !== null && c.awardScore > 0)
        .sort((a, b) => b.awardScore - a.awardScore)
        .slice(0, 3);
    });
    return result;
  }, [profiles, studentScores]);

  const awardIdMap = useMemo(() => {
    const map: Record<string, string> = {};
    AWARD_DEFS.forEach(def => {
      // Exact name match first, then case-insensitive fallback
      const match = awards.find(a => a.name === def.name)
        ?? awards.find(a => a.name.toLowerCase() === def.name.toLowerCase());
      if (match) map[def.key] = match.id;
    });
    return map;
  }, [awards]);

  const voteCount = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    awardVotes.forEach(v => {
      const def = AWARD_DEFS.find(d => awardIdMap[d.key] === v.award_id);
      if (!def) return;
      if (!map[def.key]) map[def.key] = {};
      map[def.key][v.student_id] = (map[def.key][v.student_id] || 0) + 1;
    });
    return map;
  }, [awardVotes, awardIdMap]);

  const myVotes = useMemo(() => {
    if (!juryId) return {};
    const map: Record<string, string> = {};
    awardVotes.filter(v => v.jury_id === juryId).forEach(v => { map[v.award_id] = v.student_id; });
    return map;
  }, [awardVotes, juryId]);

  // ── Handlers ──
  const handleNominate = async (awardKey: string, studentId: string) => {
    if (!juryId) return;
    const awardId = awardIdMap[awardKey];
    if (!awardId) { toast({ title: 'Award not in database — add it in Award Management first', variant: 'destructive' }); return; }
    const key = `${awardKey}::${studentId}`;
    setNominating(key);
    try {
      const existing = awardVotes.find(v => v.award_id === awardId && v.jury_id === juryId);
      if (existing) await supabase.from('award_votes').delete().eq('id', existing.id);
      if (myVotes[awardId] !== studentId) {
        await supabase.from('award_votes').insert({ award_id: awardId, student_id: studentId, jury_id: juryId });
        setSelectedCandidate(studentId);
        toast({ title: 'Nomination recorded' });
      } else {
        setSelectedCandidate(null);
        toast({ title: 'Nomination removed' });
      }
    } catch {
      toast({ title: 'Failed to save nomination', variant: 'destructive' });
    } finally {
      setNominating(null);
    }
  };

  const handleSelectCandidate = (awardKey: string, studentId: string) => {
    if (juryId) {
      handleNominate(awardKey, studentId);
    } else {
      // Organizer: toggle visual selection only
      setSelectedCandidate(prev => prev === studentId ? null : studentId);
    }
  };

  const handleFinalize = async () => {
    if (!selectedCandidate) {
      toast({ title: 'Select a candidate first', variant: 'destructive' });
      return;
    }
    const awardId = awardIdMap[activeAward.key];
    if (!awardId) {
      toast({ title: 'Award not in database — add it in Award Management first', variant: 'destructive' });
      return;
    }
    setFinalizing(true);
    try {
      if (juryId) {
        if (myVotes[awardId] !== selectedCandidate) {
          await handleNominate(activeAward.key, selectedCandidate);
        }
        toast({ title: "Jury's verdict finalized", description: 'Your nomination has been recorded.' });
      } else {
        const existing = studentAwards.find(sa => sa.award_id === awardId);
        if (existing?.student_id === selectedCandidate) {
          toast({ title: 'Award already confirmed for this delegate' });
        } else {
          if (existing) await supabase.from('student_awards').delete().eq('id', existing.id);
          const { data: { user } } = await supabase.auth.getUser();
          const { error } = await supabase.from('student_awards').insert({
            award_id: awardId,
            student_id: selectedCandidate,
            assigned_by_organizer: true,
            assigned_by_user_id: user?.id,
            event_id: profile?.event_id ?? null,
          });
          if (error) throw error;
          toast({ title: 'Award confirmed', description: 'The recipient has been finalized.' });
          fetchAll();
        }
      }
    } catch {
      toast({ title: 'Failed to finalize award', variant: 'destructive' });
    } finally {
      setFinalizing(false);
    }
  };

  // ── Derived ──
  const activeAward = AWARD_DEFS[activeAwardIdx];
  const candidates = top3[activeAward.key] ?? [];
  const scoredCount = Object.keys(studentScores).length;
  const totalSubmittedAssessments = assessments.length;
  const totalVotesCast = awardVotes.length;
  const avgScore = scoredCount > 0
    ? (Object.values(studentScores).reduce((sum, e) => sum + e.total, 0) / scoredCount)
    : 0;

  // Confidence: how dominant is the top scorer for this award
  const confidence = useMemo(() => {
    if (candidates.length < 2) return candidates.length === 1 ? 95 : 0;
    const gap = candidates[0].awardScore - candidates[1].awardScore;
    const maxPossible = activeAward.maxScore;
    return Math.min(99, Math.round(70 + (gap / maxPossible) * 100));
  }, [candidates, activeAward]);

  // Jury consensus for selected candidate
  const selectedName = useMemo(() => {
    if (!selectedCandidate) return null;
    return profiles.find(p => p.user_id === selectedCandidate)?.name ?? null;
  }, [selectedCandidate, profiles]);

  const juryApprovals = useMemo(() => {
    if (!selectedCandidate || !activeAward) return 0;
    return voteCount[activeAward.key]?.[selectedCandidate] ?? 0;
  }, [selectedCandidate, activeAward, voteCount]);

  const isFinalized = useMemo(() => {
    if (!selectedCandidate) return false;
    const awardId = awardIdMap[activeAward.key];
    if (!awardId) return false;
    return studentAwards.some(sa => sa.award_id === awardId && sa.student_id === selectedCandidate);
  }, [selectedCandidate, awardIdMap, activeAward, studentAwards]);

  const initials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  // Auto-select a candidate when opening/switching an award:
  // jury sees their own nomination; organizer/super admin sees the jury's consensus pick (most votes)
  useEffect(() => {
    const awardId = awardIdMap[activeAward.key];
    if (juryId) {
      setSelectedCandidate(awardId && myVotes[awardId] ? myVotes[awardId] : null);
      return;
    }
    if (isOrganizer) {
      const votes = voteCount[activeAward.key] ?? {};
      let consensus: { id: string; votes: number } | null = null;
      candidates.forEach(c => {
        const v = votes[c.profile.user_id] ?? 0;
        if (v > 0 && (!consensus || v > consensus.votes)) consensus = { id: c.profile.user_id, votes: v };
      });
      setSelectedCandidate(consensus ? consensus.id : null);
      return;
    }
    setSelectedCandidate(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAwardIdx, loading]);

  // ── Loading ──
  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="text-center space-y-4">
          <div className="w-14 h-14 mx-auto border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-on-surface-variant font-body font-medium">Loading Award Intelligence…</p>
        </div>
      </div>
    );
  }

  // ── Render ──
  return (
    <div className="space-y-0 animate-in fade-in duration-500 flex flex-col min-h-0 min-w-0 w-full">

      {/* ─── Award Pellet Filter Bar ─── */}
      <div className="pb-3">
        <div className="flex flex-wrap items-center gap-2">
          {AWARD_DEFS.map((award, idx) => {
            const isActive = idx === activeAwardIdx;
            const hasVotes = Object.keys(voteCount[award.key] ?? {}).length > 0;
            return (
              <button
                key={award.key}
                onClick={() => setActiveAwardIdx(idx)}
                className={`flex-shrink-0 px-3.5 py-1.5 rounded-full font-headline font-bold text-xs transition-all duration-300 flex items-center gap-1.5 ${isActive
                    ? 'bg-gradient-to-r from-primary to-primary-container text-on-primary shadow-[0_4px_16px_rgba(19,41,143,0.25)]'
                    : 'bg-surface-container-lowest border border-outline-variant/10 text-on-surface hover:border-primary/30 hover:bg-primary/5'
                  }`}
              >
                {award.name.replace(' Award', '')}
                {isActive && (
                  <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                )}
                {!isActive && hasVotes && (
                  <span className="w-2 h-2 rounded-full bg-tertiary-container shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Main Detail View ─── */}
      <div className="flex flex-col gap-3">

        {/* Award Detail Container */}
        <div className="bg-surface-container-lowest rounded-[1.5rem] p-4 lg:p-5 shadow-[0_32px_64px_-16px_rgba(19,41,143,0.06)] relative overflow-hidden">

          {/* Subtle background accent */}
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/[0.04] rounded-full -translate-y-1/2 translate-x-1/2 blur-[100px] pointer-events-none" />

          <div className="relative z-10">

            {/* Award Header Detail */}
            <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-3 pb-4 border-b border-outline-variant/10">
              <div className="max-w-3xl">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                    <span
                      className="material-symbols-outlined text-primary text-lg"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      {activeAward.icon}
                    </span>
                  </div>
                  <span className="text-[10px] font-black tracking-[0.25em] text-primary uppercase font-headline">
                    Category Deep-Dive
                  </span>
                  {activeAward.constraintLabel && (
                    <span className="text-[9px] font-black tracking-widest uppercase px-2.5 py-1 rounded-full bg-secondary/10 text-secondary font-headline">
                      {activeAward.constraintLabel}
                    </span>
                  )}
                </div>
                <h2 className="text-xl lg:text-2xl font-extrabold font-headline text-on-surface leading-[1.1] tracking-tight">
                  {activeAward.name.replace(' Award', '')}
                </h2>
                <p className="mt-1.5 text-on-surface-variant leading-snug text-xs font-medium font-body opacity-80 max-w-2xl">
                  {activeAward.basis}
                </p>
              </div>

              {/* Confidence Badge */}
              {scoredCount > 0 && (
                <div className="bg-primary-container text-on-primary-container px-5 py-2.5 rounded-2xl flex flex-row xl:flex-col items-center justify-center gap-2 xl:gap-0.5 min-w-[120px] shadow-[0_16px_48px_-8px_rgba(19,41,143,0.25)] self-start xl:self-center">
                  <span className="text-[9px] font-black tracking-[0.2em] uppercase opacity-70 font-headline">
                    AI Confidence
                  </span>
                  <span className="text-xl lg:text-2xl font-black font-headline tracking-tighter">
                    {confidence}%
                  </span>
                </div>
              )}
            </div>

            {/* Algorithmic Suggestions */}
            <div className="mt-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between mb-3 gap-2">
                <div className="flex flex-col">
                  <h3 className="text-base font-bold font-headline text-on-surface">Algorithmic Suggestions</h3>
                  <p className="text-xs font-medium text-on-surface-variant font-body mt-0.5">
                    Top candidates analyzed across multidimensional metrics
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {juryId && (
                    <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60 font-headline bg-surface-container px-3 py-1.5 rounded-full">
                      Tap to nominate
                    </span>
                  )}
                </div>
              </div>

              {/* Candidate Cards */}
              {candidates.length === 0 ? (
                <div className="bg-surface-container rounded-[1.5rem] px-8 py-8 text-center">
                  <span className="material-symbols-outlined text-[36px] text-on-surface-variant/20 block mb-2" style={{ fontVariationSettings: "'FILL' 1" }}>
                    emoji_events
                  </span>
                  <p className="text-sm font-bold text-on-surface-variant/50 font-body">
                    No eligible scored delegates yet for this award.
                  </p>
                  <p className="text-xs text-on-surface-variant/40 font-body mt-1">
                    Suggestions will appear as jury members submit assessments.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {candidates.map((c, i) => {
                    const studentInitials = initials(c.profile.name);
                    const score = Math.min(c.awardScore, activeAward.maxScore);
                    const awardId = awardIdMap[activeAward.key];
                    const isMyPick = awardId ? myVotes[awardId] === c.profile.user_id : false;
                    const isSelected = selectedCandidate === c.profile.user_id;
                    const isBusy = nominating === `${activeAward.key}::${c.profile.user_id}`;
                    const votes = voteCount[activeAward.key]?.[c.profile.user_id] ?? 0;
                    const rankLabels = ['1st', '2nd', '3rd'];
                    const skillTags = getSkillTags(activeAward.key, i);

                    return (
                      <div
                        key={c.profile.user_id}
                        className="relative group cursor-pointer"
                        onClick={() => handleSelectCandidate(activeAward.key, c.profile.user_id)}
                      >
                        <div className={`p-3 flex flex-col items-center text-center relative z-10 bg-surface-container-lowest rounded-[1.5rem] transition-all duration-300 h-full ${isSelected || isMyPick
                            ? 'border-2 border-primary bg-primary/[0.03] ring-4 ring-primary/10 shadow-[0_32px_64px_-16px_rgba(19,41,143,0.15)]'
                            : 'border border-outline-variant/10 shadow-[0_4px_32px_0_rgba(19,41,143,0.04)] group-hover:shadow-[0_32px_64px_-16px_rgba(19,41,143,0.1)] group-hover:-translate-y-1 group-hover:border-primary/20'
                          }`}>

                          {/* Rank badge (top-left) */}
                          <div className="absolute top-2.5 left-2.5">
                            <span className={`text-[9px] font-black font-headline px-2 py-0.5 rounded-lg ${i === 0 ? 'bg-secondary/10 text-secondary' :
                                i === 1 ? 'bg-surface-container-high text-on-surface-variant' :
                                  'bg-surface-container text-on-surface-variant/60'
                              }`}>
                              {rankLabels[i]}
                            </span>
                          </div>

                          {/* Avatar */}
                          <div className="relative mb-2 mt-1">
                            <div className="w-16 h-16 rounded-full ring-4 ring-primary/5 p-0.5">
                              <Avatar className="w-full h-full rounded-full">
                                <AvatarImage
                                  src={c.profile.photo_url ?? undefined}
                                  alt={c.profile.name}
                                  className="object-cover rounded-full"
                                />
                                <AvatarFallback className="bg-primary-fixed text-primary font-headline font-extrabold text-base rounded-full w-full h-full">
                                  {studentInitials}
                                </AvatarFallback>
                              </Avatar>
                            </div>
                            {/* Score badge */}
                            <div className="absolute -bottom-1 -right-1 bg-tertiary-container text-on-tertiary-container text-[10px] font-black px-2 py-0.5 rounded-lg shadow-[0_4px_16px_rgba(0,62,41,0.25)] ring-2 ring-surface-container-lowest font-headline">
                              {score.toFixed(1)}
                            </div>
                          </div>

                          {/* Name + Position */}
                          <h4 className="font-headline font-extrabold text-sm text-on-surface leading-tight">{c.profile.name}</h4>
                          <p className="text-[11px] text-on-surface-variant font-semibold font-body mt-0.5">{c.profile.position}</p>

                          {/* Jury vote count */}
                          {votes > 0 && (
                            <div className="flex items-center gap-1.5 mt-1.5">
                              <span className="material-symbols-outlined text-[12px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>how_to_reg</span>
                              <span className="text-[10px] font-black text-primary font-headline">{votes}/{juryCount || '?'} jury votes</span>
                            </div>
                          )}

                          {/* Skill tags */}
                          <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                            {skillTags.map((tag) => (
                              <span key={tag} className="px-2 py-0.5 bg-surface-container rounded-full text-[9px] font-black text-on-surface-variant tracking-wider uppercase font-headline">
                                {tag}
                              </span>
                            ))}
                          </div>

                          {/* Select / Nominate Button */}
                          <div className="mt-auto pt-3 w-full">
                            <div className={`py-2 rounded-xl font-bold text-xs font-body flex items-center justify-center gap-1.5 transition-all duration-300 ${isSelected || isMyPick
                                ? 'bg-gradient-to-r from-primary to-primary-container text-on-primary shadow-[0_4px_16px_rgba(19,41,143,0.25)]'
                                : 'border-2 border-primary text-primary hover:bg-primary hover:text-on-primary'
                              }`}>
                              {isBusy ? (
                                <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                              ) : isSelected || isMyPick ? (
                                <>
                                  <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                                  {juryId ? 'NOMINATED' : 'SELECTED'}
                                </>
                              ) : (
                                juryId ? 'Nominate Candidate' : 'Select Candidate'
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ─── Live Activity Panel ─── */}
            <div className="mt-4 bg-surface-container-low/50 rounded-[1.5rem] p-4 border border-outline-variant/10">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-3 gap-2">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-lg">analytics</span>
                  <h4 className="font-headline font-bold text-on-surface text-sm">Real-time Assessment Activity</h4>
                </div>
                <span className="text-[9px] font-black text-primary bg-primary/10 px-3 py-1 rounded-full tracking-widest uppercase font-headline">
                  Live Activity Stream
                </span>
              </div>

              {/* Participation bar */}
              <div className="flex items-center gap-4 mb-4">
                <div className="flex-1 h-2 bg-surface-container rounded-full overflow-hidden p-0.5 shadow-inner">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-primary-container rounded-full shadow-[0_2px_8px_rgba(19,41,143,0.3)] relative transition-all duration-1000"
                    style={{ width: `${profiles.length > 0 ? Math.round((scoredCount / profiles.length) * 100) : 0}%` }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse rounded-full" />
                  </div>
                </div>
                <span className="text-xs font-black text-primary whitespace-nowrap font-headline">
                  {profiles.length > 0 ? Math.round((scoredCount / profiles.length) * 100) : 0}% Delegates Scored
                </span>
              </div>

              {/* Stat tiles */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatTile label="Total Delegates" value={profiles.length.toString()} footnote={`${scoredCount} scored`} accent="tertiary" />
                <StatTile label="Assessments" value={totalSubmittedAssessments.toString()} footnote={`${juryCount} jury members`} accent="tertiary" />
                <StatTile label="Jury Votes Cast" value={totalVotesCast.toString()} footnote="Across all awards" accent="secondary" />
                <StatTile label="Avg. Score" value={avgScore > 0 ? avgScore.toFixed(1) : '—'} footnote="Per scored delegate" accent="outline" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Spacer so the sticky footer below doesn't cover content while scrolling */}
      {(juryId || isOrganizer) && candidates.length > 0 && (
        <div className="h-16" aria-hidden="true" />
      )}

      {/* ─── Sticky Footer Action Bar ─── */}
      {(juryId || isOrganizer) && candidates.length > 0 && (
        <div className="sticky bottom-0 mt-3 -mx-2 px-2">
          <div className="bg-surface-container-lowest/80 backdrop-blur-[12px] border border-outline-variant/10 rounded-2xl px-4 py-2.5 shadow-[0_-8px_32px_rgba(19,41,143,0.08)]">
            <div className="flex flex-col md:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-4 overflow-hidden">
                <div className="flex flex-col min-w-0">
                  <span className="text-[9px] font-black text-on-surface-variant/50 uppercase tracking-widest font-headline">
                    Selected Nominee
                  </span>
                  <span className="text-sm font-black text-primary font-headline truncate">
                    {selectedName || 'None Selected'}
                  </span>
                </div>
                {selectedCandidate && (
                  <>
                    <div className="w-px h-7 bg-outline-variant/20 hidden md:block shrink-0" />
                    <div className="flex flex-col shrink-0">
                      <span className="text-[9px] font-black text-on-surface-variant/50 uppercase tracking-widest font-headline">
                        Jury Consensus
                      </span>
                      <div className="flex items-center gap-2">
                        <div className="flex -space-x-1.5">
                          {Array.from({ length: Math.min(juryApprovals, 5) }).map((_, i) => (
                            <div key={i} className="w-4 h-4 rounded-full bg-surface-container-highest border-2 border-surface-container-lowest" />
                          ))}
                        </div>
                        <span className="text-xs font-bold text-on-surface-variant font-body">
                          {juryApprovals}/{juryCount || '?'} Approvals
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2.5 w-full md:w-auto">
                <button
                  onClick={() => setSelectedCandidate(null)}
                  className="flex-1 md:flex-none px-4 py-2 bg-surface-container text-on-surface-variant font-bold rounded-xl hover:bg-surface-container-high transition-all text-xs font-body"
                >
                  Discard Selection
                </button>
                <button
                  onClick={handleFinalize}
                  disabled={!selectedCandidate || finalizing || isFinalized}
                  className="flex-1 md:flex-none px-5 py-2 bg-gradient-to-r from-primary to-primary-container text-on-primary font-black rounded-xl shadow-[0_4px_16px_rgba(19,41,143,0.25)] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 text-xs font-body disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed"
                >
                  {finalizing ? (
                    <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : isFinalized ? (
                    <>
                      Award Confirmed
                      <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    </>
                  ) : (
                    <>
                      {juryId ? "Finalize Jury's Verdict" : 'Confirm Award'}
                      <span className="material-symbols-outlined text-base">gavel</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Helper: Stat Tile ──────────────────────────────────────────────────────────
const StatTile = ({ label, value, footnote, accent }: { label: string; value: string; footnote: string; accent: string }) => (
  <div className="bg-surface-container-lowest p-3 rounded-xl border border-outline-variant/10 shadow-sm">
    <span className="block text-[9px] font-black text-on-surface-variant/50 uppercase tracking-widest mb-1 font-headline">{label}</span>
    <span className="text-lg font-black text-on-surface font-headline">{value}</span>
    <span className={`block text-[9px] font-bold mt-0.5 font-body ${accent === 'tertiary' ? 'text-on-tertiary-container' :
        accent === 'secondary' ? 'text-secondary' :
          'text-on-surface-variant/60'
      }`}>
      {footnote}
    </span>
  </div>
);

// ── Helper: Skill Tags ─────────────────────────────────────────────────────────
function getSkillTags(awardKey: string, rank: number): string[] {
  const tagMap: Record<string, string[][]> = {
    best_parliamentarian: [['PROCEDURE', 'DECORUM'], ['ANALYTICAL', 'ORATORY'], ['STRATEGY', 'DECORUM']],
    best_speaker: [['AUTHORITY', 'FAIRNESS'], ['PROCEDURE', 'ORDER'], ['DIPLOMATIC', 'POISE']],
    leadership_excellence: [['VISION', 'COMMAND'], ['DIPLOMACY', 'INFLUENCE'], ['COALITION', 'POISE']],
    best_member_ruling: [['POLICY CRAFT', 'DEBATE'], ['LEGISLATION', 'UNITY'], ['CONSENSUS', 'DECORUM']],
    best_member_opposition: [['CRITIQUE', 'DEBATE'], ['SCRUTINY', 'COURAGE'], ['DISSENT', 'LOGIC']],
    best_debater: [['RHETORIC', 'LOGIC'], ['REBUTTAL', 'WIT'], ['PERSUASION', 'DEPTH']],
    most_persuasive: [['LOBBYING', 'STRATEGY'], ['INFLUENCE', 'RHETORIC'], ['ADVOCACY', 'DATA']],
    best_research: [['RESEARCH', 'CITATION'], ['ANALYSIS', 'DEPTH'], ['EVIDENCE', 'RIGOR']],
    innovative_ideas: [['CREATIVITY', 'IMPACT'], ['DISRUPTION', 'VISION'], ['INNOVATION', 'SCOPE']],
    community_impact: [['OUTREACH', 'EMPATHY'], ['GRASSROOTS', 'IMPACT'], ['SERVICE', 'ADVOCACY']],
    mvp: [['VERSATILE', 'CONSISTENT'], ['ALL-ROUND', 'RELIABLE'], ['DYNAMIC', 'ENGAGED']],
    team_spirit: [['COLLABORATION', 'UNITY'], ['TEAMWORK', 'SUPPORT'], ['COORDINATION', 'TRUST']],
    exemplary_decorum: [['DECORUM', 'GRACE'], ['PROTOCOL', 'DIGNITY'], ['COMPOSURE', 'RESPECT']],
    independent_voice: [['INDEPENDENT', 'BOLD'], ['UNBIASED', 'CLARITY'], ['NEUTRAL', 'CANDOR']],
    best_constituency_rep: [['LOCAL FOCUS', 'ADVOCACY'], ['CONSTITUENCY', 'VOICE'], ['REGIONAL', 'IMPACT']],
  };
  const tags = tagMap[awardKey];
  return tags ? (tags[rank] || tags[0]) : ['EXCELLENCE', 'MERIT'];
}
