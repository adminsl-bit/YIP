import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Search, Users, Crown, Gavel } from "lucide-react";
import { StudentProfile } from "./StudentProfile";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";

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
  user_type: string;
}

export const ParliamentTree = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStudents();
  }, []);

  useEffect(() => {
    if (!searchTerm) {
      setFilteredStudents(students);
    } else {
      const filtered = students.filter(student =>
        student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.position.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.constituency?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.party_number.toString().includes(searchTerm)
      );
      setFilteredStudents(filtered);
    }
  }, [searchTerm, students]);

  const fetchStudents = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_type', 'student')
        .order('party_number', { ascending: true })
        .order('serial_number', { ascending: true });

      if (error) throw error;
      setStudents(data || []);
      setFilteredStudents(data || []);
    } catch (error) {
      console.error('Error fetching students:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPositionIcon = (position: string) => {
    if (position.toLowerCase().includes('president') || position.toLowerCase().includes('prime')) {
      return <Crown className="w-4 h-4 text-yellow-600" />;
    }
    if (position.toLowerCase().includes('speaker') || position.toLowerCase().includes('minister')) {
      return <Gavel className="w-4 h-4 text-blue-600" />;
    }
    return <Users className="w-4 h-4 text-gray-600" />;
  };

  const groupByParty = (students: Student[]) => {
    return students.reduce((acc, student) => {
      const party = student.party_number;
      if (!acc[party]) acc[party] = [];
      acc[party].push(student);
      return acc;
    }, {} as Record<number, Student[]>);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Users className="w-5 h-5" />
            <span>Parliament Members</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const partyGroups = groupByParty(filteredStudents);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Users className="w-5 h-5" />
          <span>Parliament Members ({students.length})</span>
        </CardTitle>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search by name, position, party, or constituency..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {Object.keys(partyGroups).map(party => (
            <div key={party} className="border rounded-lg p-4 bg-gradient-to-r from-blue-50 to-purple-50">
              <h3 className="font-semibold text-lg mb-4 flex items-center">
                <Badge variant="outline" className="mr-2">Party {party}</Badge>
                <span className="text-sm text-muted-foreground">
                  ({partyGroups[parseInt(party)].length} members)
                </span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {partyGroups[parseInt(party)].map((student) => (
                  <Dialog key={student.id}>
                    <DialogTrigger asChild>
                      <div className="cursor-pointer group">
                        <Card className="hover:shadow-md transition-shadow duration-200 group-hover:border-primary/50">
                          <CardContent className="p-3">
                            <div className="flex items-center space-x-3">
                              <Avatar className="w-12 h-12">
                                <AvatarImage src={student.photo_url} alt={student.name} />
                                <AvatarFallback className="text-sm bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                                  {student.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center space-x-1 mb-1">
                                  {getPositionIcon(student.position)}
                                  <h4 className="font-medium text-sm truncate">{student.name}</h4>
                                </div>
                                <p className="text-xs text-muted-foreground truncate">{student.position}</p>
                                <p className="text-xs text-muted-foreground">#{student.serial_number}</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <StudentProfile profile={student} />
                    </DialogContent>
                  </Dialog>
                ))}
              </div>
            </div>
          ))}
          
          {filteredStudents.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No students found matching your search.</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};