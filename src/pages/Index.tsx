import { LandingHero } from "@/components/LandingHero";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { BreakingNewsTicker } from "@/components/display/BreakingNewsTicker";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

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
      <Navbar />
      <LandingHero />
      <Footer />
    </main>
  );
};

export default Index;
