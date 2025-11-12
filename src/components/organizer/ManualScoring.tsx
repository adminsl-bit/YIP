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
}

export const ManualScoring = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [scores, setScores] = useState<Record<string, string>>({});

  const { data: students, isLoading } = useQuery({
    queryKey: ['manual-scoring-students'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organizer_manual_scoring')
        .select('*')
        .order('serial_number', { ascending: true });

      if (error) throw error;
      return data as ManualScoringStudent[];
    },
  });

  const updateScoreMutation = useMutation({
    mutationFn: async ({ userId, score }: { userId: string; score: number }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ organizer_manual_score: score })
        .eq('user_id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: 'Score Updated',
        description: 'Manual score has been saved successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['manual-scoring-students'] });
      queryClient.invalidateQueries({ queryKey: ['organizer-leaderboard'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update score',
        variant: 'destructive',
      });
    },
  });

  const handleScoreChange = (userId: string, value: string) => {
    // Only allow numbers and decimal point
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setScores({ ...scores, [userId]: value });
    }
  };

  const handleSaveScore = (userId: string) => {
    const scoreValue = parseFloat(scores[userId] || '0');
    
    if (isNaN(scoreValue) || scoreValue < 0 || scoreValue > 100) {
      toast({
        title: 'Invalid Score',
        description: 'Score must be between 0 and 100',
        variant: 'destructive',
      });
      return;
    }

    updateScoreMutation.mutate({ userId, score: scoreValue });
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
              Enter scores (0-100) for journalists and admin students. These scores will be used in the final leaderboard calculations.
            </p>
          </div>
        </div>
      </Card>

      {/* Students List */}
      <div className="space-y-3">
        {students.map((student) => {
          const currentScore = scores[student.user_id] ?? student.organizer_manual_score?.toString() ?? '';
          const hasUnsavedChanges = scores[student.user_id] !== undefined && 
            scores[student.user_id] !== student.organizer_manual_score?.toString();

          return (
            <Card
              key={student.user_id}
              className={`p-4 hover:shadow-lg transition-all duration-200 ${
                hasUnsavedChanges ? 'border-2 border-amber-400 bg-amber-50/50' : ''
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

                {/* Score Input */}
                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-end gap-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      Score (out of 100)
                    </label>
                    <Input
                      type="text"
                      value={currentScore}
                      onChange={(e) => handleScoreChange(student.user_id, e.target.value)}
                      placeholder="0.00"
                      className="w-24 text-center text-lg font-semibold"
                    />
                  </div>
                  <Button
                    onClick={() => handleSaveScore(student.user_id)}
                    disabled={updateScoreMutation.isPending || !currentScore}
                    size="sm"
                    className="gap-2"
                  >
                    <Save className="h-4 w-4" />
                    Save
                  </Button>
                </div>
              </div>
              {hasUnsavedChanges && (
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
