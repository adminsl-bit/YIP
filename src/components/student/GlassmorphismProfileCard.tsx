import React, { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Hash, MapPin, Building, Mail, Crown, Gavel, Users } from 'lucide-react';

interface Student {
  id: string;
  name: string;
  position: string;
  party_number: number;
  serial_number: number;
  constituency?: string;
  state?: string;
  city?: string;
  photo_url?: string;
  email?: string;
  user_type: string;
}

interface GlassmorphismProfileCardProps {
  student: Student;
}

const GlassmorphismProfileCard = ({ student }: GlassmorphismProfileCardProps) => {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  
  const initials = student.name.split(' ').map(n => n[0]).join('').toUpperCase();
  
  const getPositionIcon = (position: string) => {
    const pos = position.toLowerCase();
    if (pos.includes('president') || pos.includes('prime minister')) {
      return <Crown className="w-5 h-5 text-amber-400" />;
    } else if (pos.includes('speaker') || pos.includes('deputy')) {
      return <Gavel className="w-5 h-5 text-blue-400" />;
    }
    return <Users className="w-5 h-5 text-slate-400" />;
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

  const infoItems = [
    {
      id: 'serial',
      icon: Hash,
      label: 'Serial Number',
      value: student.serial_number.toString(),
      color: 'bg-gray-200',
      iconColor: 'text-gray-600'
    },
    {
      id: 'constituency',
      icon: Building,
      label: 'Constituency',
      value: student.constituency,
      color: 'bg-gray-200',
      iconColor: 'text-gray-600'
    },
    {
      id: 'state',
      icon: MapPin,
      label: 'State',
      value: student.state,
      color: 'bg-gray-200',
      iconColor: 'text-gray-600'
    },
    {
      id: 'city',
      icon: Mail,
      label: 'Student City',
      value: student.city,
      color: 'bg-gray-200',
      iconColor: 'text-gray-600'
    }
  ].filter(item => item.value);

  return (
    <div className="relative w-full max-w-sm">
      <div 
        className="relative flex flex-col items-center p-8 rounded-3xl border transition-all duration-500 ease-out backdrop-blur-xl bg-white border-border/20 shadow-2xl"
      >
        {/* Avatar */}
        <div className="w-24 h-24 mb-4 rounded-full p-1 border-2 border-border/30">
          <Avatar className="w-full h-full">
            <AvatarImage 
              src={student.photo_url} 
              alt={`${student.name}'s Avatar`}
              className="object-cover"
            />
            <AvatarFallback className={`bg-gradient-to-br ${getPartyColor(student.party_number)} text-white text-xl font-bold`}>
              {initials}
            </AvatarFallback>
          </Avatar>
        </div>

        {/* Name and Title */}
        <h2 className="text-2xl font-bold text-card-foreground text-center">{student.name}</h2>
        
        <div className="flex items-center gap-2 mt-1 mb-2">
          {getPositionIcon(student.position)}
          <p className="text-sm font-medium text-primary">{student.position}</p>
        </div>

        {/* Party Badge */}
        <Badge className={`bg-gradient-to-r ${getPartyColor(student.party_number)} text-white font-bold px-4 py-1 mb-4`}>
          Party {student.party_number}
        </Badge>

        {/* Divider */}
        <div className="w-1/2 h-px my-4 rounded-full bg-border" />

        {/* Info Items */}
        <div className="w-full space-y-3">
          {infoItems.map((item) => (
            <InfoItem 
              key={item.id} 
              item={item} 
              setHoveredItem={setHoveredItem} 
              hoveredItem={hoveredItem} 
            />
          ))}
        </div>
      </div>
      
      {/* Background Glow */}
      <div className="absolute inset-0 rounded-3xl -z-10 transition-all duration-500 ease-out blur-2xl opacity-30 bg-gradient-to-r from-indigo-500/50 to-purple-500/50" />
    </div>
  );
};

// Sub-components
const InfoItem = ({ item, setHoveredItem, hoveredItem }: any) => (
  <div className="relative">
    <div
      className="flex items-center gap-3 p-3 rounded-xl transition-all duration-300 ease-out group overflow-hidden bg-gray-100 hover:bg-gray-200"
      onMouseEnter={() => setHoveredItem(item.id)}
      onMouseLeave={() => setHoveredItem(null)}
    >
      <div className={`w-8 h-8 ${item.color} rounded-lg flex items-center justify-center`}>
        <item.icon className={`w-4 h-4 ${item.iconColor}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
        <p className="text-sm font-semibold text-card-foreground truncate">{item.value}</p>
      </div>
    </div>
    <Tooltip item={item} hoveredItem={hoveredItem} />
  </div>
);


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

export default GlassmorphismProfileCard;