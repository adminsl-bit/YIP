import { useAuth } from '@/hooks/useAuth';
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogOut, Settings, Clock, BarChart3, Users, ShieldCheck, FileText, Eye } from "lucide-react";
import { FeatureToggles } from "@/components/organizer/FeatureToggles";
import { TimerControl } from "@/components/organizer/TimerControl";
import { PollManagement } from "@/components/organizer/PollManagement";
import { DuplicateLoginMonitor } from "@/components/organizer/DuplicateLoginMonitor";

const OrganizerDashboard = () => {
  const { profile, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50">
      {/* Navigation */}
      <nav className="p-4 flex justify-between items-center bg-white/20 backdrop-blur-sm border-b border-white/30">
        <div className="flex items-center space-x-4">
          <ShieldCheck className="w-8 h-8 text-emerald-600" />
          <div>
            <h1 className="text-xl font-bold text-slate-800">Organizer Console</h1>
            <p className="text-sm text-slate-600">Young Indians Parliament</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          {profile && (
            <div className="text-right">
              <p className="font-semibold text-slate-800">{profile.name}</p>
              <p className="text-sm text-slate-600">{profile.position}</p>
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

      {/* Header */}
      <div className="p-6 bg-white/30 backdrop-blur-sm border-b border-white/30">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Parliament Control Center</h2>
          <p className="text-slate-600">
            Manage all aspects of the Young Indians Parliament session from this central console
          </p>
        </div>
      </div>

      {/* Dashboard Content */}
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          <Tabs defaultValue="controls" className="w-full">
            <TabsList className="grid w-full grid-cols-6 mb-8">
              <TabsTrigger value="controls" className="flex items-center space-x-2">
                <Settings className="w-4 h-4" />
                <span>Controls</span>
              </TabsTrigger>
              <TabsTrigger value="timer" className="flex items-center space-x-2">
                <Clock className="w-4 h-4" />
                <span>Timer</span>
              </TabsTrigger>
              <TabsTrigger value="polls" className="flex items-center space-x-2">
                <BarChart3 className="w-4 h-4" />
                <span>Polls</span>
              </TabsTrigger>
              <TabsTrigger value="students" className="flex items-center space-x-2">
                <Users className="w-4 h-4" />
                <span>Students</span>
              </TabsTrigger>
              <TabsTrigger value="security" className="flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4" />
                <span>Security</span>
              </TabsTrigger>
              <TabsTrigger value="logs" className="flex items-center space-x-2">
                <FileText className="w-4 h-4" />
                <span>Logs</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="controls" className="space-y-6">
              <FeatureToggles />
            </TabsContent>

            <TabsContent value="timer" className="space-y-6">
              <TimerControl />
            </TabsContent>

            <TabsContent value="polls" className="space-y-6">
              <PollManagement />
            </TabsContent>

            <TabsContent value="students" className="space-y-6">
              <div className="bg-white/30 backdrop-blur-sm rounded-2xl p-6 border border-white/40 shadow-lg">
                <h3 className="text-xl font-bold text-slate-800 mb-4">Student Management</h3>
                <p className="text-slate-600 mb-4">
                  Comprehensive student data management including bulk import, individual editing, and password reset capabilities.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Button variant="outline" className="flex items-center justify-center p-6 h-auto">
                    <div className="text-center">
                      <Users className="w-8 h-8 mx-auto mb-2 text-blue-600" />
                      <div className="font-medium">Bulk Import</div>
                      <div className="text-sm text-muted-foreground">Import from Excel/CSV</div>
                    </div>
                  </Button>
                  <Button variant="outline" className="flex items-center justify-center p-6 h-auto">
                    <div className="text-center">
                      <Settings className="w-8 h-8 mx-auto mb-2 text-green-600" />
                      <div className="font-medium">Manage Students</div>
                      <div className="text-sm text-muted-foreground">Add, edit, delete</div>
                    </div>
                  </Button>
                  <Button variant="outline" className="flex items-center justify-center p-6 h-auto">
                    <div className="text-center">
                      <ShieldCheck className="w-8 h-8 mx-auto mb-2 text-purple-600" />
                      <div className="font-medium">Reset Passwords</div>
                      <div className="text-sm text-muted-foreground">Student access recovery</div>
                    </div>
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="security" className="space-y-6">
              <DuplicateLoginMonitor />
            </TabsContent>

            <TabsContent value="logs" className="space-y-6">
              <div className="bg-white/30 backdrop-blur-sm rounded-2xl p-6 border border-white/40 shadow-lg">
                <h3 className="text-xl font-bold text-slate-800 mb-4">System Logs</h3>
                <p className="text-slate-600 mb-4">
                  Access comprehensive audit trails and system logs with advanced filtering capabilities.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button variant="outline" className="flex items-center justify-center p-6 h-auto">
                    <div className="text-center">
                      <FileText className="w-8 h-8 mx-auto mb-2 text-blue-600" />
                      <div className="font-medium">Audit Logs</div>
                      <div className="text-sm text-muted-foreground">User actions & changes</div>
                    </div>
                  </Button>
                  <Button variant="outline" className="flex items-center justify-center p-6 h-auto">
                    <div className="text-center">
                      <Eye className="w-8 h-8 mx-auto mb-2 text-green-600" />
                      <div className="font-medium">Access Logs</div>
                      <div className="text-sm text-muted-foreground">Login & session tracking</div>
                    </div>
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default OrganizerDashboard;