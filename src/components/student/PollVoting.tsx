import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Vote, CheckCircle, AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
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
  const [polls, setPolls] = useState<Poll[]>([]);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [userVotes, setUserVotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);

  useEffect(() => {
    fetchActivePolls();
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

  if (!polls.length) {
    return null;
  }

  return (
    <div className="space-y-6">
      {polls.map((poll) => {
        const votedChoice = userVotes[poll.id];
        const hasVoted = !!votedChoice;
        return (
          <Card key={poll.id} className="bg-white/15 backdrop-blur-lg border border-white/25 shadow-xl">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center shadow-lg">
                    <Vote className="w-4 h-4 text-white" />
                  </div>
                  {poll.title}
                </CardTitle>
                <Badge variant={poll.is_active ? 'default' : 'secondary'}>
                  {poll.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {poll.description && (
                <p className="text-slate-600 mb-4">{poll.description}</p>
              )}

              {hasVoted ? (
                <div className="flex items-center gap-2 p-4 rounded-xl bg-green-50 border border-green-200">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <p className="text-green-800 font-medium">You voted: <span className="font-bold">{votedChoice}</span></p>
                </div>
              ) : (
                <div className="space-y-4">
                  <RadioGroup
                    value={selectedOptions[poll.id] || ''}
                    onValueChange={(val) => setSelectedOptions(prev => ({ ...prev, [poll.id]: val }))}
                    className="space-y-3"
                  >
                    {poll.options.map((opt, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-3 rounded-xl bg-white/30 hover:bg-white/40 transition-colors">
                        <RadioGroupItem id={`${poll.id}-${idx}`} value={opt} />
                        <Label htmlFor={`${poll.id}-${idx}`} className="cursor-pointer font-medium text-slate-800">
                          {opt}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>

                  <Button
                    onClick={() => handleVote(poll)}
                    disabled={!selectedOptions[poll.id] || submitting === poll.id}
                    className="w-full"
                  >
                    {submitting === poll.id ? 'Submitting...' : 'Cast Vote'}
                  </Button>
                </div>
              )}

              {!poll.is_active && (
                <div className="mt-4 flex items-center gap-2 text-orange-700 bg-orange-50 border border-orange-200 p-3 rounded-lg">
                  <AlertCircle className="w-4 h-4" />
                  <span>Voting is currently disabled for this poll.</span>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default PollVoting;
