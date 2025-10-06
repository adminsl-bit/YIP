import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Play, Pause, Square, RotateCcw, Clock, ExternalLink, Volume2, Trash2, Plus } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Helper function to convert H:M:S to total seconds
  const getDurationInSeconds = () => {
    return hours * 3600 + minutes * 60 + seconds;
  };

  // Helper function to convert seconds to H:M:S
  const setDurationFromSeconds = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    setHours(hrs);
    setMinutes(mins);
    setSeconds(secs);
  };

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
        .in('status', ['running', 'paused', 'stopped'])
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;
      
      if (data && data.length > 0) {
        setCurrentTimer(data[0] as TimerSession);
        setTitle(data[0].title);
        setDurationFromSeconds(data[0].duration_seconds);
      } else {
        setCurrentTimer(null);
      }
    } catch (error) {
      console.error('Error fetching timer:', error);
      setCurrentTimer(null);
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

        // Update in database every second to keep stage view in sync
        updateTimerInDB(prev.id, { remaining_seconds: newRemaining });

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

    const totalDuration = getDurationInSeconds();
    if (totalDuration < 1) {
      toast({
        title: "Invalid Duration",
        description: "Timer duration must be at least 1 second",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('timer_sessions')
        .insert({
          title,
          duration_seconds: totalDuration,
          remaining_seconds: totalDuration,
          created_by: user.id
        })
        .select()
        .single();

      if (error) throw error;

      setCurrentTimer(data as TimerSession);
      const formattedTime = `${hours}h ${minutes}m ${seconds}s`;
      toast({
        title: "Timer Created",
        description: `Timer "${title}" set for ${formattedTime}`
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

  const deleteTimer = async () => {
    if (!currentTimer || !user) return;

    try {
      const { error } = await supabase
        .from('timer_sessions')
        .delete()
        .eq('id', currentTimer.id);

      if (error) throw error;

      await supabase.rpc('log_audit_event', {
        p_user_id: user.id,
        p_action: 'timer_deleted',
        p_resource_type: 'timer_session',
        p_resource_id: currentTimer.id
      });

      setCurrentTimer(null);
      setTitle("Parliament Session");
      setHours(0);
      setMinutes(0);
      setSeconds(0);

      toast({
        title: "Timer Deleted",
        description: "Timer has been permanently deleted"
      });
    } catch (error) {
      console.error('Error deleting timer:', error);
      toast({
        title: "Error",
        description: "Failed to delete timer",
        variant: "destructive"
      });
    }
    setShowDeleteDialog(false);
  };

  const openStageView = () => {
    const stageUrl = '/display/timer';
    console.log('Opening stage view at:', stageUrl);
    const newWindow = window.open(stageUrl, '_blank', 'width=1200,height=800,fullscreen=yes');
    if (!newWindow) {
      toast({
        title: "Popup Blocked",
        description: "Please allow popups and try again, or manually navigate to /display/timer",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Stage View Opened",
        description: "Timer display opened in new window"
      });
    }
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Clock className="w-5 h-5 text-slate-700" />
          <h2 className="text-xl font-bold text-slate-800">Session Timer</h2>
        </div>
        {!currentTimer && (
          <div className="flex items-center space-x-2 text-sm text-slate-600">
            <Plus className="w-4 h-4" />
            <span>Create a new timer to get started</span>
          </div>
        )}
      </div>

      {/* Timer Setup */}
      {!currentTimer && (
        <div className="bg-white/30 backdrop-blur-sm rounded-2xl p-6 border border-white/40 shadow-lg space-y-4">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Create New Timer</h3>
          <div>
            <label className="text-sm font-medium text-slate-700">Session Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Parliament Session"
              className="bg-white/50"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Duration</label>
            <div className="grid grid-cols-3 gap-3 mt-1">
              <div>
                <label className="text-xs text-slate-600">Hours</label>
                <Input
                  type="number"
                  value={hours}
                  onChange={(e) => setHours(Math.max(0, parseInt(e.target.value) || 0))}
                  min={0}
                  max={23}
                  className="bg-white/50"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="text-xs text-slate-600">Minutes</label>
                <Input
                  type="number"
                  value={minutes}
                  onChange={(e) => setMinutes(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                  min={0}
                  max={59}
                  className="bg-white/50"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="text-xs text-slate-600">Seconds</label>
                <Input
                  type="number"
                  value={seconds}
                  onChange={(e) => setSeconds(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                  min={0}
                  max={59}
                  className="bg-white/50"
                  placeholder="0"
                />
              </div>
            </div>
            <p className="text-xs text-slate-600 mt-1">
              Total: {getDurationInSeconds()} seconds ({hours}h {minutes}m {seconds}s)
            </p>
          </div>
          <button 
            onClick={createTimer} 
            disabled={loading} 
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-3 px-6 rounded-2xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Creating...</span>
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                <span>Create Timer</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Active Timer */}
      {currentTimer && (
        <div className="bg-white/30 backdrop-blur-sm rounded-2xl p-6 border border-white/40 shadow-lg space-y-6">
          <div className="text-center">
            <h3 className="text-xl font-bold text-slate-800 mb-2">{currentTimer.title}</h3>
            <div className={`text-6xl font-mono font-bold mb-4 ${getTimerColor()}`}>
              {formatTime(currentTimer.remaining_seconds)}
            </div>
            <Progress value={getProgressValue()} className="mb-4" />
            <div className="flex items-center justify-between text-sm text-slate-600 mb-4">
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
          <div className="grid grid-cols-2 gap-3">
            {currentTimer.status === 'stopped' || currentTimer.status === 'paused' ? (
              <button 
                onClick={startTimer}
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold py-3 px-4 rounded-2xl transition-all duration-300 flex items-center justify-center space-x-2"
              >
                <Play className="w-4 h-4" />
                <span>{currentTimer.status === 'paused' ? 'Resume' : 'Start'}</span>
              </button>
            ) : (
              <button 
                onClick={pauseTimer}
                className="bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 text-white font-bold py-3 px-4 rounded-2xl transition-all duration-300 flex items-center justify-center space-x-2"
              >
                <Pause className="w-4 h-4" />
                <span>Pause</span>
              </button>
            )}
            
            <button 
              onClick={resetTimer}
              className="bg-gradient-to-r from-gray-600 to-slate-600 hover:from-gray-700 hover:to-slate-700 text-white font-bold py-3 px-4 rounded-2xl transition-all duration-300 flex items-center justify-center space-x-2"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reset</span>
            </button>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 gap-3">
            <button 
              onClick={openStageView}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold py-3 px-4 rounded-2xl transition-all duration-300 flex items-center justify-center space-x-2"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Open Stage View</span>
            </button>
            
            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
              <AlertDialogTrigger asChild>
                <button 
                  className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-bold py-3 px-4 rounded-2xl transition-all duration-300 flex items-center justify-center space-x-2"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Timer</span>
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Timer?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete the timer "{currentTimer.title}"? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={deleteTimer} className="bg-red-600 hover:bg-red-700">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          {currentTimer.status === 'completed' && (
            <div className="p-4 bg-red-50/80 border border-red-200 rounded-2xl">
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
    </div>
  );
};