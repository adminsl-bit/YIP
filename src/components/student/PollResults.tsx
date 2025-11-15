import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Users, TrendingUp } from "lucide-react";

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

export const PollResults = () => {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [results, setResults] = useState<Record<string, PollResult[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPublicPolls();
    
    // Real-time updates for polls and votes
    const pollsChannel = supabase
      .channel('public_polls')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'polls' }, () => {
        fetchPublicPolls();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'poll_votes' }, () => {
        fetchPublicPolls();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(pollsChannel);
    };
  }, []);

  const fetchPublicPolls = async () => {
    try {
      const { data: pollsData, error: pollsError } = await supabase
        .from('polls')
        .select('*')
        .eq('show_results_publicly', true)
        .order('created_at', { ascending: false });

      if (pollsError) throw pollsError;
      
      const pollsList = (pollsData || []) as Poll[];
      setPolls(pollsList);

      // Fetch results for each poll
      const resultsMap: Record<string, PollResult[]> = {};
      
      // Get excluded user IDs (journalists and admin_students)
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('role', ['journalist', 'admin_student']);
      
      const excludedUserIds = new Set(roleData?.map(r => r.user_id) || []);
      
      for (const poll of pollsList) {
        const { data: votesData, error: votesError } = await supabase
          .from('poll_votes')
          .select('option_id, voter_id')
          .eq('poll_id', poll.id);

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
      console.error('Error fetching poll results:', error);
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
      <div className="bg-white/15 backdrop-blur-lg rounded-3xl p-8 border border-white/25 shadow-xl">
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent shadow-lg"></div>
        </div>
      </div>
    );
  }

  if (!polls.length) {
    return (
      <div className="bg-white/15 backdrop-blur-lg rounded-3xl p-12 border border-white/25 shadow-xl text-center">
        <div className="relative inline-block mb-6">
          <div className="w-20 h-20 bg-gradient-to-br from-gray-400 to-gray-500 rounded-3xl flex items-center justify-center mx-auto shadow-lg">
            <BarChart3 className="w-10 h-10 text-white" />
          </div>
          <div className="absolute -top-2 -right-2 w-6 h-6 bg-gray-400/40 rounded-full animate-bounce"></div>
        </div>
        <h3 className="text-2xl font-black text-slate-800 mb-4">No Public Results Available</h3>
        <p className="text-lg text-slate-600 font-medium">
          Poll results will appear here when organizers make them public.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {polls.map((poll) => {
        const pollResults = results[poll.id] || [];
        const totalVotes = getTotalVotes(poll.id);
        const maxVotes = getMaxVotes(poll.id);

        return (
          <Card key={poll.id} className="bg-white/15 backdrop-blur-lg border border-white/25 shadow-xl">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex-1">
                  <CardTitle className="text-xl font-black text-slate-800 mb-2 flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-teal-500 rounded-2xl flex items-center justify-center shadow-lg">
                      <BarChart3 className="w-5 h-5 text-white" />
                    </div>
                    {poll.title}
                  </CardTitle>
                  {poll.description && (
                    <p className="text-slate-600 font-medium ml-13">{poll.description}</p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-gradient-to-r from-green-500 to-teal-500 text-white shadow-lg px-3 py-1">
                    <Users className="w-3 h-3 mr-1" />
                    {totalVotes} votes
                  </Badge>
                  {poll.is_active && (
                    <Badge className="bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg px-3 py-1">
                      <TrendingUp className="w-3 h-3 mr-1" />
                      Live
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-6 border border-white/30">
                <h4 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Live Results
                </h4>
                
                <div className="space-y-4">
                  {pollResults.map((result, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-800">{result.option}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-700">{result.count}</span>
                          <span className="text-sm text-slate-600">({result.percentage.toFixed(1)}%)</span>
                        </div>
                      </div>
                      <div className="relative">
                        <div className="w-full bg-white/30 rounded-full h-6 overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-1000 ease-out ${
                              result.count === maxVotes && maxVotes > 0 
                                ? 'bg-gradient-to-r from-green-500 to-emerald-500' 
                                : 'bg-gradient-to-r from-blue-500 to-purple-500'
                            }`}
                            style={{ width: `${result.percentage}%` }}
                          />
                        </div>
                        {result.count > 0 && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-xs font-bold text-white drop-shadow-lg">
                              {result.count}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {totalVotes === 0 && (
                  <div className="text-center py-8 text-slate-600">
                    <p className="font-medium">No votes yet. Be the first to vote!</p>
                  </div>
                )}
              </div>

              <div className="text-xs text-slate-500 text-center">
                Results update in real-time • Created {new Date(poll.created_at).toLocaleDateString()}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default PollResults;