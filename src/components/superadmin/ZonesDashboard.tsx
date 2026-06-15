import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { ZONES, getZoneId, ZoneId } from '@/lib/regions';
import { Pencil, Check, Printer } from 'lucide-react';

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

const ZONE_IDS = new Set<string>(ZONES.map(z => z.id));
const resolveZoneId = (ev: EventRow): ZoneId | null =>
  (ev.zone && ZONE_IDS.has(ev.zone) ? (ev.zone as ZoneId) : null) ?? getZoneId(ev.state);

interface ZoneStats {
  events: number;
  chapters: number;
  participants: number;
  schools: number;
  resultsPublished: number;
}

const emptyStats = (): ZoneStats => ({ events: 0, chapters: 0, participants: 0, schools: 0, resultsPublished: 0 });

export const ZonesDashboard = () => {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [schoolEventIds, setSchoolEventIds] = useState<string[]>([]);
  const [rmNames, setRmNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [editingZone, setEditingZone] = useState<ZoneId | null>(null);
  const [editValue, setEditValue] = useState('');

  useEffect(() => {
    const load = async () => {
      const [{ data: eventData, error: eventError }, { data: zoneData, error: zoneError }, { data: schoolData }] = await Promise.all([
        supabase.rpc('list_events_for_super_admin'),
        supabase.from('zone_managers' as any).select('zone_id, rm_name'),
        supabase.from('event_schools' as any).select('event_id'),
      ]);
      if (!eventError && eventData) setEvents(eventData as EventRow[]);
      if (!zoneError && zoneData) {
        const map: Record<string, string> = {};
        (zoneData as any[]).forEach(row => { if (row.rm_name) map[row.zone_id] = row.rm_name; });
        setRmNames(map);
      }
      if (schoolData) setSchoolEventIds((schoolData as any[]).map(row => row.event_id as string));
      setLoading(false);
    };
    load();
  }, []);

  const eventsByZone = useMemo(() => {
    const map: Record<ZoneId, EventRow[]> = {
      north: [], east: [], west: [], northeast: [], south_tn: [], south_other: [],
    };
    const unassigned: EventRow[] = [];
    events.forEach(ev => {
      const zoneId = resolveZoneId(ev);
      if (zoneId) map[zoneId].push(ev);
      else unassigned.push(ev);
    });
    return { map, unassigned };
  }, [events]);

  const zoneStats = useMemo(() => {
    const stats: Record<ZoneId, ZoneStats> = {
      north: emptyStats(), east: emptyStats(), west: emptyStats(),
      northeast: emptyStats(), south_tn: emptyStats(), south_other: emptyStats(),
    };
    ZONES.forEach(zone => {
      const zoneEvents = eventsByZone.map[zone.id];
      const zoneEventIds = new Set(zoneEvents.map(e => e.id));
      stats[zone.id] = {
        events: zoneEvents.length,
        chapters: new Set(zoneEvents.map(e => e.city).filter(Boolean)).size,
        participants: zoneEvents.reduce((s, e) => s + (e.participant_count || 0), 0),
        schools: schoolEventIds.filter(eventId => zoneEventIds.has(eventId)).length,
        resultsPublished: zoneEvents.filter(e => e.status === 'completed').length,
      };
    });
    return stats;
  }, [eventsByZone, schoolEventIds]);

  const kpi = useMemo(() => {
    const activeZones = ZONES.filter(z => zoneStats[z.id].events > 0).length;
    const totalEvents = events.length;
    const totalParticipants = events.reduce((s, e) => s + (e.participant_count || 0), 0);
    const resultsPublished = events.filter(e => e.status === 'completed').length;
    return { activeZones, totalEvents, totalParticipants, resultsPublished };
  }, [events, zoneStats]);

  const impactStory = useMemo(() => {
    const statesCovered = new Set(events.map(e => e.state).filter(Boolean)).size;
    const chaptersTotal = new Set(events.map(e => e.city).filter(Boolean)).size;
    const schoolsTotal = schoolEventIds.length;
    const leadingZone = [...ZONES].sort((a, b) => zoneStats[b.id].participants - zoneStats[a.id].participants)[0];
    return { statesCovered, chaptersTotal, schoolsTotal, leadingZone };
  }, [events, zoneStats, schoolEventIds]);

  const startEdit = (zoneId: ZoneId) => {
    setEditingZone(zoneId);
    setEditValue(rmNames[zoneId] || '');
  };

  const saveRmName = async (zoneId: ZoneId) => {
    const name = editValue.trim();
    const { error } = await supabase
      .from('zone_managers' as any)
      .upsert({ zone_id: zoneId, rm_name: name, updated_at: new Date().toISOString() });
    if (error) {
      toast({ title: 'Could not save RM name', description: error.message, variant: 'destructive' });
      return;
    }
    setRmNames(prev => ({ ...prev, [zoneId]: name }));
    setEditingZone(null);
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

      {/* Header */}
      <header className="flex items-start justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-4xl font-extrabold font-headline tracking-tight text-primary">
            Zones <span className="text-secondary">& Impact</span>
          </h1>
          <p className="text-[10px] text-on-surface-variant/40 font-black uppercase tracking-[0.4em] mt-3 flex items-center gap-2 font-headline">
            <span className="material-symbols-outlined text-[12px]">map</span>
            Regional Breakdown & Leadership Report
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-primary text-white font-headline font-bold text-sm shrink-0 hover:bg-primary/90 transition-colors"
        >
          <Printer className="w-4 h-4" />
          Print Report
        </button>
      </header>

      {/* Print-only title */}
      <div className="hidden print:block">
        <h1 className="text-3xl font-extrabold font-headline text-primary">YIP Parliament — Zones &amp; Impact Report</h1>
        <p className="text-xs text-on-surface-variant font-body mt-1">
          Generated {new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Active Zones', value: `${kpi.activeZones} / ${ZONES.length}`, icon: 'map', bg: 'bg-primary/10', text: 'text-primary' },
          { label: 'Total Events', value: kpi.totalEvents, icon: 'event', bg: 'bg-secondary/10', text: 'text-secondary' },
          { label: 'Total Participants', value: kpi.totalParticipants, icon: 'groups', bg: 'bg-tertiary/10', text: 'text-on-tertiary-fixed-variant' },
          { label: 'Results Published', value: kpi.resultsPublished, icon: 'task_alt', bg: 'bg-error/8', text: 'text-error' },
        ].map(k => (
          <div key={k.label} className="bg-surface-container-lowest rounded-[2rem] p-8 shadow-[0_4px_32px_0_rgba(19,41,143,0.06)] border border-outline-variant/10 flex flex-col gap-3 print:shadow-none print:border-outline-variant/30">
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

      {/* Zone Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {ZONES.map(zone => {
          const stats = zoneStats[zone.id];
          const resultsPct = stats.events > 0 ? Math.round((stats.resultsPublished / stats.events) * 100) : 0;
          return (
            <div key={zone.id} className="bg-surface-container-lowest rounded-[2rem] shadow-[0_4px_32px_0_rgba(19,41,143,0.06)] border border-outline-variant/10 overflow-hidden print:shadow-none print:border-outline-variant/30 print:break-inside-avoid">
              <div className="px-6 py-5 border-b border-surface-variant/30 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${zone.bg}`}>
                    <span className={`material-symbols-outlined text-[20px] ${zone.color}`} style={{ fontVariationSettings: "'FILL' 1" }}>
                      {zone.icon}
                    </span>
                  </div>
                  <div>
                    <p className="font-headline font-extrabold text-on-surface text-sm">{zone.name}</p>
                    <span className="text-[10px] text-on-surface-variant/50 font-black uppercase tracking-widest font-headline">{zone.shortLabel}</span>
                  </div>
                </div>
              </div>

              <div className="px-6 py-5 space-y-4">
                {/* RM name */}
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] text-on-surface-variant/50 font-black uppercase tracking-widest font-headline">Regional Manager</p>
                  {editingZone === zone.id ? (
                    <div className="flex items-center gap-1.5 print:hidden">
                      <input
                        autoFocus
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && saveRmName(zone.id)}
                        placeholder="RM name"
                        className="text-xs font-bold font-headline text-on-surface bg-surface-container rounded-lg px-2 py-1 w-32 outline-none border border-primary/20 focus:border-primary"
                      />
                      <button onClick={() => saveRmName(zone.id)} className="text-primary hover:text-primary/70">
                        <Check className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => startEdit(zone.id)} className="flex items-center gap-1.5 group print:cursor-default">
                      <span className="font-headline font-bold text-on-surface text-sm">{rmNames[zone.id] || '—'}</span>
                      <Pencil className="w-3 h-3 text-on-surface-variant/30 group-hover:text-primary transition-colors print:hidden" />
                    </button>
                  )}
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="bg-surface-container/50 rounded-xl py-3">
                    <p className="text-xl font-black font-headline text-on-surface leading-none">{stats.events}</p>
                    <p className="text-[9px] text-on-surface-variant/60 font-black uppercase tracking-widest font-headline mt-1">Events</p>
                  </div>
                  <div className="bg-surface-container/50 rounded-xl py-3">
                    <p className="text-xl font-black font-headline text-on-surface leading-none">{stats.chapters}</p>
                    <p className="text-[9px] text-on-surface-variant/60 font-black uppercase tracking-widest font-headline mt-1">Chapters</p>
                  </div>
                  <div className="bg-surface-container/50 rounded-xl py-3">
                    <p className="text-xl font-black font-headline text-on-surface leading-none">{stats.participants}</p>
                    <p className="text-[9px] text-on-surface-variant/60 font-black uppercase tracking-widest font-headline mt-1">Students</p>
                  </div>
                  <div className="bg-surface-container/50 rounded-xl py-3">
                    <p className="text-xl font-black font-headline text-on-surface leading-none">{stats.schools}</p>
                    <p className="text-[9px] text-on-surface-variant/60 font-black uppercase tracking-widest font-headline mt-1">Schools</p>
                  </div>
                </div>

                {/* Results published */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[10px] text-on-surface-variant font-body">
                      {stats.resultsPublished} of {stats.events} event{stats.events !== 1 ? 's' : ''} with results published
                    </p>
                    <p className="text-[10px] font-black font-headline text-on-surface">{resultsPct}%</p>
                  </div>
                  <div className="h-1.5 bg-surface-container rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-primary/50 transition-all duration-700" style={{ width: `${resultsPct}%` }} />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Impact Story */}
      <div className="bg-surface-container-lowest rounded-[2rem] shadow-[0_4px_32px_0_rgba(19,41,143,0.06)] border border-outline-variant/10 overflow-hidden print:shadow-none print:border-outline-variant/30 print:break-before-page">
        <div className="px-8 py-6 border-b border-surface-variant/30 flex items-center justify-between">
          <div>
            <p className="font-headline font-bold text-on-surface">Impact Story</p>
            <p className="text-xs text-on-surface-variant font-body mt-0.5">National reach &amp; outcomes, at a glance</p>
          </div>
          <div className="w-9 h-9 bg-secondary/10 rounded-xl flex items-center justify-center print:hidden">
            <span className="material-symbols-outlined text-[20px] text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>auto_stories</span>
          </div>
        </div>

        <div className="p-8 space-y-6">
          <p className="font-body text-on-surface leading-relaxed">
            YIP Parliament has reached <span className="font-bold text-primary">{impactStory.statesCovered} state{impactStory.statesCovered !== 1 ? 's' : ''}</span> across <span className="font-bold text-primary">{kpi.activeZones} of {ZONES.length} zones</span>, hosting <span className="font-bold text-primary">{kpi.totalEvents} event{kpi.totalEvents !== 1 ? 's' : ''}</span> through <span className="font-bold text-primary">{impactStory.chaptersTotal} city chapter{impactStory.chaptersTotal !== 1 ? 's' : ''}</span> and training <span className="font-bold text-primary">{kpi.totalParticipants} delegate{kpi.totalParticipants !== 1 ? 's' : ''}</span> so far.
            {' '}Of these, <span className="font-bold text-primary">{kpi.resultsPublished} event{kpi.resultsPublished !== 1 ? 's' : ''}</span> have published results.
            {impactStory.leadingZone && zoneStats[impactStory.leadingZone.id].participants > 0 && (
              <> The <span className="font-bold text-primary">{impactStory.leadingZone.name}</span> zone leads with <span className="font-bold text-primary">{zoneStats[impactStory.leadingZone.id].participants} delegates</span>{rmNames[impactStory.leadingZone.id] ? ` under RM ${rmNames[impactStory.leadingZone.id]}` : ''}.</>
            )}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-surface-container/40 rounded-2xl p-5 border border-outline-variant/10">
              <p className="text-2xl font-black font-headline text-on-surface leading-none">{impactStory.statesCovered}</p>
              <p className="text-[10px] text-on-surface-variant font-body mt-1.5">States represented</p>
            </div>
            <div className="bg-surface-container/40 rounded-2xl p-5 border border-outline-variant/10">
              <p className="text-2xl font-black font-headline text-on-surface leading-none">{impactStory.chaptersTotal}</p>
              <p className="text-[10px] text-on-surface-variant font-body mt-1.5">City chapters active</p>
            </div>
            <div className="bg-surface-container/40 rounded-2xl p-5 border border-outline-variant/10">
              <p className="text-2xl font-black font-headline text-on-surface leading-none">{impactStory.schoolsTotal}</p>
              <p className="text-[10px] text-on-surface-variant font-body mt-1.5">Schools reached</p>
            </div>
            <div className="bg-surface-container/40 rounded-2xl p-5 border border-outline-variant/10">
              <p className="text-2xl font-black font-headline text-on-surface leading-none">{kpi.totalParticipants}</p>
              <p className="text-[10px] text-on-surface-variant font-body mt-1.5">Delegates trained</p>
            </div>
            <div className="bg-surface-container/40 rounded-2xl p-5 border border-outline-variant/10">
              <p className="text-2xl font-black font-headline text-on-surface leading-none">{kpi.totalEvents > 0 ? Math.round((kpi.resultsPublished / kpi.totalEvents) * 100) : 0}%</p>
              <p className="text-[10px] text-on-surface-variant font-body mt-1.5">Events with results published</p>
            </div>
          </div>

          {eventsByZone.unassigned.length > 0 && (
            <p className="text-[10px] text-on-surface-variant/50 font-body print:hidden">
              {eventsByZone.unassigned.length} event{eventsByZone.unassigned.length !== 1 ? 's' : ''} not counted above — missing or unrecognized state.
            </p>
          )}
        </div>
      </div>

    </div>
  );
};
