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
    <Card className="w-full bg-white rounded-3xl shadow-lg border border-border/20">
      <CardContent className="p-0">
        <section className="flex min-h-[400px]">
          {/* Left side - Avatar */}
          <div className="w-80 flex-shrink-0 p-8 flex items-center justify-center bg-gradient-to-br from-muted/20 to-muted/10 rounded-l-3xl">
            <Avatar className="w-48 h-48 ring-4 ring-border/30 shadow-2xl">
              <AvatarImage src={profile.photo_url} alt={`${profile.name} profile photo`} />
              <AvatarFallback className="text-5xl bg-gradient-to-br from-primary to-primary-glow text-primary-foreground font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
          </div>

          {/* Right side - Profile Details */}
          <div className="flex-1 p-8 flex flex-col justify-center space-y-8">
            <header className="space-y-4">
              <CardTitle className="text-4xl font-serif font-bold text-foreground leading-tight">
                {profile.name}
              </CardTitle>
              <Badge variant="secondary" className="px-6 py-3 text-lg font-semibold bg-secondary/20 text-secondary-foreground border-none rounded-xl">
                {profile.position}
              </Badge>
            </header>

            <div className="grid grid-cols-1 gap-8">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-gray-200 rounded-2xl flex items-center justify-center">
                  <Hash className="w-7 h-7 text-gray-600" />
                </div>
                <div className="space-y-1">
                  <p className="text-lg font-semibold text-muted-foreground">Roll Number</p>
                  <p className="text-2xl font-bold text-foreground">{profile.serial_number}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-gray-200 rounded-2xl flex items-center justify-center">
                  <Users className="w-7 h-7 text-gray-600" />
                </div>
                <div className="space-y-1">
                  <p className="text-lg font-semibold text-muted-foreground">Party</p>
                  <p className="text-2xl font-bold text-foreground">Party {profile.party_number}</p>
                </div>
              </div>
            </div>

            {profile.constituency && (
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-gray-200 rounded-2xl flex items-center justify-center">
                  <Building className="w-7 h-7 text-gray-600" />
                </div>
                <div className="space-y-1">
                  <p className="text-lg font-semibold text-muted-foreground">Constituency</p>
                  <p className="text-2xl font-semibold text-foreground">{profile.constituency}</p>
                </div>
              </div>
            )}

            {(profile.city || profile.state) && (
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-gray-200 rounded-2xl flex items-center justify-center">
                  <MapPin className="w-7 h-7 text-gray-600" />
                </div>
                <div className="space-y-1">
                  <p className="text-lg font-semibold text-muted-foreground">Location</p>
                  <p className="text-2xl font-semibold text-foreground">
                    {[profile.city, profile.state].filter(Boolean).join(', ')}
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>
      </CardContent>
    </Card>
  );
};