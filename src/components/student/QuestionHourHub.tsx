import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { useSystemSettings } from '@/hooks/useSystemSettings';
import { Switch } from '@/components/ui/switch';
import { QuestionHourSummary } from '@/components/organizer/QuestionHourSummary';
import { toast } from 'sonner';
import { executeOrQueue } from '@/lib/executeOrQueue';
import { formatDistanceToNow } from 'date-fns';

const MINISTRIES = [
  'Ministry of Road Transport & Highways',
  'Ministry of Finance',
  'Ministry of Defence',
  'Ministry of Social Justice & Empowerment',
  'Ministry of Women & Child Development',
  'Ministry of Tourism & Culture',
  'Ministry of Labour & Employment',
  'Ministry of Information and Broadcasting',
  'Ministry of Youth Affairs & Sports',
  'Ministry of Home Affairs',
];

const FILTER_LABELS: Record<string, string> = {
  'All Portfolios':                              'ALL',
  'Ministry of Road Transport & Highways':       'TRANSPORT',
  'Ministry of Finance':                         'FINANCE',
  'Ministry of Defence':                         'DEFENCE',
  'Ministry of Social Justice & Empowerment':    'SOCIAL JUSTICE',
  'Ministry of Women & Child Development':       'WOMEN & CHILD',
  'Ministry of Tourism & Culture':               'TOURISM',
  'Ministry of Labour & Employment':             'LABOUR',
  'Ministry of Information and Broadcasting':    'INFORMATION',
  'Ministry of Youth Affairs & Sports':          'YOUTH',
  'Ministry of Home Affairs':                    'HOME AFFAIRS',
};

// Extract "Ministry of X" from "Minister of X" — explicitly excludes Shadow Ministers
// because shadow ministers raise questions (opposition), they don't answer them.
const getMinistryFromPosition = (position: string | null | undefined): string | null => {
  if (!position) return null;
  if (position.toLowerCase().includes('shadow')) return null;
  const match = position.match(/[Mm]inister of (.+)/);
  if (!match) return null;
  return `Ministry of ${match[1]}`;
};

interface Question {
  id: string;
  user_id: string;
  ministry: string;
  content: string;
  status: 'pending' | 'addressed' | 'rejected';
  answer?: string;
  created_at: string;
  profiles: any;
  votes_count: number;
  user_has_voted: boolean;
  is_discussing: boolean;
  supporters: { user_id: string; name: string; photo_url?: string }[];
}

const PARTY_NUMBER_LABELS = ['NONE', 'A', 'B', 'C', 'D', 'E'];

const AVATAR_COLORS = [
  'bg-primary-fixed text-on-primary-fixed',
  'bg-secondary-fixed text-on-secondary-fixed',
  'bg-tertiary-fixed text-on-tertiary-fixed',
  'bg-surface-variant text-on-surface-variant',
  'bg-primary-container text-on-primary-container',
];

// Mirrors the alignment styling used on the student profile page
const getAlignmentBadge = (alignment: string | null | undefined) => {
  switch (alignment) {
    case 'ruling_party':
      return { label: 'Ruling Party', cls: 'bg-emerald-500/10 text-emerald-700 border-emerald-200', icon: 'shield' };
    case 'opposition':
      return { label: 'Opposition', cls: 'bg-red-500/10 text-red-700 border-red-200', icon: 'flag' };
    default:
      return { label: 'Non-Aligned', cls: 'bg-gray-500/10 text-gray-600 border-gray-200', icon: 'balance' };
  }
};

const StatusBadge = ({ status }: { status: string }) => {
  const styles: Record<string, string> = {
    pending: 'bg-surface-variant text-on-surface-variant',
    addressed: 'bg-tertiary-fixed text-on-tertiary-fixed',
    rejected: 'bg-error-container text-error',
  };
  const labels: Record<string, string> = {
    pending: 'PENDING',
    addressed: 'ANSWERED',
    rejected: 'REJECTED',
  };
  return (
    <span className={`px-3 py-1 rounded-full text-[9px] font-black tracking-wider font-headline ${styles[status] || styles.pending}`}>
      {labels[status] || 'PENDING'}
    </span>
  );
};

export const QuestionHourHub = () => {
  const { user, profile } = useAuth();
  const { hasRole } = useUserRole(user?.id);
  const myMinistry = getMinistryFromPosition(profile?.position);
  const isMinister = !!myMinistry;
  const isModerator = profile?.user_type === 'organizer' || profile?.user_type === 'super_admin' || hasRole('admin_student');

  // Question submission is restricted to opposition members only.
  // Ruling party members can view all questions and post answers, but not submit new questions.
  const isRulingParty  = (profile as any)?.party_alignment === 'ruling_party';
  const isOpposition   = (profile as any)?.party_alignment === 'opposition' || (profile as any)?.party_alignment === 'non_aligned';
  const canSubmitQuestion = !isRulingParty || isModerator;
  const { settings: systemSettings, loading: settingsLoading, refetch: refetchSettings } = useSystemSettings();
  // When closed, non-moderators see questions in read-only mode (no submit/answer/vote)
  const isReadOnly = !isModerator && !settingsLoading && !systemSettings.question_hour_visible;
  const [togglingVisibility, setTogglingVisibility] = useState(false);

  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [questionContent, setQuestionContent] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  // Ministers default to their assigned view so they immediately see questions for their portfolio
  const [viewFilter, setViewFilter] = useState<'trending' | 'assigned' | 'summary'>(isMinister ? 'assigned' : 'trending');
  const [ministryFilter, setMinistryFilter] = useState<string>('All Portfolios');

  // If profile loads after mount and user is a minister, switch to assigned view
  useEffect(() => {
    if (isMinister && viewFilter === 'trending') setViewFilter('assigned');
  }, [isMinister]);
  const [selectedMinistry, setSelectedMinistry] = useState('');
  const [totalEligible, setTotalEligible] = useState(0);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const toggleExpanded = (id: string) =>
    setExpandedCards(prev => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });

  const fetchQuestions = async (opts: { silent?: boolean } = {}) => {
    if (!opts.silent) setLoading(true);
    try {
      const { data: qs, error } = await supabase
        .from('questions')
        .select(`*, profiles (*)`)
        .eq('event_id', profile?.event_id ?? '')
        .order('created_at', { ascending: false });
      if (error) throw error;

      const { data: votes } = await supabase
        .from('question_votes')
        .select('question_id, user_id');

      const voterIds = [...new Set((votes || []).map(v => v.user_id))];
      let voterProfiles: Record<string, { name: string; photo_url?: string }> = {};
      if (voterIds.length) {
        const { data: vp } = await supabase.from('profiles').select('user_id, name, photo_url').in('user_id', voterIds);
        voterProfiles = Object.fromEntries((vp || []).map((p) => [p.user_id, { name: p.name, photo_url: p.photo_url }]));
      }

      const processed: Question[] = (qs || []).map(q => {
        const qVotes = votes?.filter(v => v.question_id === q.id) || [];
        const profileData = Array.isArray(q.profiles) ? q.profiles[0] : q.profiles;
        return {
          ...q,
          profiles: profileData,
          votes_count: qVotes.length,
          user_has_voted: qVotes.some(v => v.user_id === user?.id),
          supporters: qVotes
            .map(v => voterProfiles[v.user_id] ? { user_id: v.user_id, ...voterProfiles[v.user_id] } : null)
            .filter((p): p is { user_id: string; name: string; photo_url?: string } => !!p),
        };
      });

      setQuestions(processed);
    } catch (err: any) {
      toast.error('Failed to load questions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!profile?.event_id) return; // wait until profile + event_id are ready
    fetchQuestions();
    const channel = supabase.channel('public:questions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'questions' }, () => fetchQuestions({ silent: true }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'question_votes' }, () => fetchQuestions({ silent: true }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, profile?.event_id]);

  // Total eligible delegates — used to show what share of the assembly supports a question
  useEffect(() => {
    const fetchTotalEligible = async () => {
      let q = supabase.from('profiles').select('user_id', { count: 'exact', head: true })
        .eq('user_type', 'student').eq('is_active', true)
        .not('position', 'ilike', '%journalist%')
        .not('position', 'ilike', '%administrator%')
        .not('position', 'ilike', '%admin student%');
      if (profile?.event_id) q = q.eq('event_id', profile.event_id);
      const { count } = await q;
      setTotalEligible(count || 0);
    };
    fetchTotalEligible();
  }, [profile?.event_id]);

  // Check if this student already has a pending/addressed question (not rejected)
  const myActiveQuestion = questions.find(q => q.user_id === user?.id && q.status !== 'rejected');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !questionContent.trim()) return;
    if (!profile?.event_id) {
      toast.error('Session not ready — please wait a moment and try again.');
      return;
    }
    // Enforce one-question-per-student limit
    if (!editingId && myActiveQuestion) {
      toast.error('You have already submitted a question. Only one question per session is allowed.');
      return;
    }
    const ministry = selectedMinistry || MINISTRIES[0];
    setSubmitting(true);
    try {
      let queued = false;
      if (editingId) {
        const res = await executeOrQueue({
          table: 'questions',
          type: 'update',
          payload: { ministry, content: questionContent },
          match: { id: editingId },
          description: 'Question update',
        });
        if (res.error) throw res.error;
        queued = res.queued;
        if (queued) {
          setQuestions(prev => prev.map(q => q.id === editingId ? { ...q, ministry, content: questionContent } : q));
          toast.success("Saved offline — will sync once you're back online");
        } else {
          toast.success('Question updated');
        }
      } else {
        const id = crypto.randomUUID();
        const res = await executeOrQueue({
          table: 'questions',
          type: 'insert',
          payload: { id, user_id: user.id, ministry, content: questionContent, status: 'pending', event_id: profile?.event_id ?? null },
          description: 'Question submission',
        });
        if (res.error) throw res.error;
        queued = res.queued;
        if (queued) {
          setQuestions(prev => [{
            id,
            user_id: user.id,
            ministry,
            content: questionContent,
            status: 'pending',
            created_at: new Date().toISOString(),
            profiles: profile,
            votes_count: 0,
            user_has_voted: false,
            is_discussing: false,
            supporters: [],
          }, ...prev]);
          toast.success("Saved offline — will sync once you're back online");
        } else {
          toast.success('Question submitted to the assembly');
        }
      }
      setQuestionContent('');
      setEditingId(null);
      if (!queued) fetchQuestions({ silent: true });
    } catch {
      toast.error('Failed to process question');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const { error } = await supabase.from('questions').delete().eq('id', deleteId);
      if (error) throw error;
      toast.success('Question retracted');
      fetchQuestions({ silent: true });
    } catch {
      toast.error('Failed to retract question');
    } finally {
      setDeleteId(null);
    }
  };

  const handleVote = async (questionId: string, hasVoted: boolean) => {
    if (!user) return;
    // Optimistic UI update immediately so the button feels responsive
    setQuestions(prev => prev.map(q => q.id === questionId
      ? { ...q, votes_count: q.votes_count + (hasVoted ? -1 : 1), user_has_voted: !hasVoted }
      : q));
    try {
      const { error, queued } = await executeOrQueue(
        hasVoted
          ? { table: 'question_votes', type: 'delete', payload: {}, match: { question_id: questionId, user_id: user.id }, description: 'Remove question support' }
          : { table: 'question_votes', type: 'insert', payload: { question_id: questionId, user_id: user.id }, description: 'Support question' }
      );
      if (error) {
        // Revert optimistic update on failure
        setQuestions(prev => prev.map(q => q.id === questionId
          ? { ...q, votes_count: q.votes_count + (hasVoted ? 1 : -1), user_has_voted: hasVoted }
          : q));
        toast.error('Could not record your vote — please try again.');
        console.error('Vote error:', error);
        return;
      }
      if (!queued) fetchQuestions({ silent: true });
    } catch {
      // Revert on exception too
      setQuestions(prev => prev.map(q => q.id === questionId
        ? { ...q, votes_count: q.votes_count + (hasVoted ? 1 : -1), user_has_voted: hasVoted }
        : q));
      toast.error('Protocol error');
    }
  };

  // Minister selects/clears the question their portfolio is currently discussing —
  // only one question per ministry can be "live" at a time, and the highlight is
  // visible to every student and the minister under that ministry.
  const handleToggleDiscussion = async (q: Question) => {
    if (!user) return;
    try {
      if (q.is_discussing) {
        const { error } = await supabase.from('questions').update({ is_discussing: false }).eq('id', q.id);
        if (error) throw error;
        toast.success('Discussion concluded');
      } else {
        await supabase.from('questions').update({ is_discussing: false }).eq('ministry', q.ministry).eq('is_discussing', true);
        const { error } = await supabase.from('questions').update({ is_discussing: true }).eq('id', q.id);
        if (error) throw error;
        toast.success('Question is now under discussion');
      }
      fetchQuestions({ silent: true });
    } catch {
      toast.error('Failed to update discussion status');
    }
  };

  // Admin/Organizer moderation: mark a question "Completed" once the minister
  // has spoken on it — closes the live discussion banner for everyone.
  const handleMarkCompleted = async (q: Question) => {
    try {
      const nextStatus = q.status === 'addressed' ? 'pending' : 'addressed';
      const { error } = await supabase
        .from('questions')
        .update({ status: nextStatus, is_discussing: false })
        .eq('id', q.id);
      if (error) throw error;
      toast.success(nextStatus === 'addressed' ? 'Question marked as completed' : 'Question reopened');
      fetchQuestions({ silent: true });
    } catch {
      toast.error('Failed to update question status');
    }
  };

  // Organizer/admin toggle to show or hide Question Hour from students entirely
  const handleToggleVisibility = async (visible: boolean) => {
    if (!user) return;
    setTogglingVisibility(true);
    try {
      const { error } = await supabase
        .from('system_settings')
        .upsert({
          setting_key: 'question_hour_visible',
          setting_value: visible,
          description: 'Controls whether students can view and participate in Question Hour',
          updated_by: user.id,
        }, { onConflict: 'setting_key' });
      if (error) throw error;

      await supabase.rpc('log_audit_event', {
        p_user_id: user.id,
        p_action: 'setting_updated',
        p_resource_type: 'system_setting',
        p_resource_id: 'question_hour_visible',
        p_details: { old_value: !visible, new_value: visible },
      });

      toast.success(visible ? 'Question Hour is now visible to students' : 'Question Hour is now hidden from students');
      refetchSettings();
    } catch {
      toast.error('Failed to update Question Hour visibility');
    } finally {
      setTogglingVisibility(false);
    }
  };

  const allQuestions = viewFilter === 'assigned'
    ? questions
        .filter(q => myMinistry ? q.ministry === myMinistry : false)
        .sort((a, b) => b.votes_count - a.votes_count)
    : questions
        .filter(q => ministryFilter === 'All Portfolios' || q.ministry === ministryFilter)
        .sort((a, b) => b.votes_count - a.votes_count);

  const pendingCount = allQuestions.filter(q => q.status === 'pending').length;

  return (
    <div>
      {/* Page Heading */}
      <header className="mb-10 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-4xl font-extrabold font-headline tracking-tight text-primary">
            Legislative <span className="text-secondary">Question Hour</span>
          </h1>
          <p className="text-[10px] text-on-surface-variant/40 font-black uppercase tracking-[0.4em] mt-3 flex items-center gap-2 font-headline">
            <span className="material-symbols-outlined text-[12px]">gavel</span>
            Parliamentary Deliberation Protocol
          </p>
        </div>

        {isModerator && (
          <div className="flex items-center gap-3 bg-surface-container-low border border-outline-variant/10 rounded-2xl px-4 py-3">
            <span
              className="material-symbols-outlined text-[18px] text-primary"
              style={{ fontVariationSettings: systemSettings.question_hour_visible ? "'FILL' 1" : "'FILL' 0" }}
            >
              {systemSettings.question_hour_visible ? 'visibility' : 'visibility_off'}
            </span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-on-surface font-headline">Visible to Students</p>
              <p className="text-[10px] text-on-surface-variant/50 font-body">
                {systemSettings.question_hour_visible ? 'Question Hour is open' : 'Hidden from students'}
              </p>
            </div>
            <Switch
              checked={systemSettings.question_hour_visible}
              disabled={togglingVisibility}
              onCheckedChange={handleToggleVisibility}
            />
          </div>
        )}
      </header>

    {isReadOnly && (
      <div className="mb-4 flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-amber-50 border border-amber-200">
        <span className="material-symbols-outlined text-amber-600 text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>lock</span>
        <div>
          <p className="text-[11px] font-black text-amber-800 uppercase tracking-widest font-headline">Question Hour Closed — Archive View</p>
          <p className="text-xs text-amber-700 font-body mt-0.5">The Speaker has paused Question Hour. You can browse questions but cannot submit or respond.</p>
        </div>
      </div>
    )}
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 items-start">

      {/* ── Left Sidebar ── */}
      <aside className="lg:col-span-3 bg-surface-container-low p-6 lg:p-8 space-y-8 lg:sticky lg:top-0 min-h-screen border-r border-outline-variant/10">

        <div>
          <h2 className="text-[13px] font-black uppercase italic tracking-tight text-primary mb-2 font-headline leading-tight">
            {canSubmitQuestion ? 'Formal Question Submission' : 'Government Bench'}
          </h2>
          <p className="text-[12px] text-on-surface-variant/60 leading-relaxed font-medium font-body">
            {canSubmitQuestion
              ? 'Submit a precise legislative query to the executive ministries for floor deliberation.'
              : 'As a ruling party member, you respond to questions raised by the opposition. Monitor and answer questions directed at your portfolio below.'}
          </p>
        </div>

        {/* Block form if student already has an active question */}
        {myActiveQuestion && !editingId ? (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2">
            <div className="flex items-start gap-2">
              <span className="material-symbols-outlined text-amber-600 text-[18px] shrink-0 mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>info</span>
              <div>
                <p className="text-xs font-black text-amber-800 font-headline uppercase tracking-wider">One Question Per Session</p>
                <p className="text-xs text-amber-700 font-body mt-1 leading-relaxed">You have already submitted a question. Retract it to ask a new one.</p>
              </div>
            </div>
            <p className="text-[10px] font-bold text-amber-600 font-body truncate border-t border-amber-200 pt-2">
              "{myActiveQuestion.content}"
            </p>
          </div>
        ) : null}

        {!canSubmitQuestion ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-600 text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>shield</span>
              <p className="text-[11px] font-black text-emerald-800 uppercase tracking-wider">Ruling Party</p>
            </div>
            <p className="text-[11px] text-emerald-700 leading-relaxed font-body">
              You are on the government bench. The opposition raises questions — your role is to <strong>answer and defend</strong> your ministry's policies on the floor.
            </p>
            {myMinistry && (
              <p className="text-[10px] font-bold text-emerald-600 mt-1">
                Your portfolio: {myMinistry}
              </p>
            )}
          </div>
        ) : null}

        {canSubmitQuestion && !isReadOnly && <form data-question-form onSubmit={handleSubmit} className={`space-y-5 ${myActiveQuestion && !editingId ? 'opacity-40 pointer-events-none select-none' : ''}`}>
          <div>
            <label className="text-[10px] font-black text-on-surface-variant/50 uppercase tracking-widest block mb-2 font-headline">
              Target Portfolio
            </label>
            <div className="relative">
              <select
                value={selectedMinistry}
                onChange={(e) => setSelectedMinistry(e.target.value)}
                className="w-full bg-surface-container-high border-none rounded-2xl py-3.5 px-4 text-on-surface text-sm font-medium appearance-none cursor-pointer outline-none focus:ring-2 focus:ring-primary/10 font-body"
              >
                <option value="">Select a Ministry</option>
                {MINISTRIES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant text-[18px]">expand_more</span>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black text-on-surface-variant/50 uppercase tracking-widest block mb-2 font-headline">
              Legislative Query
            </label>
            <textarea
              value={questionContent}
              onChange={(e) => setQuestionContent(e.target.value)}
              placeholder="State your question with parliamentary precision..."
              rows={5}
              className="w-full bg-surface-container-high border-none rounded-2xl py-3.5 px-4 text-on-surface text-sm font-medium placeholder:text-on-surface-variant/40 outline-none focus:ring-2 focus:ring-primary/10 resize-none font-body leading-relaxed"
            />
          </div>

          <button
            type="submit"
            disabled={submitting || !questionContent.trim()}
            className="w-full bg-primary text-white py-4 rounded-full font-headline font-black text-[11px] uppercase tracking-[0.15em] flex items-center justify-center gap-3 hover:bg-primary-container transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting
              ? <span className="material-symbols-outlined text-[16px] animate-spin">refresh</span>
              : <>{editingId ? 'Update Question' : 'Seal & Submit'} <span className="material-symbols-outlined text-[14px] opacity-70">send</span></>}
          </button>

          {editingId && (
            <button
              type="button"
              onClick={() => { setEditingId(null); setQuestionContent(''); }}
              className="w-full text-on-surface-variant/40 font-black text-[10px] uppercase tracking-widest hover:text-error py-1 transition-colors font-headline"
            >
              Discard Changes
            </button>
          )}
        </form>}

        <div className="flex gap-3 p-5 bg-surface-container rounded-2xl">
          <span className="material-symbols-outlined text-[16px] text-primary shrink-0 mt-0.5">gavel</span>
          <div>
            <p className="text-[10px] font-black text-primary uppercase tracking-[0.15em] mb-1 font-headline">Protocol Notice</p>
            <p className="text-[12px] text-on-surface-variant/70 leading-relaxed font-body">
              Questions should be constructive and focus on policy deliberation. Inflammatory or non-parliamentary language will be retracted by the Speaker.
            </p>
          </div>
        </div>

        {/* How it works */}
        <div className="p-5 bg-surface-container-lowest rounded-2xl border border-outline-variant/15 space-y-3">
          <p className="text-[10px] font-black text-primary uppercase tracking-[0.15em] font-headline flex items-center gap-2">
            <span className="material-symbols-outlined text-[14px]">help</span>
            How Question Hour Works
          </p>
          <ul className="space-y-2.5">
            {[
              'Submit one active question to a ministry of your choice — you can edit or retract it any time before it is answered.',
              'Tap "Support" on questions raised by other delegates. The bar under each question shows what share of the assembly backs it, and the floor is sorted by support.',
              'The assigned Minister can mark one question per ministry "Discuss Now". That question is highlighted with a "Now Under Discussion" tag for everyone — in Trending and in My Questions — until the Minister concludes it.',
              'Each question shows the author\'s party affiliation (Ruling Party, Opposition or Non-Aligned) alongside their name.',
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-black font-headline flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                <p className="text-[12px] text-on-surface-variant/70 leading-relaxed font-body">{step}</p>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* ── Right Feed ── */}
      <section className="lg:col-span-9 p-6 lg:p-8 space-y-7">

        {/* Header row */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-[18px] font-bold text-on-surface font-headline tracking-tight">Ministerial Portfolios</h2>
          <div className="flex bg-surface-container-high p-1 rounded-full">
            <button
              onClick={() => setViewFilter('trending')}
              className={`px-5 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest transition-all font-headline flex items-center gap-1.5 ${
                viewFilter === 'trending' ? 'bg-primary text-white shadow-sm' : 'text-on-surface-variant/50'
              }`}
            >
              <span className="material-symbols-outlined text-[13px]">trending_up</span>
              Trending
            </button>
            <button
              onClick={() => setViewFilter('assigned')}
              className={`px-5 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest transition-all font-headline flex items-center gap-1.5 ${
                viewFilter === 'assigned' ? 'bg-primary text-white shadow-sm' : 'text-on-surface-variant/50'
              }`}
            >
              <span className="material-symbols-outlined text-[13px]">inbox</span>
              My Questions
              {isMinister && viewFilter !== 'assigned' && questions.filter(q => q.ministry === myMinistry && q.status === 'pending').length > 0 && (
                <span className="w-4 h-4 rounded-full bg-error text-white text-[9px] font-black flex items-center justify-center">
                  {questions.filter(q => q.ministry === myMinistry && q.status === 'pending').length}
                </span>
              )}
            </button>
            {isModerator && (
              <button
                onClick={() => setViewFilter('summary')}
                className={`px-5 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest transition-all font-headline flex items-center gap-1.5 ${
                  viewFilter === 'summary' ? 'bg-primary text-white shadow-sm' : 'text-on-surface-variant/50'
                }`}
              >
                <span className="material-symbols-outlined text-[13px]">summarize</span>
                Summary
              </button>
            )}
          </div>
        </div>

        {/* Minister context banner — shown on assigned tab */}
        {viewFilter === 'assigned' && (
          <div className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl ${isMinister ? 'bg-primary/5 border border-primary/15' : 'bg-surface-container border border-outline-variant/10'}`}>
            <span className="material-symbols-outlined text-[20px] text-primary shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>
              {isMinister ? 'account_balance' : 'info'}
            </span>
            {isMinister ? (
              <div>
                <p className="text-xs font-black text-primary font-headline uppercase tracking-widest">
                  {myMinistry}
                </p>
                <p className="text-[10px] text-on-surface-variant font-body mt-0.5">
                  Showing all questions directed to your portfolio · {profile?.position}
                </p>
              </div>
            ) : (
              <p className="text-xs text-on-surface-variant font-body">
                This view is for ministers. Questions addressed to a ministry appear here for the assigned minister.
              </p>
            )}
          </div>
        )}

        {/* Portfolio filter chips — only on trending tab */}
        {viewFilter === 'trending' && (
          <div className="flex flex-wrap gap-2.5 pb-1">
            {Object.entries(FILTER_LABELS).map(([full, label]) => {
              const portfolioCount = full === 'All Portfolios'
                ? questions.length
                : questions.filter(q => q.ministry === full).length;
              return (
                <button
                  key={full}
                  onClick={() => setMinistryFilter(full)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-full font-black text-[10px] uppercase tracking-widest whitespace-nowrap transition-all font-headline ${
                    ministryFilter === full
                      ? 'bg-primary text-white shadow-sm shadow-primary/20'
                      : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
                  }`}
                >
                  {label}
                  {portfolioCount > 0 && (
                    <span className={`text-[9px] font-black rounded-full px-1.5 py-0.5 min-w-[18px] text-center ${
                      ministryFilter === full ? 'bg-white/20 text-white' : 'bg-primary/15 text-primary'
                    }`}>
                      {portfolioCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Section header */}
        {viewFilter !== 'summary' && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-on-tertiary-container animate-pulse" />
            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-primary font-headline">Deliberation Floor</span>
          </div>
          <span className="text-[10px] font-black text-on-surface-variant/40 uppercase tracking-widest font-headline">
            {pendingCount} Question{pendingCount !== 1 ? 's' : ''} Pending Response
          </span>
        </div>
        )}

        {/* Summary view — moderators only */}
        {viewFilter === 'summary' ? (
          <QuestionHourSummary />
        ) : loading ? (
          <div className="py-20 flex justify-center">
            <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        ) : allQuestions.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center bg-surface-container-lowest rounded-3xl border border-outline-variant/15 border-dashed text-center px-8">
            <span className="material-symbols-outlined text-[32px] text-on-surface-variant/20 mb-3">
              {viewFilter === 'assigned' ? 'inbox' : 'chat'}
            </span>
            <h4 className="text-sm font-headline font-black text-on-surface-variant/40 uppercase tracking-tight mb-1">
              {viewFilter === 'assigned' ? 'No Questions in Your Inbox' : 'No Active Questions'}
            </h4>
            <p className="text-xs text-on-surface-variant/30 max-w-xs leading-relaxed font-body">
              {viewFilter === 'assigned'
                ? isMinister
                  ? `No questions have been directed to ${myMinistry} yet.`
                  : 'You are not assigned a ministerial portfolio.'
                : `Be the first to initiate a question into the ${ministryFilter === 'All Portfolios' ? 'assembly' : ministryFilter.replace('Ministry of ', '')} portfolio.`
              }
            </p>
          </div>
        ) : (
          <AnimatePresence>
            <div className="space-y-3">
              {allQuestions.map((q) => {
                const initials = q.profiles?.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || 'D';
                const shortMinistry = q.ministry.replace('Ministry of ', '');
                const supportPct = totalEligible > 0 ? Math.min(100, (q.votes_count / totalEligible) * 100) : 0;
                const alignmentBadge = getAlignmentBadge(q.profiles?.party_alignment);
                const partyLabel = q.profiles?.party_name
                  || (q.profiles?.party_number ? `Party ${PARTY_NUMBER_LABELS[q.profiles.party_number] ?? q.profiles.party_number}` : null);
                const canToggleDiscussion = (!isReadOnly && isMinister && q.ministry === myMinistry) || isModerator;
                const isExpanded = expandedCards.has(q.id);

                return (
                  <motion.div
                    key={q.id}
                    layout
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ duration: 0.22 }}
                    className={`bg-surface-container-lowest border rounded-2xl shadow-sm overflow-hidden transition-all ${
                      q.is_discussing ? 'border-error/40 shadow-[0_4px_24px_0_rgba(186,26,26,0.08)]' : 'border-outline-variant/10'
                    }`}
                  >
                    {/* Main row */}
                    <div className="p-4 flex items-center gap-4">
                      {/* Left: avatar + ministry / author / question */}
                      <div className="flex items-center gap-3 flex-1 min-w-0 border-r border-outline-variant/20 pr-4">
                        <div className="w-9 h-9 rounded-lg overflow-hidden bg-primary/10 shrink-0 flex items-center justify-center">
                          {q.profiles?.photo_url
                            ? <img src={q.profiles.photo_url} alt={q.profiles.name} className="w-full h-full object-cover" />
                            : <span className="text-xs font-black text-primary font-headline">{initials}</span>}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-[9px] font-black uppercase tracking-widest text-primary/70 font-headline shrink-0">{shortMinistry}</span>
                            <span className="text-[10px] text-on-surface-variant/40 font-body shrink-0">· {q.profiles?.name || 'National Delegate'}</span>
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider border shrink-0 ${alignmentBadge.cls}`}>
                              <span className="material-symbols-outlined text-[9px]">{alignmentBadge.icon}</span>
                              {partyLabel || alignmentBadge.label}
                            </span>
                          </div>
                          <p className="text-sm font-bold text-on-surface font-body truncate" title={q.content}>{q.content}</p>
                        </div>
                      </div>

                      {/* Right: badges + action icons */}
                      <div className="flex items-center gap-1 shrink-0">
                        {q.is_discussing && (
                          <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-error/10 text-error border border-error/20 mr-1">
                            <span className="w-1.5 h-1.5 bg-error rounded-full animate-pulse-live" />
                            Live
                          </span>
                        )}
                        <StatusBadge status={q.status} />

                        <button
                          onClick={() => !isReadOnly && handleVote(q.id, q.user_has_voted)}
                          disabled={isReadOnly}
                          title={q.user_has_voted ? 'Remove support' : 'Support this question'}
                          className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                            q.user_has_voted ? 'bg-primary text-white' : 'text-on-surface-variant/50 hover:bg-surface-container hover:text-primary'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: q.user_has_voted ? "'FILL' 1" : "'FILL' 0" }}>thumb_up</span>
                        </button>

                        {q.user_id === user?.id && !isReadOnly && (
                          <>
                            <button
                              onClick={() => {
                                setEditingId(q.id);
                                setSelectedMinistry(q.ministry);
                                setQuestionContent(q.content);
                                setTimeout(() => {
                                  document.querySelector('[data-question-form]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                }, 50);
                              }}
                              title="Edit question"
                              className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant/50 hover:bg-surface-container hover:text-primary transition-colors"
                            >
                              <span className="material-symbols-outlined text-[16px]">edit</span>
                            </button>
                            <button
                              onClick={() => setDeleteId(q.id)}
                              title="Retract question"
                              className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant/50 hover:bg-error/10 hover:text-error transition-colors"
                            >
                              <span className="material-symbols-outlined text-[16px]">delete</span>
                            </button>
                          </>
                        )}

                        {isModerator && q.user_id !== user?.id && (
                          <button
                            onClick={() => setDeleteId(q.id)}
                            title="Delete question"
                            className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant/50 hover:bg-error/10 hover:text-error transition-colors"
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                        )}

                        {canToggleDiscussion && (
                          <button
                            onClick={() => handleToggleDiscussion(q)}
                            title={q.is_discussing ? 'Conclude discussion' : 'Mark for discussion'}
                            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                              q.is_discussing ? 'bg-error text-white' : 'text-on-surface-variant/50 hover:bg-error/10 hover:text-error'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: q.is_discussing ? "'FILL' 1" : "'FILL' 0" }}>campaign</span>
                          </button>
                        )}

                        {isModerator && (
                          <button
                            onClick={() => handleMarkCompleted(q)}
                            title={q.status === 'addressed' ? 'Reopen question' : 'Mark as completed'}
                            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                              q.status === 'addressed' ? 'bg-tertiary text-on-tertiary' : 'text-on-surface-variant/50 hover:bg-tertiary/10 hover:text-tertiary'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: q.status === 'addressed' ? "'FILL' 1" : "'FILL' 0" }}>task_alt</span>
                          </button>
                        )}

                        <button
                          onClick={() => toggleExpanded(q.id)}
                          title={isExpanded ? 'Collapse' : 'Expand'}
                          className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-surface-container transition-colors"
                        >
                          <span
                            className="material-symbols-outlined text-primary transition-transform duration-200"
                            style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
                          >
                            chevron_right
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* Expanded row */}
                    {isExpanded && (
                      <div className="border-t border-outline-variant/10 px-4 py-3 bg-surface-container-low/40 space-y-3">
                        <p className="text-sm text-on-surface font-body leading-relaxed">{q.content}</p>

                        {/* Answer panel — read/edit for minister + organizer/admin */}
                        {(q.status === 'addressed' || (canToggleDiscussion || isModerator)) && (
                          <QuestionAnswerPanel
                            question={q}
                            canEdit={canToggleDiscussion || isModerator}
                            onSaved={() => fetchQuestions({ silent: true })}
                          />
                        )}

                        <div className="flex items-center gap-3 flex-wrap">
                          {/* Support meter */}
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-black uppercase tracking-wide font-headline text-primary">Support</span>
                            <div className="w-24 h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${supportPct}%` }}
                                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                                className="h-full rounded-full bg-primary"
                              />
                            </div>
                            <span className="text-[9px] font-black font-headline text-primary">{supportPct.toFixed(0)}%</span>
                            <span className="text-[8px] text-on-surface-variant/40 font-body">({q.votes_count})</span>
                          </div>

                          <div className="w-px h-3 bg-outline-variant/30" />
                          <span className="text-[9px] font-bold text-on-surface-variant/50 font-headline whitespace-nowrap">
                            {q.votes_count}/{totalEligible} Delegates
                          </span>

                          {q.supporters.length > 0 && (
                            <>
                              <div className="w-px h-3 bg-outline-variant/30" />
                              <div className="flex items-center gap-1.5 overflow-hidden">
                                <div className="flex -space-x-1">
                                  {q.supporters.slice(0, 5).map((s, idx) => {
                                    const sInitials = s.name?.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() || '?';
                                    return s.photo_url ? (
                                      <img key={s.user_id} src={s.photo_url} alt={s.name} title={s.name}
                                        className="w-5 h-5 rounded-full border border-surface-container-lowest object-cover" />
                                    ) : (
                                      <div key={s.user_id} title={s.name}
                                        className={`w-5 h-5 rounded-full border border-surface-container-lowest flex items-center justify-center text-[7px] font-bold shrink-0 ${AVATAR_COLORS[idx % AVATAR_COLORS.length]}`}>
                                        {sInitials}
                                      </div>
                                    );
                                  })}
                                </div>
                                {q.supporters.slice(0, 3).map(s => (
                                  <span key={s.user_id} className="text-[9px] text-on-surface-variant/50 font-body whitespace-nowrap hidden sm:inline">
                                    {s.name?.split(' ')[0]}
                                  </span>
                                ))}
                                {q.votes_count > Math.min(q.supporters.length, 3) && (
                                  <span className="text-[8px] font-bold text-on-surface-variant/30 font-headline shrink-0">+{q.votes_count - Math.min(q.supporters.length, 3)}</span>
                                )}
                              </div>
                            </>
                          )}

                          <span className="ml-auto text-[9px] font-black text-on-surface-variant/30 uppercase tracking-widest font-headline">
                            {formatDistanceToNow(new Date(q.created_at), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </AnimatePresence>
        )}
      </section>
    </div>

      {/* ── Delete Dialog ── */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="bg-surface-container-lowest border-none rounded-3xl p-8 max-w-sm shadow-2xl">
          <AlertDialogHeader className="space-y-3">
            <div className="w-12 h-12 bg-error/10 rounded-2xl flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px] text-error">delete</span>
            </div>
            <AlertDialogTitle className="font-headline font-bold text-xl text-on-surface">Retract Question?</AlertDialogTitle>
            <AlertDialogDescription className="font-body text-sm text-on-surface-variant">
              This question will be permanently removed from the parliamentary archives.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-6 flex gap-3">
            <AlertDialogCancel className="flex-1 rounded-xl h-11 border border-outline-variant bg-surface-container-lowest text-on-surface-variant font-body font-semibold text-sm hover:bg-surface-container transition-all">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="flex-1 rounded-xl h-11 bg-red-500 hover:bg-red-600 text-white font-body font-semibold text-sm shadow-sm transition-all"
            >
              Retract
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// ── Question Answer Panel ─────────────────────────────────────────────────────
// Unified panel for viewing, submitting, and editing the official response.
// Visible to: minister (for their ministry's questions) + organizer + admin.
// Works for both pending (submit) and addressed (edit) questions.
const QuestionAnswerPanel = ({
  question, canEdit, onSaved,
}: { question: Question; canEdit: boolean; onSaved: () => void }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const hasAnswer = !!question.answer;
  const isPending = question.status === 'pending';

  // Open edit/compose form
  const openForm = () => {
    setDraft(question.answer ?? '');
    setEditing(true);
  };

  const handleSave = async () => {
    if (!draft.trim()) return;
    setSaving(true);
    const { error } = await supabase
      .from('questions')
      .update({ answer: draft.trim(), status: 'addressed', is_discussing: false })
      .eq('id', question.id);
    setSaving(false);
    if (error) { toast.error('Failed to save response'); return; }
    toast.success(hasAnswer ? 'Response updated' : 'Response recorded — question marked as Addressed');
    setEditing(false);
    onSaved();
  };

  // Read-only: addressed question with answer, but user can edit or delete
  if (hasAnswer && !editing) {
    const handleDeleteAnswer = async () => {
      setSaving(true);
      const { error } = await supabase
        .from('questions')
        .update({ answer: null, status: 'pending' })
        .eq('id', question.id);
      setSaving(false);
      if (error) { toast.error('Failed to remove response'); return; }
      toast.success('Response removed — question is pending again');
      onSaved();
    };

    return (
      <div className="bg-surface-container-lowest rounded-2xl p-3 border-l-4 border-tertiary">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[14px] text-tertiary" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            <span className="text-[9px] font-black uppercase tracking-[0.15em] text-tertiary font-headline">Official Response</span>
          </div>
          {canEdit && (
            <div className="flex items-center gap-1">
              <button
                onClick={openForm}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider text-on-surface-variant/60 hover:bg-surface-container hover:text-primary transition-all"
              >
                <span className="material-symbols-outlined text-[12px]">edit</span>
                Edit
              </button>
              <button
                onClick={handleDeleteAnswer}
                disabled={saving}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider text-on-surface-variant/60 hover:bg-error/10 hover:text-error transition-all disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-[12px]">delete</span>
                Remove
              </button>
            </div>
          )}
        </div>
        <p className="text-xs text-on-surface-variant italic leading-relaxed font-body">"{question.answer}"</p>
      </div>
    );
  }

  // No answer yet — only show compose form to authorised users
  if (!canEdit && !hasAnswer) return null;

  // Compose / edit form
  if (canEdit && (isPending || editing)) {
    return (
      <div className="mt-2 space-y-2 border-t border-outline-variant/10 pt-3">
        <div className="flex items-center justify-between">
          <p className="text-[9px] font-black uppercase tracking-widest text-primary/70 font-headline flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }}>account_balance</span>
            {hasAnswer ? 'Edit Response' : `Official Response — ${question.ministry.replace('Ministry of ', '')}`}
          </p>
          {editing && (
            <button onClick={() => setEditing(false)} className="text-[9px] font-bold text-on-surface-variant/40 hover:text-on-surface-variant transition-colors uppercase tracking-wider">
              Cancel
            </button>
          )}
        </div>
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder="Type the official response to this question…"
          rows={3}
          autoFocus={editing}
          className="w-full bg-surface-container-high border border-outline-variant/20 rounded-2xl px-4 py-3 text-sm font-medium font-body resize-none outline-none focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all"
        />
        <div className="flex items-center gap-2 justify-end">
          {!hasAnswer && (
            <p className="text-[10px] text-on-surface-variant/40 font-body flex-1">
              Submitting marks this question as <strong>Addressed</strong>.
            </p>
          )}
          <button
            onClick={handleSave}
            disabled={!draft.trim() || saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-xl text-xs font-black uppercase tracking-wider disabled:opacity-40 hover:bg-primary/90 transition-all active:scale-95"
          >
            <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>save</span>
            {saving ? 'Saving…' : hasAnswer ? 'Update Response' : 'Submit Response'}
          </button>
        </div>
      </div>
    );
  }

  return null;
};

export default QuestionHourHub;
