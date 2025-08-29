import { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, Trophy, Medal, Award, Star, Users, Users2, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface LeaderboardEntry {
  user_id: string;
  name: string;
  position: string;
  party_number: number;
  constituency: string;
  state: string;
  city: string;
  photo_url?: string;
  average_score: number;
  assessment_count: number;
  award_ids: string[];
}

interface Award {
  id: string;
  name: string;
  description: string;
}

interface AwardVote {
  award_id: string;
  student_id: string;
  jury_id: string;
  award_name: string;
}

export const OrganizerLeaderboard = () => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [awards, setAwards] = useState<Award[]>([]);
  const [awardVotes, setAwardVotes] = useState<AwardVote[]>([]);
  const [studentAwards, setStudentAwards] = useState<Record<string, string[]>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
    setupRealtimeSubscriptions();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch leaderboard data
      const { data: leaderboardData, error: leaderboardError } = await supabase
        .from('jury_leaderboard')
        .select('*');

      if (leaderboardError) throw leaderboardError;

      // Fetch awards
      const { data: awardsData, error: awardsError } = await supabase
        .from('awards')
        .select('*')
        .order('name');

      if (awardsError) throw awardsError;

      // Fetch award votes
      const { data: votesData, error: votesError } = await supabase
        .from('award_votes')
        .select(`
          award_id,
          student_id,
          jury_id,
          awards (name)
        `);

      if (votesError) throw votesError;

      // Fetch student awards
      const { data: studentAwardsData, error: studentAwardsError } = await supabase
        .from('student_awards')
        .select(`
          student_id,
          awards (id, name)
        `);

      if (studentAwardsError) throw studentAwardsError;

      setLeaderboard(leaderboardData || []);
      setAwards(awardsData || []);
      
      const formattedVotes = votesData?.map(vote => ({
        award_id: vote.award_id,
        student_id: vote.student_id,
        jury_id: vote.jury_id,
        award_name: (vote.awards as any)?.name || ''
      })) || [];
      setAwardVotes(formattedVotes);

      // Group student awards by student_id
      const groupedAwards: Record<string, string[]> = {};
      studentAwardsData?.forEach(sa => {
        if (!groupedAwards[sa.student_id]) {
          groupedAwards[sa.student_id] = [];
        }
        groupedAwards[sa.student_id].push((sa.awards as any)?.name || '');
      });
      setStudentAwards(groupedAwards);

    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to load leaderboard data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscriptions = () => {
    const channel = supabase
      .channel('organizer-leaderboard-updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'assessments'
      }, () => {
        fetchData();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'award_votes'
      }, () => {
        fetchData();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'student_awards'
      }, () => {
        fetchData();
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  };

  const getVoteCount = (awardId: string, studentId: string) => {
    return awardVotes.filter(vote => 
      vote.award_id === awardId && vote.student_id === studentId
    ).length;
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="w-5 h-5 text-yellow-500" />;
    if (rank === 2) return <Medal className="w-5 h-5 text-gray-400" />;
    if (rank === 3) return <Award className="w-5 h-5 text-amber-600" />;
    return <span className="w-5 h-5 flex items-center justify-center text-sm font-bold">{rank}</span>;
  };

  const getPartyColor = (partyNumber: number) => {
    const colors = [
      'bg-red-100 text-red-800',
      'bg-blue-100 text-blue-800',
      'bg-green-100 text-green-800',
      'bg-yellow-100 text-yellow-800',
      'bg-purple-100 text-purple-800',
      'bg-pink-100 text-pink-800'
    ];
    return colors[(partyNumber - 1) % colors.length];
  };

  const filteredLeaderboard = leaderboard.filter(entry =>
    entry.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.position.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.constituency?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-muted-foreground">Loading leaderboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
        <Input
          placeholder="Search students by name, position, or constituency..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="w-4 h-4" />
              Total Students
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{leaderboard.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Trophy className="w-4 h-4" />
              Top Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {leaderboard.length > 0 ? Math.round(leaderboard[0].average_score) : 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Award className="w-4 h-4" />
              Awards Given
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Object.values(studentAwards).reduce((sum, awards) => sum + awards.length, 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="w-4 h-4" />
              Avg Assessments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {leaderboard.length > 0 
                ? (leaderboard.reduce((sum, entry) => sum + entry.assessment_count, 0) / leaderboard.length).toFixed(1)
                : 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Award Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="w-5 h-5" />
            Award Voting Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {awards.map((award) => {
              const pendingVotes = awardVotes.filter(vote => vote.award_id === award.id);
              const uniqueStudents = [...new Set(pendingVotes.map(vote => vote.student_id))];
              const assignedCount = Object.values(studentAwards).flat().filter(name => name === award.name).length;
              
              return (
                <div key={award.id} className="bg-muted/50 rounded-lg p-4 space-y-2">
                  <h4 className="font-semibold text-sm">{award.name}</h4>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{uniqueStudents.length} students with votes</span>
                    <span>{assignedCount} awarded</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span>Total votes: {pendingVotes.length}</span>
                    <Badge variant={assignedCount > 0 ? "default" : "secondary"} className="text-xs">
                      {assignedCount > 0 ? "Active" : "Pending"}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Leaderboard Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5" />
            Overall Leaderboard (Averaged Scores)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Rank</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Party</TableHead>
                <TableHead>Avg Score</TableHead>
                <TableHead>Assessments</TableHead>
                <TableHead>Awards</TableHead>
                <TableHead>Vote Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLeaderboard.map((entry, index) => {
                const studentVotes = awardVotes.filter(vote => vote.student_id === entry.user_id);
                const uniqueAwards = [...new Set(studentVotes.map(vote => vote.award_id))];
                
                return (
                  <TableRow key={entry.user_id}>
                    <TableCell>
                      <div className="flex items-center justify-center">
                        {getRankIcon(index + 1)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={entry.photo_url} alt={entry.name} />
                          <AvatarFallback>
                            {entry.name.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{entry.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {entry.constituency}, {entry.state}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{entry.position}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={getPartyColor(entry.party_number)}>
                        Party {entry.party_number}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="font-bold text-lg">
                        {Math.round(entry.average_score)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {entry.assessment_count}/3
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {studentAwards[entry.user_id]?.map((award, idx) => (
                          <Badge key={idx} className="text-xs bg-yellow-100 text-yellow-800 block w-fit">
                            <Trophy className="w-3 h-3 mr-1" />
                            {award}
                          </Badge>
                        )) || <span className="text-muted-foreground text-sm">No awards</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {uniqueAwards.length > 0 ? (
                          uniqueAwards.map((awardId) => {
                            const voteCount = getVoteCount(awardId, entry.user_id);
                            const award = awards.find(a => a.id === awardId);
                            return (
                              <div key={awardId} className="text-xs">
                                <span className="font-medium">{award?.name}</span>
                                <Badge 
                                  variant={voteCount >= 3 ? "default" : "secondary"} 
                                  className="ml-1 text-xs"
                                >
                                  {voteCount}/3
                                </Badge>
                              </div>
                            );
                          })
                        ) : (
                          <span className="text-muted-foreground text-xs">No votes</span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};