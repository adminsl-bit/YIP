import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Users, CheckCircle, Clock, Trophy, Download, FileText } from "lucide-react";

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

  useEffect(() => {
    fetchDashboardData();
  }, [juryId]);

  const fetchDashboardData = async () => {
    try {
      // Fetch all students
      const { data: students, error: studentsError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_type', 'student');

      if (studentsError) throw studentsError;

      // Fetch assessments by this jury with student profiles
      const { data: assessments, error: assessmentsError } = await supabase
        .from('assessments')
        .select(`
          *,
          profiles!assessments_student_id_fkey(name, position, party_number, serial_number)
        `)
        .eq('jury_id', juryId)
        .eq('status', 'submitted');

      if (assessmentsError) throw assessmentsError;

      // Calculate stats
      const totalStudents = students?.length || 0;
      const assessedStudents = assessments?.length || 0;
      const averageScore = assessments?.length > 0 
        ? Math.round(assessments.reduce((sum, a) => sum + a.total_score, 0) / assessments.length)
        : 0;

      // Get top 5 performers
      const topPerformers = assessments
        ?.sort((a, b) => b.total_score - a.total_score)
        .slice(0, 5)
        .map(a => ({
          name: (a as any).profiles?.name || 'Unknown',
          score: a.total_score,
          position: (a as any).profiles?.position || 'Unknown'
        })) || [];

      setStats({
        totalStudents,
        assessedStudents,
        averageScore,
        topPerformers
      });

      // Calculate chart data
      if (assessments && assessments.length > 0) {
        // Party performance data
        const partyGroups = assessments.reduce((acc, assessment) => {
          const party = (assessment as any).profiles?.party_number || 0;
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

        // Role performance data
        const roleGroups = assessments.reduce((acc, assessment) => {
          const role = getSeatRole((assessment as any).profiles?.position || 'mp');
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

        const scoreDistribution = Object.entries(scoreRanges).map(([range, count]) => ({
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
    return 'mp';
  };

  const exportToPDF = () => {
    // This would typically use a library like jsPDF
    console.log('Export to PDF functionality would be implemented here');
  };

  const exportToCSV = async () => {
    try {
      const { data: assessments, error } = await supabase
        .from('assessments')
        .select(`
          *,
          profiles!assessments_student_id_fkey(name, position, party_number, serial_number)
        `)
        .eq('jury_id', juryId)
        .eq('status', 'submitted');

      if (error) throw error;

      if (!assessments || assessments.length === 0) {
        alert('No assessments to export');
        return;
      }

      // Create CSV content
      const headers = ['Student Name', 'Position', 'Party', 'Serial', 'Total Score', 'Assessment Date'];
      const csvContent = [
        headers.join(','),
        ...assessments.map(a => [
          `"${(a as any).profiles?.name || 'Unknown'}"`,
          `"${(a as any).profiles?.position || 'Unknown'}"`,
          (a as any).profiles?.party_number || 0,
          (a as any).profiles?.serial_number || 0,
          a.total_score,
          new Date(a.updated_at).toLocaleDateString()
        ].join(','))
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Progress</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.assessedStudents} / {stats.totalStudents}
            </div>
            <Progress value={progressPercentage} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {progressPercentage}% Complete
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Assessed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.assessedStudents}</div>
            <p className="text-xs text-muted-foreground">
              Students evaluated
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Remaining</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.totalStudents - stats.assessedStudents}
            </div>
            <p className="text-xs text-muted-foreground">
              Students pending
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Score</CardTitle>
            <Trophy className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.averageScore}</div>
            <p className="text-xs text-muted-foreground">
              Out of 100
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Top Performers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Trophy className="w-5 h-5" />
            <span>Top 5 Performers</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats.topPerformers.length > 0 ? (
            <div className="space-y-3">
              {stats.topPerformers.map((performer, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Badge variant={index === 0 ? "default" : "secondary"}>
                      #{index + 1}
                    </Badge>
                    <div>
                      <p className="font-medium">{performer.name}</p>
                      <p className="text-sm text-muted-foreground">{performer.position}</p>
                    </div>
                  </div>
                  <div className="text-xl font-bold text-primary">
                    {performer.score}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-4">
              No assessments completed yet
            </p>
          )}
        </CardContent>
      </Card>

      {/* Charts */}
      {chartData.partyData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Party Performance Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Performance by Party</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData.partyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="party" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value, name) => [value, name === 'averageScore' ? 'Average Score' : name]}
                    labelFormatter={(label) => `Party ${label}`}
                  />
                  <Bar dataKey="averageScore" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Role Performance Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Performance by Role</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData.roleData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="role" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value, name) => [value, name === 'averageScore' ? 'Average Score' : name]}
                  />
                  <Bar dataKey="averageScore" fill="#82ca9d" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Score Distribution */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Score Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={chartData.scoreDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ range, count }) => `${range}: ${count}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {chartData.scoreDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Export Buttons */}
      <Card>
        <CardHeader>
          <CardTitle>Export Data</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-4">
            <Button variant="outline" onClick={exportToCSV}>
              <FileText className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
            <Button variant="outline" onClick={exportToPDF}>
              <Download className="w-4 h-4 mr-2" />
              Export PDF
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};