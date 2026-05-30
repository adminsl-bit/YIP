import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Lock, Unlock, ShieldAlert, User, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface JuryMember {
  user_id: string;
  name: string;
  photo_url?: string;
}

interface AssessmentLock {
  id: string;
  jury_id?: string;
  is_global_lock: boolean;
  locked_by: string;
  locked_at: string;
  reason?: string;
}

export const AssessmentLockControls = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [juryMembers, setJuryMembers] = useState<JuryMember[]>([]);
  const [locks, setLocks] = useState<AssessmentLock[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      // Fetch all jury members
      const { data: juryData, error: juryError } = await supabase
        .from('profiles')
        .select('user_id, name, photo_url')
        .eq('user_type', 'jury')
        .order('name');

      if (juryError) throw juryError;

      // Fetch all assessment locks
      const { data: locksData, error: locksError } = await supabase
        .from('assessment_locks')
        .select('*');

      if (locksError) throw locksError;

      setJuryMembers(juryData || []);
      setLocks(locksData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load assessment lock data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const setupRealtimeSubscription = useCallback(() => {
    const channel = supabase
      .channel('assessment-locks-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'assessment_locks',
      }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  useEffect(() => {
    fetchData();
    const cleanup = setupRealtimeSubscription();
    return cleanup;
  }, [fetchData, setupRealtimeSubscription]);

  const isGlobalLocked = () => {
    return locks.some(lock => lock.is_global_lock);
  };

  const isJuryLocked = (juryId: string) => {
    return locks.some(lock => !lock.is_global_lock && lock.jury_id === juryId);
  };

  const toggleGlobalLock = async (enable: boolean) => {
    try {
      if (enable) {
        // Create global lock
        const { error } = await supabase
          .from('assessment_locks')
          .insert({
            is_global_lock: true,
            locked_by: user?.id,
            reason: 'Global lock enabled by organizer'
          });

        if (error) throw error;

        // Log audit event
        await supabase.rpc('log_audit_event', {
          p_user_id: user?.id,
          p_action: 'global_assessment_lock_enabled',
          p_resource_type: 'assessment_lock',
          p_details: { is_global: true }
        });

        toast({
          title: 'Global Lock Enabled',
          description: 'All jury assessments are now locked',
        });
      } else {
        // Remove all global locks
        const { error } = await supabase
          .from('assessment_locks')
          .delete()
          .eq('is_global_lock', true);

        if (error) throw error;

        // Log audit event
        await supabase.rpc('log_audit_event', {
          p_user_id: user?.id,
          p_action: 'global_assessment_lock_disabled',
          p_resource_type: 'assessment_lock',
          p_details: { is_global: true }
        });

        toast({
          title: 'Global Lock Disabled',
          description: 'Jury members can now edit their assessments',
        });
      }
    } catch (error) {
      console.error('Error toggling global lock:', error);
      toast({
        title: 'Error',
        description: 'Failed to update global lock',
        variant: 'destructive',
      });
    }
  };

  const toggleJuryLock = async (juryId: string, juryName: string, enable: boolean) => {
    try {
      if (enable) {
        // Create jury-specific lock
        const { error } = await supabase
          .from('assessment_locks')
          .insert({
            jury_id: juryId,
            is_global_lock: false,
            locked_by: user?.id,
            reason: `Lock enabled for ${juryName}`
          });

        if (error) throw error;

        // Log audit event
        await supabase.rpc('log_audit_event', {
          p_user_id: user?.id,
          p_action: 'jury_assessment_lock_enabled',
          p_resource_type: 'assessment_lock',
          p_resource_id: juryId,
          p_details: { jury_name: juryName }
        });

        toast({
          title: 'Jury Lock Enabled',
          description: `${juryName}'s assessments are now locked`,
        });
      } else {
        // Remove jury-specific lock
        const { error } = await supabase
          .from('assessment_locks')
          .delete()
          .eq('jury_id', juryId)
          .eq('is_global_lock', false);

        if (error) throw error;

        // Log audit event
        await supabase.rpc('log_audit_event', {
          p_user_id: user?.id,
          p_action: 'jury_assessment_lock_disabled',
          p_resource_type: 'assessment_lock',
          p_resource_id: juryId,
          p_details: { jury_name: juryName }
        });

        toast({
          title: 'Jury Lock Disabled',
          description: `${juryName} can now edit assessments`,
        });
      }
    } catch (error) {
      console.error('Error toggling jury lock:', error);
      toast({
        title: 'Error',
        description: 'Failed to update jury lock',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5" />
            Assessment Lock Controls
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

  const globalLocked = isGlobalLocked();
  const lockedCount = locks.filter(lock => !lock.is_global_lock).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="w-5 h-5" />
          Assessment Lock Controls
        </CardTitle>
        <CardDescription>
          Control which jury members can edit their assessments
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Global Lock Toggle */}
        <div className="p-4 border-2 border-primary/20 rounded-lg bg-gradient-to-r from-red-50 to-orange-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-red-100 rounded-lg">
                {globalLocked ? (
                  <Lock className="w-6 h-6 text-red-600" />
                ) : (
                  <Unlock className="w-6 h-6 text-gray-600" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-lg">Lock All Assessments</h3>
                  <Badge variant={globalLocked ? 'destructive' : 'secondary'}>
                    {globalLocked ? 'LOCKED' : 'UNLOCKED'}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {globalLocked 
                    ? 'All jury members are prevented from editing assessments'
                    : 'Enable to lock all jury assessments at once'}
                </p>
              </div>
            </div>
            <Switch
              checked={globalLocked}
              onCheckedChange={toggleGlobalLock}
              className="data-[state=checked]:bg-red-600"
            />
          </div>
        </div>

        {/* Warning when global lock is enabled */}
        {globalLocked && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
            <ShieldAlert className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-medium text-red-900">Global Lock Active</h4>
              <p className="text-sm text-red-700">
                All jury assessments are locked. Individual jury locks are overridden.
              </p>
            </div>
          </div>
        )}

        {/* Individual Jury Lock Toggles */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <Users className="w-5 h-5" />
              Individual Jury Locks
            </h3>
            <Badge variant="outline">
              {lockedCount} of {juryMembers.length} locked
            </Badge>
          </div>

          <div className="space-y-3">
            {juryMembers.map((jury) => {
              const isLocked = isJuryLocked(jury.user_id);
              const initials = jury.name
                .split(' ')
                .map(n => n[0])
                .join('')
                .toUpperCase();

              return (
                <div
                  key={jury.user_id}
                  className={`flex items-center justify-between p-4 border rounded-lg transition-all ${
                    isLocked
                      ? 'border-red-300 bg-red-50'
                      : 'border-border bg-background hover:border-primary/30'
                  } ${globalLocked ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10 border-2 border-border">
                      <AvatarImage src={jury.photo_url} alt={jury.name} />
                      <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-sm">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{jury.name}</h4>
                        {isLocked && (
                          <Badge variant="destructive" className="text-xs">
                            <Lock className="w-3 h-3 mr-1" />
                            Locked
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {isLocked 
                          ? 'Cannot edit assessments'
                          : 'Can edit assessments'}
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={isLocked}
                    onCheckedChange={(checked) => toggleJuryLock(jury.user_id, jury.name, checked)}
                    disabled={globalLocked}
                    className={isLocked ? 'data-[state=checked]:bg-red-600' : ''}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Info Box */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-2">
            <User className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-medium text-blue-900">How it works</h4>
              <ul className="text-sm text-blue-700 mt-1 space-y-1 list-disc list-inside">
                <li>Global lock overrides all individual jury locks</li>
                <li>Individual locks allow fine-grained control per jury member</li>
                <li>Locked jury members cannot create or edit assessments</li>
                <li>Changes take effect immediately</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};