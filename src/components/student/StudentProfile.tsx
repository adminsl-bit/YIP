import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { ProfilePhotoUploader } from '@/components/student/ProfilePhotoUploader';
import { PartyLogoUploader } from '@/components/student/PartyLogoUploader';

interface StudentProfileProps {
  profile?: any;
  isOwnProfile?: boolean;
  variant?: 'default' | 'integrated';
}

export const StudentProfile: React.FC<StudentProfileProps> = ({ 
  profile: externalProfile, 
  isOwnProfile = false,
  variant = 'default'
}) => {
  const { profile: authProfile } = useAuth();
  
  // Use passed profile or fall back to auth profile
  const profile = externalProfile || authProfile;

  // Manifesto data (may need to be fetched separately if not in the passed profile)
  const [manifesto, setManifesto] = useState<{
    about: string;
    problems: string[];
    solutions: string[];
  }>({ about: '', problems: [], solutions: [] });

  useEffect(() => {
    if (!profile?.id) return;

    // Check if manifesto data is already in the profile object
    if (profile.manifesto_about !== undefined) {
      setManifesto({
        about: profile.manifesto_about || '',
        problems: Array.isArray(profile.manifesto_problems)
          ? profile.manifesto_problems.map((p: any) => typeof p === 'string' ? p : p.text || '')
          : [],
        solutions: Array.isArray(profile.manifesto_solutions)
          ? profile.manifesto_solutions.map((s: any) => typeof s === 'string' ? s : s.text || '')
          : [],
      });
    } else {
      // Fetch manifesto data
      const fetchManifesto = async () => {
        try {
          const { data } = await supabase
            .from('profiles')
            .select('manifesto_about, manifesto_problems, manifesto_solutions')
            .eq('id', profile.id)
            .single();
          if (data) {
            setManifesto({
              about: (data as any).manifesto_about || '',
              problems: Array.isArray((data as any).manifesto_problems)
                ? (data as any).manifesto_problems.map((p: any) => typeof p === 'string' ? p : p.text || '')
                : [],
              solutions: Array.isArray((data as any).manifesto_solutions)
                ? (data as any).manifesto_solutions.map((s: any) => typeof s === 'string' ? s : s.text || '')
                : [],
            });
          }
        } catch (err) {
          console.error('Error fetching manifesto:', err);
        }
      };
      fetchManifesto();
    }
  }, [profile?.id, profile?.manifesto_about]);

  // Editable bench alignment (ruling party / opposition)
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

  if (!profile) return null;

  // Derived values
  const name = profile.name || 'Delegate';
  const position = profile.position || 'Member of Parliament';
  const serialNumber = profile.serial_number || '—';
  const partyName = profile.party_name || null;
  const partyNumber = profile.party_number ?? 0;
  const partyAlignment = alignment;
  const partyLogoUrl = profile.party_logo_url || null;
  const committee = profile.committee || null;
  const constituency = profile.constituency || '—';
  const state = profile.state || '—';
  const city = profile.city || '—';
  const photoUrl = profile.photo_url || null;
  const isActive = profile.is_active !== false;
  const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase();
  // Journalists and admin students sit outside party politics — no party, always Non-Aligned
  const isStaffRole = /journalist|admin/i.test(position);
  const isJournalist = /journalist/i.test(position);
  // Staff roles are fixed for the event, so their responsibilities are static copy
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

  const photoSrc = photoUrl
    ? `${photoUrl}${photoUrl.includes('?') ? '&' : '?'}cb=${profile.updated_at ? new Date(profile.updated_at).getTime() : ''}`
    : undefined;

  return (
    <div className="w-full">
      {/* Hero Banner */}
      <div className="relative mb-12">
        <div className="bg-primary h-48 md:h-64 rounded-[2.5rem] overflow-hidden relative shadow-[0_8px_30px_rgba(46,65,172,0.06)]">
          <div className="absolute inset-0 opacity-20 mix-blend-overlay">
            <div className="w-full h-full bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMCAwaDIwdjIwSDB6TTIwIDIwaDIwdjIwSDIweiIvPjwvZz48L2c+PC9zdmc+')] bg-repeat" />
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-primary/80 via-primary/20 to-transparent" />
          {/* Name inside the banner so it's always on the blue background */}
          <div className="absolute bottom-5 left-48 right-8 z-10">
            <h1 className="font-headline text-2xl md:text-4xl font-extrabold tracking-tight text-white drop-shadow">
              {name}
            </h1>
          </div>
        </div>
        {/* Avatar overlapping the banner bottom */}
        <div className="absolute -bottom-8 left-8 z-20">
          <div className="relative shrink-0">
            <div className="w-32 h-32 md:w-40 md:h-40 rounded-[2rem] border-[6px] border-[#f7f9fb] bg-[#ffffff] overflow-hidden shadow-xl relative group/avatar">
              {photoSrc ? (
                <img
                  className="w-full h-full object-cover"
                  alt={`${name}'s profile`}
                  src={photoSrc}
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/40 text-primary text-4xl font-black">
                  {initials}
                </div>
              )}
            </div>
            {isOwnProfile && (
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2">
                <ProfilePhotoUploader currentPhotoUrl={photoUrl} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mt-16">
        {isStaffRole ? (
          <>
            {/* Left Column: Staff Role Card */}
            <div className="md:col-span-4 space-y-6">
              <div className="bg-surface-container-lowest p-6 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5 3.5 9.74 9 11 5.5-1.26 9-6 9-11V5l-9-4z"/></svg>
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Staff Role</p>

                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/30 flex items-center justify-center text-primary shrink-0">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5 3.5 9.74 9 11 5.5-1.26 9-6 9-11V5l-9-4z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/></svg>
                  </div>
                  <div>
                    <h3 className="font-headline text-lg font-bold text-on-surface leading-tight">{position}</h3>
                    <p className="text-xs font-semibold mt-1 text-gray-400 uppercase tracking-wider">{staffInfo.subtitle}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mb-5">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${getAlignmentColor('non_aligned')}`}>
                    {getAlignmentLabel('non_aligned')}
                  </span>
                </div>

                <div className="space-y-3 border-t border-surface-variant/30 pt-4">
                  <div className="flex justify-between text-xs">
                    <span className="text-on-surface-variant">Serial Number</span>
                    <span className="font-bold">#{serialNumber}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-on-surface-variant">Status</span>
                    <span className={`font-bold flex items-center gap-1.5 ${isActive ? 'text-emerald-600' : 'text-red-500'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-red-500'}`} />
                      {isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Roles & Responsibilities */}
            <div className="md:col-span-8 bg-surface-container-lowest p-6 md:p-8 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="font-headline text-xl md:text-2xl font-extrabold tracking-tight">Roles &amp; Responsibilities</h2>
                  <p className="text-on-surface-variant text-xs font-medium opacity-80 mt-1">{staffInfo.subtitle}</p>
                </div>
                <svg className="w-10 h-10 text-primary opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/>
                </svg>
              </div>
              <div className="space-y-3">
                {staffInfo.responsibilities.map((item, i) => (
                  <div key={i} className="flex items-start gap-3 bg-surface-container-low/50 p-4 rounded-2xl">
                    <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-black text-xs shrink-0">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <p className="font-semibold text-on-surface text-sm leading-snug">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
        {/* Left Column: Party & Constituency */}
        <div className="md:col-span-4 space-y-6">
          {/* Party Identity Card */}
          <div className="bg-surface-container-lowest p-6 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 24 24"><path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Political Affiliation</p>

            {/* Party Logo + Name */}
            <div className="flex items-center gap-4 mb-6">
              <div className="relative shrink-0">
                <div className="w-16 h-16 rounded-2xl bg-white border border-gray-200 overflow-hidden shadow-sm flex items-center justify-center">
                  {partyLogoUrl ? (
                    <img
                      src={`${partyLogoUrl}${partyLogoUrl.includes('?') ? '&' : '?'}cb=${profile.updated_at ? new Date(profile.updated_at).getTime() : ''}`}
                      alt={`${partyName} logo`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary/10 to-primary/30 flex items-center justify-center text-primary font-black text-2xl">
                      {partyName ? partyName.charAt(0) : '?'}
                    </div>
                  )}
                </div>
                {/* Upload button for own profile */}
                {isOwnProfile && (
                  <div className="absolute -bottom-1 -right-1">
                    <PartyLogoUploader currentLogoUrl={partyLogoUrl} />
                  </div>
                )}
              </div>
              <div>
                <h3 className="font-headline text-lg font-bold text-on-surface leading-tight">
                  {partyName || 'Independent'}
                </h3>
                <p className="text-xs font-semibold mt-1 text-gray-400 uppercase tracking-wider">
                  Yi Parliamentary Bloc
                </p>
              </div>
            </div>

            {/* Tag pills: Party Number, Committee, Alignment */}
            <div className="flex flex-wrap gap-2 mb-5">
              {/* Party Number Tag — journalists/admin students have no party */}
              {!isStaffRole && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/></svg>
                  Party {partyNumber}
                </span>
              )}

              {/* Committee Tag */}
              {committee && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/10 text-indigo-700 border border-indigo-200">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/></svg>
                  {committee}
                </span>
              )}

              {/* Alignment Tag — journalists/admin students are always Non-Aligned */}
              {isStaffRole ? (
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${getAlignmentColor('non_aligned')}`}>
                  {getAlignmentLabel('non_aligned')}
                </span>
              ) : isOwnProfile ? (
                <div className="inline-flex items-center gap-1 p-1 rounded-full bg-gray-100 border border-gray-200">
                  <button
                    type="button"
                    disabled={savingAlignment}
                    onClick={() => handleAlignmentChange('ruling_party')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all disabled:opacity-60 ${
                      partyAlignment === 'ruling_party'
                        ? 'bg-emerald-500 text-white shadow-sm'
                        : 'text-gray-500 hover:text-emerald-600'
                    }`}
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/></svg>
                    Ruling Party
                  </button>
                  <button
                    type="button"
                    disabled={savingAlignment}
                    onClick={() => handleAlignmentChange('opposition')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all disabled:opacity-60 ${
                      partyAlignment === 'opposition'
                        ? 'bg-red-500 text-white shadow-sm'
                        : 'text-gray-500 hover:text-red-600'
                    }`}
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/></svg>
                    Opposition
                  </button>
                </div>
              ) : (
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${getAlignmentColor(partyAlignment)}`}>
                  {partyAlignment === 'ruling_party' && (
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/></svg>
                  )}
                  {partyAlignment === 'opposition' && (
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/></svg>
                  )}
                  {getAlignmentLabel(partyAlignment)}
                </span>
              )}
            </div>

            {/* Detail rows */}
            <div className="space-y-3 border-t border-surface-variant/30 pt-4">
              <div className="flex justify-between text-xs">
                <span className="text-on-surface-variant">Role Type</span>
                <span className="font-bold">{position}</span>
              </div>
            </div>
          </div>

          {/* Constituency Details */}
          <div className="bg-surface-container-lowest p-6 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Constituency Details</p>
            <div className="h-40 bg-surface-container-high rounded-xl mb-4 overflow-hidden relative">
              <div className="w-full h-full bg-gradient-to-br from-primary/5 to-primary/15 flex items-center justify-center">
                <svg className="w-16 h-16 text-primary/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/>
                  <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/>
                </svg>
              </div>
              <div className="absolute inset-0 bg-primary/5" />
            </div>
            <h3 className="font-headline text-lg font-bold text-on-surface">{constituency}</h3>
            <p className="text-on-surface-variant text-xs flex items-center gap-1 mt-1 font-medium opacity-85">
              <svg className="w-3.5 h-3.5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/>
              </svg>
              {state}{city !== '—' ? `, ${city}` : ''}
            </p>
            <div className="mt-4 pt-4 border-t border-surface-variant/30 grid grid-cols-2 gap-4">
              <div>
                <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">Serial Number</p>
                <p className="font-bold text-sm text-on-surface">#{serialNumber}</p>
              </div>
              <div>
                <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">Status</p>
                <p className={`font-bold text-sm flex items-center gap-1.5 ${isActive ? 'text-emerald-600' : 'text-red-500'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  {isActive ? 'Active' : 'Inactive'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Civic Agenda & Manifesto */}
        <div className="md:col-span-8 bg-surface-container-lowest p-6 md:p-8 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="font-headline text-xl md:text-2xl font-extrabold tracking-tight">Civic Agenda</h2>
                <p className="text-on-surface-variant text-xs font-medium opacity-80 mt-1">
                  Strategic Manifesto for {constituency}
                </p>
              </div>
              <svg className="w-10 h-10 text-primary opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/>
              </svg>
            </div>

            {/* About / Description */}
            {manifesto.about && (
              <div className="bg-surface-container-low/50 p-5 rounded-2xl mb-6">
                <p className="text-sm text-on-surface-variant leading-relaxed">{manifesto.about}</p>
              </div>
            )}

            {/* Challenges & Solutions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Challenges */}
              <div>
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                  <span className="text-red-500 text-lg">!</span>
                  Key Challenges ({manifesto.problems.length})
                </h4>
                <div className="space-y-3">
                  {manifesto.problems.map((problem, i) => (
                    <div key={i} className="group bg-surface-container-low/50 hover:bg-surface-container p-4 rounded-2xl transition-all duration-300">
                      <div className="flex items-start gap-3">
                        <span className="w-7 h-7 rounded-lg bg-red-500/10 text-red-600 flex items-center justify-center font-black text-xs shrink-0">
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <p className="font-semibold text-on-surface text-sm leading-snug">{problem}</p>
                      </div>
                    </div>
                  ))}
                  {manifesto.problems.length === 0 && (
                    <p className="text-gray-400 text-sm italic py-4">No challenges added yet.</p>
                  )}
                </div>
              </div>

              {/* Solutions */}
              <div>
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/>
                  </svg>
                  Proposed Solutions ({manifesto.solutions.length})
                </h4>
                <div className="space-y-3">
                  {manifesto.solutions.map((solution, i) => (
                    <div key={i} className="group bg-emerald-50/50 hover:bg-emerald-50 p-4 rounded-2xl transition-all duration-300">
                      <div className="flex items-start gap-3">
                        <span className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center font-black text-xs shrink-0">
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <p className="font-semibold text-emerald-800 text-sm leading-snug">{solution}</p>
                      </div>
                    </div>
                  ))}
                  {manifesto.solutions.length === 0 && (
                    <p className="text-gray-400 text-sm italic py-4">No solutions drafted yet.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
          </>
        )}
      </div>
    </div>
  );
};