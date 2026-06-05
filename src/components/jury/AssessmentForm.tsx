import { Textarea } from "@/components/ui/textarea";
import { Lock, ChevronDown, ChevronUp } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

const RING_R = 58;
const RING_C = 2 * Math.PI * RING_R;

// Official YIP 2026 evaluation framework — 7 components, 100 pts total
const SCORING_COMPONENTS = [
  {
    key: 'leadership',
    label: 'Leadership & Positions',
    max: 10,
    icon: 'emoji_events',
    criteria: [
      { key: 'leadership_position', label: 'Leadership positions secured in House / Party / Committee', max: 10 },
    ],
  },
  {
    key: 'mupi',
    label: 'Matters of Urgent Public Importance',
    max: 15,
    icon: 'record_voice_over',
    criteria: [
      { key: 'research_constituency',   label: 'Research & Constituency Understanding', max: 4 },
      { key: 'relevance_agenda',        label: 'Relevance to Central Agenda',            max: 3 },
      { key: 'communication_delivery',  label: 'Communication & Delivery',               max: 3 },
      { key: 'parliamentary_conduct',   label: 'Parliamentary Conduct',                  max: 2 },
      { key: 'originality_preparation', label: 'Originality & Preparation',              max: 2 },
      { key: 'time_management',         label: 'Time Management',                        max: 1 },
    ],
  },
  {
    key: 'question_hour',
    label: 'Question Hour Participation & Relevance',
    max: 20,
    icon: 'forum',
    criteria: [
      { key: 'quality_of_question',        label: 'Quality of Question',        max: 4 },
      { key: 'research_relevance',         label: 'Research & Relevance',       max: 3 },
      { key: 'parliamentary_procedure',    label: 'Parliamentary Procedure',    max: 2 },
      { key: 'supplementary_questions',    label: 'Supplementary Questions',    max: 3 },
      { key: 'quality_of_response',        label: 'Quality of Response',        max: 4 },
      { key: 'subject_knowledge',          label: 'Subject Knowledge',          max: 2 },
      { key: 'handling_supplementaries',   label: 'Handling Supplementaries',   max: 2 },
    ],
  },
  {
    key: 'zero_hour',
    label: 'Zero Hour Participation & Understanding',
    max: 15,
    icon: 'hourglass_empty',
    criteria: [
      { key: 'critical_thinking',    label: 'Critical Thinking',    max: 4 },
      { key: 'problem_solving',      label: 'Problem Solving',      max: 3 },
      { key: 'creativity',           label: 'Creativity',           max: 3 },
      { key: 'policy_orientation',   label: 'Policy Orientation',   max: 2 },
      { key: 'communication_skills', label: 'Communication Skills', max: 2 },
      { key: 'parliamentary_conduct',label: 'Parliamentary Conduct',max: 1 },
    ],
  },
  {
    key: 'political_acumen',
    label: 'Political Acumen & Legislative Strategy',
    max: 10,
    icon: 'account_balance',
    criteria: [
      { key: 'coalition_building',      label: 'Coalition Building & Alliance Management',      max: 3 },
      { key: 'parliamentary_strategy',  label: 'Parliamentary Strategy & Procedural Use',       max: 3 },
      { key: 'influence_negotiation',   label: 'Influence, Negotiation & Vote Mobilisation',    max: 2 },
      { key: 'political_communication', label: 'Political Communication & Floor Presence',      max: 2 },
    ],
  },
  {
    key: 'committee',
    label: 'Committee Discussions & Bill Drafting',
    max: 15,
    icon: 'edit_document',
    criteria: [
      { key: 'initiative',             label: 'Initiative',                  max: 3 },
      { key: 'research_contribution',  label: 'Research Contribution',       max: 3 },
      { key: 'drafting_inputs',        label: 'Drafting Inputs',             max: 3 },
      { key: 'team_collaboration',     label: 'Team Collaboration',          max: 3 },
      { key: 'quality_committee_work', label: 'Quality of Committee Work',   max: 3 },
    ],
  },
  {
    key: 'bill_presentation',
    label: 'Bill Presentation & Defence',
    max: 15,
    icon: 'gavel',
    criteria: [
      { key: 'quality_bill_presentation',  label: 'Quality of Bill Presentation', max: 3 },
      { key: 'understanding_bill',         label: 'Understanding of Bill',         max: 3 },
      { key: 'defence_against_questions',  label: 'Defence Against Questions',     max: 5 },
      { key: 'feasibility_recommendations',label: 'Feasibility of Recommendations',max: 3 },
      { key: 'parliamentary_conduct',      label: 'Parliamentary Conduct',         max: 1 },
    ],
  },
] as const;

type ComponentKey = typeof SCORING_COMPONENTS[number]['key'];
type SubScores    = Record<string, string>; // raw input strings
type AllScores    = Record<ComponentKey, SubScores>;

export interface ComponentScore {
  component: string;
  subScores: Record<string, number>;
  total: number;
}

interface StudentProfile {
  id: string;
  name: string;
  position: string;
  party_number: number;
  serial_number: number;
  constituency?: string;
  state?: string;
  city?: string;
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
}

interface AssessmentFormProps {
  student: StudentProfile;
  existingAssessments: ExistingAssessment[];
  onSubmit: (scores: ComponentScore[], notes: string, status: 'draft' | 'submitted') => Promise<void>;
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

const componentTotal = (scores: SubScores, criteria: readonly { key: string; max: number }[]) =>
  criteria.reduce((sum, c) => sum + Math.min(parseFloat(scores[c.key] || '0') || 0, c.max), 0);

export const AssessmentForm = ({
  student,
  existingAssessments,
  onSubmit,
  isLocked = false,
  onCancel,
}: AssessmentFormProps) => {

  // Find existing component-based assessment (session_id = null)
  const existingComponent = existingAssessments.find(a => !a.session_id);

  const buildInitial = (): AllScores => {
    const result = {} as AllScores;
    SCORING_COMPONENTS.forEach(comp => {
      result[comp.key as ComponentKey] = {};
      const saved = existingComponent?.scores?.[comp.key];
      comp.criteria.forEach(c => {
        (result[comp.key as ComponentKey] as SubScores)[c.key] =
          saved?.[c.key] != null ? String(saved[c.key]) : '';
      });
    });
    return result;
  };

  const [scores, setScores]       = useState<AllScores>(buildInitial);
  const [expanded, setExpanded]   = useState<Set<ComponentKey>>(
    () => new Set([SCORING_COMPONENTS[0].key as ComponentKey])
  );
  const [notes, setNotes]         = useState(existingComponent?.notes || '');
  const [isSubmitting, setIsSubmitting]           = useState(false);
  const [assessmentsLocked, setAssessmentsLocked] = useState(false);

  useEffect(() => {
    setScores(buildInitial());
    setNotes(existingComponent?.notes || '');
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

  // ── Per-component totals ────────────────────────────────────────────────────
  const compTotals = useMemo(() =>
    Object.fromEntries(
      SCORING_COMPONENTS.map(comp => [comp.key, componentTotal(scores[comp.key as ComponentKey] ?? {}, comp.criteria)])
    ), [scores]
  );

  const { grandTotal, ringOffset, stars, grade, nearCap, atCap } = useMemo(() => {
    const gt = Math.min(Object.values(compTotals).reduce((s, v) => s + v, 0), 100);
    const hr = 100 - gt;
    return {
      grandTotal : gt,
      headroom   : hr,
      ringOffset : RING_C * (1 - gt / 100),
      stars      : getStars(gt),
      grade      : getGrade(gt),
      nearCap    : hr < 10 && hr > 0,
      atCap      : hr <= 0,
    };
  }, [compTotals]);

  const updateScore = (compKey: ComponentKey, critKey: string, raw: string, max: number) => {
    if (raw === '') {
      setScores(p => ({ ...p, [compKey]: { ...p[compKey], [critKey]: '' } }));
      return;
    }
    const num = parseFloat(raw);
    if (isNaN(num)) return;
    setScores(p => ({ ...p, [compKey]: { ...p[compKey], [critKey]: String(Math.min(max, Math.max(0, num))) } }));
  };

  const toggleExpand = (key: ComponentKey) =>
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const handleSubmit = async (status: 'draft' | 'submitted') => {
    setIsSubmitting(true);
    try {
      const payload: ComponentScore[] = SCORING_COMPONENTS.map(comp => ({
        component: comp.key,
        subScores: Object.fromEntries(
          comp.criteria.map(c => [c.key, parseFloat(scores[comp.key as ComponentKey]?.[c.key] || '0') || 0])
        ),
        total: compTotals[comp.key] ?? 0,
      }));
      await onSubmit(payload, notes, status);
    } catch {}
    finally { setIsSubmitting(false); }
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto p-6 md:p-8 grid grid-cols-1 md:grid-cols-12 gap-8"
           style={{ msOverflowStyle: 'none', scrollbarWidth: 'none' }}>

        {/* LEFT — 7 component accordions */}
        <div className="md:col-span-8 space-y-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-headline font-bold text-lg text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">analytics</span>
              Evaluation Components
            </h3>
            <p className="text-[10px] text-on-surface-variant/50 font-body uppercase tracking-widest">
              100 pts total
            </p>
          </div>

          {SCORING_COMPONENTS.map(comp => {
            const isOpen  = expanded.has(comp.key as ComponentKey);
            const total   = compTotals[comp.key] ?? 0;
            const pct     = total / comp.max;
            const hasData = comp.criteria.some(c => scores[comp.key as ComponentKey]?.[c.key]);

            return (
              <div
                key={comp.key}
                className={`rounded-2xl border transition-all ${
                  hasData
                    ? 'bg-primary/3 border-primary/15'
                    : 'bg-surface-container-low border-transparent'
                }`}
              >
                {/* Accordion header */}
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => toggleExpand(comp.key as ComponentKey)}
                  className="w-full flex items-center gap-4 p-4 text-left"
                >
                  {/* Icon */}
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    hasData ? 'bg-primary/10' : 'bg-surface-container-lowest'
                  }`}>
                    <span
                      className={`material-symbols-outlined text-[18px] ${hasData ? 'text-primary' : 'text-on-surface-variant/40'}`}
                      style={hasData ? { fontVariationSettings: "'FILL' 1" } : undefined}
                    >
                      {comp.icon}
                    </span>
                  </div>

                  {/* Label + mini progress */}
                  <div className="flex-1 min-w-0">
                    <p className={`font-headline font-bold text-sm truncate ${hasData ? 'text-primary' : 'text-on-surface'}`}>
                      {comp.label}
                    </p>
                    {/* Mini bar */}
                    <div className="w-full h-1 bg-surface-container-high rounded-full mt-1.5 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary/50 transition-all duration-500"
                        style={{ width: `${pct * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Score pill + chevron */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`font-headline font-black text-sm ${total > 0 ? 'text-primary' : 'text-on-surface-variant/30'}`}>
                      {total}<span className="text-[10px] font-medium text-on-surface-variant/40">/{comp.max}</span>
                    </span>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-on-surface-variant/40" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-on-surface-variant/40" />
                    )}
                  </div>
                </button>

                {/* Expanded sub-criteria */}
                {isOpen && (
                  <div className="px-4 pb-4 space-y-2 border-t border-surface-variant/20 pt-3">
                    {comp.criteria.map(c => {
                      const val = scores[comp.key as ComponentKey]?.[c.key] ?? '';
                      return (
                        <div key={c.key} className="flex items-center gap-3">
                          <p className="flex-1 text-xs font-body text-on-surface-variant">{c.label}</p>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <input
                              type="number"
                              min={0}
                              max={c.max}
                              step={0.5}
                              placeholder="—"
                              value={val}
                              onChange={e => updateScore(comp.key as ComponentKey, c.key, e.target.value, c.max)}
                              onFocus={e => e.target.select()}
                              disabled={locked}
                              className="w-12 h-9 text-center text-sm font-black font-headline rounded-xl border-none bg-surface-container-lowest shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/15 text-primary disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <span className="text-[10px] text-on-surface-variant/40 font-body w-6 text-right">/{c.max}</span>
                          </div>
                        </div>
                      );
                    })}

                    {/* Component subtotal */}
                    <div className="flex items-center justify-between pt-2 border-t border-surface-variant/20 mt-1">
                      <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/50 font-headline">
                        Component total
                      </span>
                      <span className={`text-sm font-black font-headline ${
                        total === comp.max ? 'text-primary' : total > 0 ? 'text-on-surface' : 'text-on-surface-variant/30'
                      }`}>
                        {total} / {comp.max}
                      </span>
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

        {/* RIGHT — score ring + breakdown */}
        <div className="md:col-span-4 space-y-5">

          {/* Ring */}
          <div className="bg-surface-container-high rounded-[2rem] p-6 text-center border border-outline-variant/30 flex flex-col items-center">
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-4 font-body">
              Total Score
            </p>
            <div className="relative w-32 h-32 flex items-center justify-center mb-4">
              <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 128 128">
                <circle cx="64" cy="64" r={RING_R} fill="transparent" stroke="#e6e8ea" strokeWidth="8" />
                <circle
                  cx="64" cy="64" r={RING_R}
                  fill="transparent"
                  stroke={atCap ? '#ef4444' : nearCap ? '#f59e0b' : '#13298f'}
                  strokeWidth="8"
                  strokeLinecap="round"
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

          {/* Component breakdown */}
          <div className="bg-surface-container-lowest rounded-[2rem] p-5 border border-outline-variant/10">
            <h4 className="font-headline font-bold text-on-surface text-sm mb-3">Score Breakdown</h4>
            <div className="space-y-2">
              {SCORING_COMPONENTS.map(comp => {
                const t   = compTotals[comp.key] ?? 0;
                const pct = comp.max > 0 ? t / comp.max : 0;
                return (
                  <div key={comp.key}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[10px] font-body text-on-surface-variant truncate max-w-[140px]">{comp.label}</span>
                      <span className={`text-[11px] font-black font-headline shrink-0 ml-2 ${t > 0 ? 'text-primary' : 'text-on-surface-variant/30'}`}>
                        {t}/{comp.max}
                      </span>
                    </div>
                    <div className="h-1 bg-surface-container rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary/50 rounded-full transition-all duration-500"
                        style={{ width: `${pct * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              <div className="border-t border-outline-variant/20 pt-2 flex justify-between items-center">
                <span className="text-[11px] font-black font-headline text-on-surface">Total</span>
                <span className={`text-sm font-black font-headline ${atCap ? 'text-error' : 'text-primary'}`}>
                  {grandTotal.toFixed(0)} / 100
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      {!locked ? (
        <div className="px-8 py-5 bg-surface-container-low border-t border-outline-variant/10 flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0">
          <button
            onClick={() => handleSubmit('draft')}
            disabled={isSubmitting || grandTotal === 0}
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
              disabled={isSubmitting || grandTotal === 0}
              className="flex-1 sm:flex-none bg-primary hover:bg-primary/90 text-on-primary px-8 py-3 rounded-full font-bold shadow-[0_4px_16px_rgba(19,41,143,0.25)] transition-all flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 font-body text-sm"
            >
              <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
              Validate & Submit
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
