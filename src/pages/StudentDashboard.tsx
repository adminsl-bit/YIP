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
import { Loader2, User, LayoutDashboard, Network, Vote, MessageSquare, LogOut, MessagesSquare } from 'lucide-react';

type TabId = 'profile' | 'civic-wall' | 'tree' | 'ballot' | 'question-hour' | 'messages';

interface ManifestoItem {
  text: string;
}

const StudentDashboard = () => {
  const { user, profile, signOut, refreshProfile, loading: authLoading } = useAuth();
  const { toast } = useToast();

  // Tab navigation
  const [activeTab, setActiveTab] = useState<TabId>('profile');

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

  // Derived values
  const delegateName = profile?.name || 'Delegate';
  const firstName = delegateName.split(' ')[0];
  const position = profile?.position || 'Member of Parliament';
  const serialNumber = profile?.serial_number || '—';
  const constituency = profile?.constituency || '—';
  const state = profile?.state || '—';
  const city = profile?.city || '—';
  const partyName = profile?.party_name || 'Independent';
  const partyTagline = (profile as any)?.party_tagline || '';
  const partyNumber = profile?.party_number ?? 0;
  const partyAlignment = profile?.party_alignment || 'non_aligned';
  const partyLogoUrl = profile?.party_logo_url || null;
  const photoUrl = profile?.photo_url || null;
  const isActive = profile?.is_active !== false;
  const committee = profile?.committee || null;
  const initials = delegateName.split(' ').map((n: string) => n[0]).join('').toUpperCase();

  const getAlignmentLabel = (alignment: string) => {
    switch (alignment) {
      case 'ruling_party': return 'Ruling Party';
      case 'opposition': return 'Opposition';
      default: return 'Non-Aligned';
    }
  };

  const getAlignmentColor = (alignment: string) => {
    switch (alignment) {
      case 'ruling_party': return 'bg-emerald-500/10 text-emerald-700 border-emerald-200';
      case 'opposition': return 'bg-red-500/10 text-red-700 border-red-200';
      default: return 'bg-gray-500/10 text-gray-600 border-gray-200';
    }
  };

  // Sync profile fields
  useEffect(() => {
    if (profile) {
      setEditName(profile.name || '');
      setEditPartyName(profile.party_name || '');
      setEditPartyTagline((profile as any)?.party_tagline || '');
    }
  }, [profile]);

  // Load manifesto
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

  // Save profile
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
      .eq('id', user.id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Profile Updated' });
      setIsEditingProfile(false);
      refreshProfile?.();
    }
    setIsSavingProfile(false);
  };

  // Save manifesto
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
      .eq('id', user.id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Manifesto Saved' });
      setIsEditingManifesto(false);
      refreshProfile?.();
    }
    setIsSavingManifesto(false);
  };

  // Nav items
  const navItems: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: 'profile',       label: 'Profile',       icon: User },
    { id: 'civic-wall',    label: 'Civic Wall',     icon: LayoutDashboard },
    { id: 'tree',          label: 'Tree',           icon: Network },
    { id: 'ballot',        label: 'Ballot',         icon: Vote },
    { id: 'question-hour', label: 'Question Hour',  icon: MessageSquare },
    { id: 'messages',      label: 'Civic Chat',      icon: MessagesSquare },
  ];

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F3F4F6]">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  // ── Render Profile Tab ────────────────────────────────────────────
  const renderProfileTab = () => (
    <>
      {/* Hero Banner */}
      <section className="relative overflow-hidden rounded-3xl h-72 mb-8 flex items-center shadow-xl" style={{ background: 'linear-gradient(135deg, #2E41AC 0%, #1a237e 100%)' }}>
        <div className="absolute inset-0 opacity-20 mix-blend-overlay">
          <div className="w-full h-full bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMCAwaDIwdjIwSDB6TTIwIDIwaDIwdjIwSDIweiIvPjwvZz48L2c+PC9zdmc+')] bg-repeat" />
        </div>
        <div className="relative z-10 px-12 max-w-2xl">
          <h2 className="text-white text-5xl font-extrabold leading-tight tracking-tight font-headline">
            Welcome back to Parliament, Delegate {firstName}.
          </h2>
          <button
            onClick={() => setActiveTab('civic-wall')}
            className="mt-8 bg-white text-primary px-8 py-3 rounded-full font-bold shadow-lg hover:bg-opacity-90 transition-all flex items-center gap-2 group"
          >
            Access Civic Wall
            <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/>
            </svg>
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column – Profile Card */}
        <div className="lg:col-span-4 space-y-6">
          <div className="glass-card rounded-3xl p-8 flex flex-col items-center text-center relative shadow-lg">
            {/* Edit / Save / Cancel buttons */}
            <div className="absolute top-5 right-5 flex items-center gap-2">
              {isEditingProfile ? (
                <>
                  <button
                    onClick={() => setIsEditingProfile(false)}
                    className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100 transition-colors"
                    title="Cancel"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/></svg>
                  </button>
                  <button
                    onClick={handleSaveProfile}
                    disabled={isSavingProfile}
                    className="bg-primary text-white px-4 py-1.5 rounded-full text-xs font-bold shadow-md hover:bg-primary/90 transition-all disabled:opacity-50"
                  >
                    {isSavingProfile ? 'Saving...' : 'Save'}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setIsEditingProfile(true)}
                  className="text-gray-400 hover:text-primary p-2 rounded-full hover:bg-primary/5 transition-colors"
                  title="Edit Profile"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/></svg>
                </button>
              )}
            </div>

            {/* Avatar Section */}
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
              {/* Name */}
              {isEditingProfile ? (
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="text-2xl font-bold text-gray-900 w-full border-b-2 border-primary/30 focus:border-primary outline-none bg-transparent pb-1"
                />
              ) : (
                <h3 className="text-2xl font-bold text-gray-900">{delegateName}</h3>
              )}

              {/* Role badge */}
              <div className="flex items-center gap-2 text-primary font-semibold text-sm mt-1">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.64.304 1.24.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"/></svg>
                <span>{position}</span>
              </div>

              {/* Party Logo + Name */}
              <div className="mt-6 flex items-center gap-4">
                <div className="relative shrink-0">
                  <div className="w-14 h-14 rounded-2xl bg-white border border-gray-200 overflow-hidden shadow-sm flex items-center justify-center">
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
                        className="font-bold text-gray-900 w-full border-b border-primary/20 focus:border-primary outline-none bg-transparent text-sm pb-0.5"
                      />
                      <input
                        type="text"
                        value={editPartyTagline}
                        onChange={(e) => setEditPartyTagline(e.target.value)}
                        placeholder="Party Tagline"
                        className="text-xs text-gray-400 w-full border-b border-gray-200 focus:border-primary outline-none bg-transparent mt-1 pb-0.5"
                      />
                    </>
                  ) : (
                    <>
                      <h4 className="font-bold text-gray-900 text-sm truncate">{partyName}</h4>
                      <p className="text-xs text-gray-400 font-medium truncate">{partyTagline || 'Yi Parliamentary Bloc'}</p>
                    </>
                  )}
                </div>
              </div>

              {/* Tag pills: Party Number, Committee, Alignment */}
              <div className="flex flex-wrap gap-2 mt-6">
                {/* Party Number Tag */}
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/></svg>
                  Party {partyNumber}
                </span>

                {/* Committee Tag */}
                {committee && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/10 text-indigo-700 border border-indigo-200">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/></svg>
                    {committee}
                  </span>
                )}

                {/* Alignment Tag */}
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${getAlignmentColor(partyAlignment)}`}>
                  {partyAlignment === 'ruling_party' && (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/></svg>
                  )}
                  {partyAlignment === 'opposition' && (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/></svg>
                  )}
                  {getAlignmentLabel(partyAlignment)}
                </span>
              </div>

              {/* Detail rows */}
              <div className="mt-8 space-y-6 border-t border-gray-100 pt-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Serial ID</label>
                    <p className="font-bold text-gray-800 text-lg">#{serialNumber}</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</label>
                    <p className={`font-bold text-sm flex items-center gap-1 ${isActive ? 'text-emerald-500' : 'text-red-500'}`}>
                      <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-red-500'}`} />
                      {isActive ? 'ACTIVE MEMBER' : 'INACTIVE'}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">State</label>
                    <p className="font-bold text-gray-800">{state}</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">City</label>
                    <p className="font-bold text-gray-800">{city}</p>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Constituency Focus</label>
                  <p className="font-bold text-gray-800 flex items-center gap-1 mt-1">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/>
                      <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/>
                    </svg>
                    {constituency}
                  </p>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Parliamentary Role</label>
                  <div className="mt-1 bg-[#2E41AC] px-4 py-3 rounded-xl shadow-md border border-[#2E41AC]/20">
                    <p className="font-bold text-white">{position}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column – Civic Agenda */}
        <div className="lg:col-span-8">
          <div className="glass-card rounded-3xl p-10 min-h-[600px] flex flex-col shadow-lg">
            <div className="flex flex-wrap justify-between items-start mb-10 gap-4">
              <div>
                <h2 className="text-4xl font-extrabold text-gray-900 tracking-tight font-headline">Civic Agenda</h2>
                <div className="flex items-center gap-2 mt-2 text-primary font-medium">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/><path clipRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" fillRule="evenodd"/></svg>
                  <span>Strategic Manifesto for {constituency}</span>
                </div>
              </div>
              <button
                onClick={() => setIsEditingManifesto(!isEditingManifesto)}
                className="bg-primary text-white px-6 py-2 rounded-full font-bold flex items-center gap-2 shadow-lg shadow-blue-200 hover:scale-105 transition-transform"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/></svg>
                {isEditingManifesto ? 'Cancel' : 'Edit Manifesto'}
              </button>
            </div>

            {/* Constituency Card */}
            <div className="bg-[#F8FAFC] rounded-2xl p-8 mb-8 border border-gray-100 shadow-sm">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 block">About the Constituency</label>
              <h3 className="text-2xl font-bold text-gray-800 mb-2">{constituency}</h3>
              {isEditingManifesto ? (
                <textarea
                  value={manifestoAbout}
                  onChange={(e) => setManifestoAbout(e.target.value)}
                  placeholder="Describe your constituency focus..."
                  className="w-full bg-white border border-gray-200 rounded-xl p-4 text-gray-600 text-sm resize-none focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none min-h-[80px]"
                />
              ) : (
                <p className="text-gray-500 italic">{manifestoAbout || 'No description added yet.'}</p>
              )}
            </div>

            {/* Challenges & Solutions Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 flex-1">
              {/* Challenges */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 mb-6 h-8">
                  <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center text-red-500 font-black text-sm shrink-0">!</div>
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    Key Challenges ({manifestoChallenges.length})
                  </h4>
                </div>
                <ul className="space-y-4">
                  {manifestoChallenges.map((c, i) => (
                    <li key={i} className="flex items-center gap-4">
                      <span className="w-8 h-8 rounded-full bg-red-500/10 text-red-600 flex items-center justify-center text-xs font-bold shrink-0">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <div className="bg-white border border-gray-100 p-4 rounded-xl flex-1 shadow-sm flex items-center justify-between min-h-[56px]">
                        <p className="text-gray-800 font-semibold text-sm">{c.text}</p>
                        {isEditingManifesto && (
                          <button
                            onClick={() => setManifestoChallenges(prev => prev.filter((_, idx) => idx !== i))}
                            className="text-red-400 hover:text-red-600 ml-2 shrink-0"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/></svg>
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                  {isEditingManifesto && (
                    <li className="flex items-center gap-4">
                      <span className="w-8 h-8 rounded-full border-2 border-dashed border-red-300 flex items-center justify-center text-[10px] font-bold text-red-400 shrink-0">
                        {String(manifestoChallenges.length + 1).padStart(2, '0')}
                      </span>
                      <div className="bg-white border border-dashed border-gray-200 p-3 rounded-xl flex-1 flex items-center gap-2 min-h-[56px]">
                        <input
                          type="text"
                          value={newChallenge}
                          onChange={(e) => setNewChallenge(e.target.value)}
                          placeholder="Add next challenge..."
                          className="flex-1 bg-transparent outline-none text-sm text-gray-600 font-medium"
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
                          className="text-primary font-bold text-xs px-3 py-1.5 bg-primary/5 rounded-lg hover:bg-primary/10 transition-colors"
                        >
                          Add
                        </button>
                      </div>
                    </li>
                  )}
                  {!isEditingManifesto && manifestoChallenges.length === 0 && (
                    <li className="flex items-center gap-4 opacity-50">
                      <span className="w-8 h-8 rounded-full bg-red-500/5 text-red-400 flex items-center justify-center text-xs font-bold shrink-0">01</span>
                      <div className="bg-white border border-dashed border-gray-200 p-4 rounded-xl flex-1 min-h-[56px] flex items-center">
                        <p className="text-gray-400 italic text-sm">No challenges added yet...</p>
                      </div>
                    </li>
                  )}
                </ul>
              </div>

              {/* Solutions / Proposed Legislation */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 mb-6 h-8">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500 font-black text-sm shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"/></svg>
                  </div>
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    Proposed Legislation ({manifestoSolutions.length})
                  </h4>
                </div>
                <ul className="space-y-4">
                  {manifestoSolutions.map((s, i) => (
                    <li key={i} className="flex items-center gap-4">
                      <span className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center text-xs font-bold shrink-0">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <div className="bg-emerald-50/50 border border-emerald-100/50 p-4 rounded-xl flex-1 flex items-center justify-between min-h-[56px]">
                        <p className="text-emerald-800 font-semibold text-sm">{s.text}</p>
                        {isEditingManifesto && (
                          <button
                            onClick={() => setManifestoSolutions(prev => prev.filter((_, idx) => idx !== i))}
                            className="text-red-400 hover:text-red-600 ml-2 shrink-0"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/></svg>
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                  {isEditingManifesto && (
                    <li className="flex items-center gap-4">
                      <span className="w-8 h-8 rounded-full border-2 border-dashed border-emerald-300 flex items-center justify-center text-[10px] font-bold text-emerald-400 shrink-0">
                        {String(manifestoSolutions.length + 1).padStart(2, '0')}
                      </span>
                      <div className="bg-white border border-dashed border-gray-200 p-3 rounded-xl flex-1 flex items-center gap-2 min-h-[56px]">
                        <input
                          type="text"
                          value={newSolution}
                          onChange={(e) => setNewSolution(e.target.value)}
                          placeholder="Draft new item..."
                          className="flex-1 bg-transparent outline-none text-sm text-gray-600 font-medium"
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
                          className="text-emerald-600 font-bold text-xs px-3 py-1.5 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors"
                        >
                          Add
                        </button>
                      </div>
                    </li>
                  )}
                  {!isEditingManifesto && manifestoSolutions.length === 0 && (
                    <li className="flex items-center gap-4 opacity-50">
                      <span className="w-8 h-8 rounded-full bg-emerald-500/5 text-emerald-400 flex items-center justify-center text-xs font-bold shrink-0">01</span>
                      <div className="bg-white border border-dashed border-gray-200 p-4 rounded-xl flex-1 min-h-[56px] flex items-center">
                        <p className="text-gray-400 italic text-sm">No legislation drafted yet...</p>
                      </div>
                    </li>
                  )}
                </ul>
              </div>
            </div>

            {/* Save Manifesto button */}
            {isEditingManifesto && (
              <div className="mt-8 flex justify-end">
                <button
                  onClick={handleSaveManifesto}
                  disabled={isSavingManifesto}
                  className="bg-primary text-white px-8 py-3 rounded-full font-bold shadow-lg shadow-blue-200 hover:scale-105 transition-transform disabled:opacity-50"
                >
                  {isSavingManifesto ? 'Saving...' : 'Save Manifesto'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );

  // ── Render tab content ────────────────────────────────────────────
  const renderTabContent = () => {
    switch (activeTab) {
      case 'profile':
        return renderProfileTab();
      case 'civic-wall':
        return <CivicWall />;
      case 'tree':
        return <ParliamentTree />;
      case 'ballot':
        return <PollVoting />;
      case 'question-hour':
        return <QuestionHourHub />;
      default:
        return renderProfileTab();
    }
  };

  return (
    <div className="flex min-h-screen bg-[#F3F4F6] font-body antialiased">

      {/* ── Left Sidebar ── */}
      <aside className="hidden md:flex flex-col h-screen w-64 fixed z-50 bg-white border-r border-outline-variant py-6 px-4">
        {/* Header */}
        <div className="mb-10 px-4">
          <h1 className="font-headline font-bold text-on-surface text-lg">The Civic Canvas</h1>
          <p className="font-body text-on-surface-variant text-xs font-medium">Digital Diplomat Portal</p>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 space-y-2">
          {navItems.map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors duration-200 text-left font-body ${
                  activeTab === item.id
                    ? 'text-primary font-bold border-r-4 border-primary bg-primary/5'
                    : 'text-on-surface-variant hover:bg-surface-container font-medium'
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Sign Out */}
        <div className="mt-auto px-4">
          <button
            onClick={() => signOut()}
            className="flex items-center gap-2 font-body text-on-surface-variant hover:text-error transition-colors duration-200 font-medium"
          >
            <LogOut className="w-5 h-5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* ── Mobile Bottom Nav ── */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-outline-variant md:hidden flex justify-around items-center h-16 z-50">
        {navItems.map(item => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`p-2 ${activeTab === item.id ? 'text-primary' : 'text-on-surface-variant'}`}
            >
              <Icon className="w-5 h-5" />
            </button>
          );
        })}
      </div>

      {/* ── Main Content ── */}
      <main className="flex-1 md:ml-64 p-8 pb-24 md:pb-8">
        <div className={activeTab === 'messages' ? '' : 'hidden'}>
          <GlobalSquare />
        </div>
        {activeTab !== 'messages' && renderTabContent()}
      </main>

      <BreakingNewsTicker />
    </div>
  );
};

export default StudentDashboard;