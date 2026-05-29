import { useState, useEffect } from 'react';
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

const STATUS_COLORS: Record<string, string> = {
  upcoming:  'bg-yellow-50 text-yellow-700 border border-yellow-200',
  active:    'bg-green-50 text-green-700 border border-green-200',
  completed: 'bg-slate-100 text-slate-600 border border-slate-200',
};

const LEVEL_ICON: Record<string, string> = {
  city:     'location_city',
  regional: 'map',
  national: 'flag',
};

export const GlobalOverview = () => {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .rpc('list_events_for_super_admin')
      .then(({ data, error }) => {
        if (!error && data) setEvents(data as EventRow[]);
        setLoading(false);
      });
  }, []);

  const byLevel = (level: string) => events.filter(e => e.level === level);
  const total = events.reduce((s, e) => s + (e.participant_count || 0), 0);
  const active = events.filter(e => e.status === 'active').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-4xl font-extrabold font-headline tracking-tight text-primary">
          Global <span className="text-secondary">Overview</span>
        </h1>
        <p className="text-[10px] text-on-surface-variant/40 font-black uppercase tracking-[0.4em] mt-3 flex items-center gap-2 font-headline">
          <span className="material-symbols-outlined text-[12px]">public</span>
          YIP Parliament — All Events
        </p>
      </header>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Events',   value: events.length,                   icon: 'event',         color: 'text-primary' },
          { label: 'Active Now',     value: active,                           icon: 'play_circle',   color: 'text-green-600' },
          { label: 'Total Delegates',value: total,                            icon: 'groups',        color: 'text-secondary' },
          { label: 'Cities',         value: byLevel('city').length,           icon: 'location_city', color: 'text-violet-600' },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-2xl p-5 border border-outline-variant/30 shadow-sm">
            <span className={`material-symbols-outlined text-[28px] ${stat.color}`} style={{ fontVariationSettings: "'FILL' 1" }}>
              {stat.icon}
            </span>
            <p className="text-3xl font-black font-headline mt-2 text-on-surface">{stat.value}</p>
            <p className="text-xs text-on-surface-variant font-body mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Events by level */}
      {(['national', 'regional', 'city'] as const).map(level => {
        const levelEvents = byLevel(level);
        if (levelEvents.length === 0) return null;
        return (
          <section key={level}>
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-[18px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                {LEVEL_ICON[level]}
              </span>
              <h2 className="font-headline font-bold text-on-surface capitalize text-lg">{level} Events</h2>
              <span className="text-xs font-black font-headline px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                {levelEvents.length}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {levelEvents.map(ev => (
                <div key={ev.id} className="bg-white rounded-2xl p-5 border border-outline-variant/30 shadow-sm flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-headline font-bold text-on-surface text-sm leading-snug">{ev.name}</p>
                    <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full whitespace-nowrap font-headline ${STATUS_COLORS[ev.status] || ''}`}>
                      {ev.status}
                    </span>
                  </div>
                  {(ev.city || ev.state) && (
                    <p className="text-xs text-on-surface-variant font-body flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px]">place</span>
                      {[ev.city, ev.state].filter(Boolean).join(', ')}
                    </p>
                  )}
                  <div className="flex items-center gap-1 mt-auto">
                    <span className="material-symbols-outlined text-[14px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>group</span>
                    <span className="text-sm font-bold font-headline text-primary">{ev.participant_count}</span>
                    <span className="text-xs text-on-surface-variant font-body">participants</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}

      {events.length === 0 && (
        <div className="text-center py-20 text-on-surface-variant">
          <span className="material-symbols-outlined text-[48px] text-outline">event_busy</span>
          <p className="mt-4 font-body text-sm">No events yet. Create one in the Events tab.</p>
        </div>
      )}
    </div>
  );
};
