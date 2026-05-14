import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Users, TrendingUp, Clock, CheckCircle, XCircle, Minus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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
          (payload) => {
            console.log('Real-time vote change:', payload);
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
          (payload) => {
            console.log('Real-time poll change:', payload);
            fetchPollAndStats(); // Refresh stats on poll changes
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
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
      } catch (error) {
        console.log('Could not fetch total student count for participation stats');
      }

      // Fetch all votes for this poll with hybrid approach
      let votesData, votesError;
      
      try {
        // Try authenticated query first
        const result = await supabase
          .from('poll_votes')
          .select('option_id')
          .eq('poll_id', pollId);
        votesData = result.data;
        votesError = result.error;
      } catch (authError) {
        // Fall back to public view
        const result = await supabase
          .from('public_poll_votes')
          .select('option_id')
          .eq('poll_id', pollId);
        votesData = result.data;
        votesError = result.error;
      }

      if (votesError) throw votesError;

      // Count votes by option - handle custom options dynamically
      const voteCounts: Record<string, number> = {};
      const pollOptions = Array.isArray(pollData.options) ? pollData.options : [];
      
      // Initialize all options with 0 votes
      pollOptions.forEach((option: any) => {
        const optionKey = typeof option === 'string' ? option : option.id;
        voteCounts[optionKey] = 0;
      });

      // Count actual votes
      (votesData || []).forEach((vote: PollVoteData) => {
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
      <Card className="bg-surface-container-lowest border-none shadow-elevated rounded-[1.5rem] overflow-hidden">
        <CardHeader className="p-8 pb-4">
          <CardTitle className="flex items-center gap-4 font-headline text-2xl tracking-tight text-on-surface">
            <div className="w-12 h-12 bg-gradient-to-br from-primary to-primary-container rounded-[0.75rem] flex items-center justify-center shadow-primary">
              <TrendingUp className="w-6 h-6 text-on-primary" />
            </div>
            Live Voting Statistics
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8 pt-4">
          <div className="flex flex-col items-center justify-center h-48 gap-4">
            <div className="relative w-12 h-12">
              <div className="absolute inset-0 rounded-full border-4 border-primary/20"></div>
              <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
            </div>
            <p className="font-body text-on-surface-variant animate-pulse">Syncing with the assembly...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!poll) {
    return null;
  }

  // Determine visibility from prop or fetched poll data
  const isPublic = (typeof showResultsPublicly === 'boolean') 
    ? showResultsPublicly 
    : (poll as any)?.show_results_publicly === true;

  if (!isPublic) {
    return (
      <Card className="bg-surface-container-lowest border-none shadow-elevated rounded-[1.5rem] overflow-hidden">
        <CardContent className="p-12">
          <div className="text-center max-w-sm mx-auto">
            <div className="w-20 h-20 bg-surface-container-high rounded-[1rem] flex items-center justify-center mx-auto mb-6 shadow-sm">
              <TrendingUp className="w-10 h-10 text-on-surface-variant opacity-40" />
            </div>
            <h4 className="font-headline text-2xl font-bold text-on-surface mb-3 tracking-tight">Results are Sealed</h4>
            <p className="font-body text-on-surface-variant leading-relaxed">
              The poll results are currently private. They will be revealed once the House Organizer makes them public.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalVoted = Object.values(stats.customOptions || {}).reduce((sum, count) => sum + count, 0);

  return (
    <Card className={`bg-surface-container-lowest border-none shadow-elevated rounded-[1.5rem] overflow-hidden transition-all duration-500 ${isLive ? 'ring-2 ring-primary/20 shadow-glow' : ''}`}>
      <CardHeader className="p-8 pb-0">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <CardTitle className="flex items-center gap-4 font-headline text-2xl tracking-tight text-on-surface">
            <div className="w-12 h-12 bg-gradient-to-br from-primary to-primary-container rounded-[0.75rem] flex items-center justify-center shadow-primary">
              <TrendingUp className="w-6 h-6 text-on-primary" />
            </div>
            <span className="hidden sm:inline">Live Voting Statistics</span>
            <span className="sm:hidden text-xl">Live Stats</span>
            {isLive && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="px-3 py-1 bg-tertiary/10 text-tertiary text-[10px] uppercase tracking-widest rounded-full font-black border border-tertiary/20 flex items-center gap-1.5"
              >
                <div className="w-1.5 h-1.5 bg-tertiary rounded-full animate-pulse"></div>
                Live
              </motion.div>
            )}
          </CardTitle>
          <Badge className="bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant border-none px-4 py-1.5 rounded-full font-body font-medium transition-colors">
            {poll.title}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Overall Participation */}
        <div className="bg-surface-container-low rounded-[1.25rem] p-6 border-none">
          <div className="flex items-center justify-between mb-6">
            <h4 className="font-headline text-lg font-bold text-on-surface flex items-center gap-2.5">
              <Users className="w-5 h-5 text-primary" />
              Participation Overview
            </h4>
            <div className="px-3 py-1 bg-primary/10 text-primary text-sm font-black rounded-full border border-primary/20">
              {stats.participationRate.toFixed(1)}%
            </div>
          </div>
          
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="space-y-1">
              <div className="text-sm font-body font-medium text-on-surface-variant">Total Eligible</div>
              <div className="text-3xl font-headline font-black text-on-surface tracking-tighter">{stats.totalEligibleVoters}</div>
            </div>
            <div className="space-y-1">
              <div className="text-sm font-body font-medium text-on-surface-variant">Votes Cast</div>
              <div className="text-3xl font-headline font-black text-tertiary tracking-tighter">{totalVoted}</div>
            </div>
            <div className="space-y-1">
              <div className="text-sm font-body font-medium text-on-surface-variant">Pending</div>
              <div className="text-3xl font-headline font-black text-secondary tracking-tighter">{stats.notVoted}</div>
            </div>
            <div className="space-y-1">
              <div className="text-sm font-body font-medium text-on-surface-variant">Rate</div>
              <div className="text-3xl font-headline font-black text-primary tracking-tighter">{stats.participationRate.toFixed(1)}%</div>
            </div>
          </div>
          
          <div className="relative h-3 w-full bg-surface-container-high rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${stats.participationRate}%` }}
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-primary to-primary-container"
            />
          </div>
        </div>

        {/* Vote Summary Cards */}
        <div className="bg-surface-container-low rounded-[1.25rem] p-6 border-none">
          <h4 className="font-headline text-lg font-bold text-on-surface flex items-center gap-2.5 mb-6">
            <CheckCircle className="w-5 h-5 text-tertiary" />
            Vote Distribution Summary
          </h4>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {poll && Array.isArray(poll.options) && poll.options.map((option: any, index: number) => {
              const optionKey = typeof option === 'string' ? option : option.id;
              const optionText = typeof option === 'string' ? option : option.text;
              const voteCount = stats.customOptions?.[optionKey] || 0;
              const percentageOfTotal = stats.totalEligibleVoters > 0 ? (voteCount / stats.totalEligibleVoters) * 100 : 0;
              
              const colorSets = [
                { bg: "bg-primary/10", icon: "bg-primary", text: "text-primary", border: "border-primary/20" },
                { bg: "bg-tertiary/10", icon: "bg-tertiary", text: "text-tertiary", border: "border-tertiary/20" },
                { bg: "bg-secondary/10", icon: "bg-secondary", text: "text-secondary", border: "border-secondary/20" },
                { bg: "bg-on-surface-variant/10", icon: "bg-on-surface-variant", text: "text-on-surface-variant", border: "border-on-surface-variant/20" },
              ];
              const colors = colorSets[index % colorSets.length];
              
              return (
                <div key={optionKey} className={`${colors.bg} rounded-[1rem] p-5 flex flex-col items-center border ${colors.border} transition-transform hover:scale-[1.02]`}>
                  <div className={`w-14 h-14 ${colors.icon} rounded-full flex items-center justify-center mb-3 shadow-sm`}>
                    <span className="text-on-primary font-headline font-black text-xl">{voteCount}</span>
                  </div>
                  <div className={`font-headline font-bold ${colors.text} text-center capitalize mb-1 truncate w-full`}>{optionText}</div>
                  <div className="text-xs font-body font-medium text-on-surface-variant opacity-70">
                    {percentageOfTotal.toFixed(1)}% of students
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Vote Breakdown by Option */}
        <div className="space-y-6">
          <h4 className="font-headline text-lg font-bold text-on-surface flex items-center gap-2.5">
            <TrendingUp className="w-5 h-5 text-primary" />
            Detailed Breakdown
          </h4>
          
          <AnimatePresence>
            <div className="space-y-4">
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
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="space-y-2"
                  >
                    <div className="flex items-center justify-between font-body text-sm">
                      <span className="font-bold text-on-surface flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${color}`} />
                        {optionText}
                      </span>
                      <div className="space-x-2">
                        <span className="font-black text-on-surface">{voteCount} votes</span>
                        <span className="text-on-surface-variant opacity-60">({percentageOfVotes.toFixed(1)}%)</span>
                      </div>
                    </div>
                    <div className="relative h-2 w-full bg-surface-container-high rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${percentageOfVotes}%` }}
                        className={`absolute top-0 left-0 h-full ${color}`}
                      />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </AnimatePresence>
        </div>

        {/* Real-time indicator */}
        <div className="flex items-center justify-center gap-2.5 py-4 border-t border-surface-container font-body text-sm text-on-surface-variant opacity-60">
          <div className="relative flex items-center justify-center w-2.5 h-2.5">
            <div className="absolute w-full h-full bg-tertiary rounded-full animate-ping opacity-25"></div>
            <div className="relative w-1.5 h-1.5 bg-tertiary rounded-full"></div>
          </div>
          <span>Synchronized with Parliamentary Live Stream</span>
        </div>
      </CardContent>
    </Card>
  );
};