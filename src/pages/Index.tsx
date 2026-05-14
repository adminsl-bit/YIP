import { LandingHero } from "@/components/LandingHero";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { User } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { BreakingNewsTicker } from "@/components/display/BreakingNewsTicker";

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
      <BreakingNewsTicker />
      {/* Floating Navigation Capsule */}
      <nav className="fixed top-8 left-0 right-0 z-50 flex justify-center px-4">
        <div className="flex items-center gap-10 px-8 py-4 bg-surface/70 backdrop-blur-xl border-none rounded-full shadow-elevated">
          <div className="flex items-center gap-3">
            <img src="/lovable-uploads/strawlabs.png" alt="Strawlabs" className="h-7 w-auto" />
            <div className="w-px h-5 bg-outline-variant/20 mx-2" />
            <span className="text-[10px] font-black tracking-[0.3em] text-on-surface uppercase font-headline">Hub</span>
          </div>
          
          <div className="hidden md:flex items-center gap-8">
            <a href="#about" className="text-xs font-black text-on-surface-variant/60 hover:text-primary transition-colors tracking-widest uppercase">About</a>
            <a href="#sessions" className="text-xs font-black text-on-surface-variant/60 hover:text-primary transition-colors tracking-widest uppercase">Sessions</a>
            <a href="#results" className="text-xs font-black text-on-surface-variant/60 hover:text-primary transition-colors tracking-widest uppercase">Results</a>
          </div>
 
          <Link to="/login">
            <Button 
              className="bg-primary text-on-primary hover:bg-primary-container hover:text-on-primary-container transition-all duration-500 shadow-xl shadow-primary/20 px-8 h-12 text-xs font-black rounded-full uppercase tracking-widest"
            >
              <User className="w-4 h-4 mr-3" />
              Parliament Login
            </Button>
          </Link>
        </div>
      </nav>
      <LandingHero />
    </main>
  );
};

export default Index;
