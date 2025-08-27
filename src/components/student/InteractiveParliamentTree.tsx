import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Crown, Gavel, Users, MapPin, Mail, Building } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const groupedStudents = groupByParty(filteredStudents);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <h2 className="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
          Parliament Tree
        </h2>
        <div className="w-full md:w-96">
          <Input
            placeholder="Search by name, position, constituency..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full"
          />
        </div>
      </div>

      {Object.keys(groupedStudents).length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">No students found matching your search.</p>
        </Card>
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
              >
                <Card className={`p-6 border-2 ${getPartyBorderColor(parseInt(partyNumber))}`}>
                  <div className="mb-6">
                    <div className={`inline-block px-4 py-2 rounded-lg bg-gradient-to-r ${getPartyColor(parseInt(partyNumber))} text-white font-bold text-lg`}>
                      Party {partyNumber} ({partyStudents.length} members)
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
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
                            whileHover={{ 
                              scale: 1.05,
                              transition: { duration: 0.2 }
                            }}
                            className="relative"
                          >
                            <Card
                              className={`cursor-pointer transition-all duration-200 hover:shadow-lg border-2 ${
                                hoveredStudent === student.id 
                                  ? `${getPartyBorderColor(student.party_number)} shadow-xl` 
                                  : 'border-border hover:border-primary/50'
                              }`}
                              onClick={() => setSelectedStudent(student)}
                              onMouseEnter={() => setHoveredStudent(student.id)}
                              onMouseLeave={() => setHoveredStudent(null)}
                            >
                              <CardContent className="p-4 text-center">
                                <div className="relative mb-3">
                                  <Avatar className="w-16 h-16 mx-auto border-2 border-background">
                                    <AvatarImage src={student.photo_url} alt={student.name} />
                                    <AvatarFallback className={`bg-gradient-to-br ${getPartyColor(student.party_number)} text-white font-bold`}>
                                      {student.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                    </AvatarFallback>
                                  </Avatar>
                                  
                                  {/* Party color bar */}
                                  <div className={`absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-12 h-2 bg-gradient-to-r ${getPartyColor(student.party_number)} rounded-full`} />
                                  
                                  {/* Serial number badge */}
                                  <Badge 
                                    variant="secondary" 
                                    className="absolute -top-2 -right-2 w-6 h-6 p-0 flex items-center justify-center text-xs font-bold"
                                  >
                                    {student.serial_number}
                                  </Badge>
                                </div>

                                <h4 className="font-semibold text-sm mb-1 line-clamp-2">{student.name}</h4>
                                
                                <div className="flex items-center justify-center gap-1 mb-2">
                                  {getPositionIcon(student.position)}
                                  <span className="text-xs text-muted-foreground truncate">
                                    {student.position}
                                  </span>
                                </div>

                                {student.constituency && (
                                  <p className="text-xs text-muted-foreground truncate">
                                    {student.constituency}
                                  </p>
                                )}
                              </CardContent>
                            </Card>

                            {/* Hover tooltip */}
                            <AnimatePresence>
                              {hoveredStudent === student.id && (
                                <motion.div
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: 10 }}
                                  className="absolute z-10 -top-16 left-1/2 transform -translate-x-1/2 bg-popover border rounded-lg shadow-lg p-3 min-w-48"
                                >
                                  <div className="text-sm font-semibold">{student.name}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {student.position} • Serial #{student.serial_number}
                                  </div>
                                  {student.constituency && (
                                    <div className="text-xs text-muted-foreground">
                                      {student.constituency}
                                    </div>
                                  )}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </motion.div>
                        ))}
                    </AnimatePresence>
                  </div>
                </Card>
              </motion.div>
            ))}
        </div>
      )}

      {/* Student Profile Modal */}
      <Dialog open={!!selectedStudent} onOpenChange={() => setSelectedStudent(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Student Profile</DialogTitle>
          </DialogHeader>
          
          {selectedStudent && (
            <div className="space-y-6">
              <div className="text-center">
                <Avatar className="w-24 h-24 mx-auto mb-4">
                  <AvatarImage src={selectedStudent.photo_url} alt={selectedStudent.name} />
                  <AvatarFallback className={`bg-gradient-to-br ${getPartyColor(selectedStudent.party_number)} text-white text-2xl font-bold`}>
                    {selectedStudent.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                
                <h3 className="text-xl font-bold mb-2">{selectedStudent.name}</h3>
                
                <div className="flex items-center justify-center gap-2 mb-3">
                  {getPositionIcon(selectedStudent.position)}
                  <span className="font-medium">{selectedStudent.position}</span>
                </div>
                
                <Badge className={`bg-gradient-to-r ${getPartyColor(selectedStudent.party_number)} text-white`}>
                  Party {selectedStudent.party_number} • Serial #{selectedStudent.serial_number}
                </Badge>
              </div>

              <div className="space-y-3">
                {selectedStudent.constituency && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">
                      <strong>Constituency:</strong> {selectedStudent.constituency}
                    </span>
                  </div>
                )}

                {selectedStudent.state && (
                  <div className="flex items-center gap-2">
                    <Building className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">
                      <strong>State:</strong> {selectedStudent.state}
                    </span>
                  </div>
                )}

                {selectedStudent.city && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">
                      <strong>City:</strong> {selectedStudent.city}
                    </span>
                  </div>
                )}

                {selectedStudent.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">
                      <strong>Email:</strong> {selectedStudent.email}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InteractiveParliamentTree;