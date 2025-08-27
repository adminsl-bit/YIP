import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Vote, Clock, CheckCircle, AlertCircle, Users, Building } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface VotingSession {
  id: string;
  title: string;
  description?: string;
  vote_type: 'general' | 'community';
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
  const { user } = useAuth();
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
      <Card key={session.id} className="mb-4">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{session.title}</CardTitle>
            <div className="flex items-center space-x-2">
              {isActive ? (
                <Badge variant="default" className="bg-green-500">
                  <Vote className="w-3 h-3 mr-1" />
                  Active
                </Badge>
              ) : (
                <Badge variant="secondary">
                  <Clock className="w-3 h-3 mr-1" />
                  Inactive
                </Badge>
              )}
              {hasVoted && (
                <Badge variant="outline" className="border-green-500 text-green-700">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Voted
                </Badge>
              )}
            </div>
          </div>
          {session.description && (
            <p className="text-sm text-muted-foreground">{session.description}</p>
          )}
        </CardHeader>
        <CardContent>
          {!isActive && !hasVoted && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Voting is currently disabled for this session. Please wait for the organizer to activate it.
              </AlertDescription>
            </Alert>
          )}

          {hasVoted && userVote && (
            <Alert className="border-green-500 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                You voted: <strong>{userVote.vote_choice}</strong> on{' '}
                {new Date(userVote.created_at).toLocaleDateString()}
              </AlertDescription>
            </Alert>
          )}

          {isActive && !hasVoted && (
            <div className="space-y-4">
              <RadioGroup
                value={selectedVotes[session.id] || ''}
                onValueChange={(value) => setSelectedVotes(prev => ({ ...prev, [session.id]: value }))}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yes" id={`${session.id}-yes`} />
                  <Label htmlFor={`${session.id}-yes`}>Yes</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="no" id={`${session.id}-no`} />
                  <Label htmlFor={`${session.id}-no`}>No</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="abstain" id={`${session.id}-abstain`} />
                  <Label htmlFor={`${session.id}-abstain`}>Abstain</Label>
                </div>
              </RadioGroup>
              
              <Button
                onClick={() => handleVoteSubmit(session.id)}
                disabled={!selectedVotes[session.id] || submitting === session.id}
                className="w-full"
              >
                {submitting === session.id ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Casting Vote...</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <Vote className="w-4 h-4" />
                    <span>Cast Vote</span>
                  </div>
                )}
              </Button>
            </div>
          )}

          {session.start_time && (
            <div className="mt-4 text-xs text-muted-foreground">
              <p>Session created: {new Date(session.created_at).toLocaleString()}</p>
              {session.start_time && (
                <p>Start time: {new Date(session.start_time).toLocaleString()}</p>
              )}
              {session.end_time && (
                <p>End time: {new Date(session.end_time).toLocaleString()}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Vote className="w-5 h-5" />
            <span>Voting</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const generalSessions = votingSessions.filter(s => s.vote_type === 'general');
  const communitySessions = votingSessions.filter(s => s.vote_type === 'community');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Vote className="w-5 h-5" />
          <span>Voting Sessions</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="general" className="flex items-center space-x-2">
              <Building className="w-4 h-4" />
              <span>General ({generalSessions.length})</span>
            </TabsTrigger>
            <TabsTrigger value="community" className="flex items-center space-x-2">
              <Users className="w-4 h-4" />
              <span>Community ({communitySessions.length})</span>
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="general" className="mt-4">
            {generalSessions.length > 0 ? (
              generalSessions.map(renderVotingSession)
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Building className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No general voting sessions available.</p>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="community" className="mt-4">
            {communitySessions.length > 0 ? (
              communitySessions.map(renderVotingSession)
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No community voting sessions available.</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};