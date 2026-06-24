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

const TABS: { key: Tab; icon: string; label: string }[] = [
  { key: 'timer',       icon: 'timer',          label: 'Timer'      },
  { key: 'session',     icon: 'calendar_today',  label: 'Session'    },
  { key: 'polls',       icon: 'how_to_vote',     label: 'Votes'      },
  { key: 'questions',   icon: 'forum',           label: 'Questions'  },
  { key: 'bills',       icon: 'gavel',           label: 'Bills'      },
  { key: 'leaderboard', icon: 'leaderboard',     label: 'Scores'     },
];

interface Props {
  defaultTab?: Tab;
}

const CombinedDisplay = ({ defaultTab = 'timer' }: Props) => {
  const [tab, setTab] = useState<Tab>(defaultTab);
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

        {/* Active poll badge */}
        {activePoll && (
          <div className="ml-auto flex items-center gap-2 bg-secondary/10 border border-secondary/20 rounded-full px-4 py-1.5 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
            <span className="text-[9px] font-black uppercase tracking-[0.25em] text-secondary font-headline truncate max-w-[220px]">
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

      {/* ── Session tab ── */}
      <div
        className={`overflow-hidden ${tab !== 'session' ? 'hidden' : ''}`}
        style={{ height: `calc(100vh - ${TAB_H}px)` }}
      >
        <SessionDisplay />
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
