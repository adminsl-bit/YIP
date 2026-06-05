import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
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

// Extract "Ministry of X" from "Minister of X" or "Shadow Minister of X"
const getMinistryFromPosition = (position: string | null | undefined): string | null => {
  if (!position) return null;
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
}

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
  const myMinistry = getMinistryFromPosition(profile?.position);
  const isMinister = !!myMinistry;

  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [questionContent, setQuestionContent] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewFilter, setViewFilter] = useState<'trending' | 'assigned'>('trending');
  const [ministryFilter, setMinistryFilter] = useState<string>('All Portfolios');
  const [selectedMinistry, setSelectedMinistry] = useState('');

  const fetchQuestions = async () => {
    try {
      setLoading(true);
      const { data: qs, error } = await supabase
        .from('questions')
        .select(`*, profiles (*)`)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const { data: votes } = await supabase
        .from('question_votes')
        .select('question_id, user_id');

      const processed: Question[] = (qs || []).map(q => {
        const qVotes = votes?.filter(v => v.question_id === q.id) || [];
        const profileData = Array.isArray(q.profiles) ? q.profiles[0] : q.profiles;
        return {
          ...q,
          profiles: profileData,
          votes_count: qVotes.length,
          user_has_voted: qVotes.some(v => v.user_id === user?.id),
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
    fetchQuestions();
    const channel = supabase.channel('public:questions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'questions' }, fetchQuestions)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'question_votes' }, fetchQuestions)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Check if this student already has a pending/addressed question (not rejected)
  const myActiveQuestion = questions.find(q => q.user_id === user?.id && q.status !== 'rejected');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !questionContent.trim()) return;
    // Enforce one-question-per-student limit
    if (!editingId && myActiveQuestion) {
      toast.error('You have already submitted a question. Only one question per session is allowed.');
      return;
    }
    const ministry = selectedMinistry || MINISTRIES[0];
    setSubmitting(true);
    try {
      if (editingId) {
        const { error } = await supabase.from('questions').update({ ministry, content: questionContent }).eq('id', editingId);
        if (error) throw error;
        toast.success('Question updated');
      } else {
        const { error } = await supabase.from('questions').insert({ user_id: user.id, ministry, content: questionContent, status: 'pending' });
        if (error) throw error;
        toast.success('Question submitted to the assembly');
      }
      setQuestionContent('');
      setEditingId(null);
      fetchQuestions();
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
      fetchQuestions();
    } catch {
      toast.error('Failed to retract question');
    } finally {
      setDeleteId(null);
    }
  };

  const handleVote = async (questionId: string, hasVoted: boolean) => {
    if (!user) return;
    try {
      if (hasVoted) {
        await supabase.from('question_votes').delete().eq('question_id', questionId).eq('user_id', user.id);
      } else {
        await supabase.from('question_votes').insert({ question_id: questionId, user_id: user.id });
      }
      fetchQuestions();
    } catch {
      toast.error('Protocol error');
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
      <header className="mb-10">
        <h1 className="text-4xl font-extrabold font-headline tracking-tight text-primary">
          Legislative <span className="text-secondary">Question Hour</span>
        </h1>
        <p className="text-[10px] text-on-surface-variant/40 font-black uppercase tracking-[0.4em] mt-3 flex items-center gap-2 font-headline">
          <span className="material-symbols-outlined text-[12px]">gavel</span>
          Parliamentary Deliberation Protocol
        </p>
      </header>

    <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 items-start">

      {/* ── Left Sidebar ── */}
      <aside className="lg:col-span-3 bg-surface-container-low p-6 lg:p-8 space-y-8 lg:sticky lg:top-0 min-h-screen border-r border-outline-variant/10">

        <div>
          <h2 className="text-[13px] font-black uppercase italic tracking-tight text-primary mb-2 font-headline leading-tight">
            Formal Question Submission
          </h2>
          <p className="text-[12px] text-on-surface-variant/60 leading-relaxed font-medium font-body">
            Submit a precise legislative query to the executive ministries for floor deliberation.
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

        <form onSubmit={handleSubmit} className={`space-y-5 ${myActiveQuestion && !editingId ? 'opacity-40 pointer-events-none select-none' : ''}`}>
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
        </form>

        <div className="flex gap-3 p-5 bg-surface-container rounded-2xl">
          <span className="material-symbols-outlined text-[16px] text-primary shrink-0 mt-0.5">gavel</span>
          <div>
            <p className="text-[10px] font-black text-primary uppercase tracking-[0.15em] mb-1 font-headline">Protocol Notice</p>
            <p className="text-[12px] text-on-surface-variant/70 leading-relaxed font-body">
              Questions should be constructive and focus on policy deliberation. Inflammatory or non-parliamentary language will be retracted by the Speaker.
            </p>
          </div>
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
          <div className="flex gap-2.5 overflow-x-auto pb-1 pr-6 lg:pr-8" style={{ scrollbarWidth: 'none' }}>
            {Object.entries(FILTER_LABELS).map(([full, label]) => (
              <button
                key={full}
                onClick={() => setMinistryFilter(full)}
                className={`px-4 py-2 rounded-full font-black text-[10px] uppercase tracking-widest whitespace-nowrap transition-all font-headline ${
                  ministryFilter === full
                    ? 'bg-primary text-white shadow-sm shadow-primary/20'
                    : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Section header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-on-tertiary-container animate-pulse" />
            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-primary font-headline">Deliberation Floor</span>
          </div>
          <span className="text-[10px] font-black text-on-surface-variant/40 uppercase tracking-widest font-headline">
            {pendingCount} Question{pendingCount !== 1 ? 's' : ''} Pending Response
          </span>
        </div>

        {/* Questions feed */}
        {loading ? (
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {allQuestions.map((q, idx) => {
                const isFeatured = idx === 0;
                const initials = q.profiles?.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || 'D';
                const shortMinistry = q.ministry.replace('Ministry of ', '');

                return (
                  <motion.div
                    key={q.id}
                    layout
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ duration: 0.22 }}
                    className={`bg-surface-container-lowest rounded-[2rem] p-5 shadow-[0_4px_24px_0_rgba(46,65,172,0.04)] hover:shadow-[0_12px_40px_0_rgba(46,65,172,0.08)] hover:-translate-y-0.5 transition-all duration-300 group ${isFeatured ? 'md:col-span-2' : ''}`}
                  >
                    {/* Card header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl overflow-hidden bg-primary/10 shrink-0 flex items-center justify-center">
                          {q.profiles?.photo_url
                            ? <img src={q.profiles.photo_url} alt={q.profiles.name} className="w-full h-full object-cover" />
                            : <span className="text-sm font-black text-primary font-headline">{initials}</span>}
                        </div>
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-primary mb-0.5 font-headline">{shortMinistry}</p>
                          <h4 className="text-sm font-black text-on-surface font-headline leading-none">
                            {q.profiles?.name || 'National Delegate'}
                          </h4>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <StatusBadge status={q.status} />
                        {q.user_id === user?.id && (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => { setEditingId(q.id); setSelectedMinistry(q.ministry); setQuestionContent(q.content); }}
                              className="p-1.5 rounded-lg text-on-surface-variant/40 hover:text-primary hover:bg-surface-container transition-all"
                            >
                              <span className="material-symbols-outlined text-[12px]">edit</span>
                            </button>
                            <button
                              onClick={() => setDeleteId(q.id)}
                              className="p-1.5 rounded-lg text-on-surface-variant/40 hover:text-error hover:bg-surface-container transition-all"
                            >
                              <span className="material-symbols-outlined text-[12px]">delete</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Question text */}
                    <p className={`font-body font-semibold text-on-surface leading-snug mb-4 ${isFeatured ? 'text-lg' : 'text-sm'}`}>
                      {q.content}
                    </p>

                    {/* Official response for answered questions */}
                    {q.status === 'addressed' && q.answer && (
                      <div className="bg-surface-container-low rounded-2xl p-3 mb-4 border-l-4 border-tertiary">
                        <div className="flex items-center gap-1.5 mb-2">
                          <span className="material-symbols-outlined text-[14px] text-tertiary" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                          <span className="text-[9px] font-black uppercase tracking-[0.15em] text-tertiary font-headline">Official Response</span>
                        </div>
                        <p className="text-xs text-on-surface-variant italic leading-relaxed font-body">"{q.answer}"</p>
                      </div>
                    )}

                    {/* Footer */}
                    <div className="flex items-center gap-4 pt-3 border-t border-surface-container-high">
                      <button
                        onClick={() => handleVote(q.id, q.user_has_voted)}
                        className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest transition-all font-headline ${
                          q.user_has_voted ? 'text-primary' : 'text-on-surface-variant/40 hover:text-primary'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[14px]">trending_up</span>
                        {q.votes_count} Supports
                      </button>
                      {q.votes_count > 1 && q.status === 'pending' && !q.user_has_voted && (
                        <span className="text-[9px] font-black text-on-surface-variant/30 uppercase tracking-widest font-headline">
                          {q.votes_count} Others Asking
                        </span>
                      )}
                      <span className="text-[9px] font-black text-on-surface-variant/30 uppercase tracking-widest ml-auto font-headline">
                        {new Date(q.created_at).toLocaleDateString('en-GB')}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </AnimatePresence>
        )}
      </section>

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
    </div>
  );
};

export default QuestionHourHub;
