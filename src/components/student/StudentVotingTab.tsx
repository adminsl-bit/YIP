import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { 
  Loader2,
  User
} from "lucide-react";
import { motion } from "framer-motion";
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
  const { user } = useAuth();
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
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-4 border-[#13298f]/10"></div>
          <div className="absolute inset-0 rounded-full border-4 border-[#13298f] border-t-transparent animate-spin"></div>
        </div>
        <div className="text-center">
          <p className="font-headline font-black text-xs uppercase tracking-[0.2em] text-[#13298f] mb-2">Authenticating Credentials</p>
          <p className="font-body text-sm text-[#454653] opacity-60">Synchronizing with the Sovereign Ballot Server...</p>
        </div>
      </div>
    );
  }

  const activePoll = polls.find(p => p.is_active);
  const inactivePolls = polls.filter(p => !p.is_active);
  const lastConcludedResolution = inactivePolls.length > 0 ? inactivePolls[0] : null;

  return (
    <div className="flex flex-col animate-fade-in w-full pb-24 max-w-7xl mx-auto px-6">


      <div className="flex flex-col gap-8 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch w-full">
          {/* Active Resolution Column */}
          <section className="lg:col-span-8">
            {activePoll ? (
              <div className="bg-[#ffffff] rounded-3xl p-8 shadow-[0_8px_32px_0_rgba(46,65,172,0.04)] relative overflow-hidden group h-full flex flex-col">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#3042a6]/5 rounded-bl-[100%] transition-transform group-hover:scale-110"></div>
                
                <div className="mb-6 relative z-10">
                  <h2 className="text-2xl md:text-3xl font-bold font-headline text-[#191c1e] mb-2">
                    {activePoll.heading || activePoll.title}
                  </h2>
                  {activePoll.heading && (
                    <span className="text-[#13298f] font-bold text-sm tracking-widest font-headline uppercase block opacity-60">
                      {activePoll.title}
                    </span>
                  )}
                </div>
                
                {activePoll.proposer && (
                  <div className="flex gap-4 mb-8 items-center relative z-10">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full border-2 border-[#ffffff] bg-[#eceef0] shrink-0">
                      <User className="w-5 h-5 text-[#757684]" />
                    </div>
                    <div className="flex items-center">
                      <p className="text-sm text-[#454653] leading-relaxed">
                        <span className="font-bold text-[#191c1e]">Proposer:</span> {activePoll.proposer}
                      </p>
                    </div>
                  </div>
                )}

                <p className="text-[#454653] mb-8 text-base md:text-lg leading-relaxed relative z-10 flex-grow">
                  {activePoll.description}
                </p>

                <div className="space-y-4 flex flex-col relative z-10 mt-auto">
                  {userVotes[activePoll.id] ? (
                    <div className="w-full py-4 rounded-2xl bg-[#13298f]/10 text-[#13298f] font-bold font-headline flex items-center justify-center gap-2">
                      <span className="material-symbols-outlined text-xl">how_to_vote</span>
                      Vote Cast: {userVotes[activePoll.id]}
                    </div>
                  ) : (
                    <div className="flex gap-3 h-full min-h-[100px]">
                      {activePoll.options.map((option: string) => {
                        const isAye = option.toLowerCase() === 'aye' || option.toLowerCase() === 'yes';
                        const isNo = option.toLowerCase() === 'no' || option.toLowerCase() === 'nay';
                        
                        let colors = 'text-[#757684] hover:border-[#13298f] hover:bg-[#13298f]/5';
                        let icon = 'how_to_vote';
                        let iconColors = 'text-[#757684]';
                        
                        if (isAye) {
                          colors = 'hover:border-[#3042a6] hover:bg-[#3042a6]/5 text-[#3042a6]';
                          icon = 'thumb_up';
                          iconColors = 'text-[#3042a6]';
                        } else if (isNo) {
                          colors = 'hover:border-[#fe6f42] hover:bg-[#fe6f42]/5 text-[#fe6f42]';
                          icon = 'thumb_down';
                          iconColors = 'text-[#fe6f42]';
                        }

                        return (
                          <button 
                            key={option}
                            onClick={() => handleCastVote(activePoll.id, option)}
                            disabled={submittingId === activePoll.id || !votingEnabled}
                            className={`flex-1 group flex flex-col items-center justify-center p-4 rounded-2xl bg-[#eceef0] border-2 border-transparent transition-all ${colors} ${!votingEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            {submittingId === activePoll.id ? (
                              <Loader2 className="w-6 h-6 animate-spin mb-1" />
                            ) : (
                              <span className={`material-symbols-outlined text-3xl mb-1 group-hover:scale-110 transition-transform ${iconColors}`}>{icon}</span>
                            )}
                            <span className="font-bold font-headline">{option}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  
                  <button 
                    disabled
                    className={`w-full py-4 rounded-2xl bg-[#c5c5d5]/30 text-[#757684] cursor-not-allowed font-bold font-headline flex items-center justify-center gap-2`}
                  >
                    <span className="material-symbols-outlined text-xl">lock</span>
                    {!votingEnabled && !userVotes[activePoll.id] 
                      ? 'Floor Closed' 
                      : userVotes[activePoll.id] 
                        ? 'Vote Locked In' 
                        : 'Cast Vote (Waiting for Organizer)'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-[#ffffff] rounded-3xl p-16 text-center shadow-[0_8px_32px_0_rgba(46,65,172,0.04)] h-full flex flex-col items-center justify-center">
                <span className="material-symbols-outlined text-6xl text-[#c5c5d5] mb-4">lock</span>
                <h3 className="text-2xl font-headline font-black text-[#757684] uppercase tracking-widest mb-2">Chamber Adjourned</h3>
                <p className="text-sm font-body text-[#454653]">The house is not currently considering any active resolutions.</p>
              </div>
            )}
          </section>

          {/* Sidebar / Legislative Archive */}
          <aside className="lg:col-span-4 h-[400px] lg:h-full">
            <div className="bg-[#f2f4f6] rounded-3xl p-6 border border-[#c5c5d5]/15 h-full flex flex-col">
              <div className="flex items-center justify-between mb-6 shrink-0">
                <h3 className="font-bold font-headline text-xl text-[#13298f]">Legislative Archive</h3>
                <span className="material-symbols-outlined text-[#757684]">history</span>
              </div>
              <div className="space-y-4 flex-1 min-h-0 overflow-y-auto pr-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-[#c5c5d5]/80 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent">
                {inactivePolls.map(poll => (
                    <div 
                      key={poll.id} 
                      onClick={() => setSummaryPollId(poll.id)}
                      className="bg-[#ffffff] p-4 rounded-2xl hover:shadow-md transition-shadow cursor-pointer group border border-transparent hover:border-[#13298f]/10"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-bold text-[#757684] uppercase tracking-wider">
                          {new Date(poll.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          poll.outcome === 'passed' ? 'bg-[#6ffbbe] text-[#002113]' : 'bg-[#ffdad6] text-[#93000a]'
                        }`}>
                          {poll.outcome?.toUpperCase() || 'CLOSED'}
                        </span>
                      </div>
                      {poll.heading && <p className="text-[10px] font-bold text-[#13298f] uppercase tracking-widest mb-1">{poll.heading}</p>}
                      <h4 className="font-bold font-headline text-[#191c1e] mb-1 group-hover:text-[#13298f] transition-colors">{poll.title}</h4>
                      <p className="text-xs text-[#454653] line-clamp-2">{poll.description}</p>
                    </div>
                ))}
                
                {inactivePolls.length === 0 && (
                  <div className="text-center py-8 bg-[#ffffff] rounded-2xl">
                    <p className="text-sm text-[#757684] font-medium italic">No historical records available.</p>
                  </div>
                )}
              </div>
              
              {inactivePolls.length > 0 && (
                <button 
                  onClick={() => setHistoryModalOpen(true)}
                  className="w-full mt-6 py-3 text-[#13298f] font-bold text-sm hover:underline flex items-center justify-center gap-2 mt-auto"
                >
                  View Full History
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </button>
              )}
            </div>
          </aside>
        </div>

        {/* Real-time Results Row */}
        {activePoll && (
          <section className="w-full">
            <div className="bg-[#ffffff] rounded-3xl p-8 shadow-[0_8px_32px_0_rgba(46,65,172,0.04)]">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 rounded-2xl bg-[#13298f]/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[#13298f] text-2xl">analytics</span>
                </div>
                <div>
                  <h3 className="font-bold font-headline text-[#191c1e] text-2xl">Live Results</h3>
                  <p className="text-[#757684] text-sm">Real-time voting consensus</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {activePoll.options.map((option: string) => {
                  const count = activePoll.votes_summary?.counts[option] || 0;
                  const total = activePoll.votes_summary?.total || 0;
                  const perc = total > 0 ? Math.round((count / total) * 100) : 0;
                  const isAye = option.toLowerCase() === 'aye' || option.toLowerCase() === 'yes';
                  const isNo = option.toLowerCase() === 'no' || option.toLowerCase() === 'nay';
                  
                  let colorText = 'text-[#757684]';
                  let colorBg = 'bg-[#c5c5d5]';
                  if (isAye) { colorText = 'text-[#3042a6]'; colorBg = 'bg-[#3042a6]'; }
                  if (isNo) { colorText = 'text-[#fe6f42]'; colorBg = 'bg-[#fe6f42]'; }

                  return (
                    <div key={option} className="bg-[#f2f4f6] p-6 rounded-2xl relative overflow-hidden">
                      <div className="flex justify-between items-end mb-4 relative z-10">
                        <span className={`text-xl font-bold font-headline ${colorText} uppercase`}>{option}</span>
                        <div className="text-right">
                          <span className="block text-4xl font-black font-headline text-[#191c1e] leading-none mb-1">{perc}%</span>
                          <span className="text-xs font-bold text-[#757684] uppercase tracking-wider">{count} Votes</span>
                        </div>
                      </div>
                      <div className="w-full h-3 bg-[#e6e8ea] rounded-full overflow-hidden relative z-10">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${perc}%` }}
                          className={`h-full ${colorBg} rounded-full`}
                          transition={{ duration: 0.5, ease: "easeOut" }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* Recently Concluded Resolution */}
        {lastConcludedResolution && lastConcludedResolution.outcome && (
          <section className="w-full">
            <div className={`rounded-3xl p-8 shadow-xl flex flex-col md:flex-row items-center gap-8 relative overflow-hidden ${
              lastConcludedResolution.outcome === 'passed' ? 'bg-[#3042a6] text-[#afb9ff]' : 'bg-[#93000a] text-[#ffdad6]'
            }`}>
              <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full -mr-24 -mt-24"></div>
              <div className={`w-24 h-24 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg relative z-10 ${
                lastConcludedResolution.outcome === 'passed' ? 'bg-[#6ffbbe]' : 'bg-[#ffb4ab]'
              }`}>
                <span className={`material-symbols-outlined text-4xl ${
                  lastConcludedResolution.outcome === 'passed' ? 'text-[#002113]' : 'text-[#410002]'
                }`} style={{ fontVariationSettings: "'FILL' 1" }}>
                  {lastConcludedResolution.outcome === 'passed' ? 'check_circle' : 'cancel'}
                </span>
              </div>
              <div className="flex-1 text-center md:text-left relative z-10">
                <span className="inline-block px-3 py-1 rounded-full bg-white/20 text-xs font-bold mb-2 text-white">LAST OUTCOME</span>
                <h3 className="text-2xl font-bold font-headline mb-1 text-white">
                  {lastConcludedResolution.heading || lastConcludedResolution.title}
                </h3>
                <p className={`${lastConcludedResolution.outcome === 'passed' ? 'text-[#afb9ff]/90' : 'text-[#ffdad6]/90'} font-black text-[10px] uppercase tracking-widest opacity-60 mb-2`}>
                  {lastConcludedResolution.title}
                </p>
                <p className={`${lastConcludedResolution.outcome === 'passed' ? 'text-[#afb9ff]/90' : 'text-[#ffdad6]/90'} font-medium line-clamp-2`}>
                  {lastConcludedResolution.description}
                </p>
              </div>
              <button 
                onClick={() => setSummaryPollId(lastConcludedResolution.id)}
                className={`px-6 py-3 bg-white font-bold rounded-2xl hover:scale-105 transition-transform z-10 ${
                lastConcludedResolution.outcome === 'passed' ? 'text-[#13298f]' : 'text-[#93000a]'
              }`}>
                View Summary
              </button>
            </div>
          </section>
        )}
      </div>

      <Dialog open={historyModalOpen} onOpenChange={setHistoryModalOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0 rounded-[2.5rem] overflow-hidden border-none bg-transparent shadow-none">
          <div className="bg-[#ffffff] rounded-[2.5rem] border border-[#e0e3e5]/50 shadow-[0_8px_32px_0_rgba(46,65,172,0.04)] w-full flex flex-col max-h-full overflow-hidden">
            <DialogHeader className="p-8 md:p-10 pb-4 shrink-0">
              <DialogTitle className="text-3xl font-headline font-black text-[#13298f]">Legislative Archive</DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto p-8 md:p-10 pt-4 space-y-4">
              {inactivePolls.map(poll => (
                 <div key={poll.id} className="bg-[#f2f4f6] p-6 rounded-3xl border border-[#e0e3e5] shrink-0">
                   <div className="flex justify-between items-start mb-4">
                     <div className="max-w-xl">
                       {poll.heading && <span className="text-[#13298f] font-bold text-[10px] uppercase tracking-widest mb-1 block">{poll.heading}</span>}
                       <h4 className="font-bold font-headline text-xl text-[#191c1e]">{poll.title}</h4>
                     </div>
                     <span className={`px-4 py-1.5 rounded-full text-xs font-black tracking-widest uppercase shrink-0 ml-4 ${
                       poll.outcome === 'passed' ? 'bg-[#6ffbbe] text-[#002113]' : 'bg-[#ffdad6] text-[#93000a]'
                     }`}>
                       {poll.outcome || 'CLOSED'}
                     </span>
                   </div>
                   {poll.description && <p className="text-sm text-[#454653] mb-6 line-clamp-3">{poll.description}</p>}
                   <button 
                     onClick={() => {
                       setSummaryPollId(poll.id);
                     }}
                     className="text-sm font-black text-[#13298f] hover:underline flex items-center gap-1"
                   >
                     VIEW DETAILED SUMMARY <span className="material-symbols-outlined text-lg">arrow_right_alt</span>
                   </button>
                 </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!summaryPollId} onOpenChange={(open) => !open && setSummaryPollId(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden p-0 border-none bg-transparent shadow-none flex flex-col">
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
