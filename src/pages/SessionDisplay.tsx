import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Calendar, Clock, BarChart, Play, Pause } from "lucide-react";
import { BreakingNewsTicker } from "@/components/display/BreakingNewsTicker";
import { SubItemCarousel } from "@/components/display/SubItemCarousel";

interface SessionItem {
  id: string;
  title: string;
  bill_type: string;
  description: string | null;
  timer_id: string | null;
  poll_id: string | null;
  status: string;
}

interface TimerSession {
  id: string;
  title: string;
  duration_seconds: number;
  remaining_seconds: number;
  status: string;
}

interface Poll {
  id: string;
  title: string;
  is_active: boolean;
  show_results_publicly: boolean;
  options?: Array<{ id: string; text: string }>;
}

interface SubItem {
  id: string;
  title: string;
  description: string | null;
  content: string | null;
  is_active: boolean;
}

const SessionDisplay = () => {
  const [activeSession, setActiveSession] = useState<SessionItem | null>(null);
  const [timer, setTimer] = useState<TimerSession | null>(null);
  const [poll, setPoll] = useState<Poll | null>(null);
  const [pollResults, setPollResults] = useState<Record<string, number>>({});
  const [subItems, setSubItems] = useState<SubItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPollResults = async (pollId: string) => {
    try {
      const { data: votes, error } = await supabase
        .from('poll_votes')
        .select('option_id')
        .eq('poll_id', pollId);

      if (error) throw error;

      // Count votes per option
      const results: Record<string, number> = {};
      votes?.forEach((vote) => {
        results[vote.option_id] = (results[vote.option_id] || 0) + 1;
      });

      setPollResults(results);
    } catch (error) {
      console.error('Error fetching poll results:', error);
    }
  };

  useEffect(() => {
    document.title = "Young Indian Parliament - Session Display";
    fetchActiveSession();

    const subscription = supabase
      .channel('session_display_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'session_items' },
        () => fetchActiveSession()
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'timer_sessions' },
        () => {
          // Always refetch the active session to ensure the linked timer stays in sync
          fetchActiveSession();
        }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'polls' },
        (payload) => {
          console.log('Poll change detected:', payload);
          // Refetch the entire active session to pick up any poll changes
          // This ensures polls show up when toggled from inactive to active
          fetchActiveSession();
        }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'session_sub_items' as any },
        () => fetchActiveSession()
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchActiveSession = async () => {
    try {
      const { data: sessionData, error: sessionError } = await supabase
        .from('session_items' as any)
        .select('*')
        .eq('is_active', true)
        .maybeSingle();

      if (sessionError) throw sessionError;

      if (sessionData) {
        setActiveSession(sessionData as any as SessionItem);

        // Fetch linked timer if exists
        if ((sessionData as any).timer_id) {
          const { data: timerData, error: timerError } = await supabase
            .from('timer_sessions')
            .select('*')
            .eq('id', (sessionData as any).timer_id)
            .single();

          if (!timerError && timerData) {
            setTimer(timerData as TimerSession);
          }
        } else {
          setTimer(null);
        }

        // Fetch linked poll if exists
        if ((sessionData as any).poll_id) {
          const { data: pollData, error: pollError } = await supabase
            .from('polls')
            .select('id, title, is_active, show_results_publicly, options')
            .eq('id', (sessionData as any).poll_id)
            .single();

          if (!pollError && pollData) {
            console.log('Poll data fetched for display:', pollData);
            setPoll(pollData as Poll);
            
            // Fetch poll results if public results are enabled
            if (pollData.show_results_publicly) {
              await fetchPollResults(pollData.id);
            }
          } else if (pollError) {
            console.error('Error fetching poll:', pollError);
          }
        } else {
          setPoll(null);
          setPollResults({});
        }

        // Fetch sub-items for this session
        const { data: subItemsData, error: subItemsError } = await supabase
          .from('session_sub_items' as any)
          .select('*')
          .eq('parent_session_id', (sessionData as any).id)
          .order('sort_order', { ascending: true });

        if (!subItemsError && subItemsData) {
          setSubItems(subItemsData as any);
        }
      } else {
        setActiveSession(null);
        setTimer(null);
        setPoll(null);
        setSubItems([]);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error fetching active session:', error);
      setLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getBillTypeLabel = (type: string) => {
    const labels = {
      private_member_bill: 'Private Member Bill',
      government_bill: 'Government Bill',
      committee_report: 'Committee Report',
      question_hour: 'Question Hour',
      general_discussion: 'General Discussion',
    };
    return labels[type as keyof typeof labels] || type;
  };

  const getProgressValue = () => {
    if (!timer || timer.duration_seconds === 0) return 0;
    return ((timer.duration_seconds - timer.remaining_seconds) / timer.duration_seconds) * 100;
  };

  const getTimerColor = () => {
    if (!timer) return 'bg-primary';
    const percentage = (timer.remaining_seconds / timer.duration_seconds) * 100;
    if (percentage <= 10) return 'bg-destructive';
    if (percentage <= 25) return 'bg-orange-500';
    return 'bg-primary';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading session...</p>
        </div>
      </div>
    );
  }

  if (!activeSession) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        <BreakingNewsTicker />
        <div className="flex items-center justify-center h-[calc(100vh-48px)]">
          <div className="text-center px-8">
            <Calendar className="h-24 w-24 mx-auto mb-6 text-primary/20" />
            <h2 className="text-4xl font-bold mb-4">No Active Session</h2>
            <p className="text-xl text-muted-foreground">
              Waiting for the organizer to activate a session item
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-8">
      <BreakingNewsTicker />
      
      <div className="max-w-6xl mx-auto space-y-8 mt-12">
        {/* Session Header */}
        <Card className="border-2 border-primary shadow-xl">
          <CardContent className="p-8">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <Calendar className="h-8 w-8 text-primary" />
                  <Badge className="text-lg px-4 py-1">
                    {getBillTypeLabel(activeSession.bill_type)}
                  </Badge>
                </div>
                <h1 className="text-5xl font-bold mb-4 leading-tight">
                  {activeSession.title}
                </h1>
                {activeSession.description && (
                  <p className="text-xl text-muted-foreground leading-relaxed">
                    {activeSession.description}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sub-Items Carousel */}
        {subItems.length > 0 && (
          <SubItemCarousel subItems={subItems} />
        )}

        {/* Timer Display */}
        {timer && (
          <Card className="border-2 shadow-xl">
            <CardContent className="p-8">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Clock className="h-6 w-6 text-primary" />
                    <h2 className="text-2xl font-semibold">{timer.title}</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    {timer.status === 'running' ? (
                      <Play className="h-5 w-5 text-green-500 fill-green-500" />
                    ) : (
                      <Pause className="h-5 w-5 text-yellow-500" />
                    )}
                    <Badge variant={timer.status === 'running' ? 'default' : 'secondary'}>
                      {timer.status}
                    </Badge>
                  </div>
                </div>

                <div className="text-center py-8">
                  <div className={`text-8xl font-mono font-bold ${
                    timer.remaining_seconds <= timer.duration_seconds * 0.1 ? 'text-destructive animate-pulse' : ''
                  }`}>
                    {formatTime(timer.remaining_seconds)}
                  </div>
                  <p className="text-lg text-muted-foreground mt-4">
                    of {formatTime(timer.duration_seconds)}
                  </p>
                </div>

                <Progress 
                  value={getProgressValue()} 
                  className={`h-4 ${getTimerColor()}`}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Poll Display */}
        {poll && (
          <Card className="border-2 shadow-xl">
            <CardContent className="p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <BarChart className="h-6 w-6 text-primary" />
                  <h2 className="text-2xl font-semibold">{poll.title}</h2>
                </div>
                <Badge 
                  variant={poll.is_active ? 'default' : 'secondary'}
                  className="text-lg px-4 py-2"
                >
                  {poll.is_active ? 'Voting Open' : 'Voting Closed'}
                </Badge>
              </div>

              {poll.is_active && !poll.show_results_publicly && (
                <p className="text-xl text-center mt-6 text-muted-foreground">
                  Please cast your votes now
                </p>
              )}

              {poll.show_results_publicly && poll.options && (
                <div className="space-y-4 mt-6">
                  <h3 className="text-xl font-semibold mb-4">Results:</h3>
                  {poll.options.map((option: any) => {
                    const voteCount = pollResults[option.id] || 0;
                    const totalVotes = Object.values(pollResults).reduce((sum, count) => sum + count, 0);
                    const percentage = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;

                    return (
                      <div key={option.id} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-lg font-medium">{option.text}</span>
                          <span className="text-lg font-semibold">
                            {voteCount} vote{voteCount !== 1 ? 's' : ''} ({percentage}%)
                          </span>
                        </div>
                        <Progress value={percentage} className="h-3" />
                      </div>
                    );
                  })}
                  <div className="text-center text-muted-foreground mt-4">
                    Total Votes: {Object.values(pollResults).reduce((sum, count) => sum + count, 0)}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default SessionDisplay;