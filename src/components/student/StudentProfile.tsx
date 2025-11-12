import { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PartyBadge } from "@/components/ui/party-badge";
import { ProfilePhotoUploader } from "./ProfilePhotoUploader";
import { Hash, MapPin, Building, Users, Crown, Trophy, Award } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSystemSettings } from "@/hooks/useSystemSettings";

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
}

interface LeaderboardData {
  final_total_score: number | null;
  ranking: number;
  total_students: number;
}

interface StudentProfileProps {
  profile: Profile;
  isOwnProfile?: boolean;
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

export const StudentProfile = ({ profile, isOwnProfile = false }: StudentProfileProps) => {
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
        .single();

      if (error) throw error;

      // Get total number of students
      const { count } = await supabase
        .from('organizer_leaderboard')
        .select('*', { count: 'exact', head: true })
        .not('final_total_score', 'is', null);

      // Calculate ranking
      const { count: higherScores } = await supabase
        .from('organizer_leaderboard')
        .select('*', { count: 'exact', head: true })
        .gt('final_total_score', data?.final_total_score || 0);

      setLeaderboardData({
        final_total_score: data?.final_total_score || null,
        ranking: (higherScores || 0) + 1,
        total_students: count || 0
      });
    } catch (error) {
      console.error('Error fetching leaderboard data:', error);
    } finally {
      setLoadingLeaderboard(false);
    }
  };

  return (
    <Card className={`w-full rounded-3xl shadow-lg border overflow-hidden ${
      isSpecial 
        ? 'bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-300' 
        : 'bg-white border-border/20'
    }`}>
      <CardContent className="p-0">
        <section className="flex min-h-[400px]">
          {/* Left side - Image (Half width) */}
          <div className="w-1/2 relative">
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

          {/* Right side - Profile Details (Half width) */}
          <div className="w-1/2 p-8 flex flex-col justify-center space-y-6">
            <header className="space-y-4">
              <CardTitle className={`text-4xl font-serif font-bold leading-tight ${
                isSpecial ? 'text-amber-800' : 'text-foreground'
              }`}>
                {profile.name}
              </CardTitle>
              <div className="flex items-center gap-3">
                <span className={`text-lg font-semibold ${
                  isSpecial ? 'text-amber-700' : 'text-muted-foreground'
                }`}>{profile.position}</span>
                <span className="text-muted-foreground">•</span>
                <PartyBadge partyNumber={profile.party_number} partyName={profile.party_name} size="md" />
              </div>
            </header>

            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gray-200 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Hash className="w-6 h-6 text-gray-600" />
                </div>
                <div className="space-y-1">
                  <p className="text-base font-semibold text-muted-foreground">Roll Number</p>
                  <p className="text-2xl font-bold text-foreground">{profile.serial_number}</p>
                </div>
              </div>

              {profile.committee && (
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gray-200 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Users className="w-6 h-6 text-gray-600" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-base font-semibold text-muted-foreground">Committee</p>
                    <p className="text-2xl font-bold text-foreground">{profile.committee}</p>
                  </div>
                </div>
              )}
              

              {profile.constituency && (
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gray-200 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Building className="w-6 h-6 text-gray-600" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-base font-semibold text-muted-foreground">Constituency</p>
                    <p className="text-xl font-semibold text-foreground">{profile.constituency}</p>
                  </div>
                </div>
              )}

              {profile.state && (
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gray-200 rounded-xl flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-6 h-6 text-gray-600" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-base font-semibold text-muted-foreground">State</p>
                    <p className="text-xl font-semibold text-foreground">
                      {profile.state}
                    </p>
                  </div>
                </div>
              )}

              {/* Leaderboard Scores - Only shown when leaderboard is visible */}
              {settings.leaderboard_visible && leaderboardData && (
                <div className="pt-4 mt-4 border-t-2 border-primary/20 space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-yellow-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                      <Trophy className="w-6 h-6 text-white" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-base font-semibold text-muted-foreground">Ranking</p>
                      <p className="text-2xl font-bold text-foreground">
                        #{leaderboardData.ranking} <span className="text-base text-muted-foreground">of {leaderboardData.total_students}</span>
                      </p>
                    </div>
                  </div>

                  {leaderboardData.final_total_score !== null && (
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-primary to-primary-glow rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                        <Award className="w-6 h-6 text-white" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-base font-semibold text-muted-foreground">Total Score</p>
                        <p className="text-2xl font-bold text-foreground">
                          {leaderboardData.final_total_score.toFixed(2)} <span className="text-base text-muted-foreground">/ 100</span>
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
            </div>
          </div>
        </section>
      </CardContent>
    </Card>
  );
};