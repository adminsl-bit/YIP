import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ZONES, getZoneId, ZoneId } from '@/lib/regions';

interface EventRow {
  id: string;
  name: string;
  level: string;
  city: string | null;
  state: string | null;
  zone: string | null;
  status: string;
  participant_count: number;
  created_at: string;
}

interface MotionRow {
  id: string;
  event_id: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'discussed';
}

interface SessionItemRow {
  id: string;
  event_id: string | null;
  status: string;
}

const LEVEL_CONFIG: Record<string, { icon: string; pill: string; pillText: string; label: string }> = {
  city:     { icon: 'location_city', pill: 'bg-surface-container text-on-surface-variant',  pillText: 'text-on-surface-variant', label: 'City'     },
  regional: { icon: 'map',           pill: 'bg-secondary/10 text-secondary',                 pillText: 'text-secondary',          label: 'Regional' },
  national: { icon: 'flag',          pill: 'bg-primary/10 text-primary',                     pillText: 'text-primary',            label: 'National' },
};

// ── Zone helpers ─────────────────────────────────────────────────
const ZONE_IDS = new Set<string>(ZONES.map(z => z.id));
const resolveZoneId = (ev: EventRow): ZoneId | null =>
  (ev.zone && ZONE_IDS.has(ev.zone) ? (ev.zone as ZoneId) : null) ?? getZoneId(ev.state);

// Solid accent classes per zone, for "coverage" dots and card borders.
const ZONE_ACCENT: Record<ZoneId, { dot: string; border: string }> = {
  north:       { dot: 'bg-primary',            border: 'border-primary' },
  east:        { dot: 'bg-tertiary-fixed-dim',  border: 'border-tertiary' },
  west:        { dot: 'bg-secondary',          border: 'border-secondary' },
  northeast:   { dot: 'bg-error',              border: 'border-error' },
  south_tn:    { dot: 'bg-secondary',          border: 'border-secondary' },
  south_other: { dot: 'bg-tertiary-fixed-dim',  border: 'border-tertiary' },
};

interface ZoneStats {
  events: number;
  participants: number;
  active: number;
  completed: number;
  motionsTotal: number;
  motionsApproved: number;
}
const emptyZoneStats = (): ZoneStats => ({ events: 0, participants: 0, active: 0, completed: 0, motionsTotal: 0, motionsApproved: 0 });

interface Props {
  onNavigateToEvents?: () => void;
}

export const GlobalOverview = ({ onNavigateToEvents }: Props) => {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [totalSchools, setTotalSchools] = useState(0);
  const [motions, setMotions] = useState<MotionRow[]>([]);
  const [sessionItems, setSessionItems] = useState<SessionItemRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [
        { data: eventData, error: eventError },
        { count: schoolCount },
        { data: motionData },
        { data: sessionData },
      ] = await Promise.all([
        supabase.rpc('list_events_for_super_admin'),
        supabase.from('event_schools' as any).select('id', { count: 'exact', head: true }),
        supabase.from('motions' as any).select('id, event_id, status'),
        supabase.from('session_items').select('id, event_id, status'),
      ]);
      if (!eventError && eventData) setEvents(eventData as EventRow[]);
      setTotalSchools(schoolCount || 0);
      if (motionData) setMotions(motionData as unknown as MotionRow[]);
      if (sessionData) setSessionItems(sessionData as unknown as SessionItemRow[]);
      setLoading(false);
    };
    load();
  }, []);

  const byLevel = (level: string) => events.filter(e => e.level === level);
  const totalDelegates = useMemo(() => events.reduce((s, e) => s + (e.participant_count || 0), 0), [events]);
  const activeCount    = useMemo(() => events.filter(e => e.status === 'active').length, [events]);

  const funnelStages = useMemo(() => {
    const levels = ['city', 'regional', 'national'] as const;
    return levels.map(level => {
      const evs = byLevel(level);
      return {
        level,
        ...LEVEL_CONFIG[level],
        count: evs.length,
        delegates: evs.reduce((s, e) => s + (e.participant_count || 0), 0),
        active: evs.filter(e => e.status === 'active').length,
      };
    });
  }, [events]);

  const topCities = useMemo(() => {
    const map: Record<string, { delegates: number; events: number; hasActive: boolean }> = {};
    byLevel('city').forEach(ev => {
      const key = ev.city || 'Other';
      if (!map[key]) map[key] = { delegates: 0, events: 0, hasActive: false };
      map[key].delegates += ev.participant_count || 0;
      map[key].events    += 1;
      if (ev.status === 'active') map[key].hasActive = true;
    });
    return Object.entries(map)
      .map(([city, d]) => ({ city, ...d }))
      .sort((a, b) => b.delegates - a.delegates);
  }, [events]);

  const maxCityDelegates = Math.max(...topCities.map(c => c.delegates), 1);
  const uniqueCities = topCities.length;

  // ── Motions ──────────────────────────────────────────────────
  const approvedMotions = useMemo(() => motions.filter(m => m.status === 'approved').length, [motions]);
  const rejectedMotions = useMemo(() => motions.filter(m => m.status === 'rejected').length, [motions]);
  const pendingMotions  = motions.length - approvedMotions - rejectedMotions;
  const approvalRate    = motions.length > 0 ? Math.round((approvedMotions / motions.length) * 100) : 0;

  // ── Sessions ─────────────────────────────────────────────────
  const sessionsCompleted = useMemo(() => sessionItems.filter(s => s.status === 'completed').length, [sessionItems]);
  const sessionsActive    = useMemo(() => sessionItems.filter(s => s.status === 'active').length, [sessionItems]);
  const totalSessions     = sessionItems.length;
  const sessionsPending   = totalSessions - sessionsCompleted - sessionsActive;
  const sessionCompletionRate = totalSessions > 0 ? Math.round((sessionsCompleted / totalSessions) * 100) : 0;

  // ── Live snapshot (for "Top Hubs" sidebar) ──────────────────
  const activeEventsCount    = activeCount;
  const activeDelegatesCount = useMemo(() => events.filter(e => e.status === 'active').reduce((s, e) => s + (e.participant_count || 0), 0), [events]);

  // ── Zone stats ───────────────────────────────────────────────
  const zoneStats = useMemo(() => {
    const stats: Record<ZoneId, ZoneStats> = {
      north: emptyZoneStats(), east: emptyZoneStats(), west: emptyZoneStats(),
      northeast: emptyZoneStats(), south_tn: emptyZoneStats(), south_other: emptyZoneStats(),
    };
    const eventZone = new Map<string, ZoneId | null>(events.map(e => [e.id, resolveZoneId(e)]));
    events.forEach(ev => {
      const z = resolveZoneId(ev);
      if (!z) return;
      stats[z].events += 1;
      stats[z].participants += ev.participant_count || 0;
      if (ev.status === 'active') stats[z].active += 1;
      if (ev.status === 'completed') stats[z].completed += 1;
    });
    motions.forEach(m => {
      if (!m.event_id) return;
      const z = eventZone.get(m.event_id);
      if (!z) return;
      stats[z].motionsTotal += 1;
      if (m.status === 'approved') stats[z].motionsApproved += 1;
    });
    return stats;
  }, [events, motions]);

  const activeZonesCount = useMemo(() => ZONES.filter(z => zoneStats[z.id].events > 0).length, [zoneStats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">

      {/* Header */}
      <header>
        <h1 className="text-4xl font-extrabold font-headline tracking-tight text-primary">
          Global <span className="text-secondary">Overview</span>
        </h1>
        <p className="text-[10px] text-on-surface-variant/40 font-black uppercase tracking-[0.4em] mt-3 flex items-center gap-2 font-headline">
          <span className="material-symbols-outlined text-[12px]">public</span>
          YIP Parliament — All Events
        </p>
      </header>

      {/* ── Intelligence KPI row ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">

        {/* Active Delegates */}
        <div className="bg-surface-container-lowest rounded-[2rem] p-6 shadow-[0_4px_32px_0_rgba(19,41,143,0.06)] hover:shadow-[0_8px_32px_0_rgba(19,41,143,0.12)] border border-outline-variant/10 transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/10 text-primary">
              <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>groups</span>
            </div>
            <div className="flex items-center gap-1 text-on-surface-variant text-[10px] font-black uppercase tracking-wider font-headline bg-surface-container px-2.5 py-1 rounded-full">
              <span className="material-symbols-outlined text-[12px]">event</span>
              {events.length} Events
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="text-on-surface-variant text-sm font-body">Active Delegates</h3>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black font-headline text-on-surface">{totalDelegates}</span>
              <span className="text-xs text-on-surface-variant/50 font-body">registered</span>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-outline-variant/10">
            <div className="h-1.5 rounded-full overflow-hidden flex gap-0.5 bg-surface-container">
              {funnelStages.map(stage => {
                const pct = totalDelegates > 0 ? (stage.delegates / totalDelegates) * 100 : 0;
                return pct > 0 ? (
                  <div
                    key={stage.level}
                    className={`h-full first:rounded-l-full last:rounded-r-full ${
                      stage.level === 'city' ? 'bg-primary/60' :
                      stage.level === 'regional' ? 'bg-secondary/60' : 'bg-tertiary/60'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                ) : null;
              })}
              {totalDelegates === 0 && <div className="h-full w-full bg-surface-container rounded-full" />}
            </div>
            <p className="mt-2 text-[9px] font-black uppercase tracking-widest text-on-surface-variant/40 font-headline">
              City · Regional · National
            </p>
          </div>
        </div>

        {/* Resolutions Proposed */}
        <div className="bg-surface-container-lowest rounded-[2rem] p-6 shadow-[0_4px_32px_0_rgba(19,41,143,0.06)] hover:shadow-[0_8px_32px_0_rgba(19,41,143,0.12)] border border-outline-variant/10 transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-secondary/10 text-secondary">
              <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>description</span>
            </div>
            {motions.length > 0 ? (
              <div className="flex items-center gap-1 text-tertiary-container text-[10px] font-black uppercase tracking-wider font-headline bg-tertiary/10 px-2.5 py-1 rounded-full">
                <span className="material-symbols-outlined text-[12px]">trending_up</span>
                {approvalRate}% Passed
              </div>
            ) : (
              <div className="flex items-center gap-1 text-on-surface-variant text-[10px] font-black uppercase tracking-wider font-headline bg-surface-container px-2.5 py-1 rounded-full">
                No Motions
              </div>
            )}
          </div>
          <div className="space-y-1">
            <h3 className="text-on-surface-variant text-sm font-body">Resolutions Proposed</h3>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black font-headline text-on-surface">{motions.length}</span>
              <span className="text-xs text-on-surface-variant/50 font-body">{approvedMotions} approved</span>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-outline-variant/10">
            <div className="h-1.5 rounded-full overflow-hidden flex gap-0.5 bg-surface-container">
              {motions.length > 0 ? (
                <>
                  {approvedMotions > 0 && <div className="h-full bg-tertiary/60 first:rounded-l-full" style={{ width: `${(approvedMotions / motions.length) * 100}%` }} />}
                  {pendingMotions > 0 && <div className="h-full bg-secondary/60" style={{ width: `${(pendingMotions / motions.length) * 100}%` }} />}
                  {rejectedMotions > 0 && <div className="h-full bg-error/60 last:rounded-r-full" style={{ width: `${(rejectedMotions / motions.length) * 100}%` }} />}
                </>
              ) : (
                <div className="h-full w-full bg-surface-container rounded-full" />
              )}
            </div>
            <p className="mt-2 text-[9px] font-black uppercase tracking-widest text-on-surface-variant/40 font-headline">
              Passed · Review · Rejected
            </p>
          </div>
        </div>

        {/* Impact Hubs */}
        <div className="bg-surface-container-lowest rounded-[2rem] p-6 shadow-[0_4px_32px_0_rgba(19,41,143,0.06)] hover:shadow-[0_8px_32px_0_rgba(19,41,143,0.12)] border border-outline-variant/10 transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-tertiary/10 text-tertiary-container">
              <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>location_city</span>
            </div>
            <div className="flex items-center gap-1 text-on-surface-variant text-[10px] font-black uppercase tracking-wider font-headline bg-surface-container px-2.5 py-1 rounded-full">
              {events.length > 0 ? Math.round((activeCount / events.length) * 100) : 0}% Active
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="text-on-surface-variant text-sm font-body">Impact Hubs</h3>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black font-headline text-on-surface">{uniqueCities}</span>
              <span className="text-xs text-on-surface-variant/50 font-body">city chapters · {totalSchools} schools</span>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-outline-variant/10 flex items-center gap-1.5">
            {ZONES.map(zone => {
              const stats = zoneStats[zone.id];
              const has = stats.events > 0;
              const isLive = stats.active > 0;
              return (
                <span key={zone.id} title={`${zone.name}: ${stats.events} event${stats.events !== 1 ? 's' : ''}`} className="relative w-2.5 h-2.5">
                  {isLive && <span className={`absolute inset-0 rounded-full animate-ping opacity-40 ${ZONE_ACCENT[zone.id].dot}`} />}
                  <span className={`absolute inset-0 rounded-full ${has ? ZONE_ACCENT[zone.id].dot : 'bg-surface-container border border-outline-variant/30'}`} />
                </span>
              );
            })}
            <p className="ml-1 text-[9px] font-black uppercase tracking-widest text-on-surface-variant/40 font-headline">
              {activeZonesCount}/{ZONES.length} zones live
            </p>
          </div>
        </div>

        {/* Sessions Held */}
        <div className="bg-surface-container-lowest rounded-[2rem] p-6 shadow-[0_4px_32px_0_rgba(19,41,143,0.06)] hover:shadow-[0_8px_32px_0_rgba(19,41,143,0.12)] border border-outline-variant/10 transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-secondary/10 text-secondary">
              <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>gavel</span>
            </div>
            {totalSessions > 0 ? (
              <div className="flex items-center gap-1 text-primary text-[10px] font-black uppercase tracking-wider font-headline bg-primary/10 px-2.5 py-1 rounded-full">
                <span className="material-symbols-outlined text-[12px]">trending_up</span>
                {sessionCompletionRate}%
              </div>
            ) : (
              <div className="flex items-center gap-1 text-on-surface-variant text-[10px] font-black uppercase tracking-wider font-headline bg-surface-container px-2.5 py-1 rounded-full">
                No Sessions
              </div>
            )}
          </div>
          <div className="space-y-1">
            <h3 className="text-on-surface-variant text-sm font-body">Sessions Held</h3>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black font-headline text-on-surface">{sessionsCompleted}<span className="text-on-surface-variant/40 text-lg font-bold">/{totalSessions}</span></span>
              <span className="text-xs text-on-surface-variant/50 font-body">completed</span>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-outline-variant/10">
            <div className="h-1.5 rounded-full overflow-hidden flex gap-0.5 bg-surface-container">
              {totalSessions > 0 ? (
                <>
                  {sessionsCompleted > 0 && <div className="h-full bg-primary/60 first:rounded-l-full" style={{ width: `${(sessionsCompleted / totalSessions) * 100}%` }} />}
                  {sessionsActive > 0 && <div className="h-full bg-tertiary/60" style={{ width: `${(sessionsActive / totalSessions) * 100}%` }} />}
                  {sessionsPending > 0 && <div className="h-full bg-outline-color/30 last:rounded-r-full" style={{ width: `${(sessionsPending / totalSessions) * 100}%` }} />}
                </>
              ) : (
                <div className="h-full w-full bg-surface-container rounded-full" />
              )}
            </div>
            <p className="mt-2 text-[9px] font-black uppercase tracking-widest text-on-surface-variant/40 font-headline">
              Completed · Live · Pending
            </p>
          </div>
        </div>
      </div>

      {/* Middle Row: Funnel + Top Cities */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Delegate Pipeline — 2/3 */}
        <div className="lg:col-span-2 bg-surface-container-lowest rounded-[2rem] shadow-[0_4px_32px_0_rgba(19,41,143,0.06)] border border-outline-variant/10 overflow-hidden">
          <div className="px-8 py-6 border-b border-surface-variant/30 flex items-center justify-between">
            <div>
              <p className="font-headline font-bold text-on-surface">Delegate Pipeline</p>
              <p className="text-xs text-on-surface-variant font-body mt-0.5">City → Regional → National progression</p>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider font-headline text-on-surface-variant/60 bg-surface-container px-3 py-1.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-tertiary-fixed-dim animate-pulse" />
              Live Data
            </div>
          </div>

          <div className="p-8">
            {/* Funnel visual */}
            <div className="flex items-stretch gap-0">
              {funnelStages.map((stage, i) => {
                const maxDel = Math.max(...funnelStages.map(s => s.delegates), 1);
                const pct    = stage.delegates / maxDel;
                return (
                  <div key={stage.level} className="flex items-center flex-1">
                    <div className="flex-1">
                      {/* Stage card */}
                      <div className={`rounded-2xl p-5 border border-outline-variant/10 flex flex-col gap-3 transition-all ${
                        stage.active > 0
                          ? 'bg-primary/5 border-primary/10'
                          : 'bg-surface-container/40'
                      }`}>
                        <div className="flex items-center justify-between">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${LEVEL_CONFIG[stage.level].pill}`}>
                            <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                              {stage.icon}
                            </span>
                          </div>
                          {stage.active > 0 && (
                            <span className="flex items-center gap-1 text-[10px] font-black font-headline text-tertiary-container">
                              <span className="w-1.5 h-1.5 rounded-full bg-tertiary-fixed-dim animate-pulse" />
                              {stage.active} live
                            </span>
                          )}
                        </div>
                        <div>
                          <p className="text-2xl font-black font-headline text-on-surface leading-none">{stage.delegates}</p>
                          <p className="text-[10px] text-on-surface-variant font-body mt-0.5">delegates</p>
                        </div>
                        {/* Mini bar */}
                        <div className="h-1.5 bg-surface-container rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${
                              stage.level === 'city' ? 'bg-primary/50' :
                              stage.level === 'regional' ? 'bg-secondary/60' : 'bg-tertiary/60'
                            }`}
                            style={{ width: `${pct * 100}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className={`text-[10px] font-black uppercase tracking-wider font-headline ${LEVEL_CONFIG[stage.level].pillText}`}>
                            {stage.label}
                          </span>
                          <span className="text-[10px] text-on-surface-variant font-body">
                            {stage.count} event{stage.count !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                    </div>
                    {/* Arrow connector */}
                    {i < funnelStages.length - 1 && (
                      <div className="flex flex-col items-center px-2 shrink-0">
                        <span className="material-symbols-outlined text-[18px] text-on-surface-variant/30">chevron_right</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Summary bar */}
            <div className="mt-6 pt-5 border-t border-surface-variant/30">
              <div className="flex items-center gap-2 mb-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/50 font-headline">Level Distribution</p>
              </div>
              <div className="h-3 rounded-full overflow-hidden flex gap-0.5">
                {funnelStages.map(stage => {
                  const pct = totalDelegates > 0 ? (stage.delegates / totalDelegates) * 100 : 0;
                  return pct > 0 ? (
                    <div
                      key={stage.level}
                      className={`h-full transition-all duration-700 first:rounded-l-full last:rounded-r-full ${
                        stage.level === 'city' ? 'bg-primary/60' :
                        stage.level === 'regional' ? 'bg-secondary/60' : 'bg-tertiary/60'
                      }`}
                      style={{ width: `${pct}%` }}
                      title={`${stage.label}: ${Math.round(pct)}%`}
                    />
                  ) : null;
                })}
                {totalDelegates === 0 && <div className="h-full w-full bg-surface-container rounded-full" />}
              </div>
              <div className="flex items-center gap-4 mt-2">
                {funnelStages.map(stage => {
                  const pct = totalDelegates > 0 ? Math.round((stage.delegates / totalDelegates) * 100) : 0;
                  return (
                    <div key={stage.level} className="flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full ${
                        stage.level === 'city' ? 'bg-primary/60' :
                        stage.level === 'regional' ? 'bg-secondary/60' : 'bg-tertiary/60'
                      }`} />
                      <span className="text-[10px] font-body text-on-surface-variant">
                        {stage.label} <span className="font-bold text-on-surface">{pct}%</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Top Cities Ranking — 1/3 */}
        <div className="lg:col-span-1 bg-surface-container-lowest rounded-[2rem] shadow-[0_4px_32px_0_rgba(19,41,143,0.06)] border border-outline-variant/10 overflow-hidden flex flex-col">
          <div className="px-8 py-6 border-b border-surface-variant/30 flex items-center justify-between">
            <div>
              <p className="font-headline font-bold text-on-surface">Top City Hubs</p>
              <p className="text-xs text-on-surface-variant font-body mt-0.5">Ranked by delegates</p>
            </div>
            <div className="w-9 h-9 bg-secondary/10 rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px] text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>leaderboard</span>
            </div>
          </div>

          <div className="px-5 py-4 overflow-y-auto max-h-80 flex-1">
            {topCities.length === 0 ? (
              <div className="text-center py-10 text-on-surface-variant">
                <span className="material-symbols-outlined text-[36px] text-on-surface-variant/30">location_off</span>
                <p className="mt-2 text-xs font-body">No city events yet.</p>
              </div>
            ) : (
              <div className="space-y-1">
                {topCities.map((c, i) => (
                  <div key={c.city} className="relative flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-container/50 transition-colors group">
                    {/* Background progress bar */}
                    <div
                      className="absolute inset-y-0 left-0 rounded-xl bg-primary/5 transition-all duration-700"
                      style={{ width: `${(c.delegates / maxCityDelegates) * 100}%` }}
                    />
                    {/* Rank */}
                    <span className={`relative shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-[11px] font-black font-headline ${
                      i === 0 ? 'bg-secondary text-white' :
                      i === 1 ? 'bg-secondary/20 text-secondary' :
                      i === 2 ? 'bg-outline-variant/30 text-on-surface-variant' :
                      'text-on-surface-variant/50'
                    }`}>
                      {i < 3 ? ['1', '2', '3'][i] : i + 1}
                    </span>
                    {/* City info */}
                    <div className="relative flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-headline font-bold text-on-surface text-xs truncate">{c.city}</p>
                        {c.hasActive && (
                          <span className="w-1.5 h-1.5 rounded-full bg-tertiary-fixed-dim animate-pulse shrink-0" />
                        )}
                      </div>
                      <p className="text-[10px] text-on-surface-variant font-body">
                        {c.events} event{c.events !== 1 ? 's' : ''}
                      </p>
                    </div>
                    {/* Delegate count */}
                    <div className="relative text-right shrink-0">
                      <p className="font-black font-headline text-primary text-sm">{c.delegates}</p>
                      <p className="text-[10px] text-on-surface-variant/60 font-body">del.</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Live Now */}
          <div className="px-5 pb-5">
            <div className="p-4 rounded-2xl border border-dashed border-outline-variant/30 flex items-center gap-4">
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-on-surface-variant/50 font-headline shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-tertiary-fixed-dim animate-pulse" />
                Live
              </div>
              <div className="flex-grow space-y-1.5">
                <div className="flex justify-between text-[11px]">
                  <span className="font-body text-on-surface-variant">Active Sessions</span>
                  <span className="font-black font-headline text-primary">{sessionsActive}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="font-body text-on-surface-variant">Active Delegates</span>
                  <span className="font-black font-headline text-primary">{activeDelegatesCount}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="font-body text-on-surface-variant">Active Events</span>
                  <span className="font-black font-headline text-primary">{activeEventsCount}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Zone Intelligence ── */}
      <div>
        <div className="mb-6">
          <h2 className="font-headline text-2xl font-extrabold text-primary">Zone Intelligence</h2>
          <p className="text-xs text-on-surface-variant font-body mt-1">Legislative output and live activity across all {ZONES.length} zones</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Legislative Output by Zone */}
          <div className="bg-surface-container-lowest rounded-[2rem] shadow-[0_4px_32px_0_rgba(19,41,143,0.06)] border border-outline-variant/10 p-6 md:p-8">
            <div className="mb-6">
              <h3 className="font-headline font-bold text-on-surface text-lg">Legislative Output by Zone</h3>
              <p className="text-xs text-on-surface-variant font-body mt-0.5">Motions passed vs. under review</p>
            </div>
            <div className="space-y-5">
              {ZONES.map(zone => {
                const stats = zoneStats[zone.id];
                const passedPct = stats.motionsTotal > 0 ? (stats.motionsApproved / stats.motionsTotal) * 100 : 0;
                const remaining = stats.motionsTotal - stats.motionsApproved;
                const remainingPct = 100 - passedPct;
                return (
                  <div key={zone.id} className="space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-on-surface-variant">{zone.name}</span>
                      <span className="text-on-surface-variant/40 font-body">{stats.motionsTotal} Total</span>
                    </div>
                    <div className="h-8 w-full bg-surface-container rounded-lg flex overflow-hidden">
                      {stats.motionsTotal === 0 ? (
                        <div className="h-full w-full flex items-center justify-center text-[10px] text-on-surface-variant/40 font-body">No motions yet</div>
                      ) : (
                        <>
                          {stats.motionsApproved > 0 && (
                            <div className="h-full bg-primary flex items-center justify-center text-[10px] text-white font-bold font-headline" style={{ width: `${passedPct}%` }}>
                              {passedPct > 18 ? `Passed (${stats.motionsApproved})` : ''}
                            </div>
                          )}
                          {remaining > 0 && (
                            <div className="h-full bg-primary/20 flex items-center justify-center text-[10px] text-on-surface font-bold font-headline" style={{ width: `${remainingPct}%` }}>
                              {remainingPct > 18 ? `In Review (${remaining})` : ''}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Zone Snapshot */}
          <div className="bg-surface-container-lowest rounded-[2rem] shadow-[0_4px_32px_0_rgba(19,41,143,0.06)] border border-outline-variant/10 p-6 md:p-8">
            <div className="mb-6">
              <h3 className="font-headline font-bold text-on-surface text-lg">Zone Snapshot</h3>
              <p className="text-xs text-on-surface-variant font-body mt-0.5">Delegates, live activity &amp; impact score</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {ZONES.map(zone => {
                const stats = zoneStats[zone.id];
                const impactScore = stats.events > 0 ? Math.round((stats.completed / stats.events) * 100) / 10 : 0;
                return (
                  <div key={zone.id} className={`bg-surface rounded-2xl p-5 border-l-4 ${ZONE_ACCENT[zone.id].border} border-y border-r border-outline-variant/10`}>
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="font-headline font-bold text-on-surface text-sm">{zone.name}</h4>
                        <p className="text-[10px] text-on-surface-variant/50 uppercase tracking-widest font-black font-headline mt-0.5">{zone.shortLabel}</p>
                      </div>
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${zone.bg} ${zone.color}`}>
                        <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>{zone.icon}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-[9px] text-on-surface-variant/60 uppercase font-black tracking-wider font-headline">Delegates</p>
                        <p className="text-xl font-black font-headline text-on-surface leading-none mt-1">{stats.participants}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-on-surface-variant/60 uppercase font-black tracking-wider font-headline">Live</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          {stats.active > 0 && <span className="w-1.5 h-1.5 rounded-full bg-tertiary-fixed-dim animate-pulse shrink-0" />}
                          <p className="text-xl font-black font-headline text-on-surface leading-none">{stats.active}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-surface-container/50">
                      <span className="text-xs font-semibold text-on-surface-variant font-body">Impact Score</span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-base font-black font-headline text-primary">{impactScore}</span>
                        <span className="text-[10px] text-on-surface-variant/50 font-body">/10</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Upcoming & Completed Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Upcoming */}
        {(() => {
          const upcoming = events.filter(e => e.status === 'upcoming');
          const byLvl = (l: string) => upcoming.filter(e => e.level === l);
          const delegates = upcoming.reduce((s, e) => s + (e.participant_count || 0), 0);
          return (
            <div className="bg-surface-container-lowest rounded-[2rem] shadow-[0_4px_32px_0_rgba(19,41,143,0.06)] border border-outline-variant/10 overflow-hidden flex flex-col">
              <div className="px-8 py-6 border-b border-surface-variant/30 flex items-center justify-between">
                <div>
                  <p className="font-headline font-bold text-on-surface">Upcoming Events</p>
                  <p className="text-xs text-on-surface-variant font-body mt-0.5">Scheduled & not yet started</p>
                </div>
                <div className="w-9 h-9 bg-surface-container-high rounded-xl flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px] text-on-surface-variant" style={{ fontVariationSettings: "'FILL' 1" }}>schedule</span>
                </div>
              </div>

              <div className="p-8 flex-1 flex flex-col gap-6">
                {/* Big stat */}
                <div className="flex items-end gap-4">
                  <div>
                    <p className="text-5xl font-black font-headline text-on-surface leading-none">{upcoming.length}</p>
                    <p className="text-xs text-on-surface-variant font-body mt-1">events scheduled</p>
                  </div>
                  {delegates > 0 && (
                    <div className="pb-0.5">
                      <p className="text-2xl font-black font-headline text-primary leading-none">{delegates}</p>
                      <p className="text-[10px] text-on-surface-variant font-body mt-0.5">delegates registered</p>
                    </div>
                  )}
                </div>

                {/* Level breakdown */}
                <div className="space-y-2">
                  {(['city', 'regional', 'national'] as const).map(lvl => {
                    const n = byLvl(lvl).length;
                    const cfg = LEVEL_CONFIG[lvl];
                    return (
                      <div key={lvl} className="flex items-center gap-3">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full font-headline w-24 shrink-0 ${cfg.pill}`}>
                          <span className="material-symbols-outlined text-[11px]" style={{ fontVariationSettings: "'FILL' 1" }}>{cfg.icon}</span>
                          {cfg.label}
                        </span>
                        <div className="flex-1 h-1.5 bg-surface-container rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-outline-color/40 transition-all duration-700"
                            style={{ width: upcoming.length > 0 ? `${(n / upcoming.length) * 100}%` : '0%' }}
                          />
                        </div>
                        <span className="text-sm font-black font-headline text-on-surface w-4 text-right shrink-0">{n}</span>
                      </div>
                    );
                  })}
                </div>

                {upcoming.length === 0 && (
                  <p className="text-sm text-on-surface-variant/60 font-body text-center py-4">No upcoming events.</p>
                )}
              </div>

              <div className="px-8 pb-8 mt-auto">
                <button
                  onClick={onNavigateToEvents}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-full bg-gradient-to-r from-primary to-primary-container text-white font-headline font-bold text-sm hover:scale-[1.02] active:scale-[0.99] transition-transform shadow-[0_4px_16px_rgba(19,41,143,0.2)]"
                >
                  <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                  Manage Events
                </button>
              </div>
            </div>
          );
        })()}

        {/* Completed */}
        {(() => {
          const completed = events.filter(e => e.status === 'completed');
          const byLvl = (l: string) => completed.filter(e => e.level === l);
          const delegates = completed.reduce((s, e) => s + (e.participant_count || 0), 0);
          const topEvent = [...completed].sort((a, b) => (b.participant_count || 0) - (a.participant_count || 0))[0];
          return (
            <div className="bg-surface-container-lowest rounded-[2rem] shadow-[0_4px_32px_0_rgba(19,41,143,0.06)] border border-outline-variant/10 overflow-hidden flex flex-col">
              <div className="px-8 py-6 border-b border-surface-variant/30 flex items-center justify-between">
                <div>
                  <p className="font-headline font-bold text-on-surface">Completed Events</p>
                  <p className="text-xs text-on-surface-variant font-body mt-0.5">Finished sessions & outcomes</p>
                </div>
                <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>task_alt</span>
                </div>
              </div>

              <div className="p-8 flex-1 flex flex-col gap-6">
                {/* Big stat */}
                <div className="flex items-end gap-4">
                  <div>
                    <p className="text-5xl font-black font-headline text-on-surface leading-none">{completed.length}</p>
                    <p className="text-xs text-on-surface-variant font-body mt-1">events completed</p>
                  </div>
                  {delegates > 0 && (
                    <div className="pb-0.5">
                      <p className="text-2xl font-black font-headline text-primary leading-none">{delegates}</p>
                      <p className="text-[10px] text-on-surface-variant font-body mt-0.5">total delegates trained</p>
                    </div>
                  )}
                </div>

                {/* Level breakdown */}
                <div className="space-y-2">
                  {(['city', 'regional', 'national'] as const).map(lvl => {
                    const n = byLvl(lvl).length;
                    const cfg = LEVEL_CONFIG[lvl];
                    return (
                      <div key={lvl} className="flex items-center gap-3">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full font-headline w-24 shrink-0 ${cfg.pill}`}>
                          <span className="material-symbols-outlined text-[11px]" style={{ fontVariationSettings: "'FILL' 1" }}>{cfg.icon}</span>
                          {cfg.label}
                        </span>
                        <div className="flex-1 h-1.5 bg-surface-container rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary/40 transition-all duration-700"
                            style={{ width: completed.length > 0 ? `${(n / completed.length) * 100}%` : '0%' }}
                          />
                        </div>
                        <span className="text-sm font-black font-headline text-on-surface w-4 text-right shrink-0">{n}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Top event callout */}
                {topEvent && (
                  <div className="bg-surface-container/40 rounded-2xl px-4 py-3 flex items-center gap-3 border border-outline-variant/10">
                    <div className="w-8 h-8 bg-secondary/10 rounded-xl flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[16px] text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>emoji_events</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-on-surface-variant/60 font-body uppercase tracking-wider font-headline">Largest event</p>
                      <p className="text-xs font-bold font-headline text-on-surface truncate">{topEvent.name}</p>
                    </div>
                    <p className="text-sm font-black font-headline text-primary shrink-0">{topEvent.participant_count}</p>
                  </div>
                )}

                {completed.length === 0 && (
                  <p className="text-sm text-on-surface-variant/60 font-body text-center py-4">No completed events yet.</p>
                )}
              </div>

              <div className="px-8 pb-8 mt-auto">
                <button
                  onClick={onNavigateToEvents}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-full bg-gradient-to-r from-primary to-primary-container text-white font-headline font-bold text-sm hover:scale-[1.02] active:scale-[0.99] transition-transform shadow-[0_4px_16px_rgba(19,41,143,0.2)]"
                >
                  <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                  View All Events
                </button>
              </div>
            </div>
          );
        })()}

      </div>

    </div>
  );
};
