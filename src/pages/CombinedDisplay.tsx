import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import TimerDisplay from "./TimerDisplay";
import SessionDisplay from "./SessionDisplay";
import LeaderboardDisplay from "./LeaderboardDisplay";
import { DetailedPollResults } from "@/components/student/DetailedPollResults";
import { BreakingNewsTicker } from "@/components/display/BreakingNewsTicker";
import { QuestionHourDisplay } from "@/components/display/QuestionHourDisplay";
import { BillsDisplay } from "@/components/display/BillsDisplay";

type Tab = 'timer' | 'polls' | 'questions' | 'bills' | 'leaderboard' | 'session';

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

// Session and Scores/Leaderboard are internal-only — not shown on the public stage display
const TABS: { key: Tab; icon: string; label: string }[] = [
  { key: 'timer',     icon: 'timer',      label: 'Timer'     },
  { key: 'polls',     icon: 'how_to_vote', label: 'Votes'    },
  { key: 'questions', icon: 'forum',      label: 'Questions' },
  { key: 'bills',     icon: 'gavel',      label: 'Bills'     },
];

interface Props {
  defaultTab?: Tab;
}

const CombinedDisplay = ({ defaultTab = 'timer' }: Props) => {
  const [tab, setTab] = useState<Tab>(defaultTab);
  const [activePoll, setActivePoll] = useState<Poll | null>(null);
  const [readyPoll, setReadyPoll]   = useState<Poll | null>(null); // created but not yet started

  useEffect(() => {
    document.title = "YIP — Live Display";
    fetchActivePoll();

    // Realtime for instant sync
    const ch = supabase
      .channel('combined_display_polls')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'polls' }, fetchActivePoll)
      .subscribe();

    // Fallback interval — display screens stay open for hours and realtime
    // websockets can silently drop; this ensures we never stay on a stale state
    const interval = setInterval(fetchActivePoll, 10_000);

    return () => {
      supabase.removeChannel(ch);
      clearInterval(interval);
    };
  }, []);

  const fetchActivePoll = async () => {
    // 1. Check for currently active (voting open) poll
    const { data: active } = await supabase
      .from('polls').select('*').eq('is_active', true)
      .order('created_at', { ascending: false }).limit(1);
    if (active && active.length > 0) {
      setActivePoll(active[0] as Poll);
      setReadyPoll(null);
      return;
    }
    // 2. Check for a poll that exists but hasn't been started yet (is_active=false, not post-analysis)
    const { data: ready } = await supabase
      .from('polls').select('*').eq('is_active', false).eq('show_post_analysis', false)
      .order('created_at', { ascending: false }).limit(1);
    if (ready && ready.length > 0) {
      setActivePoll(null);
      setReadyPoll(ready[0] as Poll);
      return;
    }
    // 3. Show most recent post-analysis poll
    const { data: post } = await supabase
      .from('polls').select('*').eq('show_post_analysis', true)
      .order('updated_at', { ascending: false }).limit(1);
    setActivePoll((post?.[0] as Poll) ?? null);
    setReadyPoll(null);
  };

  // Auto-switch to Votes tab whenever a poll becomes ready or active
  useEffect(() => {
    if (activePoll || readyPoll) setTab('polls');
  }, [activePoll?.id, readyPoll?.id]);

  const pollOptions = activePoll
    ? (Array.isArray(activePoll.options) ? activePoll.options : []).map((o: any) =>
        typeof o === 'string' ? { id: o, text: o } : o
      )
    : [];

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-background">

      {/* ── Tab bar ── */}
      <nav
        className="shrink-0 bg-white border-b border-outline-variant/10 px-4 flex items-center gap-2"
        style={{ height: TAB_H }}
      >
        {/* Logo */}
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0 mr-1">
          <span className="material-symbols-outlined text-white text-base" style={{ fontVariationSettings: "'FILL' 1" }}>account_balance</span>
        </div>

        {/* Pill switcher */}
        <div className="flex items-center gap-1 bg-surface-container rounded-2xl p-1 overflow-x-auto scrollbar-none">
          {TABS.map(({ key, icon, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all font-headline whitespace-nowrap ${
                tab === key
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-on-surface-variant hover:text-primary'
              }`}
            >
              <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
              {label}
            </button>
          ))}
        </div>

        {/* Poll status badge */}
        {activePoll && (
          <div className="ml-auto flex items-center gap-2 bg-secondary/10 border border-secondary/20 rounded-full px-4 py-1.5 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
            <span className="text-[9px] font-black uppercase tracking-[0.25em] text-secondary font-headline truncate max-w-[220px]">
              {activePoll.heading || activePoll.title}
            </span>
          </div>
        )}
        {readyPoll && !activePoll && (
          <div className="ml-auto flex items-center gap-2 bg-amber-500/10 border border-amber-400/30 rounded-full px-4 py-1.5 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span className="text-[9px] font-black uppercase tracking-[0.25em] text-amber-700 font-headline truncate max-w-[220px]">
              Ready: {readyPoll.heading || readyPoll.title}
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

      {/* ── Session tab ── */}
      <div
        className={`overflow-hidden ${tab !== 'session' ? 'hidden' : ''}`}
        style={{ height: `calc(100vh - ${TAB_H}px)` }}
      >
        <SessionDisplay />
      </div>

      {/* ── Poll / Voting tab ── */}
      <div
        className={`overflow-hidden ${tab !== 'polls' ? 'hidden' : ''}`}
        style={{ height: `calc(100vh - ${TAB_H}px)` }}
      >
        {/* State 1: voting is open */}
        {activePoll && (
          <DetailedPollResults
            pollId={activePoll.id}
            pollTitle={activePoll.title}
            pollHeading={activePoll.heading}
            options={(Array.isArray(activePoll.options) ? activePoll.options : []).map((o: any) =>
              typeof o === 'string' ? { id: o, text: o } : o)}
            isOrganizer={false}
            isActive={activePoll.is_active}
          />
        )}

        {/* State 2: poll created but organiser hasn't started voting yet */}
        {!activePoll && readyPoll && (
          <div className="flex flex-col items-center justify-center h-full gap-8 bg-background">
            <div className="w-24 h-24 rounded-[2rem] bg-amber-400/10 flex items-center justify-center animate-pulse">
              <span className="material-symbols-outlined text-amber-500" style={{ fontSize: '3rem', fontVariationSettings: "'FILL' 1" }}>how_to_vote</span>
            </div>
            <div className="text-center space-y-3 max-w-lg px-8">
              <p className="text-[11px] font-black uppercase tracking-[0.4em] text-amber-600 font-headline">Voting Opens Soon</p>
              <h2 className="text-3xl md:text-4xl font-extrabold font-headline text-on-surface tracking-tight leading-tight">
                {readyPoll.heading || readyPoll.title}
              </h2>
              <p className="text-sm text-on-surface-variant font-body">Standby — the organiser will open voting shortly</p>
            </div>
            {/* Option preview — shows options without counts */}
            <div className="flex flex-wrap justify-center gap-3 px-8 max-w-2xl">
              {(Array.isArray(readyPoll.options) ? readyPoll.options : []).map((o: any, i: number) => {
                const text = typeof o === 'string' ? o : o.text;
                return (
                  <div key={i} className="px-6 py-3 rounded-2xl bg-surface-container border border-outline-variant/20 font-headline font-black text-sm text-on-surface uppercase tracking-widest">
                    {text}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* State 3: no poll at all */}
        {!activePoll && !readyPoll && (
          <div className="flex flex-col items-center justify-center h-full gap-4 bg-background">
            <div className="w-16 h-16 rounded-2xl bg-primary/5 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary/20" style={{ fontSize: '2.5rem', fontVariationSettings: "'FILL' 1" }}>how_to_vote</span>
            </div>
            <p className="text-[10px] font-headline font-black uppercase tracking-[0.4em] text-on-surface-variant/30">No Poll Scheduled</p>
          </div>
        )}
      </div>

      {/* ── Question Hour tab ── */}
      <div
        className={`overflow-hidden ${tab !== 'questions' ? 'hidden' : ''}`}
        style={{ height: `calc(100vh - ${TAB_H}px)` }}
      >
        <QuestionHourDisplay />
      </div>

      {/* ── Bills tab ── */}
      <div
        className={`overflow-hidden ${tab !== 'bills' ? 'hidden' : ''}`}
        style={{ height: `calc(100vh - ${TAB_H}px)` }}
      >
        <BillsDisplay />
      </div>

      {/* ── Leaderboard tab ── */}
      <div
        className={`overflow-hidden ${tab !== 'leaderboard' ? 'hidden' : ''}`}
        style={{ height: `calc(100vh - ${TAB_H}px)` }}
      >
        <LeaderboardDisplay />
      </div>

      <BreakingNewsTicker />
    </div>
  );
};

export default CombinedDisplay;
