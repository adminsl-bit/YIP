import { useAuth } from '@/hooks/useAuth';
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogOut, User, Users, Vote, Award } from "lucide-react";
import { StudentProfile } from "@/components/student/StudentProfile";
import { ParliamentTree } from "@/components/student/ParliamentTree";
import { VotingInterface } from "@/components/student/VotingInterface";

const StudentDashboard = () => {
  const { profile, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-orange-50">
      {/* Navigation */}
      <nav className="p-4 flex justify-between items-center bg-white/20 backdrop-blur-sm border-b border-white/30">
        <div className="flex items-center space-x-4">
          <Award className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-xl font-bold text-slate-800">Student Portal</h1>
            <p className="text-sm text-slate-600">Young Indians Parliament</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          {profile && (
            <div className="text-right">
              <p className="font-semibold text-slate-800">{profile.name}</p>
              <p className="text-sm text-slate-600">{profile.position} - Party {profile.party_number}</p>
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

      {/* Dashboard Content */}
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-slate-800 mb-4">
              Welcome, {profile?.name?.split(' ')[0]}!
            </h2>
            <p className="text-lg text-slate-600">
              You are participating as <span className="font-semibold">{profile?.position}</span> from Party {profile?.party_number}
            </p>
          </div>

          <Tabs defaultValue="profile" className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-8">
              <TabsTrigger value="profile" className="flex items-center space-x-2">
                <User className="w-4 h-4" />
                <span>My Profile</span>
              </TabsTrigger>
              <TabsTrigger value="members" className="flex items-center space-x-2">
                <Users className="w-4 h-4" />
                <span>Parliament Tree</span>
              </TabsTrigger>
              <TabsTrigger value="voting" className="flex items-center space-x-2">
                <Vote className="w-4 h-4" />
                <span>Voting</span>
              </TabsTrigger>
              <TabsTrigger value="schedule" className="flex items-center space-x-2">
                <Award className="w-4 h-4" />
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
                <div className="bg-white/30 backdrop-blur-sm rounded-2xl p-6 border border-white/40 shadow-lg">
                  <h3 className="text-xl font-bold text-slate-800 mb-6">Quick Actions</h3>
                  <div className="space-y-4">
                    <Button variant="outline" className="w-full justify-start">
                      <Users className="w-4 h-4 mr-2" />
                      View All Parliament Members
                    </Button>
                    <Button variant="outline" className="w-full justify-start">
                      <Vote className="w-4 h-4 mr-2" />
                      Check Voting Sessions
                    </Button>
                    <Button variant="outline" className="w-full justify-start">
                      <Award className="w-4 h-4 mr-2" />
                      View Session Schedule
                    </Button>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="members">
              <ParliamentTree />
            </TabsContent>

            <TabsContent value="voting">
              <VotingInterface />
            </TabsContent>

            <TabsContent value="schedule">
              <div className="bg-white/30 backdrop-blur-sm rounded-2xl p-6 border border-white/40 shadow-lg text-center">
                <Award className="w-16 h-16 mx-auto mb-4 text-slate-400" />
                <h3 className="text-xl font-bold text-slate-800 mb-2">Session Schedule</h3>
                <p className="text-slate-600">Parliament session schedules will be available here.</p>
                <p className="text-sm text-slate-500 mt-2">Check back later for updates from the organizers.</p>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;