import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { KeyRound, Eye, EyeOff } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { StudentEditDialog } from "./StudentEditDialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getLocationColumns, getZoneId, getZoneConfig } from "@/lib/regions";

const ITEMS_PER_PAGE = 20;

const PARTY_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
const partyLetter = (n: number) => (!n || n < 1) ? null : (PARTY_LETTERS[n - 1] ?? n.toString());
const partyLabel = (n: number, name?: string | null) => {
  const letter = partyLetter(n);
  if (!letter) return 'No Party';
  return name ? `${name} (${letter})` : `Party ${letter}`;
};

interface Student {
  id: string;
  user_id: string;
  name: string;
  position: string;
  party_number: number;
  party_name?: string | null;
  committee?: string | null;
  serial_number: number;
  constituency?: string;
  state?: string;
  city?: string;
  school?: string | null;
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
  const { profile } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [juryAssessments, setJuryAssessments] = useState<JuryAssessment[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [viewingStudent, setViewingStudent] = useState<Student | null>(null);
  const [passwordResetStudent, setPasswordResetStudent] = useState<Student | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState({
    seatRole: "all",
    partyNumber: "all",
    constituency: "",
    state: "",
    status: "all"
  });
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [currentPage, setCurrentPage] = useState(1);

  const [isSyncingEvent, setIsSyncingEvent] = useState(false);

  // Event-scoped committee list, configured by the SuperAdmin per event
  const [eventCommittees, setEventCommittees] = useState<string[]>([]);

  useEffect(() => {
    if (!profile?.event_id) { setEventCommittees([]); return; }
    supabase
      .from('event_committees')
      .select('name')
      .eq('event_id', profile.event_id)
      .order('display_order')
      .then(({ data }) => {
        setEventCommittees((data ?? []).map((r: { name: string }) => r.name));
      });
  }, [profile?.event_id]);

  // Event's own level/city/state/zone — students inherit these for the
  // School/City/State/Zone display columns (see lib/regions.ts).
  const [eventInfo, setEventInfo] = useState<{ level: string; city: string | null; state: string | null } | null>(null);

  useEffect(() => {
    if (!profile?.event_id) { setEventInfo(null); return; }
    supabase
      .from('events')
      .select('level, city, state')
      .eq('id', profile.event_id)
      .maybeSingle()
      .then(({ data }) => {
        setEventInfo(data ?? null);
      });
  }, [profile?.event_id]);

  const locationColumns = useMemo(() => getLocationColumns(eventInfo?.level), [eventInfo?.level]);
  const eventZoneLabel = eventInfo?.state ? getZoneId(eventInfo.state) ? getZoneConfig(getZoneId(eventInfo.state)!).name : '—' : '—';

  const handleSyncEventId = async () => {
    if (!profile?.event_id) {
      toast({ title: 'No event assigned to your account', variant: 'destructive' });
      return;
    }
    const nullEventStudents = students.filter((s: any) => !s.event_id);
    if (nullEventStudents.length === 0) {
      toast({ title: 'All students already have an event assigned' });
      return;
    }
    setIsSyncingEvent(true);
    const { error } = await supabase
      .from('profiles')
      .update({ event_id: profile.event_id })
      .in('user_id', nullEventStudents.map((s: any) => s.user_id));
    setIsSyncingEvent(false);
    if (error) {
      toast({ title: 'Sync failed', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: `${nullEventStudents.length} student${nullEventStudents.length !== 1 ? 's' : ''} assigned to this event` });
      fetchStudents();
    }
  };

  // Register new student dialog
  const [showRegisterDialog, setShowRegisterDialog] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerForm, setRegisterForm] = useState({
    name: '', loginId: '', password: '', seatRole: 'Member of Parliament',
    alliance: 'Neutral', party: 'A', partyName: '', committee: '',
    constituency: '', state: '', city: '',
  });

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
    setCurrentPage(1);
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
    const submitted = assessments.filter(a => a.student_id === userId && a.status === 'submitted');
    if (!submitted.length) return 0;
    // One row per student (session_id = null) — total already out of 100
    const row = submitted.find(a => !a.session_id) ?? submitted[0];
    return Math.round(row.total_score ?? 0);
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

  const stats = {
    total: students.length,
    inSession: students.filter(s => !!s.session_id).length,
    active: students.filter(s => s.is_active).length,
    deactivated: students.filter(s => !s.is_active).length,
  };

  const nextSerial = students.length > 0 ? Math.max(...students.map(s => s.serial_number)) + 1 : 1;

  // Count assignable MPs (excludes journalists and administrators) to drive round-robin committee assignment
  const assignableMpCount = useMemo(() =>
    students.filter(s => {
      const role = (s.position ?? '').toLowerCase();
      return !role.includes('journalist') && !role.includes('administrator') && !role.includes('admin');
    }).length
  , [students]);

  // Auto-selected committee for next registration (round-robin)
  const autoCommittee = eventCommittees.length > 0 ? eventCommittees[assignableMpCount % eventCommittees.length] : '';

  // Derive unique parties dynamically from loaded students (same pattern as InteractiveParliamentTree)
  const uniqueParties = useMemo(() => {
    const map = new Map<number, string | null>();
    students.forEach(s => {
      if (s.party_number > 0 && !map.has(s.party_number)) {
        map.set(s.party_number, s.party_name ?? null);
      }
    });
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [students]);

  const uniqueConstituencies = useMemo(() =>
    [...new Set(students.map(s => s.constituency).filter((v): v is string => !!v))].sort()
  , [students]);

  const uniquePartyNames = useMemo(() =>
    [...new Set(students.map(s => s.party_name).filter((v): v is string => !!v))].sort()
  , [students]);

  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / ITEMS_PER_PAGE));
  const paginatedStudents = filteredStudents.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const handleRegisterStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerForm.name || !registerForm.loginId || !registerForm.password) {
      toast({ title: "Missing fields", description: "Name, Login ID and Password are required.", variant: "destructive" });
      return;
    }
    setIsRegistering(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bulk-import-students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({
          mode: 'full',
          event_id: profile?.event_id ?? null,
          students: [{
            serialNumber: nextSerial,
            loginId: registerForm.loginId,
            name: registerForm.name,
            seatRole: registerForm.seatRole,
            alliance: registerForm.alliance,
            party: registerForm.party,
            partyName: registerForm.partyName,
            committee: registerForm.committee,
            constituency: registerForm.constituency,
            state: registerForm.state,
            city: registerForm.city,
            password: registerForm.password,
          }]
        }),
      });
      const result = await res.json();
      if (result.success > 0) {
        toast({ title: "Student registered", description: `${registerForm.name} added with ID ${nextSerial.toString().padStart(3, '0')}` });
        setShowRegisterDialog(false);
        setRegisterForm({ name: '', loginId: '', password: '', seatRole: 'Member of Parliament', alliance: 'Neutral', party: 'A', partyName: '', committee: '', constituency: '', state: '', city: '' });
        fetchStudents();
      } else {
        throw new Error(result.errors?.[0] || 'Registration failed');
      }
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : 'Unknown error', variant: "destructive" });
    } finally {
      setIsRegistering(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant font-body">Syncing Registry...</p>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
    <div className="space-y-6 animate-in fade-in duration-700">

      {/* Page Heading */}
      <div>
        <h1 className="text-4xl font-extrabold font-headline tracking-tight text-primary">
          Delegate <span className="text-secondary">Registry</span>
        </h1>
        <p className="text-[10px] text-on-surface-variant/40 font-black uppercase tracking-[0.4em] mt-3 flex items-center gap-2 font-headline">
          <span className="material-symbols-outlined text-[12px]">group</span>
          Parliament Participant Management
        </p>
      </div>

      {/* Action Row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('table')}
            className={`py-2.5 px-4 rounded-full flex items-center gap-2 text-sm font-bold transition-all active:scale-95 ${viewMode === 'table' ? 'bg-primary text-white shadow-[0_8px_24px_rgba(19,41,143,0.25)]' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}`}
          >
            <span className="material-symbols-outlined text-[18px]">table_rows</span>
            Table
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`py-2.5 px-4 rounded-full flex items-center gap-2 text-sm font-bold transition-all active:scale-95 ${viewMode === 'grid' ? 'bg-primary text-white shadow-[0_8px_24px_rgba(19,41,143,0.25)]' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}`}
          >
            <span className="material-symbols-outlined text-[18px]">grid_view</span>
            Cards
          </button>
        </div>
        {profile?.event_id && students.some((s: any) => !s.event_id) && (
          <button
            onClick={handleSyncEventId}
            disabled={isSyncingEvent}
            title="Assign this event to all students who are missing an event assignment"
            className="flex items-center gap-2 py-3 px-5 rounded-full border border-primary/30 text-primary font-bold font-body text-sm hover:bg-primary/5 transition-all disabled:opacity-50"
          >
            {isSyncingEvent
              ? <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
              : <span className="material-symbols-outlined text-[18px]">sync</span>}
            Sync Event ({students.filter((s: any) => !s.event_id).length})
          </button>
        )}
        <button
          onClick={() => { setRegisterForm(f => ({ ...f, committee: autoCommittee })); setShowRegisterDialog(true); }}
          className="bg-gradient-to-r from-primary to-primary-container text-white font-bold py-3 px-7 rounded-full flex items-center gap-2 shadow-[0_8px_24px_rgba(19,41,143,0.25)] hover:scale-[1.02] transition-all active:scale-95 font-body text-sm"
        >
          <span className="material-symbols-outlined text-[20px]">person_add</span>
          Register New Student
        </button>
      </div>

      {/* Stats Row — tonal cards, no borders per DESIGN.md */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            icon: 'group', label: 'Total Students', value: stats.total,
            desc: 'Registered delegates',
            iconBg: 'bg-primary-fixed/30',
            badge: `${stats.total}`, badgeBg: 'bg-primary/10 text-primary',
          },
          {
            icon: 'sensors', label: 'In Session', value: stats.inSession,
            desc: 'Currently logged in',
            iconBg: 'bg-tertiary-fixed/30',
            badge: 'Live', badgeBg: 'bg-tertiary-container text-white',
          },
          {
            icon: 'how_to_reg', label: 'Active Accounts', value: stats.active,
            desc: 'Enabled accounts',
            iconBg: 'bg-tertiary-fixed/20',
            badge: 'Active', badgeBg: 'bg-on-tertiary-container/20 text-tertiary-container',
          },
          {
            icon: 'person_off', label: 'Deactivated', value: stats.deactivated,
            desc: 'Suspended accounts',
            iconBg: 'bg-secondary-fixed/30',
            badge: 'Off', badgeBg: 'bg-error text-white',
          },
        ].map((card) => (
          <div
            key={card.label}
            className="bg-surface-container-lowest p-6 rounded-3xl shadow-[0_32px_32px_-12px_rgba(19,41,143,0.06)] hover:-translate-y-1 transition-transform duration-300"
          >
            <div className="flex justify-between items-start mb-4">
              <div className={`p-3 ${card.iconBg} rounded-2xl`}>
                <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: "'FILL' 1", color: 'inherit' }}>
                  {card.icon}
                </span>
              </div>
              <span className={`${card.badgeBg} text-[10px] font-bold px-2.5 py-0.5 rounded-full font-body`}>{card.badge}</span>
            </div>
            <p className="text-on-surface-variant text-sm font-semibold font-body">{card.label}</p>
            <p className="text-3xl font-black text-on-background font-headline mt-0.5">{card.value}</p>
            <p className="text-xs text-on-surface-variant mt-1 font-body">{card.desc}</p>
          </div>
        ))}
      </div>

      {/* Registry Section — surface-container-low against surface background per "No-Line" rule */}
      <section className="bg-surface-container-low rounded-[2rem] p-8">

        {/* Filter Bar */}
        <div className="space-y-4 mb-8">
          {/* Search row */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">search</span>
              <input
                type="text"
                placeholder="Search name, ID, constituency…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-surface-container rounded-2xl py-3.5 pl-12 pr-4 text-sm font-medium border-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-outline font-body"
              />
            </div>
            <p className="text-sm text-on-surface-variant font-body ml-auto shrink-0">
              <span className="font-bold text-on-surface">{filteredStudents.length}</span> of {students.length} delegates
            </p>
            {(searchTerm || filters.seatRole !== 'all' || filters.status !== 'all') && (
              <button
                onClick={() => { setSearchTerm(""); setFilters({ seatRole: "all", partyNumber: "all", constituency: "", state: "", status: "all" }); }}
                className="flex items-center gap-1.5 text-[11px] font-bold text-primary hover:text-primary/70 transition-colors font-body shrink-0"
              >
                <span className="material-symbols-outlined text-[14px]">close</span>
                Clear
              </button>
            )}
          </div>

          {/* Chip row — Role + Status */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Role label */}
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-on-surface-variant/50 font-headline pr-1">Role</span>
            {([
              { value: 'all', label: 'All', icon: 'groups' },
              { value: 'speaker', label: 'Speaker', icon: 'gavel' },
              { value: 'deputy_speaker', label: 'Dy. Speaker', icon: 'supervised_user_circle' },
              { value: 'minister', label: 'Minister', icon: 'account_balance' },
              { value: 'mp', label: 'MP', icon: 'how_to_reg' },
              { value: 'journalist', label: 'Journalist', icon: 'newspaper' },
              { value: 'administrator', label: 'Admin', icon: 'admin_panel_settings' },
            ] as const).map(opt => (
              <button
                key={opt.value}
                onClick={() => setFilters(f => ({ ...f, seatRole: opt.value }))}
                className={`flex items-center gap-1.5 py-2 px-3.5 rounded-full text-[11px] font-bold transition-all active:scale-95 font-body ${
                  filters.seatRole === opt.value
                    ? 'bg-primary text-white shadow-[0_4px_12px_rgba(19,41,143,0.22)]'
                    : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                <span className="material-symbols-outlined text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }}>{opt.icon}</span>
                {opt.label}
              </button>
            ))}

            {/* Divider dot */}
            <span className="w-1 h-1 rounded-full bg-outline-variant/40 mx-1" />

            {/* Status label */}
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-on-surface-variant/50 font-headline pr-1">Status</span>
            {([
              { value: 'all', label: 'All' },
              { value: 'assessed', label: 'Assessed' },
              { value: 'not_assessed', label: 'Not Assessed' },
            ] as const).map(opt => (
              <button
                key={opt.value}
                onClick={() => setFilters(f => ({ ...f, status: opt.value }))}
                className={`py-2 px-3.5 rounded-full text-[11px] font-bold transition-all active:scale-95 font-body ${
                  filters.status === opt.value
                    ? 'bg-primary text-white shadow-[0_4px_12px_rgba(19,41,143,0.22)]'
                    : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                {opt.label}
              </button>
            ))}

            {/* Party chips — only when multiple parties exist */}
            {uniqueParties.length > 1 && (
              <>
                <span className="w-1 h-1 rounded-full bg-outline-variant/40 mx-1" />
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-on-surface-variant/50 font-headline pr-1">Party</span>
                <button
                  onClick={() => setFilters(f => ({ ...f, partyNumber: 'all' }))}
                  className={`py-2 px-3.5 rounded-full text-[11px] font-bold transition-all active:scale-95 font-body ${
                    filters.partyNumber === 'all'
                      ? 'bg-primary text-white shadow-[0_4px_12px_rgba(19,41,143,0.22)]'
                      : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                  }`}
                >
                  All
                </button>
                {uniqueParties.map(([num, name]) => (
                  <button
                    key={num}
                    onClick={() => setFilters(f => ({ ...f, partyNumber: num.toString() }))}
                    className={`py-2 px-3.5 rounded-full text-[11px] font-bold transition-all active:scale-95 font-body ${
                      filters.partyNumber === num.toString()
                        ? 'bg-primary text-white shadow-[0_4px_12px_rgba(19,41,143,0.22)]'
                        : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                    }`}
                  >
                    {partyLabel(num, name)}
                  </button>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Grid View */}
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredStudents.map((student) => {
              const averageScore = getAverageScore(student.user_id);
              const initials = student.name.split(' ').map(n => n[0]).join('').toUpperCase();
              const roleKey = getSeatRole(student.position);
              return (
                <div
                  key={student.id}
                  className="bg-surface-container-lowest p-8 rounded-3xl shadow-[0_32px_32px_-12px_rgba(19,41,143,0.06)] hover:-translate-y-1 transition-transform duration-300 group"
                >
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <Avatar className="w-12 h-12 rounded-xl">
                          <AvatarImage src={student.photo_url} alt={student.name} className="object-cover" />
                          <AvatarFallback className="bg-primary-fixed/30 text-primary text-xs font-black rounded-xl font-headline">{initials}</AvatarFallback>
                        </Avatar>
                        <div className={`absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-surface-container-lowest ${student.session_id ? 'bg-on-tertiary-container' : 'bg-outline'}`} />
                      </div>
                      <div>
                        <p className="font-bold text-on-surface text-sm font-headline leading-tight">{student.name}</p>
                        <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 mt-1 inline-block font-body ${
                          roleKey === 'speaker' ? 'bg-error/10 text-error' :
                          roleKey === 'minister' ? 'bg-tertiary-container/10 text-tertiary-container' :
                          roleKey === 'journalist' ? 'bg-secondary-fixed/30 text-secondary' :
                          'bg-primary/10 text-primary'
                        }`}>{student.position || 'Delegate'}</span>
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setEditingStudent(student)} className="p-1.5 hover:bg-surface-container rounded-xl text-on-surface-variant hover:text-primary transition-all">
                        <span className="material-symbols-outlined text-[18px]">edit</span>
                      </button>
                      <button onClick={() => setPasswordResetStudent(student)} className="p-1.5 hover:bg-surface-container rounded-xl text-on-surface-variant hover:text-error transition-all">
                        <span className="material-symbols-outlined text-[18px]">lock_reset</span>
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-5">
                    <div className="bg-surface-container p-3 rounded-2xl">
                      <p className="text-[9px] font-black text-on-surface-variant uppercase mb-1 tracking-widest font-body">Party</p>
                      <p className="text-xs font-bold text-on-surface font-body truncate">{partyLabel(student.party_number, student.party_name)}</p>
                    </div>
                    <div className="bg-surface-container p-3 rounded-2xl">
                      <p className="text-[9px] font-black text-on-surface-variant uppercase mb-1 tracking-widest font-body">Committee</p>
                      <p className="text-xs font-bold text-on-surface font-body truncate">{student.committee || '—'}</p>
                    </div>
                    <div className="col-span-2 bg-surface-container p-3 rounded-2xl">
                      <p className="text-[9px] font-black text-on-surface-variant uppercase mb-1 tracking-widest font-body">Constituency</p>
                      <p className="text-xs font-bold text-on-surface font-body truncate">{student.constituency || '—'}</p>
                    </div>
                    <div className="col-span-2 bg-surface-container p-3 rounded-2xl">
                      <p className="text-[9px] font-black text-on-surface-variant uppercase mb-1 tracking-widest font-body">School</p>
                      <p className="text-xs font-bold text-on-surface font-body truncate">{student.school || '—'}</p>
                      {locationColumns.length > 0 && (
                        <p className="text-[10px] text-on-surface-variant font-body mt-0.5 truncate">
                          {[eventInfo?.city, locationColumns.includes('state') ? eventInfo?.state : null, locationColumns.includes('zone') ? eventZoneLabel : null].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1">
                      <div className="flex-1 h-1.5 bg-surface-container rounded-full overflow-hidden">
                        <div className="bg-on-tertiary-container h-full transition-all duration-1000" style={{ width: `${averageScore}%` }} />
                      </div>
                      <span className="text-xs font-black text-on-surface font-headline">{averageScore}<span className="text-[9px] text-on-surface-variant/50 font-normal">/100</span></span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Table View — surface-container-lowest "pops" off the surface-container-low section */
          <div className="rounded-2xl overflow-x-auto bg-surface-container-lowest shadow-[0_32px_32px_-12px_rgba(19,41,143,0.06)]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container text-on-surface-variant uppercase text-[11px] font-black tracking-widest font-body">
                  <th className="px-8 py-5">Student</th>
                  <th className="px-6 py-5">ID</th>
                  <th className="px-6 py-5">Role</th>
                  <th className="px-6 py-5">School</th>
                  {locationColumns.includes('city') && <th className="px-6 py-5">City</th>}
                  {locationColumns.includes('state') && <th className="px-6 py-5">State</th>}
                  {locationColumns.includes('zone') && <th className="px-6 py-5">Zone</th>}
                  <th className="px-6 py-5">Constituency & Committee</th>
                  <th className="px-6 py-5">Performance</th>
                  <th className="px-6 py-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {paginatedStudents.map((student) => {
                  const averageScore = getAverageScore(student.user_id);
                  const initials = student.name.split(' ').map(n => n[0]).join('').toUpperCase();
                  const roleKey = getSeatRole(student.position);

                  return (
                    <tr key={student.id} className="group hover:bg-primary-fixed/5 transition-colors">
                      <td className="px-8 py-4">
                        <div className="flex items-center gap-3">
                          <div className="relative shrink-0">
                            <Avatar className="w-10 h-10 rounded-full ring-2 ring-surface-container-lowest">
                              <AvatarImage src={student.photo_url} alt={student.name} className="object-cover" />
                              <AvatarFallback className="bg-primary-fixed/30 text-primary text-[10px] font-black font-headline">{initials}</AvatarFallback>
                            </Avatar>
                            <div className={`absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-surface-container-lowest ${student.session_id ? 'bg-on-tertiary-container' : 'bg-outline'}`} />
                          </div>
                          <div>
                            <p className="font-bold text-on-surface text-sm font-headline">{student.name}</p>
                            <p className="text-xs text-on-surface-variant font-body">{student.user_id.substring(0, 6)}…@yip.parliament</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-mono text-xs font-bold text-primary bg-primary/8 px-2.5 py-1 rounded-lg">#{student.serial_number.toString().padStart(3, '0')}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-tight font-body ${
                          roleKey === 'speaker' ? 'bg-error/10 text-error' :
                          roleKey === 'minister' ? 'bg-tertiary-container/10 text-tertiary-container' :
                          roleKey === 'journalist' ? 'bg-secondary-fixed/30 text-secondary' :
                          'bg-primary/10 text-primary'
                        }`}>
                          {student.position || 'Delegate'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-semibold text-on-surface font-body truncate max-w-[160px] block">{student.school || <span className="text-on-surface-variant/40 italic text-xs">—</span>}</span>
                      </td>
                      {locationColumns.includes('city') && (
                        <td className="px-6 py-4">
                          <span className="text-sm font-medium text-on-surface-variant font-body">{eventInfo?.city || '—'}</span>
                        </td>
                      )}
                      {locationColumns.includes('state') && (
                        <td className="px-6 py-4">
                          <span className="text-sm font-medium text-on-surface-variant font-body">{eventInfo?.state || '—'}</span>
                        </td>
                      )}
                      {locationColumns.includes('zone') && (
                        <td className="px-6 py-4">
                          <span className="text-sm font-medium text-on-surface-variant font-body">{eventZoneLabel}</span>
                        </td>
                      )}
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1 min-w-[140px]">
                          <div className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[12px] text-on-surface-variant/50" style={{ fontVariationSettings: "'FILL' 1" }}>location_on</span>
                            <span className="text-sm font-semibold text-on-surface font-body truncate max-w-[160px]">{student.constituency || <span className="text-on-surface-variant/40 italic text-xs">No constituency</span>}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[12px] text-on-surface-variant/50" style={{ fontVariationSettings: "'FILL' 1" }}>account_balance</span>
                            <span className="text-xs font-medium text-on-surface-variant font-body truncate max-w-[160px]">{student.committee || <span className="text-on-surface-variant/30 italic">No committee</span>}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1 w-24">
                          <div className="flex justify-between text-[10px] font-bold font-body">
                            <span className="text-on-surface-variant">Score</span>
                            <span className="text-primary">{averageScore}<span className="text-on-surface-variant/50 font-normal">/100</span></span>
                          </div>
                          <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
                            <div className="bg-on-tertiary-container h-full transition-all duration-1000" style={{ width: `${averageScore}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => setEditingStudent(student)}
                                className="p-2 text-on-surface-variant hover:text-primary rounded-lg hover:bg-surface-container transition-colors"
                              >
                                <span className="material-symbols-outlined text-[20px]">edit</span>
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>Edit student details</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => setPasswordResetStudent(student)}
                                className="p-2 text-on-surface-variant hover:text-error rounded-lg hover:bg-surface-container transition-colors"
                              >
                                <span className="material-symbols-outlined text-[20px]">lock_reset</span>
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>Reset password</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => toggleStudentStatus(student.user_id, student.is_active || false)}
                                className={`p-2 rounded-lg hover:bg-surface-container transition-colors ${student.is_active ? 'text-on-surface-variant hover:text-error' : 'text-on-tertiary-container'}`}
                              >
                                <span className="material-symbols-outlined text-[20px]">{student.is_active ? 'block' : 'check_circle'}</span>
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>{student.is_active ? 'Deactivate account' : 'Activate account'}</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => setViewingStudent(student)}
                                className="p-2 text-primary rounded-lg hover:bg-primary-fixed/20 transition-colors"
                              >
                                <span className="material-symbols-outlined text-[20px]">visibility</span>
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>View full profile</TooltipContent>
                          </Tooltip>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination */}
            <div className="flex flex-col md:flex-row justify-between items-center px-8 py-5 gap-4" style={{ borderTop: '1px solid rgba(197,197,213,0.15)' }}>
              <p className="text-sm text-on-surface-variant font-medium font-body">
                Showing <span className="font-bold text-on-surface">{Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, filteredStudents.length)}–{Math.min(currentPage * ITEMS_PER_PAGE, filteredStudents.length)}</span> of <span className="font-bold text-on-surface">{filteredStudents.length}</span> participants
              </p>
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-surface-container text-on-surface-variant hover:bg-surface-container-high transition-colors disabled:opacity-30"
                  >
                    <span className="material-symbols-outlined">chevron_left</span>
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                    .reduce<(number | string)[]>((acc, p, idx, arr) => {
                      if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1) acc.push('…');
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((p, idx) =>
                      p === '…' ? (
                        <span key={`ellipsis-${idx}`} className="text-on-surface-variant px-1">…</span>
                      ) : (
                        <button
                          key={p}
                          onClick={() => setCurrentPage(p as number)}
                          className={`w-10 h-10 flex items-center justify-center rounded-xl text-sm font-bold transition-colors ${
                            currentPage === p
                              ? 'bg-primary text-white shadow-[0_4px_12px_rgba(19,41,143,0.3)] font-headline'
                              : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high font-body'
                          }`}
                        >
                          {p}
                        </button>
                      )
                    )
                  }
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-surface-container text-on-surface-variant hover:bg-surface-container-high transition-colors disabled:opacity-30"
                  >
                    <span className="material-symbols-outlined">chevron_right</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* View Profile dialog (read-only) */}
      <Dialog open={!!viewingStudent} onOpenChange={(open) => { if (!open) setViewingStudent(null); }}>
        <DialogContent className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-surface-container-lowest max-w-md">
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-primary to-primary-container rounded-t-[2.5rem]" />
          {viewingStudent && (() => {
            const initials = viewingStudent.name.split(' ').map(n => n[0]).join('').toUpperCase();
            const roleKey = getSeatRole(viewingStudent.position);
            const avgScore = getAverageScore(viewingStudent.user_id);
            const assessCount = getAssessmentCount(viewingStudent.user_id);
            const fields = [
              { icon: 'badge', label: 'Role', value: viewingStudent.position || '—' },
              { icon: 'groups', label: 'Party', value: partyLabel(viewingStudent.party_number, viewingStudent.party_name) },
              { icon: 'account_balance', label: 'Committee', value: viewingStudent.committee || '—' },
              { icon: 'location_on', label: 'Constituency', value: viewingStudent.constituency || '—' },
              { icon: 'school', label: 'School', value: viewingStudent.school || '—' },
              { icon: 'map', label: 'State', value: viewingStudent.state || '—' },
              { icon: 'location_city', label: 'City', value: viewingStudent.city || '—' },
            ];
            return (
              <div className="pt-6">
                {/* Avatar + Name */}
                <div className="flex flex-col items-center gap-3 mb-6">
                  <div className="relative">
                    <Avatar className="w-20 h-20 rounded-2xl ring-4 ring-surface-container">
                      <AvatarImage src={viewingStudent.photo_url} alt={viewingStudent.name} className="object-cover" />
                      <AvatarFallback className="bg-primary-fixed/30 text-primary text-xl font-black rounded-2xl font-headline">{initials}</AvatarFallback>
                    </Avatar>
                    <div className={`absolute -bottom-1 -right-1 size-4 rounded-full border-2 border-surface-container-lowest ${viewingStudent.session_id ? 'bg-on-tertiary-container' : 'bg-outline'}`} />
                  </div>
                  <div className="text-center">
                    <h2 className="text-2xl font-black text-on-surface font-headline">{viewingStudent.name}</h2>
                    <div className="flex items-center justify-center gap-2 mt-1.5">
                      <span className="font-mono text-xs font-bold text-primary bg-primary/8 px-2.5 py-1 rounded-lg">#{viewingStudent.serial_number.toString().padStart(3, '0')}</span>
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold font-body ${
                        roleKey === 'speaker' ? 'bg-error/10 text-error' :
                        roleKey === 'minister' ? 'bg-tertiary-container/10 text-tertiary-container' :
                        roleKey === 'journalist' ? 'bg-secondary-fixed/30 text-secondary' :
                        'bg-primary/10 text-primary'
                      }`}>{viewingStudent.position || 'Delegate'}</span>
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold font-body ${viewingStudent.session_id ? 'bg-tertiary-container/20 text-on-tertiary-container' : 'bg-surface-container text-on-surface-variant'}`}>
                        {viewingStudent.session_id ? 'In Session' : 'Offline'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Score bar */}
                {assessCount > 0 && (
                  <div className="bg-surface-container rounded-2xl p-4 mb-4 flex items-center gap-4">
                    <div className="flex-1">
                      <div className="flex justify-between text-[10px] font-bold font-body mb-1.5">
                        <span className="text-on-surface-variant">Performance Score</span>
                        <span className="text-primary">{avgScore}<span className="text-on-surface-variant/50 font-normal text-[10px]">/100</span></span>
                      </div>
                      <div className="h-2 bg-surface-container-high rounded-full overflow-hidden">
                        <div className="bg-on-tertiary-container h-full transition-all duration-1000" style={{ width: `${avgScore}%` }} />
                      </div>
                    </div>
                    <div className="text-center shrink-0">
                      <p className="text-2xl font-black text-primary font-headline">{assessCount}</p>
                      <p className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant font-body">Assessed</p>
                    </div>
                  </div>
                )}

                {/* Fields grid */}
                <div className="grid grid-cols-2 gap-2.5 mb-6">
                  {fields.map(f => (
                    <div key={f.label} className="bg-surface-container rounded-2xl p-3.5">
                      <p className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant/60 font-body flex items-center gap-1 mb-1">
                        <span className="material-symbols-outlined text-[11px]" style={{ fontVariationSettings: "'FILL' 1" }}>{f.icon}</span>
                        {f.label}
                      </p>
                      <p className="text-sm font-bold text-on-surface font-body truncate">{f.value}</p>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <button onClick={() => setViewingStudent(null)} className="flex-1 py-3.5 text-[10px] font-black uppercase tracking-widest text-on-surface-variant font-body">Close</button>
                  <button
                    onClick={() => { setViewingStudent(null); setEditingStudent(viewingStudent); }}
                    className="flex-1 py-3.5 bg-gradient-to-r from-primary to-primary-container text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-[0_8px_24px_rgba(19,41,143,0.25)] hover:scale-[1.02] active:scale-95 transition-all font-body"
                  >
                    Edit Profile
                  </button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Register New Student dialog */}
      <Dialog open={showRegisterDialog} onOpenChange={(open) => { if (!open) setShowRegisterDialog(false); }}>
        <DialogContent className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-surface-container-lowest max-w-lg">
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-primary to-primary-container rounded-t-[2.5rem]" />
          <DialogHeader className="pt-4">
            <DialogTitle className="text-2xl font-black tracking-tight text-on-surface flex items-center gap-3 font-headline">
              <div className="w-10 h-10 bg-primary-fixed/30 rounded-xl flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-[22px]">person_add</span>
              </div>
              Register Delegate
            </DialogTitle>
            <DialogDescription className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest font-body">
              Serial will be assigned as #{nextSerial.toString().padStart(3, '0')}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRegisterStudent} className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <label className="text-[9px] font-black text-on-surface-variant uppercase tracking-widest ml-1 font-body">Full Name *</label>
                <Input
                  value={registerForm.name}
                  onChange={e => setRegisterForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Arjun Sharma"
                  className="h-12 bg-surface-container border-none rounded-2xl font-bold px-5 focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-on-surface-variant uppercase tracking-widest ml-1 font-body">Login ID *</label>
                <Input
                  value={registerForm.loginId}
                  onChange={e => setRegisterForm(f => ({ ...f, loginId: e.target.value }))}
                  placeholder="e.g. arjun.sharma"
                  className="h-12 bg-surface-container border-none rounded-2xl font-bold px-5 focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-on-surface-variant uppercase tracking-widest ml-1 font-body">Password *</label>
                <Input
                  type="password"
                  value={registerForm.password}
                  onChange={e => setRegisterForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="Min 6 characters"
                  className="h-12 bg-surface-container border-none rounded-2xl font-bold px-5 focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-on-surface-variant uppercase tracking-widest ml-1 font-body">Role</label>
                <select
                  value={registerForm.seatRole}
                  onChange={e => setRegisterForm(f => ({ ...f, seatRole: e.target.value }))}
                  className="w-full h-12 bg-surface-container border-none rounded-2xl font-bold px-5 text-sm text-on-surface focus:ring-2 focus:ring-primary/20 font-body"
                >
                  <option>Member of Parliament</option>
                  <option>Minister</option>
                  <option>Speaker</option>
                  <option>Deputy Speaker</option>
                  <option>Journalist</option>
                  <option>Administrator</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-on-surface-variant uppercase tracking-widest ml-1 font-body">Party</label>
                <select
                  value={registerForm.party}
                  onChange={e => setRegisterForm(f => ({ ...f, party: e.target.value }))}
                  className="w-full h-12 bg-surface-container border-none rounded-2xl font-bold px-5 text-sm text-on-surface focus:ring-2 focus:ring-primary/20 font-body"
                >
                  <option value="No Party">No Party</option>
                  {uniqueParties.length > 0
                    ? uniqueParties.map(([num, name]) => {
                        const letter = PARTY_LETTERS[num - 1] ?? num.toString();
                        return (
                          <option key={letter} value={letter}>
                            {name ? `${name} (${letter})` : `Party ${letter}`}
                          </option>
                        );
                      })
                    : ['A','B','C','D','E'].map(l => (
                        <option key={l} value={l}>Party {l}</option>
                      ))
                  }
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-on-surface-variant uppercase tracking-widest ml-1 font-body">Alliance</label>
                <select
                  value={registerForm.alliance}
                  onChange={e => setRegisterForm(f => ({ ...f, alliance: e.target.value }))}
                  className="w-full h-12 bg-surface-container border-none rounded-2xl font-bold px-5 text-sm text-on-surface focus:ring-2 focus:ring-primary/20 font-body"
                >
                  <option value="Neutral">Neutral</option>
                  <option value="Ruling">Ruling</option>
                  <option value="Opposition">Opposition</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-on-surface-variant uppercase tracking-widest ml-1 font-body">Party Name</label>
                <input
                  list="reg-party-names"
                  value={registerForm.partyName}
                  onChange={e => setRegisterForm(f => ({ ...f, partyName: e.target.value }))}
                  placeholder="Type or select party name"
                  className="w-full h-12 bg-surface-container border-none rounded-2xl font-bold px-5 text-sm text-on-surface focus:ring-2 focus:ring-primary/20 font-body"
                />
                <datalist id="reg-party-names">
                  {uniquePartyNames.map(n => <option key={n} value={n} />)}
                </datalist>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-on-surface-variant uppercase tracking-widest ml-1 font-body flex items-center gap-1.5">
                  Committee
                  <span className="text-primary/60 normal-case tracking-normal font-medium text-[9px]">(auto-assigned)</span>
                </label>
                <select
                  value={registerForm.committee}
                  onChange={e => setRegisterForm(f => ({ ...f, committee: e.target.value }))}
                  className="w-full h-12 bg-surface-container border-none rounded-2xl font-bold px-5 text-sm text-on-surface focus:ring-2 focus:ring-primary/20 font-body"
                >
                  <option value="">Select committee</option>
                  {eventCommittees.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-on-surface-variant uppercase tracking-widest ml-1 font-body">Constituency</label>
                <input
                  list="reg-constituencies"
                  value={registerForm.constituency}
                  onChange={e => setRegisterForm(f => ({ ...f, constituency: e.target.value }))}
                  placeholder="Type or select constituency"
                  className="w-full h-12 bg-surface-container border-none rounded-2xl font-bold px-5 text-sm text-on-surface focus:ring-2 focus:ring-primary/20 font-body"
                />
                <datalist id="reg-constituencies">
                  {uniqueConstituencies.map(c => <option key={c} value={c} />)}
                </datalist>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-on-surface-variant uppercase tracking-widest ml-1 font-body">State</label>
                <input
                  list="reg-states"
                  value={registerForm.state}
                  onChange={e => setRegisterForm(f => ({ ...f, state: e.target.value }))}
                  placeholder="Type or select state"
                  className="w-full h-12 bg-surface-container border-none rounded-2xl font-bold px-5 text-sm text-on-surface focus:ring-2 focus:ring-primary/20 font-body"
                />
                <datalist id="reg-states">
                  {["Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Delhi","Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Ladakh","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal","Jammu and Kashmir","Puducherry","Chandigarh"].map(s => <option key={s} value={s} />)}
                </datalist>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowRegisterDialog(false)} className="flex-1 py-4 text-[10px] font-black uppercase tracking-widest text-on-surface-variant font-body">Cancel</button>
              <button
                type="submit"
                disabled={isRegistering}
                className="flex-1 py-4 bg-gradient-to-r from-primary to-primary-container text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-[0_8px_24px_rgba(19,41,143,0.25)] hover:scale-[1.02] active:scale-95 transition-all font-body"
              >
                {isRegistering ? "Registering…" : "Register Delegate"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <StudentEditDialog
        student={editingStudent}
        isOpen={!!editingStudent}
        onClose={() => setEditingStudent(null)}
        onSave={() => { fetchStudents(); fetchJuryAssessments(); }}
        parties={uniqueParties}
        constituencies={uniqueConstituencies}
        committees={eventCommittees}
        partyNames={uniquePartyNames}
      />

      {/* Password reset dialog */}
      <Dialog open={!!passwordResetStudent} onOpenChange={(open) => {
        if (!open) { setPasswordResetStudent(null); setNewPassword(''); setConfirmPassword(''); setShowNewPassword(false); setShowConfirmPassword(false); }
      }}>
        <DialogContent className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-surface-container-lowest">
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-primary to-primary-container rounded-t-[2.5rem]" />
          <DialogHeader className="pt-4">
            <DialogTitle className="text-2xl font-black tracking-tight text-on-surface flex items-center gap-3 font-headline">
              <div className="w-10 h-10 bg-secondary-fixed/30 rounded-xl flex items-center justify-center text-secondary">
                <KeyRound className="w-5 h-5" />
              </div>
              Authorization Override
            </DialogTitle>
            <DialogDescription className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest font-body">
              Reset credentials for {passwordResetStudent?.name}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleResetPassword} className="space-y-5 mt-4">
            <div className="space-y-2">
              <label className="text-[9px] font-black text-on-surface-variant uppercase tracking-widest ml-1 font-body">New Password</label>
              <div className="relative">
                <Input
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-14 bg-surface-container border-none rounded-2xl font-bold px-5 focus:ring-2 focus:ring-primary/20"
                />
                <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant">
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-black text-on-surface-variant uppercase tracking-widest ml-1 font-body">Confirm Password</label>
              <div className="relative">
                <Input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-14 bg-surface-container border-none rounded-2xl font-bold px-5 focus:ring-2 focus:ring-primary/20"
                />
                <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant">
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setPasswordResetStudent(null)} className="flex-1 py-4 text-[10px] font-black uppercase tracking-widest text-on-surface-variant font-body">Cancel</button>
              <button
                type="submit"
                disabled={isResettingPassword}
                className="flex-1 py-4 bg-gradient-to-r from-primary to-primary-container text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-[0_8px_24px_rgba(19,41,143,0.25)] hover:scale-[1.02] active:scale-95 transition-all font-body"
              >
                {isResettingPassword ? "Updating…" : "Authorize Reset"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
    </TooltipProvider>
  );
};