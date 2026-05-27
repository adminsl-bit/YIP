import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Play, Pause, Square, RotateCcw, Plus, ArrowRight, ExternalLink, Clock, Pencil, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

interface TimerSession {
  id: string;
  title: string;
  duration_seconds: number;
  remaining_seconds: number;
  status: 'stopped' | 'running' | 'paused' | 'completed';
  is_active: boolean;
  created_at: string;
  updated_at: string;
  sort_order: number;
}

interface AuditLog {
    id: string;
    action: string;
    details: any;
    created_at: string;
}

export const TimerManagement = () => {
    const { user } = useAuth();
    const [timerSessions, setTimerSessions] = useState<TimerSession[]>([]);
    const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(false);
    
    // Dialog States
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [editingTimer, setEditingTimer] = useState<TimerSession | null>(null);

    // Form States
    const [newTimerTitle, setNewTimerTitle] = useState("");
    const [hours, setHours] = useState(0);
    const [minutes, setMinutes] = useState(0);
    const [seconds, setSeconds] = useState(0);

    // Timing Logic Refs
    const [nowTs, setNowTs] = useState<number>(Date.now());
    const clockOffsetRef = useRef<number>(0);
    const lastRenderRemainingRef = useRef<Record<string, number>>({});

    useEffect(() => {
        calibrateClock();
        fetchTimerSessions();
        fetchAuditLogs();

        const tickerId = window.setInterval(() => setNowTs(Date.now()), 250);
        
        const subscription = supabase
            .channel('timer_mgmt_sovereign')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'timer_sessions' }, () => fetchTimerSessions())
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'audit_logs' }, () => fetchAuditLogs())
            .subscribe();

        return () => {
            window.clearInterval(tickerId);
            subscription.unsubscribe();
        };
    }, []);

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
        } catch (e) { console.warn('Clock calibration failed', e); }
    };

    const fetchTimerSessions = async () => {
        const { data, error } = await supabase
            .from('timer_sessions')
            .select('*')
            .order('sort_order', { ascending: true });
        if (!error) setTimerSessions(data as any as TimerSession[]);
    };

    const fetchAuditLogs = async () => {
        const { data, error } = await supabase
            .from('audit_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(5);
        if (!error) setAuditLogs(data as AuditLog[]);
    };

    const handleCreateTimer = async (title: string, m: number, s: number = 0) => {
        if (!user) return;
        const totalSeconds = m * 60 + s;
        setLoading(true);
        const { error } = await supabase.from('timer_sessions').insert({
            title,
            duration_seconds: totalSeconds,
            remaining_seconds: totalSeconds,
            status: 'stopped',
            is_active: false,
            created_by: user.id,
            sort_order: timerSessions.length
        } as any);
        setLoading(false);
        if (!error) {
            fetchTimerSessions();
            setShowCreateDialog(false);
            toast({ title: `Preset "${title}" Created` });
        }
    };

    const handleTimerControl = async (timerId: string, action: 'start' | 'pause' | 'stop' | 'reset') => {
        const timer = timerSessions.find(t => t.id === timerId);
        if (!timer) return;

        let updates: any = {};
        switch (action) {
            case 'start': updates = { status: 'running', started_at: new Date().toISOString() }; break;
            case 'pause': {
                const serverNow = Date.now() + clockOffsetRef.current;
                const updatedAt = Date.parse(timer.updated_at);
                const elapsed = Math.max(0, Math.floor((serverNow - updatedAt) / 1000));
                updates = { status: 'paused', remaining_seconds: Math.max(0, timer.remaining_seconds - elapsed) };
                break;
            }
            case 'stop': updates = { status: 'stopped' }; break;
            case 'reset': updates = { status: 'stopped', remaining_seconds: timer.duration_seconds, completed_at: null }; break;
        }

        const { error } = await supabase.from('timer_sessions').update(updates).eq('id', timerId);
        if (error) toast({ title: "Action Failed", variant: "destructive" });
        else fetchTimerSessions();
    };

    const handleToggleActive = async (timerId: string, currentActive: boolean) => {
        const timer = timerSessions.find(t => t.id === timerId);
        // Deactivate all others first
        if (!currentActive) await supabase.from('timer_sessions').update({ is_active: false }).neq('id', timerId);
        // When (re)activating, reset if completed so it's immediately usable
        const updates: any = { is_active: !currentActive };
        if (!currentActive && (timer?.status === 'completed' || timer?.status === 'stopped')) {
            updates.status = 'stopped';
            updates.remaining_seconds = timer.duration_seconds;
        }
        await supabase.from('timer_sessions').update(updates).eq('id', timerId);
        fetchTimerSessions();
    };

    const handleEditTimer = (timer: TimerSession) => {
        setEditingTimer(timer);
        setNewTimerTitle(timer.title);
        setHours(Math.floor(timer.duration_seconds / 3600));
        setMinutes(Math.floor((timer.duration_seconds % 3600) / 60));
        setSeconds(timer.duration_seconds % 60);
        setShowCreateDialog(true);
    };

    const handleDeleteTimer = async (timerId: string) => {
        const { error } = await supabase.from('timer_sessions').delete().eq('id', timerId);
        if (error) toast({ title: "Delete Failed", variant: "destructive" });
        else { fetchTimerSessions(); toast({ title: "Timer Deleted" }); }
    };

    const handleSaveTimer = async () => {
        const totalSeconds = hours * 3600 + minutes * 60 + seconds;
        if (editingTimer) {
            const { error } = await supabase.from('timer_sessions').update({
                title: newTimerTitle,
                duration_seconds: totalSeconds,
                remaining_seconds: totalSeconds,
            }).eq('id', editingTimer.id);
            if (!error) { fetchTimerSessions(); toast({ title: "Timer Updated" }); }
            else toast({ title: "Update Failed", variant: "destructive" });
        } else {
            await handleCreateTimer(newTimerTitle, hours * 60 + minutes, seconds);
        }
        setShowCreateDialog(false);
        setEditingTimer(null);
        setNewTimerTitle("");
        setHours(0);
        setMinutes(0);
        setSeconds(0);
    };

    const getDisplayedRemaining = (timer: TimerSession) => {
        if (timer.status !== 'running') {
            lastRenderRemainingRef.current[timer.id] = timer.remaining_seconds;
            return timer.remaining_seconds;
        }
        const serverNow = nowTs + clockOffsetRef.current;
        const updatedAt = Date.parse((timer as any).updated_at);
        const elapsed = Math.max(0, Math.floor((serverNow - updatedAt) / 1000));
        const computed = Math.max(0, timer.remaining_seconds - elapsed);
        const last = lastRenderRemainingRef.current[timer.id];
        const monotonic = last === undefined ? computed : Math.min(last, computed);
        lastRenderRemainingRef.current[timer.id] = monotonic;
        return monotonic;
    };

    const activeTimer = timerSessions.find(t => t.is_active) || timerSessions[0];
    const remaining = activeTimer ? getDisplayedRemaining(activeTimer) : 0;

    const formatTimeSimple = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="flex flex-col gap-4 h-full min-h-0">

            {/* Top bar */}
            <div className="flex items-center justify-between shrink-0">
                <div>
                    <h2 className="text-xl font-extrabold font-headline tracking-tight text-primary">Session <span className="text-secondary">Timer</span></h2>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 font-headline">Countdown &amp; Time Management</p>
                </div>
                <button
                    onClick={() => window.open('/display/timer', '_blank')}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl shadow-sm shadow-primary/20 hover:bg-primary-container transition-all font-headline font-black uppercase tracking-widest text-[10px]"
                >
                    <ExternalLink className="w-3 h-3" /> Open Display
                </button>
            </div>

            {/* Body: hero+presets on left, instructions on right */}
            <div className="flex gap-4 flex-1 min-h-0">

            {/* Left column */}
            <div className="flex flex-col gap-4 flex-1 min-h-0">

                {/* Timer Hero */}
                <div className="flex-1 min-h-0">
                    <div className="relative overflow-hidden bg-gradient-to-br from-primary to-primary-container p-6 md:p-8 rounded-3xl text-white shadow-2xl shadow-primary/20 border border-white/5 h-full flex flex-col justify-center items-center text-center">
                        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
                            <Clock className="w-48 h-48 -rotate-12" />
                        </div>

                        <div className="relative z-10 flex flex-col items-center gap-6">
                            <div className="font-mono text-7xl md:text-[100px] lg:text-[110px] font-black tracking-tighter leading-none drop-shadow-[0_0_50px_rgba(255,255,255,0.15)]">
                                {formatTimeSimple(remaining)}
                            </div>

                            <div className="flex flex-wrap items-center justify-center gap-3">
                                <button
                                    onClick={() => activeTimer && handleTimerControl(activeTimer.id, activeTimer.status === 'running' ? 'pause' : 'start')}
                                    className="flex items-center gap-2 px-7 py-3 bg-white text-primary rounded-full font-headline font-black hover:scale-[1.03] active:scale-95 transition-all shadow-xl shadow-black/20 uppercase tracking-widest text-xs"
                                >
                                    {activeTimer?.status === 'running'
                                        ? <><Pause className="w-4 h-4 fill-primary" /> Pause</>
                                        : <><Play className="w-4 h-4 fill-primary" /> Start</>}
                                </button>

                                <button
                                    onClick={() => activeTimer && handleTimerControl(activeTimer.id, 'reset')}
                                    className="flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 backdrop-blur-xl text-white rounded-full font-headline font-black transition-all border border-white/20 uppercase tracking-widest text-xs"
                                >
                                    <RotateCcw className="w-3.5 h-3.5" /> Reset
                                </button>

                                <button
                                    onClick={() => activeTimer && handleTimerControl(activeTimer.id, 'stop')}
                                    className="flex items-center gap-2 px-6 py-3 bg-error/80 hover:bg-error text-white rounded-full font-headline font-black transition-all uppercase tracking-widest text-xs shadow-xl shadow-error/20"
                                >
                                    <Square className="w-3.5 h-3.5 fill-white" /> Stop
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Timer Presets — horizontal strip below hero */}
                <div className="shrink-0 bg-white border border-outline-variant/10 p-4 rounded-3xl shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-on-surface-variant font-headline">Timer Presets</h3>
                        <button
                            onClick={() => setShowCreateDialog(true)}
                            className="flex items-center gap-1.5 text-primary text-[10px] font-black uppercase tracking-widest font-headline hover:text-primary-container transition-colors"
                        >
                            <Plus className="w-3 h-3" /> New
                        </button>
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                        {timerSessions.map(timer => (
                            <div
                                key={timer.id}
                                className={`group flex-none flex items-center gap-2.5 p-2.5 pr-3 rounded-2xl transition-all border cursor-pointer ${
                                    timer.is_active
                                        ? 'bg-primary text-white border-transparent shadow-lg shadow-primary/20'
                                        : 'bg-surface-container hover:bg-surface-container-high border-outline-variant/10 text-on-surface'
                                }`}
                            >
                                <button
                                    onClick={() => handleToggleActive(timer.id, timer.is_active)}
                                    className="flex items-center gap-2.5 min-w-0 text-left"
                                >
                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${timer.is_active ? 'bg-white/20' : 'bg-primary/8 text-primary'}`}>
                                        <Clock className="w-3.5 h-3.5" />
                                    </div>
                                    <div className="min-w-0">
                                        <span className="font-headline font-bold text-xs tracking-tight block whitespace-nowrap">{timer.title}</span>
                                        <span className={`font-mono font-black text-[10px] ${timer.is_active ? 'text-white/70' : 'text-on-surface-variant'}`}>
                                            {formatTimeSimple(timer.duration_seconds)}
                                        </span>
                                    </div>
                                </button>

                                {/* Edit / Delete — visible on hover */}
                                <div className="flex items-center gap-0.5 ml-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                    <button
                                        onClick={() => handleEditTimer(timer)}
                                        className={`p-1 rounded-lg transition-colors ${timer.is_active ? 'hover:bg-white/20 text-white/80' : 'hover:bg-primary/10 text-on-surface-variant hover:text-primary'}`}
                                    >
                                        <Pencil className="w-3 h-3" />
                                    </button>
                                    <button
                                        onClick={() => handleDeleteTimer(timer.id)}
                                        className={`p-1 rounded-lg transition-colors ${timer.is_active ? 'hover:bg-white/20 text-white/80' : 'hover:bg-error/10 text-on-surface-variant hover:text-error'}`}
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                        ))}

                        {timerSessions.length === 0 && (
                            <p className="text-[10px] text-on-surface-variant/50 font-bold uppercase tracking-widest py-2">No presets yet</p>
                        )}

                        {/* Add button inline */}
                        <button
                            onClick={() => setShowCreateDialog(true)}
                            className="flex-none flex items-center gap-1.5 px-4 py-2.5 border border-dashed border-outline-variant/30 rounded-2xl hover:bg-surface-container transition-all text-on-surface-variant/50 group"
                        >
                            <Plus className="w-3 h-3 group-hover:scale-110 transition-transform" />
                            <span className="font-headline font-black text-[10px] uppercase tracking-widest whitespace-nowrap">Add Timer</span>
                        </button>
                    </div>
                </div>

            </div>{/* end left column */}

            {/* Right — Instructions pane */}
            <div className="w-64 shrink-0 flex flex-col gap-3 overflow-y-auto">

                {/* How to use */}
                <div className="bg-white border border-outline-variant/10 rounded-3xl p-5 shadow-sm">
                    <p className="text-[9px] font-black uppercase tracking-[0.3em] text-on-surface-variant/40 font-headline mb-4">How to Use</p>
                    <div className="space-y-4">
                        {[
                            { step: '01', icon: 'touch_app',    title: 'Select a Preset',   desc: 'Click any preset card below to activate it and load its duration.' },
                            { step: '02', icon: 'play_circle',  title: 'Start the Timer',   desc: 'Press Start. The clock counts down in real-time across all devices.' },
                            { step: '03', icon: 'pause_circle', title: 'Pause or Stop',     desc: 'Pause keeps time. Stop ends the session. Reset restores full duration.' },
                            { step: '04', icon: 'add_circle',   title: 'Create Presets',    desc: 'Use + New to save a named duration for repeated motions or rounds.' },
                        ].map(item => (
                            <div key={item.step} className="flex gap-3">
                                <div className="shrink-0 w-7 h-7 rounded-xl bg-primary/8 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-primary text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>{item.icon}</span>
                                </div>
                                <div>
                                    <p className="font-headline font-bold text-xs text-on-surface tracking-tight">{item.title}</p>
                                    <p className="font-body text-[10px] text-on-surface-variant/60 leading-relaxed mt-0.5">{item.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Display tip */}
                <div className="bg-primary/5 border border-primary/10 rounded-3xl p-5">
                    <div className="flex items-start gap-3">
                        <span className="material-symbols-outlined text-primary text-xl shrink-0 mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>display_settings</span>
                        <div>
                            <p className="font-headline font-bold text-xs text-primary tracking-tight">Live Display</p>
                            <p className="font-body text-[10px] text-on-surface-variant/60 leading-relaxed mt-1">
                                Click <span className="font-bold text-primary">Open Display</span> to open the fullscreen timer on your projector or second screen. It syncs automatically.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Keyboard shortcut note */}
                <div className="bg-surface-container rounded-3xl p-4 border border-outline-variant/10">
                    <p className="text-[9px] font-black uppercase tracking-[0.3em] text-on-surface-variant/40 font-headline mb-3">Status Guide</p>
                    <div className="space-y-2">
                        {[
                            { color: 'bg-tertiary-container', label: 'Running',   desc: 'Timer active' },
                            { color: 'bg-secondary',          label: 'Warning',   desc: 'Under 1 min' },
                            { color: 'bg-error',              label: 'Critical',  desc: 'Under 10 sec' },
                            { color: 'bg-outline-variant',    label: 'Paused',    desc: 'On hold' },
                        ].map(s => (
                            <div key={s.label} className="flex items-center gap-2.5">
                                <span className={`w-2 h-2 rounded-full shrink-0 ${s.color}`} />
                                <span className="font-headline font-bold text-[10px] text-on-surface w-14">{s.label}</span>
                                <span className="font-body text-[10px] text-on-surface-variant/50">{s.desc}</span>
                            </div>
                        ))}
                    </div>
                </div>

            </div>{/* end right pane */}

            </div>{/* end body row */}

            {/* Create / Edit Timer Dialog */}
            <Dialog open={showCreateDialog} onOpenChange={(open) => {
                setShowCreateDialog(open);
                if (!open) { setEditingTimer(null); setNewTimerTitle(""); setHours(0); setMinutes(0); setSeconds(0); }
            }}>
                <DialogContent className="max-w-md rounded-3xl p-0 border-0 shadow-[0_8px_32px_rgba(67,85,185,0.12)] overflow-hidden bg-surface-container-lowest">

                    {/* Gradient header band */}
                    <div className="bg-gradient-to-br from-primary to-primary-container px-8 pt-8 pb-10">
                        <DialogTitle className="text-2xl font-extrabold font-headline text-white tracking-tight">
                            {editingTimer ? <>Edit <span className="text-white/70">Timer</span></> : <>New <span className="text-white/70">Timer</span></>}
                        </DialogTitle>
                        <DialogDescription className="text-white/60 font-body text-sm leading-relaxed mt-1">
                            {editingTimer ? "Update title or duration — preset resets to new time." : "Set a title and duration for the upcoming motion."}
                        </DialogDescription>
                    </div>

                    {/* Body — lifted above gradient */}
                    <div className="px-8 pt-6 pb-8 space-y-6 -mt-4 bg-surface-container-lowest rounded-t-3xl relative">

                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-on-surface-variant/60 font-headline">Motion Title</Label>
                            <Input
                                placeholder="e.g. Constitutional Amendment #4"
                                value={newTimerTitle}
                                onChange={(e) => setNewTimerTitle(e.target.value)}
                                className="h-12 rounded-2xl border border-outline-variant/20 bg-surface-container-high focus:bg-surface-container-lowest focus:border-primary/20 focus:ring-0 font-body text-sm px-4 text-on-surface placeholder:text-on-surface-variant/30"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-on-surface-variant/60 font-headline">Duration</Label>
                            <div className="grid grid-cols-3 gap-3">
                                <div className="relative">
                                    <Input
                                        type="number"
                                        value={hours}
                                        onChange={(e) => setHours(Math.max(0, parseInt(e.target.value) || 0))}
                                        className="h-20 text-center text-5xl font-black rounded-3xl border border-outline-variant/20 bg-surface-container-high focus:bg-surface-container-lowest focus:border-primary/20 focus:ring-0 text-primary font-mono pb-5"
                                    />
                                    <span className="absolute bottom-2 left-0 right-0 text-center text-[9px] font-black uppercase tracking-widest text-on-surface-variant/40 font-headline">hr</span>
                                </div>
                                <div className="relative">
                                    <Input
                                        type="number"
                                        value={minutes}
                                        onChange={(e) => setMinutes(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                                        className="h-20 text-center text-5xl font-black rounded-3xl border border-outline-variant/20 bg-surface-container-high focus:bg-surface-container-lowest focus:border-primary/20 focus:ring-0 text-primary font-mono pb-5"
                                    />
                                    <span className="absolute bottom-2 left-0 right-0 text-center text-[9px] font-black uppercase tracking-widest text-on-surface-variant/40 font-headline">min</span>
                                </div>
                                <div className="relative">
                                    <Input
                                        type="number"
                                        value={seconds}
                                        onChange={(e) => setSeconds(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                                        className="h-20 text-center text-5xl font-black rounded-3xl border border-outline-variant/20 bg-surface-container-high focus:bg-surface-container-lowest focus:border-primary/20 focus:ring-0 text-primary font-mono pb-5"
                                    />
                                    <span className="absolute bottom-2 left-0 right-0 text-center text-[9px] font-black uppercase tracking-widest text-on-surface-variant/40 font-headline">sec</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={() => setShowCreateDialog(false)}
                                className="flex-1 h-12 rounded-full border border-outline-variant/20 bg-surface-container text-on-surface-variant font-headline font-black uppercase tracking-widest text-xs hover:bg-surface-container-high transition-colors"
                            >
                                Discard
                            </button>
                            <button
                                onClick={handleSaveTimer}
                                className="flex-1 h-12 rounded-full bg-gradient-to-r from-primary to-primary-container text-white font-headline font-black uppercase tracking-widest text-xs shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                            >
                                {editingTimer ? "Save" : "Deploy"} <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                </DialogContent>
            </Dialog>

        </div>
    );
};
