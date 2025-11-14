import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Trophy, Medal, Award } from 'lucide-react';
import { BreakingNewsTicker } from '@/components/display/BreakingNewsTicker';

interface AssessmentResult {
  student_id: string;
  student_name: string;
  total_score: number;
  party_number: number;
  position: string;
}

interface PollResult {
  poll_title: string;
  option_id: string;
  option_text: string;
  vote_count: number;
}

const LeaderboardDisplay = () => {
  const [scoringLeaders, setScoringLeaders] = useState<AssessmentResult[]>([]);
  const [pollResults, setPollResults] = useState<Record<string, PollResult[]>>({});
  const [loading, setLoading] = useState(true);
  const [isLeaderboardVisible, setIsLeaderboardVisible] = useState(true);

  const fetchScoringLeaders = async () => {
    try {
      const { data, error } = await supabase
        .from('assessments')
        .select(`
          student_id,
          total_score,
          profiles!inner(name, party_number, position)
        `)
        .eq('status', 'submitted')
        .order('total_score', { ascending: false })
        .limit(10);

      if (error) throw error;

      const leaders = data?.map((assessment: any) => ({
        student_id: assessment.student_id,
        student_name: assessment.profiles.name,
        total_score: assessment.total_score,
        party_number: assessment.profiles.party_number,
        position: assessment.profiles.position,
      })) || [];

      setScoringLeaders(leaders);
    } catch (error) {
      console.error('Error fetching scoring leaders:', error);
    }
  };

  const fetchPollResults = async () => {
    try {
      // Get active polls with public results
      const { data: polls, error: pollsError } = await supabase
        .from('polls')
        .select('*')
        .eq('is_active', true)
        .eq('show_results_publicly', true);

      if (pollsError) throw pollsError;

      const results: Record<string, PollResult[]> = {};

      for (const poll of polls || []) {
        // Count votes for each option
        const { data: votes, error: votesError } = await supabase
          .from('poll_votes')
          .select('option_id')
          .eq('poll_id', poll.id);

        if (votesError) throw votesError;

        const voteCounts = votes?.reduce((acc, vote) => {
          acc[vote.option_id] = (acc[vote.option_id] || 0) + 1;
          return acc;
        }, {} as Record<string, number>) || {};

        const pollResults = Array.isArray(poll.options) 
          ? poll.options.map((option: any) => ({
              poll_title: poll.title,
              option_id: option.id,
              option_text: option.text,
              vote_count: voteCounts[option.id] || 0,
            }))
          : [];

        results[poll.id] = pollResults.sort((a, b) => b.vote_count - a.vote_count);
      }

      setPollResults(results);
    } catch (error) {
      console.error('Error fetching poll results:', error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      
      // Check if leaderboard is visible
      try {
        const { data, error } = await supabase
          .from('system_settings')
          .select('setting_value')
          .eq('setting_key', 'leaderboard_visible')
          .limit(1);
        
        if (error) throw error;
        const isVisible = data && data.length ? (data[0].setting_value === true || data[0].setting_value === 'true') : true;
        setIsLeaderboardVisible(isVisible);
        
        if (isVisible) {
          await Promise.all([fetchScoringLeaders(), fetchPollResults()]);
        }
      } catch (error) {
        console.error('Error checking leaderboard visibility:', error);
        setIsLeaderboardVisible(false);
      }
      
      setLoading(false);
    };

    loadData();

    // Set up real-time subscriptions
    const assessmentChannel = supabase
      .channel('assessment-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'assessments' },
        () => fetchScoringLeaders()
      )
      .subscribe();

    const pollChannel = supabase
      .channel('poll-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'poll_votes' },
        () => fetchPollResults()
      )
      .subscribe();

    // Auto-refresh every 30 seconds
    const interval = setInterval(loadData, 30000);

    return () => {
      supabase.removeChannel(assessmentChannel);
      supabase.removeChannel(pollChannel);
      clearInterval(interval);
    };
  }, []);

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0:
        return <Trophy className="w-12 h-12 text-yellow-500" />;
      case 1:
        return <Medal className="w-12 h-12 text-gray-400" />;
      case 2:
        return <Award className="w-12 h-12 text-amber-600" />;
      default:
        return <div className="w-12 h-12 flex items-center justify-center text-4xl font-bold text-muted-foreground">#{index + 1}</div>;
    }
  };

  const getPartyColor = (partyNumber: number) => {
    const colors = [
      'bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500',
      'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500'
    ];
    return colors[partyNumber % colors.length];
  };

  if (!isLeaderboardVisible) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center px-4">
        <div className="text-center space-y-4">
          <div className="text-3xl sm:text-4xl md:text-6xl font-bold text-muted-foreground">Leaderboard Hidden</div>
          <p className="text-lg sm:text-xl md:text-2xl text-muted-foreground">The leaderboard is currently disabled by the organizer.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center px-4">
        <div className="text-3xl sm:text-4xl md:text-6xl font-bold text-primary animate-pulse text-center">Loading Leaderboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-4 sm:p-6 lg:p-8">
      <BreakingNewsTicker />
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-8xl font-bold text-center mb-6 sm:mb-8 lg:mb-12 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
          Live Leaderboard
        </h1>

        <Tabs defaultValue="scoring" className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-12 sm:h-14 lg:h-16 text-sm sm:text-lg lg:text-2xl">
            <TabsTrigger value="scoring" className="text-sm sm:text-lg lg:text-2xl">Scoring Leaders</TabsTrigger>
            <TabsTrigger value="voting" className="text-sm sm:text-lg lg:text-2xl">Voting Results</TabsTrigger>
          </TabsList>

          <TabsContent value="scoring" className="mt-4 sm:mt-6 lg:mt-8">
            <div className="grid gap-4 sm:gap-6">
              {scoringLeaders.map((leader, index) => (
                <Card key={leader.student_id} className="p-4 sm:p-6 bg-card/80 backdrop-blur-sm border-2">
                  <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-8">
                    {getRankIcon(index)}
                    <div className="flex-1">
                      <div className="flex items-center gap-4 mb-2">
                        <h3 className="text-4xl font-bold">{leader.student_name}</h3>
                        <Badge 
                          className={`${getPartyColor(leader.party_number)} text-white text-lg px-4 py-2`}
                        >
                          Party {leader.party_number}
                        </Badge>
                        <Badge variant="outline" className="text-lg px-4 py-2">
                          {leader.position}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-6xl font-bold text-primary">
                      {leader.total_score}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="voting" className="mt-8">
            <div className="space-y-12">
              {Object.entries(pollResults).map(([pollId, results]) => (
                <Card key={pollId} className="p-8 bg-card/80 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="text-4xl text-center">
                      {results[0]?.poll_title || 'Poll Results'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      {results.map((result, index) => {
                        const maxVotes = Math.max(...results.map(r => r.vote_count));
                        const percentage = maxVotes > 0 ? (result.vote_count / maxVotes) * 100 : 0;
                        
                        return (
                          <div key={result.option_id} className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-2xl font-semibold">{result.option_text}</span>
                              <span className="text-3xl font-bold text-primary">{result.vote_count} votes</span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-8">
                              <div
                                className="bg-gradient-to-r from-primary to-secondary h-8 rounded-full transition-all duration-1000 ease-out"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default LeaderboardDisplay;