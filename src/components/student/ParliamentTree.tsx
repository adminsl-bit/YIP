import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { 
  Search, 
  Users, 
  Gavel, 
  ChevronRight,
  User,
  Lightbulb,
  School,
  CloudRain,
  Coins,
  ShieldCheck,
  Building,
  Rocket,
  Activity,
  Crown,
  Scale,
  Award,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { StudentProfile } from './StudentProfile';

interface Profile {
  id: string;
  user_id: string;
  name: string;
  position: string;
  party_number: number;
  party_name?: string;
  constituency?: string;
  state?: string;
  photo_url?: string;
  email?: string;
  committee?: string;
  ministry?: string;
  preevent_scores?: number;
  organizer_manual_score?: number;
  serial_number: number;
  user_type: string;
  city?: string;
  manifesto_about?: string;
  manifesto_problems?: any[];
  manifesto_solutions?: any[];
  updated_at?: string;
  party_alignment?: string;
  party_logo_url?: string;
  is_active?: boolean;
}

interface Committee {
  id: string;
  name: string;
  label: string;
  icon: any;
  people: Profile[];
  color: string;
  bgColor: string;
}

export const ParliamentTree = () => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);

  useEffect(() => {
    fetchProfiles();
    
    const channel = supabase
      .channel('public:profiles-tree')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        fetchProfiles();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          user_id,
          name,
          position,
          party_number,
          party_name,
          constituency,
          state,
          city,
          photo_url,
          email,
          committee,
          serial_number,
          user_type,
          updated_at,
          party_alignment,
          ministry,
          party_logo_url,
          is_active
        `)
        .eq('user_type', 'student')
        .order('name');
      
      if (error) throw error;
      setProfiles(data || []);
    } catch (err) {
      console.error('Error fetching profiles:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredProfiles = profiles.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.position.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.constituency?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.party_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.committee?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const speaker = profiles.find(p => p.position?.toLowerCase().includes('speaker') && !p.position?.toLowerCase().includes('deputy'));
  const deputySpeakers = profiles.filter(p => p.position?.toLowerCase().includes('deputy speaker'));
  const secretaryGeneral = profiles.find(p => p.position?.toLowerCase().includes('secretary general'));
  
  const rulingMembers = profiles.filter(p => p.party_alignment === 'ruling_party');
  const oppositionMembers = profiles.filter(p => p.party_alignment === 'opposition');
  const independentMembers = profiles.filter(p => !p.party_alignment || p.party_alignment === 'non_aligned');

  const leaderOfHouse = rulingMembers.find(p => p.position?.toLowerCase().includes('leader of the house'));
  const ministers = rulingMembers.filter(p => (p.ministry && p.ministry.length > 0) || p.position?.toLowerCase().includes('minister'));
  
  const leaderOfOpposition = oppositionMembers.find(p => p.position?.toLowerCase().includes('leader of opposition'));
  const shadowMinisters = oppositionMembers.filter(p => p.position?.toLowerCase().includes('shadow minister'));
  
  const isLeader = (p: Profile) => 
    p.id === speaker?.id || 
    deputySpeakers.some(ds => ds.id === p.id) || 
    p.id === secretaryGeneral?.id ||
    shadowMinisters.some(m => m.id === p.id);
  
  const handleMemberClick = async (profileId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('manifesto_about, manifesto_problems, manifesto_solutions')
        .eq('id', profileId)
        .single();
      
      if (error) throw error;
      
      const baseProfile = profiles.find(p => p.id === profileId);
      if (baseProfile) {
        setSelectedProfile({ ...baseProfile, ...data });
      }
    } catch (err) {
      console.error('Error fetching profile details:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <div className="w-12 h-12 border-4 border-indigo-100 border-t-primary rounded-full animate-spin"></div>
        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Constructing Assembly...</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col animate-fade-in">
        <div className="flex justify-end mb-6">
          <div className="relative group w-64 md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 w-3.5 h-3.5 transition-colors group-focus-within:text-[#13298f]" />
            <input 
              className="w-full bg-white/50 backdrop-blur-sm border border-slate-100 rounded-xl py-2 pl-10 pr-4 focus:ring-2 focus:ring-[#13298f]/10 focus:border-[#13298f]/20 text-[11px] transition-all placeholder:text-slate-400 font-bold uppercase tracking-tight" 
              placeholder="Search members..." 
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-grow pb-24">
          <div className="w-full mx-auto pb-6">
            <div className="relative flex flex-col items-center">
              {/* 1. Assembly Floor Header (The Sovereign Will) - Absolute Top */}
              <div className="text-center space-y-3 mb-12 z-10">
                 <span className="px-3 py-1 bg-indigo-50 text-[#13298f] text-[10px] font-black rounded-full uppercase tracking-[0.2em] mb-4">The Sovereign Will</span>
                 <h2 className="text-4xl font-headline font-black text-on-surface">The Assembly Floor</h2>
                 <p className="text-sm text-slate-500 font-medium">Representatives of the Sovereign Will of the People</p>
              </div>

              <div className="w-0.5 h-12 bg-gradient-to-b from-indigo-50/0 to-slate-200/50 mb-8"></div>

              {/* 2. Presiding Officers */}
              <section className="relative mb-24 z-10 w-full flex flex-col items-center">
                <div className="mb-12 flex flex-col items-center">
                   <span className="px-3 py-1 bg-primary/10 text-primary text-[10px] font-black rounded-full uppercase tracking-[0.2em] mb-4">Presiding Authority</span>
                   <div 
                      onClick={() => speaker && handleMemberClick(speaker.id)}
                     className="bg-white rounded-[32px] p-8 shadow-2xl shadow-primary/10 border border-primary/5 max-w-sm w-full hover:scale-[1.02] transition-all cursor-pointer group relative overflow-hidden"
                   >
                     <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                     <div className="flex items-center gap-6 relative z-10">
                       <div className="relative shrink-0">
                         <div className="w-24 h-24 rounded-2xl overflow-hidden ring-4 ring-indigo-50 ring-offset-2 group-hover:ring-primary/20 transition-all shadow-lg">
                           {speaker?.photo_url ? (
                             <img src={speaker.photo_url} className="w-full h-full object-cover" alt="Speaker" />
                           ) : (
                             <div className="w-full h-full bg-slate-100 flex items-center justify-center font-black text-2xl text-slate-400">
                               {speaker?.name?.charAt(0) || '?'}
                             </div>
                           )}
                         </div>
                         <div className="absolute -bottom-2 -right-2 bg-primary text-white p-1.5 rounded-lg shadow-md ring-2 ring-white">
                           <Crown className="w-3.5 h-3.5 fill-white" />
                         </div>
                       </div>
                       <div>
                         <h3 className="text-xl font-headline font-black text-on-surface truncate whitespace-nowrap overflow-hidden max-w-[180px]">
                           {speaker?.name || 'Speaker'}
                         </h3>
                         <p className="text-sm text-primary font-bold">Speaker of the House</p>
                         <p className="text-xs text-slate-400 font-medium">Presiding Head</p>
                       </div>
                     </div>
                   </div>
                </div>

                <div className="flex flex-wrap justify-center gap-6 w-full px-4">
                  {deputySpeakers.map((official) => (
                    <div 
                      key={official.id}
                      onClick={() => handleMemberClick(official.id)}
                      className="bg-white/80 backdrop-blur-md rounded-2xl p-5 shadow-xl shadow-indigo-900/5 border border-slate-100 min-w-[280px] hover:scale-[1.02] transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-4">
                        <Avatar className="w-16 h-16 rounded-xl ring-2 ring-white shadow-sm overflow-hidden">
                          <AvatarImage src={official.photo_url} className="object-cover" />
                          <AvatarFallback className="bg-slate-100 text-primary font-black uppercase text-lg">
                            {official.name?.charAt(0) || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h4 className="font-headline font-black text-on-surface leading-tight text-sm truncate max-w-[150px]">
                            {official.name}
                          </h4>
                          <p className="text-[10px] text-secondary font-black uppercase tracking-widest">
                            Deputy Speaker
                          </p>
                          <p className="text-[10px] text-slate-400 font-medium">Constituency: {official.constituency}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="w-0.5 h-16 bg-gradient-to-b from-slate-200 to-indigo-50 absolute left-1/2 -bottom-16 -translate-x-1/2 opacity-50"></div>
              </section>

              {/* 3. Frontbenches (Treasury & Shadow) - Below Speaker */}
              <section className="relative mb-24 w-full flex flex-col items-center z-10 px-4">
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 w-full max-w-7xl items-start">
                    {/* Ruling Leadership */}
                    <div className="space-y-6">
                      <div className="flex flex-wrap justify-center gap-3">
                        {leaderOfHouse && (
                          <MemberCard 
                            person={leaderOfHouse} 
                            onClick={handleMemberClick} 
                            alignmentColor="text-[#13298f]" 
                          />
                        )}
                        {ministers.map(minister => (
                          <MemberCard 
                            key={minister.id} 
                            person={minister} 
                            onClick={handleMemberClick} 
                            alignmentColor="text-[#13298f]" 
                          />
                        ))}
                      </div>
                    </div>

                    {/* Opposition Leadership */}
                    <div className="space-y-6">
                      <div className="flex flex-wrap justify-center gap-3">
                        {leaderOfOpposition && (
                          <MemberCard 
                            person={leaderOfOpposition} 
                            onClick={handleMemberClick} 
                            alignmentColor="text-[#ac3509]" 
                          />
                        )}
                        {shadowMinisters.map(minister => (
                          <MemberCard 
                            key={minister.id} 
                            person={minister} 
                            onClick={handleMemberClick} 
                            alignmentColor="text-[#ac3509]" 
                          />
                        ))}
                      </div>
                    </div>
                 </div>
                 <div className="w-0.5 h-16 bg-gradient-to-b from-slate-200/50 to-indigo-50/0 absolute left-1/2 -bottom-16 -translate-x-1/2"></div>
              </section>

              {/* 4. Assembly Floor Members (The Benches) */}
              <section className="w-full space-y-16 px-4 mb-24 z-10 relative">
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-start">
                    {/* Ruling Benches */}
                    <div className="space-y-6 bg-white/30 backdrop-blur-sm p-6 rounded-[2rem] border border-indigo-50/30">
                      <div className="flex items-center justify-center gap-4 mb-6">
                        <Badge className="bg-indigo-50/50 text-[#13298f] border-none font-bold text-[9px] uppercase tracking-tighter">{rulingMembers.length} Members</Badge>
                      </div>
                      <div className="flex flex-wrap justify-center gap-3">
                        {rulingMembers.filter(p => !isLeader(p)).map(p => (
                          <MemberCard key={p.id} person={p} onClick={handleMemberClick} alignmentColor="text-[#13298f]" />
                        ))}
                      </div>
                    </div>

                    {/* Opposition Benches */}
                    <div className="space-y-6 bg-white/30 backdrop-blur-sm p-6 rounded-[2rem] border border-red-50/30">
                      <div className="flex items-center justify-center gap-4 mb-6">
                        <Badge className="bg-red-50/50 text-[#ac3509] border-none font-bold text-[9px] uppercase tracking-tighter">{oppositionMembers.length} Members</Badge>
                      </div>
                      <div className="flex flex-wrap justify-center gap-3">
                        {oppositionMembers.filter(p => !isLeader(p)).map(p => (
                          <MemberCard key={p.id} person={p} onClick={handleMemberClick} alignmentColor="text-[#ac3509]" />
                        ))}
                      </div>
                    </div>
                 </div>

                 {/* Independent Section */}
                 {independentMembers.filter(p => !isLeader(p)).length > 0 && (
                   <div className="space-y-8 mt-12 bg-slate-50/50 p-12 rounded-[3rem] border border-slate-100">
                      <div className="flex items-center justify-center gap-4 mb-6">
                        <div className="h-px flex-1 bg-slate-200"></div>
                        <h2 className="text-xs font-headline font-black text-slate-400 tracking-widest uppercase">Non-Aligned & Independent</h2>
                        <div className="h-px flex-1 bg-slate-200"></div>
                      </div>
                      <div className="flex flex-wrap justify-center gap-5">
                        {independentMembers.filter(p => !isLeader(p)).map(p => (
                          <MemberCard key={p.id} person={p} onClick={() => setSelectedProfile(p)} alignmentColor="text-slate-400" />
                        ))}
                      </div>
                   </div>
                 )}
              </section>

            </div>
          </div>
        </div>

      </div>

      <Dialog open={!!selectedProfile} onOpenChange={() => setSelectedProfile(null)}>
        <DialogContent className="max-w-[1000px] w-[95vw] bg-transparent border-0 shadow-none p-0 overflow-hidden [&>button]:hidden">
          <DialogTitle className="sr-only">
            {selectedProfile ? `${selectedProfile.name} Profile` : 'Member Profile'}
          </DialogTitle>
          
          {selectedProfile && (
            <div className="bg-[#f8fafc] w-full max-h-[88vh] rounded-[3rem] overflow-hidden relative shadow-[0_32px_128px_-16px_rgba(0,0,0,0.4)] border border-white flex flex-col">

               <button 
                  onClick={() => setSelectedProfile(null)}
                  className="absolute top-8 right-8 z-50 w-12 h-12 bg-white/90 hover:bg-white text-slate-500 rounded-2xl flex items-center justify-center shadow-xl transition-all backdrop-blur-md group border border-white"
               >
                  <X className="w-6 h-6 transition-transform group-hover:rotate-90" />
               </button>

              <div className="overflow-y-auto flex-1 px-4 md:px-8 custom-scrollbar [scrollbar-gutter:stable]">
                <div className="py-8 space-y-10">
                  {/* Profile Component matching StudentDashboard design */}
                  <StudentProfile profile={selectedProfile as any} variant="integrated" />


                  {/* Extended Details: Civic Agenda */}
                  <div className="px-4 pb-8 space-y-8">
                    <div className="flex items-center gap-6">
                      <div className="h-px flex-1 bg-slate-200"></div>
                      <div className="flex items-center gap-3">
                        <Gavel className="w-5 h-5 text-primary" />
                        <h3 className="text-sm font-headline font-black text-primary uppercase tracking-[0.3em]">Civic Agenda</h3>
                      </div>
                      <div className="h-px flex-1 bg-slate-200"></div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* About the Constituency */}
                      <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 space-y-4">
                        <p className="text-[10px] font-black text-primary uppercase tracking-widest">The Constituency</p>
                        <h4 className="text-xl font-headline font-black text-on-surface">{selectedProfile.constituency || 'Regional Focus'}</h4>
                        <p className="text-sm font-body text-on-surface-variant font-medium leading-relaxed opacity-70">
                          {selectedProfile.manifesto_about || "Institutional focus areas for the representing territory."}
                        </p>
                      </div>

                      {/* Quick Stats/Manifesto Highlights */}
                      <div className="space-y-6">
                         <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 flex items-start gap-4">
                           <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center flex-shrink-0">
                             <Activity className="w-5 h-5 text-red-500" />
                           </div>
                           <div>
                             <p className="text-[9px] font-black text-red-500 uppercase tracking-widest mb-1">Priority Issues</p>
                             <div className="space-y-2">
                               {Array.isArray(selectedProfile.manifesto_problems) && selectedProfile.manifesto_problems.length > 0 ? (
                                 selectedProfile.manifesto_problems.slice(0, 3).map((p: any, i: number) => (
                                   <p key={i} className="text-xs font-bold text-slate-600 truncate">• {typeof p === 'string' ? p : p.title}</p>
                                 ))
                               ) : (
                                 <p className="text-xs text-slate-300 italic">No critical issues defined.</p>
                               )}
                             </div>
                           </div>
                         </div>

                         <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 flex items-start gap-4">
                           <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center flex-shrink-0">
                             <Lightbulb className="w-5 h-5 text-emerald-500" />
                           </div>
                           <div>
                             <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-1">Strategic Proposals</p>
                             <div className="space-y-2">
                               {Array.isArray(selectedProfile.manifesto_solutions) && selectedProfile.manifesto_solutions.length > 0 ? (
                                 selectedProfile.manifesto_solutions.slice(0, 3).map((s: any, i: number) => (
                                   <p key={i} className="text-xs font-bold text-slate-600 truncate">• {typeof s === 'string' ? s : s.title}</p>
                                 ))
                               ) : (
                                 <p className="text-xs text-slate-300 italic">No legislative solutions proposed.</p>
                               )}
                             </div>
                           </div>
                         </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Close Button */}
              <div className="p-6 bg-white/40 backdrop-blur-md border-t border-white/20 flex justify-center">
                <button 
                  onClick={() => setSelectedProfile(null)}
                  className="px-8 py-3 bg-white/80 hover:bg-white text-on-surface-variant font-headline font-black text-[11px] uppercase tracking-[0.25em] rounded-2xl shadow-xl transition-all"
                >
                  Close Chamber
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

const MemberCard = ({ person, onClick, alignmentColor = "text-[#ac3509]" }: { person: Profile, onClick: () => void, alignmentColor?: string }) => (
  <div 
    onClick={() => onClick(person.id)}
    className="w-32 sm:w-36 flex-shrink-0 bg-white p-4 rounded-[20px] shadow-[0_4px_20px_rgba(46,65,172,0.03)] hover:shadow-[0_12px_32px_rgba(46,65,172,0.06)] hover:-translate-y-1 transition-all duration-300 cursor-pointer group text-center border border-transparent hover:border-indigo-50/50"
  >
    <div className="relative mx-auto mb-3 w-12 h-12">
      <div className="w-full h-full rounded-xl overflow-hidden ring-3 ring-white shadow-sm group-hover:shadow-md transition-all duration-300">
        <Avatar className="w-full h-full rounded-none">
          <AvatarImage src={person.photo_url} className="object-cover" />
          <AvatarFallback className="bg-slate-50 text-[#13298f] font-black text-base">
            {person.name?.charAt(0) || person.email?.charAt(0) || '?'}
          </AvatarFallback>
        </Avatar>
      </div>
      {person.is_active !== false && (
        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white shadow-sm"></div>
      )}
    </div>
    <h6 className="font-headline font-black text-[#191c1e] text-[10px] leading-tight truncate mb-1 px-0.5">{person.name}</h6>
    <div className="flex flex-col items-center gap-0.5">
      <p className={`text-[7px] ${alignmentColor} font-black uppercase tracking-widest truncate max-w-full opacity-70`}>
        {person.party_name || 'Independent'}
      </p>
    </div>
  </div>
);

export default ParliamentTree;