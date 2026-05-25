import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Vote, CheckCircle, ThumbsUp, ThumbsDown, Loader2, Lock,
  Landmark, Users, BarChart3, User, Building2, ShieldCheck
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { toast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

interface Poll {
  id: string;
  title: string;
  description?: string;
  options: any[];
  is_active: boolean;
  show_results_publicly: boolean;
  created_at: string;
  proposed_by?: string;
  committee?: string;
}

const getKey = (opt: any): string => typeof opt === 'string' ? opt : (opt?.id ?? String(opt));
const getText = (opt: any): string => typeof opt === 'string' ? opt : (opt?.text ?? String(opt));

export const PollVoting = () => {
  const { user } = useAuth();
  const { settings } = useSystemSettings();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [lastPassed, setLastPassed] = useState<Poll | null>(null);
  const [archivedPolls, setArchivedPolls] = useState<Poll[]>([]);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [userVotes, setUserVotes] = useState<Record<string, string>>({});
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel('poll_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'polls' }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchData = async () => {
    try {
      const [{ data: activeData }, { data: inactiveData }] = await Promise.all([
        supabase.from('polls').select('*').eq('is_active', true).order('created_at', { ascending: false }),
        supabase.from('polls').select('id, title, description, created_at').eq('is_active', false).order('created_at', { ascending: false }).limit(4),
      ]);
      const pollsData = (activeData || []) as Poll[];
      const closedData = (inactiveData || []) as Poll[];
      setPolls(pollsData);
      setLastPassed(closedData[0] || null);
      setArchivedPolls(closedData.slice(0, 3));
      if (user && pollsData.length) {
        const { data: votesData } = await supabase
          .from('poll_votes').select('poll_id, option_id')
          .eq('voter_id', user.id)
          .in('poll_id', pollsData.map(p => p.id));
        const voteMap: Record<string, string> = {};
        (votesData || []).forEach((v: any) => { voteMap[v.poll_id] = v.option_id; });
        setUserVotes(voteMap);
      } else {
        setUserVotes({});
      }
    } catch (err) {
      console.error('Error loading polls', err);
      toast({ title: 'Error', description: 'Failed to load polls', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (poll: Poll) => {
    if (!user) return;
    const choice = selectedOptions[poll.id];
    if (!choice) return;
    setSubmitting(poll.id);
    try {
      const { error } = await supabase
        .from('poll_votes')
        .insert({ poll_id: poll.id, voter_id: user.id, option_id: choice });
      if (error) throw error;
      setUserVotes(prev => ({ ...prev, [poll.id]: choice }));
      setSelectedOptions(prev => ({ ...prev, [poll.id]: '' }));
      setRefreshTrigger(prev => prev + 1);
      toast({ title: 'Vote recorded', description: `You voted: ${choice}` });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to cast vote', variant: 'destructive' });
    } finally {
      setSubmitting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-[10px] font-black uppercase text-on-surface-variant tracking-widest font-headline">Loading Chamber...</p>
      </div>
    );
  }

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).toUpperCase();

  return (
    <div>
      {/* Hero */}
      <header className="mb-10">
        <h1 className="text-4xl font-extrabold font-headline tracking-tight text-primary">
          Parliamentary <span className="text-secondary">Ballot Chamber</span>
        </h1>
        <p className="text-[10px] text-on-surface-variant/40 font-black uppercase tracking-[0.4em] mt-3 flex items-center gap-2 font-headline">
          <Landmark className="w-3 h-3" />
          Active Legislative Floor
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

        {/* ── 8-col section ── */}
        <section className="lg:col-span-8 space-y-8">

          {!settings.voting_enabled && (
            <div className="bg-surface-container-lowest rounded-3xl p-12 text-center shadow-[0_8px_32px_0_rgba(46,65,172,0.04)]">
              <Vote className="w-10 h-10 text-on-surface-variant/30 mx-auto mb-4" />
              <p className="text-on-surface-variant font-medium font-body">Voting is currently disabled by the organizer.</p>
            </div>
          )}

          {settings.voting_enabled && polls.length === 0 && (
            <div className="bg-surface-container-lowest rounded-3xl p-16 text-center shadow-[0_8px_32px_0_rgba(46,65,172,0.04)]">
              <Vote className="w-10 h-10 text-on-surface-variant/30 mx-auto mb-4" />
              <p className="text-on-surface-variant font-medium font-body">No active resolutions at this time.</p>
              <p className="text-on-surface-variant/60 text-xs font-body mt-1">The organizer will open voting when a resolution is ready.</p>
            </div>
          )}

          {settings.voting_enabled && polls.map((poll, pollIdx) => {
            const votedChoice = userVotes[poll.id];
            const hasVoted = !!votedChoice;
            const options = Array.isArray(poll.options) ? poll.options : [];
            const isBinary = options.length === 2;
            const canVote = !!selectedOptions[poll.id] && !hasVoted && settings.voting_enabled;

            return (
              <div key={poll.id} className="space-y-6">

                {/* ── Resolution Header ── */}
                <div className="bg-surface-container-lowest p-8 rounded-3xl shadow-[0_8px_32px_0_rgba(46,65,172,0.04)] border border-outline-variant/10">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                    <div className="flex-1">
                      <h2 className="text-2xl md:text-3xl font-extrabold text-on-surface font-headline leading-tight tracking-tight mb-5">
                        {poll.title}
                      </h2>
                      <div className="flex flex-wrap gap-x-6 gap-y-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-primary-fixed flex items-center justify-center shrink-0">
                            <User className="w-4 h-4 text-primary" />
                          </div>
                          <div>
                            <p className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider font-headline">Proposed By</p>
                            <p className="text-sm font-bold text-on-surface font-body">{poll.proposed_by || '—'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 border-l border-outline-variant/30 pl-6">
                          <div className="w-8 h-8 rounded-full bg-secondary-fixed flex items-center justify-center shrink-0">
                            <Building2 className="w-4 h-4 text-secondary" />
                          </div>
                          <div>
                            <p className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider font-headline">Committee</p>
                            <p className="text-sm font-bold text-on-surface font-body">{poll.committee || '—'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 border-l border-outline-variant/30 pl-6">
                          <div className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center shrink-0">
                            <ShieldCheck className="w-4 h-4 text-on-surface-variant" />
                          </div>
                          <div>
                            <p className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider font-headline">Status</p>
                            <p className="text-sm font-bold text-on-surface font-body">
                              {settings.voting_enabled ? 'Floor Open' : 'Session Paused'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-center justify-center bg-surface-container-low px-8 py-6 rounded-2xl shrink-0">
                      <div className="w-4 h-4 bg-error rounded-full animate-pulse-live mb-2" />
                      <p className="text-base font-black text-on-surface font-headline">LIVE VOTING</p>
                      <p className="text-xs font-medium text-on-surface-variant font-body mt-0.5">Session Active</p>
                    </div>
                  </div>
                </div>

                {/* ── Voting Card ── */}
                <div className="bg-surface-container-lowest rounded-3xl p-8 shadow-[0_8px_32px_0_rgba(46,65,172,0.04)] relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-[100%] transition-transform group-hover:scale-110 pointer-events-none" />
                  <span className="text-primary font-bold text-sm tracking-widest font-headline uppercase mb-1 block">
                    Resolution #{poll.id.slice(-3).toUpperCase()}
                  </span>
                  {poll.description && (
                    <p className="text-on-surface-variant font-body text-base leading-relaxed mt-2 mb-8">
                      {poll.description}
                    </p>
                  )}
                  {hasVoted && (
                    <div className="flex items-center gap-4 p-5 rounded-2xl bg-emerald-50 border border-emerald-100 mb-8">
                      <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center shrink-0">
                        <CheckCircle className="w-5 h-5 text-white" strokeWidth={2.5} />
                      </div>
                      <div>
                        <p className="text-emerald-800 font-bold font-headline">Vote Cast Successfully</p>
                        <p className="text-emerald-600 text-xs font-body mt-0.5">Your choice: <span className="font-bold">{votedChoice}</span></p>
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      {isBinary ? (
                        <div className="flex gap-3">
                          <button
                            disabled={hasVoted}
                            onClick={() => setSelectedOptions(prev => ({ ...prev, [poll.id]: getKey(options[0]) }))}
                            className={`flex-1 group/btn flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all ${
                              selectedOptions[poll.id] === getKey(options[0])
                                ? 'border-primary-container bg-primary-container/10'
                                : 'bg-surface-container border-transparent hover:border-primary-container hover:bg-primary-container/5'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                          >
                            <ThumbsUp className={`w-7 h-7 mb-1 group-hover/btn:scale-110 transition-transform text-primary-container ${selectedOptions[poll.id] === getKey(options[0]) ? 'scale-110' : ''}`} strokeWidth={1.5} />
                            <span className="font-bold font-headline text-primary-container text-sm">{getText(options[0])}</span>
                          </button>
                          <button
                            disabled={hasVoted}
                            onClick={() => setSelectedOptions(prev => ({ ...prev, [poll.id]: getKey(options[1]) }))}
                            className={`flex-1 group/btn flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all ${
                              selectedOptions[poll.id] === getKey(options[1])
                                ? 'border-secondary-container bg-secondary-container/10'
                                : 'bg-surface-container border-transparent hover:border-secondary-container hover:bg-secondary-container/5'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                          >
                            <ThumbsDown className={`w-7 h-7 mb-1 group-hover/btn:scale-110 transition-transform text-secondary-container ${selectedOptions[poll.id] === getKey(options[1]) ? 'scale-110' : ''}`} strokeWidth={1.5} />
                            <span className="font-bold font-headline text-secondary-container text-sm">{getText(options[1])}</span>
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {options.map((opt: any) => {
                            const optKey = getKey(opt);
                            const isSelected = selectedOptions[poll.id] === optKey;
                            return (
                              <button
                                key={optKey}
                                disabled={hasVoted}
                                onClick={() => setSelectedOptions(prev => ({ ...prev, [poll.id]: optKey }))}
                                className={`w-full text-left px-5 py-4 rounded-2xl border-2 transition-all font-body font-semibold text-sm ${
                                  isSelected
                                    ? 'border-primary-container bg-primary-container/10 text-primary'
                                    : 'bg-surface-container border-transparent hover:border-primary-container hover:bg-primary-container/5 text-on-surface'
                                } disabled:opacity-50 disabled:cursor-not-allowed`}
                              >
                                {getText(opt)}
                              </button>
                            );
                          })}
                        </div>
                      )}
                      {canVote ? (
                        <button
                          onClick={() => handleVote(poll)}
                          disabled={submitting === poll.id}
                          className="w-full py-4 rounded-2xl bg-gradient-to-br from-primary to-primary-container text-white font-bold font-headline shadow-md hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-70 flex items-center justify-center gap-2"
                        >
                          {submitting === poll.id
                            ? <><Loader2 className="w-4 h-4 animate-spin" /><span>Casting Vote...</span></>
                            : <><Vote className="w-4 h-4" /><span>Cast Vote</span></>}
                        </button>
                      ) : !hasVoted ? (
                        <button disabled className="w-full py-4 rounded-2xl bg-outline-variant/30 text-on-surface-variant cursor-not-allowed font-bold font-headline flex items-center justify-center gap-2">
                          <Lock className="w-4 h-4" />
                          <span>Cast Vote (Waiting for Organizer)</span>
                        </button>
                      ) : null}
                    </div>
                    <div className="bg-surface-container-low rounded-2xl p-5">
                      <h3 className="font-bold font-headline text-primary mb-4 flex items-center gap-2 text-sm">
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                        Live Results
                      </h3>
                      {poll.show_results_publicly ? (
                        <VoteBars pollId={poll.id} options={options} refreshTrigger={refreshTrigger} />
                      ) : (
                        <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
                          <Lock className="w-6 h-6 text-on-surface-variant/30" />
                          <p className="text-on-surface-variant text-xs font-body">Results visible once the organizer makes them public.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── Analytics Bento ── */}
                <AnalyticsBento pollId={poll.id} options={options} refreshTrigger={refreshTrigger} votingEnabled={settings.voting_enabled} />

                {pollIdx === polls.length - 1 && lastPassed && <LastPassedBanner poll={lastPassed} />}
              </div>
            );
          })}

          {(!settings.voting_enabled || polls.length === 0) && lastPassed && <LastPassedBanner poll={lastPassed} />}
        </section>

        {/* ── 4-col sidebar ── */}
        <aside className="lg:col-span-4 space-y-6">
          <div className="bg-surface-container-low rounded-3xl p-6 border border-outline-variant/15">
            <h3 className="font-bold font-headline text-xl text-primary mb-6">Legislative Archive</h3>
            {archivedPolls.length === 0 ? (
              <p className="text-on-surface-variant text-sm font-body text-center py-8">No archived resolutions yet.</p>
            ) : (
              <div className="space-y-4">
                {archivedPolls.map((archived) => (
                  <div key={archived.id} className="bg-surface-container-lowest p-4 rounded-2xl hover:shadow-md transition-shadow cursor-pointer group">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">{formatDate(archived.created_at)}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-tertiary-fixed text-on-tertiary-fixed">CONCLUDED</span>
                    </div>
                    <h4 className="font-bold font-headline text-on-surface mb-1 group-hover:text-primary transition-colors text-sm">{archived.title}</h4>
                    {archived.description && <p className="text-xs text-on-surface-variant line-clamp-2 font-body">{archived.description}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>

      </div>
    </div>
  );
};

/* ── Last Passed Banner ── */
const LastPassedBanner = ({ poll }: { poll: Poll }) => (
  <div className="bg-primary-container rounded-3xl p-8 shadow-xl flex flex-col md:flex-row items-center gap-8 relative overflow-hidden">
    <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full -mr-24 -mt-24 pointer-events-none" />
    <div className="w-20 h-20 bg-tertiary-fixed rounded-full flex items-center justify-center shrink-0 shadow-lg">
      <CheckCircle className="w-9 h-9 text-on-tertiary-fixed" strokeWidth={2} />
    </div>
    <div className="flex-1 text-center md:text-left">
      <span className="inline-block px-3 py-1 rounded-full bg-white/20 text-[10px] font-black tracking-widest mb-2 text-white uppercase font-headline">Last Outcome</span>
      <h3 className="text-xl font-bold font-headline text-white mb-1">{poll.title}</h3>
      <p className="text-white/80 text-sm font-body">This resolution has concluded and is no longer active in the chamber.</p>
    </div>
  </div>
);

/* ── Vote Progress Bars ── */
const VoteBars = ({ pollId, options, refreshTrigger }: { pollId: string; options: any[]; refreshTrigger: number }) => {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);

  const fetchCounts = async () => {
    const { data } = await supabase.from('poll_votes').select('option_id').eq('poll_id', pollId);
    const map: Record<string, number> = {};
    options.forEach((o: any) => { map[getKey(o)] = 0; });
    (data || []).forEach((v: any) => { if (map[v.option_id] !== undefined) map[v.option_id]++; });
    setCounts(map);
    setTotal(Object.values(map).reduce((s, n) => s + n, 0));
  };

  useEffect(() => { fetchCounts(); }, [pollId, refreshTrigger]);
  useEffect(() => {
    const ch = supabase.channel(`vbars_${pollId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'poll_votes', filter: `poll_id=eq.${pollId}` }, fetchCounts)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [pollId]);

  const barColors = ['bg-primary-container', 'bg-secondary-container', 'bg-outline-variant', 'bg-tertiary'];
  const labelColors = ['text-primary-container', 'text-secondary-container', 'text-on-surface-variant', 'text-on-surface-variant'];
  return (
    <div className="space-y-4">
      {options.map((opt: any, idx: number) => {
        const key = getKey(opt); const count = counts[key] || 0; const pct = total > 0 ? (count / total) * 100 : 0;
        return (
          <div key={key}>
            <div className="flex justify-between text-xs font-bold mb-1 font-headline">
              <span className={labelColors[idx % labelColors.length]}>{getText(opt).toUpperCase()}</span>
              <span className="text-on-surface font-body">{pct.toFixed(0)}%</span>
            </div>
            <div className="w-full h-2 bg-surface-container-high rounded-full overflow-hidden">
              <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} className={`h-full rounded-full ${barColors[idx % barColors.length]}`} />
            </div>
          </div>
        );
      })}
      {total === 0 && <p className="text-on-surface-variant text-xs text-center py-2 font-body">No votes yet.</p>}
    </div>
  );
};

/* ── Analytics Bento ── */
const AnalyticsBento = ({
  pollId, options, refreshTrigger, votingEnabled,
}: {
  pollId: string; options: any[]; refreshTrigger: number; votingEnabled: boolean;
}) => {
  const [totalDelegates, setTotalDelegates] = useState(0);
  const [votedCount, setVotedCount] = useState(0);
  const [optionCounts, setOptionCounts] = useState<Record<string, number>>({});
  const [momentumBuckets, setMomentumBuckets] = useState<number[]>(new Array(15).fill(0));
  const [votesPerMin, setVotesPerMin] = useState(0);

  const fetchAnalytics = async () => {
    const [{ count: total }, { data: votes }] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('poll_votes').select('option_id, created_at, voter_id').eq('poll_id', pollId),
    ]);
    const allVotes = (votes || []) as any[];
    setTotalDelegates(total || 0);
    setVotedCount(new Set(allVotes.map(v => v.voter_id)).size);

    const counts: Record<string, number> = {};
    options.forEach(o => { counts[getKey(o)] = 0; });
    allVotes.forEach(v => { if (counts[v.option_id] !== undefined) counts[v.option_id]++; });
    setOptionCounts(counts);

    const now = Date.now();
    const buckets = new Array(15).fill(0);
    allVotes.forEach(v => {
      const minsAgo = Math.floor((now - new Date(v.created_at).getTime()) / 60000);
      if (minsAgo >= 0 && minsAgo < 15) buckets[14 - minsAgo]++;
    });
    setMomentumBuckets(buckets);
    setVotesPerMin(buckets[14]);
  };

  useEffect(() => { fetchAnalytics(); }, [pollId, refreshTrigger]);
  useEffect(() => {
    const ch = supabase.channel(`analytics_${pollId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'poll_votes', filter: `poll_id=eq.${pollId}` }, fetchAnalytics)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [pollId]);

  const isBinary = options.length === 2;
  const totalVotes = Object.values(optionCounts).reduce((s, n) => s + n, 0);
  const keys = options.map(getKey);
  const yesCount = optionCounts[keys[0]] || 0;
  const noCount = optionCounts[keys[1]] || 0;
  const yesPct = totalVotes > 0 ? Math.round((yesCount / totalVotes) * 100) : 0;
  const noPct = totalVotes > 0 ? (100 - yesPct) : 0;
  const turnoutPct = totalDelegates > 0 ? (votedCount / totalDelegates) * 100 : 0;
  const hasActivity = momentumBuckets.some(v => v > 0);

  const sparkline = (() => {
    const max = Math.max(...momentumBuckets, 1);
    const pts = momentumBuckets.map((val, i) => ({
      x: Math.round((i / (momentumBuckets.length - 1)) * 1000),
      y: Math.round(90 - (val / max) * 75),
    }));
    const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
    const lastY = pts[pts.length - 1]?.y ?? 90;
    return { path, lastY };
  })();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

      {/* House Turnout */}
      <div className="bg-surface-container-lowest p-8 rounded-3xl shadow-sm border border-outline-variant/10 flex flex-col justify-between">
        <div>
          <div className="flex justify-between items-start mb-6">
            <h3 className="font-headline font-bold text-lg text-on-surface">House Turnout</h3>
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-4xl font-black text-on-surface font-headline">{votedCount}</span>
            <span className="text-lg text-on-surface-variant font-semibold font-body">/ {totalDelegates} Delegates</span>
          </div>
          <div className="w-full h-3 bg-surface-container-high rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${turnoutPct}%` }}
              transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
        </div>
        <p className="mt-4 text-sm font-semibold text-on-tertiary-container flex items-center gap-1.5 font-body">
          <span className="w-2 h-2 rounded-full bg-on-tertiary-container animate-pulse inline-block" />
          {turnoutPct >= 50 ? `Quorum Met (${turnoutPct.toFixed(1)}%)` : `Turnout: ${turnoutPct.toFixed(1)}%`}
        </p>
      </div>

      {/* Live Alignment */}
      <div className="bg-surface-container-lowest p-8 rounded-3xl shadow-sm border border-outline-variant/10">
        <div className="flex justify-between items-start mb-6">
          <h3 className="font-headline font-bold text-lg text-on-surface">Live Alignment</h3>
          <BarChart3 className="w-5 h-5 text-primary" />
        </div>
        {totalVotes === 0 ? (
          <p className="text-on-surface-variant text-sm font-body py-4">No votes cast yet.</p>
        ) : isBinary ? (
          <>
            <div className="flex h-10 rounded-xl overflow-hidden mb-4 gap-0.5">
              {yesPct > 0 && (
                <motion.div
                  className="bg-primary h-full flex items-center justify-center text-white text-xs font-black font-headline"
                  initial={{ width: 0 }} animate={{ width: `${yesPct}%` }}
                  transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                >
                  {yesPct > 15 ? `${yesPct}% YES` : ''}
                </motion.div>
              )}
              {noPct > 0 && (
                <motion.div
                  className="bg-secondary-container h-full flex items-center justify-center text-white text-xs font-black font-headline"
                  initial={{ width: 0 }} animate={{ width: `${noPct}%` }}
                  transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                >
                  {noPct > 15 ? `${noPct}% NO` : ''}
                </motion.div>
              )}
            </div>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-primary rounded-full" />
                <span className="text-xs font-bold text-on-surface-variant font-body">{yesCount} Affirmative</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-secondary-container rounded-full" />
                <span className="text-xs font-bold text-on-surface-variant font-body">{noCount} Dissenting</span>
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-3">
            {options.map((opt, idx) => {
              const k = getKey(opt);
              const count = optionCounts[k] || 0;
              const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
              const colors = ['bg-primary', 'bg-secondary-container', 'bg-tertiary', 'bg-outline-variant'];
              return (
                <div key={k}>
                  <div className="flex justify-between text-xs font-bold mb-1 font-headline">
                    <span className="text-on-surface-variant">{getText(opt).toUpperCase()}</span>
                    <span className="text-on-surface">{pct}%</span>
                  </div>
                  <div className="w-full h-2.5 bg-surface-container-high rounded-full overflow-hidden">
                    <motion.div className={`h-full rounded-full ${colors[idx % colors.length]}`} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8 }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Voting Momentum */}
      <div className="bg-surface-container-lowest p-8 rounded-3xl shadow-sm border border-outline-variant/10 md:col-span-2">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="font-headline font-bold text-lg text-on-surface">Voting Momentum</h3>
            <p className="text-sm text-on-surface-variant font-medium font-body">Activity over the last 15 minutes</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black text-primary font-headline">+{votesPerMin}</p>
            <p className="text-[10px] uppercase font-bold text-on-tertiary-container font-headline">Votes / Min</p>
          </div>
        </div>
        <div className="w-full h-28">
          {hasActivity ? (
            <svg className="w-full h-full" viewBox="0 0 1000 100" preserveAspectRatio="none">
              <defs>
                <linearGradient id={`spark-${pollId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(229,76%,32%)" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="hsl(229,76%,32%)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={`${sparkline.path} L1000,100 L0,100 Z`} fill={`url(#spark-${pollId})`} />
              <path d={sparkline.path} fill="none" stroke="hsl(229,76%,32%)" strokeOpacity="0.3" strokeWidth="2" />
              <path d={sparkline.path} fill="none" stroke="hsl(229,76%,32%)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="1000" cy={sparkline.lastY} r="5" fill="hsl(229,76%,32%)" />
            </svg>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-on-surface-variant text-sm font-body">No activity in the last 15 minutes.</p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

export default PollVoting;
