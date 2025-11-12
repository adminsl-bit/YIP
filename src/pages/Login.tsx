import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { ParliamentSignIn } from "@/components/ui/parliament-signin";
import { BreakingNewsTicker } from "@/components/display/BreakingNewsTicker";

export const Login = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/50 to-background">
        <BreakingNewsTicker />
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // If user is already logged in, redirect to home
  if (user) {
    return <Navigate to="/" replace />;
  }

  return (
    <>
      <BreakingNewsTicker />
      <ParliamentSignIn />
    </>
  );
};

export default Login;