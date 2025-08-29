import { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PartyBadge } from "@/components/ui/party-badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, Trophy, Medal, Award, Star, Users, Users2, Target, Filter, MapPin, Download, FileSpreadsheet, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';

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


  const hasRealScores = leaderboard.some(e => (e.average_score ?? 0) > 0);

  const filteredLeaderboard = leaderboard.filter(entry => {
    const matchesSearch = entry.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.position.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.constituency?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.city?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCity = !cityFilter || cityFilter === 'all' || entry.city === cityFilter;
    const matchesParty = !partyFilter || partyFilter === 'all' || entry.party_number.toString() === partyFilter;
    const matchesPosition = !positionFilter || positionFilter === 'all' || entry.position === positionFilter;
    
    return matchesSearch && matchesCity && matchesParty && matchesPosition;
  });

  const exportToCSV = () => {
    const exportData = filteredLeaderboard.map((entry, index) => ({
      Rank: hasRealScores ? index + 1 : '',
      Name: entry.name,
      Position: entry.position,
      Party: `Party ${entry.party_number}`,
      'Average Score': Math.round(entry.average_score || 0),
      'Assessment Count': entry.assessment_count,
      Constituency: entry.constituency || '',
      State: entry.state || '',
      'Home City': entry.city || '',
      Awards: studentAwards[entry.user_id]?.join(', ') || 'No awards'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Leaderboard');
    
    const timestamp = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `leaderboard-${timestamp}.xlsx`);
    
    toast({
      title: "Export Successful",
      description: "Leaderboard data exported to Excel file",
    });
  };

  const exportToPDF = () => {
    const pdf = new jsPDF();
    
    // Title
    pdf.setFontSize(20);
    pdf.text('Student Leaderboard Report', 20, 20);
    
    // Date
    pdf.setFontSize(12);
    const timestamp = new Date().toLocaleDateString();
    pdf.text(`Generated on: ${timestamp}`, 20, 35);
    
    // Summary stats
    pdf.text(`Total Students: ${leaderboard.length}`, 20, 50);
    pdf.text(`Filtered Results: ${filteredLeaderboard.length}`, 20, 60);
    pdf.text(`Top Score: ${leaderboard.length > 0 ? Math.round(leaderboard[0]?.average_score || 0) : 0}`, 20, 70);
    
    // Table headers
    let y = 90;
    pdf.setFontSize(10);
    pdf.text('Rank', 20, y);
    pdf.text('Name', 40, y);
    pdf.text('Position', 100, y);
    pdf.text('Party', 140, y);
    pdf.text('Score', 160, y);
    pdf.text('Awards', 180, y);
    
    // Draw header line
    pdf.line(20, y + 2, 200, y + 2);
    y += 10;
    
    // Data rows
    filteredLeaderboard.slice(0, 30).forEach((entry, index) => { // Limit to 30 for PDF space
      const rank = hasRealScores ? (index + 1).toString() : '—';
      const awards = studentAwards[entry.user_id]?.length || 0;
      
      pdf.text(rank, 20, y);
      pdf.text(entry.name.substring(0, 25), 40, y);
      pdf.text(entry.position.substring(0, 15), 100, y);
      pdf.text(`Party ${entry.party_number}`, 140, y);
      pdf.text(Math.round(entry.average_score || 0).toString(), 160, y);
      pdf.text(awards.toString(), 180, y);
      
      y += 8;
      
      // Add new page if needed
      if (y > 270) {
        pdf.addPage();
        y = 20;
      }
    });
    
    if (filteredLeaderboard.length > 30) {
      pdf.text(`... and ${filteredLeaderboard.length - 30} more students`, 20, y + 10);
    }
    
    const filename = `leaderboard-${new Date().toISOString().split('T')[0]}.pdf`;
    pdf.save(filename);
    
    toast({
      title: "Export Successful",
      description: "Leaderboard report exported to PDF",
    });
  };

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
      <Card className="bg-white rounded-3xl shadow-lg border border-border/20">
        <CardHeader className="border-b border-border/10">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Search className="w-5 h-5 text-primary" />
              Search & Filter Students
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={exportToCSV}
                className="flex items-center gap-2"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Export CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={exportToPDF}
                className="flex items-center gap-2"
              >
                <FileText className="w-4 h-4" />
                Export PDF
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search by name, position, constituency, city..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* City Filter */}
            <Select value={cityFilter} onValueChange={setCityFilter}>
              <SelectTrigger>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  <SelectValue placeholder="Filter by city" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cities</SelectItem>
                {uniqueCities.map((city) => (
                  <SelectItem key={city} value={city}>{city}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Party Filter */}
            <Select value={partyFilter} onValueChange={setPartyFilter}>
              <SelectTrigger>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  <SelectValue placeholder="Filter by party" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Parties</SelectItem>
                {uniqueParties.map((party) => (
                  <SelectItem key={party} value={party.toString()}>Party {party}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Position Filter */}
            <Select value={positionFilter} onValueChange={setPositionFilter}>
              <SelectTrigger>
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4" />
                  <SelectValue placeholder="Filter by position" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Positions</SelectItem>
                {uniquePositions.map((position) => (
                  <SelectItem key={position} value={position}>{position}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="p-6 text-center">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div className="text-3xl font-black text-slate-800 mb-2">{leaderboard.length}</div>
            <p className="text-slate-600 font-semibold">Total Students</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-200">
          <CardContent className="p-6 text-center">
            <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Trophy className="w-6 h-6 text-white" />
            </div>
            <div className="text-3xl font-black text-slate-800 mb-2">
              {leaderboard.length > 0 ? Math.round(leaderboard[0].average_score) : 0}
            </div>
            <p className="text-slate-600 font-semibold">Top Score</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-teal-50 border-green-200">
          <CardContent className="p-6 text-center">
            <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-teal-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Award className="w-6 h-6 text-white" />
            </div>
            <div className="text-3xl font-black text-slate-800 mb-2">
              {Object.values(studentAwards).reduce((sum, awards) => sum + awards.length, 0)}
            </div>
            <p className="text-slate-600 font-semibold">Awards Given</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
          <CardContent className="p-6 text-center">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Target className="w-6 h-6 text-white" />
            </div>
            <div className="text-3xl font-black text-slate-800 mb-2">
              {leaderboard.length > 0 
                ? (leaderboard.reduce((sum, entry) => sum + entry.assessment_count, 0) / leaderboard.length).toFixed(1)
                : 0}
            </div>
            <p className="text-slate-600 font-semibold">Avg Assessments</p>
          </CardContent>
        </Card>
      </div>

      {/* Student Cards - Scrollable Container */}
      <Card className="bg-white rounded-3xl shadow-lg border border-border/20">
        <CardHeader className="border-b border-border/10">
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-primary" />
            Overall Leaderboard ({filteredLeaderboard.length} students)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="max-h-[600px] overflow-y-auto pr-2">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
              {filteredLeaderboard.map((entry, index) => {
                const studentVotes = awardVotes.filter(vote => vote.student_id === entry.user_id);
                const uniqueAwards = [...new Set(studentVotes.map(vote => vote.award_id))];
                const initials = entry.name.split(' ').map(n => n[0]).join('').toUpperCase();
                const assignedAwards = studentAwards[entry.user_id] || [];

                return (
                  <Card
                    key={entry.user_id}
                    className="h-full flex flex-col overflow-hidden border border-border/20 hover:border-primary/30 transition-all duration-200 hover:shadow-md bg-gradient-to-r from-background to-accent/5"
                  >
                    <CardContent className="p-6 flex flex-col h-full">
                      {/* Header with Avatar, Rank and Name */}
                      <div className="flex items-center gap-4 mb-4">
                        <div className="relative">
                          <Avatar className="w-16 h-16 border-2 border-border/20">
                            <AvatarImage src={entry.photo_url} alt={entry.name} />
                            <AvatarFallback className="text-sm bg-gradient-to-br from-blue-500 to-purple-600 text-white font-bold">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          {hasRealScores && (
                            <div className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center shadow-lg">
                              <span className="text-white text-xs font-bold">#{index + 1}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-lg text-foreground truncate mb-1">{entry.name}</h3>
                          <p className="text-sm text-muted-foreground truncate mb-2">{entry.position}</p>
                          <div className="flex items-center gap-2">
                            <PartyBadge partyNumber={entry.party_number} size="sm" />
                          </div>
                        </div>
                      </div>

                      {/* Student Details Grid */}
                      <div className="grid grid-cols-2 gap-4 mb-4 p-3 bg-accent/20 rounded-xl">
                        <div className="space-y-1">
                          <div className="text-xs font-medium text-muted-foreground">Average Score</div>
                          <div className="text-2xl font-black text-primary">{Math.round(entry.average_score)}</div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs font-medium text-muted-foreground">Assessments</div>
                          <div className="text-lg font-bold text-foreground">{entry.assessment_count}</div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs font-medium text-muted-foreground">Constituency</div>
                          <div className="text-sm text-foreground truncate">{entry.constituency || '—'}</div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs font-medium text-muted-foreground">Home City</div>
                          <div className="text-sm text-foreground truncate">{entry.city || '—'}</div>
                        </div>
                      </div>

                      {/* Awards Section */}
                      <div className="mb-4 p-3 bg-primary/5 rounded-xl">
                        <div className="text-xs font-medium text-muted-foreground mb-2">Awards & Recognition</div>
                        {assignedAwards.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {assignedAwards.map((award, idx) => (
                              <Badge key={idx} variant="default" className="text-xs">
                                {award}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground">No awards yet</div>
                        )}
                        
                        {uniqueAwards.length > 0 && (
                          <div className="mt-2">
                            <div className="text-xs text-muted-foreground">
                              Pending votes: {uniqueAwards.length} award{uniqueAwards.length !== 1 ? 's' : ''}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* State Info */}
                      <div className="mt-auto p-2 bg-muted/30 rounded-lg">
                        <div className="text-xs text-muted-foreground">
                          State: {entry.state || '—'}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};