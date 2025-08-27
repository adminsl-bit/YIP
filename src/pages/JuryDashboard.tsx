import { useAuth } from '@/hooks/useAuth';
import { Button } from "@/components/ui/button";
import { LogOut, Gavel, BarChart3, FileText, Clock } from "lucide-react";

const JuryDashboard = () => {
  const { profile, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50">
      {/* Navigation */}
      <nav className="p-4 flex justify-between items-center bg-white/20 backdrop-blur-sm border-b border-white/30">
        <div className="flex items-center space-x-4">
          <Gavel className="w-8 h-8 text-purple-600" />
          <div>
            <h1 className="text-xl font-bold text-slate-800">Jury Panel</h1>
            <p className="text-sm text-slate-600">Young Indians Parliament</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          {profile && (
            <div className="text-right">
              <p className="font-semibold text-slate-800">{profile.name}</p>
              <p className="text-sm text-slate-600">Jury Member</p>
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
              Jury Dashboard
            </h2>
            <p className="text-lg text-slate-600">
              Monitor and evaluate parliament proceedings
            </p>
          </div>

          {/* Jury Functions Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <div className="bg-white/30 backdrop-blur-sm rounded-2xl p-6 border border-white/40 shadow-lg">
              <div className="flex items-center space-x-3 mb-4">
                <BarChart3 className="w-6 h-6 text-purple-600" />
                <h3 className="text-lg font-semibold text-slate-800">Performance Analytics</h3>
              </div>
              <p className="text-slate-600 text-sm mb-4">View student performance metrics</p>
              <Button className="w-full" variant="outline">View Analytics</Button>
            </div>

            <div className="bg-white/30 backdrop-blur-sm rounded-2xl p-6 border border-white/40 shadow-lg">
              <div className="flex items-center space-x-3 mb-4">
                <FileText className="w-6 h-6 text-indigo-600" />
                <h3 className="text-lg font-semibold text-slate-800">Evaluation Forms</h3>
              </div>
              <p className="text-slate-600 text-sm mb-4">Assess student presentations</p>
              <Button className="w-full" variant="outline">Start Evaluation</Button>
            </div>

            <div className="bg-white/30 backdrop-blur-sm rounded-2xl p-6 border border-white/40 shadow-lg">
              <div className="flex items-center space-x-3 mb-4">
                <Clock className="w-6 h-6 text-orange-600" />
                <h3 className="text-lg font-semibold text-slate-800">Session Timer</h3>
              </div>
              <p className="text-slate-600 text-sm mb-4">Manage session timing</p>
              <Button className="w-full" variant="outline">Session Control</Button>
            </div>
          </div>

          <div className="bg-white/30 backdrop-blur-sm rounded-2xl p-6 border border-white/40 shadow-lg">
            <h3 className="text-xl font-bold text-slate-800 mb-4">Jury Responsibilities</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold text-slate-800 mb-2">Evaluation Criteria</h4>
                <ul className="text-sm text-slate-600 space-y-1">
                  <li>• Parliamentary procedure adherence</li>
                  <li>• Quality of arguments and debate</li>
                  <li>• Leadership and collaboration</li>
                  <li>• Overall presentation skills</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-slate-800 mb-2">Current Session</h4>
                <p className="text-sm text-slate-600">
                  Madurai Regional Round - Young Indians Parliament
                </p>
                <p className="text-sm text-slate-600 mt-2">
                  Status: <span className="font-semibold text-green-600">Active</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JuryDashboard;