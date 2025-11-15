import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface TimerSession {
  id: string;
  title: string;
  duration_seconds: number;
  remaining_seconds: number; // remaining at start/resume
  status: 'stopped' | 'running' | 'paused' | 'completed';
  is_active: boolean;
  started_at: string | null;
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

    if (!active || active.status !== 'running' || !active.started_at) return;

    // Only watch for completion; do NOT write remaining_seconds periodically
    const startedAtMs = Date.parse(active.started_at);
    const wroteCompleteRef = { current: false };

    tickRef.current = window.setInterval(async () => {
      const now = Date.now();
      const elapsed = Math.max(0, Math.floor((now - startedAtMs) / 1000));
      const remaining = Math.max(0, (active.remaining_seconds ?? 0) - elapsed);

      if (remaining === 0 && !wroteCompleteRef.current) {
        wroteCompleteRef.current = true;
        try {
          await supabase
            .from('timer_sessions')
            .update({ remaining_seconds: 0, status: 'completed', started_at: null, completed_at: new Date().toISOString() })
            .eq('id', active.id)
            .eq('status', 'running');
        } catch (e) {
          console.error('TimerTicker completion update error', e);
        } finally {
          setActive(null);
        }
      }
    }, 500);

    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
  }, [active]);

  return null;
};
