import { Textarea } from "@/components/ui/textarea";
import { Lock, ChevronDown, ChevronUp, Plus, X } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

const RING_R = 58;
const RING_C = 2 * Math.PI * RING_R;

// 7 scoring criteria matching the official rubric
const SCORE_TAGS = [
  { key: 'leadership',        label: 'Leadership & Positions',          max: 10, icon: 'emoji_events' },
  { key: 'mupi',              label: 'MUPI / Opening Speech',           max: 15, icon: 'record_voice_over' },
  { key: 'question_hour',     label: 'Question Hour',                   max: 20, icon: 'forum' },
  { key: 'zero_hour',         label: 'Zero Hour',                       max: 15, icon: 'hourglass_empty' },
  { key: 'political_acumen',  label: 'Political Acumen & Strategy',     max: 10, icon: 'account_balance' },
  { key: 'committee',         label: 'Committee & Bill Drafting',       max: 15, icon: 'edit_document' },
  { key: 'bill_presentation', label: 'Bill Presentation & Defence',     max: 15, icon: 'gavel' },
] as const;

type TagKey = typeof SCORE_TAGS[number]['key'];

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

interface Session {
  id: string;
  title: string;
  description?: string;
  session_date?: string;
}

interface ExistingAssessment {
  student_id: string;
  scores: any;
  total_score: number;
  status: 'draft' | 'submitted' | 'locked';
  notes?: string;
  session_id?: string;
}

export interface SessionScore {
  sessionId: string;
  score: number;
  tags: Record<string, number>;
}

interface AssessmentFormProps {
  student: StudentProfile;
  sessions: Session[];
  existingAssessments: ExistingAssessment[];
  onSubmit: (scores: SessionScore[], notes: string, status: 'draft' | 'submitted') => Promise<void>;
  isLocked?: boolean;
  onCancel?: () => void;
}

const getGrade = (total: number) => {
  if (total >= 90) return 'Outstanding';
  if (total >= 75) return 'Excellent';
  if (total >= 60) return 'Good';
  if (total >= 45) return 'Satisfactory';
  if (total > 0)   return 'Needs Improvement';
  return '—';
};

const getStars = (total: number) => {
  if (total >= 80) return 5;
  if (total >= 60) return 4;
  if (total >= 45) return 3;
  if (total >= 25) return 2;
  if (total > 0)   return 1;
  return 0;
};

export const AssessmentForm = ({
  student,
  sessions,
  existingAssessments,
  onSubmit,
  isLocked = false,
  onCancel,
}: AssessmentFormProps) => {

  // Base session scores (0–10 per session)
  const buildInitialBase = () => {
    const s: Record<string, string> = {};
    sessions.forEach(sess => {
      const ex = existingAssessments.find(a => a.session_id === sess.id);
      const base = ex?.scores?.base ?? ex?.total_score;
      s[sess.id] = base != null ? String(base) : '';
    });
    return s;
  };

  // Per-session tag scores { sessionId: { tagKey: value } }
  const buildInitialTags = () => {
    const t: Record<string, Record<string, number>> = {};
    sessions.forEach(sess => {
      const ex = existingAssessments.find(a => a.session_id === sess.id);
      t[sess.id] = ex?.scores?.tags ?? {};
    });
    return t;
  };

  const [baseScores, setBaseScores]   = useState<Record<string, string>>(buildInitialBase);
  const [sessionTags, setSessionTags] = useState<Record<string, Record<string, number>>>(buildInitialTags);
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());
  const [notes, setNotes]             = useState(existingAssessments.find(a => a.notes)?.notes || '');
  const [isSubmitting, setIsSubmitting]         = useState(false);
  const [assessmentsLocked, setAssessmentsLocked] = useState(false);

  useEffect(() => {
    setBaseScores(buildInitialBase());
    setSessionTags(buildInitialTags());
    setNotes(existingAssessments.find(a => a.notes)?.notes || '');
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

  // ── Totals ──────────────────────────────────────────────────────────────────
  const baseTotal = useMemo(() =>
    Object.values(baseScores).reduce((sum, v) => sum + (parseFloat(v) || 0), 0),
    [baseScores]
  );

  const tagTotal = useMemo(() =>
    Object.values(sessionTags).reduce((sum, tags) =>
      sum + Object.values(tags).reduce((s, v) => s + (v || 0), 0), 0),
    [sessionTags]
  );

  const grandTotal  = Math.min(baseTotal + tagTotal, 100);
  const headroom    = 100 - grandTotal;
  const ringOffset  = RING_C * (1 - grandTotal / 100);
  const stars       = getStars(grandTotal);
  const grade       = getGrade(grandTotal);
  const hasScore    = grandTotal > 0;
  const nearCap     = headroom < 10 && headroom > 0;
  const atCap       = headroom <= 0;

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const updateBase = (sessionId: string, raw: string) => {
    if (raw === '') { setBaseScores(p => ({ ...p, [sessionId]: '' })); return; }
    const num = parseFloat(raw);
    if (isNaN(num)) return;
    setBaseScores(p => ({ ...p, [sessionId]: String(Math.min(10, Math.max(0, num))) }));
  };

  const toggleTag = (sessionId: string, key: string, max: number) => {
    setSessionTags(prev => {
      const current = prev[sessionId] ?? {};
      if (key in current) {
        // Remove tag
        const updated = { ...current };
        delete updated[key];
        return { ...prev, [sessionId]: updated };
      }
      // Add tag — use min of max or remaining headroom
      const available = Math.min(max, headroom + (current[key] || 0));
      if (available <= 0) return prev;
      return { ...prev, [sessionId]: { ...current, [key]: available } };
    });
  };

  const adjustTag = (sessionId: string, key: string, value: number, max: number) => {
    setSessionTags(prev => {
      const current = prev[sessionId] ?? {};
      const otherTagTotal = tagTotal - (current[key] || 0);
      const maxAllowed = Math.min(max, 100 - baseTotal - otherTagTotal);
      const clamped = Math.max(0, Math.min(value, maxAllowed));
      return { ...prev, [sessionId]: { ...current, [key]: clamped } };
    });
  };

  // Raw string state for tag inputs so jury can freely type (e.g. "1" without snapping)
  const [tagInputs, setTagInputs] = useState<Record<string, string>>({});
  const tagInputKey = (sessionId: string, key: string) => `${sessionId}__${key}`;

  const handleTagInputChange = (sessionId: string, key: string, raw: string, max: number) => {
    const inputKey = tagInputKey(sessionId, key);
    setTagInputs(prev => ({ ...prev, [inputKey]: raw }));
    const num = parseFloat(raw);
    if (!isNaN(num)) adjustTag(sessionId, key, num, max);
  };

  const handleTagInputBlur = (sessionId: string, key: string, max: number) => {
    const inputKey = tagInputKey(sessionId, key);
    // Snap display to actual stored value on blur
    const stored = sessionTags[sessionId]?.[key] ?? 0;
    setTagInputs(prev => ({ ...prev, [inputKey]: String(stored) }));
  };

  const getTagDisplayValue = (sessionId: string, key: string) => {
    const inputKey = tagInputKey(sessionId, key);
    return inputKey in tagInputs ? tagInputs[inputKey] : String(sessionTags[sessionId]?.[key] ?? '');
  };

  const toggleExpand = (sessionId: string) => {
    setExpandedSessions(prev => {
      const next = new Set(prev);
      next.has(sessionId) ? next.delete(sessionId) : next.add(sessionId);
      return next;
    });
  };

  const sessionTagTotal = (sessionId: string) =>
    Object.values(sessionTags[sessionId] ?? {}).reduce((s, v) => s + (v || 0), 0);

  const handleSubmit = async (status: 'draft' | 'submitted') => {
    setIsSubmitting(true);
    try {
      const payload: SessionScore[] = sessions
        .filter(s => baseScores[s.id] !== '' && !isNaN(parseFloat(baseScores[s.id])))
        .map(s => ({
          sessionId: s.id,
          score: parseFloat(baseScores[s.id]),
          tags: sessionTags[s.id] ?? {},
        }));
      await onSubmit(payload, notes, status);
    } catch {}
    finally { setIsSubmitting(false); }
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto p-6 md:p-8 grid grid-cols-1 md:grid-cols-12 gap-8 scroll-hide"
           style={{ msOverflowStyle: 'none', scrollbarWidth: 'none' }}>

        {/* LEFT — sessions + tags + notes */}
        <div className="md:col-span-8 space-y-4">

          <div className="flex items-center justify-between">
            <h3 className="font-headline font-bold text-lg text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">analytics</span>
              Session Performance
            </h3>
            <p className="text-[10px] text-on-surface-variant/50 font-body uppercase tracking-widest">
              Base 0–10 · Tags add to 100 total
            </p>
          </div>

          {sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <span className="material-symbols-outlined text-[44px] text-on-surface-variant/20 mb-2">event_busy</span>
              <div className="text-sm font-bold text-on-surface-variant/40 font-body">No sessions available yet</div>
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.map((session, idx) => {
                const ex       = existingAssessments.find(a => a.session_id === session.id);
                const scored   = ex?.status === 'submitted';
                const expanded = expandedSessions.has(session.id);
                const tagSum   = sessionTagTotal(session.id);
                const activeTags = Object.keys(sessionTags[session.id] ?? {});

                return (
                  <div
                    key={session.id}
                    className={`rounded-3xl border transition-all ${
                      scored
                        ? 'bg-[#42d59a]/5 border-[#42d59a]/20'
                        : 'bg-surface-container-low border-transparent'
                    }`}
                  >
                    {/* Session row */}
                    <div className="flex items-center justify-between p-5">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-11 h-11 rounded-2xl bg-surface-container-lowest flex items-center justify-center font-bold text-primary shadow-sm font-headline text-sm shrink-0">
                          {String(idx + 1).padStart(2, '0')}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-on-surface font-headline text-sm truncate">{session.title}</h4>
                          {session.description && (
                            <p className="text-xs text-on-surface-variant font-body mt-0.5 truncate max-w-[200px]">
                              {session.description}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 ml-4">
                        {/* Tag summary pill */}
                        {tagSum > 0 && (
                          <span className="text-[10px] font-black text-primary bg-primary/8 px-2 py-0.5 rounded-full font-headline">
                            +{tagSum} pts
                          </span>
                        )}
                        {/* Base score input */}
                        <input
                          type="number"
                          min={0} max={10} step={0.5}
                          placeholder="—"
                          value={baseScores[session.id] ?? ''}
                          onChange={e => updateBase(session.id, e.target.value)}
                          disabled={locked}
                          className="w-16 h-12 text-center text-xl font-bold font-headline rounded-2xl border-none bg-surface-container-lowest shadow-sm focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all placeholder:opacity-30 text-primary disabled:opacity-50"
                        />
                        <span className="text-on-surface-variant font-bold text-sm font-body">/ 10</span>
                        {/* Expand toggle */}
                        {!locked && (
                          <button
                            type="button"
                            onClick={() => toggleExpand(session.id)}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all font-headline ${
                              expanded
                                ? 'bg-primary/10 text-primary'
                                : activeTags.length > 0
                                  ? 'bg-primary/8 text-primary'
                                  : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                            }`}
                          >
                            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            {activeTags.length > 0 ? `${activeTags.length} tag${activeTags.length > 1 ? 's' : ''}` : 'Tags'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Tag panel — collapsed by default */}
                    {expanded && !locked && (
                      <div className="px-5 pb-5 space-y-3 border-t border-surface-variant/20 pt-4">

                        {/* Cap warning */}
                        {atCap && (
                          <div className="flex items-center gap-2 bg-error/8 rounded-xl px-3 py-2">
                            <span className="material-symbols-outlined text-error text-[14px]">block</span>
                            <p className="text-[11px] font-bold text-error">100 pt cap reached — remove a tag or lower a score to add more.</p>
                          </div>
                        )}
                        {nearCap && !atCap && (
                          <div className="flex items-center gap-2 bg-amber-50 rounded-xl px-3 py-2">
                            <span className="material-symbols-outlined text-amber-600 text-[14px]">warning</span>
                            <p className="text-[11px] font-bold text-amber-700">{headroom} pt{headroom !== 1 ? 's' : ''} remaining before cap.</p>
                          </div>
                        )}

                        <div className="flex flex-wrap gap-2">
                          {SCORE_TAGS.map(tag => {
                            const isActive = tag.key in (sessionTags[session.id] ?? {});
                            const val      = sessionTags[session.id]?.[tag.key] ?? tag.max;
                            const canAdd   = !isActive && headroom > 0;

                            return (
                              <div key={tag.key} className="flex items-center">
                                {isActive ? (
                                  /* Active tag — direct editable input */
                                  <div className="flex items-center gap-2 bg-primary/8 border border-primary/20 rounded-2xl pl-3 pr-2 py-1.5">
                                    <span className="material-symbols-outlined text-primary text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>{tag.icon}</span>
                                    <span className="text-[11px] font-black text-primary font-headline whitespace-nowrap">{tag.label}</span>
                                    <div className="flex items-center gap-1 ml-1 bg-white rounded-xl px-2 py-1 border-2 border-primary/30 shadow-sm">
                                      <input
                                        type="number"
                                        min={0}
                                        max={tag.max}
                                        step={1}
                                        value={getTagDisplayValue(session.id, tag.key)}
                                        onChange={e => handleTagInputChange(session.id, tag.key, e.target.value, tag.max)}
                                        onFocus={e => e.target.select()}
                                        onBlur={() => handleTagInputBlur(session.id, tag.key, tag.max)}
                                        className="w-9 text-center text-sm font-black text-primary font-headline bg-transparent outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                      />
                                      <span className="text-[11px] font-bold text-primary/50 font-body">/{tag.max}</span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => toggleTag(session.id, tag.key, tag.max)}
                                      className="ml-0.5 text-primary/40 hover:text-error transition-colors"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                ) : (
                                  /* Inactive tag — tap to add */
                                  <button
                                    type="button"
                                    onClick={() => canAdd && toggleTag(session.id, tag.key, tag.max)}
                                    disabled={!canAdd}
                                    className={`flex items-center gap-1.5 rounded-2xl px-3 py-1.5 border text-[11px] font-bold font-headline transition-all ${
                                      canAdd
                                        ? 'bg-surface-container border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high hover:border-primary/20 hover:text-primary'
                                        : 'bg-surface-container/50 border-transparent text-on-surface-variant/30 cursor-not-allowed'
                                    }`}
                                  >
                                    <Plus className="w-3 h-3" />
                                    <span className="material-symbols-outlined text-[12px]">{tag.icon}</span>
                                    {tag.label}
                                    <span className="ml-1 text-[10px] opacity-60">+{tag.max}</span>
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Session subtotal */}
                        {tagSum > 0 && (
                          <p className="text-[10px] font-black text-on-surface-variant/50 font-headline uppercase tracking-widest">
                            Session subtotal: {(parseFloat(baseScores[session.id] || '0') + tagSum).toFixed(1)} pts
                            <span className="normal-case font-normal ml-1">(base {baseScores[session.id] || 0} + tags {tagSum})</span>
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2 pt-2">
            <label className="font-bold text-on-surface-variant/60 text-[10px] uppercase tracking-widest font-body flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">sticky_note_2</span>
              Jury Observations & Feedback
            </label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Provide qualitative feedback on leadership qualities and decorum..."
              rows={3}
              disabled={locked}
              className="bg-surface-container-high border-none rounded-[1.5rem] p-5 text-sm focus-visible:ring-4 focus-visible:ring-primary/10 transition-all placeholder:text-on-surface-variant/30 font-body resize-none"
            />
          </div>
        </div>

        {/* RIGHT — live score ring */}
        <div className="md:col-span-4 space-y-5">

          {/* Score ring — out of 100 */}
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
                  className="transition-all duration-700 ease-out"
                />
              </svg>
              <div className="text-center z-10">
                <span className={`text-4xl font-extrabold font-headline ${atCap ? 'text-error' : nearCap ? 'text-amber-500' : 'text-primary'}`}>
                  {grandTotal.toFixed(0)}
                </span>
                <p className="text-[10px] font-bold text-on-surface-variant font-body">OUT OF 100</p>
              </div>
            </div>

            {/* Stars */}
            <div className="flex gap-0.5 mb-2">
              {[1, 2, 3, 4, 5].map(i => (
                <span
                  key={i}
                  className={`material-symbols-outlined text-base transition-colors duration-300 ${i <= stars ? 'text-primary' : 'text-outline-variant'}`}
                  style={i <= stars ? { fontVariationSettings: "'FILL' 1" } : undefined}
                >star</span>
              ))}
            </div>
            <p className="text-xs font-medium text-on-surface-variant font-body">
              Grade: <span className="text-on-surface font-bold">{grade}</span>
            </p>

            {/* Score breakdown */}
            {hasScore && (
              <div className="mt-4 w-full space-y-1.5 border-t border-outline-variant/20 pt-4">
                <div className="flex justify-between text-[10px] font-body">
                  <span className="text-on-surface-variant">Session base</span>
                  <span className="font-bold text-on-surface">{baseTotal.toFixed(1)}</span>
                </div>
                <div className="flex justify-between text-[10px] font-body">
                  <span className="text-on-surface-variant">Tag marks</span>
                  <span className="font-bold text-primary">+{tagTotal}</span>
                </div>
                <div className="flex justify-between text-[11px] font-black font-headline border-t border-outline-variant/20 pt-1.5">
                  <span className={atCap ? 'text-error' : 'text-on-surface'}>Total</span>
                  <span className={atCap ? 'text-error' : 'text-primary'}>{grandTotal.toFixed(0)} / 100</span>
                </div>
                {headroom > 0 && (
                  <p className={`text-[10px] font-body text-center mt-1 ${nearCap ? 'text-amber-600 font-bold' : 'text-on-surface-variant/50'}`}>
                    {headroom} pt{headroom !== 1 ? 's' : ''} remaining
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Tag reference guide */}
          <div className="bg-primary/5 rounded-[2rem] p-5">
            <h4 className="font-headline font-bold text-primary text-sm mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]">info</span>
              Tag Point Values
            </h4>
            <div className="space-y-1.5">
              {SCORE_TAGS.map(tag => (
                <div key={tag.key} className="flex items-center justify-between">
                  <span className="text-[11px] font-body text-on-surface-variant">{tag.label}</span>
                  <span className="text-[11px] font-black text-primary font-headline">{tag.max} pts</span>
                </div>
              ))}
              <div className="border-t border-primary/10 pt-1.5 flex items-center justify-between">
                <span className="text-[11px] font-black text-on-surface font-headline">Total Max</span>
                <span className="text-[11px] font-black text-primary font-headline">100 pts</span>
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
            disabled={isSubmitting || !hasScore}
            className="flex items-center gap-2 text-on-surface-variant font-bold text-sm hover:text-on-surface transition-colors disabled:opacity-30 font-body"
          >
            <span className="material-symbols-outlined text-sm">cloud_upload</span>
            Save Draft as Offline Copy
          </button>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            {onCancel && (
              <button
                onClick={onCancel}
                className="flex-1 sm:flex-none px-6 py-3 rounded-full font-bold text-on-surface hover:bg-surface-container-high transition-all font-body text-sm"
              >
                Cancel
              </button>
            )}
            <button
              onClick={() => handleSubmit('submitted')}
              disabled={isSubmitting || !hasScore}
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
