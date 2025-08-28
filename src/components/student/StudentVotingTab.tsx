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
    <div className="space-y-6">
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-4 mb-4">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-3xl flex items-center justify-center shadow-lg shadow-blue-500/30">
            <CheckCircle2 className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-4xl font-black text-transparent bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text">
            Voting Sessions
          </h2>
        </div>
        <p className="text-lg text-slate-600 font-semibold">
          Participate in active voting sessions and view your voting history
        </p>
      </div>

      {!votingEnabled ? (
        <div className="bg-white/15 backdrop-blur-lg rounded-3xl p-12 border border-white/25 shadow-xl text-center">
          <div className="relative inline-block mb-6">
            <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-red-500 rounded-3xl flex items-center justify-center mx-auto shadow-lg">
              <AlertCircle className="w-10 h-10 text-white" />
            </div>
            <div className="absolute -top-2 -right-2 w-6 h-6 bg-orange-400/40 rounded-full animate-bounce"></div>
          </div>
          <h3 className="text-2xl font-black text-slate-800 mb-4">Voting is Disabled</h3>
          <p className="text-lg text-slate-600 font-medium">
            Voting will appear here when organizers enable it.
          </p>
        </div>
      ) : hasActivePolls ? (
        <PollVoting />
      ) : (
        <div className="bg-white/15 backdrop-blur-lg rounded-3xl p-12 border border-white/25 shadow-xl text-center">
          <div className="relative inline-block mb-6">
            <div className="w-20 h-20 bg-gradient-to-br from-gray-400 to-gray-500 rounded-3xl flex items-center justify-center mx-auto shadow-lg">
              <CheckCircle2 className="w-10 h-10 text-white" />
            </div>
            <div className="absolute -top-2 -right-2 w-6 h-6 bg-gray-400/40 rounded-full animate-bounce"></div>
          </div>
          <h3 className="text-2xl font-black text-slate-800 mb-4">No Voting Sessions Available</h3>
          <p className="text-lg text-slate-600 font-medium">
            There are currently no voting sessions available. Check back later or contact the organizers.
          </p>
        </div>
      )}

      <div className="text-sm text-green-700 flex items-center justify-center gap-2">
        <CheckCircle2 className="w-4 h-4" />
        Live updates enabled. Changes by organizers reflect instantly.
      </div>
    </div>
  );
};

export default StudentVotingTab;
