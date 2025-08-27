import { LandingHero } from "@/components/LandingHero";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { LogOut, User, Crown } from "lucide-react";
import { Link } from "react-router-dom";

const Index = () => {
  const { user, profile, signOut, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <main>
        <div className="absolute top-4 right-4 z-20">
          <Link to="/login">
            <Button variant="outline" className="bg-white/20 backdrop-blur-sm border-white/30 text-slate-800 hover:bg-white/30">
              <User className="w-4 h-4 mr-2" />
              Parliament Login
            </Button>
          </Link>
        </div>
        <LandingHero />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-orange-50">
      {/* Navigation */}
      <nav className="p-4 flex justify-between items-center bg-white/20 backdrop-blur-sm border-b border-white/30">
        <div className="flex items-center space-x-4">
          <Crown className="w-8 h-8 text-orange-600" />
          <div>
            <h1 className="text-xl font-bold text-slate-800">Young Indians Parliament</h1>
            <p className="text-sm text-slate-600">Madurai Regional Round</p>
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
              Welcome to Parliament, {profile?.name?.split(' ')[0]}!
            </h2>
            <p className="text-lg text-slate-600">
              You are logged in as <span className="font-semibold">{profile?.position}</span> from Party {profile?.party_number}
            </p>
          </div>

          {/* Profile Card */}
          {profile && (
            <div className="bg-white/30 backdrop-blur-sm rounded-2xl p-6 border border-white/40 shadow-lg max-w-2xl mx-auto">
              <h3 className="text-xl font-bold text-slate-800 mb-4">Your Profile</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
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

          <div className="text-center mt-8">
            <p className="text-slate-600">
              Parliament features and functionalities will be added in the next phases.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
};

export default Index;
