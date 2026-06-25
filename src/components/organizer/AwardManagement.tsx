import { useState, useEffect } from 'react';
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

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
  const { profile } = useAuth();
  const [awards, setAwards] = useState<Award[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [studentAwards, setStudentAwards] = useState<StudentAward[]>([]);
  const [newAward, setNewAward] = useState({ name: '', description: '', visibleToJury: true });
  const [selectedAward, setSelectedAward] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [deleteAwardId, setDeleteAwardId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (profile?.event_id) {
      fetchData();
      setupRealtimeSubscriptions();
    }
  }, [profile?.event_id]);

  const fetchData = async () => {
    try {
      const { data: awardsData, error: awardsError } = await supabase
        .from('awards')
        .select('*')
        .order('created_at', { ascending: false });
      if (awardsError) throw awardsError;

      const { data: studentsData, error: studentsError } = await supabase
        .from('profiles')
        .select('user_id, name, position, party_number, constituency, photo_url')
        .eq('user_type', 'student')
        .eq('event_id', profile?.event_id ?? '')
        .order('name');
      if (studentsError) throw studentsError;

      const { data: studentAwardsData, error: studentAwardsError } = await supabase
        .from('student_awards')
        .select(`id, award_id, student_id, assigned_at, assigned_by_jury_consensus, assigned_by_organizer, awards (name)`)
        .eq('event_id', profile?.event_id ?? '')
        .order('assigned_at', { ascending: false });
      if (studentAwardsError) throw studentAwardsError;

      const studentIds = studentAwardsData?.map(sa => sa.student_id) || [];
      const { data: awardStudentsData, error: awardStudentsError } = await supabase
        .from('profiles')
        .select('user_id, name, position, party_number, photo_url')
        .in('user_id', studentIds);
      if (awardStudentsError) throw awardStudentsError;

      const enrichedStudentAwards = studentAwardsData?.map(sa => ({
        ...sa,
        profiles: awardStudentsData?.find(s => s.user_id === sa.student_id) || {
          name: 'Unknown', position: 'Unknown', party_number: 0, photo_url: null
        }
      })) || [];

      setAwards(awardsData || []);
      setStudents(studentsData || []);
      setStudentAwards(enrichedStudentAwards);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({ title: "Error", description: "Failed to load data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscriptions = () => {
    const channel = supabase
      .channel('award-management-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'awards' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'student_awards' }, () => fetchData())
      .subscribe();
    return () => supabase.removeChannel(channel);
  };

  const createAward = async () => {
    if (!newAward.name.trim()) {
      toast({ title: "Error", description: "Award name is required", variant: "destructive" });
      return;
    }
    try {
      const { error } = await supabase.from('awards').insert([{
        name: newAward.name.trim(),
        description: newAward.description.trim() || null,
        visible_to_jury: newAward.visibleToJury
      }]);
      if (error) throw error;
      toast({ title: "Success", description: "Award created successfully" });
      setNewAward({ name: '', description: '', visibleToJury: true });
      setIsCreateDialogOpen(false);
      fetchData();
    } catch (error: any) {
      const isDuplicate = error?.code === '23505';
      toast({
        title: "Error",
        description: isDuplicate ? "An award with this name already exists." : "Failed to create award",
        variant: "destructive",
      });
    }
  };

  const assignAward = async () => {
    if (!selectedAward || !selectedStudent) {
      toast({ title: "Error", description: "Please select both an award and a student", variant: "destructive" });
      return;
    }
    const existingAssignment = studentAwards.find(sa => sa.award_id === selectedAward && sa.student_id === selectedStudent);
    if (existingAssignment) {
      toast({ title: "Error", description: "This award is already assigned to the selected student", variant: "destructive" });
      return;
    }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('student_awards').insert([{
        award_id: selectedAward,
        student_id: selectedStudent,
        assigned_by_jury_consensus: false,
        assigned_by_organizer: true,
        assigned_by_user_id: user?.id,
        event_id: profile?.event_id ?? null,
      }]);
      if (error) throw error;
      toast({ title: "Success", description: "Award assigned successfully" });
      setSelectedAward('');
      setSelectedStudent('');
      setIsAssignDialogOpen(false);
      fetchData();
    } catch (error) {
      toast({ title: "Error", description: "Failed to assign award", variant: "destructive" });
    }
  };

  const deleteAward = async (awardId: string) => {
    const assignedStudents = studentAwards.filter(sa => sa.award_id === awardId);
    if (assignedStudents.length > 0) {
      toast({
        title: "Cannot Delete Award",
        description: `This award is assigned to ${assignedStudents.length} student(s). Remove all assignments first.`,
        variant: "destructive",
      });
      return;
    }
    try {
      const { error } = await supabase.from('awards').delete().eq('id', awardId);
      if (error) throw error;
      toast({ title: "Success", description: "Award deleted successfully" });
      fetchData();
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete award", variant: "destructive" });
    } finally {
      setDeleteAwardId(null);
    }
  };

  const removeAward = async (studentAwardId: string) => {
    try {
      const { error } = await supabase.from('student_awards').delete().eq('id', studentAwardId);
      if (error) throw error;
      toast({ title: "Success", description: "Award assignment removed successfully" });
      fetchData();
    } catch (error) {
      toast({ title: "Error", description: "Failed to remove award assignment", variant: "destructive" });
    }
  };

  const initials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-4">
          <span className="material-symbols-outlined text-[40px] text-primary animate-spin block mx-auto">refresh</span>
          <p className="text-sm text-on-surface-variant font-body">Loading awards…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-700">

      {/* Action bar */}
      <div className="flex justify-end gap-3">
        <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
          <DialogTrigger asChild>
            <button className="flex items-center gap-2 px-5 py-2.5 bg-surface-container-lowest border border-outline-variant/20 rounded-xl text-on-surface-variant hover:bg-surface-container-high transition-colors font-semibold text-sm font-body">
              <span className="material-symbols-outlined text-[20px]">person_add</span>
              Assign Award
            </button>
          </DialogTrigger>
          <DialogContent className="rounded-[2rem] border-none bg-surface-container-lowest shadow-2xl overflow-hidden p-0 max-w-md [&>button]:hidden">
            <div className="h-1.5 bg-gradient-to-r from-secondary to-secondary-container" />
            <div className="p-8 space-y-5">
              <div>
                <h2 className="text-xl font-extrabold font-headline text-primary">Assign Award</h2>
                <p className="text-xs text-on-surface-variant/60 font-body mt-1">Select an award and a student to create a manual assignment</p>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-on-surface-variant/50 font-headline mb-2">Award</p>
                  <Select value={selectedAward} onValueChange={setSelectedAward}>
                    <SelectTrigger className="h-12 bg-surface-container border-none rounded-2xl font-bold text-sm font-body">
                      <SelectValue placeholder="Choose an award" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-none bg-surface-container-lowest shadow-xl">
                      {awards.map(a => <SelectItem key={a.id} value={a.id} className="font-body">{a.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-on-surface-variant/50 font-headline mb-2">Student</p>
                  <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                    <SelectTrigger className="h-12 bg-surface-container border-none rounded-2xl font-bold text-sm font-body">
                      <SelectValue placeholder="Choose a student" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-none bg-surface-container-lowest shadow-xl">
                      {students.map(s => <SelectItem key={s.user_id} value={s.user_id} className="font-body">{s.name} — {s.position}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setIsAssignDialogOpen(false)} className="flex-1 h-12 bg-surface-container rounded-2xl font-bold text-sm text-on-surface-variant font-body hover:bg-surface-container-high transition-colors">Cancel</button>
                <button onClick={assignAward} className="flex-1 h-12 bg-gradient-to-r from-primary to-primary-container text-white rounded-2xl font-bold text-sm font-body shadow-[0_4px_12px_rgba(19,41,143,0.25)]">Assign</button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <button className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-primary to-primary-container text-white rounded-xl font-bold text-sm font-body shadow-[0_4px_12px_rgba(19,41,143,0.25)] hover:shadow-[0_6px_16px_rgba(19,41,143,0.35)] transition-all active:scale-[0.98]">
              <span className="material-symbols-outlined text-[20px]">add</span>
              Create Award
            </button>
          </DialogTrigger>
          <DialogContent className="rounded-[2rem] border-none bg-surface-container-lowest shadow-2xl overflow-hidden p-0 max-w-md [&>button]:hidden">
            <div className="h-1.5 bg-gradient-to-r from-primary to-primary-container" />
            <div className="p-8 space-y-5">
              <div>
                <h2 className="text-xl font-extrabold font-headline text-primary">Create Award</h2>
                <p className="text-xs text-on-surface-variant/60 font-body mt-1">Define a new recognition that can be assigned to outstanding students</p>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-on-surface-variant/50 font-headline mb-2">Award Name</p>
                  <input
                    value={newAward.name}
                    onChange={e => setNewAward(p => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. Best Delegate"
                    className="w-full h-12 bg-surface-container border-none rounded-2xl font-bold px-5 text-sm text-on-surface focus:ring-2 focus:ring-primary/20 font-body outline-none"
                  />
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-on-surface-variant/50 font-headline mb-2">Description <span className="normal-case font-medium opacity-60">(optional)</span></p>
                  <textarea
                    value={newAward.description}
                    onChange={e => setNewAward(p => ({ ...p, description: e.target.value }))}
                    placeholder="Describe the criteria for this award…"
                    rows={3}
                    className="w-full bg-surface-container border-none rounded-2xl font-body px-5 py-3 text-sm text-on-surface focus:ring-2 focus:ring-primary/20 outline-none resize-none"
                  />
                </div>
                <div className="flex items-center justify-between p-4 bg-surface-container rounded-2xl">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-on-surface-variant">
                      {newAward.visibleToJury ? 'visibility' : 'visibility_off'}
                    </span>
                    <div>
                      <p className="text-sm font-bold text-on-surface font-body">
                        {newAward.visibleToJury ? 'Jury Visible' : 'Organizer Only'}
                      </p>
                      <p className="text-xs text-on-surface-variant font-body">
                        {newAward.visibleToJury ? 'Jury members can vote on this award' : 'Hidden from jury, assigned by organizer'}
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={newAward.visibleToJury}
                    onCheckedChange={checked => setNewAward(p => ({ ...p, visibleToJury: checked }))}
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setIsCreateDialogOpen(false)} className="flex-1 h-12 bg-surface-container rounded-2xl font-bold text-sm text-on-surface-variant font-body hover:bg-surface-container-high transition-colors">Cancel</button>
                <button onClick={createAward} className="flex-1 h-12 bg-gradient-to-r from-primary to-primary-container text-white rounded-2xl font-bold text-sm font-body shadow-[0_4px_12px_rgba(19,41,143,0.25)]">Create Award</button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Available Awards */}
      <div className="bg-surface-container-lowest rounded-[2rem] shadow-[0_32px_64px_-16px_rgba(19,41,143,0.1)] overflow-hidden">
        <div className="px-8 py-6 border-b border-outline-variant/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>emoji_events</span>
            </div>
            <div>
              <h3 className="font-headline font-extrabold text-on-surface">Available Awards</h3>
              <p className="text-xs text-on-surface-variant font-body">{awards.length} recognition{awards.length !== 1 ? 's' : ''} created</p>
            </div>
          </div>
        </div>
        {awards.length === 0 ? (
          <div className="px-8 py-16 text-center">
            <span className="material-symbols-outlined text-[48px] text-on-surface-variant/20 block mb-3" style={{ fontVariationSettings: "'FILL' 1" }}>emoji_events</span>
            <p className="text-sm text-on-surface-variant/50 font-body">No awards created yet. Click "Create Award" to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low/30">
                  <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant font-body">Award</th>
                  <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant font-body">Visibility</th>
                  <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant font-body">Assigned</th>
                  <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant font-body">Created</th>
                  <th className="px-8 py-5 text-right text-[10px] font-bold uppercase tracking-widest text-on-surface-variant font-body">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/5">
                {awards.map(award => {
                  const assignedCount = studentAwards.filter(sa => sa.award_id === award.id).length;
                  return (
                    <tr key={award.id} className="hover:bg-primary-container/[0.02] transition-colors group">
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined text-[20px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>emoji_events</span>
                          </div>
                          <div className="min-w-0">
                            <p className="font-headline font-bold text-on-surface">{award.name}</p>
                            {award.description && <p className="text-xs text-on-surface-variant font-body mt-0.5 line-clamp-1">{award.description}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        {award.visible_to_jury ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-tertiary/10 text-tertiary-fixed-dim text-[11px] font-bold rounded-full font-body">
                            <span className="material-symbols-outlined text-[13px]">visibility</span>
                            Jury Visible
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-surface-container text-on-surface-variant text-[11px] font-bold rounded-full font-body">
                            <span className="material-symbols-outlined text-[13px]">visibility_off</span>
                            Organizer Only
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-5">
                        <span className="text-sm font-bold text-on-surface font-body">{assignedCount}</span>
                        <span className="text-xs text-on-surface-variant font-body ml-1">student{assignedCount !== 1 ? 's' : ''}</span>
                      </td>
                      <td className="px-6 py-5 text-sm font-medium text-on-surface-variant font-body whitespace-nowrap">
                        {new Date(award.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-8 py-5 text-right">
                        <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          <AlertDialog open={deleteAwardId === award.id} onOpenChange={open => !open && setDeleteAwardId(null)}>
                            <AlertDialogTrigger asChild>
                              <button onClick={() => setDeleteAwardId(award.id)} className="p-2 text-on-surface-variant hover:text-error transition-colors rounded-lg hover:bg-surface-container">
                                <span className="material-symbols-outlined text-[20px]">delete</span>
                              </button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="rounded-[2rem] border-none bg-surface-container-lowest shadow-2xl overflow-hidden p-0">
                              <div className="h-1.5 bg-error" />
                              <div className="p-8 space-y-4">
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="text-xl font-extrabold font-headline text-error">Delete Award?</AlertDialogTitle>
                                  <AlertDialogDescription className="text-sm text-on-surface-variant font-body">
                                    This will permanently delete "{award.name}". This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter className="flex gap-3 pt-2">
                                  <AlertDialogCancel className="flex-1 h-12 bg-surface-container border-none rounded-2xl font-bold text-sm text-on-surface-variant font-body">Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteAward(award.id)} className="flex-1 h-12 bg-error text-on-error border-none rounded-2xl font-bold text-sm font-body">Delete</AlertDialogAction>
                                </AlertDialogFooter>
                              </div>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Assigned Awards */}
      <div className="bg-surface-container-lowest rounded-[2rem] shadow-[0_32px_64px_-16px_rgba(19,41,143,0.1)] overflow-hidden">
        <div className="px-8 py-6 border-b border-outline-variant/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-secondary/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px] text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>workspace_premium</span>
            </div>
            <div>
              <h3 className="font-headline font-extrabold text-on-surface">Assigned Awards</h3>
              <p className="text-xs text-on-surface-variant font-body">{studentAwards.length} assignment{studentAwards.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
        </div>
        {studentAwards.length === 0 ? (
          <div className="px-8 py-16 text-center">
            <span className="material-symbols-outlined text-[48px] text-on-surface-variant/20 block mb-3" style={{ fontVariationSettings: "'FILL' 1" }}>workspace_premium</span>
            <p className="text-sm text-on-surface-variant/50 font-body">No awards assigned yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low/30">
                  <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant font-body">Student</th>
                  <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant font-body">Award</th>
                  <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant font-body">Source</th>
                  <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant font-body">Date</th>
                  <th className="px-8 py-5 text-right text-[10px] font-bold uppercase tracking-widest text-on-surface-variant font-body">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/5">
                {studentAwards.map(sa => (
                  <tr key={sa.id} className="hover:bg-primary-container/[0.02] transition-colors group">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-10 h-10 border-2 border-primary/10">
                          <AvatarImage src={sa.profiles.photo_url} />
                          <AvatarFallback className="bg-primary/10 text-primary font-headline font-bold text-xs">
                            {initials(sa.profiles.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-headline font-bold text-on-surface">{sa.profiles.name}</p>
                          <p className="text-xs text-on-surface-variant font-body">{sa.profiles.position}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary-fixed text-on-primary-fixed text-[11px] font-bold rounded-full font-body">
                        <span className="material-symbols-outlined text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }}>emoji_events</span>
                        {sa.awards.name}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      {sa.assigned_by_jury_consensus ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-secondary-fixed text-on-secondary-fixed text-[11px] font-bold rounded-full font-body">
                          <span className="material-symbols-outlined text-[13px]">gavel</span>
                          Jury Consensus
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-surface-container text-on-surface-variant text-[11px] font-bold rounded-full font-body">
                          <span className="material-symbols-outlined text-[13px]">person</span>
                          Organizer
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-5 text-sm font-medium text-on-surface-variant font-body whitespace-nowrap">
                      {new Date(sa.assigned_at).toLocaleDateString()}
                    </td>
                    <td className="px-8 py-5 text-right">
                      {sa.assigned_by_organizer && (
                        <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => removeAward(sa.id)} className="p-2 text-on-surface-variant hover:text-error transition-colors rounded-lg hover:bg-surface-container">
                            <span className="material-symbols-outlined text-[20px]">remove_circle</span>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
