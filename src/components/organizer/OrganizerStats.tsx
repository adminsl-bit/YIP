import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Users, CheckCircle, Clock, Trophy, UserCheck, AlertTriangle } from "lucide-react";

interface OrganizerStats {
  totalStudents: number;
  totalJury: number;
  assessmentsCompleted: number;
  totalAssessments: number;
  duplicateLogins: number;
  activePolls: number;
}

interface ChartData {
  partyData: Array<{ party: number; studentCount: number }>;
  roleData: Array<{ role: string; count: number }>;
  assessmentProgress: Array<{ status: string; count: number }>;
}

export const OrganizerStats = () => {
  const { profile } = useAuth();
  const [stats, setStats] = useState<OrganizerStats>({
    totalStudents: 0,
    totalJury: 0,
    assessmentsCompleted: 0,
    totalAssessments: 0,
    duplicateLogins: 0,
    activePolls: 0
  });
  const [chartData, setChartData] = useState<ChartData>({
    partyData: [],
    roleData: [],
    assessmentProgress: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.event_id) fetchOrganizerData();
  }, [profile?.event_id]);

  const fetchOrganizerData = async () => {
    try {
      // Fetch all profiles scoped to this organizer's event
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .eq('event_id', profile?.event_id ?? '');

      if (profilesError) throw profilesError;

      const eventId = profile?.event_id ?? '';

      const { data: assessments, error: assessmentsError } = await supabase
        .from('assessments')
        .select('*')
        .eq('event_id', eventId);

      if (assessmentsError) throw assessmentsError;

      const { data: duplicateLogins, error: duplicateError } = await supabase
        .from('login_audit')
        .select('*')
        .eq('is_duplicate_session', true);

      if (duplicateError) throw duplicateError;

      const { data: activePolls, error: pollsError } = await supabase
        .from('polls')
        .select('*')
        .eq('is_active', true)
        .eq('event_id', eventId);

      if (pollsError) throw pollsError;

      const students = profiles?.filter(p => p.user_type === 'student') || [];
      const jury = profiles?.filter(p => p.user_type === 'jury') || [];
      const completedAssessments = assessments?.filter(a => a.status === 'submitted') || [];

      // Calculate expected total assessments (students × jury members)
      const expectedAssessments = students.length * jury.length;

      setStats({
        totalStudents: students.length,
        totalJury: jury.length,
        assessmentsCompleted: completedAssessments.length,
        totalAssessments: expectedAssessments,
        duplicateLogins: duplicateLogins?.length || 0,
        activePolls: activePolls?.length || 0
      });

      // Calculate chart data
      if (students.length > 0) {
        // Party distribution
        const partyGroups = students.reduce((acc, student) => {
          const party = student.party_number || 0;
          acc[party] = (acc[party] || 0) + 1;
          return acc;
        }, {} as Record<number, number>);

        const partyData = Object.entries(partyGroups).map(([party, count]) => ({
          party: parseInt(party),
          studentCount: count
        }));

        // Role distribution
        const roleGroups = students.reduce((acc, student) => {
          const role = getSeatRole(student.position || '');
          acc[role] = (acc[role] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        const roleData = Object.entries(roleGroups).map(([role, count]) => ({
          role: role.replace('_', ' ').toUpperCase(),
          count
        }));

        // Assessment progress - show how many students have been assessed by jury
        const studentAssessmentStatus = students.map(student => {
          const studentAssessments = assessments?.filter(a => a.student_id === student.user_id) || [];
          const completedCount = studentAssessments.filter(a => a.status === 'submitted').length;
          const inProgressCount = studentAssessments.filter(a => a.status === 'draft').length;
          
          if (completedCount === jury.length) return 'Fully Assessed';
          if (completedCount > 0 || inProgressCount > 0) return 'Partially Assessed';
          return 'Not Assessed';
        });

        const statusGroups = {
          'Fully Assessed': studentAssessmentStatus.filter(s => s === 'Fully Assessed').length,
          'Partially Assessed': studentAssessmentStatus.filter(s => s === 'Partially Assessed').length,
          'Not Assessed': studentAssessmentStatus.filter(s => s === 'Not Assessed').length
        };

        const assessmentProgress = Object.entries(statusGroups)
          .map(([status, count]) => ({ status, count }))
          .filter(item => item.count > 0); // Only show categories with data

        setChartData({
          partyData: partyData.sort((a, b) => a.party - b.party),
          roleData,
          assessmentProgress
        });
      }
    } catch (error) {
      console.error('Error fetching organizer data:', error);
    } finally {
      setLoading(false);
    }
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

  const assessmentProgress = stats.totalAssessments > 0 
    ? Math.round((stats.assessmentsCompleted / stats.totalAssessments) * 100)
    : 0;

  const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#8dd1e1'];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-6 border border-white/30 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center">
              <Users className="w-6 h-6 text-white" />
            </div>
            <Badge variant="secondary">{stats.totalStudents}</Badge>
          </div>
          <h3 className="text-lg font-bold text-slate-800">Total Students</h3>
          <p className="text-sm text-slate-600">Registered participants</p>
        </div>

        <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-6 border border-white/30 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-teal-500 rounded-2xl flex items-center justify-center">
              <UserCheck className="w-6 h-6 text-white" />
            </div>
            <Badge variant="secondary">{stats.totalJury}</Badge>
          </div>
          <h3 className="text-lg font-bold text-slate-800">Jury Members</h3>
          <p className="text-sm text-slate-600">Assessment evaluators</p>
        </div>

        <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-6 border border-white/30 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-2xl flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-white" />
            </div>
            <Badge variant="secondary">{stats.assessmentsCompleted}</Badge>
          </div>
          <h3 className="text-lg font-bold text-slate-800">Assessments Done</h3>
          <p className="text-sm text-slate-600">Out of {stats.totalAssessments}</p>
          <Progress value={assessmentProgress} className="mt-2" />
        </div>

        <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-6 border border-white/30 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-pink-500 rounded-2xl flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-white" />
            </div>
            <Badge variant={stats.duplicateLogins > 0 ? "destructive" : "secondary"}>
              {stats.duplicateLogins}
            </Badge>
          </div>
          <h3 className="text-lg font-bold text-slate-800">Security Alerts</h3>
          <p className="text-sm text-slate-600">Duplicate login attempts</p>
        </div>

        <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-6 border border-white/30 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-2xl flex items-center justify-center">
              <Trophy className="w-6 h-6 text-white" />
            </div>
            <Badge variant="secondary">{stats.activePolls}</Badge>
          </div>
          <h3 className="text-lg font-bold text-slate-800">Active Polls</h3>
          <p className="text-sm text-slate-600">Currently running</p>
        </div>

        <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-6 border border-white/30 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-2xl flex items-center justify-center">
              <Clock className="w-6 h-6 text-white" />
            </div>
            <Badge variant="secondary">
              {Math.round((stats.assessmentsCompleted / Math.max(stats.totalAssessments, 1)) * 100)}%
            </Badge>
          </div>
          <h3 className="text-lg font-bold text-slate-800">Progress</h3>
          <p className="text-sm text-slate-600">Overall completion</p>
        </div>
      </div>

      {/* Charts */}
      {chartData.partyData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Party Distribution Chart */}
          <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-6 border border-white/30 shadow-lg">
            <h3 className="text-xl font-bold text-slate-800 mb-4">Students by Party</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData.partyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="party" />
                <YAxis />
                <Tooltip 
                  formatter={(value, name) => [value, 'Students']}
                  labelFormatter={(label) => `Party ${label}`}
                />
                <Bar dataKey="studentCount" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Role Distribution Chart */}
          <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-6 border border-white/30 shadow-lg">
            <h3 className="text-xl font-bold text-slate-800 mb-4">Students by Role</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData.roleData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="role" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#82ca9d" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Assessment Progress Pie Chart */}
          <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-6 border border-white/30 shadow-lg lg:col-span-2">
            <h3 className="text-xl font-bold text-slate-800 mb-4">Assessment Progress</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={chartData.assessmentProgress}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ status, count }) => `${status}: ${count}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {chartData.assessmentProgress.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};