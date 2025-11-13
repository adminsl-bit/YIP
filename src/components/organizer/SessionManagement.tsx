import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Calendar, Plus, GripVertical, Play, Pause, Square, CheckCircle, BarChart, Clock, ExternalLink, Eye, Pencil, Trash2, RotateCcw } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SessionItem {
  id: string;
  title: string;
  bill_type: 'private_member_bill' | 'government_bill' | 'committee_report' | 'question_hour' | 'general_discussion';
  description: string | null;
  sort_order: number;
  timer_id: string | null;
  poll_id: string | null;
  status: 'pending' | 'active' | 'completed';
  is_active: boolean;
  session_date: string | null;
  created_at: string;
}

interface TimerSession {
  id: string;
  title: string;
  status: string;
  remaining_seconds: number;
  duration_seconds: number;
}

interface Poll {
  id: string;
  title: string;
  is_active: boolean;
  show_results_publicly: boolean;
}

export const SessionManagement = () => {
  const { user } = useAuth();
  const [sessionItems, setSessionItems] = useState<SessionItem[]>([]);
  const [availableTimers, setAvailableTimers] = useState<TimerSession[]>([]);
  const [availablePolls, setAvailablePolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [billType, setBillType] = useState<string>("government_bill");
  const [description, setDescription] = useState("");
  const [linkedTimerId, setLinkedTimerId] = useState<string>("");
  const [linkedPollId, setLinkedPollId] = useState<string>("");

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    fetchSessionItems();
    fetchAvailableTimers();
    fetchAvailablePolls();

    const subscription = supabase
      .channel('session_management_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'session_items' },
        () => fetchSessionItems()
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'timer_sessions' },
        () => fetchAvailableTimers()
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'polls' },
        () => fetchAvailablePolls()
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchSessionItems = async () => {
    try {
      const { data, error } = await supabase
        .from('session_items' as any)
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setSessionItems(data as any as SessionItem[]);
    } catch (error) {
      console.error('Error fetching session items:', error);
    }
  };

  const fetchAvailableTimers = async () => {
    try {
      const { data, error } = await supabase
        .from('timer_sessions')
        .select('id, title, status, remaining_seconds, duration_seconds')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAvailableTimers(data as TimerSession[]);
    } catch (error) {
      console.error('Error fetching timers:', error);
    }
  };

  const fetchAvailablePolls = async () => {
    try {
      const { data, error } = await supabase
        .from('polls')
        .select('id, title, is_active, show_results_publicly')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAvailablePolls(data as Poll[]);
    } catch (error) {
      console.error('Error fetching polls:', error);
    }
  };

  const handleCreateSession = async () => {
    if (!user || !title.trim()) {
      toast({
        title: "Error",
        description: "Please enter a title for the session item",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      if (editingSessionId) {
        // Update existing session
        const { error } = await supabase
          .from('session_items' as any)
          .update({
            title,
            bill_type: billType as any,
            description: description || null,
            timer_id: linkedTimerId || null,
            poll_id: linkedPollId || null,
          })
          .eq('id', editingSessionId);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Session item updated successfully",
        });
      } else {
        // Create new session
        const { error } = await supabase
          .from('session_items' as any)
          .insert([{
            title,
            bill_type: billType as any,
            description: description || null,
            timer_id: linkedTimerId || null,
            poll_id: linkedPollId || null,
            sort_order: sessionItems.length,
            status: 'pending',
            is_active: false,
            created_by: user.id,
          } as any]);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Session item created successfully",
        });
      }

      setShowCreateDialog(false);
      setEditingSessionId(null);
      setTitle("");
      setBillType("government_bill");
      setDescription("");
      setLinkedTimerId("");
      setLinkedPollId("");
      fetchSessionItems();
    } catch (error) {
      console.error('Error saving session:', error);
      toast({
        title: "Error",
        description: `Failed to ${editingSessionId ? 'update' : 'create'} session item`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleActivateItem = async (itemId: string, currentActive: boolean) => {
    setLoading(true);
    try {
      if (!currentActive) {
        // Deactivate all other items first
        await supabase
          .from('session_items' as any)
          .update({ is_active: false })
          .neq('id', itemId);
      }

      const { error } = await supabase
        .from('session_items' as any)
        .update({ 
          is_active: !currentActive,
          status: !currentActive ? 'active' : 'pending'
        } as any)
        .eq('id', itemId);

      if (error) throw error;

      toast({
        title: "Success",
        description: currentActive ? "Item deactivated" : "Item activated on display",
      });

      fetchSessionItems();
    } catch (error) {
      console.error('Error activating item:', error);
      toast({
        title: "Error",
        description: "Failed to update item status",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTimerControl = async (timerId: string | null, action: 'start' | 'pause' | 'stop' | 'reset') => {
    if (!timerId) return;

    // Don't use global loading state to prevent flickering
    try {
      let updates: any = {};

      switch (action) {
        case 'start':
          // Deactivate all other timers first
          await supabase
            .from('timer_sessions')
            .update({ is_active: false })
            .neq('id', timerId);
          
          updates = { 
            status: 'running', 
            is_active: true,
            started_at: new Date().toISOString() 
          };
          break;
        case 'pause':
          updates = { status: 'paused' };
          break;
        case 'stop':
          updates = { status: 'stopped', is_active: false };
          break;
        case 'reset':
          // Get the original duration to reset remaining_seconds
          const { data: timerData } = await supabase
            .from('timer_sessions')
            .select('duration_seconds')
            .eq('id', timerId)
            .single();
          
          updates = { 
            status: 'stopped',
            is_active: false,
            remaining_seconds: timerData?.duration_seconds || 0
          };
          break;
      }

      const { error } = await supabase
        .from('timer_sessions')
        .update(updates)
        .eq('id', timerId);

      if (error) throw error;

      toast({
        title: "Success",
        description: action === 'reset' ? 'Timer reset' : `Timer ${action}ed`,
      });

      fetchAvailableTimers();
    } catch (error) {
      console.error('Error controlling timer:', error);
      toast({
        title: "Error",
        description: "Failed to control timer",
        variant: "destructive",
      });
    }
  };

  const handlePollToggle = async (pollId: string | null, currentActive: boolean) => {
    if (!pollId) return;

    // Don't use global loading state to prevent flickering
    try {
      const { error } = await supabase
        .from('polls')
        .update({ is_active: !currentActive })
        .eq('id', pollId);

      if (error) throw error;

      toast({
        title: "Success",
        description: currentActive ? "Poll closed" : "Poll opened for voting",
      });

      fetchAvailablePolls();
    } catch (error) {
      console.error('Error toggling poll:', error);
      toast({
        title: "Error",
        description: "Failed to toggle poll",
        variant: "destructive",
      });
    }
  };

  const handlePollResultsToggle = async (pollId: string | null, currentStatus: boolean) => {
    if (!pollId) return;

    // Don't use global loading state to prevent flickering
    try {
      const { error } = await supabase
        .from('polls')
        .update({ show_results_publicly: !currentStatus })
        .eq('id', pollId);

      if (error) throw error;

      toast({
        title: "Success",
        description: currentStatus ? "Results hidden from public" : "Results now visible publicly",
      });

      fetchAvailablePolls();
    } catch (error) {
      console.error('Error toggling poll results:', error);
      toast({
        title: "Error",
        description: "Failed to toggle poll results visibility",
        variant: "destructive",
      });
    }
  };

  const handleEditSession = (session: SessionItem) => {
    setEditingSessionId(session.id);
    setTitle(session.title);
    setBillType(session.bill_type);
    setDescription(session.description || '');
    setLinkedTimerId(session.timer_id || '');
    setLinkedPollId(session.poll_id || '');
    setShowCreateDialog(true);
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to delete this session item?')) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('session_items' as any)
        .delete()
        .eq('id', sessionId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Session item deleted successfully",
      });

      fetchSessionItems();
    } catch (error) {
      console.error('Error deleting session:', error);
      toast({
        title: "Error",
        description: "Failed to delete session item",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteItem = async (itemId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('session_items' as any)
        .update({ 
          status: 'completed',
          is_active: false,
          completed_at: new Date().toISOString()
        } as any)
        .eq('id', itemId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Item marked as completed",
      });

      fetchSessionItems();
    } catch (error) {
      console.error('Error completing item:', error);
      toast({
        title: "Error",
        description: "Failed to complete item",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = sessionItems.findIndex((t) => t.id === active.id);
    const newIndex = sessionItems.findIndex((t) => t.id === over.id);

    const reordered = arrayMove(sessionItems, oldIndex, newIndex);
    setSessionItems(reordered);

    try {
      const updates = reordered.map((item, index) => ({
        id: item.id,
        sort_order: index,
      }));

      for (const update of updates) {
        await supabase
          .from('session_items' as any)
          .update({ sort_order: update.sort_order } as any)
          .eq('id', update.id);
      }

      toast({
        title: "Success",
        description: "Session order updated",
      });
    } catch (error) {
      console.error('Error updating session order:', error);
      toast({
        title: "Error",
        description: "Failed to update session order",
        variant: "destructive",
      });
      fetchSessionItems();
    }
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

  const getBillTypeBadge = (type: string) => {
    const variants = {
      private_member_bill: 'secondary',
      government_bill: 'default',
      committee_report: 'outline',
      question_hour: 'destructive',
      general_discussion: 'secondary',
    };
    return <Badge variant={variants[type as keyof typeof variants] as any}>{getBillTypeLabel(type)}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    const configs = {
      pending: { label: 'Pending', variant: 'outline' as const },
      active: { label: 'Active', variant: 'default' as const },
      completed: { label: 'Completed', variant: 'secondary' as const },
    };
    const config = configs[status as keyof typeof configs];
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const SortableSessionItem = ({ item }: { item: SessionItem }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: item.id });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    };

    const linkedTimer = availableTimers.find(t => t.id === item.timer_id);
    const linkedPoll = availablePolls.find(p => p.id === item.poll_id);

    return (
      <Card
        ref={setNodeRef}
        style={style}
        className={`${item.is_active ? 'border-primary shadow-md' : ''} ${isDragging ? 'shadow-lg' : ''}`}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            <button
              className="cursor-grab active:cursor-grabbing p-2 hover:bg-muted rounded-md transition-colors mt-1"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="h-5 w-5 text-muted-foreground" />
            </button>

            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-lg">{item.title}</h3>
                {getBillTypeBadge(item.bill_type)}
                {getStatusBadge(item.status)}
                {item.is_active && (
                  <Badge className="bg-primary">
                    Live on Display
                  </Badge>
                )}
              </div>

              {item.description && (
                <p className="text-sm text-muted-foreground">{item.description}</p>
              )}

              <div className="flex items-center gap-4 flex-wrap">
                {linkedTimer && (
                  <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                    <Clock className="h-4 w-4" />
                    <span className="text-sm font-mono">{formatTime(linkedTimer.remaining_seconds)}</span>
                    <div className="flex gap-1">
                      {linkedTimer.status === 'running' ? (
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={() => handleTimerControl(item.timer_id, 'pause')} 
                          title="Pause"
                          className="transition-all duration-200 hover:scale-105"
                        >
                          <Pause className="h-3 w-3" />
                        </Button>
                      ) : (
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={() => handleTimerControl(item.timer_id, 'start')} 
                          title="Play"
                          className="transition-all duration-200 hover:scale-105"
                        >
                          <Play className="h-3 w-3" />
                        </Button>
                      )}
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => handleTimerControl(item.timer_id, 'stop')} 
                        title="Stop"
                        className="transition-all duration-200 hover:scale-105"
                      >
                        <Square className="h-3 w-3" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => handleTimerControl(item.timer_id, 'reset')} 
                        title="Reset"
                        className="transition-all duration-200 hover:scale-105"
                      >
                        <RotateCcw className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}

                {linkedPoll && (
                  <div className="flex items-center gap-2 p-2 bg-muted rounded-md flex-wrap">
                    <BarChart className="h-4 w-4" />
                    <span className="text-sm">{linkedPoll.title}</span>
                    <Button 
                      size="sm" 
                      variant={linkedPoll.is_active ? "default" : "outline"}
                      onClick={() => handlePollToggle(item.poll_id, linkedPoll.is_active)}
                      className="transition-all duration-200"
                    >
                      {linkedPoll.is_active ? 'Close' : 'Open'} Voting
                    </Button>
                    <div className="flex items-center gap-2 ml-2 pl-2 border-l">
                      <Eye className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Public Results</span>
                      <Switch
                        checked={linkedPoll.show_results_publicly}
                        onCheckedChange={() => handlePollResultsToggle(item.poll_id, linkedPoll.show_results_publicly)}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleEditSession(item)}
                disabled={loading}
                className="h-8 w-8 p-0"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleDeleteSession(item.id)}
                disabled={loading}
                className="h-8 w-8 p-0"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
              
              <div className="h-6 w-px bg-border mx-1" />
              
              <Button
                size="sm"
                variant={item.is_active ? "default" : "outline"}
                onClick={() => handleActivateItem(item.id, item.is_active)}
                disabled={loading}
              >
                {item.is_active ? 'Deactivate' : 'Activate'}
              </Button>

              {item.status !== 'completed' && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleCompleteItem(item.id)}
                  disabled={loading}
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Complete
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Session Management
          </CardTitle>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => window.open('/display/session', '_blank')}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open Display
            </Button>
            <Dialog open={showCreateDialog} onOpenChange={(open) => {
              setShowCreateDialog(open);
              if (!open) {
                setEditingSessionId(null);
                setTitle("");
                setBillType("government_bill");
                setDescription("");
                setLinkedTimerId("");
                setLinkedPollId("");
              }
            }}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Session Item
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{editingSessionId ? 'Edit' : 'Create'} Session Item</DialogTitle>
                  <DialogDescription>
                    {editingSessionId ? 'Update the' : 'Add a new'} agenda item with optional timer and poll
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Title *</Label>
                    <Input
                      id="title"
                      placeholder="e.g., Healthcare Reform Bill 2025"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bill-type">Type *</Label>
                    <Select value={billType} onValueChange={setBillType}>
                      <SelectTrigger id="bill-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="government_bill">Government Bill</SelectItem>
                        <SelectItem value="private_member_bill">Private Member Bill</SelectItem>
                        <SelectItem value="committee_report">Committee Report</SelectItem>
                        <SelectItem value="question_hour">Question Hour</SelectItem>
                        <SelectItem value="general_discussion">General Discussion</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      placeholder="Brief description of the session item"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="timer">Link Timer (Optional)</Label>
                      <Select value={linkedTimerId || "none"} onValueChange={(val) => setLinkedTimerId(val === "none" ? "" : val)}>
                        <SelectTrigger id="timer">
                          <SelectValue placeholder="Select a timer" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No Timer</SelectItem>
                          {availableTimers.map(timer => (
                            <SelectItem key={timer.id} value={timer.id}>
                              {timer.title} ({formatTime(timer.duration_seconds)})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="poll">Link Poll (Optional)</Label>
                      <Select value={linkedPollId || "none"} onValueChange={(val) => setLinkedPollId(val === "none" ? "" : val)}>
                        <SelectTrigger id="poll">
                          <SelectValue placeholder="Select a poll" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No Poll</SelectItem>
                          {availablePolls.map(poll => (
                            <SelectItem key={poll.id} value={poll.id}>
                              {poll.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateSession} disabled={loading}>
                    {editingSessionId ? 'Update' : 'Create'} Session Item
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>

        <CardContent>
          {sessionItems.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p className="text-lg">No session items yet</p>
              <p className="text-sm">Create your first agenda item to get started</p>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={sessionItems.map((item) => item.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-4">
                  {sessionItems.map((item) => (
                    <SortableSessionItem key={item.id} item={item} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </CardContent>
      </Card>
    </div>
  );
};