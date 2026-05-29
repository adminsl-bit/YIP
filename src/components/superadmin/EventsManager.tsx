import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface EventRow {
  id: string;
  name: string;
  level: string;
  city: string | null;
  state: string | null;
  parent_event_id: string | null;
  status: string;
  participant_count: number;
  created_at: string;
}

const INDIAN_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat',
  'Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh',
  'Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab',
  'Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh',
  'Uttarakhand','West Bengal',
  'Andaman and Nicobar Islands','Chandigarh','Dadra and Nagar Haveli and Daman and Diu',
  'Delhi','Jammu and Kashmir','Ladakh','Lakshadweep','Puducherry',
];

const CITIES = [
  'Agartala','Agra','Ahmedabad','Aizawl','Ajmer','Aligarh','Amravati','Amritsar',
  'Asansol','Aurangabad','Bengaluru','Bhopal','Bhubaneswar','Bikaner','Chandigarh',
  'Chennai','Coimbatore','Cuttack','Dehradun','Delhi','Dhanbad','Dispur','Durgapur',
  'Faridabad','Ghaziabad','Guwahati','Gwalior','Hubli','Hyderabad','Imphal',
  'Indore','Itanagar','Jabalpur','Jaipur','Jalandhar','Jammu','Jamshedpur',
  'Jodhpur','Kanpur','Kochi','Kohima','Kolkata','Lucknow','Ludhiana','Madurai',
  'Mangaluru','Meerut','Mumbai','Mysuru','Nagpur','Nashik','Navi Mumbai',
  'Noida','Panjim','Patna','Pune','Raipur','Rajkot','Ranchi','Shillong',
  'Shimla','Siliguri','Srinagar','Surat','Thane','Thiruvananthapuram','Tiruchirappalli',
  'Vadodara','Varanasi','Vijayawada','Visakhapatnam','Warangal',
];

const STATUS_COLORS: Record<string, string> = {
  upcoming:  'bg-yellow-50 text-yellow-700 border border-yellow-200',
  active:    'bg-green-50 text-green-700 border border-green-200',
  completed: 'bg-slate-100 text-slate-600 border border-slate-200',
};

const blankForm = {
  name: '',
  level: 'city' as 'city' | 'regional' | 'national',
  city: '',
  state: '',
  parent_event_id: '',
  status: 'upcoming' as 'upcoming' | 'active' | 'completed',
};

export const EventsManager = () => {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(blankForm);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const fetchEvents = useCallback(async () => {
    const { data, error } = await supabase.rpc('list_events_for_super_admin');
    if (!error && data) setEvents(data as EventRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const handleCreate = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Name required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      level: form.level,
      status: form.status,
    };
    if (form.city) payload.city = form.city;
    if (form.state) payload.state = form.state;
    if (form.parent_event_id) payload.parent_event_id = form.parent_event_id;

    const { error } = await supabase.from('events').insert(payload);
    setSaving(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Event created' });
      setForm(blankForm);
      setShowForm(false);
      fetchEvents();
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    const { error } = await supabase.from('events').update({ status }).eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setEvents(prev => prev.map(e => e.id === id ? { ...e, status } : e));
    }
  };

  const parentOptions = events.filter(e => {
    if (form.level === 'regional') return e.level === 'city';
    if (form.level === 'national') return e.level === 'regional';
    return false;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-4xl font-extrabold font-headline tracking-tight text-primary">
            Events <span className="text-secondary">Manager</span>
          </h1>
          <p className="text-[10px] text-on-surface-variant/40 font-black uppercase tracking-[0.4em] mt-3 flex items-center gap-2 font-headline">
            <span className="material-symbols-outlined text-[12px]">event</span>
            City · Regional · National
          </p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white font-headline font-bold text-sm shadow-sm hover:bg-primary/90 transition"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          New Event
        </button>
      </header>

      {/* Create form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-outline-variant/30 shadow-sm p-6 space-y-5">
          <h2 className="font-headline font-bold text-on-surface text-base">Create New Event</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-on-surface-variant mb-1 font-headline uppercase tracking-wider">Event Name *</label>
              <input
                className="w-full border border-outline-variant rounded-xl px-4 py-2.5 text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="e.g. YIP City Parliament — Chennai 2025"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-on-surface-variant mb-1 font-headline uppercase tracking-wider">Level *</label>
              <select
                className="w-full border border-outline-variant rounded-xl px-4 py-2.5 text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/30"
                value={form.level}
                onChange={e => setForm(f => ({ ...f, level: e.target.value as typeof form.level, parent_event_id: '' }))}
              >
                <option value="city">City</option>
                <option value="regional">Regional</option>
                <option value="national">National</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-on-surface-variant mb-1 font-headline uppercase tracking-wider">Status</label>
              <select
                className="w-full border border-outline-variant rounded-xl px-4 py-2.5 text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/30"
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value as typeof form.status }))}
              >
                <option value="upcoming">Upcoming</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            {form.level === 'city' && (
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1 font-headline uppercase tracking-wider">City</label>
                <select
                  className="w-full border border-outline-variant rounded-xl px-4 py-2.5 text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/30"
                  value={form.city}
                  onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                >
                  <option value="">Select city</option>
                  {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-on-surface-variant mb-1 font-headline uppercase tracking-wider">State</label>
              <select
                className="w-full border border-outline-variant rounded-xl px-4 py-2.5 text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/30"
                value={form.state}
                onChange={e => setForm(f => ({ ...f, state: e.target.value }))}
              >
                <option value="">Select state</option>
                {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {parentOptions.length > 0 && (
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-on-surface-variant mb-1 font-headline uppercase tracking-wider">
                  Parent Event ({form.level === 'regional' ? 'City' : 'Regional'})
                </label>
                <select
                  className="w-full border border-outline-variant rounded-xl px-4 py-2.5 text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/30"
                  value={form.parent_event_id}
                  onChange={e => setForm(f => ({ ...f, parent_event_id: e.target.value }))}
                >
                  <option value="">None</option>
                  {parentOptions.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleCreate}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white font-headline font-bold text-sm hover:bg-primary/90 disabled:opacity-50 transition"
            >
              {saving ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <span className="material-symbols-outlined text-[16px]">check</span>
              )}
              Create Event
            </button>
            <button
              onClick={() => { setShowForm(false); setForm(blankForm); }}
              className="px-5 py-2.5 rounded-xl border border-outline-variant text-on-surface-variant font-body text-sm hover:bg-surface-container transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Events table */}
      <div className="bg-white rounded-2xl border border-outline-variant/30 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-body">
            <thead>
              <tr className="border-b border-outline-variant/30 bg-surface-container/50">
                {['Name','Level','Location','Status','Participants','Actions'].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60 font-headline whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {events.map(ev => (
                <tr key={ev.id} className="border-b border-outline-variant/10 hover:bg-surface-container/30 transition-colors">
                  <td className="px-5 py-3.5 font-bold text-on-surface font-headline max-w-[200px] truncate">{ev.name}</td>
                  <td className="px-5 py-3.5">
                    <span className="capitalize text-xs font-bold font-headline px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                      {ev.level}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-on-surface-variant text-xs">
                    {[ev.city, ev.state].filter(Boolean).join(', ') || '—'}
                  </td>
                  <td className="px-5 py-3.5">
                    <select
                      value={ev.status}
                      onChange={e => handleStatusChange(ev.id, e.target.value)}
                      className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full font-headline cursor-pointer border-0 focus:ring-0 ${STATUS_COLORS[ev.status] || ''}`}
                    >
                      <option value="upcoming">Upcoming</option>
                      <option value="active">Active</option>
                      <option value="completed">Completed</option>
                    </select>
                  </td>
                  <td className="px-5 py-3.5 font-bold text-primary font-headline">{ev.participant_count}</td>
                  <td className="px-5 py-3.5">
                    <span className="text-[10px] font-body text-on-surface-variant/60 select-all">{ev.id.slice(0, 8)}…</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {events.length === 0 && (
            <div className="text-center py-16 text-on-surface-variant">
              <span className="material-symbols-outlined text-[40px] text-outline">event_busy</span>
              <p className="mt-3 text-sm font-body">No events yet. Click "New Event" to get started.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
