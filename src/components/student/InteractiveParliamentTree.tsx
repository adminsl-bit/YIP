import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Crown, Gavel, Users, MapPin, Search, X, Filter, Loader2 } from 'lucide-react';
import GlassmorphismProfileCard from './GlassmorphismProfileCard';
import { motion, AnimatePresence } from 'framer-motion';
import { useSystemSettings } from '@/hooks/useSystemSettings';

interface Student {
  id: string;
  user_id: string;
  name: string;
  position: string;
  party_number: number;
  party_name?: string;
  serial_number: number;
  constituency?: string;
  state?: string;
  city?: string;
  photo_url?: string;
  email?: string;
  user_type: string;
  party_alignment?: string;
}

interface LeaderboardData {
  ranking: number;
  final_total_score: number;
}

const InteractiveParliamentTree = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [hoveredStudent, setHoveredStudent] = useState<string | null>(null);
  const [positionFilter, setPositionFilter] = useState<string>("all");
  const [partyFilter, setPartyFilter] = useState<string>("all");
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [leaderboardData, setLeaderboardData] = useState<Record<string, LeaderboardData>>({});

  const { settings } = useSystemSettings();

  useEffect(() => {
    fetchStudents();
    if (settings.leaderboard_visible) {
      fetchLeaderboardRankings();
    }
  }, [settings.leaderboard_visible]);

  useEffect(() => {
    applyFilters();
  }, [students, searchTerm, positionFilter, partyFilter, stateFilter]);

  const applyFilters = () => {
    let filtered = students;

    // Apply search term filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(student =>
        student.name.toLowerCase().includes(searchLower) ||
        student.position.toLowerCase().includes(searchLower) ||
        student.constituency?.toLowerCase().includes(searchLower) ||
        student.state?.toLowerCase().includes(searchLower) ||
        student.city?.toLowerCase().includes(searchLower) ||
        student.party_name?.toLowerCase().includes(searchLower) ||
        student.party_number.toString().includes(searchTerm) ||
        student.serial_number.toString().includes(searchTerm)
      );
    }

    // Apply position filter
    if (positionFilter !== "all") {
      filtered = filtered.filter(student => {
        const role = getSeatRole(student.position);
        return role === positionFilter;
      });
    }

    // Apply party filter
    if (partyFilter !== "all") {
      filtered = filtered.filter(student => student.party_number.toString() === partyFilter);
    }

    // Apply state filter
    if (stateFilter !== "all") {
      filtered = filtered.filter(student => student.state === stateFilter);
    }

    setFilteredStudents(filtered);
  };

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('id, user_id, name, position, party_number, party_name, serial_number, constituency, state, photo_url, email, user_type, party_alignment')
        .eq('user_type', 'student')
        .order('party_number')
        .order('serial_number');

      if (error) {
        console.error('Error fetching students:', error);
        return;
      }

      setStudents(data || []);
      setFilteredStudents(data || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
};

  const fetchLeaderboardRankings = async () => {
    try {
      const { data, error } = await supabase
        .from('organizer_leaderboard')
        .select('user_id, final_total_score')
        .gt('final_total_score', 0);

      if (error) throw error;

      if (!data || data.length === 0) {
        setLeaderboardData({});
        return;
      }

      // Sort by score to calculate rankings
      const sortedData = [...data].sort((a, b) => 
        (b.final_total_score || 0) - (a.final_total_score || 0)
      );

      // Create ranking map
      const rankingMap: Record<string, LeaderboardData> = {};
      sortedData.forEach((item, index) => {
        rankingMap[item.user_id] = {
          ranking: index + 1,
          final_total_score: item.final_total_score || 0
        };
      });

      setLeaderboardData(rankingMap);
    } catch (error) {
      console.error('Error fetching leaderboard rankings:', error);
      setLeaderboardData({});
    }
  };

  // Realtime: refresh when profiles change
  useEffect(() => {
    const channel = supabase
      .channel('public:profiles-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        fetchStudents();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const getPositionIcon = (position: string) => {
    const pos = position.toLowerCase();
    if (pos.includes('president') || pos.includes('prime minister')) {
      return <Crown className="w-4 h-4 text-yellow-500" />;
    } else if (pos.includes('speaker') || pos.includes('deputy') || pos.includes('minister') || pos.includes('ministry')) {
      return <Gavel className="w-4 h-4 text-blue-500" />;
    }
    return <Users className="w-4 h-4 text-gray-500" />;
  };

  const getSeatRole = (position: string): string => {
    const pos = position.toLowerCase();
    if (pos.includes('speaker') && pos.includes('deputy')) return 'deputy_speaker';
    if (pos.includes('speaker')) return 'speaker';
    if (pos.includes('administrator') || pos.includes('admin')) return 'administrator';
    if (pos.includes('journalist')) return 'journalist';
    if (pos.includes('minister') || pos.includes('shadow minister')) return 'minister';
    return 'mp';
  };

  const isSpecialPosition = (position: string, name?: string) => {
    const pos = position.toLowerCase();
    const specialNames = [
      'roobe saghana c',
      'a ray archer', 
      'adeena saleem',
      'laxana b',
      'arnav a',
      'pranaav a'
    ];
    
    return pos.includes('minister') || 
           pos.includes('ministry') ||
           pos.includes('leader') || 
           pos.includes('president') || 
           pos.includes('speaker') ||
           (name && specialNames.includes(name.toLowerCase()));
  };

  const getPartyColor = (partyNumber: number) => {
    const colors = [
      'from-red-500 to-red-600',
      'from-blue-500 to-blue-600', 
      'from-green-500 to-green-600',
      'from-yellow-500 to-yellow-600',
      'from-purple-500 to-purple-600',
      'from-pink-500 to-pink-600',
      'from-indigo-500 to-indigo-600',
      'from-teal-500 to-teal-600'
    ];
    return colors[partyNumber % colors.length] || 'from-gray-500 to-gray-600';
  };

  const getPartyBorderColor = (partyNumber: number) => {
    const colors = [
      'border-red-400',
      'border-blue-400',
      'border-green-400',
      'border-yellow-400',
      'border-purple-400',
      'border-pink-400',
      'border-indigo-400',
      'border-teal-400'
    ];
    return colors[partyNumber % colors.length] || 'border-gray-400';
  };

  const groupByParty = (students: Student[]) => {
    return students.reduce((groups, student) => {
      const party = student.party_number;
      if (!groups[party]) {
        groups[party] = [];
      }
      groups[party].push(student);
      return groups;
    }, {} as Record<number, Student[]>);
  };

  const getUniqueParties = () => {
    const parties = [...new Set(students.map(s => s.party_number))].sort((a, b) => a - b);
    return parties;
  };

  const getUniqueStates = () => {
    const states = [...new Set(students.map(s => s.state).filter(Boolean))].sort();
    return states;
  };

  const clearAllFilters = () => {
    setSearchTerm("");
    setPositionFilter("all");
    setPartyFilter("all");
    setStateFilter("all");
  };

  const hasActiveFilters = searchTerm || positionFilter !== "all" || partyFilter !== "all" || stateFilter !== "all";

  if (loading) {
    return (
      <div className="bg-surface-container p-8 rounded-[2.5rem] shadow-sm">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
            <Users className="w-6 h-6 text-primary" />
          </div>
          <h2 className="text-2xl font-headline font-black text-on-surface">Assembly is Forming</h2>
        </div>
        <div className="flex items-center justify-center h-32">
          <Loader2 className="w-10 h-10 animate-spin text-primary/30" />
        </div>
      </div>
    );
  }

  const groupedStudents = groupByParty(filteredStudents);

  const speaker = filteredStudents.find(p => p.position?.toLowerCase().includes('speaker') && !p.position?.toLowerCase().includes('deputy'));
  const deputySpeakers = filteredStudents.filter(p => p.position?.toLowerCase().includes('deputy speaker'));
  
  const rulingMembers = filteredStudents.filter(p => p.party_alignment === 'ruling_party');
  const oppositionMembers = filteredStudents.filter(p => p.party_alignment === 'opposition');
  const independentMembers = filteredStudents.filter(p => !p.party_alignment || p.party_alignment === 'non_aligned');

  return (
    <div className="space-y-16 pb-20">
      {/* Header Section */}
      <div className="text-center mb-16 px-4">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center gap-6 mb-8"
        >
          <div className="space-y-4">
            <span className="px-4 py-1.5 bg-primary/10 text-primary text-[10px] font-black rounded-full uppercase tracking-[0.3em] backdrop-blur-md border border-primary/10">
              The Sovereign Will
            </span>
            <h1 className="text-5xl md:text-7xl font-headline font-black text-on-surface tracking-tight leading-none">
              The Assembly Floor
            </h1>
            <p className="text-on-surface-variant/60 font-medium text-lg md:text-xl max-w-2xl mx-auto leading-relaxed font-sans">
              Representatives of the Sovereign Will of the People
            </p>
          </div>
        </motion.div>
        
        {/* Search & Filters (Maintain functionality) */}
        <div className="max-w-4xl mx-auto mb-12">
          <div className="flex flex-col gap-6">
            <div className="relative group">
              <div className="absolute inset-0 bg-primary/5 blur-2xl rounded-3xl -z-10 opacity-0 group-focus-within:opacity-100 transition-opacity duration-500" />
              <Search className="absolute left-6 top-1/2 transform -translate-y-1/2 w-5 h-5 text-on-surface-variant/40 group-focus-within:text-primary transition-colors" />
              <Input
                placeholder="Search the Assembly by name, position, party..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-16 pr-8 bg-surface-container-low border-none text-on-surface placeholder:text-on-surface-variant/30 focus:bg-surface-container-lowest focus:ring-4 focus:ring-primary/5 rounded-[2rem] h-20 text-xl font-bold shadow-sm transition-all"
              />
            </div>

            <div className="flex flex-wrap gap-4 items-center justify-center">
              <div className="flex flex-wrap gap-3 items-center justify-center">
                <Select value={positionFilter} onValueChange={setPositionFilter}>
                  <SelectTrigger className="w-48 bg-surface-container-low border-none rounded-2xl font-bold h-12 shadow-sm">
                    <SelectValue placeholder="Position" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-none shadow-elevated bg-surface-container-lowest">
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="speaker">Speaker</SelectItem>
                    <SelectItem value="deputy_speaker">Deputy Speaker</SelectItem>
                    <SelectItem value="administrator">Administrator</SelectItem>
                    <SelectItem value="journalist">Journalist</SelectItem>
                    <SelectItem value="minister">Minister/Shadow Minister</SelectItem>
                    <SelectItem value="mp">Member of Parliament</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={partyFilter} onValueChange={setPartyFilter}>
                  <SelectTrigger className="w-48 bg-surface-container-low border-none rounded-2xl font-bold h-12 shadow-sm">
                    <SelectValue placeholder="Party" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-none shadow-elevated bg-surface-container-lowest">
                    <SelectItem value="all">All Parties</SelectItem>
                    {getUniqueParties().map(party => {
                      const partyLetter = ['No Party', 'A', 'B', 'C', 'D', 'E'][party] || party;
                      const partyName = students.find(s => s.party_number === party)?.party_name;
                      return (
                        <SelectItem key={party} value={party.toString()}>
                          {partyName ? `${partyName} (${partyLetter})` : `Party ${partyLetter}`}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>

                <Select value={stateFilter} onValueChange={setStateFilter}>
                  <SelectTrigger className="w-48 bg-surface-container-low border-none rounded-2xl font-bold h-12 shadow-sm">
                    <SelectValue placeholder="State" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-none shadow-elevated bg-surface-container-lowest">
                    <SelectItem value="all">All States</SelectItem>
                    {getUniqueStates().map(state => (
                      <SelectItem key={state} value={state!}>
                        {state}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {hasActiveFilters && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={clearAllFilters}
                    className="flex items-center gap-2 text-primary hover:bg-primary/5 font-bold rounded-2xl h-12 px-6"
                  >
                    <X className="w-4 h-4" />
                    Clear
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-4 space-y-24">
        {/* Presiding Officers */}
        <section className="relative flex flex-col items-center">
          <div className="mb-12 flex flex-col items-center">
             <span className="px-4 py-1 bg-primary/10 text-primary text-[10px] font-black rounded-full uppercase tracking-[0.2em] mb-6">Presiding Authority</span>
             <motion.div 
                whileHover={{ scale: 1.02, y: -4 }}
                onClick={() => speaker && setSelectedStudent(speaker)}
                className="bg-surface-container-low rounded-[3rem] p-10 shadow-elevated max-w-lg w-full cursor-pointer group relative overflow-hidden backdrop-blur-xl"
             >
               <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 rounded-full -mr-24 -mt-24 blur-3xl group-hover:bg-primary/10 transition-colors" />
               <div className="flex items-center gap-8 relative z-10">
                 <div className="relative shrink-0">
                   <div className="w-32 h-32 rounded-[2rem] overflow-hidden ring-4 ring-primary/10 ring-offset-4 ring-offset-surface-container-low group-hover:ring-primary/30 transition-all shadow-xl bg-surface-container-high">
                     {speaker?.photo_url ? (
                       <img src={speaker.photo_url.includes('/file/d/') ? `https://drive.google.com/uc?export=view&id=${speaker.photo_url.split('/d/')[1]?.split('/')[0]}` : speaker.photo_url} className="w-full h-full object-cover" alt="Speaker" />
                     ) : (
                       <AvatarFallback className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 text-primary font-black text-4xl">
                         {speaker?.name?.charAt(0) || '?'}
                       </AvatarFallback>
                     )}
                   </div>
                   <div className="absolute -bottom-2 -right-2 bg-primary text-white p-2 rounded-xl shadow-lg ring-4 ring-surface-container-low">
                     <Crown className="w-5 h-5 fill-white" />
                   </div>
                 </div>
                 <div>
                   <h3 className="text-2xl font-headline font-black text-on-surface mb-1">
                     {speaker?.name || 'Speaker of the House'}
                   </h3>
                   <p className="text-primary font-black uppercase text-xs tracking-widest mb-1">Speaker</p>
                   <p className="text-on-surface-variant/40 font-bold text-xs">{speaker?.constituency || 'Assembly Head'}</p>
                 </div>
               </div>
             </motion.div>
          </div>

          <div className="flex flex-wrap justify-center gap-6 w-full max-w-5xl">
            {deputySpeakers.map((official) => (
              <motion.div 
                key={official.id}
                whileHover={{ y: -5 }}
                onClick={() => setSelectedStudent(official)}
                className="bg-surface-container p-6 backdrop-blur-md rounded-[2rem] shadow-sm min-w-[340px] cursor-pointer group flex items-center gap-6 hover:bg-surface-container-high transition-colors"
              >
                <div className="relative">
                  <Avatar className="w-20 h-20 rounded-2xl ring-4 ring-primary/5 group-hover:ring-primary/20 transition-all shadow-md overflow-hidden">
                    <AvatarImage src={official.photo_url} className="object-cover" />
                    <AvatarFallback className="bg-primary/5 text-primary font-black uppercase text-xl">
                      {official.name?.charAt(0) || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-1 -right-1 bg-surface-container-low text-primary p-1 rounded-lg shadow-md ring-2 ring-surface-container-low">
                    <Gavel className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div>
                  <h4 className="font-headline font-black text-on-surface leading-tight text-lg">
                    {official.name}
                  </h4>
                  <p className="text-[10px] text-primary font-black uppercase tracking-[0.2em]">
                    Deputy Speaker
                  </p>
                  <p className="text-[10px] text-on-surface-variant/40 font-bold mt-1">Constituency: {official.constituency}</p>
                </div>
              </motion.div>
            ))}
          </div>
          
          <div className="w-px h-24 bg-gradient-to-b from-outline-variant/20 to-transparent mt-12" />
        </section>

        {/* The Chamber Benches */}
        <section className="w-full">
           <div className="grid grid-cols-1 xl:grid-cols-2 gap-12 xl:gap-20 items-start">
              {/* Government Side */}
              <div className="space-y-8">
                <div className="flex flex-col items-center gap-4 mb-8">
                  <div className="w-16 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
                  <span className="text-[10px] font-black text-primary uppercase tracking-[0.4em] opacity-40">Section Alpha</span>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  <AnimatePresence mode="popLayout">
                    {rulingMembers.map((student, idx) => (
                      <MemberSmallCard 
                        key={student.id} 
                        student={student} 
                        onClick={() => setSelectedStudent(student)} 
                        delay={idx}
                        accentColor="bg-primary"
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </div>

              {/* Opposition Side */}
              <div className="space-y-8">
                <div className="flex flex-col items-center gap-4 mb-8">
                  <div className="w-16 h-px bg-gradient-to-r from-transparent via-secondary/30 to-transparent" />
                  <span className="text-[10px] font-black text-secondary uppercase tracking-[0.4em] opacity-40">Section Beta</span>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  <AnimatePresence mode="popLayout">
                    {oppositionMembers.map((student, idx) => (
                      <MemberSmallCard 
                        key={student.id} 
                        student={student} 
                        onClick={() => setSelectedStudent(student)} 
                        delay={idx}
                        accentColor="bg-secondary"
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </div>
           </div>

           {/* Independent/Others */}
           {independentMembers.length > 0 && (
             <div className="mt-24 pt-24 border-t border-outline-variant/10">
                <div className="flex flex-col items-center gap-6 mb-12">
                   <h2 className="text-xl font-headline font-black text-on-surface-variant/40 tracking-[0.3em] uppercase">Non-Aligned Members</h2>
                   <div className="w-24 h-1 bg-outline-variant/10 rounded-full" />
                </div>
                <div className="flex flex-wrap justify-center gap-6 max-w-6xl mx-auto">
                   {independentMembers.map((student, idx) => (
                      <MemberSmallCard 
                        key={student.id} 
                        student={student} 
                        onClick={() => setSelectedStudent(student)} 
                        delay={idx}
                        accentColor="bg-on-surface-variant/20"
                      />
                   ))}
                </div>
             </div>
           )}
        </section>
      </div>

      {/* Keep existing Modal logic */}
      <Dialog open={!!selectedStudent} onOpenChange={(open) => {
        if (!open) setSelectedStudent(null);
      }}>
        <DialogContent className="max-w-xl bg-transparent border-none shadow-none p-0 rounded-[3rem] overflow-visible">
          <DialogTitle className="sr-only">
            {selectedStudent ? `${selectedStudent.name} Profile` : 'Student Profile'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Detailed profile information for the selected parliament member
          </DialogDescription>
          
          {selectedStudent && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="relative"
            >
              <button
                onClick={() => setSelectedStudent(null)}
                className="absolute -top-4 -right-4 z-50 w-12 h-12 bg-surface-container-highest/90 hover:bg-primary hover:text-white text-on-surface rounded-2xl flex items-center justify-center shadow-elevated transition-all duration-300 backdrop-blur-xl group"
              >
                <X className="w-6 h-6 transition-transform group-hover:rotate-90" />
              </button>
              
              <div className="flex items-center justify-center min-h-[500px]">
                <GlassmorphismProfileCard student={selectedStudent} />
              </div>
            </motion.div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const MemberSmallCard = ({ student, onClick, delay, accentColor }: { student: Student, onClick: () => void, delay: number, accentColor: string }) => {
  const { settings } = useSystemSettings();
  
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ scale: 1.05, y: -4 }}
      transition={{ 
        duration: 0.3,
        delay: delay * 0.02,
        type: "spring",
        stiffness: 300,
        damping: 25
      }}
      onClick={onClick}
      className="bg-surface-container p-5 rounded-[2rem] shadow-sm hover:shadow-xl hover:bg-surface-container-high hover:-translate-y-1 transition-all cursor-pointer group text-center"
    >
      <div className="relative mx-auto mb-4 w-20 h-20">
        <div className="w-full h-full rounded-2xl overflow-hidden ring-4 ring-outline-variant/5 group-hover:ring-primary/20 transition-all shadow-md">
          <Avatar className="w-full h-full rounded-none">
            <AvatarImage src={student.photo_url?.includes('/file/d/') ? `https://drive.google.com/uc?export=view&id=${student.photo_url.split('/d/')[1]?.split('/')[0]}` : student.photo_url} className="object-cover" />
            <AvatarFallback className={`bg-gradient-to-br ${accentColor} text-white font-black text-xl`}>
              {student.name?.charAt(0) || '?'}
            </AvatarFallback>
          </Avatar>
        </div>
        <div className={`absolute -bottom-1 -right-1 w-4 h-4 ${accentColor} rounded-full border-2 border-surface-container-low shadow-sm transition-transform group-hover:scale-125`} />
      </div>
      
      <h4 className="font-headline font-black text-on-surface text-xs leading-tight mb-1 truncate px-1 group-hover:text-primary transition-colors">
        {student.name}
      </h4>
      <p className="text-[8px] font-black uppercase tracking-widest text-on-surface-variant/40 truncate opacity-60">
        {student.position}
      </p>
    </motion.div>
  );
};

export default InteractiveParliamentTree;