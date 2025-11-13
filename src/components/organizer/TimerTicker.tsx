import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface TimerSession {
  id: string;
  title: string;
  duration_seconds: number;
  remaining_seconds: number;
  status: 'stopped' | 'running' | 'paused' | 'completed';
  is_active: boolean;
}

// Headless ticker that runs while OrganizerDashboard is mounted
export const TimerTicker = () => {
  const [active, setActive] = useState<TimerSession | null>(null);
  const tickRef = useRef<number | null>(null);

  // Fetch currently active running timer
  const fetchActiveRunning = async () => {
    const { data, error } = await supabase
      .from('timer_sessions')
      .select('*')
      .eq('is_active', true)
      .eq('status', 'running')
      .limit(1)
      .maybeSingle();
    if (!error) setActive(data as TimerSession | null);
  };

  useEffect(() => {
    fetchActiveRunning();

    // Realtime: keep in sync with any timer changes
    const channel = supabase
      .channel('timer_ticker_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'timer_sessions' }, () => {
        fetchActiveRunning();
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
  }, []);

  useEffect(() => {
    if (tickRef.current) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }

    if (!active || active.status !== 'running') return;

    // Store the active timer data in a ref to avoid stale closures
    const timerRef = { current: active };
    
    tickRef.current = window.setInterval(async () => {
      // Read from the latest state
      const currentTimer = timerRef.current;
      if (!currentTimer) return;
      
      const nextRemaining = Math.max(0, (currentTimer.remaining_seconds ?? 0) - 1);

      try {
        if (nextRemaining === 0) {
          await supabase
            .from('timer_sessions')
            .update({ remaining_seconds: 0, status: 'completed' })
            .eq('id', currentTimer.id);
          setActive(null);
        } else {
          await supabase
            .from('timer_sessions')
            .update({ remaining_seconds: nextRemaining })
            .eq('id', currentTimer.id);
          // Update both the ref and state
          timerRef.current = { ...currentTimer, remaining_seconds: nextRemaining };
          setActive(prev => (prev ? { ...prev, remaining_seconds: nextRemaining } : prev));
        }
      } catch (e) {
        console.error('TimerTicker update error', e);
      }
    }, 1000);

    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
  }, [active?.id, active?.status]);

  return null;
};
