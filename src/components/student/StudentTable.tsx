import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, Crown, Gavel, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Student {
  id: string;
  user_id: string;
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

export const StudentTable = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchStudents = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, user_id, name, position, party_number, party_name, serial_number, constituency, state, city, photo_url, email, user_type')
        .eq('user_type', 'student')
        .order('party_number', { ascending: true })
        .order('serial_number', { ascending: true });

      if (error) throw error;

      const studentsData = data || [];
      setStudents(studentsData);
      setFilteredStudents(studentsData);
    } catch (error) {
      console.error('Error fetching students:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  // Realtime updates
  useEffect(() => {
    const channel = supabase
      .channel('public:profiles-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        fetchStudents();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Filter students based on search term
  useEffect(() => {
    if (!searchTerm) {
      setFilteredStudents(students);
    } else {
      const filtered = students.filter(student =>
        student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.position.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.party_number.toString().includes(searchTerm) ||
        student.constituency?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.state?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredStudents(filtered);
    }
  }, [searchTerm, students]);

  const getPositionIcon = (position: string) => {
    const pos = position.toLowerCase();
    if (pos.includes('president') || pos.includes('prime minister')) {
      return <Crown className="w-4 h-4 text-amber-500" />;
    } else if (pos.includes('speaker') || pos.includes('deputy') || pos.includes('minister') || pos.includes('ministry')) {
      return <Gavel className="w-4 h-4 text-blue-500" />;
    }
    return <Users className="w-4 h-4 text-slate-500" />;
  };

  const isSpecialPosition = (position: string, name?: string): boolean => {
    const pos = position.toLowerCase();
    const specialNames = [
      'arjun', 'priya', 'vikram', 'ananya', 'rohan', 'ishita', 'aditya',
      'kavya', 'dhruv', 'shreya', 'aarav', 'nisha', 'kiran', 'meera',
      'siddharth', 'riya', 'harsh', 'divya', 'rahul', 'pooja'
    ];
    
    return pos.includes('minister') || 
           pos.includes('ministry') ||
           pos.includes('leader') || 
           pos.includes('president') || 
           pos.includes('speaker') ||
           pos.includes('deputy') ||
           (name && specialNames.some(specialName => 
             name.toLowerCase().includes(specialName.toLowerCase())
           ));
  };

  const getPartyColor = (partyNumber: number) => {
    const colors = [
      'bg-red-100 text-red-800',
      'bg-blue-100 text-blue-800',
      'bg-green-100 text-green-800',
      'bg-yellow-100 text-yellow-800',
      'bg-purple-100 text-purple-800',
      'bg-pink-100 text-pink-800',
      'bg-indigo-100 text-indigo-800',
      'bg-orange-100 text-orange-800'
    ];
    return colors[(partyNumber - 1) % colors.length];
  };

  if (loading) {
    return (
      <Card className="w-full bg-white/20 backdrop-blur-lg border border-white/25">
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-32">
            <div className="text-lg font-medium text-slate-600">Loading students...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full bg-white/20 backdrop-blur-lg border border-white/25 shadow-xl">
      <CardHeader className="pb-4">
        <CardTitle className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Users className="w-6 h-6" />
          Student Directory
        </CardTitle>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
          <Input
            placeholder="Search students by name, position, party, constituency..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-white/50 border-white/30"
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg overflow-hidden bg-white/50 border border-white/30">
          <Table>
            <TableHeader>
              <TableRow className="bg-white/70 hover:bg-white/80">
                <TableHead className="font-semibold text-slate-700">Name</TableHead>
                <TableHead className="font-semibold text-slate-700">Position</TableHead>
                <TableHead className="font-semibold text-slate-700">Party</TableHead>
                <TableHead className="font-semibold text-slate-700">Constituency</TableHead>
                <TableHead className="font-semibold text-slate-700">State</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStudents.map((student) => (
                <TableRow 
                  key={student.id} 
                  className={`hover:bg-white/60 transition-colors ${
                    isSpecialPosition(student.position, student.name) 
                      ? 'bg-gradient-to-r from-yellow-50/80 to-orange-50/80 border-l-4 border-amber-400' 
                      : 'bg-white/30'
                  }`}
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {getPositionIcon(student.position)}
                      <span className={isSpecialPosition(student.position, student.name) ? 'font-bold text-slate-800' : 'text-slate-700'}>
                        {student.name}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`text-sm ${isSpecialPosition(student.position, student.name) ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>
                      {student.position}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge className={getPartyColor(student.party_number)}>
                      Party {student.party_number}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-slate-600">{student.constituency || '-'}</TableCell>
                  <TableCell className="text-slate-600">{student.state || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        
        {filteredStudents.length === 0 && !loading && (
          <div className="text-center py-8">
            <p className="text-slate-600 text-lg">No students found matching your search.</p>
          </div>
        )}
        
        <div className="mt-4 text-sm text-slate-600 text-center">
          Showing {filteredStudents.length} of {students.length} students
        </div>
      </CardContent>
    </Card>
  );
};