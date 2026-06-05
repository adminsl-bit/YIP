import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from '@/hooks/use-toast';

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

interface AwardDef {
  key: string;
  name: string;
  icon: string;
  accent: string;
  basis: string;
  formula: (scores: Scores, total: number) => number;
  maxScore: number;
  constraint: ((p: StudentProfile) => boolean) | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const sc = (scores: Scores, k: keyof Scores) => scores[k] ?? 0;

const isLeadershipRole = (pos: string) =>
  /speaker|prime minister|minister|party leader|coalition leader|leader of opposition/i.test(pos || '');

// ── 15 Award definitions ───────────────────────────────────────────────────────
const AWARD_DEFS: AwardDef[] = [
  {
    key: 'best_parliamentarian',
    name: 'Best Parliamentarian Award',
    icon: 'emoji_events',
    accent: 'amber',
    basis: 'Highest overall score across all components',
    formula: (_s, t) => t,
    maxScore: 100,
    constraint: null,
  },
  {
    key: 'best_speaker',
    name: 'Best Speaker Award',
    icon: 'gavel',
    accent: 'purple',
    basis: 'Highest score — Speaker role only',
    formula: (_s, t) => t,
    maxScore: 100,
    constraint: p => /speaker/i.test(p.position),
  },
  {
    key: 'leadership_excellence',
    name: 'Leadership Excellence Award',
    icon: 'star',
    accent: 'yellow',
    basis: 'Leadership (50%) + overall (50%)',
    formula: (s, t) => sc(s, 'leadership') * (50 / 10) + t * 0.5,
    maxScore: 100,
    constraint: p => isLeadershipRole(p.position),
  },
  {
    key: 'best_member_ruling',
    name: 'Best Member – Ruling Bench',
    icon: 'account_balance',
    accent: 'green',
    basis: 'Highest total — Ruling Party only',
    formula: (_s, t) => t,
    maxScore: 100,
    constraint: p => p.party_alignment === 'ruling_party',
  },
  {
    key: 'best_member_opposition',
    name: 'Best Member – Opposition Bench',
    icon: 'record_voice_over',
    accent: 'red',
    basis: 'Highest total — Opposition only',
    formula: (_s, t) => t,
    maxScore: 100,
    constraint: p => p.party_alignment === 'opposition',
  },
  {
    key: 'best_debater',
    name: 'Best Debater Award',
    icon: 'forum',
    accent: 'blue',
    basis: 'MUPI (40%) + Question Hour (60%)',
    formula: s => sc(s, 'mupi') / 15 * 40 + sc(s, 'question_hour') / 20 * 60,
    maxScore: 100,
    constraint: null,
  },
  {
    key: 'most_persuasive',
    name: 'Most Persuasive Policy Advocate',
    icon: 'campaign',
    accent: 'orange',
    basis: 'Political Acumen (50%) + MUPI (50%)',
    formula: s => sc(s, 'political_acumen') / 10 * 50 + sc(s, 'mupi') / 15 * 50,
    maxScore: 100,
    constraint: null,
  },
  {
    key: 'best_research',
    name: 'Best Research & Presentation Award',
    icon: 'auto_stories',
    accent: 'cyan',
    basis: 'MUPI (40%) + Bill Presentation (30%) + Committee (30%)',
    formula: s =>
      sc(s, 'mupi') / 15 * 40 +
      sc(s, 'bill_presentation') / 15 * 30 +
      sc(s, 'committee') / 15 * 30,
    maxScore: 100,
    constraint: null,
  },
  {
    key: 'innovative_ideas',
    name: 'Innovative Ideas Award',
    icon: 'lightbulb',
    accent: 'lime',
    basis: 'Zero Hour (60%) + Committee (40%)',
    formula: s => sc(s, 'zero_hour') / 15 * 60 + sc(s, 'committee') / 15 * 40,
    maxScore: 100,
    constraint: null,
  },
  {
    key: 'community_impact',
    name: 'Community Impact Award',
    icon: 'diversity_3',
    accent: 'teal',
    basis: 'MUPI (40%) + Zero Hour (30%) + Bill Presentation (30%)',
    formula: s =>
      sc(s, 'mupi') / 15 * 40 +
      sc(s, 'zero_hour') / 15 * 30 +
      sc(s, 'bill_presentation') / 15 * 30,
    maxScore: 100,
    constraint: null,
  },
  {
    key: 'mvp',
    name: 'Most Valuable Participant (MVP)',
    icon: 'military_tech',
    accent: 'indigo',
    basis: 'Total score excluding Leadership position points',
    formula: (s, t) => t - sc(s, 'leadership'),
    maxScore: 90,
    constraint: null,
  },
  {
    key: 'team_spirit',
    name: 'Team Spirit Award',
    icon: 'handshake',
    accent: 'pink',
    basis: 'Committee Discussions & Bill Drafting score',
    formula: s => sc(s, 'committee') / 15 * 100,
    maxScore: 100,
    constraint: null,
  },
  {
    key: 'exemplary_decorum',
    name: 'Exemplary Parliamentary Decorum',
    icon: 'verified',
    accent: 'slate',
    basis: 'Leadership + MUPI + Zero Hour + Bill Presentation (conduct signals)',
    formula: s =>
      sc(s, 'leadership') / 10 * 25 +
      sc(s, 'mupi') / 15 * 25 +
      sc(s, 'zero_hour') / 15 * 25 +
      sc(s, 'bill_presentation') / 15 * 25,
    maxScore: 100,
    constraint: null,
  },
  {
    key: 'independent_voice',
    name: 'Independent Voice of the House',
    icon: 'person_raised_hand',
    accent: 'violet',
    basis: 'MUPI + Zero Hour + Question Hour — Non-aligned only',
    formula: s =>
      sc(s, 'mupi') / 15 * 34 +
      sc(s, 'zero_hour') / 15 * 33 +
      sc(s, 'question_hour') / 20 * 33,
    maxScore: 100,
    constraint: p => p.party_alignment === 'non_aligned',
  },
  {
    key: 'best_constituency_rep',
    name: 'Best Constituency Representative Award',
    icon: 'location_on',
    accent: 'emerald',
    basis: 'MUPI (50%) + Question Hour (30%) + Zero Hour (20%)',
    formula: s =>
      sc(s, 'mupi') / 15 * 50 +
      sc(s, 'question_hour') / 20 * 30 +
      sc(s, 'zero_hour') / 15 * 20,
    maxScore: 100,
    constraint: null,
  },
];

// Accent colour → Tailwind classes
const ACCENT: Record<string, { bg: string; text: string; border: string; badge: string }> = {
  amber:   { bg: 'bg-amber-50',   text: 'text-amber-700',  border: 'border-amber-200',  badge: 'bg-amber-100 text-amber-700' },
  purple:  { bg: 'bg-purple-50',  text: 'text-purple-700', border: 'border-purple-200', badge: 'bg-purple-100 text-purple-700' },
  yellow:  { bg: 'bg-yellow-50',  text: 'text-yellow-700', border: 'border-yellow-200', badge: 'bg-yellow-100 text-yellow-700' },
  green:   { bg: 'bg-green-50',   text: 'text-green-700',  border: 'border-green-200',  badge: 'bg-green-100 text-green-700' },
  red:     { bg: 'bg-red-50',     text: 'text-red-700',    border: 'border-red-200',    badge: 'bg-red-100 text-red-700' },
  blue:    { bg: 'bg-blue-50',    text: 'text-blue-700',   border: 'border-blue-200',   badge: 'bg-blue-100 text-blue-700' },
  orange:  { bg: 'bg-orange-50',  text: 'text-orange-700', border: 'border-orange-200', badge: 'bg-orange-100 text-orange-700' },
  cyan:    { bg: 'bg-cyan-50',    text: 'text-cyan-700',   border: 'border-cyan-200',   badge: 'bg-cyan-100 text-cyan-700' },
  lime:    { bg: 'bg-lime-50',    text: 'text-lime-700',   border: 'border-lime-200',   badge: 'bg-lime-100 text-lime-700' },
  teal:    { bg: 'bg-teal-50',    text: 'text-teal-700',   border: 'border-teal-200',   badge: 'bg-teal-100 text-teal-700' },
  indigo:  { bg: 'bg-indigo-50',  text: 'text-indigo-700', border: 'border-indigo-200', badge: 'bg-indigo-100 text-indigo-700' },
  pink:    { bg: 'bg-pink-50',    text: 'text-pink-700',   border: 'border-pink-200',   badge: 'bg-pink-100 text-pink-700' },
  slate:   { bg: 'bg-slate-50',   text: 'text-slate-700',  border: 'border-slate-200',  badge: 'bg-slate-100 text-slate-700' },
  violet:  { bg: 'bg-violet-50',  text: 'text-violet-700', border: 'border-violet-200', badge: 'bg-violet-100 text-violet-700' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700',border: 'border-emerald-200',badge: 'bg-emerald-100 text-emerald-700' },
};

const MEDAL = ['🥇', '🥈', '🥉'];

// ── Component ──────────────────────────────────────────────────────────────────
interface Props {
  juryId?: string;  // if provided, jury can nominate directly from this view
}

export const AwardSuggestions = ({ juryId }: Props) => {
  const [profiles, setProfiles]     = useState<StudentProfile[]>([]);
  const [assessments, setAssessments] = useState<{ student_id: string; scores: any; total_score: number; jury_id: string }[]>([]);
  const [awards, setAwards]         = useState<{ id: string; name: string }[]>([]);
  const [awardVotes, setAwardVotes] = useState<{ award_id: string; student_id: string; jury_id: string }[]>([]);
  const [nominating, setNominating] = useState<string | null>(null); // `${awardKey}::${studentId}`
  const [loading, setLoading]       = useState(true);
  const [juryCount, setJuryCount]   = useState(0);

  const fetchAll = async () => {
    const [profilesRes, assessRes, awardsRes, votesRes, juryRes] = await Promise.all([
      supabase.from('profiles').select('user_id,name,position,party_alignment,party_number,party_name,photo_url,serial_number').eq('user_type', 'student').eq('is_active', true),
      supabase.from('assessments').select('student_id,scores,total_score,jury_id').eq('status', 'submitted').is('session_id', null),
      supabase.from('awards').select('id,name'),
      supabase.from('award_votes').select('award_id,student_id,jury_id'),
      supabase.from('profiles').select('user_id', { count: 'exact', head: true }).eq('user_type', 'jury'),
    ]);
    if (profilesRes.data)  setProfiles(profilesRes.data as StudentProfile[]);
    if (assessRes.data)    setAssessments(assessRes.data);
    if (awardsRes.data)    setAwards(awardsRes.data);
    if (votesRes.data)     setAwardVotes(votesRes.data);
    if (juryRes.count !== null) setJuryCount(juryRes.count);
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
    const ch = supabase.channel('award-suggestions-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assessments' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'award_votes' }, fetchAll)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  // ── Per-student averaged scores across all submitted juries ──────────────────
  const studentScores = useMemo(() => {
    const map: Record<string, { scores: Scores; total: number; count: number }> = {};
    assessments.forEach(a => {
      if (!map[a.student_id]) map[a.student_id] = { scores: {}, total: 0, count: 0 };
      const entry = map[a.student_id];
      const s = (a.scores || {}) as Record<string, number>;
      Object.keys(s).forEach(k => {
        (entry.scores as any)[k] = ((entry.scores as any)[k] || 0) + (s[k] || 0);
      });
      entry.total += a.total_score || 0;
      entry.count += 1;
    });
    // Average
    Object.values(map).forEach(entry => {
      Object.keys(entry.scores).forEach(k => {
        (entry.scores as any)[k] /= entry.count;
      });
      entry.total /= entry.count;
    });
    return map;
  }, [assessments]);

  // ── Top 3 per award ──────────────────────────────────────────────────────────
  const top3 = useMemo(() => {
    const result: Record<string, { profile: StudentProfile; awardScore: number; juryVotes: number }[]> = {};
    AWARD_DEFS.forEach(award => {
      const candidates = profiles
        .filter(p => !award.constraint || award.constraint(p))
        .map(p => {
          const entry = studentScores[p.user_id];
          if (!entry || entry.count === 0) return null;
          const awardScore = award.formula(entry.scores, entry.total);
          return { profile: p, awardScore, juryVotes: 0 };
        })
        .filter((c): c is NonNullable<typeof c> => c !== null && c.awardScore > 0)
        .sort((a, b) => b.awardScore - a.awardScore)
        .slice(0, 3);

      result[award.key] = candidates;
    });
    return result;
  }, [profiles, studentScores]);

  // Map award name → DB award id (fuzzy match on first significant word)
  const awardIdMap = useMemo(() => {
    const map: Record<string, string> = {};
    AWARD_DEFS.forEach(def => {
      const match = awards.find(a =>
        a.name.toLowerCase().includes(def.name.split(' ')[1]?.toLowerCase() || '') ||
        def.name.toLowerCase().includes(a.name.split(' ')[1]?.toLowerCase() || '')
      );
      if (match) map[def.key] = match.id;
    });
    return map;
  }, [awards]);

  // Vote count per award per student
  const voteCount = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    awardVotes.forEach(v => {
      const awardDef = AWARD_DEFS.find(d => awardIdMap[d.key] === v.award_id);
      if (!awardDef) return;
      if (!map[awardDef.key]) map[awardDef.key] = {};
      map[awardDef.key][v.student_id] = (map[awardDef.key][v.student_id] || 0) + 1;
    });
    return map;
  }, [awardVotes, awardIdMap]);

  // Already voted check for this jury member
  const myVotes = useMemo(() => {
    if (!juryId) return {};
    const map: Record<string, string> = {}; // awardId → studentId
    awardVotes.filter(v => v.jury_id === juryId).forEach(v => {
      map[v.award_id] = v.student_id;
    });
    return map;
  }, [awardVotes, juryId]);

  const handleNominate = async (awardKey: string, studentId: string) => {
    if (!juryId) return;
    const awardId = awardIdMap[awardKey];
    if (!awardId) { toast({ title: 'Award not found in database', variant: 'destructive' }); return; }

    const key = `${awardKey}::${studentId}`;
    setNominating(key);
    try {
      const existing = awardVotes.find(v => v.award_id === awardId && v.jury_id === juryId);
      if (existing) {
        await supabase.from('award_votes').delete().eq('id', (existing as any).id);
      }
      if (myVotes[awardId] !== studentId) {
        await supabase.from('award_votes').insert({ award_id: awardId, student_id: studentId, jury_id: juryId });
        toast({ title: 'Nomination recorded' });
      } else {
        toast({ title: 'Nomination removed' });
      }
    } catch {
      toast({ title: 'Error', variant: 'destructive' });
    } finally {
      setNominating(null);
    }
  };

  const scoredStudents = Object.keys(studentScores).length;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black font-headline text-primary">
            Award <span className="text-secondary">Intelligence</span>
          </h2>
          <p className="text-xs text-on-surface-variant font-body mt-1">
            Top 3 candidates per award · live as scores come in · {scoredStudents} students scored
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-container rounded-xl">
            <span className="w-2 h-2 rounded-full bg-tertiary-fixed-dim animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant font-headline">Live</span>
          </div>
          {juryId && (
            <div className="text-[10px] font-bold text-on-surface-variant font-body bg-primary/8 px-3 py-1.5 rounded-xl">
              Click a candidate to nominate
            </div>
          )}
        </div>
      </div>

      {scoredStudents === 0 ? (
        <div className="text-center py-20 bg-surface-container-low rounded-[2rem]">
          <span className="material-symbols-outlined text-[48px] text-on-surface-variant/20 block mb-3">emoji_events</span>
          <p className="text-sm font-bold text-on-surface-variant/50 font-body">No scored students yet. Suggestions will appear as juries submit assessments.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {AWARD_DEFS.map(award => {
            const candidates = top3[award.key] ?? [];
            const ac = ACCENT[award.accent] ?? ACCENT.indigo;
            const awardId = awardIdMap[award.key];

            return (
              <div
                key={award.key}
                className={`rounded-[1.5rem] border ${ac.border} ${ac.bg} overflow-hidden flex flex-col`}
              >
                {/* Award header */}
                <div className="px-5 py-4 flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${ac.badge}`}>
                    <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      {award.icon}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-headline font-black text-sm leading-tight ${ac.text}`}>{award.name}</p>
                    <p className="text-[10px] text-on-surface-variant/60 font-body mt-0.5">{award.basis}</p>
                  </div>
                </div>

                {/* Constraint badge */}
                {award.constraint && (
                  <div className="px-5 pb-2">
                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full font-headline ${ac.badge}`}>
                      {award.key === 'best_speaker' ? 'Speaker only' :
                       award.key === 'best_member_ruling' ? 'Ruling Party only' :
                       award.key === 'best_member_opposition' ? 'Opposition only' :
                       award.key === 'independent_voice' ? 'Non-aligned only' :
                       award.key === 'leadership_excellence' ? 'Leadership roles only' : ''}
                    </span>
                  </div>
                )}

                {/* Candidates */}
                <div className="px-4 pb-4 flex-1 space-y-2">
                  {candidates.length === 0 ? (
                    <p className="text-[11px] text-on-surface-variant/40 font-body italic py-2 text-center">
                      No eligible scored candidates yet
                    </p>
                  ) : (
                    candidates.map((c, i) => {
                      const initials = c.profile.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                      const votes = voteCount[award.key]?.[c.profile.user_id] ?? 0;
                      const isMyNominee = awardId && myVotes[awardId] === c.profile.user_id;
                      const isNominating = nominating === `${award.key}::${c.profile.user_id}`;
                      const score = Math.min(c.awardScore, award.maxScore);
                      const pct = award.maxScore > 0 ? (score / award.maxScore) * 100 : 0;

                      return (
                        <div
                          key={c.profile.user_id}
                          className={`flex items-center gap-3 bg-white/70 rounded-xl px-3 py-2.5 transition-all ${
                            juryId ? 'cursor-pointer hover:bg-white active:scale-[0.98]' : ''
                          } ${isMyNominee ? 'ring-2 ring-primary/30 bg-primary/5' : ''}`}
                          onClick={() => juryId && handleNominate(award.key, c.profile.user_id)}
                        >
                          {/* Rank */}
                          <span className="text-base shrink-0 w-6 text-center">{MEDAL[i]}</span>

                          {/* Avatar */}
                          <Avatar className="w-8 h-8 rounded-xl shrink-0">
                            <AvatarImage src={c.profile.photo_url ?? undefined} alt={c.profile.name} className="object-cover" />
                            <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-black rounded-xl">{initials}</AvatarFallback>
                          </Avatar>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="font-headline font-bold text-xs text-on-surface truncate">{c.profile.name}</p>
                            {/* Score bar */}
                            <div className="w-full h-1 bg-surface-container rounded-full overflow-hidden mt-1">
                              <div
                                className={`h-full rounded-full ${ac.text.replace('text-', 'bg-')}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>

                          {/* Score + votes */}
                          <div className="text-right shrink-0">
                            <p className={`text-xs font-black font-headline ${ac.text}`}>
                              {score.toFixed(1)}
                            </p>
                            {votes > 0 && (
                              <div className="flex items-center gap-0.5 justify-end mt-0.5">
                                <span className="material-symbols-outlined text-[10px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>how_to_reg</span>
                                <span className="text-[9px] font-black text-primary font-headline">{votes}/{juryCount || '?'}</span>
                              </div>
                            )}
                            {isMyNominee && (
                              <span className="text-[9px] font-black text-primary font-headline">✓ My pick</span>
                            )}
                          </div>

                          {isNominating && (
                            <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
