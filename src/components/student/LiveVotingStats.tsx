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
        .channel('poll_votes_changes')
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
      
      // Fetch poll details
      const { data: pollData, error: pollError } = await supabase
        .from('polls')
        .select('*')
        .eq('id', pollId)
        .single();

      if (pollError) throw pollError;
      setPoll(pollData as Poll);

      // Fetch total eligible voters (students)
      const { count: totalVoters, error: votersError } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('user_type', 'student')
        .eq('is_active', true);

      if (votersError) throw votersError;

      // Fetch all votes for this poll
      const { data: votesData, error: votesError } = await supabase
        .from('poll_votes')
        .select('option_id, voter_id')
        .eq('poll_id', pollId);

      if (votesError) throw votesError;

      // Count votes by option
      const voteCounts = {
        yes: 0,
        no: 0
      };

      (votesData || []).forEach((vote: PollVoteData) => {
        const option = vote.option_id.toLowerCase();
        if (option.includes('yes')) voteCounts.yes++;
        else if (option.includes('no')) voteCounts.no++;
      });

      const totalVoted = voteCounts.yes + voteCounts.no;
      const notVoted = (totalVoters || 0) - totalVoted;
      const participationRate = totalVoters ? (totalVoted / totalVoters) * 100 : 0;

      setStats({
        totalEligibleVoters: totalVoters || 0,
        yesVotes: voteCounts.yes,
        noVotes: voteCounts.no,
        notVoted: Math.max(0, notVoted),
        participationRate
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

  const totalVoted = stats.yesVotes + stats.noVotes;

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
        {/* Overall Participation */}
        <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4 border border-white/30">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-bold text-slate-800 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Participation Overview
            </h4>
            <Badge className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold">
              {stats.participationRate.toFixed(1)}%
            </Badge>
          </div>
          
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-black text-slate-800">{stats.totalEligibleVoters}</div>
              <div className="text-sm text-slate-600">Total Students</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-black text-emerald-600">{totalVoted}</div>
              <div className="text-sm text-slate-600">Have Voted</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-black text-orange-600">{stats.notVoted}</div>
              <div className="text-sm text-slate-600">Not Voted</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-black text-blue-600">{stats.participationRate.toFixed(1)}%</div>
              <div className="text-sm text-slate-600">Participation</div>
            </div>
          </div>
          
          <Progress 
            value={stats.participationRate} 
            className="h-3 bg-white/30"
          />
        </div>

        {/* Vote Breakdown */}
        <div className="space-y-4">
          <h4 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
            <CheckCircle className="w-4 h-4" />
            Vote Breakdown
          </h4>
          
          <AnimatePresence>
            {/* YES Votes */}
            <motion.div 
              key="yes-votes"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-green-50/50 backdrop-blur-sm rounded-xl p-4 border border-green-200/50"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                    <CheckCircle className="w-4 h-4 text-white" />
                  </div>
                  <span className="font-bold text-green-800">YES</span>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black text-green-700">{stats.yesVotes}</div>
                  <div className="text-sm text-green-600">
                    {stats.totalEligibleVoters > 0 ? ((stats.yesVotes / stats.totalEligibleVoters) * 100).toFixed(1) : 0}% of total
                  </div>
                </div>
              </div>
              <Progress 
                value={stats.totalEligibleVoters > 0 ? (stats.yesVotes / stats.totalEligibleVoters) * 100 : 0} 
                className="h-2 bg-green-100"
              />
            </motion.div>

            {/* NO Votes */}
            <motion.div 
              key="no-votes"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-red-50/50 backdrop-blur-sm rounded-xl p-4 border border-red-200/50"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center">
                    <XCircle className="w-4 h-4 text-white" />
                  </div>
                  <span className="font-bold text-red-800">NO</span>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black text-red-700">{stats.noVotes}</div>
                  <div className="text-sm text-red-600">
                    {stats.totalEligibleVoters > 0 ? ((stats.noVotes / stats.totalEligibleVoters) * 100).toFixed(1) : 0}% of total
                  </div>
                </div>
              </div>
              <Progress 
                value={stats.totalEligibleVoters > 0 ? (stats.noVotes / stats.totalEligibleVoters) * 100 : 0} 
                className="h-2 bg-red-100"
              />
            </motion.div>

            {/* NOT VOTED */}
            <motion.div 
              key="not-voted"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-orange-50/50 backdrop-blur-sm rounded-xl p-4 border border-orange-200/50"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
                    <Clock className="w-4 h-4 text-white" />
                  </div>
                  <span className="font-bold text-orange-800">NOT VOTED</span>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black text-orange-700">{stats.notVoted}</div>
                  <div className="text-sm text-orange-600">
                    {stats.totalEligibleVoters > 0 ? ((stats.notVoted / stats.totalEligibleVoters) * 100).toFixed(1) : 0}% of total
                  </div>
                </div>
              </div>
              <Progress 
                value={stats.totalEligibleVoters > 0 ? (stats.notVoted / stats.totalEligibleVoters) * 100 : 0} 
                className="h-2 bg-orange-100"
              />
            </motion.div>
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