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
  signInWithOtp: (email: string) => Promise<{ error: any }>;
  verifyOtp: (email: string, token: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  signUp: (email: string, password: string, fullName: string, metadata?: any) => Promise<{ error: any; user: User | null }>;
  getSystemSetting: (key: string) => Promise<any>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  loading: true,
  signIn: async () => ({ error: null }),
  signInWithOtp: async () => ({ error: null }),
  verifyOtp: async () => ({ error: null }),
  signOut: async () => {},
  refreshProfile: async () => {},
  signUp: async () => ({ error: null, user: null }),
  getSystemSetting: async () => null,
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
      
      if (!data) {
        setProfile(null);
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
      const { data, error } = await supabase.rpc('enforce_single_session_login', {
        p_user_id: userId,
        p_new_session_id: sessionId,
        p_ip_address: null, // Could be enhanced to get real IP
        p_user_agent: navigator.userAgent
      });

      if (error) {
        console.error('Error enforcing single session login:', error);
        return;
      }

      if (data && typeof data === 'object' && !Array.isArray(data)) {
        const sessionData = data as { previous_session_terminated?: boolean };
        if (sessionData.previous_session_terminated) {
          toast.warning('Your previous session has been terminated. You can only be logged in from one device at a time.');
        }
        
        // Store the current session ID in localStorage for validation
        localStorage.setItem('current_session_id', sessionId);
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
      case 'super_admin':
        navigate('/super-admin');
        break;
      default:
        navigate('/');
    }
  };

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Defer profile fetch to avoid auth state change conflicts
          setTimeout(() => {
            fetchProfile(session.user!.id);
          }, 0);
        } else {
          setProfile(null);
          // Clear session ID from localStorage on logout
          localStorage.removeItem('current_session_id');
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

  // Real-time session validation - detect when session is terminated from another device
  useEffect(() => {
    if (!user) return;

    const currentSessionId = localStorage.getItem('current_session_id');
    if (!currentSessionId) return;

    // Subscribe to profile changes to detect session termination
    const channel = supabase
      .channel('session-validation')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          const newSessionId = payload.new.session_id;
          
          // If session ID changed and doesn't match current session, we've been logged out
          if (newSessionId && newSessionId !== currentSessionId) {
            toast.error('You have been logged out because you logged in from another device.');
            setTimeout(() => {
              signOut();
            }, 2000);
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user]);

  const signIn = async (loginId: string, password: string) => {
    try {
      let email: string;

      // Determine base email from loginId
      if (loginId.includes('@')) {
        email = loginId;
      } else {
        const lowerId = loginId.toLowerCase().trim();
        // Try parliament domain first as it's the primary for delegates
        email = `${lowerId}@yip-parliament.com`;
      }

      // Helper to attempt sign-in with a specific email
      const attemptSignIn = async (em: string) => {
        return await supabase.auth.signInWithPassword({ email: em, password });
      };

      // First attempt (Parliament domain)
      let { data, error } = await attemptSignIn(email);

      // Fallback for staff/admin domains (yip.com, yip.org)
      if (error && !loginId.includes('@')) {
        const fallbackDomains = [`${loginId}@yip.com`, `${loginId}@yip.org`].filter(d => d !== email);
        for (const fb of fallbackDomains) {
          const fallback = await attemptSignIn(fb);
          if (!fallback.error) {
            data = fallback.data;
            error = null;
            break;
          }
        }
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

  const signInWithOtp = async (email: string) => {
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) {
        toast.error(error.message);
      } else {
        toast.success('OTP sent to your email!');
      }
      return { error };
    } catch (error: any) {
      toast.error('Failed to send OTP');
      return { error };
    }
  };

  const verifyOtp = async (email: string, token: string) => {
    try {
      // 1. Try 'signup' verification type (for new registration confirmations)
      let { data, error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'signup',
      });

      // 2. If 'signup' fails, try 'magiclink' verification type (standard for OTP logins)
      if (error) {
        const magicLinkResult = await supabase.auth.verifyOtp({
          email,
          token,
          type: 'magiclink',
        });
        error = magicLinkResult.error;
        data = magicLinkResult.data;
      }

      // 3. Fallback to 'email' type if both 'signup' and 'magiclink' failed
      if (error) {
        const emailResult = await supabase.auth.verifyOtp({
          email,
          token,
          type: 'email',
        });
        error = emailResult.error;
        data = emailResult.data;
      }

      if (error) {
        toast.error(error.message);
        return { error };
      }

      toast.success('Successfully authenticated!');
      return { error: null };
    } catch (error: any) {
      toast.error('Verification failed');
      return { error };
    }
  };

  const signUp = async (email: string, password: string, fullName: string, metadata: any = {}) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          }
        }
      });

      if (error) {
        toast.error(error.message);
        return { error, user: null };
      }

      if (data.user) {
        // Create profile
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            user_id: data.user.id,
            name: fullName,
            user_type: 'student',
            position: metadata.position || 'Member',
            party_number: metadata.party_number || Math.floor(Math.random() * 5) + 1,
            serial_number: metadata.serial_number || Math.floor(Math.random() * 9000) + 1000,
            constituency: metadata.constituency || 'TBD',
            is_active: true
          });

        if (profileError) {
          console.error('Error creating profile during signup:', profileError);
          // We don't block for profile error as the user is already created in Auth
        }

        toast.success('Registration successful! Please check your email for verification.');
      }

      return { error: null, user: data.user };
    } catch (error: any) {
      toast.error('An unexpected error occurred during registration');
      return { error, user: null };
    }
  };

  const signOut = async () => {
    try {
      setUser(null);
      setSession(null);
      setProfile(null);
      
      if (user?.id) {
        try {
          const { data: roleData } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', user.id);
          
          const roles = roleData?.map(r => r.role) || [];
          const isJournalist = roles.includes('journalist');
          const isAdminStudent = roles.includes('admin_student');
          const isStudent = profile?.user_type === 'student';
          
          if (isStudent || isJournalist || isAdminStudent) {
            await supabase
              .from('profiles')
              .update({ session_id: null })
              .eq('user_id', user.id);
          }
        } catch {
          // cleanup failed; continue logout anyway
        }
      }
      
      localStorage.removeItem('current_session_id');
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('Supabase signOut error:', error.message);
      }
      
      toast.success('Signed out successfully');
      navigate('/login');
    } catch (error) {
      console.error('Error during sign out:', error);
      setUser(null);
      setSession(null);
      setProfile(null);
      toast.success('Signed out successfully');
      navigate('/');
    }
  };

  const getSystemSetting = async (key: string) => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', key)
        .maybeSingle();

      if (error) throw error;
      
      if (!data) {
        // Default to true for registration if not found, to avoid locking out users
        if (key === 'registration_enabled') return true;
        return null;
      }
      
      return data.setting_value === 'true' || data.setting_value === true;
    } catch (e) {
      console.error('Error fetching system setting:', key, e);
      return null;
    }
  };

  const value = {
    user,
    session,
    profile,
    loading,
    signIn,
    signInWithOtp,
    verifyOtp,
    signOut,
    refreshProfile,
    signUp,
    getSystemSetting,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};