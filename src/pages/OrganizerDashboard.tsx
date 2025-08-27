import { useAuth } from '@/hooks/useAuth';
import { Button } from "@/components/ui/button";
import { LogOut, Settings, Users, Activity, Shield, Database } from "lucide-react";

const OrganizerDashboard = () => {
  const { profile, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50">
      {/* Navigation */}
      <nav className="p-4 flex justify-between items-center bg-white/20 backdrop-blur-sm border-b border-white/30">
        <div className="flex items-center space-x-4">
          <Shield className="w-8 h-8 text-emerald-600" />
          <div>
            <h1 className="text-xl font-bold text-slate-800">Organizer Control</h1>
            <p className="text-sm text-slate-600">Young Indians Parliament</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          {profile && (
            <div className="text-right">
              <p className="font-semibold text-slate-800">{profile.name}</p>
              <p className="text-sm text-slate-600">Event Organizer</p>
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
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-slate-800 mb-4">
              Event Management Console
            </h2>
            <p className="text-lg text-slate-600">
              Complete control over parliament proceedings and participants
            </p>
          </div>

          {/* Admin Functions Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <div className="bg-white/30 backdrop-blur-sm rounded-2xl p-6 border border-white/40 shadow-lg">
              <div className="flex items-center space-x-3 mb-4">
                <Users className="w-6 h-6 text-emerald-600" />
                <h3 className="text-lg font-semibold text-slate-800">User Management</h3>
              </div>
              <p className="text-slate-600 text-sm mb-4">Manage student, jury & organizer accounts</p>
              <Button className="w-full" variant="outline">Manage Users</Button>
            </div>

            <div className="bg-white/30 backdrop-blur-sm rounded-2xl p-6 border border-white/40 shadow-lg">
              <div className="flex items-center space-x-3 mb-4">
                <Activity className="w-6 h-6 text-blue-600" />
                <h3 className="text-lg font-semibold text-slate-800">Session Control</h3>
              </div>
              <p className="text-slate-600 text-sm mb-4">Start, pause, and manage sessions</p>
              <Button className="w-full" variant="outline">Control Session</Button>
            </div>

            <div className="bg-white/30 backdrop-blur-sm rounded-2xl p-6 border border-white/40 shadow-lg">
              <div className="flex items-center space-x-3 mb-4">
                <Database className="w-6 h-6 text-purple-600" />
                <h3 className="text-lg font-semibold text-slate-800">Login Audit</h3>
              </div>
              <p className="text-slate-600 text-sm mb-4">Monitor duplicate logins and security</p>
              <Button className="w-full" variant="outline">View Audit</Button>
            </div>

            <div className="bg-white/30 backdrop-blur-sm rounded-2xl p-6 border border-white/40 shadow-lg">
              <div className="flex items-center space-x-3 mb-4">
                <Settings className="w-6 h-6 text-orange-600" />
                <h3 className="text-lg font-semibold text-slate-800">Event Settings</h3>
              </div>
              <p className="text-slate-600 text-sm mb-4">Configure parliament parameters</p>
              <Button className="w-full" variant="outline">Settings</Button>
            </div>

            <div className="bg-white/30 backdrop-blur-sm rounded-2xl p-6 border border-white/40 shadow-lg">
              <div className="flex items-center space-x-3 mb-4">
                <Activity className="w-6 h-6 text-red-500" />
                <h3 className="text-lg font-semibold text-slate-800">Live Monitoring</h3>
              </div>
              <p className="text-slate-600 text-sm mb-4">Real-time session monitoring</p>
              <Button className="w-full" variant="outline">Live View</Button>
            </div>

            <div className="bg-white/30 backdrop-blur-sm rounded-2xl p-6 border border-white/40 shadow-lg">
              <div className="flex items-center space-x-3 mb-4">
                <Database className="w-6 h-6 text-teal-600" />
                <h3 className="text-lg font-semibold text-slate-800">Reports & Export</h3>
              </div>
              <p className="text-slate-600 text-sm mb-4">Generate event reports</p>
              <Button className="w-full" variant="outline">Generate Reports</Button>
            </div>
          </div>

          {/* Admin Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white/30 backdrop-blur-sm rounded-2xl p-6 border border-white/40 shadow-lg">
              <h3 className="text-xl font-bold text-slate-800 mb-4">Event Status</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-slate-600">Total Students:</span>
                  <span className="font-semibold text-slate-800">--</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Active Sessions:</span>
                  <span className="font-semibold text-green-600">0</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Jury Members:</span>
                  <span className="font-semibold text-slate-800">--</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Duplicate Logins:</span>
                  <span className="font-semibold text-red-500">0</span>
                </div>
              </div>
            </div>

            <div className="bg-white/30 backdrop-blur-sm rounded-2xl p-6 border border-white/40 shadow-lg">
              <h3 className="text-xl font-bold text-slate-800 mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <Button className="w-full justify-start" variant="outline">
                  Create New User Account
                </Button>
                <Button className="w-full justify-start" variant="outline">
                  Bulk Import Students
                </Button>
                <Button className="w-full justify-start" variant="outline">
                  Reset All Passwords
                </Button>
                <Button className="w-full justify-start" variant="outline">
                  Download Event Data
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrganizerDashboard;