import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Users, CheckCircle, Clock, Trophy, Download, FileText } from "lucide-react";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface DashboardStats {
  totalStudents: number;
  assessedStudents: number;
  averageScore: number;
  topPerformers: Array<{
    name: string;
    score: number;
    position: string;
  }>;
}

interface ChartData {
  partyData: Array<{ party: number; averageScore: number; count: number }>;
  roleData: Array<{ role: string; averageScore: number; count: number }>;
  scoreDistribution: Array<{ range: string; count: number }>;
}

interface JuryDashboardStatsProps {
  juryId: string;
}

export const JuryDashboardStats = ({ juryId }: JuryDashboardStatsProps) => {
  const [stats, setStats] = useState<DashboardStats>({
    totalStudents: 0,
    assessedStudents: 0,
    averageScore: 0,
    topPerformers: []
  });
  const [chartData, setChartData] = useState<ChartData>({
    partyData: [],
    roleData: [],
    scoreDistribution: []
  });
  const [loading, setLoading] = useState(true);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchDashboardData();
    
    // Set up real-time subscription for assessments
    const channel = supabase
      .channel('jury-dashboard-updates')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'assessments',
          filter: `jury_id=eq.${juryId}` // Only listen to this jury's assessments
        },
        (payload) => {
          console.log('Dashboard assessment update received:', payload);
          // Refresh dashboard data when any assessment changes
          fetchDashboardData();
        }
      )
      .subscribe();

    // Also listen to profile changes for student data updates
    const profileChannel = supabase
      .channel('jury-dashboard-student-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `user_type=eq.student`
        },
        (payload) => {
          console.log('Dashboard student profile update received:', payload);
          // Refresh dashboard data when student profiles change
          fetchDashboardData();
        }
      )
      .subscribe();

    // Cleanup subscriptions on unmount
    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(profileChannel);
    };
  }, [juryId]);

  const fetchDashboardData = async () => {
    try {
      // Fetch all students
      const { data: students, error: studentsError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_type', 'student');

      if (studentsError) throw studentsError;

      // Fetch assessments by this jury
      const { data: assessments, error: assessmentsError } = await supabase
        .from('assessments')
        .select('id, student_id, total_score, updated_at, seat_role, status')
        .eq('jury_id', juryId)
        .eq('status', 'submitted');

      if (assessmentsError) {
        console.error('Assessments query error:', assessmentsError);
        throw assessmentsError;
      }

      console.log('Fetched assessments:', assessments);
      console.log('Total students:', students?.length);
      console.log('Assessed count:', assessments?.length);

      // Build profiles map for assessed students
      const studentIds = (assessments || []).map((a) => a.student_id).filter(Boolean);
      let profilesMap: Record<string, any> = {};
      
      if (studentIds.length > 0) {
        console.log('Student IDs to fetch:', studentIds);
        const uniqueIds = Array.from(new Set(studentIds));
        const { data: byUserId, error: profilesError1 } = await supabase
          .from('profiles')
          .select('id, user_id, name, position, party_number, serial_number')
          .in('user_id', uniqueIds);
        
        if (profilesError1) {
          console.error('Profiles query error (user_id):', profilesError1);
          throw profilesError1;
        }
        
        console.log('Student profiles fetched (user_id):', byUserId);
        profilesMap = (byUserId || []).reduce((acc, p) => {
          acc[p.user_id] = p;
          return acc;
        }, {} as Record<string, any>);

        const missing = uniqueIds.filter((id) => !profilesMap[id]);
        if (missing.length) {
          console.log('Missing profiles for user_id, trying id lookup:', missing);
          const { data: byId, error: profilesError2 } = await supabase
            .from('profiles')
            .select('id, user_id, name, position, party_number, serial_number')
            .in('id', missing);
          if (profilesError2) {
            console.error('Profiles query error (id):', profilesError2);
            throw profilesError2;
          }
          (byId || []).forEach((p) => {
            if (p.user_id) profilesMap[p.user_id] = p;
            profilesMap[p.id] = p;
          });
        }
        console.log('Profiles map:', profilesMap);
      }

      // Calculate stats
      const totalStudents = students?.length || 0;
      const assessedStudents = assessments?.length || 0;
      const averageScore = assessments?.length > 0 
        ? Math.round(assessments.reduce((sum, a) => sum + a.total_score, 0) / assessments.length)
        : 0;

      // Get top 5 performers with better error handling
      const topPerformers = assessments
        ?.sort((a, b) => b.total_score - a.total_score)
        .slice(0, 5)
        .map(a => {
          const profile = profilesMap[a.student_id];
          console.log(`Processing student ${a.student_id}:`, profile);
          return {
            name: profile?.name || 'Student Name Not Found',
            score: a.total_score,
            position: profile?.position || 'Position Not Found'
          };
        }) || [];

      setStats({
        totalStudents,
        assessedStudents,
        averageScore,
        topPerformers
      });

      // Calculate chart data
      if (assessments && assessments.length > 0) {
        // Party performance data using profiles map
        const partyGroups = assessments.reduce((acc, assessment) => {
          const profile = profilesMap[assessment.student_id];
          const party = profile?.party_number ?? 0;
          if (!acc[party]) acc[party] = { scores: [], count: 0 };
          acc[party].scores.push(assessment.total_score);
          acc[party].count++;
          return acc;
        }, {} as Record<number, { scores: number[]; count: number }>);

        const partyData = Object.entries(partyGroups).map(([party, data]) => ({
          party: parseInt(party),
          averageScore: Math.round(data.scores.reduce((a, b) => a + b, 0) / data.count),
          count: data.count
        }));

        // Role performance data using profiles map
        const roleGroups = assessments.reduce((acc, assessment) => {
          const profile = profilesMap[assessment.student_id];
          const role = getSeatRole(profile?.position || 'mp');
          if (!acc[role]) acc[role] = { scores: [], count: 0 };
          acc[role].scores.push(assessment.total_score);
          acc[role].count++;
          return acc;
        }, {} as Record<string, { scores: number[]; count: number }>);

        const roleData = Object.entries(roleGroups).map(([role, data]) => ({
          role: role.replace('_', ' ').toUpperCase(),
          averageScore: Math.round(data.scores.reduce((a, b) => a + b, 0) / data.count),
          count: data.count
        }));

        // Score distribution
        const scoreRanges = {
          '0-20': 0,
          '21-40': 0,
          '41-60': 0,
          '61-80': 0,
          '81-100': 0
        };

        assessments.forEach(assessment => {
          const score = assessment.total_score;
          if (score <= 20) scoreRanges['0-20']++;
          else if (score <= 40) scoreRanges['21-40']++;
          else if (score <= 60) scoreRanges['41-60']++;
          else if (score <= 80) scoreRanges['61-80']++;
          else scoreRanges['81-100']++;
        });

        const scoreDistribution = Object.entries(scoreRanges)
          .filter(([range, count]) => count > 0) // Only include ranges with data
          .map(([range, count]) => ({
            range,
            count
          }));

        setChartData({
          partyData: partyData.sort((a, b) => a.party - b.party),
          roleData,
          scoreDistribution
        });
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSeatRole = (position: string): string => {
    const pos = position.toLowerCase();
    if (pos.includes('speaker') && pos.includes('deputy')) return 'deputy_speaker';
    if (pos.includes('speaker')) return 'speaker';
    if (pos.includes('administrator') || pos.includes('admin')) return 'administrator';
    return 'mp';
  };

  const exportToPDF = async () => {
    try {
      const container = reportRef.current;
      if (!container) {
        alert('Report not ready to export');
        return;
      }

      const originalBg = container.style.backgroundColor;
      container.style.backgroundColor = '#ffffff';

      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      container.style.backgroundColor = originalBg;

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      pdf.save(`jury-dashboard-${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Failed to export PDF');
    }
  };

  const exportToCSV = async () => {
    try {
      const { data: assessments, error: assessErr } = await supabase
        .from('assessments')
        .select('id, student_id, total_score, updated_at')
        .eq('jury_id', juryId)
        .eq('status', 'submitted');

      if (assessErr) throw assessErr;

      if (!assessments || assessments.length === 0) {
        alert('No assessments to export');
        return;
      }

      const studentIds = Array.from(new Set(assessments.map(a => a.student_id).filter(Boolean)));
      const { data: profiles, error: profErr } = await supabase
        .from('profiles')
        .select('user_id, name, position, party_number, serial_number')
        .in('user_id', studentIds);
      if (profErr) throw profErr;
      const profilesMap = (profiles || []).reduce((acc, p) => {
        acc[p.user_id] = p;
        return acc;
      }, {} as Record<string, any>);

      // Create CSV content
      const headers = ['Student Name', 'Position', 'Party', 'Serial', 'Total Score', 'Assessment Date'];
      const csvContent = [
        headers.join(','),
        ...assessments.map(a => {
          const p = (profilesMap as any)[a.student_id] || {};
          return [
            `"${p.name || 'Unknown'}"`,
            `"${p.position || 'Unknown'}"`,
            p.party_number ?? 0,
            p.serial_number ?? 0,
            a.total_score,
            new Date(a.updated_at).toLocaleDateString()
          ].join(',');
        })
      ].join('\n');

      // Download CSV
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `jury-assessments-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error exporting CSV:', error);
      alert('Failed to export CSV');
    }
  };

  const progressPercentage = stats.totalStudents > 0 
    ? Math.round((stats.assessedStudents / stats.totalStudents) * 100)
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div ref={reportRef} className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white/20 backdrop-blur-lg rounded-3xl p-6 border border-white/25 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center shadow-lg">
              <Users className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wide">Progress</h3>
          </div>
          <div className="space-y-2">
            <div className="text-3xl font-black text-slate-800">
              {stats.assessedStudents} / {stats.totalStudents}
            </div>
            <Progress value={progressPercentage} className="h-3 bg-white/30" />
            <p className="text-sm font-semibold text-slate-600">
              {progressPercentage}% Complete
            </p>
          </div>
        </div>

        <div className="bg-white/20 backdrop-blur-lg rounded-3xl p-6 border border-white/25 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-teal-500 rounded-2xl flex items-center justify-center shadow-lg">
              <CheckCircle className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wide">Assessed</h3>
          </div>
          <div className="text-3xl font-black text-slate-800 mb-2">{stats.assessedStudents}</div>
          <p className="text-sm font-semibold text-slate-600">Students evaluated</p>
        </div>

        <div className="bg-white/20 backdrop-blur-lg rounded-3xl p-6 border border-white/25 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg">
              <Clock className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wide">Remaining</h3>
          </div>
          <div className="text-3xl font-black text-slate-800 mb-2">
            {stats.totalStudents - stats.assessedStudents}
          </div>
          <p className="text-sm font-semibold text-slate-600">Students pending</p>
        </div>

        <div className="bg-white/20 backdrop-blur-lg rounded-3xl p-6 border border-white/25 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl flex items-center justify-center shadow-lg">
              <Trophy className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wide">Average</h3>
          </div>
          <div className="text-3xl font-black text-slate-800 mb-2">{stats.averageScore}</div>
          <p className="text-sm font-semibold text-slate-600">Out of 100</p>
        </div>
      </div>

      {/* Top Performers */}
      <div className="bg-white/20 backdrop-blur-lg rounded-3xl p-6 border border-white/25 shadow-xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl flex items-center justify-center shadow-lg">
            <Trophy className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-xl font-black text-slate-800">Top 5 Performers</h3>
        </div>
        
        {stats.topPerformers.length > 0 ? (
          <div className="space-y-4">
            {stats.topPerformers.map((performer, index) => (
              <div key={index} className="flex items-center justify-between bg-white/30 backdrop-blur-sm rounded-2xl p-4">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-white ${
                    index === 0 ? 'bg-gradient-to-br from-yellow-500 to-orange-500' :
                    index === 1 ? 'bg-gradient-to-br from-gray-400 to-gray-500' :
                    index === 2 ? 'bg-gradient-to-br from-orange-600 to-yellow-600' :
                    'bg-gradient-to-br from-slate-500 to-slate-600'
                  }`}>
                    #{index + 1}
                  </div>
                  <div>
                    <p className="font-bold text-slate-800">{performer.name}</p>
                    <p className="text-sm font-semibold text-slate-600">{performer.position}</p>
                  </div>
                </div>
                <div className="bg-white/40 backdrop-blur-sm rounded-xl px-4 py-2">
                  <span className="text-xl font-black text-slate-800">{performer.score}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Trophy className="w-12 h-12 mx-auto mb-3 text-slate-400" />
            <p className="text-slate-600 font-semibold">No assessments completed yet</p>
          </div>
        )}
      </div>

      {/* Charts */}
      {chartData.partyData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Party Performance Chart */}
          <div className="bg-white/20 backdrop-blur-lg rounded-3xl p-6 border border-white/25 shadow-xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-2xl flex items-center justify-center shadow-lg">
                <BarChart className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-black text-slate-800">Performance by Party</h3>
            </div>
            <div className="bg-white/30 backdrop-blur-sm rounded-2xl p-4">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData.partyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.3)" />
                  <XAxis dataKey="party" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value, name) => [value, name === 'averageScore' ? 'Average Score' : name]}
                    labelFormatter={(label) => `Party ${label}`}
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      backdropFilter: 'blur(10px)',
                      border: 'none',
                      borderRadius: '12px',
                      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                  <Bar dataKey="averageScore" fill="url(#blueGradient)" radius={[4, 4, 0, 0]} />
                  <defs>
                    <linearGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#6366F1" stopOpacity={0.6} />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Role Performance Chart */}
          <div className="bg-white/20 backdrop-blur-lg rounded-3xl p-6 border border-white/25 shadow-xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center shadow-lg">
                <BarChart className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-black text-slate-800">Performance by Role</h3>
            </div>
            <div className="bg-white/30 backdrop-blur-sm rounded-2xl p-4">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData.roleData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.3)" />
                  <XAxis dataKey="role" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value, name) => [value, name === 'averageScore' ? 'Average Score' : name]}
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      backdropFilter: 'blur(10px)',
                      border: 'none',
                      borderRadius: '12px',
                      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                  <Bar dataKey="averageScore" fill="url(#greenGradient)" radius={[4, 4, 0, 0]} />
                  <defs>
                    <linearGradient id="greenGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#059669" stopOpacity={0.6} />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Score Distribution */}
          <div className="lg:col-span-2 bg-white/20 backdrop-blur-lg rounded-3xl p-6 border border-white/25 shadow-xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-500 rounded-2xl flex items-center justify-center shadow-lg">
                <BarChart className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-black text-slate-800">Score Distribution</h3>
            </div>
            <div className="bg-white/30 backdrop-blur-sm rounded-2xl p-4">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData.scoreDistribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.3)" />
                  <XAxis 
                    dataKey="range" 
                    tick={{ fontSize: 12, fill: '#475569' }}
                    axisLine={{ stroke: '#94A3B8', strokeWidth: 1 }}
                  />
                  <YAxis 
                    tick={{ fontSize: 12, fill: '#475569' }}
                    axisLine={{ stroke: '#94A3B8', strokeWidth: 1 }}
                    label={{ value: 'Number of Students', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#475569' } }}
                  />
                  <Tooltip 
                    formatter={(value, name) => [value, 'Students']}
                    labelFormatter={(label) => `Score Range: ${label}`}
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      backdropFilter: 'blur(10px)',
                      border: 'none',
                      borderRadius: '12px',
                      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                  <Bar dataKey="count" fill="url(#violetGradient)" radius={[4, 4, 0, 0]} />
                  <defs>
                    <linearGradient id="violetGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.9} />
                      <stop offset="95%" stopColor="#7C3AED" stopOpacity={0.7} />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Export Buttons */}
      <div className="bg-white/20 backdrop-blur-lg rounded-3xl p-6 border border-white/25 shadow-xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-blue-500 rounded-2xl flex items-center justify-center shadow-lg">
            <Download className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-xl font-black text-slate-800">Export Data</h3>
        </div>
        
        <div className="flex flex-wrap gap-4">
          <Button 
            variant="outline" 
            onClick={exportToCSV}
            className="bg-white/30 backdrop-blur-sm border-white/40 text-slate-800 hover:bg-white/40 hover:scale-105 transition-all duration-300 rounded-2xl px-6 py-3 font-semibold"
          >
            <FileText className="w-5 h-5 mr-2" />
            Export CSV
          </Button>
          <Button 
            variant="outline" 
            onClick={exportToPDF}
            className="bg-white/30 backdrop-blur-sm border-white/40 text-slate-800 hover:bg-white/40 hover:scale-105 transition-all duration-300 rounded-2xl px-6 py-3 font-semibold"
          >
            <Download className="w-5 h-5 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>
    </div>
  );
};