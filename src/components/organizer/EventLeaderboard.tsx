import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
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
  const [events, setEvents]             = useState<EventOption[]>([]);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [leaderboard, setLeaderboard]   = useState<RankedEntry[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingLb, setLoadingLb]       = useState(false);
  const [promoteMode, setPromoteMode]   = useState(false);
  const [selected, setSelected]         = useState<Set<string>>(new Set());
  const [toEvent, setToEvent]           = useState('');
  const [promoting, setPromoting]       = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    supabase.from('events').select('id, name, level, status').order('created_at')
      .then(({ data }) => { if (data) setEvents(data as EventOption[]); setLoadingEvents(false); });
  }, []);

  const fetchLeaderboard = useCallback(async (eventId: string) => {
    setLoadingLb(true);
    setSelected(new Set());
    const { data, error } = await supabase.rpc('get_event_leaderboard', { p_event_id: eventId });
    if (!error && data) setLeaderboard(data as RankedEntry[]);
    setLoadingLb(false);
  }, []);

  useEffect(() => {
    if (selectedEvent) fetchLeaderboard(selectedEvent);
    else setLeaderboard([]);
  }, [selectedEvent, fetchLeaderboard]);

  const sourceLevel     = events.find(e => e.id === selectedEvent)?.level;
  const toEventOptions  = events.filter(e => sourceLevel && LEVEL_ORDER[e.level] > LEVEL_ORDER[sourceLevel]);
  const selectedEventMeta = events.find(e => e.id === selectedEvent);

  const toggleSelect = (uid: string) =>
    setSelected(prev => { const n = new Set(prev); n.has(uid) ? n.delete(uid) : n.add(uid); return n; });

  const quickPromote = (uid: string) => {
    if (!promoteMode) setPromoteMode(true);
    setSelected(prev => { const n = new Set(prev); n.add(uid); return n; });
  };

  const handlePromote = async () => {
    if (!selectedEvent || !toEvent || selected.size === 0) return;
    setPromoting(true);
    const { error } = await supabase.rpc('promote_participants', {
      p_user_ids:   Array.from(selected),
      p_from_event: selectedEvent,
      p_to_event:   toEvent,
    });
    setPromoting(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({
        title: `${selected.size} participant${selected.size !== 1 ? 's' : ''} promoted`,
        description: `Moved to ${events.find(e => e.id === toEvent)?.name}.`,
      });
      setSelected(new Set());
      setPromoteMode(false);
      setToEvent('');
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

      {/* ── Event Selector ── */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-[0_4px_32px_0_rgba(19,41,143,0.06)] border border-outline-variant/10 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[20px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>event</span>
          </div>
          <div>
            <p className="font-headline font-extrabold text-on-surface text-sm">Select Event</p>
            <p className="text-[10px] text-on-surface-variant font-body">Choose an event to view its performance rankings</p>
          </div>
        </div>
        <div className="relative">
          <select
            className={selectCls}
            value={selectedEvent}
            onChange={e => { setSelectedEvent(e.target.value); setPromoteMode(false); setToEvent(''); }}
          >
            <option value="">— Choose an event —</option>
            {events.map(e => (
              <option key={e.id} value={e.id}>{e.name} · {e.level} · {e.status}</option>
            ))}
          </select>
          <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none text-[20px]">expand_more</span>
        </div>

        {/* Event meta pills */}
        {selectedEventMeta && (
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest font-headline ${STATUS_COLOR[selectedEventMeta.status] ?? 'bg-surface-container text-on-surface-variant'}`}>
              {selectedEventMeta.status}
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest font-headline bg-primary/10 text-primary">
              {selectedEventMeta.level}
            </span>
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
                {leaderboard.length} participants · click a row or <span className="font-bold">↑</span> to promote
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {promoteMode && (
                <>
                  <span className="text-xs font-bold text-primary font-headline">{selected.size} selected</span>
                  <button onClick={() => setSelected(new Set(leaderboard.map(e => e.user_id)))} className="text-xs font-bold text-primary font-headline hover:underline">All</button>
                  <span className="text-outline text-xs">|</span>
                  <button onClick={() => setSelected(new Set())} className="text-xs font-bold text-on-surface-variant font-headline hover:underline">None</button>
                  <span className="text-outline text-xs">|</span>
                </>
              )}
              <button
                onClick={() => { setPromoteMode(m => !m); setSelected(new Set()); setToEvent(''); }}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-[11px] font-black font-headline uppercase tracking-wide transition-all ${
                  promoteMode
                    ? 'bg-primary text-on-primary shadow-[0_2px_8px_rgba(19,41,143,0.3)]'
                    : 'bg-primary/10 text-primary hover:bg-primary/20'
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">arrow_upward</span>
                {promoteMode ? 'Exit Promote' : 'Promote Mode'}
              </button>
            </div>
          </div>

          {/* Promote destination selector — visible when in promote mode */}
          {promoteMode && (
            <div className="px-6 py-4 bg-primary/[0.03] border-b border-surface-variant/30 flex items-center gap-4 flex-wrap">
              <span className="material-symbols-outlined text-[18px] text-primary shrink-0">arrow_upward</span>
              <p className="text-xs font-bold text-on-surface-variant font-headline shrink-0">Promote to:</p>
              <div className="relative flex-1 min-w-[200px]">
                <select
                  className={selectCls}
                  value={toEvent}
                  onChange={e => setToEvent(e.target.value)}
                  disabled={toEventOptions.length === 0}
                >
                  <option value="">
                    {toEventOptions.length === 0
                      ? sourceLevel === 'national' ? 'Already national level' : 'No higher-level events found'
                      : `Select ${LEVEL_NEXT[sourceLevel ?? ''] ?? 'destination'} event…`}
                  </option>
                  {toEventOptions.map(e => (
                    <option key={e.id} value={e.id}>{e.name} ({e.level})</option>
                  ))}
                </select>
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none text-[20px]">expand_more</span>
              </div>
              {toEventOptions.length === 0 && sourceLevel !== 'national' && (
                <p className="text-[10px] text-on-surface-variant/60 font-body">
                  Create a {LEVEL_NEXT[sourceLevel ?? ''] ?? 'higher-level'} event first.
                </p>
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
                    {promoteMode && <th className="w-12 px-5 py-3.5" />}
                    <th className="px-5 py-3.5 text-left text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60 font-headline">Rank</th>
                    <th className="px-5 py-3.5 text-left text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60 font-headline">Participant</th>
                    <th className="px-5 py-3.5 text-left text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60 font-headline">Constituency</th>
                    <th className="px-5 py-3.5 text-right text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60 font-headline">Pre-event</th>
                    <th className="px-5 py-3.5 text-right text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60 font-headline">Jury Avg</th>
                    <th className="px-5 py-3.5 text-right text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60 font-headline">Final</th>
                    <th className="w-12 px-3 py-3.5" />
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((entry, idx) => {
                    const isSelected = selected.has(entry.user_id);
                    const initials   = entry.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                    const rankColor  = idx === 0 ? 'text-amber-500' : idx === 1 ? 'text-slate-400' : idx === 2 ? 'text-orange-500' : 'text-on-surface-variant/40';
                    return (
                      <tr
                        key={entry.user_id}
                        onClick={() => promoteMode && toggleSelect(entry.user_id)}
                        className={`border-b border-surface-variant/20 last:border-0 transition-colors ${
                          promoteMode
                            ? `cursor-pointer ${isSelected ? 'bg-primary/5' : 'hover:bg-surface-container/30'}`
                            : 'hover:bg-surface-container/20'
                        }`}
                      >
                        {/* Checkbox */}
                        {promoteMode && (
                          <td className="px-5 py-3.5">
                            <div className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors ${isSelected ? 'bg-primary' : 'bg-surface-container border border-outline-variant/30'}`}>
                              {isSelected && <span className="material-symbols-outlined text-white text-[12px]">check</span>}
                            </div>
                          </td>
                        )}

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
                            <span className={`font-black font-headline text-xs ${rankColor}`}>#{idx + 1}</span>
                          )}
                        </td>

                        {/* Participant */}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="shrink-0">
                              {entry.photo_url ? (
                                <img src={entry.photo_url} alt={entry.name} className="w-9 h-9 rounded-xl object-cover" />
                              ) : (
                                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                                  <span className="text-xs font-headline font-bold text-primary">{initials}</span>
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

                        {/* Quick promote icon */}
                        <td className="px-3 py-3.5">
                          <button
                            type="button"
                            title="Add to promote selection"
                            onClick={e => { e.stopPropagation(); quickPromote(entry.user_id); }}
                            className={`p-1.5 rounded-lg transition-all ${
                              isSelected
                                ? 'text-primary bg-primary/10'
                                : 'text-on-surface-variant/30 hover:text-primary hover:bg-primary/5'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[18px]" style={isSelected ? { fontVariationSettings: "'FILL' 1" } : undefined}>
                              arrow_circle_up
                            </span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Sticky promote CTA ── */}
      {promoteMode && selected.size > 0 && toEvent && (
        <div className="sticky bottom-8 flex justify-center">
          <button
            type="button"
            onClick={handlePromote}
            disabled={promoting}
            className="flex items-center gap-3 px-8 py-3.5 rounded-full bg-gradient-to-r from-primary to-primary-container text-white font-headline font-bold text-sm shadow-[0_4px_24px_rgba(19,41,143,0.3)] hover:scale-[1.02] active:scale-[0.99] disabled:opacity-50 transition-all"
          >
            {promoting ? (
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <span className="material-symbols-outlined text-[20px]">arrow_upward</span>
            )}
            Promote {selected.size} Participant{selected.size !== 1 ? 's' : ''} → {events.find(e => e.id === toEvent)?.name}
          </button>
        </div>
      )}

      {/* Prompt to select destination when selections made but no destination */}
      {promoteMode && selected.size > 0 && !toEvent && (
        <div className="sticky bottom-8 flex justify-center">
          <div className="flex items-center gap-2 px-6 py-3 rounded-full bg-surface-container-lowest border border-primary/20 shadow-lg text-sm font-body text-on-surface-variant">
            <span className="material-symbols-outlined text-[18px] text-primary">info</span>
            {selected.size} selected — pick a destination event above to promote
          </div>
        </div>
      )}
    </div>
  );
};
