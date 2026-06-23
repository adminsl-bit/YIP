import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { ProfilePhotoUploader } from '@/components/student/ProfilePhotoUploader';
import { PartyLogoUploader } from '@/components/student/PartyLogoUploader';
import { CivicWall } from '@/components/student/CivicWall';
import { ParliamentTree } from '@/components/student/ParliamentTree';
import { PollVoting } from '@/components/student/PollVoting';
import { QuestionHourHub } from '@/components/student/QuestionHourHub';
import { GlobalSquare } from '@/components/student/GlobalSquare';
import { BreakingNewsTicker } from '@/components/display/BreakingNewsTicker';
import { SpeechTrackingView } from '@/components/student/SpeechTrackingView';
import { AgendaView } from '@/components/student/AgendaView';
import { StudentDocuments } from '@/components/student/StudentDocuments';
import { MotionsHub } from '@/components/student/MotionsHub';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';

type TabId = 'profile' | 'civic-wall' | 'tree' | 'ballot' | 'question-hour' | 'speeches' | 'messages' | 'agenda' | 'motions' | 'documents';

interface ManifestoItem {
  text: string;
}

const baseNavItems: { id: TabId; label: string; icon: string }[] = [
  { id: 'profile',       label: 'Profile',         icon: 'person' },
  { id: 'civic-wall',    label: 'Civic Wall',       icon: 'public' },
  { id: 'tree',          label: 'Parliament Tree',  icon: 'account_tree' },
  { id: 'agenda',        label: 'Agenda',           icon: 'event_seat' },
  { id: 'motions',       label: 'Motions',          icon: 'gavel' },
  { id: 'ballot',        label: 'Ballot',           icon: 'how_to_vote' },
  { id: 'question-hour', label: 'Question Hour',    icon: 'forum' },
  { id: 'speeches',      label: 'Speech Tracker',   icon: 'mic' },
  { id: 'documents',     label: 'Documents',        icon: 'description' },
  { id: 'messages',      label: 'Civic Chat',       icon: 'chat' },
];

const StudentDashboard = () => {
  const { user, profile, signOut, refreshProfile, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<TabId>('profile');
  const [moreOpen, setMoreOpen] = useState(false);
  const [unreadChat, setUnreadChat] = useState(0);

  // Manifesto state
  const [isEditingManifesto, setIsEditingManifesto] = useState(false);
  const [manifestoAbout, setManifestoAbout] = useState('');
  const [manifestoChallenges, setManifestoChallenges] = useState<ManifestoItem[]>([]);
  const [manifestoSolutions, setManifestoSolutions] = useState<ManifestoItem[]>([]);
  const [newChallenge, setNewChallenge] = useState('');
  const [newSolution, setNewSolution] = useState('');
  const [isSavingManifesto, setIsSavingManifesto] = useState(false);

  // Profile edit state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPartyName, setEditPartyName] = useState('');
  const [editPartyTagline, setEditPartyTagline] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Bench alignment (ruling party / opposition)
  const [alignment, setAlignment] = useState<string>(profile?.party_alignment || 'non_aligned');
  const [savingAlignment, setSavingAlignment] = useState(false);

  useEffect(() => {
    setAlignment(profile?.party_alignment || 'non_aligned');
  }, [profile?.party_alignment]);

  const handleAlignmentChange = async (newAlignment: 'ruling_party' | 'opposition') => {
    if (newAlignment === alignment || savingAlignment || !profile?.user_id) return;
    setSavingAlignment(true);
    const previous = alignment;
    setAlignment(newAlignment);
    const { error } = await supabase
      .from('profiles')
      .update({ party_alignment: newAlignment })
      .eq('user_id', profile.user_id);
    if (error) {
      setAlignment(previous);
      toast({ title: 'Failed to update bench', variant: 'destructive' });
    } else {
      toast({ title: `Switched to ${newAlignment === 'ruling_party' ? 'Ruling Party' : 'Opposition'}` });
    }
    setSavingAlignment(false);
  };

  // Derived values
  const delegateName = profile?.name || 'Delegate';
  const firstName = delegateName.split(' ')[0];
  const position = profile?.position || 'Member of Parliament';
  // Speaker & Deputy Speaker get a read-only view of the speech tracker
  const isSpeaker = /speaker/i.test(position);
  const navItems = isSpeaker ? baseNavItems : baseNavItems.filter(item => item.id !== 'speeches');
  // ── Civic Chat unread badge ──────────────────────────────────────────────
  // Stores the timestamp of the last time the user viewed Civic Chat so we
  // can count newer messages and show a WhatsApp-style unread badge.
  useEffect(() => {
    if (!profile?.event_id) return;
    const STORAGE_KEY = `yip_chat_last_seen_${profile.event_id}`;

    const countUnread = async () => {
      const lastSeen = localStorage.getItem(STORAGE_KEY) ?? new Date(0).toISOString();
      const { count } = await supabase
        .from('civic_chat_messages')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', profile.event_id)
        .gt('created_at', lastSeen)
        .neq('user_id', user?.id ?? ''); // don't count own messages
      setUnreadChat(count ?? 0);
    };

    // Count on mount and when user switches away from chat tab
    if (activeTab !== 'messages') {
      countUnread();
    } else {
      // User is viewing chat — mark as seen now
      localStorage.setItem(STORAGE_KEY, new Date().toISOString());
      setUnreadChat(0);
    }

    // Live updates: re-count when new messages arrive
    const channel = supabase
      .channel('chat-unread-badge')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'civic_chat_messages',
          filter: `event_id=eq.${profile.event_id}` }, () => {
        if (activeTab !== 'messages') countUnread();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeTab, profile?.event_id, user?.id]);

  // Mobile bottom nav: keep the live-session essentials in the bar, tuck the rest behind "More"
  const primaryTabIds: TabId[] = ['agenda', 'civic-wall', 'ballot', 'question-hour'];
  const primaryNavItems = navItems.filter(item => primaryTabIds.includes(item.id));
  const moreNavItems = navItems.filter(item => !primaryTabIds.includes(item.id));
  const isMoreTabActive = moreNavItems.some(item => item.id === activeTab);
  // Admin students and journalists sit outside party politics — fixed role card, no manifesto
  const isStaffRole = /journalist|admin/i.test(position);
  const isJournalist = /journalist/i.test(position);
  const staffInfo = isJournalist
    ? {
        subtitle: 'Press & Media Corps',
        responsibilities: [
          'Cover committee proceedings and plenary debates as they unfold',
          'Publish reports and updates to the Civic Wall',
          'Conduct interviews with delegates and party representatives',
          'Maintain neutrality and accuracy across all published content',
        ],
      }
    : {
        subtitle: 'Administrative Support Team',
        responsibilities: [
          'Assist organizers with session logistics and scheduling',
          'Moderate and curate content on the Civic Wall',
          'Support attendance and score tracking for delegates',
          "Coordinate with the Speaker's office on procedural matters",
        ],
      };
  const serialNumber = profile?.serial_number || '—';
  const constituency = profile?.constituency || '—';
  const state = profile?.state || '—';
  const city = profile?.city || '—';
  const partyName = profile?.party_name || 'Independent';
  const partyTagline = (profile as any)?.party_tagline || '';
  const partyNumber = profile?.party_number ?? 0;
  const partyAlignment = alignment;
  const partyLogoUrl = profile?.party_logo_url || null;
  const photoUrl = profile?.photo_url || null;
  const isActive = profile?.is_active !== false;
  const committee = profile?.committee || null;
  const initials = delegateName.split(' ').map((n: string) => n[0]).join('').toUpperCase();


  useEffect(() => {
    if (profile) {
      setEditName(profile.name || '');
      setEditPartyName(profile.party_name || '');
      setEditPartyTagline((profile as any)?.party_tagline || '');
    }
  }, [profile]);

  useEffect(() => {
    if (profile) {
      setManifestoAbout((profile as any)?.manifesto_about || '');
      const problems = (profile as any)?.manifesto_problems;
      const solutions = (profile as any)?.manifesto_solutions;
      setManifestoChallenges(
        Array.isArray(problems) ? problems.map((p: any) => (typeof p === 'string' ? { text: p } : p)) : []
      );
      setManifestoSolutions(
        Array.isArray(solutions) ? solutions.map((s: any) => (typeof s === 'string' ? { text: s } : s)) : []
      );
    }
  }, [profile]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setIsSavingProfile(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        name: editName.trim() || delegateName,
        party_name: editPartyName.trim() || null,
        party_tagline: editPartyTagline.trim() || null,
      } as any)
      .eq('user_id', user.id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Profile Updated' });
      setIsEditingProfile(false);
      refreshProfile?.();
    }
    setIsSavingProfile(false);
  };

  const handleSaveManifesto = async () => {
    if (!user) return;
    setIsSavingManifesto(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        manifesto_about: manifestoAbout,
        manifesto_problems: manifestoChallenges,
        manifesto_solutions: manifestoSolutions,
      } as any)
      .eq('user_id', user.id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Manifesto Saved' });
      setIsEditingManifesto(false);
      refreshProfile?.();
    }
    setIsSavingManifesto(false);
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F3F4F6]">
        <div className="text-center space-y-4">
          <div className="w-14 h-14 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-headline font-black text-on-surface-variant uppercase tracking-widest">Loading…</p>
        </div>
      </div>
    );
  }

  // ── Profile Tab ───────────────────────────────────────────────────
  const renderProfileTab = () => (
    <>
      {/* Hero Banner */}
      <section className="relative overflow-hidden rounded-[2rem] h-64 mb-8 flex items-end shadow-xl" style={{ background: 'linear-gradient(135deg, #13298f 0%, #1a237e 100%)' }}>
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-32 -right-32 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
          <div className="absolute -bottom-16 -left-16 w-64 h-64 bg-primary-container/20 rounded-full blur-2xl" />
          <div className="absolute top-8 left-1/3 w-48 h-48 bg-white/3 rounded-full blur-2xl" />
        </div>
        <div className="relative z-10 px-10 pb-10">
          <p className="text-white/60 text-xs font-headline font-black uppercase tracking-[0.3em] mb-2">Welcome back to Parliament</p>
          <h2 className="text-white text-4xl font-extrabold leading-tight tracking-tight font-headline">
            Delegate {firstName}
          </h2>
          <button
            onClick={() => setActiveTab('civic-wall')}
            className="mt-6 bg-white text-primary px-8 py-3 rounded-full font-bold shadow-lg hover:bg-opacity-90 transition-all flex items-center gap-2 group text-sm"
          >
            Access Civic Wall
            <span className="material-symbols-outlined text-[16px] transition-transform group-hover:translate-x-1">arrow_forward</span>
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column – Profile Card */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-surface-container-lowest rounded-[2rem] p-8 flex flex-col items-center text-center relative shadow-[0_16px_40px_-12px_rgba(19,41,143,0.08)]">
            {/* Edit / Save / Cancel */}
            <div className="absolute top-5 right-5 flex items-center gap-2">
              {isEditingProfile ? (
                <>
                  <button
                    onClick={() => setIsEditingProfile(false)}
                    className="text-on-surface-variant hover:text-on-surface p-2 rounded-full hover:bg-surface-container transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                  <button
                    onClick={handleSaveProfile}
                    disabled={isSavingProfile}
                    className="bg-primary text-white px-4 py-1.5 rounded-full text-xs font-bold shadow-md hover:bg-primary/90 transition-all disabled:opacity-50 font-headline"
                  >
                    {isSavingProfile ? 'Saving…' : 'Save'}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setIsEditingProfile(true)}
                  className="text-on-surface-variant hover:text-primary p-2 rounded-full hover:bg-primary/5 transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">edit</span>
                </button>
              )}
            </div>

            {/* Avatar */}
            <div className="relative mb-6">
              <div className="w-32 h-32 rounded-3xl overflow-hidden border-4 border-white shadow-xl">
                {photoUrl ? (
                  <img
                    className="w-full h-full object-cover"
                    alt={`${delegateName}'s avatar`}
                    src={`${photoUrl}${photoUrl.includes('?') ? '&' : '?'}cb=${profile?.updated_at ? new Date(profile.updated_at).getTime() : ''}`}
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/40 text-primary text-4xl font-black">
                    {initials}
                  </div>
                )}
              </div>
              {isEditingProfile && (
                <div className="absolute -bottom-2 flex gap-2 left-1/2 -translate-x-1/2">
                  <ProfilePhotoUploader currentPhotoUrl={photoUrl} />
                </div>
              )}
            </div>

            <div className="w-full text-left">
              {isEditingProfile ? (
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="text-2xl font-bold text-on-surface w-full border-b-2 border-primary/30 focus:border-primary outline-none bg-transparent pb-1"
                />
              ) : (
                <h3 className="text-2xl font-bold text-on-surface">{delegateName}</h3>
              )}

              <div className="flex items-center gap-2 text-primary font-semibold text-sm mt-1">
                <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                <span>{position}</span>
              </div>

              {isStaffRole ? (
                /* Staff role badge — admin students/journalists have no party */
                <div className="mt-6 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
                    <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>badge</span>
                    {staffInfo.subtitle}
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-surface-container text-on-surface-variant border border-outline-variant/20">
                    Non-Aligned
                  </span>
                </div>
              ) : (
                <>
                  {/* Party */}
                  <div className="mt-6 flex items-center gap-4">
                    <div className="relative shrink-0">
                      <div className="w-14 h-14 rounded-2xl bg-surface-container-low border border-outline-variant/20 overflow-hidden shadow-sm flex items-center justify-center">
                        {partyLogoUrl ? (
                          <img
                            src={`${partyLogoUrl}${partyLogoUrl.includes('?') ? '&' : '?'}cb=${profile?.updated_at ? new Date(profile.updated_at).getTime() : ''}`}
                            alt="Party logo"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-primary/10 to-primary/30 flex items-center justify-center text-primary font-black text-xl">
                            {partyName?.charAt(0) || '?'}
                          </div>
                        )}
                      </div>
                      {isEditingProfile && (
                        <div className="absolute -bottom-1 -right-1">
                          <PartyLogoUploader currentLogoUrl={partyLogoUrl} />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      {isEditingProfile ? (
                        <>
                          <input
                            type="text"
                            value={editPartyName}
                            onChange={(e) => setEditPartyName(e.target.value)}
                            placeholder="Party Name"
                            className="font-bold text-on-surface w-full border-b border-primary/20 focus:border-primary outline-none bg-transparent text-sm pb-0.5"
                          />
                          <input
                            type="text"
                            value={editPartyTagline}
                            onChange={(e) => setEditPartyTagline(e.target.value)}
                            placeholder="Party Tagline"
                            className="text-xs text-on-surface-variant w-full border-b border-outline-variant/20 focus:border-primary outline-none bg-transparent mt-1 pb-0.5"
                          />
                        </>
                      ) : (
                        <>
                          <h4 className="font-bold text-on-surface text-sm truncate">{partyName}</h4>
                          <p className="text-xs text-on-surface-variant font-medium truncate">{partyTagline || 'Yi Parliamentary Bloc'}</p>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Tag pills */}
                  <div className="flex flex-wrap gap-2 mt-6">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
                      <span className="material-symbols-outlined text-[12px]">tag</span>
                      {partyName}
                    </span>

                    {committee && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-secondary/10 text-secondary border border-secondary/20">
                        <span className="material-symbols-outlined text-[12px]">people</span>
                        {committee}
                      </span>
                    )}

                    {isEditingProfile ? (
                      <div className="inline-flex items-center gap-1 p-1 rounded-full bg-surface-container border border-outline-variant/20">
                        <button
                          type="button"
                          disabled={savingAlignment}
                          onClick={() => handleAlignmentChange('ruling_party')}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all disabled:opacity-60 ${
                            partyAlignment === 'ruling_party'
                              ? 'bg-tertiary-fixed text-on-tertiary-fixed shadow-sm'
                              : 'text-on-surface-variant hover:text-tertiary'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>shield</span>
                          Ruling Party
                        </button>
                        <button
                          type="button"
                          disabled={savingAlignment}
                          onClick={() => handleAlignmentChange('opposition')}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all disabled:opacity-60 ${
                            partyAlignment === 'opposition'
                              ? 'bg-error text-on-error shadow-sm'
                              : 'text-on-surface-variant hover:text-error'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[12px]">flag</span>
                          Opposition
                        </button>
                      </div>
                    ) : (
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        partyAlignment === 'ruling_party'
                          ? 'bg-tertiary-fixed text-on-tertiary-fixed'
                          : partyAlignment === 'opposition'
                            ? 'bg-error text-on-error'
                            : 'bg-surface-container text-on-surface-variant border border-outline-variant/20'
                      }`}>
                        <span className="material-symbols-outlined text-[12px]" style={partyAlignment === 'ruling_party' ? { fontVariationSettings: "'FILL' 1" } : undefined}>
                          {partyAlignment === 'ruling_party' ? 'shield' : partyAlignment === 'opposition' ? 'flag' : 'balance'}
                        </span>
                        {partyAlignment === 'ruling_party' ? 'Ruling Party' : partyAlignment === 'opposition' ? 'Opposition' : 'Non-Aligned'}
                      </span>
                    )}
                  </div>
                </>
              )}

              {/* Detail rows */}
              <div className="mt-8 space-y-6 border-t border-outline-variant/10 pt-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Serial ID</label>
                    <p className="font-bold text-on-surface text-lg">#{serialNumber}</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Status</label>
                    <p className={`font-bold text-sm flex items-center gap-1 ${isActive ? 'text-on-tertiary-container' : 'text-error'}`}>
                      <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-on-tertiary-container' : 'bg-error'}`} />
                      {isActive ? 'ACTIVE MEMBER' : 'INACTIVE'}
                    </p>
                  </div>
                </div>
                {!isStaffRole && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">State</label>
                        <p className="font-bold text-on-surface">{state}</p>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">City</label>
                        <p className="font-bold text-on-surface">{city}</p>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Constituency Focus</label>
                      <p className="font-bold text-on-surface flex items-center gap-1 mt-1">
                        <span className="material-symbols-outlined text-[16px] text-on-surface-variant" style={{ fontVariationSettings: "'FILL' 1" }}>location_on</span>
                        {constituency}
                      </p>
                    </div>
                  </>
                )}
                <div>
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Parliamentary Role</label>
                  <div className="mt-1 bg-primary px-4 py-3 rounded-xl shadow-md">
                    <p className="font-bold text-white">{position}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column – Civic Agenda / Roles & Responsibilities */}
        <div className="lg:col-span-8">
          <div className="bg-surface-container-lowest rounded-[2rem] p-10 min-h-[600px] flex flex-col shadow-[0_16px_40px_-12px_rgba(19,41,143,0.06)]">
          {isStaffRole ? (
            <>
              {/* Roles & Responsibilities */}
              <div className="flex flex-wrap justify-between items-start mb-10 gap-4">
                <div>
                  <h2 className="text-4xl font-extrabold text-on-surface tracking-tight font-headline">Roles &amp; Responsibilities</h2>
                  <div className="flex items-center gap-2 mt-2 text-primary font-medium">
                    <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>badge</span>
                    <span className="text-sm">{staffInfo.subtitle}</span>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                {staffInfo.responsibilities.map((item, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <span className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold shrink-0 font-headline">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <div className="bg-surface-container-low border border-outline-variant/10 p-5 rounded-xl flex-1 shadow-sm">
                      <p className="text-on-surface font-semibold text-sm font-body">{item}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
            <div className="flex flex-wrap justify-between items-start mb-10 gap-4">
              <div>
                <h2 className="text-4xl font-extrabold text-on-surface tracking-tight font-headline">Civic Agenda</h2>
                <div className="flex items-center gap-2 mt-2 text-primary font-medium">
                  <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>assignment</span>
                  <span className="text-sm">Strategic Manifesto for {constituency}</span>
                </div>
              </div>
              <button
                onClick={() => setIsEditingManifesto(!isEditingManifesto)}
                className="bg-gradient-to-r from-primary to-primary-container text-white px-6 py-2.5 rounded-full font-bold flex items-center gap-2 shadow-[0_4px_16px_rgba(19,41,143,0.25)] hover:scale-105 transition-transform font-headline text-sm"
              >
                <span className="material-symbols-outlined text-[16px]">edit</span>
                {isEditingManifesto ? 'Cancel' : 'Edit Manifesto'}
              </button>
            </div>

            {/* Constituency Card */}
            <div className="bg-surface-container-low rounded-2xl p-8 mb-8 border border-outline-variant/10">
              <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-4 block">About the Constituency</label>
              <h3 className="text-2xl font-bold text-on-surface mb-2">{constituency}</h3>
              {isEditingManifesto ? (
                <textarea
                  value={manifestoAbout}
                  onChange={(e) => setManifestoAbout(e.target.value)}
                  placeholder="Describe your constituency focus..."
                  className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-xl p-4 text-on-surface-variant text-sm resize-none focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none min-h-[80px] font-body"
                />
              ) : (
                <p className="text-on-surface-variant italic font-body">{manifestoAbout || 'No description added yet.'}</p>
              )}
            </div>

            {/* Challenges & Solutions Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 flex-1">
              {/* Challenges */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 mb-6 h-8">
                  <div className="w-8 h-8 rounded-lg bg-error/10 flex items-center justify-center text-error shrink-0">
                    <span className="material-symbols-outlined text-[16px]">warning</span>
                  </div>
                  <h4 className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
                    Key Challenges ({manifestoChallenges.length})
                  </h4>
                </div>
                <ul className="space-y-4">
                  {manifestoChallenges.map((c, i) => (
                    <li key={i} className="flex items-center gap-4">
                      <span className="w-8 h-8 rounded-full bg-error/10 text-error flex items-center justify-center text-xs font-bold shrink-0 font-headline">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <div className="bg-surface-container-lowest border border-outline-variant/10 p-4 rounded-xl flex-1 shadow-sm flex items-center justify-between min-h-[56px]">
                        <p className="text-on-surface font-semibold text-sm font-body">{c.text}</p>
                        {isEditingManifesto && (
                          <button
                            onClick={() => setManifestoChallenges(prev => prev.filter((_, idx) => idx !== i))}
                            className="text-error/50 hover:text-error ml-2 shrink-0 transition-colors"
                          >
                            <span className="material-symbols-outlined text-[16px]">close</span>
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                  {isEditingManifesto && (
                    <li className="flex items-center gap-4">
                      <span className="w-8 h-8 rounded-full border-2 border-dashed border-error/30 flex items-center justify-center text-[10px] font-bold text-error/40 shrink-0 font-headline">
                        {String(manifestoChallenges.length + 1).padStart(2, '0')}
                      </span>
                      <div className="bg-surface-container-lowest border border-dashed border-outline-variant/20 p-3 rounded-xl flex-1 flex items-center gap-2 min-h-[56px]">
                        <input
                          type="text"
                          value={newChallenge}
                          onChange={(e) => setNewChallenge(e.target.value)}
                          placeholder="Add next challenge..."
                          className="flex-1 bg-transparent outline-none text-sm text-on-surface-variant font-medium font-body"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && newChallenge.trim()) {
                              setManifestoChallenges(prev => [...prev, { text: newChallenge.trim() }]);
                              setNewChallenge('');
                            }
                          }}
                        />
                        <button
                          onClick={() => {
                            if (newChallenge.trim()) {
                              setManifestoChallenges(prev => [...prev, { text: newChallenge.trim() }]);
                              setNewChallenge('');
                            }
                          }}
                          className="text-primary font-bold text-xs px-3 py-1.5 bg-primary/5 rounded-lg hover:bg-primary/10 transition-colors font-headline"
                        >
                          Add
                        </button>
                      </div>
                    </li>
                  )}
                  {!isEditingManifesto && manifestoChallenges.length === 0 && (
                    <li className="flex items-center gap-4 opacity-50">
                      <span className="w-8 h-8 rounded-full bg-error/5 text-error/40 flex items-center justify-center text-xs font-bold shrink-0 font-headline">01</span>
                      <div className="bg-surface-container-lowest border border-dashed border-outline-variant/10 p-4 rounded-xl flex-1 min-h-[56px] flex items-center">
                        <p className="text-on-surface-variant italic text-sm font-body">No challenges added yet...</p>
                      </div>
                    </li>
                  )}
                </ul>
              </div>

              {/* Solutions */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 mb-6 h-8">
                  <div className="w-8 h-8 rounded-lg bg-tertiary-fixed/30 flex items-center justify-center text-tertiary-container shrink-0">
                    <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  </div>
                  <h4 className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
                    Proposed Legislation ({manifestoSolutions.length})
                  </h4>
                </div>
                <ul className="space-y-4">
                  {manifestoSolutions.map((s, i) => (
                    <li key={i} className="flex items-center gap-4">
                      <span className="w-8 h-8 rounded-full bg-tertiary-fixed/30 text-tertiary-container flex items-center justify-center text-xs font-bold shrink-0 font-headline">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <div className="bg-tertiary-fixed/10 border border-tertiary-fixed-dim/20 p-4 rounded-xl flex-1 flex items-center justify-between min-h-[56px]">
                        <p className="text-tertiary-container font-semibold text-sm font-body">{s.text}</p>
                        {isEditingManifesto && (
                          <button
                            onClick={() => setManifestoSolutions(prev => prev.filter((_, idx) => idx !== i))}
                            className="text-error/50 hover:text-error ml-2 shrink-0 transition-colors"
                          >
                            <span className="material-symbols-outlined text-[16px]">close</span>
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                  {isEditingManifesto && (
                    <li className="flex items-center gap-4">
                      <span className="w-8 h-8 rounded-full border-2 border-dashed border-tertiary-fixed-dim/30 flex items-center justify-center text-[10px] font-bold text-tertiary-container/40 shrink-0 font-headline">
                        {String(manifestoSolutions.length + 1).padStart(2, '0')}
                      </span>
                      <div className="bg-surface-container-lowest border border-dashed border-outline-variant/20 p-3 rounded-xl flex-1 flex items-center gap-2 min-h-[56px]">
                        <input
                          type="text"
                          value={newSolution}
                          onChange={(e) => setNewSolution(e.target.value)}
                          placeholder="Draft new legislation..."
                          className="flex-1 bg-transparent outline-none text-sm text-on-surface-variant font-medium font-body"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && newSolution.trim()) {
                              setManifestoSolutions(prev => [...prev, { text: newSolution.trim() }]);
                              setNewSolution('');
                            }
                          }}
                        />
                        <button
                          onClick={() => {
                            if (newSolution.trim()) {
                              setManifestoSolutions(prev => [...prev, { text: newSolution.trim() }]);
                              setNewSolution('');
                            }
                          }}
                          className="text-tertiary-container font-bold text-xs px-3 py-1.5 bg-tertiary-fixed/20 rounded-lg hover:bg-tertiary-fixed/30 transition-colors font-headline"
                        >
                          Add
                        </button>
                      </div>
                    </li>
                  )}
                  {!isEditingManifesto && manifestoSolutions.length === 0 && (
                    <li className="flex items-center gap-4 opacity-50">
                      <span className="w-8 h-8 rounded-full bg-tertiary-fixed/10 text-tertiary-container/40 flex items-center justify-center text-xs font-bold shrink-0 font-headline">01</span>
                      <div className="bg-surface-container-lowest border border-dashed border-outline-variant/10 p-4 rounded-xl flex-1 min-h-[56px] flex items-center">
                        <p className="text-on-surface-variant italic text-sm font-body">No legislation drafted yet...</p>
                      </div>
                    </li>
                  )}
                </ul>
              </div>
            </div>

            {isEditingManifesto && (
              <div className="mt-8 flex justify-end">
                <button
                  onClick={handleSaveManifesto}
                  disabled={isSavingManifesto}
                  className="bg-gradient-to-r from-primary to-primary-container text-white px-8 py-3 rounded-full font-bold shadow-[0_4px_16px_rgba(19,41,143,0.25)] hover:scale-105 transition-transform disabled:opacity-50 font-headline"
                >
                  {isSavingManifesto ? 'Saving…' : 'Save Manifesto'}
                </button>
              </div>
            )}
            </>
          )}
          </div>
        </div>
      </div>
    </>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'profile':       return renderProfileTab();
      case 'civic-wall':   return <CivicWall />;
      case 'tree':          return <ParliamentTree />;
      case 'agenda':        return <AgendaView />;
      case 'motions':       return <MotionsHub />;
      case 'ballot':        return <PollVoting />;
      case 'question-hour': return <QuestionHourHub />;
      case 'speeches':      return <SpeechTrackerTabWrapper />;
      case 'documents':     return <StudentDocuments />;
      default:              return renderProfileTab();
    }
  };

  return (
    <div className={`flex bg-[#F3F4F6] font-body antialiased ${activeTab === 'messages' ? 'h-dvh overflow-hidden' : 'min-h-screen'}`}>

      {/* ── Left Sidebar ── */}
      <aside className="hidden md:flex flex-col h-screen w-64 fixed z-50 bg-white border-r border-outline-variant py-6 px-4">
        <div className="mb-8 px-2 pt-2">
          <h1 className="font-headline font-bold text-on-surface text-lg">The Civic Canvas</h1>
          <p className="font-body text-on-surface-variant text-xs font-medium">Digital Diplomat Portal</p>
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
              <span className="font-body text-sm whitespace-nowrap flex-1">{item.label}</span>
              {item.id === 'messages' && unreadChat > 0 && (
                <span className="ml-auto min-w-[20px] h-5 px-1.5 bg-primary text-white text-[10px] font-black rounded-full flex items-center justify-center">
                  {unreadChat > 99 ? '99+' : unreadChat}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="px-2 py-4 mt-auto">
          <button
            onClick={() => signOut()}
            className="flex items-center gap-2 font-body text-on-surface-variant hover:text-error transition-colors duration-200 font-medium text-sm"
          >
            <span className="material-symbols-outlined text-[20px]">logout</span>
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* ── Mobile Bottom Nav ── */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-outline-variant md:hidden flex justify-around items-center h-16 z-50">
        {primaryNavItems.map(item => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`flex flex-col items-center justify-center p-2 min-w-[3rem] min-h-[44px] transition-colors ${activeTab === item.id ? 'text-primary' : 'text-on-surface-variant'}`}
          >
            <span
              className="material-symbols-outlined text-[22px]"
              style={activeTab === item.id ? { fontVariationSettings: "'FILL' 1" } : undefined}
            >
              {item.icon}
            </span>
          </button>
        ))}
        <button
          onClick={() => setMoreOpen(true)}
          className={`flex flex-col items-center justify-center p-2 min-w-[3rem] min-h-[44px] transition-colors ${isMoreTabActive ? 'text-primary' : 'text-on-surface-variant'}`}
        >
          <span
            className="material-symbols-outlined text-[22px]"
            style={isMoreTabActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
          >
            more_horiz
          </span>
        </button>
      </div>

      {/* ── Mobile "More" Drawer ── */}
      <Drawer open={moreOpen} onOpenChange={setMoreOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>More</DrawerTitle>
          </DrawerHeader>
          <nav className="px-4 pb-8 space-y-1">
            {moreNavItems.map(item => (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id); setMoreOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 text-left min-h-[44px] ${
                  activeTab === item.id
                    ? 'text-primary font-bold bg-primary/5'
                    : 'text-on-surface-variant hover:bg-surface-container font-medium'
                }`}
              >
                <span
                  className="material-symbols-outlined text-[20px] shrink-0"
                  style={activeTab === item.id ? { fontVariationSettings: "'FILL' 1" } : undefined}
                >
                  {item.icon}
                </span>
                <span className="font-body text-sm whitespace-nowrap flex-1">{item.label}</span>
                {item.id === 'messages' && unreadChat > 0 && (
                  <span className="ml-auto min-w-[20px] h-5 px-1.5 bg-primary text-white text-[10px] font-black rounded-full flex items-center justify-center">
                    {unreadChat > 99 ? '99+' : unreadChat}
                  </span>
                )}
              </button>
            ))}
            <button
              onClick={() => signOut()}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-left min-h-[44px] text-on-surface-variant hover:bg-error/5 hover:text-error font-medium transition-colors duration-200"
            >
              <span className="material-symbols-outlined text-[20px] shrink-0">logout</span>
              <span className="font-body text-sm whitespace-nowrap">Sign Out</span>
            </button>
          </nav>
        </DrawerContent>
      </Drawer>

      {/* ── Main Content ── */}
      {/* Messages tab gets no padding so GlobalSquare can fill the full height */}
      <main className={`flex-1 md:ml-64 ${
        activeTab === 'messages'
          ? 'flex flex-col overflow-hidden pb-16 md:pb-0 md:p-6'
          : 'p-4 sm:p-6 md:p-8 pb-24 md:pb-8 overflow-y-auto'
      }`}>
        {activeTab === 'messages' ? <GlobalSquare /> : renderTabContent()}
      </main>

      <BreakingNewsTicker />
    </div>
  );
};

// Wrapper to give the speech tracker tab a proper page heading
const SpeechTrackerTabWrapper = () => (
  <div>
    <header className="mb-10">
      <h1 className="text-4xl font-extrabold font-headline tracking-tight text-primary">
        Speech <span className="text-secondary">Tracker</span>
      </h1>
      <p className="text-[10px] text-on-surface-variant/40 font-black uppercase tracking-[0.4em] mt-3 flex items-center gap-2 font-headline">
        <span className="material-symbols-outlined text-[12px]">mic</span>
        Parliamentary Participation Monitor
      </p>
    </header>
    <SpeechTrackingView />
  </div>
);

export default StudentDashboard;
