import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { BreakingNewsTicker } from '@/components/display/BreakingNewsTicker';

interface AssessmentResult {
  student_id: string;
  student_name: string;
  total_score: number;
  party_number: number;
  position: string;
}

interface PollResult {
  poll_title: string;
  option_id: string;
  option_text: string;
  vote_count: number;
}

// ── Rank config for top 3 ─────────────────────────────────────────────────────
const RANK_CONFIG = [
  { icon: 'emoji_events',     iconColor: 'text-amber-500',  cardBg: 'bg-gradient-to-r from-amber-50 to-white',  ring: 'ring-2 ring-amber-200/60' },
  { icon: 'military_tech',    iconColor: 'text-slate-400',  cardBg: 'bg-gradient-to-r from-slate-50 to-white',  ring: 'ring-2 ring-slate-200/60' },
  { icon: 'workspace_premium',iconColor: 'text-orange-500', cardBg: 'bg-gradient-to-r from-orange-50 to-white', ring: 'ring-2 ring-orange-200/60' },
];

const PARTY_COLORS: Record<number, string> = {
  0: 'bg-error-container text-on-error-container',
  1: 'bg-primary-fixed text-on-primary-fixed-variant',
  2: 'bg-secondary-fixed text-on-secondary-fixed-variant',
  3: 'bg-tertiary-fixed/30 text-tertiary-container',
  4: 'bg-primary-fixed-dim/30 text-on-primary-fixed-variant',
};
const partyColor = (n: number) => PARTY_COLORS[n] ?? 'bg-surface-container text-on-surface-variant';
const partyLabel = (n: number) => (['No Party', 'A', 'B', 'C', 'D', 'E'] as const)[n] ?? String(n);

// ── LeaderRow ─────────────────────────────────────────────────────────────────
const LeaderRow = ({ leader, index }: { leader: AssessmentResult; index: number }) => {
  const isTop3 = index < 3;
  const rankCfg = isTop3 ? RANK_CONFIG[index] : null;

  return (
    <div
      className={`flex items-center gap-5 px-6 py-4 rounded-[1.5rem] transition-all ${
        isTop3
          ? `${rankCfg!.cardBg} ${rankCfg!.ring} shadow-md`
          : 'bg-surface-container-lowest border border-outline-variant/10 hover:border-primary/10'
      }`}
    >
      {/* Rank */}
      <div className="shrink-0 w-14 flex items-center justify-center">
        {isTop3 ? (
          <span
            className={`material-symbols-outlined ${rankCfg!.iconColor}`}
            style={{ fontSize: '2.5rem', fontVariationSettings: "'FILL' 1" }}
          >
            {rankCfg!.icon}
          </span>
        ) : (
          <span className="text-2xl font-headline font-black text-on-surface-variant/40">
            #{index + 1}
          </span>
        )}
      </div>

      {/* Name + meta */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 flex-wrap">
          <h3 className={`font-headline font-black truncate ${isTop3 ? 'text-2xl text-on-surface' : 'text-xl text-on-surface'}`}>
            {leader.student_name}
          </h3>
          <span className={`px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest rounded-md font-headline ${partyColor(leader.party_number)}`}>
            Party {partyLabel(leader.party_number)}
          </span>
        </div>
        <p className="text-sm text-on-surface-variant font-body mt-0.5">{leader.position}</p>
      </div>

      {/* Score */}
      <div className="shrink-0 text-right">
        <span className={`font-headline font-black tabular-nums ${isTop3 ? 'text-4xl text-primary' : 'text-3xl text-on-surface'}`}>
          {leader.total_score}
        </span>
        <p className="text-[10px] text-on-surface-variant font-headline uppercase tracking-widest">pts</p>
      </div>
    </div>
  );
};

// ── PollCard ──────────────────────────────────────────────────────────────────
const PollCard = ({ title, results }: { title: string; results: PollResult[] }) => {
  const maxVotes = Math.max(...results.map(r => r.vote_count), 1);
  const totalVotes = results.reduce((sum, r) => sum + r.vote_count, 0);

  return (
    <div className="bg-surface-container-lowest rounded-[2rem] overflow-hidden shadow-[0_16px_40px_-12px_rgba(19,41,143,0.08)]">
      <div className="h-1.5 bg-gradient-to-r from-primary to-primary-container" />
      <div className="p-8 space-y-6">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-primary text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>how_to_vote</span>
          <h3 className="text-2xl font-headline font-black text-on-surface -tracking-[0.02em]">{title}</h3>
          <span className="ml-auto text-sm text-on-surface-variant font-body">{totalVotes} total votes</span>
        </div>
        <div className="space-y-4">
          {results.map((result, i) => {
            const pct = Math.round((result.vote_count / maxVotes) * 100);
            const isLeading = i === 0;
            return (
              <div key={result.option_id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className={`text-base font-body font-semibold ${isLeading ? 'text-primary' : 'text-on-surface'}`}>
                    {result.option_text}
                  </span>
                  <span className={`text-lg font-headline font-black tabular-nums ${isLeading ? 'text-primary' : 'text-on-surface-variant'}`}>
                    {result.vote_count}
                  </span>
                </div>
                <div className="w-full h-3 bg-surface-container rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ease-out ${
                      isLeading ? 'bg-gradient-to-r from-primary to-primary-container' : 'bg-outline-variant'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ── Main ──────────────────────────────────────────────────────────────────────
const LeaderboardDisplay = () => {
  const [scoringLeaders, setScoringLeaders] = useState<AssessmentResult[]>([]);
  const [pollResults, setPollResults] = useState<Record<string, PollResult[]>>({});
  const [loading, setLoading] = useState(true);
  const [isLeaderboardVisible, setIsLeaderboardVisible] = useState(true);
  const [activeTab, setActiveTab] = useState<'scoring' | 'voting'>('scoring');

  const fetchScoringLeaders = async () => {
    try {
      const { data, error } = await supabase
        .from('assessments')
        .select('student_id, total_score, profiles!inner(name, party_number, position)')
        .eq('status', 'submitted')
        .order('total_score', { ascending: false })
        .limit(10);
      if (error) throw error;
      setScoringLeaders(
        data?.map((a: any) => ({
          student_id: a.student_id,
          student_name: a.profiles.name,
          total_score: a.total_score,
          party_number: a.profiles.party_number,
          position: a.profiles.position,
        })) || []
      );
    } catch (e) { console.error(e); }
  };

  const fetchPollResults = async () => {
    try {
      // Global "Show Results Publicly" override — when off, hide poll results
      // here regardless of each poll's individual setting.
      const { data: rpData } = await supabase
        .from('system_settings').select('setting_value').eq('setting_key', 'results_public').limit(1);
      const resultsPublic = rpData?.length ? (rpData[0].setting_value === true || rpData[0].setting_value === 'true') : true;
      if (!resultsPublic) { setPollResults({}); return; }

      const { data: polls, error: pollsError } = await supabase
        .from('polls').select('*').eq('is_active', true).eq('show_results_publicly', true);
      if (pollsError) throw pollsError;
      const results: Record<string, PollResult[]> = {};
      for (const poll of polls || []) {
        const { data: votes } = await supabase.from('poll_votes').select('option_id').eq('poll_id', poll.id);
        const counts = votes?.reduce((acc, v) => { acc[v.option_id] = (acc[v.option_id] || 0) + 1; return acc; }, {} as Record<string, number>) || {};
        results[poll.id] = (Array.isArray(poll.options) ? poll.options : [])
          .map((o: any) => ({ poll_title: poll.title, option_id: o.id, option_text: o.text, vote_count: counts[o.id] || 0 }))
          .sort((a, b) => b.vote_count - a.vote_count);
      }
      setPollResults(results);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const { data } = await supabase.from('system_settings').select('setting_value').eq('setting_key', 'leaderboard_visible').limit(1);
        const visible = data?.length ? (data[0].setting_value === true || data[0].setting_value === 'true') : true;
        setIsLeaderboardVisible(visible);
        if (visible) await Promise.all([fetchScoringLeaders(), fetchPollResults()]);
      } catch { setIsLeaderboardVisible(false); }
      setLoading(false);
    };

    loadData();

    const assessmentCh = supabase.channel('lb-assessments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assessments' }, fetchScoringLeaders)
      .subscribe();
    const pollCh = supabase.channel('lb-polls')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'poll_votes' }, fetchPollResults)
      .subscribe();
    const interval = setInterval(loadData, 30000);

    return () => {
      supabase.removeChannel(assessmentCh);
      supabase.removeChannel(pollCh);
      clearInterval(interval);
    };
  }, []);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="h-screen civic-mesh-bg flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-14 h-14 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-base font-headline font-black text-on-surface-variant uppercase tracking-widest">Loading Leaderboard…</p>
        </div>
      </div>
    );
  }

  // ── Hidden ─────────────────────────────────────────────────────────────────
  if (!isLeaderboardVisible) {
    return (
      <div className="h-screen civic-mesh-bg flex items-center justify-center px-8">
        <div className="bg-surface-container-lowest rounded-[2rem] p-16 text-center shadow-[0_32px_64px_-16px_rgba(19,41,143,0.1)] max-w-md">
          <span className="material-symbols-outlined text-[64px] text-on-surface-variant/20 block mb-4" style={{ fontVariationSettings: "'FILL' 1" }}>leaderboard</span>
          <h2 className="text-2xl font-headline font-black text-on-surface mb-2">Leaderboard Hidden</h2>
          <p className="text-sm text-on-surface-variant font-body">The leaderboard is currently disabled by the organizer.</p>
        </div>
      </div>
    );
  }

  const pollEntries = Object.entries(pollResults);

  // ── Main ───────────────────────────────────────────────────────────────────
  return (
    <div className="h-screen civic-mesh-bg flex flex-col font-body antialiased overflow-hidden">

      {/* ── Top bar ── */}
      <div className="shrink-0 px-8 pt-6 pb-3 flex items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <span
            className="material-symbols-outlined text-primary"
            style={{ fontSize: '2.5rem', fontVariationSettings: "'FILL' 1" }}
          >
            leaderboard
          </span>
          <div>
            <h1 className="text-3xl font-headline font-black text-on-surface -tracking-[0.03em] leading-none">Live Leaderboard</h1>
            <p className="text-xs text-on-surface-variant font-medium mt-0.5">Young Indians Parliament · Real-time rankings</p>
          </div>
        </div>

        {/* Live pulse */}
        <div className="flex items-center gap-2 bg-surface-container-lowest border border-outline-variant/20 rounded-full px-5 py-2.5 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-tertiary-fixed-dim animate-pulse shrink-0" />
          <span className="text-xs font-headline font-black text-on-surface uppercase tracking-wide">Live</span>
        </div>
      </div>

      {/* ── Tab switcher ── */}
      <div className="shrink-0 px-8 pb-4">
        <div className="flex items-center gap-1 bg-surface-container rounded-2xl p-1 w-fit">
          <button
            onClick={() => setActiveTab('scoring')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-headline font-black uppercase tracking-wide transition-all ${
              activeTab === 'scoring'
                ? 'bg-gradient-to-r from-primary to-primary-container text-white shadow-sm'
                : 'text-on-surface-variant hover:text-primary'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>emoji_events</span>
            Scoring Leaders
          </button>
          <button
            onClick={() => setActiveTab('voting')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-headline font-black uppercase tracking-wide transition-all ${
              activeTab === 'voting'
                ? 'bg-gradient-to-r from-primary to-primary-container text-white shadow-sm'
                : 'text-on-surface-variant hover:text-primary'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>how_to_vote</span>
            Voting Results
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 px-8 pb-16 overflow-y-auto min-h-0">

        {/* Scoring Leaders */}
        {activeTab === 'scoring' && (
          <div className="max-w-4xl mx-auto space-y-3">
            {scoringLeaders.length === 0 ? (
              <div className="bg-surface-container-lowest rounded-[2rem] px-8 py-20 text-center">
                <span className="material-symbols-outlined text-[56px] text-on-surface-variant/20 block mb-3" style={{ fontVariationSettings: "'FILL' 1" }}>emoji_events</span>
                <p className="text-base text-on-surface-variant/50 font-body">No scores submitted yet.</p>
              </div>
            ) : (
              scoringLeaders.map((leader, i) => (
                <LeaderRow key={leader.student_id} leader={leader} index={i} />
              ))
            )}
          </div>
        )}

        {/* Voting Results */}
        {activeTab === 'voting' && (
          <div className="max-w-4xl mx-auto space-y-6">
            {pollEntries.length === 0 ? (
              <div className="bg-surface-container-lowest rounded-[2rem] px-8 py-20 text-center">
                <span className="material-symbols-outlined text-[56px] text-on-surface-variant/20 block mb-3" style={{ fontVariationSettings: "'FILL' 1" }}>how_to_vote</span>
                <p className="text-base text-on-surface-variant/50 font-body">No active polls with public results.</p>
              </div>
            ) : (
              pollEntries.map(([id, results]) => (
                <PollCard key={id} title={results[0]?.poll_title || 'Poll'} results={results} />
              ))
            )}
          </div>
        )}
      </div>

      <BreakingNewsTicker />
    </div>
  );
};

export default LeaderboardDisplay;
