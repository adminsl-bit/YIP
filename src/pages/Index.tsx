import { LandingHero } from "@/components/LandingHero";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { User } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useEffect } from "react";

const Index = () => {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();

  // Redirect authenticated users to their appropriate dashboard
  useEffect(() => {
    if (user && profile?.user_type) {
      switch (profile.user_type) {
        case 'student':
          navigate('/student');
          break;
        case 'jury':
          navigate('/jury');
          break;
        case 'organizer':
          navigate('/organizer');
          break;
      }
    }
  }, [user, profile, navigate]);

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

  // Only show landing page for non-authenticated users
  return (
    <main>
      <div className="absolute top-4 right-4 z-20">
        <Link to="/login">
          <Button 
            variant="outline" 
            className="bg-white/20 backdrop-blur-lg border-white/30 text-slate-800 hover:bg-white/35 hover:scale-105 transition-all duration-300 shadow-lg px-6 py-3 text-lg font-semibold rounded-2xl"
          >
            <User className="w-5 h-5 mr-2" />
            Parliament Login
          </Button>
        </Link>
      </div>
      <LandingHero />
    </main>
  );
};

export default Index;
