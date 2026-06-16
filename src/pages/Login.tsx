import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Navigate, Link } from 'react-router-dom';
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { supabase } from '@/integrations/supabase/client';

const Login = () => {
  const [loginMode, setLoginMode] = useState<'password' | 'code'>('password');
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Login-with-code state
  const [loginCode, setLoginCode] = useState('');

  // Forgot password state
  const [showForgotPw, setShowForgotPw] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSending, setForgotSending] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  const { user, loading, signIn } = useAuth();
  const { toast } = useToast();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f2f4f6] px-4">
        <div className="text-center space-y-8">
          <div className="relative">
            <div className="absolute inset-0 bg-[#13298f]/20 blur-3xl rounded-full scale-150 animate-pulse" />
            <Loader2 className="w-16 h-16 text-[#13298f] animate-spin mx-auto relative z-10" />
          </div>
          <div className="space-y-2">
            <p className="text-[#13298f] font-headline font-black uppercase tracking-[0.3em] text-xs">Verifying Credentials</p>
            <p className="text-slate-400 font-medium text-xs">Entering the Chamber...</p>
          </div>
        </div>
      </div>
    );
  }

  if (user && !isAuthenticating) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthenticating(true);
    try {
      await signIn(loginId.trim(), password);
    } catch (error) {
      console.error('Login error:', error);
      toast({
        title: "Access Denied",
        description: "Your credentials could not be verified. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = loginCode.trim();
    if (!/^\d{6}$/.test(code)) {
      toast({
        title: "Invalid Code",
        description: "Enter the 6-digit code from your login sheet.",
        variant: "destructive"
      });
      return;
    }

    setIsAuthenticating(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/login-with-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const result = await response.json();

      if (!response.ok || !result.email) {
        toast({
          title: "Access Denied",
          description: result.error || "That code wasn't recognised. Please check and try again.",
          variant: "destructive"
        });
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({ email: result.email, password: code });
      if (error) {
        toast({
          title: "Access Denied",
          description: "Your code could not be verified. Please try again.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Code login error:', error);
      toast({
        title: "Access Denied",
        description: "Something went wrong. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;
    setForgotSending(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setForgotSent(true);
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to send reset email.",
        variant: "destructive",
      });
    } finally {
      setForgotSending(false);
    }
  };

  return (
    <div className="bg-surface font-body text-on-surface antialiased min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-grow flex items-center justify-center pt-24 pb-16 px-4 md:px-6 relative">
        {/* Decorative ambient glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />

        <div className="w-full max-w-5xl grid md:grid-cols-2 bg-surface-container-lowest rounded-[2rem] overflow-hidden shadow-2xl shadow-primary/5 min-h-[650px] relative z-10">

          {/* Left Side: Visual/Context */}
          <div className="hidden md:flex flex-col justify-between p-12 bg-primary relative overflow-hidden">
            {/* Abstract Geometric Patterns */}
            <div className="absolute inset-0 opacity-10">
              <svg height="100%" preserveAspectRatio="none" viewBox="0 0 100 100" width="100%">
                <defs>
                  <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                    <path d="M 10 0 L 0 0 0 10" fill="none" stroke="white" strokeWidth="0.5"></path>
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)"></rect>
              </svg>
            </div>

            <div className="relative z-10">
              <div className="inline-flex items-center px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white text-[10px] font-black uppercase tracking-widest mb-6">
                Future Leaders Hub
              </div>
              <h2 className="text-4xl lg:text-5xl font-extrabold font-headline text-white leading-tight mb-6">
                Empowering the next <span className="text-tertiary-fixed">generation</span> of Indian leaders.
              </h2>
              <p className="text-white/85 text-sm max-w-md leading-relaxed">
                Join the most prestigious parliamentary simulation for youth and help shape the dialogue of tomorrow's India.
              </p>
            </div>

            {/* Mascot/Logo Element */}
            <div className="relative z-10 flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center">
                <span className="material-symbols-outlined text-tertiary-fixed text-3xl">account_balance</span>
              </div>
              <div>
                <p className="text-white font-bold text-sm">Young Indians Parliament</p>
                <p className="text-white/60 text-xs">Authentic Civic Engagement</p>
              </div>
            </div>

            {/* Parliament Building Illustration Overlay */}
            <img
              className="absolute bottom-[-10%] right-[-10%] w-3/4 opacity-20 pointer-events-none transform rotate-12"
              alt="Indian Parliament"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuC07q01SqSF90alFkhGfPrzUk-LCriw8zmEDoFL8Ys_V2m-uAtUPUuUFlCkxe-PLQwmH8TElV2y_U4R5QfapSacvYMM-pcapbY24CNASLnwXUFlRZxQZOBK2kIjHNCoctpulr2n2ErcQcxObSww5YTMZp4_cdR2pFDZ7o-ce5QMa4y55tC7ufw0jL3ZMXR3CoCwzpktDsziYG5bbjjlXjhdMDwgfZVc1fsdTPOidk1_mSol6rOu9lKG0kKTigXqQ2BPwPzKZ6kNf63I"
            />
          </div>

          {/* Right Side: Login Form / Forgot Password */}
          <div className="flex flex-col justify-center p-8 md:p-12 lg:p-16 relative">

            {/* ── Forgot Password Panel ── */}
            {showForgotPw ? (
              <div>
                <button
                  type="button"
                  onClick={() => { setShowForgotPw(false); setForgotSent(false); setForgotEmail(''); }}
                  className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-on-surface-variant hover:text-primary mb-6 transition-colors"
                >
                  <span className="material-symbols-outlined text-base">arrow_back</span>
                  Back to Login
                </button>

                {forgotSent ? (
                  <div className="text-center py-6">
                    <div className="w-16 h-16 rounded-full bg-tertiary-fixed/20 flex items-center justify-center mx-auto mb-4">
                      <span className="material-symbols-outlined text-tertiary-container text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>mark_email_read</span>
                    </div>
                    <h2 className="text-xl font-black font-headline text-on-surface mb-2">Check your inbox</h2>
                    <p className="text-sm text-on-surface-variant font-body leading-relaxed max-w-xs mx-auto">
                      A password reset link has been sent to <span className="font-bold text-primary">{forgotEmail}</span>. Follow the link to set a new password.
                    </p>
                    <p className="text-xs text-on-surface-variant/60 font-body mt-4">
                      Didn't receive it? Check your spam folder or contact your organizer.
                    </p>
                    <button
                      type="button"
                      onClick={() => { setShowForgotPw(false); setForgotSent(false); setForgotEmail(''); }}
                      className="mt-6 text-xs font-black uppercase tracking-widest text-primary hover:underline"
                    >
                      Return to Login
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="mb-8">
                      <h1 className="text-2xl font-black font-headline text-on-surface mb-1.5 tracking-tight">Forgot Password?</h1>
                      <p className="text-xs text-on-surface-variant font-medium">Enter your registered email to receive a reset link.</p>
                    </div>

                    <form onSubmit={handleForgotPassword} className="space-y-5">
                      <div className="space-y-2">
                        <label className="block text-xs font-black uppercase tracking-widest text-on-surface-variant ml-1">Email Address</label>
                        <div className="relative group">
                          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <span className="material-symbols-outlined text-outline group-focus-within:text-primary transition-colors text-lg">mail</span>
                          </div>
                          <input
                            type="email"
                            required
                            value={forgotEmail}
                            onChange={e => setForgotEmail(e.target.value)}
                            className="block w-full pl-11 pr-4 py-3.5 bg-surface-container border-none rounded-xl text-xs text-on-surface focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all placeholder:text-outline/50 outline-none font-bold"
                            placeholder="e.g. delegate@email.com"
                          />
                        </div>
                      </div>

                      <p className="text-[11px] text-on-surface-variant/70 font-body leading-relaxed bg-surface-container rounded-xl px-4 py-3">
                        <span className="material-symbols-outlined text-[13px] align-middle mr-1">info</span>
                        This works for accounts registered with a real email address. For internal YIP accounts, contact your organizer to reset your password.
                      </p>

                      <button
                        type="submit"
                        disabled={forgotSending}
                        className="w-full flex justify-center items-center gap-2.5 py-3.5 px-6 bg-gradient-to-r from-primary to-primary-container text-white text-xs font-black uppercase tracking-[0.2em] rounded-xl shadow-lg shadow-primary/10 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-75"
                      >
                        {forgotSending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <span>Send Reset Link</span>
                            <span className="material-symbols-outlined text-base">send</span>
                          </>
                        )}
                      </button>
                    </form>
                  </>
                )}
              </div>
            ) : (
              /* ── Login Form ── */
              <>
                <div className="mb-8">
                  <h1 className="text-2xl font-black font-headline text-on-surface mb-1.5 tracking-tight">Parliament Login</h1>
                  <p className="text-xs text-on-surface-variant font-medium">Welcome back, Delegate. Access your chamber.</p>
                </div>

                <div className="flex gap-2 mb-6 p-1 bg-surface-container rounded-xl">
                  <button
                    type="button"
                    onClick={() => setLoginMode('password')}
                    className={`flex-1 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${loginMode === 'password' ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant'}`}
                  >
                    Username
                  </button>
                  <button
                    type="button"
                    onClick={() => setLoginMode('code')}
                    className={`flex-1 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${loginMode === 'code' ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant'}`}
                  >
                    Login Code
                  </button>
                </div>

                {loginMode === 'code' ? (
                  <form onSubmit={handleCodeSubmit} className="space-y-5">
                    <div className="space-y-2">
                      <label className="block text-xs font-black uppercase tracking-widest text-on-surface-variant ml-1">6-Digit Login Code</label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <span className="material-symbols-outlined text-outline group-focus-within:text-primary transition-colors text-lg">password</span>
                        </div>
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          required
                          value={loginCode}
                          onChange={(e) => setLoginCode(e.target.value.replace(/\D/g, ''))}
                          className="block w-full pl-11 pr-4 py-3.5 bg-surface-container border-none rounded-xl text-lg text-center tracking-[0.5em] text-on-surface focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all placeholder:text-outline/50 outline-none font-black"
                          placeholder="000000"
                        />
                      </div>
                      <p className="text-[11px] text-on-surface-variant/70 font-body leading-relaxed ml-1">
                        Enter the code from your login sheet — no email needed.
                      </p>
                    </div>

                    <button
                      type="submit"
                      disabled={isAuthenticating}
                      className="w-full flex justify-center items-center gap-2.5 py-3.5 px-6 bg-gradient-to-r from-primary to-primary-container text-white text-xs font-black uppercase tracking-[0.2em] rounded-xl shadow-lg shadow-primary/10 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-75"
                    >
                      {isAuthenticating ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <span>Sign In to Portal</span>
                          <span className="material-symbols-outlined text-base">login</span>
                        </>
                      )}
                    </button>
                  </form>
                ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <label className="block text-xs font-black uppercase tracking-widest text-on-surface-variant ml-1">Username or Email</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <span className="material-symbols-outlined text-outline group-focus-within:text-primary transition-colors text-lg">person</span>
                      </div>
                      <input
                        type="text"
                        required
                        value={loginId}
                        onChange={(e) => setLoginId(e.target.value)}
                        className="block w-full pl-11 pr-4 py-3.5 bg-surface-container border-none rounded-xl text-xs text-on-surface focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all placeholder:text-outline/50 outline-none font-bold"
                        placeholder="e.g. rahul.sharma"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center mb-2 ml-1">
                      <label className="block text-xs font-black uppercase tracking-widest text-on-surface-variant">Password</label>
                      <button
                        type="button"
                        onClick={() => setShowForgotPw(true)}
                        className="text-xs font-black uppercase tracking-widest text-secondary hover:underline"
                      >
                        Forgot Password?
                      </button>
                    </div>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <span className="material-symbols-outlined text-outline group-focus-within:text-primary transition-colors text-lg">lock</span>
                      </div>
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="block w-full pl-11 pr-11 py-3.5 bg-surface-container border-none rounded-xl text-xs text-on-surface focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all placeholder:text-outline/50 outline-none font-bold"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-outline hover:text-primary"
                      >
                        <span className="material-symbols-outlined text-lg">{showPassword ? "visibility_off" : "visibility"}</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center">
                    <input
                      id="remember-me"
                      name="remember-me"
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="h-4 w-4 text-primary focus:ring-primary border-outline-variant rounded transition-all"
                    />
                    <label className="ml-2.5 block text-xs font-semibold text-on-surface-variant cursor-pointer" htmlFor="remember-me">
                      Remember my credentials
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={isAuthenticating}
                    className="w-full flex justify-center items-center gap-2.5 py-3.5 px-6 bg-gradient-to-r from-primary to-primary-container text-white text-xs font-black uppercase tracking-[0.2em] rounded-xl shadow-lg shadow-primary/10 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-75"
                  >
                    {isAuthenticating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <span>Sign In to Portal</span>
                        <span className="material-symbols-outlined text-base">login</span>
                      </>
                    )}
                  </button>
                </form>
                )}

                <div className="mt-8 pt-6 border-t border-surface-variant/30 text-center">
                  <p className="text-xs text-on-surface-variant font-semibold mb-3">New to the Parliament?</p>
                  <Link
                    to="/register"
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-secondary-container/10 text-on-secondary-container font-black uppercase tracking-widest text-xs hover:bg-secondary-container/15 transition-all"
                  >
                    Register for a Session
                    <span className="material-symbols-outlined text-base">arrow_forward</span>
                  </Link>
                </div>

                {/* Friendly Mascot Integration */}
                <div className="absolute bottom-4 right-8 flex items-center gap-2 opacity-30 cursor-default">
                  <span className="text-[8px] font-black uppercase tracking-widest text-primary">Trusted by Delegates</span>
                  <div className="w-6 h-6 rounded-full bg-tertiary-fixed flex items-center justify-center">
                    <span className="material-symbols-outlined text-on-tertiary-fixed text-xs">emoji_events</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Login;
