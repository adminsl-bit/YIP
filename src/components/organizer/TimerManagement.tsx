import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
    Play, Pause, Square, RotateCcw, Plus, 
    History, Mic2, Save, SkipForward, ArrowRight,
    Bell, Settings, ExternalLink, Moon, Sun, 
    Monitor, Mic, MapPin, MessageSquare, Receipt, 
    Zap, Landmark, Clock, RefreshCw
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
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

    // Form States
    const [newTimerTitle, setNewTimerTitle] = useState("");
    const [minutes, setMinutes] = useState(5);
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
            case 'pause': updates = { status: 'paused' }; break;
            case 'stop': updates = { status: 'stopped' }; break;
            case 'reset': updates = { status: 'stopped', remaining_seconds: timer.duration_seconds, completed_at: null }; break;
        }

        const { error } = await supabase.from('timer_sessions').update(updates).eq('id', timerId);
        if (error) toast({ title: "Action Failed", variant: "destructive" });
        else fetchTimerSessions();
    };

    const handleToggleActive = async (timerId: string, currentActive: boolean) => {
        if (!currentActive) await supabase.from('timer_sessions').update({ is_active: false }).neq('id', timerId);
        await supabase.from('timer_sessions').update({ is_active: !currentActive }).eq('id', timerId);
        fetchTimerSessions();
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
        <div className="space-y-8 animate-fade-in">
            {/* Page Header */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>

                    <h2 className="text-3xl font-black text-slate-900 dark:text-white font-headline tracking-tighter mt-1">Parliament Control Center</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-xs font-bold mt-2 uppercase tracking-widest opacity-70">2026 National Youth Assembly • Session IV</p>
                </div>
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => window.open('/display/timer', '_blank')}
                        className="hidden md:flex items-center gap-3 px-6 py-2.5 bg-[#1A3192] text-white rounded-xl shadow-lg shadow-[#1A3192]/20 hover:bg-blue-800 transition-all font-black uppercase tracking-widest text-[10px]"
                    >
                        <ExternalLink className="w-4 h-4" /> Open Display
                    </button>

                </div>
            </header>

            <div className="grid grid-cols-12 gap-8">
                {/* Left Column (8 Spans) */}
                <div className="col-span-12 lg:col-span-8 space-y-8">
                    {/* Sovereign Timer Card */}
                    <div className="relative overflow-hidden bg-[#1A3192] p-12 md:p-16 rounded-[3rem] text-white shadow-2xl shadow-[#1A3192]/20 border border-white/5">
                        <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
                            <Clock className="w-[300px] h-[300px] -rotate-12" />
                        </div>
                        
                        <div className="relative z-10 flex flex-col items-center text-center">


                            <div className="font-mono text-9xl md:text-[160px] font-black tracking-tighter leading-none mb-14 drop-shadow-[0_0_50px_rgba(255,255,255,0.2)]">
                                {formatTimeSimple(remaining)}
                            </div>

                            <div className="flex flex-wrap items-center justify-center gap-6">
                                <button 
                                    onClick={() => activeTimer && handleTimerControl(activeTimer.id, activeTimer.status === 'running' ? 'pause' : 'start')}
                                    className="group flex items-center gap-4 px-10 py-5 bg-white text-[#1A3192] rounded-[1.5rem] font-black hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-black/20 uppercase tracking-widest text-xs"
                                >
                                    {activeTimer?.status === 'running' ? <><Pause className="w-5 h-5 fill-[#1A3192]" /> Pause Session</> : <><Play className="w-5 h-5 fill-[#1A3192]" /> Resume Session</>}
                                </button>
                                
                                <button 
                                    onClick={() => activeTimer && handleTimerControl(activeTimer.id, 'reset')}
                                    className="group flex items-center gap-4 px-8 py-5 bg-white/10 hover:bg-white/20 backdrop-blur-xl text-white rounded-[1.5rem] font-black transition-all border border-white/20 uppercase tracking-widest text-xs"
                                >
                                    <RotateCcw className="w-5 h-5" /> Reset
                                </button>

                                <button 
                                    onClick={() => activeTimer && handleTimerControl(activeTimer.id, 'stop')}
                                    className="group flex items-center gap-4 px-8 py-5 bg-[#E63946]/80 hover:bg-[#E63946] text-white rounded-[1.5rem] font-black transition-all border border-white/20 uppercase tracking-widest text-xs shadow-xl shadow-[#E63946]/20"
                                >
                                    <Square className="w-5 h-5 fill-white" /> Terminate
                                </button>
                            </div>
                        </div>
                    </div>


                </div>

                {/* Right Column (4 Spans) */}
                <div className="col-span-12 lg:col-span-4 space-y-8">
                    {/* Timer Presets */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-[2.5rem] shadow-sm">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Timer Presets</h3>
                            <button className="text-[#1A3192] dark:text-blue-400 hover:underline text-[10px] font-black uppercase tracking-widest">Edit List</button>
                        </div>
                        <div className="space-y-3">
                            {timerSessions.map(timer => (
                                <button 
                                    key={timer.id}
                                    onClick={() => handleToggleActive(timer.id, timer.is_active)}
                                    className={`w-full flex items-center justify-between p-5 rounded-2xl transition-all group border ${timer.is_active ? 'bg-[#1A3192] text-white border-transparent shadow-xl shadow-[#1A3192]/20' : 'bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-900 dark:text-slate-100'}`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${timer.is_active ? 'bg-white/20' : 'bg-[#1A3192]/10 text-[#1A3192]'}`}>
                                            <MessageSquare className="w-5 h-5" />
                                        </div>
                                        <span className="font-black text-sm tracking-tight">{timer.title}</span>
                                    </div>
                                    <span className="font-mono font-black text-[#FFD700]">{formatTimeSimple(timer.duration_seconds)}</span>
                                </button>
                            ))}
                            
                            <button 
                                onClick={() => setShowCreateDialog(true)}
                                className="w-full flex items-center gap-4 p-5 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all text-slate-400 group"
                            >
                                <Plus className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                <span className="font-black text-xs uppercase tracking-widest">Custom Timer Setup</span>
                            </button>
                        </div>
                    </div>


                </div>
            </div>



            {/* Modal */}
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogContent className="rounded-[2.5rem] p-12 border-none shadow-2xl dark:bg-slate-900">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black font-headline text-[#1A3192] dark:text-blue-400 tracking-tighter">Initialize Sovereign Timer</DialogTitle>
                        <DialogDescription className="text-slate-500 dark:text-slate-400 font-bold leading-relaxed mt-3">
                            Enter specialized duration parameters for the upcoming motion.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-8 py-10">
                        <div className="space-y-3">
                            <Label className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 ml-1">Motion Identifier</Label>
                            <Input
                                placeholder="e.g. Constitutional Amendment #4"
                                value={newTimerTitle}
                                onChange={(e) => setNewTimerTitle(e.target.value)}
                                className="h-16 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-800 focus:ring-4 focus:ring-[#1A3192]/10 font-black text-lg px-6"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-8">
                            <div className="space-y-3">
                                <Label className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 ml-1">Minutes</Label>
                                <Input
                                    type="number"
                                    value={minutes}
                                    onChange={(e) => setMinutes(parseInt(e.target.value) || 0)}
                                    className="h-20 text-center text-4xl font-black rounded-3xl border-slate-200 dark:border-slate-700 dark:bg-slate-800"
                                />
                            </div>
                            <div className="space-y-3">
                                <Label className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 ml-1">Seconds</Label>
                                <Input
                                    type="number"
                                    value={seconds}
                                    onChange={(e) => setSeconds(parseInt(e.target.value) || 0)}
                                    className="h-20 text-center text-4xl font-black rounded-3xl border-slate-200 dark:border-slate-700 dark:bg-slate-800"
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="gap-6 pt-6">
                        <Button variant="outline" onClick={() => setShowCreateDialog(false)} className="h-16 rounded-2xl px-12 font-black uppercase tracking-widest text-xs border-slate-200 dark:border-slate-700">Discard</Button>
                        <Button onClick={() => handleCreateTimer(newTimerTitle, minutes, seconds)} className="h-16 rounded-2xl px-12 bg-[#1A3192] hover:bg-blue-800 font-black uppercase tracking-widest text-xs shadow-xl shadow-[#1A3192]/20"> Deploy Timer <ArrowRight className="ml-3 w-4 h-4" /></Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};
