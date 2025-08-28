import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Hash, MapPin, Building, Users } from "lucide-react";

interface Profile {
  id: string;
  name: string;
  position: string;
  party_number: number;
  serial_number: number;
  constituency?: string;
  state?: string;
  city?: string;
  photo_url?: string;
  user_type: string;
}

interface StudentProfileProps {
  profile: Profile;
  isOwnProfile?: boolean;
}

export const StudentProfile = ({ profile, isOwnProfile = false }: StudentProfileProps) => {
  const initials = profile.name.split(' ').map(n => n[0]).join('').toUpperCase();

  return (
    <Card className="w-full bg-white rounded-3xl shadow-lg border border-border/20 overflow-hidden">
      <CardContent className="p-0">
        <section className="flex min-h-[400px]">
          {/* Left side - Image (Half width) */}
          <div className="w-1/2 relative">
            {profile.photo_url ? (
              <img 
                src={profile.photo_url} 
                alt={`${profile.name} profile photo`}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center">
                <span className="text-6xl font-bold text-primary-foreground">{initials}</span>
              </div>
            )}
          </div>

          {/* Right side - Profile Details (Half width) */}
          <div className="w-1/2 p-8 flex flex-col justify-center space-y-6">
            <header className="space-y-4">
              <CardTitle className="text-4xl font-serif font-bold text-foreground leading-tight">
                {profile.name}
              </CardTitle>
              <Badge className="px-6 py-3 text-lg font-semibold bg-blue-100 text-blue-800 border-none rounded-xl w-fit">
                {profile.position}
              </Badge>
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
              
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gray-200 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Users className="w-6 h-6 text-gray-600" />
                </div>
                <div className="space-y-1">
                  <p className="text-base font-semibold text-muted-foreground">Party</p>
                  <p className="text-2xl font-bold text-foreground">Party {profile.party_number}</p>
                </div>
              </div>

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

              {(profile.city || profile.state) && (
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gray-200 rounded-xl flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-6 h-6 text-gray-600" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-base font-semibold text-muted-foreground">Location</p>
                    <p className="text-xl font-semibold text-foreground">
                      {[profile.city, profile.state].filter(Boolean).join(', ')}
                    </p>
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