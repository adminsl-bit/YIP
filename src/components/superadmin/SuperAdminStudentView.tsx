import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { KeyRound, Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';

const ITEMS_PER_PAGE = 25;

const STATE_REGION: Record<string, string> = {
  // North
  'Delhi': 'North', 'Haryana': 'North', 'Punjab': 'North', 'Himachal Pradesh': 'North',
  'Uttarakhand': 'North', 'Jammu and Kashmir': 'North', 'Ladakh': 'North',
  'Uttar Pradesh': 'North', 'Rajasthan': 'North', 'Chandigarh': 'North',
  // South
  'Tamil Nadu': 'South', 'Kerala': 'South', 'Karnataka': 'South',
  'Andhra Pradesh': 'South', 'Telangana': 'South', 'Puducherry': 'South', 'Lakshadweep': 'South',
  // East
  'West Bengal': 'East', 'Odisha': 'East', 'Bihar': 'East', 'Jharkhand': 'East',
  'Andaman and Nicobar Islands': 'East',
  // West
  'Maharashtra': 'West', 'Gujarat': 'West', 'Goa': 'West',
  'Madhya Pradesh': 'West', 'Chhattisgarh': 'West',
  'Dadra and Nagar Haveli and Daman and Diu': 'West',
  // Northeast
  'Assam': 'Northeast', 'Meghalaya': 'Northeast', 'Manipur': 'Northeast',
  'Mizoram': 'Northeast', 'Nagaland': 'Northeast', 'Tripura': 'Northeast',
  'Arunachal Pradesh': 'Northeast', 'Sikkim': 'Northeast',
};

const REGION_CONFIG: Record<string, { icon: string; color: string; bg: string }> = {
  North:     { icon: 'north', color: 'text-primary', bg: 'bg-primary/8' },
  South:     { icon: 'south', color: 'text-secondary', bg: 'bg-secondary/8' },
  East:      { icon: 'east', color: 'text-tertiary-container', bg: 'bg-tertiary-fixed/15' },
  West:      { icon: 'west', color: 'text-on-tertiary-fixed-variant', bg: 'bg-tertiary/10' },
  Northeast: { icon: 'explore', color: 'text-error', bg: 'bg-error/8' },
};

const getRegion = (state?: string) => (state ? (STATE_REGION[state] ?? 'Other') : 'Other');

interface Student {
  id: string;
  user_id: string;
  name: string;
  position: string;
  party_number: number;
  party_name?: string | null;
  committee?: string | null;
  serial_number: number;
  constituency?: string;
  state?: string;
  city?: string;
  photo_url?: string;
  user_type: string;
  is_active?: boolean;
  last_login_at?: string;
  session_id?: string;
  created_at?: string;
}

const partyLabel = (n: number, name?: string | null) => {
  if (!n || n < 1) return 'No Party';
  const letters = ['A','B','C','D','E','F','G','H','I','J'];
  const l = letters[n - 1] ?? n.toString();
  return name ? `${name} (${l})` : `Party ${l}`;
};

const getSeatRole = (position: string) => {
  const p = (position || '').toLowerCase();
  if (p.includes('speaker') && p.includes('deputy')) return 'deputy_speaker';
  if (p.includes('speaker')) return 'speaker';
  if (p.includes('admin')) return 'administrator';
  if (p.includes('journalist')) return 'journalist';
  if (p.includes('minister')) return 'minister';
  return 'mp';
};

const roleChip = (pos: string) => {
  const r = getSeatRole(pos);
  const cls =
    r === 'speaker' ? 'bg-error/10 text-error' :
    r === 'minister' ? 'bg-tertiary-container/10 text-tertiary-container' :
    r === 'journalist' ? 'bg-secondary-fixed/30 text-secondary' :
    'bg-primary/10 text-primary';
  return <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold font-body ${cls}`}>{pos || 'Delegate'}</span>;
};

export const SuperAdminStudentView = () => {
  const [students, setStudents]         = useState<Student[]>([]);
  const [loading, setLoading]           = useState(true);
  const [searchTerm, setSearchTerm]     = useState('');
  const [cityFilter, setCityFilter]     = useState('');
  const [regionFilter, setRegionFilter] = useState('');
  const [roleFilter, setRoleFilter]     = useState('all');
  const [currentPage, setCurrentPage]   = useState(1);
  const [viewingStudent, setViewingStudent] = useState<Student | null>(null);
  const [resetStudent, setResetStudent]     = useState<Student | null>(null);
  const [newPw, setNewPw]               = useState('');
  const [confirmPw, setConfirmPw]       = useState('');
  const [showPw, setShowPw]             = useState(false);
  const [showConfirm, setShowConfirm]   = useState(false);
  const [resetting, setResetting]       = useState(false);

  useEffect(() => { fetchStudents(); }, []);

  const fetchStudents = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles').select('*').eq('user_type', 'student').order('city').order('serial_number');
    if (!error && data) setStudents(data as Student[]);
    setLoading(false);
  };

  // ── Region breakdown ──────────────────────────────────────────────────────────
  const regionGroups = useMemo(() => {
    const map: Record<string, Student[]> = {};
    students.forEach(s => {
      const r = getRegion(s.state);
      if (!map[r]) map[r] = [];
      map[r].push(s);
    });
    const order = ['North', 'South', 'East', 'West', 'Northeast', 'Other'];
    return order.filter(r => map[r]?.length > 0).map(r => [r, map[r]] as [string, Student[]]);
  }, [students]);

  // ── City breakdown ────────────────────────────────────────────────────────────
  const cityGroups = useMemo(() => {
    const map: Record<string, Student[]> = {};
    const source = regionFilter ? students.filter(s => getRegion(s.state) === regionFilter) : students;
    source.forEach(s => {
      const c = (s.city || 'Unassigned').trim();
      if (!map[c]) map[c] = [];
      map[c].push(s);
    });
    return Object.entries(map).sort((a, b) => b[1].length - a[1].length);
  }, [students, regionFilter]);

  const totalStudents  = students.length;
  const totalCities    = cityGroups.filter(([c]) => c !== 'Unassigned').length;
  const activeSessions = students.filter(s => s.session_id).length;
  const activeAccounts = students.filter(s => s.is_active).length;

  // ── Filtered table ────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return students.filter(s => {
      const matchRegion = !regionFilter || getRegion(s.state) === regionFilter;
      const matchCity = !cityFilter || (s.city || '').toLowerCase() === cityFilter.toLowerCase();
      const matchRole = roleFilter === 'all' || getSeatRole(s.position) === roleFilter;
      const matchSearch = !q || (
        s.name.toLowerCase().includes(q) ||
        (s.constituency || '').toLowerCase().includes(q) ||
        (s.city || '').toLowerCase().includes(q) ||
        (s.state || '').toLowerCase().includes(q) ||
        s.serial_number.toString().includes(q) ||
        (s.position || '').toLowerCase().includes(q)
      );
      return matchRegion && matchCity && matchRole && matchSearch;
    });
  }, [students, searchTerm, cityFilter, regionFilter, roleFilter]);

  const totalPages       = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated        = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  useEffect(() => { setCurrentPage(1); }, [searchTerm, cityFilter, regionFilter, roleFilter]);

  // ── Password reset ────────────────────────────────────────────────────────────
  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetStudent) return;
    if (!newPw || newPw.length < 6) {
      toast({ title: 'Password too short', variant: 'destructive' }); return;
    }
    if (newPw !== confirmPw) {
      toast({ title: "Passwords don't match", variant: 'destructive' }); return;
    }
    setResetting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reset-student-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ userId: resetStudent.user_id, newPassword: newPw }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error || 'Failed');
      toast({ title: 'Password reset', description: `${resetStudent.name}'s credentials updated.` });
      setResetStudent(null); setNewPw(''); setConfirmPw('');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setResetting(false);
    }
  };

  const toggleActive = async (s: Student) => {
    const { error } = await supabase.from('profiles').update({ is_active: !s.is_active }).eq('user_id', s.user_id);
    if (!error) { toast({ title: s.is_active ? 'Account deactivated' : 'Account activated' }); fetchStudents(); }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <TooltipProvider delayDuration={300}>
    <div className="space-y-8 animate-in fade-in duration-700">

      {/* ── Stats bento ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: 'group',      label: 'Total Delegates', value: totalStudents,  sub: 'across all chapters',  color: 'text-primary',                 bg: 'bg-primary/8' },
          { icon: 'location_city', label: 'Chapters',     value: totalCities,    sub: 'active cities',        color: 'text-secondary',               bg: 'bg-secondary/8' },
          { icon: 'sensors',    label: 'In Session',      value: activeSessions, sub: 'currently online',     color: 'text-on-tertiary-fixed-variant',bg: 'bg-tertiary-fixed/20' },
          { icon: 'how_to_reg', label: 'Active Accounts', value: activeAccounts, sub: 'enabled accounts',     color: 'text-on-surface',              bg: 'bg-surface-container' },
        ].map(c => (
          <div key={c.label} className="bg-surface-container-lowest p-6 rounded-[2rem] shadow-[0_4px_32px_0_rgba(19,41,143,0.06)] border border-outline-variant/10 flex flex-col justify-between">
            <div className={`w-10 h-10 ${c.bg} rounded-2xl flex items-center justify-center mb-4`}>
              <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1", color: 'inherit' }}>{c.icon}</span>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60 font-headline">{c.label}</p>
              <p className={`text-4xl font-extrabold font-headline mt-1 ${c.color}`}>{c.value}</p>
              <p className="text-xs text-on-surface-variant font-body mt-0.5">{c.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Region breakdown (5 regions) ── */}
      <div className="bg-surface-container-lowest rounded-[2rem] shadow-[0_4px_32px_0_rgba(19,41,143,0.06)] border border-outline-variant/10 overflow-hidden">
        <div className="px-8 py-5 border-b border-surface-variant/30 flex items-center gap-3">
          <span className="material-symbols-outlined text-[20px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>public</span>
          <div>
            <p className="font-headline font-extrabold text-on-surface">Region Breakdown</p>
            <p className="text-xs text-on-surface-variant font-body mt-0.5">Delegates across 5 national regions — click a region to filter</p>
          </div>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {regionGroups.map(([region, members]) => {
              const cfg = REGION_CONFIG[region] || { icon: 'place', color: 'text-on-surface', bg: 'bg-surface-container' };
              const pct = totalStudents > 0 ? Math.round((members.length / totalStudents) * 100) : 0;
              const live = members.filter(m => m.session_id).length;
              const isActive = regionFilter === region;
              return (
                <button
                  key={region}
                  type="button"
                  onClick={() => { setRegionFilter(isActive ? '' : region); setCityFilter(''); }}
                  className={`text-left p-4 rounded-2xl border transition-all ${
                    isActive
                      ? 'bg-primary/8 border-primary/20 shadow-[0_2px_8px_rgba(19,41,143,0.12)]'
                      : 'bg-surface-container border-transparent hover:bg-surface-container-high hover:border-outline-variant/20'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isActive ? 'bg-primary/15' : cfg.bg}`}>
                      <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1", color: 'inherit' }}>{cfg.icon}</span>
                    </div>
                    <span className={`text-2xl font-headline font-extrabold ${isActive ? 'text-primary' : 'text-on-surface'}`}>{members.length}</span>
                  </div>
                  <p className={`font-headline font-extrabold text-sm ${isActive ? 'text-primary' : 'text-on-surface'}`}>{region}</p>
                  {live > 0 && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-tertiary-fixed-dim" />
                      <span className="text-[10px] text-on-surface-variant font-body">{live} online</span>
                    </div>
                  )}
                  <div className="w-full h-1.5 bg-surface-container-high rounded-full overflow-hidden mt-2">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${isActive ? 'bg-primary' : 'bg-primary/40'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-on-surface-variant font-body mt-1">{pct}% of total</p>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Chapter breakdown ── */}
      <div className="bg-surface-container-lowest rounded-[2rem] shadow-[0_4px_32px_0_rgba(19,41,143,0.06)] border border-outline-variant/10 overflow-hidden">
        <div className="px-8 py-5 border-b border-surface-variant/30 flex items-center gap-3">
          <span className="material-symbols-outlined text-[20px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>map</span>
          <div>
            <p className="font-headline font-extrabold text-on-surface">Chapter Breakdown</p>
            <p className="text-xs text-on-surface-variant font-body mt-0.5">
              {regionFilter ? `Cities in ${regionFilter} region — click to filter table` : 'All chapters by city — click to filter table'}
            </p>
          </div>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {cityGroups.map(([city, members]) => {
              const pct = totalStudents > 0 ? Math.round((members.length / totalStudents) * 100) : 0;
              const live = members.filter(m => m.session_id).length;
              const isActive = cityFilter.toLowerCase() === city.toLowerCase();
              return (
                <button
                  key={city}
                  type="button"
                  onClick={() => setCityFilter(isActive ? '' : city)}
                  className={`text-left p-4 rounded-2xl border transition-all ${
                    isActive
                      ? 'bg-primary/8 border-primary/20 shadow-[0_2px_8px_rgba(19,41,143,0.12)]'
                      : 'bg-surface-container border-transparent hover:bg-surface-container-high hover:border-outline-variant/20'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className={`font-headline font-extrabold text-sm ${isActive ? 'text-primary' : 'text-on-surface'}`}>{city}</p>
                      {live > 0 && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-tertiary-fixed-dim" />
                          <span className="text-[10px] text-on-surface-variant font-body">{live} online</span>
                        </div>
                      )}
                    </div>
                    <span className={`text-2xl font-headline font-extrabold ${isActive ? 'text-primary' : 'text-on-surface'}`}>{members.length}</span>
                  </div>
                  <div className="w-full h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${isActive ? 'bg-primary' : 'bg-primary/40'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-on-surface-variant font-body mt-1">{pct}% of total</p>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Student table ── */}
      <div className="bg-surface-container-lowest rounded-[2rem] shadow-[0_4px_32px_0_rgba(19,41,143,0.06)] border border-outline-variant/10 overflow-hidden">
        {/* Table toolbar */}
        <div className="px-8 py-5 border-b border-surface-variant/30 flex flex-col gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline text-[18px]">search</span>
              <input
                type="text"
                placeholder="Search name, city, constituency…"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-surface-container rounded-xl pl-10 pr-4 py-2.5 text-sm font-body border-0 outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
            <p className="text-sm text-on-surface-variant font-body shrink-0">
              <span className="font-bold text-on-surface">{filtered.length}</span> of {totalStudents}
            </p>
            {(searchTerm || cityFilter || regionFilter || roleFilter !== 'all') && (
              <button onClick={() => { setSearchTerm(''); setCityFilter(''); setRegionFilter(''); setRoleFilter('all'); }} className="text-xs font-bold text-primary hover:underline font-headline shrink-0 flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">close</span>Clear
              </button>
            )}
          </div>

          {/* Region chips */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant/50 font-headline">Region</span>
            {['', 'North', 'South', 'East', 'West', 'Northeast'].map(r => (
              <button
                key={r || 'all'}
                onClick={() => { setRegionFilter(r); setCityFilter(''); }}
                className={`flex items-center gap-1 py-1 px-2.5 rounded-full text-[11px] font-bold transition-all font-body ${
                  regionFilter === r
                    ? 'bg-primary text-on-primary shadow-[0_2px_8px_rgba(19,41,143,0.22)]'
                    : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                {r || 'All'}
              </button>
            ))}
          </div>

          {/* Role chips */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant/50 font-headline">Role</span>
            {([
              { v: 'all', label: 'All', icon: 'groups' },
              { v: 'speaker', label: 'Speaker', icon: 'gavel' },
              { v: 'deputy_speaker', label: 'Dy. Speaker', icon: 'supervised_user_circle' },
              { v: 'minister', label: 'Minister', icon: 'account_balance' },
              { v: 'mp', label: 'MP', icon: 'how_to_reg' },
              { v: 'journalist', label: 'Journalist', icon: 'newspaper' },
              { v: 'administrator', label: 'Admin', icon: 'admin_panel_settings' },
            ]).map(opt => (
              <button
                key={opt.v}
                onClick={() => setRoleFilter(opt.v)}
                className={`flex items-center gap-1.5 py-1.5 px-3 rounded-full text-[11px] font-bold transition-all font-body ${
                  roleFilter === opt.v
                    ? 'bg-primary text-on-primary shadow-[0_2px_8px_rgba(19,41,143,0.22)]'
                    : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>{opt.icon}</span>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface-container/30 border-b border-surface-variant/30">
                {['Delegate', 'ID', 'Role', 'City / Chapter', 'Constituency', 'State', 'Status', 'Actions'].map(h => (
                  <th key={h} className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60 font-headline whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-variant/20">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <span className="material-symbols-outlined text-[48px] text-outline/30 block mb-3">group_off</span>
                    <p className="text-sm text-on-surface-variant/50 font-body">No delegates match your filters.</p>
                  </td>
                </tr>
              ) : paginated.map(s => {
                const initials = s.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                return (
                  <tr key={s.id} className="group hover:bg-surface-container/20 transition-colors">
                    {/* Delegate */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="relative shrink-0">
                          <Avatar className="w-9 h-9 rounded-xl">
                            <AvatarImage src={s.photo_url} alt={s.name} className="object-cover" />
                            <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-black rounded-xl font-headline">{initials}</AvatarFallback>
                          </Avatar>
                          <div className={`absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-surface-container-lowest ${s.session_id ? 'bg-tertiary-fixed-dim' : 'bg-outline/40'}`} />
                        </div>
                        <p className="font-headline font-bold text-sm text-on-surface">{s.name}</p>
                      </div>
                    </td>
                    {/* ID */}
                    <td className="px-6 py-4">
                      <span className="font-mono text-xs font-bold text-primary bg-primary/8 px-2.5 py-1 rounded-lg">#{s.serial_number.toString().padStart(3, '0')}</span>
                    </td>
                    {/* Role */}
                    <td className="px-6 py-4">{roleChip(s.position)}</td>
                    {/* City */}
                    <td className="px-6 py-4">
                      <button
                        onClick={() => setCityFilter(cityFilter === s.city ? '' : (s.city || ''))}
                        className="flex items-center gap-1.5 text-sm font-bold text-on-surface hover:text-primary transition-colors font-headline"
                      >
                        <span className="material-symbols-outlined text-[14px] text-outline/50" style={{ fontVariationSettings: "'FILL' 1" }}>location_city</span>
                        {s.city || '—'}
                      </button>
                    </td>
                    {/* Constituency */}
                    <td className="px-6 py-4 text-sm text-on-surface-variant font-body max-w-[140px] truncate">{s.constituency || '—'}</td>
                    {/* State */}
                    <td className="px-6 py-4 text-sm text-on-surface-variant font-body whitespace-nowrap">{s.state || '—'}</td>
                    {/* Status */}
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold font-body ${
                        s.session_id ? 'bg-tertiary-fixed/20 text-on-tertiary-fixed-variant' : s.is_active ? 'bg-surface-container text-on-surface-variant' : 'bg-error/10 text-error'
                      }`}>
                        {s.session_id ? 'Online' : s.is_active ? 'Offline' : 'Deactivated'}
                      </span>
                    </td>
                    {/* Actions */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button onClick={() => setViewingStudent(s)} className="p-1.5 text-primary rounded-lg hover:bg-primary/8 transition-colors">
                              <span className="material-symbols-outlined text-[18px]">visibility</span>
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>View profile</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button onClick={() => setResetStudent(s)} className="p-1.5 text-on-surface-variant hover:text-error rounded-lg hover:bg-error/5 transition-colors">
                              <span className="material-symbols-outlined text-[18px]">lock_reset</span>
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Reset password</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button onClick={() => toggleActive(s)} className={`p-1.5 rounded-lg transition-colors ${s.is_active ? 'text-on-surface-variant hover:text-error hover:bg-error/5' : 'text-tertiary-fixed-dim hover:bg-tertiary-fixed/10'}`}>
                              <span className="material-symbols-outlined text-[18px]">{s.is_active ? 'block' : 'check_circle'}</span>
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>{s.is_active ? 'Deactivate' : 'Activate'}</TooltipContent>
                        </Tooltip>
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
          <div className="px-8 py-5 border-t border-surface-variant/30 flex items-center justify-between">
            <p className="text-sm text-on-surface-variant font-body">
              Showing <span className="font-bold text-on-surface">{Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, filtered.length)}–{Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)}</span> of <span className="font-bold text-on-surface">{filtered.length}</span>
            </p>
            <div className="flex items-center gap-1">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                className="size-8 rounded-lg border border-outline-variant/30 flex items-center justify-center text-on-surface-variant hover:border-primary/20 hover:text-primary disabled:opacity-30 transition-all">
                <span className="material-symbols-outlined text-[16px]">chevron_left</span>
              </button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                let p = totalPages <= 7 ? i + 1 : currentPage <= 4 ? i + 1 : currentPage >= totalPages - 3 ? totalPages - 6 + i : currentPage - 3 + i;
                return (
                  <button key={p} onClick={() => setCurrentPage(p)}
                    className={`size-8 rounded-lg text-xs font-black font-headline transition-all ${currentPage === p ? 'bg-primary text-on-primary' : 'border border-outline-variant/30 text-on-surface-variant hover:border-primary/20 hover:text-primary'}`}>
                    {p}
                  </button>
                );
              })}
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                className="size-8 rounded-lg border border-outline-variant/30 flex items-center justify-center text-on-surface-variant hover:border-primary/20 hover:text-primary disabled:opacity-30 transition-all">
                <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── View Profile dialog ── */}
      <Dialog open={!!viewingStudent} onOpenChange={o => { if (!o) setViewingStudent(null); }}>
        <DialogContent className="rounded-[2.5rem] border-none shadow-2xl bg-surface-container-lowest max-w-md overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-primary to-primary-container rounded-t-[2.5rem]" />
          {viewingStudent && (() => {
            const initials = viewingStudent.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
            const fields = [
              { icon: 'badge',          label: 'Role',         value: viewingStudent.position || '—' },
              { icon: 'groups',         label: 'Party',        value: partyLabel(viewingStudent.party_number, viewingStudent.party_name) },
              { icon: 'account_balance',label: 'Committee',    value: viewingStudent.committee || '—' },
              { icon: 'location_on',    label: 'Constituency', value: viewingStudent.constituency || '—' },
              { icon: 'location_city',  label: 'City',         value: viewingStudent.city || '—' },
              { icon: 'map',            label: 'State',        value: viewingStudent.state || '—' },
            ];
            return (
              <div className="pt-6">
                <div className="flex flex-col items-center gap-3 mb-6">
                  <Avatar className="w-20 h-20 rounded-2xl ring-4 ring-surface-container">
                    <AvatarImage src={viewingStudent.photo_url} alt={viewingStudent.name} className="object-cover" />
                    <AvatarFallback className="bg-primary/10 text-primary text-xl font-black rounded-2xl font-headline">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="text-center">
                    <h2 className="text-2xl font-black text-on-surface font-headline">{viewingStudent.name}</h2>
                    <div className="flex items-center justify-center gap-2 mt-1.5">
                      <span className="font-mono text-xs font-bold text-primary bg-primary/8 px-2.5 py-1 rounded-lg">#{viewingStudent.serial_number.toString().padStart(3, '0')}</span>
                      {roleChip(viewingStudent.position)}
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold font-body ${viewingStudent.session_id ? 'bg-tertiary-fixed/20 text-on-tertiary-fixed-variant' : 'bg-surface-container text-on-surface-variant'}`}>
                        {viewingStudent.session_id ? 'Online' : 'Offline'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2.5 mb-6">
                  {fields.map(f => (
                    <div key={f.label} className="bg-surface-container rounded-2xl p-3.5">
                      <p className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant/60 font-body flex items-center gap-1 mb-1">
                        <span className="material-symbols-outlined text-[11px]" style={{ fontVariationSettings: "'FILL' 1" }}>{f.icon}</span>
                        {f.label}
                      </p>
                      <p className="text-sm font-bold text-on-surface font-body truncate">{f.value}</p>
                    </div>
                  ))}
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setViewingStudent(null)} className="flex-1 py-3.5 text-[10px] font-black uppercase tracking-widest text-on-surface-variant font-body">Close</button>
                  <button
                    onClick={() => { setViewingStudent(null); setResetStudent(viewingStudent); }}
                    className="flex-1 py-3.5 bg-gradient-to-r from-primary to-primary-container text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-[0_8px_24px_rgba(19,41,143,0.25)] hover:scale-[1.02] active:scale-95 transition-all font-body"
                  >
                    Reset Password
                  </button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ── Password reset dialog ── */}
      <Dialog open={!!resetStudent} onOpenChange={o => { if (!o) { setResetStudent(null); setNewPw(''); setConfirmPw(''); } }}>
        <DialogContent className="rounded-[2.5rem] border-none shadow-2xl bg-surface-container-lowest overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-primary to-primary-container rounded-t-[2.5rem]" />
          <DialogHeader className="pt-4">
            <DialogTitle className="text-2xl font-black tracking-tight text-on-surface flex items-center gap-3 font-headline">
              <div className="w-10 h-10 bg-secondary-fixed/30 rounded-xl flex items-center justify-center text-secondary">
                <KeyRound className="w-5 h-5" />
              </div>
              Reset Credentials
            </DialogTitle>
            <DialogDescription className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest font-body">
              Updating password for {resetStudent?.name}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleReset} className="space-y-4 mt-2">
            <div className="space-y-1">
              <label className="text-[9px] font-black text-on-surface-variant uppercase tracking-widest ml-1 font-body">New Password</label>
              <div className="relative">
                <Input type={showPw ? 'text' : 'password'} value={newPw} onChange={e => setNewPw(e.target.value)}
                  placeholder="Min 6 characters" className="h-14 bg-surface-container border-none rounded-2xl font-bold px-5 focus:ring-2 focus:ring-primary/20" />
                <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black text-on-surface-variant uppercase tracking-widest ml-1 font-body">Confirm Password</label>
              <div className="relative">
                <Input type={showConfirm ? 'text' : 'password'} value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
                  placeholder="Repeat password" className="h-14 bg-surface-container border-none rounded-2xl font-bold px-5 focus:ring-2 focus:ring-primary/20" />
                <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant">
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setResetStudent(null)} className="flex-1 py-4 text-[10px] font-black uppercase tracking-widest text-on-surface-variant font-body">Cancel</button>
              <button type="submit" disabled={resetting}
                className="flex-1 py-4 bg-gradient-to-r from-primary to-primary-container text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-[0_8px_24px_rgba(19,41,143,0.25)] hover:scale-[1.02] active:scale-95 transition-all font-body">
                {resetting ? 'Updating…' : 'Authorize Reset'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

    </div>
    </TooltipProvider>
  );
};
