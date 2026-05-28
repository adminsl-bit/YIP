import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import TimerDisplay from "./TimerDisplay";
import { DetailedPollResults } from "@/components/student/DetailedPollResults";

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

const TAB_H = 56; // px

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
    <div className="h-screen overflow-hidden flex flex-col bg-background">

      {/* ── Top tab bar ── */}
      <nav
        className="shrink-0 bg-white border-b border-outline-variant/10 px-6 flex items-center gap-3"
        style={{ height: TAB_H }}
      >
        {/* Pill switcher */}
        <div className="flex items-center gap-1 bg-surface-container rounded-2xl p-1">
          <button
            onClick={() => setTab('timer')}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all font-headline ${
              tab === 'timer'
                ? 'bg-primary text-white shadow-sm'
                : 'text-on-surface-variant hover:text-primary'
            }`}
          >
            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>timer</span>
            Timer
          </button>
          <button
            onClick={() => setTab('polls')}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all font-headline ${
              tab === 'polls'
                ? 'bg-primary text-white shadow-sm'
                : 'text-on-surface-variant hover:text-primary'
            }`}
          >
            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>how_to_vote</span>
            Poll Results
          </button>
        </div>

        {/* Active poll badge */}
        {activePoll && (
          <div className="ml-auto flex items-center gap-2 bg-secondary/10 border border-secondary/20 rounded-full px-4 py-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
            <span className="text-[9px] font-black uppercase tracking-[0.25em] text-secondary font-headline truncate max-w-[280px]">
              {activePoll.heading || activePoll.title}
            </span>
          </div>
        )}
      </nav>

      {/* ── Timer tab ── */}
      <div
        className={`overflow-hidden ${tab !== 'timer' ? 'hidden' : ''}`}
        style={{ height: `calc(100vh - ${TAB_H}px)` }}
      >
        <TimerDisplay />
      </div>

      {/* ── Poll Results tab ── */}
      <div
        className={`overflow-hidden ${tab !== 'polls' ? 'hidden' : ''}`}
        style={{ height: `calc(100vh - ${TAB_H}px)` }}
      >
        {!activePoll ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 bg-slate-50">
            <div className="w-16 h-16 rounded-2xl bg-primary/5 flex items-center justify-center">
              <span
                className="material-symbols-outlined text-primary/20"
                style={{ fontSize: '2.5rem', fontVariationSettings: "'FILL' 1" }}
              >how_to_vote</span>
            </div>
            <p className="text-[10px] font-headline font-black uppercase tracking-[0.4em] text-slate-400">
              No Active Poll
            </p>
          </div>
        ) : (
          <DetailedPollResults
            pollId={activePoll.id}
            pollTitle={activePoll.title}
            pollHeading={activePoll.heading}
            options={pollOptions}
            isOrganizer={false}
            isActive={activePoll.is_active}
          />
        )}
      </div>

    </div>
  );
};

export default CombinedDisplay;
