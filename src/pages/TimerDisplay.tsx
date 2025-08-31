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
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

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
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Display component should not run its own countdown - rely on TimerControl component for time management
  // This prevents conflicts between multiple timer instances

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
        .in('status', ['running', 'paused', 'stopped', 'completed'])
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;
      
      if (data && data.length > 0) {
        setTimer(data[0] as TimerSession);
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
      <div className="max-w-6xl w-full mx-auto p-8">
        <Card className="bg-white/10 backdrop-blur-lg border-white/20 shadow-2xl rounded-3xl overflow-hidden">
          <CardContent className="p-12 text-center">
            {timer ? (
              <div className={`space-y-8 ${getTextColor()}`}>
                {/* Timer Title */}
                <h1 className="text-4xl md:text-6xl font-bold mb-8 animate-fade-in">
                  {timer.title}
                </h1>

                {/* Tiger Timekeeper Character */}
                <div className="flex justify-center mb-8">
                  <div className="relative animate-scale-in">
                    <img 
                      src="/lovable-uploads/9850b13c-f0c3-4079-ade9-bc1be0b69ee0.png"
                      alt="Tiger Timekeeper"
                      className="w-32 h-32 md:w-48 md:h-48 animate-pulse hover:scale-110 transition-transform duration-500 filter drop-shadow-lg"
                    />
                    {timer.status === 'running' && (
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-400 rounded-full animate-ping"></div>
                    )}
                    {timer.status === 'paused' && (
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-yellow-400 rounded-full animate-pulse"></div>
                    )}
                    {timer.status === 'completed' && (
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-400 rounded-full animate-bounce"></div>
                    )}
                  </div>
                </div>

                {/* Main Timer Display with soft glow */}
                <div className="relative">
                  <div className="text-8xl md:text-9xl font-mono font-bold tracking-wider mb-8 animate-fade-in relative">
                    <span className="relative z-10">{formatTime(timer.remaining_seconds)}</span>
                    <div className="absolute inset-0 text-8xl md:text-9xl font-mono font-bold tracking-wider text-white/20 blur-lg animate-pulse">
                      {formatTime(timer.remaining_seconds)}
                    </div>
                  </div>
                </div>

                {/* Progress Bar with soft styling */}
                <div className="max-w-2xl mx-auto mb-8">
                  <div className="bg-white/20 rounded-full p-2 shadow-inner">
                    <Progress 
                      value={getProgressValue()} 
                      className="h-6 bg-transparent"
                    />
                  </div>
                  <div className="flex justify-between text-xl mt-4 font-semibold">
                    <span className="bg-white/20 px-4 py-2 rounded-full">0:00</span>
                    <span className="bg-white/20 px-4 py-2 rounded-full">{formatTime(timer.duration_seconds)}</span>
                  </div>
                </div>

                {/* Status Badge with animations */}
                <div className="flex justify-center">
                  <Badge 
                    variant="outline" 
                    className={`text-2xl px-8 py-4 border-white/40 text-white bg-white/20 rounded-2xl backdrop-blur-sm shadow-lg transition-all duration-300 ${
                      timer.status === 'running' ? 'animate-pulse' : 
                      timer.status === 'completed' ? 'animate-bounce' : ''
                    }`}
                  >
                    {timer.status === 'running' && '⏰ '}{timer.status === 'paused' && '⏸️ '}{timer.status === 'completed' && '🔔 '}
                    {timer.status.toUpperCase()}
                  </Badge>
                </div>

                {/* Completion Message with celebration */}
                {timer.status === 'completed' && (
                  <div className="mt-8 p-8 bg-gradient-to-r from-purple-400/30 to-pink-400/30 rounded-3xl backdrop-blur-sm border border-white/30 animate-scale-in">
                    <div className="text-6xl mb-4 animate-bounce">🎉</div>
                    <h2 className="text-4xl font-bold mb-4 animate-fade-in">TIME'S UP!</h2>
                    <p className="text-2xl animate-fade-in">Session has completed successfully!</p>
                    <div className="mt-4 text-4xl animate-pulse">⏰ 🎊 ⏰</div>
                  </div>
                )}

                {/* Motivational messages based on time remaining */}
                {timer.status === 'running' && (
                  <div className="mt-8 text-lg font-medium animate-fade-in">
                    {timer.remaining_seconds > timer.duration_seconds * 0.8 && (
                      <p className="text-green-200">🌟 Session is going strong! Keep up the great work!</p>
                    )}
                    {timer.remaining_seconds <= timer.duration_seconds * 0.8 && timer.remaining_seconds > timer.duration_seconds * 0.3 && (
                      <p className="text-yellow-200">⚡ Halfway there! Maintain the momentum!</p>
                    )}
                    {timer.remaining_seconds <= timer.duration_seconds * 0.3 && timer.remaining_seconds > 0 && (
                      <p className="text-orange-200">🚀 Final stretch! Time to wrap up!</p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-white space-y-8">
                <div className="animate-scale-in">
                  <img 
                    src="/lovable-uploads/9850b13c-f0c3-4079-ade9-bc1be0b69ee0.png"
                    alt="Tiger Timekeeper Waiting"
                    className="w-48 h-48 mx-auto opacity-75 animate-pulse filter drop-shadow-lg"
                  />
                </div>
                <h1 className="text-4xl md:text-6xl font-bold animate-fade-in">
                  🐅 Timekeeper Ready!
                </h1>
                <p className="text-xl opacity-75 animate-fade-in">
                  Waiting for organizer to start a timer session...
                </p>
                <div className="text-2xl animate-pulse">⏰ 🎯 ⏰</div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TimerDisplay;