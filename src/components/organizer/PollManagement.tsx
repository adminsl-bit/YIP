import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus, Trash, Play, Pause, MoreVertical, ExternalLink,
  Eye, RotateCcw, Users, ArrowRight, TrendingUp, MapPin,
  CheckCircle2, XCircle, Clock
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
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
  const [originData, setOriginData] = useState<{ label: string; value: number }[]>([]);

  const [formData, setFormData] = useState({
    heading: "",
    title: "",
    description: "",
    options: ["", ""],
    showPublicly: true,
    allowMultiple: false,
  });

  useEffect(() => {
    fetchPolls();
    fetchTotalParticipants();
    fetchAggregateInsights();
  }, []);

  useEffect(() => {
    polls.forEach(poll => fetchPollResults(poll.id));
  }, [polls]);

  useEffect(() => {
    const channel = supabase
      .channel('organizer_poll_management_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'poll_votes' }, (payload) => {
        const pollId = (payload as any)?.new?.poll_id || (payload as any)?.old?.poll_id;
        if (pollId) fetchPollResults(pollId);
        fetchAggregateInsights();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'polls' }, () => fetchPolls())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchPolls = async () => {
    try {
      const { data, error } = await supabase.from('polls').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setPolls((data || []) as Poll[]);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const fetchTotalParticipants = async () => {
    const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('user_type', 'student');
    setTotalParticipants(count || 0);
  };

  const fetchAggregateInsights = async () => {
    try {
      const { data, error } = await supabase.from('poll_votes').select(`created_at, voter_id, profiles!inner(state)`);
      if (error || !data || data.length === 0) return;

      const stateCounts: Record<string, number> = {};
      data.forEach((v: any) => {
        const state = v.profiles?.state || 'Unknown';
        stateCounts[state] = (stateCounts[state] || 0) + 1;
      });
      const totalVotes = data.length;
      setOriginData(
        Object.entries(stateCounts)
          .map(([label, count]) => ({ label, value: Math.round((count / totalVotes) * 100) }))
          .sort((a, b) => b.value - a.value).slice(0, 3)
      );

      const now = new Date();
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      const buckets = new Array(12).fill(0);
      const bucketSizeMs = (2 * 60 * 60 * 1000) / 12;
      data.forEach((v: any) => {
        const voteTime = new Date(v.created_at);
        if (voteTime > twoHoursAgo) {
          const diffMs = voteTime.getTime() - twoHoursAgo.getTime();
          buckets[Math.min(11, Math.floor(diffMs / bucketSizeMs))]++;
        }
      });
      const maxVotes = Math.max(...buckets, 1);
      setHeatmapData(buckets.map(c => Math.round((c / maxVotes) * 100)));
    } catch (e) { console.error(e); }
  };

  const fetchPollResults = async (pollId: string) => {
    try {
      const { data, error } = await supabase.from('poll_votes').select('option_id, voter_id').eq('poll_id', pollId);
      if (error) throw error;
      const { data: roleData } = await supabase.from('user_roles').select('user_id, role').in('role', ['journalist', 'admin_student']);
      const excluded = new Set(roleData?.map((r: any) => r.user_id) || []);
      const filtered = data?.filter(v => !excluded.has(v.voter_id)) || [];
      const counts: Record<string, number> = {};
      filtered.forEach(v => { counts[v.option_id] = (counts[v.option_id] || 0) + 1; });
      setPollResults(prev => ({ ...prev, [pollId]: Object.entries(counts).map(([option_id, count]) => ({ option_id, count })) }));
    } catch (e) { console.error(e); }
  };

  const addOption = () => setFormData(prev => ({ ...prev, options: [...prev.options, ""] }));
  const removeOption = (idx: number) => {
    if (formData.options.length > 2)
      setFormData(prev => ({ ...prev, options: prev.options.filter((_, i) => i !== idx) }));
  };
  const updateOption = (idx: number, val: string) =>
    setFormData(prev => ({ ...prev, options: prev.options.map((o, i) => i === idx ? val : o) }));

  const handleCreatePoll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formData.title.trim()) {
      toast({ title: "Error", description: "Question is required", variant: "destructive" }); return;
    }
    const validOptions = formData.options.filter(o => o.trim()).map(o => o.trim());
    if (validOptions.length < 2) {
      toast({ title: "Error", description: "At least 2 options required", variant: "destructive" }); return;
    }
    try {
      const { error } = await supabase.from('polls').insert({
        title: formData.title.trim(),
        heading: formData.heading.trim() || null,
        options: validOptions,
        created_by: user.id,
        is_active: true,
        show_results_publicly: formData.showPublicly,
      });
      if (error) throw error;
      await supabase.from('system_settings').update({ setting_value: true }).eq('setting_key', 'voting_enabled');
      toast({ title: "Poll Launched", description: "Voting is now open for participants." });
      setFormData({ heading: "", title: "", description: "", options: ["", ""], showPublicly: true, allowMultiple: false });
      fetchPolls();
    } catch { toast({ title: "Error", description: "Failed to create poll", variant: "destructive" }); }
  };

  const togglePollStatus = async (poll: Poll, outcome?: 'passed' | 'failed') => {
    const newStatus = !poll.is_active;
    const updateData: any = {
      is_active: newStatus,
      show_results_publicly: newStatus ? true : poll.show_results_publicly,
      show_post_analysis: !newStatus,
    };
    if (outcome) updateData.outcome = outcome;
    const { error } = await supabase.from('polls').update(updateData).eq('id', poll.id);
    if (error) { toast({ title: "Error", description: "Failed to update status", variant: "destructive" }); return; }
    if (newStatus) {
      await supabase.from('system_settings').update({ setting_value: true }).eq('setting_key', 'voting_enabled');
      await supabase.from('polls').update({ outcome: null }).eq('id', poll.id);
    }
    fetchPolls();
    toast({ title: newStatus ? "Poll Active" : "Poll Stopped", description: outcome ? `Resolution marked as ${outcome.toUpperCase()}` : undefined });
  };

  const deletePoll = async (pollId: string) => {
    const { error } = await supabase.from('polls').delete().eq('id', pollId);
    if (error) { toast({ title: "Error", variant: "destructive" }); return; }
    fetchPolls(); setPollToDelete(null);
    toast({ title: "Deleted Successfully" });
  };

  const resetPoll = async (pollId: string) => {
    setIsResetting(true);
    const { error } = await supabase.from('poll_votes').delete().eq('poll_id', pollId);
    setIsResetting(false);
    if (error) { toast({ title: "Error", variant: "destructive" }); return; }
    fetchPollResults(pollId); setPollToReset(null);
    toast({ title: "Poll Votes Cleared" });
  };

  const getTotalVotes = (pollId: string) =>
    (pollResults[pollId] || []).reduce((t, r) => t + r.count, 0);

  const openStageView = (pollId: string) =>
    window.open(`/display/polls?pollId=${pollId}`, `poll_stage_${pollId}`, 'width=1200,height=800');

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center animate-pulse">
          <span className="material-symbols-outlined text-primary text-2xl">how_to_vote</span>
        </div>
      </div>
    );
  }

  const activePolls = polls.filter(p => p.is_active);
  const pastPolls   = polls.filter(p => !p.is_active);
  const totalVotesAcrossAll = Object.values(pollResults).reduce((t, r) => t + r.reduce((st, sr) => st + sr.count, 0), 0);
  const participationRate = totalParticipants > 0
    ? Math.round((totalVotesAcrossAll / (totalParticipants * Math.max(polls.length, 1))) * 100)
    : 0;

  return (
    <div className="space-y-6 pb-4">

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* Left — New Poll form */}
        <div className="lg:col-span-4 bg-white border border-outline-variant/10 rounded-3xl p-6 shadow-sm space-y-5 sticky top-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-primary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>how_to_vote</span>
            </div>
            <div>
              <h3 className="text-sm font-headline font-black text-on-surface">New Poll</h3>
              <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/40 font-headline mt-0.5">Create a vote</p>
            </div>
          </div>

          <form className="space-y-4" onSubmit={handleCreatePoll}>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-on-surface-variant/50 uppercase tracking-[0.3em] font-headline">Heading</label>
              <Input
                value={formData.heading}
                onChange={e => setFormData(p => ({ ...p, heading: e.target.value }))}
                className="bg-surface-container-high border-outline-variant/10 rounded-2xl h-11 text-sm font-bold text-on-surface focus:ring-2 focus:ring-primary/20 focus:border-transparent"
                placeholder="e.g. Constitutional Amendment Act"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-on-surface-variant/50 uppercase tracking-[0.3em] font-headline">Question</label>
              <Textarea
                value={formData.title}
                onChange={e => setFormData(p => ({ ...p, title: e.target.value }))}
                className="bg-surface-container-high border-outline-variant/10 rounded-2xl text-sm font-bold text-on-surface focus:ring-2 focus:ring-primary/20 focus:border-transparent resize-none"
                placeholder="What would you like to ask participants?"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-on-surface-variant/50 uppercase tracking-[0.3em] font-headline">Options</label>
              {formData.options.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2 group">
                  <input
                    value={opt}
                    onChange={e => updateOption(idx, e.target.value)}
                    className="flex-1 bg-surface-container-high border border-outline-variant/10 rounded-2xl px-3 py-2.5 text-sm font-bold text-on-surface focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    placeholder={`Option ${idx + 1}`}
                  />
                  {formData.options.length > 2 && (
                    <button type="button" onClick={() => removeOption(idx)}
                      className="p-1.5 text-on-surface-variant/30 hover:text-error opacity-0 group-hover:opacity-100 transition-all">
                      <Trash className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
              <button type="button" onClick={addOption}
                className="flex items-center gap-1.5 text-primary text-[10px] font-black uppercase tracking-widest font-headline hover:text-primary-container transition-colors mt-1">
                <Plus className="w-3 h-3" /> Add Option
              </button>
            </div>

            <div className="pt-3 border-t border-outline-variant/10 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-on-surface">Show Results Publicly</span>
                <Toggle active={formData.showPublicly} onChange={val => setFormData(p => ({ ...p, showPublicly: val }))} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-on-surface">Allow Multiple Choices</span>
                <Toggle active={formData.allowMultiple} onChange={val => setFormData(p => ({ ...p, allowMultiple: val }))} />
              </div>
            </div>

            <button type="submit"
              className="w-full py-3 rounded-full bg-gradient-to-r from-primary to-primary-container text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all font-headline flex items-center justify-center gap-1.5">
              Launch Poll <span className="material-symbols-outlined text-sm">send</span>
            </button>
          </form>
        </div>

        {/* Right — Active + Past polls */}
        <div className="lg:col-span-8 space-y-5">

          {/* Active polls */}
          <div className="bg-surface-container rounded-3xl p-7 border border-outline-variant/10">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-base font-black font-headline text-on-surface tracking-tight">Active Polls</h2>
                <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/40 font-headline mt-1">Live participant feedback</p>
              </div>
              <div className="flex items-center gap-2.5">
                <span className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-sm ${activePolls.length > 0 ? 'bg-secondary/10 text-secondary border-secondary/20' : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant/10'}`}>
                  {activePolls.length} Live
                </span>
                <button
                  onClick={async () => {
                    const { error } = await supabase.from('system_settings').update({ setting_value: true }).eq('setting_key', 'voting_enabled');
                    if (!error) toast({ title: "Voting Enabled", description: "All participant devices unfrozen." });
                  }}
                  className="px-3 py-1.5 bg-tertiary/10 text-tertiary border border-tertiary/20 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-tertiary/20 transition-colors font-headline"
                >
                  Force Unfreeze
                </button>
              </div>
            </div>

            <div className="space-y-8">
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
                <div className="bg-surface-container-lowest border-2 border-dashed border-outline-variant/20 rounded-3xl p-14 text-center flex flex-col items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-primary/5 flex items-center justify-center">
                    <span className="material-symbols-outlined text-primary/20 text-3xl">how_to_vote</span>
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/40 font-headline">No active polls — launch one from the form</p>
                </div>
              )}
            </div>
          </div>

          {/* Past polls */}
          {pastPolls.length > 0 && (
            <div className="bg-surface-container rounded-3xl p-7 border border-outline-variant/10">
              <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-on-surface-variant/40 font-headline mb-5">Recently Completed</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {pastPolls.slice(0, 4).map(poll => (
                  <div
                    key={poll.id}
                    onClick={() => setShowDetailedResults(poll.id)}
                    className="bg-surface-container-lowest border border-outline-variant/10 p-5 rounded-3xl flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer group relative overflow-hidden"
                  >
                    {poll.outcome && (
                      <div className={`absolute top-0 right-0 px-3 py-1 text-[8px] font-black uppercase tracking-widest rounded-bl-2xl ${poll.outcome === 'passed' ? 'bg-tertiary/20 text-tertiary' : 'bg-error/10 text-error'}`}>
                        {poll.outcome}
                      </div>
                    )}
                    <div className="w-11 h-11 bg-surface-container rounded-2xl flex flex-col items-center justify-center text-on-surface-variant border border-outline-variant/10 shrink-0">
                      <span className="text-[9px] font-black uppercase tracking-tighter leading-none">{new Date(poll.created_at).toLocaleDateString('en-US', { month: 'short' })}</span>
                      <span className="text-lg font-black leading-tight">{new Date(poll.created_at).getDate()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      {poll.heading && <p className="text-[9px] font-black text-primary uppercase tracking-widest mb-0.5">{poll.heading}</p>}
                      <h5 className="font-bold text-sm text-on-surface truncate font-headline">{poll.title}</h5>
                      <p className="text-[9px] font-black text-on-surface-variant/40 uppercase tracking-wider mt-0.5">
                        {getTotalVotes(poll.id)} votes · {poll.outcome ? `Verdict: ${poll.outcome.toUpperCase()}` : 'Closed'}
                      </p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button onClick={e => e.stopPropagation()} className="p-1.5 text-on-surface-variant/30 hover:text-on-surface-variant">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-2xl shadow-xl border-outline-variant/10 p-2 w-52">
                        <DropdownMenuItem onClick={() => setPollToDelete(poll)} className="text-error rounded-xl font-bold p-3"><Trash className="w-4 h-4 mr-2" /> Delete</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setPollToReset(poll)} className="rounded-xl font-bold p-3"><RotateCcw className="w-4 h-4 mr-2" /> Reset Results</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => togglePollStatus(poll, 'passed')} className="text-tertiary rounded-xl font-bold p-3"><CheckCircle2 className="w-4 h-4 mr-2" /> Mark Passed</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => togglePollStatus(poll, 'failed')} className="text-error rounded-xl font-bold p-3"><XCircle className="w-4 h-4 mr-2" /> Mark Failed</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Insights */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

            {/* Heatmap */}
            <div className="md:col-span-2 bg-surface-container rounded-3xl p-7 border border-outline-variant/10 relative overflow-hidden">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-sm font-headline font-black text-on-surface tracking-tight">Response Heatmap</h3>
                  <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/40 font-headline mt-1">Peak voting momentum</p>
                </div>
                <TrendingUp className="text-primary/20 w-6 h-6" />
              </div>
              <div className="flex gap-1.5 items-end h-28">
                {heatmapData.map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-primary/15 hover:bg-primary transition-all rounded-t-lg"
                    style={{ height: `${Math.max(h, 5)}%` }}
                  />
                ))}
              </div>
              <div className="flex justify-between mt-3 text-[9px] font-black text-on-surface-variant/40 uppercase tracking-widest font-headline">
                <span>2h ago</span><span>Peak</span><span>Now</span>
              </div>
            </div>

            {/* Origin */}
            <div className="bg-gradient-to-br from-primary to-primary-container text-white rounded-3xl p-7 relative overflow-hidden flex flex-col justify-between border border-white/5 shadow-xl shadow-primary/20">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-3xl pointer-events-none" />
              <div className="relative z-10">
                <div className="flex items-center gap-2.5 mb-4">
                  <MapPin className="w-5 h-5 text-white/60" />
                  <h3 className="font-headline font-black text-sm text-white">Participant Origin</h3>
                </div>
                <div className="space-y-4">
                  {originData.length > 0 ? originData.map((d, i) => (
                    <div key={i} className="space-y-1.5">
                      <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                        <span className="text-white/70">{d.label}</span>
                        <span className="text-white">{d.value}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-white/60 rounded-full transition-all duration-1000" style={{ width: `${d.value}%` }} />
                      </div>
                    </div>
                  )) : (
                    <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Gathering data…</p>
                  )}
                </div>
              </div>
              <button className="relative z-10 mt-6 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/60 hover:text-white hover:gap-3 transition-all font-headline">
                Full Demographics <ArrowRight className="w-3 h-3" />
              </button>
            </div>

          </div>
        </div>
      </div>

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

/* ── Sub-components ──────────────────────────────────────────────────────── */

const PollItem = ({ poll, results, onToggle, onReset, onDelete, onOpenStage, onShowResults, showDetails }: any) => {
  const totalVotes = results.reduce((t: number, r: any) => t + r.count, 0);
  const options = Array.isArray(poll.options) ? poll.options : [];

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row justify-between items-start gap-4">
        <div className="flex-1 min-w-0">
          {poll.heading && <span className="text-[9px] font-black text-primary uppercase tracking-[0.3em] font-headline mb-1 block">{poll.heading}</span>}
          <h4 className="font-headline font-bold text-base text-on-surface leading-tight">{poll.title}</h4>
          {poll.description && <p className="text-xs text-on-surface-variant/60 mt-1">{poll.description}</p>}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="flex flex-col items-end mr-1">
            <span className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant/40 font-headline">Votes</span>
            <div className="flex items-center gap-1">
              <Users className="w-3 h-3 text-primary/40" />
              <span className="text-lg font-black text-primary font-headline">{totalVotes}</span>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-9 h-9 rounded-2xl bg-surface-container-highest border border-outline-variant/10 flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high transition-colors">
                <MoreVertical className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-2xl shadow-xl border-outline-variant/10 p-2 w-52">
              <DropdownMenuItem onClick={onOpenStage} className="rounded-xl font-bold p-3"><ExternalLink className="w-4 h-4 mr-2" /> External Display</DropdownMenuItem>
              <DropdownMenuItem onClick={onShowResults} className="rounded-xl font-bold p-3"><Eye className="w-4 h-4 mr-2" /> {showDetails ? 'Hide' : 'Show'} Results</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onReset} className="rounded-xl font-bold p-3"><RotateCcw className="w-4 h-4 mr-2" /> Reset Votes</DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete} className="text-error rounded-xl font-bold p-3"><Trash className="w-4 h-4 mr-2" /> Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {poll.is_active ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1.5 px-4 py-2.5 rounded-full font-black text-[10px] uppercase tracking-widest bg-error/10 text-error border border-error/20 hover:bg-error/20 transition-all font-headline">
                  <Pause className="w-3 h-3" /> End
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-2xl shadow-xl border-outline-variant/10 p-2 w-52">
                <div className="px-3 py-1.5 text-[9px] font-black text-on-surface-variant/40 uppercase tracking-widest font-headline">Declare Outcome</div>
                <DropdownMenuItem onClick={() => onToggle('passed')} className="text-tertiary rounded-xl font-bold p-3"><CheckCircle2 className="w-4 h-4 mr-2" /> Mark Passed</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onToggle('failed')} className="text-error rounded-xl font-bold p-3"><XCircle className="w-4 h-4 mr-2" /> Mark Failed</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onToggle()} className="rounded-xl font-bold p-3"><Pause className="w-4 h-4 mr-2" /> Archive No Verdict</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <button onClick={() => onToggle()}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-full font-black text-[10px] uppercase tracking-widest bg-gradient-to-r from-primary to-primary-container text-white shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all font-headline">
              <Play className="w-3 h-3" /> Start
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {options.map((option: any, idx: number) => {
          const optText = typeof option === 'string' ? option : option.text;
          const voteCount = results.find((r: any) => r.option_id === optText)?.count || 0;
          const percent = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
          const isTop = results.length > 0 && voteCount === Math.max(...results.map((r: any) => r.count)) && voteCount > 0;

          return (
            <div key={idx} className={`p-5 rounded-3xl border transition-all ${isTop ? 'bg-primary/5 border-primary/15' : 'bg-surface-container-lowest border-outline-variant/10'}`}>
              <div className="flex justify-between items-center mb-3">
                <span className={`text-xs font-black uppercase tracking-wide font-headline ${isTop ? 'text-primary' : 'text-on-surface-variant'}`}>{optText}</span>
                <span className={`text-xl font-black font-headline ${isTop ? 'text-primary' : 'text-on-surface'}`}>{percent}%</span>
              </div>
              <div className="h-2 w-full bg-surface-container rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-700 ${isTop ? 'bg-primary' : 'bg-primary/30'}`} style={{ width: `${percent}%` }} />
              </div>
              <p className="text-[9px] font-black text-on-surface-variant/40 uppercase tracking-widest font-headline mt-2">{voteCount} votes</p>
            </div>
          );
        })}
      </div>

      {showDetails && (
        <div className="pt-5 border-t border-outline-variant/10">
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

const Toggle = ({ active, onChange }: { active: boolean; onChange: (v: boolean) => void }) => (
  <button
    type="button"
    onClick={() => onChange(!active)}
    className={`w-11 h-6 rounded-full relative transition-colors duration-300 ${active ? 'bg-primary' : 'bg-outline-variant/30'}`}
  >
    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-md transition-all duration-300 ${active ? 'left-6' : 'left-1'}`} />
  </button>
);

const PollModals = ({ pollToDelete, pollToReset, setPollToDelete, setPollToReset, deletePoll, resetPoll, isResetting, getTotalVotes }: any) => (
  <>
    <AlertDialog open={!!pollToDelete} onOpenChange={() => setPollToDelete(null)}>
      <AlertDialogContent className="rounded-3xl p-8 border-outline-variant/10 shadow-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl font-black font-headline text-error">Delete Poll?</AlertDialogTitle>
          <AlertDialogDescription className="text-on-surface-variant font-medium leading-relaxed mt-2">
            This permanently removes "{pollToDelete?.title}" and all its voting data.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-6 gap-3">
          <AlertDialogCancel className="rounded-full px-5 font-bold bg-surface-container border-outline-variant/10">Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => deletePoll(pollToDelete.id)}
            className="bg-error hover:bg-error/90 rounded-full px-6 font-black uppercase tracking-widest text-xs">
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <AlertDialog open={!!pollToReset} onOpenChange={() => setPollToReset(null)}>
      <AlertDialogContent className="rounded-3xl p-8 border-outline-variant/10 shadow-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl font-black font-headline text-on-surface">Reset Votes?</AlertDialogTitle>
          <AlertDialogDescription className="text-on-surface-variant font-medium leading-relaxed mt-2">
            This will wipe all {getTotalVotes(pollToReset?.id)} votes for "{pollToReset?.title}". The poll itself remains.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-6 gap-3">
          <AlertDialogCancel disabled={isResetting} className="rounded-full px-5 font-bold bg-surface-container border-outline-variant/10">Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => resetPoll(pollToReset.id)} disabled={isResetting}
            className="bg-primary hover:bg-primary/90 rounded-full px-6 font-black uppercase tracking-widest text-xs">
            {isResetting ? 'Clearing…' : 'Wipe Votes'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>
);
