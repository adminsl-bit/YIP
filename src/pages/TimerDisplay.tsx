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
  updated_at: string;
  started_at: string | null;
}

const TimerDisplay = () => {
  const [timer, setTimer] = useState<TimerSession | null>(null);
  const [loading, setLoading] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previousRemainingRef = useRef<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const baselineRef = useRef<{ remaining: number; clientNow: number } | null>(null);
  const clockOffsetRef = useRef<number>(0);


useEffect(() => {
  document.title = "Young Indian Parliament - Timer Display";
  
  // Calibrate clock offset with server
  const calibrateClock = async () => {
    const clientBefore = Date.now();
    const { data } = await supabase.rpc('get_server_time');
    const clientAfter = Date.now();
    if (data) {
      const serverTime = Date.parse(data);
      const clientMid = (clientBefore + clientAfter) / 2;
      clockOffsetRef.current = serverTime - clientMid;
      console.log('[TimerDisplay] Clock offset calibrated:', clockOffsetRef.current, 'ms');
    }
  };
  
  calibrateClock();
  // Periodic re-calibration every 30s
  recalibRef.current = window.setInterval(calibrateClock, 30000);
  fetchActiveTimer();

  // Initialize audio
  audioRef.current = new Audio();

  // Set up real-time subscription
  const subscription = supabase
    .channel('timer_changes')
    .on('postgres_changes', 
      { event: 'UPDATE', schema: 'public', table: 'timer_sessions' },
      () => {
        fetchActiveTimer();
      }
    )
    .subscribe();

  return () => {
    subscription.unsubscribe();
    if (recalibRef.current) window.clearInterval(recalibRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  };
}, []);

// Local high-frequency countdown using requestAnimationFrame derived from started_at
useEffect(() => {
  if (rafRef.current) {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }

  if (!timer || timer.status !== 'running' || !(timer as any).started_at) return;

  const render = () => {
    const base = baselineRef.current;
    if (!base) return;
    const nowAdj = Date.now() + clockOffsetRef.current;
    const elapsed = Math.floor((nowAdj - base.startedAtMs) / 1000);
    const computed = Math.max(0, base.remainingAtStart - elapsed);
    setTimer(prev => (prev ? { ...prev, remaining_seconds: computed } : prev));
    rafRef.current = requestAnimationFrame(render);
  };

  render();

  return () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  };
}, [timer?.id, timer?.status, (timer as any)?.started_at]);

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
  const nowAdj = Date.now() + clockOffsetRef.current;
  const startedAt: string | null = (running as any).started_at ?? null;
  let adjustedRemaining = (running as any).remaining_seconds;
  if (startedAt) {
    const startedAtMs = Date.parse(startedAt);
    adjustedRemaining = Math.max(0, (running as any).remaining_seconds - Math.floor((nowAdj - startedAtMs) / 1000));
    baselineRef.current = { remainingAtStart: (running as any).remaining_seconds, startedAtMs };
  } else {
    const serverUpdatedAt = Date.parse((running as any).updated_at);
    adjustedRemaining = Math.max(0, (running as any).remaining_seconds - Math.floor((nowAdj - serverUpdatedAt) / 1000));
    baselineRef.current = { remainingAtStart: (running as any).remaining_seconds, startedAtMs: nowAdj };
  }
  setTimer(prev => prev 
    ? ({ ...(running as any), remaining_seconds: Math.min(prev.remaining_seconds, adjustedRemaining) } as TimerSession)
    : ({ ...(running as any), remaining_seconds: adjustedRemaining } as TimerSession)
  );
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
if (activeAny) {
  const nowAdj = Date.now() + clockOffsetRef.current;
  const startedAt: string | null = (activeAny as any).started_at ?? null;
  let adjustedRemaining = (activeAny as any).remaining_seconds;
  if ((activeAny as any).status === 'running' && startedAt) {
    const startedAtMs = Date.parse(startedAt);
    adjustedRemaining = Math.max(0, (activeAny as any).remaining_seconds - Math.floor((nowAdj - startedAtMs) / 1000));
    baselineRef.current = { remainingAtStart: (activeAny as any).remaining_seconds, startedAtMs };
  } else {
    baselineRef.current = null;
  }
  setTimer(prev => prev 
    ? ({ ...(activeAny as any), remaining_seconds: Math.min(prev.remaining_seconds, adjustedRemaining) } as TimerSession)
    : ({ ...(activeAny as any), remaining_seconds: adjustedRemaining } as TimerSession)
  );
} else {
  setTimer(null);
}
      } else {
        setTimer(null);
      }
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
      <div className="min-h-screen flex items-center justify-center bg-white px-4">
        <div className="text-center text-slate-800">
          <div className="animate-spin rounded-full h-12 w-12 sm:h-16 sm:w-16 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-base sm:text-xl">Loading Timer Display...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-4 sm:p-6 lg:p-8">
      <BreakingNewsTicker />
      
      <div className="max-w-6xl mx-auto mt-6 sm:mt-8 lg:mt-12">
        {/* Timer Header Card */}
        <Card className="border-2 border-primary shadow-xl">
          <CardContent className="p-4 sm:p-6 lg:p-8">
            {timer ? (
              <div className="space-y-4 sm:space-y-6">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <Clock className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
                    <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-center sm:text-left">{timer.title}</h1>
                  </div>
                  <div className="flex items-center gap-2">
                    {timer.status === 'running' ? (
                      <Play className="h-5 w-5 sm:h-6 sm:w-6 text-green-500 fill-green-500" />
                    ) : timer.status === 'paused' ? (
                      <Pause className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-500" />
                    ) : (
                      <Square className="h-5 w-5 sm:h-6 sm:w-6 text-muted-foreground" />
                    )}
                    <Badge 
                      variant={timer.status === 'running' ? 'default' : 'secondary'}
                      className="text-sm sm:text-base lg:text-lg px-3 sm:px-4 py-1 sm:py-2"
                    >
                      {timer.status}
                    </Badge>
                  </div>
                </div>

                <div className="text-center py-6 sm:py-8 lg:py-12">
                  <div className={`text-5xl sm:text-7xl lg:text-9xl font-mono font-bold transition-colors duration-300 ${
                    timer.remaining_seconds <= timer.duration_seconds * 0.1 ? 'text-destructive animate-pulse' : ''
                  }`}>
                    {formatTime(timer.remaining_seconds)}
                  </div>
                  <p className="text-lg sm:text-xl lg:text-2xl text-muted-foreground mt-3 sm:mt-4 lg:mt-6">
                    of {formatTime(timer.duration_seconds)}
                  </p>
                </div>

                <Progress 
                  value={getProgressValue()} 
                  className={`h-4 sm:h-5 lg:h-6 transition-all duration-300 ${
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