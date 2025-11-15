import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Vote, CheckCircle, AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { LiveVotingStats } from "./LiveVotingStats";
import { toast } from "@/hooks/use-toast";

interface Poll {
  id: string;
  title: string;
  description?: string;
  options: string[];
  is_active: boolean;
  show_results_publicly: boolean;
  created_at: string;
}

export const PollVoting = () => {
  const { user } = useAuth();
  const { settings } = useSystemSettings();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [userVotes, setUserVotes] = useState<Record<string, string>>({});
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);

  useEffect(() => {
    fetchActivePolls();
    
    // Set up real-time subscription for poll changes
    const channel = supabase
      .channel('poll_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'polls'
        },
        () => {
          console.log('Poll changed, refreshing...');
          fetchActivePolls();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchActivePolls = async () => {
    try {
      const { data, error } = await supabase
        .from('polls')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const pollsData = (data || []) as Poll[];
      setPolls(pollsData);

      if (user && pollsData.length) {
        // Fetch user's existing votes for these polls
        const { data: votesData, error: votesError } = await supabase
          .from('poll_votes')
          .select('poll_id, option_id')
          .eq('voter_id', user.id)
          .in('poll_id', pollsData.map(p => p.id));
        if (votesError) throw votesError;
        const voteMap: Record<string, string> = {};
        (votesData || []).forEach(v => {
          voteMap[v.poll_id as string] = v.option_id as string;
        });
        setUserVotes(voteMap);
      } else {
        setUserVotes({});
      }
    } catch (err) {
      console.error('Error loading polls', err);
      toast({ title: 'Error', description: 'Failed to load polls', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (poll: Poll) => {
    if (!user) return;
    const choice = selectedOptions[poll.id];
    if (!choice) return;

    setSubmitting(poll.id);
    try {
      const { error } = await supabase
        .from('poll_votes')
        .insert({ poll_id: poll.id, voter_id: user.id, option_id: choice });
      if (error) throw error;

      setUserVotes(prev => ({ ...prev, [poll.id]: choice }));
      setSelectedOptions(prev => ({ ...prev, [poll.id]: '' }));
      setRefreshTrigger(prev => prev + 1); // Trigger stats refresh
      toast({ title: 'Vote recorded', description: `You voted: ${choice}` });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to cast vote', variant: 'destructive' });
    } finally {
      setSubmitting(null);
    }
  };

  if (loading) {
    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Live Polls</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-24">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!settings.voting_enabled) {
    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Live Polls</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center p-8">
            <p className="text-muted-foreground text-lg">Voting is currently disabled by the organizer.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!polls.length) {
    return null;
  }

  return (
    <div className="space-y-6">
      {polls.map((poll) => {
        const votedChoice = userVotes[poll.id];
        const hasVoted = !!votedChoice;
        return (
          <div key={poll.id} className="space-y-6">
            {/* Voting Interface */}
            <Card className="bg-white/20 backdrop-blur-lg border border-white/25 shadow-xl">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                      <Vote className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-slate-800 font-bold">{poll.title}</span>
                  </CardTitle>
                  <Badge 
                    variant={poll.is_active ? 'default' : 'secondary'}
                    className={poll.is_active ? 'bg-green-500 hover:bg-green-600' : ''}
                  >
                    {poll.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                {poll.description && (
                  <p className="text-slate-600 mt-3 font-medium leading-relaxed">{poll.description}</p>
                )}
              </CardHeader>
              <CardContent className="space-y-6">
                {hasVoted ? (
                  <div className="flex items-center gap-3 p-6 rounded-2xl bg-gradient-to-r from-green-50/80 to-emerald-50/80 border border-green-200/50 backdrop-blur-sm shadow-sm">
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-green-800 font-semibold">Vote Successfully Cast!</p>
                      <p className="text-green-700 text-sm">Your choice: <span className="font-bold">{votedChoice}</span></p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <h4 className="text-lg font-semibold text-slate-800 mb-4">Cast Your Vote</h4>
                      <RadioGroup
                        value={selectedOptions[poll.id] || ''}
                        onValueChange={(val) => setSelectedOptions(prev => ({ ...prev, [poll.id]: val }))}
                        className="space-y-3"
                      >
                        {(Array.isArray(poll.options) ? poll.options : []).map((opt: any, idx: number) => (
                          <div key={idx} className="group">
                            <div className="flex items-center gap-4 p-5 rounded-2xl bg-white/40 hover:bg-white/60 transition-all duration-300 border border-white/30 hover:border-white/50 hover:shadow-md cursor-pointer">
                              <RadioGroupItem 
                                id={`${poll.id}-${idx}`} 
                                value={typeof opt === 'string' ? opt : opt.id} 
                                className="border-2 border-slate-400 text-primary" 
                              />
                              <Label 
                                htmlFor={`${poll.id}-${idx}`} 
                                className="cursor-pointer font-semibold text-slate-800 flex-1 text-lg"
                              >
                                {typeof opt === 'string' ? opt : opt.text}
                              </Label>
                            </div>
                          </div>
                        ))}
                      </RadioGroup>
                    </div>

                    <Button
                      onClick={() => handleVote(poll)}
                      disabled={!selectedOptions[poll.id] || submitting === poll.id || !settings.voting_enabled}
                      className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold text-lg py-8 rounded-2xl shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-300 disabled:hover:scale-100"
                    >
                      {submitting === poll.id ? (
                        <div className="flex items-center justify-center gap-3">
                          <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                          <span className="text-xl">Casting Vote...</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-3">
                          <Vote className="w-6 h-6" />
                          <span className="text-xl">Cast Your Vote</span>
                        </div>
                      )}
                    </Button>
                  </div>
                )}

                {!poll.is_active && (
                  <div className="mt-6 flex items-center gap-3 text-orange-800 bg-gradient-to-r from-orange-50/80 to-yellow-50/80 border border-orange-200/50 p-5 rounded-2xl backdrop-blur-sm shadow-sm">
                    <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
                      <AlertCircle className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold">Voting Disabled</p>
                      <p className="text-sm text-orange-700">This poll is currently inactive.</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Live Voting Statistics */}
            <LiveVotingStats 
              pollId={poll.id} 
              refreshTrigger={refreshTrigger}
              showResultsPublicly={poll.show_results_publicly}
            />
          </div>
        );
      })}
    </div>
  );
};

export default PollVoting;
