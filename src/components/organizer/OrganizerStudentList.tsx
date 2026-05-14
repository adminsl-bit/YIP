import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Users, UserX, UserCheck, Shield, AlertTriangle, Edit, BarChart3, TrendingUp, KeyRound, Eye, EyeOff, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { StudentEditDialog } from "./StudentEditDialog";
import { AssessmentChart } from "./AssessmentChart";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

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
  created_at?: string;
}

interface Assessment {
  id: string;
  student_id: string;
  jury_id: string;
  total_score: number;
  status: 'draft' | 'submitted' | 'locked';
  updated_at: string;
}

interface JuryAssessment {
  jury_id: string;
  jury_name: string;
  total_assessed: number;
  avg_score: number;
  assessments: Array<{
    student_id: string;
    student_name: string;
    total_score: number;
    status: string;
  }>;
}

export const OrganizerStudentList = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [juryAssessments, setJuryAssessments] = useState<JuryAssessment[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [passwordResetStudent, setPasswordResetStudent] = useState<Student | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showCharts, setShowCharts] = useState(false);
  const [filters, setFilters] = useState({
    seatRole: "all",
    partyNumber: "all",
    constituency: "",
    state: "",
    status: "all"
  });
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [activeRoles, setActiveRoles] = useState([
    { name: 'Speaker', type: 'Admin' },
    { name: 'Opposition', type: 'Lead' },
    { name: 'Rapporteur', type: 'Member' }
  ]);

  useEffect(() => {
    fetchStudents();
    fetchJuryAssessments();
    fetchAssessments();

    // Realtime: refresh when profiles change (e.g., after import)
    const channel = supabase
      .channel('realtime-profiles-organizer')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        fetchStudents();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    applyFilters();
  }, [students, searchTerm, filters]);

  const fetchStudents = async () => {
    try {
      const { data: studentsData, error: studentsError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_type', 'student')
        .order('serial_number');

      const { data: assessmentsData, error: assessmentsError } = await supabase
        .from('assessments')
        .select(`
          id, 
          student_id, 
          jury_id,
          total_score, 
          status, 
          updated_at
        `);

      if (studentsError) throw studentsError;
      if (assessmentsError) throw assessmentsError;

      setStudents(studentsData || []);
      setAssessments((assessmentsData || []).map(a => ({
        ...a,
        status: a.status as 'draft' | 'submitted' | 'locked'
      })));
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to load student data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchJuryAssessments = async () => {
    try {
      // Get all jury members
      const { data: juryData, error: juryError } = await supabase
        .from('profiles')
        .select('user_id, name')
        .eq('user_type', 'jury');

      if (juryError) throw juryError;

      // Get all assessments with student names
      const { data: assessmentsData, error: assessmentsError } = await supabase
        .from('assessments')
        .select(`
          jury_id,
          student_id,
          total_score,
          status,
          profiles!assessments_student_id_fkey (name)
        `)
        .eq('status', 'submitted');

      if (assessmentsError) throw assessmentsError;

      // Group assessments by jury
      const juryAssessmentsMap = new Map<string, JuryAssessment>();
      
      juryData?.forEach(jury => {
        juryAssessmentsMap.set(jury.user_id, {
          jury_id: jury.user_id,
          jury_name: jury.name,
          total_assessed: 0,
          avg_score: 0,
          assessments: []
        });
      });

      assessmentsData?.forEach(assessment => {
        const juryAssessment = juryAssessmentsMap.get(assessment.jury_id);
        if (juryAssessment) {
          juryAssessment.assessments.push({
            student_id: assessment.student_id,
            student_name: (assessment.profiles as any)?.name || 'Unknown',
            total_score: assessment.total_score,
            status: assessment.status
          });
          juryAssessment.total_assessed++;
        }
      });

      // Calculate average scores
      juryAssessmentsMap.forEach(juryAssessment => {
        if (juryAssessment.assessments.length > 0) {
          const totalScore = juryAssessment.assessments.reduce((sum, a) => sum + a.total_score, 0);
          juryAssessment.avg_score = totalScore / juryAssessment.assessments.length;
        }
      });

      setJuryAssessments(Array.from(juryAssessmentsMap.values()));
    } catch (error) {
      console.error('Error fetching jury assessments:', error);
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
    if (pos.includes('administrator') || pos.includes('admin')) return 'administrator';
    if (pos.includes('journalist')) return 'journalist';
    if (pos.includes('minister') || pos.includes('shadow minister')) return 'minister';
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
      fetchJuryAssessments();
    } catch (error) {
      console.error('Error forcing logout:', error);
      toast({
        title: "Error",
        description: "Failed to logout student",
        variant: "destructive",
      });
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!passwordResetStudent) return;

    if (!newPassword || !confirmPassword) {
      toast({
        title: "Password Required",
        description: "Please fill in both password fields.",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwords Don't Match",
        description: "New password and confirmation must match.",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Password Too Short",
        description: "Password must be at least 6 characters long.",
        variant: "destructive",
      });
      return;
    }

    setIsResettingPassword(true);

    try {
      const { data, error } = await supabase.functions.invoke('reset-student-password', {
        body: {
          userId: passwordResetStudent.user_id,
          newPassword: newPassword
        }
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Failed to reset password');
      }

      toast({
        title: "Password Reset",
        description: `Password has been reset for ${passwordResetStudent.name}.`,
      });
      
      setPasswordResetStudent(null);
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      console.error('Password reset error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to reset password. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsResettingPassword(false);
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
        return <Badge className="h-6 px-3 rounded-full text-xs font-semibold bg-green-600 text-white">Assessed</Badge>;
      case 'in_progress':
        return <Badge variant="outline" className="h-6 px-3 rounded-full text-xs font-semibold border-yellow-500 text-yellow-700 bg-yellow-50">In Progress</Badge>;
      default:
        return <Badge variant="secondary" className="h-6 px-3 rounded-full text-xs font-semibold">Not Assessed</Badge>;
    }
  };

  const stats = {
    total: students.length,
    active: students.filter(s => s.is_active).length,
    deactivated: students.filter(s => !s.is_active).length,
    new: 128 // Mocked based on design or can be calculated if created_at exists
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
         <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-[#13298f]/20 border-t-[#13298f] rounded-full animate-spin"></div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Syncing Registry...</p>
         </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Page Header */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-4xl font-extrabold font-headline tracking-tight text-on-surface mb-2">Student Registry & Management</h2>
          <p className="text-on-surface-variant font-bold uppercase text-[10px] tracking-[0.2em] opacity-60">Young Indians Parliament Authority</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setViewMode(viewMode === 'table' ? 'grid' : 'table')}
            className="px-4 py-3 rounded-2xl bg-white text-slate-600 border border-slate-100 shadow-sm hover:shadow-md transition-all flex items-center justify-center"
            title={viewMode === 'table' ? "Switch to Grid View" : "Switch to Table View"}
          >
            <span className="material-symbols-outlined text-[20px]">{viewMode === 'table' ? 'grid_view' : 'table_rows'}</span>
          </button>
          <button 
            onClick={() => setShowCharts(!showCharts)}
            className={`px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 ${showCharts ? 'bg-[#13298f] text-white shadow-lg shadow-blue-900/20' : 'bg-white text-slate-600 border border-slate-100 shadow-sm hover:shadow-md'}`}
          >
            <span className="material-symbols-outlined text-[18px]">{showCharts ? 'group' : 'monitoring'}</span>
            {showCharts ? 'View Registry' : 'View Analytics'}
          </button>
          {!showCharts && (
            <button className="px-6 py-3 bg-gradient-to-r from-[#13298f] to-[#3042a6] text-white font-black text-[10px] uppercase tracking-widest rounded-2xl shadow-lg shadow-blue-900/20 hover:scale-[1.05] active:scale-95 transition-all flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">person_add</span>
              Add Delegate
            </button>
          )}
        </div>
      </div>

      {/* Analytics View */}
      {showCharts ? (
        <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
          {/* Summary Stats */}
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-[2rem] shadow-[0_32px_32px_-12px_rgba(46,65,172,0.06)] border-none flex items-center gap-5">
              <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-[#13298f]">
                <Users className="w-7 h-7" />
              </div>
              <div>
                <p className="text-[9px] font-black text-slate-400 tracking-[0.15em] uppercase">Total Students</p>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">{stats.total}</h3>
              </div>
            </div>
            <div className="bg-white p-6 rounded-[2rem] shadow-[0_32px_32px_-12px_rgba(46,65,172,0.06)] border-none flex items-center gap-5">
              <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
                <span className="material-symbols-outlined text-3xl">how_to_reg</span>
              </div>
              <div>
                <p className="text-[9px] font-black text-slate-400 tracking-[0.15em] uppercase">Active Members</p>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">{stats.active}</h3>
              </div>
            </div>
            <div className="bg-white p-6 rounded-[2rem] shadow-[0_32px_32_rgba(46,65,172,0.06)] border-none flex items-center gap-5">
              <div className="w-14 h-14 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-600">
                <span className="material-symbols-outlined text-3xl">person_off</span>
              </div>
              <div>
                <p className="text-[9px] font-black text-slate-400 tracking-[0.15em] uppercase">Deactivated</p>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">{stats.deactivated}</h3>
              </div>
            </div>
            <div className="bg-white p-6 rounded-[2rem] shadow-[0_32px_32px_-12px_rgba(46,65,172,0.06)] border-none flex items-center gap-5">
              <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600">
                <span className="material-symbols-outlined text-3xl">new_releases</span>
              </div>
              <div>
                <p className="text-[9px] font-black text-slate-400 tracking-[0.15em] uppercase">New entries</p>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">{stats.new}</h3>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Participation Trends */}
            <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] shadow-[0_32px_32px_-12px_rgba(46,65,172,0.06)]">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight">Participation Trends</h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Student engagement across sessions</p>
                </div>
              </div>
              <div className="relative h-64 w-full flex items-end justify-between gap-2 px-4">
                {[
                  { label: "JAN", h: "h-24", p: "h-16" },
                  { label: "FEB", h: "h-32", p: "h-24" },
                  { label: "MAR", h: "h-48", p: "h-40" },
                  { label: "APR", h: "h-56", p: "h-52", active: true },
                  { label: "MAY", h: "h-40", p: "h-32" },
                  { label: "JUN", h: "h-36", p: "h-28" }
                ].map((item, idx) => (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-3">
                    <div className={`w-full bg-slate-50 rounded-t-2xl ${item.h} relative group transition-all duration-500`}>
                      <div className={`absolute bottom-0 w-full rounded-t-2xl transition-all ${item.active ? 'bg-[#13298f] ' + item.p : 'bg-[#13298f]/20 group-hover:bg-[#13298f]/40 ' + item.p}`}></div>
                    </div>
                    <span className={`text-[9px] font-black tracking-widest ${item.active ? 'text-[#13298f]' : 'text-slate-400'}`}>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Role Distribution */}
            <div className="bg-white p-8 rounded-[2.5rem] shadow-[0_32px_32px_-12px_rgba(46,65,172,0.06)]">
              <h2 className="text-xl font-black text-slate-900 tracking-tight mb-8">Role Distribution</h2>
              <div className="space-y-6">
                {[
                  { role: "MPs", value: 65, color: "bg-[#13298f]" },
                  { role: "Speakers", value: 15, color: "bg-orange-500" },
                  { role: "Journalists", value: 12, color: "bg-emerald-500" },
                  { role: "Observers", value: 8, color: "bg-slate-300" }
                ].map((item, idx) => (
                  <div key={idx} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.role}</span>
                      <span className="text-xs font-black text-slate-900">{item.value}%</span>
                    </div>
                    <div className="w-full bg-slate-50 h-2.5 rounded-full overflow-hidden">
                      <div className={`${item.color} h-full rounded-full transition-all duration-1000`} style={{ width: `${item.value}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Performance Radar Sim */}
          <section className="bg-[#13298f] p-8 rounded-[3rem] text-white shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-96 h-96 bg-white opacity-[0.03] rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform duration-1000"></div>
            <div className="flex flex-col lg:flex-row items-center justify-between gap-8 relative z-10">
              <div className="max-w-xl">
                <h2 className="text-2xl font-black tracking-tight mb-4">Parliamentary Performance Radar</h2>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: "Public Speaking", val: "8.4" },
                    { label: "Diplomacy", val: "9.1" },
                    { label: "Research", val: "7.8" },
                    { label: "Collaboration", val: "8.9" }
                  ].map((stat, idx) => (
                    <div key={idx} className="bg-white/10 backdrop-blur-md p-4 rounded-2xl flex justify-between items-center border border-white/10">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-300">{stat.label}</span>
                      <span className="text-lg font-black">{stat.val}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="lg:max-w-xs space-y-4">
                <p className="text-sm font-bold text-white/70 italic leading-relaxed">"The current cohort shows exceptional growth in diplomatic negotiation and legislative drafting skills."</p>
                <div className="flex gap-2">
                  <span className="w-8 h-1 bg-white rounded-full"></span>
                  <span className="w-2 h-1 bg-white/30 rounded-full"></span>
                  <span className="w-2 h-1 bg-white/30 rounded-full"></span>
                </div>
              </div>
            </div>
          </section>
        </div>
      ) : (
        <div className="animate-in fade-in duration-500 space-y-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8">
            {/* Dynamic Role Creator - Sidebar Style */}
            <aside className="lg:col-span-4 bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100 h-fit space-y-8">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold flex items-center gap-2 text-[#191c1e]">
                  <span className="material-symbols-outlined text-[#13298f]">psychology</span> 
                  Dynamic Role Creator
                </h2>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Role Name</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Finance Minister" 
                    className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-[#13298f]/20"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Permissions Tier</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button className="py-2.5 rounded-xl bg-[#13298f]/10 text-[#13298f] text-[10px] font-black border-2 border-[#13298f]/20 uppercase tracking-widest">Member</button>
                    <button className="py-2.5 rounded-xl bg-slate-50 text-slate-400 text-[10px] font-black border-2 border-transparent hover:bg-slate-100 transition-colors uppercase tracking-widest">Lead</button>
                    <button className="py-2.5 rounded-xl bg-slate-50 text-slate-400 text-[10px] font-black border-2 border-transparent hover:bg-slate-100 transition-colors uppercase tracking-widest">Admin</button>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Constituency Power</label>
                  <input type="range" className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-[#13298f]" />
                  <div className="flex justify-between mt-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                    <span>Local</span>
                    <span>Regional</span>
                    <span>National</span>
                  </div>
                </div>

                <button className="w-full py-4 bg-[#13298f] text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-blue-900/20 hover:opacity-90 transition-all active:scale-95">
                  Deploy New Role
                </button>

                <div className="pt-6 border-t border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase mb-4 tracking-widest flex justify-between">
                    Active Roles <span>({activeRoles.length})</span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {activeRoles.map((role, idx) => (
                      <span key={idx} className="px-3 py-1.5 bg-slate-50 rounded-full text-[9px] font-black text-slate-600 flex items-center gap-2 group cursor-default">
                        {role.name}
                        <span className="material-symbols-outlined text-[14px] text-slate-300 hover:text-rose-500 cursor-pointer transition-colors">close</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </aside>

            {/* Students View - Grid or Table */}
            <div className="lg:col-span-8 space-y-6">
              {/* Table Navigation Header */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
                <button className="px-5 py-2.5 bg-[#13298f] text-white rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap">All Students ({students.length})</button>
                <button className="px-5 py-2.5 bg-white text-slate-500 border border-slate-100 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap hover:bg-slate-50 transition-colors">Qualified Leaders</button>
                <button className="px-5 py-2.5 bg-white text-slate-500 border border-slate-100 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap hover:bg-slate-50 transition-colors">Pending Review</button>
              </div>

              {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {filteredStudents.map((student) => {
                    const averageScore = getAverageScore(student.user_id);
                    const status = getStudentStatus(student.user_id);
                    const initials = student.name.split(' ').map(n => n[0]).join('').toUpperCase();

                    return (
                      <div key={student.id} className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 hover:shadow-md hover:border-[#13298f]/10 transition-all group relative">
                        <div className="flex items-start justify-between mb-6">
                          <div className="flex items-center gap-4">
                            <div className="relative">
                              <Avatar className="w-14 h-14 rounded-2xl shadow-sm border border-slate-100">
                                <AvatarImage src={student.photo_url} alt={student.name} className="object-cover" />
                                <AvatarFallback className="bg-slate-100 text-[#13298f] text-xs font-black">{initials}</AvatarFallback>
                              </Avatar>
                              <div className={`absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-white ${student.session_id ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-300'}`}></div>
                            </div>
                            <div>
                              <h3 className="font-bold text-base text-[#191c1e] leading-tight">{student.name}</h3>
                              <p className="text-[10px] text-[#13298f] font-black uppercase tracking-widest mt-1">{student.position || 'Delegate'}</p>
                            </div>
                          </div>
                          <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => setEditingStudent(student)} className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-[#13298f] transition-all">
                              <span className="material-symbols-outlined text-[18px]">edit</span>
                            </button>
                            <button onClick={() => setPasswordResetStudent(student)} className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-amber-600 transition-all">
                               <KeyRound className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-6">
                          <div className="bg-slate-50 p-3 rounded-2xl">
                            <p className="text-[9px] font-black text-slate-400 uppercase mb-1 tracking-widest">Party</p>
                            <p className="text-xs font-bold text-[#191c1e]">Reform Hub #{student.party_number}</p>
                          </div>
                          <div className="bg-slate-50 p-3 rounded-2xl">
                            <p className="text-[9px] font-black text-slate-400 uppercase mb-1 tracking-widest">Constituency</p>
                            <p className="text-xs font-bold text-[#191c1e] truncate">{student.constituency || 'TBD'}</p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between mt-auto">
                          <div className="flex items-center gap-3">
                            <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div 
                                className={`h-full transition-all duration-1000 ${averageScore >= 80 ? 'bg-[#42d59a]' : 'bg-[#fe6f42]'}`} 
                                style={{ width: `${averageScore}%` }} 
                              />
                            </div>
                            <span className="text-xs font-black text-[#191c1e]">{averageScore}%</span>
                          </div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            {getAssessmentCount(student.user_id)} Assessments
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <>
                  {/* Management Analytics - Bento Style */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <div className="w-10 h-10 bg-[#13298f]/10 rounded-lg flex items-center justify-center">
                  <span className="material-symbols-outlined text-[#13298f]">group</span>
                </div>
                <span className="text-xs font-bold text-[#00583b] bg-[#6ffbbe] px-2 py-1 rounded-full">+12%</span>
              </div>
              <p className="text-sm font-semibold text-slate-500 mb-1 font-body">Total Students</p>
              <h3 className="text-2xl font-extrabold font-headline text-[#191c1e]">{stats.total}</h3>
            </div>
            
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <div className="w-10 h-10 bg-[#6ffbbe]/30 rounded-lg flex items-center justify-center">
                  <span className="material-symbols-outlined text-[#00583b]">how_to_reg</span>
                </div>
                <span className="text-xs font-bold text-[#00583b] bg-[#6ffbbe] px-2 py-1 rounded-full">Active</span>
              </div>
              <p className="text-sm font-semibold text-slate-500 mb-1 font-body">Active Members</p>
              <h3 className="text-2xl font-extrabold font-headline text-[#191c1e]">{stats.active}</h3>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <div className="w-10 h-10 bg-[#ffdad6]/30 rounded-lg flex items-center justify-center">
                  <span className="material-symbols-outlined text-[#ba1a1a]">person_off</span>
                </div>
                <span className="text-xs font-bold text-[#ba1a1a] bg-[#ffdad6] px-2 py-1 rounded-full">Off</span>
              </div>
              <p className="text-sm font-semibold text-slate-500 mb-1 font-body">Deactivated</p>
              <h3 className="text-2xl font-extrabold font-headline text-[#191c1e]">{stats.deactivated}</h3>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <div className="w-10 h-10 bg-[#fe6f42]/20 rounded-lg flex items-center justify-center">
                  <span className="material-symbols-outlined text-[#ac3509]">new_releases</span>
                </div>
                <span className="text-xs font-bold text-[#ac3509] bg-[#ffdbd0] px-2 py-1 rounded-full">New</span>
              </div>
              <p className="text-sm font-semibold text-slate-500 mb-1 font-body">New Registrations</p>
              <h3 className="text-2xl font-extrabold font-headline text-[#191c1e]">{stats.new}</h3>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="bg-slate-100/50 p-4 rounded-2xl mb-6 flex flex-wrap items-center gap-4 border border-slate-200/50">
            <div className="flex-1 min-w-[300px] relative">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-stone-400">search</span>
              <input 
                type="text" 
                placeholder="Search by name, ID, or constituency..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white border-none rounded-xl focus:ring-2 focus:ring-[#13298f]/20 text-sm font-medium shadow-sm transition-all"
              />
            </div>
            <div className="flex items-center gap-3">
              <select 
                value={filters.seatRole} 
                onChange={(e) => setFilters(f => ({ ...f, seatRole: e.target.value }))}
                className="bg-white border-none rounded-xl py-3 pl-4 pr-10 text-sm font-bold focus:ring-2 focus:ring-[#13298f]/20 shadow-sm cursor-pointer"
              >
                <option value="all">Role: All</option>
                <option value="mp">Delegate</option>
                <option value="speaker">Speaker</option>
                <option value="minister">Minister</option>
                <option value="journalist">Journalist</option>
              </select>
              <select 
                value={filters.status} 
                onChange={(e) => setFilters(f => ({ ...f, status: e.target.value }))}
                className="bg-white border-none rounded-xl py-3 pl-4 pr-10 text-sm font-bold focus:ring-2 focus:ring-[#13298f]/20 shadow-sm cursor-pointer"
              >
                <option value="all">Status: All</option>
                <option value="assessed">Active</option>
                <option value="not_assessed">Inactive</option>
              </select>
              <button 
                onClick={() => { setSearchTerm(""); setFilters({ seatRole: "all", partyNumber: "all", constituency: "", state: "", status: "all" }); }}
                className="p-3 bg-[#13298f] text-white rounded-xl hover:bg-[#3042a6] transition-colors shadow-lg shadow-blue-900/20"
              >
                <span className="material-symbols-outlined">tune</span>
              </button>
            </div>
          </div>

          {/* Student Data Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="px-6 py-5 text-xs font-bold uppercase tracking-wider text-slate-500">Student</th>
                    <th className="px-6 py-5 text-xs font-bold uppercase tracking-wider text-slate-500">ID Number</th>
                    <th className="px-6 py-5 text-xs font-bold uppercase tracking-wider text-slate-500">Assigned Role</th>
                    <th className="px-6 py-5 text-xs font-bold uppercase tracking-wider text-slate-500">Constituency</th>
                    <th className="px-6 py-5 text-xs font-bold uppercase tracking-wider text-slate-500">Performance</th>
                    <th className="px-6 py-5 text-xs font-bold uppercase tracking-wider text-slate-500 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStudents.map((student) => {
                    const averageScore = getAverageScore(student.user_id);
                    const status = getStudentStatus(student.user_id);
                    const initials = student.name.split(' ').map(n => n[0]).join('').toUpperCase();

                    return (
                      <tr key={student.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <Avatar className="w-10 h-10 rounded-lg shadow-sm border border-slate-100 overflow-hidden">
                                <AvatarImage src={student.photo_url} alt={student.name} className="object-cover" />
                                <AvatarFallback className="bg-slate-100 text-[#13298f] text-[10px] font-black">{initials}</AvatarFallback>
                              </Avatar>
                              <div className={`absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-white ${student.session_id ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                            </div>
                            <div>
                              <p className="text-sm font-bold text-[#191c1e]">{student.name}</p>
                              <p className="text-[10px] text-slate-500 font-medium">{student.user_id.substring(0, 8)}@ypa.org</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-medium text-slate-600">YI-2024-{student.serial_number.toString().padStart(4, '0')}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 text-[10px] font-bold rounded-full uppercase tracking-tight ${
                            getSeatRole(student.position) === 'speaker' ? 'bg-[#ffdad6] text-[#ba1a1a]' :
                            getSeatRole(student.position) === 'minister' ? 'bg-[#6ffbbe] text-[#00583b]' :
                            'bg-[#13298f]/10 text-[#13298f]'
                          }`}>
                            {student.position || 'Delegate'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-slate-600">{student.constituency || 'Portfolio Assigned'}</p>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div 
                                className={`h-full transition-all duration-1000 ${averageScore >= 80 ? 'bg-[#42d59a]' : 'bg-[#fe6f42]'}`} 
                                style={{ width: `${averageScore}%` }} 
                              />
                            </div>
                            <span className={`text-xs font-bold ${averageScore >= 80 ? 'text-[#005236]' : 'text-[#ac3509]'}`}>{averageScore}%</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => setEditingStudent(student)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-[#13298f] transition-colors">
                              <span className="material-symbols-outlined text-[18px]">edit</span>
                            </button>
                            <button onClick={() => setPasswordResetStudent(student)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-amber-600 transition-colors">
                              <KeyRound className="w-4 h-4" />
                            </button>
                            <button onClick={() => toggleStudentStatus(student.user_id, student.is_active || false)} className={`p-1.5 rounded-lg transition-all ${student.is_active ? 'text-slate-400 hover:text-rose-500 hover:bg-rose-50' : 'text-emerald-500 hover:bg-emerald-50'}`}>
                              <span className="material-symbols-outlined text-[18px]">{student.is_active ? 'block' : 'check_circle'}</span>
                            </button>
                            <button className="p-1.5 bg-slate-50 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-[#191c1e] transition-colors">
                              <span className="material-symbols-outlined text-[18px]">visibility</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="px-6 py-5 bg-slate-50/30 border-t border-slate-100 flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-500 font-body">Showing 1 to {filteredStudents.length} of {students.length} entries</p>
              <div className="flex items-center gap-2">
                <button className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-white hover:text-[#13298f] transition-all">
                  <span className="material-symbols-outlined text-sm">chevron_left</span>
                </button>
                <button className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#13298f] text-white text-xs font-bold shadow-sm">1</button>
                <button className="w-8 h-8 flex items-center justify-center rounded-lg border border-transparent text-xs font-bold text-slate-600 hover:bg-white hover:border-slate-200 transition-all">2</button>
                <button className="w-8 h-8 flex items-center justify-center rounded-lg border border-transparent text-xs font-bold text-slate-600 hover:bg-white hover:border-slate-200 transition-all">3</button>
                <span className="text-slate-400 font-bold px-1">...</span>
                <button className="w-8 h-8 flex items-center justify-center rounded-lg border border-transparent text-xs font-bold text-slate-600 hover:bg-white hover:border-slate-200 transition-all">254</button>
                <button className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-white hover:text-[#13298f] transition-all">
                  <span className="material-symbols-outlined text-sm">chevron_right</span>
                </button>
              </div>
            </div>
            </div>
          </>
        )}

        {/* Global Performance Insights Section */}
        <section className="mt-12 bg-gradient-to-br from-[#13298f] to-[#3042a6] p-12 rounded-[3rem] relative overflow-hidden shadow-2xl group">
            <div className="absolute top-0 right-0 w-1/2 h-full opacity-5 pointer-events-none">
              <span className="material-symbols-outlined text-[30rem] -translate-y-20 translate-x-20 transition-transform duration-1000 group-hover:scale-110">diversity_3</span>
            </div>
            <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-12 text-white">
              <div>
                <h2 className="text-[10px] font-black uppercase tracking-[0.2em] mb-4 opacity-70">Total Participation</h2>
                <p className="text-6xl font-black mb-2 animate-in slide-in-from-left duration-700">94.2<span className="text-2xl">%</span></p>
                <p className="text-sm font-bold opacity-80 leading-relaxed font-body">Delegate engagement across all dynamic parliamentary sessions this quarter.</p>
              </div>
              <div>
                <h2 className="text-[10px] font-black uppercase tracking-[0.2em] mb-4 opacity-70">Bills Authored</h2>
                <p className="text-6xl font-black mb-2 animate-in slide-in-from-left duration-1000">3,120</p>
                <p className="text-sm font-bold opacity-80 leading-relaxed font-body">Legislative contributions submitted through the dynamic portal interface.</p>
              </div>
              <div>
                <h2 className="text-[10px] font-black uppercase tracking-[0.2em] mb-4 opacity-70">Avg. Skill Rating</h2>
                <p className="text-6xl font-black mb-2 animate-in slide-in-from-left duration-700">8.4<span className="text-2xl">/10</span></p>
                <p className="text-sm font-bold opacity-80 leading-relaxed font-body">Aggregate student performance in critical thinking and diplomatic speech.</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )}

      {/* Re-using identified components from existing logic */}
      <StudentEditDialog 
        student={editingStudent}
        isOpen={!!editingStudent}
        onClose={() => setEditingStudent(null)}
        onSave={() => { fetchStudents(); fetchJuryAssessments(); }}
      />

      <Dialog open={!!passwordResetStudent} onOpenChange={(open) => {
        if (!open) { setPasswordResetStudent(null); setNewPassword(''); setConfirmPassword(''); setShowNewPassword(false); setShowConfirmPassword(false); }
      }}>
        <DialogContent className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-[#13298f] to-amber-500"></div>
          <DialogHeader className="pt-4">
            <DialogTitle className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600">
                <KeyRound className="w-5 h-5" />
              </div>
              Authorization Override
            </DialogTitle>
            <DialogDescription className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Reset Security Credentials for {passwordResetStudent?.name}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleResetPassword} className="space-y-6 mt-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">New Password</label>
                <div className="relative">
                  <Input 
                    type={showNewPassword ? "text" : "password"} 
                    value={newPassword} 
                    onChange={(e) => setNewPassword(e.target.value)} 
                    placeholder="••••••••" 
                    className="h-14 bg-slate-50 border-none rounded-2xl font-bold px-5" 
                  />
                  <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">{showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Confirm Security Pin</label>
                <div className="relative">
                  <Input 
                    type={showConfirmPassword ? "text" : "password"} 
                    value={confirmPassword} 
                    onChange={(e) => setConfirmPassword(e.target.value)} 
                    placeholder="••••••••" 
                    className="h-14 bg-slate-50 border-none rounded-2xl font-bold px-5" 
                  />
                  <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">{showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                </div>
              </div>
            </div>
            <div className="flex gap-3 pt-4">
               <button type="button" onClick={() => setPasswordResetStudent(null)} className="flex-1 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 transition-colors">Abort</button>
               <button type="submit" disabled={isResettingPassword} className="flex-1 py-4 bg-[#13298f] text-white rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest shadow-lg shadow-blue-900/20 active:scale-95 transition-all">
                 {isResettingPassword ? "Updating..." : "Authorize Reset"}
               </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};