import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Users, UserX, UserCheck, Shield, AlertTriangle } from "lucide-react";
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
  is_active?: boolean;
  last_login_at?: string;
  session_id?: string;
}

interface Assessment {
  id: string;
  student_id: string;
  total_score: number;
  status: 'draft' | 'submitted' | 'locked';
  updated_at: string;
}

export const OrganizerStudentList = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState({
    seatRole: "all",
    partyNumber: "all",
    constituency: "",
    state: "",
    status: "all"
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStudents();
    fetchAssessments();
  }, []);

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
        .select('*');

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

    // Apply status filter
    if (filters.status && filters.status !== "all") {
      filtered = filtered.filter(student => {
        const status = getStudentStatus(student.user_id);
        return status === filters.status;
      });
    }

    setFilteredStudents(filtered);
  };

  const getSeatRole = (position: string): string => {
    const pos = position.toLowerCase();
    if (pos.includes('speaker') && pos.includes('deputy')) return 'deputy_speaker';
    if (pos.includes('speaker')) return 'speaker';
    return 'mp';
  };

  const getStudentStatus = (userId: string): string => {
    const studentAssessments = assessments.filter(a => a.student_id === userId);
    if (studentAssessments.length === 0) return 'not_assessed';
    
    const hasSubmitted = studentAssessments.some(a => a.status === 'submitted');
    const hasDraft = studentAssessments.some(a => a.status === 'draft');
    
    if (hasSubmitted) return 'assessed';
    if (hasDraft) return 'in_progress';
    return 'not_assessed';
  };

  const getAssessmentCount = (userId: string): number => {
    return assessments.filter(a => a.student_id === userId && a.status === 'submitted').length;
  };

  const getAverageScore = (userId: string): number => {
    const studentAssessments = assessments.filter(a => a.student_id === userId && a.status === 'submitted');
    if (studentAssessments.length === 0) return 0;
    
    const total = studentAssessments.reduce((sum, a) => sum + a.total_score, 0);
    return Math.round(total / studentAssessments.length);
  };

  const toggleStudentStatus = async (studentId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: !currentStatus })
        .eq('user_id', studentId);

      if (error) throw error;

      toast({
        title: "Student Status Updated",
        description: `Student has been ${!currentStatus ? 'activated' : 'deactivated'}`,
      });

      fetchStudents();
    } catch (error) {
      console.error('Error updating student status:', error);
      toast({
        title: "Error",
        description: "Failed to update student status",
        variant: "destructive",
      });
    }
  };

  const forceLogout = async (studentId: string, studentName: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ session_id: null })
        .eq('user_id', studentId);

      if (error) throw error;

      toast({
        title: "Student Logged Out",
        description: `${studentName} has been forcefully logged out`,
      });

      fetchStudents();
    } catch (error) {
      console.error('Error forcing logout:', error);
      toast({
        title: "Error",
        description: "Failed to logout student",
        variant: "destructive",
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'assessed':
        return <UserCheck className="w-4 h-4 text-green-600" />;
      case 'in_progress':
        return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      default:
        return <UserX className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'assessed':
        return <Badge className="bg-green-500">Assessed</Badge>;
      case 'in_progress':
        return <Badge variant="outline" className="border-yellow-500 text-yellow-700">In Progress</Badge>;
      default:
        return <Badge variant="secondary">Not Assessed</Badge>;
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
      <Card className="bg-white rounded-3xl shadow-lg border border-border/20">
        <CardHeader className="border-b border-border/10">
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5 text-primary" />
            Search & Filter Students
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
              className="pl-10 h-12 text-base border-2 border-border/20 rounded-xl focus:border-primary transition-colors"
            />
          </div>

          {/* Filters */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Select value={filters.seatRole} onValueChange={(value) => setFilters(prev => ({ ...prev, seatRole: value }))}>
              <SelectTrigger className="h-12 border-2 border-border/20 rounded-xl bg-background">
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
              <SelectTrigger className="h-12 border-2 border-border/20 rounded-xl bg-background">
                <SelectValue placeholder="Filter by Party" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Parties</SelectItem>
                {[...new Set(students.map(s => s.party_number))].sort().map(party => (
                  <SelectItem key={party} value={party.toString()}>Party {party}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filters.status} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}>
              <SelectTrigger className="h-12 border-2 border-border/20 rounded-xl bg-background">
                <SelectValue placeholder="Filter by Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="assessed">Assessed</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="not_assessed">Not Assessed</SelectItem>
              </SelectContent>
            </Select>

            <Input
              placeholder="Filter by Constituency"
              value={filters.constituency}
              onChange={(e) => setFilters(prev => ({ ...prev, constituency: e.target.value }))}
              className="h-12 border-2 border-border/20 rounded-xl"
            />

            <Input
              placeholder="Filter by State"
              value={filters.state}
              onChange={(e) => setFilters(prev => ({ ...prev, state: e.target.value }))}
              className="h-12 border-2 border-border/20 rounded-xl"
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Showing {filteredStudents.length} of {students.length} students
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchTerm("");
                setFilters({ seatRole: "all", partyNumber: "all", constituency: "", state: "", status: "all" });
              }}
            >
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Student List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
        {filteredStudents.map((student) => {
          const status = getStudentStatus(student.user_id);
          const assessmentCount = getAssessmentCount(student.user_id);
          const averageScore = getAverageScore(student.user_id);
          const initials = student.name.split(' ').map(n => n[0]).join('').toUpperCase();

          return (
            <Card
              key={student.id}
              className="h-full flex flex-col overflow-hidden border border-border/20 hover:border-primary/30 transition-all duration-200 hover:shadow-md bg-gradient-to-r from-background to-accent/5"
            >
              <CardContent className="p-6 flex flex-col h-full">
                {/* Header with Avatar and Name */}
                <div className="flex items-center gap-4 mb-4">
                  <Avatar className="w-16 h-16 border-2 border-border/20">
                    <AvatarImage src={student.photo_url} alt={student.name} />
                    <AvatarFallback className="text-sm bg-gradient-to-br from-blue-500 to-purple-600 text-white font-bold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-lg text-foreground truncate mb-1">{student.name}</h3>
                    <p className="text-sm text-muted-foreground truncate mb-2">{student.position}</p>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(status)}
                      {getStatusBadge(status)}
                    </div>
                  </div>
                </div>

                {/* Student Details Grid */}
                <div className="grid grid-cols-2 gap-4 mb-4 p-3 bg-accent/20 rounded-xl min-h-[88px]">
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-muted-foreground">Serial Number</div>
                    <div className="text-sm font-bold text-foreground">{student.serial_number}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-muted-foreground">Party</div>
                    <div className="text-sm font-bold text-foreground">{student.party_number}</div>
                  </div>
                  <div className="space-y-1 col-span-2">
                    <div className="text-xs font-medium text-muted-foreground">Location</div>
                    <div className="text-sm text-foreground truncate">
                      {student.constituency}{student.state ? `, ${student.state}` : ''}
                    </div>
                  </div>
                </div>

                {/* Assessment Information */}
                <div className="flex items-center justify-between mb-4 p-3 bg-primary/5 rounded-xl min-h-[64px]">
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-muted-foreground">Assessments</div>
                    <div className="text-sm font-bold text-foreground">{assessmentCount} completed</div>
                  </div>
                  {assessmentCount > 0 && (
                    <div className="space-y-1 text-right">
                      <div className="text-xs font-medium text-muted-foreground">Average Score</div>
                      <div className="text-lg font-bold text-primary">{averageScore}</div>
                    </div>
                  )}
                </div>

                {/* Last Login Info */}
                {student.last_login_at && (
                  <div className="mb-4 p-2 bg-muted/30 rounded-lg">
                    <div className="text-xs text-muted-foreground">
                      Last login: {new Date(student.last_login_at).toLocaleDateString()}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="mt-auto flex gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleStudentStatus(student.user_id, student.is_active || false)}
                    className={`flex-1 h-10 ${student.is_active ? 'hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30' : 'hover:bg-green-50 hover:text-green-700 hover:border-green-300'}`}
                  >
                    {student.is_active ? (
                      <>
                        <UserX className="w-4 h-4 mr-2" />
                        Deactivate
                      </>
                    ) : (
                      <>
                        <UserCheck className="w-4 h-4 mr-2" />
                        Activate
                      </>
                    )}
                  </Button>
                  {student.session_id && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => forceLogout(student.user_id, student.name)}
                      className="flex-1 h-10 hover:bg-orange-50 hover:text-orange-700 hover:border-orange-300"
                    >
                      <Shield className="w-4 h-4 mr-2" />
                      Force Logout
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredStudents.length === 0 && (
        <div className="text-center py-12 text-slate-600">
          <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No students found matching your criteria.</p>
        </div>
      )}
    </div>
  );
};