import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Clock, Pause, Play, Square } from "lucide-react";
import { BreakingNewsTicker } from "@/components/display/BreakingNewsTicker";

interface TimerSession {
  id: string;
  title: string;
  duration_seconds: number;
  remaining_seconds: number;
  status: 'stopped' | 'running' | 'paused' | 'completed';
}

const TimerDisplay = () => {
  const [timer, setTimer] = useState<TimerSession | null>(null);
  const [loading, setLoading] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previousRemainingRef = useRef<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    document.title = "Young Indian Parliament - Timer Display";
    fetchActiveTimer();

    // Initialize audio
    audioRef.current = new Audio();

    // Set up real-time subscription
    const subscription = supabase
      .channel('timer_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'timer_sessions' },
        () => {
          fetchActiveTimer();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Local countdown for smooth display - syncs with database updates
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!timer || timer.status !== 'running') return;

    // Update display every second for smooth countdown
    intervalRef.current = setInterval(() => {
      setTimer(prev => {
        if (!prev || prev.status !== 'running') return prev;
        const newRemaining = Math.max(0, prev.remaining_seconds - 1);
        return { ...prev, remaining_seconds: newRemaining };
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [timer?.id, timer?.status]);

  // Bell sound effect when timer reaches 0
  useEffect(() => {
    if (timer && previousRemainingRef.current !== null) {
      if (previousRemainingRef.current > 0 && timer.remaining_seconds === 0) {
        // Timer just reached 0, play bell sound
        const createBeepSound = () => {
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          
          oscillator.frequency.value = 800;
          oscillator.type = 'sine';
          
          gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 2);
          
          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + 2);
        };
        
        createBeepSound();
      }
    }
    previousRemainingRef.current = timer?.remaining_seconds || null;
  }, [timer?.remaining_seconds]);

  const fetchActiveTimer = async () => {
    try {
      // Prefer the currently running active timer
      const { data: running, error: runningError } = await supabase
        .from('timer_sessions')
        .select('*')
        .eq('is_active', true)
        .eq('status', 'running')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!runningError && running) {
        setTimer(running as TimerSession);
        return;
      }

      // Fallback: latest active timer (paused/stopped/completed)
      const { data: activeAny, error: activeError } = await supabase
        .from('timer_sessions')
        .select('*')
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (activeError) throw activeError;
      setTimer(activeAny as TimerSession | null);
    } catch (error) {
      console.error('Error fetching timer:', error);
      setTimer(null);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getProgressValue = () => {
    if (!timer) return 0;
    return ((timer.duration_seconds - timer.remaining_seconds) / timer.duration_seconds) * 100;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center text-slate-800">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-xl">Loading Timer Display...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-8">
      <BreakingNewsTicker />
      
      <div className="max-w-6xl mx-auto mt-12">
        {/* Timer Header Card */}
        <Card className="border-2 border-primary shadow-xl">
          <CardContent className="p-8">
            {timer ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Clock className="h-8 w-8 text-primary" />
                    <h1 className="text-4xl font-bold">{timer.title}</h1>
                  </div>
                  <div className="flex items-center gap-2">
                    {timer.status === 'running' ? (
                      <Play className="h-6 w-6 text-green-500 fill-green-500" />
                    ) : timer.status === 'paused' ? (
                      <Pause className="h-6 w-6 text-yellow-500" />
                    ) : (
                      <Square className="h-6 w-6 text-muted-foreground" />
                    )}
                    <Badge 
                      variant={timer.status === 'running' ? 'default' : 'secondary'}
                      className="text-lg px-4 py-2"
                    >
                      {timer.status}
                    </Badge>
                  </div>
                </div>

                <div className="text-center py-12">
                  <div className={`text-9xl font-mono font-bold transition-colors duration-300 ${
                    timer.remaining_seconds <= timer.duration_seconds * 0.1 ? 'text-destructive animate-pulse' : ''
                  }`}>
                    {formatTime(timer.remaining_seconds)}
                  </div>
                  <p className="text-2xl text-muted-foreground mt-6">
                    of {formatTime(timer.duration_seconds)}
                  </p>
                </div>

                <Progress 
                  value={getProgressValue()} 
                  className={`h-6 transition-all duration-300 ${
                    timer.remaining_seconds <= timer.duration_seconds * 0.1 ? 'bg-destructive' :
                    timer.remaining_seconds <= timer.duration_seconds * 0.25 ? 'bg-orange-500' :
                    'bg-primary'
                  }`}
                />

                {timer.remaining_seconds <= timer.duration_seconds * 0.1 && timer.status === 'running' && (
                  <div className="text-center">
                    <p className="text-2xl font-semibold text-destructive animate-pulse">
                      Time is running out!
                    </p>
                  </div>
                )}

                {timer.status === 'completed' && (
                  <div className="text-center mt-6 p-6 bg-green-50 dark:bg-green-950 rounded-lg">
                    <p className="text-3xl font-bold text-green-700 dark:text-green-300">
                      🎉 TIME'S UP! 🎉
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12 space-y-6">
                <Clock className="h-24 w-24 mx-auto text-primary/20" />
                <h2 className="text-4xl font-bold">No Active Timer</h2>
                <p className="text-xl text-muted-foreground">
                  Waiting for organizer to activate a timer
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TimerDisplay;