import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

interface DuplicateLogin {
  user_id: string;
  name: string;
  email: string;
  position: string;
  is_duplicate_session: boolean;
  session_id: string;
  previous_session_id?: string;
  last_login_at: string;
}

interface AuditLogEntry {
  id: string;
  user_id: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  details: any;
  created_at: string;
  ip_address?: string;
  user_agent?: string;
  user_name?: string;
}

interface ActiveUser {
  user_id: string;
  name: string;
  email: string;
  position: string;
  user_type: string;
  last_login_at: string;
  session_id?: string;
  is_active: boolean;
}

interface LoginAuditEntry {
  id: string;
  user_id: string;
  user_name?: string;
  ip_address?: string;
  user_agent?: string;
  session_id?: string;
  is_duplicate_session: boolean;
  previous_session_id?: string;
  login_attempt_at: string;
}

export const SecurityLogsManager = () => {
  const [duplicateLogins, setDuplicateLogins] = useState<DuplicateLogin[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [loginAuditEntries, setLoginAuditEntries] = useState<LoginAuditEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'audit' | 'access'>("audit");

  useEffect(() => {
    fetchAllData();
    const loginSubscription = supabase.channel('login_audit_changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'login_audit' }, () => {
        fetchDuplicateLogins(); fetchActiveUsers(); fetchLoginAuditEntries();
      }).subscribe();
    const auditSubscription = supabase.channel('audit_logs_changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'audit_logs' }, () => {
        fetchAuditLogs();
      }).subscribe();
    return () => { loginSubscription.unsubscribe(); auditSubscription.unsubscribe(); };
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    await Promise.all([fetchDuplicateLogins(), fetchAuditLogs(), fetchActiveUsers(), fetchLoginAuditEntries()]);
    setLoading(false);
  };

  const fetchDuplicateLogins = async () => {
    try {
      const { data: activeSessionUsers, error: activeError } = await supabase
        .from('profiles').select('user_id, name, email, position, session_id, last_login_at')
        .not('session_id', 'is', null).eq('is_active', true).neq('user_type', 'super_admin');
      if (activeError) throw activeError;
      if (!activeSessionUsers || activeSessionUsers.length === 0) { setDuplicateLogins([]); return; }
      const activeUserIds = activeSessionUsers.map(u => u.user_id);
      const windowStart = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const { data: recentLogins, error: loginErr } = await supabase
        .from('login_audit').select('user_id, is_duplicate_session, session_id, previous_session_id, login_attempt_at, ip_address, user_agent')
        .in('user_id', activeUserIds).gte('login_attempt_at', windowStart)
        .order('login_attempt_at', { ascending: false }).limit(300);
      if (loginErr) throw loginErr;
      const incidents: DuplicateLogin[] = [];
      const byUser: Record<string, typeof recentLogins> = {} as any;
      (recentLogins || []).forEach(row => {
        if (!byUser[row.user_id]) byUser[row.user_id] = [] as any;
        (byUser[row.user_id] as any).push(row);
      });
      Object.entries(byUser).forEach(([userId, rows]) => {
        const activeUser = activeSessionUsers.find(u => u.user_id === userId);
        if (!activeUser) return;
        const nowWindowStart = Date.now() - 2 * 60 * 1000;
        const hasActiveAndDuplicate = (rows as any[]).some(r => {
          const t = new Date(r.login_attempt_at).getTime();
          return r.is_duplicate_session === true && r.session_id && r.session_id !== activeUser.session_id && t >= nowWindowStart;
        });
        const hasCurrentSessionSeen = (rows as any[]).some(r => r.session_id && r.session_id === activeUser.session_id);
        if (hasActiveAndDuplicate && hasCurrentSessionSeen) {
          const latestDup = (rows as any[]).find(r => r.is_duplicate_session);
          incidents.push({ user_id: userId, name: activeUser.name || 'Unknown', email: activeUser.email || 'Unknown', position: activeUser.position || 'Unknown', is_duplicate_session: true, session_id: latestDup?.session_id, previous_session_id: latestDup?.previous_session_id, last_login_at: latestDup?.login_attempt_at || activeUser.last_login_at });
        }
      });
      setDuplicateLogins(incidents);
    } catch (error) { setDuplicateLogins([]); }
  };

  const fetchAuditLogs = async () => {
    try {
      const { data: auditData, error: auditError } = await supabase
        .from('audit_logs').select('id, user_id, action, resource_type, resource_id, details, created_at, ip_address, user_agent')
        .order('created_at', { ascending: false }).limit(100);
      if (auditError) throw auditError;
      if (auditData && auditData.length > 0) {
        const userIds = [...new Set(auditData.map(item => item.user_id).filter(Boolean))];
        const { data: profileData } = await supabase.from('profiles').select('user_id, name').in('user_id', userIds);
        setAuditLogs(auditData.map(audit => ({ ...audit, user_name: profileData?.find(p => p.user_id === audit.user_id)?.name || 'System' })));
      }
    } catch (error) { console.error('Error fetching audit logs:', error); }
  };

  const fetchActiveUsers = async () => {
    try {
      const { data: profileData, error } = await supabase
        .from('profiles').select('user_id, name, email, position, user_type, last_login_at, session_id, is_active')
        .eq('is_active', true).not('last_login_at', 'is', null).neq('user_type', 'super_admin').order('last_login_at', { ascending: false });
      if (error) throw error;
      const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
      setActiveUsers(profileData?.filter(u => new Date(u.last_login_at) > fourHoursAgo || u.session_id !== null) || []);
    } catch (error) { console.error(error); }
  };

  const fetchLoginAuditEntries = async () => {
    try {
      const { data: loginData, error } = await supabase
        .from('login_audit').select('id, user_id, ip_address, user_agent, session_id, is_duplicate_session, previous_session_id, login_attempt_at')
        .order('login_attempt_at', { ascending: false }).limit(50);
      if (error) throw error;
      if (loginData && loginData.length > 0) {
        const userIds = [...new Set(loginData.map(item => item.user_id))];
        const { data: profileData } = await supabase.from('profiles').select('user_id, name').in('user_id', userIds);
        setLoginAuditEntries(loginData.map(login => ({ ...login, user_name: profileData?.find(p => p.user_id === login.user_id)?.name || 'Unknown User' })));
      } else { setLoginAuditEntries([]); }
    } catch (error) { console.error(error); }
  };

  const forceLogoutUser = async (userId: string, userName: string) => {
    const target = activeUsers.find(u => u.user_id === userId);
    if (target?.user_type === 'super_admin') {
      toast({ title: 'Access Denied', description: 'Cannot force logout a super admin.', variant: 'destructive' });
      return;
    }
    try {
      const { error } = await supabase.from('profiles').update({ session_id: null }).eq('user_id', userId);
      if (error) throw error;
      await supabase.rpc('log_audit_event', { p_user_id: userId, p_action: 'force_logout', p_resource_type: 'user_session', p_resource_id: userId, p_details: { forced_by_organizer: true } });
      toast({ title: "User Logged Out", description: `${userName} has been forcefully logged out from all sessions` });
      fetchActiveUsers(); fetchDuplicateLogins();
    } catch (error) {
      toast({ title: "Error", description: "Failed to logout user", variant: "destructive" });
    }
  };

  const filteredUsers = activeUsers.filter(user => {
    const matchesSearch = searchTerm === '' || user.name.toLowerCase().includes(searchTerm.toLowerCase()) || user.position.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = statusFilter === 'all' || (statusFilter === 'active_session' && user.session_id) || (statusFilter === 'recent' && !user.session_id) || statusFilter === user.user_type;
    return matchesSearch && matchesFilter;
  });

  const userTypeMeta: Record<string, { label: string; cls: string }> = {
    student:   { label: 'Student',   cls: 'bg-primary-fixed text-on-primary-fixed' },
    jury:      { label: 'Jury',      cls: 'bg-secondary-fixed text-on-secondary-fixed' },
    organizer: { label: 'Organizer', cls: 'bg-primary-container text-on-primary-container' },
    admin:     { label: 'Admin',     cls: 'bg-surface-container-high text-on-surface-variant border border-outline-variant/20' },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="material-symbols-outlined text-[40px] text-primary animate-spin block mx-auto">refresh</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-700">

      {/* Security incidents alert */}
      {duplicateLogins.length > 0 && (
        <div className="bg-error/5 border border-error/20 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-error/15 flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-error animate-pulse block shrink-0" />
            <div className="flex items-center gap-2 flex-1">
              <span className="material-symbols-outlined text-[18px] text-error" style={{ fontVariationSettings: "'FILL' 1" }}>gpp_bad</span>
              <p className="font-headline font-extrabold text-error text-sm">Active Security Threats</p>
              <span className="px-2 py-0.5 bg-error text-on-error text-[11px] font-black rounded-full font-headline">{duplicateLogins.length}</span>
            </div>
            <p className="text-[10px] text-error/60 font-black uppercase tracking-widest font-headline">Users with concurrent sessions on multiple devices</p>
          </div>
          <div className="divide-y divide-error/10">
            {duplicateLogins.map((login, i) => (
              <div key={`${login.user_id}-${i}`} className="px-6 py-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-error/10 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[18px] text-error" style={{ fontVariationSettings: "'FILL' 1" }}>person_alert</span>
                  </div>
                  <div>
                    <p className="font-headline font-bold text-on-surface">{login.name}</p>
                    <p className="text-xs text-on-surface-variant font-body">{login.position}</p>
                    <p className="text-[11px] text-error font-bold font-body mt-0.5">
                      Multiple active sessions · {new Date(login.last_login_at).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => forceLogoutUser(login.user_id, login.name)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-error text-on-error rounded-xl font-bold text-sm font-body hover:bg-error/90 transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">logout</span>
                  Force Logout
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        {[
          { label: 'Active Sessions', value: String(activeUsers.filter(u => u.session_id).length).padStart(2, '0'), icon: 'sensors',     color: 'text-primary',   iconColor: 'text-primary' },
          { label: 'Recent Activity', value: String(activeUsers.filter(u => !u.session_id).length).padStart(2, '0'), icon: 'schedule',   color: 'text-secondary', iconColor: 'text-secondary' },
          { label: 'Audit Entries',   value: String(auditLogs.length).padStart(2, '0'),             icon: 'inventory',    color: 'text-tertiary',  iconColor: 'text-tertiary' },
          { label: 'Login Events',    value: String(loginAuditEntries.length).padStart(2, '0'),     icon: 'lock_clock',   color: 'text-on-surface',iconColor: 'text-on-surface-variant' },
        ].map((card, i) => (
          <div key={i} className="bg-surface-container-lowest p-6 rounded-2xl shadow-sm border border-outline-variant/10 relative overflow-hidden group">
            <div className="relative z-10">
              <p className="text-on-surface-variant font-bold text-xs uppercase tracking-widest mb-1 font-body">{card.label}</p>
              <h4 className={`text-3xl font-headline font-extrabold ${card.color}`}>{card.value}</h4>
            </div>
            <span className={`material-symbols-outlined absolute -bottom-2 -right-2 ${card.iconColor} opacity-10 text-7xl group-hover:scale-110 transition-transform select-none`} style={{ fontVariationSettings: "'FILL' 1" }}>{card.icon}</span>
          </div>
        ))}
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2">
        {(['audit', 'access'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm font-body transition-all ${activeTab === tab ? 'bg-gradient-to-r from-primary to-primary-container text-white shadow-[0_4px_12px_rgba(19,41,143,0.25)]' : 'bg-surface-container-lowest border border-outline-variant/20 text-on-surface-variant hover:bg-surface-container-high'}`}
          >
            <span className="material-symbols-outlined text-[18px]">{tab === 'audit' ? 'inventory' : 'manage_accounts'}</span>
            {tab === 'audit' ? 'Audit Logs' : 'Access Logs'}
          </button>
        ))}
        <div className="ml-auto">
          <button onClick={fetchAllData} className="flex items-center gap-2 px-4 py-2.5 bg-surface-container-lowest border border-outline-variant/20 rounded-xl text-on-surface-variant hover:bg-surface-container-high transition-colors font-semibold text-sm font-body">
            <span className="material-symbols-outlined text-[18px]">refresh</span>
            Refresh
          </button>
        </div>
      </div>

      {/* Audit Logs tab */}
      {activeTab === 'audit' && (
        <div className="bg-surface-container-lowest rounded-[2rem] shadow-[0_32px_64px_-16px_rgba(19,41,143,0.1)] overflow-hidden">
          <div className="px-8 py-6 border-b border-outline-variant/10 flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>inventory</span>
            </div>
            <div>
              <h3 className="font-headline font-extrabold text-on-surface">System Audit Logs</h3>
              <p className="text-xs text-on-surface-variant font-body">{auditLogs.length} entries · monitor all system activities and administrative actions</p>
            </div>
          </div>
          {auditLogs.length === 0 ? (
            <div className="px-8 py-16 text-center">
              <span className="material-symbols-outlined text-[48px] text-on-surface-variant/20 block mb-3" style={{ fontVariationSettings: "'FILL' 1" }}>inventory</span>
              <p className="text-sm text-on-surface-variant/50 font-body">No audit logs available. System activity will appear here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low/30">
                    <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant font-body">Action</th>
                    <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant font-body">User</th>
                    <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant font-body">Resource</th>
                    <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant font-body">IP</th>
                    <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant font-body">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/5">
                  {auditLogs.map(log => (
                    <tr key={log.id} className="hover:bg-primary-container/[0.02] transition-colors">
                      <td className="px-8 py-4">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary/10 text-primary text-[11px] font-bold rounded-full font-body">{log.action}</span>
                        <span className="ml-2 text-[11px] text-on-surface-variant font-body">{log.resource_type}</span>
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-on-surface font-body">{log.user_name}</td>
                      <td className="px-6 py-4 text-xs font-mono text-on-surface-variant">{log.resource_id ? log.resource_id.slice(0, 12) + '…' : '—'}</td>
                      <td className="px-6 py-4 text-xs font-mono text-on-surface-variant">{log.ip_address || '—'}</td>
                      <td className="px-6 py-4 text-sm text-on-surface-variant font-body whitespace-nowrap">{new Date(log.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Access Logs tab */}
      {activeTab === 'access' && (
        <div className="space-y-6">
          {/* Active Users */}
          <div className="bg-surface-container-lowest rounded-[2rem] shadow-[0_32px_64px_-16px_rgba(19,41,143,0.1)] overflow-hidden">
            <div className="px-8 py-5 border-b border-outline-variant/10 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-tertiary/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px] text-tertiary-fixed-dim" style={{ fontVariationSettings: "'FILL' 1" }}>sensors</span>
                </div>
                <div>
                  <h3 className="font-headline font-extrabold text-on-surface">Active Users</h3>
                  <p className="text-xs text-on-surface-variant font-body">{activeUsers.length} users logged in within last 4 hours</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[16px] text-on-surface-variant/50">search</span>
                  <input
                    placeholder="Search users…"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="h-9 bg-surface-container border-none rounded-xl pl-9 pr-4 text-sm font-body text-on-surface focus:ring-2 focus:ring-primary/20 outline-none w-48"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-9 bg-surface-container border-none rounded-xl font-body text-sm w-44">
                    <SelectValue placeholder="Filter" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-none bg-surface-container-lowest shadow-xl">
                    <SelectItem value="all">All Users</SelectItem>
                    <SelectItem value="active_session">Active Sessions</SelectItem>
                    <SelectItem value="recent">Recent Only</SelectItem>
                    <SelectItem value="student">Students</SelectItem>
                    <SelectItem value="jury">Jury</SelectItem>
                    <SelectItem value="organizer">Organizers</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {filteredUsers.length === 0 ? (
              <div className="px-8 py-12 text-center">
                <span className="material-symbols-outlined text-[48px] text-on-surface-variant/20 block mb-3" style={{ fontVariationSettings: "'FILL' 1" }}>group_off</span>
                <p className="text-sm text-on-surface-variant/50 font-body">No active users found.</p>
              </div>
            ) : (
              <div className="divide-y divide-outline-variant/5 max-h-[480px] overflow-y-auto">
                {filteredUsers.map(user => {
                  const meta = userTypeMeta[user.user_type] || userTypeMeta['student'];
                  return (
                    <div key={user.user_id} className="px-8 py-4 flex items-center justify-between gap-4 hover:bg-primary-container/[0.02] transition-colors">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${user.session_id ? 'bg-tertiary-fixed-dim' : 'bg-outline-variant'}`} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-headline font-bold text-on-surface truncate">{user.name}</p>
                            <span className={`inline-flex px-2 py-0.5 text-[10px] font-bold rounded-full font-body shrink-0 ${meta.cls}`}>{meta.label}</span>
                          </div>
                          <p className="text-xs text-on-surface-variant font-body truncate">{user.position}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs text-on-surface-variant font-body">{new Date(user.last_login_at).toLocaleTimeString()}</span>
                        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full font-body ${user.session_id ? 'bg-tertiary/10 text-tertiary-fixed-dim' : 'bg-surface-container text-on-surface-variant'}`}>
                          {user.session_id ? 'Live' : 'Recent'}
                        </span>
                        <button
                          onClick={() => forceLogoutUser(user.user_id, user.name)}
                          className="p-1.5 text-on-surface-variant hover:text-error transition-colors rounded-lg hover:bg-surface-container"
                          title="Force logout"
                        >
                          <span className="material-symbols-outlined text-[16px]">logout</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Login Audit */}
          <div className="bg-surface-container-lowest rounded-[2rem] shadow-[0_32px_64px_-16px_rgba(19,41,143,0.1)] overflow-hidden">
            <div className="px-8 py-6 border-b border-outline-variant/10 flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>lock_clock</span>
              </div>
              <div>
                <h3 className="font-headline font-extrabold text-on-surface">Login Activity Log</h3>
                <p className="text-xs text-on-surface-variant font-body">{loginAuditEntries.length} entries · all login attempts and session activities</p>
              </div>
            </div>
            {loginAuditEntries.length === 0 ? (
              <div className="px-8 py-12 text-center">
                <span className="material-symbols-outlined text-[48px] text-on-surface-variant/20 block mb-3" style={{ fontVariationSettings: "'FILL' 1" }}>lock_clock</span>
                <p className="text-sm text-on-surface-variant/50 font-body">No login activity yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-outline-variant/5 max-h-[480px] overflow-y-auto">
                {loginAuditEntries.map(entry => (
                  <div key={entry.id} className={`px-8 py-4 flex items-start justify-between gap-4 transition-colors ${entry.is_duplicate_session ? 'bg-error/[0.03] hover:bg-error/[0.06]' : 'hover:bg-primary-container/[0.02]'}`}>
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${entry.is_duplicate_session ? 'bg-error' : 'bg-tertiary-fixed-dim'}`} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-headline font-bold text-on-surface">{entry.user_name}</p>
                          {entry.is_duplicate_session && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-error/10 text-error text-[11px] font-bold rounded-full font-body">
                              <span className="material-symbols-outlined text-[12px]">warning</span>
                              Duplicate Session
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                          <span className="text-xs text-on-surface-variant font-body flex items-center gap-1">
                            <span className="material-symbols-outlined text-[12px]">schedule</span>
                            {new Date(entry.login_attempt_at).toLocaleString()}
                          </span>
                          {entry.ip_address && (
                            <span className="text-xs font-mono text-on-surface-variant">
                              {entry.ip_address}
                            </span>
                          )}
                          {entry.session_id && (
                            <span className="text-xs font-mono text-on-surface-variant/60">
                              Session: {entry.session_id.slice(0, 8)}…
                            </span>
                          )}
                        </div>
                        {entry.previous_session_id && (
                          <span className="text-[11px] font-mono text-error font-bold">
                            Prev: {entry.previous_session_id.slice(0, 8)}…
                          </span>
                        )}
                      </div>
                    </div>
                    <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full font-body shrink-0 mt-1 ${entry.is_duplicate_session ? 'bg-error/10 text-error' : 'bg-tertiary/10 text-tertiary-fixed-dim'}`}>
                      {entry.is_duplicate_session ? 'Security Alert' : 'Normal Login'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
