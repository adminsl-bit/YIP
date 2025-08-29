import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { PartyBadge } from "@/components/ui/party-badge";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, Trophy, Medal, Award, Star, Users, Vote, CheckCircle2 } from "lucide-react";
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

interface JuryLeaderboardProps {
  juryId: string;
}

export const JuryLeaderboard = ({ juryId }: JuryLeaderboardProps) => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [awards, setAwards] = useState<Award[]>([]);
  const [awardVotes, setAwardVotes] = useState<AwardVote[]>([]);
  const [studentAwards, setStudentAwards] = useState<Record<string, string[]>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<LeaderboardEntry | null>(null);
  const [selectedAward, setSelectedAward] = useState<string>('');
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

      // Fetch awards visible to jury
      const { data: awardsData, error: awardsError } = await supabase
        .from('awards')
        .select('*')
        .eq('visible_to_jury', true)
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
      .channel('jury-leaderboard-updates')
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
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'awards'
      }, () => {
        fetchData();
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  };

  const handleAwardVote = async () => {
    if (!selectedStudent || !selectedAward) return;

    try {
      const { error } = await supabase
        .from('award_votes')
        .upsert({
          award_id: selectedAward,
          student_id: selectedStudent.user_id,
          jury_id: juryId
        }, {
          onConflict: 'award_id,student_id,jury_id'
        });

      if (error) throw error;

      toast({
        title: "Vote Cast",
        description: "Your award vote has been recorded",
      });

      setSelectedStudent(null);
      setSelectedAward('');
      fetchData();
    } catch (error) {
      console.error('Error voting for award:', error);
      toast({
        title: "Error",
        description: "Failed to cast vote",
        variant: "destructive",
      });
    }
  };

  const getVoteCount = (awardId: string, studentId: string) => {
    return awardVotes.filter(vote => 
      vote.award_id === awardId && vote.student_id === studentId
    ).length;
  };

  const hasVoted = (awardId: string, studentId: string) => {
    return awardVotes.some(vote => 
      vote.award_id === awardId && vote.student_id === studentId && vote.jury_id === juryId
    );
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="w-5 h-5 text-yellow-500" />;
    if (rank === 2) return <Medal className="w-5 h-5 text-gray-400" />;
    if (rank === 3) return <Award className="w-5 h-5 text-amber-600" />;
    return <span className="w-5 h-5 flex items-center justify-center text-sm font-bold">{rank}</span>;
  };

  const getPartyColor = (partyNumber: number) => {
    const colors = [
      'bg-red-500/20 text-red-700 border-red-500/30',
      'bg-blue-500/20 text-blue-700 border-blue-500/30',
      'bg-green-500/20 text-green-700 border-green-500/30',
      'bg-yellow-500/20 text-yellow-700 border-yellow-500/30',
      'bg-purple-500/20 text-purple-700 border-purple-500/30',
      'bg-pink-500/20 text-pink-700 border-pink-500/30'
    ];
    return colors[(partyNumber - 1) % colors.length];
  };

  const hasRealScores = leaderboard.some(e => (e.average_score ?? 0) > 0);

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
    <div className="space-y-8">
      {/* Search Bar */}
      <div className="relative max-w-xl mx-auto">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
        <Input
          placeholder="Search students by name, position, or constituency..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 bg-white/20 backdrop-blur-sm border-white/30 text-slate-800 placeholder:text-slate-600"
        />
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white/20 backdrop-blur-lg rounded-2xl p-6 border border-white/25 shadow-lg text-center">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Users className="w-6 h-6 text-white" />
          </div>
          <div className="text-3xl font-black text-slate-800 mb-2">{leaderboard.length}</div>
          <p className="text-slate-600 font-semibold">Total Students</p>
        </div>

        <div className="bg-white/20 backdrop-blur-lg rounded-2xl p-6 border border-white/25 shadow-lg text-center">
          <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Trophy className="w-6 h-6 text-white" />
          </div>
          <div className="text-3xl font-black text-slate-800 mb-2">
            {leaderboard.length > 0 ? Math.round(leaderboard[0].average_score) : 0}
          </div>
          <p className="text-slate-600 font-semibold">Top Score</p>
        </div>

        <div className="bg-white/20 backdrop-blur-lg rounded-2xl p-6 border border-white/25 shadow-lg text-center">
          <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-teal-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Award className="w-6 h-6 text-white" />
          </div>
          <div className="text-3xl font-black text-slate-800 mb-2">
            {Object.values(studentAwards).reduce((sum, awards) => sum + awards.length, 0)}
          </div>
          <p className="text-slate-600 font-semibold">Awards Given</p>
        </div>
      </div>

      {/* Leaderboard Table */}
      <div className="bg-white/20 backdrop-blur-lg rounded-2xl border border-white/25 shadow-lg overflow-hidden">
        <div className="p-6 border-b border-white/25">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg">
              <Trophy className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-800">Jury Leaderboard</h3>
              <p className="text-slate-600 font-medium">Averaged scores from all juries</p>
            </div>
          </div>
        </div>
        
        <div className="p-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-white/25">
                  <TableHead className="w-16 text-center text-slate-700 font-semibold">Rank</TableHead>
                  <TableHead className="min-w-[200px] text-slate-700 font-semibold">Student</TableHead>
                  <TableHead className="w-32 text-center text-slate-700 font-semibold">Position</TableHead>
                  <TableHead className="w-24 text-center text-slate-700 font-semibold">Party</TableHead>
                  <TableHead className="w-24 text-center text-slate-700 font-semibold">Score</TableHead>
                  <TableHead className="w-28 text-center text-slate-700 font-semibold">Progress</TableHead>
                  <TableHead className="w-32 text-center text-slate-700 font-semibold">Awards</TableHead>
                  <TableHead className="w-32 text-center text-slate-700 font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeaderboard.map((entry, index) => (
                  <TableRow key={entry.user_id} className="border-white/25 hover:bg-white/10 transition-colors">
                    <TableCell>
                      <div className="flex items-center justify-center">
                        {hasRealScores ? getRankIcon(index + 1) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="w-10 h-10 border-2 border-white/25">
                          <AvatarImage src={entry.photo_url} alt={entry.name} />
                          <AvatarFallback className="bg-gradient-to-br from-slate-500 to-slate-600 text-white font-semibold">
                            {entry.name.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-semibold text-slate-800">{entry.name}</div>
                          <div className="text-sm text-slate-600">
                            {entry.constituency}, {entry.state}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="bg-white/20 border-white/30 text-slate-700 font-medium">
                        {entry.position}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <PartyBadge partyNumber={entry.party_number} size="md" />
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="font-black text-2xl text-slate-800">
                        {Math.round(entry.average_score)}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="bg-slate-200 text-slate-800 font-medium">
                        {entry.assessment_count}/3
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="space-y-1 flex flex-col items-center">
                        {studentAwards[entry.user_id]?.map((award, idx) => (
                          <Badge key={idx} className="text-xs bg-yellow-500/20 text-yellow-700 border border-yellow-500/30 font-medium">
                            <Trophy className="w-3 h-3 mr-1" />
                            {award}
                          </Badge>
                        )) || <span className="text-slate-600 text-sm font-medium">No awards</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => setSelectedStudent(entry)}
                            className="bg-white/20 backdrop-blur-sm border-white/30 text-slate-800 hover:bg-white/35 font-semibold"
                          >
                            <Vote className="w-4 h-4 mr-2" />
                            Vote Award
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md bg-white/95 backdrop-blur-lg border border-white/25">
                          <DialogHeader>
                            <DialogTitle className="text-slate-800 font-black">Vote for Award</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="text-sm bg-white/20 backdrop-blur-sm rounded-lg p-3 border border-white/25">
                              Voting for: <span className="font-black text-slate-800">{entry.name}</span>
                            </div>
                            
                            <Select value={selectedAward} onValueChange={setSelectedAward}>
                              <SelectTrigger className="bg-white/20 backdrop-blur-sm border-white/30 text-slate-800">
                                <SelectValue placeholder="Select an award" />
                              </SelectTrigger>
                              <SelectContent>
                                {awards.map((award) => (
                                  <SelectItem key={award.id} value={award.id}>
                                    <div className="flex items-center justify-between w-full">
                                      <span className="font-medium">{award.name}</span>
                                      <div className="flex items-center gap-2 ml-4">
                                        <span className="text-xs text-muted-foreground font-medium">
                                          {getVoteCount(award.id, entry.user_id)}/3 votes
                                        </span>
                                        {hasVoted(award.id, entry.user_id) && (
                                          <CheckCircle2 className="w-3 h-3 text-green-500" />
                                        )}
                                      </div>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            {selectedAward && (
                              <div className="text-xs bg-slate-100 rounded-lg p-3 text-slate-700 font-medium">
                                Current votes: {getVoteCount(selectedAward, entry.user_id)}/3
                                {getVoteCount(selectedAward, entry.user_id) >= 3 && (
                                  <span className="text-green-600 font-black"> - Award will be assigned!</span>
                                )}
                              </div>
                            )}

                            <div className="flex gap-2 pt-4">
                              <Button 
                                onClick={handleAwardVote}
                                disabled={!selectedAward}
                                className="flex-1 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white font-semibold"
                              >
                                Cast Vote
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
};