import { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PartyBadge } from "@/components/ui/party-badge";
import { ProfilePhotoUploader } from "./ProfilePhotoUploader";
import { PartyLogoUploader } from "./PartyLogoUploader";
import { Hash, MapPin, Building, Users, Crown, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { ChangePasswordDialog } from "@/components/auth/ChangePasswordDialog";

interface Profile {
  id: string;
  name: string;
  position: string;
  party_number: number;
  party_name?: string;
  party_logo_url?: string;
  serial_number: number;
  committee?: string;
  constituency?: string;
  state?: string;
  city?: string;
  photo_url?: string;
  updated_at?: string;
  user_type: string;
  party_alignment?: string;
  ministry?: string;
}

interface LeaderboardData {
  final_total_score: number | null;
  ranking: number;
  total_students: number;
}

interface StudentProfileProps {
  profile: Profile;
  isOwnProfile?: boolean;
  variant?: 'default' | 'integrated';
}

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

export const StudentProfile = ({ profile, isOwnProfile = false, variant = 'default' }: StudentProfileProps) => {
  const initials = profile.name.split(' ').map(n => n[0]).join('').toUpperCase();
  const isSpecial = isSpecialPosition(profile.position, profile.name);
  const { settings } = useSystemSettings();
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardData | null>(null);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

  useEffect(() => {
    if (settings.leaderboard_visible && profile.id) {
      fetchLeaderboardData();
    }
  }, [settings.leaderboard_visible, profile.id]);

  const fetchLeaderboardData = async () => {
    setLoadingLeaderboard(true);
    try {
      const { data, error } = await supabase
        .from('organizer_leaderboard')
        .select('final_total_score')
        .eq('user_id', profile.id)
        .maybeSingle();

      if (error) throw error;

      if (!data || data.final_total_score === null) {
        setLeaderboardData(null);
        return;
      }

      const { count } = await supabase
        .from('organizer_leaderboard')
        .select('*', { count: 'exact', head: true })
        .not('final_total_score', 'is', null);

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

  return (
    <Card className={`w-full rounded-[2.5rem] overflow-hidden border-none shadow-none ${
      variant === 'integrated' 
        ? 'bg-transparent' 
        : `relative z-10 ${isSpecial ? 'bg-gradient-to-br from-amber-50 to-white' : 'bg-white/40 backdrop-blur-md'}`
    }`}>
      {/* Background Decorative Element for non-integrated cards */}
      {variant !== 'integrated' && !isSpecial && (
        <div className="absolute inset-0 z-[-1] opacity-50">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/[0.03] rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-secondary/[0.03] rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
        </div>
      )}

      <CardContent className="p-0">
        <section className={`flex flex-col lg:flex-row ${variant === 'integrated' ? 'min-h-0' : 'min-h-[600px]'}`}>
          {/* Left side - Image & Identity */}
          <div className={`${variant === 'integrated' ? 'w-full lg:w-[40%]' : 'w-full lg:w-1/2'} relative aspect-square lg:aspect-auto group/photo overflow-hidden`}>
            {profile.photo_url ? (
              <img 
                src={`${profile.photo_url}${profile.photo_url.includes('?') ? '&' : '?'}cb=${profile.updated_at ? new Date(profile.updated_at).getTime() : Date.now()}`}
                data-src={profile.photo_url}
                alt={`${profile.name} profile photo`}
                className="w-full h-full object-cover transition-transform duration-1000 group-hover/photo:scale-110"
                loading="lazy"
                onError={(e) => {
                  const target = e.currentTarget as HTMLImageElement;
                  const original = target.getAttribute('data-src') || target.src;
                  const retried = target.getAttribute('data-retried') === 'true';
                  if (!retried) {
                    target.setAttribute('data-retried', 'true');
                    target.src = `${original}${original.includes('?') ? '&' : '?'}cb=${Date.now()}`;
                    return;
                  }
                  target.style.display = 'none';
                }}
              />
            ) : (
              <div className={`w-full h-full flex items-center justify-center ${
                isSpecial 
                  ? 'bg-gradient-to-br from-amber-400 to-yellow-500' 
                  : 'bg-primary'
              }`}>
                <span className="text-display-xl text-on-primary font-display font-black italic">{initials}</span>
              </div>
            )}
            
            {/* Overlay Badges */}
            <div className="absolute top-10 left-10 flex flex-col gap-5">
              {isSpecial && (
                <div className="bg-amber-500 rounded-[1.25rem] p-5 shadow-2xl shadow-amber-500/30 backdrop-blur-md animate-in zoom-in duration-500">
                  <Crown className="w-10 h-10 text-white" />
                </div>
              )}
              {profile.party_logo_url && (
                <div className="bg-white/80 rounded-[1.25rem] p-4 shadow-2xl shadow-on-surface/5 backdrop-blur-md w-20 h-20 flex items-center justify-center overflow-hidden transition-transform hover:scale-110 duration-500">
                  <img src={profile.party_logo_url} alt="Party Logo" className="w-full h-full object-contain" />
                </div>
              )}
            </div>

            {isOwnProfile && (
              <div className="absolute bottom-10 right-10 flex flex-col gap-5 opacity-0 group-hover/photo:opacity-100 transition-opacity duration-500">
                <ProfilePhotoUploader currentPhotoUrl={profile.photo_url} />
                <PartyLogoUploader currentLogoUrl={profile.party_logo_url} />
              </div>
            )}
          </div>

          {/* Right side - Profile Details */}
          <div className={`${variant === 'integrated' ? 'w-full lg:w-[60%]' : 'w-full lg:w-1/2'} p-10 lg:p-20 flex flex-col justify-center`}>
            <header className="mb-16">
              <div className="space-y-4 mb-10">
                <CardTitle className={`text-display-md lg:text-display-lg font-display font-black tracking-tighter leading-none uppercase italic ${
                  isSpecial ? 'text-amber-800' : 'text-on-surface'
                }`}>
                  {profile.name.replace(/^Delegate\s+/i, '')}
                </CardTitle>
                <div className="flex items-center gap-4">
                  <div className={`h-1.5 w-12 rounded-full ${isSpecial ? 'bg-amber-500' : 'bg-primary'}`} />
                  <span className={`text-label-sm font-black uppercase tracking-[0.4em] ${
                    isSpecial ? 'text-amber-600' : 'text-primary'
                  }`}>{profile.position}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <PartyBadge 
                  partyNumber={profile.party_number} 
                  partyName={profile.party_name} 
                  partyLogoUrl={profile.party_logo_url}
                  size="lg" 
                />
                
                {profile.party_alignment && (
                  <Badge variant="outline" className={`px-8 py-3 text-label-xs border-none shadow-none font-black rounded-full uppercase tracking-widest ${
                    profile.party_alignment === 'ruling_party' ? 'bg-primary text-on-primary shadow-lg shadow-primary/20' : 
                    profile.party_alignment === 'opposition' ? 'bg-secondary text-on-secondary shadow-lg shadow-secondary/20' : 
                    'bg-surface-container-high text-on-surface-variant/40'
                  }`}>
                    {profile.party_alignment.replace('_', ' ')}
                  </Badge>
                )}
              </div>
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-12 mb-20">
              <div className="flex items-center gap-6 group cursor-default">
                <div className="w-20 h-20 bg-surface-container-low rounded-[2rem] flex items-center justify-center flex-shrink-0 group-hover:bg-primary/5 transition-all duration-700">
                  <Hash className="w-8 h-8 text-on-surface-variant/30 group-hover:text-primary transition-colors" />
                </div>
                <div className="space-y-1">
                  <p className="text-label-xs font-black text-on-surface-variant/30 uppercase tracking-[0.3em]">Serial ID</p>
                  <p className="text-display-xs font-display font-black text-on-surface italic">{profile.serial_number}</p>
                </div>
              </div>

              {profile.committee && (
                <div className="flex items-center gap-6 group cursor-default">
                  <div className="w-20 h-20 bg-surface-container-low rounded-[2rem] flex items-center justify-center flex-shrink-0 group-hover:bg-primary/5 transition-all duration-700">
                    <Users className="w-8 h-8 text-on-surface-variant/30 group-hover:text-primary transition-colors" />
                  </div>
                  <div className="space-y-1 min-w-0">
                    <p className="text-label-xs font-black text-on-surface-variant/30 uppercase tracking-[0.3em]">Committee</p>
                    <p className="text-headline-sm font-display font-black text-on-surface truncate uppercase italic tracking-tight">{profile.committee}</p>
                  </div>
                </div>
              )}

              {profile.ministry && (
                <div className="flex items-center gap-6 group cursor-default">
                  <div className="w-20 h-20 bg-amber-50 rounded-[2rem] flex items-center justify-center flex-shrink-0 group-hover:bg-amber-100 transition-all duration-700">
                    <Crown className="w-8 h-8 text-amber-500" />
                  </div>
                  <div className="space-y-1 min-w-0">
                    <p className="text-label-xs font-black text-amber-600/40 uppercase tracking-[0.3em]">Ministry</p>
                    <p className="text-headline-sm font-display font-black text-on-surface uppercase italic tracking-tight">{profile.ministry}</p>
                  </div>
                </div>
              )}
              
              {profile.constituency && (
                <div className="flex items-center gap-6 group cursor-default">
                  <div className="w-20 h-20 bg-surface-container-low rounded-[2rem] flex items-center justify-center flex-shrink-0 group-hover:bg-primary/5 transition-all duration-700">
                    <Building className="w-8 h-8 text-on-surface-variant/30 group-hover:text-primary transition-colors" />
                  </div>
                  <div className="space-y-1 min-w-0">
                    <p className="text-label-xs font-black text-on-surface-variant/30 uppercase tracking-[0.3em]">Constituency</p>
                    <p className="text-headline-sm font-display font-black text-on-surface uppercase italic tracking-tight">{profile.constituency}</p>
                  </div>
                </div>
              )}

              {profile.state && (
                <div className="flex items-center gap-6 group cursor-default">
                  <div className="w-20 h-20 bg-surface-container-low rounded-[2rem] flex items-center justify-center flex-shrink-0 group-hover:bg-primary/5 transition-all duration-700">
                    <MapPin className="w-8 h-8 text-on-surface-variant/30 group-hover:text-primary transition-colors" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-label-xs font-black text-on-surface-variant/30 uppercase tracking-[0.3em]">Region</p>
                    <p className="text-headline-sm font-display font-black text-on-surface uppercase italic tracking-tight">
                      {profile.state}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Leaderboard & Security Section */}
            <div className="pt-16 space-y-10 border-t border-on-surface-variant/5">
              {settings.leaderboard_visible && leaderboardData && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                  <div className="bg-primary rounded-[2.5rem] p-8 text-on-primary shadow-2xl shadow-primary/20 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-1000" />
                    <p className="text-label-xs opacity-60 mb-3 font-black uppercase tracking-[0.3em] relative z-10">Current Rank</p>
                    <p className="text-display-md font-display font-black italic uppercase relative z-10 tracking-tighter">#{leaderboardData.ranking}</p>
                    <p className="text-label-xs opacity-40 mt-2 font-black uppercase tracking-[0.1em] relative z-10">Global Standing</p>
                  </div>
                  <div className="bg-white/60 backdrop-blur-md rounded-[2.5rem] p-8 shadow-2xl shadow-on-surface/5 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-1000" />
                    <p className="text-label-xs text-on-surface-variant/40 mb-3 font-black uppercase tracking-[0.3em] relative z-10">Impact Score</p>
                    <p className="text-display-md font-display font-black text-primary italic uppercase relative z-10 tracking-tighter">{leaderboardData.final_total_score?.toFixed(1)}</p>
                    <p className="text-label-xs text-on-surface-variant/20 mt-2 font-black uppercase tracking-[0.1em] relative z-10">Out of 100.0</p>
                  </div>
                </div>
              )}

              {isOwnProfile && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-8 p-8 bg-surface-container-low/40 rounded-[2.5rem] backdrop-blur-sm">
                  <div className="w-full sm:w-auto">
                    <ChangePasswordDialog />
                  </div>
                  <div className="hidden sm:block h-16 w-px bg-on-surface-variant/5" />
                  <div className="flex items-center gap-5">
                    <div className="w-14 h-14 rounded-[1.25rem] bg-tertiary/10 flex items-center justify-center shadow-inner">
                      <ShieldCheck className="w-7 h-7 text-tertiary" />
                    </div>
                    <div>
                      <p className="text-label-xs font-black text-on-surface-variant/30 uppercase tracking-[0.2em]">Security Status</p>
                      <p className="text-label-md font-black text-tertiary uppercase tracking-widest">Authenticated Access</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </CardContent>
    </Card>
  );
};