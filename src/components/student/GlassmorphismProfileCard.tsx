import React, { useState, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { PartyBadge } from '@/components/ui/party-badge';
import { Hash, MapPin, Building, Mail, Crown, Gavel, Users, Trophy, Award } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useSystemSettings } from '@/hooks/useSystemSettings';

interface Student {
  id: string;
  user_id?: string;
  name: string;
  position: string;
  party_number: number;
  party_name?: string;
  serial_number: number;
  constituency?: string;
  state?: string;
  city?: string;
  photo_url?: string;
  updated_at?: string;
  email?: string;
  user_type: string;
}

interface LeaderboardData {
  final_total_score: number | null;
  ranking: number;
  total_students: number;
}

interface GlassmorphismProfileCardProps {
  student: Student;
}

const GlassmorphismProfileCard = ({ student }: GlassmorphismProfileCardProps) => {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const { settings } = useSystemSettings();
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardData | null>(null);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  
  const initials = student.name.split(' ').map(n => n[0]).join('').toUpperCase();

  useEffect(() => {
    if (settings.leaderboard_visible && student.id) {
      fetchLeaderboardData();
    }
  }, [settings.leaderboard_visible, student.id]);

  const fetchLeaderboardData = async () => {
    setLoadingLeaderboard(true);
    try {
      const { data, error } = await supabase
        .from('organizer_leaderboard')
        .select('final_total_score')
        .eq('user_id', student.user_id || student.id)
        .maybeSingle();

      if (error) throw error;

      if (!data || data.final_total_score === null || data.final_total_score <= 0) {
        setLeaderboardData(null);
        return;
      }

      const { count } = await supabase
        .from('organizer_leaderboard')
        .select('*', { count: 'exact', head: true })
        .gt('final_total_score', 0);

      const { count: higherScores } = await supabase
        .from('organizer_leaderboard')
        .select('*', { count: 'exact', head: true })
        .gt('final_total_score', data.final_total_score);

      setLeaderboardData({
        final_total_score: data.final_total_score,
        ranking: (higherScores || 0) + 1,
        total_students: count || 0
      });
    } catch (error) {
      console.error('Error fetching leaderboard data:', error);
      setLeaderboardData(null);
    } finally {
      setLoadingLeaderboard(false);
    }
  };
  
  const getPositionIcon = (position: string) => {
    const pos = position.toLowerCase();
    if (pos.includes('president') || pos.includes('prime minister')) {
      return <Crown className="w-5 h-5 text-amber-500" />;
    } else if (pos.includes('speaker') || pos.includes('deputy') || pos.includes('minister') || pos.includes('ministry')) {
      return <Gavel className="w-5 h-5 text-primary" />;
    }
    return <Users className="w-5 h-5 text-on-surface-variant/60" />;
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
    return colors[partyNumber % colors.length] || 'from-slate-500 to-slate-600';
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

  const infoItems = [
    {
      id: 'serial',
      icon: Hash,
      label: 'Serial Number',
      value: student.serial_number.toString(),
      color: 'bg-surface-container-highest',
      iconColor: 'text-on-surface-variant'
    },
    {
      id: 'constituency',
      icon: Building,
      label: 'Constituency',
      value: student.constituency,
      color: 'bg-surface-container-highest',
      iconColor: 'text-on-surface-variant'
    },
    {
      id: 'state',
      icon: MapPin,
      label: 'State',
      value: student.state,
      color: 'bg-surface-container-highest',
      iconColor: 'text-on-surface-variant'
    },
  ].filter(item => item.value);

  const leaderboardItems = settings.leaderboard_visible && leaderboardData ? [
    {
      id: 'ranking',
      icon: Trophy,
      label: 'Ranking',
      value: `#${leaderboardData.ranking} of ${leaderboardData.total_students}`,
      color: 'bg-gradient-to-br from-amber-400 to-yellow-500',
      iconColor: 'text-white'
    },
    leaderboardData.final_total_score !== null ? {
      id: 'score',
      icon: Award,
      label: 'Total Score',
      value: `${leaderboardData.final_total_score.toFixed(2)} / 100`,
      color: 'bg-gradient-to-br from-primary to-primary-glow',
      iconColor: 'text-white'
    } : null
  ].filter(Boolean) : [];

  const allInfoItems = [...infoItems, ...leaderboardItems];

  return (
    <div className="relative w-full max-w-sm">
      <div 
        className={`relative flex flex-col items-center p-6 rounded-3xl transition-all duration-500 ease-out backdrop-blur-3xl shadow-elevated ${
          isSpecialPosition(student.position, student.name)
            ? 'bg-gradient-to-br from-amber-50/90 to-surface-container-low/90'
            : 'bg-surface-container-low/80'
        }`}
      >
        {/* Avatar Section */}
        <div className="relative mb-4">
          <div className={`w-32 h-32 rounded-2xl p-1.5 transition-all duration-500 ${
            isSpecialPosition(student.position, student.name) 
              ? 'bg-gradient-to-br from-amber-400 to-yellow-500 shadow-lg shadow-amber-500/20' 
              : 'bg-surface-container-high'
          }`}>
            <div className="relative w-full h-full rounded-xl overflow-hidden bg-surface">
              <Avatar className="w-full h-full rounded-none">
                <AvatarImage 
                  src={student.photo_url
                    ? (() => {
                        const raw = student.photo_url.includes('/file/d/')
                          ? `https://drive.google.com/uc?export=view&id=${student.photo_url.split('/d/')[1]?.split('/')[0]}`
                          : student.photo_url;
                        const suffix = raw.includes('?') ? '&' : '?';
                        return `${raw}${suffix}cb=${student.updated_at ? new Date(student.updated_at).getTime() : ''}`;
                      })()
                    : undefined}
                  alt={`${student.name}'s Avatar`}
                  className="object-cover"
                  referrerPolicy="no-referrer"
                  loading="lazy"
                  decoding="async"
                />
                <AvatarFallback className={`bg-gradient-to-br ${getPartyColor(student.party_number)} text-white text-2xl font-black font-headline`}>
                  {initials}
                </AvatarFallback>
              </Avatar>
            </div>
            
            {isSpecialPosition(student.position, student.name) && (
              <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center border-4 border-surface shadow-xl">
                <Crown className="w-5 h-5 text-white" />
              </div>
            )}
          </div>
        </div>

        {/* Identity Section */}
        <div className="text-center mb-4">
          <h2 className={`text-2xl font-headline font-black tracking-tight mb-2 ${
            isSpecialPosition(student.position, student.name) ? 'text-amber-900' : 'text-on-surface'
          }`}>
            {student.name}
          </h2>
          
          <div className="flex items-center justify-center gap-2 px-4 py-1.5 rounded-full bg-surface-container-high/50 backdrop-blur-sm">
            {getPositionIcon(student.position)}
            <p className={`text-sm font-bold tracking-wide uppercase ${
              isSpecialPosition(student.position, student.name) ? 'text-amber-700' : 'text-primary'
            }`}>
              {student.position}
            </p>
          </div>
        </div>

        {/* Party Badge */}
        <div className="mb-6 w-full flex justify-center">
          <PartyBadge partyNumber={student.party_number} partyName={student.party_name} size="lg" />
        </div>

        {/* Info Grid */}
        <div className="w-full space-y-2">
          {allInfoItems.map((item) => (
            <InfoItem 
              key={item.id} 
              item={item} 
              setHoveredItem={setHoveredItem} 
              hoveredItem={hoveredItem} 
            />
          ))}
          
          {settings.leaderboard_visible && loadingLeaderboard && (
            <div className="flex items-center justify-center py-4">
              <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          )}
        </div>
      </div>
      
      {/* Dynamic Background Glow */}
      <div className={`absolute inset-0 rounded-3xl -z-10 blur-3xl opacity-20 transition-all duration-700 ${
        isSpecialPosition(student.position, student.name)
          ? 'bg-amber-400'
          : 'bg-primary'
      }`} />
    </div>
  );
};

const InfoItem = ({ item, setHoveredItem, hoveredItem }: any) => (
  <div className="relative group">
    <div
      className={`flex items-center gap-4 p-3 rounded-xl transition-all duration-300 ease-out ${
        hoveredItem === item.id ? 'bg-surface-container-highest shadow-sm' : 'bg-surface-container-high/40'
      }`}
      onMouseEnter={() => setHoveredItem(item.id)}
      onMouseLeave={() => setHoveredItem(null)}
    >
      <div className={`w-10 h-10 ${item.color} rounded-xl flex items-center justify-center shadow-inner`}>
        <item.icon className={`w-5 h-5 ${item.iconColor}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/50 mb-0.5">
          {item.label}
        </p>
        <p className="text-sm font-bold text-on-surface truncate">
          {item.value}
        </p>
      </div>
    </div>
  </div>
);

export default GlassmorphismProfileCard;



const Tooltip = ({ item, hoveredItem }: any) => (
  <div 
    role="tooltip"
    className={`absolute -top-12 left-1/2 -translate-x-1/2 z-50 px-3 py-1.5 rounded-lg backdrop-blur-md border text-xs font-medium whitespace-nowrap transition-all duration-300 ease-out pointer-events-none bg-popover text-popover-foreground border-border ${hoveredItem === item.id ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}
    style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
  >
    {item.label}
    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 bg-popover border-b border-r border-border" />
  </div>
);