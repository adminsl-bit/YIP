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
      <CardContent className="p-0">
        <section className="flex">
          {/* Left side - Avatar */}
          <div className="w-48 flex-shrink-0 p-8 flex items-center justify-center bg-gradient-to-br from-white/10 to-white/5 rounded-l-3xl">
            <Avatar className="w-32 h-32 ring-4 ring-white/30 shadow-2xl">
              <AvatarImage src={profile.photo_url} alt={`${profile.name} profile photo`} />
              <AvatarFallback className="text-3xl bg-gradient-to-br from-primary to-primary-glow text-white font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
          </div>

          {/* Right side - Profile Details */}
          <div className="flex-1 p-8">
            <header className="mb-6">
              <CardTitle className="text-3xl font-serif font-bold text-slate-800 mb-3">
                {profile.name}
              </CardTitle>
              <Badge variant="secondary" className="px-4 py-2 text-sm font-semibold bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-slate-700 border-none">
                {profile.position}
              </Badge>
            </header>

            <div className="grid grid-cols-2 gap-6 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500/20 to-blue-600/20 rounded-xl flex items-center justify-center">
                  <User className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500 mb-1">Serial Number</p>
                  <p className="text-lg font-bold text-slate-800">{profile.serial_number}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-green-500/20 to-green-600/20 rounded-xl flex items-center justify-center">
                  <Users className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500 mb-1">Party Number</p>
                  <p className="text-lg font-bold text-slate-800">{profile.party_number}</p>
                </div>
              </div>
            </div>

            {profile.constituency && (
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500/20 to-purple-600/20 rounded-xl flex items-center justify-center">
                  <Building className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500 mb-1">Constituency</p>
                  <p className="text-lg font-semibold text-slate-800">{profile.constituency}</p>
                </div>
              </div>
            )}

            {(profile.city || profile.state) && (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-orange-500/20 to-orange-600/20 rounded-xl flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500 mb-1">Location</p>
                  <p className="text-lg font-semibold text-slate-800">
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