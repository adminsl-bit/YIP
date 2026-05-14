import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  LogOut, Settings, Clock, BarChart3, Users, ShieldCheck, 
  GraduationCap, AlertTriangle, Trophy, Award, Presentation, Mic, 
  Newspaper, FileEdit, Calendar, Plus, Info, Gavel, CheckCircle2, Zap
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { FeatureToggles } from "@/components/organizer/FeatureToggles";
import { TimerManagement } from "@/components/organizer/TimerManagement";
import { SessionManagement } from "@/components/organizer/SessionManagement";
import { PollManagement } from "@/components/organizer/PollManagement";
import { SecurityLogsManager } from "@/components/organizer/SecurityLogsManager";
import { OrganizerStats } from "@/components/organizer/OrganizerStats";
import { OrganizerStudentList } from "@/components/organizer/OrganizerStudentList";
import { StudentBulkImport } from "@/components/organizer/StudentBulkImport";
import { DynamicRoleCreator } from "@/components/organizer/DynamicRoleCreator";
import PhotoUploadManager from "@/components/organizer/PhotoUploadManager";
import PhotoMigration from "@/components/organizer/PhotoMigration";
import { OrganizerLeaderboard } from "@/components/organizer/OrganizerLeaderboard";
import { AwardManagement } from "@/components/organizer/AwardManagement";
import { AdminSpeechTracker } from "@/components/organizer/AdminSpeechTracker";
import { BreakingNewsPublisher } from "@/components/journalist/BreakingNewsPublisher";
import { ManualScoring } from "@/components/organizer/ManualScoring";
import { TimerTicker } from "@/components/organizer/TimerTicker";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { GlobalSquare } from "@/components/student/GlobalSquare";

interface DashboardStats {
  totalStudents: number;
  totalJury: number;
  assessmentsCompleted: number;
  totalAssessments: number;
}

const OrganizerDashboard = () => {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("controls");
  const [stats, setStats] = useState<DashboardStats>({
    totalStudents: 0,
    totalJury: 0,
    assessmentsCompleted: 0,
    totalAssessments: 0
  });
  const [activeTimer, setActiveTimer] = useState<{ title: string; remaining_seconds: number; status: string } | null>(null);

  useEffect(() => {
    fetchStats();
    fetchActiveTimer();
    
    const timer = setInterval(() => {
        fetchStats();
        fetchActiveTimer();
    }, 10000); // 10s refresh for stats
    return () => clearInterval(timer);
  }, []);

  const fetchStats = async () => {
    try {
        const { data: profiles } = await supabase.from('profiles').select('user_type');
        const { data: assessments } = await supabase.from('assessments').select('status');
        
        if (profiles) {
          const students = profiles.filter(p => p.user_type === 'student').length;
          const jury = profiles.filter(p => p.user_type === 'jury').length;
          const completed = assessments?.filter(a => a.status === 'submitted').length || 0;
          
          setStats({
            totalStudents: students,
            totalJury: jury,
            assessmentsCompleted: completed,
            totalAssessments: Math.max(students * jury, 1)
          });
        }
    } catch (e) {
        console.error("Stats fetch error", e);
    }
  };

  const fetchActiveTimer = async () => {
    try {
        const { data } = await supabase
          .from('timer_sessions')
          .select('title, remaining_seconds, status, started_at')
          .eq('is_active', true)
          .limit(1)
          .maybeSingle();

        if (data && data.status === 'running' && data.started_at) {
          const elapsed = Math.max(0, Math.floor((Date.now() - Date.parse(data.started_at)) / 1000));
          setActiveTimer({
            title: data.title,
            status: data.status,
            remaining_seconds: Math.max(0, data.remaining_seconds - elapsed)
          });
        } else {
          setActiveTimer(data ? { title: data.title, remaining_seconds: data.remaining_seconds, status: data.status } : null);
        }
    } catch (e) {
        console.error("Timer fetch error", e);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const resetAllAssessments = async () => {
    try {
      const { data: allAssessments } = await supabase.from('assessments').select('id');
      if (!allAssessments || allAssessments.length === 0) return;

      await supabase.from('award_votes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('student_awards').delete().eq('assigned_by_jury_consensus', true);
      
      const { error } = await supabase
        .from('assessments')
        .update({ status: 'draft', total_score: 0, scores: {}, submitted_at: null, notes: null })
        .in('id', allAssessments.map(a => a.id));

      if (error) throw error;
      toast({ title: "Success", description: "All assessments have been reset." });
      fetchStats();
    } catch (error) {
      toast({ title: "Error", description: "Failed to reset.", variant: "destructive" });
    }
  };

  return (
    <div className="flex min-h-screen bg-[#f7f9fb] font-body text-[#191c1e] antialiased">
      <TimerTicker />
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex h-screen overflow-hidden">
        {/* SideNavBar - Persistent on Desktop */}
        <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-[#e0e3e5]/50 h-full overflow-y-auto">
          <div className="p-6 flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-[#13298f] rounded-xl flex items-center justify-center text-white shadow-lg shadow-[#13298f]/20">
              <span className="material-symbols-outlined text-2xl font-fill">account_balance</span>
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-[#13298f] leading-none font-headline tracking-tight">YI Parliament</h2>
              <p className="text-[8px] uppercase tracking-widest text-[#757684] font-bold mt-1">Organizer Hub</p>
            </div>
          </div>

          <TabsList className="flex-1 flex flex-col items-stretch bg-transparent h-auto px-4 space-y-1 mb-8">
            <NavTrigger value="controls" icon="dashboard_customize" label="Controls" />
            <NavTrigger value="timer" icon="timer" label="Timer" />
            <NavTrigger value="sessions" icon="event_seat" label="Sessions" />
            <NavTrigger value="polls" icon="how_to_vote" label="Ballot" />
            <NavTrigger value="square" icon="forum" label="Square" />
            <NavTrigger value="students" icon="group" label="Students" />
            <NavTrigger value="security" icon="security" label="Security" />
            <NavTrigger value="leaderboard" icon="leaderboard" label="Leaderboard" />
            <NavTrigger value="awards" icon="emoji_events" label="Awards" />
            <NavTrigger value="photos" icon="photo_library" label="Photos" />
            <NavTrigger value="speeches" icon="record_voice_over" label="Speeches" />
            <NavTrigger value="news" icon="campaign" label="Breaking News" />
            <NavTrigger value="manual-scoring" icon="edit_note" label="Manual Scoring" />
          </TabsList>

          <div className="px-6 py-8 mt-auto border-t border-slate-50">
            <button 
              onClick={signOut}
              className="w-full flex items-center justify-center gap-2 text-slate-400 hover:text-red-500 font-bold text-xs uppercase tracking-widest py-3 transition-all"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col h-full min-w-0 bg-[#f7f9fb]">
          {/* TopNavBar */}
          <header className="h-16 bg-white/70 backdrop-blur-xl border-b border-[#e0e3e5]/50 flex items-center justify-between px-8 z-30 shadow-sm sticky top-0">
            <div className="flex items-center gap-4">
              <span className="text-lg font-extrabold text-[#13298f] font-headline tracking-tighter uppercase">Organizer Portal</span>
            </div>

          </header>

          {/* Canvas */}
          <main className={`flex-1 transition-all duration-300 ${activeTab === 'square' ? 'p-0 overflow-hidden bg-white' : 'p-4 sm:p-8 lg:p-12 pb-32 overflow-y-auto'}`}>
            {/* Stats section follows immediately */}



            {/* Tab Contents */}
            <div className="animate-fade-in delay-100">
              <TabsContent value="controls" className="m-0 space-y-12">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                  {/* Left Column: Quick Actions & News Ticker */}
                  <div className="lg:col-span-2 space-y-10">
                    {/* Quick Access Modules Card */}
                    <div className="bg-[#f2f4f6] rounded-[2.5rem] p-10 border border-[#e0e3e5]/60 shadow-sm relative overflow-hidden group">
                       <div className="absolute top-0 right-0 p-8 opacity-5">
                          <span className="material-symbols-outlined text-9xl">apps</span>
                       </div>
                       <div className="flex items-center justify-between mb-10 relative z-10">
                          <div>
                            <h2 className="text-2xl font-black font-headline text-[#13298f]">Quick Access Modules</h2>
                            <p className="text-[#757684] text-xs font-bold mt-1 opacity-70 italic">Accelerate administrative legislative workflows</p>
                          </div>
                          <button className="text-[10px] font-black text-[#13298f] uppercase tracking-widest flex items-center gap-2 py-2 px-4 bg-white rounded-full shadow-sm hover:shadow-md transition-all">
                             Customize <span className="material-symbols-outlined text-sm">edit</span>
                          </button>
                       </div>
                       
                       <div className="grid grid-cols-2 md:grid-cols-3 gap-5 relative z-10">
                          <ModuleButton label="Manage Polls" icon="how_to_vote" onClick={() => setActiveTab('polls')} />
                          <ModuleButton label="Broadcast Alert" icon="campaign" onClick={() => setActiveTab('news')} />
                          <ModuleButton label="View Rosters" icon="list_alt" onClick={() => setActiveTab('students')} />
                          <ModuleButton label="Session Report" icon="summarize" isSecondary />
                          <ModuleButton label="Room Security" icon="lock" onClick={() => setActiveTab('security')} />
                          <ModuleButton label="All Tools" icon="more_horiz" isSecondary />
                       </div>
                    </div>



                    {/* Danger Zone (Kept but styled) */}
                    <div className="bg-[#ba1a1a]/5 border border-[#ba1a1a]/10 rounded-[2.5rem] p-10 flex flex-col sm:flex-row items-center justify-between gap-6">
                        <div className="flex items-center gap-6">
                           <div className="w-16 h-16 bg-[#ba1a1a]/10 rounded-2xl flex items-center justify-center text-[#ba1a1a] border border-[#ba1a1a]/20">
                              <AlertTriangle className="w-8 h-8" />
                           </div>
                           <div>
                              <h3 className="text-xl font-bold text-[#ba1a1a] font-headline">Legislative Recall</h3>
                              <p className="text-xs text-[#ba1a1a]/70 font-bold opacity-80 uppercase tracking-widest">Global Session Data Termination</p>
                           </div>
                        </div>
                        <AlertDialog>
                           <AlertDialogTrigger asChild>
                              <Button className="bg-[#ba1a1a] hover:bg-red-700 text-white font-black text-xs uppercase tracking-widest px-8 py-6 rounded-2xl shadow-xl shadow-red-900/20 active:scale-95 transition-all">
                                 Reset Database
                              </Button>
                           </AlertDialogTrigger>
                           <AlertDialogContent className="rounded-[2.5rem] p-10 border-none shadow-2xl">
                              <AlertDialogHeader>
                                 <AlertDialogTitle className="text-2xl font-black font-headline text-[#191c1e]">Confirm Data Erasure?</AlertDialogTitle>
                                 <AlertDialogDescription className="text-slate-500 font-bold mt-4 leading-relaxed font-body">
                                    All parliamentary records, votes, and assessment milestones will be permanently purged. This action is irreversible.
                                 </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter className="mt-8 gap-4">
                                 <AlertDialogCancel className="rounded-2xl px-6 font-black text-[10px] uppercase tracking-widest py-6 bg-slate-100 border-none">Abort</AlertDialogCancel>
                                 <AlertDialogAction onClick={resetAllAssessments} className="bg-[#ba1a1a] hover:bg-red-700 rounded-2xl px-8 font-black text-[10px] uppercase tracking-widest py-6 shadow-lg shadow-red-900/20">
                                    Confirm Recall
                                 </AlertDialogAction>
                              </AlertDialogFooter>
                           </AlertDialogContent>
                        </AlertDialog>
                    </div>
                  </div>

                  {/* Right Column: Feature Toggles & Mascot */}
                  <div className="space-y-8">
                     <div className="bg-[#e0e3e5] rounded-[3rem] p-10 border border-[#e0e3e5]/60 shadow-sm transition-all hover:shadow-md">
                        <h2 className="text-xl font-black font-headline text-[#13298f] mb-8 flex items-center gap-3">
                           <span className="material-symbols-outlined text-[#13298f] font-fill">toggle_on</span> 
                           Process Toggles
                        </h2>
                        <FeatureToggles />
                     </div>




                  </div>
                </div>
              </TabsContent>

              <TabsContent value="timer" className="m-0"><TimerManagement /></TabsContent>
              <TabsContent value="sessions" className="m-0"><SessionManagement /></TabsContent>
              <TabsContent value="polls" className="m-0"><PollManagement /></TabsContent>
              <TabsContent value="square" className="m-0 h-[calc(100vh-80px)] overflow-hidden border-none shadow-none"><GlobalSquare /></TabsContent>
              <TabsContent value="students" className="m-0 space-y-12">
                <div className="bg-white border border-[#e0e3e5]/60 rounded-[3rem] p-10 shadow-sm"><OrganizerStudentList /></div>
                <div className="bg-white border border-[#e0e3e5]/60 rounded-[3rem] p-10 shadow-sm">
                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="bulk" className="border-none">
                      <AccordionTrigger className="hover:no-underline py-0">
                        <div className="flex items-center gap-6">
                          <div className="w-14 h-14 bg-[#6ffbbe]/20 rounded-2xl flex items-center justify-center text-[#003e29] shadow-sm">
                            <span className="material-symbols-outlined text-3xl">upload_file</span>
                          </div>
                          <div className="text-left font-headline">
                            <h3 className="text-2xl font-black text-[#191c1e]">Bulk Student Tools</h3>
                            <p className="text-[#757684] font-bold text-xs opacity-70">Import from Excel and dynamic role mapping</p>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pt-10">
                        <StudentBulkImport />
                        <div className="mt-10 pt-10 border-t border-slate-100">
                          <DynamicRoleCreator />
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>
              </TabsContent>
              <TabsContent value="security" className="m-0"><SecurityLogsManager /></TabsContent>
              <TabsContent value="leaderboard" className="m-0"><OrganizerLeaderboard /></TabsContent>
              <TabsContent value="awards" className="m-0 space-y-12">
                 <div className="bg-white border border-[#e0e3e5]/60 rounded-[3rem] p-10 shadow-sm">
                    <div className="mb-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                      <div className="font-headline">
                        <h2 className="text-2xl font-black text-[#13298f]">Parliament Awards</h2>
                        <p className="text-[#757684] font-bold text-xs opacity-70">Assign accolades and consensus trophies</p>
                      </div>
                      <Button onClick={() => navigate('/display/awards')} className="bg-[#ffdbd0] text-[#ac3509] hover:bg-[#ffdbd0]/80 font-black px-8 py-6 rounded-2xl">
                        <Presentation className="h-5 w-5 mr-3" /> Launch Award Screen
                      </Button>
                    </div>
                    <AwardManagement />
                 </div>
              </TabsContent>
              <TabsContent value="photos" className="m-0 space-y-8">
                 <div className="bg-white border border-[#e0e3e5]/60 rounded-[3rem] p-10 shadow-sm"><PhotoUploadManager /></div>
                 <div className="bg-white border border-[#e0e3e5]/60 rounded-[3rem] p-10 shadow-sm">
                    <Accordion type="single" collapsible className="w-full">
                       <AccordionItem value="migration" className="border-none">
                          <AccordionTrigger className="hover:no-underline py-0">
                             <div className="flex items-center gap-4 font-headline">
                                <Zap className="w-6 h-6 text-amber-500" />
                                <h3 className="text-xl font-black">Photo Migration Tool</h3>
                             </div>
                          </AccordionTrigger>
                          <AccordionContent className="pt-8">
                             <PhotoMigration />
                          </AccordionContent>
                       </AccordionItem>
                    </Accordion>
                 </div>
              </TabsContent>
              <TabsContent value="speeches" className="m-0"><AdminSpeechTracker /></TabsContent>
              <TabsContent value="news" className="m-0"><BreakingNewsPublisher /></TabsContent>
              <TabsContent value="manual-scoring" className="m-0"><ManualScoring /></TabsContent>
            </div>
          </main>
          

        </div>
      </Tabs>
    </div>
  );
};

const NavTrigger = ({ value, label, icon }: { value: string; label: string; icon: string }) => (
  <TabsTrigger 
    value={value} 
    className="flex items-center gap-3 px-4 py-2.5 text-[#757684] data-[state=active]:bg-[#13298f]/5 data-[state=active]:text-[#13298f] rounded-xl transition-all duration-300 group hover:bg-slate-50 relative justify-start w-full"
  >
    <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
      <span className="material-symbols-outlined text-xl transition-transform duration-300 group-hover:scale-110 group-data-[state=active]:font-fill">{icon}</span>
    </div>
    <span className="font-headline text-xs font-bold tracking-tight whitespace-nowrap">{label}</span>
    <div className="absolute right-3 w-1.5 h-1.5 rounded-full bg-[#13298f] opacity-0 group-data-[state=active]:opacity-100 transition-opacity"></div>
  </TabsTrigger>
);

const StatCard = ({ value, label, icon, color }: { value: number; label: string; icon: string; color: 'primary' | 'secondary' | 'tertiary' }) => {
  const configs = {
    primary: { bg: 'bg-[#13298f]/10', text: 'text-[#13298f]', border: 'border-[#13298f]/20' },
    secondary: { bg: 'bg-[#ac3509]/10', text: 'text-[#ac3509]', border: 'border-[#ac3509]/20' },
    tertiary: { bg: 'bg-[#003e29]/10', text: 'text-[#003e29]', border: 'border-[#003e29]/20' },
  };
  const config = configs[color];

  return (
    <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-[#e0e3e5]/30 hover:shadow-xl hover:scale-[1.02] transition-all duration-300 group">
      <div className={`w-12 h-12 ${config.bg} ${config.text} rounded-xl flex items-center justify-center mb-4 shadow-sm`}>
        <span className="material-symbols-outlined text-2xl font-fill">{icon}</span>
      </div>
      <p className="text-[#757684] text-[9px] font-black uppercase tracking-[0.2em] mb-1 opacity-70 group-hover:opacity-100">{label}</p>
      <h3 className={`text-2xl font-black font-headline tracking-tighter ${config.text}`}>{value.toLocaleString()}</h3>
    </div>
  );
};

const ProgressWidget = ({ label, value, color }: { label: string; value: number; color: string }) => (
  <div className="space-y-2">
    <div className="flex justify-between text-[10px] font-black uppercase tracking-wider text-[#757684]">
      <span>{label}</span>
      <span>{value}%</span>
    </div>
    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${value}%`, backgroundColor: color }}></div>
    </div>
  </div>
);

const ModuleButton = ({ label, icon, onClick, isSecondary }: { label: string; icon: string; onClick?: () => void; isSecondary?: boolean }) => (
  <button 
    onClick={onClick}
    className={`p-5 rounded-2xl flex flex-col items-center justify-center gap-3 group transition-all duration-300 hover:scale-[1.05] active:scale-95 shadow-sm border ${
      isSecondary 
      ? 'bg-white text-[#757684] border-[#e0e3e5] hover:border-[#13298f]/30 ring-0 hover:ring-4 ring-[#13298f]/5' 
      : 'bg-white text-[#13298f] border-transparent hover:bg-[#13298f] hover:text-white shadow-xl shadow-[#13298f]/5'
    }`}
  >
    <div className={`p-3 rounded-xl transition-transform duration-500 group-hover:scale-110 ${isSecondary ? 'bg-slate-50' : 'bg-[#13298f]/5 group-hover:bg-white/20'}`}>
       <span className="material-symbols-outlined text-2xl">{icon}</span>
    </div>
    <span className="text-[10px] font-black font-headline uppercase tracking-widest">{label}</span>
  </button>
);

export default OrganizerDashboard;