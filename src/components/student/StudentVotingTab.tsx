import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { 
  Loader2,
  User,
  History,
  Lock,
  ArrowRight,
  CheckCircle,
  XCircle,
  ThumbsUp,
  ThumbsDown,
  Activity,
  Archive
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { DetailedPollResults } from "./DetailedPollResults";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Poll {
  id: string;
  title: string;
  heading?: string;
  description?: string;
  options: any[];
  is_active: boolean;
  show_results_publicly: boolean;
  created_at: string;
  ends_at?: string;
  category?: string;
  proposer?: string;
  outcome?: 'passed' | 'failed';
  votes_summary?: {
    counts: Record<string, number>;
    total: number;
  };
}

export const StudentVotingTab = () => {
  const { user, profile } = useAuth();
  const [votingEnabled, setVotingEnabled] = useState<boolean>(false);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [userVotes, setUserVotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [summaryPollId, setSummaryPollId] = useState<string | null>(null);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);

  const fetchData = async () => {
    try {
      const { data: settingsData } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'voting_enabled')
        .single();
      
      const enabled = settingsData?.setting_value === true || settingsData?.setting_value === 'true';
      setVotingEnabled(enabled);

      const { data: pollData, error: pollError } = await supabase
        .from('polls')
        .select('*')
        .eq('event_id', profile?.event_id ?? '')
        .order('created_at', { ascending: false });

      if (pollError) throw pollError;
      
      const pollIds = (pollData || []).map(p => p.id);
      
      const { data: allVotes } = await supabase
        .from('poll_votes')
        .select('poll_id, option_id')
        .in('poll_id', pollIds);

      const processedPolls = (pollData || []).map((p) => {
        const votesForThisPoll = allVotes?.filter(v => v.poll_id === p.id) || [];
        const optionCounts: Record<string, number> = {};
        
        const optionsArray = Array.isArray(p.options) ? p.options : [];
        optionsArray.forEach((opt: string) => {
          optionCounts[opt] = 0;
        });

        votesForThisPoll.forEach(v => {
          if (optionCounts[v.option_id] !== undefined) {
            optionCounts[v.option_id]++;
          }
        });

        return {
          ...p,
          votes_summary: {
            counts: optionCounts,
            total: votesForThisPoll.length
          }
        };
      }) as Poll[];
      
      setPolls(processedPolls);

      if (user && pollIds.length > 0) {
        const { data: voteData } = await supabase
          .from('poll_votes')
          .select('poll_id, option_id')
          .eq('voter_id', user.id)
          .in('poll_id', pollIds);
        
        const voteMap: Record<string, string> = {};
        voteData?.forEach(v => {
          voteMap[v.poll_id] = v.option_id;
        });
        setUserVotes(voteMap);
      }
    } catch (err) {
      console.error('Error fetching voting data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const syncChannel = supabase
      .channel('voting_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'system_settings' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'polls' }, () => fetchData())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'poll_votes' }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(syncChannel);
    };
  }, [user]);

  const handleCastVote = async (pollId: string, optionId: string) => {
    if (!user || !votingEnabled || !optionId) return;

    setSubmittingId(pollId);
    try {
      const { error } = await supabase
        .from('poll_votes')
        .insert({
          poll_id: pollId,
          voter_id: user.id,
          option_id: optionId
        });

      if (error) {
        if (error.code === '23505') {
          toast.error("Constitutional Protocol: You have already cast your vote for this resolution.");
        } else {
          throw error;
        }
      } else {
        toast.success("Political Will Recorded: Your vote has been securely synchronized with the assembly.");
        setUserVotes(prev => ({ ...prev, [pollId]: optionId }));
        fetchData();
      }
    } catch (err) {
      console.error('Error casting vote:', err);
      toast.error("Parliamentary Error: Failed to record your vote.");
    } finally {
      setSubmittingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="relative w-20 h-20"
        >
          <div className="absolute inset-0 rounded-full border-t-4 border-primary shadow-[0_0_15px_rgba(19,41,143,0.3)]"></div>
          <div className="absolute inset-2 rounded-full border-t-4 border-secondary/40"></div>
        </motion.div>
        <div className="text-center">
          <p className="font-display font-black text-label-sm uppercase tracking-[0.3em] text-primary mb-3">Sovereign Synchronization</p>
          <p className="font-body text-body-sm text-on-surface-variant/40 italic">Calibrating assembly ballot servers...</p>
        </div>
      </div>
    );
  }

  const activePoll = polls.find(p => p.is_active);
  const inactivePolls = polls.filter(p => !p.is_active);
  const lastConcludedResolution = inactivePolls.length > 0 ? inactivePolls[0] : null;

  return (
    <div className="flex flex-col w-full pb-32 max-w-7xl mx-auto px-6 lg:px-12 space-y-16">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
        {/* Active Resolution Column - Tonal Layering */}
        <section className="lg:col-span-8 flex flex-col">
          {activePoll ? (
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-surface-container-low/40 rounded-[4rem] p-1 lg:p-2 h-full flex flex-col"
            >
              <div className="bg-surface-container-lowest rounded-[3.5rem] p-10 lg:p-16 h-full flex flex-col relative overflow-hidden shadow-2xl shadow-primary/5">
                {/* Visual Accent */}
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
                
                <div className="mb-12 relative z-10">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="px-5 py-2 bg-primary text-on-primary rounded-full text-label-xs font-black uppercase tracking-[0.2em] shadow-lg shadow-primary/20">
                      Active Resolution
                    </div>
                    {activePoll.category && (
                      <span className="text-on-surface-variant/30 text-label-xs font-bold uppercase tracking-widest">{activePoll.category}</span>
                    )}
                  </div>
                  <h2 className="text-display-md lg:text-display-lg font-display font-black text-on-surface mb-6 uppercase italic tracking-tight leading-none">
                    {activePoll.heading || activePoll.title}
                  </h2>
                  {activePoll.heading && (
                    <span className="text-primary/40 font-bold text-label-sm tracking-[0.25em] font-display uppercase block">
                      {activePoll.title}
                    </span>
                  )}
                </div>
                
                {activePoll.proposer && (
                  <div className="flex gap-6 mb-12 items-center relative z-10 p-6 bg-surface-container-low/50 rounded-[2.5rem] backdrop-blur-sm">
                    <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-white/80 shadow-inner">
                      <User className="w-6 h-6 text-primary/40" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-label-xs font-black text-primary/40 uppercase tracking-widest">Sponsoring Delegate</span>
                      <p className="text-body-md font-bold text-on-surface">{activePoll.proposer}</p>
                    </div>
                  </div>
                )}

                <div className="text-on-surface-variant font-medium mb-16 text-body-lg lg:text-body-xl leading-relaxed relative z-10 flex-grow italic border-l-4 border-primary/10 pl-8">
                  "{activePoll.description}"
                </div>

                {/* Interaction Zone */}
                <div className="space-y-8 flex flex-col relative z-10 mt-auto">
                  {userVotes[activePoll.id] ? (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="w-full py-8 rounded-[2.5rem] bg-surface-container-high/50 text-primary font-black font-display text-label-lg flex items-center justify-center gap-4 border border-white/20 backdrop-blur-xl"
                    >
                      <CheckCircle className="w-8 h-8" />
                      POSITION RECORDED: {userVotes[activePoll.id]}
                    </motion.div>
                  ) : (
                    <div className="flex gap-6 min-h-[140px]">
                      {activePoll.options.map((option: string) => {
                        const isAye = option.toLowerCase() === 'aye' || option.toLowerCase() === 'yes';
                        const isNo = option.toLowerCase() === 'no' || option.toLowerCase() === 'nay';
                        
                        let baseStyle = "flex-1 group flex flex-col items-center justify-center p-10 rounded-[3rem] transition-all relative overflow-hidden";
                        let colors = isAye 
                          ? "bg-tertiary/5 text-tertiary hover:bg-tertiary hover:text-on-tertiary shadow-lg shadow-tertiary/5" 
                          : isNo 
                            ? "bg-secondary/5 text-secondary hover:bg-secondary hover:text-on-secondary shadow-lg shadow-secondary/5"
                            : "bg-surface-container-low text-on-surface-variant hover:bg-primary hover:text-on-primary shadow-lg shadow-primary/5";
                        
                        let icon = isAye ? <ThumbsUp className="w-8 h-8 mb-4" /> : isNo ? <ThumbsDown className="w-8 h-8 mb-4" /> : <Activity className="w-8 h-8 mb-4" />;
                        
                        return (
                          <button 
                            key={option}
                            onClick={() => handleCastVote(activePoll.id, option)}
                            disabled={submittingId === activePoll.id || !votingEnabled}
                            className={`${baseStyle} ${colors} ${!votingEnabled ? 'opacity-30 cursor-not-allowed grayscale' : 'active:scale-95'}`}
                          >
                            <div className="relative z-10 flex flex-col items-center">
                              {submittingId === activePoll.id ? (
                                <Loader2 className="w-8 h-8 animate-spin mb-4" />
                              ) : (
                                <div className="group-hover:scale-110 transition-transform duration-500">{icon}</div>
                              )}
                              <span className="font-black font-display text-label-md uppercase tracking-[0.25em]">{option}</span>
                            </div>
                            <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                        );
                      })}
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between px-6 py-4 bg-surface-container-low rounded-full">
                    <div className="flex items-center gap-3">
                      <div className={`w-2.5 h-2.5 rounded-full ${votingEnabled ? 'bg-tertiary animate-pulse' : 'bg-secondary'}`} />
                      <span className="text-label-xs font-black uppercase tracking-widest text-on-surface-variant/40">
                        {votingEnabled ? 'Floor Open for Debate' : 'Floor Currently Closed'}
                      </span>
                    </div>
                    {!userVotes[activePoll.id] && !votingEnabled && (
                      <div className="flex items-center gap-2 text-label-xs font-bold text-secondary uppercase tracking-widest italic">
                        <Lock className="w-3 h-3" /> Waiting for Speaker
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="bg-surface-container-low/40 rounded-[4rem] p-1 h-full">
              <div className="bg-surface-container-lowest rounded-[3.5rem] p-24 text-center h-full flex flex-col items-center justify-center space-y-8">
                <div className="w-24 h-24 bg-surface-container rounded-[2rem] flex items-center justify-center shadow-inner">
                  <Lock className="w-12 h-12 text-on-surface-variant/10" />
                </div>
                <div className="space-y-3">
                  <h3 className="text-display-xs font-display font-black text-on-surface-variant/20 uppercase tracking-[0.3em] italic leading-none">Chamber Adjourned</h3>
                  <p className="text-body-md font-medium text-on-surface-variant/30 italic">No active resolutions are being considered at this time.</p>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Sidebar / Legislative Archive - Borderless Editorial */}
        <aside className="lg:col-span-4 flex flex-col h-[600px] lg:h-auto">
          <div className="bg-surface-container-low/40 rounded-[4rem] p-8 flex flex-col h-full space-y-8">
            <div className="flex items-center justify-between px-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-2xl text-primary shadow-inner">
                  <Archive className="w-5 h-5" />
                </div>
                <h3 className="font-black font-display text-title-md text-primary uppercase italic tracking-tight">Legislative Archive</h3>
              </div>
              <History className="w-5 h-5 text-on-surface-variant/20" />
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar no-scrollbar">
              {inactivePolls.map(poll => (
                <motion.div 
                  key={poll.id} 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  onClick={() => setSummaryPollId(poll.id)}
                  className="bg-white/60 hover:bg-white p-6 rounded-[2.5rem] border border-white/5 transition-all cursor-pointer group shadow-sm hover:shadow-xl hover:shadow-primary/5 active:scale-[0.98]"
                >
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-label-xs font-black text-on-surface-variant/20 uppercase tracking-widest">
                      {new Date(poll.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                    <span className={`px-4 py-1 rounded-full text-[10px] font-black tracking-widest uppercase shadow-sm ${
                      poll.outcome === 'passed' ? 'bg-tertiary/10 text-tertiary' : 'bg-secondary/10 text-secondary'
                    }`}>
                      {poll.outcome || 'CLOSED'}
                    </span>
                  </div>
                  {poll.heading && <p className="text-label-xs font-black text-primary/40 uppercase tracking-[0.2em] mb-1 truncate">{poll.heading}</p>}
                  <h4 className="font-black font-display text-on-surface text-body-sm mb-2 group-hover:text-primary transition-colors leading-tight italic">{poll.title}</h4>
                  <p className="text-body-xs text-on-surface-variant/40 font-medium line-clamp-2 italic leading-relaxed">"{poll.description}"</p>
                </motion.div>
              ))}
              
              {inactivePolls.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-20 py-12">
                  <Archive className="w-12 h-12" />
                  <p className="text-label-sm font-black uppercase tracking-[0.3em] italic">No historical records</p>
                </div>
              )}
            </div>
            
            {inactivePolls.length > 0 && (
              <button 
                onClick={() => setHistoryModalOpen(true)}
                className="group w-full py-5 bg-white rounded-full text-primary font-black text-label-xs uppercase tracking-[0.3em] hover:bg-primary hover:text-on-primary transition-all flex items-center justify-center gap-3 shadow-xl shadow-primary/5"
              >
                Expand Full Archive
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>
            )}
          </div>
        </aside>
      </div>

      {/* Real-time Results Section - Modernized Bar Charts */}
      {activePoll && (
        <motion.section 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="w-full"
        >
          <div className="bg-surface-container-low/40 rounded-[4.5rem] p-1">
            <div className="bg-surface-container-lowest rounded-[4rem] p-10 lg:p-16 shadow-2xl shadow-primary/5 overflow-hidden relative">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8 mb-16 relative z-10">
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 rounded-[2rem] bg-primary text-on-primary flex items-center justify-center shadow-xl shadow-primary/20">
                    <Activity className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="font-black font-display text-display-xs text-on-surface uppercase italic tracking-tight leading-none">Live Consensus Monitoring</h3>
                    <p className="text-primary/40 text-label-xs font-black uppercase tracking-[0.3em] mt-3 italic">Real-time parliamentary trajectory</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 bg-surface-container-low rounded-full px-8 py-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-tertiary animate-pulse" />
                  <span className="text-label-xs font-black uppercase tracking-[0.2em] text-on-surface-variant/40">Broadcasting Real-time Data</span>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                {activePoll.options.map((option: string) => {
                  const count = activePoll.votes_summary?.counts[option] || 0;
                  const total = activePoll.votes_summary?.total || 0;
                  const perc = total > 0 ? Math.round((count / total) * 100) : 0;
                  const isAye = option.toLowerCase() === 'aye' || option.toLowerCase() === 'yes';
                  const isNo = option.toLowerCase() === 'no' || option.toLowerCase() === 'nay';
                  
                  let barColor = isAye ? "bg-tertiary" : isNo ? "bg-secondary" : "bg-primary";
                  let textColor = isAye ? "text-tertiary" : isNo ? "text-secondary" : "text-primary";
                  let bgColor = isAye ? "bg-tertiary/5" : isNo ? "bg-secondary/5" : "bg-primary/5";

                  return (
                    <div key={option} className={`${bgColor} p-10 rounded-[3rem] border border-white/10 relative overflow-hidden group transition-all hover:shadow-2xl hover:shadow-black/5`}>
                      <div className="flex justify-between items-end mb-8">
                        <div className="space-y-1">
                          <span className={`text-display-xs font-display font-black ${textColor} uppercase italic tracking-tight leading-none`}>{option}</span>
                          <p className="text-label-xs font-bold text-on-surface-variant/30 uppercase tracking-widest">{count} Delegates</p>
                        </div>
                        <div className="text-right">
                          <span className="text-display-md font-display font-black text-on-surface tracking-tighter italic leading-none">{perc}%</span>
                        </div>
                      </div>
                      <div className="w-full h-4 bg-white/60 rounded-full overflow-hidden shadow-inner p-0.5">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${perc}%` }}
                          className={`h-full ${barColor} rounded-full shadow-lg shadow-black/10`}
                          transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </motion.section>
      )}

      {/* Concluded Verdict Highlight - Tonal Polish */}
      {lastConcludedResolution && lastConcludedResolution.outcome && (
        <motion.section 
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          className="w-full"
        >
          <div className={`rounded-[4rem] p-12 lg:p-20 flex flex-col lg:flex-row items-center gap-12 relative overflow-hidden shadow-2xl ${
            lastConcludedResolution.outcome === 'passed' 
              ? 'bg-tertiary text-on-tertiary' 
              : 'bg-secondary text-on-secondary'
          }`}>
            <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -mr-48 -mt-48 blur-3xl animate-pulse"></div>
            
            <div className={`w-32 h-32 rounded-[2.5rem] flex items-center justify-center flex-shrink-0 shadow-2xl relative z-10 backdrop-blur-xl border border-white/20 bg-white/10`}>
              {lastConcludedResolution.outcome === 'passed' ? (
                <CheckCircle className="w-16 h-16 text-white" />
              ) : (
                <XCircle className="w-16 h-16 text-white" />
              )}
            </div>
            
            <div className="flex-1 text-center lg:text-left relative z-10 space-y-6">
              <div className="inline-flex px-5 py-2 rounded-full bg-white/10 text-label-xs font-black uppercase tracking-[0.25em] border border-white/20 backdrop-blur-sm">
                Legislative Verdict
              </div>
              <div className="space-y-3">
                <h3 className="text-display-sm lg:text-display-md font-display font-black uppercase italic tracking-tight text-white leading-tight">
                  {lastConcludedResolution.heading || lastConcludedResolution.title}
                </h3>
                <p className="text-label-sm font-black uppercase tracking-[0.3em] opacity-40 italic">
                  Resolution Protocol {lastConcludedResolution.id.substring(0, 8)}
                </p>
              </div>
              <p className="text-body-md font-medium opacity-80 italic leading-relaxed max-w-2xl mx-auto lg:mx-0">
                "{lastConcludedResolution.description}"
              </p>
            </div>
            
            <button 
              onClick={() => setSummaryPollId(lastConcludedResolution.id)}
              className="px-12 py-6 bg-white font-black rounded-full hover:scale-105 transition-all shadow-2xl z-10 font-display text-label-xs uppercase tracking-[0.3em] text-on-surface active:scale-95"
            >
              Review Verdict
            </button>
          </div>
        </motion.section>
      )}

      {/* History Dialog Refinement */}
      <Dialog open={historyModalOpen} onOpenChange={setHistoryModalOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-0 rounded-[4rem] overflow-hidden border-none bg-transparent shadow-none">
          <div className="bg-surface-container-lowest rounded-[4rem] border border-white/20 shadow-2xl w-full flex flex-col max-h-full overflow-hidden">
            <DialogHeader className="p-12 lg:p-16 pb-8 shrink-0 bg-surface-container-low/50">
              <div className="flex items-center gap-6 mb-4">
                <div className="p-4 bg-primary text-on-primary rounded-3xl shadow-xl shadow-primary/20">
                  <Archive className="w-8 h-8" />
                </div>
                <DialogTitle className="text-display-xs font-display font-black text-on-surface uppercase italic tracking-tight">Full Legislative Archive</DialogTitle>
              </div>
              <p className="text-label-sm font-black text-primary/40 uppercase tracking-[0.3em] italic">Comprehensive record of past resolutions</p>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto p-12 lg:p-16 pt-8 space-y-8 no-scrollbar">
              {inactivePolls.map(poll => (
                 <div key={poll.id} className="bg-surface-container-low/50 p-10 rounded-[3.5rem] border border-white/10 group hover:bg-white hover:shadow-2xl hover:shadow-black/5 transition-all">
                   <div className="flex flex-col md:flex-row justify-between items-start gap-8 mb-8">
                     <div className="flex-1 space-y-4">
                       {poll.heading && <span className="text-primary font-black text-label-xs uppercase tracking-[0.25em] block opacity-40">{poll.heading}</span>}
                       <h4 className="font-black font-display text-display-xs text-on-surface uppercase italic tracking-tight leading-tight">{poll.title}</h4>
                     </div>
                     <span className={`px-6 py-2 rounded-full text-label-xs font-black tracking-[0.25em] uppercase shrink-0 shadow-sm ${
                       poll.outcome === 'passed' ? 'bg-tertiary/10 text-tertiary' : 'bg-secondary/10 text-secondary'
                     }`}>
                       {poll.outcome || 'CLOSED'}
                     </span>
                   </div>
                   {poll.description && <p className="text-body-md font-medium text-on-surface-variant/40 mb-10 line-clamp-3 italic leading-relaxed">"{poll.description}"</p>}
                   <button 
                     onClick={() => setSummaryPollId(poll.id)}
                     className="text-label-xs font-black text-primary hover:gap-4 flex items-center gap-3 transition-all uppercase tracking-[0.3em] group/btn"
                   >
                     Examine Detailed Verdict 
                     <ArrowRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-1" />
                   </button>
                 </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Result Dialog Refinement */}
      <Dialog open={!!summaryPollId} onOpenChange={(open) => !open && setSummaryPollId(null)}>
        <DialogContent className="max-w-5xl max-h-[95vh] overflow-hidden p-0 border-none bg-transparent shadow-none flex flex-col">
          {summaryPollId && (
            <DetailedPollResults 
              pollId={summaryPollId} 
              pollTitle={polls.find(p => p.id === summaryPollId)?.title || ""} 
              pollHeading={polls.find(p => p.id === summaryPollId)?.heading}
              options={polls.find(p => p.id === summaryPollId)?.options || []} 
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StudentVotingTab;

