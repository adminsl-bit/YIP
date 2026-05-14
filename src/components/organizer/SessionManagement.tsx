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
import { SessionSubItems } from "./SessionSubItems";
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
  const [billType, setBillType] = useState<string>("government_bill");
  const [description, setDescription] = useState("");
  const [linkedTimerId, setLinkedTimerId] = useState<string>("");
  const [linkedPollId, setLinkedPollId] = useState<string>("");

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
          console.log('[SessionManagement] Clock offset calibrated:', clockOffsetRef.current, 'ms');
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
                updated_at: newRow.updated_at
              } : t);
            }
            if (eventType === 'INSERT' && newRow) {
              const inserted = {
                id: newRow.id,
                title: newRow.title,
                status: newRow.status,
                remaining_seconds: newRow.remaining_seconds,
                duration_seconds: newRow.duration_seconds,
                updated_at: newRow.updated_at
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
        .select('id, title, status, remaining_seconds, duration_seconds, updated_at')
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

    console.log('Poll toggle called - Poll ID:', pollId, 'Current Active:', currentActive, 'Will set to:', !currentActive);

    // Don't use global loading state to prevent flickering
    try {
      const { error } = await supabase
        .from('polls')
        .update({ is_active: !currentActive })
        .eq('id', pollId);

      if (error) throw error;

      console.log('Poll updated successfully to is_active:', !currentActive);

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

  const handleExpandChange = (itemId: string, value: string) => {
    setExpandedAccordions(prev => ({
      ...prev,
      [itemId]: value
    }));
  };

  const activeTimer = sessionItems.find(item => item.is_active)?.timer_id ? availableTimers.find(t => t.id === sessionItems.find(item => item.is_active)?.timer_id) : null;

  return (
    <div className="space-y-12 pb-20 animate-in fade-in duration-700">
      {/* Header Section */}
      <header className="flex flex-col lg:flex-row justify-between lg:items-end gap-6 mb-4">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#6ffbbe] text-[#002113] rounded-full text-[10px] font-black uppercase tracking-widest mb-6 shadow-sm shadow-[#6ffbbe]/20">
            <span className="w-2 h-2 rounded-full bg-[#005236] animate-pulse"></span>
            ACTIVE SESSION: MONSOON SUMMIT 2024
          </div>
          <h1 className="text-5xl font-extrabold tracking-tighter text-[#191c1e] mb-3 font-headline">Session Management</h1>
          <p className="text-[#454653] font-bold text-sm leading-relaxed max-w-2xl">
            Orchestrate parliamentary procedures, manage live debates, and coordinate legislative timing from a single diplomat portal.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => window.open('/display/session', '_blank')}
            className="group flex items-center gap-3 px-6 py-3.5 bg-white text-[#13298f] border border-[#13298f]/10 rounded-2xl shadow-sm hover:shadow-md transition-all font-black uppercase tracking-widest text-[10px]"
          >
            <ExternalLink className="w-4 h-4 transition-transform group-hover:rotate-12" /> Open Public View
          </button>
          <button 
            onClick={() => setShowCreateDialog(true)}
            className="px-6 py-3.5 bg-gradient-to-r from-[#13298f] to-[#3042a6] text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-blue-900/20 hover:scale-[1.03] active:scale-95 transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Assemble Agenda Item
          </button>
        </div>
      </header>



      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Agenda Timeline Section */}
        <section className="lg:col-span-8 bg-[#f2f4f6] rounded-[2.5rem] p-10 border border-slate-200/50">
          <div className="flex justify-between items-center mb-10">
            <h2 className="text-2xl font-black text-[#191c1e] tracking-tight">Scheduled Agenda Items</h2>
            <div className="flex gap-2">
              <span className="px-4 py-1.5 bg-white rounded-full text-[10px] font-black uppercase tracking-widest text-slate-500 border border-slate-100 shadow-sm">
                {sessionItems.filter(i => i.status === 'pending').length} Remaining
              </span>
              <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-sm transition-all ${sessionItems.some(i => i.is_active) ? 'bg-[#ffdbd0] text-[#852300] border-[#ffb59f]' : 'bg-[#dee0ff] text-[#13298f] border-[#bac3ff]'}`}>
                {sessionItems.filter(i => i.status === 'completed').length} Completed
              </span>
            </div>
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={sessionItems.map(i => i.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-6">
                {sessionItems.length === 0 ? (
                  <div className="bg-white border-2 border-dashed border-slate-100 rounded-[3rem] p-24 text-center flex flex-col items-center justify-center gap-8 group">
                    <div className="size-28 rounded-full bg-slate-50 flex items-center justify-center text-slate-200 shadow-inner group-hover:scale-110 transition-transform">
                      <Landmark className="w-14 h-14" />
                    </div>
                    <div>
                      <h4 className="text-xl font-black text-[#191c1e]">Agenda Repository Empty</h4>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-3">Scheduled sessions will appear in this timeline</p>
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
                      expandedAccordions={expandedAccordions}
                      onExpandChange={handleExpandChange}
                      onTimerControl={handleTimerControl}
                      onPollToggle={handlePollToggle}
                      onPollResultsToggle={handlePollResultsToggle}
                      onEditSession={handleEditSession}
                      onDeleteSession={handleDeleteSession}
                      onActivateItem={handleActivateItem}
                      onCompleteItem={handleCompleteItem}
                      getBillTypeBadge={getBillTypeBadge}
                      getStatusBadge={getStatusBadge}
                      formatTime={formatTime}
                      getDisplayedRemaining={getDisplayedRemaining}
                    />
                  ))
                )}
              </div>
            </SortableContext>
          </DndContext>
        </section>

        {/* Sidebar Controls & Forms */}
        <aside className="lg:col-span-4 space-y-8">
          {/* Procedure Control Switchboard */}
          <div className="bg-[#13298f] text-white rounded-[2.5rem] p-10 relative overflow-hidden shadow-2xl shadow-blue-900/30">
            <div className="relative z-10">
              <h2 className="text-xl font-headline font-black mb-8 flex items-center gap-3">
                <span className="material-symbols-outlined text-emerald-400">shield_with_house</span>
                Procedure Control
              </h2>
              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-white/10 rounded-2xl hover:bg-white/15 transition-colors border border-white/5">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-white/90">Automatic Transition</span>
                    <span className="text-[9px] font-black uppercase tracking-widest text-[#afb9ff]">Timed sequence flow</span>
                  </div>
                  <Switch defaultChecked className="data-[state=checked]:bg-[#6ffbbe]" />
                </div>
                <div className="flex items-center justify-between p-4 bg-white/10 rounded-2xl hover:bg-white/15 transition-colors border border-white/5">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-white/90">Member Notifications</span>
                    <span className="text-[9px] font-black uppercase tracking-widest text-[#afb9ff]">Real-time push alerts</span>
                  </div>
                  <Switch className="data-[state=checked]:bg-[#6ffbbe]" />
                </div>
              </div>
              <button 
                onClick={() => toast({ title: "Recess Initiated", description: "Parliamentary break active." })}
                className="w-full mt-8 py-4 bg-white text-[#13298f] rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all active:scale-95 shadow-xl shadow-black/10"
              >
                 Immediate Recess
              </button>
            </div>
            {/* Visual Flair */}
            <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -mr-24 -mt-24 blur-3xl"></div>
          </div>

          {/* New Agenda Entry Form */}
          <div className="bg-white border border-slate-100 rounded-[2.5rem] p-10 shadow-sm space-y-8">
            <div className="flex items-center gap-4">
              <div className="size-12 rounded-2xl bg-slate-50 flex items-center justify-center text-[#13298f]">
                  <span className="material-symbols-outlined text-2xl">post_add</span>
              </div>
              <h3 className="text-xl font-headline font-black text-[#191c1e]">New Agenda Entry</h3>
            </div>
            
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Title of the Item</label>
                <input 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-[#f7f9fb] border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-[#13298f]/20 transition-all placeholder:text-slate-300" 
                  placeholder="e.g. Question Hour" 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Type</label>
                  <select 
                    value={billType}
                    onChange={(e) => setBillType(e.target.value)}
                    className="w-full bg-[#f7f9fb] border-none rounded-2xl px-4 py-4 text-[11px] font-black uppercase tracking-widest focus:ring-2 focus:ring-[#13298f]/20"
                  >
                    <option value="government_bill">Govt Bill</option>
                    <option value="private_member_bill">Private Bill</option>
                    <option value="question_hour">Question</option>
                    <option value="general_discussion">Discussion</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Duration</label>
                  <select className="w-full bg-[#f7f9fb] border-none rounded-2xl px-4 py-4 text-[11px] font-black uppercase tracking-widest focus:ring-2 focus:ring-[#13298f]/20">
                    <option>15 mins</option>
                    <option>30 mins</option>
                    <option>1 hour</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  onClick={() => { setTitle(""); setDescription(""); }}
                  className="flex-1 py-4 border border-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-all"
                >
                    Reset
                </button>
                <button 
                  onClick={handleCreateSession}
                  className="flex-1 py-4 bg-[#13298f] text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-900/10 hover:opacity-95 active:scale-95 transition-all"
                >
                    Schedule
                </button>
              </div>
            </div>
          </div>

          {/* Technical Support Mascot Card */}
          <div className="relative bg-gradient-to-br from-[#ffdbd0] to-[#ffb59f]/40 rounded-[2.5rem] p-10 overflow-visible h-48 flex items-center border border-[#ffdbd0]">
            <div className="relative z-10 w-3/5 space-y-3">
              <p className="text-[#852300] font-black text-lg leading-tight font-headline">Need technical assistance?</p>
              <button className="text-[10px] font-black text-[#ac3509] uppercase tracking-widest flex items-center gap-1.5 hover:gap-2 transition-all">
                  Chat with Support <span className="material-symbols-outlined text-sm font-black">arrow_forward</span>
              </button>
            </div>
            <img 
              alt="YI Parliament Mascot" 
              className="absolute -right-4 -bottom-4 w-44 h-44 object-contain drop-shadow-2x transition-transform hover:scale-105 duration-500" 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuB2LFH0vYk8C0j0AVVo4CRIhOniNE_ceNcIQIr5RkJeSQYGzAlDFiOjUaiaA647rvXcIn0fMwEJ-5rP2h0lHoknVI3FZCNUncpLNKV4Ydg3p5EfE8-mzp3cYWwZ6KhhZwWxrSdt2RGcQR83gZgjdxxuCteuU-VnOTPsWSup9HVrcg-c2LrgfT-UGNTACxJydHJYsPVmQZj9u4cmpAv7npVcqcLlzSkBAWd9ZnewT-KZhH5mTE202_Vhzdpvgc3Qhln7XwC6N-u6EJDC" 
            />
          </div>
        </aside>
      </div>
    </div>
  );
};
