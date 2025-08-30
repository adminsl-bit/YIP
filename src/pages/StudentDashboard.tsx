import { useAuth } from '@/hooks/useAuth';
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogOut, User, Users, Vote, Calendar, Award, GraduationCap } from "lucide-react";
import { StudentProfile } from "@/components/student/StudentProfile";
import InteractiveParliamentTree from "@/components/student/InteractiveParliamentTree";
import { StudentVotingTab } from "@/components/student/StudentVotingTab";
import { ParliamentAgenda } from "@/components/student/ParliamentAgenda";


const StudentDashboard = () => {
  const { profile, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-orange-50 relative overflow-hidden">
      {/* Enhanced animated background matching landing page */}
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
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/30">
              <GraduationCap className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
            </div>
            <div className="absolute -top-1 -right-1 w-3 h-3 sm:w-4 sm:h-4 bg-orange-400/40 rounded-full animate-bounce"></div>
          </div>
          <div className="text-center sm:text-left">
            <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">Student Portal</h1>
            <p className="text-sm sm:text-lg font-semibold text-slate-600">Young Indians Parliament</p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
          {profile && (
            <div className="text-center sm:text-right bg-white/20 backdrop-blur-sm rounded-2xl p-3 sm:p-4 border border-white/30 order-2 sm:order-1">
              <p className="font-bold text-slate-800 text-base sm:text-lg">{profile.name}</p>
              <p className="text-xs sm:text-sm text-slate-600 font-medium">{profile.position} - Party {profile.party_number}</p>
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
                You are participating as <span className="font-black text-transparent bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text">{profile?.position}</span> from <span className="font-black text-transparent bg-gradient-to-r from-green-600 to-teal-600 bg-clip-text">Party {profile?.party_number}</span>
              </p>
            </div>
          </div>

          <Tabs defaultValue="profile" className="w-full">
            <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 gap-2 mb-8 sm:mb-12 bg-white/15 backdrop-blur-lg border border-white/25 p-2 sm:p-3 rounded-2xl sm:rounded-3xl shadow-xl h-auto">
              <TabsTrigger 
                value="profile" 
                className="flex flex-col items-center justify-center gap-1 sm:gap-2 px-2 sm:px-4 py-4 sm:py-6 rounded-xl sm:rounded-2xl text-xs sm:text-sm lg:text-base font-semibold transition-all duration-300 data-[state=active]:bg-white/30 data-[state=active]:shadow-lg hover:scale-105 min-h-[60px] sm:min-h-[80px] touch-target"
              >
                <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0">
                  <User className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                </div>
                <span className="text-center">My Profile</span>
              </TabsTrigger>
              <TabsTrigger 
                value="members" 
                className="flex flex-col items-center justify-center gap-1 sm:gap-2 px-2 sm:px-4 py-4 sm:py-6 rounded-xl sm:rounded-2xl text-xs sm:text-sm lg:text-base font-semibold transition-all duration-300 data-[state=active]:bg-white/30 data-[state=active]:shadow-lg hover:scale-105 min-h-[60px] sm:min-h-[80px] touch-target"
              >
                <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-br from-green-500 to-teal-500 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0">
                  <Users className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                </div>
                <span className="text-center">Parliament Tree</span>
              </TabsTrigger>
              <TabsTrigger 
                value="voting" 
                className="flex flex-col items-center justify-center gap-1 sm:gap-2 px-2 sm:px-4 py-4 sm:py-6 rounded-xl sm:rounded-2xl text-xs sm:text-sm lg:text-base font-semibold transition-all duration-300 data-[state=active]:bg-white/30 data-[state=active]:shadow-lg hover:scale-105 min-h-[60px] sm:min-h-[80px] touch-target"
              >
                <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-br from-red-500 to-pink-500 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0">
                  <Vote className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                </div>
                <span className="text-center">Voting</span>
              </TabsTrigger>
              <TabsTrigger 
                value="schedule" 
                className="flex flex-col items-center justify-center gap-1 sm:gap-2 px-2 sm:px-4 py-4 sm:py-6 rounded-xl sm:rounded-2xl text-xs sm:text-sm lg:text-base font-semibold transition-all duration-300 data-[state=active]:bg-white/30 data-[state=active]:shadow-lg hover:scale-105 min-h-[60px] sm:min-h-[80px] touch-target"
              >
                <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0">
                  <Calendar className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                </div>
                <span className="text-center">Schedule</span>
              </TabsTrigger>
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

          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;