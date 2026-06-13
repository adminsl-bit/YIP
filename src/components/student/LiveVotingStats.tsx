import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Users, TrendingUp, Clock, CheckCircle, XCircle, Minus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useSystemSettings } from "@/hooks/useSystemSettings";

interface VotingStats {
  totalEligibleVoters: number;
  yesVotes: number;
  noVotes: number;
  notVoted: number;
  participationRate: number;
  customOptions?: Record<string, number>;
}

interface Poll {
  id: string;
  title: string;
  description?: string;
  options: any; // JSON field from Supabase
  is_active: boolean;
  created_at: string;
}

interface PollVoteData {
  poll_id: string;
  option_id: string;
  voter_id: string;
}

interface LiveVotingStatsProps {
  pollId?: string;
  refreshTrigger?: number;
  showResultsPublicly?: boolean;
}

export const LiveVotingStats = ({ pollId, refreshTrigger, showResultsPublicly }: LiveVotingStatsProps) => {
  const { settings } = useSystemSettings();
  const [stats, setStats] = useState<VotingStats>({
    totalEligibleVoters: 0,
    yesVotes: 0,
    noVotes: 0,
    notVoted: 0,
    participationRate: 0
  });
  const [poll, setPoll] = useState<Poll | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    if (pollId) {
      fetchPollAndStats();
      
      // Set up real-time subscription for vote changes
      const channel = supabase
        .channel(`poll_votes_${pollId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'poll_votes',
            filter: `poll_id=eq.${pollId}`
          },
          () => {
            fetchPollAndStats(); // Refresh stats on any vote change
            setIsLive(true);
            setTimeout(() => setIsLive(false), 1000); // Flash effect
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'polls',
            filter: `id=eq.${pollId}`
          },
          () => {
            fetchPollAndStats();
          }
        )
        .subscribe();

      // Fallback polling: kiosk/TV displays stay open for hours and the realtime
      // websocket can silently drop, leaving the screen stuck on stale vote counts.
      const pollInterval = setInterval(fetchPollAndStats, 15000);

      return () => {
        supabase.removeChannel(channel);
        clearInterval(pollInterval);
      };
    }
  }, [pollId]);

  useEffect(() => {
    if (refreshTrigger && pollId) {
      fetchPollAndStats();
    }
  }, [refreshTrigger]);

  const fetchPollAndStats = async () => {
    if (!pollId) return;
    
    try {
      setLoading(true);
      
      // Try authenticated query first, fall back to public view
      let pollData, pollError;
      
      try {
        // Try authenticated query first
        const result = await supabase
          .from('polls')
          .select('*')
          .eq('id', pollId)
          .single();
        pollData = result.data;
        pollError = result.error;
      } catch (authError) {
        // Fall back to public view if authentication fails
        const result = await supabase
          .from('public_polls')
          .select('*')
          .eq('id', pollId)
          .single();
        pollData = result.data;
        pollError = result.error;
      }

      if (pollError) throw pollError;
      setPoll(pollData as Poll);

      // Get total student count for participation stats
      let totalVoters = 0;
      try {
        // Try to get total student count for participation stats
        const { data: totalCount, error: countError } = await supabase.rpc('get_total_active_students');
        if (!countError && totalCount !== null) {
          totalVoters = totalCount;
        }
      } catch {
        // participation stats total unavailable; continue with partial count
      }

      // Fetch all votes for this poll with hybrid approach
      let votesData, votesError;
      
      try {
        // Try authenticated query first
        const result = await supabase
          .from('poll_votes')
          .select('option_id, voter_id')
          .eq('poll_id', pollId);
        votesData = result.data;
        votesError = result.error;
      } catch (authError) {
        // Fall back to public view
        const result = await supabase
          .from('public_poll_votes')
          .select('option_id, voter_id')
          .eq('poll_id', pollId);
        votesData = result.data;
        votesError = result.error;
      }

      if (votesError) throw votesError;

      // Exclude journalist/admin_student votes so counts match the public-facing totals
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('role', ['journalist', 'admin_student']);
      const excludedVoterIds = new Set((roleData || []).map((r: { user_id: string }) => r.user_id));
      const filteredVotes = (votesData || []).filter((v: PollVoteData) => !excludedVoterIds.has(v.voter_id));

      // Count votes by option - handle custom options dynamically
      const voteCounts: Record<string, number> = {};
      const pollOptions = Array.isArray(pollData.options) ? pollData.options : [];

      // Initialize all options with 0 votes
      pollOptions.forEach((option: any) => {
        const optionKey = typeof option === 'string' ? option : option.id;
        voteCounts[optionKey] = 0;
      });

      // Count actual votes
      filteredVotes.forEach((vote: PollVoteData) => {
        const option = vote.option_id;
        if (voteCounts.hasOwnProperty(option)) {
          voteCounts[option]++;
        }
      });

      const totalVoted = Object.values(voteCounts).reduce((sum, count) => sum + count, 0);
      const notVoted = Math.max(0, totalVoters - totalVoted);
      const participationRate = totalVoters > 0 ? (totalVoted / totalVoters) * 100 : 0;
      
      setStats({
        totalEligibleVoters: totalVoters,
        yesVotes: voteCounts.yes || 0,
        noVotes: voteCounts.no || 0,
        notVoted: notVoted,
        participationRate: participationRate,
        customOptions: voteCounts
      });

    } catch (error) {
      console.error('Error fetching voting stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-surface-container-lowest rounded-[4rem] shadow-2xl p-16 flex flex-col items-center justify-center min-h-[400px] border border-outline-variant/10">
        <div className="relative w-20 h-20 mb-10">
          <div className="absolute inset-0 rounded-full border-4 border-primary/10"></div>
          <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
        </div>
        <p className="font-display font-bold text-primary uppercase tracking-[0.2em] text-label-md animate-pulse">Syncing with Assembly...</p>
      </div>
    );
  }

  if (!poll) {
    return null;
  }

  // Determine visibility from prop or fetched poll data, always subject to the
  // organizer's global "Show Results Publicly" override.
  const isPublic = ((typeof showResultsPublicly === 'boolean')
    ? showResultsPublicly
    : (poll as any)?.show_results_publicly === true) && settings.results_public;

  if (!isPublic) {
    return (
      <div className="bg-surface-container-lowest border border-outline-variant/10 shadow-2xl rounded-[4rem] overflow-hidden">
        <div className="p-20">
          <div className="text-center max-w-md mx-auto">
            <div className="w-28 h-28 bg-surface-container-high rounded-[2.5rem] flex items-center justify-center mx-auto mb-10 shadow-inner">
              <TrendingUp className="w-14 h-14 text-on-surface-variant/20" />
            </div>
            <h4 className="font-display text-display-sm font-bold text-on-surface mb-6 uppercase italic tracking-tight">Results are Sealed</h4>
            <p className="font-body text-body-lg text-on-surface-variant/60 leading-relaxed">
              The poll results are currently private. They will be revealed once the House Organizer makes them public.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const totalVoted = Object.values(stats.customOptions || {}).reduce((sum, count) => sum + count, 0);

  return (
    <div className={`bg-surface-container-lowest border border-outline-variant/10 shadow-2xl rounded-[4rem] overflow-hidden transition-all duration-700 ${isLive ? 'ring-4 ring-primary/10' : ''}`}>
      <div className="p-12 lg:p-14 pb-0">
        <div className="flex items-center justify-between flex-wrap gap-8">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-primary/10 rounded-[1.5rem] flex items-center justify-center border border-primary/20 shadow-sm">
              <TrendingUp className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h3 className="font-display text-display-sm font-bold text-on-surface uppercase italic tracking-tight">
                Live Analytics
              </h3>
              <p className="text-label-md font-bold text-primary uppercase tracking-[0.2em] mt-1.5">Assembly Pulse</p>
            </div>
            {isLive && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="px-6 py-2 bg-tertiary/10 text-tertiary text-label-sm uppercase tracking-widest rounded-full font-black border border-tertiary/20 flex items-center gap-3 ml-3"
              >
                <div className="w-2.5 h-2.5 bg-tertiary rounded-full animate-pulse"></div>
                Live
              </motion.div>
            )}
          </div>
          <Badge className="bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant border-none px-8 py-3 rounded-full font-display font-bold uppercase tracking-widest text-body-sm transition-colors">
            {poll.title}
          </Badge>
        </div>
      </div>
      
      <div className="p-12 lg:p-14 space-y-12">
        {/* Overall Participation */}
        <div className="bg-surface-container-low rounded-[3rem] p-12 border border-outline-variant/5">
          <div className="flex items-center justify-between mb-10">
            <h4 className="font-display text-display-xs font-bold text-on-surface flex items-center gap-5 uppercase italic">
              <Users className="w-8 h-8 text-primary" />
              House Turnout
            </h4>
            <div className="px-6 py-2.5 bg-primary/10 text-primary text-label-lg font-black rounded-full border border-primary/20">
              {stats.participationRate.toFixed(1)}%
            </div>
          </div>
          
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
            <div className="space-y-3">
              <div className="text-label-sm font-bold uppercase tracking-[0.2em] text-on-surface-variant/40">Total Delegates</div>
              <div className="text-display-md font-display font-black text-on-surface tracking-tighter italic">{stats.totalEligibleVoters}</div>
            </div>
            <div className="space-y-3">
              <div className="text-label-sm font-bold uppercase tracking-[0.2em] text-on-surface-variant/40">Votes Cast</div>
              <div className="text-display-md font-display font-black text-tertiary tracking-tighter italic">{totalVoted}</div>
            </div>
            <div className="space-y-3">
              <div className="text-label-sm font-bold uppercase tracking-[0.2em] text-on-surface-variant/40">Pending</div>
              <div className="text-display-md font-display font-black text-secondary tracking-tighter italic">{stats.notVoted}</div>
            </div>
            <div className="space-y-3">
              <div className="text-label-sm font-bold uppercase tracking-[0.2em] text-on-surface-variant/40">Quorum Rate</div>
              <div className="text-display-md font-display font-black text-primary tracking-tighter italic">{stats.participationRate.toFixed(1)}%</div>
            </div>
          </div>
          
          <div className="relative h-5 w-full bg-surface-container-high rounded-full overflow-hidden shadow-inner">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${stats.participationRate}%` }}
              transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-primary to-primary-container shadow-sm"
            />
          </div>
        </div>

        {/* Vote Summary Cards */}
        <div className="bg-surface-container-low rounded-[3rem] p-12 border border-outline-variant/5">
          <h4 className="font-display text-display-xs font-bold text-on-surface flex items-center gap-5 mb-10 uppercase italic">
            <CheckCircle className="w-8 h-8 text-tertiary" />
            Voter Alignment
          </h4>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {poll && Array.isArray(poll.options) && poll.options.map((option: any, index: number) => {
              const optionKey = typeof option === 'string' ? option : option.id;
              const optionText = typeof option === 'string' ? option : option.text;
              const voteCount = stats.customOptions?.[optionKey] || 0;
              const percentageOfTotal = stats.totalEligibleVoters > 0 ? (voteCount / stats.totalEligibleVoters) * 100 : 0;
              
              const colorSets = [
                { bg: "bg-primary/5", icon: "bg-primary", text: "text-primary", border: "border-primary/10" },
                { bg: "bg-tertiary/5", icon: "bg-tertiary", text: "text-tertiary", border: "border-tertiary/10" },
                { bg: "bg-secondary/5", icon: "bg-secondary", text: "text-secondary", border: "border-secondary/10" },
                { bg: "bg-on-surface-variant/5", icon: "bg-on-surface-variant", text: "text-on-surface-variant", border: "border-on-surface-variant/10" },
              ];
              const colors = colorSets[index % colorSets.length];
              
              return (
                <div key={optionKey} className={`${colors.bg} rounded-[2.5rem] p-10 flex flex-col items-center border ${colors.border} transition-all duration-500 hover:shadow-xl hover:-translate-y-1`}>
                  <div className={`w-20 h-20 ${colors.icon} rounded-[1.5rem] flex items-center justify-center mb-6 shadow-lg`}>
                    <span className="text-on-primary font-display font-black text-3xl italic">{voteCount}</span>
                  </div>
                  <div className={`font-display font-bold ${colors.text} text-center uppercase italic mb-3 truncate w-full text-display-xs tracking-tight`}>{optionText}</div>
                  <div className="text-label-md font-bold text-on-surface-variant/40 uppercase tracking-[0.1em]">
                    {percentageOfTotal.toFixed(1)}% Delegates
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Vote Breakdown by Option */}
        <div className="space-y-10 px-6">
          <h4 className="font-display text-display-xs font-bold text-on-surface flex items-center gap-5 uppercase italic">
            <TrendingUp className="w-8 h-8 text-primary" />
            Legislative Trajectory
          </h4>
          
          <AnimatePresence>
            <div className="space-y-10">
              {poll && Array.isArray(poll.options) && poll.options.map((option: any, index: number) => {
                const optionKey = typeof option === 'string' ? option : option.id;
                const optionText = typeof option === 'string' ? option : option.text;
                const voteCount = stats.customOptions?.[optionKey] || 0;
                const percentageOfVotes = totalVoted > 0 ? (voteCount / totalVoted) * 100 : 0;
                
                const barColors = [
                  "bg-primary",
                  "bg-tertiary",
                  "bg-secondary",
                  "bg-on-surface-variant",
                ];
                const color = barColors[index % barColors.length];
                
                return (
                  <motion.div 
                    key={`option-${index}`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                    className="space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-display font-bold text-on-surface flex items-center gap-4 uppercase italic tracking-tight text-title-md">
                        <div className={`w-4 h-4 rounded-full ${color} shadow-sm`} />
                        {optionText}
                      </span>
                      <div className="flex items-baseline gap-3">
                        <span className="font-display font-black text-on-surface text-display-xs italic">{voteCount}</span>
                        <span className="text-label-md font-bold text-on-surface-variant/40 uppercase tracking-widest">({percentageOfVotes.toFixed(1)}%)</span>
                      </div>
                    </div>
                    <div className="relative h-4 w-full bg-surface-container-high rounded-full overflow-hidden shadow-inner">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${percentageOfVotes}%` }}
                        transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
                        className={`absolute top-0 left-0 h-full ${color} shadow-sm`}
                      />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </AnimatePresence>
        </div>

        {/* Real-time indicator */}
        <div className="flex items-center justify-center gap-5 py-10 border-t border-outline-variant/5 font-display text-label-md text-on-surface-variant/40 uppercase tracking-[0.3em] italic">
          <div className="relative flex items-center justify-center w-4 h-4">
            <div className="absolute w-full h-full bg-tertiary rounded-full animate-ping opacity-30"></div>
            <div className="relative w-2.5 h-2.5 bg-tertiary rounded-full"></div>
          </div>
          <span>Parliamentary Sync Active</span>
        </div>
      </div>
    </div>

  );
};