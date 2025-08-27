import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <Avatar className="w-24 h-24 mx-auto mb-4">
          <AvatarImage src={profile.photo_url} alt={profile.name} />
          <AvatarFallback className="text-2xl bg-gradient-to-br from-blue-500 to-purple-600 text-white">
            {initials}
          </AvatarFallback>
        </Avatar>
        <CardTitle className="text-xl">{profile.name}</CardTitle>
        <Badge variant="secondary" className="w-fit mx-auto">
          {profile.position}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center space-x-2">
            <User className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-muted-foreground">Serial No.</p>
              <p className="font-medium">{profile.serial_number}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-muted-foreground">Party</p>
              <p className="font-medium">{profile.party_number}</p>
            </div>
          </div>
        </div>
        
        {profile.constituency && (
          <div className="flex items-center space-x-2">
            <Building className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-muted-foreground">Constituency</p>
              <p className="font-medium">{profile.constituency}</p>
            </div>
          </div>
        )}
        
        {(profile.city || profile.state) && (
          <div className="flex items-center space-x-2">
            <MapPin className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-muted-foreground">Location</p>
              <p className="font-medium">
                {[profile.city, profile.state].filter(Boolean).join(', ')}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};