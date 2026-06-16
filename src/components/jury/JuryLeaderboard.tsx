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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Trophy, Medal, Award, Star, Users, Vote, CheckCircle2, Filter, X, SortAsc, SortDesc } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

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
  jury_name?: string;
}

interface JuryLeaderboardProps {
  juryId: string;
}

export const JuryLeaderboard = ({ juryId }: JuryLeaderboardProps) => {
  const { profile } = useAuth();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [awards, setAwards] = useState<Award[]>([]);
  const [awardVotes, setAwardVotes] = useState<AwardVote[]>([]);
  const [studentAwards, setStudentAwards] = useState<Record<string, string[]>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [positionFilter, setPositionFilter] = useState('all-positions');
  const [partyFilter, setPartyFilter] = useState('all-parties');
  const [stateFilter, setStateFilter] = useState('all-states');
  const [sortBy, setSortBy] = useState<'score' | 'name' | 'assessments'>('score');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
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
      const eventId = profile?.event_id ?? '';

      const { data: leaderboardData, error: leaderboardError } = await supabase
        .from('jury_leaderboard')
        .select('*')
        .eq('event_id', eventId);

      if (leaderboardError) throw leaderboardError;

      // Fetch awards visible to jury
      const { data: awardsData, error: awardsError } = await supabase
        .from('awards')
        .select('*')
        .eq('visible_to_jury', true)
        .order('name');

      if (awardsError) throw awardsError;

      // Fetch award votes with jury names
      const { data: votesData, error: votesError } = await supabase
        .from('award_votes')
        .select(`
          award_id,
          student_id,
          jury_id,
          awards (name)
        `)
        .eq('event_id', eventId);

      if (votesError) throw votesError;

      // Fetch all jury profiles to map names using secure function
      const { data: allJuryData, error: allJuryError } = await supabase.rpc('get_jury_directory');

      if (allJuryError) throw allJuryError;

      // Identify orphaned votes (do not delete on client)
      const allVotes = votesData || [];
      const validJuryIds = new Set((allJuryData?.map(j => j.user_id)) || []);
      const orphanedVotes = allVotes.filter(vote => !validJuryIds.has(vote.jury_id));
      if (orphanedVotes.length > 0) {
        console.warn(`Found ${orphanedVotes.length} vote(s) from jury profiles not found. Displaying as "Unknown Jury".`);
      }

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
      
      const formattedVotes = allVotes.map(vote => {
        const juryProfile = allJuryData?.find(j => j.user_id === vote.jury_id);
        return {
          award_id: vote.award_id,
          student_id: vote.student_id,
          jury_id: vote.jury_id,
          award_name: (vote.awards as any)?.name || '',
          jury_name: juryProfile?.name || 'Unknown Jury'
        };
      });
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

  const handleRemoveVote = async (awardId: string, studentId: string) => {
    try {
      const { error } = await supabase
        .from('award_votes')
        .delete()
        .eq('award_id', awardId)
        .eq('student_id', studentId)
        .eq('jury_id', juryId);

      if (error) throw error;

      toast({
        title: "Vote Removed",
        description: "Your award vote has been removed",
      });

      fetchData();
    } catch (error) {
      console.error('Error removing vote:', error);
      toast({
        title: "Error",
        description: "Failed to remove vote",
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

  const getVoters = (awardId: string, studentId: string) => {
    return awardVotes
      .filter(vote => vote.award_id === awardId && vote.student_id === studentId)
      .map(vote => vote.jury_name || 'Unknown');
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="w-5 h-5 text-yellow-500" />;
    if (rank === 2) return <Medal className="w-5 h-5 text-gray-400" />;
    if (rank === 3) return <Award className="w-5 h-5 text-amber-600" />;
    return <span className="w-5 h-5 flex items-center justify-center text-sm font-bold">{rank}</span>;
  };

  const hasRealScores = leaderboard.some(e => (e.average_score ?? 0) > 0);

  // Get unique values for filters
  const uniquePositions = [...new Set(leaderboard.map(e => e.position))].sort();
  const uniqueParties = [...new Set(leaderboard.map(e => e.party_number))].sort((a, b) => a - b);
  const uniqueStates = [...new Set(leaderboard.map(e => e.state))].sort();

  // Apply filters and search
  let filteredLeaderboard = leaderboard.filter(entry => {
    const matchesSearch = 
      entry.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.position.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.constituency?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesPosition = positionFilter === 'all-positions' || !positionFilter || entry.position === positionFilter;
    const matchesParty = partyFilter === 'all-parties' || !partyFilter || entry.party_number.toString() === partyFilter;
    const matchesState = stateFilter === 'all-states' || !stateFilter || entry.state === stateFilter;
    
    return matchesSearch && matchesPosition && matchesParty && matchesState;
  });

  // Apply sorting
  filteredLeaderboard.sort((a, b) => {
    let aValue, bValue;
    
    switch (sortBy) {
      case 'score':
        aValue = a.average_score;
        bValue = b.average_score;
        break;
      case 'name':
        aValue = a.name.toLowerCase();
        bValue = b.name.toLowerCase();
        break;
      case 'assessments':
        aValue = a.assessment_count;
        bValue = b.assessment_count;
        break;
      default:
        aValue = a.average_score;
        bValue = b.average_score;
    }
    
    if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const clearFilters = () => {
    setSearchTerm('');
    setPositionFilter('all-positions');
    setPartyFilter('all-parties');
    setStateFilter('all-states');
    setSortBy('score');
    setSortOrder('desc');
  };

  const hasActiveFilters = searchTerm || (positionFilter && positionFilter !== 'all-positions') || (partyFilter && partyFilter !== 'all-parties') || (stateFilter && stateFilter !== 'all-states') || sortBy !== 'score' || sortOrder !== 'desc';

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
    <Card className="bg-white/20 backdrop-blur-lg border border-white/25 shadow-lg">
      <CardHeader className="border-b border-white/25">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg">
              <Trophy className="w-6 h-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl font-black text-slate-800">Jury Leaderboard</CardTitle>
              <p className="text-slate-600 font-medium">Averaged scores from all juries</p>
            </div>
          </div>
          <Badge variant="outline" className="bg-white/20 border-white/30 text-slate-700 font-medium">
            {filteredLeaderboard.length} of {leaderboard.length} students
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white/20 backdrop-blur-lg rounded-2xl p-6 border border-white/25 shadow-lg text-center">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div className="text-3xl font-black text-slate-800 mb-2">{filteredLeaderboard.length}</div>
            <p className="text-slate-600 font-semibold">Filtered Students</p>
          </div>

          <div className="bg-white/20 backdrop-blur-lg rounded-2xl p-6 border border-white/25 shadow-lg text-center">
            <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Trophy className="w-6 h-6 text-white" />
            </div>
            <div className="text-3xl font-black text-slate-800 mb-2">
              {filteredLeaderboard.length > 0 ? Math.round(filteredLeaderboard[0].average_score) : 0}
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

        {/* Search and Filters */}
        <div className="space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search students by name, position, or constituency..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-white/20 backdrop-blur-sm border-white/30 text-slate-800 placeholder:text-slate-600"
            />
          </div>

          {/* Filters Row */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2 text-slate-700 font-medium">
              <Filter className="w-4 h-4" />
              <span>Filters:</span>
            </div>
            
            <Select value={positionFilter} onValueChange={setPositionFilter}>
              <SelectTrigger className="w-[180px] bg-white/20 backdrop-blur-sm border-white/30 text-slate-800">
                <SelectValue placeholder="Position" />
              </SelectTrigger>
              <SelectContent className="bg-white/95 backdrop-blur-lg border border-white/25">
                <SelectItem value="all-positions">All Positions</SelectItem>
                {uniquePositions.map(position => (
                  <SelectItem key={position} value={position}>{position}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={partyFilter} onValueChange={setPartyFilter}>
              <SelectTrigger className="w-[120px] bg-white/20 backdrop-blur-sm border-white/30 text-slate-800">
                <SelectValue placeholder="Party" />
              </SelectTrigger>
              <SelectContent className="bg-white/95 backdrop-blur-lg border border-white/25">
                <SelectItem value="all-parties">All Parties</SelectItem>
                {uniqueParties.map(party => {
                  const partyLetter = ['No Party', 'A', 'B', 'C', 'D', 'E'][party] || party;
                  return (
                    <SelectItem key={party} value={party.toString()}>Party {partyLetter}</SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            <Select value={stateFilter} onValueChange={setStateFilter}>
              <SelectTrigger className="w-[150px] bg-white/20 backdrop-blur-sm border-white/30 text-slate-800">
                <SelectValue placeholder="State" />
              </SelectTrigger>
              <SelectContent className="bg-white/95 backdrop-blur-lg border border-white/25">
                <SelectItem value="all-states">All States</SelectItem>
                {uniqueStates.map(state => (
                  <SelectItem key={state} value={state}>{state}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <span className="text-slate-700 font-medium text-sm">Sort by:</span>
              <Select value={sortBy} onValueChange={(value: 'score' | 'name' | 'assessments') => setSortBy(value)}>
                <SelectTrigger className="w-[130px] bg-white/20 backdrop-blur-sm border-white/30 text-slate-800">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white/95 backdrop-blur-lg border border-white/25">
                  <SelectItem value="score">Score</SelectItem>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="assessments">Assessments</SelectItem>
                </SelectContent>
              </Select>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="bg-white/20 backdrop-blur-sm border-white/30 text-slate-800 hover:bg-white/35"
              >
                {sortOrder === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />}
              </Button>
            </div>

            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearFilters}
                className="bg-red-500/20 backdrop-blur-sm border-red-500/30 text-red-700 hover:bg-red-500/35"
              >
                <X className="w-4 h-4 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* Desktop Table View - Hidden on Mobile */}
        <div className="hidden md:block bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 overflow-hidden">
          <ScrollArea className="h-[600px]">
            <Table>
              <TableHeader className="sticky top-0 bg-white/20 backdrop-blur-lg z-10">
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
                {filteredLeaderboard.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12">
                      <div className="text-slate-600">
                        <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p className="text-lg font-medium">No students found</p>
                        <p className="text-sm">Try adjusting your search or filters</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLeaderboard.map((entry, index) => (
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
                             <AvatarImage 
                               src={entry.photo_url ? (entry.photo_url.includes('/file/d/') ? `https://drive.google.com/uc?export=view&id=${entry.photo_url.split('/d/')[1]?.split('/')[0]}` : entry.photo_url) : undefined} 
                               alt={entry.name}
                               referrerPolicy="no-referrer"
                               loading="lazy"
                               decoding="async"
                               onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/images/mahatma-logo.png'; }}
                             />
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
                         <Badge variant="secondary" className="bg-slate-200 text-slate-800 font-medium text-xs mb-1">
                           {entry.assessment_count}/3 Assessed
                         </Badge>
                         {awards.some(award => getVoteCount(award.id, entry.user_id) > 0) && (
                           <div className="text-xs text-slate-600 font-medium">
                             {awards.filter(award => getVoteCount(award.id, entry.user_id) > 0).length} Award{awards.filter(award => getVoteCount(award.id, entry.user_id) > 0).length !== 1 ? 's' : ''} Voted
                           </div>
                         )}
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
                               <DialogTitle className="text-slate-800 font-black">Manage Award Votes</DialogTitle>
                             </DialogHeader>
                             <div className="space-y-4">
                               <div className="text-sm bg-white/20 backdrop-blur-sm rounded-lg p-3 border border-white/25">
                                 Student: <span className="font-black text-slate-800">{entry.name}</span>
                               </div>

                                {/* All Votes Section */}
                                <div className="space-y-2">
                                  <h4 className="text-sm font-semibold text-slate-700">All Jury Votes:</h4>
                                  {awards.filter(award => getVoteCount(award.id, entry.user_id) > 0).length > 0 ? (
                                   <div className="space-y-2">
                                     {awards.filter(award => getVoteCount(award.id, entry.user_id) > 0).map((award) => (
                                        <div key={award.id} className="bg-blue-50/80 rounded-lg p-3 border border-blue-200/50">
                                          <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                              <CheckCircle2 className="w-4 h-4 text-blue-600" />
                                              <span className="text-sm font-medium text-slate-700">{award.name}</span>
                                              <span className="text-xs text-slate-500">({getVoteCount(award.id, entry.user_id)}/3 votes)</span>
                                            </div>
                                             {hasVoted(award.id, entry.user_id) && (
                                               <Button
                                                 size="sm"
                                                 variant="outline"
                                                 onClick={() => handleRemoveVote(award.id, entry.user_id)}
                                                 className="h-7 px-2 bg-red-50/80 border-red-200/50 text-red-600 hover:bg-red-100/80 text-xs"
                                               >
                                                 <X className="w-3 h-3 mr-1" />
                                                 Remove
                                               </Button>
                                             )}
                                          </div>
                                          {/* Show which jury members voted for this award */}
                                          {getVoters(award.id, entry.user_id).length > 0 && (
                                            <div className="mt-2 pt-2 border-t border-blue-200/30">
                                              <div className="text-xs text-slate-600 font-medium mb-1">Voted by:</div>
                                              <div className="flex flex-wrap gap-1">
                                                {getVoters(award.id, entry.user_id).map((voterName, voterIdx) => (
                                                  <Badge key={voterIdx} variant="secondary" className="text-xs bg-blue-100/80 text-blue-700 border border-blue-200/50">
                                                    {voterName}
                                                  </Badge>
                                                ))}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                     ))}
                                   </div>
                                 ) : (
                                   <p className="text-sm text-slate-500 italic">No votes cast yet</p>
                                 )}
                               </div>

                               {/* Cast New Vote Section */}
                               <div className="space-y-2">
                                 <h4 className="text-sm font-semibold text-slate-700">Cast New Vote:</h4>
                                 <Select value={selectedAward} onValueChange={setSelectedAward}>
                                   <SelectTrigger className="bg-white/20 backdrop-blur-sm border-white/30 text-slate-800">
                                     <SelectValue placeholder="Select an award" />
                                   </SelectTrigger>
                                   <SelectContent className="bg-white/95 backdrop-blur-lg border border-white/25">
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
                                 
                                 <Button
                                   onClick={handleAwardVote}
                                   disabled={!selectedAward}
                                   className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold"
                                 >
                                   <Vote className="w-4 h-4 mr-2" />
                                   Cast Vote
                                 </Button>
                               </div>
                             </div>
                           </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>

        {/* Mobile Card View - Visible only on Mobile */}
        <div className="md:hidden space-y-3 max-h-[600px] overflow-y-auto">
          {filteredLeaderboard.length === 0 ? (
            <div className="text-center py-12 text-slate-600">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No students found</p>
              <p className="text-sm">Try adjusting your search or filters</p>
            </div>
          ) : (
            filteredLeaderboard.map((entry, index) => {
              const initials = entry.name.split(' ').map(n => n[0]).join('').toUpperCase();
              
              return (
                <Card key={entry.user_id} className="bg-white/15 backdrop-blur-lg border border-white/25 p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="flex-shrink-0">
                      {hasRealScores ? getRankIcon(index + 1) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Avatar className="w-10 h-10 border-2 border-white/30">
                          <AvatarImage 
                            src={entry.photo_url ? (entry.photo_url.includes('/file/d/') ? `https://drive.google.com/uc?export=view&id=${entry.photo_url.split('/d/')[1]?.split('/')[0]}` : entry.photo_url) : undefined}
                            alt={entry.name}
                          />
                          <AvatarFallback className="text-xs bg-gradient-to-br from-slate-500 to-slate-600 text-white font-bold">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-sm truncate">{entry.name}</h3>
                          <p className="text-xs text-slate-600 truncate">{entry.constituency}, {entry.state}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <Badge variant="outline" className="bg-white/20 border-white/30 text-xs">
                          {entry.position}
                        </Badge>
                        <PartyBadge partyNumber={entry.party_number} size="sm" />
                      </div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <Badge variant="secondary" className="bg-slate-200 text-slate-800 font-medium text-xs">
                          {entry.assessment_count}/3 Assessed
                        </Badge>
                        <div className="font-black text-xl text-slate-800">
                          {Math.round(entry.average_score)}
                        </div>
                      </div>
                      {studentAwards[entry.user_id] && studentAwards[entry.user_id].length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {studentAwards[entry.user_id].map((award, idx) => (
                            <Badge key={idx} className="text-xs bg-yellow-500/20 text-yellow-700 border border-yellow-500/30">
                              <Trophy className="w-3 h-3 mr-1" />
                              {award}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button 
                        size="sm"
                        onClick={() => setSelectedStudent(entry)}
                        className="w-full bg-white/20 backdrop-blur-sm border-white/30 text-slate-800 hover:bg-white/35 touch-target"
                      >
                        <Vote className="w-4 h-4 mr-2" />
                        Vote Award
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-[95vw] sm:max-w-md bg-white/95 backdrop-blur-lg border border-white/25">
                      <DialogHeader>
                        <DialogTitle className="text-slate-800 font-black text-base">Manage Award Votes</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                        <div className="text-sm bg-white/20 backdrop-blur-sm rounded-lg p-3 border border-white/25">
                          Student: <span className="font-black text-slate-800">{entry.name}</span>
                        </div>

                        {/* All Votes Section */}
                        <div className="space-y-2">
                          <h4 className="text-sm font-semibold text-slate-700">All Jury Votes:</h4>
                          {awards.filter(award => getVoteCount(award.id, entry.user_id) > 0).length > 0 ? (
                            <div className="space-y-2">
                              {awards.filter(award => getVoteCount(award.id, entry.user_id) > 0).map((award) => (
                                <div key={award.id} className="bg-blue-50/80 rounded-lg p-3 border border-blue-200/50">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <CheckCircle2 className="w-4 h-4 text-blue-600" />
                                      <span className="text-sm font-medium text-slate-700">{award.name}</span>
                                      <span className="text-xs text-slate-500">({getVoteCount(award.id, entry.user_id)}/3 votes)</span>
                                    </div>
                                    {hasVoted(award.id, entry.user_id) && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleRemoveVote(award.id, entry.user_id)}
                                        className="h-7 px-2 bg-red-50/80 border-red-200/50 text-red-600 hover:bg-red-100/80 text-xs"
                                      >
                                        <X className="w-3 h-3 mr-1" />
                                        Remove
                                      </Button>
                                    )}
                                  </div>
                                  {getVoters(award.id, entry.user_id).length > 0 && (
                                    <div className="mt-2 pt-2 border-t border-blue-200/30">
                                      <div className="text-xs text-slate-600 font-medium mb-1">Voted by:</div>
                                      <div className="flex flex-wrap gap-1">
                                        {getVoters(award.id, entry.user_id).map((voterName, voterIdx) => (
                                          <Badge key={voterIdx} variant="secondary" className="text-xs bg-blue-100/80 text-blue-700 border border-blue-200/50">
                                            {voterName}
                                          </Badge>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-slate-500 italic">No votes cast yet</p>
                          )}
                        </div>

                        {/* Cast New Vote Section */}
                        <div className="space-y-2">
                          <h4 className="text-sm font-semibold text-slate-700">Cast New Vote:</h4>
                          <Select value={selectedAward} onValueChange={setSelectedAward}>
                            <SelectTrigger className="bg-white/20 backdrop-blur-sm border-white/30 text-slate-800 touch-target">
                              <SelectValue placeholder="Select an award" />
                            </SelectTrigger>
                            <SelectContent className="bg-white/95 backdrop-blur-lg border border-white/25">
                              {awards.map((award) => (
                                <SelectItem key={award.id} value={award.id}>
                                  <div className="flex items-center justify-between w-full">
                                    <span className="font-medium text-sm">{award.name}</span>
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
                          
                          <Button
                            onClick={handleAwardVote}
                            disabled={!selectedAward}
                            className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold touch-target"
                          >
                            <Vote className="w-4 h-4 mr-2" />
                            Cast Vote
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </Card>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
};