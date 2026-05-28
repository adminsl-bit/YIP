import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { PartyBadge } from '@/components/ui/party-badge';

interface ManualScoringStudent {
  user_id: string;
  serial_number: number;
  name: string;
  position: string;
  party_number: number;
  party_name: string | null;
  photo_url: string | null;
  special_role: 'journalist' | 'admin_student';
  organizer_manual_score: number | null;
  preevent_score: number | null;
}

export const ManualScoring = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [preeventScores, setPreeventScores] = useState<Record<string, string>>({});
  const [liveScores, setLiveScores] = useState<Record<string, string>>({});

  const { data: students, isLoading } = useQuery({
    queryKey: ['manual-scoring-students'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organizer_manual_scoring')
        .select('*')
        .order('serial_number', { ascending: true });
      if (error) throw error;

      const studentsWithPreEventScores = await Promise.all(
        (data || []).map(async student => {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('preevent_scores')
            .eq('user_id', student.user_id)
            .single();
          return { ...student, preevent_score: profileData?.preevent_scores || null };
        })
      );
      return studentsWithPreEventScores as ManualScoringStudent[];
    },
  });

  const updateScoresMutation = useMutation({
    mutationFn: async ({ userId, preeventScore, liveScore }: { userId: string; preeventScore: number | null; liveScore: number | null }) => {
      const updates: any = {};
      if (preeventScore !== null) updates.preevent_scores = preeventScore;
      if (liveScore !== null) updates.organizer_manual_score = liveScore;
      const { error } = await supabase.from('profiles').update(updates).eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Scores Updated', description: 'Scores have been saved successfully' });
      queryClient.invalidateQueries({ queryKey: ['manual-scoring-students'] });
      queryClient.invalidateQueries({ queryKey: ['organizer-leaderboard'] });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to update scores', variant: 'destructive' });
    },
  });

  const handlePreeventScoreChange = (userId: string, value: string) => {
    if (value === '' || /^\d*\.?\d*$/.test(value)) setPreeventScores({ ...preeventScores, [userId]: value });
  };

  const handleLiveScoreChange = (userId: string, value: string) => {
    if (value === '' || /^\d*\.?\d*$/.test(value)) setLiveScores({ ...liveScores, [userId]: value });
  };

  const handleSaveScores = (userId: string, student: ManualScoringStudent) => {
    const preeventValue = preeventScores[userId] !== undefined ? preeventScores[userId] : student.preevent_score?.toString();
    const liveValue = liveScores[userId] !== undefined ? liveScores[userId] : student.organizer_manual_score?.toString();

    let preeventScore: number | null = null;
    let liveScore: number | null = null;

    if (preeventValue) {
      const parsed = parseFloat(preeventValue);
      if (isNaN(parsed) || parsed < 0 || parsed > 60) {
        toast({ title: 'Invalid Score', description: 'Pre-event score must be between 0 and 60', variant: 'destructive' });
        return;
      }
      preeventScore = parsed;
    }

    if (liveValue) {
      const parsed = parseFloat(liveValue);
      if (isNaN(parsed) || parsed < 0 || parsed > 40) {
        toast({ title: 'Invalid Score', description: 'Live event score must be between 0 and 40', variant: 'destructive' });
        return;
      }
      liveScore = parsed;
    }

    if (preeventScore === null && liveScore === null) {
      toast({ title: 'No Scores to Save', description: 'Please enter at least one score', variant: 'destructive' });
      return;
    }

    updateScoresMutation.mutate({ userId, preeventScore, liveScore });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-4">
          <span className="material-symbols-outlined text-[40px] text-primary animate-spin block mx-auto">refresh</span>
          <p className="text-sm text-on-surface-variant font-body">Loading students…</p>
        </div>
      </div>
    );
  }

  if (!students || students.length === 0) {
    return (
      <div className="bg-surface-container-lowest rounded-[2rem] shadow-[0_32px_64px_-16px_rgba(19,41,143,0.1)] px-8 py-16 text-center">
        <span className="material-symbols-outlined text-[48px] text-on-surface-variant/20 block mb-3" style={{ fontVariationSettings: "'FILL' 1" }}>edit_note</span>
        <p className="text-sm text-on-surface-variant/50 font-body">No journalists or admin students found.</p>
        <p className="text-xs text-on-surface-variant/40 font-body mt-1">Students with special roles will appear here for manual scoring.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-700">

      {/* Info banner */}
      <div className="flex items-start gap-4 p-5 bg-primary-container/30 rounded-2xl">
        <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-[18px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>edit_note</span>
        </div>
        <div>
          <p className="font-headline font-bold text-on-surface text-sm">Manual Scoring</p>
          <p className="text-xs text-on-surface-variant font-body mt-0.5">
            Enter pre-event scores (0–60) and live event scores (0–40) for journalists and admin students. Pre-event scores from imports will appear here.
          </p>
        </div>
      </div>

      {/* Students list */}
      <div className="bg-surface-container-lowest rounded-[2rem] shadow-[0_32px_64px_-16px_rgba(19,41,143,0.1)] overflow-hidden">
        <div className="divide-y divide-outline-variant/5">
          {students.map(student => {
            const currentPreeventScore = preeventScores[student.user_id] ?? student.preevent_score?.toString() ?? '';
            const currentLiveScore = liveScores[student.user_id] ?? student.organizer_manual_score?.toString() ?? '';
            const hasPreeventChanges = preeventScores[student.user_id] !== undefined && preeventScores[student.user_id] !== student.preevent_score?.toString();
            const hasLiveChanges = liveScores[student.user_id] !== undefined && liveScores[student.user_id] !== student.organizer_manual_score?.toString();
            const hasAnyChanges = hasPreeventChanges || hasLiveChanges;

            return (
              <div
                key={student.user_id}
                className={`px-8 py-5 transition-colors ${hasAnyChanges ? 'bg-primary-container/[0.06]' : 'hover:bg-primary-container/[0.02]'}`}
              >
                <div className="flex items-center gap-4 flex-wrap">
                  {/* Serial */}
                  <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-primary font-headline">{student.serial_number}</span>
                  </div>

                  {/* Avatar */}
                  <Avatar className="h-12 w-12 border-2 border-primary/10 shrink-0">
                    <AvatarImage src={student.photo_url || undefined} alt={student.name} />
                    <AvatarFallback className="bg-primary/10 text-primary font-headline font-bold text-sm">
                      {student.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <p className="font-headline font-bold text-on-surface">{student.name}</p>
                      <PartyBadge partyNumber={student.party_number} size="sm" />
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-bold rounded-full font-body ${student.special_role === 'journalist' ? 'bg-secondary-fixed text-on-secondary-fixed' : 'bg-surface-container-high text-on-surface-variant border border-outline-variant/20'}`}>
                        <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                          {student.special_role === 'journalist' ? 'article' : 'admin_panel_settings'}
                        </span>
                        {student.special_role === 'journalist' ? 'Journalist' : 'Admin'}
                      </span>
                    </div>
                    <p className="text-xs text-on-surface-variant font-body truncate">{student.position}</p>
                    {hasAnyChanges && (
                      <p className="text-[11px] text-primary font-bold font-body mt-0.5 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[12px]">pending</span>
                        Unsaved changes
                      </p>
                    )}
                  </div>

                  {/* Score inputs */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex flex-col items-center gap-1">
                      <p className="text-[9px] font-black uppercase tracking-[0.15em] text-on-surface-variant/50 font-headline whitespace-nowrap">Pre-Event / 60</p>
                      <input
                        type="text"
                        value={currentPreeventScore}
                        onChange={e => handlePreeventScoreChange(student.user_id, e.target.value)}
                        placeholder="0.00"
                        className="w-24 h-11 bg-surface-container border-none rounded-2xl text-center text-lg font-bold text-on-surface font-headline focus:ring-2 focus:ring-primary/20 outline-none"
                      />
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <p className="text-[9px] font-black uppercase tracking-[0.15em] text-on-surface-variant/50 font-headline whitespace-nowrap">Live Event / 40</p>
                      <input
                        type="text"
                        value={currentLiveScore}
                        onChange={e => handleLiveScoreChange(student.user_id, e.target.value)}
                        placeholder="0.00"
                        className="w-24 h-11 bg-surface-container border-none rounded-2xl text-center text-lg font-bold text-on-surface font-headline focus:ring-2 focus:ring-primary/20 outline-none"
                      />
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <p className="text-[9px] font-black uppercase tracking-[0.15em] text-on-surface-variant/0 font-headline">save</p>
                      <button
                        onClick={() => handleSaveScores(student.user_id, student)}
                        disabled={updateScoresMutation.isPending}
                        className={`flex items-center gap-1.5 h-11 px-4 rounded-2xl font-bold text-sm font-body transition-all active:scale-[0.98] disabled:opacity-50 ${hasAnyChanges ? 'bg-gradient-to-r from-primary to-primary-container text-white shadow-[0_4px_12px_rgba(19,41,143,0.25)]' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}`}
                      >
                        <span className="material-symbols-outlined text-[16px]">save</span>
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
