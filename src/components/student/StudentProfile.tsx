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
    <Card className="w-full max-w-md mx-auto bg-card rounded-3xl shadow-lg overflow-hidden transition-transform duration-700 hover:scale-[1.02]">
      <CardContent className="p-0">
        {/* Large Profile Image Section */}
        <div className="relative overflow-hidden group">
          <div className="w-full aspect-square">
            {profile.photo_url ? (
              <img 
                src={profile.photo_url} 
                alt={`${profile.name} profile photo`}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center">
                <span className="text-6xl font-bold text-primary-foreground">{initials}</span>
              </div>
            )}
          </div>
          
          {/* Gradient Overlay */}
          <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/40 to-transparent pointer-events-none"></div>
          
          {/* Name Overlay */}
          <div className="absolute top-6 left-6">
            <h2 className="text-2xl font-serif font-bold text-white drop-shadow-lg">{profile.name}</h2>
            <Badge variant="secondary" className="mt-2 bg-white/20 text-white border-white/30 hover:bg-white/30">
              {profile.position}
            </Badge>
          </div>
        </div>
        
        {/* Bottom Info Section */}
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="w-8 h-8 ring-2 ring-border transition-transform duration-500 hover:scale-110">
              <AvatarImage src={profile.photo_url} alt={`${profile.name} avatar`} />
              <AvatarFallback className="text-xs bg-muted">{initials}</AvatarFallback>
            </Avatar>
            <div className="transition-transform duration-500 hover:translate-x-1">
              <div className="text-sm font-medium text-foreground">Roll #{profile.serial_number}</div>
              <div className="text-xs text-muted-foreground">Party {profile.party_number}</div>
            </div>
          </div>
          
          <div className="text-right">
            <div className="text-sm font-medium text-foreground">{profile.constituency || 'N/A'}</div>
            <div className="text-xs text-muted-foreground">
              {[profile.city, profile.state].filter(Boolean).join(', ') || 'Location N/A'}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};