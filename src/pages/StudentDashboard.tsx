import { useAuth } from '@/hooks/useAuth';
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogOut, User, Users, Vote, Calendar, Award, GraduationCap, Settings, Mic } from "lucide-react";
import { StudentProfile } from "@/components/student/StudentProfile";
import InteractiveParliamentTree from "@/components/student/InteractiveParliamentTree";
import { StudentVotingTab } from "@/components/student/StudentVotingTab";
import { ParliamentAgenda } from "@/components/student/ParliamentAgenda";
import { BreakingNewsTicker } from "@/components/display/BreakingNewsTicker";
import { SpeechTrackingView } from "@/components/student/SpeechTrackingView";
import { getPartyLetter } from "@/lib/utils";

const StudentDashboard = () => {
  const { profile, signOut } = useAuth();
  
  // Check if user has Speaker or Deputy Speaker position
  const canViewSpeechTracking = 
    profile?.position?.toLowerCase().includes('speaker') || 
    profile?.position?.toLowerCase().includes('deputy speaker');

  return (
    <div className="min-h-screen bg-surface selection:bg-primary/10 relative overflow-hidden font-sans">
      <BreakingNewsTicker />
      
      {/* Civic Canvas Background Layers */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-surface-container-lowest skew-x-[-12deg] translate-x-24 opacity-50" />
        <div className="absolute top-[10%] left-[-5%] w-[30%] h-[40%] bg-primary/5 rounded-full blur-[100px]" />
        <div className="absolute bottom-[5%] right-[2%] w-[25%] h-[35%] bg-secondary/5 rounded-full blur-[80px]" />
      </div>

      {/* Navigation with enhanced glass morphism */}
      <nav className="relative z-10 px-8 py-4 flex flex-col sm:flex-row justify-between items-center gap-6 bg-surface/70 backdrop-blur-xl border-none shadow-sm mx-6 mt-6 rounded-[2.5rem]">
        <div className="flex items-center gap-6">
          <div className="relative">
            <div className="w-14 h-14 bg-surface-container-high rounded-2xl flex items-center justify-center shadow-inner group">
              <GraduationCap className="w-7 h-7 text-primary transition-transform group-hover:scale-110" />
            </div>
          </div>
          <div className="text-left">
            <h1 className="text-xl font-headline font-black text-on-surface tracking-tight uppercase">Member Portal</h1>
            <p className="text-xs font-black text-on-surface-variant/40 tracking-[0.2em] uppercase">Young Indians Parliament</p>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          {profile && (
            <div className="text-right hidden sm:block">
              <p className="font-headline font-black text-on-surface text-lg leading-none mb-1">{profile.name}</p>
              <p className="text-[10px] font-black text-primary uppercase tracking-widest opacity-60">
                {profile.position} • Party {getPartyLetter(profile.party_number)}
              </p>
            </div>
          )}
          <div className="w-px h-10 bg-outline-variant/10 hidden sm:block" />
          <Button 
            onClick={signOut}
            variant="ghost"
            className="hover:bg-red-50 text-on-surface-variant hover:text-red-600 rounded-2xl px-6 h-12 font-bold transition-all"
          >
            <LogOut className="w-5 h-5 mr-3" />
            Exit
          </Button>
        </div>
      </nav>

      {/* Dashboard Content */}
      <div className="relative z-10 responsive-padding">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8 sm:mb-12">
            <div className="relative inline-block mb-6 sm:mb-8">
              <h2 className="responsive-text-3xl font-black text-transparent bg-gradient-to-r from-orange-600 via-slate-800 to-green-600 bg-clip-text tracking-tight drop-shadow-lg">
                Welcome, {profile?.name?.split(' ')[0]}!
              </h2>
              <div className="absolute -top-2 right-4 sm:right-8 w-4 h-4 sm:w-6 sm:h-6 lg:w-8 lg:h-8 bg-gradient-to-br from-orange-400/30 to-red-400/20 rounded-full animate-bounce shadow-lg"></div>
            </div>
            <div className="bg-white/20 backdrop-blur-lg rounded-2xl sm:rounded-3xl border border-white/25 responsive-padding shadow-xl max-w-xl sm:max-w-2xl mx-auto">
              <p className="responsive-text-base text-slate-700 font-semibold">
                You are participating as <span className="font-black text-transparent bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text">{profile?.position}</span> from <span className="font-black text-transparent bg-gradient-to-r from-green-600 to-teal-600 bg-clip-text">Party {getPartyLetter(profile?.party_number ?? 0)}</span>
              </p>
            </div>
          </div>

          <Tabs defaultValue="profile" className="w-full">
            <TabsList className={`grid w-full ${canViewSpeechTracking ? 'grid-cols-2 lg:grid-cols-5' : 'grid-cols-2 lg:grid-cols-4'} gap-3 mb-16 bg-surface-container-low p-2 rounded-[2rem] shadow-sm h-auto border-none`}>
              <TabsTrigger 
                value="profile" 
                className="flex flex-col items-center justify-center gap-2 px-6 py-8 rounded-[1.5rem] font-headline font-black transition-all duration-300 data-[state=active]:bg-surface data-[state=active]:shadow-elevated hover:bg-surface-container hover:scale-[1.02]"
              >
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center mb-1">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <span>Identity</span>
              </TabsTrigger>
              <TabsTrigger 
                value="members" 
                className="flex flex-col items-center justify-center gap-2 px-6 py-8 rounded-[1.5rem] font-headline font-black transition-all duration-300 data-[state=active]:bg-surface data-[state=active]:shadow-elevated hover:bg-surface-container hover:scale-[1.02]"
              >
                <div className="w-10 h-10 bg-secondary/10 rounded-xl flex items-center justify-center mb-1">
                  <Users className="w-5 h-5 text-secondary" />
                </div>
                <span>Assembly</span>
              </TabsTrigger>
              <TabsTrigger 
                value="voting" 
                className="flex flex-col items-center justify-center gap-2 px-6 py-8 rounded-[1.5rem] font-headline font-black transition-all duration-300 data-[state=active]:bg-surface data-[state=active]:shadow-elevated hover:bg-surface-container hover:scale-[1.02]"
              >
                <div className="w-10 h-10 bg-tertiary/10 rounded-xl flex items-center justify-center mb-1">
                  <Vote className="w-5 h-5 text-tertiary" />
                </div>
                <span>Ballot</span>
              </TabsTrigger>
              <TabsTrigger 
                value="schedule" 
                className="flex flex-col items-center justify-center gap-2 px-6 py-8 rounded-[1.5rem] font-headline font-black transition-all duration-300 data-[state=active]:bg-surface data-[state=active]:shadow-elevated hover:bg-surface-container hover:scale-[1.02]"
              >
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center mb-1">
                  <Calendar className="w-5 h-5 text-primary" />
                </div>
                <span>Agenda</span>
              </TabsTrigger>
              
              {canViewSpeechTracking && (
                <TabsTrigger 
                  value="speeches" 
                  className="flex flex-col items-center justify-center gap-2 px-6 py-8 rounded-[1.5rem] font-headline font-black transition-all duration-300 data-[state=active]:bg-surface data-[state=active]:shadow-elevated hover:bg-surface-container hover:scale-[1.02]"
                >
                  <div className="w-10 h-10 bg-secondary/10 rounded-xl flex items-center justify-center mb-1">
                    <Mic className="w-5 h-5 text-secondary" />
                  </div>
                  <span>Registry</span>
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="profile" className="space-y-6">
              <div className="w-full">
                {profile && (
                  <StudentProfile profile={profile} isOwnProfile={true} />
                )}
              </div>
            </TabsContent>

            <TabsContent value="members">
              <InteractiveParliamentTree />
            </TabsContent>

            <TabsContent value="voting">
              <StudentVotingTab />
            </TabsContent>

            <TabsContent value="schedule">
              <ParliamentAgenda />
            </TabsContent>

            {canViewSpeechTracking && (
              <TabsContent value="speeches">
                <SpeechTrackingView />
              </TabsContent>
            )}

          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;