import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Clock, Play, Pause, Square, RotateCcw, Trash2, Plus, ExternalLink } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface TimerSession {
  id: string;
  title: string;
  duration_seconds: number;
  remaining_seconds: number;
  status: 'stopped' | 'running' | 'paused' | 'completed';
  is_active: boolean;
  created_at: string;
}

export const TimerManagement = () => {
  const { user } = useAuth();
  const [timerSessions, setTimerSessions] = useState<TimerSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newTimerTitle, setNewTimerTitle] = useState("");
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(5);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    fetchTimerSessions();

    // Set up real-time subscription
    const subscription = supabase
      .channel('timer_management_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'timer_sessions' },
        () => fetchTimerSessions()
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchTimerSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('timer_sessions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTimerSessions(data as TimerSession[]);
    } catch (error) {
      console.error('Error fetching timer sessions:', error);
      toast({
        title: "Error",
        description: "Failed to fetch timer sessions",
        variant: "destructive",
      });
    }
  };

  const handleCreateTimer = async () => {
    if (!user || !newTimerTitle.trim()) {
      toast({
        title: "Error",
        description: "Please enter a title for the timer",
        variant: "destructive",
      });
      return;
    }

    const totalSeconds = hours * 3600 + minutes * 60 + seconds;
    if (totalSeconds === 0) {
      toast({
        title: "Error",
        description: "Please set a duration for the timer",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('timer_sessions')
        .insert({
          title: newTimerTitle,
          duration_seconds: totalSeconds,
          remaining_seconds: totalSeconds,
          status: 'stopped',
          is_active: false,
          created_by: user.id,
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Timer session created successfully",
      });

      setShowCreateDialog(false);
      setNewTimerTitle("");
      setHours(0);
      setMinutes(5);
      setSeconds(0);
      fetchTimerSessions();
    } catch (error) {
      console.error('Error creating timer:', error);
      toast({
        title: "Error",
        description: "Failed to create timer session",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (timerId: string, currentActive: boolean) => {
    setLoading(true);
    try {
      if (!currentActive) {
        // Deactivate all other timers first
        await supabase
          .from('timer_sessions')
          .update({ is_active: false })
          .neq('id', timerId);
      }

      // Toggle the selected timer
      const { error } = await supabase
        .from('timer_sessions')
        .update({ is_active: !currentActive })
        .eq('id', timerId);

      if (error) throw error;

      toast({
        title: "Success",
        description: currentActive ? "Timer deactivated" : "Timer activated for display",
      });

      fetchTimerSessions();
    } catch (error) {
      console.error('Error toggling timer:', error);
      toast({
        title: "Error",
        description: "Failed to toggle timer status",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTimerControl = async (timerId: string, action: 'start' | 'pause' | 'stop' | 'reset') => {
    setLoading(true);
    try {
      const timer = timerSessions.find(t => t.id === timerId);
      if (!timer) return;

      let updates: any = {};

      switch (action) {
        case 'start':
          updates = { status: 'running', started_at: new Date().toISOString() };
          break;
        case 'pause':
          updates = { status: 'paused' };
          break;
        case 'stop':
          updates = { status: 'stopped' };
          break;
        case 'reset':
          updates = { 
            status: 'stopped', 
            remaining_seconds: timer.duration_seconds,
            completed_at: null 
          };
          break;
      }

      const { error } = await supabase
        .from('timer_sessions')
        .update(updates)
        .eq('id', timerId);

      if (error) throw error;

      fetchTimerSessions();
    } catch (error) {
      console.error('Error controlling timer:', error);
      toast({
        title: "Error",
        description: "Failed to control timer",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTimer = async (timerId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('timer_sessions')
        .delete()
        .eq('id', timerId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Timer session deleted",
      });

      fetchTimerSessions();
    } catch (error) {
      console.error('Error deleting timer:', error);
      toast({
        title: "Error",
        description: "Failed to delete timer session",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      running: { label: 'Running', variant: 'default' as const },
      paused: { label: 'Paused', variant: 'secondary' as const },
      stopped: { label: 'Stopped', variant: 'outline' as const },
      completed: { label: 'Completed', variant: 'destructive' as const },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.stopped;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Timer Management
          </CardTitle>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => window.open('/timer-display', '_blank')}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open Display
            </Button>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Timer
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Timer Session</DialogTitle>
                  <DialogDescription>
                    Create a predefined timer session that you can activate later
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Session Title</Label>
                    <Input
                      id="title"
                      placeholder="e.g., Parliament Session, Lunch Break"
                      value={newTimerTitle}
                      onChange={(e) => setNewTimerTitle(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Duration</Label>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Label htmlFor="hours" className="text-xs text-muted-foreground">Hours</Label>
                        <Input
                          id="hours"
                          type="number"
                          min="0"
                          max="23"
                          value={hours}
                          onChange={(e) => setHours(Math.max(0, parseInt(e.target.value) || 0))}
                        />
                      </div>
                      <div className="flex-1">
                        <Label htmlFor="minutes" className="text-xs text-muted-foreground">Minutes</Label>
                        <Input
                          id="minutes"
                          type="number"
                          min="0"
                          max="59"
                          value={minutes}
                          onChange={(e) => setMinutes(Math.max(0, parseInt(e.target.value) || 0))}
                        />
                      </div>
                      <div className="flex-1">
                        <Label htmlFor="seconds" className="text-xs text-muted-foreground">Seconds</Label>
                        <Input
                          id="seconds"
                          type="number"
                          min="0"
                          max="59"
                          value={seconds}
                          onChange={(e) => setSeconds(Math.max(0, parseInt(e.target.value) || 0))}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateTimer} disabled={loading}>
                    Create Timer
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {timerSessions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No timer sessions yet. Create one to get started!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {timerSessions.map((timer) => (
                <Card key={timer.id} className={timer.is_active ? "border-primary" : ""}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{timer.title}</h3>
                          {timer.is_active && (
                            <Badge variant="default" className="text-xs">
                              Active on Display
                            </Badge>
                          )}
                          {getStatusBadge(timer.status)}
                        </div>
                        <div className="text-2xl font-mono">
                          {formatTime(timer.remaining_seconds)}
                          <span className="text-sm text-muted-foreground ml-2">
                            / {formatTime(timer.duration_seconds)}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md">
                          <Label htmlFor={`active-${timer.id}`} className="text-sm cursor-pointer">
                            {timer.is_active ? "Active" : "Inactive"}
                          </Label>
                          <Switch
                            id={`active-${timer.id}`}
                            checked={timer.is_active}
                            onCheckedChange={() => handleToggleActive(timer.id, timer.is_active)}
                            disabled={loading}
                          />
                        </div>
                        
                        {timer.is_active && (
                          <>
                            {timer.status === 'running' ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleTimerControl(timer.id, 'pause')}
                                disabled={loading}
                              >
                                <Pause className="h-4 w-4" />
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleTimerControl(timer.id, 'start')}
                                disabled={loading}
                              >
                                <Play className="h-4 w-4" />
                              </Button>
                            )}
                            
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleTimerControl(timer.id, 'stop')}
                              disabled={loading}
                            >
                              <Square className="h-4 w-4" />
                            </Button>
                            
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleTimerControl(timer.id, 'reset')}
                              disabled={loading}
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              disabled={loading}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Timer Session</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete "{timer.title}"? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteTimer(timer.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
