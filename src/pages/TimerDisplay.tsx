import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Clock, Pause, Play, Square } from "lucide-react";

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

  useEffect(() => {
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
    };
  }, []);

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
      const { data, error } = await supabase
        .from('timer_sessions')
        .select('*')
        .in('status', ['running', 'paused'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      setTimer(data as TimerSession);
    } catch (error) {
      console.error('Error fetching timer:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getBackgroundColor = () => {
    if (!timer) return 'bg-gray-500';
    
    const progress = timer.remaining_seconds / timer.duration_seconds;
    if (progress > 0.6) return 'bg-gradient-to-br from-green-400 to-green-600';
    if (progress > 0.3) return 'bg-gradient-to-br from-yellow-400 to-orange-500';
    return 'bg-gradient-to-br from-red-500 to-red-700';
  };

  const getTextColor = () => {
    if (!timer) return 'text-white';
    
    const progress = timer.remaining_seconds / timer.duration_seconds;
    if (progress > 0.6) return 'text-white';
    if (progress > 0.3) return 'text-white';
    return 'text-white';
  };

  const getProgressValue = () => {
    if (!timer) return 0;
    return (timer.remaining_seconds / timer.duration_seconds) * 100;
  };

  const getStatusIcon = () => {
    if (!timer) return <Clock className="w-16 h-16" />;
    
    switch (timer.status) {
      case 'running':
        return <Play className="w-16 h-16" />;
      case 'paused':
        return <Pause className="w-16 h-16" />;
      case 'completed':
        return <Square className="w-16 h-16" />;
      default:
        return <Clock className="w-16 h-16" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-xl">Loading Timer Display...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex items-center justify-center transition-all duration-1000 ${getBackgroundColor()}`}>
      <div className="max-w-4xl w-full mx-auto p-8">
        <Card className="bg-black/20 backdrop-blur-md border-white/20">
          <CardContent className="p-12 text-center">
            {timer ? (
              <div className={`space-y-8 ${getTextColor()}`}>
                {/* Timer Title */}
                <h1 className="text-4xl md:text-6xl font-bold mb-8">
                  {timer.title}
                </h1>

                {/* Status Icon */}
                <div className="flex justify-center mb-8">
                  {getStatusIcon()}
                </div>

                {/* Main Timer Display */}
                <div className="text-8xl md:text-9xl font-mono font-bold tracking-wider mb-8">
                  {formatTime(timer.remaining_seconds)}
                </div>

                {/* Progress Bar */}
                <div className="max-w-2xl mx-auto mb-8">
                  <Progress 
                    value={getProgressValue()} 
                    className="h-4 bg-white/20"
                  />
                  <div className="flex justify-between text-xl mt-4">
                    <span>0:00</span>
                    <span>{formatTime(timer.duration_seconds)}</span>
                  </div>
                </div>

                {/* Status Badge */}
                <div className="flex justify-center">
                  <Badge 
                    variant="outline" 
                    className="text-2xl px-6 py-3 border-white/40 text-white bg-white/10"
                  >
                    {timer.status.toUpperCase()}
                  </Badge>
                </div>

                {/* Completion Message */}
                {timer.status === 'completed' && (
                  <div className="mt-8 p-6 bg-white/20 rounded-lg">
                    <h2 className="text-3xl font-bold mb-2">TIME'S UP!</h2>
                    <p className="text-xl">Session has completed</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-white space-y-8">
                <Clock className="w-24 h-24 mx-auto opacity-50" />
                <h1 className="text-4xl md:text-6xl font-bold">
                  No Active Timer
                </h1>
                <p className="text-xl opacity-75">
                  Waiting for organizer to start a timer session
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