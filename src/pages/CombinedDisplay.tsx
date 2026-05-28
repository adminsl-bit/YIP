import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import TimerDisplay from "./TimerDisplay";
import { LiveVotingStats } from "@/components/student/LiveVotingStats";
import { DetailedPollResults } from "@/components/student/DetailedPollResults";
import { BreakingNewsTicker } from "@/components/display/BreakingNewsTicker";

type Tab = 'timer' | 'polls';

interface Poll {
  id: string;
  title: string;
  heading?: string;
  options: any[];
  is_active: boolean;
  show_results_publicly: boolean;
  show_post_analysis: boolean;
}

const CombinedDisplay = () => {
  const [tab, setTab] = useState<Tab>('timer');
  const [activePoll, setActivePoll] = useState<Poll | null>(null);

  useEffect(() => {
    document.title = "YIP — Live Display";
    fetchActivePoll();
    const ch = supabase
      .channel('combined_display_polls')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'polls' }, fetchActivePoll)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const fetchActivePoll = async () => {
    const { data } = await supabase
      .from('polls').select('*').eq('is_active', true)
      .order('created_at', { ascending: false }).limit(1);
    if (data && data.length > 0) { setActivePoll(data[0] as Poll); return; }
    const { data: post } = await supabase
      .from('polls').select('*').eq('show_post_analysis', true)
      .order('updated_at', { ascending: false }).limit(1);
    setActivePoll((post?.[0] as Poll) ?? null);
  };

  const pollOptions = activePoll
    ? (Array.isArray(activePoll.options) ? activePoll.options : []).map((o: any) =>
        typeof o === 'string' ? { id: o, text: o } : o
      )
    : [];

  return (
    <div className="relative h-screen overflow-hidden bg-background">

      {/* Timer tab — full viewport */}
      <div className={tab !== 'timer' ? 'hidden' : ''}>
        <TimerDisplay />
      </div>

      {/* Poll Results tab — full viewport, scrollable */}
      <div className={`h-screen overflow-y-auto ${tab !== 'polls' ? 'hidden' : ''}`}>
        <BreakingNewsTicker />
        {!activePoll ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <span className="material-symbols-outlined text-on-surface-variant/20" style={{ fontSize: '6rem' }}>how_to_vote</span>
            <p className="text-[10px] font-headline font-black uppercase tracking-[0.4em] text-on-surface-variant/40">
              No Active Poll
            </p>
          </div>
        ) : (
          <div className="max-w-5xl mx-auto px-6 py-8 pb-24 space-y-8">
            {activePoll.show_results_publicly && (
              <LiveVotingStats pollId={activePoll.id} showResultsPublicly={activePoll.show_results_publicly} />
            )}
            <DetailedPollResults
              pollId={activePoll.id}
              pollTitle={activePoll.title}
              pollHeading={activePoll.heading}
              options={pollOptions}
              isOrganizer={false}
            />
          </div>
        )}
      </div>

      {/* Floating pill tab bar — bottom center */}
      <nav className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 bg-white/90 backdrop-blur-xl rounded-full px-2 py-2 shadow-2xl border border-outline-variant/10">
        <button
          onClick={() => setTab('timer')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-black uppercase tracking-widest transition-all font-headline ${
            tab === 'timer'
              ? 'bg-primary text-white shadow-md'
              : 'text-on-surface-variant hover:text-primary'
          }`}
        >
          <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>timer</span>
          Timer
        </button>
        <button
          onClick={() => setTab('polls')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-black uppercase tracking-widest transition-all font-headline ${
            tab === 'polls'
              ? 'bg-primary text-white shadow-md'
              : 'text-on-surface-variant hover:text-primary'
          }`}
        >
          <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>how_to_vote</span>
          Poll Results
        </button>
      </nav>

    </div>
  );
};

export default CombinedDisplay;
