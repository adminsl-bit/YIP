import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SystemSettings {
  voting_enabled: boolean;
  results_public: boolean;
  assessments_locked: boolean;
  leaderboard_visible: boolean;
  question_hour_visible: boolean;
}

export const useSystemSettings = () => {
  const [settings, setSettings] = useState<SystemSettings>({
    voting_enabled: false,
    results_public: true,
    assessments_locked: false,
    leaderboard_visible: true,
    question_hour_visible: true
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSettings();

    // Set up real-time subscription for settings changes
    const channel = supabase
      .channel('system_settings_changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'system_settings' 
      }, () => {
        fetchSettings();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .in('setting_key', ['voting_enabled', 'results_public', 'assessments_locked', 'leaderboard_visible', 'question_hour_visible']);

      if (error) throw error;

      const settingsMap: Partial<SystemSettings> = {};
      data?.forEach((setting) => {
        settingsMap[setting.setting_key as keyof SystemSettings] = 
          setting.setting_value === 'true' || setting.setting_value === true;
      });

      setSettings(prev => ({ ...prev, ...settingsMap }));
    } catch (error) {
      console.error('Error fetching system settings:', error);
    } finally {
      setLoading(false);
    }
  };

  return { settings, loading, refetch: fetchSettings };
};