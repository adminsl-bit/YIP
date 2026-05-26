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
import { CreateAdminUsers } from "@/components/organizer/CreateAdminUsers";
import { CreateJuryUsers } from "@/components/organizer/CreateJuryUsers";
import { DuplicateLoginMonitor } from "@/components/organizer/DuplicateLoginMonitor";
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
    <div className="flex min-h-screen bg-[#F3F4F6] font-body text-on-surface antialiased">
      <TimerTicker />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex h-screen overflow-hidden">

        {/* ── Left Sidebar ── */}
        <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-outline-variant h-full overflow-y-auto shrink-0">
          <div className="mb-8 px-6 pt-6">
            <h1 className="font-headline font-bold text-on-surface text-lg">The Civic Canvas</h1>
            <p className="font-body text-on-surface-variant text-xs font-medium">Organizer Hub</p>
          </div>

          <TabsList className="flex-1 flex flex-col items-stretch bg-transparent h-auto px-4 space-y-1 mb-8">
            <NavTrigger value="controls"       icon="dashboard_customize" label="Controls" />
            <NavTrigger value="timer"          icon="timer"               label="Timer" />
            <NavTrigger value="sessions"       icon="event_seat"          label="Sessions" />
            <NavTrigger value="polls"          icon="how_to_vote"         label="Ballot" />
            <NavTrigger value="square"         icon="forum"               label="Civic Chat" />
            <NavTrigger value="students"       icon="group"               label="Students" />
            <NavTrigger value="security"       icon="security"            label="Security" />
            <NavTrigger value="leaderboard"    icon="leaderboard"         label="Leaderboard" />
            <NavTrigger value="awards"         icon="emoji_events"        label="Awards" />
            <NavTrigger value="photos"         icon="photo_library"       label="Photos" />
            <NavTrigger value="speeches"       icon="record_voice_over"   label="Speeches" />
            <NavTrigger value="news"           icon="campaign"            label="Breaking News" />
            <NavTrigger value="manual-scoring" icon="edit_note"           label="Manual Scoring" />
          </TabsList>

          <div className="px-6 py-6 mt-auto">
            <button
              onClick={signOut}
              className="flex items-center gap-2 font-body text-on-surface-variant hover:text-error transition-colors duration-200 font-medium text-sm"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </aside>

        {/* ── Main Content Area ── */}
        <div className="flex-1 flex flex-col h-full min-w-0">

          {/* ── Canvas ──*/}
          <main className={`flex-1 transition-all duration-200 ${activeTab === 'square' ? 'p-0 overflow-hidden' : 'p-8 lg:p-10 pb-24 overflow-y-auto'}`}>
            <div>
              <TabsContent value="controls" className="m-0 space-y-10">

                {/* Page heading */}
                <header>
                  <h1 className="text-4xl font-extrabold font-headline tracking-tight text-primary">
                    Organizer <span className="text-secondary">Controls</span>
                  </h1>
                  <p className="text-[10px] text-on-surface-variant/40 font-black uppercase tracking-[0.4em] mt-3 flex items-center gap-2 font-headline">
                    <Settings className="w-3 h-3" />
                    Parliamentary Operations Centre
                  </p>
                </header>

                {/* Quick Access Modules — full width */}
                <div className="bg-white rounded-3xl p-8 border border-outline-variant/10 shadow-sm">
                  <div className="mb-6">
                    <h2 className="text-xl font-extrabold font-headline text-primary">
                      Quick <span className="text-secondary">Access</span>
                    </h2>
                    <p className="text-[10px] text-on-surface-variant/40 font-black uppercase tracking-[0.4em] mt-2 font-headline">Accelerate legislative workflows</p>
                  </div>
                  <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    <ModuleButton label="Timer"          icon="timer"             onClick={() => setActiveTab('timer')} />
                    <ModuleButton label="Sessions"       icon="event_seat"        onClick={() => setActiveTab('sessions')} />
                    <ModuleButton label="Ballot"         icon="how_to_vote"       onClick={() => setActiveTab('polls')} />
                    <ModuleButton label="Civic Chat"     icon="forum"             onClick={() => setActiveTab('square')} />
                    <ModuleButton label="Students"       icon="group"             onClick={() => setActiveTab('students')} />
                    <ModuleButton label="Security"       icon="security"          onClick={() => setActiveTab('security')} />
                    <ModuleButton label="Leaderboard"    icon="leaderboard"       onClick={() => setActiveTab('leaderboard')} />
                    <ModuleButton label="Awards"         icon="emoji_events"      onClick={() => setActiveTab('awards')} />
                    <ModuleButton label="Photos"         icon="photo_library"     onClick={() => setActiveTab('photos')} />
                    <ModuleButton label="Speeches"       icon="record_voice_over" onClick={() => setActiveTab('speeches')} />
                    <ModuleButton label="Breaking News"  icon="campaign"          onClick={() => setActiveTab('news')} />
                    <ModuleButton label="Manual Scoring" icon="edit_note"         onClick={() => setActiveTab('manual-scoring')} />
                  </div>
                </div>

                {/* Process Toggles */}
                <div className="bg-white rounded-3xl p-8 border border-outline-variant/10 shadow-sm">
                  <div className="mb-6">
                    <h2 className="text-xl font-extrabold font-headline text-primary">
                      Process <span className="text-secondary">Toggles</span>
                    </h2>
                    <p className="text-[10px] text-on-surface-variant/40 font-black uppercase tracking-[0.4em] mt-2 font-headline">Feature gate controls</p>
                  </div>
                  <FeatureToggles />
                </div>

                {/* Danger Zone */}
                <div className="bg-error/5 border border-error/10 rounded-3xl p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
                  <div className="flex items-center gap-5">
                    <div className="w-14 h-14 bg-error/10 rounded-2xl flex items-center justify-center text-error">
                      <AlertTriangle className="w-7 h-7" />
                    </div>
                    <div>
                      <h3 className="text-lg font-extrabold font-headline text-error">Legislative Recall</h3>
                      <p className="text-[10px] text-error/60 font-black uppercase tracking-[0.3em] mt-1">Global Session Data Termination</p>
                    </div>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button className="bg-error hover:bg-error/90 text-on-error font-bold text-xs uppercase tracking-widest px-6 py-5 rounded-2xl shadow-lg shadow-error/20 active:scale-95 transition-all">
                        Reset Database
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="rounded-3xl p-8 border border-outline-variant/10 shadow-2xl">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-2xl font-extrabold font-headline text-on-surface">Confirm Data Erasure?</AlertDialogTitle>
                        <AlertDialogDescription className="text-on-surface-variant font-medium mt-3 leading-relaxed font-body">
                          All parliamentary records, votes, and assessment milestones will be permanently purged. This action is irreversible.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter className="mt-6 gap-3">
                        <AlertDialogCancel className="rounded-2xl px-6 font-bold text-xs uppercase tracking-widest py-5 bg-surface-container border-none">Abort</AlertDialogCancel>
                        <AlertDialogAction onClick={resetAllAssessments} className="bg-error hover:bg-error/90 rounded-2xl px-6 font-bold text-xs uppercase tracking-widest py-5 shadow-lg shadow-error/20">
                          Confirm Recall
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>

              </TabsContent>

              <TabsContent value="timer" className="m-0 space-y-10">
                <PageHeader primary="Session" secondary="Timer" icon={<Clock className="w-3 h-3" />} subtitle="Countdown & Time Management" />
                <TimerManagement />
              </TabsContent>

              <TabsContent value="sessions" className="m-0 space-y-10">
                <PageHeader primary="Parliamentary" secondary="Sessions" icon={<Calendar className="w-3 h-3" />} subtitle="Agenda & Schedule Control" />
                <SessionManagement />
              </TabsContent>

              <TabsContent value="polls" className="m-0 space-y-10">
                <PageHeader primary="Ballot" secondary="Management" icon={<Gavel className="w-3 h-3" />} subtitle="Active Poll Administration" />
                <PollManagement />
              </TabsContent>

              <TabsContent value="square" className="m-0 h-[calc(100vh-80px)] overflow-hidden">
                <GlobalSquare />
              </TabsContent>

              <TabsContent value="students" className="m-0 space-y-8">
                <PageHeader primary="Student" secondary="Roster" icon={<GraduationCap className="w-3 h-3" />} subtitle="Delegate Registry & Bulk Tools" />
                <div className="bg-white border border-outline-variant/10 rounded-3xl p-8 shadow-sm"><OrganizerStudentList /></div>
                <div className="bg-white border border-outline-variant/10 rounded-3xl p-8 shadow-sm">
                  <div className="mb-6">
                    <h2 className="text-xl font-extrabold font-headline text-primary">Parliament <span className="text-secondary">Analytics</span></h2>
                    <p className="text-[10px] text-on-surface-variant/40 font-black uppercase tracking-[0.4em] mt-2 font-headline">Party distribution, roles & assessment progress</p>
                  </div>
                  <OrganizerStats />
                </div>
                <div className="bg-white border border-outline-variant/10 rounded-3xl p-8 shadow-sm">
                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="bulk" className="border-none">
                      <AccordionTrigger className="hover:no-underline py-0">
                        <div className="flex items-center gap-5">
                          <div className="w-12 h-12 bg-tertiary/8 rounded-2xl flex items-center justify-center text-tertiary">
                            <span className="material-symbols-outlined text-2xl">upload_file</span>
                          </div>
                          <div className="text-left">
                            <h3 className="text-xl font-extrabold font-headline text-on-surface">Bulk Student Tools</h3>
                            <p className="text-[10px] text-on-surface-variant/50 font-black uppercase tracking-[0.3em] mt-1">Import from Excel and dynamic role mapping</p>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pt-8">
                        <StudentBulkImport />
                        <div className="mt-8 pt-8 border-t border-outline-variant/10">
                          <DynamicRoleCreator />
                        </div>
                        <div className="mt-8 pt-8 border-t border-outline-variant/10">
                          <h3 className="text-sm font-extrabold font-headline text-on-surface mb-1">Quick Account Creation</h3>
                          <p className="text-[10px] text-on-surface-variant/50 font-black uppercase tracking-[0.3em] mb-5">Provision admin and jury accounts via edge function</p>
                          <div className="flex flex-wrap gap-3">
                            <CreateAdminUsers />
                            <CreateJuryUsers />
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>
              </TabsContent>

              <TabsContent value="security" className="m-0 space-y-10">
                <PageHeader primary="Security" secondary="Monitor" icon={<ShieldCheck className="w-3 h-3" />} subtitle="Login Audit & Session Control" />
                <div className="bg-white border border-outline-variant/10 rounded-3xl p-8 shadow-sm">
                  <div className="mb-6">
                    <h2 className="text-xl font-extrabold font-headline text-primary">Duplicate <span className="text-secondary">Login Monitor</span></h2>
                    <p className="text-[10px] text-on-surface-variant/40 font-black uppercase tracking-[0.4em] mt-2 font-headline">Real-time concurrent session detection</p>
                  </div>
                  <DuplicateLoginMonitor />
                </div>
                <SecurityLogsManager />
              </TabsContent>

              <TabsContent value="leaderboard" className="m-0 space-y-10">
                <PageHeader primary="Performance" secondary="Leaderboard" icon={<BarChart3 className="w-3 h-3" />} subtitle="Delegate Rankings & Scores" />
                <OrganizerLeaderboard />
              </TabsContent>

              <TabsContent value="awards" className="m-0 space-y-8">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5">
                  <PageHeader primary="Parliament" secondary="Awards" icon={<Trophy className="w-3 h-3" />} subtitle="Accolades & Consensus Trophies" className="mb-0" />
                  <Button onClick={() => navigate('/display/awards')} className="bg-secondary/10 text-secondary hover:bg-secondary/20 font-bold px-6 py-5 rounded-2xl border border-secondary/10 shrink-0">
                    <Presentation className="h-4 w-4 mr-2" /> Launch Award Screen
                  </Button>
                </div>
                <div className="bg-white border border-outline-variant/10 rounded-3xl p-8 shadow-sm">
                  <AwardManagement />
                </div>
              </TabsContent>

              <TabsContent value="photos" className="m-0 space-y-8">
                <PageHeader primary="Photo" secondary="Gallery" icon={<span className="material-symbols-outlined text-[12px]">photo_library</span>} subtitle="Delegate Photo Management" />
                <div className="bg-white border border-outline-variant/10 rounded-3xl p-8 shadow-sm"><PhotoUploadManager /></div>
                <div className="bg-white border border-outline-variant/10 rounded-3xl p-8 shadow-sm">
                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="migration" className="border-none">
                      <AccordionTrigger className="hover:no-underline py-0">
                        <div className="flex items-center gap-4">
                          <Zap className="w-5 h-5 text-amber-500" />
                          <h3 className="text-xl font-extrabold font-headline text-on-surface">Photo Migration Tool</h3>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pt-8"><PhotoMigration /></AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>
              </TabsContent>

              <TabsContent value="speeches" className="m-0 space-y-10">
                <PageHeader primary="Speech" secondary="Tracker" icon={<Mic className="w-3 h-3" />} subtitle="Oratory Performance Monitor" />
                <AdminSpeechTracker />
              </TabsContent>

              <TabsContent value="news" className="m-0 space-y-10">
                <PageHeader primary="Breaking" secondary="News" icon={<Newspaper className="w-3 h-3" />} subtitle="Live Broadcast Publisher" />
                <BreakingNewsPublisher />
              </TabsContent>

              <TabsContent value="manual-scoring" className="m-0 space-y-10">
                <PageHeader primary="Manual" secondary="Scoring" icon={<FileEdit className="w-3 h-3" />} subtitle="Direct Score Override" />
                <ManualScoring />
              </TabsContent>
            </div>
          </main>
          

        </div>
      </Tabs>
    </div>
  );
};

const PageHeader = ({ primary, secondary, icon, subtitle, className = 'mb-0' }: { primary: string; secondary: string; icon: React.ReactNode; subtitle: string; className?: string }) => (
  <header className={className}>
    <h1 className="text-4xl font-extrabold font-headline tracking-tight text-primary">
      {primary} <span className="text-secondary">{secondary}</span>
    </h1>
    <p className="text-[10px] text-on-surface-variant/40 font-black uppercase tracking-[0.4em] mt-3 flex items-center gap-2 font-headline">
      {icon}
      {subtitle}
    </p>
  </header>
);

const NavTrigger = ({ value, label, icon }: { value: string; label: string; icon: string }) => (
  <TabsTrigger
    value={value}
    className="flex items-center gap-3 px-3 py-2.5 text-on-surface-variant data-[state=active]:text-primary data-[state=active]:font-bold data-[state=active]:bg-primary/5 data-[state=active]:border-r-4 data-[state=active]:border-primary rounded-lg transition-all duration-200 hover:bg-surface-container justify-start w-full font-medium"
  >
    <span className="material-symbols-outlined text-[20px] shrink-0 group-data-[state=active]:font-fill">{icon}</span>
    <span className="font-body text-sm whitespace-nowrap">{label}</span>
  </TabsTrigger>
);

const StatCard = ({ value, label, icon, color }: { value: number; label: string; icon: string; color: 'primary' | 'secondary' | 'tertiary' }) => {
  const configs = {
    primary:   { bg: 'bg-primary/8',   text: 'text-primary' },
    secondary: { bg: 'bg-secondary/8', text: 'text-secondary' },
    tertiary:  { bg: 'bg-tertiary/8',  text: 'text-tertiary' },
  };
  const c = configs[color];
  return (
    <div className="bg-white p-6 rounded-3xl border border-outline-variant/10 shadow-sm hover:shadow-md hover:scale-[1.01] transition-all duration-200 group">
      <div className={`w-11 h-11 ${c.bg} ${c.text} rounded-xl flex items-center justify-center mb-4`}>
        <span className="material-symbols-outlined text-xl font-fill">{icon}</span>
      </div>
      <p className="text-[10px] text-on-surface-variant/50 font-black uppercase tracking-[0.2em] mb-1">{label}</p>
      <h3 className={`text-2xl font-extrabold font-headline tracking-tight ${c.text}`}>{value.toLocaleString()}</h3>
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

const ModuleButton = ({ label, icon, onClick }: { label: string; icon: string; onClick?: () => void }) => (
  <button
    onClick={onClick}
    className="p-5 rounded-2xl flex flex-col items-center justify-center gap-3 group transition-all duration-200 hover:scale-[1.03] active:scale-95 border bg-primary/5 text-primary border-primary/10 hover:bg-primary hover:text-white hover:border-transparent shadow-sm shadow-primary/5"
  >
    <span className="material-symbols-outlined text-2xl transition-transform duration-300 group-hover:scale-110">{icon}</span>
    <span className="text-[10px] font-bold font-headline uppercase tracking-wider">{label}</span>
  </button>
);

export default OrganizerDashboard;