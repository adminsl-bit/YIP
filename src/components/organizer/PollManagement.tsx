import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Plus, Trash, Play, Pause, MoreVertical, ExternalLink, 
  Eye, RotateCcw, BarChart3, Users, Clock, ArrowRight,
  TrendingUp, MapPin, CheckCircle2, XCircle, Activity
} from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger, 
  DropdownMenuSeparator 
} from "@/components/ui/dropdown-menu";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { DetailedPollResults } from "@/components/student/DetailedPollResults";

interface Poll {
  id: string;
  title: string;
  heading?: string;
  description?: string;
  options: string[];
  is_active: boolean;
  show_results_publicly: boolean;
  show_post_analysis: boolean;
  outcome?: 'passed' | 'failed' | null;
  created_at: string;
}

interface PollVote {
  option_id: string;
  count: number;
}

export const PollManagement = () => {
  const { user } = useAuth();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [pollResults, setPollResults] = useState<Record<string, PollVote[]>>({});
  const [showDetailedResults, setShowDetailedResults] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [totalParticipants, setTotalParticipants] = useState(0);
  
  const [pollToDelete, setPollToDelete] = useState<Poll | null>(null);
  const [pollToReset, setPollToReset] = useState<Poll | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [heatmapData, setHeatmapData] = useState<number[]>(new Array(12).fill(0));
  const [originData, setOriginData] = useState<{label: string, value: number}[]>([]);

  const [formData, setFormData] = useState({
    heading: "",
    title: "",
    description: "",
    options: ["", ""],
    showPublicly: true,
    allowMultiple: false
  });

  useEffect(() => {
    fetchPolls();
    fetchTotalParticipants();
    fetchAggregateInsights();
  }, []);

  useEffect(() => {
    polls.forEach(poll => {
      fetchPollResults(poll.id);
    });
  }, [polls]);

  useEffect(() => {
    const channel = supabase
      .channel('organizer_poll_management_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'poll_votes' }, (payload) => {
        const pollId = (payload as any)?.new?.poll_id || (payload as any)?.old?.poll_id;
        if (pollId) fetchPollResults(pollId);
        fetchAggregateInsights();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'polls' }, () => {
        fetchPolls();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchPolls = async () => {
    try {
      const { data, error } = await supabase
        .from('polls')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setPolls((data || []) as Poll[]);
    } catch (error) {
      console.error('Error fetching polls:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTotalParticipants = async () => {
    const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('user_type', 'student');
    setTotalParticipants(count || 0);
  };

  const fetchAggregateInsights = async () => {
    try {
      // Fetch votes with voter profile information (specifically state)
      const { data, error } = await supabase
        .from('poll_votes')
        .select(`
          created_at,
          voter_id,
          profiles!inner (
            state
          )
        `);

      if (error) throw error;
      if (!data || data.length === 0) return;

      // 1. Calculate Origin Data (Geographic distribution)
      const stateCounts: Record<string, number> = {};
      data.forEach((v: any) => {
        const state = v.profiles?.state || 'Unknown';
        stateCounts[state] = (stateCounts[state] || 0) + 1;
      });

      const totalVotes = data.length;
      const sortedStates = Object.entries(stateCounts)
        .map(([label, count]) => ({ 
          label, 
          value: Math.round((count / totalVotes) * 100) 
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 3); // Top 3 states

      setOriginData(sortedStates);

      // 2. Calculate Heatmap (Temporal distribution)
      // We'll look at the last 2 hours of activity to show current momentum
      const now = new Date();
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      
      const buckets = new Array(12).fill(0);
      const bucketSizeMs = (2 * 60 * 60 * 1000) / 12; // 10 minutes per bucket

      data.forEach((v: any) => {
        const voteTime = new Date(v.created_at);
        if (voteTime > twoHoursAgo) {
          const diffMs = voteTime.getTime() - twoHoursAgo.getTime();
          const bucketIndex = Math.min(11, Math.floor(diffMs / bucketSizeMs));
          buckets[bucketIndex]++;
        }
      });

      // Normalize buckets for visualization (max height 100%)
      const maxVotes = Math.max(...buckets, 1);
      const normalizedBuckets = buckets.map(count => Math.round((count / maxVotes) * 100));
      setHeatmapData(normalizedBuckets);

    } catch (e) {
      console.error('Error fetching aggregate insights:', e);
    }
  };

  const fetchPollResults = async (pollId: string) => {
    try {
      const { data, error } = await supabase
        .from('poll_votes')
        .select('option_id, voter_id')
        .eq('poll_id', pollId);

      if (error) throw error;

      const { data: roleData } = await supabase.from('user_roles').select('user_id, role').in('role', ['journalist', 'admin_student']);
      const excludedUserIds = new Set(roleData?.map(r => r.user_id) || []);
      const filteredVotes = data?.filter(vote => !excludedUserIds.has(vote.voter_id)) || [];

      const voteCounts: Record<string, number> = {};
      filteredVotes.forEach(vote => {
        voteCounts[vote.option_id] = (voteCounts[vote.option_id] || 0) + 1;
      });

      const results: PollVote[] = Object.entries(voteCounts).map(([option_id, count]) => ({ option_id, count }));
      setPollResults(prev => ({ ...prev, [pollId]: results }));
    } catch (e) { console.error(e); }
  };

  const addOption = () => setFormData(prev => ({ ...prev, options: [...prev.options, ""] }));
  const removeOption = (idx: number) => {
    if (formData.options.length > 2) {
      setFormData(prev => ({ ...prev, options: prev.options.filter((_, i) => i !== idx) }));
    }
  };
  const updateOption = (idx: number, val: string) => {
    setFormData(prev => ({ ...prev, options: prev.options.map((opt, i) => i === idx ? val : opt) }));
  };

  const handleCreatePoll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formData.title.trim()) {
      toast({ title: "Error", description: "Question is required", variant: "destructive" });
      return;
    }
    const validOptions = formData.options.filter(opt => opt.trim()).map(opt => opt.trim());
    if (validOptions.length < 2) {
      toast({ title: "Error", description: "At least 2 options required", variant: "destructive" });
      return;
    }

    try {
      const { error } = await supabase.from('polls').insert({
        title: formData.title.trim(),
        heading: formData.heading.trim() || null,
        options: validOptions,
        created_by: user.id,
        is_active: true,
        show_results_publicly: formData.showPublicly
      });

      if (error) throw error;
      
      // Automatically enable voting in system settings when launching a new poll
      await supabase
        .from('system_settings')
        .update({ setting_value: true })
        .eq('setting_key', 'voting_enabled');

      toast({ title: "Poll Launched", description: "Successfully created the poll and enabled voting." });
      setFormData({ heading: "", title: "", description: "", options: ["", ""], showPublicly: true, allowMultiple: false });
      fetchPolls();
    } catch (e) { toast({ title: "Error", description: "Failed to create poll", variant: "destructive" }); }
  };

  const togglePollStatus = async (poll: Poll, outcome?: 'passed' | 'failed') => {
    const newStatus = !poll.is_active;
    const updateData: any = { 
        is_active: newStatus,
        show_results_publicly: newStatus ? true : poll.show_results_publicly,
        show_post_analysis: !newStatus
    };

    if (outcome) {
      updateData.outcome = outcome;
    }

    const { error } = await supabase.from('polls').update(updateData).eq('id', poll.id);

    if (error) {
      toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
      return;
    }

    // If starting a poll, ensure global voting is also enabled
    if (newStatus) {
      await supabase
        .from('system_settings')
        .update({ setting_value: true })
        .eq('setting_key', 'voting_enabled');
      
      // Also clear any previous outcome if restarting
      await supabase.from('polls').update({ outcome: null }).eq('id', poll.id);
    }

    fetchPolls();
    toast({ title: newStatus ? "Poll Active" : "Poll Stopped", description: outcome ? `Resolution marked as ${outcome.toUpperCase()}` : undefined });
  };

  const deletePoll = async (pollId: string) => {
    const { error } = await supabase.from('polls').delete().eq('id', pollId);
    if (error) return toast({ title: "Error", variant: "destructive" });
    fetchPolls();
    setPollToDelete(null);
    toast({ title: "Deleted Successfully" });
  };

  const resetPoll = async (pollId: string) => {
    setIsResetting(true);
    const { error } = await supabase.from('poll_votes').delete().eq('poll_id', pollId);
    setIsResetting(false);
    if (error) return toast({ title: "Error", variant: "destructive" });
    fetchPollResults(pollId);
    setPollToReset(null);
    toast({ title: "Poll Votes Cleared" });
  };

  const getTotalVotes = (pollId: string) => {
    return (pollResults[pollId] || []).reduce((t, r) => t + r.count, 0);
  };

  const openStageView = (pollId: string) => {
    window.open(`/display/polls?pollId=${pollId}`, `poll_stage_${pollId}`, 'width=1200,height=800');
  };

  if (loading) {
    return <div className="flex items-center justify-center p-20"><Clock className="animate-spin text-[#13298f] w-10 h-10" /></div>;
  }

  const activePolls = polls.filter(p => p.is_active);
  const pastPolls = polls.filter(p => !p.is_active);
  const totalVotesAcrossAll = Object.values(pollResults).reduce((t, r) => t + r.reduce((st, sr) => st + sr.count, 0), 0);
  const totalPollsCount = polls.length || 1;
  const participationRate = totalParticipants > 0 ? Math.round((totalVotesAcrossAll / (totalParticipants * totalPollsCount)) * 100) : 0;

  return (
    <div className="space-y-12 animate-fade-in">
      <header className="flex flex-col lg:flex-row justify-between lg:items-end gap-6 mb-4">
        <div className="max-w-3xl">
          <h1 className="text-5xl font-black text-[#13298f] mb-3 font-headline">Ballot Control Center</h1>
          <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] ml-1 opacity-70">Overseeing active legislative resolutions and voting protocols</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={async () => {
              const { error } = await supabase.from('system_settings').update({ setting_value: true }).eq('setting_key', 'voting_enabled');
              if (!error) toast({ title: "Voting Protocol Enabled", description: "All student tablets have been unfrozen." });
            }}
            className="px-6 py-3 bg-[#4edea3] text-[#00583b] rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-[#4edea3]/20 hover:scale-105 transition-all flex items-center gap-2"
          >
            <Play className="w-4 h-4" /> Force Unfreeze All
          </button>
        </div>
      </header>



      {/* Main Content Layout */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Creation Lateral Form */}
        <div className="lg:col-span-4 bg-[#f2f4f6] p-8 rounded-[2.5rem] border border-[#e0e3e5] sticky top-24">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-10 h-10 bg-[#13298f] rounded-2xl flex items-center justify-center shadow-lg shadow-[#13298f]/20">
              <Plus className="text-white w-6 h-6" />
            </div>
            <h2 className="text-2xl font-black text-[#13298f] font-headline">New Poll</h2>
          </div>
          
          <form className="space-y-6" onSubmit={handleCreatePoll}>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-[#757684] uppercase tracking-widest ml-1">Poll Heading</label>
              <Input 
                value={formData.heading}
                onChange={e => setFormData(p => ({ ...p, heading: e.target.value }))}
                className="w-full bg-white border-none rounded-2xl p-4 focus:ring-2 focus:ring-[#13298f]/20 text-sm shadow-sm" 
                placeholder="e.g. Constitutional Amendment Act" 
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-[#757684] uppercase tracking-widest ml-1">Poll Question</label>
              <Textarea 
                value={formData.title}
                onChange={e => setFormData(p => ({ ...p, title: e.target.value }))}
                className="w-full bg-white border-none rounded-2xl p-4 focus:ring-2 focus:ring-[#13298f]/20 text-sm shadow-sm" 
                placeholder="What would you like to ask the participants?" 
                rows={3} 
              />
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-black text-[#757684] uppercase tracking-widest ml-1">Options</label>
              {formData.options.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2 group">
                  <input 
                    value={opt}
                    onChange={e => updateOption(idx, e.target.value)}
                    className="flex-1 bg-white border-none rounded-xl px-4 py-3 text-sm shadow-sm focus:ring-2 focus:ring-[#13298f]/20" 
                    placeholder={`Option ${idx + 1}`} 
                  />
                  {formData.options.length > 2 && (
                    <button 
                       type="button"
                       onClick={() => removeOption(idx)}
                       className="p-2 text-[#757684] hover:text-[#ba1a1a] opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              <button 
                type="button" 
                onClick={addOption}
                className="flex items-center gap-2 text-[#13298f] text-xs font-black ml-1 hover:underline"
              >
                <Plus className="w-4 h-4" /> ADD ANOTHER OPTION
              </button>
            </div>

            <div className="pt-6 border-t border-[#e0e3e5] space-y-4">
               <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-[#191c1e]">Show Results Publicly</span>
                  <Toggle active={formData.showPublicly} onChange={(val) => setFormData(p => ({ ...p, showPublicly: val }))} />
               </div>
               <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-[#191c1e]">Allow Multiple Choices</span>
                  <Toggle active={formData.allowMultiple} onChange={(val) => setFormData(p => ({ ...p, allowMultiple: val }))} />
               </div>
            </div>

            <button 
              type="submit"
              className="w-full py-4 bg-[#13298f] text-white rounded-2xl font-black text-sm shadow-xl shadow-[#13298f]/20 hover:scale-[1.02] active:scale-95 transition-all mt-4 font-headline uppercase tracking-wider"
            >
               Launch Poll
            </button>
          </form>
        </div>

        {/* Active & Past Polls */}
        <div className="lg:col-span-8 space-y-8">
           {/* Active List */}
           <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-[#e0e3e5]/50">
              <div className="flex items-center justify-between mb-10">
                 <div>
                    <h3 className="text-2xl font-black text-[#13298f] font-headline">Active Polls</h3>
                    <p className="text-sm text-[#757684] font-medium opacity-80 mt-1">Real-time monitoring of live participant feedback</p>
                 </div>

              </div>

              <div className="space-y-12">
                 {activePolls.length > 0 ? activePolls.map(poll => (
                     <PollItem 
                        key={poll.id} 
                        poll={poll} 
                        results={pollResults[poll.id] || []}
                        onToggle={(outcome?: 'passed' | 'failed') => togglePollStatus(poll, outcome)}
                        onReset={() => setPollToReset(poll)}
                        onDelete={() => setPollToDelete(poll)}
                        onOpenStage={() => openStageView(poll.id)}
                        onShowResults={() => setShowDetailedResults(showDetailedResults === poll.id ? null : poll.id)}
                        showDetails={showDetailedResults === poll.id}
                     />
                 )) : (
                    <div className="text-center py-12 bg-slate-50/50 rounded-[2rem] border-2 border-dashed border-slate-200">
                       <Clock className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                       <p className="text-[#757684] font-bold">No active polls at the moment</p>
                    </div>
                 )}
              </div>
           </div>

           {/* Past Polls Archive */}
           <div className="bg-[#f2f4f6] p-8 rounded-[3rem]">
              <h3 className="text-sm font-black text-[#757684] uppercase tracking-[0.2em] mb-6 px-2">Recently Completed</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {pastPolls.slice(0, 4).map(poll => (
                    <div 
                       key={poll.id}
                       onClick={() => setShowDetailedResults(poll.id)}
                       className="bg-white p-6 rounded-[2rem] flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer group relative overflow-hidden"
                    >
                       {poll.outcome && (
                         <div className={`absolute top-0 right-0 px-3 py-1 text-[8px] font-black uppercase tracking-widest rounded-bl-xl ${poll.outcome === 'passed' ? 'bg-[#4edea3] text-[#00583b]' : 'bg-[#ba1a1a] text-white'}`}>
                           {poll.outcome}
                         </div>
                       )}
                       <div className="w-12 h-12 bg-[#f7f9fb] rounded-2xl flex flex-col items-center justify-center text-[#757684] border border-[#e0e3e5]/50 group-hover:bg-[#13298f]/5 group-hover:text-[#13298f] transition-colors">
                          <span className="text-[10px] font-black uppercase tracking-tighter leading-none">{new Date(poll.created_at).toLocaleDateString('en-US', { month: 'short' })}</span>
                          <span className="text-xl font-black leading-tight">{new Date(poll.created_at).getDate()}</span>
                       </div>
                       <div className="flex-1 min-w-0">
                          {poll.heading && <p className="text-xs font-bold text-[#13298f] mb-1">{poll.heading}</p>}
                          <h5 className="font-bold text-sm text-[#191c1e] truncate font-headline">{poll.title}</h5>
                          <p className="text-[10px] font-black text-[#757684] uppercase tracking-wider opacity-60">
                             {getTotalVotes(poll.id)} Respondents • {poll.outcome ? `Verdict: ${poll.outcome.toUpperCase()}` : 'Closed'}
                          </p>
                       </div>
                       <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                             <button className="p-2 text-slate-300 hover:text-slate-600">
                                <MoreVertical className="w-4 h-4" />
                             </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-2xl shadow-xl border-none p-2">
                             <DropdownMenuItem onClick={() => setPollToDelete(poll)} className="text-[#ba1a1a] rounded-xl font-bold p-3"><Trash className="w-4 h-4 mr-2" /> Delete Archive</DropdownMenuItem>
                             <DropdownMenuItem onClick={() => setPollToReset(poll)} className="rounded-xl font-bold p-3"><RotateCcw className="w-4 h-4 mr-2" /> Reset Results</DropdownMenuItem>
                             <DropdownMenuSeparator />
                             <DropdownMenuItem onClick={() => togglePollStatus(poll, 'passed')} className="text-[#00583b] rounded-xl font-bold p-3"><CheckCircle2 className="w-4 h-4 mr-2" /> Mark as Passed</DropdownMenuItem>
                             <DropdownMenuItem onClick={() => togglePollStatus(poll, 'failed')} className="text-[#ba1a1a] rounded-xl font-bold p-3"><XCircle className="w-4 h-4 mr-2" /> Mark as Failed</DropdownMenuItem>
                          </DropdownMenuContent>
                       </DropdownMenu>
                    </div>
                 ))}
              </div>
           </div>
        </div>
      </section>

      {/* Participant Tracking Asymmetric Bento */}
      <section className="space-y-8 pb-20">
         <div className="flex items-center gap-4">
            <h2 className="text-3xl font-black text-[#13298f] font-headline">Participant Insights</h2>
            <div className="h-px flex-1 bg-gradient-to-r from-[#e0e3e5] to-transparent"></div>
         </div>
         
         <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-2 bg-white p-10 rounded-[3rem] shadow-sm border border-[#e0e3e5]/70 relative overflow-hidden group">
               <div className="relative z-10 flex flex-col h-full">
                  <div className="flex justify-between items-start mb-10">
                    <div>
                      <h3 className="text-xl font-black text-[#13298f] font-headline mb-2">Real-time Response Heatmap</h3>
                      <p className="text-xs font-semibold text-[#757684] opacity-70 italic">Visualizing peak voting momentum during the session</p>
                    </div>
                    <TrendingUp className="text-[#13298f] w-8 h-8 opacity-20" />
                  </div>
                  
                  <div className="flex-1 grid grid-cols-12 gap-2 items-end min-h-[180px]">
                     {heatmapData.map((h, i) => (
                        <div 
                          key={i} 
                          className="col-span-1 bg-[#13298f]/20 hover:bg-[#13298f] transition-all rounded-t-lg group-hover:scale-y-105" 
                          style={{ height: `${Math.max(h, 5)}%` }}
                        ></div>
                     ))}
                  </div>
                  <div className="flex justify-between mt-6 text-[10px] font-black text-[#757684] uppercase tracking-[0.2em] opacity-60">
                     <span>2 Hours Ago</span>
                     <span>Peak Momentum</span>
                     <span>Current</span>
                  </div>
               </div>
               <div className="absolute -right-16 -top-16 w-64 h-64 bg-[#13298f]/5 rounded-full blur-[100px] pointer-events-none"></div>
            </div>

            <div className="bg-[#13298f] text-white p-10 rounded-[3rem] shadow-2xl relative overflow-hidden group flex flex-col justify-between">
               <div className="relative z-10">
                  <div className="flex items-center gap-4 mb-4">
                    <MapPin className="w-8 h-8 text-[#4edea3]" />
                    <h3 className="font-black text-2xl font-headline italic">Participant Origin</h3>
                  </div>
                  <p className="text-white/60 text-sm font-medium mb-10 leading-relaxed">Top contributing delegates aggregated by geographic regional zones.</p>
                  
                  <div className="space-y-6">
                     {originData.length > 0 ? originData.map((data, idx) => (
                       <RegionStat key={idx} label={data.label} value={data.value} />
                     )) : (
                       <div className="py-4 text-white/40 text-xs font-bold italic">Gathering regional data...</div>
                     )}
                  </div>
               </div>
               
               <div className="mt-12 pt-6 border-t border-white/10 relative z-10">
                  <button className="flex items-center gap-3 font-black text-sm hover:gap-5 transition-all uppercase tracking-widest text-[#4edea3]">
                     Full Demographics <ArrowRight className="w-4 h-4" />
                  </button>
               </div>
               <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.2),_transparent_70%)]"></div>
            </div>
         </div>
      </section>

      {/* Overlays / Modals */}
      <PollModals 
        pollToDelete={pollToDelete} 
        pollToReset={pollToReset}
        setPollToDelete={setPollToDelete}
        setPollToReset={setPollToReset}
        deletePoll={deletePoll}
        resetPoll={resetPoll}
        isResetting={isResetting}
        getTotalVotes={getTotalVotes}
      />
    </div>
  );
};

/* --- Sub Components --- */

const SummaryCard = ({ label, value, icon, badge, badgeColor, color }: any) => (
  <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-[#e0e3e5]/50 hover:shadow-xl hover:scale-[1.02] transition-all group">
    <div className="flex items-center justify-between mb-6">
      <div className={`w-14 h-14 ${color || 'bg-[#13298f]/10 text-[#13298f]'} rounded-2xl flex items-center justify-center shadow-sm`}>
        <span className="material-symbols-outlined text-3xl font-fill">{icon}</span>
      </div>
      {badge && <span className={`text-[10px] font-black ${badgeColor} px-4 py-1.5 rounded-full border border-current opacity-80 uppercase tracking-widest`}>{badge}</span>}
    </div>
    <div className="space-y-1">
      <p className="text-[10px] font-black text-[#757684] uppercase tracking-[0.25em] opacity-80 mb-2 leading-none">{label}</p>
      <h3 className="text-5xl font-black text-[#13298f] font-headline tracking-tighter leading-none">{value}</h3>
    </div>
  </div>
);

const PollItem = ({ poll, results, onToggle, onReset, onDelete, onOpenStage, onShowResults, showDetails }: any) => {
  const totalVotes = results.reduce((t: number, r: any) => t + r.count, 0);
  const options = Array.isArray(poll.options) ? poll.options : [];

  return (
    <div className="space-y-8 animate-fade-in">
       <div className="flex flex-col md:flex-row justify-between items-start gap-8">
          <div className="max-w-xl">
             {poll.heading && <span className="text-[#13298f] font-bold text-xs tracking-widest uppercase mb-2 block">{poll.heading}</span>}
             <h4 className="font-extrabold text-2xl text-[#191c1e] font-headline leading-tight">{poll.title}</h4>
             {poll.description && <p className="text-sm text-[#757684] mt-3 font-medium opacity-80">{poll.description}</p>}
          </div>
          <div className="flex items-center gap-4">
             <div className="text-right flex flex-col items-end">
                <p className="text-[10px] font-black text-[#757684] uppercase tracking-[0.2em] mb-1">Total Votes</p>
                <div className="flex items-center gap-2">
                   <Users className="w-4 h-4 text-[#13298f] opacity-40" />
                   <span className="text-2xl font-black text-[#13298f]">{totalVotes}</span>
                </div>
             </div>
             
             <DropdownMenu>
                <DropdownMenuTrigger asChild>
                   <button className="w-12 h-12 rounded-2xl bg-[#f7f9fb] border border-[#e0e3e5] flex items-center justify-center text-[#757684] hover:bg-slate-50 transition-colors shadow-sm">
                      <MoreVertical className="w-5 h-5" />
                   </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-2xl shadow-2xl border-none p-3 w-56 space-y-1">
                   <DropdownMenuItem onClick={onOpenStage} className="rounded-xl font-bold py-3 p-3"><ExternalLink className="w-4 h-4 mr-3" /> External Display</DropdownMenuItem>
                   <DropdownMenuItem onClick={onShowResults} className="rounded-xl font-bold py-3 p-3"><Eye className="w-4 h-4 mr-3" /> {showDetails ? 'Hide' : 'Detailed'} Results</DropdownMenuItem>
                   <DropdownMenuSeparator className="bg-slate-100" />
                   <DropdownMenuItem onClick={onReset} className="rounded-xl font-bold py-3 p-3"><RotateCcw className="w-4 h-4 mr-3" /> Reset Votes</DropdownMenuItem>
                   <DropdownMenuItem onClick={onDelete} className="text-[#ba1a1a] rounded-xl font-bold py-3 p-3"><Trash className="w-4 h-4 mr-3" /> Delete Permanently</DropdownMenuItem>
                </DropdownMenuContent>
             </DropdownMenu>

             {poll.is_active ? (
               <DropdownMenu>
                 <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all bg-[#ba1a1a] text-white shadow-lg shadow-[#ba1a1a]/20 hover:scale-105">
                       <Pause className="w-4 h-4" /> End Session
                    </button>
                 </DropdownMenuTrigger>
                 <DropdownMenuContent align="end" className="rounded-2xl shadow-2xl border-none p-3 w-56 space-y-1">
                    <div className="px-3 py-2 text-[10px] font-black text-[#757684] uppercase tracking-widest opacity-60">Declare Outcome</div>
                    <DropdownMenuItem onClick={() => onToggle('passed')} className="text-[#00583b] bg-[#4edea3]/10 rounded-xl font-bold py-3 p-3 mb-1">
                       <CheckCircle2 className="w-4 h-4 mr-3" /> Mark as Passed
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onToggle('failed')} className="text-[#ba1a1a] bg-[#ba1a1a]/10 rounded-xl font-bold py-3 p-3">
                       <XCircle className="w-4 h-4 mr-3" /> Mark as Failed
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => onToggle()} className="rounded-xl font-bold py-3 p-3">
                       <Pause className="w-4 h-4 mr-3" /> Archive without Verdict
                    </DropdownMenuItem>
                 </DropdownMenuContent>
               </DropdownMenu>
             ) : (
               <button 
                  onClick={() => onToggle()}
                  className="flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all bg-[#13298f] text-white shadow-lg shadow-[#13298f]/20 hover:scale-105"
               >
                  <Play className="w-4 h-4" /> Start Live
               </button>
             )}
          </div>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {options.map((option: any, idx: number) => {
             const optText = typeof option === 'string' ? option : option.text;
             const voteCount = results.find((r: any) => r.option_id === optText)?.count || 0;
             const percent = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
             const isTop = results.length > 0 && voteCount === Math.max(...results.map((r: any) => r.count)) && voteCount > 0;
             
             return (
                <div key={idx} className={`p-6 rounded-[2rem] border transition-all ${isTop ? 'bg-[#13298f]/5 border-[#13298f]/20' : 'bg-[#f7f9fb] border-[#e0e3e5]/40'}`}>
                   <div className="flex justify-between items-center mb-3">
                      <span className={`text-xs font-black uppercase tracking-wider ${isTop ? 'text-[#13298f]' : 'text-[#757684]'}`}>{optText}</span>
                      <span className={`text-xl font-black ${isTop ? 'text-[#13298f]' : 'text-slate-900'}`}>{percent}%</span>
                   </div>
                   <div className="h-2.5 w-full bg-slate-200/50 rounded-full overflow-hidden shadow-inner">
                      <div className={`h-full rounded-full transition-all duration-1000 ${isTop ? 'bg-[#13298f]' : 'bg-[#13298f]/40'}`} style={{ width: `${percent}%` }}></div>
                   </div>
                   <p className="text-[10px] font-black text-[#757684] mt-2 opacity-60 uppercase tracking-widest">{voteCount} Votes</p>
                </div>
             );
          })}
        </div>

       {showDetails && (
          <div className="mt-8 pt-8 border-t border-slate-100 overflow-hidden animate-in slide-in-from-top duration-500">
             <DetailedPollResults 
                pollId={poll.id} 
                pollTitle={poll.title} 
                options={options.map((opt: any) => typeof opt === 'string' ? { id: opt, text: opt } : opt)} 
                isOrganizer={true}
             />
          </div>
       )}
    </div>
  );
};

const RegionStat = ({ label, value }: { label: string; value: number }) => (
  <div className="space-y-3">
     <div className="flex justify-between items-center text-xs font-black uppercase tracking-[0.2em]">
        <span className="opacity-70">{label}</span>
        <span className="text-[#4edea3]">{value}%</span>
     </div>
     <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
        <div className="h-full bg-[#4edea3] rounded-full transition-all duration-1000" style={{ width: `${value}%` }}></div>
     </div>
  </div>
);

const Toggle = ({ active, onChange }: { active: boolean; onChange: (v: boolean) => void }) => (
   <button 
     type="button"
     onClick={() => onChange(!active)}
     className={`w-12 h-6 rounded-full relative transition-colors duration-300 shadow-inner ${active ? 'bg-[#13298f]' : 'bg-[#e0e3e5]'}`}
   >
      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-md transition-all duration-300 ${active ? 'left-7' : 'left-1'}`}></div>
   </button>
);

const PollModals = ({ pollToDelete, pollToReset, setPollToDelete, setPollToReset, deletePoll, resetPoll, isResetting, getTotalVotes }: any) => (
  <>
    <AlertDialog open={!!pollToDelete} onOpenChange={() => setPollToDelete(null)}>
      <AlertDialogContent className="rounded-[2.5rem] p-10 border-none shadow-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-2xl font-black font-headline text-[#ba1a1a]">Delete Poll Archive?</AlertDialogTitle>
          <AlertDialogDescription className="text-[#757684] font-medium leading-relaxed mt-4">
             Are you absolutely sure you want to delete "{pollToDelete?.title}"? This will permanently remove all historical voting data and participant analytics linked to this session.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-8 gap-4">
          <AlertDialogCancel className="rounded-2xl px-6 font-bold py-4 bg-slate-100 border-none">Cancel</AlertDialogCancel>
          <AlertDialogAction 
             onClick={() => deletePoll(pollToDelete.id)}
             className="bg-[#ba1a1a] hover:bg-[#ba1a1a]/90 rounded-2xl px-8 font-black py-4 uppercase tracking-widest text-xs"
          >
            Confirm Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <AlertDialog open={!!pollToReset} onOpenChange={() => setPollToReset(null)}>
      <AlertDialogContent className="rounded-[2.5rem] p-10 border-none shadow-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-2xl font-black font-headline">Reset Voting Ledger?</AlertDialogTitle>
          <AlertDialogDescription className="text-[#757684] font-medium leading-relaxed mt-4">
             This will wipe all {getTotalVotes(pollToReset?.id)} registered votes for "{pollToReset?.title}". Use this if there was a testing error or if you wish to restart the identical poll for a new session.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-8 gap-4">
          <AlertDialogCancel disabled={isResetting} className="rounded-2xl px-6 font-bold py-4 bg-slate-100 border-none">Cancel</AlertDialogCancel>
          <AlertDialogAction 
            onClick={() => resetPoll(pollToReset.id)}
            disabled={isResetting}
            className="bg-[#13298f] hover:bg-[#13298f]/90 rounded-2xl px-8 font-black py-4 uppercase tracking-widest text-xs"
          >
            {isResetting ? 'Clearing...' : 'Wipe Data'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>
);