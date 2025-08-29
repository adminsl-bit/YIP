import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Crown, Gavel, Users, MapPin, Search, X } from 'lucide-react';
import GlassmorphismProfileCard from './GlassmorphismProfileCard';
import { motion, AnimatePresence } from 'framer-motion';

interface Student {
  id: string;
  name: string;
  position: string;
  party_number: number;
  party_name?: string;
  serial_number: number;
  constituency?: string;
  state?: string;
  city?: string;
  photo_url?: string;
  email?: string;
  user_type: string;
}

const InteractiveParliamentTree = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [hoveredStudent, setHoveredStudent] = useState<string | null>(null);

  useEffect(() => {
    fetchStudents();
  }, []);

  useEffect(() => {
    const filtered = students.filter(student =>
      student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.position.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.constituency?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.state?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredStudents(filtered);
  }, [students, searchTerm]);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_type', 'student')
        .order('party_number')
        .order('serial_number');

      if (error) {
        console.error('Error fetching students:', error);
        return;
      }

      setStudents(data || []);
      setFilteredStudents(data || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPositionIcon = (position: string) => {
    const pos = position.toLowerCase();
    if (pos.includes('president') || pos.includes('prime minister')) {
      return <Crown className="w-4 h-4 text-yellow-500" />;
    } else if (pos.includes('speaker') || pos.includes('deputy')) {
      return <Gavel className="w-4 h-4 text-blue-500" />;
    }
    return <Users className="w-4 h-4 text-gray-500" />;
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
    return colors[partyNumber % colors.length] || 'from-gray-500 to-gray-600';
  };

  const getPartyBorderColor = (partyNumber: number) => {
    const colors = [
      'border-red-400',
      'border-blue-400',
      'border-green-400',
      'border-yellow-400',
      'border-purple-400',
      'border-pink-400',
      'border-indigo-400',
      'border-teal-400'
    ];
    return colors[partyNumber % colors.length] || 'border-gray-400';
  };

  const groupByParty = (students: Student[]) => {
    return students.reduce((groups, student) => {
      const party = student.party_number;
      if (!groups[party]) {
        groups[party] = [];
      }
      groups[party].push(student);
      return groups;
    }, {} as Record<number, Student[]>);
  };

  if (loading) {
    return (
      <div className="bg-white/15 backdrop-blur-lg rounded-3xl p-8 border border-white/25 shadow-xl">
        <div className="flex items-center justify-center gap-4 mb-6">
          <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-teal-500 rounded-2xl flex items-center justify-center shadow-lg">
            <Users className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-2xl font-black text-slate-800">Parliament Tree</h2>
        </div>
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-green-500 border-t-transparent shadow-lg"></div>
        </div>
      </div>
    );
  }

  const groupedStudents = groupByParty(filteredStudents);

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-4 mb-4">
          <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-teal-500 rounded-3xl flex items-center justify-center shadow-lg shadow-green-500/30">
            <Users className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-4xl font-black text-transparent bg-gradient-to-r from-green-600 to-teal-600 bg-clip-text">
            Parliament Tree
          </h2>
        </div>
        <p className="text-lg text-slate-600 font-semibold mb-6">
          Meet all parliament members organized by their respective parties
        </p>
        
        <div className="max-w-md mx-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
            <Input
              placeholder="Search by name, position, constituency..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12 bg-white/20 backdrop-blur-sm border-white/30 text-slate-800 placeholder:text-slate-500 focus:bg-white/30 focus:border-white/50 rounded-2xl h-12 text-lg font-medium"
            />
          </div>
        </div>
      </div>

      {Object.keys(groupedStudents).length === 0 ? (
        <div className="bg-white/15 backdrop-blur-lg rounded-3xl p-12 border border-white/25 shadow-xl text-center">
          <div className="relative inline-block mb-6">
            <div className="w-20 h-20 bg-gradient-to-br from-gray-400 to-gray-500 rounded-3xl flex items-center justify-center mx-auto shadow-lg">
              <Users className="w-10 h-10 text-white" />
            </div>
            <div className="absolute -top-2 -right-2 w-6 h-6 bg-gray-400/40 rounded-full animate-bounce"></div>
          </div>
          <h3 className="text-2xl font-black text-slate-800 mb-4">No Members Found</h3>
          <p className="text-lg text-slate-600 font-medium">
            No parliament members found matching your search criteria.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedStudents)
            .sort(([a], [b]) => parseInt(a) - parseInt(b))
            .map(([partyNumber, partyStudents]) => (
              <motion.div
                key={partyNumber}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="bg-white/15 backdrop-blur-lg rounded-3xl p-6 border border-white/25 shadow-xl"
              >
                <div className="mb-6 text-center">
                  <div className={`inline-flex items-center gap-3 px-6 py-3 rounded-2xl bg-gradient-to-r ${getPartyColor(parseInt(partyNumber))} text-white font-black text-xl shadow-lg`}>
                    <Users className="w-6 h-6" />
                    {partyStudents[0]?.party_name 
                      ? `${partyStudents[0].party_name} (${partyNumber})`
                      : `Party ${partyNumber}`}
                    <Badge className="bg-white/20 text-white font-bold">
                      {partyStudents.length} members
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  <AnimatePresence>
                    {partyStudents
                      .sort((a, b) => a.serial_number - b.serial_number)
                      .map((student, index) => (
                        <motion.div
                          key={student.id}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          transition={{ 
                            duration: 0.3,
                            delay: index * 0.05 
                          }}
                        >
                          <Card
                            className="cursor-pointer bg-white/20 backdrop-blur-sm border border-white/30 hover:bg-white/30 hover:border-white/50 hover:shadow-xl hover:scale-105 transition-all duration-300 rounded-2xl overflow-hidden"
                            onClick={() => {
                              console.log('Card clicked for student:', student.name);
                              setSelectedStudent(student);
                            }}
                          >
                            <CardContent className="p-0">
                              <div className="flex items-center gap-4 p-4">
                                {/* Profile Image - Left Side */}
                                <div className="relative flex-shrink-0">
                                  <Avatar className="w-16 h-16 border-2 border-white/50 shadow-lg">
                                    <AvatarImage src={student.photo_url ? (student.photo_url.includes('/file/d/') ? `https://drive.google.com/uc?export=view&id=${student.photo_url.split('/d/')[1]?.split('/')[0]}` : student.photo_url) : undefined} alt={student.name} referrerPolicy="no-referrer" loading="lazy" decoding="async" />
                                    <AvatarFallback className={`bg-gradient-to-br ${getPartyColor(student.party_number)} text-white font-bold text-lg`}>
                                      {student.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                    </AvatarFallback>
                                  </Avatar>
                                  
                                  {/* Serial number badge */}
                                  <Badge 
                                    className="absolute -top-2 -right-2 w-6 h-6 p-0 flex items-center justify-center text-xs font-bold bg-gradient-to-r from-orange-500 to-yellow-500 text-white border-0 shadow-lg"
                                  >
                                    {student.serial_number}
                                  </Badge>
                                </div>

                                {/* Details - Right Side */}
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-black text-slate-800 text-lg mb-1 truncate">{student.name}</h4>
                                  
                                  <div className="flex items-center gap-2 mb-2">
                                    {getPositionIcon(student.position)}
                                    <span className="text-sm font-semibold text-slate-600 truncate">
                                      {student.position}
                                    </span>
                                  </div>

                                  {student.constituency && (
                                    <div className="flex items-center gap-2 mb-2">
                                      <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
                                      <span className="text-xs text-slate-500 truncate">
                                        {student.constituency}
                                      </span>
                                    </div>
                                  )}

                                  <div className="flex items-center gap-2">
                                    <div className={`w-4 h-2 bg-gradient-to-r ${getPartyColor(student.party_number)} rounded-full`} />
                                    <span className="text-xs font-medium text-slate-600">
                                      {student.party_name 
                                        ? `${student.party_name} (${student.party_number})`
                                        : `Party ${student.party_number}`}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>
                      ))}
                  </AnimatePresence>
                </div>
              </motion.div>
            ))}
        </div>
      )}

      {/* Student Profile Modal */}
      <Dialog open={!!selectedStudent} onOpenChange={(open) => {
        console.log('Dialog onOpenChange:', open, 'selectedStudent:', selectedStudent?.name);
        if (!open) {
          setSelectedStudent(null);
        }
      }}>
        <DialogContent className="max-w-2xl bg-transparent border-0 shadow-none p-0 rounded-3xl overflow-visible">
          <DialogTitle className="sr-only">
            {selectedStudent ? `${selectedStudent.name} Profile` : 'Student Profile'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Detailed profile information for the selected parliament member
          </DialogDescription>
          
          {selectedStudent && (
            <div className="relative">
              {/* Close Button */}
              <button
                onClick={() => {
                  console.log('Close button clicked');
                  setSelectedStudent(null);
                }}
                className="absolute top-4 right-4 z-50 w-10 h-10 bg-red-500/90 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg transition-all duration-200 backdrop-blur-sm"
                aria-label="Close profile"
              >
                <X className="w-5 h-5" />
              </button>
              
              {/* Profile Content */}
              <div className="p-8 flex items-center justify-center min-h-[400px]">
                <GlassmorphismProfileCard student={selectedStudent} />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InteractiveParliamentTree;