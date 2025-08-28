import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Users, TrendingUp, Vote } from "lucide-react";

interface Poll {
  id: string;
  title: string;
  description?: string;
  options: string[];
  is_active: boolean;
  show_results_publicly: boolean;
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
    
    // Real-time updates
    const channel = supabase
      .channel('poll_display')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'polls' }, () => {
        fetchActivePolls();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'poll_votes' }, () => {
        fetchActivePolls();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchActivePolls = async () => {
    try {
      const { data: pollsData, error: pollsError } = await supabase
        .from('polls')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (pollsError) throw pollsError;
      
      const pollsList = (pollsData || []) as Poll[];
      setPolls(pollsList);

      // Fetch results for each poll
      const resultsMap: Record<string, PollResult[]> = {};
      
      for (const poll of pollsList) {
        const { data: votesData, error: votesError } = await supabase
          .from('poll_votes')
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
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 flex items-center justify-center p-4">
      <div className="max-w-5xl w-full mx-auto">
        <Card className="bg-black/20 backdrop-blur-md border-white/20">
          <CardContent className="p-8 md:p-12">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="flex items-center justify-center gap-4 mb-6">
                <div className="w-16 h-16 bg-white/20 rounded-3xl flex items-center justify-center">
                  <BarChart3 className="w-8 h-8 text-white" />
                </div>
                <h1 className="text-4xl md:text-6xl font-bold text-white">
                  {activePoll.title}
                </h1>
              </div>
              
              {activePoll.description && (
                <p className="text-xl text-white/80 mb-6">{activePoll.description}</p>
              )}
              
              <div className="flex justify-center items-center gap-4">
                <Badge className="bg-white/20 text-white border-white/40 text-lg px-4 py-2">
                  <Users className="w-5 h-5 mr-2" />
                  {totalVotes} votes
                </Badge>
                <Badge className="bg-green-500/80 text-white text-lg px-4 py-2">
                  <TrendingUp className="w-5 h-5 mr-2" />
                  Live Results
                </Badge>
              </div>
            </div>

            {/* Results */}
            <div className="space-y-6">
              {pollResults.map((result, index) => (
                <div key={index} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl md:text-3xl font-bold text-white">{result.option}</span>
                    <div className="flex items-center gap-4">
                      <span className="text-3xl md:text-4xl font-bold text-white">{result.count}</span>
                      <span className="text-xl text-white/80">({result.percentage.toFixed(1)}%)</span>
                    </div>
                  </div>
                  <div className="relative">
                    <div className="w-full bg-white/20 rounded-full h-8 md:h-12 overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-1000 ease-out ${
                          result.count === maxVotes && maxVotes > 0 
                            ? 'bg-gradient-to-r from-green-400 to-emerald-400' 
                            : 'bg-gradient-to-r from-blue-400 to-purple-400'
                        }`}
                        style={{ width: `${result.percentage}%` }}
                      />
                    </div>
                    {result.count > 0 && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-lg md:text-xl font-bold text-white drop-shadow-lg">
                          {result.count} votes
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {totalVotes === 0 && (
              <div className="text-center py-12">
                <p className="text-2xl text-white/80 font-medium">Waiting for votes...</p>
              </div>
            )}

            {/* Footer */}
            <div className="text-center mt-8 text-white/60">
              <p className="text-lg">Results update in real-time</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PollDisplay;