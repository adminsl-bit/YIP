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
      console.log('Fetching profile for user ID:', userId);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching profile:', error);
        return;
      }
      
      if (!data) {
        console.log('No profile found for user ID:', userId);
        // If no profile exists, sign out the user as their account may be deleted
        toast.error('Your account is not found. Please contact support.');
        setTimeout(() => {
          signOut();
        }, 1000);
        return;
      }
      
      console.log('Profile fetched successfully:', data);
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
      case 'journalist':
        navigate('/journalist');
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

      // Determine base email from loginId
      if (loginId.includes('@')) {
        email = loginId;
      } else if (/^\d+$/.test(loginId) || /^YIP\d+$/i.test(loginId)) {
        // Student login: numeric id or YIP prefix -> internal email alias
        email = `${loginId}@yip.parliament`;
      } else {
        // Username (e.g., jury4, admin1) -> default to .com or .org domain
        if (loginId.startsWith('admin')) {
          email = `${loginId}@yip.org`;
        } else {
          email = `${loginId}@yip.com`;
        }
      }

      // Helper to attempt sign-in with a specific email
      const attemptSignIn = async (em: string) => {
        return await supabase.auth.signInWithPassword({ email: em, password });
      };

      // First attempt
      let { data, error } = await attemptSignIn(email);

      // If username-based login failed with .com, try legacy .org as fallback
      if (error && !loginId.includes('@') && !/^\d+$/.test(loginId)) {
        const fallbackEmail = `${loginId}@yip.org`;
        const fallback = await attemptSignIn(fallbackEmail);
        data = fallback.data;
        error = fallback.error;
      }

      if (error) {
        toast.error(error.message);
      } else {
        toast.success('Welcome to Young Indians Parliament!');

        if (data.user) {
          await logUserLogin(data.user.id);

          const { data: profileData } = await supabase
            .from('profiles')
            .select('user_type')
            .eq('user_id', data.user.id)
            .maybeSingle();

          if (profileData?.user_type) {
            if (profileData.user_type === 'student') {
              // Check for special roles
              const { data: roleData } = await supabase
                .from('user_roles')
                .select('role')
                .eq('user_id', data.user.id);

              const roles = roleData?.map(r => r.role) || [];
              
              // Priority: journalist > admin_student > regular student
              if (roles.includes('journalist')) {
                navigate('/journalist');
                return { error: null };
              } else if (roles.includes('admin_student')) {
                navigate('/admin-student');
                return { error: null };
              }
            }
            redirectByRole(profileData.user_type);
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
    console.log('SignOut function called. Current state:', { user: !!user, session: !!session, profile: !!profile });
    try {
      // Always clear local state first to prevent UI issues
      setUser(null);
      setSession(null);
      setProfile(null);
      
      // Clear session in database if it's a student and we have user data
      if (profile?.user_type === 'student' && user?.id) {
        try {
          await supabase
            .from('profiles')
            .update({ session_id: null })
            .eq('user_id', user.id);
        } catch (dbError) {
          console.log('Database cleanup failed, continuing with logout:', dbError);
        }
      }
      
      // Attempt to sign out from Supabase
      const { error } = await supabase.auth.signOut();
      
      // Handle any Supabase signOut errors gracefully
      if (error) {
        console.log('Supabase signOut error (handled gracefully):', error.message);
        // Don't show error to user since we've already cleared local state
      }
      
      // Always show success and navigate
      toast.success('Signed out successfully');
      navigate('/');
      
    } catch (error) {
      // If any error occurs, ensure we still clear state and navigate
      console.log('Error during sign out, but state already cleared:', error);
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