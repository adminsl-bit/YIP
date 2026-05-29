import { useState, useEffect, useMemo } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────────────────────
type RoleType     = 'jury' | 'admin' | 'journalist' | 'organizer';
type DisplayRole  = 'jury' | 'admin' | 'journalist' | 'student' | 'organizer';
type RoleFilter   = 'all' | DisplayRole;

interface EventOption { id: string; name: string; level: string; status: string; }

interface RoleConfig {
  type: RoleType;
  label: string;
  defaultPassword: string;
  userType: 'jury' | 'student' | 'organizer';
  appRole?: 'admin_student' | 'journalist';
  position: string;
  serialStart: number;
  emailDomain: string;
}

interface UserRow {
  user_id: string;
  name: string;
  email: string;
  serial_number: number;
  user_type: string;
  position?: string | null;
  created_at?: string;
  is_active?: boolean;
  event_id?: string | null;
  displayRole: DisplayRole;
}

// ── Config ─────────────────────────────────────────────────────────────────
const roleConfigs: Record<RoleType, RoleConfig> = {
  jury:       { type: 'jury',       label: 'Jury',          defaultPassword: 'jury2025',       userType: 'jury',      position: 'Senior Evaluator', serialStart: 1001, emailDomain: '@yip.com' },
  admin:      { type: 'admin',      label: 'Admin Student', defaultPassword: 'admin2025',      userType: 'student',   appRole: 'admin_student', position: 'Admin Student',   serialStart: 9001, emailDomain: '@yip.com' },
  journalist: { type: 'journalist', label: 'Journalist',    defaultPassword: 'journalist2025', userType: 'student',   appRole: 'journalist',    position: 'Journalist',       serialStart: 8001, emailDomain: '@yip.com' },
  organizer:  { type: 'organizer',  label: 'Organizer',     defaultPassword: 'organizer2025',  userType: 'organizer', position: 'Event Organizer',  serialStart: 5001, emailDomain: '@yip.com' },
};

const roleIcons: Record<RoleType, string> = {
  jury: 'gavel', admin: 'admin_panel_settings', journalist: 'newspaper', organizer: 'manage_accounts',
};

const roleMeta: Record<DisplayRole, { label: string; icon: string; badgeCls: string; avatarCls: string; filterIcon: string }> = {
  jury:       { label: 'Jury Member',     icon: 'gavel',                badgeCls: 'bg-primary-fixed text-on-primary-fixed',                                       avatarCls: 'bg-primary/10 text-primary',               filterIcon: 'gavel' },
  journalist: { label: 'Journalist',      icon: 'article',              badgeCls: 'bg-secondary-fixed text-on-secondary-fixed',                                   avatarCls: 'bg-secondary/10 text-secondary',           filterIcon: 'article' },
  admin:      { label: 'Admin Student',   icon: 'admin_panel_settings', badgeCls: 'bg-surface-container-high text-on-surface border border-outline-variant/10',   avatarCls: 'bg-surface-container-high text-on-surface', filterIcon: 'admin_panel_settings' },
  organizer:  { label: 'Organizer',       icon: 'groups',               badgeCls: 'bg-primary-container text-on-primary-container',                               avatarCls: 'bg-primary-container/60 text-primary',     filterIcon: 'manage_accounts' },
  student:    { label: 'Regular Student', icon: 'school',               badgeCls: 'bg-surface-container text-on-surface-variant border border-outline-variant/10', avatarCls: 'bg-surface-container-highest text-on-surface-variant', filterIcon: 'school' },
};

const initials = (name: string) => name.trim().split(/\s+/).map(n => n[0]).join('').slice(0, 2).toUpperCase();
const fmtDate  = (d?: string)   => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : '—';

const ITEMS_PER_PAGE = 10;

// ── Component ──────────────────────────────────────────────────────────────
export const SuperAdminRoleCreator = () => {
  const [events, setEvents]               = useState<EventOption[]>([]);
  const [selectedEvent, setSelectedEvent] = useState('');

  // Create form
  const [selectedRole, setSelectedRole]   = useState<RoleType>('organizer');
  const [count, setCount]                 = useState(1);
  const [password, setPassword]           = useState('');
  const [isCreating, setIsCreating]       = useState(false);
  const [isCreateOpen, setIsCreateOpen]   = useState(false);

  // Users table
  const [allUsers, setAllUsers]   = useState<UserRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Delete
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Edit
  const [editingUser, setEditingUser]     = useState<UserRow | null>(null);
  const [editName, setEditName]           = useState('');
  const [editPosition, setEditPosition]   = useState('');
  const [isSaving, setIsSaving]           = useState(false);

  // Password reset
  const [resetTarget, setResetTarget]   = useState<UserRow | null>(null);
  const [newPassword, setNewPassword]   = useState('');
  const [isResetting, setIsResetting]   = useState(false);

  // Filters
  const [roleFilter, setRoleFilter]   = useState<RoleFilter>('organizer');
  const [currentPage, setCurrentPage] = useState(1);

  const config = roleConfigs[selectedRole];

  // ── Fetch events ───────────────────────────────────────────────────────
  useEffect(() => {
    supabase.rpc('list_events_for_super_admin').then(({ data }) => {
      if (data) setEvents(data as EventOption[]);
    });
  }, []);

  // ── Fetch users ────────────────────────────────────────────────────────
  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      let juryQ       = supabase.from('profiles').select('user_id, name, email, serial_number, user_type, position, created_at, is_active, event_id').eq('user_type', 'jury').order('serial_number');
      let orgQ        = supabase.from('profiles').select('user_id, name, email, serial_number, user_type, position, created_at, is_active, event_id').eq('user_type', 'organizer').order('serial_number');
      let studentQ    = supabase.from('profiles').select('user_id, name, email, serial_number, user_type, position, created_at, is_active, event_id').eq('user_type', 'student').order('serial_number');

      if (selectedEvent) {
        juryQ    = juryQ.eq('event_id', selectedEvent);
        orgQ     = orgQ.eq('event_id', selectedEvent);
        studentQ = studentQ.eq('event_id', selectedEvent);
      }

      const [{ data: juryData }, { data: orgData }, { data: rolesData }, { data: studentData }] = await Promise.all([
        juryQ, orgQ,
        supabase.from('user_roles').select('user_id, role'),
        studentQ,
      ]);

      const flat: UserRow[] = [];
      (juryData || []).forEach(u => flat.push({ ...u, displayRole: 'jury' }));
      (orgData  || []).forEach(u => flat.push({ ...u, displayRole: 'organizer' }));
      (studentData || []).forEach(u => {
        const r  = rolesData?.find(x => x.user_id === u.user_id);
        const dr: DisplayRole = r?.role === 'admin_student' ? 'admin' : r?.role === 'journalist' ? 'journalist' : 'student';
        flat.push({ ...u, displayRole: dr });
      });

      flat.sort((a, b) => a.name.localeCompare(b.name));
      setAllUsers(flat);
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, [selectedEvent]);

  // ── Create ──────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (count < 1 || count > 50) { toast.error('Enter a number between 1 and 50'); return; }
    if (!selectedEvent) { toast.error('Select an event first'); return; }
    const finalPwd = password.trim() || config.defaultPassword;
    setIsCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-role-users', {
        body: { roleType: selectedRole, count, password: finalPwd },
      });
      if (error) throw new Error(error.message || JSON.stringify(error));
      if (data?.error) throw new Error(data.error);

      // Assign created users to the selected event
      const created: { userId: string }[] = (data?.results || []).filter((r: any) => r.success);
      if (created.length > 0) {
        const userIds = created.map((r: any) => r.userId).filter(Boolean);
        if (userIds.length > 0) {
          // Update profiles
          await supabase.from('profiles').update({ event_id: selectedEvent }).in('user_id', userIds);
          // Upsert event_participants
          await supabase.from('event_participants').upsert(
            userIds.map((uid: string) => ({ event_id: selectedEvent, user_id: uid, is_current: true })),
            { onConflict: 'event_id,user_id' }
          );
        }
      }

      const ok   = (data?.results || []).filter((r: any) => r.success).length;
      const fail = (data?.results || []).filter((r: any) => !r.success).length;
      toast.success('Users Created', {
        description: `Created ${ok} ${config.label} users for this event.${fail > 0 ? ` Failed: ${fail}` : ''}`,
      });
      setIsCreateOpen(false);
      setPassword('');
      setCount(1);
      fetchUsers();
    } catch (err: any) {
      toast.error('Error', { description: err.message || `Failed to create ${config.label} users.` });
    } finally {
      setIsCreating(false);
    }
  };

  // ── Delete ──────────────────────────────────────────────────────────────
  const handleDelete = async (userId: string, userName: string) => {
    setDeletingId(userId);
    try {
      const { data, error } = await supabase.functions.invoke('delete-user', { body: { userId } });
      if (error || !data?.success) throw new Error(data?.error || error?.message || 'Delete failed');
      toast.success('User Deleted', { description: `${userName} has been deleted.` });
      fetchUsers();
    } catch (err: any) {
      toast.error('Error', { description: err.message || 'Failed to delete user.' });
    } finally {
      setDeletingId(null);
    }
  };

  // ── Edit ────────────────────────────────────────────────────────────────
  const openEdit = (user: UserRow) => { setEditingUser(user); setEditName(user.name); setEditPosition(user.position || ''); };

  const handleEditSave = async () => {
    if (!editingUser) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.from('profiles').update({ name: editName.trim(), position: editPosition.trim() }).eq('user_id', editingUser.user_id);
      if (error) throw error;
      toast.success('Updated', { description: `${editName.trim()} has been updated.` });
      setEditingUser(null);
      fetchUsers();
    } catch (err) {
      toast.error('Error', { description: 'Failed to update user.' });
    } finally {
      setIsSaving(false);
    }
  };

  // ── Password Reset ──────────────────────────────────────────────────────
  const openReset = (user: UserRow) => { setResetTarget(user); setNewPassword(''); };

  const handlePasswordReset = async () => {
    if (!resetTarget || !newPassword.trim()) { toast.error('Enter a new password'); return; }
    setIsResetting(true);
    try {
      const { data, error } = await supabase.functions.invoke('reset-student-password', {
        body: { userId: resetTarget.user_id, newPassword: newPassword.trim() },
      });
      if (error || !data?.success) throw new Error(data?.error || error?.message || 'Reset failed');
      toast.success('Password Reset', { description: `Password updated for ${resetTarget.name}.` });
      setResetTarget(null);
    } catch (err: any) {
      toast.error('Error', { description: err.message || 'Failed to reset password.' });
    } finally {
      setIsResetting(false);
    }
  };

  // ── Stats ───────────────────────────────────────────────────────────────
  const orgCount     = useMemo(() => allUsers.filter(u => u.displayRole === 'organizer').length,  [allUsers]);
  const juryCount    = useMemo(() => allUsers.filter(u => u.displayRole === 'jury').length,        [allUsers]);
  const pressCount   = useMemo(() => allUsers.filter(u => u.displayRole === 'journalist').length,  [allUsers]);
  const adminCount   = useMemo(() => allUsers.filter(u => u.displayRole === 'admin').length,       [allUsers]);

  // ── Filter + paginate ────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (roleFilter === 'all') return allUsers;
    return allUsers.filter(u => u.displayRole === roleFilter);
  }, [allUsers, roleFilter]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated  = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const applyFilter = (f: RoleFilter) => { setRoleFilter(f); setCurrentPage(1); };
  const start = filtered.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const end   = Math.min(currentPage * ITEMS_PER_PAGE, filtered.length);

  const pageNumbers = useMemo(() => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (currentPage <= 3) return [1, 2, 3, '…', totalPages];
    if (currentPage >= totalPages - 2) return [1, '…', totalPages - 2, totalPages - 1, totalPages];
    return [1, '…', currentPage - 1, currentPage, currentPage + 1, '…', totalPages];
  }, [currentPage, totalPages]);

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8 animate-in fade-in duration-700">

      {/* Page heading */}
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-4xl font-extrabold font-headline tracking-tight text-primary">
            Organizers <span className="text-secondary">&amp; Roles</span>
          </h1>
          <p className="text-[10px] text-on-surface-variant/40 font-black uppercase tracking-[0.4em] mt-3 flex items-center gap-2 font-headline">
            <span className="material-symbols-outlined text-[12px]">manage_accounts</span>
            Assign organizers per event · Create supporting roles as needed
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchUsers} disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2.5 bg-surface-container-lowest border border-outline-variant/10 rounded-full text-on-surface-variant hover:bg-surface-container-high transition-all font-semibold text-sm font-body disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-[18px] ${isLoading ? 'animate-spin' : ''}`}>refresh</span>
            Refresh
          </button>
          <button
            onClick={() => { if (!selectedEvent) { toast.error('Select an event first'); return; } setIsCreateOpen(true); }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-primary to-primary-container text-white font-headline font-bold text-sm shadow-lg shadow-primary/10 hover:scale-[1.02] active:scale-[0.99] transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">person_add</span>
            Add Organizer
          </button>
        </div>
      </header>

      {/* Event picker */}
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 shadow-[0_2px_12px_0_rgba(19,41,143,0.06)] p-6">
        <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/60 font-headline mb-3">
          Select Event to Manage
        </label>
        <div className="relative">
          <select
            value={selectedEvent}
            onChange={e => { setSelectedEvent(e.target.value); setRoleFilter('organizer'); setCurrentPage(1); }}
            className="w-full bg-surface-container-high rounded-xl px-4 py-3 text-sm font-body border-0 outline-none focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all font-medium text-on-surface appearance-none pr-10"
          >
            <option value="">Show all events</option>
            {events.map(e => (
              <option key={e.id} value={e.id}>{e.name} ({e.level})</option>
            ))}
          </select>
          <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none text-[20px]">
            expand_more
          </span>
        </div>
        {selectedEvent && (
          <p className="text-xs text-on-surface-variant/50 font-body mt-3 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[13px]">info</span>
            New roles created will be automatically assigned to this event.
          </p>
        )}
      </div>

      {/* Stat cards — organizer is primary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Primary: Organizers */}
        <div
          onClick={() => applyFilter('organizer')}
          className={`rounded-2xl p-6 relative overflow-hidden group cursor-pointer transition-all col-span-2 md:col-span-1 ${
            roleFilter === 'organizer'
              ? 'bg-gradient-to-br from-primary to-primary-container shadow-[0_8px_24px_rgba(19,41,143,0.25)]'
              : 'bg-surface-container-lowest shadow-[0_2px_12px_0_rgba(19,41,143,0.06)] border border-outline-variant/10 hover:shadow-[0_4px_16px_rgba(19,41,143,0.12)]'
          }`}
        >
          <div className="relative z-10">
            <p className={`font-bold text-xs uppercase tracking-widest mb-1 font-body ${roleFilter === 'organizer' ? 'text-white/70' : 'text-on-surface-variant'}`}>Organizers</p>
            <h4 className={`text-3xl font-headline font-extrabold ${roleFilter === 'organizer' ? 'text-white' : 'text-primary'}`}>{String(orgCount).padStart(2, '0')}</h4>
            <p className={`text-[10px] font-headline font-black uppercase tracking-widest mt-1 ${roleFilter === 'organizer' ? 'text-white/50' : 'text-primary/40'}`}>Primary</p>
          </div>
          <span className={`material-symbols-outlined absolute -bottom-2 -right-2 opacity-10 text-7xl group-hover:scale-110 transition-transform select-none ${roleFilter === 'organizer' ? 'text-white' : 'text-primary'}`} style={{ fontVariationSettings: "'FILL' 1" }}>manage_accounts</span>
        </div>

        {/* Secondary roles */}
        {[
          { filter: 'jury'       as RoleFilter, label: 'Jury',          value: juryCount,  color: 'text-violet-600', icon: 'gavel' },
          { filter: 'journalist' as RoleFilter, label: 'Journalists',   value: pressCount, color: 'text-secondary',  icon: 'article' },
          { filter: 'admin'      as RoleFilter, label: 'Admin Students', value: adminCount, color: 'text-error',      icon: 'admin_panel_settings' },
        ].map(card => (
          <div
            key={card.label}
            onClick={() => applyFilter(card.filter)}
            className={`rounded-2xl p-6 relative overflow-hidden group cursor-pointer transition-all ${
              roleFilter === card.filter
                ? 'bg-surface-container-high shadow-[0_2px_12px_0_rgba(19,41,143,0.08)] border border-outline-variant/10'
                : 'bg-surface-container-lowest shadow-[0_2px_12px_0_rgba(19,41,143,0.06)] border border-outline-variant/10 hover:shadow-[0_4px_16px_rgba(19,41,143,0.10)]'
            }`}
          >
            <div className="relative z-10">
              <p className="text-on-surface-variant font-bold text-xs uppercase tracking-widest mb-1 font-body">{card.label}</p>
              <h4 className={`text-3xl font-headline font-extrabold ${card.color}`}>{String(card.value).padStart(2, '0')}</h4>
            </div>
            <span className={`material-symbols-outlined absolute -bottom-2 -right-2 ${card.color} opacity-10 text-7xl group-hover:scale-110 transition-transform select-none`} style={{ fontVariationSettings: "'FILL' 1" }}>{card.icon}</span>
          </div>
        ))}
      </div>

      {/* Users table */}
      <div className="bg-surface-container-lowest rounded-[2rem] shadow-[0_32px_64px_-16px_rgba(19,41,143,0.1)] overflow-hidden">

        {/* Table header bar */}
        <div className="px-6 py-5 border-b border-outline-variant/10 bg-surface-container-low/30 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-headline ${roleMeta[roleFilter === 'all' ? 'organizer' : roleFilter as DisplayRole]?.badgeCls || ''}`}>
              <span className="material-symbols-outlined text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                {roleMeta[roleFilter === 'all' ? 'organizer' : roleFilter as DisplayRole]?.filterIcon || 'group'}
              </span>
              {roleFilter === 'all' ? 'All Roles' : roleMeta[roleFilter as DisplayRole]?.label}
            </span>
            <button onClick={() => applyFilter('all')} className={`text-xs font-bold font-body transition-colors ${roleFilter === 'all' ? 'text-primary' : 'text-on-surface-variant/50 hover:text-on-surface-variant'}`}>
              {roleFilter !== 'all' && '· Show all'}
            </button>
          </div>
          <p className="text-sm font-semibold text-on-surface-variant font-body shrink-0">{start}–{end} of {filtered.length}</p>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low/30">
                <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant font-body">User Information</th>
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant font-body">Role</th>
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant font-body">Event</th>
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant font-body">Created</th>
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant font-body">Status</th>
                <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant text-right font-body">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/5">
              {isLoading ? (
                <tr><td colSpan={6} className="px-8 py-16 text-center text-on-surface-variant/50 font-body">
                  <span className="material-symbols-outlined text-[32px] animate-spin block mb-3 mx-auto">refresh</span>
                  Loading users…
                </td></tr>
              ) : paginated.length === 0 ? (
                <tr><td colSpan={6} className="px-8 py-16 text-center">
                  <span className="material-symbols-outlined text-[48px] text-on-surface-variant/20 block mb-3 mx-auto" style={{ fontVariationSettings: "'FILL' 1" }}>group</span>
                  <p className="text-sm text-on-surface-variant/50 font-body">
                    {selectedEvent ? 'No users assigned to this event yet.' : 'No users found.'}
                  </p>
                </td></tr>
              ) : paginated.map(user => {
                const meta   = roleMeta[user.displayRole];
                const active = user.is_active !== false;
                const eventName = events.find(e => e.id === user.event_id)?.name;
                return (
                  <tr key={user.user_id} className="hover:bg-primary-container/[0.02] transition-colors group">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <div className="relative shrink-0">
                          <div className={`w-11 h-11 rounded-full ${meta.avatarCls} flex items-center justify-center font-headline font-bold text-sm border-2 border-primary/10`}>
                            {initials(user.name)}
                          </div>
                          {active && <span className="absolute bottom-0 right-0 w-3 h-3 bg-tertiary-fixed-dim rounded-full border-2 border-white block" />}
                        </div>
                        <div className="min-w-0">
                          <p className="font-headline font-bold text-on-surface truncate">{user.name}</p>
                          <p className="text-xs text-on-surface-variant font-medium font-body truncate">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 ${meta.badgeCls} text-[11px] font-bold rounded-full whitespace-nowrap`}>
                        <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>{meta.icon}</span>
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      {eventName ? (
                        <span className="text-xs font-bold font-headline px-2 py-0.5 rounded-full bg-primary/10 text-primary whitespace-nowrap">{eventName}</span>
                      ) : (
                        <span className="text-xs text-on-surface-variant/40 font-body">Unassigned</span>
                      )}
                    </td>
                    <td className="px-6 py-5 text-sm font-medium text-on-surface-variant font-body whitespace-nowrap">{fmtDate(user.created_at)}</td>
                    <td className="px-6 py-5">
                      {active
                        ? <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-tertiary/10 text-tertiary-fixed-dim text-[11px] font-bold rounded-full uppercase tracking-wider font-body">Active</span>
                        : <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-surface-container-highest text-on-surface-variant text-[11px] font-bold rounded-full uppercase tracking-wider font-body">Inactive</span>
                      }
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(user)} className="p-2 text-on-surface-variant hover:text-primary transition-colors rounded-lg hover:bg-surface-container">
                          <span className="material-symbols-outlined text-[20px]">edit</span>
                        </button>
                        <button onClick={() => openReset(user)} className="p-2 text-on-surface-variant hover:text-secondary transition-colors rounded-lg hover:bg-surface-container">
                          <span className="material-symbols-outlined text-[20px]">lock_reset</span>
                        </button>
                        <AlertDialog>
                          <button
                            disabled={deletingId === user.user_id}
                            onClick={() => handleDelete(user.user_id, user.name)}
                            className="p-2 text-on-surface-variant hover:text-error transition-colors rounded-lg hover:bg-surface-container disabled:opacity-40"
                          >
                            {deletingId === user.user_id
                              ? <span className="w-5 h-5 border-2 border-error border-t-transparent rounded-full animate-spin block" />
                              : <span className="material-symbols-outlined text-[20px]">delete</span>
                            }
                          </button>
                        </AlertDialog>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-8 py-5 bg-surface-container-low/20 flex justify-between items-center border-t border-outline-variant/10 flex-wrap gap-4">
            <p className="text-xs text-on-surface-variant font-medium font-body">
              Showing <span className="text-on-surface font-bold">{start}–{end}</span> of <span className="text-on-surface font-bold">{filtered.length}</span>
            </p>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-surface-container border border-outline-variant/10 text-on-surface-variant hover:bg-surface-container-high transition-colors disabled:opacity-30">
                <span className="material-symbols-outlined text-[18px]">chevron_left</span>
              </button>
              {pageNumbers.map((p, i) =>
                p === '…'
                  ? <span key={`e${i}`} className="w-9 h-9 flex items-center justify-center text-on-surface-variant text-sm font-bold font-body">…</span>
                  : <button key={p} onClick={() => setCurrentPage(p as number)}
                      className={`w-9 h-9 flex items-center justify-center rounded-xl font-bold text-xs transition-all font-body ${currentPage === p ? 'bg-gradient-to-r from-primary to-primary-container text-white shadow-[0_4px_12px_rgba(19,41,143,0.25)]' : 'bg-surface-container border border-outline-variant/10 text-on-surface-variant hover:bg-surface-container-high'}`}>
                      {p}
                    </button>
              )}
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-surface-container border border-outline-variant/10 text-on-surface-variant hover:bg-surface-container-high transition-colors disabled:opacity-30">
                <span className="material-symbols-outlined text-[18px]">chevron_right</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Edit Dialog ──────────────────────────────────────────────────── */}
      <Dialog open={!!editingUser} onOpenChange={open => !open && setEditingUser(null)}>
        <DialogContent className="rounded-[2rem] border-none bg-surface-container-lowest shadow-[0_32px_64px_-16px_rgba(19,41,143,0.12)] overflow-hidden p-0 max-w-md [&>button]:hidden">
          <div className="h-1.5 bg-gradient-to-r from-primary to-primary-container" />
          <div className="p-8 space-y-5">
            <div>
              <h2 className="text-xl font-extrabold font-headline text-primary">Edit User</h2>
              <p className="text-xs text-on-surface-variant/60 font-body mt-1">Update name and position for {editingUser?.name}</p>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-on-surface-variant/50 font-headline mb-2">Name</p>
                <input value={editName} onChange={e => setEditName(e.target.value)}
                  className="w-full h-12 bg-surface-container-high border-none rounded-2xl font-bold px-5 text-sm text-on-surface focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest font-body outline-none" />
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-on-surface-variant/50 font-headline mb-2">Position</p>
                <input value={editPosition} onChange={e => setEditPosition(e.target.value)} placeholder="e.g. Senior Evaluator"
                  className="w-full h-12 bg-surface-container-high border-none rounded-2xl font-bold px-5 text-sm text-on-surface focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest font-body outline-none" />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setEditingUser(null)} className="flex-1 h-12 bg-surface-container rounded-2xl font-bold text-sm text-on-surface-variant font-body hover:bg-surface-container-high transition-colors">Cancel</button>
              <button onClick={handleEditSave} disabled={isSaving || !editName.trim()}
                className="flex-1 h-12 bg-gradient-to-r from-primary to-primary-container text-white rounded-2xl font-bold text-sm font-body shadow-[0_4px_12px_rgba(19,41,143,0.25)] disabled:opacity-50 transition-all">
                {isSaving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Password Reset Dialog ────────────────────────────────────────── */}
      <Dialog open={!!resetTarget} onOpenChange={open => !open && setResetTarget(null)}>
        <DialogContent className="rounded-[2rem] border-none bg-surface-container-lowest shadow-[0_32px_64px_-16px_rgba(19,41,143,0.12)] overflow-hidden p-0 max-w-md [&>button]:hidden">
          <div className="h-1.5 bg-gradient-to-r from-secondary to-secondary-fixed-dim" />
          <div className="p-8 space-y-5">
            <div>
              <h2 className="text-xl font-extrabold font-headline text-secondary">Reset Password</h2>
              <p className="text-xs text-on-surface-variant/60 font-body mt-1">Set a new password for {resetTarget?.name}</p>
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-on-surface-variant/50 font-headline mb-2">New Password</p>
              <input type="text" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Enter new password"
                className="w-full h-12 bg-surface-container-high border-none rounded-2xl font-bold px-5 text-sm text-on-surface focus:ring-2 focus:ring-secondary/20 focus:bg-surface-container-lowest font-body outline-none" />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setResetTarget(null)} className="flex-1 h-12 bg-surface-container rounded-2xl font-bold text-sm text-on-surface-variant font-body hover:bg-surface-container-high transition-colors">Cancel</button>
              <button onClick={handlePasswordReset} disabled={isResetting || !newPassword.trim()}
                className="flex-1 h-12 bg-gradient-to-r from-secondary to-secondary-container text-white rounded-2xl font-bold text-sm font-body shadow-[0_4px_12px_rgba(172,53,9,0.2)] disabled:opacity-50 transition-all hover:scale-[1.01] active:scale-[0.99]">
                {isResetting ? 'Resetting…' : 'Reset Password'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Create Dialog ────────────────────────────────────────────────── */}
      <AlertDialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <AlertDialogContent className="rounded-[2rem] border-none bg-surface-container-lowest shadow-[0_32px_64px_-16px_rgba(19,41,143,0.12)] overflow-hidden p-0 max-w-xl">
          {/* Top accent bar */}
          <div className="h-1.5 bg-gradient-to-r from-primary to-primary-container" />

          <div className="overflow-y-auto max-h-[82vh]">
            {/* Header */}
            <div className="px-10 pt-10 pb-6">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-2xl font-extrabold font-headline text-primary leading-tight">
                  Create Role Users
                </AlertDialogTitle>
                <AlertDialogDescription className="text-sm text-on-surface-variant font-body mt-1.5">
                  Creating for{' '}
                  <span className="font-bold text-on-surface">
                    {events.find(e => e.id === selectedEvent)?.name || '—'}
                  </span>
                </AlertDialogDescription>
              </AlertDialogHeader>
            </div>

            <div className="px-10 space-y-8 pb-10">

              {/* ── Role picker ── */}
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/60 font-headline">Role Type</p>
                  <p className="text-xs text-on-surface-variant/50 font-body mt-0.5">Organizer is the primary role. Other roles are available if needed.</p>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => setSelectedRole('organizer')}
                    className={`flex items-center gap-1.5 py-2 px-4 rounded-full text-xs font-bold transition-all active:scale-95 font-headline whitespace-nowrap ${
                      selectedRole === 'organizer'
                        ? 'bg-gradient-to-r from-primary to-primary-container text-white shadow-[0_4px_12px_rgba(19,41,143,0.25)]'
                        : 'bg-primary/10 text-primary hover:bg-primary/20 border border-primary/15'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>manage_accounts</span>
                    Organizer
                  </button>

                  <span className="w-px h-4 bg-outline-variant/40 shrink-0" />

                  {(['jury', 'admin', 'journalist'] as RoleType[]).map(type => (
                    <button
                      key={type}
                      onClick={() => setSelectedRole(type)}
                      className={`flex items-center gap-1.5 py-2 px-4 rounded-full text-xs font-bold transition-all active:scale-95 font-headline whitespace-nowrap ${
                        selectedRole === type
                          ? 'bg-gradient-to-r from-primary to-primary-container text-white shadow-[0_4px_12px_rgba(19,41,143,0.25)]'
                          : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>{roleIcons[type]}</span>
                      {roleConfigs[type].label}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Count + password ── */}
              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/60 font-headline">How many?</p>
                  <input
                    type="number" min="1" max="50" value={count}
                    onChange={e => setCount(parseInt(e.target.value) || 1)}
                    className="w-full h-12 bg-surface-container-high border-none rounded-2xl font-bold px-5 text-sm text-on-surface focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest font-body outline-none"
                  />
                  <p className="text-[10px] text-on-surface-variant/40 font-body">Max 50 at once</p>
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/60 font-headline">Password</p>
                  <input
                    type="text" value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder={config.defaultPassword}
                    className="w-full h-12 bg-surface-container-high border-none rounded-2xl font-bold px-5 text-sm text-on-surface focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest font-body outline-none"
                  />
                  <p className="text-[10px] text-on-surface-variant/40 font-body">Default: {config.defaultPassword}</p>
                </div>
              </div>

              {/* ── Preview ── */}
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/60 font-headline">Preview</p>
                <div className="bg-surface-container-low rounded-2xl p-5 max-h-36 overflow-y-auto">
                  <ul className="space-y-2">
                    {Array.from({ length: Math.min(count, 5) }, (_, i) => (
                      <li key={i} className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-[10px] font-black text-primary font-headline">{i + 1}</span>
                        </div>
                        <span className="text-sm font-body text-on-surface">
                          {config.label} {i + 1}
                          <span className="text-on-surface-variant/50 ml-2 text-xs">{selectedRole}{i + 1}{config.emailDomain}</span>
                        </span>
                      </li>
                    ))}
                    {count > 5 && (
                      <li className="text-xs text-on-surface-variant/50 font-body italic pl-9">…and {count - 5} more</li>
                    )}
                  </ul>
                </div>
                <p className="text-xs text-on-surface-variant/50 font-body flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[13px]">info</span>
                  All users will be automatically assigned to the selected event.
                </p>
              </div>

              {/* ── Footer ── */}
              <div className="flex gap-3 pt-2">
                <AlertDialogCancel className="flex-1 h-12 bg-surface-container-high border-none rounded-2xl font-bold text-sm text-on-surface-variant font-body hover:bg-surface-container-highest transition-colors">
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleCreate}
                  disabled={isCreating}
                  className="flex-2 h-12 px-8 bg-gradient-to-r from-primary to-primary-container text-white border-none rounded-2xl font-bold text-sm font-headline shadow-[0_4px_12px_rgba(19,41,143,0.25)] disabled:opacity-50 hover:scale-[1.01] active:scale-[0.99] transition-all"
                >
                  {isCreating
                    ? <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Creating…</span>
                    : `Create ${count} ${config.label}${count > 1 ? 's' : ''}`
                  }
                </AlertDialogAction>
              </div>

            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
};
