import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Play, Pause, Square, RotateCcw, Clock, ExternalLink, Volume2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface TimerSession {
  id: string;
  title: string;
  duration_seconds: number;
  remaining_seconds: number;
  status: 'stopped' | 'running' | 'paused' | 'completed';
  completed_at?: string;
  updated_at: string;
}

export const TimerControl = () => {
  const { user } = useAuth();
  const [currentTimer, setCurrentTimer] = useState<TimerSession | null>(null);
  const [title, setTitle] = useState("Parliament Session");
  const [duration, setDuration] = useState(300); // 5 minutes default
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    fetchActiveTimer();
    // Create audio element for alarm
    audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhFjiX2+m9m1MfO0sj');
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (currentTimer?.status === 'running') {
      startInterval();
    } else {
      stopInterval();
    }
  }, [currentTimer?.status]);

  const fetchActiveTimer = async () => {
    try {
      const { data, error } = await supabase
        .from('timer_sessions')
        .select('*')
        .in('status', ['running', 'paused'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        setCurrentTimer(data as TimerSession);
        setTitle(data.title);
        setDuration(data.duration_seconds);
      }
    } catch (error) {
      console.error('Error fetching timer:', error);
    }
  };

  const startInterval = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    intervalRef.current = setInterval(() => {
      setCurrentTimer(prev => {
        if (!prev || prev.status !== 'running') return prev;

        const newRemaining = Math.max(0, prev.remaining_seconds - 1);
        
        if (newRemaining === 0) {
          // Timer completed
          playAlarm();
          updateTimerInDB(prev.id, {
            remaining_seconds: 0,
            status: 'completed',
            completed_at: new Date().toISOString()
          });
          return { ...prev, remaining_seconds: 0, status: 'completed' as const };
        }

        // Update in database every 5 seconds
        if (newRemaining % 5 === 0) {
          updateTimerInDB(prev.id, { remaining_seconds: newRemaining });
        }

        return { ...prev, remaining_seconds: newRemaining };
      });
    }, 1000);
  };

  const stopInterval = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const playAlarm = () => {
    if (audioRef.current) {
      audioRef.current.play().catch(console.error);
    }
  };

  const updateTimerInDB = async (timerId: string, updates: Partial<TimerSession>) => {
    try {
      await supabase
        .from('timer_sessions')
        .update(updates)
        .eq('id', timerId);
    } catch (error) {
      console.error('Error updating timer:', error);
    }
  };

  const createTimer = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('timer_sessions')
        .insert({
          title,
          duration_seconds: duration,
          remaining_seconds: duration,
          created_by: user.id
        })
        .select()
        .single();

      if (error) throw error;

      setCurrentTimer(data as TimerSession);
      toast({
        title: "Timer Created",
        description: `Timer "${title}" set for ${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}`
      });
    } catch (error) {
      console.error('Error creating timer:', error);
      toast({
        title: "Error",
        description: "Failed to create timer",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const startTimer = async () => {
    if (!currentTimer || !user) return;

    try {
      const updates = {
        status: 'running' as const,
        started_at: new Date().toISOString()
      };

      await updateTimerInDB(currentTimer.id, updates);
      setCurrentTimer(prev => prev ? { ...prev, ...updates } : null);

      await supabase.rpc('log_audit_event', {
        p_user_id: user.id,
        p_action: 'timer_started',
        p_resource_type: 'timer_session',
        p_resource_id: currentTimer.id
      });

      toast({
        title: "Timer Started",
        description: "Parliament session timer is now running"
      });
    } catch (error) {
      console.error('Error starting timer:', error);
    }
  };

  const pauseTimer = async () => {
    if (!currentTimer || !user) return;

    try {
      await updateTimerInDB(currentTimer.id, { status: 'paused' });
      setCurrentTimer(prev => prev ? { ...prev, status: 'paused' } : null);

      await supabase.rpc('log_audit_event', {
        p_user_id: user.id,
        p_action: 'timer_paused',
        p_resource_type: 'timer_session',
        p_resource_id: currentTimer.id
      });

      toast({
        title: "Timer Paused",
        description: "Parliament session timer has been paused"
      });
    } catch (error) {
      console.error('Error pausing timer:', error);
    }
  };

  const resetTimer = async () => {
    if (!currentTimer || !user) return;

    try {
      const updates = {
        status: 'stopped' as const,
        remaining_seconds: currentTimer.duration_seconds
      };

      await updateTimerInDB(currentTimer.id, updates);
      setCurrentTimer(prev => prev ? { ...prev, ...updates } : null);

      await supabase.rpc('log_audit_event', {
        p_user_id: user.id,
        p_action: 'timer_reset',
        p_resource_type: 'timer_session',
        p_resource_id: currentTimer.id
      });

      toast({
        title: "Timer Reset",
        description: "Timer has been reset to original duration"
      });
    } catch (error) {
      console.error('Error resetting timer:', error);
    }
  };

  const openStageView = () => {
    window.open('/display/timer', '_blank');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimerColor = () => {
    if (!currentTimer) return 'text-gray-500';
    
    const progress = currentTimer.remaining_seconds / currentTimer.duration_seconds;
    if (progress > 0.6) return 'text-green-600';
    if (progress > 0.3) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getProgressValue = () => {
    if (!currentTimer) return 0;
    return (currentTimer.remaining_seconds / currentTimer.duration_seconds) * 100;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Clock className="w-5 h-5" />
          <span>Session Timer</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Timer Setup */}
        {!currentTimer && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="timer-title">Session Title</Label>
              <Input
                id="timer-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Parliament Session"
              />
            </div>
            <div>
              <Label htmlFor="timer-duration">Duration (seconds)</Label>
              <Input
                id="timer-duration"
                type="number"
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value) || 300)}
                min={60}
                max={3600}
              />
              <p className="text-sm text-muted-foreground mt-1">
                Default: 300 seconds (5 minutes)
              </p>
            </div>
            <Button onClick={createTimer} disabled={loading} className="w-full">
              Create Timer
            </Button>
          </div>
        )}

        {/* Active Timer */}
        {currentTimer && (
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">{currentTimer.title}</h3>
              <div className={`text-4xl font-mono font-bold ${getTimerColor()}`}>
                {formatTime(currentTimer.remaining_seconds)}
              </div>
              <Progress value={getProgressValue()} className="mt-4" />
              <div className="flex items-center justify-between text-sm text-muted-foreground mt-2">
                <span>0:00</span>
                <Badge variant={
                  currentTimer.status === 'running' ? 'default' :
                  currentTimer.status === 'paused' ? 'secondary' :
                  currentTimer.status === 'completed' ? 'destructive' : 'outline'
                }>
                  {currentTimer.status.toUpperCase()}
                </Badge>
                <span>{formatTime(currentTimer.duration_seconds)}</span>
              </div>
            </div>

            {/* Timer Controls */}
            <div className="flex space-x-2">
              {currentTimer.status === 'stopped' || currentTimer.status === 'paused' ? (
                <Button onClick={startTimer} className="flex-1">
                  <Play className="w-4 h-4 mr-2" />
                  {currentTimer.status === 'paused' ? 'Resume' : 'Start'}
                </Button>
              ) : (
                <Button onClick={pauseTimer} variant="outline" className="flex-1">
                  <Pause className="w-4 h-4 mr-2" />
                  Pause
                </Button>
              )}
              
              <Button onClick={resetTimer} variant="outline" className="flex-1">
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset
              </Button>
            </div>

            {/* Stage View Button */}
            <Button onClick={openStageView} variant="outline" className="w-full">
              <ExternalLink className="w-4 h-4 mr-2" />
              Open Stage View
            </Button>

            {currentTimer.status === 'completed' && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center space-x-2">
                  <Volume2 className="w-5 h-5 text-red-600" />
                  <div>
                    <h4 className="font-medium text-red-900">Time's Up!</h4>
                    <p className="text-sm text-red-700">The session timer has completed.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};