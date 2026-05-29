import { Textarea } from "@/components/ui/textarea";
import { Lock } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const RING_R = 58;
const RING_C = 2 * Math.PI * RING_R; // ≈ 364.4

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
}

interface AssessmentFormProps {
  student: StudentProfile;
  sessions: Session[];
  existingAssessments: ExistingAssessment[];
  onSubmit: (scores: SessionScore[], notes: string, status: 'draft' | 'submitted') => Promise<void>;
  isLocked?: boolean;
  onCancel?: () => void;
}

const getGrade = (avg: number) => {
  if (avg >= 9)   return 'Outstanding';
  if (avg >= 7.5) return 'Excellent';
  if (avg >= 6)   return 'Good';
  if (avg >= 4.5) return 'Satisfactory';
  if (avg > 0)    return 'Needs Improvement';
  return '—';
};

const getStars = (avg: number) => {
  if (avg >= 8)   return 5;
  if (avg >= 6)   return 4;
  if (avg >= 4.5) return 3;
  if (avg >= 2.5) return 2;
  if (avg > 0)    return 1;
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

  const buildInitialScores = () => {
    const s: Record<string, string> = {};
    sessions.forEach(sess => {
      const ex = existingAssessments.find(a => a.session_id === sess.id);
      s[sess.id] = ex ? String(ex.total_score) : '';
    });
    return s;
  };

  const [scores, setScores] = useState<Record<string, string>>(buildInitialScores);
  const [notes, setNotes]   = useState(existingAssessments.find(a => a.notes)?.notes || '');
  const [isSubmitting, setIsSubmitting]       = useState(false);
  const [assessmentsLocked, setAssessmentsLocked] = useState(false);

  useEffect(() => {
    setScores(buildInitialScores());
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

  // Live average from entered values
  const enteredValues = Object.values(scores)
    .map(v => parseFloat(v))
    .filter(v => !isNaN(v) && v >= 0);
  const avg = enteredValues.length > 0
    ? enteredValues.reduce((a, b) => a + b, 0) / enteredValues.length
    : 0;

  const ringOffset = RING_C * (1 - Math.min(avg, 10) / 10);
  const stars       = getStars(avg);
  const grade       = getGrade(avg);
  const hasScore    = enteredValues.length > 0;

  const updateScore = (sessionId: string, raw: string) => {
    if (raw === '') { setScores(p => ({ ...p, [sessionId]: '' })); return; }
    const num = parseFloat(raw);
    if (isNaN(num)) return;
    setScores(p => ({ ...p, [sessionId]: String(Math.min(10, Math.max(0, num))) }));
  };

  const handleSubmit = async (status: 'draft' | 'submitted') => {
    setIsSubmitting(true);
    try {
      const payload: SessionScore[] = sessions
        .filter(s => scores[s.id] !== '' && !isNaN(parseFloat(scores[s.id])))
        .map(s => ({ sessionId: s.id, score: parseFloat(scores[s.id]) }));
      await onSubmit(payload, notes, status);
    } catch {}
    finally { setIsSubmitting(false); }
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto p-8 grid grid-cols-1 md:grid-cols-12 gap-8 scroll-hide"
           style={{ msOverflowStyle: 'none', scrollbarWidth: 'none' }}>

        {/* LEFT — session rows + notes */}
        <div className="md:col-span-8 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-headline font-bold text-lg text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">analytics</span>
              Session Performance
            </h3>
            <p className="text-[10px] text-on-surface-variant/50 font-body uppercase tracking-widest">
              Score each session 0 – 10
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
                const ex = existingAssessments.find(a => a.session_id === session.id);
                const scored = ex?.status === 'submitted';
                return (
                  <div
                    key={session.id}
                    className={`flex items-center justify-between p-5 rounded-3xl border transition-all group ${
                      scored
                        ? 'bg-[#42d59a]/5 border-[#42d59a]/20'
                        : 'bg-surface-container-low border-transparent hover:border-primary/20'
                    }`}
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-11 h-11 rounded-2xl bg-surface-container-lowest flex items-center justify-center font-bold text-primary shadow-sm font-headline text-sm shrink-0">
                        {String(idx + 1).padStart(2, '0')}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-on-surface font-headline text-sm truncate">{session.title}</h4>
                        {session.description && (
                          <p className="text-xs text-on-surface-variant font-body mt-0.5 truncate max-w-[260px]">
                            {session.description}
                          </p>
                        )}
                        {session.session_date && (
                          <p className="text-[10px] text-on-surface-variant/40 font-body mt-0.5">
                            {new Date(session.session_date).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-4">
                      <input
                        type="number"
                        min={0}
                        max={10}
                        step={0.5}
                        placeholder="—"
                        value={scores[session.id] ?? ''}
                        onChange={e => updateScore(session.id, e.target.value)}
                        disabled={locked}
                        className="w-16 h-12 text-center text-xl font-bold font-headline rounded-2xl border-none bg-surface-container-lowest shadow-sm focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all placeholder:opacity-30 text-primary disabled:opacity-50"
                      />
                      <span className="text-on-surface-variant font-bold text-sm font-body">/ 10</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
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

        {/* RIGHT — live summary */}
        <div className="md:col-span-4 space-y-5">

          {/* Animated ring */}
          <div className="bg-surface-container-high rounded-[2rem] p-6 text-center border border-outline-variant/30 flex flex-col items-center">
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-4 font-body">
              Live Average Score
            </p>
            <div className="relative w-32 h-32 flex items-center justify-center mb-4">
              <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 128 128">
                <circle
                  cx="64" cy="64" r={RING_R}
                  fill="transparent" stroke="#e6e8ea" strokeWidth="8"
                />
                <circle
                  cx="64" cy="64" r={RING_R}
                  fill="transparent" stroke="#13298f" strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={RING_C}
                  strokeDashoffset={ringOffset}
                  className="transition-all duration-700 ease-out"
                />
              </svg>
              <div className="text-center z-10">
                <span className="text-4xl font-extrabold text-primary font-headline">
                  {avg.toFixed(1)}
                </span>
                <p className="text-[10px] font-bold text-on-surface-variant font-body">OUT OF 10</p>
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
          </div>

          {/* Tips */}
          <div className="bg-primary/5 rounded-[2rem] p-5">
            <h4 className="font-headline font-bold text-primary text-sm mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]">lightbulb</span>
              Assessment Tips
            </h4>
            <ul className="space-y-2.5">
              {[
                'Evaluate neutrality during conflict resolution.',
                'Look for adherence to parliamentary terminology.',
                'Reward inclusive behavior toward opposition delegates.',
              ].map((tip, i) => (
                <li key={i} className="flex gap-2 text-[11px] leading-relaxed font-body">
                  <span
                    className="material-symbols-outlined text-primary text-sm shrink-0"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >check_circle</span>
                  {tip}
                </li>
              ))}
            </ul>
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
              <span
                className="material-symbols-outlined text-sm"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >verified</span>
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
