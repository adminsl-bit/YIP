import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { toast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import jsPDF from "jspdf";

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

export const getKey = (opt: any): string => typeof opt === 'string' ? opt : (opt?.id ?? String(opt));
export const getText = (opt: any): string => typeof opt === 'string' ? opt : (opt?.text ?? String(opt));

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
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
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
          <span className="material-symbols-outlined text-[12px]">account_balance</span>
          Active Legislative Floor
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

        {/* ── 8-col section ── */}
        <section className="lg:col-span-8 space-y-8">

          {!settings.voting_enabled && (
            <div className="bg-surface-container-lowest rounded-3xl p-12 text-center shadow-[0_8px_32px_0_rgba(46,65,172,0.04)]">
              <span className="material-symbols-outlined text-[40px] text-on-surface-variant/30 block mx-auto mb-4">how_to_vote</span>
              <p className="text-on-surface-variant font-medium font-body">Voting is currently disabled by the organizer.</p>
            </div>
          )}

          {settings.voting_enabled && polls.length === 0 && (
            <div className="bg-surface-container-lowest rounded-3xl p-16 text-center shadow-[0_8px_32px_0_rgba(46,65,172,0.04)]">
              <span className="material-symbols-outlined text-[40px] text-on-surface-variant/30 block mx-auto mb-4">how_to_vote</span>
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
                            <span className="material-symbols-outlined text-[16px] text-primary">person</span>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider font-headline">Proposed By</p>
                            <p className="text-sm font-bold text-on-surface font-body">{poll.proposed_by || '—'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 border-l border-outline-variant/30 pl-6">
                          <div className="w-8 h-8 rounded-full bg-secondary-fixed flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined text-[16px] text-secondary">domain</span>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider font-headline">Committee</p>
                            <p className="text-sm font-bold text-on-surface font-body">{poll.committee || '—'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 border-l border-outline-variant/30 pl-6">
                          <div className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined text-[16px] text-on-surface-variant" style={{ fontVariationSettings: "'FILL' 1" }}>verified_user</span>
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
                    <div className="flex items-center gap-4 p-5 rounded-2xl bg-tertiary-fixed/20 border border-tertiary-fixed-dim/30 mb-8">
                      <div className="w-10 h-10 bg-on-tertiary-container rounded-full flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[20px] text-white" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                      </div>
                      <div>
                        <p className="text-tertiary-container font-bold font-headline">Vote Cast Successfully</p>
                        <p className="text-on-surface-variant text-xs font-body mt-0.5">Your choice: <span className="font-bold">{votedChoice}</span></p>
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
                            className={`flex-1 group/btn flex flex-col items-center justify-center p-5 rounded-2xl border-2 transition-all ${
                              selectedOptions[poll.id] === getKey(options[0])
                                ? 'border-[#42d59a] bg-[#42d59a]/10 shadow-[0_0_0_4px_rgba(66,213,154,0.08)]'
                                : 'bg-surface-container border-outline-variant hover:border-[#42d59a]/60 hover:bg-[#42d59a]/5'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                          >
                            <span className={`material-symbols-outlined text-[32px] mb-1.5 transition-transform group-hover/btn:scale-110 ${selectedOptions[poll.id] === getKey(options[0]) ? 'scale-110 text-[#2bb87c]' : 'text-on-surface-variant'}`} style={{ fontVariationSettings: selectedOptions[poll.id] === getKey(options[0]) ? "'FILL' 1" : "'FILL' 0" }}>thumb_up</span>
                            <span className={`font-bold font-headline text-sm ${selectedOptions[poll.id] === getKey(options[0]) ? 'text-[#2bb87c]' : 'text-on-surface'}`}>{getText(options[0])}</span>
                          </button>
                          <button
                            disabled={hasVoted}
                            onClick={() => setSelectedOptions(prev => ({ ...prev, [poll.id]: getKey(options[1]) }))}
                            className={`flex-1 group/btn flex flex-col items-center justify-center p-5 rounded-2xl border-2 transition-all ${
                              selectedOptions[poll.id] === getKey(options[1])
                                ? 'border-error bg-error/10 shadow-[0_0_0_4px_rgba(186,26,26,0.07)]'
                                : 'bg-surface-container border-outline-variant hover:border-error/50 hover:bg-error/5'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                          >
                            <span className={`material-symbols-outlined text-[32px] mb-1.5 transition-transform group-hover/btn:scale-110 ${selectedOptions[poll.id] === getKey(options[1]) ? 'scale-110 text-error' : 'text-on-surface-variant'}`} style={{ fontVariationSettings: selectedOptions[poll.id] === getKey(options[1]) ? "'FILL' 1" : "'FILL' 0" }}>thumb_down</span>
                            <span className={`font-bold font-headline text-sm ${selectedOptions[poll.id] === getKey(options[1]) ? 'text-error' : 'text-on-surface'}`}>{getText(options[1])}</span>
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
                                    ? 'border-primary bg-primary/10 text-primary shadow-[0_0_0_3px_rgba(19,41,143,0.08)]'
                                    : 'bg-surface-container border-outline-variant hover:border-primary/40 hover:bg-primary/5 text-on-surface'
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
                          className="w-full py-4 rounded-2xl bg-gradient-to-br from-[#0f1f7a] via-primary to-[#2e4fd6] text-white font-bold font-headline shadow-[0_6px_24px_rgba(19,41,143,0.40)] hover:shadow-[0_8px_28px_rgba(19,41,143,0.50)] hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-70 flex items-center justify-center gap-2"
                        >
                          {submitting === poll.id
                            ? <><span className="material-symbols-outlined text-[16px] animate-spin">refresh</span><span>Casting Vote...</span></>
                            : <><span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>how_to_vote</span><span>Cast Vote</span></>}
                        </button>
                      ) : !hasVoted ? (
                        <button disabled className="w-full py-4 rounded-2xl bg-outline-variant/30 text-on-surface-variant cursor-not-allowed font-bold font-headline flex items-center justify-center gap-2">
                          <span className="material-symbols-outlined text-[16px]">lock</span>
                          <span>Cast Vote (Waiting for Organizer)</span>
                        </button>
                      ) : null}
                    </div>
                    <div className="bg-surface-container-low rounded-2xl p-5">
                      <h3 className="font-bold font-headline text-primary mb-4 flex items-center gap-2 text-sm">
                        <div className="w-1.5 h-1.5 bg-on-tertiary-container rounded-full animate-pulse" />
                        Live Results
                      </h3>
                      {poll.show_results_publicly ? (
                        <VoteBars pollId={poll.id} options={options} refreshTrigger={refreshTrigger} />
                      ) : (
                        <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
                          <span className="material-symbols-outlined text-[24px] text-on-surface-variant/30">lock</span>
                          <p className="text-on-surface-variant text-xs font-body">Results visible once the organizer makes them public.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── Analytics Bento ── */}
                <AnalyticsBento pollId={poll.id} options={options} refreshTrigger={refreshTrigger} votingEnabled={settings.voting_enabled} pollTitle={poll.title} />

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
      <span className="material-symbols-outlined text-[36px] text-on-tertiary-fixed" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
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

/* ── Analytics Bento ── compact single-row bar */
export const AnalyticsBento = ({
  pollId, options, refreshTrigger, votingEnabled,
  pollTitle, pollHeading, outcome,
  expanded: controlledExpanded, onToggleExpand,
  onResetVotes, onDeletePoll,
}: {
  pollId: string; options: any[]; refreshTrigger: number; votingEnabled: boolean;
  pollTitle?: string; pollHeading?: string; outcome?: 'passed' | 'failed' | null;
  expanded?: boolean; onToggleExpand?: () => void;
  onResetVotes?: () => void; onDeletePoll?: () => void;
}) => {
  const [totalDelegates, setTotalDelegates] = useState(0);
  const [votedCount, setVotedCount] = useState(0);
  const [optionCounts, setOptionCounts] = useState<Record<string, number>>({});
  const [recentVoters, setRecentVoters] = useState<any[]>([]);
  const [internalExpanded, setInternalExpanded] = useState(false);
  const [isDownloading, setIsDownloading] = useState<'csv' | 'pdf' | null>(null);
  const isExpanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded;
  const handleToggle = onToggleExpand ?? (() => setInternalExpanded(e => !e));

  const resolvePollMeta = async (pid: string): Promise<{ eventId: string | null; createdAt: string | null }> => {
    const { data: pollRow } = await supabase
      .from('polls').select('event_id, created_at').eq('id', pid).single();
    return { eventId: pollRow?.event_id ?? null, createdAt: pollRow?.created_at ?? null };
  };

  const fetchDetailedVotes = async () => {
    const { eventId, createdAt } = await resolvePollMeta(pollId);

    let profilesQuery = supabase
      .from('profiles').select('user_id, name, position, party_number, constituency, state')
      .eq('user_type', 'student').eq('is_active', true);
    if (eventId) profilesQuery = profilesQuery.eq('event_id', eventId);
    if (createdAt) profilesQuery = profilesQuery.lte('created_at', createdAt);

    const [{ data: votes }, { data: profiles }] = await Promise.all([
      supabase.from('poll_votes').select('voter_id, option_id').eq('poll_id', pollId),
      profilesQuery,
    ]);
    // Only MPs are eligible — exclude journalists and administrators
    const mpProfiles = (profiles || []).filter((p: any) => {
      const pos = (p.position ?? '').toLowerCase();
      return !pos.includes('journalist') && !pos.includes('administrator') && !pos.includes('admin');
    });
    const profileMap = new Map(mpProfiles.map((p: any) => [p.user_id, p]));
    return { votes: (votes || []) as any[], profileMap, profiles: mpProfiles };
  };

  const partyStr = (num: number | null | undefined) => {
    if (num == null) return '';
    return `P${(['NONE','A','B','C','D','E'] as string[])[num] ?? num}`;
  };

  const handleDownloadCSV = async () => {
    setIsDownloading('csv');
    try {
      const { votes, profileMap, profiles } = await fetchDetailedVotes();
      const voterSet = new Set(votes.map((v: any) => v.voter_id));
      const rows: string[][] = [['Option', 'Delegate Name', 'Position', 'Party', 'State', 'Constituency']];
      options.forEach(opt => {
        const key = getKey(opt); const text = getText(opt);
        votes.filter((v: any) => v.option_id === key).forEach((v: any) => {
          const p = profileMap.get(v.voter_id);
          if (p) rows.push([text, p.name, p.position || '', partyStr(p.party_number), p.state || '', p.constituency || '']);
        });
      });
      profiles.filter((p: any) => !voterSet.has(p.user_id)).forEach((p: any) => {
        rows.push(['Did Not Vote', p.name, p.position || '', partyStr(p.party_number), p.state || '', p.constituency || '']);
      });
      const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
      const a = Object.assign(document.createElement('a'), { href: url, download: `poll-${(pollTitle || 'results').replace(/[^a-zA-Z0-9]/g, '-')}.csv` });
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: 'CSV downloaded' });
    } catch { toast({ title: 'Export failed', variant: 'destructive' }); }
    finally { setIsDownloading(null); }
  };

  const handleDownloadPDF = async () => {
    setIsDownloading('pdf');
    try {
      const { votes, profileMap, profiles } = await fetchDetailedVotes();
      const voterSet = new Set(votes.map((v: any) => v.voter_id));
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const W = 210, M = 18;
      let y = 0;

      // ── Primary blue header bar ──
      pdf.setFillColor(19, 41, 143);
      pdf.rect(0, 0, W, 20, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      pdf.setTextColor(255, 255, 255);
      pdf.text('NATIONAL YOUTH PARLIAMENT', M, 8);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7.5);
      pdf.text('POLL RESULTS — OFFICIAL LEGISLATIVE RECORD', M, 14);
      pdf.setFontSize(7);
      pdf.text(new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).toUpperCase(), W - M, 11, { align: 'right' });
      y = 30;

      // ── Poll title ──
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(18);
      pdf.setTextColor(19, 41, 143);
      const titleLines = pdf.splitTextToSize(pollTitle || 'Poll Results', W - 2 * M);
      pdf.text(titleLines, M, y);
      y += titleLines.length * 9 + 2;

      if (pollHeading) {
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        pdf.setTextColor(69, 70, 83);
        pdf.text(pollHeading, M, y);
        y += 7;
      }

      // Accent line
      pdf.setDrawColor(19, 41, 143);
      pdf.setLineWidth(0.5);
      pdf.line(M, y, W - M, y);
      y += 8;

      // ── Summary stats row ──
      pdf.setFillColor(242, 244, 246);
      pdf.roundedRect(M, y, W - 2 * M, 24, 2, 2, 'F');
      const statsData = [
        { label: 'TOTAL DELEGATES', value: String(totalDelegates) },
        { label: 'VOTES CAST', value: String(votedCount) },
        { label: 'TURNOUT', value: `${(totalDelegates > 0 ? (votedCount / totalDelegates * 100) : 0).toFixed(1)}%` },
        { label: 'STATUS', value: votingEnabled ? 'LIVE' : 'CLOSED' },
      ];
      const colW = (W - 2 * M) / 4;
      statsData.forEach((s, i) => {
        const cx = M + i * colW + colW / 2;
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(13);
        pdf.setTextColor(19, 41, 143);
        pdf.text(s.value, cx, y + 10, { align: 'center' });
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(6);
        pdf.setTextColor(100, 100, 120);
        pdf.text(s.label, cx, y + 18, { align: 'center' });
        if (i < 3) {
          pdf.setDrawColor(197, 197, 213);
          pdf.setLineWidth(0.2);
          pdf.line(M + (i + 1) * colW, y + 4, M + (i + 1) * colW, y + 20);
        }
      });
      y += 32;

      // ── Results breakdown header ──
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7.5);
      pdf.setTextColor(100, 100, 120);
      pdf.text('RESULTS BREAKDOWN', M, y);
      y += 6;

      // ── Per-option bars + delegate lists ──
      options.forEach((opt) => {
        if (y > 250) { pdf.addPage(); y = 20; }
        const key = getKey(opt); const text = getText(opt);
        const count = optionCounts[key] || 0;
        const pct = totalDelegates > 0 ? count / totalDelegates * 100 : 0;
        const optVotes = votes.filter((v: any) => v.option_id === key);
        const t = text.toLowerCase();
        const [r, g, b] = t === 'yes' || t === 'aye' ? [0, 88, 59] : t === 'no' || t === 'nay' ? [172, 53, 9] : [19, 41, 143];

        // Option accent swatch
        pdf.setFillColor(r, g, b);
        pdf.roundedRect(M, y, 3, 6, 0.5, 0.5, 'F');

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10);
        pdf.setTextColor(r, g, b);
        pdf.text(text.toUpperCase(), M + 6, y + 5);

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.setTextColor(50, 50, 70);
        pdf.text(`${count} vote${count !== 1 ? 's' : ''}`, M + 45, y + 5);

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(11);
        pdf.setTextColor(r, g, b);
        pdf.text(`${pct.toFixed(1)}%`, W - M, y + 5, { align: 'right' });

        y += 9;

        // Progress bar track + fill
        const barW = W - 2 * M;
        pdf.setFillColor(228, 230, 234);
        pdf.roundedRect(M, y, barW, 5, 1.5, 1.5, 'F');
        if (pct > 0) {
          pdf.setFillColor(r, g, b);
          pdf.roundedRect(M, y, Math.max(barW * pct / 100, 3), 5, 1.5, 1.5, 'F');
        }
        y += 10;

        // Delegate list
        if (optVotes.length > 0) {
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(6.5);
          pdf.setTextColor(r, g, b);
          pdf.text(`DELEGATES (${optVotes.length})`, M, y);
          y += 5;

          const delegates = optVotes.map((v: any) => {
            const p = profileMap.get(v.voter_id);
            return p ? `${p.name}${p.position ? ` · ${p.position}` : ''}${partyStr(p.party_number) ? ` · ${partyStr(p.party_number)}` : ''}` : null;
          }).filter(Boolean) as string[];

          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(7);
          pdf.setTextColor(60, 60, 80);
          const perRow = 2;
          for (let i = 0; i < delegates.length; i += perRow) {
            if (y > 270) { pdf.addPage(); y = 20; }
            const pair = delegates.slice(i, i + perRow);
            pair.forEach((name, j) => {
              pdf.text(`• ${name}`, M + j * ((W - 2 * M) / 2), y);
            });
            y += 5;
          }
          y += 4;
        }
        y += 2;
      });

      // ── Did Not Vote section ──
      const dnvDelegates = profiles.filter((p: any) => !voterSet.has(p.user_id));
      if (dnvDelegates.length > 0) {
        if (y > 245) { pdf.addPage(); y = 20; }
        const dnvPct = totalDelegates > 0 ? dnvDelegates.length / totalDelegates * 100 : 0;

        pdf.setFillColor(197, 197, 213);
        pdf.roundedRect(M, y, 3, 6, 0.5, 0.5, 'F');
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10);
        pdf.setTextColor(100, 100, 120);
        pdf.text('DID NOT VOTE', M + 6, y + 5);
        pdf.text(`${dnvDelegates.length}`, M + 55, y + 5);
        pdf.setTextColor(100, 100, 120);
        pdf.text(`${dnvPct.toFixed(1)}%`, W - M, y + 5, { align: 'right' });
        y += 9;

        const barW = W - 2 * M;
        pdf.setFillColor(228, 230, 234);
        pdf.roundedRect(M, y, barW, 5, 1.5, 1.5, 'F');
        if (dnvPct > 0) {
          pdf.setFillColor(160, 160, 175);
          pdf.roundedRect(M, y, barW * dnvPct / 100, 5, 1.5, 1.5, 'F');
        }
        y += 10;

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(6.5);
        pdf.setTextColor(100, 100, 120);
        pdf.text(`ABSENT DELEGATES (${dnvDelegates.length})`, M, y);
        y += 5;
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7);
        pdf.setTextColor(100, 100, 120);
        const perRow = 2;
        for (let i = 0; i < dnvDelegates.length; i += perRow) {
          if (y > 270) { pdf.addPage(); y = 20; }
          dnvDelegates.slice(i, i + perRow).forEach((p: any, j: number) => {
            pdf.text(`• ${p.name}${p.position ? ` · ${p.position}` : ''}`, M + j * ((W - 2 * M) / 2), y);
          });
          y += 5;
        }
      }

      // ── Footer on every page ──
      const pageCount = (pdf as any).getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        pdf.setFillColor(19, 41, 143);
        pdf.rect(0, 287, W, 10, 'F');
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(6.5);
        pdf.setTextColor(255, 255, 255);
        pdf.text('YIP PARLIAMENT HUB · LEGISLATIVE ANALYTICS RECORD', M, 293);
        pdf.text(`Page ${i} of ${pageCount}`, W - M, 293, { align: 'right' });
      }

      pdf.save(`poll-${(pollTitle || 'results').replace(/[^a-zA-Z0-9]/g, '-')}.pdf`);
      toast({ title: 'PDF downloaded' });
    } catch (e) { console.error(e); toast({ title: 'Export failed', variant: 'destructive' }); }
    finally { setIsDownloading(null); }
  };

  const fetchAnalytics = async () => {
    const { eventId, createdAt } = await resolvePollMeta(pollId);

    let delegatesQuery = supabase.from('profiles').select('user_id', { count: 'exact', head: true })
      .eq('user_type', 'student').eq('is_active', true)
      .not('position', 'ilike', '%journalist%')
      .not('position', 'ilike', '%administrator%')
      .not('position', 'ilike', '%admin student%');
    if (eventId) delegatesQuery = delegatesQuery.eq('event_id', eventId);
    if (createdAt) delegatesQuery = delegatesQuery.lte('created_at', createdAt);

    const [{ count: total }, { data: votes }] = await Promise.all([
      delegatesQuery,
      supabase.from('poll_votes').select('option_id, voter_id').eq('poll_id', pollId).order('created_at', { ascending: false }),
    ]);
    const allVotes = (votes || []) as any[];
    const delegates = total || 0;
    setTotalDelegates(delegates);
    setVotedCount(new Set(allVotes.map((v: any) => v.voter_id)).size);

    const counts: Record<string, number> = {};
    options.forEach(o => { counts[getKey(o)] = 0; });
    allVotes.forEach((v: any) => { if (counts[v.option_id] !== undefined) counts[v.option_id]++; });
    setOptionCounts(counts);

    // Fetch profiles for the 6 most recent unique voters
    const recentIds = [...new Set(allVotes.map((v: any) => v.voter_id))].slice(0, 6) as string[];
    if (recentIds.length > 0) {
      const { data: profileData } = await supabase
        .from('profiles').select('user_id, name, photo_url').in('user_id', recentIds);
      // Preserve recency order
      const profileMap = new Map((profileData || []).map((p: any) => [p.user_id, p]));
      setRecentVoters(recentIds.map(id => profileMap.get(id)).filter(Boolean));
    } else {
      setRecentVoters([]);
    }
  };

  useEffect(() => { fetchAnalytics(); }, [pollId, refreshTrigger]);
  useEffect(() => {
    const ch = supabase.channel(`analytics_${pollId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'poll_votes', filter: `poll_id=eq.${pollId}` } as any, fetchAnalytics)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [pollId]);

  const turnoutPct = totalDelegates > 0 ? (votedCount / totalDelegates) * 100 : 0;
  const abstainCount = Math.max(0, totalDelegates - votedCount);
  const abstainPct = totalDelegates > 0 ? (abstainCount / totalDelegates * 100) : 0;

  const OPTION_STYLES = [
    { icon: 'check_circle',  bg: 'bg-tertiary-fixed/30',      text: 'text-on-tertiary-container' },
    { icon: 'cancel',        bg: 'bg-error-container/30',     text: 'text-error' },
    { icon: 'how_to_vote',   bg: 'bg-primary/10',             text: 'text-primary' },
    { icon: 'pending',       bg: 'bg-surface-container-high', text: 'text-on-surface-variant' },
  ];

  const getStyle = (text: string, idx: number) => {
    const t = text.toLowerCase();
    if (t === 'yes' || t === 'aye') return OPTION_STYLES[0];
    if (t === 'no'  || t === 'nay') return OPTION_STYLES[1];
    return OPTION_STYLES[2 + (idx % 2)];
  };

  const AVATAR_COLORS = [
    'bg-primary-fixed text-on-primary-fixed',
    'bg-secondary-fixed text-on-secondary-fixed',
    'bg-tertiary-fixed text-on-tertiary-fixed',
    'bg-surface-variant text-on-surface-variant',
    'bg-primary-container text-on-primary-container',
  ];

  return (
    <div className="bg-surface-container-lowest border border-outline-variant/10 rounded-2xl shadow-sm overflow-hidden">

      {/* ── Main row ── */}
      <div className="p-4 flex flex-col md:flex-row items-center gap-6">

        {/* ── Left: branded header ── */}
        <div className="flex flex-col border-r border-outline-variant/20 pr-6 min-w-fit shrink-0">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 bg-primary rounded flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-white" style={{ fontSize: '14px', fontVariationSettings: "'FILL' 1" }}>account_balance</span>
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-primary/70 font-headline">National Youth Parliament</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-base font-extrabold text-on-surface font-headline max-w-[160px] truncate" title={pollTitle || pollHeading}>
              {pollTitle || pollHeading || 'Poll Analytics'}
            </span>
            <span className="bg-tertiary-fixed text-on-tertiary-fixed text-[10px] px-2 py-0.5 rounded-full font-black font-headline flex items-center gap-1 shrink-0">
              <span className="w-1.5 h-1.5 bg-tertiary-container rounded-full animate-pulse inline-block" />
              {votingEnabled ? 'LIVE' : 'FINAL'} {turnoutPct.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* ── Middle: icon-centric per-option metrics ── */}
        <div className="flex items-center gap-6 flex-grow flex-nowrap">
          {options.map((opt, idx) => {
            const key = getKey(opt);
            const text = getText(opt);
            const count = optionCounts[key] || 0;
            const pct = totalDelegates > 0 ? (count / totalDelegates * 100).toFixed(1) : '0.0';
            const style = getStyle(text, idx);
            return (
              <div key={key} className="flex items-center gap-3 group">
                <div className={`w-10 h-10 rounded-full ${style.bg} flex items-center justify-center ${style.text} group-hover:scale-110 transition-transform shrink-0`}>
                  <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>{style.icon}</span>
                </div>
                <div>
                  <div className="text-xs text-on-surface-variant font-medium font-body">{text}</div>
                  <div className="text-lg font-black leading-none font-headline">{pct}%</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Outcome badge (between options and recent votes) ── */}
        {outcome && (
          <div className={`shrink-0 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest font-headline flex items-center gap-1.5 ${
            outcome === 'passed'
              ? 'bg-tertiary/15 text-tertiary border border-tertiary/20'
              : 'bg-error/10 text-error border border-error/20'
          }`}>
            <span className="material-symbols-outlined" style={{ fontSize: '12px', fontVariationSettings: "'FILL' 1" }}>
              {outcome === 'passed' ? 'check_circle' : 'cancel'}
            </span>
            {outcome}
          </div>
        )}

        {/* ── Right: recent voter avatars + action buttons ── */}
        <div className="flex items-center gap-3 border-l border-outline-variant/20 pl-6 shrink-0">
          <span className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-tighter w-10 leading-tight font-headline">Recent Votes</span>
          <div className="flex -space-x-2">
            {recentVoters.slice(0, 5).map((voter: any, idx: number) => {
              const initials = voter.name?.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() || '?';
              return voter.photo_url ? (
                <img
                  key={voter.user_id}
                  src={voter.photo_url}
                  alt={voter.name}
                  title={voter.name}
                  className="w-8 h-8 rounded-full border-2 border-surface-container-lowest object-cover cursor-help hover:-translate-y-1 transition-transform"
                />
              ) : (
                <div
                  key={voter.user_id}
                  title={voter.name}
                  className={`w-8 h-8 rounded-full border-2 border-surface-container-lowest flex items-center justify-center text-[10px] font-bold cursor-help hover:-translate-y-1 transition-transform ${AVATAR_COLORS[idx % AVATAR_COLORS.length]}`}
                >
                  {initials}
                </div>
              );
            })}
            {votedCount > 5 && (
              <div className="w-8 h-8 rounded-full border-2 border-surface-container-lowest bg-surface-container-high flex items-center justify-center text-[8px] font-bold text-on-surface-variant">
                +{votedCount - 5}
              </div>
            )}
          </div>

          {/* CSV + PDF downloads (organizer) */}
          {(onResetVotes || onDeletePoll) && (
            <>
              <button
                onClick={handleDownloadCSV}
                disabled={!!isDownloading}
                title="Download CSV"
                className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant/60 hover:bg-surface-container hover:text-primary transition-colors disabled:opacity-40"
              >
                {isDownloading === 'csv'
                  ? <span className="material-symbols-outlined animate-spin" style={{ fontSize: '16px' }}>progress_activity</span>
                  : <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>table_view</span>}
              </button>
              <button
                onClick={handleDownloadPDF}
                disabled={!!isDownloading}
                title="Download PDF"
                className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant/60 hover:bg-primary hover:text-white transition-colors disabled:opacity-40"
              >
                {isDownloading === 'pdf'
                  ? <span className="material-symbols-outlined animate-spin" style={{ fontSize: '16px' }}>progress_activity</span>
                  : <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>picture_as_pdf</span>}
              </button>
            </>
          )}

          {/* Reset & Delete (organizer actions) */}
          {onResetVotes && (
            <button
              onClick={onResetVotes}
              title="Reset votes"
              className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant/60 hover:bg-warning/10 hover:text-warning transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>restart_alt</span>
            </button>
          )}
          {onDeletePoll && (
            <button
              onClick={onDeletePoll}
              title="Delete poll"
              className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant/60 hover:bg-error/10 hover:text-error transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>delete</span>
            </button>
          )}

          {/* Expand chevron */}
          <button
            onClick={handleToggle}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-surface-container transition-colors"
          >
            <span
              className="material-symbols-outlined text-primary transition-transform duration-200"
              style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
            >
              chevron_right
            </span>
          </button>
        </div>

      </div>

      {/* ── Accordion: single compact row ── */}
      {isExpanded && (
        <div className="border-t border-outline-variant/10 px-4 py-2 bg-surface-container-low/40 flex items-center gap-3 overflow-hidden">

          {/* Option tiles */}
          {options.map((opt, idx) => {
            const key = getKey(opt);
            const text = getText(opt);
            const count = optionCounts[key] || 0;
            const pct = totalDelegates > 0 ? (count / totalDelegates * 100) : 0;
            const style = getStyle(text, idx);
            const BAR_COLORS = ['bg-tertiary-fixed', 'bg-error-container', 'bg-primary-container', 'bg-secondary-container'];
            return (
              <div key={key} className="flex items-center gap-1.5 shrink-0">
                <span className={`text-[9px] font-black uppercase tracking-wide font-headline ${style.text}`}>{text}</span>
                <div className="w-12 h-1 bg-surface-container-high rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                    className={`h-full rounded-full ${BAR_COLORS[idx % BAR_COLORS.length]}`}
                  />
                </div>
                <span className={`text-[9px] font-black font-headline ${style.text}`}>{pct.toFixed(0)}%</span>
                <span className="text-[8px] text-on-surface-variant/40 font-body">({count})</span>
              </div>
            );
          })}

          <div className="w-px h-3 bg-outline-variant/30 shrink-0" />

          {/* Turnout */}
          <span className="text-[9px] font-bold text-on-surface-variant/50 font-headline whitespace-nowrap shrink-0">
            {votedCount}/{totalDelegates} · {turnoutPct.toFixed(0)}%
          </span>

          {/* Recent voters */}
          {recentVoters.length > 0 && (
            <>
              <div className="w-px h-3 bg-outline-variant/30 shrink-0" />
              <div className="flex items-center gap-1.5 overflow-hidden">
                <div className="flex -space-x-1">
                  {recentVoters.slice(0, 5).map((voter: any, idx: number) => {
                    const initials = voter.name?.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() || '?';
                    return voter.photo_url ? (
                      <img key={voter.user_id} src={voter.photo_url} alt={voter.name} title={voter.name}
                        className="w-4 h-4 rounded-full border border-surface-container-lowest object-cover" />
                    ) : (
                      <div key={voter.user_id} title={voter.name}
                        className={`w-4 h-4 rounded-full border border-surface-container-lowest flex items-center justify-center text-[6px] font-bold shrink-0 ${AVATAR_COLORS[idx % AVATAR_COLORS.length]}`}>
                        {initials}
                      </div>
                    );
                  })}
                </div>
                {recentVoters.slice(0, 3).map((voter: any) => (
                  <span key={voter.user_id} className="text-[9px] text-on-surface-variant/50 font-body whitespace-nowrap hidden sm:inline">
                    {voter.name?.split(' ')[0]}
                  </span>
                ))}
                {votedCount > recentVoters.length && (
                  <span className="text-[8px] font-bold text-on-surface-variant/30 font-headline shrink-0">+{votedCount - recentVoters.length}</span>
                )}
              </div>
            </>
          )}

        </div>
      )}

    </div>
  );
};

export default PollVoting;
