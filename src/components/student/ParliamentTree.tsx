import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Users, Crown, Gavel, X, Filter } from "lucide-react";
import { StudentProfile } from "./StudentProfile";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";

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
  updated_at?: string;
  user_type: string;
}

export const ParliamentTree = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [positionFilter, setPositionFilter] = useState<string>("all");
  const [partyFilter, setPartyFilter] = useState<string>("all");
  const [stateFilter, setStateFilter] = useState<string>("all");

  useEffect(() => {
    fetchStudents();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [searchTerm, students, positionFilter, partyFilter, stateFilter]);

  const applyFilters = () => {
    let filtered = students;

    // Apply search term filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(student =>
        student.name.toLowerCase().includes(searchLower) ||
        student.position.toLowerCase().includes(searchLower) ||
        student.constituency?.toLowerCase().includes(searchLower) ||
        student.state?.toLowerCase().includes(searchLower) ||
        student.city?.toLowerCase().includes(searchLower) ||
        student.party_name?.toLowerCase().includes(searchLower) ||
        student.party_number.toString().includes(searchTerm) ||
        student.serial_number.toString().includes(searchTerm)
      );
    }

    // Apply position filter
    if (positionFilter !== "all") {
      if (positionFilter === "special") {
        filtered = filtered.filter(student => isSpecialPosition(student.position, student.name));
      } else if (positionFilter === "mp") {
        filtered = filtered.filter(student => !isSpecialPosition(student.position, student.name));
      }
    }

    // Apply party filter
    if (partyFilter !== "all") {
      filtered = filtered.filter(student => student.party_number.toString() === partyFilter);
    }

    // Apply state filter
    if (stateFilter !== "all") {
      filtered = filtered.filter(student => student.state === stateFilter);
    }

    setFilteredStudents(filtered);
  };

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

  const isSpecialPosition = (position: string, name?: string) => {
    const pos = position.toLowerCase();
    const specialNames = [
      'roobe saghana c',
      'a ray archer', 
      'adeena saleem',
      'laxana b',
      'arnav a',
      'pranaav a'
    ];
    
    return pos.includes('minister') || 
           pos.includes('leader') || 
           pos.includes('president') || 
           pos.includes('speaker') ||
           (name && specialNames.includes(name.toLowerCase()));
  };

  const getUniqueParties = () => {
    const parties = [...new Set(students.map(s => s.party_number))].sort((a, b) => a - b);
    return parties;
  };

  const getUniqueStates = () => {
    const states = [...new Set(students.map(s => s.state).filter(Boolean))].sort();
    return states;
  };

  const clearAllFilters = () => {
    setSearchTerm("");
    setPositionFilter("all");
    setPartyFilter("all");
    setStateFilter("all");
  };

  const hasActiveFilters = searchTerm || positionFilter !== "all" || partyFilter !== "all" || stateFilter !== "all";

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
          {hasActiveFilters && (
            <Badge variant="secondary" className="ml-2">
              {filteredStudents.length} filtered
            </Badge>
          )}
        </CardTitle>
        
        {/* Search Bar */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <Search className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium text-foreground">Search Parliament Members</span>
          </div>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
            <Input
              placeholder="Search by name, position, party, constituency, state..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12 pr-4 h-12 text-base bg-background border-2 border-border/40 focus:border-primary/60 focus:ring-2 focus:ring-primary/20 rounded-xl shadow-sm"
            />
          </div>
        </div>

        {/* Filters Row */}
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Filters:</span>
          </div>
          
          <Select value={positionFilter} onValueChange={setPositionFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Position" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Positions</SelectItem>
              <SelectItem value="special">Ministers & Leaders</SelectItem>
              <SelectItem value="mp">Members of Parliament</SelectItem>
            </SelectContent>
          </Select>

          <Select value={partyFilter} onValueChange={setPartyFilter}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Party" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Parties</SelectItem>
              {getUniqueParties().map(party => (
                <SelectItem key={party} value={party.toString()}>
                  {students.find(s => s.party_number === party)?.party_name || `Party ${party}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={stateFilter} onValueChange={setStateFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="State" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All States</SelectItem>
              {getUniqueStates().map(state => (
                <SelectItem key={state} value={state!}>
                  {state}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={clearAllFilters}
              className="flex items-center gap-2"
            >
              <X className="w-3 h-3" />
              Clear Filters
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {Object.keys(partyGroups).map(party => (
            <div key={party} className="border rounded-lg p-4 bg-gradient-to-r from-blue-50 to-purple-50">
              <h3 className="font-semibold text-lg mb-4 flex items-center">
                <Badge variant="outline" className="mr-2">
                  {partyGroups[parseInt(party)][0]?.party_name 
                    ? `${partyGroups[parseInt(party)][0].party_name} (${party})`
                    : `Party ${party}`}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  ({partyGroups[parseInt(party)].length} members)
                </span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {partyGroups[parseInt(party)].map((student) => (
                  <Dialog key={student.id}>
                    <DialogTrigger asChild>
                      <div className="cursor-pointer group">
                        <Card className={`hover:shadow-md transition-shadow duration-200 group-hover:border-primary/50 ${
                          isSpecialPosition(student.position, student.name) 
                            ? 'border-2 border-amber-400 bg-gradient-to-br from-amber-50 to-yellow-50 shadow-md' 
                            : ''
                        }`}>
                          <CardContent className="p-3">
                            <div className="flex items-center space-x-3">
                              <div className="relative">
                                <Avatar className="w-12 h-12">
                                  <AvatarImage src={student.photo_url ? `${student.photo_url}${student.photo_url.includes('?') ? '&' : '?'}cb=${student.updated_at ? new Date(student.updated_at).getTime() : ''}` : undefined} alt={student.name} />
                                  <AvatarFallback className="text-sm bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                                    {student.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                {isSpecialPosition(student.position, student.name) && (
                                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center">
                                    <Crown className="w-3 h-3 text-white" />
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center space-x-1 mb-1">
                                  {getPositionIcon(student.position)}
                                  <h4 className={`font-medium text-sm truncate ${
                                    isSpecialPosition(student.position, student.name) ? 'text-amber-800 font-bold' : ''
                                  }`}>{student.name}</h4>
                                </div>
                                <p className={`text-xs truncate ${
                                  isSpecialPosition(student.position, student.name) ? 'text-amber-700 font-semibold' : 'text-muted-foreground'
                                }`}>{student.position}</p>
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
          
          {filteredStudents.length === 0 && students.length > 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="mb-4">
                {hasActiveFilters 
                  ? 'No students found matching your search and filter criteria.' 
                  : 'No students found matching your search.'}
              </p>
              {hasActiveFilters && (
                <Button variant="outline" onClick={clearAllFilters}>
                  Clear All Filters
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};