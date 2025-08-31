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
    // Always use white background instead of colored gradients
    return 'bg-white';
  };

  const getTextColor = () => {
    // Use dark text colors for white background
    return 'text-slate-800';
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
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center text-slate-800">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-xl">Loading Timer Display...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex items-center justify-center transition-all duration-1000 ${getBackgroundColor()}`}>
      <div className="max-w-6xl w-full mx-auto p-8">
        <Card className="bg-white shadow-2xl rounded-3xl overflow-hidden border border-slate-200">
          <CardContent className="p-12 text-center">
            {timer ? (
              <div className={`space-y-8 ${getTextColor()}`}>
                {/* Timer Title */}
                <h1 className="text-4xl md:text-6xl font-bold mb-8 animate-fade-in text-slate-800">
                  {timer.title}
                </h1>

                {/* Tiger Timekeeper Character - Fixed positioning and removed flickering */}
                <div className="flex justify-center mb-8">
                  <div className="relative">
                    <div className="w-48 h-48 md:w-64 md:h-64 flex items-center justify-center">
                      <img 
                        src="/lovable-uploads/9850b13c-f0c3-4079-ade9-bc1be0b69ee0.png"
                        alt="Tiger Timekeeper"
                        className="w-full h-full object-contain transition-transform duration-300 hover:scale-105 filter drop-shadow-lg"
                        style={{ imageRendering: 'crisp-edges' }}
                      />
                    </div>
                    {timer.status === 'running' && (
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full animate-ping"></div>
                    )}
                    {timer.status === 'paused' && (
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-yellow-500 rounded-full animate-pulse"></div>
                    )}
                    {timer.status === 'completed' && (
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full animate-bounce"></div>
                    )}
                  </div>
                </div>

                {/* Main Timer Display */}
                <div className="relative">
                  <div className="text-8xl md:text-9xl font-mono font-bold tracking-wider mb-8 text-slate-800">
                    {formatTime(timer.remaining_seconds)}
                  </div>
                </div>

                {/* Progress Bar with better styling for white background */}
                <div className="max-w-2xl mx-auto mb-8">
                  <div className="bg-slate-100 rounded-full p-2 shadow-inner">
                    <Progress 
                      value={getProgressValue()} 
                      className="h-6 bg-transparent"
                    />
                  </div>
                  <div className="flex justify-between text-xl mt-4 font-semibold text-slate-700">
                    <span className="bg-slate-100 px-4 py-2 rounded-full border border-slate-200">0:00</span>
                    <span className="bg-slate-100 px-4 py-2 rounded-full border border-slate-200">{formatTime(timer.duration_seconds)}</span>
                  </div>
                </div>

                {/* Status Badge with proper styling for white background */}
                <div className="flex justify-center">
                  <Badge 
                    variant="outline" 
                    className={`text-2xl px-8 py-4 border-slate-300 text-slate-800 bg-slate-50 rounded-2xl shadow-lg transition-all duration-300 ${
                      timer.status === 'running' ? 'bg-green-50 border-green-300 text-green-800' : 
                      timer.status === 'paused' ? 'bg-yellow-50 border-yellow-300 text-yellow-800' :
                      timer.status === 'completed' ? 'bg-red-50 border-red-300 text-red-800 animate-bounce' : ''
                    }`}
                  >
                    {timer.status === 'running' && '⏰ '}{timer.status === 'paused' && '⏸️ '}{timer.status === 'completed' && '🔔 '}
                    {timer.status.toUpperCase()}
                  </Badge>
                </div>

                {/* Completion Message with better styling */}
                {timer.status === 'completed' && (
                  <div className="mt-8 p-8 bg-gradient-to-r from-green-50 to-blue-50 rounded-3xl border border-green-200 shadow-lg animate-scale-in">
                    <div className="text-6xl mb-4 animate-bounce">🎉</div>
                    <h2 className="text-4xl font-bold mb-4 text-slate-800 animate-fade-in">TIME'S UP!</h2>
                    <p className="text-2xl text-slate-700 animate-fade-in">Session has completed successfully!</p>
                    <div className="mt-4 text-4xl animate-pulse">⏰ 🎊 ⏰</div>
                  </div>
                )}

                {/* Motivational messages with better colors for white background */}
                {timer.status === 'running' && (
                  <div className="mt-8 text-lg font-medium animate-fade-in">
                    {timer.remaining_seconds > timer.duration_seconds * 0.8 && (
                      <p className="text-green-700 bg-green-50 px-6 py-3 rounded-full border border-green-200">🌟 Session is going strong! Keep up the great work!</p>
                    )}
                    {timer.remaining_seconds <= timer.duration_seconds * 0.8 && timer.remaining_seconds > timer.duration_seconds * 0.3 && (
                      <p className="text-orange-700 bg-orange-50 px-6 py-3 rounded-full border border-orange-200">⚡ Halfway there! Maintain the momentum!</p>
                    )}
                    {timer.remaining_seconds <= timer.duration_seconds * 0.3 && timer.remaining_seconds > 0 && (
                      <p className="text-red-700 bg-red-50 px-6 py-3 rounded-full border border-red-200">🚀 Final stretch! Time to wrap up!</p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-slate-800 space-y-8">
                <div className="flex justify-center">
                  <div className="w-48 h-48 flex items-center justify-center">
                    <img 
                      src="/lovable-uploads/9850b13c-f0c3-4079-ade9-bc1be0b69ee0.png"
                      alt="Tiger Timekeeper Waiting"
                      className="w-full h-full object-contain opacity-75 transition-transform duration-300 hover:scale-105 filter drop-shadow-lg"
                      style={{ imageRendering: 'crisp-edges' }}
                    />
                  </div>
                </div>
                <h1 className="text-4xl md:text-6xl font-bold animate-fade-in text-slate-800">
                  🐅 Timekeeper Ready!
                </h1>
                <p className="text-xl opacity-75 animate-fade-in text-slate-600">
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