import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface EventRow {
  id: string;
  name: string;
  level: string;
  city: string | null;
  state: string | null;
  status: string;
  participant_count: number;
  created_at: string;
}


const STATUS_DOT: Record<string, string> = {
  active:    'bg-tertiary-fixed-dim',
  upcoming:  'bg-outline-color',
  completed: 'bg-outline-color/40',
};
const STATUS_LABEL: Record<string, string> = {
  active: 'Live', upcoming: 'Upcoming', completed: 'Done',
};

const LEVEL_CONFIG: Record<string, { icon: string; pill: string; pillText: string; label: string }> = {
  city:     { icon: 'location_city', pill: 'bg-surface-container text-on-surface-variant',  pillText: 'text-on-surface-variant', label: 'City'     },
  regional: { icon: 'map',           pill: 'bg-secondary/10 text-secondary',                 pillText: 'text-secondary',          label: 'Regional' },
  national: { icon: 'flag',          pill: 'bg-primary/10 text-primary',                     pillText: 'text-primary',            label: 'National' },
};

interface Props {
  onNavigateToEvents?: () => void;
}

export const GlobalOverview = ({ onNavigateToEvents }: Props) => {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.rpc('list_events_for_super_admin').then(({ data, error }) => {
      if (!error && data) setEvents(data as EventRow[]);
      setLoading(false);
    });
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

  const kpi = [
    { label: 'Total Events',    value: events.length, icon: 'event',         bg: 'bg-primary/10',   text: 'text-primary'   },
    { label: 'Live Now',        value: activeCount,   icon: 'sensors',       bg: 'bg-tertiary-fixed/20', text: 'text-tertiary-container' },
    { label: 'Total Delegates', value: totalDelegates, icon: 'groups',       bg: 'bg-secondary/10', text: 'text-secondary' },
    { label: 'City Hubs',       value: byLevel('city').length, icon: 'location_city', bg: 'bg-primary/10', text: 'text-primary' },
  ];

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

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpi.map(k => (
          <div key={k.label} className="bg-surface-container-lowest rounded-[2rem] p-8 shadow-[0_4px_32px_0_rgba(19,41,143,0.06)] hover:shadow-[0_8px_32px_0_rgba(19,41,143,0.12)] border border-outline-variant/10 flex flex-col gap-3 transition-shadow">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${k.bg}`}>
              <span className={`material-symbols-outlined text-[22px] ${k.text}`} style={{ fontVariationSettings: "'FILL' 1" }}>
                {k.icon}
              </span>
            </div>
            <div>
              <p className="text-3xl font-black font-headline text-on-surface leading-none">{k.value}</p>
              <p className="text-xs text-on-surface-variant font-body mt-1">{k.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Middle Row: Funnel + Top Cities */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Delegate Funnel — 2/3 */}
        <div className="lg:col-span-2 bg-surface-container-lowest rounded-[2rem] shadow-[0_4px_32px_0_rgba(19,41,143,0.06)] border border-outline-variant/10 overflow-hidden">
          <div className="px-8 py-6 border-b border-surface-variant/30 flex items-center justify-between">
            <div>
              <p className="font-headline font-bold text-on-surface">Delegate Pipeline</p>
              <p className="text-xs text-on-surface-variant font-body mt-0.5">City → Regional → National progression</p>
            </div>
            <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px] text-primary">arrow_forward</span>
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
                        <span className="material-symbols-outlined text-[18px] text-outline/40">chevron_right</span>
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
        <div className="lg:col-span-1 bg-surface-container-lowest rounded-[2rem] shadow-[0_4px_32px_0_rgba(19,41,143,0.06)] border border-outline-variant/10 overflow-hidden">
          <div className="px-8 py-6 border-b border-surface-variant/30 flex items-center justify-between">
            <div>
              <p className="font-headline font-bold text-on-surface">Top City Hubs</p>
              <p className="text-xs text-on-surface-variant font-body mt-0.5">Ranked by delegates</p>
            </div>
            <div className="w-9 h-9 bg-secondary/10 rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px] text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>leaderboard</span>
            </div>
          </div>

          <div className="px-5 py-4 overflow-y-auto max-h-80">
            {topCities.length === 0 ? (
              <div className="text-center py-10 text-on-surface-variant">
                <span className="material-symbols-outlined text-[36px] text-outline">location_off</span>
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
                      i === 2 ? 'bg-outline/20 text-on-surface-variant' :
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
