import { useState, useEffect, useMemo } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type RoleType = 'jury' | 'admin' | 'journalist';
type DisplayRole = 'jury' | 'admin' | 'journalist' | 'student';
type RoleFilter = 'all' | DisplayRole;

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

const roleConfigs: Record<RoleType, RoleConfig> = {
  jury:       { type: 'jury',       label: 'Jury',          defaultPassword: 'jury2025',       userType: 'jury',      position: 'Senior Evaluator', serialStart: 1001, emailDomain: '@yip.com' },
  admin:      { type: 'admin',      label: 'Admin Student', defaultPassword: 'admin2025',      userType: 'student',   appRole: 'admin_student', position: 'Admin Student',  serialStart: 9001, emailDomain: '@yip.com' },
  journalist: { type: 'journalist', label: 'Journalist',    defaultPassword: 'journalist2025', userType: 'student',   appRole: 'journalist',    position: 'Journalist',      serialStart: 8001, emailDomain: '@yip.com' },
};

const createRoleIcons: Record<string, string> = {
  jury: 'gavel', admin: 'admin_panel_settings', journalist: 'newspaper',
};

interface UserRow {
  user_id: string;
  name: string;
  email: string;
  serial_number: number;
  user_type: string;
  position?: string | null;
  created_at?: string;
  is_active?: boolean;
  displayRole: DisplayRole;
}

const roleMeta: Record<DisplayRole, { label: string; icon: string; badgeCls: string; avatarCls: string; filterIcon: string }> = {
  jury:       { label: 'Jury Member',    icon: 'gavel',              badgeCls: 'bg-primary-fixed text-on-primary-fixed',                                          avatarCls: 'bg-primary/10 text-primary',              filterIcon: 'gavel' },
  journalist: { label: 'Journalist',     icon: 'article',            badgeCls: 'bg-secondary-fixed text-on-secondary-fixed',                                      avatarCls: 'bg-secondary/10 text-secondary',          filterIcon: 'article' },
  admin:      { label: 'Admin Student',  icon: 'admin_panel_settings', badgeCls: 'bg-surface-container-high text-on-surface border border-outline-variant/20',    avatarCls: 'bg-surface-container-high text-on-surface', filterIcon: 'admin_panel_settings' },
  student:    { label: 'Regular Student',icon: 'school',             badgeCls: 'bg-surface-container text-on-surface-variant border border-outline-variant/30',   avatarCls: 'bg-surface-container-highest text-on-surface-variant', filterIcon: 'school' },
};

const initials = (name: string) => name.trim().split(/\s+/).map(n => n[0]).join('').slice(0, 2).toUpperCase();
const fmtDate  = (d?: string)   => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : '—';

const ITEMS_PER_PAGE = 10;

export const DynamicRoleCreator = () => {
  // Create form
  const [selectedRole, setSelectedRole]   = useState<RoleType>('jury');
  const [count, setCount]                 = useState(1);
  const [password, setPassword]           = useState('');
  const [isCreating, setIsCreating]       = useState(false);
  const [isCreateOpen, setIsCreateOpen]   = useState(false);

  // Data
  const [allUsers, setAllUsers]     = useState<UserRow[]>([]);
  const [isLoading, setIsLoading]   = useState(false);

  // Delete
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Edit
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [editName, setEditName]       = useState('');
  const [editPosition, setEditPosition] = useState('');
  const [isSaving, setIsSaving]       = useState(false);

  // Password reset
  const [resetTarget, setResetTarget]   = useState<UserRow | null>(null);
  const [newPassword, setNewPassword]   = useState('');
  const [isResetting, setIsResetting]   = useState(false);

  // Filters
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [currentPage, setCurrentPage]   = useState(1);

  const config = roleConfigs[selectedRole];

  // ── Fetch ────────────────────────────────────────────────────────────────
  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const [{ data: juryData }, { data: rolesData }, { data: studentData }] = await Promise.all([
        supabase.from('profiles').select('user_id, name, email, serial_number, user_type, position, created_at, is_active').eq('user_type', 'jury').order('serial_number'),
        supabase.from('user_roles').select('user_id, role'),
        supabase.from('profiles').select('user_id, name, email, serial_number, user_type, position, created_at, is_active').eq('user_type', 'student').order('serial_number'),
      ]);

      const flat: UserRow[] = [];
      (juryData || []).forEach(u => flat.push({ ...u, displayRole: 'jury' }));
      (studentData || []).forEach(u => {
        const r = rolesData?.find(x => x.user_id === u.user_id);
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

  useEffect(() => { fetchUsers(); }, []);

  // ── Delete ───────────────────────────────────────────────────────────────
  const handleDelete = async (userId: string, userName: string) => {
    setDeletingId(userId);
    try {
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { userId },
      });
      if (error || !data?.success) throw new Error(data?.error || error?.message || 'Delete failed');
      toast.success('User Deleted', { description: `${userName} has been deleted.` });
      fetchUsers();
    } catch (err: any) {
      console.error(err);
      toast.error('Error', { description: err.message || 'Failed to delete user.' });
    } finally {
      setDeletingId(null);
    }
  };

  // ── Edit ─────────────────────────────────────────────────────────────────
  const openEdit = (user: UserRow) => {
    setEditingUser(user);
    setEditName(user.name);
    setEditPosition(user.position || '');
  };

  const handleEditSave = async () => {
    if (!editingUser) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ name: editName.trim(), position: editPosition.trim() })
        .eq('user_id', editingUser.user_id);
      if (error) throw error;
      toast.success('User Updated', { description: `${editName.trim()} has been updated.` });
      setEditingUser(null);
      fetchUsers();
    } catch (err) {
      console.error(err);
      toast.error('Error', { description: 'Failed to update user.' });
    } finally {
      setIsSaving(false);
    }
  };

  // ── Password Reset ───────────────────────────────────────────────────────
  const openReset = (user: UserRow) => { setResetTarget(user); setNewPassword(''); };

  const handlePasswordReset = async () => {
    if (!resetTarget || !newPassword.trim()) {
      toast.error('Enter a new password');
      return;
    }
    setIsResetting(true);
    try {
      const { data, error } = await supabase.functions.invoke('reset-student-password', {
        body: { userId: resetTarget.user_id, newPassword: newPassword.trim() },
      });
      if (error || !data?.success) throw new Error(data?.error || error?.message || 'Reset failed');
      toast.success('Password Reset', { description: `Password updated for ${resetTarget.name}.` });
      setResetTarget(null);
      setNewPassword('');
    } catch (err: any) {
      console.error(err);
      toast.error('Error', { description: err.message || 'Failed to reset password.' });
    } finally {
      setIsResetting(false);
    }
  };

  // ── Create ───────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (count < 1 || count > 50) { toast.error('Invalid Count', { description: 'Enter a number between 1 and 50.' }); return; }
    const finalPwd = password.trim() || config.defaultPassword;
    setIsCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-role-users', {
        body: { roleType: selectedRole, count, password: finalPwd },
      });
      if (error) throw new Error(error.message || JSON.stringify(error));
      if (data?.error) throw new Error(data.error);
      const ok   = data?.results?.filter((r: any) => r.success).length || 0;
      const fail = data?.results?.filter((r: any) => !r.success).length || 0;
      toast.success('Users Created', { description: `Created ${ok} ${config.label} users.${fail > 0 ? ` Failed: ${fail}` : ''}` });
      setIsCreateOpen(false);
      setPassword('');
      setCount(1);
      fetchUsers();
    } catch (err: any) {
      console.error('Create role users error:', err);
      toast.error('Error', { description: err.message || `Failed to create ${config.label} users.` });
    } finally {
      setIsCreating(false);
    }
  };

  // ── Stats ────────────────────────────────────────────────────────────────
  const juryCount    = useMemo(() => allUsers.filter(u => u.displayRole === 'jury').length,                                  [allUsers]);
  const pressCount   = useMemo(() => allUsers.filter(u => u.displayRole === 'journalist').length,                            [allUsers]);
  const studentCount = useMemo(() => allUsers.filter(u => u.displayRole === 'student').length, [allUsers]);
  const adminCount   = useMemo(() => allUsers.filter(u => u.displayRole === 'admin').length,   [allUsers]);

  // ── Filter + paginate ────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (roleFilter === 'all') return allUsers;
    return allUsers.filter(u => u.displayRole === roleFilter);
  }, [allUsers, roleFilter]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated  = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const applyRoleFilter = (f: RoleFilter) => { setRoleFilter(f); setCurrentPage(1); };

  const pageNumbers = useMemo(() => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (currentPage <= 3) return [1, 2, 3, '…', totalPages];
    if (currentPage >= totalPages - 2) return [1, '…', totalPages - 2, totalPages - 1, totalPages];
    return [1, '…', currentPage - 1, currentPage, currentPage + 1, '…', totalPages];
  }, [currentPage, totalPages]);

  const start = filtered.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const end   = Math.min(currentPage * ITEMS_PER_PAGE, filtered.length);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-in fade-in duration-700">

      {/* Actions bar */}
      <div className="flex justify-end gap-3">
        <button
          onClick={fetchUsers} disabled={isLoading}
          className="flex items-center gap-2 px-5 py-2.5 bg-surface-container-lowest border border-outline-variant/20 rounded-xl text-on-surface-variant hover:bg-surface-container-high transition-colors font-semibold text-sm font-body disabled:opacity-50"
        >
          <span className={`material-symbols-outlined text-[20px] ${isLoading ? 'animate-spin' : ''}`}>refresh</span>
          Refresh
        </button>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-primary to-primary-container text-white rounded-xl font-bold text-sm font-body shadow-[0_4px_12px_rgba(19,41,143,0.25)] hover:shadow-[0_6px_16px_rgba(19,41,143,0.35)] transition-all active:scale-[0.98]"
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
          Add Role
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        {[
          { label: 'Jury Members',     value: String(juryCount).padStart(2, '0'),    color: 'text-primary',   icon: 'gavel',                iconColor: 'text-primary' },
          { label: 'Journalists',      value: String(pressCount).padStart(2, '0'),   color: 'text-secondary', icon: 'article',              iconColor: 'text-secondary' },
          { label: 'Students',         value: String(studentCount).padStart(3, '0'), color: 'text-tertiary',   icon: 'school',               iconColor: 'text-tertiary' },
          { label: 'Admin Students',   value: String(adminCount).padStart(2, '0'),   color: 'text-error',     icon: 'admin_panel_settings', iconColor: 'text-error' },
        ].map((card, i) => (
          <div key={i} className="bg-surface-container-lowest p-6 rounded-2xl shadow-sm border border-outline-variant/10 relative overflow-hidden group">
            <div className="relative z-10">
              <p className="text-on-surface-variant font-bold text-xs uppercase tracking-widest mb-1 font-body">{card.label}</p>
              <h4 className={`text-3xl font-headline font-extrabold ${card.color}`}>{card.value}</h4>
            </div>
            {card.icon && (
              <span className={`material-symbols-outlined absolute -bottom-2 -right-2 ${card.iconColor} opacity-10 text-7xl group-hover:scale-110 transition-transform select-none`} style={{ fontVariationSettings: "'FILL' 1" }}>{card.icon}</span>
            )}
          </div>
        ))}
      </div>

      {/* Table card */}
      <div className="bg-surface-container-lowest rounded-[2rem] shadow-[0_32px_64px_-16px_rgba(19,41,143,0.1)] overflow-hidden">

        {/* Filter bar */}
        <div className="px-6 py-5 border-b border-outline-variant/10 bg-surface-container-low/30 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-on-surface-variant/50 font-headline pr-1">Role</span>
            <button onClick={() => applyRoleFilter('all')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all font-body ${roleFilter === 'all' ? 'bg-primary text-white shadow-[0_4px_12px_rgba(19,41,143,0.25)]' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}`}
            >
              All Roles
            </button>
            {(Object.keys(roleMeta) as DisplayRole[]).map(role => (
              <button key={role} onClick={() => applyRoleFilter(role)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all font-body ${roleFilter === role ? 'bg-primary text-white shadow-[0_4px_12px_rgba(19,41,143,0.25)]' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}`}
              >
                <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>{roleMeta[role].filterIcon}</span>
                {roleMeta[role].label}
              </button>
            ))}
          </div>
          <p className="text-sm font-semibold text-on-surface-variant font-body shrink-0">
            {start}–{end} of {filtered.length}
          </p>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low/30">
                <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant font-body">User Information</th>
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant font-body">Role Category</th>
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant font-body">Date Created</th>
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant font-body">Status</th>
                <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant text-right font-body">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/5">
              {isLoading ? (
                <tr><td colSpan={5} className="px-8 py-16 text-center text-on-surface-variant/50 font-body">
                  <span className="material-symbols-outlined text-[32px] animate-spin block mb-3 mx-auto">refresh</span>
                  Loading users…
                </td></tr>
              ) : paginated.length === 0 ? (
                <tr><td colSpan={5} className="px-8 py-16 text-center">
                  <span className="material-symbols-outlined text-[48px] text-on-surface-variant/20 block mb-3 mx-auto" style={{ fontVariationSettings: "'FILL' 1" }}>group</span>
                  <p className="text-sm text-on-surface-variant/50 font-body">No users found.</p>
                </td></tr>
              ) : paginated.map(user => {
                const meta   = roleMeta[user.displayRole];
                const active = user.is_active !== false;
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
                    <td className="px-6 py-5 text-sm font-medium text-on-surface-variant font-body whitespace-nowrap">{fmtDate(user.created_at)}</td>
                    <td className="px-6 py-5">
                      {active
                        ? <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-tertiary/10 text-tertiary-fixed-dim text-[11px] font-bold rounded-full uppercase tracking-wider font-body">Active</span>
                        : <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-surface-container-highest text-on-surface-variant text-[11px] font-bold rounded-full uppercase tracking-wider font-body">Inactive</span>
                      }
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {/* Edit */}
                        <button onClick={() => openEdit(user)} className="p-2 text-on-surface-variant hover:text-primary transition-colors rounded-lg hover:bg-surface-container">
                          <span className="material-symbols-outlined text-[20px]">edit</span>
                        </button>
                        {/* Password Reset */}
                        <button onClick={() => openReset(user)} className="p-2 text-on-surface-variant hover:text-secondary transition-colors rounded-lg hover:bg-surface-container">
                          <span className="material-symbols-outlined text-[20px]">lock_reset</span>
                        </button>
                        {/* Delete */}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button disabled={deletingId === user.user_id} className="p-2 text-on-surface-variant hover:text-error transition-colors rounded-lg hover:bg-surface-container disabled:opacity-40">
                              <span className="material-symbols-outlined text-[20px]">delete</span>
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="rounded-[2rem] border-none bg-surface-container-lowest shadow-2xl overflow-hidden p-0">
                            <div className="h-1.5 bg-error" />
                            <div className="p-8 space-y-4">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="text-xl font-extrabold font-headline text-error">Delete {user.name}?</AlertDialogTitle>
                                <AlertDialogDescription className="text-sm text-on-surface-variant font-body">
                                  This will permanently delete this account and all associated data. This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter className="flex gap-3 pt-2">
                                <AlertDialogCancel className="flex-1 h-12 bg-surface-container border-none rounded-2xl font-bold text-sm text-on-surface-variant font-body">Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(user.user_id, user.name)} className="flex-1 h-12 bg-error text-on-error border-none rounded-2xl font-bold text-sm font-body">Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </div>
                          </AlertDialogContent>
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
              Showing <span className="text-on-surface font-bold">{start}–{end}</span> of <span className="text-on-surface font-bold">{filtered.length}</span> results
            </p>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-surface-container border border-outline-variant/20 text-on-surface-variant hover:bg-surface-container-high transition-colors disabled:opacity-30">
                <span className="material-symbols-outlined text-[18px]">chevron_left</span>
              </button>
              {pageNumbers.map((p, i) =>
                p === '…'
                  ? <span key={`e${i}`} className="w-9 h-9 flex items-center justify-center text-on-surface-variant text-sm font-bold font-body">…</span>
                  : <button key={p} onClick={() => setCurrentPage(p as number)}
                      className={`w-9 h-9 flex items-center justify-center rounded-xl font-bold text-xs transition-all font-body ${currentPage === p ? 'bg-gradient-to-r from-primary to-primary-container text-white shadow-[0_4px_12px_rgba(19,41,143,0.25)]' : 'bg-surface-container border border-outline-variant/20 text-on-surface-variant hover:bg-surface-container-high'}`}>
                      {p}
                    </button>
              )}
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-surface-container border border-outline-variant/20 text-on-surface-variant hover:bg-surface-container-high transition-colors disabled:opacity-30">
                <span className="material-symbols-outlined text-[18px]">chevron_right</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Edit Dialog ──────────────────────────────────────────────────── */}
      <Dialog open={!!editingUser} onOpenChange={open => !open && setEditingUser(null)}>
        <DialogContent className="rounded-[2rem] border-none bg-surface-container-lowest shadow-2xl overflow-hidden p-0 max-w-md [&>button]:hidden">
          <div className="h-1.5 bg-gradient-to-r from-primary to-primary-container" />
          <div className="p-8 space-y-5">
            <div>
              <h2 className="text-xl font-extrabold font-headline text-primary">Edit User</h2>
              <p className="text-xs text-on-surface-variant/60 font-body mt-1">Update name and position for {editingUser?.name}</p>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-on-surface-variant/50 font-headline mb-2">Name</p>
                <input
                  value={editName} onChange={e => setEditName(e.target.value)}
                  className="w-full h-12 bg-surface-container border-none rounded-2xl font-bold px-5 text-sm text-on-surface focus:ring-2 focus:ring-primary/20 font-body outline-none"
                />
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-on-surface-variant/50 font-headline mb-2">Position</p>
                <input
                  value={editPosition} onChange={e => setEditPosition(e.target.value)}
                  placeholder="e.g. Senior Evaluator"
                  className="w-full h-12 bg-surface-container border-none rounded-2xl font-bold px-5 text-sm text-on-surface focus:ring-2 focus:ring-primary/20 font-body outline-none"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setEditingUser(null)} className="flex-1 h-12 bg-surface-container rounded-2xl font-bold text-sm text-on-surface-variant font-body hover:bg-surface-container-high transition-colors">
                Cancel
              </button>
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
        <DialogContent className="rounded-[2rem] border-none bg-surface-container-lowest shadow-2xl overflow-hidden p-0 max-w-md [&>button]:hidden">
          <div className="h-1.5 bg-gradient-to-r from-secondary to-secondary-fixed-dim" />
          <div className="p-8 space-y-5">
            <div>
              <h2 className="text-xl font-extrabold font-headline text-secondary">Reset Password</h2>
              <p className="text-xs text-on-surface-variant/60 font-body mt-1">Set a new password for {resetTarget?.name}</p>
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-on-surface-variant/50 font-headline mb-2">New Password</p>
              <input
                type="text" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                className="w-full h-12 bg-surface-container border-none rounded-2xl font-bold px-5 text-sm text-on-surface focus:ring-2 focus:ring-secondary/20 font-body outline-none"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setResetTarget(null)} className="flex-1 h-12 bg-surface-container rounded-2xl font-bold text-sm text-on-surface-variant font-body hover:bg-surface-container-high transition-colors">
                Cancel
              </button>
              <button onClick={handlePasswordReset} disabled={isResetting || !newPassword.trim()}
                className="flex-1 h-12 bg-secondary text-white rounded-2xl font-bold text-sm font-body shadow-[0_4px_12px_rgba(172,53,9,0.25)] disabled:opacity-50 transition-all">
                {isResetting ? 'Resetting…' : 'Reset Password'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Create Users Dialog ──────────────────────────────────────────── */}
      <AlertDialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <AlertDialogContent className="rounded-[2rem] border-none bg-surface-container-lowest shadow-2xl overflow-hidden p-0 max-w-lg max-h-[85vh]">
          <div className="h-1.5 bg-gradient-to-r from-primary to-primary-container" />
          <div className="p-8 space-y-6 overflow-y-auto">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-2xl font-extrabold font-headline text-primary">Create Role Users</AlertDialogTitle>
              <AlertDialogDescription className="text-sm text-on-surface-variant font-body">Configure and provision new user accounts</AlertDialogDescription>
            </AlertDialogHeader>

            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-on-surface-variant/50 font-headline mb-3">Role Type</p>
              <div className="flex flex-wrap gap-2">
                {(Object.entries(roleConfigs) as [RoleType, RoleConfig][]).map(([type, cfg]) => (
                  <button key={type} onClick={() => setSelectedRole(type)}
                    className={`flex items-center gap-2 py-2 px-4 rounded-full text-sm font-bold transition-all active:scale-95 font-body ${selectedRole === type ? 'bg-primary text-white shadow-[0_4px_12px_rgba(19,41,143,0.25)]' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}`}
                  >
                    <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>{createRoleIcons[type]}</span>
                    {cfg.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-on-surface-variant/50 font-headline mb-2">Count</p>
                <input type="number" min="1" max="50" value={count} onChange={e => setCount(parseInt(e.target.value) || 1)}
                  className="w-full h-12 bg-surface-container border-none rounded-2xl font-bold px-5 text-sm text-on-surface focus:ring-2 focus:ring-primary/20 font-body outline-none" />
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-on-surface-variant/50 font-headline mb-2">
                  Password <span className="normal-case font-normal opacity-60">(default: {config.defaultPassword})</span>
                </p>
                <input type="text" value={password} onChange={e => setPassword(e.target.value)} placeholder={config.defaultPassword}
                  className="w-full h-12 bg-surface-container border-none rounded-2xl font-bold px-5 text-sm text-on-surface focus:ring-2 focus:ring-primary/20 font-body outline-none" />
              </div>
            </div>

            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-on-surface-variant/50 font-headline mb-2">Will Create</p>
              <div className="bg-surface-container rounded-2xl p-4 max-h-32 overflow-y-auto">
                <ul className="space-y-1">
                  {Array.from({ length: Math.min(count, 5) }, (_, i) => (
                    <li key={i} className="text-sm font-body text-on-surface">{config.label} {i + 1} — {selectedRole}{i + 1}{config.emailDomain}</li>
                  ))}
                  {count > 5 && <li className="text-xs text-on-surface-variant/60 font-body italic">…and {count - 5} more</li>}
                </ul>
              </div>
              <p className="text-xs text-on-surface-variant/60 font-body mt-2">Existing users will be updated with the new password.</p>
            </div>

            <AlertDialogFooter className="flex gap-3">
              <AlertDialogCancel className="flex-1 h-12 bg-surface-container border-none rounded-2xl font-bold text-sm text-on-surface-variant font-body">Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleCreate} disabled={isCreating}
                className="flex-1 h-12 bg-gradient-to-r from-primary to-primary-container text-white border-none rounded-2xl font-bold text-sm font-body shadow-[0_4px_12px_rgba(19,41,143,0.25)] disabled:opacity-50">
                {isCreating ? 'Creating…' : `Create ${count} ${config.label} ${count > 1 ? 'Users' : 'User'}`}
              </AlertDialogAction>
            </AlertDialogFooter>
          </div>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
};
