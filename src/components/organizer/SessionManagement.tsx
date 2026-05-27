import React, { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Calendar, Plus, GripVertical, Play, Pause, Square, CheckCircle, BarChart, Clock, ExternalLink, Eye, Pencil, Trash2, RotateCcw, Bell, Landmark, Users, Gavel, ClipboardCheck, Search, Info, Trash, Edit, ChevronDown, Check, Activity, ListChecks, PlayCircle } from "lucide-react";
import { SortableSessionItem } from "./SortableSessionItem";
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
  updated_at: string;
  started_at: string | null;
}

interface Poll {
  id: string;
  title: string;
  is_active: boolean;
  show_results_publicly: boolean;
}

interface Stats {
  student_count: number;
  jury_count: number;
  assessment_count: number;
}

export const SessionManagement = () => {
  const { user } = useAuth();
  const { hasRole } = useUserRole(user?.id);
  const [sessionItems, setSessionItems] = useState<SessionItem[]>([]);
  const [availableTimers, setAvailableTimers] = useState<TimerSession[]>([]);
  const [availablePolls, setAvailablePolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [expandedAccordions, setExpandedAccordions] = useState<Record<string, string>>({});
  const [stats, setStats] = useState<Stats>({ student_count: 0, jury_count: 0, assessment_count: 0 });

  // Form state
  const [title, setTitle] = useState("");
  const [billType, setBillType] = useState<string>("");
  const [description, setDescription] = useState("");
  const [linkedTimerId, setLinkedTimerId] = useState<string>("");
  const [linkedPollId, setLinkedPollId] = useState<string>("");

  // Procedure control state
  const [autoTransition, setAutoTransition] = useState(false);
  const [memberNotifications, setMemberNotifications] = useState(false);

  // Server clock calibration for smooth timer display
  const [nowTs, setNowTs] = useState<number>(Date.now());
  const clockOffsetRef = useRef<number>(0);

  useEffect(() => {
    const calibrateClock = async () => {
      try {
        const clientBefore = Date.now();
        const { data } = await supabase.rpc('get_server_time');
        const clientAfter = Date.now();
        if (data) {
          const serverTime = Date.parse(data as unknown as string);
          const clientMid = (clientBefore + clientAfter) / 2;
          clockOffsetRef.current = serverTime - clientMid;
        }
      } catch (e) {
        console.warn('[SessionManagement] Clock calibration failed', e);
      }
    };

    calibrateClock();
    const id = window.setInterval(() => setNowTs(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);


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
    fetchStats();
    fetchProcedureSettings();

    const subscription = supabase
      .channel('session_management_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'session_items' },
        () => fetchSessionItems()
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'timer_sessions' },
        (payload) => {
          const newRow: any = (payload as any).new;
          const oldRow: any = (payload as any).old;
          setAvailableTimers((prev) => {
            if (!prev) return prev as any;
            const eventType = (payload as any).eventType;
            if (eventType === 'UPDATE' && newRow) {
              return prev.map(t => t.id === newRow.id ? {
                id: newRow.id,
                title: newRow.title,
                status: newRow.status,
                remaining_seconds: newRow.remaining_seconds,
                duration_seconds: newRow.duration_seconds,
                updated_at: newRow.updated_at,
                started_at: newRow.started_at ?? null,
              } : t);
            }
            if (eventType === 'INSERT' && newRow) {
              const inserted = {
                id: newRow.id,
                title: newRow.title,
                status: newRow.status,
                remaining_seconds: newRow.remaining_seconds,
                duration_seconds: newRow.duration_seconds,
                updated_at: newRow.updated_at,
                started_at: newRow.started_at ?? null,
              } as any;
              return [inserted, ...prev.filter(t => t.id !== newRow.id)];
            }
            if (eventType === 'DELETE' && oldRow) {
              return prev.filter(t => t.id !== oldRow.id);
            }
            return prev;
          });
        }
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
        .select('id, title, status, remaining_seconds, duration_seconds, updated_at, started_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAvailableTimers(data as TimerSession[]);
    } catch (error) {
      console.error('Error fetching timers:', error);
    }
  };

  // Compute display remaining using server-synced time
  const getDisplayedRemaining = (timer: TimerSession | undefined) => {
    if (!timer || timer.status !== 'running') return timer?.remaining_seconds || 0;
    const serverNow = nowTs + clockOffsetRef.current;
    const updatedAt = Date.parse(timer.updated_at);
    const elapsed = Math.max(0, Math.floor((serverNow - updatedAt) / 1000));
    return Math.max(0, timer.remaining_seconds - elapsed);
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

  const fetchStats = async () => {
    try {
      const { data: students } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('user_type', 'student');
      const { data: jury } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('user_type', 'jury');
      const { data: assessments } = await supabase.from('assessments').select('id', { count: 'exact', head: true });
      
      setStats({
        student_count: students?.length || 0, // Fallback if count is not available directly
        jury_count: jury?.length || 0,
        assessment_count: assessments?.length || 0,
      });

      // Better way to get counts if the above doesn't work well
      const { count: sCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('user_type', 'student');
      const { count: jCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('user_type', 'jury');
      const { count: aCount } = await supabase.from('assessments').select('*', { count: 'exact', head: true });
      
      setStats({
        student_count: sCount || 0,
        jury_count: jCount || 0,
        assessment_count: aCount || 0,
      });
    } catch (e) {
      console.error('Error fetching stats:', e);
    }
  };

  const fetchProcedureSettings = async () => {
    try {
      const { data } = await supabase
        .from('system_settings')
        .select('setting_key, setting_value')
        .in('setting_key', ['auto_transition_enabled', 'notifications_enabled']);
      data?.forEach((s: any) => {
        const val = s.setting_value === true || s.setting_value === 'true';
        if (s.setting_key === 'auto_transition_enabled') setAutoTransition(val);
        if (s.setting_key === 'notifications_enabled') setMemberNotifications(val);
      });
    } catch (e) { /* settings may not exist yet — local state only */ }
  };

  const updateProcedureSetting = async (key: string, value: boolean) => {
    try {
      await (supabase.from('system_settings') as any)
        .upsert({ setting_key: key, setting_value: value, description: key }, { onConflict: 'setting_key' });
    } catch (e) { /* persist failure is non-critical */ }
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
        const { error } = await supabase
          .from('session_items' as any)
          .update({
            title,
            bill_type: mapTextToBillType(billType),
            description: description || null,
            timer_id: linkedTimerId || null,
            poll_id: linkedPollId || null,
          })
          .eq('id', editingSessionId);
        if (error) throw error;
        toast({ title: "Updated", description: "Session item updated successfully" });
      } else {
        const { error } = await supabase
          .from('session_items' as any)
          .insert([{
            title,
            bill_type: mapTextToBillType(billType),
            description: description || null,
            timer_id: linkedTimerId || null,
            poll_id: linkedPollId || null,
            sort_order: sessionItems.length,
            status: 'pending',
            is_active: false,
            created_by: user.id,
          } as any]);
        if (error) throw error;
        toast({ title: "Scheduled", description: `"${title}" added to agenda` });
      }

      setShowCreateDialog(false);
      setEditingSessionId(null);
      setTitle("");
      setBillType("");
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
        case 'pause': {
          const currentTimer = availableTimers.find(t => t.id === timerId);
          if (currentTimer) {
            const startedAt = currentTimer.started_at ? Date.parse(currentTimer.started_at) : Date.now();
            const elapsed = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
            updates = { status: 'paused', remaining_seconds: Math.max(0, currentTimer.remaining_seconds - elapsed) };
          } else {
            updates = { status: 'paused' };
          }
          break;
        }
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

      // Optimistic UI will be synced by realtime updates
      // fetchAvailableTimers();
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

      // Don't refetch - rely on realtime updates to prevent race conditions
      // fetchAvailablePolls();
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

      // Don't refetch - rely on realtime updates
      // fetchAvailablePolls();
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
    setBillType(getBillTypeLabel(session.bill_type));
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
    const labels: Record<string, string> = {
      private_member_bill: 'Private Member Bill',
      government_bill: 'Government Bill',
      committee_report: 'Committee Report',
      question_hour: 'Question Hour',
      general_discussion: 'General Discussion',
    };
    return labels[type] || type;
  };

  const mapTextToBillType = (text: string): SessionItem['bill_type'] => {
    const t = text.toLowerCase();
    if (t.includes('government') || t.includes('govt')) return 'government_bill';
    if (t.includes('private') || t.includes('member')) return 'private_member_bill';
    if (t.includes('committee') || t.includes('report')) return 'committee_report';
    if (t.includes('question') || t.includes('hour')) return 'question_hour';
    return 'general_discussion';
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

  const handleExpandChange = (itemId: string, value: string) => {
    setExpandedAccordions(prev => ({
      ...prev,
      [itemId]: value
    }));
  };

  const activeTimer = sessionItems.find(item => item.is_active)?.timer_id ? availableTimers.find(t => t.id === sessionItems.find(item => item.is_active)?.timer_id) : null;

  return (
    <div className="space-y-6 pb-4">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Left — Agenda Timeline */}
        <section className="lg:col-span-8 bg-surface-container rounded-3xl p-7 border border-outline-variant/10">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-base font-black font-headline text-on-surface tracking-tight">Scheduled Agenda</h2>
              <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/40 font-headline mt-1">Drag rows to reorder</p>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="px-3 py-1.5 bg-surface-container-lowest rounded-full text-[10px] font-black uppercase tracking-widest text-on-surface-variant border border-outline-variant/10 shadow-sm">
                {sessionItems.filter(i => i.status === 'pending').length} Pending
              </span>
              <span className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-sm ${sessionItems.some(i => i.is_active) ? 'bg-secondary/10 text-secondary border-secondary/20' : 'bg-primary/10 text-primary border-primary/10'}`}>
                {sessionItems.filter(i => i.status === 'completed').length} Done
              </span>
              <a
                href="/display/timer"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm shadow-primary/20 hover:bg-primary-container transition-all font-headline"
              >
                <span className="material-symbols-outlined text-sm">open_in_new</span>
                Open Display
              </a>
            </div>
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={sessionItems.map(i => i.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-4">
                {sessionItems.length === 0 ? (
                  <div className="bg-surface-container-lowest border-2 border-dashed border-outline-variant/20 rounded-3xl p-16 text-center flex flex-col items-center gap-6">
                    <div className="w-20 h-20 rounded-2xl bg-primary/5 flex items-center justify-center">
                      <Landmark className="w-10 h-10 text-primary/20" />
                    </div>
                    <div>
                      <h4 className="text-lg font-black font-headline text-on-surface">Agenda Repository Empty</h4>
                      <p className="text-[10px] font-black text-on-surface-variant/40 uppercase tracking-[0.2em] mt-2">Scheduled sessions will appear in this timeline</p>
                    </div>
                  </div>
                ) : (
                  sessionItems.map((item, index) => (
                    <SortableSessionItem
                      key={item.id}
                      index={index + 1}
                      item={item}
                      availableTimers={availableTimers}
                      availablePolls={availablePolls}
                      loading={loading}
                      onTimerControl={handleTimerControl}
                      onPollToggle={handlePollToggle}
                      onEditSession={handleEditSession}
                      onDeleteSession={handleDeleteSession}
                      onActivateItem={handleActivateItem}
                      onCompleteItem={handleCompleteItem}
                      formatTime={formatTime}
                    />
                  ))
                )}
              </div>
            </SortableContext>
          </DndContext>
        </section>

        {/* Right — Controls sidebar */}
        <aside className="lg:col-span-4 space-y-5">

          {/* New Agenda Entry Form */}
          <div className="bg-white border border-outline-variant/10 rounded-3xl p-6 shadow-sm space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>post_add</span>
              </div>
              <div>
                <h3 className="text-sm font-headline font-black text-on-surface">
                  {editingSessionId ? 'Edit Agenda Item' : 'New Agenda Entry'}
                </h3>
                <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/40 font-headline mt-0.5">
                  {editingSessionId ? 'Updating existing item' : 'Add to session agenda'}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-on-surface-variant/50 uppercase tracking-[0.3em] font-headline">Title of the Item</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-surface-container-high border border-outline-variant/10 rounded-2xl px-4 py-3 text-sm font-bold text-on-surface focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-on-surface-variant/30 outline-none"
                  placeholder="e.g. Question Hour"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-on-surface-variant/50 uppercase tracking-[0.3em] font-headline">Type</label>
                <input
                  value={billType}
                  onChange={(e) => setBillType(e.target.value)}
                  placeholder="e.g. Question Hour"
                  className="w-full bg-surface-container-high border border-outline-variant/10 rounded-2xl px-3 py-3 text-sm font-bold text-on-surface focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-on-surface-variant/30"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-on-surface-variant/50 uppercase tracking-[0.3em] font-headline">Link Timer</label>
                  <div className="relative">
                    <select
                      value={linkedTimerId}
                      onChange={(e) => setLinkedTimerId(e.target.value)}
                      className="w-full appearance-none bg-surface-container-high border border-outline-variant/10 rounded-2xl pl-3 pr-8 py-3 text-xs font-bold text-on-surface focus:ring-2 focus:ring-primary/20 outline-none transition-all cursor-pointer"
                    >
                      <option value="">None</option>
                      {availableTimers.map(t => (
                        <option key={t.id} value={t.id}>{t.title}</option>
                      ))}
                    </select>
                    <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-on-surface-variant/40 text-base">expand_more</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-on-surface-variant/50 uppercase tracking-[0.3em] font-headline">Link Poll</label>
                  <div className="relative">
                    <select
                      value={linkedPollId}
                      onChange={(e) => setLinkedPollId(e.target.value)}
                      className="w-full appearance-none bg-surface-container-high border border-outline-variant/10 rounded-2xl pl-3 pr-8 py-3 text-xs font-bold text-on-surface focus:ring-2 focus:ring-primary/20 outline-none transition-all cursor-pointer"
                    >
                      <option value="">None</option>
                      {availablePolls.map(p => (
                        <option key={p.id} value={p.id}>{p.title}</option>
                      ))}
                    </select>
                    <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-on-surface-variant/40 text-base">expand_more</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => { setTitle(""); setBillType(""); setDescription(""); setLinkedTimerId(""); setLinkedPollId(""); setEditingSessionId(null); }}
                  className="flex-1 py-3 rounded-full border border-outline-variant/20 text-[10px] font-black uppercase tracking-widest text-on-surface-variant bg-surface-container hover:bg-surface-container-high transition-all font-headline"
                >
                  {editingSessionId ? 'Cancel' : 'Reset'}
                </button>
                <button
                  onClick={handleCreateSession}
                  className="flex-1 py-3 rounded-full bg-gradient-to-r from-primary to-primary-container text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all font-headline flex items-center justify-center gap-1.5"
                >
                  {editingSessionId ? 'Update' : 'Schedule'} <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>

          {/* Procedure Control Panel */}
          <div className="bg-gradient-to-br from-primary to-primary-container text-white rounded-3xl p-7 relative overflow-hidden shadow-xl shadow-primary/20 border border-white/5">
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -mr-20 -mt-20 blur-3xl pointer-events-none" />
            <div className="relative z-10">
              <h2 className="text-sm font-headline font-black mb-6 flex items-center gap-2.5 text-white">
                <span className="material-symbols-outlined text-white text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>shield_with_house</span>
                Procedure Control
              </h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3.5 bg-white/10 rounded-2xl border border-white/5 hover:bg-white/15 transition-colors">
                  <div>
                    <span className="text-xs font-bold text-white/90 block">Automatic Transition</span>
                    <span className="text-[9px] font-black uppercase tracking-widest text-white/50">Timed sequence flow</span>
                  </div>
                  <Switch
                    checked={autoTransition}
                    onCheckedChange={(v) => { setAutoTransition(v); updateProcedureSetting('auto_transition_enabled', v); }}
                    className="data-[state=checked]:bg-tertiary-container"
                  />
                </div>
                <div className="flex items-center justify-between p-3.5 bg-white/10 rounded-2xl border border-white/5 hover:bg-white/15 transition-colors">
                  <div>
                    <span className="text-xs font-bold text-white/90 block">Member Notifications</span>
                    <span className="text-[9px] font-black uppercase tracking-widest text-white/50">Real-time push alerts</span>
                  </div>
                  <Switch
                    checked={memberNotifications}
                    onCheckedChange={(v) => { setMemberNotifications(v); updateProcedureSetting('notifications_enabled', v); }}
                    className="data-[state=checked]:bg-tertiary-container"
                  />
                </div>
              </div>
              <button
                onClick={() => toast({ title: "Recess Initiated", description: "Parliamentary break active." })}
                className="w-full mt-6 py-3 bg-white text-primary rounded-2xl font-headline font-black text-[10px] uppercase tracking-widest hover:bg-white/95 active:scale-95 transition-all shadow-xl shadow-black/10"
              >
                Immediate Recess
              </button>
            </div>
          </div>

        </aside>
      </div>
    </div>
  );
};
