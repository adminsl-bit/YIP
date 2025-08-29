import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { LogOut, Settings, Clock, BarChart3, Users, ShieldCheck, FileText, Eye, GraduationCap, Activity, Zap, Image as ImageIcon, AlertTriangle, Trophy, Award, Presentation } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { FeatureToggles } from "@/components/organizer/FeatureToggles";
import { TimerControl } from "@/components/organizer/TimerControl";
import { PollManagement } from "@/components/organizer/PollManagement";
import { SecurityLogsManager } from "@/components/organizer/SecurityLogsManager";
import { OrganizerStats } from "@/components/organizer/OrganizerStats";
import { OrganizerStudentList } from "@/components/organizer/OrganizerStudentList";
import { StudentBulkImport } from "@/components/organizer/StudentBulkImport";
import PhotoUploadManager from "@/components/organizer/PhotoUploadManager";
import PhotoMigration from "@/components/organizer/PhotoMigration";
import { OrganizerLeaderboard } from "@/components/organizer/OrganizerLeaderboard";
import { AwardManagement } from "@/components/organizer/AwardManagement";

const OrganizerDashboard = () => {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const resetAllAssessments = async () => {
    if (!confirm('Are you sure you want to reset ALL assessments for ALL juries? This will clear all scores and notes.')) {
      return;
    }
    
    try {
      // First get all assessment IDs to ensure we have a proper WHERE clause
      const { data: allAssessments, error: fetchError } = await supabase
        .from('assessments')
        .select('id');

      if (fetchError) throw fetchError;

      if (!allAssessments || allAssessments.length === 0) {
        alert('No assessments found to reset.');
        return;
      }

      // Now update with a proper WHERE clause
      const { error } = await supabase
        .from('assessments')
        .update({
          status: 'draft',
          total_score: 0,
          scores: {},
          submitted_at: null,
          notes: null,
        })
        .in('id', allAssessments.map(a => a.id));

      if (error) throw error;

      alert(`${allAssessments.length} assessments have been reset successfully.`);
    } catch (error) {
      console.error('Error resetting assessments:', error);
      alert('Failed to reset assessments. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-orange-50 relative overflow-hidden">
      {/* Enhanced animated background matching student dashboard */}
      <div className="absolute inset-0">
        {/* Enhanced dot pattern */}
        <div className="absolute top-0 left-0 w-full h-full opacity-40">
          <div className="absolute inset-0 bg-white/8" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.08'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            backgroundSize: '60px 60px'
          }}></div>
        </div>
        
        {/* Flowing gradient orbs */}
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-gradient-to-br from-orange-500/30 to-orange-300/20 rounded-full blur-2xl animate-pulse"></div>
        <div className="absolute top-1/2 -right-40 w-[28rem] h-[28rem] bg-gradient-to-bl from-green-500/25 to-green-300/15 rounded-full blur-2xl animate-pulse delay-1000"></div>
        <div className="absolute bottom-0 left-1/2 w-80 h-80 bg-gradient-to-t from-blue-500/30 to-blue-300/15 rounded-full blur-2xl animate-pulse delay-500"></div>
        
        {/* Floating bubbles */}
        <div className="absolute top-1/4 left-1/4 w-6 h-6 bg-orange-400/30 rounded-full animate-bounce shadow-lg shadow-orange-400/20" style={{animationDelay: '0s', animationDuration: '3s'}}></div>
        <div className="absolute top-3/4 left-1/3 w-8 h-8 bg-green-400/25 rounded-full animate-bounce shadow-lg shadow-green-400/20" style={{animationDelay: '1s', animationDuration: '4s'}}></div>
        <div className="absolute top-1/2 right-1/4 w-5 h-5 bg-blue-400/35 rounded-full animate-bounce shadow-lg shadow-blue-400/20" style={{animationDelay: '2s', animationDuration: '3.5s'}}></div>
      </div>

      {/* Navigation with enhanced glass morphism */}
      <nav className="relative z-10 p-4 sm:p-6 flex flex-col sm:flex-row justify-between items-center gap-4 bg-white/15 backdrop-blur-lg border-b border-white/25 shadow-xl">
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="relative">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <ShieldCheck className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
            </div>
            <div className="absolute -top-1 -right-1 w-3 h-3 sm:w-4 sm:h-4 bg-emerald-400/40 rounded-full animate-bounce"></div>
          </div>
          <div className="text-center sm:text-left">
            <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">Organizer Console</h1>
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

      {/* Dashboard Content */}
      <div className="relative z-10 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8 sm:mb-12">
            <div className="relative inline-block mb-6 sm:mb-8">
              <h2 className="text-3xl sm:text-4xl md:text-6xl font-black text-transparent bg-gradient-to-r from-emerald-600 via-slate-800 to-teal-600 bg-clip-text tracking-tight drop-shadow-lg">
                Parliament Control Center
              </h2>
              <div className="absolute -top-2 right-8 w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-br from-emerald-400/30 to-teal-400/20 rounded-full animate-bounce shadow-lg"></div>
            </div>
            <div className="bg-white/20 backdrop-blur-lg rounded-2xl sm:rounded-3xl border border-white/25 p-4 sm:p-6 shadow-xl max-w-xl sm:max-w-2xl mx-auto">
              <p className="text-base sm:text-xl text-slate-700 font-semibold">
                Manage all aspects of the <span className="font-black text-transparent bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text">Young Indians Parliament</span> session from this central console
              </p>
            </div>
          </div>

          <Tabs defaultValue="controls" className="w-full">
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 mb-12 bg-white/15 backdrop-blur-lg border border-white/25 p-3 rounded-3xl shadow-xl h-auto">
              <TabsTrigger 
                value="controls" 
                className="flex flex-col items-center justify-center gap-2 px-4 py-6 rounded-2xl text-sm lg:text-base font-semibold transition-all duration-300 data-[state=active]:bg-white/30 data-[state=active]:shadow-lg hover:scale-105 min-h-[80px]"
              >
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0">
                  <Settings className="w-4 h-4 text-white" />
                </div>
                <span className="text-center">Controls</span>
              </TabsTrigger>
              <TabsTrigger 
                value="timer" 
                className="flex flex-col items-center justify-center gap-2 px-4 py-6 rounded-2xl text-sm lg:text-base font-semibold transition-all duration-300 data-[state=active]:bg-white/30 data-[state=active]:shadow-lg hover:scale-105 min-h-[80px]"
              >
                <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-teal-500 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0">
                  <Clock className="w-4 h-4 text-white" />
                </div>
                <span className="text-center">Timer</span>
              </TabsTrigger>
              <TabsTrigger 
                value="polls" 
                className="flex flex-col items-center justify-center gap-2 px-4 py-6 rounded-2xl text-sm lg:text-base font-semibold transition-all duration-300 data-[state=active]:bg-white/30 data-[state=active]:shadow-lg hover:scale-105 min-h-[80px]"
              >
                <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0">
                  <BarChart3 className="w-4 h-4 text-white" />
                </div>
                <span className="text-center">Polls</span>
              </TabsTrigger>
              <TabsTrigger 
                value="students" 
                className="flex flex-col items-center justify-center gap-2 px-4 py-6 rounded-2xl text-sm lg:text-base font-semibold transition-all duration-300 data-[state=active]:bg-white/30 data-[state=active]:shadow-lg hover:scale-105 min-h-[80px]"
              >
                <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0">
                  <Users className="w-4 h-4 text-white" />
                </div>
                <span className="text-center">Students</span>
              </TabsTrigger>
              <TabsTrigger 
                value="security" 
                className="flex flex-col items-center justify-center gap-2 px-4 py-6 rounded-2xl text-sm lg:text-base font-semibold transition-all duration-300 data-[state=active]:bg-white/30 data-[state=active]:shadow-lg hover:scale-105 min-h-[80px]"
              >
                <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0">
                  <ShieldCheck className="w-4 h-4 text-white" />
                </div>
                <span className="text-center">Security</span>
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
                value="awards" 
                className="flex flex-col items-center justify-center gap-2 px-4 py-6 rounded-2xl text-sm lg:text-base font-semibold transition-all duration-300 data-[state=active]:bg-white/30 data-[state=active]:shadow-lg hover:scale-105 min-h-[80px]"
              >
                <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-yellow-500 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0">
                  <Award className="w-4 h-4 text-white" />
                </div>
                <span className="text-center">Awards</span>
              </TabsTrigger>
              <TabsTrigger 
                value="photos" 
                className="flex flex-col items-center justify-center gap-2 px-4 py-6 rounded-2xl text-sm lg:text-base font-semibold transition-all duration-300 data-[state=active]:bg-white/30 data-[state=active]:shadow-lg hover:scale-105 min-h-[80px]"
              >
                <div className="w-8 h-8 bg-gradient-to-br from-pink-500 to-rose-500 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0">
                  <ImageIcon className="w-4 h-4 text-white" />
                </div>
                <span className="text-center">Photos</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="controls" className="space-y-6">
              <div className="bg-white/15 backdrop-blur-lg rounded-3xl p-8 border border-white/25 shadow-xl">
                <FeatureToggles />
              </div>
              
              {/* Assessment Reset Controls */}
              <div className="bg-white/15 backdrop-blur-lg rounded-3xl p-8 border border-white/25 shadow-xl">
                <div className="text-center mb-6">
                  <div className="relative inline-block mb-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-pink-500 rounded-3xl flex items-center justify-center mx-auto shadow-lg shadow-red-500/30">
                      <AlertTriangle className="w-8 h-8 text-white" />
                    </div>
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-400/40 rounded-full animate-bounce"></div>
                  </div>
                  <h3 className="text-2xl font-black text-slate-800 mb-2">Assessment Controls</h3>
                  <p className="text-slate-600 font-medium">Manage assessment data and progress</p>
                </div>
                
                <div className="flex justify-center">
                  <Button 
                    onClick={resetAllAssessments}
                    className="bg-red-500/20 hover:bg-red-500/30 border-red-500/30 text-red-700 font-semibold px-6 py-3"
                    variant="outline"
                  >
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    Reset All Assessments
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="timer" className="space-y-6">
              <div className="bg-white/15 backdrop-blur-lg rounded-3xl p-8 border border-white/25 shadow-xl">
                <TimerControl />
              </div>
            </TabsContent>

            <TabsContent value="polls" className="space-y-6">
              <div className="bg-white/15 backdrop-blur-lg rounded-3xl p-8 border border-white/25 shadow-xl">
                <PollManagement />
              </div>
            </TabsContent>

            <TabsContent value="students" className="space-y-6">
              {/* Student Overview - Full Width at Top */}
              <div className="bg-white/15 backdrop-blur-lg rounded-3xl p-8 border border-white/25 shadow-xl">
                <div className="text-center mb-8">
                  <div className="relative inline-block mb-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-3xl flex items-center justify-center mx-auto shadow-lg shadow-orange-500/30">
                      <Activity className="w-8 h-8 text-white" />
                    </div>
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-orange-400/40 rounded-full animate-bounce"></div>
                  </div>
                  <h3 className="text-2xl font-black text-slate-800 mb-2">Student Overview</h3>
                  <p className="text-slate-600 font-medium">Performance and assessment statistics</p>
                </div>
                <OrganizerStats />
              </div>
              
              {/* Student Management - Full Width with Scrollable Content */}
              <div className="bg-white/15 backdrop-blur-lg rounded-3xl p-8 border border-white/25 shadow-xl">
                <div className="text-center mb-8">
                  <div className="relative inline-block mb-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-3xl flex items-center justify-center mx-auto shadow-lg shadow-blue-500/30">
                      <Users className="w-8 h-8 text-white" />
                    </div>
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-400/40 rounded-full animate-bounce"></div>
                  </div>
                  <h3 className="text-2xl font-black text-slate-800 mb-2">Student Management</h3>
                  <p className="text-slate-600 font-medium">View and manage student profiles</p>
                </div>
                <OrganizerStudentList />
              </div>

              {/* Bulk Import as Accordion at Bottom */}
              <div className="bg-white/15 backdrop-blur-lg rounded-3xl p-8 border border-white/25 shadow-xl">
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="bulk-import" className="border-none">
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
                          <GraduationCap className="w-6 h-6 text-white" />
                        </div>
                        <div className="text-left">
                          <h3 className="text-xl font-black text-slate-800">Bulk Student Import</h3>
                          <p className="text-slate-600 font-medium text-sm">Import students from Excel with photos</p>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-6">
                      <StudentBulkImport />
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            </TabsContent>

            <TabsContent value="security" className="space-y-6">
              <div className="bg-white/15 backdrop-blur-lg rounded-3xl p-8 border border-white/25 shadow-xl">
                <SecurityLogsManager />
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
                  <h3 className="text-2xl font-black text-slate-800 mb-2">Overall Leaderboard</h3>
                  <p className="text-slate-600 font-medium">Monitor rankings, scores, and award consensus</p>
                </div>
                <OrganizerLeaderboard />
              </div>
            </TabsContent>

            <TabsContent value="awards" className="space-y-6">
              <div className="bg-white/15 backdrop-blur-lg rounded-3xl p-8 border border-white/25 shadow-xl">
                <div className="text-center mb-8">
                  <div className="relative inline-block mb-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-yellow-500 rounded-3xl flex items-center justify-center mx-auto shadow-lg shadow-amber-500/30">
                      <Award className="w-8 h-8 text-white" />
                    </div>
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400/40 rounded-full animate-bounce"></div>
                  </div>
                  <h3 className="text-2xl font-black text-slate-800 mb-2">Award Management</h3>
                  <p className="text-slate-600 font-medium">Create and assign awards to outstanding candidates</p>
                </div>
                <div className="flex justify-center mb-6">
                  <Button 
                    onClick={() => navigate('/display/awards')}
                    className="bg-gradient-to-r from-yellow-500 to-orange-600 text-white hover:from-yellow-600 hover:to-orange-700 font-semibold px-6 py-3 shadow-lg hover:shadow-xl transition-all duration-300"
                  >
                    <Presentation className="w-5 h-5 mr-2" />
                    Launch Award Showcase
                  </Button>
                </div>
                <AwardManagement />
              </div>
            </TabsContent>

            <TabsContent value="photos" className="space-y-6">
              {/* Photo Upload Manager */}
              <div className="bg-white/15 backdrop-blur-lg rounded-3xl p-8 border border-white/25 shadow-xl">
                <div className="text-center mb-8">
                  <div className="relative inline-block mb-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-pink-500 to-rose-500 rounded-3xl flex items-center justify-center mx-auto shadow-lg shadow-pink-500/30">
                      <ImageIcon className="w-8 h-8 text-white" />
                    </div>
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-pink-400/40 rounded-full animate-bounce"></div>
                  </div>
                  <h3 className="text-2xl font-black text-slate-800 mb-2">Photo Management</h3>
                  <p className="text-slate-600 font-medium">Upload and manage student photos</p>
                </div>
                <PhotoUploadManager />
              </div>

              {/* Photo Migration as Accordion */}
              <div className="bg-white/15 backdrop-blur-lg rounded-3xl p-8 border border-white/25 shadow-xl">
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="photo-migration" className="border-none">
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/30">
                          <Zap className="w-6 h-6 text-white" />
                        </div>
                        <div className="text-left">
                          <h3 className="text-xl font-black text-slate-800">Photo Migration</h3>
                          <p className="text-slate-600 font-medium text-sm">Migrate photos from Google Drive to Supabase Storage</p>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-6">
                      <PhotoMigration />
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default OrganizerDashboard;