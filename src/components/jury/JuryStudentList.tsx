import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PartyBadge } from "@/components/ui/party-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Filter, Users, CheckCircle, Clock, Lock } from "lucide-react";
import { AssessmentForm } from "./AssessmentForm";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";

interface Student {
  id: string;
  user_id: string;
  name: string;
  position: string;
  party_number: number;
  serial_number: number;
  constituency?: string;
  state?: string;
  city?: string;
  photo_url?: string;
  user_type: string;
}

interface Assessment {
  id: string;
  student_id: string;
  scores: any; // Changed from Record<string, any> to any to match Json type
  total_score: number;
  status: 'draft' | 'submitted' | 'locked';
  notes?: string;
  updated_at: string;
  session_id?: string;
}

interface Session {
  id: string;
  title: string;
  description?: string;
  session_date?: string;
  status?: string;
}

interface JuryStudentListProps {
  juryId: string;
}

export const JuryStudentList = ({ juryId }: JuryStudentListProps) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<string>("");
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState({
    seatRole: "all",
    partyNumber: "all",
    constituency: "",
    state: ""
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStudents();
    fetchSessions();
  }, [juryId]);

  useEffect(() => {
    if (selectedSession) {
      fetchAssessments();
    }
    
    // Set up real-time subscription for assessments
    const assessmentChannel = supabase
      .channel('jury-student-list-assessments')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'assessments',
          filter: `jury_id=eq.${juryId}` // Only listen to this jury's assessments
        },
        (payload) => {
          console.log('Student list assessment update received:', payload);
          // Refresh assessments when any assessment changes
          fetchAssessments();
        }
      )
      .subscribe();

    // Listen to profile changes for student updates
    const profileChannel = supabase
      .channel('jury-student-list-profiles')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `user_type=eq.student`
        },
        (payload) => {
          console.log('Student list profile update received:', payload);
          // Refresh students when student profiles change
          fetchStudents();
        }
      )
      .subscribe();

    // Cleanup subscriptions on unmount
    return () => {
      supabase.removeChannel(assessmentChannel);
      supabase.removeChannel(profileChannel);
    };
  }, [juryId, selectedSession]);

  useEffect(() => {
    applyFilters();
  }, [students, searchTerm, filters]);

  const fetchStudents = async () => {
    try {
      // Get all students first
      const { data: studentsData, error: studentsError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_type', 'student')
        .order('party_number', { ascending: true })
        .order('serial_number', { ascending: true });

      if (studentsError) throw studentsError;

      // Filter out students with Administrator or Journalist positions
      const regularStudents = studentsData?.filter(student => {
        const position = student.position.toLowerCase();
        return !position.includes('administrator') && !position.includes('journalist');
      }) || [];

      console.log('Total students:', studentsData?.length);
      console.log('Regular students after filter:', regularStudents.length);

      setStudents(regularStudents);
    } catch (error) {
      console.error('Error fetching students:', error);
    }
  };

  const fetchSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('session_items')
        .select('id, title, description, session_date, status')
        .order('session_date', { ascending: true })
        .order('sort_order', { ascending: true });

      if (error) throw error;
      
      setSessions(data || []);
      // Auto-select first active session, or first session if no active ones
      if (data && data.length > 0 && !selectedSession) {
        const activeSession = data.find(s => s.status === 'active');
        setSelectedSession(activeSession?.id || data[0].id);
      }
    } catch (error) {
      console.error('Error fetching sessions:', error);
      toast({
        title: "Error Loading Sessions",
        description: "Failed to load sessions. Please refresh the page.",
        variant: "destructive",
      });
    }
  };

  const fetchAssessments = async () => {
    if (!selectedSession) return;
    
    try {
      const { data, error } = await supabase
        .from('assessments')
        .select('*')
        .eq('jury_id', juryId)
        .eq('session_id', selectedSession);

      if (error) throw error;
      setAssessments((data || []) as Assessment[]);
    } catch (error) {
      console.error('Error fetching assessments:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = students;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(student =>
        student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.serial_number.toString().includes(searchTerm) ||
        student.party_number.toString().includes(searchTerm) ||
        student.position.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.constituency?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply role filter
    if (filters.seatRole && filters.seatRole !== "all") {
      filtered = filtered.filter(student => {
        const role = getSeatRole(student.position);
        return role === filters.seatRole;
      });
    }

    // Apply party filter
    if (filters.partyNumber && filters.partyNumber !== "all") {
      filtered = filtered.filter(student => 
        student.party_number.toString() === filters.partyNumber
      );
    }

    // Apply constituency filter
    if (filters.constituency) {
      filtered = filtered.filter(student => 
        student.constituency?.toLowerCase().includes(filters.constituency.toLowerCase())
      );
    }

    // Apply state filter
    if (filters.state) {
      filtered = filtered.filter(student => 
        student.state?.toLowerCase().includes(filters.state.toLowerCase())
      );
    }

    setFilteredStudents(filtered);
  };

  const getSeatRole = (position: string): string => {
    if (!position) return 'mp';
    const pos = position.toLowerCase();
    if (pos.includes('speaker') && pos.includes('deputy')) return 'deputy_speaker';
    if (pos.includes('speaker')) return 'speaker';
    if (pos.includes('administrator') || pos.includes('admin')) return 'administrator';
    if (pos.includes('journalist')) return 'journalist';
    // Normalize all minister roles to mp for assessment purposes
    if (pos.includes('minister') || pos.includes('shadow minister')) return 'mp';
    return 'mp';
  };
  // Party badge styling consistent with other components
  const getPartyBadgeClass = (partyNumber: number) => {
    const colors = [
      'bg-red-500/90 text-white border-red-600',
      'bg-blue-500/90 text-white border-blue-600', 
      'bg-green-500/90 text-white border-green-600',
      'bg-yellow-500/90 text-white border-yellow-600',
      'bg-purple-500/90 text-white border-purple-600',
      'bg-pink-500/90 text-white border-pink-600',
      'bg-indigo-500/90 text-white border-indigo-600',
      'bg-teal-500/90 text-white border-teal-600',
    ];
    return colors[(partyNumber - 1) % colors.length] || 'bg-slate-500/90 text-white border-slate-600';
  };
  const getAssessmentStatus = (studentUserId: string) => {
    const assessment = assessments.find(a => a.student_id === studentUserId);
    return assessment?.status || 'not_started';
  };

  const getAssessment = (studentUserId: string) => {
    return assessments.find(a => a.student_id === studentUserId);
  };

  const handleAssessmentSubmit = async (
    studentUserId: string,
    scores: Record<string, any>,
    notes: string,
    status: 'draft' | 'submitted'
  ) => {
    if (!selectedSession) {
      toast({
        title: "Session Required",
        description: "Please select a session from the dropdown at the top before submitting assessments.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Calculate total score
      const totalScore = calculateTotalFromScores(scores);
      const dbSeatRole = getSeatRole(selectedStudent!.position);
      
      console.log('Saving assessment with seat_role:', dbSeatRole, 'for position:', selectedStudent!.position);
      
      const assessmentData = {
        jury_id: juryId,
        student_id: studentUserId, // Use user_id instead of profile id
        session_id: selectedSession,
        seat_role: dbSeatRole,
        scores,
        total_score: totalScore,
        status,
        notes,
        submitted_at: status === 'submitted' ? new Date().toISOString() : null
      };

      // Use upsert with the new unique constraint including session_id
      const { error } = await supabase
        .from('assessments')
        .upsert(assessmentData, {
          onConflict: 'jury_id,student_id,session_id'
        });
      
      if (error) throw error;

      // Show success message
      if (status === 'submitted') {
        toast({
          title: "Assessment Submitted",
          description: "Your assessment has been submitted successfully.",
        });
      } else {
        toast({
          title: "Assessment Saved",
          description: "Your assessment has been saved as draft.",
        });
      }

      // Refresh assessments
      await fetchAssessments();
      setSelectedStudent(null);
    } catch (error) {
      console.error('Error saving assessment:', error);
      toast({
        title: "Error",
        description: "Failed to save assessment. Please try again.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const calculateTotalFromScores = (scores: Record<string, any>): number => {
    let total = 0;
    Object.values(scores).forEach(value => {
      if (typeof value === 'number') {
        total += value;
      } else if (typeof value === 'object') {
        Object.values(value).forEach(subValue => {
          if (typeof subValue === 'number') {
            total += subValue;
          }
        });
      }
    });
    return total;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'submitted':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'draft':
        return <Clock className="w-4 h-4 text-yellow-600" />;
      case 'locked':
        return <Lock className="w-4 h-4 text-red-600" />;
      default:
        return <div className="w-4 h-4 rounded-full border-2 border-gray-300" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'submitted':
        return <Badge className="bg-green-500">Submitted</Badge>;
      case 'draft':
        return <Badge variant="outline" className="border-yellow-500 text-yellow-700">Draft</Badge>;
      case 'locked':
        return <Badge variant="destructive">Locked</Badge>;
      default:
        return <Badge variant="secondary">Not Started</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Session Selection - MUST SELECT FIRST */}
      <div className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 backdrop-blur-lg rounded-3xl p-6 border-2 border-blue-300/50 shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center shadow-lg">
            <Users className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-800">Select Session to Assess</h3>
            <p className="text-sm text-slate-600 font-medium">Choose which session you want to evaluate students for</p>
          </div>
        </div>
        <Select value={selectedSession} onValueChange={setSelectedSession}>
          <SelectTrigger className="h-14 bg-white/50 backdrop-blur-sm border-2 border-blue-300/50 rounded-2xl text-lg font-semibold">
            <SelectValue placeholder="Select a session to begin assessment..." />
          </SelectTrigger>
          <SelectContent className="bg-white/95 backdrop-blur-lg border-white/40">
            {sessions.length === 0 ? (
              <SelectItem value="no-sessions" disabled>No sessions available</SelectItem>
            ) : (
              sessions.map((session) => (
                <SelectItem key={session.id} value={session.id} className="text-base font-medium py-3">
                  {session.title}
                  {session.session_date && ` - ${new Date(session.session_date).toLocaleDateString()}`}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Search and Filters */}
      {selectedSession && (
        <div className="bg-white/20 backdrop-blur-lg rounded-3xl p-6 border border-white/25 shadow-xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center shadow-lg">
            <Search className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-xl font-black text-slate-800">Search & Filter Students</h3>
        </div>

        <div className="space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-500 w-5 h-5" />
            <Input
              placeholder="Search by name, serial no, party number, position, or constituency..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12 h-12 bg-white/30 backdrop-blur-sm border-white/40 text-slate-800 placeholder:text-slate-500 rounded-2xl"
            />
          </div>

          {/* Filters */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Select value={filters.seatRole} onValueChange={(value) => setFilters(prev => ({ ...prev, seatRole: value }))}>
              <SelectTrigger className="h-12 bg-white/30 backdrop-blur-sm border-white/40 rounded-2xl">
                <SelectValue placeholder="Filter by Role" />
              </SelectTrigger>
               <SelectContent className="bg-white/95 backdrop-blur-lg border-white/40">
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="speaker">Speaker</SelectItem>
                <SelectItem value="deputy_speaker">Deputy Speaker</SelectItem>
                <SelectItem value="minister">Minister</SelectItem>
                <SelectItem value="mp">MP</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.partyNumber} onValueChange={(value) => setFilters(prev => ({ ...prev, partyNumber: value }))}>
              <SelectTrigger className="h-12 bg-white/30 backdrop-blur-sm border-white/40 rounded-2xl">
                <SelectValue placeholder="Filter by Party" />
              </SelectTrigger>
              <SelectContent className="bg-white/95 backdrop-blur-lg border-white/40">
                <SelectItem value="all">All Parties</SelectItem>
                {[...new Set(students.map(s => s.party_number))].sort().map(party => (
                  <SelectItem key={party} value={party.toString()}>Party {party}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              placeholder="Filter by Constituency"
              value={filters.constituency}
              onChange={(e) => setFilters(prev => ({ ...prev, constituency: e.target.value }))}
              className="h-12 bg-white/30 backdrop-blur-sm border-white/40 rounded-2xl"
            />

            <Input
              placeholder="Filter by State"
              value={filters.state}
              onChange={(e) => setFilters(prev => ({ ...prev, state: e.target.value }))}
              className="h-12 bg-white/30 backdrop-blur-sm border-white/40 rounded-2xl"
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-600 font-medium">
              Showing {filteredStudents.length} of {students.length} students
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchTerm("");
                setFilters({ seatRole: "all", partyNumber: "all", constituency: "", state: "" });
              }}
              className="bg-white/20 backdrop-blur-sm border-white/30 text-slate-700 hover:bg-white/35 rounded-xl"
            >
              Clear Filters
            </Button>
          </div>
        </div>
      </div>
      )}

      {/* Students Grid */}
      {!selectedSession ? (
        <div className="bg-white/20 backdrop-blur-lg rounded-3xl p-12 border border-white/25 shadow-xl text-center">
          <Users className="w-16 h-16 text-slate-400 mx-auto mb-4" />
          <h3 className="text-2xl font-bold text-slate-800 mb-2">Select a Session First</h3>
          <p className="text-slate-600">Please select a session from the dropdown above to view and assess students for that session.</p>
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="text-center py-12">
          <Users className="w-16 h-16 mx-auto mb-4 text-slate-400" />
          <h3 className="text-xl font-semibold mb-2">No Students Found</h3>
          <p className="text-slate-600">Try adjusting your filters or search term.</p>
        </div>
      ) : (
      <div>
      {/* Student List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredStudents.map((student) => {
          const status = getAssessmentStatus(student.user_id);
          const assessment = getAssessment(student.user_id);
          const initials = student.name.split(' ').map(n => n[0]).join('').toUpperCase();

          return (
            <div
              key={student.id}
              className="bg-white/20 backdrop-blur-xl rounded-3xl p-6 border border-white/25 shadow-xl hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 cursor-pointer"
              onClick={() => setSelectedStudent(student)}
            >
              {/* Header */}
              <div className="flex items-center gap-4 mb-4">
                <Avatar className="w-14 h-14 ring-4 ring-white/20">
                  <AvatarImage src={student.photo_url} alt={student.name} />
                  <AvatarFallback className="text-base font-bold bg-gradient-to-br from-purple-500 to-indigo-500 text-white">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <h3 className="font-black text-slate-800 text-lg truncate font-serif">
                    {student.name}
                  </h3>
                  <div className="flex items-center gap-2">
                    <p className="text-slate-600 font-semibold truncate">{student.position}</p>
                  </div>
                </div>
                <div className="flex-shrink-0">{getStatusIcon(status)}</div>
              </div>

              {/* Info Grid aligned with Student Profile */}
              <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                <div className="bg-white/30 backdrop-blur-sm rounded-xl p-3">
                  <p className="text-muted-foreground font-medium">Serial</p>
                  <p className="font-bold text-slate-800">{student.serial_number}</p>
                </div>
                <div className="bg-white/30 backdrop-blur-sm rounded-xl p-3">
                  <p className="text-muted-foreground font-medium">Party</p>
                  <PartyBadge partyNumber={student.party_number} />
                </div>
                {student.constituency && (
                  <div className="bg-white/30 backdrop-blur-sm rounded-xl p-3 col-span-2 sm:col-span-1">
                    <p className="text-muted-foreground font-medium">Constituency</p>
                    <p className="font-semibold text-slate-800 text-sm leading-tight truncate">{student.constituency}</p>
                  </div>
                )}
                {student.state && (
                  <div className="bg-white/30 backdrop-blur-sm rounded-xl p-3 col-span-2 sm:col-span-1">
                    <p className="text-muted-foreground font-medium">State</p>
                    <p className="font-semibold text-slate-800 text-sm leading-tight truncate">{student.state}</p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between">
                {getStatusBadge(status)}
                {assessment && (
                  <div className="bg-white/30 backdrop-blur-sm rounded-xl px-3 py-1">
                    <span className="text-sm font-bold text-slate-800">Score: {assessment.total_score}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      </div>
      )}

      {/* Assessment Dialog */}
      <Dialog open={!!selectedStudent} onOpenChange={() => setSelectedStudent(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Assess Student: {selectedStudent?.name}</DialogTitle>
          </DialogHeader>
          {selectedStudent && selectedSession && (
            <div className="mt-4">
              <AssessmentForm
                key={`${selectedStudent.user_id}-${selectedSession}`} // Force re-render when student OR session changes
                student={selectedStudent}
                sessionId={selectedSession}
                sessionTitle={sessions.find(s => s.id === selectedSession)?.title || ''}
                onSubmit={(scores, notes, status) => 
                  handleAssessmentSubmit(selectedStudent.user_id, scores, notes, status)
                }
                initialScores={getAssessment(selectedStudent.user_id)?.scores || {}}
                initialNotes={getAssessment(selectedStudent.user_id)?.notes || ""}
                initialStatus={getAssessment(selectedStudent.user_id)?.status}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};