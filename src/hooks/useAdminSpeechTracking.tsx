import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface AdminStudentData {
  user_id: string;
  serial_number: number;
  name: string;
  position: string;
  party_number: number;
  party_name: string | null;
  constituency: string | null;
  state: string | null;
  city: string | null;
  photo_url: string | null;
  is_active: boolean;
  speech_count: number;
  last_speech_at: string | null;
  has_jury_score: boolean;
  assessment_count: number;
  average_score: number;
}

interface Filters {
  searchQuery: string;
  hasSpeech: 'all' | 'spoken' | 'not-spoken';
  hasScore: 'all' | 'scored' | 'not-scored';
  partyNumber: number | null;
}

export const useAdminSpeechTracking = () => {
  const { profile } = useAuth();
  const [students, setStudents] = useState<AdminStudentData[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<AdminStudentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>({
    searchQuery: '',
    hasSpeech: 'all',
    hasScore: 'all',
    partyNumber: null,
  });
  const { toast } = useToast();
  const initialLoadDone = useRef(false);

  // silent=true skips the loading spinner (used for background re-syncs)
  const fetchStudents = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const [{ data, error }, { data: specialIds }] = await Promise.all([
        supabase
          .from('admin_student_dashboard')
          .select('*')
          .eq('event_id', profile?.event_id ?? '')
          .order('serial_number', { ascending: true }),
        supabase.rpc('get_non_scoreable_student_ids'),
      ]);

      if (error) throw error;
      const excluded = new Set<string>((specialIds as string[] | null) || []);
      setStudents((data || []).filter(s => !excluded.has(s.user_id)));
      initialLoadDone.current = true;
    } catch (error: any) {
      console.error('Error fetching students:', error);
      toast({
        title: "Error",
        description: "Failed to load student data",
        variant: "destructive",
      });
    } finally {
      if (!silent) setLoading(false);
    }
  }, [toast]);

  // Apply filters
  useEffect(() => {
    let filtered = [...students];

    // Search filter
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.serial_number.toString().includes(query) ||
          s.name.toLowerCase().includes(query) ||
          s.position.toLowerCase().includes(query)
      );
    }

    // Speech filter
    if (filters.hasSpeech === 'spoken') {
      filtered = filtered.filter((s) => s.speech_count > 0);
    } else if (filters.hasSpeech === 'not-spoken') {
      filtered = filtered.filter((s) => s.speech_count === 0);
    }

    // Score filter
    if (filters.hasScore === 'scored') {
      filtered = filtered.filter((s) => s.has_jury_score);
    } else if (filters.hasScore === 'not-scored') {
      filtered = filtered.filter((s) => !s.has_jury_score);
    }

    // Party filter
    if (filters.partyNumber !== null) {
      filtered = filtered.filter((s) => s.party_number === filters.partyNumber);
    }

    setFilteredStudents(filtered);
  }, [students, filters]);

  // Real-time subscription
  useEffect(() => {
    fetchStudents();

    const channel = supabase
      .channel('admin-speech-tracking')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'student_speeches' },
        () => fetchStudents(true)   // silent — don't show spinner
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'assessments' },
        () => fetchStudents(true)   // silent — don't show spinner
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchStudents]);

  const recordSpeech = useCallback(
    async (studentId: string, notes?: string) => {
      // Optimistic update — increment immediately
      setStudents(prev => prev.map(s =>
        s.user_id === studentId
          ? { ...s, speech_count: s.speech_count + 1, last_speech_at: new Date().toISOString() }
          : s
      ));

      try {
        const { error } = await supabase.from('student_speeches').insert({
          student_id: studentId,
          recorded_by: (await supabase.auth.getUser()).data.user?.id,
          notes: notes || null,
        });

        if (error) throw error;

        toast({ title: "Speech Recorded", description: "Speech count updated successfully" });
      } catch (error: any) {
        // Revert on failure
        setStudents(prev => prev.map(s =>
          s.user_id === studentId
            ? { ...s, speech_count: Math.max(0, s.speech_count - 1) }
            : s
        ));
        console.error('Error recording speech:', error);
        toast({ title: "Error", description: "Failed to record speech", variant: "destructive" });
      }
    },
    [toast]
  );

  const undoLastSpeech = useCallback(
    async (studentId: string) => {
      // Optimistic update — decrement immediately
      setStudents(prev => prev.map(s =>
        s.user_id === studentId
          ? { ...s, speech_count: Math.max(0, s.speech_count - 1) }
          : s
      ));

      try {
        const { data: lastSpeech, error: fetchError } = await supabase
          .from('student_speeches')
          .select('id')
          .eq('student_id', studentId)
          .order('recorded_at', { ascending: false })
          .limit(1)
          .single();

        if (fetchError || !lastSpeech) {
          // Revert
          setStudents(prev => prev.map(s =>
            s.user_id === studentId ? { ...s, speech_count: s.speech_count + 1 } : s
          ));
          toast({ title: "Error", description: "No speech found to undo", variant: "destructive" });
          return;
        }

        const { error: deleteError } = await supabase
          .from('student_speeches')
          .delete()
          .eq('id', lastSpeech.id);

        if (deleteError) throw deleteError;

        toast({ title: "Speech Removed", description: "Last speech entry removed successfully" });
      } catch (error: any) {
        // Revert
        setStudents(prev => prev.map(s =>
          s.user_id === studentId ? { ...s, speech_count: s.speech_count + 1 } : s
        ));
        console.error('Error undoing speech:', error);
        toast({ title: "Error", description: "Failed to undo speech", variant: "destructive" });
      }
    },
    [toast]
  );

  const quickRecordBySerial = useCallback(
    async (serialNumber: number) => {
      const student = students.find((s) => s.serial_number === serialNumber);
      if (!student) {
        toast({
          title: "Student Not Found",
          description: `No student with serial number ${serialNumber}`,
          variant: "destructive",
        });
        return;
      }

      await recordSpeech(student.user_id);
    },
    [students, recordSpeech, toast]
  );

  return {
    students: filteredStudents,       // filtered — for the list
    allStudents: students,            // unfiltered — for stat card counts
    loading,
    filters,
    setFilters,
    recordSpeech,
    undoLastSpeech,
    quickRecordBySerial,
    totalCount: students.length,
    filteredCount: filteredStudents.length,
  };
};
