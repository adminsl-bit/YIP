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
        .in('setting_key', ['voting_enabled', 'results_public', 'leaderboard_visible', 'registration_enabled']);

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
    },
    {
      key: 'registration_enabled',
      label: 'Public Registration',
      description: 'Allow new students to register themselves via landing page',
      icon: Users,
      color: 'text-purple-600'
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
    <div className="space-y-8">
      <div className="space-y-6">
        {toggleSettings.map((toggle) => {
          const isEnabled = settings[toggle.key];

          return (
            <div key={toggle.key} className="flex items-center justify-between group">
              <div>
                <p className="font-bold text-sm text-[#191c1e]">{toggle.label}</p>
                <p className="text-[10px] text-[#757684] font-bold uppercase tracking-wider opacity-60">{toggle.description}</p>
              </div>
              <Switch
                checked={isEnabled}
                onCheckedChange={(checked) => updateSetting(toggle.key, checked)}
                className="data-[state=checked]:bg-[#ac3509] scale-110 shadow-sm"
              />
            </div>
          );
        })}
      </div>

      <div className="mt-10 p-5 bg-[#13298f]/5 rounded-[2rem] border border-[#13298f]/10 relative overflow-hidden ring-1 ring-white/20">
        <div className="absolute top-0 right-0 p-4 opacity-5">
           <span className="material-symbols-outlined text-4xl text-[#13298f]">info</span>
        </div>
        <p className="text-xs font-black text-[#13298f] mb-3 flex items-center gap-2">
           <span className="material-symbols-outlined text-sm font-fill">info</span> 
           Critical Warning
        </p>
        <p className="text-[10px] leading-relaxed text-[#13298f]/80 font-bold uppercase tracking-tight">
           Switching off 'Enabling Voting' will instantly freeze all student tablets across the hall.
        </p>
      </div>

      {/* Advanced Jury Locks (Kept in Accordion) */}
      <Accordion type="single" collapsible className="mt-8">
        <AccordionItem value="locks" className="border-none">
          <AccordionTrigger className="py-2 hover:no-underline opacity-60 hover:opacity-100 transition-opacity">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#757684]">Advanced Jury Locks</span>
          </AccordionTrigger>
          <AccordionContent className="pt-4 space-y-4">
             <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                <span className="text-xs font-bold text-slate-600">Global Assessment Lock</span>
                <Switch 
                   checked={globalLocked} 
                   onCheckedChange={toggleGlobalLock} 
                   className="data-[state=checked]:bg-[#13298f]"
                />
             </div>
             <div className="space-y-2">
                {juryMembers.map(jury => (
                   <div key={jury.user_id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl transition-colors hover:bg-slate-100">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">{jury.name}</span>
                      <Switch 
                         checked={isJuryLocked(jury.user_id)} 
                         onCheckedChange={(c) => toggleJuryLock(jury.user_id, jury.name, c)}
                         disabled={globalLocked}
                         className="scale-90 data-[state=checked]:bg-[#13298f]"
                      />
                   </div>
                ))}
             </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
};