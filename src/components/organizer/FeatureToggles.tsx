import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Settings, Power, Eye, Lock, Trophy, AlertCircle } from "lucide-react";
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
    assessments_locked: false,
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
        .in('setting_key', ['voting_enabled', 'results_public', 'assessments_locked', 'leaderboard_visible']);

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
      key: 'assessments_locked',
      label: 'Lock Assessments',
      description: 'Prevent jury members from modifying their assessments',
      icon: Lock,
      color: 'text-red-600'
    },
    {
      key: 'leaderboard_visible',
      label: 'Show Leaderboard',
      description: 'Display performance rankings to students',
      icon: Trophy,
      color: 'text-yellow-600'
    }
  ];

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