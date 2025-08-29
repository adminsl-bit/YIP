import { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PartyBadge } from "@/components/ui/party-badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, Trophy, Medal, Award, Star, Users, Users2, Target, Filter, MapPin } from "lucide-react";
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
  const [cityFilter, setCityFilter] = useState('');
  const [partyFilter, setPartyFilter] = useState('');
  const [positionFilter, setPositionFilter] = useState('');
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

  // Get unique values for filters
  const uniqueCities = [...new Set(leaderboard.map(entry => entry.city).filter(Boolean))].sort();
  const uniqueParties = [...new Set(leaderboard.map(entry => entry.party_number))].sort((a, b) => a - b);
  const uniquePositions = [...new Set(leaderboard.map(entry => entry.position))].sort();


  const filteredLeaderboard = leaderboard.filter(entry => {
    const matchesSearch = entry.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.position.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.constituency?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.city?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCity = !cityFilter || entry.city === cityFilter;
    const matchesParty = !partyFilter || entry.party_number.toString() === partyFilter;
    const matchesPosition = !positionFilter || entry.position === positionFilter;
    
    return matchesSearch && matchesCity && matchesParty && matchesPosition;
  });

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
      {/* Search and Filter Section */}
      <div className="bg-white/15 backdrop-blur-lg rounded-2xl border border-white/25 shadow-lg p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center shadow-lg">
            <Filter className="w-4 h-4 text-white" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">Search & Filters</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search by name, position, constituency, city..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-white/20 backdrop-blur-sm border-white/30 text-slate-800 placeholder:text-slate-600"
            />
          </div>

          {/* City Filter */}
          <Select value={cityFilter} onValueChange={setCityFilter}>
            <SelectTrigger className="bg-white/20 backdrop-blur-sm border-white/30 text-slate-800">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                <SelectValue placeholder="Filter by city" />
              </div>
            </SelectTrigger>
            <SelectContent className="bg-white border-white/25 shadow-xl">
              <SelectItem value="">All Cities</SelectItem>
              {uniqueCities.map((city) => (
                <SelectItem key={city} value={city}>{city}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Party Filter */}
          <Select value={partyFilter} onValueChange={setPartyFilter}>
            <SelectTrigger className="bg-white/20 backdrop-blur-sm border-white/30 text-slate-800">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <SelectValue placeholder="Filter by party" />
              </div>
            </SelectTrigger>
            <SelectContent className="bg-white border-white/25 shadow-xl">
              <SelectItem value="">All Parties</SelectItem>
              {uniqueParties.map((party) => (
                <SelectItem key={party} value={party.toString()}>Party {party}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Position Filter */}
          <Select value={positionFilter} onValueChange={setPositionFilter}>
            <SelectTrigger className="bg-white/20 backdrop-blur-sm border-white/30 text-slate-800">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4" />
                <SelectValue placeholder="Filter by position" />
              </div>
            </SelectTrigger>
            <SelectContent className="bg-white border-white/25 shadow-xl">
              <SelectItem value="">All Positions</SelectItem>
              {uniquePositions.map((position) => (
                <SelectItem key={position} value={position}>{position}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
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

        <div className="bg-white/20 backdrop-blur-lg rounded-2xl p-6 border border-white/25 shadow-lg text-center">
          <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Target className="w-6 h-6 text-white" />
          </div>
          <div className="text-3xl font-black text-slate-800 mb-2">
            {leaderboard.length > 0 
              ? (leaderboard.reduce((sum, entry) => sum + entry.assessment_count, 0) / leaderboard.length).toFixed(1)
              : 0}
          </div>
          <p className="text-slate-600 font-semibold">Avg Assessments</p>
        </div>
      </div>

      {/* Award Summary */}
      <div className="bg-white/20 backdrop-blur-lg rounded-2xl border border-white/25 shadow-lg overflow-hidden">
        <div className="p-6 border-b border-white/25">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-2xl flex items-center justify-center shadow-lg">
              <Star className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-800">Award Voting Summary</h3>
              <p className="text-slate-600 font-medium">Track consensus progress across all awards</p>
            </div>
          </div>
        </div>
        
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {awards.map((award) => {
              const pendingVotes = awardVotes.filter(vote => vote.award_id === award.id);
              const uniqueStudents = [...new Set(pendingVotes.map(vote => vote.student_id))];
              const assignedCount = Object.values(studentAwards).flat().filter(name => name === award.name).length;
              
              return (
                <div key={award.id} className="bg-white/15 backdrop-blur-sm rounded-xl p-4 border border-white/20 space-y-2">
                  <h4 className="font-black text-slate-800 text-sm">{award.name}</h4>
                  <div className="flex justify-between text-xs text-slate-600 font-medium">
                    <span>{uniqueStudents.length} students with votes</span>
                    <span>{assignedCount} awarded</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-slate-700">Total votes: {pendingVotes.length}</span>
                    <Badge variant={assignedCount > 0 ? "default" : "secondary"} className="text-xs font-medium">
                      {assignedCount > 0 ? "Active" : "Pending"}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
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
              <h3 className="text-xl font-black text-slate-800">Overall Leaderboard</h3>
              <p className="text-slate-600 font-medium">Averaged scores from all jury assessments</p>
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
                  <TableHead className="w-32 text-center text-slate-700 font-semibold">Home City</TableHead>
                  <TableHead className="w-24 text-center text-slate-700 font-semibold">Score</TableHead>
                  <TableHead className="w-28 text-center text-slate-700 font-semibold">Progress</TableHead>
                  <TableHead className="w-32 text-center text-slate-700 font-semibold">Awards</TableHead>
                  <TableHead className="w-32 text-center text-slate-700 font-semibold">Vote Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeaderboard.map((entry, index) => {
                  const studentVotes = awardVotes.filter(vote => vote.student_id === entry.user_id);
                  const uniqueAwards = [...new Set(studentVotes.map(vote => vote.award_id))];
                  
                  return (
                    <TableRow key={entry.user_id} className="border-white/25 hover:bg-white/10 transition-colors">
                      <TableCell>
                        <div className="flex items-center justify-center">
                          {getRankIcon(index + 1)}
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
                        <div className="flex items-center justify-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-500" />
                          <span className="text-sm font-medium text-slate-700">{entry.city || 'N/A'}</span>
                        </div>
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
                        <div className="space-y-1 flex flex-col items-center">
                          {uniqueAwards.length > 0 ? (
                            uniqueAwards.map((awardId) => {
                              const voteCount = getVoteCount(awardId, entry.user_id);
                              const award = awards.find(a => a.id === awardId);
                              return (
                                <div key={awardId} className="text-xs flex items-center gap-1">
                                  <span className="font-semibold text-slate-700 text-center">{award?.name}</span>
                                  <Badge 
                                    variant={voteCount >= 3 ? "default" : "secondary"} 
                                    className="text-xs font-medium"
                                  >
                                    {voteCount}/3
                                  </Badge>
                                </div>
                              );
                            })
                          ) : (
                            <span className="text-slate-600 text-xs font-medium">No votes</span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
};