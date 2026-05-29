import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface EventOption {
  id: string;
  name: string;
  level: string;
  status: string;
  participant_count: number;
}

interface LeaderboardEntry {
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

export const PromoteParticipants = () => {
  const [events, setEvents] = useState<EventOption[]>([]);
  const [fromEvent, setFromEvent] = useState('');
  const [toEvent, setToEvent] = useState('');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    supabase.rpc('list_events_for_super_admin').then(({ data }) => {
      if (data) setEvents(data as EventOption[]);
      setLoading(false);
    });
  }, []);

  const fetchLeaderboard = useCallback(async (eventId: string) => {
    setLoadingLeaderboard(true);
    setSelected(new Set());
    const { data, error } = await supabase.rpc('get_event_leaderboard', { p_event_id: eventId });
    if (!error && data) setLeaderboard(data as LeaderboardEntry[]);
    setLoadingLeaderboard(false);
  }, []);

  useEffect(() => {
    if (fromEvent) fetchLeaderboard(fromEvent);
    else setLeaderboard([]);
  }, [fromEvent, fetchLeaderboard]);

  // Only show destination events at a higher level than source
  const sourceLevel = events.find(e => e.id === fromEvent)?.level;
  const toEventOptions = events.filter(e =>
    sourceLevel && LEVEL_ORDER[e.level] > LEVEL_ORDER[sourceLevel]
  );

  const toggleSelect = (uid: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid); else next.add(uid);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(leaderboard.map(e => e.user_id)));
  const clearAll = () => setSelected(new Set());

  const handlePromote = async () => {
    if (!fromEvent || !toEvent || selected.size === 0) {
      toast({ title: 'Select a source event, destination event, and at least one participant', variant: 'destructive' });
      return;
    }
    setPromoting(true);
    const { error } = await supabase.rpc('promote_participants', {
      p_user_ids: Array.from(selected),
      p_from_event: fromEvent,
      p_to_event: toEvent,
    });
    setPromoting(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: `${selected.size} participant${selected.size !== 1 ? 's' : ''} promoted`, description: 'They will now appear in the destination event.' });
      clearAll();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-4xl font-extrabold font-headline tracking-tight text-primary">
          Promote <span className="text-secondary">Participants</span>
        </h1>
        <p className="text-[10px] text-on-surface-variant/40 font-black uppercase tracking-[0.4em] mt-3 flex items-center gap-2 font-headline">
          <span className="material-symbols-outlined text-[12px]">arrow_upward</span>
          City → Regional → National
        </p>
      </header>

      {/* Event selectors */}
      <div className="bg-white rounded-2xl border border-outline-variant/30 shadow-sm p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-bold text-on-surface-variant mb-2 font-headline uppercase tracking-wider">
              Source Event (promote FROM)
            </label>
            <select
              className="w-full border border-outline-variant rounded-xl px-4 py-2.5 text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/30"
              value={fromEvent}
              onChange={e => { setFromEvent(e.target.value); setToEvent(''); }}
            >
              <option value="">Select source event</option>
              {events.filter(e => e.level !== 'national').map(e => (
                <option key={e.id} value={e.id}>{e.name} ({e.level})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-on-surface-variant mb-2 font-headline uppercase tracking-wider">
              Destination Event (promote TO)
            </label>
            <select
              className="w-full border border-outline-variant rounded-xl px-4 py-2.5 text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/30"
              value={toEvent}
              onChange={e => setToEvent(e.target.value)}
              disabled={!fromEvent || toEventOptions.length === 0}
            >
              <option value="">
                {!fromEvent ? 'Select source first' : toEventOptions.length === 0 ? 'No higher-level events' : 'Select destination event'}
              </option>
              {toEventOptions.map(e => (
                <option key={e.id} value={e.id}>{e.name} ({e.level})</option>
              ))}
            </select>
            {fromEvent && toEventOptions.length === 0 && (
              <p className="text-xs text-on-surface-variant/60 mt-1.5 font-body">
                Create a regional or national event first in the Events tab.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Leaderboard selection */}
      {fromEvent && (
        <div className="bg-white rounded-2xl border border-outline-variant/30 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-outline-variant/20 flex items-center justify-between">
            <div>
              <p className="font-headline font-bold text-on-surface text-sm">
                Ranked Participants — {events.find(e => e.id === fromEvent)?.name}
              </p>
              <p className="text-xs text-on-surface-variant font-body mt-0.5">
                {selected.size > 0 ? `${selected.size} selected` : 'Select participants to promote'}
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={selectAll} className="text-xs font-bold font-headline text-primary hover:underline">Select All</button>
              <span className="text-on-surface-variant/30">|</span>
              <button onClick={clearAll} className="text-xs font-bold font-headline text-on-surface-variant hover:underline">Clear</button>
            </div>
          </div>

          {loadingLeaderboard ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm font-body">
                <thead>
                  <tr className="border-b border-outline-variant/20 bg-surface-container/30">
                    <th className="w-12 px-5 py-3"></th>
                    {['Rank','Name','Position','Constituency','Pre-event','Jury Avg','Final Score'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60 font-headline whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((entry, idx) => (
                    <tr
                      key={entry.user_id}
                      onClick={() => toggleSelect(entry.user_id)}
                      className={`border-b border-outline-variant/10 cursor-pointer transition-colors ${
                        selected.has(entry.user_id) ? 'bg-primary/5' : 'hover:bg-surface-container/30'
                      }`}
                    >
                      <td className="px-5 py-3.5">
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                          selected.has(entry.user_id) ? 'bg-primary border-primary' : 'border-outline-variant'
                        }`}>
                          {selected.has(entry.user_id) && (
                            <span className="material-symbols-outlined text-white text-[12px]">check</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`font-black font-headline text-xs ${idx < 3 ? 'text-secondary' : 'text-on-surface-variant'}`}>
                          #{idx + 1}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-bold text-on-surface font-headline">{entry.name}</td>
                      <td className="px-4 py-3.5 text-on-surface-variant text-xs">{entry.position}</td>
                      <td className="px-4 py-3.5 text-on-surface-variant text-xs max-w-[140px] truncate">{entry.constituency || '—'}</td>
                      <td className="px-4 py-3.5 text-on-surface font-body">
                        {entry.preevent_scores != null ? Number(entry.preevent_scores).toFixed(1) : '—'}
                      </td>
                      <td className="px-4 py-3.5 text-on-surface font-body">
                        {entry.avg_jury_score != null ? Number(entry.avg_jury_score).toFixed(1) : '—'}
                      </td>
                      <td className="px-4 py-3.5 font-bold text-primary font-headline">
                        {entry.final_score != null ? Number(entry.final_score).toFixed(2) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {leaderboard.length === 0 && (
                <div className="text-center py-12 text-on-surface-variant">
                  <span className="material-symbols-outlined text-[40px] text-outline">group_off</span>
                  <p className="mt-3 text-sm font-body">No participants in this event yet.</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Promote button */}
      {selected.size > 0 && toEvent && (
        <div className="sticky bottom-8 flex justify-center">
          <button
            onClick={handlePromote}
            disabled={promoting}
            className="flex items-center gap-3 px-8 py-3.5 rounded-2xl bg-primary text-white font-headline font-bold text-sm shadow-lg hover:bg-primary/90 disabled:opacity-50 transition"
          >
            {promoting ? (
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <span className="material-symbols-outlined text-[20px]">arrow_upward</span>
            )}
            Promote {selected.size} Participant{selected.size !== 1 ? 's' : ''} →{' '}
            {events.find(e => e.id === toEvent)?.name}
          </button>
        </div>
      )}
    </div>
  );
};
