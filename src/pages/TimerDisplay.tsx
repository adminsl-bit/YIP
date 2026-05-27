import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface TimerSession {
  id: string;
  title: string;
  duration_seconds: number;
  remaining_seconds: number;
  status: 'stopped' | 'running' | 'paused' | 'completed';
  updated_at: string;
  started_at: string | null;
}

const TimerDisplay = () => {
  const [timer, setTimer] = useState<TimerSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [colonVisible, setColonVisible] = useState(true);

  const rafRef        = useRef<number | null>(null);
  const recalibRef    = useRef<number | null>(null);
  const baselineRef   = useRef<{ remainingAtStart: number; startedAtMs: number } | null>(null);
  const clockOffsetRef          = useRef<number>(0);
  const previousRemainingRef    = useRef<number | null>(null);

  // ── Clock calibration & initial fetch ──────────────────────────────────────
  useEffect(() => {
    document.title = "YIP — Timer Display";

    const calibrateClock = async () => {
      const clientBefore = Date.now();
      const { data } = await supabase.rpc('get_server_time');
      const clientAfter = Date.now();
      if (data) {
        const serverTime = Date.parse(data);
        clockOffsetRef.current = serverTime - (clientBefore + clientAfter) / 2;
      }
    };

    calibrateClock();
    recalibRef.current = window.setInterval(calibrateClock, 30_000);
    fetchActiveTimer();

    const subscription = supabase
      .channel('timer_display_changes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'timer_sessions' }, () => {
        fetchActiveTimer();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
      if (recalibRef.current) window.clearInterval(recalibRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // ── RAF countdown (runs only when status === 'running') ────────────────────
  useEffect(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (!timer || timer.status !== 'running' || !timer.started_at) return;

    const render = () => {
      const base = baselineRef.current;
      if (!base) return;
      const nowAdj  = Date.now() + clockOffsetRef.current;
      const elapsed = Math.floor((nowAdj - base.startedAtMs) / 1000);
      const computed = Math.max(0, base.remainingAtStart - elapsed);
      setTimer(prev => prev ? { ...prev, remaining_seconds: computed } : prev);
      rafRef.current = requestAnimationFrame(render);
    };

    render();
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [timer?.id, timer?.status, timer?.started_at]);

  // ── Blinking colon ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (timer?.status !== 'running') { setColonVisible(true); return; }
    const id = setInterval(() => setColonVisible(v => !v), 500);
    return () => clearInterval(id);
  }, [timer?.status]);

  // ── Bell on expiry ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (timer && previousRemainingRef.current !== null) {
      if (previousRemainingRef.current > 0 && timer.remaining_seconds === 0) {
        try {
          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const osc  = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain); gain.connect(ctx.destination);
          osc.frequency.value = 800; osc.type = 'sine';
          gain.gain.setValueAtTime(0.5, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 2);
          osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 2);
        } catch (_) {}
      }
    }
    previousRemainingRef.current = timer?.remaining_seconds ?? null;
  }, [timer?.remaining_seconds]);

  // ── Fetch active timer ─────────────────────────────────────────────────────
  const fetchActiveTimer = async () => {
    try {
      const { data: running } = await supabase
        .from('timer_sessions').select('*')
        .eq('is_active', true).eq('status', 'running')
        .order('updated_at', { ascending: false }).limit(1).maybeSingle();

      if (running) {
        const nowAdj = Date.now() + clockOffsetRef.current;
        const startedAtMs = running.started_at ? Date.parse(running.started_at) : nowAdj;
        const adjustedRemaining = Math.max(0, running.remaining_seconds - Math.floor((nowAdj - startedAtMs) / 1000));
        baselineRef.current = { remainingAtStart: running.remaining_seconds, startedAtMs };
        setTimer(prev => prev
          ? { ...(running as TimerSession), remaining_seconds: Math.min(prev.remaining_seconds, adjustedRemaining) }
          : { ...(running as TimerSession), remaining_seconds: adjustedRemaining });
        return;
      }

      const { data: activeAny } = await supabase
        .from('timer_sessions').select('*')
        .eq('is_active', true)
        .order('updated_at', { ascending: false }).limit(1).maybeSingle();

      if (activeAny) {
        const nowAdj = Date.now() + clockOffsetRef.current;
        if ((activeAny as any).status === 'running' && activeAny.started_at) {
          const startedAtMs = Date.parse(activeAny.started_at);
          const adj = Math.max(0, activeAny.remaining_seconds - Math.floor((nowAdj - startedAtMs) / 1000));
          baselineRef.current = { remainingAtStart: activeAny.remaining_seconds, startedAtMs };
          setTimer(prev => prev
            ? { ...(activeAny as TimerSession), remaining_seconds: Math.min(prev.remaining_seconds, adj) }
            : { ...(activeAny as TimerSession), remaining_seconds: adj });
        } else {
          baselineRef.current = null;
          setTimer(activeAny as TimerSession);
        }
      } else {
        setTimer(null);
      }
    } catch (e) {
      console.error('Error fetching timer:', e);
      setTimer(null);
    } finally {
      setLoading(false);
    }
  };

  // ── Derived display values ─────────────────────────────────────────────────
  const remaining  = timer?.remaining_seconds ?? 0;
  const duration   = timer?.duration_seconds  ?? 0;
  const pct        = duration > 0 ? Math.ceil((remaining / duration) * 100) : 0;

  const phase =
    !timer                                               ? 'idle'
    : remaining === 0 || timer.status === 'completed'   ? 'expired'
    : remaining <= 10                                    ? 'critical'
    : remaining <= 60                                    ? 'warning'
    : 'normal';

  const mins = Math.floor(remaining / 60).toString().padStart(2, '0');
  const secs = (remaining % 60).toString().padStart(2, '0');
  const allocatedStr = `${Math.floor(duration / 60).toString().padStart(2, '0')}:${(duration % 60).toString().padStart(2, '0')}`;

  const statusLabel =
    phase === 'expired'            ? 'TIME EXPIRED'
    : timer?.status === 'paused'   ? 'PAUSED'
    : timer?.status === 'stopped'  ? 'STOPPED'
    : 'TIME REMAINING';

  const statusLabelClass =
    phase === 'expired'  ? 'text-error'
    : phase === 'warning' ? 'text-secondary'
    : 'text-on-surface-variant/60';

  const timerColorClass =
    phase === 'critical' || phase === 'expired' ? 'text-error'
    : 'text-primary';

  const progressGradient =
    phase === 'critical' || phase === 'expired'
      ? 'from-error to-error-container'
      : 'from-primary to-primary-container';

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center animate-pulse">
            <span className="material-symbols-outlined text-primary text-4xl">timer</span>
          </div>
          <p className="text-[10px] font-headline font-black uppercase tracking-[0.4em] text-on-surface-variant/40">
            Connecting to Parliament…
          </p>
        </div>
      </div>
    );
  }

  // ── No active timer ────────────────────────────────────────────────────────
  if (!timer) {
    return (
      <div className="min-h-screen bg-background flex flex-col overflow-hidden">
        <Header />
        <main className="flex-grow flex flex-col items-center justify-center gap-6">
          <div className="opacity-5 pointer-events-none select-none">
            <span className="material-symbols-outlined text-primary" style={{ fontSize: '20rem' }}>timer_off</span>
          </div>
          <div className="absolute text-center space-y-3">
            <p className="text-[10px] font-headline font-black uppercase tracking-[0.5em] text-on-surface-variant/40">Awaiting Session</p>
            <h2 className="text-4xl font-display font-extrabold text-primary tracking-tight">No Active Timer</h2>
            <p className="text-on-surface-variant font-body text-sm">Waiting for organizer to start a timer</p>
          </div>
        </main>
      </div>
    );
  }

  // ── Main display ───────────────────────────────────────────────────────────
  return (
    <div className="bg-background text-on-background font-body min-h-screen flex flex-col overflow-hidden">

      <Header timerTitle={timer.title} status={timer.status} />

      {/* Main Canvas */}
      <main className="flex-grow flex flex-col items-center justify-center px-6 relative">

        {/* Background watermark */}
        <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none select-none">
          <span className="material-symbols-outlined text-primary" style={{ fontSize: '80vw' }}>timer</span>
        </div>

        <div className="relative w-full max-w-7xl">

          {/* Floating badge */}
          <div className="absolute -top-6 left-1/2 -translate-x-1/2 z-10 glass-panel px-8 py-2.5 rounded-full border border-primary/10 shadow-xl shadow-primary/5 flex items-center gap-3 whitespace-nowrap">
            <span className="material-symbols-outlined text-primary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
            <span className="font-headline font-bold text-primary tracking-wide text-sm">{timer.title}</span>
          </div>

          {/* Timer card */}
          <div className="glass-panel rounded-[3rem] p-16 md:p-24 flex flex-col items-center justify-center border border-white shadow-[0_32px_64px_-16px_rgba(19,41,143,0.12)]">

            {/* Status label */}
            <div className="flex flex-col items-center gap-4 mb-6">
              <span className={`font-label font-bold tracking-[0.4em] uppercase text-lg ${statusLabelClass} ${phase === 'expired' ? 'animate-pulse' : ''}`}>
                {statusLabel}
              </span>
              <div className="h-1 w-24 bg-primary/20 rounded-full" />
            </div>

            {/* Clock face */}
            <div
              className={`font-display font-extrabold leading-none tracking-tighter flex items-baseline timer-glow ${timerColorClass} ${phase === 'expired' ? 'animate-pulse' : ''}`}
              style={{ fontSize: 'clamp(8rem, 22vw, 22rem)' }}
            >
              <span>{mins}</span>
              <span className={`px-4 transition-opacity duration-100 ${colonVisible ? 'opacity-80' : 'opacity-0'}`}>:</span>
              <span>{secs}</span>
            </div>

            {/* Allocated time */}
            <div className="mt-10 flex items-center gap-8">
              <div className="flex flex-col items-center">
                <span className="font-label font-bold text-on-surface-variant uppercase tracking-widest opacity-40 text-sm">Allocated</span>
                <span className="font-headline font-bold text-2xl text-on-surface">{allocatedStr}</span>
              </div>
              {phase !== 'idle' && (
                <>
                  <div className="h-10 w-px bg-outline-variant/30" />
                  <div className="flex flex-col items-center">
                    <span className="font-label font-bold text-on-surface-variant uppercase tracking-widest opacity-40 text-sm">Remaining</span>
                    <span className={`font-headline font-bold text-2xl ${timerColorClass}`}>{pct}%</span>
                  </div>
                </>
              )}
            </div>

          </div>
        </div>
      </main>

      {/* Progress bar footer */}
      <footer className="w-full p-12 mt-auto">
        <div className="max-w-7xl mx-auto space-y-4">
          <div className="flex justify-between items-end px-2">
            <div className="flex flex-col">
              <span className="font-label font-bold text-primary uppercase tracking-tighter">Parliamentary Protocol</span>
              <span className="font-body text-sm text-on-surface-variant">{timer.title}</span>
            </div>
            <div className={`font-display font-extrabold text-4xl italic ${timerColorClass} opacity-20`}>{pct}%</div>
          </div>
          <div className="w-full h-8 bg-surface-container-high rounded-full overflow-hidden p-1 shadow-inner">
            <div
              className={`h-full bg-gradient-to-r ${progressGradient} rounded-full shadow-lg relative overflow-hidden`}
              style={{ width: `${pct}%`, transition: 'width 1s linear' }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent w-40 skew-x-12 animate-[shimmer_3s_infinite]" />
            </div>
          </div>
        </div>
      </footer>

      <style>{`
        .glass-panel {
          background: rgba(255,255,255,0.7);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
        }
        .timer-glow {
          text-shadow: 0 0 40px rgba(19,41,143,0.15);
        }
        @keyframes shimmer {
          0%   { transform: translateX(-200%) skewX(-45deg); }
          100% { transform: translateX(400%)  skewX(-45deg); }
        }
      `}</style>

    </div>
  );
};

// ── Shared header ──────────────────────────────────────────────────────────────
const Header = ({ timerTitle, status }: { timerTitle?: string; status?: string }) => (
  <header className="flex justify-between items-center px-12 py-8 w-full">
    <div className="flex items-center gap-4">
      <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
        <span className="material-symbols-outlined text-white text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>account_balance</span>
      </div>
      <div>
        <h1 className="font-headline font-extrabold text-2xl tracking-tighter text-primary">National Youth Parliament</h1>
        <p className="font-body text-xs font-medium text-on-surface-variant uppercase tracking-widest">Digital Diplomat Display</p>
      </div>
    </div>

    {timerTitle && (
      <div className="glass-panel px-6 py-3 rounded-full flex items-center gap-3 border border-outline-variant/20 shadow-sm">
        <span className={`w-2 h-2 rounded-full ${status === 'running' ? 'bg-tertiary-container animate-pulse' : 'bg-outline-variant'}`} />
        <span className="font-headline font-bold text-on-surface-variant text-sm tracking-wide">{timerTitle}</span>
        {status && (
          <>
            <div className="w-px h-4 bg-outline-variant/30" />
            <span className="font-headline font-black text-[10px] uppercase tracking-widest text-on-surface-variant/60">{status}</span>
          </>
        )}
      </div>
    )}
  </header>
);

export default TimerDisplay;
