import { useAuth } from '@/hooks/useAuth';
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { LogOut, Users, BarChart3, Gavel, User, Activity, ClipboardCheck, Target, CheckCircle, Trophy } from "lucide-react";
import { JuryStudentList } from "@/components/jury/JuryStudentList";
import { JuryDashboardStats } from "@/components/jury/JuryDashboardStats";
import { JuryLeaderboard } from "@/components/jury/JuryLeaderboard";
import { ProfilePhotoUploader } from "@/components/jury/ProfilePhotoUploader";
import { JuryProfileEditor } from "@/components/jury/JuryProfileEditor";
import { BreakingNewsTicker } from "@/components/display/BreakingNewsTicker";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const JuryDashboard = () => {
  const { user, profile, signOut } = useAuth();
  const [assessmentStats, setAssessmentStats] = useState({
    totalStudents: 0,
    assessedStudents: 0
  });
  const [isRealTimeConnected, setIsRealTimeConnected] = useState(false);

  useEffect(() => {
    if (user) {
      fetchAssessmentStats();
      
      // Set up real-time subscription for assessments
      const channel = supabase
        .channel('jury-assessment-updates')
        .on(
          'postgres_changes',
          {
            event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
            schema: 'public',
            table: 'assessments',
            filter: `jury_id=eq.${user.id}` // Only listen to this jury's assessments
          },
          (payload) => {
            console.log('Assessment update received:', payload);
            // Refresh stats when any assessment changes
            fetchAssessmentStats();
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            setIsRealTimeConnected(true);
          }
        });

      // Also listen to profile changes for student count updates
      const profileChannel = supabase
        .channel('jury-student-updates')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'profiles',
            filter: `user_type=eq.student`
          },
          (payload) => {
            console.log('Student profile update received:', payload);
            // Refresh stats when student profiles change
            fetchAssessmentStats();
          }
        )
        .subscribe();

      // Cleanup subscriptions on unmount
      return () => {
        supabase.removeChannel(channel);
        supabase.removeChannel(profileChannel);
      };
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
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50 relative overflow-hidden">
      <BreakingNewsTicker />
      {/* Enhanced animated background matching other dashboards */}
      <div className="absolute inset-0">
        {/* Enhanced dot pattern */}
        <div className="absolute top-0 left-0 w-full h-full opacity-40">
          <div className="absolute inset-0 bg-white/8" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.08'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            backgroundSize: '60px 60px'
          }}></div>
        </div>
        
        {/* Flowing gradient orbs */}
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-gradient-to-br from-purple-500/30 to-purple-300/20 rounded-full blur-2xl animate-pulse"></div>
        <div className="absolute top-1/2 -right-40 w-[28rem] h-[28rem] bg-gradient-to-bl from-indigo-500/25 to-indigo-300/15 rounded-full blur-2xl animate-pulse delay-1000"></div>
        <div className="absolute bottom-0 left-1/2 w-80 h-80 bg-gradient-to-t from-violet-500/30 to-violet-300/15 rounded-full blur-2xl animate-pulse delay-500"></div>
        
        {/* Floating bubbles */}
        <div className="absolute top-1/4 left-1/4 w-6 h-6 bg-purple-400/30 rounded-full animate-bounce shadow-lg shadow-purple-400/20" style={{animationDelay: '0s', animationDuration: '3s'}}></div>
        <div className="absolute top-3/4 left-1/3 w-8 h-8 bg-indigo-400/25 rounded-full animate-bounce shadow-lg shadow-indigo-400/20" style={{animationDelay: '1s', animationDuration: '4s'}}></div>
        <div className="absolute top-1/2 right-1/4 w-5 h-5 bg-violet-400/35 rounded-full animate-bounce shadow-lg shadow-violet-400/20" style={{animationDelay: '2s', animationDuration: '3.5s'}}></div>
      </div>

      {/* Navigation with enhanced glass morphism */}
      <nav className="relative z-10 p-4 sm:p-6 flex flex-col sm:flex-row justify-between items-center gap-4 bg-white/15 backdrop-blur-lg border-b border-white/25 shadow-xl">
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="relative">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/30">
              <Gavel className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
            </div>
            <div className="absolute -top-1 -right-1 w-3 h-3 sm:w-4 sm:h-4 bg-purple-400/40 rounded-full animate-bounce"></div>
          </div>
          <div className="text-center sm:text-left">
            <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">Jury Portal</h1>
            <p className="text-sm sm:text-lg font-semibold text-slate-600">Young Indians Parliament</p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
          {profile && (
            <div className="text-center sm:text-right bg-white/20 backdrop-blur-sm rounded-2xl p-3 sm:p-4 border border-white/30 order-2 sm:order-1">
              <p className="font-bold text-slate-800 text-base sm:text-lg">{profile.name}</p>
              <p className="text-xs sm:text-sm text-slate-600 font-medium">{profile.position}</p>
            </div>
          )}
          <Button 
            onClick={signOut}
            variant="outline"
            className="bg-white/20 backdrop-blur-sm border-white/30 text-slate-800 hover:bg-white/35 hover:scale-105 transition-all duration-300 shadow-lg px-4 sm:px-6 py-2 sm:py-3 text-base sm:text-lg font-semibold order-1 sm:order-2"
          >
            <LogOut className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
            Sign Out
          </Button>
        </div>
      </nav>

      {/* Enhanced Progress Section */}
      <div className="relative z-10 p-6 sm:p-8 bg-white/20 backdrop-blur-lg border-b border-white/25">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white/15 backdrop-blur-lg rounded-3xl p-6 sm:p-8 border border-white/25 shadow-xl">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-6 mb-6">
              <div className="text-center lg:text-left">
                <div className="relative inline-block mb-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-3xl flex items-center justify-center mx-auto lg:mx-0 shadow-lg shadow-purple-500/30">
                    <Target className="w-8 h-8 text-white" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-purple-400/40 rounded-full animate-bounce"></div>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <h2 className="text-2xl sm:text-3xl font-black text-slate-800">Assessment Progress</h2>
                  {isRealTimeConnected && (
                    <div className="flex items-center gap-1 bg-green-100/80 backdrop-blur-sm rounded-full px-3 py-1 border border-green-200/50">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-xs font-bold text-green-800">LIVE</span>
                    </div>
                  )}
                </div>
                <p className="text-slate-600 font-semibold text-lg">Track your evaluation progress across all students</p>
              </div>
              <div className="text-center bg-white/20 backdrop-blur-sm rounded-2xl p-6 border border-white/30">
                <div className="text-4xl sm:text-5xl font-black text-transparent bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text mb-2">
                  {assessmentStats.assessedStudents} / {assessmentStats.totalStudents}
                </div>
                <p className="text-slate-600 font-semibold">Students Assessed</p>
              </div>
            </div>
            <div className="space-y-4">
              <Progress value={progressPercentage} className="h-4 bg-white/20" />
              <div className="flex justify-between items-center text-sm font-semibold">
                <span className="text-slate-600">{progressPercentage}% Complete</span>
                <span className="text-slate-600">{assessmentStats.totalStudents - assessmentStats.assessedStudents} Remaining</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard Content */}
      <div className="relative z-10 p-8 pt-16">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 sm:mb-20">
            <div className="relative inline-block mb-10 sm:mb-14">
              <h2 className="text-3xl sm:text-4xl md:text-6xl font-black text-transparent bg-gradient-to-r from-purple-600 via-slate-800 to-indigo-600 bg-clip-text tracking-tight drop-shadow-lg">
                Jury Assessment Center
              </h2>
              <div className="absolute -top-2 right-8 w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-br from-purple-400/30 to-indigo-400/20 rounded-full animate-bounce shadow-lg"></div>
            </div>
            <div className="bg-white/20 backdrop-blur-lg rounded-2xl sm:rounded-3xl border border-white/25 p-4 sm:p-6 shadow-xl max-w-xl sm:max-w-2xl mx-auto">
              <p className="text-base sm:text-xl text-slate-700 font-semibold">
                Evaluate and assess <span className="font-black text-transparent bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text">student performances</span> in the Young Indians Parliament
              </p>
            </div>
          </div>

          <Tabs defaultValue="assess" className="w-full">
            <TabsList className="grid w-full grid-cols-4 gap-2 mb-12 bg-white/15 backdrop-blur-lg border border-white/25 p-3 rounded-3xl shadow-xl h-auto">
              <TabsTrigger 
                value="assess" 
                className="flex flex-col items-center justify-center gap-2 px-4 py-6 rounded-2xl text-sm lg:text-base font-semibold transition-all duration-300 data-[state=active]:bg-white/30 data-[state=active]:shadow-lg hover:scale-105 min-h-[80px]"
              >
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0">
                  <ClipboardCheck className="w-4 h-4 text-white" />
                </div>
                <span className="text-center">Assess Students</span>
              </TabsTrigger>
              <TabsTrigger 
                value="dashboard" 
                className="flex flex-col items-center justify-center gap-2 px-4 py-6 rounded-2xl text-sm lg:text-base font-semibold transition-all duration-300 data-[state=active]:bg-white/30 data-[state=active]:shadow-lg hover:scale-105 min-h-[80px]"
              >
                <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-teal-500 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0">
                  <BarChart3 className="w-4 h-4 text-white" />
                </div>
                <span className="text-center">Dashboard</span>
              </TabsTrigger>
              <TabsTrigger 
                value="leaderboard" 
                className="flex flex-col items-center justify-center gap-2 px-4 py-6 rounded-2xl text-sm lg:text-base font-semibold transition-all duration-300 data-[state=active]:bg-white/30 data-[state=active]:shadow-lg hover:scale-105 min-h-[80px]"
              >
                <div className="w-8 h-8 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0">
                  <Trophy className="w-4 h-4 text-white" />
                </div>
                <span className="text-center">Leaderboard</span>
              </TabsTrigger>
              <TabsTrigger 
                value="profile" 
                className="flex flex-col items-center justify-center gap-2 px-4 py-6 rounded-2xl text-sm lg:text-base font-semibold transition-all duration-300 data-[state=active]:bg-white/30 data-[state=active]:shadow-lg hover:scale-105 min-h-[80px]"
              >
                <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0">
                  <User className="w-4 h-4 text-white" />
                </div>
                <span className="text-center">My Profile</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="assess" className="space-y-6">
              <div className="bg-white/15 backdrop-blur-lg rounded-3xl p-8 border border-white/25 shadow-xl">
                <div className="text-center mb-8">
                  <div className="relative inline-block mb-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-3xl flex items-center justify-center mx-auto shadow-lg shadow-blue-500/30">
                      <Users className="w-8 h-8 text-white" />
                    </div>
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-400/40 rounded-full animate-bounce"></div>
                  </div>
                  <h3 className="text-2xl font-black text-slate-800 mb-2">Student Assessment</h3>
                  <p className="text-slate-600 font-medium">Evaluate student performances and provide detailed feedback</p>
                </div>
                {user && <JuryStudentList juryId={user.id} />}
              </div>
            </TabsContent>

            <TabsContent value="dashboard" className="space-y-6">
              <div className="bg-white/15 backdrop-blur-lg rounded-3xl p-8 border border-white/25 shadow-xl">
                <div className="text-center mb-8">
                  <div className="relative inline-block mb-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-teal-500 rounded-3xl flex items-center justify-center mx-auto shadow-lg shadow-green-500/30">
                      <Activity className="w-8 h-8 text-white" />
                    </div>
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-400/40 rounded-full animate-bounce"></div>
                  </div>
                  <h3 className="text-2xl font-black text-slate-800 mb-2">Assessment Analytics</h3>
                  <p className="text-slate-600 font-medium">View comprehensive statistics and progress reports</p>
                </div>
                {user && <JuryDashboardStats juryId={user.id} />}
              </div>
            </TabsContent>

            <TabsContent value="leaderboard" className="space-y-6">
              <div className="bg-white/15 backdrop-blur-lg rounded-3xl p-8 border border-white/25 shadow-xl">
                <div className="text-center mb-8">
                  <div className="relative inline-block mb-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-3xl flex items-center justify-center mx-auto shadow-lg shadow-yellow-500/30">
                      <Trophy className="w-8 h-8 text-white" />
                    </div>
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400/40 rounded-full animate-bounce"></div>
                  </div>
                  <h3 className="text-2xl font-black text-slate-800 mb-2">Jury Leaderboard</h3>
                  <p className="text-slate-600 font-medium">View averaged scores and vote for awards</p>
                </div>
                {user && <JuryLeaderboard juryId={user.id} />}
              </div>
            </TabsContent>

            <TabsContent value="profile" className="space-y-6">
              <div className="bg-white/15 backdrop-blur-lg rounded-3xl p-8 border border-white/25 shadow-xl max-w-5xl mx-auto">
                <div className="text-center mb-8">
                  <div className="relative inline-block mb-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-pink-500 rounded-3xl flex items-center justify-center mx-auto shadow-lg shadow-red-500/30">
                      <User className="w-8 h-8 text-white" />
                    </div>
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-400/40 rounded-full animate-bounce"></div>
                  </div>
                  <h3 className="text-2xl font-black text-slate-800 mb-2">Jury Profile</h3>
                  <p className="text-slate-600 font-medium">Your information and assessment progress overview</p>
                </div>
                <div className="flex justify-center mb-4">
                  <JuryProfileEditor />
                </div>
                {profile && (
                  <div className="bg-white/20 backdrop-blur-lg rounded-3xl border border-white/25 shadow-xl overflow-hidden">
                    <div className="flex flex-col lg:flex-row min-h-[400px]">
                      {/* Left side - Profile Image/Avatar */}
                      <div className="lg:w-1/2 relative">
                        {profile.photo_url ? (
                          <img 
                            src={profile.photo_url && profile.photo_url.includes('/file/d/') 
                              ? `https://drive.google.com/uc?export=view&id=${profile.photo_url.split('/d/')[1]?.split('/')[0]}` 
                              : profile.photo_url}
                            alt={`${profile.name} profile photo`}
                            className="w-full h-full object-cover"
                            loading="lazy"
                            decoding="async"
                            referrerPolicy="no-referrer"
                            onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/images/mahatma-logo.png'; }}
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center">
                            <span className="text-6xl font-black text-white">
                              {profile.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                            </span>
                          </div>
                        )}
                        <div className="absolute bottom-4 right-4">
                          <ProfilePhotoUploader />
                        </div>
                      </div>

                      {/* Right side - Profile Details */}
                      <div className="lg:w-1/2 p-8 flex flex-col justify-center space-y-6">
                        <header className="space-y-4">
                          <h4 className="text-4xl font-black text-slate-800 leading-tight">
                            {profile.name}
                          </h4>
                          <div className="inline-block px-6 py-3 text-lg font-bold bg-purple-100 text-purple-800 border-none rounded-xl">
                            {profile.position}
                          </div>
                        </header>

                        <div className="space-y-6">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-white/30 backdrop-blur-sm rounded-xl flex items-center justify-center flex-shrink-0">
                              <Users className="w-6 h-6 text-slate-600" />
                            </div>
                            <div className="space-y-1">
                              <p className="text-base font-bold text-slate-600">Role</p>
                              <p className="text-2xl font-black text-slate-800">Jury Member</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-white/30 backdrop-blur-sm rounded-xl flex items-center justify-center flex-shrink-0">
                              <CheckCircle className="w-6 h-6 text-slate-600" />
                            </div>
                            <div className="space-y-1">
                              <p className="text-base font-bold text-slate-600">Students Assessed</p>
                              <p className="text-2xl font-black text-slate-800">
                                {assessmentStats.assessedStudents} of {assessmentStats.totalStudents}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-white/30 backdrop-blur-sm rounded-xl flex items-center justify-center flex-shrink-0">
                              <Target className="w-6 h-6 text-slate-600" />
                            </div>
                            <div className="space-y-1">
                              <p className="text-base font-bold text-slate-600">Completion Rate</p>
                              <p className="text-2xl font-black text-slate-800">{progressPercentage}%</p>
                            </div>
                          </div>
                        </div>
                      </div>
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