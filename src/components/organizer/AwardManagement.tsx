import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Award, Plus, Trophy, Users, Edit, Trash2, UserCheck, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Award {
  id: string;
  name: string;
  description?: string;
  visible_to_jury: boolean;
  created_at: string;
}

interface Student {
  user_id: string;
  name: string;
  position: string;
  party_number: number;
  constituency: string;
  photo_url?: string;
}

interface StudentAward {
  id: string;
  award_id: string;
  student_id: string;
  assigned_at: string;
  assigned_by_jury_consensus: boolean;
  assigned_by_organizer: boolean;
  awards: { name: string };
  profiles: { name: string; position: string; party_number: number; photo_url?: string };
}

export const AwardManagement = () => {
  const [awards, setAwards] = useState<Award[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [studentAwards, setStudentAwards] = useState<StudentAward[]>([]);
  const [newAward, setNewAward] = useState({ name: '', description: '', visibleToJury: true });
  const [selectedAward, setSelectedAward] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
    setupRealtimeSubscriptions();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch awards
      const { data: awardsData, error: awardsError } = await supabase
        .from('awards')
        .select('*')
        .order('created_at', { ascending: false });

      if (awardsError) throw awardsError;

      // Fetch students
      const { data: studentsData, error: studentsError } = await supabase
        .from('profiles')
        .select('user_id, name, position, party_number, constituency, photo_url')
        .eq('user_type', 'student')
        .order('name');

      if (studentsError) throw studentsError;

      // Fetch student awards with related data
      const { data: studentAwardsData, error: studentAwardsError } = await supabase
        .from('student_awards')
        .select(`
          id,
          award_id,
          student_id,
          assigned_at,
          assigned_by_jury_consensus,
          assigned_by_organizer,
          awards (name)
        `)
        .order('assigned_at', { ascending: false });

      if (studentAwardsError) throw studentAwardsError;

      // Fetch student details for awards
      const studentIds = studentAwardsData?.map(sa => sa.student_id) || [];
      const { data: awardStudentsData, error: awardStudentsError } = await supabase
        .from('profiles')
        .select('user_id, name, position, party_number, photo_url')
        .in('user_id', studentIds);

      if (awardStudentsError) throw awardStudentsError;

      // Combine student awards with student data
      const enrichedStudentAwards = studentAwardsData?.map(sa => ({
        ...sa,
        profiles: awardStudentsData?.find(student => student.user_id === sa.student_id) || {
          name: 'Unknown',
          position: 'Unknown',
          party_number: 0,
          photo_url: null
        }
      })) || [];

      setAwards(awardsData || []);
      setStudents(studentsData || []);
      setStudentAwards(enrichedStudentAwards);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to load data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscriptions = () => {
    const channel = supabase
      .channel('award-management-updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'awards'
      }, () => {
        fetchData();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'student_awards'
      }, () => {
        fetchData();
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  };

  const createAward = async () => {
    if (!newAward.name.trim()) {
      toast({
        title: "Error",
        description: "Award name is required",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('awards')
        .insert([{
          name: newAward.name.trim(),
          description: newAward.description.trim() || null,
          visible_to_jury: newAward.visibleToJury
        }]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Award created successfully",
      });

      setNewAward({ name: '', description: '', visibleToJury: true });
      setIsCreateDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error creating award:', error);
      toast({
        title: "Error",
        description: "Failed to create award",
        variant: "destructive",
      });
    }
  };

  const assignAward = async () => {
    if (!selectedAward || !selectedStudent) {
      toast({
        title: "Error",
        description: "Please select both an award and a student",
        variant: "destructive",
      });
      return;
    }

    // Check if this award is already assigned to this student
    const existingAssignment = studentAwards.find(
      sa => sa.award_id === selectedAward && sa.student_id === selectedStudent
    );

    if (existingAssignment) {
      toast({
        title: "Error",
        description: "This award is already assigned to the selected student",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('student_awards')
        .insert([{
          award_id: selectedAward,
          student_id: selectedStudent,
          assigned_by_jury_consensus: false,
          assigned_by_organizer: true,
          assigned_by_user_id: user?.id
        }]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Award assigned successfully",
      });

      setSelectedAward('');
      setSelectedStudent('');
      setIsAssignDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error assigning award:', error);
      toast({
        title: "Error",
        description: "Failed to assign award",
        variant: "destructive",
      });
    }
  };

  const deleteAward = async (awardId: string) => {
    // Check if award is assigned to any students
    const assignedStudents = studentAwards.filter(sa => sa.award_id === awardId);
    
    if (assignedStudents.length > 0) {
      toast({
        title: "Cannot Delete Award",
        description: `This award is assigned to ${assignedStudents.length} student(s). Remove all assignments first.`,
        variant: "destructive",
      });
      return;
    }

    if (!confirm('Are you sure you want to delete this award? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('awards')
        .delete()
        .eq('id', awardId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Award deleted successfully",
      });

      fetchData();
    } catch (error) {
      console.error('Error deleting award:', error);
      toast({
        title: "Error",
        description: "Failed to delete award",
        variant: "destructive",
      });
    }
  };

  const removeAward = async (studentAwardId: string) => {
    try {
      const { error } = await supabase
        .from('student_awards')
        .delete()
        .eq('id', studentAwardId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Award assignment removed successfully",
      });

      fetchData();
    } catch (error) {
      console.error('Error removing award assignment:', error);
      toast({
        title: "Error",
        description: "Failed to remove award assignment",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-muted-foreground">Loading award management...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Actions */}
      <div className="flex gap-4">
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700">
              <Plus className="w-4 h-4 mr-2" />
              Create Award
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Award</DialogTitle>
              <DialogDescription>
                Create a new award that can be assigned to outstanding students.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="award-name" className="text-sm font-medium text-slate-700">Award Name</Label>
                <Input
                  id="award-name"
                  value={newAward.name}
                  onChange={(e) => setNewAward(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter award name"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="award-description" className="text-sm font-medium text-slate-700">Description (Optional)</Label>
                <Textarea
                  id="award-description"
                  value={newAward.description}
                  onChange={(e) => setNewAward(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter award description"
                  className="mt-1"
                  rows={3}
                />
              </div>
              <div className="flex items-center space-x-3 p-4 bg-gradient-to-r from-slate-50/80 to-blue-50/80 backdrop-blur-sm rounded-xl border border-white/40 shadow-sm">
                <Switch
                  id="visible-to-jury"
                  checked={newAward.visibleToJury}
                  onCheckedChange={(checked) => setNewAward(prev => ({ ...prev, visibleToJury: checked }))}
                  className="data-[state=checked]:bg-green-500"
                />
                <div className="flex items-center gap-2">
                  {newAward.visibleToJury ? (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-green-100/80 to-emerald-100/80 backdrop-blur-sm border border-green-200/50 rounded-full shadow-sm">
                      <Eye className="w-4 h-4 text-green-600" />
                      <span className="text-sm font-semibold text-green-700">Jury Visible</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-slate-100/80 to-gray-100/80 backdrop-blur-sm border border-slate-200/50 rounded-full shadow-sm">
                      <EyeOff className="w-4 h-4 text-slate-500" />
                      <span className="text-sm font-semibold text-slate-600">Organizer Only</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="bg-blue-50/50 border-l-4 border-blue-400 p-3 rounded-r-lg">
                <p className="text-sm text-blue-700 font-medium">
                  {newAward.visibleToJury 
                    ? "🗳️ Jury members can see and vote on this award" 
                    : "🔒 Only organizers can assign this award (hidden from jury)"
                  }
                </p>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={createAward}>
                  Create Award
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="border-blue-200 text-blue-700 hover:bg-blue-50">
              <UserCheck className="w-4 h-4 mr-2" />
              Assign Award
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Award to Student</DialogTitle>
              <DialogDescription>
                Select an award and a student to create a manual award assignment.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
                <div>
                  <Label htmlFor="select-award" className="text-sm font-medium text-slate-700">Select Award</Label>
                <Select value={selectedAward} onValueChange={setSelectedAward}>
                  <SelectTrigger id="select-student" className="mt-1">
                    <SelectValue placeholder="Choose an award" />
                  </SelectTrigger>
                  <SelectContent>
                    {awards.map((award) => (
                      <SelectItem key={award.id} value={award.id}>
                        {award.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
                <div>
                  <Label htmlFor="select-student" className="text-sm font-medium text-slate-700">Select Student</Label>
                <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                  <SelectTrigger id="select-award" className="mt-1">
                    <SelectValue placeholder="Choose a student" />
                  </SelectTrigger>
                  <SelectContent>
                    {students.map((student) => (
                      <SelectItem key={student.user_id} value={student.user_id}>
                        {student.name} - {student.position}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={assignAward}>
                  Assign Award
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Available Awards */}
      <Card className="bg-white/20 backdrop-blur-lg border border-white/25 shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-xl flex items-center justify-center">
              <Award className="w-5 h-5 text-white" />
            </div>
            <CardTitle className="text-slate-800">Available Awards</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {awards.length === 0 ? (
            <p className="text-slate-600 text-center py-8">No awards created yet. Create your first award!</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {awards.map((award) => {
                const assignedCount = studentAwards.filter(sa => sa.award_id === award.id).length;
                
                return (
                  <div key={award.id} className="bg-white/15 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-bold text-slate-800">{award.name}</h4>
                          {award.visible_to_jury ? (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-green-100/80 to-emerald-100/80 backdrop-blur-sm border border-green-200/50 rounded-full shadow-sm">
                              <Eye className="w-3.5 h-3.5 text-green-600" />
                              <span className="text-xs font-semibold text-green-700">Jury Visible</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-slate-100/80 to-gray-100/80 backdrop-blur-sm border border-slate-200/50 rounded-full shadow-sm">
                              <EyeOff className="w-3.5 h-3.5 text-slate-500" />
                              <span className="text-xs font-semibold text-slate-600">Organizer Only</span>
                            </div>
                          )}
                        </div>
                        {award.description && (
                          <p className="text-sm text-slate-600 mt-1">{award.description}</p>
                        )}
                        <div className="flex items-center justify-between mt-2">
                          <p className="text-xs text-slate-500">
                            Created {new Date(award.created_at).toLocaleDateString()}
                          </p>
                          <p className="text-xs text-slate-600 font-medium">
                            {assignedCount} assignment{assignedCount !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-2">
                        <Trophy className="w-5 h-5 text-yellow-600" />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteAward(award.id)}
                          className="text-red-600 border-red-200 hover:bg-red-50 ml-2"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assigned Awards */}
      <Card className="bg-white/20 backdrop-blur-lg border border-white/25 shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-teal-500 rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5 text-white" />
            </div>
            <CardTitle className="text-slate-800">Assigned Awards</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {studentAwards.length === 0 ? (
            <p className="text-slate-600 text-center py-8">No awards assigned yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/25">
                    <TableHead className="text-slate-700 font-semibold">Student</TableHead>
                    <TableHead className="text-slate-700 font-semibold">Award</TableHead>
                    <TableHead className="text-slate-700 font-semibold">Assignment Type</TableHead>
                    <TableHead className="text-slate-700 font-semibold">Date</TableHead>
                    <TableHead className="text-slate-700 font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {studentAwards.map((studentAward) => (
                    <TableRow key={studentAward.id} className="border-white/25 hover:bg-white/10">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="w-8 h-8">
                            <AvatarImage src={studentAward.profiles.photo_url} />
                            <AvatarFallback className="bg-gradient-to-br from-slate-500 to-slate-600 text-white text-xs">
                              {studentAward.profiles.name.split(' ').map(n => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium text-slate-800">{studentAward.profiles.name}</div>
                            <div className="text-sm text-slate-600">{studentAward.profiles.position}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-yellow-500/20 text-yellow-700 border border-yellow-500/30">
                          <Trophy className="w-3 h-3 mr-1" />
                          {studentAward.awards.name}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={studentAward.assigned_by_jury_consensus ? "default" : "secondary"}
                          className={studentAward.assigned_by_jury_consensus 
                            ? "bg-blue-500/20 text-blue-700 border border-blue-500/30" 
                            : "bg-purple-500/20 text-purple-700 border border-purple-500/30"
                          }
                        >
                          {studentAward.assigned_by_jury_consensus ? "Jury Consensus" : "Organizer"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">
                        {new Date(studentAward.assigned_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {studentAward.assigned_by_organizer && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => removeAward(studentAward.id)}
                            className="text-red-600 border-red-200 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};