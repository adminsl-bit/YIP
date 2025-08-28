import { useAuth } from '@/hooks/useAuth';
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogOut, User, Users, Vote, Award } from "lucide-react";
import { StudentProfile } from "@/components/student/StudentProfile";
import InteractiveParliamentTree from "@/components/student/InteractiveParliamentTree";
import { VotingInterface } from "@/components/student/VotingInterface";

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
      <nav className="relative z-10 p-6 flex justify-between items-center bg-white/15 backdrop-blur-lg border-b border-white/25 shadow-xl">
        <div className="flex items-center space-x-6">
          <div className="relative">
            <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/30">
              <Award className="w-8 h-8 text-white" />
            </div>
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-orange-400/40 rounded-full animate-bounce"></div>
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Student Portal</h1>
            <p className="text-lg font-semibold text-slate-600">Young Indians Parliament</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-6">
          {profile && (
            <div className="text-right bg-white/20 backdrop-blur-sm rounded-2xl p-4 border border-white/30">
              <p className="font-bold text-slate-800 text-lg">{profile.name}</p>
              <p className="text-sm text-slate-600 font-medium">{profile.position} - Party {profile.party_number}</p>
            </div>
          )}
          <Button 
            onClick={signOut}
            variant="outline"
            className="bg-white/20 backdrop-blur-sm border-white/30 text-slate-800 hover:bg-white/35 hover:scale-105 transition-all duration-300 shadow-lg px-6 py-3 text-lg font-semibold"
          >
            <LogOut className="w-5 h-5 mr-2" />
            Sign Out
          </Button>
        </div>
      </nav>

      {/* Dashboard Content */}
      <div className="relative z-10 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <div className="relative inline-block mb-8">
              <h2 className="text-6xl font-black text-transparent bg-gradient-to-r from-orange-600 via-slate-800 to-green-600 bg-clip-text tracking-tight drop-shadow-lg">
                Welcome, {profile?.name?.split(' ')[0]}!
              </h2>
              <div className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-br from-orange-400 to-red-400 rounded-full animate-bounce shadow-lg"></div>
            </div>
            <div className="bg-white/20 backdrop-blur-lg rounded-3xl border border-white/25 p-6 shadow-xl max-w-2xl mx-auto">
              <p className="text-xl text-slate-700 font-semibold">
                You are participating as <span className="font-black text-transparent bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text">{profile?.position}</span> from <span className="font-black text-transparent bg-gradient-to-r from-green-600 to-teal-600 bg-clip-text">Party {profile?.party_number}</span>
              </p>
            </div>
          </div>

          <Tabs defaultValue="profile" className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-12 bg-white/15 backdrop-blur-lg border border-white/25 p-2 rounded-3xl shadow-xl">
              <TabsTrigger value="profile" className="flex items-center space-x-3 px-6 py-4 rounded-2xl text-lg font-semibold transition-all duration-300 data-[state=active]:bg-white/30 data-[state=active]:shadow-lg hover:scale-105">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center shadow-lg">
                  <User className="w-5 h-5 text-white" />
                </div>
                <span>My Profile</span>
              </TabsTrigger>
              <TabsTrigger value="members" className="flex items-center space-x-3 px-6 py-4 rounded-2xl text-lg font-semibold transition-all duration-300 data-[state=active]:bg-white/30 data-[state=active]:shadow-lg hover:scale-105">
                <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-teal-500 rounded-2xl flex items-center justify-center shadow-lg">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <span>Parliament Tree</span>
              </TabsTrigger>
              <TabsTrigger value="voting" className="flex items-center space-x-3 px-6 py-4 rounded-2xl text-lg font-semibold transition-all duration-300 data-[state=active]:bg-white/30 data-[state=active]:shadow-lg hover:scale-105">
                <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg">
                  <Vote className="w-5 h-5 text-white" />
                </div>
                <span>Voting</span>
              </TabsTrigger>
              <TabsTrigger value="schedule" className="flex items-center space-x-3 px-6 py-4 rounded-2xl text-lg font-semibold transition-all duration-300 data-[state=active]:bg-white/30 data-[state=active]:shadow-lg hover:scale-105">
                <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-2xl flex items-center justify-center shadow-lg">
                  <Award className="w-5 h-5 text-white" />
                </div>
                <span>Schedule</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="flex justify-center">
                  {profile && (
                    <StudentProfile profile={profile} isOwnProfile={true} />
                  )}
                </div>
                <div className="bg-white/15 backdrop-blur-lg rounded-3xl p-8 border border-white/25 shadow-xl">
                  <h3 className="text-2xl font-black text-slate-800 mb-8 text-center">Quick Actions</h3>
                  <div className="space-y-6">
                    <Button className="w-full justify-start bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 p-6 text-lg font-semibold rounded-2xl">
                      <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mr-4">
                        <Users className="w-5 h-5" />
                      </div>
                      View All Parliament Members
                    </Button>
                    <Button className="w-full justify-start bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 p-6 text-lg font-semibold rounded-2xl">
                      <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mr-4">
                        <Vote className="w-5 h-5" />
                      </div>
                      Check Voting Sessions
                    </Button>
                    <Button className="w-full justify-start bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 p-6 text-lg font-semibold rounded-2xl">
                      <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mr-4">
                        <Award className="w-5 h-5" />
                      </div>
                      View Session Schedule
                    </Button>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="members">
              <InteractiveParliamentTree />
            </TabsContent>

            <TabsContent value="voting">
              <VotingInterface />
            </TabsContent>

            <TabsContent value="schedule">
              <div className="bg-white/15 backdrop-blur-lg rounded-3xl p-12 border border-white/25 shadow-xl text-center">
                <div className="relative inline-block mb-8">
                  <div className="w-24 h-24 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-3xl flex items-center justify-center mx-auto shadow-lg shadow-orange-500/30">
                    <Award className="w-12 h-12 text-white" />
                  </div>
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-orange-400/40 rounded-full animate-bounce"></div>
                </div>
                <h3 className="text-3xl font-black text-slate-800 mb-4">Session Schedule</h3>
                <p className="text-xl text-slate-600 font-semibold mb-4">Parliament session schedules will be available here.</p>
                <p className="text-lg text-slate-500">Check back later for updates from the organizers.</p>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;