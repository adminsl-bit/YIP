import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Navigate, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowRight, ShieldCheck, Mail, CheckCircle2 } from "lucide-react";

const Register = () => {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'mode' | 'email' | 'verify' | 'direct'>('mode');
  const [isLoading, setIsLoading] = useState(false);
  const [registrationEnabled, setRegistrationEnabled] = useState<boolean | null>(null);
  
  // Direct registration fields
  const [fullName, setFullName] = useState('');
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const { user, profile, signInWithOtp, verifyOtp, getSystemSetting, signUp, signIn } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const checkEnabled = async () => {
      const enabled = await getSystemSetting('registration_enabled');
      setRegistrationEnabled(enabled);
    };
    checkEnabled();
  }, [getSystemSetting]);

  // If user is already authenticated and has a profile, go to dashboard
  useEffect(() => {
    if (user && profile) {
      // Check if student has completed onboarding (has constituency assignment)
      const hasCompletedOnboarding = profile.user_type === 'student' 
        ? !!profile.constituency
        : true;

      if (!hasCompletedOnboarding) {
        navigate('/onboarding');
      } else if (profile.user_type === 'student') {
        navigate('/student');
      } else if (profile.user_type === 'jury') {
        navigate('/jury');
      } else if (profile.user_type === 'organizer') {
        navigate('/organizer');
      }
    } else if (user && !profile && !isLoading) {
      // Authenticated but no profile -> Go to onboarding
      navigate('/onboarding');
    }
  }, [user, profile, navigate, isLoading]);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { error } = await signInWithOtp(email);
      if (!error) {
        setStep('verify');
      }
    } catch (error) {
      console.error('OTP Request error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { error } = await verifyOtp(email, otp);
      if (!error) {
        // Success handled by the useEffect above
      }
    } catch (error) {
      console.error('OTP Verification error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFullNameChange = (val: string) => {
    setFullName(val);
    // Auto-generate Login ID: "First Last" -> "first.last"
    const suggestedId = val
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '.')
      .replace(/[^a-z0-9.]/g, '');
    setLoginId(suggestedId);
  };

  const handleDirectSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !loginId || !password) {
      toast({ title: "Required Fields", description: "Please fill all details.", variant: "destructive" });
      return;
    }
    
    setIsLoading(true);
    try {
      // Call the direct database registration function
      const { data, error } = await supabase.rpc('create_delegate_direct', {
        p_name: fullName,
        p_login_id: loginId.toLowerCase().trim(),
        p_password: password
      });
      
      if (error || (data && !data.success)) {
        const errorMsg = error?.message || data?.error || "Registration failed";
        if (errorMsg.includes('already registered') || errorMsg.includes('unique constraint')) {
          toast({ title: "ID Taken", description: "This Login ID is already in use. Please try another.", variant: "destructive" });
        } else {
          throw new Error(errorMsg);
        }
      } else {
        toast({ title: "Welcome, Delegate!", description: "Account created. Completing your setup..." });
        // Sign them in, then redirect to onboarding for party/committee assignment
        await signIn(loginId, password);
        navigate('/onboarding');
      }
    } catch (error: any) {
      console.error('Direct signup error:', error);
      toast({ title: "Enrollment Failed", description: error.message || "An unexpected error occurred.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  if (registrationEnabled === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <div className="max-w-md w-full text-center space-y-6 p-12 bg-surface-container-lowest rounded-[3rem] shadow-2xl">
          <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-inner">
            <span className="material-symbols-outlined text-4xl">lock_person</span>
          </div>
          <h1 className="text-3xl font-black font-headline text-slate-900 leading-tight">Registration Closed</h1>
          <p className="text-slate-500 font-medium leading-relaxed">
            Self-registration is currently closed for this session. Please talk to your organizer to get logged in.
          </p>
          <Link to="/" className="inline-block mt-4 text-primary font-bold hover:underline">
            Back to Hall
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col font-body antialiased">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-3 rounded-full mt-4 max-w-6xl mx-auto bg-white/70 backdrop-blur-md shadow-xl shadow-indigo-500/10">
        <Link to="/" className="text-xl font-bold tracking-tight text-indigo-900 font-headline">
          Young Indians Parliament
        </Link>
        <div className="flex items-center gap-6">
          <Link to="/login" className="text-slate-600 hover:text-indigo-500 font-bold transition-all text-sm font-headline">
            Login
          </Link>
          <div className="h-4 w-[1px] bg-slate-200"></div>
          <p className="text-[10px] font-black uppercase tracking-widest text-[#13298f]">Enrollment Portal</p>
        </div>
      </header>

      <main className="flex-grow flex items-center justify-center pt-24 pb-12 px-4 md:px-0">
        <div className="w-full max-w-6xl grid md:grid-cols-2 bg-surface-container-lowest rounded-3xl overflow-hidden shadow-2xl shadow-primary/5 min-h-[600px]">
          {/* Left Panel */}
          <div className="hidden md:flex flex-col justify-between p-12 bg-[#13298f] relative overflow-hidden text-white">
            <div className="absolute inset-0 opacity-10 pointer-events-none">
              <svg height="100%" preserveAspectRatio="none" viewBox="0 0 100 100" width="100%">
                <defs><pattern height="10" id="dots" patternUnits="userSpaceOnUse" width="10"><circle cx="1" cy="1" fill="white" r="1"/></pattern></defs>
                <rect fill="url(#dots)" height="100" width="100"></rect>
              </svg>
            </div>
            <div className="relative z-10">
              <span className="inline-block px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-[10px] font-black uppercase tracking-[0.2em] mb-8">
                Official Registration 2026
              </span>
              <h2 className="text-4xl font-black font-headline leading-tight mb-6">
                Begin your <span className="text-[#6ffbbe]">leadership</span> journey.
              </h2>
              <p className="text-xl opacity-80 leading-relaxed font-medium max-w-md">
                Secure your seat through our verify-first enrollment system. No passwords needed, just your identity.
              </p>
            </div>
            
            <div className="relative z-10 space-y-6">
               <div className="flex items-center gap-4 group">
                  <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-[#6ffbbe]/20 transition-all">
                     <span className="material-symbols-outlined text-[#6ffbbe]">badge</span>
                  </div>
                  <div>
                     <p className="text-sm font-bold">State Credentials</p>
                     <p className="text-[10px] text-white/50 uppercase tracking-widest">Official Delegate ID</p>
                  </div>
               </div>
               <div className="flex items-center gap-4 group">
                  <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-[#6ffbbe]/20 transition-all">
                     <CheckCircle2 className="w-5 h-5 text-[#6ffbbe]" />
                  </div>
                  <div>
                     <p className="text-sm font-bold">Instant Verification</p>
                     <p className="text-[10px] text-white/50 uppercase tracking-widest">Real-time Seat Assignment</p>
                  </div>
               </div>
            </div>

            <div className="relative z-10 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#6ffbbe]/20 backdrop-blur-md flex items-center justify-center text-[#6ffbbe]">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <p className="font-bold text-sm text-white">Encrypted Enrollment</p>
                <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Security by Design</p>
              </div>
            </div>
            
            <img 
              className="absolute bottom-[-15%] right-[-15%] w-full opacity-10 pointer-events-none transform -rotate-6 scale-125" 
              src="https://images.unsplash.com/photo-1571679654681-ba01b94b7467?auto=format&fit=crop&w=1200&q=80"
              alt="Indian Parliament"
            />
          </div>

          {/* Right Panel: Forms */}
          <div className="flex flex-col justify-center p-8 md:p-12 lg:p-16 relative bg-white overflow-y-auto max-h-[800px]">
            <AnimatePresence mode="wait">
              {step === 'mode' ? (
                <motion.div 
                  key="mode-step"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.05 }}
                  className="space-y-8"
                >
                  <div className="text-center">
                    <h1 className="text-3xl font-black text-slate-900 mb-2 tracking-tight font-headline">Join the Session</h1>
                    <p className="text-slate-500 font-bold opacity-70 text-sm font-body">Select your enrollment method to continue.</p>
                  </div>

                  <div className="space-y-4">
                    <button 
                      onClick={() => setStep('email')}
                      className="w-full p-6 rounded-3xl bg-slate-50 border-2 border-transparent hover:border-[#13298f]/20 transition-all flex flex-col items-center gap-3 group"
                    >
                      <div className="w-14 h-14 rounded-2xl bg-white shadow-xl flex items-center justify-center group-hover:scale-110 transition-all">
                        <Mail className="w-8 h-8 text-[#13298f]" />
                      </div>
                      <div className="text-center">
                        <p className="font-headline font-black text-slate-800">Email Enrollment</p>
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">Via Secure OTP Code</p>
                      </div>
                    </button>

                    <button 
                      onClick={() => setStep('direct')}
                      className="w-full p-6 rounded-3xl bg-[#13298f]/5 border-2 border-transparent hover:border-[#13298f]/20 transition-all flex flex-col items-center gap-3 group"
                    >
                      <div className="w-14 h-14 rounded-2xl bg-white shadow-xl flex items-center justify-center group-hover:scale-110 transition-all">
                        <span className="material-symbols-outlined text-4xl text-[#13298f]">badge</span>
                      </div>
                      <div className="text-center">
                        <p className="font-headline font-black text-slate-800">No Email Address?</p>
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">Enroll via Delegate ID</p>
                      </div>
                    </button>
                  </div>

                  <div className="text-center pt-8 border-t border-slate-100">
                    <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mb-4">Already Enrolled?</p>
                    <Link to="/login" className="px-8 py-3 rounded-full border border-slate-200 text-slate-600 font-black uppercase tracking-widest text-[10px] hover:bg-slate-50 transition-all inline-block">
                      Return to Login
                    </Link>
                  </div>
                </motion.div>
              ) : step === 'email' ? (
                <motion.div 
                  key="email-step"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-8"
                >
                  <button onClick={() => setStep('mode')} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-[#13298f] transition-colors mb-4">
                    <span className="material-symbols-outlined text-sm">arrow_back</span> Back
                  </button>
                  <div>
                    <h1 className="text-3xl font-black text-slate-900 mb-2 tracking-tight font-headline">New Enrollment</h1>
                    <p className="text-slate-500 font-bold opacity-70 text-sm font-body leading-relaxed">
                      Enter your official email to receive a registration code.
                    </p>
                  </div>

                  {registrationEnabled === null ? (
                    <div className="flex items-center gap-3 py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      <span className="font-bold text-slate-400 uppercase tracking-widest text-xs">Verifying Gateway...</span>
                    </div>
                  ) : (
                    <form className="space-y-6" onSubmit={handleRequestOtp}>
                      <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Official Email</label>
                        <div className="relative">
                          <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                          <input 
                            type="email"
                            className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border-none rounded-2xl focus:bg-white focus:ring-2 focus:ring-primary/10 transition-all font-bold text-slate-800 placeholder:text-slate-300 shadow-inner"
                            placeholder="rahul@university.edu"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                          />
                        </div>
                      </div>

                      <button 
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-4 bg-[#13298f] text-white rounded-full font-black uppercase tracking-[0.2em] text-xs shadow-xl shadow-[#13298f]/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-70"
                      >
                        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Request Secure Code <ArrowRight className="w-4 h-4" /></>}
                      </button>
                    </form>
                  )}
                </motion.div>
              ) : step === 'verify' ? (
                <motion.div 
                  key="verify-step"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-8"
                >
                  <div>
                    <h1 className="text-3xl font-black text-slate-900 mb-2 tracking-tight font-headline">Verify Identity</h1>
                    <p className="text-slate-500 font-bold opacity-70 text-sm font-body leading-relaxed">
                      We've sent an 8-digit verification code to <span className="text-[#13298f] underline underline-offset-4">{email}</span>.
                    </p>
                  </div>

                  <form className="space-y-6" onSubmit={handleVerifyOtp}>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Verification Code</label>
                      <input 
                        type="text"
                        maxLength={8}
                        className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:bg-white focus:ring-2 focus:ring-primary/10 transition-all font-black text-slate-800 placeholder:text-slate-300 text-center text-3xl tracking-[0.5em] shadow-inner"
                        placeholder="00000000"
                        required
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                      />
                    </div>

                    <button 
                      type="submit"
                      disabled={isLoading}
                      className="w-full py-4 bg-[#13298f] text-white rounded-full font-black uppercase tracking-[0.2em] text-xs shadow-xl shadow-[#13298f]/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-70"
                    >
                      {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Verify & Continue <ArrowRight className="w-4 h-4" /></>}
                    </button>

                    <div className="text-center pt-8 flex items-center justify-between border-t border-slate-100">
                      <button 
                        type="button"
                        onClick={() => setStep('email')}
                        className="text-slate-400 font-bold text-[10px] uppercase tracking-widest hover:text-[#13298f] transition-colors"
                      >
                        Change Email
                      </button>
                      <button 
                        type="button"
                        onClick={handleRequestOtp}
                        className="text-[#13298f] font-black text-[10px] uppercase tracking-widest border-b-2 border-[#13298f]/20"
                      >
                        Resend Code
                      </button>
                    </div>
                  </form>
                </motion.div>
              ) : (
                <motion.div 
                  key="direct-step"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-8"
                >
                  <button onClick={() => setStep('mode')} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-[#13298f] transition-colors mb-4">
                    <span className="material-symbols-outlined text-sm">arrow_back</span> Back
                  </button>
                  <div>
                    <h1 className="text-3xl font-black text-slate-900 mb-2 tracking-tight font-headline">Direct Enrollment</h1>
                    <p className="text-slate-500 font-bold opacity-70 text-sm font-body leading-relaxed">
                      Enroll as a delegate without an email address.
                    </p>
                  </div>

                  <form className="space-y-6" onSubmit={handleDirectSignUp}>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                        <input 
                          type="text"
                          className="w-full px-5 py-3.5 bg-slate-50 border-none rounded-2xl focus:bg-white focus:ring-2 focus:ring-primary/10 transition-all font-bold text-slate-800 placeholder:text-slate-300 shadow-inner"
                          placeholder="e.g. Arjun Kapoor"
                          required
                          value={fullName}
                          onChange={(e) => handleFullNameChange(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Choose Login ID</label>
                        <input 
                          type="text"
                          className="w-full px-5 py-3.5 bg-slate-50 border-none rounded-2xl focus:bg-white focus:ring-2 focus:ring-primary/10 transition-all font-bold text-slate-800 placeholder:text-slate-300 shadow-inner"
                          placeholder="e.g. arjun.delegate"
                          required
                          value={loginId}
                          onChange={(e) => setLoginId(e.target.value.toLowerCase().replace(/\s/g, ''))}
                        />
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider ml-1">You will use this to login later</p>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Secret Password</label>
                        <div className="relative group">
                          <input 
                            type={showPassword ? "text" : "password"}
                            className="w-full pl-5 pr-11 py-3.5 bg-slate-50 border-none rounded-2xl focus:bg-white focus:ring-2 focus:ring-primary/10 transition-all font-bold text-slate-800 placeholder:text-slate-300 shadow-inner"
                            placeholder="••••••••"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                          />
                          <button 
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-primary transition-colors focus:outline-none"
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                          >
                            <span className="material-symbols-outlined text-lg">{showPassword ? "visibility_off" : "visibility"}</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    <button 
                      type="submit"
                      disabled={isLoading}
                      className="w-full py-4 bg-[#13298f] text-white rounded-full font-black uppercase tracking-[0.2em] text-xs shadow-xl shadow-[#13298f]/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-70"
                    >
                      {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Complete Enrollment <ArrowRight className="w-4 h-4" /></>}
                    </button>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>

  );
};

export default Register;
