import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Navigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useToast } from "@/components/ui/use-toast";
import { Loader2, ArrowRight, ShieldCheck, Mail, Lock, Eye, EyeOff, User } from "lucide-react";

const Login = () => {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  
  const { user, loading, signIn } = useAuth();
  const { toast } = useToast();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto" />
          <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Preparing the Chamber...</p>
        </div>
      </div>
    );
  }

  // If user is already logged in, redirect to home
  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthenticating(true);
    
    // Auto-append correct domain based on alias pattern
    let loginEmail = loginId;
    if (!loginEmail.includes('@')) {
      const lowerLoginId = loginEmail.toLowerCase();
      
      // Detect role type and append appropriate domain
      if (lowerLoginId.startsWith('jury')) {
        loginEmail = `${loginEmail}@yip.com`;
      } else if (lowerLoginId.startsWith('admin')) {
        loginEmail = `${loginEmail}@yip.admin`;
      } else if (lowerLoginId.startsWith('journalist')) {
        loginEmail = `${loginEmail}@yip.journalism`;
      } else {
        // Default to student domain for numeric IDs
        loginEmail = `${loginEmail}@yip-parliament.com`;
      }
    }
    
    try {
      await signIn(loginEmail, password);
    } catch (error) {
      console.error('Login error:', error);
      toast({
        title: "Authentication Failed",
        description: "Please check your credentials and try again.",
        variant: "destructive"
      });
    } finally {
      setIsAuthenticating(false);
    }
  };

  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col font-body antialiased">
      {/* Header aligned with Register */}
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-3 rounded-full mt-4 max-w-6xl mx-auto bg-white/70 backdrop-blur-md shadow-xl shadow-indigo-500/10">
        <Link to="/" className="text-xl font-bold tracking-tight text-indigo-900 font-headline">
          Young Indians Parliament
        </Link>
        <div className="flex items-center gap-6">
          <Link to="/register" className="text-slate-600 hover:text-indigo-500 font-bold transition-all text-sm font-headline">
            Register
          </Link>
          <div className="h-4 w-[1px] bg-slate-200"></div>
          <p className="text-[10px] font-black uppercase tracking-widest text-[#13298f]">Delegate Access</p>
        </div>
      </header>

      <main className="flex-grow flex items-center justify-center pt-24 pb-12 px-4 md:px-0">
        <div className="w-full max-w-6xl grid md:grid-cols-2 bg-surface-container-lowest rounded-3xl overflow-hidden shadow-2xl shadow-primary/5 min-h-[600px]">
          {/* Left Panel: Matches Register.tsx */}
          <div className="hidden md:flex flex-col justify-between p-12 bg-[#13298f] relative overflow-hidden text-white">
            <div className="absolute inset-0 opacity-10 pointer-events-none">
              <svg height="100%" preserveAspectRatio="none" viewBox="0 0 100 100" width="100%">
                <defs><pattern height="10" id="dots" patternUnits="userSpaceOnUse" width="10"><circle cx="1" cy="1" fill="white" r="1"/></pattern></defs>
                <rect fill="url(#dots)" height="100" width="100"></rect>
              </svg>
            </div>
            <div className="relative z-10">
              <span className="inline-block px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-[10px] font-black uppercase tracking-[0.2em] mb-8">
                Official Access Portal
              </span>
              <h2 className="text-4xl font-black font-headline leading-tight mb-6">
                Return to the <br/><span className="text-[#6ffbbe]">parliament</span> floor.
              </h2>
              <p className="text-xl opacity-80 leading-relaxed font-medium max-w-md">
                Access your session drafts, voting history, and national rankings through your secure delegate portal.
              </p>
            </div>
            
            <div className="relative z-10 space-y-6">
               <div className="flex items-center gap-4 group">
                  <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-[#6ffbbe]/20 transition-all">
                     <Lock className="w-5 h-5 text-[#6ffbbe]" />
                  </div>
                  <div>
                     <p className="text-sm font-bold">Secure Access</p>
                     <p className="text-[10px] text-white/50 uppercase tracking-widest">End-to-end Encrypted</p>
                  </div>
               </div>
               <div className="flex items-center gap-4 group">
                  <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-[#6ffbbe]/20 transition-all">
                     <ShieldCheck className="w-5 h-5 text-[#6ffbbe]" />
                  </div>
                  <div>
                     <p className="text-sm font-bold">Delegate Verification</p>
                     <p className="text-[10px] text-white/50 uppercase tracking-widest">Official State Credentials</p>
                  </div>
               </div>
            </div>

            <div className="relative z-10 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#6ffbbe]/20 backdrop-blur-md flex items-center justify-center text-[#6ffbbe]">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <p className="font-bold text-sm text-white">Trust & Security</p>
                <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Protocol Compliant</p>
              </div>
            </div>
            
            <img 
              className="absolute bottom-[-15%] right-[-15%] w-full opacity-10 pointer-events-none transform -rotate-6 scale-125" 
              src="https://images.unsplash.com/photo-1571679654681-ba01b94b7467?auto=format&fit=crop&w=1200&q=80"
              alt="Indian Parliament"
            />
          </div>

          {/* Right Panel: Login Form */}
          <div className="flex flex-col justify-center p-8 md:p-12 lg:p-16 relative bg-white">
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <div>
                <h1 className="text-3xl font-black text-slate-900 mb-2 tracking-tight font-headline">Welcome Back</h1>
                <p className="text-slate-500 font-bold opacity-70 text-sm font-body leading-relaxed">
                  Enter your credentials to access the delegate chamber.
                </p>
              </div>

              <form className="space-y-6" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Username or Email</label>
                  <div className="relative group">
                    <User className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-[#13298f] transition-colors" />
                    <input 
                      type="text"
                      className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border-none rounded-2xl focus:bg-white focus:ring-2 focus:ring-primary/10 transition-all font-bold text-slate-800 placeholder:text-slate-300 shadow-inner"
                      placeholder="e.g. rahul.sharma"
                      required
                      value={loginId}
                      onChange={(e) => setLoginId(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center ml-1">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Password</label>
                    <a href="#" className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline">Forgot?</a>
                  </div>
                  <div className="relative group">
                    <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-[#13298f] transition-colors" />
                    <input 
                      type={showPassword ? "text" : "password"}
                      className="w-full pl-12 pr-12 py-3.5 bg-slate-50 border-none rounded-2xl focus:bg-white focus:ring-2 focus:ring-primary/10 transition-all font-bold text-slate-800 placeholder:text-slate-300 shadow-inner"
                      placeholder="••••••••"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button 
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-primary transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <button 
                  type="submit"
                  disabled={isAuthenticating}
                  className="w-full py-4 bg-[#13298f] text-white rounded-full font-black uppercase tracking-[0.2em] text-xs shadow-xl shadow-[#13298f]/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-70"
                >
                  {isAuthenticating ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Sign In to Portal <ArrowRight className="w-4 h-4" /></>}
                </button>

                <div className="text-center pt-8 border-t border-slate-100">
                  <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mb-4">Not part of a session?</p>
                  <Link to="/register" className="px-8 py-3 rounded-full border border-slate-200 text-slate-600 font-black uppercase tracking-widest text-[10px] hover:bg-slate-50 transition-all inline-block">
                    Register Now
                  </Link>
                </div>
              </form>
            </motion.div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Login;