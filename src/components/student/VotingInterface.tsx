import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Vote, Clock, CheckCircle, AlertCircle, BarChart3 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface VotingSession {
  id: string;
  title: string;
  description?: string;
  vote_type: string;
  is_active: boolean;
  start_time?: string;
  end_time?: string;
  created_at: string;
}

interface UserVote {
  id: string;
  voting_session_id: string;
  vote_choice: string;
  created_at: string;
}

export const VotingInterface = () => {
  const { user, profile } = useAuth();
  const [votingSessions, setVotingSessions] = useState<VotingSession[]>([]);
  const [userVotes, setUserVotes] = useState<UserVote[]>([]);
  const [selectedVotes, setSelectedVotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchVotingSessions();
      fetchUserVotes();
    }
  }, [user]);

  const fetchVotingSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('voting_sessions')
        .select('*')
        .eq('event_id', profile?.event_id ?? '')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setVotingSessions((data || []) as VotingSession[]);
    } catch (error) {
      console.error('Error fetching voting sessions:', error);
      toast({
        title: "Error",
        description: "Failed to load voting sessions",
        variant: "destructive",
      });
    }
  };

  const fetchUserVotes = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('votes')
        .select('*')
        .eq('voter_id', user.id);

      if (error) throw error;
      setUserVotes(data || []);
    } catch (error) {
      console.error('Error fetching user votes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVoteSubmit = async (sessionId: string) => {
    if (!user || !selectedVotes[sessionId]) return;

    setSubmitting(sessionId);
    try {
      const { error } = await supabase
        .from('votes')
        .insert({
          voting_session_id: sessionId,
          voter_id: user.id,
          vote_choice: selectedVotes[sessionId]
        });

      if (error) throw error;

      toast({
        title: "Vote Cast Successfully!",
        description: "Your vote has been recorded.",
      });

      // Refresh user votes
      await fetchUserVotes();
      
      // Clear selection
      setSelectedVotes(prev => ({ ...prev, [sessionId]: '' }));
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to cast vote",
        variant: "destructive",
      });
    } finally {
      setSubmitting(null);
    }
  };

  const hasUserVoted = (sessionId: string) => {
    return userVotes.some(vote => vote.voting_session_id === sessionId);
  };

  const getUserVote = (sessionId: string) => {
    return userVotes.find(vote => vote.voting_session_id === sessionId);
  };

  const renderVotingSession = (session: VotingSession) => {
    const hasVoted = hasUserVoted(session.id);
    const userVote = getUserVote(session.id);
    const isActive = session.is_active;
    
    return (
      <Card key={session.id} className="mb-6 bg-white/15 backdrop-blur-lg border border-white/25 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex-1">
              <CardTitle className="text-xl font-black text-slate-800 mb-2 flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center shadow-lg">
                  <Vote className="w-5 h-5 text-white" />
                </div>
                {session.title}
              </CardTitle>
              {session.description && (
                <p className="text-slate-600 font-medium ml-13">{session.description}</p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {isActive ? (
                <Badge className="bg-gradient-to-r from-green-500 to-teal-500 text-white shadow-lg px-3 py-1">
                  <Vote className="w-3 h-3 mr-1" />
                  Active
                </Badge>
              ) : (
                <Badge className="bg-gradient-to-r from-gray-400 to-gray-500 text-white shadow-lg px-3 py-1">
                  <Clock className="w-3 h-3 mr-1" />
                  Inactive
                </Badge>
              )}
              {hasVoted && (
                <Badge className="bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-lg px-3 py-1">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Voted
                </Badge>
              )}
              <Badge className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg px-3 py-1 capitalize">
                {session.vote_type}
              </Badge>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="pt-0">
          {!isActive && !hasVoted && (
            <Alert className="mb-4 bg-orange-50/50 border-orange-200 backdrop-blur-sm">
              <AlertCircle className="h-4 w-4 text-orange-500" />
              <AlertDescription className="text-orange-700 font-medium">
                Voting is currently disabled for this session. Please wait for the organizer to activate it.
              </AlertDescription>
            </Alert>
          )}

          {hasVoted && userVote && (
            <Alert className="mb-4 bg-green-50/50 border-green-200 backdrop-blur-sm">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800 font-medium">
                You voted: <span className="font-black text-green-900">{userVote.vote_choice}</span> on{' '}
                {new Date(userVote.created_at).toLocaleDateString()}
              </AlertDescription>
            </Alert>
          )}

          {isActive && !hasVoted && (
            <div className="space-y-6">
              <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4 border border-white/30">
                <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  Cast Your Vote
                </h4>
                <RadioGroup
                  value={selectedVotes[session.id] || ''}
                  onValueChange={(value) => setSelectedVotes(prev => ({ ...prev, [session.id]: value }))}
                  className="space-y-3"
                >
                  <div className="flex items-center space-x-3 p-3 rounded-xl bg-white/30 hover:bg-white/40 transition-colors">
                    <RadioGroupItem value="yes" id={`${session.id}-yes`} className="border-2 border-green-500" />
                    <Label htmlFor={`${session.id}-yes`} className="font-semibold text-slate-800 cursor-pointer flex-1">
                      Yes - I support this motion
                    </Label>
                  </div>
                  <div className="flex items-center space-x-3 p-3 rounded-xl bg-white/30 hover:bg-white/40 transition-colors">
                    <RadioGroupItem value="no" id={`${session.id}-no`} className="border-2 border-red-500" />
                    <Label htmlFor={`${session.id}-no`} className="font-semibold text-slate-800 cursor-pointer flex-1">
                      No - I oppose this motion
                    </Label>
                  </div>
                  <div className="flex items-center space-x-3 p-3 rounded-xl bg-white/30 hover:bg-white/40 transition-colors">
                    <RadioGroupItem value="abstain" id={`${session.id}-abstain`} className="border-2 border-gray-500" />
                    <Label htmlFor={`${session.id}-abstain`} className="font-semibold text-slate-800 cursor-pointer flex-1">
                      Abstain - I choose not to vote
                    </Label>
                  </div>
                </RadioGroup>
              </div>
              
              <Button
                onClick={() => handleVoteSubmit(session.id)}
                disabled={!selectedVotes[session.id] || submitting === session.id}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold text-lg py-6 rounded-2xl shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300"
              >
                {submitting === session.id ? (
                  <div className="flex items-center justify-center gap-3">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Casting Vote...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-3">
                    <Vote className="w-5 h-5" />
                    <span>Cast Your Vote</span>
                  </div>
                )}
              </Button>
            </div>
          )}

          {(session.start_time || session.created_at) && (
            <div className="mt-6 p-4 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20">
              <h5 className="font-semibold text-slate-800 mb-2 text-sm">Session Information</h5>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600">
                <p><strong>Created:</strong> {new Date(session.created_at).toLocaleString()}</p>
                {session.start_time && (
                  <p><strong>Started:</strong> {new Date(session.start_time).toLocaleString()}</p>
                )}
                {session.end_time && (
                  <p><strong>Ends:</strong> {new Date(session.end_time).toLocaleString()}</p>
                )}
                <p><strong>Type:</strong> <span className="capitalize">{session.vote_type}</span></p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="bg-white/15 backdrop-blur-lg rounded-3xl p-8 border border-white/25 shadow-xl">
        <div className="flex items-center justify-center gap-4 mb-6">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center shadow-lg">
            <Vote className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-2xl font-black text-slate-800">Voting Sessions</h2>
        </div>
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent shadow-lg"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-4 mb-4">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-3xl flex items-center justify-center shadow-lg shadow-blue-500/30">
            <Vote className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-4xl font-black text-transparent bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text">
            Voting Sessions
          </h2>
        </div>
        <p className="text-lg text-slate-600 font-semibold">
          Participate in active voting sessions and view your voting history
        </p>
      </div>

      {votingSessions.length > 0 ? (
        <div className="space-y-6">
          {votingSessions.map(renderVotingSession)}
        </div>
      ) : (
        <div className="bg-white/15 backdrop-blur-lg rounded-3xl p-12 border border-white/25 shadow-xl text-center">
          <div className="relative inline-block mb-6">
            <div className="w-20 h-20 bg-gradient-to-br from-gray-400 to-gray-500 rounded-3xl flex items-center justify-center mx-auto shadow-lg">
              <Vote className="w-10 h-10 text-white" />
            </div>
            <div className="absolute -top-2 -right-2 w-6 h-6 bg-gray-400/40 rounded-full animate-bounce"></div>
          </div>
          <h3 className="text-2xl font-black text-slate-800 mb-4">No Voting Sessions Available</h3>
          <p className="text-lg text-slate-600 font-medium">
            There are currently no voting sessions available. Check back later or contact the organizers.
          </p>
        </div>
      )}
    </div>
  );
};