import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Users, TrendingUp, Vote } from "lucide-react";
import { LiveVotingStats } from "@/components/student/LiveVotingStats";
import { PostVotingAnalysis } from "@/components/student/PostVotingAnalysis";

interface Poll {
  id: string;
  title: string;
  description?: string;
  options: string[];
  is_active: boolean;
  show_results_publicly: boolean;
  show_post_analysis: boolean;
  created_at: string;
}

interface PollResult {
  option: string;
  count: number;
  percentage: number;
}

const PollDisplay = () => {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [results, setResults] = useState<Record<string, PollResult[]>>({});
  
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActivePolls();
    
    // Real-time updates with more specific channels
    const pollsChannel = supabase
      .channel('polls_channel_display')
      .on(
        'postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'polls' 
        }, 
        (payload) => {
          console.log('Real-time poll change on display:', payload);
          fetchActivePolls();
        }
      )
      .subscribe();

    const votesChannel = supabase
      .channel('votes_channel_display')
      .on(
        'postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'poll_votes' 
        }, 
        (payload) => {
          console.log('Real-time vote change on display:', payload);
          fetchActivePolls();
        }
      )
      .subscribe();

    // Space bar toggle removed; stage display follows organizer stop action.


    return () => {
      supabase.removeChannel(pollsChannel);
      supabase.removeChannel(votesChannel);
    };
  }, []);

  const fetchActivePolls = async () => {
    try {
      // Use public view for unauthenticated access
      const { data: pollsData, error: pollsError } = await supabase
        .from('public_polls')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (pollsError) throw pollsError;
      
      const pollsList = (pollsData || []) as Poll[];
      let effectivePollsList = pollsList;

      // If no active polls, show the most recent poll marked for post-analysis
      if (effectivePollsList.length === 0) {
        const { data: postData, error: postError } = await supabase
          .from('public_polls')
          .select('*')
          .eq('show_post_analysis', true)
          .order('updated_at', { ascending: false })
          .limit(1);
        if (postError) throw postError;
        effectivePollsList = (postData || []) as Poll[];
      }

      setPolls(effectivePollsList);

      // Fetch results for each poll using public view
      const resultsMap: Record<string, PollResult[]> = {};
      
      for (const poll of effectivePollsList) {
        const { data: votesData, error: votesError } = await supabase
          .from('public_poll_votes')
          .select('option_id')
          .eq('poll_id', poll.id);

        if (votesError) throw votesError;

        // Count votes for each option
        const voteCounts: Record<string, number> = {};
        const totalVotes = votesData?.length || 0;

        // Initialize all options with 0 votes
        poll.options.forEach(option => {
          voteCounts[option] = 0;
        });

        // Count actual votes
        votesData?.forEach(vote => {
          const option = vote.option_id as string;
          if (poll.options.includes(option)) {
            voteCounts[option]++;
          }
        });

        // Convert to results with percentages
        const pollResults: PollResult[] = poll.options.map(option => ({
          option,
          count: voteCounts[option],
          percentage: totalVotes > 0 ? (voteCounts[option] / totalVotes) * 100 : 0
        }));

        resultsMap[poll.id] = pollResults;
      }

      setResults(resultsMap);
    } catch (error) {
      console.error('Error fetching polls:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTotalVotes = (pollId: string) => {
    const pollResults = results[pollId] || [];
    return pollResults.reduce((total, result) => total + result.count, 0);
  };

  const getMaxVotes = (pollId: string) => {
    const pollResults = results[pollId] || [];
    return Math.max(...pollResults.map(r => r.count), 0);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 to-purple-700">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-xl">Loading Poll Display...</p>
        </div>
      </div>
    );
  }

  if (!polls.length) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-600 to-gray-800">
        <div className="max-w-2xl w-full mx-auto p-8">
          <Card className="bg-black/20 backdrop-blur-md border-white/20">
            <CardContent className="p-12 text-center text-white">
              <Vote className="w-24 h-24 mx-auto opacity-50 mb-8" />
              <h1 className="text-4xl md:text-6xl font-bold mb-4">
                No Active Polls
              </h1>
              <p className="text-xl opacity-75">
                Waiting for organizer to activate a poll
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // For stage display, show the most recent active poll
  const activePoll = polls[0];
  const pollResults = results[activePoll.id] || [];
  const totalVotes = getTotalVotes(activePoll.id);
  const maxVotes = getMaxVotes(activePoll.id);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="max-w-6xl w-full mx-auto space-y-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-4 mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-3xl flex items-center justify-center shadow-lg">
              <BarChart3 className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-slate-800">
              {activePoll.title}
            </h1>
          </div>
          
          {activePoll.description && (
            <p className="text-xl text-slate-600 mb-6">{activePoll.description}</p>
          )}
          
          <div className="flex justify-center items-center gap-4">
            <Badge className="bg-gradient-to-r from-blue-500 to-purple-500 text-white text-lg px-4 py-2">
              <Users className="w-5 h-5 mr-2" />
              {totalVotes} votes
            </Badge>
            <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white text-lg px-4 py-2">
              <TrendingUp className="w-5 h-5 mr-2" />
              Live Results
            </Badge>
          </div>
        </div>

        {/* Live Voting Statistics */}
        <LiveVotingStats 
          pollId={activePoll.id} 
          showResultsPublicly={activePoll.show_results_publicly}
        />

        {/* Post-Voting Analysis (shown only after organizer presses Stop) */}
        {activePoll.show_post_analysis && (
          <PostVotingAnalysis pollId={activePoll.id} pollTitle={activePoll.title} />
        )}

      </div>
    </div>
  );
};

export default PollDisplay;