import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface EventOption {
  id: string;
  name: string;
  level: string;
}

interface OrganizerRow {
  user_id: string;
  name: string;
  email: string | null;
  city: string | null;
  state: string | null;
  event_id: string | null;
  event_name?: string;
  created_at: string;
}

const blankForm = { name: '', email: '', password: '', event_id: '' };

const inputCls = 'w-full bg-surface-container rounded-xl px-4 py-2.5 text-sm font-body border-0 outline-none focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all';

export const OrganizerManager = () => {
  const [organizers, setOrganizers] = useState<OrganizerRow[]>([]);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(blankForm);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    const [{ data: orgs }, { data: evts }] = await Promise.all([
      supabase
        .from('profiles')
        .select('user_id, name, city, state, event_id, created_at')
        .eq('user_type', 'organizer')
        .order('created_at', { ascending: false }),
      supabase.rpc('list_events_for_super_admin'),
    ]);

    const eventMap = new Map<string, string>(
      ((evts || []) as EventOption[]).map((e: EventOption) => [e.id, e.name])
    );

    setOrganizers(
      (orgs || []).map(o => ({
        ...o,
        email: null,
        event_name: o.event_id ? eventMap.get(o.event_id) : undefined,
      }))
    );
    setEvents((evts || []) as EventOption[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
      toast({ title: 'Name, email, and password are required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const { data: signupData, error: signupError } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: { data: { full_name: form.name.trim() }, emailRedirectTo: undefined },
      });

      if (signupError) throw signupError;
      if (!signupData.user) throw new Error('User creation failed');

      const profilePayload: Record<string, unknown> = {
        user_id: signupData.user.id,
        name: form.name.trim(),
        user_type: 'organizer',
        position: 'Organizer',
        serial_number: 0,
        party_number: 0,
      };
      if (form.event_id) profilePayload.event_id = form.event_id;

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert(profilePayload, { onConflict: 'user_id' });

      if (profileError) throw profileError;

      if (form.event_id) {
        await supabase.from('event_participants').insert({
          event_id: form.event_id,
          user_id: signupData.user.id,
          is_current: true,
        });
      }

      toast({ title: 'Organizer created', description: `Account created for ${form.name.trim()}` });
      setForm(blankForm);
      setShowForm(false);
      fetchData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
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
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-4xl font-extrabold font-headline tracking-tight text-primary">
            Organizer <span className="text-secondary">Accounts</span>
          </h1>
          <p className="text-[10px] text-on-surface-variant/40 font-black uppercase tracking-[0.4em] mt-3 flex items-center gap-2 font-headline">
            <span className="material-symbols-outlined text-[12px]">manage_accounts</span>
            Create and assign event organizers
          </p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-primary to-primary-container text-white font-headline font-bold text-sm shadow-lg shadow-primary/10 hover:scale-[1.02] active:scale-[0.99] transition-all"
        >
          <span className="material-symbols-outlined text-[18px]">person_add</span>
          New Organizer
        </button>
      </header>

      {showForm && (
        <div className="bg-surface-container-lowest rounded-2xl shadow-[0_2px_12px_0_rgba(19,41,143,0.06)] border border-outline-variant/10 p-6 space-y-5">
          <h2 className="font-headline font-bold text-on-surface text-base">Create Organizer Account</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-on-surface-variant mb-1.5 font-headline uppercase tracking-wider">Full Name *</label>
              <input
                className={inputCls}
                placeholder="Organizer name"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-on-surface-variant mb-1.5 font-headline uppercase tracking-wider">Email *</label>
              <input
                type="email"
                className={inputCls}
                placeholder="organizer@example.com"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-on-surface-variant mb-1.5 font-headline uppercase tracking-wider">Temporary Password *</label>
              <input
                type="password"
                className={inputCls}
                placeholder="Minimum 6 characters"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-on-surface-variant mb-1.5 font-headline uppercase tracking-wider">Assign to Event</label>
              <select
                className={inputCls}
                value={form.event_id}
                onChange={e => setForm(f => ({ ...f, event_id: e.target.value }))}
              >
                <option value="">No event (assign later)</option>
                {events.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
          </div>

          <div className="bg-secondary/5 rounded-xl p-3 text-xs text-on-surface-variant font-body">
            <span className="font-bold text-on-surface">Note:</span> Share the email and temporary password with the organizer. They should change their password on first login.
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleCreate}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-gradient-to-r from-primary to-primary-container text-white font-headline font-bold text-sm shadow-lg shadow-primary/10 hover:scale-[1.02] active:scale-[0.99] disabled:opacity-50 transition-all"
            >
              {saving ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <span className="material-symbols-outlined text-[16px]">check</span>
              )}
              Create Account
            </button>
            <button
              onClick={() => { setShowForm(false); setForm(blankForm); }}
              className="px-6 py-2.5 rounded-full border border-outline-variant/10 bg-surface-container text-on-surface-variant font-body text-sm hover:bg-surface-container-high transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="bg-surface-container-lowest rounded-2xl shadow-[0_2px_12px_0_rgba(19,41,143,0.06)] border border-outline-variant/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-body">
            <thead>
              <tr className="border-b border-outline-variant/10 bg-surface-container/50">
                {['Name','Location','Assigned Event','Joined'].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60 font-headline whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {organizers.map(org => (
                <tr key={org.user_id} className="border-b border-outline-variant/10 hover:bg-surface-container/30 transition-colors">
                  <td className="px-5 py-3.5 font-bold text-on-surface font-headline">{org.name}</td>
                  <td className="px-5 py-3.5 text-on-surface-variant text-xs">
                    {[org.city, org.state].filter(Boolean).join(', ') || '—'}
                  </td>
                  <td className="px-5 py-3.5">
                    {org.event_name ? (
                      <span className="text-xs font-bold font-headline px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                        {org.event_name}
                      </span>
                    ) : (
                      <span className="text-xs text-on-surface-variant/50">Unassigned</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-on-surface-variant text-xs">
                    {new Date(org.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {organizers.length === 0 && (
            <div className="text-center py-16 text-on-surface-variant">
              <span className="material-symbols-outlined text-[40px] text-outline">manage_accounts</span>
              <p className="mt-3 text-sm font-body">No organizers yet. Click "New Organizer" to create one.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
