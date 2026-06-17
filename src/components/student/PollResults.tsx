import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Users, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import { useSystemSettings } from "@/hooks/useSystemSettings";

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
  const { profile } = useAuth();
  const { settings } = useSystemSettings();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [results, setResults] = useState<Record<string, PollResult[]>>({});
  const [loading, setLoading] = useState(true);

  // Global "Show Results Publicly" override — kept in a ref so the realtime
  // subscription callbacks (set up once on mount) always read the latest value.
  const resultsPublicRef = useRef(true);
  useEffect(() => {
    resultsPublicRef.current = settings.results_public;
    fetchPublicPolls();
  }, [settings.results_public]);

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
      // Global "Show Results Publicly" override — when off, hide every poll's
      // results regardless of the per-poll setting.
      if (!resultsPublicRef.current) {
        setPolls([]);
        setResults({});
        setLoading(false);
        return;
      }

      const { data: pollsData, error: pollsError } = await supabase
        .from('polls')
        .select('*')
        .eq('show_results_publicly', true)
        .eq('event_id', profile?.event_id ?? '')
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
      <div className="bg-surface-container-lowest rounded-[2.5rem] p-12 border border-outline-variant/10 shadow-xl">
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-12 h-12 text-primary animate-spin" />
        </div>
      </div>
    );
  }

  if (!polls.length) {
    return (
      <div className="bg-surface-container-lowest rounded-[3rem] p-20 border border-outline-variant/10 shadow-2xl text-center">
        <div className="relative inline-block mb-10">
          <div className="w-24 h-24 bg-surface-container-low rounded-[2rem] flex items-center justify-center mx-auto shadow-lg">
            <BarChart3 className="w-10 h-10 text-on-surface-variant/20" />
          </div>
          <div className="absolute -top-3 -right-3 w-8 h-8 bg-primary/10 rounded-full animate-bounce"></div>
        </div>
        <h3 className="text-display-xs font-display font-bold text-on-surface mb-4 uppercase italic tracking-tight">No Public Results</h3>
        <p className="text-body-md text-on-surface-variant/60 font-medium">
          Poll results will appear here when organizers make them public for the assembly.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {polls.map((poll) => {
        const pollResults = results[poll.id] || [];
        const totalVotes = getTotalVotes(poll.id);
        const maxVotes = getMaxVotes(poll.id);

        return (
          <Card key={poll.id} className="bg-surface-container-lowest rounded-[3rem] border border-outline-variant/10 shadow-2xl overflow-hidden">
            <CardHeader className="p-10 lg:p-12 pb-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-8">
                <div className="flex-1">
                  <CardTitle className="text-display-xs font-display font-bold text-on-surface mb-4 flex items-center gap-5 italic tracking-tight uppercase">
                    <div className="w-14 h-14 bg-primary/5 rounded-2xl flex items-center justify-center border border-primary/10">
                      <BarChart3 className="w-7 h-7 text-primary" />
                    </div>
                    {poll.title}
                  </CardTitle>
                  {poll.description && (
                    <p className="text-body-md text-on-surface-variant/60 font-medium ml-19 leading-relaxed">{poll.description}</p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <Badge className="bg-surface-container text-on-surface-variant px-5 py-2.5 rounded-2xl font-bold text-label-sm border-none shadow-sm uppercase tracking-widest flex items-center gap-3">
                    <Users className="w-4 h-4" />
                    {totalVotes} Votes
                  </Badge>
                  {poll.is_active && (
                    <Badge className="bg-emerald-50 text-emerald-600 px-5 py-2.5 rounded-2xl font-bold text-label-sm border-emerald-100 shadow-sm uppercase tracking-widest flex items-center gap-3">
                      <TrendingUp className="w-4 h-4" />
                      Live
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-10 lg:p-12 pt-0 space-y-8">
              <div className="bg-surface-container-low/50 rounded-[2.5rem] p-10 border border-outline-variant/5">
                <h4 className="font-display font-bold text-title-md text-on-surface mb-10 flex items-center gap-4 uppercase italic tracking-tight">
                  <div className="w-1.5 h-6 bg-primary rounded-full"></div>
                  Assembly Statistics
                </h4>
                
                <div className="space-y-8">
                  {pollResults.map((result, index) => (
                    <div key={index} className="space-y-4">
                      <div className="flex items-center justify-between px-2">
                        <span className="text-body-lg font-black text-on-surface uppercase tracking-tight italic">{result.option}</span>
                        <div className="flex items-center gap-4">
                          <span className="text-body-md font-bold text-on-surface">{result.count}</span>
                          <span className="text-label-sm font-black text-on-surface-variant/40 tracking-[0.1em]">({result.percentage.toFixed(1)}%)</span>
                        </div>
                      </div>
                      <div className="relative">
                        <div className="w-full bg-surface-container rounded-full h-8 overflow-hidden border border-outline-variant/5 shadow-inner">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${result.percentage}%` }}
                            transition={{ duration: 1.5, ease: "easeOut" }}
                            className={`h-full rounded-full ${
                              result.count === maxVotes && maxVotes > 0 
                                ? 'bg-primary shadow-[0_0_20px_rgba(var(--primary-rgb),0.3)]' 
                                : 'bg-on-surface-variant/10'
                            }`}
                          />
                        </div>
                        {result.count > 0 && result.percentage > 10 && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-label-xs font-black text-on-primary tracking-widest uppercase opacity-80">
                              {result.count}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {totalVotes === 0 && (
                  <div className="text-center py-12">
                    <p className="text-body-md font-bold text-on-surface-variant/30 uppercase tracking-widest">Awaiting First Ballot</p>
                  </div>
                )}
              </div>

              <div className="text-label-sm text-on-surface-variant/30 text-center font-bold uppercase tracking-[0.25em]">
                Live Stream • Synced {new Date(poll.created_at).toLocaleDateString()}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default PollResults;