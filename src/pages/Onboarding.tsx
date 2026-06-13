import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from "@/components/ui/use-toast";
import { Loader2, ArrowRight, ArrowLeft, User, MapPin, Landmark, Sparkles, CheckCircle2 } from "lucide-react";

interface ActiveEventCity {
  id: string;
  city: string;
  state: string;
}

const STATE_REGION: Record<string, string> = {
  'Delhi': 'North', 'Haryana': 'North', 'Punjab': 'North', 'Himachal Pradesh': 'North',
  'Uttarakhand': 'North', 'Jammu and Kashmir': 'North', 'Ladakh': 'North',
  'Uttar Pradesh': 'North', 'Rajasthan': 'North', 'Chandigarh': 'North',
  'Tamil Nadu': 'South', 'Kerala': 'South', 'Karnataka': 'South',
  'Andhra Pradesh': 'South', 'Telangana': 'South', 'Puducherry': 'South', 'Lakshadweep': 'South',
  'West Bengal': 'East', 'Odisha': 'East', 'Bihar': 'East', 'Jharkhand': 'East',
  'Assam': 'East', 'Meghalaya': 'East', 'Manipur': 'East', 'Mizoram': 'East',
  'Nagaland': 'East', 'Tripura': 'East', 'Arunachal Pradesh': 'East', 'Sikkim': 'East',
  'Andaman and Nicobar Islands': 'East',
  'Maharashtra': 'West', 'Gujarat': 'West', 'Goa': 'West',
  'Madhya Pradesh': 'West', 'Chhattisgarh': 'West',
  'Dadra and Nagar Haveli and Daman and Diu': 'West',
};

const Onboarding = () => {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeEventCities, setActiveEventCities] = useState<ActiveEventCity[]>([]);
  const [loadingCities, setLoadingCities] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

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

  // Fetch only cities that have an active city-level event
  useEffect(() => {
    supabase
      .from('events')
      .select('id, city, state')
      .eq('status', 'active')
      .eq('level', 'city')
      .not('city', 'is', null)
      .then(({ data }) => {
        if (data) {
          const unique = data
            .filter(e => e.city)
            .filter((e, i, arr) => arr.findIndex(x => x.city === e.city) === i)
            .sort((a, b) => (a.city ?? '').localeCompare(b.city ?? '')) as ActiveEventCity[];
          setActiveEventCities(unique);
        }
        setLoadingCities(false);
      });
  }, []);

  useEffect(() => {
    if (profile && profile.constituency) {
      navigate('/student');
    }
    if (profile?.name && !formData.name) {
      setFormData(prev => ({ ...prev, name: profile.name }));
    }
  }, [profile, navigate]);

  const nextStep = () => setStep(s => s + 1);
  const prevStep = () => setStep(s => s - 1);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // When city is chosen from an active event, auto-fill state from the event record
  const handleCitySelect = (city: string) => {
    const match = activeEventCities.find(e => e.city === city);
    setFormData(prev => ({
      ...prev,
      city,
      state: match?.state || prev.state,
    }));
    setSelectedEventId(match?.id || null);
  };

  const handleSubmit = async () => {
    if (!user) return;
    setIsSubmitting(true);
    
    try {
      if (!selectedEventId) {
        throw new Error("System configuration missing. Please contact administration.");
      }

      // 1. Fetch System-Driven Assignment Configuration
      const { data: settings, error: settingsError } = await supabase
        .from('system_settings')
        .select('setting_key, setting_value')
        .eq('setting_key', 'assignment_constituencies');

      if (settingsError) throw settingsError;

      const { data: committeeRows } = await supabase
        .from('event_committees')
        .select('name')
        .eq('event_id', selectedEventId)
        .order('display_order');
      const { data: partyRows } = await supabase
        .from('event_parties')
        .select('name')
        .eq('event_id', selectedEventId)
        .order('display_order');

      const committees = (committeeRows ?? []).map((r: { name: string }) => r.name);
      const parties = (partyRows ?? []).map((r: { name: string }) => r.name);
      const allConstituencies = (settings?.find(s => s.setting_key === 'assignment_constituencies')?.setting_value as any[]) || [];

      if (parties.length === 0 || committees.length === 0 || allConstituencies.length === 0) {
        throw new Error("System configuration missing. Please contact administration.");
      }

      const southernStates = [
        'tamil nadu', 'tamilnadu', 'kerala', 'karnataka', 'andhra pradesh', 'telangana', 'puducherry'
      ];

      // 2. Count ALL students for serial number (includes admin/journalist)
      const { count: totalStudentCount, error: totalCountError } = await supabase
        .from('profiles')
        .select('user_id', { count: 'exact', head: true })
        .eq('user_type', 'student');

      if (totalCountError) throw totalCountError;

      // Count only parliamentary members for party/alignment distribution
      // Excludes Admin Student and Journalist so their registrations don't skew the cycle
      const { count: mpCount, error: countError } = await supabase
        .from('profiles')
        .select('user_id', { count: 'exact', head: true })
        .eq('user_type', 'student')
        .neq('position', 'Admin Student')
        .neq('position', 'Journalist');

      if (countError) throw countError;

      const currentCount = mpCount || 0;           // drives party/committee/constituency/alignment
      const nextSerial = 1001 + (totalStudentCount || 0); // serial still based on all students

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

      // 4. Parliamentary Alignment — algorithmic, based on majority/minority bench split
      let partyAlignment: 'ruling_party' | 'opposition' | 'non_aligned' = 'non_aligned';
      if (!isDemoAccount) {
        const rulingThreshold = Math.floor(parties.length / 2) + 1;
        partyAlignment = partyNumber <= rulingThreshold ? 'ruling_party' : 'opposition';
      }

      // 4. Create or Update Profile
      const profileData = {
        name: formData.name.trim(),
        state: formData.state.trim(),
        city: formData.city.trim(),
        constituency: constituency,
        position: 'Member of Parliament',
        party_name: partyName,
        party_number: partyNumber,
        committee: committee,
        serial_number: nextSerial,
        user_type: 'student' as const,
        is_active: true,
        email: user.email,
        party_alignment: partyAlignment,
        event_id: selectedEventId,
      };

      let insertError;

      // Check if profile already exists (e.g. from direct registration)
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingProfile) {
        // Update existing profile with onboarding data
        const { error } = await supabase
          .from('profiles')
          .update(profileData)
          .eq('user_id', user.id);
        insertError = error;
      } else {
        // Create new profile
        const { error } = await supabase
          .from('profiles')
          .insert({ ...profileData, user_id: user.id });
        insertError = error;
      }

      if (insertError) throw insertError;

      setAssignedDetails({ 
        serial: nextSerial, 
        partyName: partyName || 'N/A',
        committee: committee || 'N/A',
        constituency: constituency
      });
      
      await refreshProfile();
      setStep(3); // 3 = identity card

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
              <h2 className="text-4xl font-black font-headline text-slate-900 leading-tight tracking-tight">Select Your City</h2>
              <p className="text-slate-500 font-medium text-lg">Choose the city where your parliament session is taking place.</p>
            </div>

            <div className="grid grid-cols-1 gap-6">
              {/* City — driven by active events */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Parliament City</label>
                <div className="relative group">
                  <Landmark className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-300 group-focus-within:text-primary transition-colors z-10" />
                  {loadingCities ? (
                    <div className="w-full pl-16 pr-6 py-5 bg-slate-50 rounded-2xl flex items-center gap-3">
                      <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                      <span className="text-slate-400 font-bold text-sm">Loading active sessions…</span>
                    </div>
                  ) : activeEventCities.length === 0 ? (
                    <div className="w-full p-6 bg-amber-50 rounded-2xl border-2 border-amber-200 space-y-4">
                      <div className="flex items-start gap-3">
                        <span className="material-symbols-outlined text-amber-500 text-[22px] mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>event_busy</span>
                        <div>
                          <p className="text-amber-800 font-black text-sm">No active parliament sessions right now</p>
                          <p className="text-amber-700 font-medium text-xs mt-1 leading-relaxed">Your registration is saved. Come back once your organizer has opened a session for your city, or contact administration to confirm your event date.</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={async () => { await signOut(); navigate('/login'); }}
                        className="w-full py-3 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-800 font-black text-xs uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
                      >
                        <span className="material-symbols-outlined text-[16px]">logout</span>
                        Sign Out & Return Later
                      </button>
                    </div>
                  ) : (
                    <>
                      <select
                        name="city"
                        className="w-full pl-16 pr-6 py-5 bg-slate-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-primary/10 transition-all font-bold text-slate-800 shadow-inner z-10 appearance-none cursor-pointer"
                        value={formData.city}
                        onChange={e => handleCitySelect(e.target.value)}
                        required
                      >
                        <option value="" disabled>Select your parliament city</option>
                        {activeEventCities.map(ev => (
                          <option key={ev.city} value={ev.city}>{ev.city}</option>
                        ))}
                      </select>
                      <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none z-10">
                        <ArrowRight className="w-4 h-4 text-slate-300 rotate-90" />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* State — auto-filled from event, read-only */}
              {formData.city && formData.state && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-2"
                >
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">State / Region</label>
                  <div className="flex items-center gap-3 pl-6 pr-4 py-4 bg-primary/5 rounded-2xl border-2 border-primary/10">
                    <MapPin className="w-5 h-5 text-primary/60 shrink-0" />
                    <div className="flex-1">
                      <p className="font-bold text-slate-800">{formData.state}</p>
                      {STATE_REGION[formData.state] && (
                        <p className="text-[10px] font-black uppercase tracking-wider text-primary/60 mt-0.5">
                          {STATE_REGION[formData.state]} India
                        </p>
                      )}
                    </div>
                    <span className="material-symbols-outlined text-primary/40 text-[18px]">check_circle</span>
                  </div>
                </motion.div>
              )}
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
          
          <div className="mt-8 text-center flex items-center justify-center gap-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-slate-300" />
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">Verified Secure Session</span>
            </div>
            <span className="text-slate-200">·</span>
            <button
              type="button"
              onClick={async () => { await signOut(); navigate('/login'); }}
              className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] hover:text-slate-600 transition-colors flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[13px]">logout</span>
              Sign Out
            </button>
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
