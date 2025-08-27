import { useAuth } from '@/hooks/useAuth';
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { LogOut, Users, BarChart3, Gavel, User } from "lucide-react";
import { JuryStudentList } from "@/components/jury/JuryStudentList";
import { JuryDashboardStats } from "@/components/jury/JuryDashboardStats";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const JuryDashboard = () => {
  const { user, profile, signOut } = useAuth();
  const [assessmentStats, setAssessmentStats] = useState({
    totalStudents: 0,
    assessedStudents: 0
  });

  useEffect(() => {
    if (user) {
      fetchAssessmentStats();
    }
  }, [user]);

  const fetchAssessmentStats = async () => {
    try {
      const { data: students, error: studentsError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_type', 'student');

      if (studentsError) throw studentsError;

      const { data: assessments, error: assessmentsError } = await supabase
        .from('assessments')
        .select('id')
        .eq('jury_id', user?.id)
        .eq('status', 'submitted');

      if (assessmentsError) throw assessmentsError;

      setAssessmentStats({
        totalStudents: students?.length || 0,
        assessedStudents: assessments?.length || 0
      });
    } catch (error) {
      console.error('Error fetching assessment stats:', error);
    }
  };

  const progressPercentage = assessmentStats.totalStudents > 0 
    ? Math.round((assessmentStats.assessedStudents / assessmentStats.totalStudents) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50">
      <nav className="p-4 flex justify-between items-center bg-white/20 backdrop-blur-sm border-b border-white/30">
        <div className="flex items-center space-x-4">
          <Gavel className="w-8 h-8 text-purple-600" />
          <div>
            <h1 className="text-xl font-bold text-slate-800">Jury Portal</h1>
            <p className="text-sm text-slate-600">Young Indians Parliament</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          {profile && (
            <div className="text-right">
              <p className="font-semibold text-slate-800">{profile.name}</p>
              <p className="text-sm text-slate-600">{profile.position}</p>
            </div>
          )}
          <Button 
            onClick={signOut}
            variant="outline"
            className="bg-white/20 backdrop-blur-sm border-white/30 text-slate-800 hover:bg-white/30"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </nav>

      <div className="p-6 bg-white/30 backdrop-blur-sm border-b border-white/30">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-800">Assessment Progress</h2>
              <p className="text-slate-600">Track your evaluation progress across all students</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-purple-600">
                {assessmentStats.assessedStudents} / {assessmentStats.totalStudents}
              </div>
              <p className="text-sm text-slate-600">Students Assessed</p>
            </div>
          </div>
          <Progress value={progressPercentage} className="h-3" />
          <p className="text-sm text-slate-600 mt-2">
            {progressPercentage}% Complete • {assessmentStats.totalStudents - assessmentStats.assessedStudents} Remaining
          </p>
        </div>
      </div>

      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          <Tabs defaultValue="assess" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-8">
              <TabsTrigger value="assess" className="flex items-center space-x-2">
                <Users className="w-4 h-4" />
                <span>Assess Students</span>
              </TabsTrigger>
              <TabsTrigger value="dashboard" className="flex items-center space-x-2">
                <BarChart3 className="w-4 h-4" />
                <span>Dashboard</span>
              </TabsTrigger>
              <TabsTrigger value="profile" className="flex items-center space-x-2">
                <User className="w-4 h-4" />
                <span>My Profile</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="assess">
              {user && <JuryStudentList juryId={user.id} />}
            </TabsContent>

            <TabsContent value="dashboard">
              {user && <JuryDashboardStats juryId={user.id} />}
            </TabsContent>

            <TabsContent value="profile">
              <div className="bg-white/30 backdrop-blur-sm rounded-2xl p-6 border border-white/40 shadow-lg max-w-2xl mx-auto">
                <h3 className="text-xl font-bold text-slate-800 mb-6">Jury Profile</h3>
                {profile && (
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-slate-600">Name:</p>
                      <p className="font-semibold text-slate-800">{profile.name}</p>
                    </div>
                    <div>
                      <p className="text-slate-600">Position:</p>
                      <p className="font-semibold text-slate-800">{profile.position}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-slate-600">Assessment Progress:</p>
                      <p className="font-semibold text-slate-800">
                        {assessmentStats.assessedStudents} of {assessmentStats.totalStudents} students assessed ({progressPercentage}%)
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default JuryDashboard;