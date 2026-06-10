import { useAuth } from '@/hooks/useAuth';
import { JuryStudentList } from "@/components/jury/JuryStudentList";
import { ProfilePhotoUploader } from "@/components/jury/ProfilePhotoUploader";
import { JuryProfileEditor } from "@/components/jury/JuryProfileEditor";
import { BreakingNewsTicker } from "@/components/display/BreakingNewsTicker";
import { AwardIntelligenceDashboard } from "@/components/shared/AwardIntelligenceDashboard";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type TabId = 'dashboard' | 'assessment' | 'awards' | 'profile';

const navItems: { id: TabId; label: string; icon: string }[] = [
  { id: 'dashboard',  label: 'Dashboard',  icon: 'dashboard' },
  { id: 'assessment', label: 'Assessment', icon: 'rate_review' },
  { id: 'awards',     label: 'Awards',     icon: 'emoji_events' },
  { id: 'profile',    label: 'Profile',    icon: 'person' },
];

// SVG ring circumferences
const SMALL_C = 2 * Math.PI * 20;  // r=20 hero ring
const LARGE_C = 2 * Math.PI * 56;  // r=56 analytics ring

const JuryDashboard = () => {
  const { user, profile, signOut } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [assessmentStats, setAssessmentStats] = useState({ totalStudents: 0, assessedStudents: 0 });
  const [avgScore, setAvgScore] = useState<number | null>(null);
  const [isRealTimeConnected, setIsRealTimeConnected] = useState(false);
  const [topPerformers, setTopPerformers] = useState<{ user_id: string; name: string; position: string; average_score: number; party_number: number }[]>([]);
  const [juryDirectory, setJuryDirectory] = useState<{ user_id: string; name: string; position?: string }[]>([]);
  const [selectedJuryMemberId, setSelectedJuryMemberId] = useState<string | null>(null);
  const [directoryMemberProfile, setDirectoryMemberProfile] = useState<any | null>(null);
  const [loadingDirectoryMember, setLoadingDirectoryMember] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwLoading, setPwLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetchAssessmentStats();
    fetchTopPerformers();
    fetchJuryDirectory();

    const channel = supabase
      .channel('jury-assessment-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assessments', filter: `jury_id=eq.${user.id}` }, () => {
        fetchAssessmentStats();
        fetchTopPerformers();
      })
      .subscribe((status) => { if (status === 'SUBSCRIBED') setIsRealTimeConnected(true); });

    const profileChannel = supabase
      .channel('jury-student-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `user_type=eq.student` }, () => fetchAssessmentStats())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(profileChannel);
    };
  }, [user]);

  const fetchAssessmentStats = async () => {
    try {
      const [{ data: students }, { data: assessments }] = await Promise.all([
        supabase.from('profiles').select('id').eq('user_type', 'student')
          .neq('position', 'Admin Student').neq('position', 'Journalist'),
        supabase.from('assessments').select('student_id, total_score')
          .eq('jury_id', user?.id).eq('status', 'submitted'),
      ]);

      // Count unique students assessed (not sessions)
      const uniqueAssessed = new Set(assessments?.map(a => a.student_id) || []).size;
      setAssessmentStats({ totalStudents: students?.length || 0, assessedStudents: uniqueAssessed });

      // Avg: per-student average across sessions, then overall average
      if (assessments?.length) {
        const byStudent: Record<string, number[]> = {};
        assessments.forEach(a => {
          if (!byStudent[a.student_id]) byStudent[a.student_id] = [];
          byStudent[a.student_id].push(a.total_score || 0);
        });
        const studentAvgs = Object.values(byStudent).map(s => s.reduce((a, b) => a + b, 0) / s.length);
        setAvgScore(Math.round(studentAvgs.reduce((a, b) => a + b, 0) / studentAvgs.length));
      } else {
        setAvgScore(null);
      }
    } catch (err) { console.error('Assessment stats error:', err); }
  };

  const fetchJuryDirectory = async () => {
    try {
      const { data, error } = await supabase.rpc('get_jury_directory');
      if (error) throw error;
      setJuryDirectory(data || []);
    } catch (err) { console.error('Jury directory error:', err); }
  };

  const fetchTopPerformers = async () => {
    try {
      const { data, error } = await supabase
        .from('jury_leaderboard')
        .select('user_id, name, position, average_score, party_number')
        .order('average_score', { ascending: false })
        .limit(5);
      if (error) throw error;
      setTopPerformers(data || []);
    } catch (err) { console.error('Top performers error:', err); }
  };

  const progressPct = assessmentStats.totalStudents > 0
    ? Math.round((assessmentStats.assessedStudents / assessmentStats.totalStudents) * 100)
    : 0;
  const smallOffset = SMALL_C * (1 - progressPct / 100);
  const largeOffset  = LARGE_C  * (1 - progressPct / 100);
  const firstName = profile?.name?.split(' ')[0] || 'Evaluator';
  const initials  = profile?.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || 'JU';

  const handleExport = (type: 'CSV' | 'PDF') =>
    toast({ title: `Export ${type}`, description: 'Export functionality coming soon.' });

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwForm.next !== pwForm.confirm) {
      toast({ title: 'Passwords do not match', variant: 'destructive' }); return;
    }
    if (pwForm.next.length < 6) {
      toast({ title: 'Password must be at least 6 characters', variant: 'destructive' }); return;
    }
    setPwLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pwForm.next });
      if (error) throw error;
      toast({ title: 'Password updated successfully' });
      setShowChangePassword(false);
      setPwForm({ current: '', next: '', confirm: '' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to update password', variant: 'destructive' });
    } finally { setPwLoading(false); }
  };

  const handleDirectoryMemberClick = async (memberId: string) => {
    if (memberId === user?.id) return;
    if (selectedJuryMemberId === memberId) {
      setSelectedJuryMemberId(null);
      setDirectoryMemberProfile(null);
      return;
    }
    setSelectedJuryMemberId(memberId);
    setDirectoryMemberProfile(null);
    setLoadingDirectoryMember(true);
    try {
      const { data } = await supabase.from('profiles').select('*').eq('user_id', memberId).single();
      setDirectoryMemberProfile(data || null);
    } catch {}
    finally { setLoadingDirectoryMember(false); }
  };

  const photoSrc = (url: string) =>
    url.includes('/file/d/')
      ? `https://drive.google.com/uc?export=view&id=${url.split('/d/')[1]?.split('/')[0]}`
      : url;

  return (
    <div className="min-h-screen bg-[#F3F4F6] font-body text-on-surface antialiased">
      <BreakingNewsTicker />

      {/* ── Sidebar ── */}
      <aside className="hidden md:flex fixed left-0 top-0 h-screen w-64 flex-col bg-surface-container-lowest border-r border-outline-variant/10 z-30 py-6 px-4">
        <div className="mb-8 px-2">
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-7 h-7 bg-gradient-to-br from-primary to-primary-container rounded-lg flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[14px] text-on-primary" style={{ fontVariationSettings: "'FILL' 1" }}>gavel</span>
            </div>
            <span className="font-headline font-bold text-on-surface text-base leading-tight">Jury Portal</span>
          </div>
          <p className="font-body text-on-surface-variant text-xs font-medium ml-9">Young Indians Parliament</p>
        </div>

        <nav className="flex-1 space-y-1">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-left ${
                activeTab === item.id
                  ? 'text-primary font-bold bg-primary/5 border-r-4 border-primary'
                  : 'text-on-surface-variant hover:bg-surface-container font-medium'
              }`}
            >
              <span
                className="material-symbols-outlined text-[20px] shrink-0"
                style={activeTab === item.id ? { fontVariationSettings: "'FILL' 1" } : undefined}
              >
                {item.icon}
              </span>
              <span className="font-body text-sm whitespace-nowrap">{item.label}</span>
            </button>
          ))}
        </nav>

        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-error hover:bg-error/10 transition-colors font-medium mt-2"
        >
          <span className="material-symbols-outlined text-[20px] shrink-0">logout</span>
          <span className="font-body text-sm">Sign Out</span>
        </button>
      </aside>

      {/* ── Mobile bottom bar ── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 h-16 bg-surface-container-lowest border-t border-outline-variant/10 z-30 flex items-center justify-around px-2">
        {navItems.map(item => (
          <button key={item.id} onClick={() => setActiveTab(item.id)} className="flex flex-col items-center gap-0.5 flex-1 py-2">
            <span
              className={`material-symbols-outlined text-[22px] ${activeTab === item.id ? 'text-primary' : 'text-on-surface-variant'}`}
              style={activeTab === item.id ? { fontVariationSettings: "'FILL' 1" } : undefined}
            >
              {item.icon}
            </span>
            <span className={`text-[9px] font-black uppercase tracking-wider font-body ${activeTab === item.id ? 'text-primary' : 'text-on-surface-variant'}`}>
              {item.label}
            </span>
          </button>
        ))}
        <button onClick={signOut} className="flex flex-col items-center gap-0.5 flex-1 py-2">
          <span className="material-symbols-outlined text-[22px] text-error">logout</span>
          <span className="text-[9px] font-black uppercase tracking-wider font-body text-error">Exit</span>
        </button>
      </nav>

      {/* ── Main ── */}
      <main className="md:ml-64 min-h-screen pb-20 md:pb-0">

        {/* ── Dashboard tab ── */}
        {activeTab === 'dashboard' && (
          <div className="px-8 lg:px-12 py-8 pb-12">

            {/* Page heading + progress card */}
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-10">
              <header>
                <h1 className="text-4xl font-extrabold font-headline tracking-tight text-primary">
                  Jury <span className="text-secondary">Assessment</span>
                </h1>
                <p className="text-[10px] text-on-surface-variant/40 font-black uppercase tracking-[0.4em] mt-3 flex items-center gap-2 font-headline">
                  <span className="material-symbols-outlined text-[12px]">gavel</span>
                  Secured Evaluation Environment
                </p>
              </header>

              {/* Overall Progress card */}
              <div className="bg-surface-container-lowest rounded-[1.75rem] shadow-[0_4px_24px_-4px_rgba(19,41,143,0.08)] flex items-center gap-4 px-5 py-4 shrink-0">
                <div className="text-right">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60 font-body">Overall Progress</div>
                  <div className="text-2xl font-bold text-on-surface font-headline">
                    {assessmentStats.assessedStudents}
                    <span className="text-sm font-normal text-on-surface-variant"> / {assessmentStats.totalStudents}</span>
                  </div>
                  <div className="text-[10px] font-bold text-on-surface-variant/50 font-body">{progressPct}% COMPLETE</div>
                </div>
                <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 48 48">
                    <circle cx="24" cy="24" r="20" fill="transparent" stroke="#e6e8ea" strokeWidth="4" />
                    <circle
                      cx="24" cy="24" r="20" fill="transparent"
                      stroke="#13298f" strokeWidth="4"
                      strokeDasharray={SMALL_C}
                      strokeDashoffset={smallOffset}
                      strokeLinecap="round"
                      className="transition-all duration-1000"
                    />
                  </svg>
                  <span className="absolute text-[10px] font-bold text-on-surface">{progressPct}%</span>
                </div>
              </div>
            </div>

            {/* Metric cards */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
              <div className="bg-surface-container-lowest rounded-[1.75rem] shadow-[0_4px_24px_-4px_rgba(19,41,143,0.08)] p-6 flex items-center gap-5">
                <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>group</span>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-wider font-body">Total Students</p>
                  <h3 className="text-2xl font-bold text-on-surface font-headline">
                    {String(assessmentStats.totalStudents).padStart(2, '0')}
                  </h3>
                </div>
              </div>

              <div className="bg-surface-container-lowest rounded-[1.75rem] shadow-[0_4px_24px_-4px_rgba(19,41,143,0.08)] border-l-4 border-l-[#42d59a] p-6 flex items-center gap-5">
                <div className="w-12 h-12 bg-tertiary/10 text-tertiary-container rounded-xl flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>task_alt</span>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-wider font-body">Assessed</p>
                  <h3 className="text-2xl font-bold text-on-surface font-headline">
                    {String(assessmentStats.assessedStudents).padStart(2, '0')}
                  </h3>
                </div>
              </div>

              <div className="bg-surface-container-lowest rounded-[1.75rem] shadow-[0_4px_24px_-4px_rgba(19,41,143,0.08)] border-l-4 border-l-outline-variant p-6 flex items-center gap-5">
                <div className="w-12 h-12 bg-surface-container text-on-surface-variant rounded-xl flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[22px]">schedule</span>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-wider font-body">Remaining</p>
                  <h3 className="text-2xl font-bold text-on-surface font-headline">
                    {String(assessmentStats.totalStudents - assessmentStats.assessedStudents).padStart(2, '0')}
                  </h3>
                </div>
              </div>
            </section>

            {/* Analytics section */}
            <section className="mb-8">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-1.5 h-6 bg-primary rounded-full" />
                <h4 className="text-base font-bold text-on-surface font-headline">Assessment Analytics</h4>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
                {/* Large ring */}
                <div className="bg-surface-container-lowest rounded-[1.75rem] shadow-[0_4px_24px_-4px_rgba(19,41,143,0.06)] p-6 flex flex-col items-center justify-center">
                  <div className="relative w-32 h-32 mb-4">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 128 128">
                      <circle cx="64" cy="64" r="56" fill="transparent" stroke="#e6e8ea" strokeWidth="8" />
                      <circle
                        cx="64" cy="64" r="56" fill="transparent"
                        stroke="#13298f" strokeWidth="8"
                        strokeDasharray={LARGE_C}
                        strokeDashoffset={largeOffset}
                        strokeLinecap="round"
                        className="transition-all duration-1000"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl font-bold text-on-surface font-headline">{progressPct}%</span>
                      <span className="text-[10px] uppercase font-bold text-on-surface-variant font-body">Complete</span>
                    </div>
                  </div>
                  <p className="text-xs font-semibold text-on-surface-variant font-body">Global Progress</p>
                </div>

                {/* Stat cards */}
                <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Evaluated */}
                  <div className="bg-surface-container-lowest rounded-[1.75rem] shadow-[0_4px_24px_-4px_rgba(19,41,143,0.06)] p-5">
                    <div className="flex justify-between items-start mb-4">
                      <span className="p-2 bg-primary/10 text-primary rounded-lg">
                        <span className="material-symbols-outlined text-[18px]">donut_large</span>
                      </span>
                      <span className="text-[10px] font-bold text-on-surface-variant/60 uppercase font-body">Evaluated</span>
                    </div>
                    <div className="text-2xl font-bold font-headline text-on-surface">
                      {assessmentStats.assessedStudents}
                      <span className="text-sm font-medium text-on-surface-variant"> / {assessmentStats.totalStudents}</span>
                    </div>
                    <div className="mt-4 w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden">
                      <div className="bg-primary h-full rounded-full transition-all duration-700" style={{ width: `${progressPct}%` }} />
                    </div>
                  </div>

                  {/* Pending */}
                  <div className="bg-surface-container-lowest rounded-[1.75rem] shadow-[0_4px_24px_-4px_rgba(19,41,143,0.06)] p-5">
                    <div className="flex justify-between items-start mb-4">
                      <span className="p-2 bg-outline-variant/20 text-on-surface-variant rounded-lg">
                        <span className="material-symbols-outlined text-[18px]">schedule</span>
                      </span>
                      <span className="text-[10px] font-bold text-on-surface-variant/60 uppercase font-body">Pending</span>
                    </div>
                    <div className="text-2xl font-bold font-headline text-on-surface">
                      {assessmentStats.totalStudents - assessmentStats.assessedStudents}
                      <span className="text-sm font-medium text-on-surface-variant"> / {assessmentStats.totalStudents}</span>
                    </div>
                    <div className="mt-4 w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-outline-variant h-full rounded-full transition-all duration-700"
                        style={{ width: assessmentStats.totalStudents > 0 ? `${100 - progressPct}%` : '0%' }}
                      />
                    </div>
                  </div>

                  {/* Avg Score */}
                  <div className="bg-surface-container-lowest rounded-[1.75rem] shadow-[0_4px_24px_-4px_rgba(19,41,143,0.06)] p-5">
                    <div className="flex justify-between items-start mb-4">
                      <span className="p-2 bg-tertiary/10 text-tertiary-container rounded-lg">
                        <span className="material-symbols-outlined text-[18px]">trending_up</span>
                      </span>
                      <span className="text-[10px] font-bold text-on-surface-variant/60 uppercase font-body">Avg Score</span>
                    </div>
                    <div className="text-2xl font-bold font-headline text-on-surface">
                      {avgScore ?? 0}
                      <span className="text-sm font-medium text-on-surface-variant"> / 10</span>
                    </div>
                    <div className="mt-4">
                      <span className="text-[10px] text-on-surface-variant font-body">
                        {avgScore !== null ? 'Based on submitted scores' : 'No data collected yet'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Secondary sections */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Performers */}
              <div className="bg-surface-container-lowest rounded-[1.75rem] shadow-[0_4px_24px_-4px_rgba(19,41,143,0.06)] overflow-hidden flex flex-col">
                <div className="px-6 py-4 border-b border-outline-variant/10 flex items-center gap-3">
                  <div className="p-2 bg-tertiary-fixed/30 text-on-tertiary-fixed rounded-lg">
                    <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                  </div>
                  <h5 className="font-bold text-on-surface font-headline text-sm">Top Performers</h5>
                </div>
                <div className="flex-1 p-4">
                  {topPerformers.filter(p => (p.average_score ?? 0) > 0).length === 0 ? (
                    <div className="py-8 flex flex-col items-center justify-center text-center">
                      <div className="w-14 h-14 bg-surface-container rounded-full flex items-center justify-center mb-3">
                        <span className="material-symbols-outlined text-[28px] text-on-surface-variant/30">leaderboard</span>
                      </div>
                      <p className="text-xs font-bold text-on-surface-variant/50 font-body">
                        Leaderboard populates once scores are submitted
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {topPerformers.filter(p => (p.average_score ?? 0) > 0).map((p, i) => {
                        const rankColors = [
                          'bg-[#42d59a]/20 text-[#2bb87c]',
                          'bg-primary/10 text-primary',
                          'bg-outline-variant/30 text-on-surface-variant',
                        ];
                        const rankIcons = ['emoji_events', 'workspace_premium', 'military_tech'];
                        const initials = p.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                        return (
                          <div key={p.user_id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-container transition-colors">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${rankColors[i] ?? 'bg-surface-container text-on-surface-variant/50'}`}>
                              {i < 3
                                ? <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>{rankIcons[i]}</span>
                                : <span className="text-[11px] font-bold font-headline">{i + 1}</span>
                              }
                            </div>
                            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[11px] font-bold font-headline shrink-0">
                              {initials}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-headline font-bold text-on-surface text-sm truncate">{p.name}</div>
                              <div className="text-[10px] text-on-surface-variant/50 font-body truncate">{p.position}</div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="font-headline font-extrabold text-primary text-base leading-none">{p.average_score?.toFixed(1)}</div>
                              <div className="text-[9px] text-on-surface-variant/40 font-body">/ 10</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Export Data */}
              <div className="bg-surface-container-lowest rounded-[1.75rem] shadow-[0_4px_24px_-4px_rgba(19,41,143,0.06)] overflow-hidden flex flex-col">
                <div className="px-6 py-4 border-b border-outline-variant/10 flex items-center gap-3">
                  <div className="p-2 bg-primary/10 text-primary rounded-lg">
                    <span className="material-symbols-outlined text-[18px]">download</span>
                  </div>
                  <h5 className="font-bold text-on-surface font-headline text-sm">Export Data</h5>
                </div>
                <div className="p-8 flex flex-col justify-center flex-1">
                  <p className="text-sm text-on-surface-variant mb-6 font-body">
                    Download the current assessment state for your records.
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => handleExport('CSV')}
                      className="flex items-center justify-center gap-2 px-5 py-3 bg-surface-container text-on-surface font-bold text-sm rounded-full hover:bg-surface-container-high hover:scale-[1.02] transition-all font-body"
                    >
                      <span className="material-symbols-outlined text-[16px] text-tertiary-container">table_chart</span>
                      Export CSV
                    </button>
                    <button
                      onClick={() => handleExport('PDF')}
                      className="flex items-center justify-center gap-2 px-5 py-3 bg-primary/8 text-primary font-bold text-sm rounded-full hover:bg-primary/12 hover:scale-[1.02] transition-all font-body"
                    >
                      <span className="material-symbols-outlined text-[16px]">picture_as_pdf</span>
                      Export PDF
                    </button>
                  </div>
                </div>
              </div>
            </section>

          </div>
        )}

        {/* ── Assessment tab ── */}
        {activeTab === 'assessment' && (
          <div className="px-8 lg:px-12 py-8">
            <header className="mb-8">
              <h1 className="text-4xl font-extrabold font-headline tracking-tight text-primary">
                Student <span className="text-secondary">Assessment</span>
              </h1>
              <p className="text-[10px] text-on-surface-variant/40 font-black uppercase tracking-[0.4em] mt-3 flex items-center gap-2 font-headline">
                <span className="material-symbols-outlined text-[12px]">rate_review</span>
                Evaluate & score delegate performances
              </p>
            </header>
            <div className="bg-surface-container-lowest rounded-[2rem] shadow-[0_4px_24px_-4px_rgba(19,41,143,0.06)] p-6">
              {user && <JuryStudentList juryId={user.id} />}
            </div>
          </div>
        )}

        {/* ── Awards tab ── */}
        {activeTab === 'awards' && (
          <div className="px-8 lg:px-12 py-8">
            <AwardIntelligenceDashboard juryId={user?.id} />
          </div>
        )}

        {/* ── Profile tab ── */}
        {activeTab === 'profile' && (
          <div className="pb-12">

            {/* ── Hero Section ── */}
            <div className="px-8 lg:px-10 pt-8">
              {/* Gradient banner */}
              <div className="h-48 rounded-[2.5rem] w-full shadow-xl bg-gradient-to-r from-primary to-primary-container relative overflow-hidden">
                <div className="absolute -bottom-10 -right-10 w-56 h-56 rounded-full bg-white/5" />
                <div className="absolute top-6 left-1/3 w-36 h-36 rounded-full bg-white/[0.03]" />
              </div>

              {/* Floating info card — no edit button, no three dots */}
              <div className="mx-4 -mt-20 bg-surface-container-lowest rounded-[2rem] shadow-2xl shadow-[rgba(19,41,143,0.12)] flex flex-col md:flex-row items-end gap-6 p-8 relative z-10">
                {/* Large avatar */}
                <div className="relative -mt-24 group shrink-0">
                  <div className="w-36 h-36 rounded-[1.75rem] overflow-hidden border-4 border-surface-container-lowest shadow-[0_8px_32px_rgba(19,41,143,0.2)] bg-surface">
                    {profile?.photo_url
                      ? <img src={photoSrc(profile.photo_url)} alt={profile.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      : <div className="w-full h-full bg-primary-fixed flex items-center justify-center">
                          <span className="font-headline font-extrabold text-primary text-5xl">{initials}</span>
                        </div>
                    }
                  </div>
                  <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ProfilePhotoUploader />
                  </div>
                </div>

                {/* Name + role + pencil */}
                <div className="flex-grow flex flex-row justify-between items-end gap-4 mb-1">
                  <div>
                    <div className="flex items-center gap-3 mb-1.5 flex-wrap">
                      <h1 className="text-3xl font-headline font-extrabold tracking-tight text-on-surface">
                        {profile?.name || 'Jury Member'}
                      </h1>
                      <span className="px-3 py-1 bg-primary-container text-on-primary-container text-[10px] uppercase font-bold rounded-full tracking-wider font-body">
                        Jury Member
                      </span>
                    </div>
                    <p className="text-on-surface-variant font-body text-sm flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm">history_edu</span>
                      {profile?.position || 'Senior Parliamentary Evaluator'}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowEditProfile(true)}
                    title="Edit Profile"
                    className="w-11 h-11 bg-surface-container rounded-full flex items-center justify-center text-on-surface-variant hover:bg-primary hover:text-on-primary transition-all shadow-sm hover:shadow-[0_4px_12px_rgba(19,41,143,0.2)] shrink-0"
                  >
                    <span className="material-symbols-outlined text-[18px]">edit</span>
                  </button>
                </div>
              </div>
            </div>

            {/* ── Edit Profile Modal ── */}
            {showEditProfile && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                <div className="bg-surface-container-lowest rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden">
                  {/* Modal header */}
                  <div className="flex items-center justify-between px-7 pt-7 pb-5 border-b border-outline-variant/10">
                    <div>
                      <h2 className="font-headline font-extrabold text-xl text-on-surface">Edit Profile</h2>
                      <p className="text-xs text-on-surface-variant font-body mt-0.5">Update your photo, name and role</p>
                    </div>
                    <button
                      onClick={() => setShowEditProfile(false)}
                      className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center hover:bg-surface-container-high transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px] text-on-surface-variant">close</span>
                    </button>
                  </div>

                  {/* Photo upload section — avatar is the clickable trigger */}
                  <div className="px-7 pt-6 pb-5 border-b border-outline-variant/10 flex items-center gap-5">
                    <label className="relative group shrink-0 cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file || !user) return;
                          try {
                            const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
                            const path = `jury/${user.id}/${Date.now()}.${ext}`;
                            const { error: upErr } = await supabase.storage.from('student-photos').upload(path, file, { cacheControl: '3600', upsert: true, contentType: file.type });
                            if (upErr) throw upErr;
                            const { data: urlData } = supabase.storage.from('student-photos').getPublicUrl(path);
                            const { error: dbErr } = await supabase.from('profiles').update({ photo_url: urlData.publicUrl }).eq('user_id', user.id);
                            if (dbErr) throw dbErr;
                            toast({ title: 'Photo updated' });
                          } catch (err: any) { toast({ title: 'Upload failed', description: err?.message, variant: 'destructive' }); }
                          finally { e.target.value = ''; }
                        }}
                      />
                      <div className="w-20 h-20 rounded-2xl overflow-hidden bg-primary-fixed shadow-[0_4px_16px_rgba(19,41,143,0.15)]">
                        {profile?.photo_url
                          ? <img src={photoSrc(profile.photo_url)} alt={profile?.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          : <div className="w-full h-full flex items-center justify-center">
                              <span className="font-headline font-extrabold text-primary text-3xl">{initials}</span>
                            </div>
                        }
                      </div>
                      <div className="absolute inset-0 rounded-2xl bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="material-symbols-outlined text-white text-[22px]">photo_camera</span>
                      </div>
                    </label>
                    <div>
                      <p className="text-sm font-bold text-on-surface font-headline mb-0.5">Profile Photo</p>
                      <p className="text-xs text-on-surface-variant/60 font-body">Hover over the photo and click to change</p>
                    </div>
                  </div>

                  {/* Editor */}
                  <div className="px-7 py-6">
                    <JuryProfileEditor onSaved={() => setShowEditProfile(false)} />
                  </div>
                </div>
              </div>
            )}

            {/* ── Change Password Modal ── */}
            {showChangePassword && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                <div className="bg-surface-container-lowest rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden">
                  <div className="flex items-center justify-between px-7 pt-7 pb-5 border-b border-outline-variant/10">
                    <div>
                      <h2 className="font-headline font-extrabold text-xl text-on-surface">Change Password</h2>
                      <p className="text-xs text-on-surface-variant font-body mt-0.5">Choose a strong new password</p>
                    </div>
                    <button
                      onClick={() => { setShowChangePassword(false); setPwForm({ current: '', next: '', confirm: '' }); }}
                      className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center hover:bg-surface-container-high transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px] text-on-surface-variant">close</span>
                    </button>
                  </div>
                  <form onSubmit={handleChangePassword} className="px-7 py-6 space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase text-on-surface-variant/60 tracking-widest font-body">New Password</label>
                      <input
                        type="password"
                        value={pwForm.next}
                        onChange={e => setPwForm(p => ({ ...p, next: e.target.value }))}
                        placeholder="At least 6 characters"
                        required
                        className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm font-body outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase text-on-surface-variant/60 tracking-widest font-body">Confirm New Password</label>
                      <input
                        type="password"
                        value={pwForm.confirm}
                        onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))}
                        placeholder="Repeat new password"
                        required
                        className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm font-body outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                    <div className="flex justify-end pt-2">
                      <button
                        type="submit"
                        disabled={pwLoading}
                        className="px-6 py-2.5 bg-primary text-on-primary rounded-full font-bold text-sm font-body shadow-[0_4px_12px_rgba(19,41,143,0.25)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center gap-2"
                      >
                        {pwLoading && <span className="w-3.5 h-3.5 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />}
                        {pwLoading ? 'Updating…' : 'Update Password'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* ── Stats Bar ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5 px-12 lg:px-14 mt-8">
              {[
                { icon: 'groups',        color: 'bg-primary/10 text-primary',      label: 'Students Assessed', value: `${assessmentStats.assessedStudents} of ${assessmentStats.totalStudents}` },
                { icon: 'analytics',     color: 'bg-secondary/10 text-secondary',  label: 'Completion Rate',   value: `${progressPct}%` },
                { icon: 'task_alt',      color: 'bg-[#42d59a]/10 text-[#42d59a]', label: 'Status',            value: 'Live', pulse: true },
                { icon: 'verified_user', color: 'bg-outline/10 text-outline',      label: 'Access Tier',       value: 'Full' },
              ].map(tile => (
                <div key={tile.label} className="bg-surface-container-lowest p-5 rounded-[1.75rem] shadow-sm border border-outline-variant/10 flex items-center gap-4 hover:-translate-y-1 transition-transform duration-300">
                  <div className={`p-3 ${tile.color} rounded-xl shrink-0`}>
                    <span className="material-symbols-outlined">{tile.icon}</span>
                  </div>
                  <div>
                    <p className="text-xs text-on-surface-variant font-bold uppercase tracking-tighter font-body">{tile.label}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {tile.pulse && <div className="w-2 h-2 rounded-full bg-[#4edea3] animate-pulse shrink-0" />}
                      <p className="text-xl font-headline font-black text-on-surface leading-none">{tile.value}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Details Grid ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 px-12 lg:px-14 mt-10">

              {/* ── LEFT: profile details + jury directory (col-span-2) ── */}
              <div className="lg:col-span-2 space-y-10">

                {/* Profile Details */}
                <section>
                  <div className="flex items-center gap-4 mb-6">
                    <div className="h-px flex-grow bg-outline-variant/20" />
                    <h3 className="font-headline font-extrabold text-xl text-primary whitespace-nowrap">Profile Details</h3>
                    <div className="h-px w-12 bg-outline-variant/20" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {[
                      { label: 'Full Legal Name',  value: profile?.name || '—',               icon: 'badge' },
                      { label: 'Email Address',    value: user?.email || '—',                 icon: 'mail' },
                      { label: 'Role / Position',  value: profile?.position || 'Jury Member',  icon: 'gavel' },
                      { label: 'Access Level',     value: 'Full Assessment',                  icon: 'verified_user' },
                    ].map(field => (
                      <div key={field.label} className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-on-surface-variant/60 tracking-widest font-body flex items-center gap-1.5 ml-1">
                          <span className="material-symbols-outlined text-[12px]">{field.icon}</span>
                          {field.label}
                        </label>
                        <div className="bg-surface-container-low px-4 py-3.5 rounded-xl text-on-surface font-body font-medium text-sm border border-transparent hover:border-primary/10 transition-colors truncate">
                          {field.value}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Jury Directory */}
                <section>
                  <div className="flex items-center gap-4 mb-6">
                    <div className="h-px flex-grow bg-outline-variant/20" />
                    <h3 className="font-headline font-extrabold text-xl text-primary whitespace-nowrap">Jury Directory</h3>
                    <div className="h-px w-12 bg-outline-variant/20" />
                  </div>

                  {juryDirectory.length === 0 ? (
                    <div className="py-10 flex flex-col items-center text-center bg-surface-container-lowest rounded-[2rem] shadow-[0_4px_24px_-4px_rgba(19,41,143,0.06)]">
                      <span className="material-symbols-outlined text-[44px] text-on-surface-variant/20 mb-2">group</span>
                      <p className="text-sm font-bold text-on-surface-variant/40 font-body">No other jury members found</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {juryDirectory.map((member) => {
                        const mInitials = member.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'JU';
                        const isMe = member.user_id === user?.id;
                        const isSelected = selectedJuryMemberId === member.user_id;

                        return (
                          <div key={member.user_id}>
                            {/* Member row */}
                            <div
                              onClick={() => handleDirectoryMemberClick(member.user_id)}
                              className={`flex items-center gap-4 p-4 rounded-[1.5rem] border transition-all duration-200 ${
                                isMe
                                  ? 'bg-primary/5 border-primary/15 cursor-default'
                                  : isSelected
                                  ? 'bg-surface-container-lowest border-primary/20 shadow-[0_4px_24px_-4px_rgba(19,41,143,0.12)] cursor-pointer'
                                  : 'bg-surface-container-lowest border-outline-variant/10 shadow-sm hover:border-primary/15 hover:shadow-[0_4px_16px_-4px_rgba(19,41,143,0.08)] cursor-pointer hover:-translate-y-0.5'
                              }`}
                            >
                              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-bold font-headline shrink-0 ${isMe ? 'bg-primary text-on-primary' : 'bg-primary/10 text-primary'}`}>
                                {mInitials}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-headline font-bold text-on-surface text-base truncate flex items-center gap-2">
                                  {member.name}
                                  {isMe && (
                                    <span className="text-[9px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full uppercase tracking-widest font-body shrink-0">You</span>
                                  )}
                                </div>
                                <div className="text-xs text-on-surface-variant/60 font-body mt-0.5">
                                  {member.position || 'Jury Member'}
                                </div>
                              </div>
                              {!isMe && (
                                <span
                                  className="material-symbols-outlined text-primary/50 transition-transform duration-200 shrink-0"
                                  style={{ transform: isSelected ? 'rotate(90deg)' : 'rotate(0deg)' }}
                                >
                                  expand_more
                                </span>
                              )}
                            </div>

                            {/* Expanded member profile */}
                            {isSelected && (
                              <div className="mt-2 ml-4 bg-surface-container-low rounded-[1.5rem] border border-primary/10 overflow-hidden">
                                {loadingDirectoryMember ? (
                                  <div className="flex items-center justify-center gap-3 py-10">
                                    <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                    <span className="text-sm text-on-surface-variant font-body">Loading profile…</span>
                                  </div>
                                ) : directoryMemberProfile ? (
                                  <div className="p-6">
                                    {/* Mini hero */}
                                    <div className="flex items-center gap-4 mb-6">
                                      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-lg font-bold font-headline text-primary shrink-0 overflow-hidden">
                                        {directoryMemberProfile.photo_url
                                          ? <img src={photoSrc(directoryMemberProfile.photo_url)} alt={directoryMemberProfile.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                          : mInitials
                                        }
                                      </div>
                                      <div>
                                        <h4 className="font-headline font-bold text-on-surface text-lg">{directoryMemberProfile.name}</h4>
                                        <span className="px-2.5 py-0.5 bg-primary/10 text-primary text-[10px] uppercase font-bold rounded-full tracking-wider font-body">
                                          Jury Member
                                        </span>
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                      {[
                                        { label: 'Position',     value: directoryMemberProfile.position || 'Jury Member',   icon: 'gavel' },
                                        { label: 'Access Level', value: 'Full Assessment',                                  icon: 'verified_user' },
                                        { label: 'Status',       value: directoryMemberProfile.is_active ? 'Active' : 'Inactive', icon: 'task_alt' },
                                        { label: 'Role',         value: directoryMemberProfile.user_type || 'jury',         icon: 'badge' },
                                      ].map(f => (
                                        <div key={f.label} className="space-y-1">
                                          <label className="text-[10px] font-bold uppercase text-on-surface-variant/50 tracking-widest font-body flex items-center gap-1 ml-0.5">
                                            <span className="material-symbols-outlined text-[11px]">{f.icon}</span>
                                            {f.label}
                                          </label>
                                          <div className="bg-surface-container-lowest px-3.5 py-3 rounded-xl text-on-surface font-body font-medium text-sm truncate">
                                            {f.value}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="py-8 flex flex-col items-center text-center">
                                    <span className="material-symbols-outlined text-[32px] text-on-surface-variant/20 mb-1">person_off</span>
                                    <p className="text-xs text-on-surface-variant/40 font-body">Profile not available</p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              </div>

              {/* ── RIGHT: account security only ── */}
              <div>
                <div className="bg-surface-container-highest/30 p-5 rounded-[1.75rem] border border-outline-variant/20 backdrop-blur-sm">
                  <h4 className="font-headline font-bold text-on-surface mb-4">Account Security</h4>
                  <div
                    onClick={() => setShowChangePassword(true)}
                    className="flex items-center justify-between p-4 bg-surface-container-lowest rounded-2xl shadow-sm hover:-translate-y-0.5 transition-transform duration-200 cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-primary">password</span>
                      <span className="text-sm font-medium font-body text-on-surface">Change Password</span>
                    </div>
                    <span className="material-symbols-outlined text-on-surface-variant/40 text-sm">chevron_right</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

      </main>
    </div>
  );
};

export default JuryDashboard;
