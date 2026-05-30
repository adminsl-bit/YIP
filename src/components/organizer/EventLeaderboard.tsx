import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface EventOption {
  id: string;
  name: string;
  level: string;
  status: string;
}

interface RankedEntry {
  user_id: string;
  name: string;
  position: string;
  party_number: number;
  constituency: string | null;
  state: string | null;
  serial_number: number;
  photo_url: string | null;
  avg_jury_score: number | null;
  preevent_scores: number | null;
  final_score: number | null;
  _promoted?: boolean;
}

const LEVEL_ORDER: Record<string, number> = { city: 1, regional: 2, national: 3 };

const selectCls = 'w-full bg-surface-container rounded-xl px-4 py-2.5 text-sm font-body border-0 outline-none focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-50 appearance-none';

export const EventLeaderboard = () => {
  const { profile } = useAuth();
  const isOrganizer = profile?.user_type === 'organizer';

  const [events, setEvents]               = useState<EventOption[]>([]);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [leaderboard, setLeaderboard]     = useState<RankedEntry[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingLb, setLoadingLb]         = useState(false);
  const [promotingId, setPromotingId]     = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    supabase.from('events').select('id, name, level, status').order('created_at')
      .then(({ data }) => {
        if (data) setEvents(data as EventOption[]);
        setLoadingEvents(false);
      });
  }, []);

  useEffect(() => {
    if (isOrganizer && profile?.event_id && !loadingEvents) {
      setSelectedEvent(profile.event_id);
    }
  }, [isOrganizer, profile?.event_id, loadingEvents]);

  const fetchLeaderboard = useCallback(async (eventId: string) => {
    setLoadingLb(true);
    const [{ data: lbData, error }, { data: epData }] = await Promise.all([
      supabase.rpc('get_event_leaderboard', { p_event_id: eventId }),
      supabase
        .from('event_participants')
        .select('user_id')
        .eq('event_id', eventId)
        .eq('is_current', false)
        .not('promoted_at', 'is', null),
    ]);

    const alreadyPromoted = new Set((epData || []).map((r: any) => r.user_id as string));
    if (!error && lbData) {
      setLeaderboard((lbData as RankedEntry[]).map(r => ({
        ...r,
        _promoted: alreadyPromoted.has(r.user_id),
      })));
    }
    setLoadingLb(false);
  }, []);

  useEffect(() => {
    if (selectedEvent) fetchLeaderboard(selectedEvent);
    else setLeaderboard([]);
  }, [selectedEvent, fetchLeaderboard]);

  const sourceLevel  = events.find(e => e.id === selectedEvent)?.level;
  // Pick the nearest higher-level event (any level above current)
  const destEvent    = sourceLevel
    ? events
        .filter(e => LEVEL_ORDER[e.level] > LEVEL_ORDER[sourceLevel])
        .sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level])[0] ?? null
    : null;

  const handlePromote = async (entry: RankedEntry) => {
    if (!destEvent || entry._promoted || promotingId) return;

    // Optimistic green highlight immediately
    setLeaderboard(prev => prev.map(r => r.user_id === entry.user_id ? { ...r, _promoted: true } : r));
    setPromotingId(entry.user_id);

    const { error } = await supabase.rpc('promote_participants', {
      p_user_ids:   [entry.user_id],
      p_from_event: selectedEvent,
      p_to_event:   destEvent.id,
    });

    setPromotingId(null);

    if (error) {
      // Roll back on failure
      setLeaderboard(prev => prev.map(r => r.user_id === entry.user_id ? { ...r, _promoted: false } : r));
      toast({ title: 'Promotion failed', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: `${entry.name} promoted`, description: `Now in ${destEvent.name}.` });
    }
  };

  if (loadingEvents) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Super admin: event selector */}
      {!isOrganizer && (
        <div className="relative">
          <select
            className={selectCls}
            value={selectedEvent}
            onChange={e => setSelectedEvent(e.target.value)}
          >
            <option value="">— Choose an event —</option>
            {events.map(e => (
              <option key={e.id} value={e.id}>{e.name} · {e.level} · {e.status}</option>
            ))}
          </select>
          <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none text-[20px]">expand_more</span>
        </div>
      )}

      {selectedEvent && loadingLb && (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {selectedEvent && !loadingLb && leaderboard.length > 0 && (
        <div className="bg-surface-container-lowest rounded-2xl shadow-[0_4px_32px_0_rgba(19,41,143,0.06)] border border-outline-variant/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-body">
              <thead>
                <tr className="bg-surface-container/30 border-b border-surface-variant/30">
                  <th className="px-5 py-3.5 text-left text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60 font-headline">Rank</th>
                  <th className="px-5 py-3.5 text-left text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60 font-headline">Participant</th>
                  <th className="px-5 py-3.5 text-left text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60 font-headline">Constituency</th>
                  <th className="px-5 py-3.5 text-right text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60 font-headline">Pre-event</th>
                  <th className="px-5 py-3.5 text-right text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60 font-headline">Jury Avg</th>
                  <th className="px-5 py-3.5 text-right text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60 font-headline">Final</th>
                  {selectedEvent && <th className="w-14 px-3 py-3.5 text-center text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60 font-headline">Promote</th>}
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((entry, idx) => {
                  const isPromoted  = !!entry._promoted;
                  const isPromoting = promotingId === entry.user_id;
                  const hasNoScore  = entry.final_score == null || Number(entry.final_score) === 0;
                  const initials    = entry.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                  return (
                    <tr
                      key={entry.user_id}
                      className={`border-b border-surface-variant/20 last:border-0 transition-colors ${
                        isPromoted ? 'bg-[#e6f9f1] dark:bg-tertiary-fixed/10' : 'hover:bg-surface-container/20'
                      }`}
                    >
                      {/* Rank */}
                      <td className="px-5 py-3.5">
                        {idx < 3 ? (
                          <span className="material-symbols-outlined text-[22px]" style={{
                            fontVariationSettings: "'FILL' 1",
                            color: idx === 0 ? '#f59e0b' : idx === 1 ? '#94a3b8' : '#ea580c',
                          }}>
                            {idx === 0 ? 'emoji_events' : idx === 1 ? 'military_tech' : 'workspace_premium'}
                          </span>
                        ) : (
                          <span className="font-black font-headline text-xs text-on-surface-variant/40">#{idx + 1}</span>
                        )}
                      </td>

                      {/* Participant */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="shrink-0 relative">
                            {entry.photo_url ? (
                              <img src={entry.photo_url} alt={entry.name} className={`w-9 h-9 rounded-xl object-cover ${isPromoted ? 'ring-2 ring-[#2bb87c]' : ''}`} />
                            ) : (
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isPromoted ? 'bg-[#2bb87c]/20' : 'bg-primary/10'}`}>
                                <span className={`text-xs font-headline font-bold ${isPromoted ? 'text-[#2bb87c]' : 'text-primary'}`}>{initials}</span>
                              </div>
                            )}
                            {isPromoted && (
                              <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#2bb87c] flex items-center justify-center shadow">
                                <span className="material-symbols-outlined text-[10px] text-white" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className={`font-headline font-bold ${isPromoted ? 'text-[#1a8a5c]' : 'text-on-surface'}`}>{entry.name}</p>
                              {isPromoted && (
                                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-[#2bb87c]/15 text-[#1a8a5c] text-[9px] font-black uppercase tracking-wider font-headline">
                                  <span className="material-symbols-outlined text-[10px]" style={{ fontVariationSettings: "'FILL' 1" }}>arrow_upward</span>
                                  Promoted
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-on-surface-variant font-body">{entry.position} · #{entry.serial_number}</p>
                          </div>
                        </div>
                      </td>

                      {/* Constituency */}
                      <td className="px-5 py-3.5 text-on-surface-variant text-xs max-w-[140px] truncate">
                        {entry.constituency || '—'}
                      </td>

                      {/* Pre-event */}
                      <td className="px-5 py-3.5 text-right font-headline font-bold tabular-nums text-on-surface">
                        {entry.preevent_scores != null ? Number(entry.preevent_scores).toFixed(1) : '—'}
                      </td>

                      {/* Jury Avg */}
                      <td className="px-5 py-3.5 text-right tabular-nums text-on-surface-variant">
                        {entry.avg_jury_score != null ? Number(entry.avg_jury_score).toFixed(1) : '—'}
                      </td>

                      {/* Final */}
                      <td className="px-5 py-3.5 text-right">
                        <span className={`inline-block font-headline font-black text-sm tabular-nums rounded-lg px-3 py-1 ${isPromoted ? 'bg-[#2bb87c]/15 text-[#1a8a5c]' : 'bg-primary text-on-primary'}`}>
                          {entry.final_score != null ? Number(entry.final_score).toFixed(1) : '—'}
                        </span>
                      </td>

                      {/* Promote */}
                      {selectedEvent && (
                        <td className="px-3 py-3.5 text-center">
                          {isPromoted ? (
                            <span className="material-symbols-outlined text-[20px] text-[#2bb87c]" title="Already promoted" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                          ) : isPromoting ? (
                            <span className="material-symbols-outlined text-[20px] text-primary animate-spin">progress_activity</span>
                          ) : !destEvent ? (
                            <span className="material-symbols-outlined text-[20px] text-on-surface-variant/20" title="No higher-level event">arrow_circle_up</span>
                          ) : hasNoScore ? (
                            <span className="material-symbols-outlined text-[20px] text-on-surface-variant/20" title="No score yet">block</span>
                          ) : (
                            <button
                              type="button"
                              title={`Promote to ${destEvent.name}`}
                              onClick={() => handlePromote(entry)}
                              disabled={!!promotingId}
                              className="p-1.5 rounded-lg text-primary hover:bg-primary hover:text-on-primary transition-all disabled:opacity-30"
                            >
                              <span className="material-symbols-outlined text-[20px]">arrow_circle_up</span>
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
