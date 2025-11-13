import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Calendar, Clock, BarChart, Play, Pause } from "lucide-react";
import { BreakingNewsTicker } from "@/components/display/BreakingNewsTicker";
import { SubItemCarousel } from "@/components/display/SubItemCarousel";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useToast } from "@/components/ui/use-toast";

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
  const timerChannelRef = useRef<any>(null);

  // Auth and permissions for managing polls from stage view
  const { user, profile } = useAuth();
  const { hasRole } = useUserRole(user?.id);
  const { toast } = useToast();
  const canManagePolls = (profile?.user_type === 'organizer') || hasRole('admin_student');

  // Active sub-item polls to display (may be multiple)
  const [activeSubItemPolls, setActiveSubItemPolls] = useState<Array<{ poll: Poll; results: Record<string, number> }>>([]);

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

  const fetchPollWithResults = async (pollId: string): Promise<{ poll: Poll | null; results: Record<string, number> }> => {
    try {
      const { data: pollData, error: pollError } = await supabase
        .from('polls')
        .select('id, title, is_active, show_results_publicly, options')
        .eq('id', pollId)
        .single();

      if (pollError || !pollData) return { poll: null, results: {} };

      let results: Record<string, number> = {};
      if (pollData.show_results_publicly) {
        await fetchPollResults(pollData.id);
        // Re-run here to get latest state set by fetchPollResults is not accessible.
        // So fetch directly for this poll
        const { data: votes, error } = await supabase
          .from('poll_votes')
          .select('option_id')
          .eq('poll_id', pollData.id);
        if (!error && votes) {
          votes.forEach((v) => {
            results[v.option_id] = (results[v.option_id] || 0) + 1;
          });
        }
      }

      return { poll: pollData as Poll, results };
    } catch (e) {
      console.error('Error fetching poll with results:', e);
      return { poll: null, results: {} };
    }
  };
  useEffect(() => {
    document.title = "Young Indian Parliament - Session Display";
    fetchActiveSession();

    const subscription = supabase
      .channel('session_display_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'session_items' },
        () => {
          console.log('[SessionDisplay] session_items changed, refetching...');
          fetchActiveSession();
        }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'timer_sessions' },
        () => {
          console.log('[SessionDisplay] timer_sessions changed, refetching...');
          fetchActiveSession();
        }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'polls' },
        () => {
          console.log('[SessionDisplay] polls changed, refetching...');
          fetchActiveSession();
        }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'session_sub_items' as any },
        () => {
          console.log('[SessionDisplay] session_sub_items changed, refetching...');
          fetchActiveSession();
        }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'poll_votes' },
        () => {
          console.log('[SessionDisplay] poll_votes changed, refetching...');
          fetchActiveSession();
        }
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
        .order('updated_at', { ascending: false })
        .limit(1)
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

        // Fetch sub-items for this session
        const { data: subItemsData, error: subItemsError } = await supabase
          .from('session_sub_items' as any)
          .select('*')
          .eq('parent_session_id', (sessionData as any).id)
          .order('sort_order', { ascending: true });

        if (!subItemsError && subItemsData) {
          setSubItems(subItemsData as any);
        }

        // Check for polls to display
        // 1) If any sub-items are active and have polls, display ALL of them
        // 2) Otherwise, fall back to the parent session poll (if any)
        let subItemPollIds: string[] = [];
        if (subItemsData) {
          subItemPollIds = (subItemsData as any[])
            .filter((subItem: any) => subItem.is_active && subItem.poll_id)
            .map((subItem: any) => subItem.poll_id);
        }

        if (subItemPollIds.length > 0) {
          // Fetch all active sub-item polls and their results (if public)
          const fetched = await Promise.all(subItemPollIds.map((id) => fetchPollWithResults(id)));
          const valid = (fetched.filter((f) => !!f.poll) as Array<{ poll: Poll; results: Record<string, number> }>)
            .filter(({ poll }) => poll.is_active || poll.show_results_publicly);

          if (valid.length > 0) {
            setActiveSubItemPolls(valid);
            // Clear parent poll fallback
            setPoll(null);
            setPollResults({});
          } else if ((sessionData as any).poll_id) {
            // No visible sub-item polls - fallback to parent session poll
            const { data: pollData, error: pollError } = await supabase
              .from('polls')
              .select('id, title, is_active, show_results_publicly, options')
              .eq('id', (sessionData as any).poll_id)
              .single();

            if (!pollError && pollData && (pollData.is_active || pollData.show_results_publicly)) {
              setPoll(pollData as Poll);
              setActiveSubItemPolls([]);
              if (pollData.show_results_publicly) {
                await fetchPollResults(pollData.id);
              } else {
                setPollResults({});
              }
            } else {
              setPoll(null);
              setPollResults({});
              setActiveSubItemPolls([]);
            }
          } else {
            // No visible sub-item polls and no parent poll
            setActiveSubItemPolls([]);
            setPoll(null);
            setPollResults({});
          }
        } else if ((sessionData as any).poll_id) {
          // Parent-level poll fallback
          const { data: pollData, error: pollError } = await supabase
            .from('polls')
            .select('id, title, is_active, show_results_publicly, options')
            .eq('id', (sessionData as any).poll_id)
            .single();

          if (!pollError && pollData) {
            if (pollData.is_active || pollData.show_results_publicly) {
              setPoll(pollData as Poll);
              setActiveSubItemPolls([]);
              if (pollData.show_results_publicly) {
                await fetchPollResults(pollData.id);
              } else {
                setPollResults({});
              }
            } else {
              setPoll(null);
              setPollResults({});
              setActiveSubItemPolls([]);
            }
          } else {
            setPoll(null);
            setPollResults({});
            setActiveSubItemPolls([]);
          }
        } else {
          // No polls to display
          setPoll(null);
          setPollResults({});
          setActiveSubItemPolls([]);
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

  // Fetch a single timer row reliably
  const fetchTimerById = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('timer_sessions')
        .select('*')
        .eq('id', id)
        .single();

      if (!error && data) {
        setTimer(data as unknown as TimerSession);
      }
    } catch (e) {
      console.error('Error fetching timer by id:', e);
    }
  };

  // Subscribe to just the active timer row for precise updates
  useEffect(() => {
    if (timerChannelRef.current) {
      supabase.removeChannel(timerChannelRef.current);
      timerChannelRef.current = null;
    }

    if (!timer?.id) return;

    const ch = supabase
      .channel(`session_timer_${timer.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'timer_sessions', filter: `id=eq.${timer.id}` },
        () => {
          console.log('[SessionDisplay] timer row changed, refetching single timer...');
          fetchTimerById(timer.id!);
        }
      )
      .subscribe();

    timerChannelRef.current = ch;

    return () => {
      if (timerChannelRef.current) {
        supabase.removeChannel(timerChannelRef.current);
        timerChannelRef.current = null;
      }
    };
  }, [timer?.id]);

  // Fallback poll in case a realtime event is missed
  useEffect(() => {
    if (!timer?.id || timer.status !== 'running') return;
    const id = setInterval(() => fetchTimerById(timer.id!), 5000);
    return () => clearInterval(id);
  }, [timer?.id, timer?.status]);

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

  // Stage controls: open/close voting and show/hide results for a specific poll
  const togglePollActiveById = async (pollId: string, currentActive: boolean) => {
    if (!canManagePolls) {
      toast({ title: 'Not allowed', description: 'You do not have permission to manage polls.', variant: 'destructive' });
      return;
    }
    try {
      const { error } = await supabase
        .from('polls')
        .update({ is_active: !currentActive })
        .eq('id', pollId);
      if (error) throw error;
      // Update local state and hide card if both flags are false
      setPoll((prev) => {
        if (prev && prev.id === pollId) {
          const updated = { ...prev, is_active: !currentActive };
          return (updated.is_active || updated.show_results_publicly) ? updated : null;
        }
        return prev;
      });
      setActiveSubItemPolls((prev) => {
        const updated = prev.map((p) => p.poll.id === pollId ? { ...p, poll: { ...p.poll, is_active: !currentActive } } : p);
        return updated.filter((p) => p.poll.is_active || p.poll.show_results_publicly);
      });
      toast({ title: currentActive ? 'Voting closed' : 'Voting opened' });
    } catch (err) {
      console.error('Error toggling poll active:', err);
      toast({ title: 'Failed to update poll', description: 'Please try again.', variant: 'destructive' });
    }
  };

  const toggleShowResultsById = async (pollId: string, currentValue: boolean) => {
    if (!canManagePolls) {
      toast({ title: 'Not allowed', description: 'You do not have permission to manage poll visibility.', variant: 'destructive' });
      return;
    }
    const next = !currentValue;
    try {
      const { error } = await supabase
        .from('polls')
        .update({ show_results_publicly: next })
        .eq('id', pollId);
      if (error) throw error;
      // Update local state and hide card if both flags are false
      setPoll((prev) => {
        if (prev && prev.id === pollId) {
          const updated = { ...prev, show_results_publicly: next };
          return (updated.is_active || updated.show_results_publicly) ? updated : null;
        }
        return prev;
      });
      setActiveSubItemPolls((prev) => {
        // Update visibility flag
        let updated = prev.map((p) => p.poll.id === pollId ? { ...p, poll: { ...p.poll, show_results_publicly: next } } : p);
        if (next) {
          // Fetch fresh results for this poll
          // Note: We do not await here because we still filter below. We'll compute results separately.
        }
        // Filter out polls that are neither active nor showing results
        updated = updated.filter((p) => p.poll.is_active || p.poll.show_results_publicly);
        return updated;
      });
      if (next) {
        // Fetch fresh results for this poll
        const { data: votes, error: voteErr } = await supabase
          .from('poll_votes')
          .select('option_id')
          .eq('poll_id', pollId);
        if (!voteErr && votes) {
          const results: Record<string, number> = {};
          votes.forEach((v) => { results[v.option_id] = (results[v.option_id] || 0) + 1; });
          setPollResults((prev) => (poll && poll.id === pollId ? results : prev));
          setActiveSubItemPolls((prev) => prev.map((p) => p.poll.id === pollId ? { ...p, results } : p));
        }
      } else {
        setPollResults((prev) => (poll && poll.id === pollId ? {} : prev));
        setActiveSubItemPolls((prev) => prev.map((p) => p.poll.id === pollId ? { ...p, results: {} } : p));
      }
      toast({ title: next ? 'Results shown' : 'Results hidden' });
    } catch (err) {
      console.error('Error toggling results visibility:', err);
      toast({ title: 'Failed to update visibility', description: 'Please try again.', variant: 'destructive' });
    }
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
        {/* Session Header with Timer */}
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

            {/* Timer Display */}
            {timer && (
              <div className="mt-8 pt-8 border-t space-y-6">
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
            )}
          </CardContent>
        </Card>

        {/* Poll Display - Sub-item polls (one card per active sub-item) */}
        {activeSubItemPolls.length > 0 && (
          <div className="space-y-6">
            {activeSubItemPolls.map(({ poll: p, results }) => {
              const totalVotes = Object.values(results).reduce((sum, c) => sum + c, 0);
              return (
                <Card key={p.id} className="border-2 shadow-xl">
                  <CardContent className="p-8">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <BarChart className="h-6 w-6 text-primary" />
                        <h2 className="text-2xl font-semibold">{p.title}</h2>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge 
                          variant={p.is_active ? 'default' : 'secondary'}
                          className="text-lg px-4 py-2"
                        >
                          {p.is_active ? 'Voting Open' : 'Voting Closed'}
                        </Badge>
                        {canManagePolls && (
                          <div className="flex items-center gap-3">
                            <Button size="sm" onClick={() => togglePollActiveById(p.id, p.is_active)} disabled={!canManagePolls} title={canManagePolls ? '' : 'Sign in as Organizer/Admin to control polls'}>
                              {p.is_active ? 'Close Voting' : 'Open Voting'}
                            </Button>
                            <div className="flex items-center gap-2">
                              <Switch
                                id={`show-results-switch-${p.id}`}
                                checked={p.show_results_publicly}
                                onCheckedChange={() => toggleShowResultsById(p.id, p.show_results_publicly)}
                                disabled={!canManagePolls}
                              />
                              <label htmlFor={`show-results-switch-${p.id}`} className="text-sm">Show Results</label>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {p.is_active && !p.show_results_publicly && (
                      <p className="text-xl text-center mt-6 text-muted-foreground">
                        Please cast your votes now
                      </p>
                    )}

                    {p.show_results_publicly && p.options && (
                      <div className="space-y-4 mt-6">
                        <h3 className="text-xl font-semibold mb-4">Results:</h3>
                        {p.options.map((option: any) => {
                          const voteCount = results[option.id] || 0;
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
                          Total Votes: {totalVotes}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Poll Display - Parent-level fallback */}
        {activeSubItemPolls.length === 0 && poll && (
          <Card className="border-2 shadow-xl">
            <CardContent className="p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <BarChart className="h-6 w-6 text-primary" />
                  <h2 className="text-2xl font-semibold">{poll.title}</h2>
                </div>
                <div className="flex items-center gap-3">
                  <Badge 
                    variant={poll.is_active ? 'default' : 'secondary'}
                    className="text-lg px-4 py-2"
                  >
                    {poll.is_active ? 'Voting Open' : 'Voting Closed'}
                  </Badge>
                  {canManagePolls && (
                    <div className="flex items-center gap-3">
                      <Button size="sm" onClick={() => togglePollActiveById(poll.id, poll.is_active)}>
                        {poll.is_active ? 'Close Voting' : 'Open Voting'}
                      </Button>
                      <div className="flex items-center gap-2">
                        <Switch
                          id={`show-results-switch-${poll.id}`}
                          checked={poll.show_results_publicly}
                          onCheckedChange={() => toggleShowResultsById(poll.id, poll.show_results_publicly)}
                        />
                        <label htmlFor={`show-results-switch-${poll.id}`} className="text-sm">Show Results</label>
                      </div>
                    </div>
                  )}
                </div>
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

        {/* Sub-Items Carousel */}
        {subItems.length > 0 && (
          <SubItemCarousel subItems={subItems} />
        )}
      </div>
    </div>
  );
};

export default SessionDisplay;