import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PollVoting from "./PollVoting";
import { VotingInterface } from "./VotingInterface";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, CheckCircle2 } from "lucide-react";

export const StudentVotingTab = () => {
  const [votingEnabled, setVotingEnabled] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [hasActivePolls, setHasActivePolls] = useState<boolean>(false);

  useEffect(() => {
    fetchSetting();
    fetchActivePolls();

    const settingsChannel = supabase
      .channel('settings_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'system_settings' }, () => fetchSetting())
      .subscribe();

    const pollsChannel = supabase
      .channel('polls_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'polls' }, () => fetchActivePolls())
      .subscribe();

    return () => {
      supabase.removeChannel(settingsChannel);
      supabase.removeChannel(pollsChannel);
    };
  }, []);

  const fetchSetting = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'voting_enabled')
        .limit(1);
      if (error) throw error;
      const val = data && data.length ? data[0].setting_value : false;
      setVotingEnabled(val === true || val === 'true');
    } catch (err) {
      console.error('Failed to load voting_enabled', err);
      setVotingEnabled(false);
    } finally {
      setLoading(false);
    }
  };

  const fetchActivePolls = async () => {
    try {
      const { data, error } = await supabase
        .from('polls')
        .select('id')
        .eq('is_active', true)
        .limit(1);
      if (error) throw error;
      setHasActivePolls(!!(data && data.length));
    } catch (err) {
      console.error('Failed to load active polls', err);
      setHasActivePolls(false);
    }
  };
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Voting</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-24">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!votingEnabled) {
    return (
      <Card className="bg-orange-50 border-orange-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-orange-800">
            <AlertCircle className="w-5 h-5" /> Voting is disabled
          </CardTitle>
        </CardHeader>
        <CardContent>
          Voting will appear here when organizers enable it.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      {hasActivePolls ? (
        <PollVoting />
      ) : (
        <VotingInterface />
      )}
      <div className="text-sm text-green-700 flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4" />
        Live updates enabled. Changes by organizers reflect instantly.
      </div>
    </div>
  );
};

export default StudentVotingTab;
