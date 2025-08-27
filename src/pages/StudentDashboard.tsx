import { useAuth } from '@/hooks/useAuth';
import { Button } from "@/components/ui/button";
import { LogOut, Users, BookOpen, Calendar, Award } from "lucide-react";

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
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-slate-800 mb-4">
              Welcome, {profile?.name?.split(' ')[0]}!
            </h2>
            <p className="text-lg text-slate-600">
              You are participating as <span className="font-semibold">{profile?.position}</span> from Party {profile?.party_number}
            </p>
          </div>

          {/* Quick Actions Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <div className="bg-white/30 backdrop-blur-sm rounded-2xl p-6 border border-white/40 shadow-lg">
              <div className="flex items-center space-x-3 mb-4">
                <Users className="w-6 h-6 text-blue-600" />
                <h3 className="text-lg font-semibold text-slate-800">Parliament Members</h3>
              </div>
              <p className="text-slate-600 text-sm mb-4">View all members and their positions</p>
              <Button className="w-full" variant="outline">View Members</Button>
            </div>

            <div className="bg-white/30 backdrop-blur-sm rounded-2xl p-6 border border-white/40 shadow-lg">
              <div className="flex items-center space-x-3 mb-4">
                <BookOpen className="w-6 h-6 text-green-600" />
                <h3 className="text-lg font-semibold text-slate-800">Bills & Proposals</h3>
              </div>
              <p className="text-slate-600 text-sm mb-4">Review and vote on bills</p>
              <Button className="w-full" variant="outline">View Bills</Button>
            </div>

            <div className="bg-white/30 backdrop-blur-sm rounded-2xl p-6 border border-white/40 shadow-lg">
              <div className="flex items-center space-x-3 mb-4">
                <Calendar className="w-6 h-6 text-orange-600" />
                <h3 className="text-lg font-semibold text-slate-800">Sessions</h3>
              </div>
              <p className="text-slate-600 text-sm mb-4">Upcoming parliament sessions</p>
              <Button className="w-full" variant="outline">View Schedule</Button>
            </div>
          </div>

          {/* Profile Information */}
          {profile && (
            <div className="bg-white/30 backdrop-blur-sm rounded-2xl p-6 border border-white/40 shadow-lg">
              <h3 className="text-xl font-bold text-slate-800 mb-4">Your Parliament Profile</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-slate-600">Serial Number:</p>
                  <p className="font-semibold text-slate-800">{profile.serial_number}</p>
                </div>
                <div>
                  <p className="text-slate-600">Party Number:</p>
                  <p className="font-semibold text-slate-800">{profile.party_number}</p>
                </div>
                <div>
                  <p className="text-slate-600">Position:</p>
                  <p className="font-semibold text-slate-800">{profile.position}</p>
                </div>
                <div>
                  <p className="text-slate-600">Constituency:</p>
                  <p className="font-semibold text-slate-800">{profile.constituency}</p>
                </div>
                <div>
                  <p className="text-slate-600">State:</p>
                  <p className="font-semibold text-slate-800">{profile.state}</p>
                </div>
                <div>
                  <p className="text-slate-600">City:</p>
                  <p className="font-semibold text-slate-800">{profile.city}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;