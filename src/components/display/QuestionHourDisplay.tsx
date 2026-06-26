import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, ChevronRight } from "lucide-react";

const AUTO_ADVANCE_MS = 12_000; // 12 s per question on the projector

interface Question {
  id: string;
  ministry: string;
  content: string;
  answer: string | null;
  status: 'pending' | 'addressed' | 'rejected';
  votes_count: number;
  is_discussing: boolean;
  created_at: string;
  profiles: {
    name?: string;
    photo_url?: string;
    party_name?: string;
    party_alignment?: string;
    position?: string;
    constituency?: string;
  } | null;
}

const MINISTRY_SHORT: Record<string, string> = {
  'Ministry of Road Transport & Highways': 'Transport',
  'Ministry of Finance': 'Finance',
  'Ministry of Defence': 'Defence',
  'Ministry of Social Justice & Empowerment': 'Social Justice',
  'Ministry of Women & Child Development': 'Women & Child',
  'Ministry of Tourism & Culture': 'Tourism',
  'Ministry of Labour & Employment': 'Labour',
  'Ministry of Information and Broadcasting': 'Info & Broadcasting',
  'Ministry of Youth Affairs & Sports': 'Youth & Sports',
  'Ministry of Home Affairs': 'Home Affairs',
};

export const QuestionHourDisplay = () => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex]         = useState(0);
  const [loading, setLoading]     = useState(true);
  const [progress, setProgress]   = useState(0);
  const [direction, setDirection] = useState(1); // 1 = forward, -1 = backward
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchQuestions = async () => {
    const { data, error } = await supabase
      .from('questions' as any)
      .select('id, ministry, content, answer, status, is_discussing, created_at, profiles (name, photo_url, party_name, party_alignment, position, constituency)')
      .not('status', 'eq', 'rejected')
      .order('is_discussing', { ascending: false }) // discussing questions first
      .order('created_at', { ascending: true });

    if (!error && data) {
      setQuestions((data as any[]).map(q => ({
        ...q,
        profiles: Array.isArray(q.profiles) ? q.profiles[0] : q.profiles,
      })));
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchQuestions();
    const ch = supabase.channel('display_qhour')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'questions' }, fetchQuestions)
      .subscribe();
    const pollInterval = setInterval(fetchQuestions, 15_000);
    return () => { supabase.removeChannel(ch); clearInterval(pollInterval); };
  }, []);

  // Keep index in bounds when question list changes
  useEffect(() => {
    setIndex(prev => Math.min(prev, Math.max(questions.length - 1, 0)));
  }, [questions.length]);

  // Auto-advance + progress bar
  const startAutoAdvance = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (progressRef.current) clearInterval(progressRef.current);
    setProgress(0);

    const start = Date.now();
    progressRef.current = setInterval(() => {
      const elapsed = Date.now() - start;
      setProgress(Math.min((elapsed / AUTO_ADVANCE_MS) * 100, 100));
    }, 100);

    intervalRef.current = setInterval(() => {
      setDirection(1);
      setIndex(prev => (prev + 1) % questions.length);
    }, AUTO_ADVANCE_MS);
  };

  useEffect(() => {
    if (questions.length > 1) startAutoAdvance();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (progressRef.current) clearInterval(progressRef.current);
    };
  }, [questions.length, index]);

  const navigate = (dir: 1 | -1) => {
    setDirection(dir);
    setIndex(prev => {
      const next = prev + dir;
      if (next < 0) return questions.length - 1;
      if (next >= questions.length) return 0;
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-background">
        <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-5 bg-background">
        <div className="w-20 h-20 rounded-[2rem] bg-primary/5 flex items-center justify-center">
          <span className="material-symbols-outlined text-primary/20" style={{ fontSize: '3rem', fontVariationSettings: "'FILL' 1" }}>forum</span>
        </div>
        <p className="text-[11px] font-headline font-black uppercase tracking-[0.4em] text-on-surface-variant/30">No Questions on the Floor</p>
      </div>
    );
  }

  const q = questions[index];
  const asker = q.profiles;
  const shortMinistry = MINISTRY_SHORT[q.ministry] ?? q.ministry.replace('Ministry of ', '');

  const slideVariants = {
    enter:  (d: number) => ({ x: d > 0 ? 80 : -80, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit:   (d: number) => ({ x: d > 0 ? -80 : 80, opacity: 0 }),
  };

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden relative">

      {/* Ambient blobs */}
      <div className="absolute -top-32 -left-32 w-[500px] h-[500px] bg-primary/4 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 -right-32 w-[400px] h-[400px] bg-tertiary-container/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Progress bar */}
      {questions.length > 1 && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-surface-container z-20">
          <motion.div
            className="h-full bg-primary/50"
            style={{ width: `${progress}%` }}
            transition={{ duration: 0.1 }}
          />
        </div>
      )}

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-10 py-4 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
            <span className="material-symbols-outlined text-white text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>forum</span>
          </div>
          <div>
            <h1 className="font-headline font-extrabold text-2xl tracking-tighter text-primary">Legislative Question Hour</h1>
            <p className="font-body text-xs font-medium text-on-surface-variant uppercase tracking-widest">Parliamentary Floor — Questions to Ministries</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Counter */}
          <div className="bg-white/70 backdrop-blur-[20px] px-5 py-2.5 rounded-full flex items-center gap-3 border border-outline-variant/20 shadow-sm">
            <span className="font-headline font-black text-primary text-lg tabular-nums">{index + 1}</span>
            <span className="text-on-surface-variant/40 font-body">/</span>
            <span className="font-headline font-bold text-on-surface-variant text-base">{questions.length}</span>
            <div className="w-px h-4 bg-outline-variant/30" />
            <span className="font-headline font-black text-[10px] uppercase tracking-widest text-on-surface-variant/60">
              Questions
            </span>
          </div>

          {/* Dot indicators */}
          <div className="flex items-center gap-1.5">
            {questions.map((_, i) => (
              <button
                key={i}
                onClick={() => { setDirection(i > index ? 1 : -1); setIndex(i); }}
                className={`rounded-full transition-all ${i === index ? 'w-5 h-2.5 bg-primary' : 'w-2.5 h-2.5 bg-outline-variant/40 hover:bg-primary/40'}`}
              />
            ))}
          </div>
        </div>
      </header>

      {/* Main card — animated */}
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-6 md:px-16 lg:px-24 pb-6 relative z-10">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={q.id}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-5xl flex flex-col gap-5"
          >
            {/* Ministry + status row */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="px-5 py-2 rounded-full bg-primary text-white text-xs font-black uppercase tracking-[0.2em] font-headline shadow-lg shadow-primary/20">
                {shortMinistry}
              </span>
              {q.is_discussing && (
                <span className="flex items-center gap-2 px-4 py-2 rounded-full bg-error/10 text-error border border-error/20 text-xs font-black uppercase tracking-widest font-headline">
                  <span className="w-2 h-2 rounded-full bg-error animate-pulse" />
                  Now in Discussion
                </span>
              )}
              {q.status === 'addressed' && (
                <span className="px-4 py-2 rounded-full bg-tertiary-fixed text-on-tertiary-fixed text-xs font-black uppercase tracking-widest font-headline">
                  Answered
                </span>
              )}
            </div>

            {/* Question text */}
            <div className="bg-white/80 backdrop-blur-sm rounded-[2.5rem] border border-outline-variant/10 shadow-2xl shadow-primary/5 px-10 md:px-16 py-10 md:py-14">
              <p className="text-2xl md:text-3xl lg:text-4xl font-bold font-headline text-on-surface leading-relaxed">
                "{q.content}"
              </p>

              {/* Official response if answered */}
              {q.answer && (
                <div className="mt-6 pt-6 border-t border-outline-variant/10">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-tertiary font-headline mb-2">Official Response</p>
                  <p className="text-lg text-on-surface-variant italic font-body leading-relaxed">{q.answer}</p>
                </div>
              )}
            </div>

            {/* Asker info */}
            <div className="flex items-center gap-5 bg-white/70 backdrop-blur-sm rounded-3xl border border-outline-variant/10 shadow-sm px-7 py-5 self-start max-w-xl">
              {asker?.photo_url ? (
                <img src={asker.photo_url} alt={asker.name} className="w-14 h-14 rounded-2xl object-cover shrink-0" />
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-black text-2xl shrink-0">
                  {(asker?.name || '?').charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <p className="text-[9px] font-black text-on-surface-variant/40 uppercase tracking-[0.2em] font-headline">Raised By</p>
                <p className="text-lg font-extrabold font-headline text-on-surface leading-tight">{asker?.name || 'Unknown Delegate'}</p>
                <p className="text-sm font-bold text-primary/60 mt-0.5">
                  {asker?.party_name || asker?.position || asker?.constituency || ''}
                </p>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation arrows */}
      {questions.length > 1 && (
        <div className="absolute bottom-8 right-8 flex items-center gap-3 z-20">
          <button
            onClick={() => navigate(-1)}
            className="w-12 h-12 rounded-full bg-white/80 backdrop-blur-sm border border-outline-variant/20 shadow-sm flex items-center justify-center hover:bg-primary/5 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-primary" />
          </button>
          <button
            onClick={() => navigate(1)}
            className="w-12 h-12 rounded-full bg-primary text-white shadow-lg shadow-primary/20 flex items-center justify-center hover:bg-primary/90 transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
};
