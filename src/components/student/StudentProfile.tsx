import { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PartyBadge } from "@/components/ui/party-badge";
import { ProfilePhotoUploader } from "./ProfilePhotoUploader";
import { Hash, MapPin, Building, Users, Crown, Trophy, Award } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { ChangePasswordDialog } from "@/components/auth/ChangePasswordDialog";

interface Profile {
  id: string;
  name: string;
  position: string;
  party_number: number;
  party_name?: string;
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
      // Fetch student's score and ranking
      const { data, error } = await supabase
        .from('organizer_leaderboard')
        .select('final_total_score')
        .eq('user_id', profile.id)
        .maybeSingle();

      if (error) throw error;

      // If no data exists or score is null, don't show leaderboard
      if (!data || data.final_total_score === null) {
        setLeaderboardData(null);
        return;
      }

      // Get total number of students with scores
      const { count } = await supabase
        .from('organizer_leaderboard')
        .select('*', { count: 'exact', head: true })
        .not('final_total_score', 'is', null);

      // Calculate ranking
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
    <Card className={`w-full rounded-[2.5rem] overflow-hidden ${
      variant === 'integrated' 
        ? 'shadow-none border-none bg-transparent' 
        : `shadow-lg border ${isSpecial ? 'bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-300' : 'bg-white border-border/20'}`
    }`}>
      <CardContent className="p-0">
        <section className={`flex flex-col md:flex-row ${variant === 'integrated' ? 'min-h-0' : 'min-h-[500px]'}`}>
          {/* Left side - Image */}
          <div className={`${variant === 'integrated' ? 'w-full md:w-[40%]' : 'w-full md:w-1/2'} relative aspect-square md:aspect-auto`}>
            {profile.photo_url ? (
              <img 
                src={`${profile.photo_url}${profile.photo_url.includes('?') ? '&' : '?'}cb=${profile.updated_at ? new Date(profile.updated_at).getTime() : Date.now()}`}
                data-src={profile.photo_url}
                alt={`${profile.name} profile photo`}
                className="w-full h-full object-cover"
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
                  : 'bg-gradient-to-br from-primary to-primary-glow'
              }`}>
                <span className="text-6xl font-bold text-primary-foreground">{initials}</span>
              </div>
            )}
            {isSpecial && (
              <div className="absolute top-4 left-4 bg-amber-500 rounded-full p-2 shadow-lg">
                <Crown className="w-6 h-6 text-white" />
              </div>
            )}
            {isOwnProfile && (
              <div className="absolute bottom-4 right-4">
                <ProfilePhotoUploader currentPhotoUrl={profile.photo_url} />
              </div>
            )}
          </div>

          {/* Right side - Profile Details */}
          <div className={`${variant === 'integrated' ? 'w-full md:w-[60%]' : 'w-full md:w-1/2'} p-8 md:p-12 flex flex-col justify-center space-y-8`}>
            <header className="space-y-4">
              <CardTitle className={`text-2xl md:text-3xl font-headline font-black leading-tight ${
                isSpecial ? 'text-amber-800' : 'text-[#191c1e]'
              }`}>
                {profile.name.replace(/^Delegate\s+/i, '')}
              </CardTitle>
              <div className="flex flex-wrap items-center gap-3">
                <span className={`text-base font-bold ${
                  isSpecial ? 'text-amber-700' : 'text-slate-500'
                }`}>{profile.position}</span>
                <span className="text-muted-foreground">•</span>
                <PartyBadge partyNumber={profile.party_number} partyName={profile.party_name} size="md" />
                <Badge variant="outline" className="px-3 py-1 text-[10px] font-black uppercase tracking-widest bg-blue-50 text-blue-600 border-none">
                  Party {profile.party_number}
                </Badge>
                {profile.party_alignment && (
                  <Badge variant="outline" className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest border-none ${
                    profile.party_alignment === 'ruling_party' ? 'bg-indigo-50 text-[#13298f]' : 
                    profile.party_alignment === 'opposition' ? 'bg-red-50 text-[#ac3509]' : 
                    'bg-slate-50 text-slate-400'
                  }`}>
                    {profile.party_alignment.replace('_', ' ')}
                  </Badge>
                )}
              </div>
            </header>

            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Hash className="w-5 h-5 text-slate-400" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Roll Number</p>
                  <p className="text-xl font-headline font-black text-[#191c1e]">{profile.serial_number}</p>
                </div>
              </div>

              {profile.committee && (
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Users className="w-5 h-5 text-slate-400" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Committee</p>
                    <p className="text-xl font-headline font-black text-[#191c1e]">{profile.committee}</p>
                  </div>
                </div>
              )}

              {profile.ministry && (
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Crown className="w-5 h-5 text-amber-500" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-amber-400 uppercase tracking-widest">Ministry</p>
                    <p className="text-xl font-headline font-black text-[#191c1e]">{profile.ministry}</p>
                  </div>
                </div>
              )}
              

              {profile.constituency && (
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Building className="w-5 h-5 text-slate-400" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Constituency</p>
                    <p className="text-lg font-headline font-black text-[#191c1e]">{profile.constituency}</p>
                  </div>
                </div>
              )}

              {profile.state && (
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-5 h-5 text-slate-400" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">State</p>
                    <p className="text-lg font-headline font-black text-[#191c1e]">
                      {profile.state}
                    </p>
                  </div>
                </div>
              )}

              {/* Leaderboard Scores - Only shown when leaderboard is visible */}
              {settings.leaderboard_visible && leaderboardData && (
                <div className="pt-4 mt-4 border-t-2 border-primary/20 space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-yellow-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-amber-200">
                      <Trophy className="w-5 h-5 text-white" />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Ranking</p>
                      <p className="text-xl font-headline font-black text-[#191c1e]">
                        #{leaderboardData.ranking} <span className="text-xs text-slate-400">of {leaderboardData.total_students}</span>
                      </p>
                    </div>
                  </div>

                  {leaderboardData.final_total_score !== null && (
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary-glow rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-200">
                        <Award className="w-5 h-5 text-white" />
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Score</p>
                        <p className="text-xl font-headline font-black text-[#191c1e]">
                          {leaderboardData.final_total_score.toFixed(2)} <span className="text-xs text-slate-400">/ 100</span>
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {settings.leaderboard_visible && loadingLeaderboard && (
                <div className="pt-4 mt-4 border-t-2 border-primary/20">
                  <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                </div>
              )}

              {/* Change Password Button - Only for own profile */}
              {isOwnProfile && (
                <div className="pt-4 mt-4 border-t-2 border-primary/20">
                  <ChangePasswordDialog />
                </div>
              )}
            </div>
          </div>
        </section>
      </CardContent>
    </Card>
  );
};