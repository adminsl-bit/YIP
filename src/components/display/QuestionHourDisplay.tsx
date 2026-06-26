import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from "lucide-react";

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
  const [expanded, setExpanded]   = useState(false);
  const [direction, setDirection] = useState(1);
  const [loading, setLoading]     = useState(true);

  const fetchQuestions = async () => {
    // Only show questions the organiser has explicitly marked as "in discussion"
    const { data, error } = await supabase
      .from('questions' as any)
      .select('id, ministry, content, answer, status, is_discussing, created_at, profiles (name, photo_url, party_name, party_alignment, position, constituency)')
      .eq('is_discussing', true)
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
    const poll = setInterval(fetchQuestions, 15_000);
    return () => { supabase.removeChannel(ch); clearInterval(poll); };
  }, []);

  // Keep index in bounds when list changes
  useEffect(() => {
    setIndex(prev => Math.min(prev, Math.max(questions.length - 1, 0)));
  }, [questions.length]);

  // Reset accordion when question changes
  useEffect(() => { setExpanded(false); }, [index]);

  const navigate = (dir: 1 | -1) => {
    setDirection(dir);
    setExpanded(false);
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
  const PREVIEW_LENGTH = 220;
  const isLong = q.content.length > PREVIEW_LENGTH;
  const preview = isLong ? q.content.slice(0, PREVIEW_LENGTH).trimEnd() + '…' : q.content;

  const slideVariants = {
    enter:  (d: number) => ({ x: d > 0 ? 60 : -60, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit:   (d: number) => ({ x: d > 0 ? -60 : 60, opacity: 0 }),
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 overflow-hidden">

      {/* ── Header ── */}
      <header className="shrink-0 flex items-center justify-between px-8 py-4 bg-white border-b border-outline-variant/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-md shadow-primary/20">
            <span className="material-symbols-outlined text-white text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>forum</span>
          </div>
          <div>
            <h1 className="font-headline font-extrabold text-lg tracking-tight text-primary">Legislative Question Hour</h1>
            <p className="font-body text-[10px] font-medium text-on-surface-variant/50 uppercase tracking-widest">Parliamentary Floor — Questions to Ministries</p>
          </div>
        </div>

        {/* Question counter + nav */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full bg-surface-container border border-outline-variant/20 flex items-center justify-center hover:bg-primary/5 transition-colors">
            <ChevronLeft className="w-4 h-4 text-primary" />
          </button>
          <div className="flex items-center gap-1.5 px-4 py-2 bg-surface-container rounded-full border border-outline-variant/10">
            <span className="font-headline font-black text-primary text-base tabular-nums">{index + 1}</span>
            <span className="text-on-surface-variant/40 text-sm">/</span>
            <span className="font-headline font-bold text-on-surface-variant text-base">{questions.length}</span>
          </div>
          <button onClick={() => navigate(1)}
            className="w-9 h-9 rounded-full bg-primary text-white shadow-md shadow-primary/20 flex items-center justify-center hover:bg-primary/90 transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ── Main area ── */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 md:px-12 py-6 space-y-4">

        {/* Animated question card */}
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={q.id}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-4xl mx-auto"
          >
            {/* Ministry + status badges */}
            <div className="flex items-center gap-3 flex-wrap mb-4">
              <span className="px-4 py-1.5 rounded-full bg-primary text-white text-[11px] font-black uppercase tracking-[0.15em] font-headline shadow-sm shadow-primary/20">
                {shortMinistry}
              </span>
              {q.is_discussing && (
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-error/10 text-error border border-error/20 text-[11px] font-black uppercase tracking-widest font-headline">
                  <span className="w-1.5 h-1.5 rounded-full bg-error animate-pulse" />
                  Now in Discussion
                </span>
              )}
              {q.status === 'addressed' && (
                <span className="px-3 py-1.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed text-[11px] font-black uppercase tracking-widest font-headline">
                  Answered
                </span>
              )}
            </div>

            {/* Question card with accordion */}
            <div className="bg-white rounded-3xl border border-outline-variant/10 shadow-xl shadow-primary/5 overflow-hidden">
              <div className="px-8 md:px-12 py-8">
                {/* Preview text — always visible */}
                <p className="text-xl md:text-2xl font-bold font-headline text-on-surface leading-relaxed">
                  "{preview}"
                </p>

                {/* Accordion — full text */}
                {isLong && (
                  <>
                    <AnimatePresence>
                      {expanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                          className="overflow-hidden"
                        >
                          <p className="text-xl md:text-2xl font-bold font-headline text-on-surface leading-relaxed mt-0 pt-2">
                            {q.content.slice(PREVIEW_LENGTH)}
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <button
                      onClick={() => setExpanded(e => !e)}
                      className="mt-5 flex items-center gap-2 text-primary text-sm font-black uppercase tracking-widest font-headline hover:text-primary/70 transition-colors"
                    >
                      {expanded ? <><ChevronUp className="w-4 h-4" /> Collapse</> : <><ChevronDown className="w-4 h-4" /> Read Full Question</>}
                    </button>
                  </>
                )}
              </div>

              {/* Official response if answered */}
              {q.answer && (
                <div className="px-8 md:px-12 py-5 bg-surface-container-low border-t border-outline-variant/10">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-tertiary font-headline mb-2">Official Response</p>
                  <p className="text-base text-on-surface-variant font-body leading-relaxed italic">{q.answer}</p>
                </div>
              )}
            </div>

            {/* Asker info */}
            <div className="mt-4 flex items-center gap-4 bg-white rounded-2xl border border-outline-variant/10 shadow-sm px-6 py-4 self-start max-w-md">
              {asker?.photo_url ? (
                <img src={asker.photo_url} alt={asker.name} className="w-12 h-12 rounded-xl object-cover shrink-0" />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black text-xl shrink-0">
                  {(asker?.name || '?').charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <p className="text-[9px] font-black text-on-surface-variant/40 uppercase tracking-[0.2em] font-headline">Raised By</p>
                <p className="text-base font-extrabold font-headline text-on-surface leading-tight">{asker?.name || 'Unknown Delegate'}</p>
                <p className="text-xs font-bold text-primary/60 mt-0.5">
                  {asker?.party_name || asker?.position || asker?.constituency || ''}
                </p>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* ── All questions list (like bills order) ── */}
        <div className="w-full max-w-4xl mx-auto space-y-2 pb-4">
          <p className="text-[10px] font-black text-on-surface-variant/40 uppercase tracking-[0.3em] font-headline mb-3">
            All Questions · {questions.length} on the Floor
          </p>
          {questions.map((item, idx) => {
            const isCurrent = idx === index;
            const statusLabel = item.is_discussing ? 'Discussing' : item.status === 'addressed' ? 'Answered' : `Q${idx + 1}`;
            const statusCls = item.is_discussing ? 'bg-error/15 text-error' : item.status === 'addressed' ? 'bg-tertiary-fixed text-on-tertiary-fixed' : 'bg-primary/10 text-primary';
            return (
              <button
                key={item.id}
                onClick={() => { setDirection(idx > index ? 1 : -1); setIndex(idx); }}
                className={`w-full flex items-center gap-4 px-5 py-3.5 rounded-2xl border text-left transition-all ${
                  isCurrent
                    ? 'bg-primary/5 border-primary/20 shadow-sm'
                    : 'bg-white border-outline-variant/10 hover:border-primary/15 hover:bg-primary/3'
                }`}
              >
                <span className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${isCurrent ? 'bg-primary text-white' : 'bg-primary/10 text-primary'}`}>
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold font-headline text-on-surface text-sm truncate">{item.content.slice(0, 80)}{item.content.length > 80 ? '…' : ''}</p>
                  <p className="text-[10px] text-on-surface-variant/50 font-headline uppercase tracking-widest mt-0.5">
                    {MINISTRY_SHORT[item.ministry] ?? item.ministry.replace('Ministry of ', '')}
                    {item.profiles?.name ? ` · ${item.profiles.name}` : ''}
                  </p>
                </div>
                <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full font-headline shrink-0 ${statusCls}`}>
                  {statusLabel}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
