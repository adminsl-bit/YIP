import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, MapPin, Building, Users } from "lucide-react";

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
    <Card className="w-full bg-white/15 backdrop-blur-lg rounded-3xl border border-white/25 shadow-xl">
      <CardContent className="p-6">
        <section className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          <Avatar className="w-28 h-28 flex-shrink-0 ring-2 ring-primary/20">
            <AvatarImage src={profile.photo_url} alt={`${profile.name} profile photo`} />
            <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 w-full">
            <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="text-2xl">{profile.name}</CardTitle>
                <Badge variant="secondary" className="mt-2 w-fit">
                  {profile.position}
                </Badge>
              </div>
            </header>

            <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground">Serial No.</p>
                  <p className="font-medium">{profile.serial_number}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground">Party</p>
                  <p className="font-medium">{profile.party_number}</p>
                </div>
              </div>
            </div>

            {profile.constituency && (
              <div className="mt-6 flex items-center gap-2">
                <Building className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground">Constituency</p>
                  <p className="font-medium">{profile.constituency}</p>
                </div>
              </div>
            )}

            {(profile.city || profile.state) && (
              <div className="mt-3 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground">Location</p>
                  <p className="font-medium">
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