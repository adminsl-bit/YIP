import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: any | null;
  loading: boolean;
  signIn: (loginId: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  loading: true,
  signIn: async () => ({ error: null }),
  signOut: async () => {},
  refreshProfile: async () => {},
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching profile:', error);
        return;
      }
      
      setProfile(data);
    } catch (error) {
      console.error('Error in fetchProfile:', error);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  const logUserLogin = async (userId: string) => {
    try {
      const sessionId = crypto.randomUUID();
      const { data, error } = await supabase.rpc('log_user_login', {
        p_user_id: userId,
        p_session_id: sessionId,
        p_ip_address: null, // Could be enhanced to get real IP
        p_user_agent: navigator.userAgent
      });

      if (error) {
        console.error('Error logging user login:', error);
        return;
      }

      if (data && typeof data === 'object' && 'is_duplicate_session' in data && data.is_duplicate_session) {
        toast.warning('Another session detected. Previous session has been terminated.');
      }
    } catch (error) {
      console.error('Error in logUserLogin:', error);
    }
  };

  const redirectByRole = (userType: string) => {
    switch (userType) {
      case 'student':
        navigate('/student');
        break;
      case 'jury':
        navigate('/jury');
        break;
      case 'organizer':
        navigate('/organizer');
        break;
      default:
        navigate('/');
    }
  };

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state change:', event, 'Session:', !!session);
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Defer profile fetch to avoid auth state change conflicts
          setTimeout(() => {
            fetchProfile(session.user!.id);
          }, 0);
        } else {
          setProfile(null);
        }
        
        setLoading(false);
      }
    );

    // Failsafe: ensure we never stay in loading state too long
    const loadingTimeout = window.setTimeout(() => {
      setLoading(false);
    }, 5000);

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('Initial session check:', !!session);
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        setTimeout(() => {
          fetchProfile(session.user!.id);
        }, 0);
      }
      
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
      window.clearTimeout(loadingTimeout);
    };
  }, []);

  const signIn = async (loginId: string, password: string) => {
    try {
      let email: string;
      
      // Check if this is a student login (numeric) or jury/organizer (email format)
      if (/^\d+$/.test(loginId)) {
        // Student login: serial+party format -> email format
        email = `${loginId}@yip.parliament`;
      } else if (loginId.includes('@')) {
        // Jury/Organizer: direct email
        email = loginId;
      } else {
        // Jury/Organizer: username -> convert to email format
        email = `${loginId}@yip.org`;
      }
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast.error(error.message);
      } else {
        toast.success('Welcome to Young Indians Parliament!');
        
        // Only log user login and redirect after successful sign in
        if (data.user) {
          await logUserLogin(data.user.id);
          
          // Get profile to determine redirect
          const { data: profileData } = await supabase
            .from('profiles')
            .select('user_type')
            .eq('user_id', data.user.id)
            .maybeSingle();
          
          if (profileData?.user_type) {
            // Small delay to ensure auth state is updated
            setTimeout(() => {
              redirectByRole(profileData.user_type);
            }, 100);
          }
        }
      }

      return { error };
    } catch (error: any) {
      toast.error('An unexpected error occurred');
      return { error };
    }
  };

  const signOut = async () => {
    try {
      // Clear session in database if it's a student
      if (profile?.user_type === 'student') {
        await supabase
          .from('profiles')
          .update({ session_id: null })
          .eq('user_id', user?.id);
      }
      
      const { error } = await supabase.auth.signOut();
      
      // Handle session not found gracefully - just clear local state
      if (error && error.message.includes('Session not found')) {
        console.log('Session already expired, clearing local state');
        setUser(null);
        setSession(null);
        setProfile(null);
        toast.success('Signed out successfully');
        navigate('/');
        return;
      }
      
      if (error) {
        toast.error(error.message);
      } else {
        toast.success('Signed out successfully');
        navigate('/');
      }
    } catch (error) {
      // If any error occurs, force clear the auth state
      console.log('Error during sign out, forcing clear:', error);
      setUser(null);
      setSession(null);
      setProfile(null);
      toast.success('Signed out successfully');
      navigate('/');
    }
  };

  const value = {
    user,
    session,
    profile,
    loading,
    signIn,
    signOut,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};