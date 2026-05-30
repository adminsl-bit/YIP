import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Users, TrendingUp, Vote, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LiveVotingStats } from "@/components/student/LiveVotingStats";
import { PostVotingAnalysis } from "@/components/student/PostVotingAnalysis";
import { DetailedPollResults } from "@/components/student/DetailedPollResults";
import { BreakingNewsTicker } from "@/components/display/BreakingNewsTicker";

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
  const [showDetailedResults, setShowDetailedResults] = useState(false);
  const [loading, setLoading] = useState(true);
  const [specificPollId, setSpecificPollId] = useState<string | null>(null);

  useEffect(() => {
    // Check if a specific poll ID is requested via URL parameter
    const params = new URLSearchParams(window.location.search);
    const pollId = params.get('pollId');
    if (pollId) {
      setSpecificPollId(pollId);
    }
  }, []);

  useEffect(() => {
    fetchActivePolls();

    const timestamp = Date.now();
    const pollsChannelName = `polls_display_${timestamp}`;
    const votesChannelName = `votes_display_${timestamp}`;

    const pollsChannel = supabase
      .channel(pollsChannelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'polls' }, () => {
        fetchActivePolls();
      })
      .subscribe();

    const votesChannel = supabase
      .channel(votesChannelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'poll_votes' }, async () => {
        await fetchActivePolls();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(pollsChannel);
      supabase.removeChannel(votesChannel);
    };
  }, [specificPollId]);

  const fetchActivePolls = async () => {
    try {
      // Try authenticated query first, fall back to public view
      let pollsData, pollsError;
      
      try {
        // Try authenticated query first
        let query = supabase
          .from('polls')
          .select('*');
        
        // If specific poll ID is requested, filter by it
        if (specificPollId) {
          query = query.eq('id', specificPollId);
        } else {
          query = query.eq('is_active', true);
        }
        
        const result = await query.order('created_at', { ascending: false });
        pollsData = result.data;
        pollsError = result.error;
      } catch (authError) {
        // Fall back to public view if authentication fails
        let query = supabase
          .from('public_polls')
          .select('*');
        
        // If specific poll ID is requested, filter by it
        if (specificPollId) {
          query = query.eq('id', specificPollId);
        } else {
          query = query.eq('is_active', true);
        }
        
        const result = await query.order('created_at', { ascending: false });
        pollsData = result.data;
        pollsError = result.error;
      }

      if (pollsError) throw pollsError;
      
      const pollsList = (pollsData || []) as Poll[];
      let effectivePollsList = pollsList;

      // If no active polls and no specific poll requested, show the most recent poll marked for post-analysis
      if (effectivePollsList.length === 0 && !specificPollId) {
        let postData, postError;
        
        try {
          // Try authenticated query first
          const result = await supabase
            .from('polls')
            .select('*')
            .eq('show_post_analysis', true)
            .order('updated_at', { ascending: false })
            .limit(1);
          postData = result.data;
          postError = result.error;
        } catch (authError) {
          // Fall back to public view
          const result = await supabase
            .from('public_polls')
            .select('*')
            .eq('show_post_analysis', true)
            .order('updated_at', { ascending: false })
            .limit(1);
          postData = result.data;
          postError = result.error;
        }
        
        if (postError) throw postError;
        effectivePollsList = (postData || []) as Poll[];
      }

      setPolls(effectivePollsList);

      // Fetch results for each poll with similar fallback approach
      const resultsMap: Record<string, PollResult[]> = {};
      
      // Get excluded user IDs (journalists and admin_students)
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('role', ['journalist', 'admin_student']);
      
      const excludedUserIds = new Set(roleData?.map(r => r.user_id) || []);
      
      for (const poll of effectivePollsList) {
        let votesData, votesError;
        
        try {
          // Try authenticated query first with cache busting
          const result = await supabase
            .from('poll_votes')
            .select('option_id, voter_id')
            .eq('poll_id', poll.id)
          votesData = result.data;
          votesError = result.error;
        } catch (authError) {
          // Fall back to public view - need to get voter_id somehow for filtering
          const result = await supabase
            .from('poll_votes')
            .select('option_id, voter_id')
            .eq('poll_id', poll.id)
          votesData = result.data;
          votesError = result.error;
        }

        if (votesError) throw votesError;

        // Filter out excluded users
        const filteredVotes = votesData?.filter(vote => !excludedUserIds.has(vote.voter_id)) || [];

        // Count votes for each option
        const voteCounts: Record<string, number> = {};
        const totalVotes = filteredVotes.length;

        // Initialize all options with 0 votes
        poll.options.forEach((option: any) => {
          const optionKey = typeof option === 'string' ? option : option.id;
          voteCounts[optionKey] = 0;
        });

        // Count actual votes
        filteredVotes.forEach(vote => {
          const option = vote.option_id as string;
          if (voteCounts.hasOwnProperty(option)) {
            voteCounts[option]++;
          }
        });

        // Convert to results with percentages
        const pollResults: PollResult[] = poll.options.map((option: any) => {
          const optionKey = typeof option === 'string' ? option : option.id;
          const optionText = typeof option === 'string' ? option : option.text;
          return {
            option: optionText,
            count: voteCounts[optionKey] || 0,
            percentage: totalVotes > 0 ? ((voteCounts[optionKey] || 0) / totalVotes) * 100 : 0
          };
        });

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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 to-purple-700 px-4">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-12 w-12 sm:h-16 sm:w-16 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-base sm:text-xl">Loading Poll Display...</p>
        </div>
      </div>
    );
  }

  if (!polls.length) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-600 to-gray-800 px-4">
        <div className="max-w-2xl w-full mx-auto p-4 sm:p-8">
          <Card className="bg-black/20 backdrop-blur-md border-white/20">
            <CardContent className="p-6 sm:p-8 lg:p-12 text-center text-white">
              <Vote className="w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 mx-auto opacity-50 mb-4 sm:mb-6 lg:mb-8" />
              <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-6xl font-bold mb-3 sm:mb-4">
                No Active Polls
              </h1>
              <p className="text-base sm:text-lg lg:text-xl opacity-75">
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col p-2 sm:p-4 overflow-hidden">
      <BreakingNewsTicker />
      <div className="max-w-6xl w-full mx-auto flex flex-col h-full px-2 sm:px-0">
        {/* Compact Header */}
        <div className="text-center mb-3 sm:mb-4 flex-shrink-0">
          <div className="flex items-center justify-center gap-2 sm:gap-3 mb-2 sm:mb-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg">
              <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-slate-800">
              {activePoll.title}
            </h1>
          </div>
          
          {activePoll.description && (
            <p className="text-sm sm:text-base lg:text-lg text-slate-600 mb-2 sm:mb-3 px-2">{activePoll.description}</p>
          )}
          
          <div className="flex justify-center items-center gap-2 sm:gap-3">
            <Badge className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-2 sm:px-3 py-1 text-xs sm:text-sm">
              <Users className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
              {totalVotes} votes
            </Badge>
            <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-3 py-1">
              <TrendingUp className="w-4 h-4 mr-1" />
              Live Results
            </Badge>
            <Button
              onClick={() => setShowDetailedResults(!showDetailedResults)}
              variant="outline"
              size="sm"
              className="bg-white/20 border-white/30 text-slate-700 hover:bg-white/30"
            >
              <FileText className="w-4 h-4 mr-1" />
              {showDetailedResults ? 'Hide' : 'Show'} Detailed Results
            </Button>
          </div>
        </div>

        {/* Content Area - Scrollable if needed */}
        <div className="flex-1 min-h-0 space-y-4">
          <div className="h-full overflow-y-auto">
            {/* Detailed Results View */}
            {showDetailedResults ? (
              <DetailedPollResults 
                pollId={activePoll.id} 
                pollTitle={activePoll.title}
                options={Array.isArray(activePoll.options) ? activePoll.options.map((opt: any) => 
                  typeof opt === 'string' ? { id: opt, text: opt } : opt
                ) : []}
              />
            ) : (
              <>
                {/* Live Voting Statistics */}
                <LiveVotingStats 
                  pollId={activePoll.id} 
                  showResultsPublicly={activePoll.show_results_publicly}
                />

                {/* Post-Voting Analysis (shown only after poll is closed AND post-analysis is enabled) */}
                {!activePoll.is_active && activePoll.show_post_analysis && (
                  <div className="mt-4">
                    <PostVotingAnalysis pollId={activePoll.id} pollTitle={activePoll.title} />
                  </div>
                )}
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default PollDisplay;