import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { PartyBadge } from '@/components/ui/party-badge';
import { Award, Save, Users } from 'lucide-react';

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
      
      // Fetch preevent_scores from profiles table
      const studentsWithPreEventScores = await Promise.all(
        (data || []).map(async (student) => {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('preevent_scores')
            .eq('user_id', student.user_id)
            .single();
          
          return {
            ...student,
            preevent_score: profileData?.preevent_scores || null,
          };
        })
      );
      
      return studentsWithPreEventScores as ManualScoringStudent[];
    },
  });

  const updatePreeventScoreMutation = useMutation({
    mutationFn: async ({ userId, score }: { userId: string; score: number }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ preevent_scores: score })
        .eq('user_id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: 'Pre-Event Score Updated',
        description: 'Pre-event score has been saved successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['manual-scoring-students'] });
      queryClient.invalidateQueries({ queryKey: ['organizer-leaderboard'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update pre-event score',
        variant: 'destructive',
      });
    },
  });

  const updateLiveScoreMutation = useMutation({
    mutationFn: async ({ userId, score }: { userId: string; score: number }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ organizer_manual_score: score })
        .eq('user_id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: 'Live Event Score Updated',
        description: 'Live event score has been saved successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['manual-scoring-students'] });
      queryClient.invalidateQueries({ queryKey: ['organizer-leaderboard'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update live event score',
        variant: 'destructive',
      });
    },
  });

  const handlePreeventScoreChange = (userId: string, value: string) => {
    // Only allow numbers and decimal point
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setPreeventScores({ ...preeventScores, [userId]: value });
    }
  };

  const handleLiveScoreChange = (userId: string, value: string) => {
    // Only allow numbers and decimal point
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setLiveScores({ ...liveScores, [userId]: value });
    }
  };

  const handleSavePreeventScore = (userId: string) => {
    const scoreValue = parseFloat(preeventScores[userId] || '0');
    
    if (isNaN(scoreValue) || scoreValue < 0 || scoreValue > 60) {
      toast({
        title: 'Invalid Score',
        description: 'Pre-event score must be between 0 and 60',
        variant: 'destructive',
      });
      return;
    }

    updatePreeventScoreMutation.mutate({ userId, score: scoreValue });
  };

  const handleSaveLiveScore = (userId: string) => {
    const scoreValue = parseFloat(liveScores[userId] || '0');
    
    if (isNaN(scoreValue) || scoreValue < 0 || scoreValue > 40) {
      toast({
        title: 'Invalid Score',
        description: 'Live event score must be between 0 and 40',
        variant: 'destructive',
      });
      return;
    }

    updateLiveScoreMutation.mutate({ userId, score: scoreValue });
  };

  const getRoleBadgeColor = (role: string) => {
    return role === 'journalist' ? 'bg-orange-500' : 'bg-cyan-500';
  };

  const getRoleLabel = (role: string) => {
    return role === 'journalist' ? 'Journalist' : 'Admin';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-muted-foreground">Loading students...</p>
        </div>
      </div>
    );
  }

  if (!students || students.length === 0) {
    return (
      <Card className="p-12">
        <div className="text-center text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">No journalists or admin students found</p>
          <p className="text-sm">Students with special roles will appear here for manual scoring</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Info Card */}
      <Card className="p-6 bg-blue-50 border-blue-200">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-blue-500 rounded-lg">
            <Award className="h-6 w-6 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-lg mb-1">Manual Scoring</h3>
            <p className="text-sm text-muted-foreground">
              Enter pre-event scores (0-60) and live event scores (0-40) for journalists and admin students. Pre-event scores from imports will appear here.
            </p>
          </div>
        </div>
      </Card>

      {/* Students List */}
      <div className="space-y-3">
        {students.map((student) => {
          const currentPreeventScore = preeventScores[student.user_id] ?? student.preevent_score?.toString() ?? '';
          const currentLiveScore = liveScores[student.user_id] ?? student.organizer_manual_score?.toString() ?? '';
          const hasPreeventChanges = preeventScores[student.user_id] !== undefined && 
            preeventScores[student.user_id] !== student.preevent_score?.toString();
          const hasLiveChanges = liveScores[student.user_id] !== undefined && 
            liveScores[student.user_id] !== student.organizer_manual_score?.toString();
          const hasAnyChanges = hasPreeventChanges || hasLiveChanges;

          return (
            <Card
              key={student.user_id}
              className={`p-4 hover:shadow-lg transition-all duration-200 ${
                hasAnyChanges ? 'border-2 border-amber-400 bg-amber-50/50' : ''
              }`}
            >
              <div className="flex items-center gap-4">
                {/* Serial Number */}
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-lg font-bold text-primary">
                      {student.serial_number}
                    </span>
                  </div>
                </div>

                {/* Avatar */}
                <Avatar className="h-14 w-14 border-2 border-border">
                  <AvatarImage src={student.photo_url || undefined} alt={student.name} />
                  <AvatarFallback className="text-lg">
                    {student.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="font-semibold text-lg truncate">{student.name}</h3>
                    <PartyBadge partyNumber={student.party_number} size="sm" />
                    <Badge className={`${getRoleBadgeColor(student.special_role)} text-white`}>
                      {getRoleLabel(student.special_role)}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {student.position}
                  </p>
                </div>

                {/* Score Inputs */}
                <div className="flex items-center gap-3">
                  {/* Pre-Event Score */}
                  <div className="flex flex-col items-end gap-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      Pre-Event (out of 60)
                    </label>
                    <Input
                      type="text"
                      value={currentPreeventScore}
                      onChange={(e) => handlePreeventScoreChange(student.user_id, e.target.value)}
                      placeholder="0.00"
                      className="w-24 text-center text-lg font-semibold"
                    />
                  </div>
                  <Button
                    onClick={() => handleSavePreeventScore(student.user_id)}
                    disabled={updatePreeventScoreMutation.isPending || !currentPreeventScore}
                    size="sm"
                    className="gap-2"
                  >
                    <Save className="h-4 w-4" />
                    Save
                  </Button>
                  
                  {/* Live Event Score */}
                  <div className="flex flex-col items-end gap-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      Live Event (out of 40)
                    </label>
                    <Input
                      type="text"
                      value={currentLiveScore}
                      onChange={(e) => handleLiveScoreChange(student.user_id, e.target.value)}
                      placeholder="0.00"
                      className="w-24 text-center text-lg font-semibold"
                    />
                  </div>
                  <Button
                    onClick={() => handleSaveLiveScore(student.user_id)}
                    disabled={updateLiveScoreMutation.isPending || !currentLiveScore}
                    size="sm"
                    className="gap-2"
                  >
                    <Save className="h-4 w-4" />
                    Save
                  </Button>
                </div>
              </div>
              {hasAnyChanges && (
                <div className="mt-2 text-xs text-amber-600 font-medium">
                  ⚠️ You have unsaved changes
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
};
