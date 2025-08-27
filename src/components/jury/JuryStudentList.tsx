import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Filter, Users, CheckCircle, Clock, Lock } from "lucide-react";
import { AssessmentForm } from "./AssessmentForm";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Student {
  id: string;
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
}

interface JuryStudentListProps {
  juryId: string;
}

export const JuryStudentList = ({ juryId }: JuryStudentListProps) => {
  const [students, setStudents] = useState<Student[]>([]);
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
    fetchAssessments();
  }, [juryId]);

  useEffect(() => {
    applyFilters();
  }, [students, searchTerm, filters]);

  const fetchStudents = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_type', 'student')
        .order('party_number', { ascending: true })
        .order('serial_number', { ascending: true });

      if (error) throw error;
      setStudents(data || []);
    } catch (error) {
      console.error('Error fetching students:', error);
    }
  };

  const fetchAssessments = async () => {
    try {
      const { data, error } = await supabase
        .from('assessments')
        .select('*')
        .eq('jury_id', juryId);

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
    const pos = position.toLowerCase();
    if (pos.includes('speaker') && pos.includes('deputy')) return 'deputy_speaker';
    if (pos.includes('speaker')) return 'speaker';
    return 'mp';
  };

  const getAssessmentStatus = (studentId: string) => {
    const assessment = assessments.find(a => a.student_id === studentId);
    return assessment?.status || 'not_started';
  };

  const getAssessment = (studentId: string) => {
    return assessments.find(a => a.student_id === studentId);
  };

  const handleAssessmentSubmit = async (
    studentId: string,
    scores: Record<string, any>,
    notes: string,
    status: 'draft' | 'submitted'
  ) => {
    try {
      // Calculate total score
      const totalScore = calculateTotalFromScores(scores);
      
      const assessmentData = {
        jury_id: juryId,
        student_id: studentId,
        seat_role: getSeatRole(selectedStudent!.position),
        scores,
        total_score: totalScore,
        status,
        notes,
        submitted_at: status === 'submitted' ? new Date().toISOString() : null
      };

      const existingAssessment = getAssessment(studentId);
      
      if (existingAssessment) {
        const { error } = await supabase
          .from('assessments')
          .update(assessmentData)
          .eq('id', existingAssessment.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('assessments')
          .insert(assessmentData);
        
        if (error) throw error;
      }

      // Refresh assessments
      await fetchAssessments();
      setSelectedStudent(null);
    } catch (error) {
      console.error('Error saving assessment:', error);
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
      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Search className="w-5 h-5" />
            <span>Search & Filter Students</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search by name, serial no, party number, position, or constituency..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Filters */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Select value={filters.seatRole} onValueChange={(value) => setFilters(prev => ({ ...prev, seatRole: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="speaker">Speaker</SelectItem>
                <SelectItem value="deputy_speaker">Deputy Speaker</SelectItem>
                <SelectItem value="mp">MP</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.partyNumber} onValueChange={(value) => setFilters(prev => ({ ...prev, partyNumber: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by Party" />
              </SelectTrigger>
              <SelectContent>
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
            />

            <Input
              placeholder="Filter by State"
              value={filters.state}
              onChange={(e) => setFilters(prev => ({ ...prev, state: e.target.value }))}
            />
          </div>

          <div className="flex items-center space-x-4 text-sm text-muted-foreground">
            <span>Showing {filteredStudents.length} of {students.length} students</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchTerm("");
                setFilters({ seatRole: "all", partyNumber: "all", constituency: "", state: "" });
              }}
            >
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Student List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredStudents.map((student) => {
          const status = getAssessmentStatus(student.id);
          const assessment = getAssessment(student.id);
          const initials = student.name.split(' ').map(n => n[0]).join('').toUpperCase();

          return (
            <Card
              key={student.id}
              className="cursor-pointer hover:shadow-md transition-shadow duration-200"
              onClick={() => setSelectedStudent(student)}
            >
              <CardContent className="p-4">
                <div className="flex items-center space-x-3 mb-3">
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={student.photo_url} alt={student.name} />
                    <AvatarFallback className="text-sm bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{student.name}</h3>
                    <p className="text-sm text-muted-foreground truncate">{student.position}</p>
                  </div>
                  {getStatusIcon(status)}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mb-3">
                  <div>Serial: {student.serial_number}</div>
                  <div>Party: {student.party_number}</div>
                  <div className="col-span-2 truncate">
                    {student.constituency}, {student.state}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  {getStatusBadge(status)}
                  {assessment && (
                    <span className="text-sm font-medium">
                      Score: {assessment.total_score}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredStudents.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No students found matching your criteria.</p>
        </div>
      )}

      {/* Assessment Dialog */}
      <Dialog open={!!selectedStudent} onOpenChange={() => setSelectedStudent(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Assess Student</DialogTitle>
          </DialogHeader>
          {selectedStudent && (
            <AssessmentForm
              student={selectedStudent}
              onSubmit={(scores, notes, status) => 
                handleAssessmentSubmit(selectedStudent.id, scores, notes, status)
              }
              initialScores={getAssessment(selectedStudent.id)?.scores || {}}
              initialNotes={getAssessment(selectedStudent.id)?.notes || ""}
              initialStatus={getAssessment(selectedStudent.id)?.status}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};