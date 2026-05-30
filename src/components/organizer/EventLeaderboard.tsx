import { useState, useEffect, useCallback, useRef } from 'react';
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
}

const LEVEL_ORDER: Record<string, number> = { city: 1, regional: 2, national: 3 };
const LEVEL_NEXT: Record<string, string>  = { city: 'Regional', regional: 'National' };


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
  const [promotedIds, setPromotedIds]     = useState<Set<string>>(new Set());
  // userId of the row whose inline picker is open
  const [pickerOpen, setPickerOpen]       = useState<string | null>(null);
  const { toast } = useToast();
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.from('events').select('id, name, level, status').order('created_at')
      .then(({ data }) => {
        if (data) setEvents(data as EventOption[]);
        setLoadingEvents(false);
      });
  }, []);

  // Auto-select organizer's own event
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
    if (!error && lbData) setLeaderboard(lbData as RankedEntry[]);
    // Seed promotedIds with anyone already promoted out of this event
    setPromotedIds(new Set((epData || []).map((r: any) => r.user_id)));
    setLoadingLb(false);
  }, []);

  useEffect(() => {
    if (selectedEvent) fetchLeaderboard(selectedEvent);
    else setLeaderboard([]);
  }, [selectedEvent, fetchLeaderboard]);

  const sourceLevel       = events.find(e => e.id === selectedEvent)?.level;
  const toEventOptions    = events.filter(e => sourceLevel && LEVEL_ORDER[e.level] > LEVEL_ORDER[sourceLevel]);
  const selectedEventMeta = events.find(e => e.id === selectedEvent);
  const showPromoteColumn = !!selectedEvent;

  // Close picker on outside click
  useEffect(() => {
    if (!pickerOpen) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [pickerOpen]);

  const handlePromoteOne = async (entry: RankedEntry, destEventId: string) => {
    setPickerOpen(null);
    setPromotingId(entry.user_id);
    const { error } = await supabase.rpc('promote_participants', {
      p_user_ids:   [entry.user_id],
      p_from_event: selectedEvent,
      p_to_event:   destEventId,
    });
    setPromotingId(null);
    if (error) {
      toast({ title: 'Promotion failed', description: error.message, variant: 'destructive' });
    } else {
      toast({
        title: `${entry.name} promoted`,
        description: `Now in ${events.find(e => e.id === destEventId)?.name}.`,
      });
      // Refresh from DB so promoted state is persisted and duplicates are blocked
      fetchLeaderboard(selectedEvent);
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

      {/* Super admin: event selector (slim, no card) */}
      {!isOrganizer && (
        <div className="relative">
          <select
            className={selectCls}
            value={selectedEvent}
            onChange={e => { setSelectedEvent(e.target.value); }}
          >
            <option value="">— Choose an event —</option>
            {events.map(e => (
              <option key={e.id} value={e.id}>{e.name} · {e.level} · {e.status}</option>
            ))}
          </select>
          <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none text-[20px]">expand_more</span>
        </div>
      )}

      {/* ── Leaderboard table ── */}
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
                    {showPromoteColumn && <th className="w-14 px-3 py-3.5 text-center text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60 font-headline">Promote</th>}
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((entry, idx) => {
                    const isPromoted  = promotedIds.has(entry.user_id);
                    const isPromoting = promotingId === entry.user_id;
                    const hasNoScore  = entry.final_score == null || Number(entry.final_score) === 0;
                    const initials    = entry.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                    return (
                      <tr
                        key={entry.user_id}
                        className={`border-b border-surface-variant/20 last:border-0 transition-colors ${
                          isPromoted
                            ? 'bg-[#e6f9f1] dark:bg-tertiary-fixed/10'
                            : 'hover:bg-surface-container/20'
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

                        {/* Promote icon */}
                        {showPromoteColumn && (
                          <td className="px-3 py-3.5 text-center relative">
                            {isPromoted ? (
                              <span className="material-symbols-outlined text-[20px] text-[#2bb87c]" title="Already promoted" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                            ) : isPromoting ? (
                              <span className="material-symbols-outlined text-[20px] text-primary animate-spin">progress_activity</span>
                            ) : hasNoScore ? (
                              <span className="material-symbols-outlined text-[20px] text-on-surface-variant/20" title="No score — cannot promote">block</span>
                            ) : toEventOptions.length === 0 ? (
                              <span className="material-symbols-outlined text-[20px] text-on-surface-variant/20" title="No higher-level events available">arrow_circle_up</span>
                            ) : (
                              <div className="relative inline-block" ref={pickerOpen === entry.user_id ? pickerRef : undefined}>
                                <button
                                  type="button"
                                  title="Promote to next round"
                                  onClick={() => setPickerOpen(p => p === entry.user_id ? null : entry.user_id)}
                                  disabled={!!promotingId}
                                  className="p-1.5 rounded-lg text-primary hover:bg-primary hover:text-on-primary transition-all disabled:opacity-30"
                                >
                                  <span className="material-symbols-outlined text-[20px]">arrow_circle_up</span>
                                </button>
                                {pickerOpen === entry.user_id && (
                                  <div className="absolute right-0 top-full mt-1 z-50 bg-surface-container-lowest rounded-xl shadow-[0_8px_32px_rgba(19,41,143,0.15)] border border-outline-variant/20 min-w-[200px] overflow-hidden">
                                    <p className="px-3 pt-2.5 pb-1 text-[10px] font-black uppercase tracking-widest text-on-surface-variant/50 font-headline">Promote to</p>
                                    {toEventOptions.map(ev => (
                                      <button
                                        key={ev.id}
                                        type="button"
                                        onClick={() => handlePromoteOne(entry, ev.id)}
                                        className="w-full text-left px-3 py-2.5 text-sm font-body hover:bg-primary/5 flex items-center gap-2 transition-colors"
                                      >
                                        <span className="material-symbols-outlined text-[16px] text-primary">arrow_upward</span>
                                        <span className="font-medium text-on-surface">{ev.name}</span>
                                        <span className="ml-auto text-[10px] text-on-surface-variant/50 uppercase font-headline">{ev.level}</span>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
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
