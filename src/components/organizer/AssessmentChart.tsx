import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Users, Award, Target } from "lucide-react";

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

interface AssessmentChartProps {
  juryAssessments: JuryAssessment[];
  totalStudents: number;
}

export const AssessmentChart = ({ juryAssessments, totalStudents }: AssessmentChartProps) => {
  // Prepare data for charts
  const juryProgressData = juryAssessments.map(jury => ({
    name: jury.jury_name,
    assessed: jury.total_assessed,
    remaining: totalStudents - jury.total_assessed,
    avgScore: jury.avg_score,
    percentage: Math.round((jury.total_assessed / totalStudents) * 100)
  }));

  const overallProgressData = [
    {
      name: 'Assessed',
      value: juryAssessments.reduce((sum, jury) => sum + jury.total_assessed, 0),
      color: '#22c55e'
    },
    {
      name: 'Remaining',
      value: (totalStudents * juryAssessments.length) - juryAssessments.reduce((sum, jury) => sum + jury.total_assessed, 0),
      color: '#e5e7eb'
    }
  ];

  const COLORS = ['#22c55e', '#e5e7eb'];

  const averageScoreData = juryAssessments.map(jury => ({
    jury: jury.jury_name,
    score: jury.avg_score,
    assessments: jury.total_assessed
  }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-slate-200 rounded-lg shadow-lg">
          <p className="font-semibold text-slate-800">{`${label}`}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {`${entry.dataKey}: ${entry.value}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Overall Progress */}
      <Card className="bg-white/20 backdrop-blur-lg border border-white/25 shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
              <Target className="w-5 h-5 text-white" />
            </div>
            <CardTitle className="text-slate-800">Overall Assessment Progress</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={overallProgressData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {overallProgressData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center mt-4">
            <div className="text-center">
              <div className="text-2xl font-black text-slate-800">
                {Math.round((overallProgressData[0].value / (overallProgressData[0].value + overallProgressData[1].value)) * 100)}%
              </div>
              <div className="text-sm text-slate-600 font-medium">Complete</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Jury Progress Breakdown */}
      <Card className="bg-white/20 backdrop-blur-lg border border-white/25 shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5 text-white" />
            </div>
            <CardTitle className="text-slate-800">Jury Assessment Progress</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={juryProgressData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="assessed" fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="remaining" fill="#e5e7eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Average Scores by Jury */}
      <Card className="bg-white/20 backdrop-blur-lg border border-white/25 shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <CardTitle className="text-slate-800">Average Scores by Jury</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={averageScoreData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis 
                  dataKey="jury" 
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis 
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  domain={[0, 100]}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="score" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Jury Statistics */}
      <Card className="bg-white/20 backdrop-blur-lg border border-white/25 shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center">
              <Award className="w-5 h-5 text-white" />
            </div>
            <CardTitle className="text-slate-800">Jury Performance Summary</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {juryAssessments.map((jury, index) => (
              <div key={jury.jury_id} className="flex items-center justify-between p-4 bg-white/30 backdrop-blur-sm rounded-xl border border-white/20">
                <div className="flex-1">
                  <div className="font-semibold text-slate-800">{jury.jury_name}</div>
                  <div className="text-sm text-slate-600 mt-1">
                    {jury.total_assessed} of {totalStudents} assessed
                  </div>
                </div>
                <div className="text-right space-y-2">
                  <Badge 
                    variant="secondary" 
                    className={`font-medium ${
                      jury.total_assessed === totalStudents 
                        ? 'bg-green-100 text-green-800 border-green-300' 
                        : jury.total_assessed > totalStudents * 0.7
                        ? 'bg-yellow-100 text-yellow-800 border-yellow-300'
                        : 'bg-slate-100 text-slate-600 border-slate-300'
                    }`}
                  >
                    {Math.round((jury.total_assessed / totalStudents) * 100)}%
                  </Badge>
                  <div className="text-sm font-medium text-slate-700">
                    Avg: {jury.avg_score.toFixed(1)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};