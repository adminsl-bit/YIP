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

// Accent using only civic canvas tokens
type AccentKey = 'primary' | 'secondary' | 'tertiary' | 'error';
const ACCENT_CLASSES: Record<AccentKey, { icon: string; badge: string; bar: string; score: string }> = {
  primary:   { icon: 'text-primary',                    badge: 'bg-primary/8 text-primary',                             bar: 'bg-primary/50',                  score: 'text-primary' },
  secondary: { icon: 'text-secondary',                  badge: 'bg-secondary/8 text-secondary',                         bar: 'bg-secondary/50',                score: 'text-secondary' },
  tertiary:  { icon: 'text-on-tertiary-fixed-variant',  badge: 'bg-tertiary-fixed/20 text-on-tertiary-fixed-variant',   bar: 'bg-tertiary-fixed-dim/50',       score: 'text-on-tertiary-fixed-variant' },
  error:     { icon: 'text-error',                      badge: 'bg-error/8 text-error',                                 bar: 'bg-error/40',                    score: 'text-error' },
};

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

// ── 15 Award definitions ───────────────────────────────────────────────────────
const AWARD_DEFS: AwardDef[] = [
  {
    key: 'best_parliamentarian',
    name: 'Best Parliamentarian Award',
    icon: 'emoji_events',
    accent: 'primary',
    basis: 'Highest overall score across all components',
    formula: (_s, t) => t,
    maxScore: 100,
    constraint: null,
  },
  {
    key: 'best_speaker',
    name: 'Best Speaker Award',
    icon: 'gavel',
    accent: 'primary',
    basis: 'Highest total — Speaker role only',
    formula: (_s, t) => t,
    maxScore: 100,
    constraint: p => /speaker/i.test(p.position),
    constraintLabel: 'Speaker only',
  },
  {
    key: 'leadership_excellence',
    name: 'Leadership Excellence Award',
    icon: 'star',
    accent: 'secondary',
    basis: 'Leadership (50%) + Overall (50%)',
    formula: (s, t) => sc(s, 'leadership') / 10 * 50 + t * 0.5,
    maxScore: 100,
    constraint: p => isLeadershipRole(p.position),
    constraintLabel: 'Leadership roles',
  },
  {
    key: 'best_member_ruling',
    name: 'Best Member – Ruling Bench',
    icon: 'account_balance',
    accent: 'tertiary',
    basis: 'Highest total — Ruling Party members',
    formula: (_s, t) => t,
    maxScore: 100,
    constraint: p => p.party_alignment === 'ruling_party',
    constraintLabel: 'Ruling Party',
  },
  {
    key: 'best_member_opposition',
    name: 'Best Member – Opposition Bench',
    icon: 'record_voice_over',
    accent: 'error',
    basis: 'Highest total — Opposition members',
    formula: (_s, t) => t,
    maxScore: 100,
    constraint: p => p.party_alignment === 'opposition',
    constraintLabel: 'Opposition',
  },
  {
    key: 'best_debater',
    name: 'Best Debater Award',
    icon: 'forum',
    accent: 'primary',
    basis: 'MUPI (40%) + Question Hour (60%)',
    formula: s => sc(s, 'mupi') / 15 * 40 + sc(s, 'question_hour') / 20 * 60,
    maxScore: 100,
    constraint: null,
  },
  {
    key: 'most_persuasive',
    name: 'Most Persuasive Policy Advocate',
    icon: 'campaign',
    accent: 'secondary',
    basis: 'Political Acumen (50%) + MUPI (50%)',
    formula: s => sc(s, 'political_acumen') / 10 * 50 + sc(s, 'mupi') / 15 * 50,
    maxScore: 100,
    constraint: null,
  },
  {
    key: 'best_research',
    name: 'Best Research & Presentation',
    icon: 'auto_stories',
    accent: 'primary',
    basis: 'MUPI (40%) + Bill Presentation (30%) + Committee (30%)',
    formula: s => sc(s, 'mupi') / 15 * 40 + sc(s, 'bill_presentation') / 15 * 30 + sc(s, 'committee') / 15 * 30,
    maxScore: 100,
    constraint: null,
  },
  {
    key: 'innovative_ideas',
    name: 'Innovative Ideas Award',
    icon: 'lightbulb',
    accent: 'tertiary',
    basis: 'Zero Hour (60%) + Committee (40%)',
    formula: s => sc(s, 'zero_hour') / 15 * 60 + sc(s, 'committee') / 15 * 40,
    maxScore: 100,
    constraint: null,
  },
  {
    key: 'community_impact',
    name: 'Community Impact Award',
    icon: 'diversity_3',
    accent: 'tertiary',
    basis: 'MUPI (40%) + Zero Hour (30%) + Bill Presentation (30%)',
    formula: s => sc(s, 'mupi') / 15 * 40 + sc(s, 'zero_hour') / 15 * 30 + sc(s, 'bill_presentation') / 15 * 30,
    maxScore: 100,
    constraint: null,
  },
  {
    key: 'mvp',
    name: 'Most Valuable Participant',
    icon: 'military_tech',
    accent: 'primary',
    basis: 'Total score excluding Leadership position points',
    formula: (s, t) => t - sc(s, 'leadership'),
    maxScore: 90,
    constraint: null,
  },
  {
    key: 'team_spirit',
    name: 'Team Spirit Award',
    icon: 'handshake',
    accent: 'secondary',
    basis: 'Committee Discussions & Bill Drafting score',
    formula: s => sc(s, 'committee') / 15 * 100,
    maxScore: 100,
    constraint: null,
  },
  {
    key: 'exemplary_decorum',
    name: 'Exemplary Parliamentary Decorum',
    icon: 'verified',
    accent: 'primary',
    basis: 'Leadership + MUPI + Zero Hour + Bill Presentation',
    formula: s =>
      sc(s, 'leadership') / 10 * 25 + sc(s, 'mupi') / 15 * 25 +
      sc(s, 'zero_hour') / 15 * 25 + sc(s, 'bill_presentation') / 15 * 25,
    maxScore: 100,
    constraint: null,
  },
  {
    key: 'independent_voice',
    name: 'Independent Voice of the House',
    icon: 'person_raised_hand',
    accent: 'secondary',
    basis: 'MUPI + Zero Hour + Question Hour — Non-aligned',
    formula: s => sc(s, 'mupi') / 15 * 34 + sc(s, 'zero_hour') / 15 * 33 + sc(s, 'question_hour') / 20 * 33,
    maxScore: 100,
    constraint: p => p.party_alignment === 'non_aligned',
    constraintLabel: 'Non-aligned',
  },
  {
    key: 'best_constituency_rep',
    name: 'Best Constituency Representative',
    icon: 'location_on',
    accent: 'tertiary',
    basis: 'MUPI (50%) + Question Hour (30%) + Zero Hour (20%)',
    formula: s => sc(s, 'mupi') / 15 * 50 + sc(s, 'question_hour') / 20 * 30 + sc(s, 'zero_hour') / 15 * 20,
    maxScore: 100,
    constraint: null,
  },
];

const MEDAL_COLORS = [
  'bg-secondary/10 text-secondary',
  'bg-surface-container-high text-on-surface-variant',
  'bg-surface-container text-on-surface-variant/60',
];
const MEDAL_LABELS = ['1st', '2nd', '3rd'];

// ── Component ──────────────────────────────────────────────────────────────────
interface Props {
  juryId?: string;
}

export const AwardSuggestions = ({ juryId }: Props) => {
  const [profiles, setProfiles]       = useState<StudentProfile[]>([]);
  const [assessments, setAssessments] = useState<{ student_id: string; scores: any; total_score: number; jury_id: string }[]>([]);
  const [awards, setAwards]           = useState<{ id: string; name: string }[]>([]);
  const [awardVotes, setAwardVotes]   = useState<{ id: string; award_id: string; student_id: string; jury_id: string }[]>([]);
  const [nominating, setNominating]   = useState<string | null>(null);
  const [loading, setLoading]         = useState(true);
  const [juryCount, setJuryCount]     = useState(0);

  const fetchAll = async () => {
    const [profilesRes, assessRes, awardsRes, votesRes, juryRes] = await Promise.all([
      supabase.from('profiles').select('user_id,name,position,party_alignment,party_number,party_name,photo_url,serial_number').eq('user_type', 'student').eq('is_active', true),
      supabase.from('assessments').select('student_id,scores,total_score,jury_id').eq('status', 'submitted').is('session_id', null),
      supabase.from('awards').select('id,name'),
      supabase.from('award_votes').select('id,award_id,student_id,jury_id'),
      supabase.from('profiles').select('user_id', { count: 'exact', head: true }).eq('user_type', 'jury'),
    ]);
    if (profilesRes.data)   setProfiles(profilesRes.data as StudentProfile[]);
    if (assessRes.data)     setAssessments(assessRes.data);
    if (awardsRes.data)     setAwards(awardsRes.data);
    if (votesRes.data)      setAwardVotes(votesRes.data as any);
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

  // Averaged component scores per student across all submitted juries
  const studentScores = useMemo(() => {
    const map: Record<string, { scores: Scores; total: number; count: number }> = {};
    assessments.forEach(a => {
      if (!map[a.student_id]) map[a.student_id] = { scores: {}, total: 0, count: 0 };
      const entry = map[a.student_id];
      const s = (a.scores || {}) as Record<string, number>;
      Object.keys(s).forEach(k => { (entry.scores as any)[k] = ((entry.scores as any)[k] || 0) + (s[k] || 0); });
      entry.total += a.total_score || 0;
      entry.count += 1;
    });
    Object.values(map).forEach(entry => {
      Object.keys(entry.scores).forEach(k => { (entry.scores as any)[k] /= entry.count; });
      entry.total /= entry.count;
    });
    return map;
  }, [assessments]);

  // Top 3 per award
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

  // Award name → DB id (fuzzy match)
  const awardIdMap = useMemo(() => {
    const map: Record<string, string> = {};
    AWARD_DEFS.forEach(def => {
      const match = awards.find(a =>
        a.name.toLowerCase().includes(def.name.split(' ')[1]?.toLowerCase() || '') ||
        def.name.toLowerCase().includes((a.name.split(' ')[1] || '').toLowerCase())
      );
      if (match) map[def.key] = match.id;
    });
    return map;
  }, [awards]);

  // Vote counts per award per student
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

  // This jury's current nominations (awardId → studentId)
  const myVotes = useMemo(() => {
    if (!juryId) return {};
    const map: Record<string, string> = {};
    awardVotes.filter(v => v.jury_id === juryId).forEach(v => { map[v.award_id] = v.student_id; });
    return map;
  }, [awardVotes, juryId]);

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
        toast({ title: 'Nomination recorded' });
      } else {
        toast({ title: 'Nomination removed' });
      }
    } catch {
      toast({ title: 'Failed to save nomination', variant: 'destructive' });
    } finally {
      setNominating(null);
    }
  };

  const scoredCount = Object.keys(studentScores).length;

  if (loading) return (
    <div className="flex items-center justify-center h-40">
      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold font-headline tracking-tight text-primary">
            Award <span className="text-secondary">Intelligence</span>
          </h1>
          <p className="text-[10px] text-on-surface-variant/40 font-black uppercase tracking-[0.4em] mt-3 flex items-center gap-2 font-headline">
            <span className="material-symbols-outlined text-[12px]">emoji_events</span>
            Algorithmic Top-3 Suggestions · Live · {scoredCount} delegate{scoredCount !== 1 ? 's' : ''} scored
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-tertiary-fixed/15 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-tertiary-fixed-dim animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest text-on-tertiary-fixed-variant font-headline">Live</span>
          </div>
          {juryId && (
            <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60 font-headline bg-surface-container px-3 py-1.5 rounded-full">
              Tap candidate to nominate
            </span>
          )}
        </div>
      </div>

      {scoredCount === 0 ? (
        <div className="bg-surface-container-lowest rounded-[2rem] shadow-[0_4px_32px_0_rgba(19,41,143,0.06)] border border-outline-variant/10 p-16 text-center">
          <span className="material-symbols-outlined text-[48px] text-outline/30 block mb-4">emoji_events</span>
          <p className="text-sm font-bold text-on-surface-variant/50 font-body">No scored delegates yet.</p>
          <p className="text-xs text-on-surface-variant/40 font-body mt-1">Suggestions will appear live as jury members submit assessments.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {AWARD_DEFS.map(award => {
            const candidates  = top3[award.key] ?? [];
            const ac          = ACCENT_CLASSES[award.accent];
            const awardId     = awardIdMap[award.key];

            return (
              <div
                key={award.key}
                className="bg-surface-container-lowest rounded-[2rem] shadow-[0_4px_32px_0_rgba(19,41,143,0.06)] border border-outline-variant/10 overflow-hidden flex flex-col"
              >
                {/* Accent top bar */}
                <div className={`h-1 ${
                  award.accent === 'primary' ? 'bg-gradient-to-r from-primary to-primary-container' :
                  award.accent === 'secondary' ? 'bg-gradient-to-r from-secondary to-secondary-container' :
                  award.accent === 'tertiary' ? 'bg-gradient-to-r from-tertiary-container to-on-tertiary-container' :
                  'bg-gradient-to-r from-error to-error/60'
                }`} />

                {/* Award header */}
                <div className="px-5 pt-5 pb-3 flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${ac.badge}`}>
                    <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      {award.icon}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-headline font-black text-sm text-on-surface leading-tight">{award.name}</p>
                    <p className="text-[10px] text-on-surface-variant/60 font-body mt-0.5 leading-relaxed">{award.basis}</p>
                    {award.constraintLabel && (
                      <span className={`inline-flex items-center mt-1.5 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full font-headline ${ac.badge}`}>
                        {award.constraintLabel}
                      </span>
                    )}
                  </div>
                </div>

                {/* Candidates */}
                <div className="px-4 pb-5 flex-1 space-y-2">
                  {candidates.length === 0 ? (
                    <div className="bg-surface-container rounded-2xl px-4 py-5 text-center">
                      <p className="text-[11px] text-on-surface-variant/40 font-body italic">No eligible scored delegates yet</p>
                    </div>
                  ) : (
                    candidates.map((c, i) => {
                      const initials   = c.profile.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                      const votes      = voteCount[award.key]?.[c.profile.user_id] ?? 0;
                      const isMyPick   = awardId ? myVotes[awardId] === c.profile.user_id : false;
                      const isBusy     = nominating === `${award.key}::${c.profile.user_id}`;
                      const score      = Math.min(c.awardScore, award.maxScore);
                      const pct        = award.maxScore > 0 ? (score / award.maxScore) * 100 : 0;

                      return (
                        <div
                          key={c.profile.user_id}
                          onClick={() => juryId && handleNominate(award.key, c.profile.user_id)}
                          className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-all ${
                            juryId ? 'cursor-pointer hover:bg-surface-container active:scale-[0.98]' : ''
                          } ${
                            isMyPick
                              ? 'bg-primary/5 ring-1 ring-primary/20'
                              : 'bg-surface-container/50'
                          }`}
                        >
                          {/* Rank chip */}
                          <span className={`text-[9px] font-black font-headline px-1.5 py-0.5 rounded-md shrink-0 ${MEDAL_COLORS[i]}`}>
                            {MEDAL_LABELS[i]}
                          </span>

                          {/* Avatar */}
                          <Avatar className="w-8 h-8 rounded-xl shrink-0">
                            <AvatarImage src={c.profile.photo_url ?? undefined} alt={c.profile.name} className="object-cover" />
                            <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-black rounded-xl font-headline">{initials}</AvatarFallback>
                          </Avatar>

                          {/* Name + bar */}
                          <div className="flex-1 min-w-0">
                            <p className="font-headline font-bold text-xs text-on-surface truncate">{c.profile.name}</p>
                            <div className="w-full h-1 bg-surface-container-high rounded-full overflow-hidden mt-1">
                              <div className={`h-full rounded-full transition-all duration-700 ${ac.bar}`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>

                          {/* Score + vote count */}
                          <div className="text-right shrink-0 min-w-[2.5rem]">
                            <p className={`text-xs font-black font-headline ${ac.score}`}>{score.toFixed(1)}</p>
                            {votes > 0 && (
                              <div className="flex items-center gap-0.5 justify-end mt-0.5">
                                <span className="material-symbols-outlined text-[10px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>how_to_reg</span>
                                <span className="text-[9px] font-black text-primary font-headline">{votes}/{juryCount || '?'}</span>
                              </div>
                            )}
                            {isMyPick && !votes && (
                              <span className="text-[9px] font-black text-primary font-headline">✓</span>
                            )}
                          </div>

                          {isBusy && (
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
