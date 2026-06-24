import { Textarea } from "@/components/ui/textarea";
import { Lock } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

const RING_R = 58;
const RING_C = 2 * Math.PI * RING_R;

// 6 floor sessions — 90 pts total. Leadership bonus (+0 to +5) is auto-computed from role.
const SCORING_COMPONENTS = [
  {
    key: 'mupi',
    label: 'Matters of Urgent Public Importance',
    session: 'Session 1',
    max: 15,
    icon: 'record_voice_over',
    criteria: [
      { label: 'Research & Constituency Understanding', max: 4 },
      { label: 'Relevance to Central Agenda',           max: 3 },
      { label: 'Communication & Delivery',              max: 3 },
      { label: 'Parliamentary Conduct',                 max: 2 },
      { label: 'Originality & Preparation',             max: 2 },
      { label: 'Time Management',                       max: 1 },
    ],
  },
  {
    key: 'question_hour',
    label: 'Question Hour',
    session: 'Session 2',
    max: 20,
    icon: 'forum',
    criteria: [
      { label: 'Quality of Question',       max: 4 },
      { label: 'Research & Relevance',      max: 3 },
      { label: 'Parliamentary Procedure',   max: 2 },
      { label: 'Supplementary Questions',   max: 3 },
      { label: 'Quality of Response',       max: 4 },
      { label: 'Subject Knowledge',         max: 2 },
      { label: 'Handling Supplementaries',  max: 2 },
    ],
  },
  {
    key: 'zero_hour',
    label: 'Zero Hour',
    session: 'Session 3',
    max: 15,
    icon: 'hourglass_empty',
    criteria: [
      { label: 'Critical Thinking',    max: 4 },
      { label: 'Problem Solving',      max: 3 },
      { label: 'Creativity',           max: 3 },
      { label: 'Policy Orientation',   max: 2 },
      { label: 'Communication Skills', max: 2 },
      { label: 'Parliamentary Conduct',max: 1 },
    ],
  },
  {
    key: 'political_acumen',
    label: 'Political Acumen & Legislative Strategy',
    session: 'Session 4',
    max: 10,
    icon: 'account_balance',
    criteria: [
      { label: 'Coalition Building & Alliance Management',     max: 3 },
      { label: 'Parliamentary Strategy & Procedural Use',      max: 3 },
      { label: 'Influence, Negotiation & Vote Mobilisation',   max: 2 },
      { label: 'Political Communication & Floor Presence',     max: 2 },
    ],
  },
  {
    key: 'committee',
    label: 'Committee Discussions & Bill Drafting',
    session: 'Session 5',
    max: 15,
    icon: 'edit_document',
    criteria: [
      { label: 'Initiative',               max: 3 },
      { label: 'Research Contribution',    max: 3 },
      { label: 'Drafting Inputs',          max: 3 },
      { label: 'Team Collaboration',       max: 3 },
      { label: 'Quality of Committee Work',max: 3 },
    ],
  },
  {
    key: 'bill_presentation',
    label: 'Bill Presentation & Defence',
    session: 'Session 6',
    max: 15,
    icon: 'gavel',
    criteria: [
      { label: 'Quality of Bill Presentation', max: 3 },
      { label: 'Understanding of Bill',         max: 3 },
      { label: 'Defence Against Questions',     max: 5 },
      { label: 'Feasibility of Recommendations',max: 3 },
      { label: 'Parliamentary Conduct',         max: 1 },
    ],
  },
] as const;

type ComponentKey = typeof SCORING_COMPONENTS[number]['key'];

export interface ComponentScore {
  component: string;
  score: number;
}

// Auto-compute leadership bonus from position string — jury never enters this.
export const getLeadershipBonus = (position: string): number => {
  const p = (position || '').toLowerCase();
  if (p.includes('prime minister') && !p.includes('deputy')) return 5;
  if (p.includes('nominated speaker')) return 1;
  if (p.includes('deputy speaker')) return 4;
  if (p.includes('deputy prime minister')) return 4;
  if (p.includes('speaker')) return 5;
  if (p.includes('leader of opposition')) return 4;
  if (p.includes('coalition leader')) return 4;
  if (p.includes('shadow minister')) return 2;
  if (p.includes('minister')) return 3; // catches "Minister of X", "Cabinet Minister"
  if (p.includes('party leader')) return 3;
  if (p.includes('committee chair')) return 2;
  return 0;
};

interface StudentProfile {
  id: string;
  name: string;
  position: string;
  party_number: number;
  serial_number: number;
  constituency?: string;
  photo_url?: string;
  user_type: string;
}

interface ExistingAssessment {
  student_id: string;
  scores: any;
  total_score: number;
  status: 'draft' | 'submitted' | 'locked';
  notes?: string;
  session_id?: string | null;
  id?: string;
}

interface AssessmentFormProps {
  student: StudentProfile;
  existingAssessments: ExistingAssessment[];
  onSubmit: (scores: ComponentScore[], notes: string, status: 'draft' | 'submitted') => Promise<void>;
  onSessionSave?: (key: string, score: number) => Promise<void>;
  isLocked?: boolean;
  onCancel?: () => void;
}

const getGrade = (t: number) => {
  if (t >= 90) return 'Outstanding';
  if (t >= 75) return 'Excellent';
  if (t >= 60) return 'Good';
  if (t >= 45) return 'Satisfactory';
  if (t > 0)   return 'Needs Improvement';
  return '—';
};

const getStars = (t: number) => {
  if (t >= 80) return 5;
  if (t >= 60) return 4;
  if (t >= 45) return 3;
  if (t >= 25) return 2;
  if (t > 0)   return 1;
  return 0;
};

export const AssessmentForm = ({
  student,
  existingAssessments,
  onSubmit,
  onSessionSave,
  isLocked = false,
  onCancel,
}: AssessmentFormProps) => {

  const existingComponent = existingAssessments.find(a => !a.session_id);
  const bonus = getLeadershipBonus(student.position);

  const buildInitial = (): Record<ComponentKey, string> => {
    const saved = existingComponent?.scores ?? {};
    return Object.fromEntries(
      SCORING_COMPONENTS.map(c => [
        c.key,
        saved[c.key] != null ? String(saved[c.key]) : '',
      ])
    ) as Record<ComponentKey, string>;
  };

  const buildSavedSessions = (): Set<ComponentKey> => {
    const arr: string[] = existingComponent?.scores?.saved_sessions ?? [];
    return new Set(arr as ComponentKey[]);
  };

  const [scores, setScores]           = useState<Record<ComponentKey, string>>(buildInitial);
  const [savedSessions, setSaved]     = useState<Set<ComponentKey>>(buildSavedSessions);
  const [expanded, setExpanded]       = useState<Set<ComponentKey>>(new Set());
  const [notes, setNotes]             = useState(existingComponent?.notes || '');
  const [isSubmitting, setIsSubmitting]           = useState(false);
  const [lockingSession, setLockingSession]       = useState<ComponentKey | null>(null);
  const [assessmentsLocked, setAssessmentsLocked] = useState(false);

  useEffect(() => {
    setScores(buildInitial());
    setNotes(existingComponent?.notes || '');
    setSaved(buildSavedSessions());
    setExpanded(new Set());
  }, [student.id]);

  useEffect(() => {
    supabase.from('system_settings').select('setting_value')
      .eq('setting_key', 'assessments_locked').limit(1)
      .then(({ data }) => {
        const v = data?.[0]?.setting_value;
        setAssessmentsLocked(v === true || v === 'true');
      }).catch(() => {});
  }, []);

  const locked = isLocked || assessmentsLocked;

  const floorTotal = useMemo(() =>
    Math.min(
      SCORING_COMPONENTS.reduce((sum, c) => sum + Math.min(parseFloat(scores[c.key] || '0') || 0, c.max), 0),
      90
    ),
  [scores]);

  const grandTotal = Math.min(floorTotal + bonus, 100);
  const nearCap = (100 - grandTotal) < 10 && grandTotal < 100;
  const atCap   = grandTotal >= 100;
  const ringOffset = RING_C * (1 - grandTotal / 100);
  const stars = getStars(grandTotal);
  const grade = getGrade(grandTotal);

  const updateScore = (key: ComponentKey, raw: string, max: number) => {
    if (savedSessions.has(key)) return; // locked
    if (raw === '') { setScores(p => ({ ...p, [key]: '' })); return; }
    const num = parseFloat(raw);
    if (isNaN(num)) return;
    setScores(p => ({ ...p, [key]: String(Math.min(max, Math.max(0, num))) }));
  };

  const toggleExpand = (key: ComponentKey) => {
    if (savedSessions.has(key) && !expanded.has(key)) return; // don't expand locked sessions
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const handleLockSession = async (key: ComponentKey) => {
    const val = parseFloat(scores[key] || '0') || 0;
    if (val <= 0) return;
    setLockingSession(key);
    try {
      if (onSessionSave) await onSessionSave(key, val);
      setSaved(prev => new Set([...prev, key]));
      setExpanded(prev => { const n = new Set(prev); n.delete(key); return n; });
    } finally {
      setLockingSession(null);
    }
  };

  const handleSubmit = async (status: 'draft' | 'submitted') => {
    setIsSubmitting(true);
    try {
      const payload: ComponentScore[] = SCORING_COMPONENTS.map(c => ({
        component: c.key,
        score: parseFloat(scores[c.key] || '0') || 0,
      }));
      await onSubmit(payload, notes, status);
    } catch {}
    finally { setIsSubmitting(false); }
  };

  const allSessionsHaveScore = SCORING_COMPONENTS.every(c => (parseFloat(scores[c.key] || '0') || 0) > 0);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">

      <div className="flex-1 overflow-y-auto p-6 md:p-8 grid grid-cols-1 md:grid-cols-12 gap-8"
           style={{ msOverflowStyle: 'none', scrollbarWidth: 'none' }}>

        {/* LEFT — session scoring panels */}
        <div className="md:col-span-8 space-y-2.5">

          <div className="flex items-center justify-between mb-3">
            <h3 className="font-headline font-bold text-lg text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">analytics</span>
              Session Scoring
            </h3>
            <p className="text-[10px] text-on-surface-variant/50 font-body uppercase tracking-widest">
              90 pts floor · {bonus > 0 ? `+${bonus} role bonus` : 'no role bonus'}
            </p>
          </div>

          {SCORING_COMPONENTS.map(comp => {
            const key     = comp.key as ComponentKey;
            const isLocked_ = savedSessions.has(key);
            const isOpen  = expanded.has(key);
            const val     = scores[key];
            const numVal  = parseFloat(val || '0') || 0;
            const hasData = val !== '';
            const pct     = numVal / comp.max;
            const isLocking = lockingSession === key;

            return (
              <div
                key={comp.key}
                className={`rounded-2xl border transition-all duration-200 ${
                  isLocked_
                    ? 'bg-emerald-50/50 border-emerald-200/60'
                    : hasData
                      ? 'bg-primary/3 border-primary/15'
                      : 'bg-surface-container-low border-transparent'
                }`}
              >
                {/* Header row */}
                <div className="flex items-center gap-3 p-4">

                  {/* Session tag */}
                  <span className="text-[8px] font-black uppercase tracking-widest text-on-surface-variant/40 font-headline shrink-0 hidden sm:block w-14 text-center">
                    {comp.session}
                  </span>

                  {/* Icon / lock indicator */}
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    isLocked_ ? 'bg-emerald-100' : hasData ? 'bg-primary/10' : 'bg-surface-container-lowest'
                  }`}>
                    {isLocked_ ? (
                      <span className="material-symbols-outlined text-[16px] text-emerald-600" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    ) : (
                      <span
                        className={`material-symbols-outlined text-[16px] ${hasData ? 'text-primary' : 'text-on-surface-variant/30'}`}
                        style={hasData ? { fontVariationSettings: "'FILL' 1" } : undefined}
                      >
                        {comp.icon}
                      </span>
                    )}
                  </div>

                  {/* Label + mini bar */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`font-headline font-bold text-sm truncate ${isLocked_ ? 'text-emerald-700' : hasData ? 'text-primary' : 'text-on-surface'}`}>
                        {comp.label}
                      </p>
                      {isLocked_ && (
                        <span className="text-[8px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-full font-headline shrink-0">Locked</span>
                      )}
                    </div>
                    <div className="w-full h-1 bg-surface-container-high rounded-full mt-1 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${isLocked_ ? 'bg-emerald-400' : 'bg-primary/40'}`}
                        style={{ width: `${pct * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Score display / input */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isLocked_ ? (
                      <div className="w-14 h-10 text-center flex items-center justify-center">
                        <span className="text-xl font-black font-headline text-emerald-700">{numVal}</span>
                      </div>
                    ) : (
                      <input
                        type="number"
                        min={0}
                        max={comp.max}
                        step={0.5}
                        placeholder="—"
                        value={val}
                        onChange={e => updateScore(key, e.target.value, comp.max)}
                        onFocus={e => e.target.select()}
                        disabled={locked || isLocked_}
                        className="w-14 h-10 text-center text-lg font-black font-headline rounded-xl border-none bg-surface-container-lowest shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/15 text-primary disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    )}
                    <span className="text-xs text-on-surface-variant/40 font-body">/{comp.max}</span>
                  </div>

                  {/* Lock session button */}
                  {!locked && !isLocked_ && numVal > 0 && (
                    <button
                      type="button"
                      onClick={() => handleLockSession(key)}
                      disabled={isLocking}
                      title="Lock this session score"
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-[9px] font-black uppercase tracking-widest font-headline transition-colors disabled:opacity-50 shrink-0"
                    >
                      {isLocking
                        ? <span className="material-symbols-outlined text-[13px] animate-spin">refresh</span>
                        : <span className="material-symbols-outlined text-[13px]">lock</span>}
                      Lock
                    </button>
                  )}

                  {/* Expand toggle — criteria reference */}
                  {!isLocked_ && (
                    <button
                      type="button"
                      onClick={() => toggleExpand(key)}
                      className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 hover:bg-surface-container transition-colors"
                    >
                      <span className={`material-symbols-outlined text-[16px] text-on-surface-variant/30 transition-transform ${isOpen ? 'rotate-180' : ''}`}>expand_more</span>
                    </button>
                  )}
                </div>

                {/* Expanded criteria reference */}
                {isOpen && !isLocked_ && (
                  <div className="px-5 pb-4 border-t border-surface-variant/20 pt-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant/40 font-headline mb-2 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[11px]">info</span>
                      Scoring reference — consider these criteria
                    </p>
                    <div className="space-y-1">
                      {comp.criteria.map((c, i) => (
                        <div key={i} className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="w-1 h-1 rounded-full bg-primary/30 shrink-0" />
                            <p className="text-xs font-body text-on-surface-variant">{c.label}</p>
                          </div>
                          <span className="text-[10px] font-black text-primary/50 font-headline shrink-0 tabular-nums">
                            {c.max} pts
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Notes */}
          <div className="space-y-2 pt-2">
            <label className="font-bold text-on-surface-variant/60 text-[10px] uppercase tracking-widest font-body flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">sticky_note_2</span>
              Jury Observations & Feedback
            </label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Qualitative notes on performance, decorum and standout moments..."
              rows={3}
              disabled={locked}
              className="bg-surface-container-high border-none rounded-[1.5rem] p-5 text-sm focus-visible:ring-4 focus-visible:ring-primary/10 transition-all placeholder:text-on-surface-variant/30 font-body resize-none"
            />
          </div>
        </div>

        {/* RIGHT — ring + breakdown */}
        <div className="md:col-span-4 space-y-5">

          {/* Score ring */}
          <div className="bg-surface-container-high rounded-[2rem] p-6 text-center border border-outline-variant/30 flex flex-col items-center">
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-4 font-body">Total Score</p>
            <div className="relative w-32 h-32 flex items-center justify-center mb-4">
              <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 128 128">
                <circle cx="64" cy="64" r={RING_R} fill="transparent" stroke="#e6e8ea" strokeWidth="8" />
                <circle
                  cx="64" cy="64" r={RING_R}
                  fill="transparent"
                  stroke={atCap ? '#ef4444' : nearCap ? '#f59e0b' : '#13298f'}
                  strokeWidth="8" strokeLinecap="round"
                  strokeDasharray={RING_C}
                  strokeDashoffset={ringOffset}
                  className="transition-all duration-500 ease-out"
                />
              </svg>
              <div className="text-center z-10">
                <span className={`text-4xl font-extrabold font-headline ${atCap ? 'text-error' : nearCap ? 'text-amber-500' : 'text-primary'}`}>
                  {grandTotal.toFixed(0)}
                </span>
                <p className="text-[10px] font-bold text-on-surface-variant font-body">OUT OF 100</p>
              </div>
            </div>
            <div className="flex gap-0.5 mb-2">
              {[1,2,3,4,5].map(i => (
                <span key={i}
                  className={`material-symbols-outlined text-base ${i <= stars ? 'text-primary' : 'text-outline-variant'}`}
                  style={i <= stars ? { fontVariationSettings: "'FILL' 1" } : undefined}
                >star</span>
              ))}
            </div>
            <p className="text-xs font-medium text-on-surface-variant font-body">
              Grade: <span className="text-on-surface font-bold">{grade}</span>
            </p>
          </div>

          {/* Score breakdown */}
          <div className="bg-surface-container-lowest rounded-[2rem] p-5 border border-outline-variant/10">
            <h4 className="font-headline font-bold text-on-surface text-sm mb-3">Breakdown</h4>
            <div className="space-y-2.5">
              {SCORING_COMPONENTS.map(comp => {
                const v   = parseFloat(scores[comp.key as ComponentKey] || '0') || 0;
                const pct = comp.max > 0 ? v / comp.max : 0;
                const locked_ = savedSessions.has(comp.key as ComponentKey);
                return (
                  <div key={comp.key}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[10px] font-body text-on-surface-variant truncate max-w-[130px] flex items-center gap-1">
                        {locked_ && <span className="material-symbols-outlined text-[10px] text-emerald-500" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>}
                        {comp.label}
                      </span>
                      <span className={`text-[11px] font-black font-headline shrink-0 ml-2 ${v > 0 ? (locked_ ? 'text-emerald-600' : 'text-primary') : 'text-on-surface-variant/25'}`}>
                        {v}/{comp.max}
                      </span>
                    </div>
                    <div className="h-1 bg-surface-container rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-500 ${locked_ ? 'bg-emerald-400' : 'bg-primary/50'}`} style={{ width: `${pct * 100}%` }} />
                    </div>
                  </div>
                );
              })}

              {/* Floor subtotal */}
              <div className="border-t border-outline-variant/20 pt-2 flex justify-between items-center">
                <span className="text-[10px] text-on-surface-variant font-body">Floor Score</span>
                <span className="text-[11px] font-black font-headline text-on-surface">{floorTotal} / 90</span>
              </div>

              {/* Leadership bonus */}
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[12px] text-amber-500" style={{ fontVariationSettings: "'FILL' 1" }}>emoji_events</span>
                  <span className="text-[10px] text-on-surface-variant font-body">Leadership Bonus</span>
                </div>
                <span className={`text-[11px] font-black font-headline ${bonus > 0 ? 'text-amber-600' : 'text-on-surface-variant/30'}`}>
                  +{bonus}
                </span>
              </div>

              {/* Grand total */}
              <div className="border-t border-outline-variant/20 pt-2 flex justify-between items-center">
                <span className="text-[11px] font-black font-headline text-on-surface">Total</span>
                <span className={`text-sm font-black font-headline ${atCap ? 'text-error' : 'text-primary'}`}>
                  {grandTotal.toFixed(0)} / 100
                </span>
              </div>
            </div>
          </div>

          {/* Session progress */}
          <div className="bg-surface-container-lowest rounded-[2rem] p-5 border border-outline-variant/10">
            <h4 className="font-headline font-bold text-on-surface text-sm mb-3 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-primary">playlist_add_check</span>
              Sessions
            </h4>
            <div className="space-y-1.5">
              {SCORING_COMPONENTS.map(comp => {
                const locked_ = savedSessions.has(comp.key as ComponentKey);
                const has = (parseFloat(scores[comp.key as ComponentKey] || '0') || 0) > 0;
                return (
                  <div key={comp.key} className="flex items-center gap-2">
                    <span className={`material-symbols-outlined text-[14px] ${locked_ ? 'text-emerald-500' : has ? 'text-amber-400' : 'text-on-surface-variant/20'}`}
                      style={{ fontVariationSettings: "'FILL' 1" }}>
                      {locked_ ? 'check_circle' : has ? 'pending' : 'radio_button_unchecked'}
                    </span>
                    <span className="text-[10px] font-body text-on-surface-variant truncate">{comp.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      {!locked ? (
        <div className="px-8 py-5 bg-surface-container-low border-t border-outline-variant/10 flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0">
          <button
            onClick={() => handleSubmit('draft')}
            disabled={isSubmitting || floorTotal === 0}
            className="flex items-center gap-2 text-on-surface-variant font-bold text-sm hover:text-on-surface transition-colors disabled:opacity-30 font-body"
          >
            <span className="material-symbols-outlined text-sm">cloud_upload</span>
            Save Draft
          </button>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            {onCancel && (
              <button onClick={onCancel} className="flex-1 sm:flex-none px-6 py-3 rounded-full font-bold text-on-surface hover:bg-surface-container-high transition-all font-body text-sm">
                Cancel
              </button>
            )}
            <button
              onClick={() => handleSubmit('submitted')}
              disabled={isSubmitting || !allSessionsHaveScore}
              className="flex-1 sm:flex-none bg-primary hover:bg-primary/90 text-on-primary px-8 py-3 rounded-full font-bold shadow-[0_4px_16px_rgba(19,41,143,0.25)] transition-all flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 font-body text-sm"
            >
              <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
              {isSubmitting ? 'Submitting…' : 'Validate & Submit'}
            </button>
          </div>
        </div>
      ) : (
        <div className="px-8 py-5 bg-surface-container-low border-t border-outline-variant/10 flex items-center justify-center gap-3 shrink-0">
          <Lock className="w-4 h-4 text-error/60" />
          <span className="text-sm font-bold text-error/70 font-body">
            {assessmentsLocked ? 'Assessments locked by organizer' : 'This assessment is locked'}
          </span>
        </div>
      )}
    </div>
  );
};
