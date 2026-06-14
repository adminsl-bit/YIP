import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, ChevronRight, Mic2 } from "lucide-react";

interface DiscussingQuestion {
  id: string;
  ministry: string;
  content: string;
  status: 'pending' | 'addressed' | 'rejected';
  created_at: string;
  profiles: {
    name?: string;
    photo_url?: string;
    party_name?: string;
    committee?: string;
    constituency?: string;
  } | null;
}

const StatusPill = ({ status }: { status: string }) => {
  const styles: Record<string, string> = {
    pending: 'bg-surface-variant text-on-surface-variant',
    addressed: 'bg-tertiary-fixed text-on-tertiary-fixed',
    rejected: 'bg-error-container text-error',
  };
  const labels: Record<string, string> = {
    pending: 'IN DISCUSSION',
    addressed: 'ANSWERED',
    rejected: 'REJECTED',
  };
  return (
    <span className={`px-4 py-1.5 rounded-full text-xs font-black tracking-widest font-headline ${styles[status] || styles.pending}`}>
      {labels[status] || 'IN DISCUSSION'}
    </span>
  );
};

export const QuestionHourDisplay = () => {
  const [questions, setQuestions] = useState<DiscussingQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchQuestions = async () => {
    const { data, error } = await supabase
      .from('questions')
      .select('id, ministry, content, status, created_at, profiles (name, photo_url, party_name, committee, constituency)')
      .eq('is_discussing', true)
      .order('created_at', { ascending: true });
    if (!error) {
      const processed = (data || []).map((q: any) => ({
        ...q,
        profiles: Array.isArray(q.profiles) ? q.profiles[0] : q.profiles,
      }));
      setQuestions(processed);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchQuestions();
    const channel = supabase
      .channel('display_question_hour')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'questions' }, fetchQuestions)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Keep the carousel index in bounds as the discussing set changes
  useEffect(() => {
    setIndex(prev => Math.min(prev, Math.max(questions.length - 1, 0)));
  }, [questions.length]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-50">
        <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 bg-slate-50">
        <div className="w-16 h-16 rounded-2xl bg-primary/5 flex items-center justify-center">
          <Mic2 className="w-10 h-10 text-primary/20" />
        </div>
        <p className="text-[10px] font-headline font-black uppercase tracking-[0.4em] text-slate-400">
          No Question Currently In Discussion
        </p>
      </div>
    );
  }

  const q = questions[index];
  const asker = q.profiles;

  return (
    <div className="flex flex-col items-center justify-center h-full bg-slate-50 px-8 md:px-20 py-10 gap-10">
      <div className="w-full max-w-5xl flex flex-col items-center gap-8">
        {/* Ministry + status */}
        <div className="flex items-center gap-4 flex-wrap justify-center">
          <span className="px-5 py-2 rounded-full bg-primary text-white text-xs font-black uppercase tracking-[0.2em] font-headline shadow-lg shadow-primary/20">
            {q.ministry}
          </span>
          <StatusPill status={q.status} />
        </div>

        {/* Question content */}
        <div className="bg-white rounded-[2.5rem] border border-outline-variant/10 shadow-2xl shadow-primary/5 p-10 md:p-16 w-full">
          <p className="text-2xl md:text-4xl font-bold font-headline text-on-surface text-center leading-relaxed">
            "{q.content}"
          </p>
        </div>

        {/* Asker details */}
        <div className="flex items-center gap-5 bg-white rounded-3xl border border-outline-variant/10 shadow-sm px-8 py-5">
          {asker?.photo_url ? (
            <img src={asker.photo_url} alt={asker.name} className="w-16 h-16 rounded-2xl object-cover shrink-0" />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-black text-2xl shrink-0">
              {(asker?.name || '?').charAt(0)}
            </div>
          )}
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Raised By</p>
            <p className="text-xl font-extrabold font-headline text-on-surface">{asker?.name || 'Unknown Delegate'}</p>
            <p className="text-sm font-bold text-primary/70 mt-0.5">
              {asker?.party_name || asker?.committee || asker?.constituency || ''}
            </p>
          </div>
        </div>
      </div>

      {/* Manual carousel controls */}
      {questions.length > 1 && (
        <div className="flex items-center gap-6">
          <button
            onClick={() => setIndex(prev => (prev === 0 ? questions.length - 1 : prev - 1))}
            className="w-12 h-12 rounded-full bg-white border border-outline-variant/10 shadow-sm flex items-center justify-center hover:bg-primary/5 transition-colors"
          >
            <ChevronLeft className="w-6 h-6 text-primary" />
          </button>
          <span className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 font-headline">
            {index + 1} / {questions.length}
          </span>
          <button
            onClick={() => setIndex(prev => (prev === questions.length - 1 ? 0 : prev + 1))}
            className="w-12 h-12 rounded-full bg-white border border-outline-variant/10 shadow-sm flex items-center justify-center hover:bg-primary/5 transition-colors"
          >
            <ChevronRight className="w-6 h-6 text-primary" />
          </button>
        </div>
      )}
    </div>
  );
};
