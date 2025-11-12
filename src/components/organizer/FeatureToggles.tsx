import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Settings, Power, Eye, Trophy, AlertCircle, Lock, Unlock, Users } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface SystemSetting {
  id: string;
  setting_key: string;
  setting_value: any;
  description: string;
  updated_at: string;
}

export const FeatureToggles = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<Record<string, boolean>>({
    voting_enabled: false,
    results_public: false,
    leaderboard_visible: true
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .in('setting_key', ['voting_enabled', 'results_public', 'leaderboard_visible']);

      if (error) throw error;

      const settingsMap: Record<string, boolean> = {};
      data?.forEach((setting: SystemSetting) => {
        settingsMap[setting.setting_key] = setting.setting_value === 'true' || setting.setting_value === true;
      });

      setSettings(settingsMap);
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast({
        title: "Error",
        description: "Failed to load system settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (key: string, value: boolean) => {
    try {
      const { error } = await supabase
        .from('system_settings')
        .update({
          setting_value: value,
          updated_by: user?.id
        })
        .eq('setting_key', key);

      if (error) throw error;

      setSettings(prev => ({ ...prev, [key]: value }));

      // Log audit event
      await supabase.rpc('log_audit_event', {
        p_user_id: user?.id,
        p_action: 'setting_updated',
        p_resource_type: 'system_setting',
        p_resource_id: key,
        p_details: { old_value: !value, new_value: value }
      });

      toast({
        title: "Setting Updated",
        description: `${key.replace('_', ' ')} has been ${value ? 'enabled' : 'disabled'}`,
      });
    } catch (error) {
      console.error('Error updating setting:', error);
      toast({
        title: "Error",
        description: "Failed to update setting",
        variant: "destructive",
      });
    }
  };

  const toggleSettings = [
    {
      key: 'voting_enabled',
      label: 'Enable Voting',
      description: 'Allow students to participate in polls and voting sessions',
      icon: Power,
      color: 'text-green-600'
    },
    {
      key: 'results_public',
      label: 'Show Results Publicly',
      description: 'Display voting results and poll outcomes to all users',
      icon: Eye,
      color: 'text-blue-600'
    },
    {
      key: 'leaderboard_visible',
      label: 'Show Leaderboard',
      description: 'Display performance rankings to students',
      icon: Trophy,
      color: 'text-yellow-600'
    }
  ];

  // Assessment lock controls (global and per-jury)
  type JuryMember = { user_id: string; name: string; photo_url?: string | null };
  const [juryMembers, setJuryMembers] = useState<JuryMember[]>([]);
  const [locks, setLocks] = useState<any[]>([]);
  const [locksLoading, setLocksLoading] = useState(true);

  const fetchLocks = async () => {
    try {
      const { data: juryData, error: juryError } = await supabase
        .from('profiles')
        .select('user_id, name, photo_url')
        .eq('user_type', 'jury')
        .order('name');
      if (juryError) throw juryError;

      const { data: locksData, error: locksError } = await supabase
        .from('assessment_locks')
        .select('*');
      if (locksError) throw locksError;

      setJuryMembers(juryData || []);
      setLocks(locksData || []);
    } catch (e) {
      console.error('Error loading locks:', e);
    } finally {
      setLocksLoading(false);
    }
  };

  useEffect(() => {
    fetchLocks();
    const channel = supabase
      .channel('assessment-locks-in-toggles')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assessment_locks' }, () => {
        fetchLocks();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const isGlobalLocked = () => locks.some(l => l.is_global_lock);
  const isJuryLocked = (juryId: string) => locks.some(l => !l.is_global_lock && l.jury_id === juryId);

  const toggleGlobalLock = async (enable: boolean) => {
    try {
      if (enable) {
        // optimistic UI
        setLocks(prev => [...prev, { id: `local-${Date.now()}`, is_global_lock: true }]);
        const { error } = await supabase.from('assessment_locks').insert({
          is_global_lock: true,
          locked_by: user?.id,
          reason: 'Global lock enabled by organizer'
        });
        if (error) throw error;
        toast({ title: 'Global Lock Enabled', description: 'All jury assessments are now locked' });
      } else {
        setLocks(prev => prev.filter(l => !l.is_global_lock));
        const { error } = await supabase.from('assessment_locks').delete().eq('is_global_lock', true);
        if (error) throw error;
        toast({ title: 'Global Lock Disabled', description: 'Jury members can now edit their assessments' });
      }
    } catch (e: any) {
      console.error('Global lock toggle failed', e);
      toast({ title: 'Error', description: e.message || 'Failed to update global lock', variant: 'destructive' });
      fetchLocks();
    }
  };

  const toggleJuryLock = async (juryId: string, juryName: string, enable: boolean) => {
    try {
      if (enable) {
        setLocks(prev => [...prev, { id: `local-${juryId}`, is_global_lock: false, jury_id: juryId }]);
        const { error } = await supabase.from('assessment_locks').insert({
          jury_id: juryId,
          is_global_lock: false,
          locked_by: user?.id,
          reason: `Lock enabled for ${juryName}`
        });
        if (error) throw error;
        toast({ title: 'Jury Locked', description: `${juryName}'s assessments are now locked` });
      } else {
        setLocks(prev => prev.filter(l => !(l.jury_id === juryId && !l.is_global_lock)));
        const { error } = await supabase.from('assessment_locks').delete().eq('jury_id', juryId).eq('is_global_lock', false);
        if (error) throw error;
        toast({ title: 'Jury Unlocked', description: `${juryName} can now edit assessments` });
      }
    } catch (e: any) {
      console.error('Jury lock toggle failed', e);
      toast({ title: 'Error', description: e.message || 'Failed to update jury lock', variant: 'destructive' });
      fetchLocks();
    }
  };

  const globalLocked = isGlobalLocked();
  const lockedCount = locks.filter(l => !l.is_global_lock).length;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="w-5 h-5" />
            <span>Feature Toggles</span>
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Settings className="w-5 h-5" />
          <span>Feature Toggles</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {toggleSettings.map((toggle) => {
          const IconComponent = toggle.icon;
          const isEnabled = settings[toggle.key];

          return (
            <div key={toggle.key} className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center space-x-4">
                <IconComponent className={`w-5 h-5 ${toggle.color}`} />
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="font-medium">{toggle.label}</h3>
                    <Badge variant={isEnabled ? "default" : "secondary"}>
                      {isEnabled ? "Enabled" : "Disabled"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{toggle.description}</p>
                </div>
              </div>
              <Switch
                checked={isEnabled}
                onCheckedChange={(checked) => updateSetting(toggle.key, checked)}
              />
            </div>
          );
        })}

        <Accordion type="single" collapsible className="mt-2">
          <AccordionItem value="assessment-locks">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center space-x-4">
                {globalLocked ? (
                  <Lock className="w-5 h-5 text-red-600" />
                ) : (
                  <Unlock className="w-5 h-5 text-muted-foreground" />
                )}
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="font-medium">Assessment Locks</h3>
                    <Badge variant={globalLocked ? 'destructive' : 'secondary'}>
                      {globalLocked ? 'LOCKED' : 'UNLOCKED'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {globalLocked ? 'All jury assessments are locked' : 'Lock all assessments or expand for per‑jury locks'}
                  </p>
                </div>
              </div>
              <Switch
                checked={globalLocked}
                onCheckedChange={toggleGlobalLock}
                onClick={(e) => e.stopPropagation()}
                className={globalLocked ? 'data-[state=checked]:bg-red-600' : ''}
              />
            </div>
            <AccordionContent className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  <span className="text-sm font-medium">Individual Jury Locks</span>
                </div>
                <Badge variant="outline">{lockedCount} of {juryMembers.length} locked</Badge>
              </div>
              <div className="space-y-3">
                {juryMembers.map((jury) => {
                  const isLocked = isJuryLocked(jury.user_id);
                  const initials = (jury.name || '').split(' ').map((n) => n[0]).join('').toUpperCase();
                  return (
                    <div
                      key={jury.user_id}
                      className={`flex items-center justify-between p-4 border rounded-lg ${
                        isLocked ? 'border-red-300 bg-red-50' : 'border-border bg-background hover:border-primary/30'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="w-10 h-10 border-2 border-border">
                          <AvatarImage src={jury.photo_url || undefined} alt={jury.name} />
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
                            {isLocked ? 'Cannot edit assessments' : 'Can edit assessments'}
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
            </AccordionContent>
          </AccordionItem>
        </Accordion>
        
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start space-x-2">
            <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-900">Global System Controls</h4>
              <p className="text-sm text-blue-700 mt-1">
                These toggles affect the entire parliament session. Changes take effect immediately for all users.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};