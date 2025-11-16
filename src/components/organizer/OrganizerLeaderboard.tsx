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
import autoTable from 'jspdf-autotable';

interface LeaderboardEntry {
  user_id: string;
  name: string;
  position: string;
  party_number: number;
  constituency: string;
  state: string;
  city: string;
  photo_url?: string;
  preevent_scores: number;
  jury_average_score: number;
  jury_converted_score: number;
  final_total_score: number;
  assessment_count: number;
  jury_count_submitted: number;
  award_ids: string[];
  serial_number: number;
  original_rank: number;
  missing_jury_assessments?: string[];
  organizer_manual_score?: number;
  session_names?: string[];
}

interface JuryMember {
  user_id: string;
  name: string;
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
  const [juryMembers, setJuryMembers] = useState<JuryMember[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [partyFilter, setPartyFilter] = useState('');
  const [positionFilter, setPositionFilter] = useState('');
  const [assessmentStatusFilter, setAssessmentStatusFilter] = useState('');
  const [sessionFilter, setSessionFilter] = useState('');
  const [sessionOptions, setSessionOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
    setupRealtimeSubscriptions();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch leaderboard data from organizer view
      const { data: leaderboardData, error: leaderboardError } = await supabase
        .from('organizer_leaderboard')
        .select('*');

      if (leaderboardError) throw leaderboardError;
      
      // Fetch organizer_manual_score for admin/journalist students
      const { data: manualScoreData, error: manualScoreError } = await supabase
        .from('profiles')
        .select('user_id, organizer_manual_score')
        .in('user_id', leaderboardData?.map(entry => entry.user_id) || []);
      
      if (manualScoreError) throw manualScoreError;
      
      // Create map for user_id to organizer_manual_score
      const manualScoreMap = new Map();
      manualScoreData?.forEach(profile => {
        manualScoreMap.set(profile.user_id, profile.organizer_manual_score);
      });

      // Fetch jury members
      const { data: juryData, error: juryError } = await supabase
        .from('profiles')
        .select('user_id, name')
        .eq('user_type', 'jury');

      if (juryError) throw juryError;
      setJuryMembers(juryData || []);

      // Fetch all assessments to determine missing jury assessments and sessions
      const { data: assessmentsData, error: assessmentsError } = await supabase
        .from('assessments')
        .select('student_id, jury_id, status, session_id');

      if (assessmentsError) throw assessmentsError;

      // Fetch session items to get session names
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('session_items')
        .select('id, title');

      if (sessionsError) throw sessionsError;
      
      console.log('All session items fetched:', sessionsData?.map(s => s.title));

      // Create a map of session_id to session title
      const sessionTitleMap = new Map<string, string>();
      sessionsData?.forEach(session => {
        sessionTitleMap.set(session.id, session.title);
      });

      // Create a map of student_id to their session names
      const studentSessionsMap = new Map<string, Set<string>>();
      assessmentsData?.forEach(assessment => {
        if (assessment.session_id && assessment.status === 'submitted') {
          const sessionName = sessionTitleMap.get(assessment.session_id);
          if (sessionName) {
            if (!studentSessionsMap.has(assessment.student_id)) {
              studentSessionsMap.set(assessment.student_id, new Set<string>());
            }
            studentSessionsMap.get(assessment.student_id)!.add(sessionName);
          }
        }
      });
      
      // Build available session options from assessments (submitted only)
      const sessionsWithSubmissions = new Set<string>();
      assessmentsData?.forEach(a => {
        if (a.session_id && a.status === 'submitted') {
          const name = sessionTitleMap.get(a.session_id);
          if (name) sessionsWithSubmissions.add(name);
        }
      });
      const options = Array.from(sessionsWithSubmissions).sort();
      setSessionOptions(options);
      
      console.log('Student sessions map size:', studentSessionsMap.size);
      console.log('Sample student sessions:', Array.from(studentSessionsMap.entries()).slice(0, 3));
      console.log('Session options (from assessments):', options);

      // Fetch serial numbers for all students in the leaderboard
      const userIds = leaderboardData?.map(entry => entry.user_id) || [];
      const { data: serialData, error: serialError } = await supabase
        .from('profiles')
        .select('user_id, serial_number')
        .in('user_id', userIds);

      if (serialError) throw serialError;

      // Create a map of user_id to serial_number
      const serialNumberMap = new Map();
      serialData?.forEach(profile => {
        serialNumberMap.set(profile.user_id, profile.serial_number);
      });

      // Create a map of submitted assessments
      const submittedAssessments = new Set();
      assessmentsData?.forEach(assessment => {
        if (assessment.status === 'submitted') {
          submittedAssessments.add(`${assessment.student_id}-${assessment.jury_id}`);
        }
      });

      // Sort leaderboard by final_total_score (descending) to get correct ranking
      const sortedLeaderboard = leaderboardData?.sort((a, b) => (b.final_total_score || 0) - (a.final_total_score || 0)) || [];
      
      // Process leaderboard data to include original rank, missing assessments, and manual scores
      const processedLeaderboard = sortedLeaderboard.map((entry, index) => {
        const missingJuryAssessments = juryData?.filter(jury => 
          !submittedAssessments.has(`${entry.user_id}-${jury.user_id}`)
        ).map(jury => jury.name) || [];

        return {
          ...entry,
          original_rank: index + 1,
          missing_jury_assessments: missingJuryAssessments,
          organizer_manual_score: manualScoreMap.get(entry.user_id) || 0,
          session_names: Array.from(studentSessionsMap.get(entry.user_id) || new Set<string>())
        };
      });
      setLeaderboard(processedLeaderboard);

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
  
  // Get unique session names from all students
  const allSessionNames = new Set<string>();
  leaderboard.forEach(entry => {
    entry.session_names?.forEach(session => allSessionNames.add(session));
  });
  const uniqueSessions = Array.from(allSessionNames).sort();
  
  console.log('Unique sessions found:', uniqueSessions);
  console.log('Total students with sessions:', leaderboard.filter(e => e.session_names && e.session_names.length > 0).length);


  const hasRealScores = leaderboard.some(e => (e.final_total_score ?? 0) > 0);

  const getAssessmentStatus = (entry: LeaderboardEntry) => {
    const totalJury = juryMembers.length;
    if (entry.assessment_count === 0) return 'not-assessed';
    if (entry.assessment_count < totalJury) return 'partially-assessed';
    return 'fully-assessed';
  };

  const filteredLeaderboard = leaderboard.filter(entry => {
    const matchesSearch = entry.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.position.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.constituency?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.serial_number.toString().includes(searchTerm);
    
    const matchesCity = !cityFilter || cityFilter === 'all' || entry.city === cityFilter;
    const matchesParty = !partyFilter || partyFilter === 'all' || entry.party_number.toString() === partyFilter;
    const matchesPosition = !positionFilter || positionFilter === 'all' || entry.position === positionFilter;
    const matchesSession = !sessionFilter || sessionFilter === 'all' || 
      (entry.session_names && entry.session_names.includes(sessionFilter));
    
    const matchesAssessmentStatus = !assessmentStatusFilter || assessmentStatusFilter === 'all' || 
      getAssessmentStatus(entry) === assessmentStatusFilter;
    
    return matchesSearch && matchesCity && matchesParty && matchesPosition && matchesSession && matchesAssessmentStatus;
  });

  const exportToCSV = () => {
    const exportData = filteredLeaderboard.map((entry) => ({
      Rank: hasRealScores ? entry.original_rank : '',
      Name: entry.name,
      Position: entry.position,
      Party: `Party ${entry.party_number}`,
      'Pre-Event Score (60)': entry.preevent_scores?.toFixed(2) || '0.00',
      'Jury Score (40)': entry.jury_converted_score?.toFixed(2) || '0.00',
      'Final Total (100)': entry.final_total_score?.toFixed(2) || '0.00',
      'Jury Average (100 scale)': entry.jury_average_score?.toFixed(2) || '0.00',
      'Assessment Count': entry.assessment_count,
      'Juries Submitted': `${entry.jury_count_submitted || 0} / ${juryMembers.length}`,
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
    const pdf = new jsPDF('p', 'mm', 'a4');

    // Title
    pdf.setFontSize(18);
    pdf.text('Student Leaderboard Report', 14, 16);

    // Metadata
    pdf.setFontSize(11);
    const timestamp = new Date().toLocaleString();
    pdf.text(`Generated on: ${timestamp}`, 14, 24);
    pdf.text(`Total Students: ${leaderboard.length}`, 14, 30);
    pdf.text(`Filtered Results: ${filteredLeaderboard.length}`, 14, 36);

    // Build table data for all rows (no truncation)
    const body = filteredLeaderboard.map((entry) => {
      const rank = hasRealScores ? entry.original_rank.toString() : '—';
      const awards = (studentAwards[entry.user_id]?.length || 0).toString();
      const preEventScore = entry.preevent_scores?.toFixed(1) || '0';
      const juryScore = entry.jury_converted_score?.toFixed(1) || '0';
      const finalScore = entry.final_total_score?.toFixed(1) || '0';
      return [rank, entry.name, entry.position, `Party ${entry.party_number}`, preEventScore, juryScore, finalScore, awards];
    });

    autoTable(pdf, {
      head: [[ 'Rank', 'Name', 'Position', 'Party', 'Pre(60)', 'Jury(40)', 'Total', 'Awards' ]],
      body,
      startY: 42,
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [33, 150, 243] },
      theme: 'striped',
      margin: { left: 14, right: 14 },
      columnStyles: {
        0: { cellWidth: 12 },
        1: { cellWidth: 45 },
        2: { cellWidth: 32 },
        3: { cellWidth: 22 },
        4: { cellWidth: 18, halign: 'right' },
        5: { cellWidth: 18, halign: 'right' },
        6: { cellWidth: 18, halign: 'right' },
        7: { cellWidth: 18, halign: 'right' }
      }
    });

    pdf.save(`leaderboard-${new Date().toISOString().split('T')[0]}.pdf`);

    toast({
      title: 'Export Successful',
      description: 'Leaderboard report exported to PDF',
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
              placeholder="Search by name, position, constituency, city, serial number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
                {uniqueParties.map((party) => {
                  const partyLetter = ['No Party', 'A', 'B', 'C', 'D', 'E'][party] || party;
                  return (
                    <SelectItem key={party} value={party.toString()}>Party {partyLetter}</SelectItem>
                  );
                })}
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

            {/* Assessment Status Filter */}
            <Select value={assessmentStatusFilter} onValueChange={setAssessmentStatusFilter}>
              <SelectTrigger>
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  <SelectValue placeholder="Filter by assessment status" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Assessment Status</SelectItem>
                <SelectItem value="not-assessed">Not Assessed</SelectItem>
                <SelectItem value="partially-assessed">Partially Assessed</SelectItem>
                <SelectItem value="fully-assessed">Fully Assessed</SelectItem>
              </SelectContent>
            </Select>

            {/* Session Filter */}
            <Select value={sessionFilter} onValueChange={setSessionFilter}>
              <SelectTrigger>
                <div className="flex items-center gap-2">
                  <Users2 className="w-4 h-4" />
                  <SelectValue placeholder="Filter by session" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sessions</SelectItem>
                {sessionOptions.map((session) => (
                  <SelectItem key={session} value={session}>{session}</SelectItem>
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
              {leaderboard.length > 0 ? Math.round(leaderboard[0].final_total_score) : 0}
            </div>
            <p className="text-slate-600 font-semibold">Top Final Score</p>
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
                               <span className="text-white text-xs font-bold">#{entry.original_rank}</span>
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

                      {/* Scoring Breakdown */}
                      <div className="space-y-3 mb-4">
                        {/* Final Score - Prominent */}
                        <div className="p-4 bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl border-2 border-primary/20">
                          <div className="text-xs font-medium text-muted-foreground mb-1">Final Total Score</div>
                          <div className="text-3xl font-black text-primary">{entry.final_total_score?.toFixed(2) || '0.00'}</div>
                          <div className="text-xs text-muted-foreground">out of 100</div>
                        </div>
                        
                        {/* Score Components */}
                        <div className="grid grid-cols-2 gap-3 p-3 bg-accent/20 rounded-xl">
                          <div className="space-y-1">
                            <div className="text-xs font-medium text-muted-foreground">Pre-Event Score</div>
                            <div className="text-lg font-bold text-foreground">{entry.preevent_scores?.toFixed(2) || '0.00'}</div>
                            <div className="text-xs text-muted-foreground">out of 60</div>
                          </div>
                          {/* Only show Jury Score for regular students (not administrators or journalists) */}
                          {!entry.position.toLowerCase().includes('administrator') && 
                           !entry.position.toLowerCase().includes('journalist') && (
                            <div className="space-y-1">
                              <div className="text-xs font-medium text-muted-foreground">Jury Score</div>
                              <div className="text-lg font-bold text-foreground">{entry.jury_converted_score?.toFixed(2) || '0.00'}</div>
                              <div className="text-xs text-muted-foreground">out of 40</div>
                            </div>
                          )}
                          {/* Show Live Event Score for administrators and journalists */}
                          {(entry.position.toLowerCase().includes('administrator') || 
                            entry.position.toLowerCase().includes('journalist')) && (
                            <div className="space-y-1">
                              <div className="text-xs font-medium text-muted-foreground">Live Event Score</div>
                              <div className="text-lg font-bold text-foreground">{entry.organizer_manual_score?.toFixed(2) || '0.00'}</div>
                              <div className="text-xs text-muted-foreground">out of 40</div>
                            </div>
                          )}
                        </div>
                        
                        {/* Additional Info */}
                        <div className="grid grid-cols-2 gap-3 p-3 bg-muted/30 rounded-xl">
                          {/* Only show Assessments count for regular students */}
                          {!entry.position.toLowerCase().includes('administrator') && 
                           !entry.position.toLowerCase().includes('journalist') && (
                            <>
                              <div className="space-y-1">
                                <div className="text-xs font-medium text-muted-foreground">Assessments</div>
                                <div className="text-sm font-bold text-foreground">{entry.assessment_count}</div>
                              </div>
                              <div className="space-y-1">
                                <div className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                  <Users className="w-3 h-3" />
                                  Juries Submitted
                                </div>
                                <div className="text-sm font-bold text-foreground">
                                  {entry.jury_count_submitted || 0} / {juryMembers.length}
                                </div>
                              </div>
                            </>
                          )}
                          {/* Show Scoring Type for administrators and journalists */}
                          {(entry.position.toLowerCase().includes('administrator') || 
                            entry.position.toLowerCase().includes('journalist')) && (
                            <>
                              <div className="space-y-1">
                                <div className="text-xs font-medium text-muted-foreground">Scoring Type</div>
                                <div className="text-sm font-bold text-foreground">Organizer Manual</div>
                              </div>
                              <div className="space-y-1">
                                <div className="text-xs font-medium text-muted-foreground">Constituency</div>
                                <div className="text-sm text-foreground truncate">{entry.constituency || '—'}</div>
                              </div>
                            </>
                          )}
                        </div>
                        {/* Location info moved to separate section for regular students */}
                        {!entry.position.toLowerCase().includes('administrator') && 
                         !entry.position.toLowerCase().includes('journalist') && (
                          <div className="p-3 bg-muted/30 rounded-xl">
                            <div className="space-y-1">
                              <div className="text-xs font-medium text-muted-foreground">Constituency</div>
                              <div className="text-sm text-foreground truncate">{entry.constituency || '—'}</div>
                            </div>
                          </div>
                        )}
                      </div>

                       {/* Assessment Status Section - Only for regular students */}
                      {!entry.position.toLowerCase().includes('administrator') && 
                       !entry.position.toLowerCase().includes('journalist') && (
                        <div className="mb-4 p-3 bg-orange/5 rounded-xl">
                          <div className="text-xs font-medium text-muted-foreground mb-2">Assessment Status</div>
                          <div className="flex items-center gap-2 mb-2">
                            <Badge 
                              variant={getAssessmentStatus(entry) === 'fully-assessed' ? 'default' : 
                                     getAssessmentStatus(entry) === 'partially-assessed' ? 'secondary' : 'destructive'}
                              className="text-xs"
                            >
                              {getAssessmentStatus(entry) === 'not-assessed' ? 'Not Assessed' :
                               getAssessmentStatus(entry) === 'partially-assessed' ? 'Partially Assessed' :
                               'Fully Assessed'}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              ({entry.assessment_count}/{juryMembers.length})
                            </span>
                          </div>
                          {entry.missing_jury_assessments && entry.missing_jury_assessments.length > 0 && (
                            <div className="text-xs text-red-600">
                              <div className="font-medium mb-1">Missing assessments from:</div>
                              <div className="space-y-1">
                                {entry.missing_jury_assessments.map((juryName, idx) => (
                                  <div key={idx} className="text-xs bg-red-50 px-2 py-1 rounded">
                                    {juryName}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Awards Section */}
                      <div className="mb-4 p-4 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-xl border border-yellow-200">
                        <div className="flex items-center gap-2 mb-3">
                          <Trophy className="w-4 h-4 text-yellow-600" />
                          <div className="text-sm font-semibold text-yellow-800">Awards & Recognition</div>
                        </div>
                        {assignedAwards.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {assignedAwards.map((award, idx) => (
                              <Badge key={idx} className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white border-0 shadow-sm font-medium">
                                <Star className="w-3 h-3 mr-1" />
                                {award}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground bg-white px-3 py-2 rounded-lg border border-gray-200">
                            No awards yet
                          </div>
                        )}
                        
                        {uniqueAwards.length > 0 && (
                          <div className="mt-3 p-2 bg-blue-50 rounded-lg border border-blue-200">
                            <div className="text-xs font-medium text-blue-700 mb-1">
                              Pending Jury Votes
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {uniqueAwards.map((awardId, idx) => {
                                const awardName = awards.find(a => a.id === awardId)?.name || 'Unknown Award';
                                const voteCount = getVoteCount(awardId, entry.user_id);
                                return (
                                  <Badge key={idx} variant="secondary" className="text-xs bg-blue-100 text-blue-700">
                                    {awardName} ({voteCount}/3)
                                  </Badge>
                                );
                              })}
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