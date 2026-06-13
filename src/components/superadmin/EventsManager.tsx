import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { CommitteePartyEditor, defaultCommittees, defaultParties } from './CommitteePartyEditor';

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

const ITEMS_PER_PAGE = 10;

type LevelFilter  = 'all' | 'city' | 'regional' | 'national';
type StatusFilter = 'all' | 'upcoming' | 'active' | 'completed';

const STATUS_STYLE: Record<string, { dot: string; text: string; label: string }> = {
  upcoming:  { dot: 'bg-outline',           text: 'text-outline',           label: 'Upcoming'  },
  active:    { dot: 'bg-tertiary-fixed-dim', text: 'text-tertiary',          label: 'Active'    },
  completed: { dot: 'bg-primary-container',  text: 'text-primary-container', label: 'Completed' },
};

const LEVEL_BADGE: Record<string, string> = {
  city:     'bg-surface-container-high text-on-surface-variant',
  regional: 'bg-secondary-fixed/50 text-on-secondary-fixed-variant',
  national: 'bg-primary/10 text-primary',
};

const LEVEL_AVATAR: Record<string, string> = {
  city:     'bg-surface-container-high text-on-surface-variant',
  regional: 'bg-secondary/10 text-secondary',
  national: 'bg-primary/10 text-primary',
};

const LEVEL_ICON: Record<string, string> = {
  city: 'location_city', regional: 'map', national: 'flag',
};

const fieldCls = 'w-full bg-surface-container-low border-none rounded-2xl px-6 py-4 text-sm font-body focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all appearance-none outline-none placeholder:text-outline/50';

const blankForm = {
  name: '',
  level: 'city' as 'city' | 'regional' | 'national',
  city: '',
  state: '',
  parent_event_id: '',
  status: 'upcoming' as 'upcoming' | 'active' | 'completed',
};

type EditForm = typeof blankForm;

const SelectField = ({ label, value, onChange, children }: {
  label: string; value: string; onChange: (v: string) => void; children: React.ReactNode;
}) => (
  <div>
    <label className="block text-xs font-bold text-primary mb-2 ml-1 uppercase tracking-wider font-headline">{label}</label>
    <div className="relative">
      <select value={value} onChange={e => onChange(e.target.value)} className={fieldCls}>
        {children}
      </select>
      <span className="material-symbols-outlined absolute right-5 top-1/2 -translate-y-1/2 text-outline pointer-events-none text-[20px]">expand_more</span>
    </div>
  </div>
);

export const EventsManager = () => {
  const [events, setEvents]   = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Create
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm]             = useState(blankForm);
  const [saving, setSaving]         = useState(false);
  const [createStep, setCreateStep] = useState<1 | 2>(1);
  const [createCommittees, setCreateCommittees] = useState<string[]>(() => defaultCommittees(5));
  const [createParties, setCreateParties]       = useState<string[]>(() => defaultParties(5));

  // Filters
  const [levelFilter, setLevelFilter]   = useState<LevelFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch]             = useState('');
  const [currentPage, setCurrentPage]   = useState(1);

  // View
  const [viewEvent, setViewEvent] = useState<EventRow | null>(null);

  // Edit
  const [editEvent, setEditEvent]     = useState<EventRow | null>(null);
  const [editForm, setEditForm]       = useState<EditForm>(blankForm);
  const [editSaving, setEditSaving]   = useState(false);
  const [editStep, setEditStep]       = useState<1 | 2>(1);
  const [editCommittees, setEditCommittees] = useState<string[]>([]);
  const [editParties, setEditParties]       = useState<string[]>([]);
  const [originalCommittees, setOriginalCommittees] = useState<string[]>([]);
  const [originalParties, setOriginalParties]       = useState<string[]>([]);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<EventRow | null>(null);
  const [deleting, setDeleting]         = useState(false);

  // Staff assignment
  const [staffUsers, setStaffUsers]       = useState<{ user_id: string; name: string; email: string; user_type: string; event_id: string | null }[]>([]);
  const [assignOrganizer, setAssignOrganizer] = useState('');
  const [assignJury, setAssignJury]       = useState<Set<string>>(new Set());
  const [loadingStaff, setLoadingStaff]   = useState(false);

  const { toast } = useToast();

  const fetchEvents = useCallback(async () => {
    const { data, error } = await supabase.rpc('list_events_for_super_admin');
    if (!error && data) setEvents(data as EventRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  // ── Filtered + paginated ─────────────────────────────────────────────────
  const filtered = useMemo(() => events.filter(ev => {
    if (levelFilter !== 'all' && ev.level !== levelFilter) return false;
    if (statusFilter !== 'all' && ev.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        ev.name.toLowerCase().includes(q) ||
        (ev.city  || '').toLowerCase().includes(q) ||
        (ev.state || '').toLowerCase().includes(q) ||
        ev.id.toLowerCase().includes(q)
      );
    }
    return true;
  }), [events, levelFilter, statusFilter, search]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated  = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const applyLevel  = (f: LevelFilter)  => { setLevelFilter(f);  setCurrentPage(1); };
  const applyStatus = (f: StatusFilter) => { setStatusFilter(f); setCurrentPage(1); };
  const applySearch = (q: string)       => { setSearch(q);        setCurrentPage(1); };

  const start = filtered.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const end   = Math.min(currentPage * ITEMS_PER_PAGE, filtered.length);

  const pageNumbers = useMemo(() => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (currentPage <= 3) return [1, 2, 3, '…', totalPages];
    if (currentPage >= totalPages - 2) return [1, '…', totalPages - 2, totalPages - 1, totalPages];
    return [1, '…', currentPage - 1, currentPage, currentPage + 1, '…', totalPages];
  }, [currentPage, totalPages]);

  // ── Create ───────────────────────────────────────────────────────────────
  const resetCreateState = () => {
    setForm(blankForm);
    setCreateStep(1);
    setCreateCommittees(defaultCommittees(5));
    setCreateParties(defaultParties(5));
  };

  const handleCreate = async () => {
    if (!form.name.trim()) { toast({ title: 'Name required', variant: 'destructive' }); return; }
    setSaving(true);
    const payload: Record<string, unknown> = { name: form.name.trim(), level: form.level, status: form.status };
    if (form.city)             payload.city             = form.city;
    if (form.state)            payload.state            = form.state;
    if (form.parent_event_id)  payload.parent_event_id  = form.parent_event_id;
    const { data: newEvent, error } = await supabase.from('events').insert(payload).select('id').single();
    if (!error && newEvent) {
      await supabase.from('event_committees').insert(
        createCommittees.map((name, i) => ({ event_id: newEvent.id, name, display_order: i }))
      );
      await supabase.from('event_parties').insert(
        createParties.map((name, i) => ({ event_id: newEvent.id, name, display_order: i }))
      );
    }
    setSaving(false);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); }
    else { toast({ title: 'Event created' }); resetCreateState(); setShowCreate(false); fetchEvents(); }
  };

  // ── Edit ─────────────────────────────────────────────────────────────────
  const openEdit = async (ev: EventRow) => {
    setEditEvent(ev);
    setEditStep(1);
    setEditForm({ name: ev.name, level: ev.level as EditForm['level'], city: ev.city || '', state: ev.state || '', parent_event_id: ev.parent_event_id || '', status: ev.status as EditForm['status'] });
    setLoadingStaff(true);
    const { data } = await supabase
      .from('profiles')
      .select('user_id, name, email, user_type, event_id')
      .in('user_type', ['organizer', 'jury']);
    if (data) {
      setStaffUsers(data);
      const org = data.find(u => u.user_type === 'organizer' && u.event_id === ev.id);
      setAssignOrganizer(org?.user_id || '');
      setAssignJury(new Set(data.filter(u => u.user_type === 'jury' && u.event_id === ev.id).map(u => u.user_id)));
    }
    setLoadingStaff(false);

    const { data: committeeRows } = await supabase.from('event_committees').select('name').eq('event_id', ev.id).order('display_order');
    const { data: partyRows }     = await supabase.from('event_parties').select('name').eq('event_id', ev.id).order('display_order');
    const committees = (committeeRows ?? []).map((r: { name: string }) => r.name);
    const parties    = (partyRows ?? []).map((r: { name: string }) => r.name);
    setEditCommittees(committees);
    setEditParties(parties);
    setOriginalCommittees(committees);
    setOriginalParties(parties);
  };

  const handleEditSave = async () => {
    if (!editEvent || !editForm.name.trim()) { toast({ title: 'Name required', variant: 'destructive' }); return; }
    setEditSaving(true);

    const { error } = await supabase.from('events').update({
      name: editForm.name.trim(), level: editForm.level, status: editForm.status,
      city: editForm.city || null, state: editForm.state || null,
      parent_event_id: editForm.parent_event_id || null,
    }).eq('id', editEvent.id);

    if (!error) {
      // Unassign organizers previously on this event who are no longer selected
      const prevOrgs = staffUsers.filter(u => u.user_type === 'organizer' && u.event_id === editEvent.id);
      for (const u of prevOrgs) {
        if (u.user_id !== assignOrganizer) {
          await supabase.from('profiles').update({ event_id: null }).eq('user_id', u.user_id);
        }
      }
      if (assignOrganizer) {
        await supabase.from('profiles').update({ event_id: editEvent.id }).eq('user_id', assignOrganizer);
      }

      // Unassign jury previously on this event who are no longer selected
      const prevJury = staffUsers.filter(u => u.user_type === 'jury' && u.event_id === editEvent.id);
      for (const u of prevJury) {
        if (!assignJury.has(u.user_id)) {
          await supabase.from('profiles').update({ event_id: null }).eq('user_id', u.user_id);
        }
      }
      for (const uid of assignJury) {
        await supabase.from('profiles').update({ event_id: editEvent.id }).eq('user_id', uid);
      }

      // Committees / Parties — only touch & reassign if the configuration actually changed
      const committeesChanged = JSON.stringify(editCommittees) !== JSON.stringify(originalCommittees);
      const partiesChanged    = JSON.stringify(editParties)    !== JSON.stringify(originalParties);
      if (committeesChanged || partiesChanged) {
        if (committeesChanged) {
          await supabase.from('event_committees').delete().eq('event_id', editEvent.id);
          await supabase.from('event_committees').insert(
            editCommittees.map((name, i) => ({ event_id: editEvent.id, name, display_order: i }))
          );
        }
        if (partiesChanged) {
          await supabase.from('event_parties').delete().eq('event_id', editEvent.id);
          await supabase.from('event_parties').insert(
            editParties.map((name, i) => ({ event_id: editEvent.id, name, display_order: i }))
          );
        }
        const { error: reassignError } = await supabase.rpc('reassign_event_committees_parties', { p_event_id: editEvent.id });
        if (reassignError) {
          toast({ title: 'Reassignment failed', description: reassignError.message, variant: 'destructive' });
        }
      }
    }

    setEditSaving(false);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); }
    else { toast({ title: 'Event updated' }); setEditEvent(null); fetchEvents(); }
  };

  // ── Delete ───────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from('events').delete().eq('id', deleteTarget.id);
    setDeleting(false);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); }
    else { toast({ title: 'Event deleted', description: `"${deleteTarget.name}" has been removed.` }); setDeleteTarget(null); fetchEvents(); }
  };

  const parentOptions = (level: string, excludeId?: string) =>
    events.filter(e =>
      level === 'city' ? e.level === 'regional' && e.id !== excludeId : false
    );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Shared form body ─────────────────────────────────────────────────────
  const renderFormFields = (f: EditForm, setF: (fn: (prev: EditForm) => EditForm) => void, excludeId?: string) => (
    <div className="space-y-6">
      {/* Name */}
      <div>
        <label className="block text-xs font-bold text-primary mb-2 ml-1 uppercase tracking-wider font-headline">Event Name *</label>
        <input
          className={fieldCls}
          placeholder="e.g. YIP City Parliament — Chennai 2025"
          value={f.name}
          onChange={e => setF(prev => ({ ...prev, name: e.target.value }))}
        />
      </div>

      {/* Level + Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SelectField label="Level *" value={f.level} onChange={v => setF(prev => ({ ...prev, level: v as EditForm['level'], parent_event_id: '' }))}>
          <option value="city">City</option>
          <option value="regional">Regional</option>
          <option value="national">National</option>
        </SelectField>
        <SelectField label="Status" value={f.status} onChange={v => setF(prev => ({ ...prev, status: v as EditForm['status'] }))}>
          <option value="upcoming">Upcoming</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
        </SelectField>
      </div>

      {/* City + State */}
      <div className={`grid grid-cols-1 gap-6 ${f.level === 'city' ? 'md:grid-cols-2' : ''}`}>
        {f.level === 'city' && (
          <SelectField label="City" value={f.city} onChange={v => setF(prev => ({ ...prev, city: v }))}>
            <option value="">Select city</option>
            {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
          </SelectField>
        )}
        <SelectField label="State" value={f.state} onChange={v => setF(prev => ({ ...prev, state: v }))}>
          <option value="">Select state</option>
          {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
        </SelectField>
      </div>

      {/* Parent — city events roll up to a regional event */}
      {f.level === 'city' && parentOptions(f.level, excludeId).length > 0 && (
        <SelectField
          label="Parent Regional Event"
          value={f.parent_event_id}
          onChange={v => setF(prev => ({ ...prev, parent_event_id: v }))}
        >
          <option value="">None</option>
          {parentOptions(f.level, excludeId).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </SelectField>
      )}
    </div>
  );

  return (
    <div className="space-y-8">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-4xl font-extrabold font-headline tracking-tight text-primary">
            Events <span className="text-secondary">Manager</span>
          </h1>
          <p className="text-[10px] text-on-surface-variant/40 font-black uppercase tracking-[0.4em] mt-3 flex items-center gap-2 font-headline">
            <span className="material-symbols-outlined text-[12px]">event</span>
            City · Regional · National
          </p>
          {/* Level filter pills */}
          <div className="flex items-center gap-2 mt-4 flex-wrap">
            {(['all', 'city', 'regional', 'national'] as LevelFilter[]).map(level => (
              <button
                key={level}
                onClick={() => applyLevel(level)}
                className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest font-headline transition-all ${
                  levelFilter === level
                    ? 'bg-primary text-white shadow-[0_4px_12px_rgba(19,41,143,0.25)]'
                    : 'text-on-surface-variant border border-outline-variant/20 hover:border-outline-variant/50 hover:text-on-surface'
                }`}
              >
                {level === 'all' ? 'All Events' : level}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-primary to-primary-container text-white font-headline font-bold text-sm shadow-lg shadow-primary/10 hover:scale-[1.02] active:scale-[0.99] transition-all"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          New Event
        </button>
      </header>

      {/* ── Search + Status filter ───────────────────────────────────────────── */}
      <div className="bg-surface-container-low rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 group w-full">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors text-[20px]">search</span>
          <input
            type="text"
            value={search}
            onChange={e => applySearch(e.target.value)}
            placeholder="Search events by name, location or ID..."
            className="w-full pl-12 pr-4 py-3 bg-surface-container-lowest border-none rounded-xl focus:ring-2 focus:ring-primary/20 transition-all font-body text-sm outline-none"
          />
        </div>
        <div className="relative shrink-0">
          <select
            value={statusFilter}
            onChange={e => applyStatus(e.target.value as StatusFilter)}
            className="pl-4 pr-10 py-3 bg-surface-container-lowest text-on-surface-variant rounded-xl border border-outline-variant/10 hover:bg-surface-container-high transition-colors font-body text-sm font-bold appearance-none outline-none cursor-pointer"
          >
            <option value="all">Status: All</option>
            <option value="upcoming">Upcoming</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
          </select>
          <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none text-[18px]">expand_more</span>
        </div>
      </div>

      {/* ── Table ───────────────────────────────────────────────────────────── */}
      <div className="bg-surface-container-lowest rounded-[32px] shadow-sm border border-outline-variant/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-surface-container-low/50">
                <th className="text-left px-8 py-5 text-[11px] font-black tracking-[0.2em] text-outline uppercase border-b border-outline-variant/15 font-headline">Name</th>
                <th className="text-left px-6 py-5 text-[11px] font-black tracking-[0.2em] text-outline uppercase border-b border-outline-variant/15 font-headline">Level</th>
                <th className="text-left px-6 py-5 text-[11px] font-black tracking-[0.2em] text-outline uppercase border-b border-outline-variant/15 font-headline">Location</th>
                <th className="text-left px-6 py-5 text-[11px] font-black tracking-[0.2em] text-outline uppercase border-b border-outline-variant/15 font-headline">Status</th>
                <th className="text-left px-6 py-5 text-[11px] font-black tracking-[0.2em] text-outline uppercase border-b border-outline-variant/15 font-headline">Participants</th>
                <th className="text-right px-8 py-5 text-[11px] font-black tracking-[0.2em] text-outline uppercase border-b border-outline-variant/15 font-headline">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-16 text-on-surface-variant">
                    <span className="material-symbols-outlined text-[40px] text-outline block mb-3">event_busy</span>
                    <p className="text-sm font-body">
                      {search || levelFilter !== 'all' || statusFilter !== 'all'
                        ? 'No events match your filters.'
                        : 'No events yet. Click "New Event" to get started.'}
                    </p>
                  </td>
                </tr>
              ) : paginated.map(ev => {
                const status = STATUS_STYLE[ev.status] || STATUS_STYLE.upcoming;
                return (
                  <tr key={ev.id} className="hover:bg-surface-container-low/30 transition-colors group">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${LEVEL_AVATAR[ev.level] || 'bg-surface-container text-on-surface-variant'}`}>
                          <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                            {LEVEL_ICON[ev.level] || 'event'}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-on-surface font-headline truncate max-w-[180px]">{ev.name}</p>
                          <p className="text-xs text-outline font-body">{ev.id.slice(0, 12)}…</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase font-headline ${LEVEL_BADGE[ev.level] || ''}`}>
                        {ev.level}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2 text-on-surface-variant font-body text-sm">
                        <span className="material-symbols-outlined text-[16px] opacity-60">location_on</span>
                        {[ev.city, ev.state].filter(Boolean).join(', ') || '—'}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${status.dot} ${ev.status === 'active' ? 'animate-pulse' : ''}`} />
                        <span className={`text-sm font-bold font-body ${status.text}`}>{status.label}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-on-surface-variant font-body text-sm font-medium">
                      {ev.participant_count}
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setViewEvent(ev)} title="View" className="p-2 hover:bg-surface-container-high rounded-lg text-outline hover:text-primary transition-colors">
                          <span className="material-symbols-outlined text-[20px]">visibility</span>
                        </button>
                        <button onClick={() => openEdit(ev)} title="Edit" className="p-2 hover:bg-surface-container-high rounded-lg text-outline hover:text-primary transition-colors">
                          <span className="material-symbols-outlined text-[20px]">edit</span>
                        </button>
                        <button onClick={() => setDeleteTarget(ev)} title="Delete" className="p-2 hover:bg-surface-container-high rounded-lg text-outline hover:text-error transition-colors">
                          <span className="material-symbols-outlined text-[20px]">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="bg-surface-container-low/30 px-8 py-4 flex items-center justify-between border-t border-outline-variant/15 flex-wrap gap-4">
          <p className="text-xs text-outline font-body">
            Showing {start} to {end} of {filtered.length} events
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 bg-surface-container-lowest border border-outline-variant/20 rounded-lg text-outline disabled:opacity-30 hover:bg-surface-container-high transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">chevron_left</span>
              </button>
              {pageNumbers.map((p, i) =>
                p === '…'
                  ? <span key={`e${i}`} className="w-8 h-8 flex items-center justify-center text-on-surface-variant text-xs font-bold">…</span>
                  : <button
                      key={p}
                      onClick={() => setCurrentPage(p as number)}
                      className={`w-8 h-8 flex items-center justify-center rounded-lg font-bold text-xs transition-all font-body ${
                        currentPage === p ? 'bg-primary text-white' : 'hover:bg-surface-container-high text-on-surface-variant'
                      }`}
                    >{p}</button>
              )}
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 bg-surface-container-lowest border border-outline-variant/20 rounded-lg text-outline disabled:opacity-30 hover:bg-surface-container-high transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">chevron_right</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Create Dialog ────────────────────────────────────────────────────── */}
      <Dialog open={showCreate} onOpenChange={open => { if (!open) { setShowCreate(false); resetCreateState(); } }}>
        <DialogContent className="rounded-[2rem] border-none bg-surface-container-lowest shadow-2xl overflow-hidden p-0 max-w-2xl [&>button]:hidden">
          <div className="relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -mr-20 -mt-20 blur-3xl pointer-events-none" />
            <div className="p-10 space-y-8 relative z-10 max-h-[85vh] overflow-y-auto">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black font-headline ${createStep === 1 ? 'bg-primary text-white' : 'bg-primary/10 text-primary'}`}>1</span>
                  <span className="h-px flex-1 max-w-[40px] bg-outline-variant/30" />
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black font-headline ${createStep === 2 ? 'bg-primary text-white' : 'bg-primary/10 text-primary'}`}>2</span>
                </div>
                <h3 className="text-2xl font-extrabold font-headline text-on-surface tracking-tight">Create New Event</h3>
                <p className="text-sm text-outline/70 font-body mt-1">
                  {createStep === 1
                    ? 'Provision a new parliamentary session for the civic ecosystem.'
                    : 'Set the committees and parties students will be assigned to — rename or accept the defaults.'}
                </p>
              </div>
              {createStep === 1
                ? renderFormFields(form, setForm as any)
                : (
                  <CommitteePartyEditor
                    committees={createCommittees}
                    parties={createParties}
                    onCommitteesChange={setCreateCommittees}
                    onPartiesChange={setCreateParties}
                  />
                )}
              <div className="flex flex-wrap items-center gap-4 pt-2">
                {createStep === 1 ? (
                  <button
                    onClick={() => {
                      if (!form.name.trim()) { toast({ title: 'Name required', variant: 'destructive' }); return; }
                      setCreateStep(2);
                    }}
                    className="flex items-center gap-2 px-10 py-4 rounded-full bg-gradient-to-r from-primary to-primary-container text-white font-headline font-bold text-sm shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
                  >
                    Next
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleCreate}
                      disabled={saving}
                      className="flex items-center gap-2 px-10 py-4 rounded-full bg-gradient-to-r from-primary to-primary-container text-white font-headline font-bold text-sm shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 disabled:opacity-50 transition-all"
                    >
                      {saving
                        ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        : <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                      }
                      {saving ? 'Creating…' : 'Create Event'}
                    </button>
                    <button
                      onClick={() => setCreateStep(1)}
                      className="px-8 py-4 text-outline hover:text-on-surface font-bold font-body transition-all"
                    >
                      Back
                    </button>
                  </>
                )}
                <button
                  onClick={() => { setShowCreate(false); resetCreateState(); }}
                  className="px-8 py-4 text-outline hover:text-on-surface font-bold font-body transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── View Dialog ──────────────────────────────────────────────────────── */}
      <Dialog open={!!viewEvent} onOpenChange={open => !open && setViewEvent(null)}>
        <DialogContent className="rounded-[2rem] border-none bg-surface-container-lowest shadow-2xl overflow-hidden p-0 max-w-md [&>button]:hidden">
          <div className="h-1.5 bg-gradient-to-r from-primary to-primary-container" />
          <div className="p-8 space-y-6">
            <div>
              <h2 className="text-xl font-extrabold font-headline text-primary leading-tight">{viewEvent?.name}</h2>
              <div className="flex items-center gap-2 mt-2">
                <span className={`capitalize text-xs font-bold font-headline px-2 py-0.5 rounded-full ${LEVEL_BADGE[viewEvent?.level || ''] || ''}`}>
                  {viewEvent?.level}
                </span>
                <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full font-headline flex items-center gap-1.5 ${STATUS_STYLE[viewEvent?.status || 'upcoming']?.text || ''}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${STATUS_STYLE[viewEvent?.status || 'upcoming']?.dot || ''}`} />
                  {STATUS_STYLE[viewEvent?.status || 'upcoming']?.label}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'City',         value: viewEvent?.city || '—',  icon: 'location_city' },
                { label: 'State',        value: viewEvent?.state || '—', icon: 'map' },
                { label: 'Participants', value: String(viewEvent?.participant_count ?? 0), icon: 'groups' },
                { label: 'Created',      value: viewEvent?.created_at ? new Date(viewEvent.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—', icon: 'calendar_today' },
              ].map(item => (
                <div key={item.label} className="bg-surface-container rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="material-symbols-outlined text-[14px] text-on-surface-variant/60">{item.icon}</span>
                    <p className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant/50 font-headline">{item.label}</p>
                  </div>
                  <p className="font-bold text-sm text-on-surface font-headline">{item.value}</p>
                </div>
              ))}
            </div>
            <div className="bg-surface-container rounded-xl p-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant/50 font-headline mb-1">Event ID</p>
              <p className="text-xs font-mono text-on-surface-variant select-all break-all">{viewEvent?.id}</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setViewEvent(null); openEdit(viewEvent!); }} className="flex-1 h-11 bg-gradient-to-r from-primary to-primary-container text-white rounded-2xl font-bold text-sm font-body shadow-[0_4px_12px_rgba(19,41,143,0.2)] hover:scale-[1.01] transition-all">
                Edit Event
              </button>
              <button onClick={() => setViewEvent(null)} className="flex-1 h-11 bg-surface-container rounded-2xl font-bold text-sm text-on-surface-variant font-body hover:bg-surface-container-high transition-colors">
                Close
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Edit Dialog ──────────────────────────────────────────────────────── */}
      <Dialog open={!!editEvent} onOpenChange={open => !open && setEditEvent(null)}>
        <DialogContent className="rounded-[2rem] border-none bg-surface-container-lowest shadow-2xl overflow-hidden p-0 max-w-2xl [&>button]:hidden">
          <div className="relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-secondary/5 rounded-full -mr-20 -mt-20 blur-3xl pointer-events-none" />
            <div className="p-10 space-y-8 relative z-10 max-h-[85vh] overflow-y-auto">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black font-headline ${editStep === 1 ? 'bg-primary text-white' : 'bg-primary/10 text-primary'}`}>1</span>
                  <span className="h-px flex-1 max-w-[40px] bg-outline-variant/30" />
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black font-headline ${editStep === 2 ? 'bg-primary text-white' : 'bg-primary/10 text-primary'}`}>2</span>
                </div>
                <h3 className="text-2xl font-extrabold font-headline text-on-surface tracking-tight">Edit Event</h3>
                <p className="text-sm text-outline/70 font-body mt-1">
                  {editStep === 1
                    ? editEvent?.name
                    : "Set the committees and parties students will be assigned to — changing the count or names will round-robin reassign this event's students on save."}
                </p>
              </div>

              {editStep === 1 ? (
                <>
                  {renderFormFields(editForm, setEditForm as any, editEvent?.id)}

                  {/* Staff Assignment */}
                  <div className="space-y-5 pt-2 border-t border-outline-variant/15">
                    <p className="text-xs font-black uppercase tracking-widest text-primary font-headline">Assign Staff</p>

                    {loadingStaff ? (
                      <div className="flex items-center gap-2 text-outline text-xs font-body">
                        <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        Loading staff…
                      </div>
                    ) : (
                      <>
                        {/* Organizer */}
                        <div>
                          <label className="block text-xs font-bold text-on-surface-variant mb-2 ml-1 uppercase tracking-wider font-headline">Organizer</label>
                          <div className="relative">
                            <select
                              value={assignOrganizer}
                              onChange={e => setAssignOrganizer(e.target.value)}
                              className={fieldCls}
                            >
                              <option value="">— None —</option>
                              {staffUsers.filter(u => u.user_type === 'organizer').map(u => (
                                <option key={u.user_id} value={u.user_id}>
                                  {u.name} {u.event_id && u.event_id !== editEvent?.id ? '(assigned elsewhere)' : ''}
                                </option>
                              ))}
                            </select>
                            <span className="material-symbols-outlined absolute right-5 top-1/2 -translate-y-1/2 text-outline pointer-events-none text-[20px]">expand_more</span>
                          </div>
                        </div>

                        {/* Jury */}
                        <div>
                          <label className="block text-xs font-bold text-on-surface-variant mb-2 ml-1 uppercase tracking-wider font-headline">Jury Members</label>
                          <div className="space-y-2">
                            {staffUsers.filter(u => u.user_type === 'jury').length === 0 ? (
                              <p className="text-xs text-outline font-body">No jury accounts found.</p>
                            ) : staffUsers.filter(u => u.user_type === 'jury').map(u => (
                              <label key={u.user_id} className="flex items-center gap-3 px-4 py-3 bg-surface-container rounded-xl cursor-pointer hover:bg-surface-container-high transition-colors">
                                <input
                                  type="checkbox"
                                  checked={assignJury.has(u.user_id)}
                                  onChange={e => {
                                    setAssignJury(prev => {
                                      const next = new Set(prev);
                                      e.target.checked ? next.add(u.user_id) : next.delete(u.user_id);
                                      return next;
                                    });
                                  }}
                                  className="h-4 w-4 rounded text-primary focus:ring-primary/20"
                                />
                                <div className="min-w-0">
                                  <p className="text-sm font-bold font-headline text-on-surface">{u.name}</p>
                                  <p className="text-xs text-outline font-body truncate">{u.email}</p>
                                </div>
                                {u.event_id && u.event_id !== editEvent?.id && (
                                  <span className="ml-auto text-[9px] font-black uppercase tracking-wider text-outline font-headline shrink-0">elsewhere</span>
                                )}
                              </label>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </>
              ) : (
                <CommitteePartyEditor
                  committees={editCommittees}
                  parties={editParties}
                  onCommitteesChange={setEditCommittees}
                  onPartiesChange={setEditParties}
                />
              )}

              <div className="flex flex-wrap items-center gap-4 pt-2">
                {editStep === 1 ? (
                  <button
                    onClick={() => {
                      if (!editForm.name.trim()) { toast({ title: 'Name required', variant: 'destructive' }); return; }
                      setEditStep(2);
                    }}
                    className="flex items-center gap-2 px-10 py-4 rounded-full bg-gradient-to-r from-primary to-primary-container text-white font-headline font-bold text-sm shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
                  >
                    Next
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleEditSave}
                      disabled={editSaving || !editForm.name.trim()}
                      className="flex items-center gap-2 px-10 py-4 rounded-full bg-gradient-to-r from-primary to-primary-container text-white font-headline font-bold text-sm shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 disabled:opacity-50 transition-all"
                    >
                      {editSaving
                        ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        : <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                      }
                      {editSaving ? 'Saving…' : 'Save Changes'}
                    </button>
                    <button
                      onClick={() => setEditStep(1)}
                      className="px-8 py-4 text-outline hover:text-on-surface font-bold font-body transition-all"
                    >
                      Back
                    </button>
                  </>
                )}
                <button onClick={() => setEditEvent(null)} className="px-8 py-4 text-outline hover:text-on-surface font-bold font-body transition-all">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ───────────────────────────────────────────────── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-[2rem] border-none bg-surface-container-lowest shadow-2xl overflow-hidden p-0 max-w-sm">
          <div className="h-1.5 bg-error" />
          <div className="p-8 space-y-4">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-xl font-extrabold font-headline text-error">Delete Event?</AlertDialogTitle>
              <AlertDialogDescription className="text-sm text-on-surface-variant font-body">
                <span className="font-bold text-on-surface">"{deleteTarget?.name}"</span> will be permanently deleted.
                This cannot be undone and may affect participants assigned to this event.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex gap-3 pt-2">
              <AlertDialogCancel onClick={() => setDeleteTarget(null)} className="flex-1 h-11 bg-surface-container border-none rounded-2xl font-bold text-sm text-on-surface-variant font-body">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} disabled={deleting} className="flex-1 h-11 bg-error text-white border-none rounded-2xl font-bold text-sm font-body disabled:opacity-50 transition-all">
                {deleting ? 'Deleting…' : 'Delete Event'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </div>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
};
