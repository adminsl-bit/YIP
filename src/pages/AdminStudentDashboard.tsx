import { useAuth } from '@/hooks/useAuth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StudentProfile } from '@/components/student/StudentProfile';
import InteractiveParliamentTree from '@/components/student/InteractiveParliamentTree';
import { StudentVotingTab } from '@/components/student/StudentVotingTab';
import { ParliamentAgenda } from '@/components/student/ParliamentAgenda';
import { AdminSpeechTracker } from '@/components/organizer/AdminSpeechTracker';
import { SessionManagement } from '@/components/organizer/SessionManagement';
import { BreakingNewsTicker } from '@/components/display/BreakingNewsTicker';
import { Button } from "@/components/ui/button";
import { LogOut, User, Users, Calendar, Mic, ListOrdered } from "lucide-react";
import { TimerTicker } from "@/components/organizer/TimerTicker";

export const AdminStudentDashboard = () => {
  const { profile, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10">
      <TimerTicker />
      <BreakingNewsTicker />
      {/* Header */}
      <div className="sticky top-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border/50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                Young Indians Parliament
              </h1>
              <p className="text-sm text-muted-foreground">Admin Dashboard</p>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="font-medium text-foreground">{profile?.name}</p>
                <p className="text-sm text-muted-foreground capitalize">{profile?.position} (Admin)</p>
              </div>
              <Button
                onClick={signOut}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl shadow-xl p-6">
          <div className="mb-6">
            <h2 className="text-3xl font-bold text-foreground">
              Welcome, <span className="text-primary">{profile?.name}</span>
            </h2>
            <p className="text-muted-foreground mt-2">
              Managing as {profile?.position} with administrative privileges
            </p>
          </div>

          <Tabs defaultValue="profile" className="w-full">
            <TabsList className="grid w-full grid-cols-5 gap-2 mb-6">
              <TabsTrigger value="profile" className="gap-2">
                <User className="h-4 w-4" />
                <span className="hidden sm:inline">My Profile</span>
              </TabsTrigger>
              <TabsTrigger value="parliament" className="gap-2">
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">Parliament Tree</span>
              </TabsTrigger>
              <TabsTrigger value="schedule" className="gap-2">
                <Calendar className="h-4 w-4" />
                <span className="hidden sm:inline">Schedule</span>
              </TabsTrigger>
              <TabsTrigger value="sessions" className="gap-2">
                <ListOrdered className="h-4 w-4" />
                <span className="hidden sm:inline">Sessions</span>
              </TabsTrigger>
              <TabsTrigger value="tracking" className="gap-2">
                <Mic className="h-4 w-4" />
                <span className="hidden sm:inline">Speech Tracking</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="profile">
              {profile && <StudentProfile profile={profile} isOwnProfile={true} />}
            </TabsContent>

            <TabsContent value="parliament">
              <InteractiveParliamentTree />
            </TabsContent>

            <TabsContent value="schedule">
              <ParliamentAgenda />
            </TabsContent>

            <TabsContent value="sessions">
              <SessionManagement />
            </TabsContent>

            <TabsContent value="tracking">
              <AdminSpeechTracker />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default AdminStudentDashboard;
