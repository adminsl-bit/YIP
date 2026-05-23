import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogOut, User, Users, Vote, Calendar, Mic, GraduationCap } from "lucide-react";
import { StudentProfile } from "@/components/student/StudentProfile";
import InteractiveParliamentTree from "@/components/student/InteractiveParliamentTree";
import { StudentVotingTab } from "@/components/student/StudentVotingTab";
import { ParliamentAgenda } from "@/components/student/ParliamentAgenda";
import { BreakingNewsTicker } from "@/components/display/BreakingNewsTicker";
import { SpeechTrackingView } from "@/components/student/SpeechTrackingView";
import { CivicWall } from "@/components/student/CivicWall";
import { GlobalSquare } from "@/components/student/GlobalSquare";
import { getPartyLetter } from "@/lib/utils";
import { MessageSquare, Globe } from "lucide-react";

const StudentDashboard = () => {
  const { profile, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState("profile");
  
  // Check if user has Speaker or Deputy Speaker position
  const canViewSpeechTracking = 
    profile?.position?.toLowerCase().includes('speaker') || 
    profile?.position?.toLowerCase().includes('deputy speaker');

  return (
    <div className="flex min-h-screen bg-surface font-body text-on-surface antialiased overflow-hidden selection:bg-primary/10 selection:text-primary">
      <BreakingNewsTicker />
      
      {/* Civic Canvas Background Layers */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-0 w-3/4 h-full bg-surface-container-lowest skew-x-[-15deg] translate-x-1/3 opacity-40 transition-transform duration-1000" />
        <div className="absolute top-[-10%] left-[-5%] w-[50%] h-[60%] bg-primary/[0.03] rounded-full blur-[120px] animate-pulse-soft" />
        <div className="absolute bottom-[-5%] right-[5%] w-[40%] h-[50%] bg-secondary/[0.03] rounded-full blur-[100px] animate-pulse-soft" style={{ animationDelay: '1s' }} />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex h-screen overflow-hidden relative z-10">
        {/* Persistent Side Navigation - Editorial Sidebar */}
        <aside className="hidden lg:flex flex-col w-80 bg-white/70 backdrop-blur-xl h-full overflow-y-auto relative z-20">
          <div className="p-8 flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center text-on-primary shadow-lg shadow-primary/20 group relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <GraduationCap className="w-6 h-6 transition-transform group-hover:scale-110 relative z-10" />
            </div>
            <div>
              <h2 className="text-title-md font-display font-bold text-primary leading-tight tracking-tight uppercase italic">Member Hub</h2>
              <p className="text-label-xs uppercase tracking-[0.2em] text-on-surface-variant font-bold mt-1 opacity-50">Young Indians Parliament</p>
            </div>
          </div>

          <div className="px-6 mb-8">
            <div className="bg-surface-container-low rounded-3xl p-5 relative overflow-hidden group">
              <div className="absolute inset-0 bg-primary/[0.02] opacity-0 group-hover:opacity-100 transition-opacity" />
              <p className="text-label-xs font-black text-primary uppercase tracking-[0.15em] mb-2 opacity-60">Credentials</p>
              <h3 className="font-display font-bold text-on-surface text-title-md truncate leading-tight">{profile?.name}</h3>
              <p className="text-label-xs font-bold text-on-surface-variant mt-1.5 truncate opacity-70">
                {profile?.position} <span className="mx-1 text-primary/30">•</span> {getPartyLetter(profile?.party_number ?? 0)}
              </p>
            </div>
          </div>

          <TabsList className="flex-1 flex flex-col items-stretch bg-transparent h-auto px-4 space-y-2 mb-8 border-none">
            <NavTrigger value="profile" icon={<User className="w-5 h-5" />} label="Identity" />
            <NavTrigger value="members" icon={<Users className="w-5 h-5" />} label="Assembly" />
            <NavTrigger value="voting" icon={<Vote className="w-5 h-5" />} label="Ballot Chamber" />
            <NavTrigger value="wall" icon={<Globe className="w-5 h-5" />} label="Civic Wall" />
            <NavTrigger value="chat" icon={<MessageSquare className="w-5 h-5" />} label="Global Square" />
            <NavTrigger value="schedule" icon={<Calendar className="w-5 h-5" />} label="Order of Day" />
            {canViewSpeechTracking && (
              <NavTrigger value="speeches" icon={<Mic className="w-5 h-5" />} label="Registry" />
            )}
          </TabsList>

          <div className="px-6 py-8 mt-auto">
            <button 
              onClick={signOut}
              className="w-full flex items-center justify-center gap-3 text-on-surface-variant hover:text-secondary font-black text-label-xs uppercase tracking-[0.25em] py-4 bg-surface-container-low hover:bg-secondary/5 rounded-2xl transition-all group"
            >
              <LogOut className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
              Exit Portal
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col h-full min-w-0 bg-surface-container-lowest/30 relative">
          {/* Header for Mobile */}
          <header className="lg:hidden h-20 bg-white/80 backdrop-blur-xl flex items-center justify-between px-6 sticky top-0 z-50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-on-primary shadow-lg shadow-primary/10">
                <GraduationCap className="w-5 h-5" />
              </div>
              <span className="font-display font-black text-primary uppercase tracking-tighter italic text-headline-xs">NYP Portal</span>
            </div>
            <button 
              onClick={signOut}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-secondary/10 text-secondary"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </header>

          <main className="flex-1 overflow-y-auto p-6 sm:p-10 lg:p-12 pb-32 scroll-smooth">
            <div className="max-w-7xl mx-auto">
              <header className="mb-12 animate-fade-in">
                <div className="flex items-center gap-3 mb-6">
                  <div className="h-px w-8 bg-primary/20" />
                  <span className="text-label-sm font-black text-primary uppercase tracking-[0.4em] opacity-80">
                    {activeTab === 'profile' ? 'Member Credentials' : 
                     activeTab === 'members' ? 'Parliamentary Tree' :
                     activeTab === 'voting' ? 'Legislative Action' :
                     activeTab === 'wall' ? 'Civic Discourse' :
                     activeTab === 'chat' ? 'Global Exchange' :
                     activeTab === 'schedule' ? 'Session Timeline' : 'Speech Registry'}
                  </span>
                </div>
                
                <h1 className="text-display-sm md:text-display-md font-display font-black text-on-surface tracking-tighter leading-none mb-4 uppercase italic">
                  {activeTab === 'profile' ? `Welcome, ${profile?.name?.split(' ')[0]}` : 
                   activeTab === 'members' ? 'The Assembly Floor' :
                   activeTab === 'voting' ? 'Ballot Chamber' :
                   activeTab === 'wall' ? 'The Civic Wall' :
                   activeTab === 'chat' ? 'Global Square' :
                   activeTab === 'schedule' ? 'Parliament Agenda' : 'Speech Registry'}
                </h1>
                <p className="text-body-md text-on-surface-variant font-medium max-w-2xl leading-relaxed opacity-70">
                  {activeTab === 'profile' ? 'Review your official credentials and performance metrics for the active session.' : 
                   activeTab === 'members' ? 'Explore the full organizational structure of the current assembly members.' :
                   activeTab === 'voting' ? 'Exercise your democratic right by casting votes on active resolutions.' :
                   activeTab === 'wall' ? 'Engage with fellow delegates through posts and shared reflections.' :
                   activeTab === 'chat' ? 'Real-time collaborative exchange for institutional delegates.' :
                   activeTab === 'schedule' ? 'Track upcoming sessions, debates, and institutional proceedings.' : 'Official record of session interventions and speeches.'}
                </p>
              </header>

              <div className="relative">
                <TabsContent value="profile" className="m-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  {profile && <StudentProfile profile={profile} isOwnProfile={true} />}
                </TabsContent>

                <TabsContent value="members" className="m-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <InteractiveParliamentTree />
                </TabsContent>

                <TabsContent value="voting" className="m-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <StudentVotingTab />
                </TabsContent>

                <TabsContent value="wall" className="m-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <CivicWall />
                </TabsContent>

                <TabsContent value="chat" className="m-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <GlobalSquare />
                </TabsContent>

                <TabsContent value="schedule" className="m-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <ParliamentAgenda />
                </TabsContent>

                {canViewSpeechTracking && (
                  <TabsContent value="speeches" className="m-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <SpeechTrackingView />
                  </TabsContent>
                )}
              </div>
            </div>
          </main>
        </div>
      </Tabs>

      {/* Bottom Nav for Mobile - Floating Capsule */}
      <div className="lg:hidden fixed bottom-6 left-6 right-6 h-20 bg-white/80 backdrop-blur-2xl rounded-[2.5rem] px-6 flex items-center justify-around z-50 shadow-2xl shadow-primary/5">
        <MobileNavTrigger value="profile" icon={<User className="w-5 h-5" />} active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} />
        <MobileNavTrigger value="members" icon={<Users className="w-5 h-5" />} active={activeTab === 'members'} onClick={() => setActiveTab('members')} />
        <MobileNavTrigger value="voting" icon={<Vote className="w-5 h-5" />} active={activeTab === 'voting'} onClick={() => setActiveTab('voting')} />
        <MobileNavTrigger value="wall" icon={<Globe className="w-5 h-5" />} active={activeTab === 'wall'} onClick={() => setActiveTab('wall')} />
        <MobileNavTrigger value="chat" icon={<MessageSquare className="w-5 h-5" />} active={activeTab === 'chat'} onClick={() => setActiveTab('chat')} />
        <MobileNavTrigger value="schedule" icon={<Calendar className="w-5 h-5" />} active={activeTab === 'schedule'} onClick={() => setActiveTab('schedule')} />
      </div>
    </div>
  );
};

const NavTrigger = ({ value, label, icon }: { value: string; label: string; icon: React.ReactNode }) => (
  <TabsTrigger 
    value={value} 
    className="flex items-center gap-4 px-6 py-4 text-on-surface-variant/40 data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-2xl transition-all duration-500 group relative justify-start w-full border-none shadow-none overflow-hidden"
  >
    <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
    <div className="flex-shrink-0 transition-transform duration-500 group-hover:scale-110 group-data-[state=active]:scale-110 relative z-10">
      {icon}
    </div>
    <span className="text-label-xs font-black tracking-[0.15em] uppercase relative z-10 transition-colors">{label}</span>
    <div className="absolute right-6 w-1.5 h-1.5 rounded-full bg-primary opacity-0 group-data-[state=active]:opacity-100 transition-all duration-500 scale-0 group-data-[state=active]:scale-100 relative z-10"></div>
  </TabsTrigger>
);

const MobileNavTrigger = ({ icon, active, onClick }: { value: string; icon: React.ReactNode; active: boolean; onClick: () => void }) => (
  <button 
    onClick={onClick}
    className={`flex flex-col items-center justify-center gap-1 p-3 rounded-2xl transition-all duration-500 ${active ? 'text-primary bg-primary/10 scale-110 shadow-lg shadow-primary/5' : 'text-on-surface-variant/30'}`}
  >
    {icon}
  </button>
);

export default StudentDashboard;