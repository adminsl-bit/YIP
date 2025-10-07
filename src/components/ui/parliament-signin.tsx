'use client'
import React, { useState } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, ArrowRight, Crown, Users, Shield, ArrowLeft, Info } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from "@/lib/utils"
import { useAuth } from '@/hooks/useAuth';

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground border-input flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "aria-invalid:ring-destructive/20 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export function ParliamentSignIn() {
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'student' | 'admin_student' | 'jury' | 'organizer'>('student');
  const [credentials, setCredentials] = useState({
    loginId: 'demo',
    password: 'password'
  });
  const [isLoading, setIsLoading] = useState(false);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  
  const { signIn } = useAuth();

  // For 3D card effect
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const rotateX = useTransform(mouseY, [-300, 300], [5, -5]);
  const rotateY = useTransform(mouseX, [-300, 300], [-5, 5]);

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mouseX.set(e.clientX - rect.left - rect.width / 2);
    mouseY.set(e.clientY - rect.top - rect.height / 2);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Map role to actual login credentials
    const roleCredentials = {
      student: { loginId: '1702@yip.parliament', password: 'password' },
      admin_student: { loginId: '825@yip.parliament', password: 'password' },
      jury: { loginId: 'jury1@yip.org', password: 'password' },
      organizer: { loginId: '00@yip.org', password: 'password' }
    };
    
    const actualCredentials = roleCredentials[selectedRole];
    const { error } = await signIn(actualCredentials.loginId, actualCredentials.password);
    
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-orange-50 relative overflow-hidden text-slate-800">
      {/* Enhanced animated background - matching landing page */}
      <div className="absolute inset-0">
        {/* Enhanced dot pattern */}
        <div className="absolute top-0 left-0 w-full h-full opacity-60">
          <div className="absolute inset-0 bg-white/8" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.08'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            backgroundSize: '60px 60px'
          }}></div>
        </div>
        
        {/* Flowing gradient orbs */}
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-gradient-to-br from-orange-500/50 to-orange-300/30 rounded-full blur-2xl animate-pulse"></div>
        <div className="absolute top-1/2 -right-40 w-[28rem] h-[28rem] bg-gradient-to-bl from-green-500/45 to-green-300/25 rounded-full blur-2xl animate-pulse delay-1000"></div>
        <div className="absolute bottom-0 left-1/2 w-80 h-80 bg-gradient-to-t from-blue-500/40 to-blue-300/20 rounded-full blur-2xl animate-pulse delay-500"></div>
        
        {/* Floating bubbles */}
        <div className="absolute top-1/4 left-1/4 w-6 h-6 bg-orange-400/40 rounded-full animate-bounce shadow-lg shadow-orange-400/20" style={{animationDelay: '0s', animationDuration: '3s'}}></div>
        <div className="absolute top-3/4 left-1/3 w-8 h-8 bg-green-400/35 rounded-full animate-bounce shadow-lg shadow-green-400/20" style={{animationDelay: '1s', animationDuration: '4s'}}></div>
        <div className="absolute top-1/2 right-1/4 w-5 h-5 bg-blue-400/45 rounded-full animate-bounce shadow-lg shadow-blue-400/20" style={{animationDelay: '2s', animationDuration: '3.5s'}}></div>
        
        {/* Curved glass elements */}
        <div className="absolute top-20 right-20 w-64 h-32 bg-white/20 backdrop-blur-sm rounded-full border border-white/30 shadow-xl transform rotate-12 animate-pulse" style={{animationDelay: '1s', animationDuration: '8s'}}></div>
        <div className="absolute bottom-40 left-20 w-48 h-48 bg-gradient-to-br from-orange-400/20 to-green-400/20 backdrop-blur-sm rounded-full border border-white/30 shadow-xl transform -rotate-6 animate-pulse" style={{animationDelay: '3s', animationDuration: '10s'}}></div>
      </div>

      {/* Content */}
      <div className="relative z-10 flex items-center justify-center min-h-screen p-4">
        {/* Back Button */}
        <div className="absolute top-8 left-8">
          <Link to="/">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-white/20 backdrop-blur-lg border border-white/30 rounded-2xl px-6 py-3 text-slate-800 hover:bg-white/30 transition-all duration-300 shadow-lg flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </motion.button>
          </Link>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="w-full max-w-md relative"
          style={{ perspective: 1500 }}
        >
          <motion.div
            className="relative"
            style={{ rotateX, rotateY }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            whileHover={{ z: 10 }}
          >
            <div className="relative group">
              {/* Card glow effect */}
              <motion.div 
                className="absolute -inset-[1px] rounded-3xl opacity-0 group-hover:opacity-70 transition-opacity duration-700 pointer-events-none"
                animate={{
                  boxShadow: [
                    "0 0 20px 5px rgba(255,165,0,0.1)",
                    "0 0 30px 10px rgba(255,165,0,0.15)",
                    "0 0 20px 5px rgba(255,165,0,0.1)"
                  ],
                  opacity: [0.3, 0.5, 0.3]
                }}
                transition={{ 
                  duration: 4, 
                  repeat: Infinity, 
                  ease: "easeInOut", 
                  repeatType: "mirror" 
                }}
              />

              {/* Traveling light beam effect */}
              <div className="absolute -inset-[1px] rounded-3xl overflow-hidden pointer-events-none">
                <motion.div 
                  className="absolute top-0 left-0 h-[3px] w-[50%] bg-gradient-to-r from-transparent via-orange-400/60 to-transparent"
                  animate={{ 
                    left: ["-50%", "100%"],
                    opacity: [0.4, 0.8, 0.4]
                  }}
                  transition={{ 
                    left: { duration: 3, ease: "easeInOut", repeat: Infinity, repeatDelay: 1 },
                    opacity: { duration: 1.5, repeat: Infinity, repeatType: "mirror" }
                  }}
                />
                
                <motion.div 
                  className="absolute top-0 right-0 h-[50%] w-[3px] bg-gradient-to-b from-transparent via-green-400/60 to-transparent"
                  animate={{ 
                    top: ["-50%", "100%"],
                    opacity: [0.4, 0.8, 0.4]
                  }}
                  transition={{ 
                    top: { duration: 3, ease: "easeInOut", repeat: Infinity, repeatDelay: 1, delay: 0.8 },
                    opacity: { duration: 1.5, repeat: Infinity, repeatType: "mirror", delay: 0.8 }
                  }}
                />
              </div>

              {/* Glass card background */}
              <div className="relative bg-white/20 backdrop-blur-xl rounded-3xl p-8 border border-white/30 shadow-2xl overflow-hidden">
                {/* Subtle card inner patterns */}
                <div className="absolute inset-0 opacity-[0.05]" 
                  style={{
                    backgroundImage: `linear-gradient(135deg, #ff6b35 0.5px, transparent 0.5px), linear-gradient(45deg, #22c55e 0.5px, transparent 0.5px)`,
                    backgroundSize: '30px 30px'
                  }}
                />

                {/* Logo and header */}
                <div className="text-center space-y-2 mb-8">
                  <motion.h1
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="text-2xl font-bold text-slate-800"
                  >
                    Parliament Access
                  </motion.h1>
                  
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="text-slate-600 text-sm"
                  >
                    Young Indians Parliament - Madurai Regional Round
                  </motion.p>
                </div>

                {/* Login form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                  <motion.div className="space-y-4">
                    {/* Role Selector */}
                    <motion.div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Select Role</label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { value: 'student', label: 'Student', icon: Users },
                          { value: 'admin_student', label: 'Admin Student', icon: Crown },
                          { value: 'jury', label: 'Jury', icon: Shield },
                          { value: 'organizer', label: 'Organizer', icon: Crown }
                        ].map((role) => (
                          <motion.button
                            key={role.value}
                            type="button"
                            onClick={() => setSelectedRole(role.value as any)}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className={`p-3 rounded-xl border-2 transition-all duration-300 flex items-center justify-center gap-2 ${
                              selectedRole === role.value
                                ? 'bg-gradient-to-r from-blue-500/20 to-indigo-500/20 border-blue-500 text-slate-900 shadow-md'
                                : 'bg-white/10 border-white/30 text-slate-700 hover:bg-white/20'
                            }`}
                          >
                            <role.icon className="w-4 h-4" />
                            <span className="text-sm font-medium">{role.label}</span>
                          </motion.button>
                        ))}
                      </div>
                    </motion.div>

                    {/* Login ID input */}
                    <motion.div 
                      className={`relative ${focusedInput === "loginId" ? 'z-10' : ''}`}
                      whileFocus={{ scale: 1.02 }}
                      whileHover={{ scale: 1.01 }}
                      transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    >
                      <div className="relative flex items-center overflow-hidden rounded-lg">
                        <Mail className={`absolute left-3 w-4 h-4 transition-all duration-300 ${
                          focusedInput === "loginId" ? 'text-slate-800' : 'text-slate-500'
                        }`} />
                        
                        <Input
                          type="text"
                          placeholder="demo"
                          value={credentials.loginId}
                          onChange={(e) => setCredentials(prev => ({ ...prev, loginId: e.target.value }))}
                          onFocus={() => setFocusedInput("loginId")}
                          onBlur={() => setFocusedInput(null)}
                          className="w-full bg-white/10 border-transparent focus:border-white/40 text-slate-800 placeholder:text-slate-500 h-11 transition-all duration-300 pl-10 pr-3 focus:bg-white/20"
                          required
                        />
                        
                        {focusedInput === "loginId" && (
                          <motion.div 
                            layoutId="input-highlight"
                            className="absolute inset-0 bg-white/10 -z-10 rounded-lg"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                          />
                        )}
                      </div>
                    </motion.div>

                    {/* Password input */}
                    <motion.div 
                      className={`relative ${focusedInput === "password" ? 'z-10' : ''}`}
                      whileFocus={{ scale: 1.02 }}
                      whileHover={{ scale: 1.01 }}
                      transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    >
                      <div className="relative flex items-center overflow-hidden rounded-lg">
                        <Lock className={`absolute left-3 w-4 h-4 transition-all duration-300 ${
                          focusedInput === "password" ? 'text-slate-800' : 'text-slate-500'
                        }`} />
                        
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="password"
                          value={credentials.password}
                          onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
                          onFocus={() => setFocusedInput("password")}
                          onBlur={() => setFocusedInput(null)}
                          className="w-full bg-white/10 border-transparent focus:border-white/40 text-slate-800 placeholder:text-slate-500 h-11 transition-all duration-300 pl-10 pr-10 focus:bg-white/20"
                          required
                        />
                        
                        <div 
                          onClick={() => setShowPassword(!showPassword)} 
                          className="absolute right-3 cursor-pointer"
                        >
                          {showPassword ? (
                            <EyeOff className="w-4 h-4 text-slate-500 hover:text-slate-800 transition-colors duration-300" />
                          ) : (
                            <Eye className="w-4 h-4 text-slate-500 hover:text-slate-800 transition-colors duration-300" />
                          )}
                        </div>
                        
                        {focusedInput === "password" && (
                          <motion.div 
                            layoutId="input-highlight"
                            className="absolute inset-0 bg-white/10 -z-10 rounded-lg"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                          />
                        )}
                      </div>
                    </motion.div>
                  </motion.div>

                  {/* Sign in button */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={isLoading}
                    className="w-full relative group/button mt-6"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/30 to-indigo-500/30 rounded-2xl blur-lg opacity-0 group-hover/button:opacity-70 transition-opacity duration-300" />
                    
                    <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold h-12 rounded-2xl transition-all duration-300 flex items-center justify-center border border-white/20">
                      <AnimatePresence mode="wait">
                        {isLoading ? (
                          <motion.div
                            key="loading"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex items-center justify-center gap-2"
                          >
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Authenticating...
                          </motion.div>
                        ) : (
                          <motion.span
                            key="button-text"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex items-center justify-center gap-2 text-base font-bold"
                          >
                            <Crown className="w-5 h-5" />
                            Enter Parliament
                            <ArrowRight className="w-4 h-4 group-hover/button:translate-x-1 transition-transform duration-300" />
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.button>

                </form>
              </div>
            </div>
          </motion.div>

        </motion.div>

        {/* Help Text */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
          <p className="text-sm text-slate-600 text-center">
            Need help? Contact your organizer or technical support
          </p>
        </div>
      </div>
    </div>
  );
}