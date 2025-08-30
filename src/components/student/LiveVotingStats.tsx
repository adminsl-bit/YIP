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

      // For public display, we don't need total eligible voters count
      // We'll just show vote counts without participation rate
      let totalVoters = 0;

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
      pollOptions.forEach((option: string) => {
        voteCounts[option] = 0;
      });

      // Count actual votes
      (votesData || []).forEach((vote: PollVoteData) => {
        const option = vote.option_id;
        if (voteCounts.hasOwnProperty(option)) {
          voteCounts[option]++;
        }
      });

      const totalVoted = Object.values(voteCounts).reduce((sum, count) => sum + count, 0);
      
      setStats({
        totalEligibleVoters: 0, // Not available in public view
        yesVotes: voteCounts.yes || 0,
        noVotes: voteCounts.no || 0,
        notVoted: 0, // Not available in public view
        participationRate: 0, // Not available in public view
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
      <Card className="bg-white/15 backdrop-blur-lg border border-white/25 shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-teal-500 rounded-2xl flex items-center justify-center shadow-lg">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            Live Voting Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-green-500 border-t-transparent shadow-lg"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!poll) {
    return null;
  }

  // Don't show results to students unless explicitly made public by organizers
  if (showResultsPublicly !== undefined && !showResultsPublicly) {
    return (
      <Card className="bg-white/15 backdrop-blur-lg border border-white/25 shadow-xl">
        <CardContent className="p-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-slate-400 to-slate-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <TrendingUp className="w-8 h-8 text-white" />
            </div>
            <h4 className="text-lg font-semibold text-slate-700 mb-2">Results Hidden</h4>
            <p className="text-slate-600">
              Poll results will be revealed when the organizer makes them public.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalVoted = Object.values(stats.customOptions || {}).reduce((sum, count) => sum + count, 0);

  return (
    <Card className={`bg-white/15 backdrop-blur-lg border border-white/25 shadow-xl transition-all duration-300 ${isLive ? 'ring-2 ring-green-400 shadow-green-400/20' : ''}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-teal-500 rounded-2xl flex items-center justify-center shadow-lg">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            Live Voting Statistics
            {isLive && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                className="px-2 py-1 bg-green-500 text-white text-xs rounded-full font-bold"
              >
                LIVE
              </motion.div>
            )}
          </CardTitle>
          <Badge className="bg-gradient-to-r from-blue-500 to-purple-500 text-white">
            {poll.title}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Overall Participation - Simplified for public display */}
        <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4 border border-white/30">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-bold text-slate-800 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Vote Summary
            </h4>
            <Badge className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold">
              {totalVoted} votes
            </Badge>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-black text-emerald-600">{totalVoted}</div>
              <div className="text-sm text-slate-600">Total Votes Cast</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-black text-blue-600">{poll?.options?.length || 0}</div>
              <div className="text-sm text-slate-600">Options Available</div>
            </div>
          </div>
        </div>

        {/* Vote Breakdown by Option */}
        <div className="space-y-4">
          <h4 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
            <CheckCircle className="w-4 h-4" />
            Vote Results by Option
          </h4>
          
          <AnimatePresence>
            {/* Dynamic Options - Show vote count and percentage of total votes */}
            {poll && Array.isArray(poll.options) && poll.options.map((option: string, index: number) => {
              const voteCount = stats.customOptions?.[option] || 0;
              const percentage = totalVoted > 0 ? (voteCount / totalVoted) * 100 : 0;
              
              // Choose colors based on index
              const colorClasses = [
                { bg: "bg-green-50/50", border: "border-green-200/50", icon: "bg-green-500", text: "text-green-800", count: "text-green-700", percent: "text-green-600", progress: "bg-green-100" },
                { bg: "bg-blue-50/50", border: "border-blue-200/50", icon: "bg-blue-500", text: "text-blue-800", count: "text-blue-700", percent: "text-blue-600", progress: "bg-blue-100" },
                { bg: "bg-purple-50/50", border: "border-purple-200/50", icon: "bg-purple-500", text: "text-purple-800", count: "text-purple-700", percent: "text-purple-600", progress: "bg-purple-100" },
                { bg: "bg-orange-50/50", border: "border-orange-200/50", icon: "bg-orange-500", text: "text-orange-800", count: "text-orange-700", percent: "text-orange-600", progress: "bg-orange-100" },
                { bg: "bg-pink-50/50", border: "border-pink-200/50", icon: "bg-pink-500", text: "text-pink-800", count: "text-pink-700", percent: "text-pink-600", progress: "bg-pink-100" }
              ];
              const colors = colorClasses[index % colorClasses.length];
              
              return (
                <motion.div 
                  key={`option-${index}`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`${colors.bg} backdrop-blur-sm rounded-xl p-4 border ${colors.border}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 ${colors.icon} rounded-lg flex items-center justify-center`}>
                        <CheckCircle className="w-4 h-4 text-white" />
                      </div>
                      <span className={`font-bold ${colors.text}`}>{option}</span>
                    </div>
                    <div className="text-right">
                      <div className={`text-2xl font-black ${colors.count}`}>{voteCount}</div>
                      <div className={`text-xs ${colors.percent}`}>
                        {totalVoted > 0 ? percentage.toFixed(1) : '0'}% of votes
                      </div>
                    </div>
                  </div>
                  <Progress 
                    value={totalVoted > 0 ? percentage : 0} 
                    className={`h-2 ${colors.progress}`}
                  />
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Real-time indicator */}
        <div className="flex items-center justify-center gap-2 text-sm text-slate-600 bg-white/10 rounded-lg p-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span>Real-time updates enabled</span>
        </div>
      </CardContent>
    </Card>
  );
};