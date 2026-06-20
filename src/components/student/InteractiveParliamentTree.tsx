import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
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
  const { profile } = useAuth();
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
        .eq('event_id', profile?.event_id ?? '')
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
        .eq('event_id', profile?.event_id ?? '')
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
      <div className="bg-surface-container-low p-12 rounded-[3rem] shadow-sm">
        <div className="flex flex-col items-center justify-center gap-6 mb-8">
          <div className="w-16 h-16 bg-primary/10 rounded-[24px] flex items-center justify-center">
            <Users className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-display-sm font-headline font-black text-on-surface uppercase italic">Assembly is Forming</h2>
        </div>
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-12 h-12 animate-spin text-primary/30" />
        </div>
      </div>
    );
  }

  // ── Role classification ──────────────────────────────────────────────────
  const pos = (s: Student) => (s.position ?? '').toLowerCase();

  const speaker       = filteredStudents.find(s => pos(s).includes('speaker') && !pos(s).includes('deputy'));
  const deputySpeakers = filteredStudents.filter(s => pos(s).includes('deputy speaker'));

  // Special roles — extracted before the regular grid
  const primeMinister      = filteredStudents.find(s => pos(s).includes('prime minister'));
  const leaderOpposition   = filteredStudents.find(s => pos(s).includes('leader of opposition'));
  const rulingPartyLeaders = filteredStudents.filter(s =>
    pos(s).includes('party leader') && s.party_alignment === 'ruling_party' && s !== primeMinister
  );
  const oppositionPartyLeaders = filteredStudents.filter(s =>
    pos(s).includes('party leader') && s.party_alignment === 'opposition' && s !== leaderOpposition
  );
  const ministers      = filteredStudents.filter(s =>
    pos(s).includes('minister') && !pos(s).includes('prime minister') &&
    !pos(s).includes('shadow') && s.party_alignment === 'ruling_party'
  );
  const shadowMinisters = filteredStudents.filter(s =>
    pos(s).includes('shadow minister') && s.party_alignment === 'opposition'
  );

  // Regular MPs after special roles are removed
  const specialIds = new Set([
    speaker?.id, ...deputySpeakers.map(s => s.id),
    primeMinister?.id, leaderOpposition?.id,
    ...rulingPartyLeaders.map(s => s.id), ...oppositionPartyLeaders.map(s => s.id),
    ...ministers.map(s => s.id), ...shadowMinisters.map(s => s.id),
  ].filter(Boolean));

  const rulingMPs      = filteredStudents.filter(s => s.party_alignment === 'ruling_party'  && !specialIds.has(s.id));
  const oppositionMPs  = filteredStudents.filter(s => s.party_alignment === 'opposition'     && !specialIds.has(s.id));
  const independentMembers = filteredStudents.filter(s =>
    (!s.party_alignment || s.party_alignment === 'non_aligned') && !specialIds.has(s.id)
  );

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
            <span className="px-4 py-1.5 bg-primary/10 text-primary text-label-xs rounded-full uppercase tracking-[0.3em] backdrop-blur-md border border-primary/10">
              The Sovereign Will
            </span>
            <h1 className="text-display-md md:text-display-xl font-headline font-black text-on-surface tracking-tight leading-none uppercase italic">
              The Assembly Floor
            </h1>
            <p className="text-on-surface-variant/70 font-medium text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
              Representatives of the Sovereign Will of the People
            </p>
          </div>
        </motion.div>
        
        {/* Search & Filters (Maintain functionality) */}
        <div className="max-w-4xl mx-auto mb-12">
          <div className="flex flex-col gap-6">
            <div className="relative group">
              <div className="absolute inset-0 bg-primary/5 blur-3xl rounded-[3rem] -z-10 opacity-0 group-focus-within:opacity-100 transition-opacity duration-700" />
              <Search className="absolute left-8 top-1/2 transform -translate-y-1/2 w-6 h-6 text-on-surface-variant/40 group-focus-within:text-primary transition-all duration-500" />
              <Input
                placeholder="Search the Assembly by name, position, party..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-20 pr-10 bg-surface-container-high border-none text-on-surface placeholder:text-on-surface-variant/30 focus:bg-surface-container-lowest focus:ring-8 focus:ring-primary/5 rounded-[3rem] h-20 text-body-lg font-bold shadow-sm transition-all duration-500"
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
             <span className="px-4 py-1 bg-primary/10 text-primary text-label-xs rounded-full uppercase tracking-[0.2em] mb-6">Presiding Authority</span>
             <motion.div 
                whileHover={{ scale: 1.02, y: -8 }}
                onClick={() => speaker && setSelectedStudent(speaker)}
                className="bg-surface-container-lowest rounded-[3rem] p-12 ambient-shadow max-w-2xl w-full cursor-pointer group relative overflow-hidden"
             >
               <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -mr-32 -mt-32 blur-3xl group-hover:bg-primary/10 transition-colors duration-700" />
               <div className="flex items-center gap-10 relative z-10">
                 <div className="relative shrink-0">
                   <div className="w-40 h-40 rounded-[2.5rem] overflow-hidden ring-8 ring-primary/5 ring-offset-4 ring-offset-surface-container-lowest group-hover:ring-primary/20 transition-all duration-500 shadow-2xl bg-surface-container-high">
                     {speaker?.photo_url ? (
                       <img src={speaker.photo_url.includes('/file/d/') ? `https://drive.google.com/uc?export=view&id=${speaker.photo_url.split('/d/')[1]?.split('/')[0]}` : speaker.photo_url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt="Speaker" />
                     ) : (
                       <AvatarFallback className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 text-primary font-black text-5xl">
                         {speaker?.name?.charAt(0) || '?'}
                       </AvatarFallback>
                     )}
                   </div>
                   <div className="absolute -bottom-3 -right-3 bg-primary text-white p-3 rounded-2xl shadow-2xl ring-4 ring-surface-container-lowest group-hover:scale-110 transition-transform duration-500">
                     <Crown className="w-6 h-6 fill-white" />
                   </div>
                 </div>
                 <div className="flex flex-col gap-1">
                    <h3 className="text-display-sm font-headline font-black text-on-surface italic uppercase leading-tight">
                      {speaker?.name || 'Speaker of the House'}
                    </h3>
                    <p className="text-primary font-black uppercase text-label-sm tracking-[0.2em] mb-1">Speaker</p>
                    <p className="text-on-surface-variant/40 font-bold text-body-xs uppercase tracking-widest">{speaker?.constituency || 'Assembly Head'}</p>
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
                  <p className="text-label-xs text-primary tracking-[0.2em]">
                    Deputy Speaker
                  </p>
                  <p className="text-body-xxs text-on-surface-variant/40 font-bold mt-1">Constituency: {official.constituency}</p>
                </div>
              </motion.div>
            ))}
          </div>
          
          <div className="w-px h-24 bg-gradient-to-b from-outline-variant/20 to-transparent mt-12" />
        </section>

        {/* The Chamber Benches */}
        <section className="w-full">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 xl:gap-16 items-start">

            {/* ── RULING COALITION ── */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex-1 h-px bg-gradient-to-r from-emerald-400/40 to-transparent" />
                <span className="text-[10px] font-black tracking-[0.3em] text-emerald-600 uppercase">Ruling Coalition</span>
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
              </div>

              {/* Prime Minister */}
              {primeMinister && (
                <motion.div whileHover={{ y: -4 }} onClick={() => setSelectedStudent(primeMinister)}
                  className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-2 border-emerald-300/60 rounded-[2rem] p-5 cursor-pointer flex items-center gap-5 hover:shadow-lg transition-all">
                  <div className="relative shrink-0">
                    <Avatar className="w-16 h-16 rounded-2xl">
                      <AvatarImage src={primeMinister.photo_url} className="object-cover" />
                      <AvatarFallback className="bg-emerald-500 text-white font-black text-xl">{primeMinister.name?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="absolute -top-2 -right-2 bg-amber-400 rounded-lg p-1 shadow">
                      <Crown className="w-3.5 h-3.5 text-white fill-white" />
                    </div>
                  </div>
                  <div>
                    <p className="text-[9px] font-black tracking-[0.2em] text-emerald-600 uppercase mb-0.5">Prime Minister</p>
                    <h3 className="font-headline font-black text-on-surface text-lg leading-tight uppercase italic">{primeMinister.name}</h3>
                    <p className="text-xs text-on-surface-variant/60">{primeMinister.party_name} · {primeMinister.constituency}</p>
                  </div>
                </motion.div>
              )}

              {/* Ruling Party Leaders */}
              {rulingPartyLeaders.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[9px] font-black tracking-[0.2em] text-on-surface-variant/40 uppercase ml-1">Party Leaders</p>
                  {rulingPartyLeaders.map(s => (
                    <RoleCard key={s.id} student={s} onClick={() => setSelectedStudent(s)} accent="emerald" />
                  ))}
                </div>
              )}

              {/* Ministers */}
              {ministers.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[9px] font-black tracking-[0.2em] text-on-surface-variant/40 uppercase ml-1">Cabinet Ministers</p>
                  <div className="grid grid-cols-2 gap-2">
                    {ministers.map(s => (
                      <RoleCard key={s.id} student={s} onClick={() => setSelectedStudent(s)} accent="emerald" compact />
                    ))}
                  </div>
                </div>
              )}

              {/* Ruling MPs */}
              {rulingMPs.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[9px] font-black tracking-[0.2em] text-on-surface-variant/40 uppercase ml-1">Members of Parliament</p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    <AnimatePresence mode="popLayout">
                      {rulingMPs.map((s, i) => (
                        <MemberSmallCard key={s.id} student={s} onClick={() => setSelectedStudent(s)} delay={i} accentColor="bg-emerald-500" />
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              )}
            </div>

            {/* ── OPPOSITION COALITION ── */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-2 h-2 rounded-full bg-red-400" />
                <span className="text-[10px] font-black tracking-[0.3em] text-red-500 uppercase">Opposition</span>
                <div className="flex-1 h-px bg-gradient-to-l from-red-400/40 to-transparent" />
              </div>

              {/* Leader of Opposition */}
              {leaderOpposition && (
                <motion.div whileHover={{ y: -4 }} onClick={() => setSelectedStudent(leaderOpposition)}
                  className="bg-gradient-to-br from-red-50 to-red-100/50 border-2 border-red-300/60 rounded-[2rem] p-5 cursor-pointer flex items-center gap-5 hover:shadow-lg transition-all">
                  <div className="relative shrink-0">
                    <Avatar className="w-16 h-16 rounded-2xl">
                      <AvatarImage src={leaderOpposition.photo_url} className="object-cover" />
                      <AvatarFallback className="bg-red-500 text-white font-black text-xl">{leaderOpposition.name?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="absolute -top-2 -right-2 bg-red-500 rounded-lg p-1 shadow">
                      <Gavel className="w-3.5 h-3.5 text-white" />
                    </div>
                  </div>
                  <div>
                    <p className="text-[9px] font-black tracking-[0.2em] text-red-500 uppercase mb-0.5">Leader of Opposition</p>
                    <h3 className="font-headline font-black text-on-surface text-lg leading-tight uppercase italic">{leaderOpposition.name}</h3>
                    <p className="text-xs text-on-surface-variant/60">{leaderOpposition.party_name} · {leaderOpposition.constituency}</p>
                  </div>
                </motion.div>
              )}

              {/* Opposition Party Leaders */}
              {oppositionPartyLeaders.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[9px] font-black tracking-[0.2em] text-on-surface-variant/40 uppercase ml-1">Party Leaders</p>
                  {oppositionPartyLeaders.map(s => (
                    <RoleCard key={s.id} student={s} onClick={() => setSelectedStudent(s)} accent="red" />
                  ))}
                </div>
              )}

              {/* Shadow Ministers */}
              {shadowMinisters.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[9px] font-black tracking-[0.2em] text-on-surface-variant/40 uppercase ml-1">Shadow Cabinet</p>
                  <div className="grid grid-cols-2 gap-2">
                    {shadowMinisters.map(s => (
                      <RoleCard key={s.id} student={s} onClick={() => setSelectedStudent(s)} accent="red" compact />
                    ))}
                  </div>
                </div>
              )}

              {/* Opposition MPs */}
              {oppositionMPs.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[9px] font-black tracking-[0.2em] text-on-surface-variant/40 uppercase ml-1">Members of Parliament</p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    <AnimatePresence mode="popLayout">
                      {oppositionMPs.map((s, i) => (
                        <MemberSmallCard key={s.id} student={s} onClick={() => setSelectedStudent(s)} delay={i} accentColor="bg-red-500" />
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Non-Aligned */}
          {independentMembers.length > 0 && (
            <div className="mt-16 pt-16 border-t border-outline-variant/10">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex-1 h-px bg-outline-variant/20" />
                <span className="text-[10px] font-black tracking-[0.3em] text-on-surface-variant/40 uppercase">Non-Aligned Members</span>
                <div className="flex-1 h-px bg-outline-variant/20" />
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 max-w-5xl mx-auto">
                {independentMembers.map((s, i) => (
                  <MemberSmallCard key={s.id} student={s} onClick={() => setSelectedStudent(s)} delay={i} accentColor="bg-on-surface-variant/40" />
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

// Compact role card for Ministers, Shadow Ministers, Party Leaders
const RoleCard = ({ student, onClick, accent, compact }: {
  student: Student; onClick: () => void;
  accent: 'emerald' | 'red'; compact?: boolean;
}) => {
  const borderCls = accent === 'emerald' ? 'border-emerald-200/60 bg-emerald-50/50' : 'border-red-200/60 bg-red-50/50';
  const textCls   = accent === 'emerald' ? 'text-emerald-700' : 'text-red-600';
  const avatarCls = accent === 'emerald' ? 'bg-emerald-500' : 'bg-red-500';
  return (
    <motion.div whileHover={{ y: -2 }} onClick={onClick}
      className={`border ${borderCls} rounded-2xl p-3 cursor-pointer flex items-center gap-3 hover:shadow-md transition-all`}>
      <Avatar className={`${compact ? 'w-9 h-9' : 'w-11 h-11'} rounded-xl shrink-0`}>
        <AvatarImage src={student.photo_url} className="object-cover" />
        <AvatarFallback className={`${avatarCls} text-white font-black text-sm`}>{student.name?.charAt(0)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="font-headline font-black text-on-surface text-sm leading-tight truncate uppercase italic">{student.name}</p>
        <p className={`text-[9px] font-black tracking-wider ${textCls} truncate uppercase`}>{student.position}</p>
      </div>
    </motion.div>
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
      whileHover={{ scale: 1.05, y: -8 }}
      transition={{ 
        duration: 0.4,
        delay: delay * 0.02,
        type: "spring",
        stiffness: 260,
        damping: 20
      }}
      onClick={onClick}
      className="bg-surface-container-lowest p-6 rounded-[2.5rem] ambient-shadow hover:shadow-2xl hover:bg-white hover:-translate-y-2 transition-all duration-500 cursor-pointer group text-center border-none"
    >
      <div className="relative mx-auto mb-5 w-24 h-24">
        <div className="w-full h-full rounded-[2rem] overflow-hidden ring-8 ring-outline-variant/5 group-hover:ring-primary/10 transition-all duration-500 shadow-xl">
          <Avatar className="w-full h-full rounded-none">
            <AvatarImage src={student.photo_url?.includes('/file/d/') ? `https://drive.google.com/uc?export=view&id=${student.photo_url.split('/d/')[1]?.split('/')[0]}` : student.photo_url} className="object-cover group-hover:scale-110 transition-transform duration-700" />
            <AvatarFallback className={`bg-gradient-to-br ${accentColor} text-white font-black text-2xl`}>
              {student.name?.charAt(0) || '?'}
            </AvatarFallback>
          </Avatar>
        </div>
        <div className={`absolute -bottom-1.5 -right-1.5 w-6 h-6 ${accentColor} rounded-xl border-4 border-surface-container-lowest shadow-lg transition-transform duration-500 group-hover:scale-110 group-hover:rotate-12`} />
      </div>
      
      <h4 className="font-headline font-black text-on-surface text-body-md leading-tight mb-1 truncate px-1 group-hover:text-primary transition-colors duration-300 uppercase italic">
        {student.name}
      </h4>
      <p className="text-body-xs font-bold uppercase tracking-widest text-on-surface-variant/40 truncate opacity-60">
        {student.position}
      </p>
    </motion.div>
  );
};

export default InteractiveParliamentTree;