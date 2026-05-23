import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from "@/components/ui/use-toast";
import { Loader2, ArrowRight, ArrowLeft, User, MapPin, Landmark, Sparkles, CheckCircle2 } from "lucide-react";

const Onboarding = () => {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState({
    name: '',
    state: '',
    city: '',
  });

  // Assigned Details (derived on submission)
  const [assignedDetails, setAssignedDetails] = useState<{ 
    serial: number; 
    partyName: string; 
    committee: string;
    constituency: string;
  } | null>(null);

  useEffect(() => {
    if (profile && profile.serial_number) {
      // If profile already exists with serial number, skip onboarding
      navigate('/student');
    }
  }, [profile, navigate]);

  const nextStep = () => setStep(s => s + 1);
  const prevStep = () => setStep(s => s - 1);

  const states = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", 
    "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", 
    "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", 
    "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", 
    "Uttarakhand", "West Bengal", "Delhi", "Jammu and Kashmir", "Ladakh", "Puducherry", 
    "Chandigarh", "Andaman and Nicobar Islands", "Dadra and Nagar Haveli and Daman and Diu", 
    "Lakshadweep"
  ];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    if (!user) return;
    setIsSubmitting(true);
    
    try {
      // 1. Fetch System-Driven Assignment Configuration
      const { data: settings, error: settingsError } = await supabase
        .from('system_settings')
        .select('setting_key, setting_value')
        .in('setting_key', ['assignment_parties', 'assignment_committees', 'assignment_constituencies']);

      if (settingsError) throw settingsError;

      const parties = (settings?.find(s => s.setting_key === 'assignment_parties')?.setting_value as string[]) || [];
      const committees = (settings?.find(s => s.setting_key === 'assignment_committees')?.setting_value as string[]) || [];
      const allConstituencies = (settings?.find(s => s.setting_key === 'assignment_constituencies')?.setting_value as any[]) || [];

      if (parties.length === 0 || committees.length === 0 || allConstituencies.length === 0) {
        throw new Error("System configuration missing. Please contact administration.");
      }

      const southernStates = [
        'tamil nadu', 'tamilnadu', 'kerala', 'karnataka', 'andhra pradesh', 'telangana', 'puducherry'
      ];

      // 2. Get current student count for balanced distribution
      // Using a deterministic but fair distribution based on existing count
      const { count: studentCount, error: countError } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('user_type', 'student');

      if (countError) throw countError;

      const currentCount = studentCount || 0;
      const nextSerial = 1001 + currentCount;

      // Special Exemption for Demo Accounts
      const isDemoAccount = ['demo admin', 'demo journalist'].includes(formData.name.toLowerCase().trim());
      
      const partyName = isDemoAccount ? null : parties[currentCount % parties.length];
      const partyNumber = isDemoAccount ? 0 : (currentCount % parties.length) + 1;
      const committee = isDemoAccount ? null : committees[currentCount % committees.length];
      
      // Regional exemption logic: Students from Southern states are assigned to non-Southern constituencies
      const userState = formData.state.toLowerCase().trim().replace(/\s/g, '');
      const isFromSouth = southernStates.some(s => s.replace(/\s/g, '') === userState);
      
      const availableConstituencies = isFromSouth 
        ? allConstituencies.filter(c => c.region !== 'Southern')
        : allConstituencies;
      
      // Select constituency based on modulo of current count to ensure distribution
      const constituency = availableConstituencies[currentCount % availableConstituencies.length].name;

      // 4. Determine Parliamentary Alignment (Proportional Split)
      let partyAlignment: 'ruling_party' | 'opposition' | 'non_aligned' = 'non_aligned';
      if (!isDemoAccount) {
        const rulingThreshold = Math.ceil(parties.length * 0.4);
        const oppositionThreshold = Math.ceil(parties.length * 0.8);

        if (partyNumber <= rulingThreshold) {
          partyAlignment = 'ruling_party';
        } else if (partyNumber <= oppositionThreshold) {
          partyAlignment = 'opposition';
        } else {
          partyAlignment = 'non_aligned';
        }
      }

      // 4. Create or Update Profile
      const { error: insertError } = await supabase
        .from('profiles')
        .upsert({
          user_id: user.id,
          name: formData.name.trim(),
          state: formData.state.trim(),
          city: formData.city.trim(),
          constituency: constituency,
          position: 'Member of Parliament',
          party_name: partyName,
          party_number: partyNumber,
          committee: committee,
          serial_number: nextSerial,
          user_type: 'student',
          is_active: true,
          email: user.email,
          party_alignment: partyAlignment
        }, { onConflict: 'user_id' });

      if (insertError) throw insertError;

      setAssignedDetails({ 
        serial: nextSerial, 
        partyName: partyName || 'N/A',
        committee: committee || 'N/A',
        constituency: constituency
      });
      
      await refreshProfile();
      setStep(3); // Move to success summary
      
      toast({
        title: "Registration Validated",
        description: `Parliamentary profile generated for ${formData.name}.`,
      });
    } catch (error: any) {
      console.error('Onboarding error:', error);
      toast({
        variant: "destructive",
        title: "System Error",
        description: error.message || "Unable to process registration. Please contact administration.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
          >
            <div className="space-y-2">
              <span className="text-primary font-black uppercase tracking-[0.2em] text-[10px] bg-primary/5 px-3 py-1 rounded-full">Step 01 / Protocol</span>
              <h2 className="text-4xl font-black font-headline text-slate-900 leading-tight tracking-tight">Identity Verification</h2>
              <p className="text-slate-500 font-medium text-lg">Enter your legal name as it should appear in the parliamentary registry.</p>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Official Name</label>
                <div className="relative group">
                  <div className="absolute inset-0 bg-primary/5 rounded-3xl blur-xl group-focus-within:bg-primary/10 transition-all" />
                  <User className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-300 group-focus-within:text-primary transition-colors z-10" />
                  <input 
                    name="name"
                    className="relative w-full pl-16 pr-6 py-6 bg-slate-50 border-2 border-transparent rounded-3xl focus:bg-white focus:border-primary/10 transition-all font-bold text-slate-800 placeholder:text-slate-300 shadow-inner text-lg z-10"
                    placeholder="e.g. Arjun Sharma"
                    required
                    autoFocus
                    value={formData.name}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <button 
                onClick={nextStep}
                disabled={!formData.name || formData.name.length < 3}
                className="w-full py-6 bg-[#13298f] text-white rounded-[2.5rem] font-black uppercase tracking-[0.2em] text-sm shadow-2xl shadow-[#13298f]/20 hover:scale-[1.02] hover:shadow-[#13298f]/40 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-30 disabled:hover:scale-100"
              >
                Proceed to Location <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        );
      case 2:
        return (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
          >
            <div className="space-y-2">
              <span className="text-primary font-black uppercase tracking-[0.2em] text-[10px] bg-primary/5 px-3 py-1 rounded-full">Step 02 / Demographics</span>
              <h2 className="text-4xl font-black font-headline text-slate-900 leading-tight tracking-tight">Regional Details</h2>
              <p className="text-slate-500 font-medium text-lg">Constituencies and committees are assigned based on institutional balance protocols.</p>
            </div>

            <div className="grid grid-cols-1 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Home State</label>
                <div className="relative group">
                  <MapPin className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-300 group-focus-within:text-primary transition-colors z-10" />
                  <select 
                    name="state"
                    className="w-full pl-16 pr-6 py-5 bg-slate-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-primary/10 transition-all font-bold text-slate-800 shadow-inner z-10 appearance-none cursor-pointer"
                    value={formData.state}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="" disabled>Select your state</option>
                    {states.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none z-10">
                    <ArrowRight className="w-4 h-4 text-slate-300 rotate-90" />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Current City</label>
                <div className="relative group">
                  <Landmark className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-300 group-focus-within:text-primary transition-colors z-10" />
                  <input 
                    name="city"
                    className="w-full pl-16 pr-6 py-5 bg-slate-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-primary/10 transition-all font-bold text-slate-800 shadow-inner z-10"
                    placeholder="e.g. Chennai"
                    value={formData.city}
                    onChange={handleInputChange}
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <button 
                onClick={prevStep}
                className="flex-1 py-6 bg-slate-100 text-slate-500 rounded-[2.5rem] font-black uppercase tracking-[0.2em] text-xs hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button 
                onClick={handleSubmit}
                disabled={isSubmitting || !formData.state || !formData.city}
                className="flex-[2] py-6 bg-[#13298f] text-white rounded-[2.5rem] font-black uppercase tracking-[0.2em] text-sm shadow-2xl shadow-[#13298f]/20 hover:scale-[1.02] hover:shadow-[#13298f]/40 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-30 disabled:hover:scale-100"
              >
                {isSubmitting ? (
                  <>Processing... <Loader2 className="w-5 h-5 animate-spin" /></>
                ) : (
                  <>Initialize Profile <Sparkles className="w-5 h-5" /></>
                )}
              </button>
            </div>
          </motion.div>
        );

      case 3:
        return (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center space-y-10"
          >
            <div className="relative inline-block">
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", damping: 12, delay: 0.2 }}
                className="w-24 h-24 bg-emerald-500 text-white rounded-[2rem] flex items-center justify-center mx-auto shadow-2xl shadow-emerald-200 relative z-10"
              >
                <CheckCircle2 className="w-12 h-12" />
              </motion.div>
              <div className="absolute inset-0 bg-emerald-500/20 blur-3xl rounded-full scale-150 animate-pulse" />
            </div>
            
            <div className="space-y-3">
              <h2 className="text-4xl font-black font-headline text-slate-900 leading-tight tracking-tight">Identity Confirmed</h2>
              <p className="text-slate-500 font-medium text-lg px-4">The assembly has acknowledged your registration. Your parliamentary credentials have been generated.</p>
            </div>

            {/* Parliamentary Identity Card */}
            <div className="relative group perspective-1000 py-4">
              {/* Outer Glow */}
              <div className="absolute inset-0 bg-gradient-to-br from-[#13298f]/20 via-indigo-500/10 to-emerald-500/10 rounded-[3rem] blur-3xl opacity-50 group-hover:opacity-70 transition-opacity" />
              
              <motion.div 
                initial={{ rotateY: -10, opacity: 0 }}
                animate={{ rotateY: 0, opacity: 1 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="relative bg-white/70 backdrop-blur-2xl border border-white/50 rounded-[3rem] overflow-hidden shadow-[0_32px_64px_-12px_rgba(19,41,143,0.06)] transition-all duration-500 hover:shadow-[0_48px_80px_-12px_rgba(19,41,143,0.1)] group-hover:scale-[1.01]"
              >
                {/* Holographic Overlay Effect */}
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform [transition-duration:2s] ease-in-out pointer-events-none z-20" />
                
                {/* Card Header */}
                <div className="bg-gradient-to-r from-[#13298f] to-[#3042a6] p-8 text-white relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
                  <div className="absolute bottom-0 left-0 w-24 h-24 bg-emerald-400/20 rounded-full translate-y-1/2 -translate-x-1/2 blur-xl" />
                  
                  <div className="flex justify-between items-start relative z-10">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md shadow-inner border border-white/20">
                        <Landmark className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <span className="block font-black text-[10px] uppercase tracking-[0.4em] opacity-80 mb-1">Youth Parliament of India</span>
                        <h3 className="font-headline font-black text-lg tracking-tight">Official Delegate Card</h3>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="bg-white/20 px-3 py-1 rounded-full backdrop-blur-md border border-white/10 mb-2">
                        <span className="block text-[8px] font-black uppercase tracking-widest opacity-80">Reference ID</span>
                        <span className="font-black text-xs font-mono">#{assignedDetails?.serial}</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Card Body */}
                <div className="p-10 space-y-10 relative">
                  {/* Subtle Background Pattern */}
                  <div className="absolute inset-0 opacity-[0.03] pointer-events-none overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-full" style={{ backgroundImage: 'radial-gradient(#13298f 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
                  </div>

                  <div className="flex items-center justify-between relative z-10">
                    <div className="space-y-2">
                      <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Parliamentary Delegate</p>
                      <h2 className="text-3xl font-black text-slate-900 font-headline leading-none">{formData.name}</h2>
                    </div>
                    <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center border-2 border-dashed border-slate-200">
                      <User className="w-8 h-8 text-slate-300" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-10 pt-8 border-t border-slate-100 relative z-10">
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Constituency</p>
                      <p className="text-base font-bold text-slate-800 flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-primary/40" />
                        {assignedDetails?.constituency}
                      </p>
                    </div>
                    {assignedDetails?.committee !== 'N/A' && (
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Committee</p>
                        <p className="text-base font-bold text-slate-800 flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-primary/40" />
                          {assignedDetails?.committee}
                        </p>
                      </div>
                    )}
                    
                    {assignedDetails?.partyName !== 'N/A' && (
                      <div className="space-y-1.5 col-span-2 bg-slate-50/50 p-6 rounded-3xl border border-slate-100/50">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Political Assignment</p>
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#13298f] to-indigo-600 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-[#13298f]/20">
                            {assignedDetails?.partyName.charAt(0)}
                          </div>
                          <div>
                            <p className="text-lg font-black text-slate-900 leading-tight">{assignedDetails?.partyName}</p>
                            <p className="text-[10px] font-bold text-[#13298f] uppercase tracking-widest opacity-60">Yi Parliamentary Bloc</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Secure Footer */}
                <div className="bg-slate-50/80 px-10 py-4 flex justify-between items-center border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Status: Active Registry</span>
                  </div>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map(i => (
                      <div key={i} className="w-1 h-3 bg-slate-200 rounded-full" />
                    ))}
                  </div>
                </div>
              </motion.div>
            </div>

            <button 
              onClick={() => navigate('/student')}
              className="w-full py-6 bg-gradient-to-r from-[#13298f] to-[#3042a6] text-white rounded-[2.5rem] font-black uppercase tracking-[0.2em] text-sm shadow-2xl shadow-[#13298f]/30 hover:scale-[1.02] hover:shadow-[#13298f]/50 transition-all flex items-center justify-center gap-3 relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 skew-x-12" />
              Enter Your Dashboard <ArrowRight className="w-6 h-6" />
            </button>
          </motion.div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col font-body antialiased selection:bg-primary/20">
      {/* Visual Background Elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-primary/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/5 rounded-full blur-[120px]" />
      </div>

      <main className="flex-grow flex items-center justify-center py-20 px-4 relative z-10">
        <div className="w-full max-w-xl">
          <div className="bg-white rounded-[3.5rem] p-10 md:p-14 shadow-2xl shadow-slate-200/50 border border-slate-50">
            <AnimatePresence mode="wait">
              {renderStep()}
            </AnimatePresence>
          </div>
          
          <div className="mt-8 text-center flex items-center justify-center gap-2">
            <ShieldCheck className="w-4 h-4 text-slate-300" />
            <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">Verified Secure Session</span>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Onboarding;

const ShieldCheck = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
