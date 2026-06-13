import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useSystemSettings } from '@/hooks/useSystemSettings';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { PartyBadge } from '@/components/ui/party-badge';

interface ManualScoringStudent {
  user_id: string;
  serial_number: number;
  name: string;
  position: string;
  party_number: number;
  party_name: string | null;
  photo_url: string | null;
  special_role: 'journalist' | 'admin_student' | null;
  organizer_manual_score: number | null;
  preevent_scores: number | null;
}

const ITEMS_PER_PAGE = 20;

export const ManualScoring = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { settings: systemSettings, refetch: refetchSettings } = useSystemSettings();
  const [preeventScores, setPreeventScores] = useState<Record<string, string>>({});
  const [liveScores, setLiveScores] = useState<Record<string, string>>({});
  const [weightPct, setWeightPct] = useState(60);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setWeightPct(systemSettings.pre_event_weightage_pct);
  }, [systemSettings.pre_event_weightage_pct]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const { data: students, isLoading } = useQuery({
    queryKey: ['manual-scoring-students'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organizer_manual_scoring')
        .select('*')
        .order('serial_number', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as ManualScoringStudent[];
    },
  });

  const filteredStudents = useMemo(() => {
    if (!students) return [];
    if (!searchTerm) return students;
    const term = searchTerm.toLowerCase();
    return students.filter(student =>
      student.name.toLowerCase().includes(term) ||
      student.serial_number.toString().includes(term) ||
      student.position.toLowerCase().includes(term)
    );
  }, [students, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / ITEMS_PER_PAGE));
  const paginatedStudents = filteredStudents.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

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

  const persistScoringSetting = async (key: string, value: boolean | number, description: string) => {
    if (!user) return;
    const { error } = await supabase
      .from('system_settings')
      .upsert({ setting_key: key, setting_value: value, description, updated_by: user.id }, { onConflict: 'setting_key' });
    if (error) throw error;

    await supabase.rpc('log_audit_event', {
      p_user_id: user.id,
      p_action: 'setting_updated',
      p_resource_type: 'system_setting',
      p_resource_id: key,
      p_details: { new_value: value },
    });

    refetchSettings();
    queryClient.invalidateQueries({ queryKey: ['organizer-leaderboard'] });
  };

  const handleToggleWeightage = async (enabled: boolean) => {
    try {
      await persistScoringSetting('pre_event_weightage_enabled', enabled, 'Whether the pre-event score contributes to the final leaderboard total');
      toast({
        title: enabled ? 'Pre-Event Score Enabled' : 'Pre-Event Score Disabled',
        description: enabled ? 'Final scores now include the pre-event weightage.' : 'Final scores are now 100% judge / live event scoring.',
      });
    } catch {
      toast({ title: 'Error', description: 'Failed to update scoring weightage', variant: 'destructive' });
    }
  };

  const handleCommitWeightPct = async (pct: number) => {
    try {
      await persistScoringSetting('pre_event_weightage_pct', pct, 'Percentage weight given to the pre-event score in the final total (the remainder goes to judge/live scoring)');
      toast({ title: 'Scoring Weightage Updated', description: `Pre-event: ${pct}% · Judges/Live: ${100 - pct}%` });
    } catch {
      toast({ title: 'Error', description: 'Failed to update scoring weightage', variant: 'destructive' });
    }
  };

  const handlePreeventScoreChange = (userId: string, value: string) => {
    if (value === '' || /^\d*\.?\d*$/.test(value)) setPreeventScores({ ...preeventScores, [userId]: value });
  };

  const handleLiveScoreChange = (userId: string, value: string) => {
    if (value === '' || /^\d*\.?\d*$/.test(value)) setLiveScores({ ...liveScores, [userId]: value });
  };

  const handleSaveScores = (userId: string, student: ManualScoringStudent) => {
    const preeventValue = preeventScores[userId] !== undefined ? preeventScores[userId] : student.preevent_scores?.toString();
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
        <p className="text-sm text-on-surface-variant/50 font-body">No students found.</p>
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
            Enter pre-event scores (0–60) for every student. Journalists and admin students also get a live event score (0–40). Pre-event scores from imports will appear here.
          </p>
        </div>
      </div>

      {/* Scoring Weightage */}
      <div className="bg-surface-container-lowest rounded-[2rem] shadow-[0_32px_64px_-16px_rgba(19,41,143,0.1)] p-6 space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[18px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>tune</span>
            </div>
            <div>
              <p className="font-headline font-bold text-on-surface text-sm">Scoring Weightage</p>
              <p className="text-xs text-on-surface-variant font-body mt-0.5">
                Control whether pre-event scores count toward the final leaderboard total.
              </p>
            </div>
          </div>
          <Switch checked={systemSettings.pre_event_weightage_enabled} onCheckedChange={handleToggleWeightage} />
        </div>

        {systemSettings.pre_event_weightage_enabled ? (
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <Slider
                value={[weightPct]}
                min={0}
                max={100}
                step={1}
                onValueChange={([v]) => setWeightPct(v)}
                onValueCommit={([v]) => handleCommitWeightPct(v)}
                className="flex-1"
              />
              <input
                type="number"
                min={0}
                max={100}
                value={weightPct}
                onChange={e => setWeightPct(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                onBlur={() => handleCommitWeightPct(weightPct)}
                className="w-20 h-11 bg-surface-container border-none rounded-2xl text-center text-lg font-bold text-on-surface font-headline focus:ring-2 focus:ring-primary/20 outline-none"
              />
            </div>
            <p className="text-xs text-on-surface-variant font-body">
              Pre-event: <span className="font-bold text-primary">{weightPct}%</span> (worth {weightPct} of 100) · Judges/Live: <span className="font-bold text-primary">{100 - weightPct}%</span> (worth {100 - weightPct} of 100)
            </p>
          </div>
        ) : (
          <p className="text-xs text-on-surface-variant font-body">
            Final score = <span className="font-bold text-primary">100% Judge / Live Event scoring</span>. Pre-event scores are ignored.
          </p>
        )}
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40 text-[18px]">search</span>
          <input
            type="text"
            placeholder="Search by name, serial number, or position…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-surface-container-lowest rounded-2xl py-3.5 pl-12 pr-4 text-sm font-medium border-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-outline font-body"
          />
        </div>
        <p className="text-sm text-on-surface-variant font-body shrink-0">
          <span className="font-bold text-on-surface">{filteredStudents.length}</span> of {students.length} students
        </p>
      </div>

      {/* Students list */}
      <div className="bg-surface-container-lowest rounded-[2rem] shadow-[0_32px_64px_-16px_rgba(19,41,143,0.1)] overflow-hidden">
        <div className="divide-y divide-outline-variant/5">
          {paginatedStudents.map(student => {
            const currentPreeventScore = preeventScores[student.user_id] ?? student.preevent_scores?.toString() ?? '';
            const currentLiveScore = liveScores[student.user_id] ?? student.organizer_manual_score?.toString() ?? '';
            const hasPreeventChanges = preeventScores[student.user_id] !== undefined && preeventScores[student.user_id] !== student.preevent_scores?.toString();
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
                      {student.special_role && (
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-bold rounded-full font-body ${student.special_role === 'journalist' ? 'bg-secondary-fixed text-on-secondary-fixed' : 'bg-surface-container-high text-on-surface-variant border border-outline-variant/20'}`}>
                          <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                            {student.special_role === 'journalist' ? 'article' : 'admin_panel_settings'}
                          </span>
                          {student.special_role === 'journalist' ? 'Journalist' : 'Admin'}
                        </span>
                      )}
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
                      {student.special_role ? (
                        <input
                          type="text"
                          value={currentLiveScore}
                          onChange={e => handleLiveScoreChange(student.user_id, e.target.value)}
                          placeholder="0.00"
                          className="w-24 h-11 bg-surface-container border-none rounded-2xl text-center text-lg font-bold text-on-surface font-headline focus:ring-2 focus:ring-primary/20 outline-none"
                        />
                      ) : (
                        <div className="w-24 h-11 flex items-center justify-center text-on-surface-variant/30 font-body text-sm">—</div>
                      )}
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

        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-outline-variant/10 flex items-center justify-between">
            <span className="text-xs text-outline font-body">
              Page <span className="font-bold text-on-surface">{currentPage}</span> of{' '}
              <span className="font-bold text-on-surface">{totalPages}</span>
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="size-8 rounded-lg border border-outline-variant/30 flex items-center justify-center text-on-surface-variant hover:border-primary/20 hover:text-primary transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-[16px]">chevron_left</span>
              </button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                let page: number;
                if (totalPages <= 7) page = i + 1;
                else if (currentPage <= 4) page = i + 1;
                else if (currentPage >= totalPages - 3) page = totalPages - 6 + i;
                else page = currentPage - 3 + i;
                return (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setCurrentPage(page)}
                    className={`size-8 rounded-lg text-xs font-black font-headline transition-all ${
                      currentPage === page
                        ? 'bg-primary text-on-primary'
                        : 'border border-outline-variant/30 text-on-surface-variant hover:border-primary/20 hover:text-primary'
                    }`}
                  >
                    {page}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="size-8 rounded-lg border border-outline-variant/30 flex items-center justify-center text-on-surface-variant hover:border-primary/20 hover:text-primary transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
