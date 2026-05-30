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

const STATUS_COLOR: Record<string, string> = {
  active:    'bg-tertiary-fixed-dim/20 text-on-tertiary-fixed-variant',
  upcoming:  'bg-primary/10 text-primary',
  completed: 'bg-surface-container text-on-surface-variant',
};

const selectCls = 'w-full bg-surface-container rounded-xl px-4 py-2.5 text-sm font-body border-0 outline-none focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-50 appearance-none';

export const EventLeaderboard = () => {
  const { profile } = useAuth();
  const isOrganizer = profile?.user_type === 'organizer';

  const [events, setEvents]               = useState<EventOption[]>([]);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [leaderboard, setLeaderboard]     = useState<RankedEntry[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingLb, setLoadingLb]         = useState(false);
  const [toEvent, setToEvent]             = useState('');
  const [promotingId, setPromotingId]     = useState<string | null>(null);
  const [promotedIds, setPromotedIds]     = useState<Set<string>>(new Set());
  const [shakeDest, setShakeDest]         = useState(false);
  const { toast } = useToast();
  const destRef = useRef<HTMLDivElement>(null);

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
    setPromotedIds(new Set());
    const { data, error } = await supabase.rpc('get_event_leaderboard', { p_event_id: eventId });
    if (!error && data) setLeaderboard(data as RankedEntry[]);
    setLoadingLb(false);
  }, []);

  useEffect(() => {
    if (selectedEvent) fetchLeaderboard(selectedEvent);
    else setLeaderboard([]);
  }, [selectedEvent, fetchLeaderboard]);

  const sourceLevel      = events.find(e => e.id === selectedEvent)?.level;
  const toEventOptions   = events.filter(e => sourceLevel && LEVEL_ORDER[e.level] > LEVEL_ORDER[sourceLevel]);
  const selectedEventMeta = events.find(e => e.id === selectedEvent);
  const canPromote       = !!sourceLevel && sourceLevel !== 'national' && toEventOptions.length > 0;

  const handlePromoteOne = async (entry: RankedEntry) => {
    if (!toEvent) {
      // Flash the destination picker
      setShakeDest(true);
      setTimeout(() => setShakeDest(false), 600);
      destRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      toast({ title: 'Pick a destination event first', variant: 'destructive' });
      return;
    }
    setPromotingId(entry.user_id);
    const { error } = await supabase.rpc('promote_participants', {
      p_user_ids:   [entry.user_id],
      p_from_event: selectedEvent,
      p_to_event:   toEvent,
    });
    setPromotingId(null);
    if (error) {
      toast({ title: 'Promotion failed', description: error.message, variant: 'destructive' });
    } else {
      setPromotedIds(prev => new Set(prev).add(entry.user_id));
      toast({
        title: `${entry.name} promoted`,
        description: `Now in ${events.find(e => e.id === toEvent)?.name}.`,
      });
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

      {/* ── Event Selector / Organizer Badge ── */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-[0_4px_32px_0_rgba(19,41,143,0.06)] border border-outline-variant/10 p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[20px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>event</span>
            </div>
            <div>
              <p className="font-headline font-extrabold text-on-surface text-sm">
                {isOrganizer ? (selectedEventMeta?.name ?? 'Your Event') : 'Select Event'}
              </p>
              <p className="text-[10px] text-on-surface-variant font-body">
                {isOrganizer ? 'Performance rankings for your chapter' : 'Choose an event to view its performance rankings'}
              </p>
            </div>
          </div>

          {isOrganizer && selectedEventMeta && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary text-on-primary text-[10px] font-black uppercase tracking-widest font-headline shadow-[0_2px_8px_rgba(19,41,143,0.25)]">
                <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>location_city</span>
                {selectedEventMeta.level.charAt(0).toUpperCase() + selectedEventMeta.level.slice(1)} Level
              </span>
              {profile?.city && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest font-headline">
                  <span className="material-symbols-outlined text-[12px]">place</span>
                  {profile.city}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Super admin: event dropdown */}
        {!isOrganizer && (
          <div className="relative mt-4">
            <select
              className={selectCls}
              value={selectedEvent}
              onChange={e => { setSelectedEvent(e.target.value); setToEvent(''); }}
            >
              <option value="">— Choose an event —</option>
              {events.map(e => (
                <option key={e.id} value={e.id}>{e.name} · {e.level} · {e.status}</option>
              ))}
            </select>
            <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none text-[20px]">expand_more</span>
          </div>
        )}

        {/* Event meta pills */}
        {selectedEventMeta && (
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest font-headline ${STATUS_COLOR[selectedEventMeta.status] ?? 'bg-surface-container text-on-surface-variant'}`}>
              {selectedEventMeta.status}
            </span>
            {!isOrganizer && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest font-headline bg-primary/10 text-primary">
                {selectedEventMeta.level}
              </span>
            )}
            {sourceLevel && LEVEL_NEXT[sourceLevel] && (
              <span className="text-[10px] text-on-surface-variant font-body">
                Can promote to <span className="font-bold text-secondary">{LEVEL_NEXT[sourceLevel]}</span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Leaderboard table ── */}
      {selectedEvent && (
        <div className="bg-surface-container-lowest rounded-2xl shadow-[0_4px_32px_0_rgba(19,41,143,0.06)] border border-outline-variant/10 overflow-hidden">

          {/* Table header bar */}
          <div className="px-6 py-4 border-b border-surface-variant/30 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="font-headline font-extrabold text-on-surface text-sm">
                Performance Rankings — {selectedEventMeta?.name}
              </p>
              <p className="text-xs text-on-surface-variant font-body mt-0.5">
                {leaderboard.length} participants
                {promotedIds.size > 0 && (
                  <span className="ml-2 text-primary font-bold">· {promotedIds.size} promoted this session</span>
                )}
              </p>
            </div>
          </div>

          {/* ── Promote destination bar (always visible when promotion is possible) ── */}
          {canPromote && (
            <div
              ref={destRef}
              className={`px-6 py-3.5 bg-primary/[0.03] border-b border-surface-variant/30 flex items-center gap-3 flex-wrap transition-all ${
                shakeDest ? 'animate-[shake_0.4s_ease-in-out]' : ''
              }`}
            >
              <span className="material-symbols-outlined text-[18px] text-primary shrink-0">arrow_upward</span>
              <p className="text-xs font-bold text-on-surface-variant font-headline shrink-0">Promote to:</p>
              <div className="relative flex-1 min-w-[200px] max-w-xs">
                <select
                  className={`${selectCls} ${!toEvent ? 'ring-2 ring-primary/20' : ''}`}
                  value={toEvent}
                  onChange={e => setToEvent(e.target.value)}
                >
                  <option value="">
                    {`Select ${LEVEL_NEXT[sourceLevel ?? ''] ?? 'destination'} event…`}
                  </option>
                  {toEventOptions.map(e => (
                    <option key={e.id} value={e.id}>{e.name} ({e.level})</option>
                  ))}
                </select>
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none text-[20px]">expand_more</span>
              </div>
              {toEvent ? (
                <span className="text-[11px] text-primary font-bold font-headline flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  Destination set — click ↑ on any row to promote
                </span>
              ) : (
                <span className="text-[11px] text-on-surface-variant/60 font-body">
                  Select destination, then click ↑ on a participant row
                </span>
              )}
            </div>
          )}

          {/* Table body */}
          {loadingLb ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="text-center py-16">
              <span className="material-symbols-outlined text-[48px] text-outline/30 block mb-3">group_off</span>
              <p className="text-sm text-on-surface-variant/50 font-body">No participants in this event yet.</p>
            </div>
          ) : (
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
                    {canPromote && <th className="w-14 px-3 py-3.5 text-center text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60 font-headline">Promote</th>}
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((entry, idx) => {
                    const isPromoted  = promotedIds.has(entry.user_id);
                    const isPromoting = promotingId === entry.user_id;
                    const initials    = entry.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                    return (
                      <tr
                        key={entry.user_id}
                        className={`border-b border-surface-variant/20 last:border-0 transition-colors hover:bg-surface-container/20 ${isPromoted ? 'opacity-50' : ''}`}
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
                                <img src={entry.photo_url} alt={entry.name} className="w-9 h-9 rounded-xl object-cover" />
                              ) : (
                                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                                  <span className="text-xs font-headline font-bold text-primary">{initials}</span>
                                </div>
                              )}
                              {isPromoted && (
                                <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-tertiary-fixed flex items-center justify-center">
                                  <span className="material-symbols-outlined text-[10px] text-on-tertiary-fixed" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>
                                </div>
                              )}
                            </div>
                            <div>
                              <p className="font-headline font-bold text-on-surface">{entry.name}</p>
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
                          <span className="inline-block bg-primary text-on-primary font-headline font-black text-sm tabular-nums rounded-lg px-3 py-1">
                            {entry.final_score != null ? Number(entry.final_score).toFixed(1) : '—'}
                          </span>
                        </td>

                        {/* Promote icon */}
                        {canPromote && (
                          <td className="px-3 py-3.5 text-center">
                            {isPromoted ? (
                              <span className="material-symbols-outlined text-[20px] text-tertiary-fixed-dim" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                            ) : (
                              <button
                                type="button"
                                title={toEvent ? `Promote to ${events.find(e => e.id === toEvent)?.name}` : 'Select a destination event first'}
                                onClick={() => handlePromoteOne(entry)}
                                disabled={!!promotingId}
                                className={`p-1.5 rounded-lg transition-all disabled:opacity-40 ${
                                  toEvent
                                    ? 'text-primary hover:bg-primary hover:text-on-primary'
                                    : 'text-on-surface-variant/30 hover:text-primary hover:bg-primary/5'
                                }`}
                              >
                                {isPromoting ? (
                                  <span className="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>
                                ) : (
                                  <span className="material-symbols-outlined text-[20px]">arrow_circle_up</span>
                                )}
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
          )}
        </div>
      )}
    </div>
  );
};
