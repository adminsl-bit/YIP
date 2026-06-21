import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { StudentProfile } from './StudentProfile';

interface Profile {
  id: string;
  user_id: string;
  name: string;
  position: string;
  party_number: number;
  party_name?: string;
  constituency?: string;
  state?: string;
  photo_url?: string;
  email?: string;
  committee?: string;
  ministry?: string;
  preevent_scores?: number;
  organizer_manual_score?: number;
  serial_number: number;
  user_type: string;
  city?: string;
  manifesto_about?: string;
  manifesto_problems?: any[];
  manifesto_solutions?: any[];
  updated_at?: string;
  party_alignment?: string;
  party_logo_url?: string;
  is_active?: boolean;
}

export const ParliamentTree = () => {
  const { profile: authProfile } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (authProfile?.event_id) fetchProfiles();
  }, [authProfile?.event_id]);

  useEffect(() => {
    const channel = supabase
      .channel('public:profiles-tree')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        fetchProfiles();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id, user_id, name, position, party_number, party_name, constituency,
          state, city, photo_url, email, committee, serial_number, user_type,
          updated_at, party_alignment, ministry, party_logo_url, is_active
        `)
        .eq('user_type', 'student')
        .eq('event_id', authProfile?.event_id ?? '')
        .order('serial_number');
      if (error) throw error;
      setProfiles(data || []);
    } catch (err) {
      console.error('Error fetching profiles:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredProfiles = profiles.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.position?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.constituency?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.party_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.committee?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // ── Role classification ──────────────────────────────────────────────────
  const p = (s: Profile) => (s.position ?? '').toLowerCase();

  const speaker       = profiles.find(s => p(s).includes('speaker') && !p(s).includes('deputy'));
  const deputySpeakers = profiles.filter(s => p(s).includes('deputy speaker'));

  const primeMinister       = profiles.find(s => p(s).includes('prime minister'));
  const leaderOfOpposition  = profiles.find(s => p(s).includes('leader of opposition'));
  const rulingPartyLeaders  = profiles.filter(s => p(s).includes('party leader') && s.party_alignment === 'ruling_party' && s !== primeMinister);
  const oppPartyLeaders     = profiles.filter(s => p(s).includes('party leader') && s.party_alignment === 'opposition' && s !== leaderOfOpposition);
  const ministers           = profiles.filter(s =>
    p(s).includes('minister') && !p(s).includes('prime') && !p(s).includes('shadow')
  );
  // Match by position text alone — don't require party_alignment since it may not be set
  const shadowMinisters     = profiles.filter(s => p(s).includes('shadow minister'));

  const specialIds = new Set([
    speaker?.id, ...deputySpeakers.map(s => s.id),
    primeMinister?.id, leaderOfOpposition?.id,
    ...rulingPartyLeaders.map(s => s.id), ...oppPartyLeaders.map(s => s.id),
    ...ministers.map(s => s.id), ...shadowMinisters.map(s => s.id),
  ].filter(Boolean) as string[]);

  const rulingMPs      = profiles.filter(s => s.party_alignment === 'ruling_party'  && !specialIds.has(s.id));
  const oppositionMPs  = profiles.filter(s => s.party_alignment === 'opposition'     && !specialIds.has(s.id));
  const independentMembers = profiles.filter(s => (!s.party_alignment || s.party_alignment === 'non_aligned') && !specialIds.has(s.id));

  // Filtered source for search
  const source = searchTerm ? filteredProfiles : profiles;
  const govSource  = source.filter(s => s.party_alignment === 'ruling_party'  && !specialIds.has(s.id));
  const oppSource  = source.filter(s => s.party_alignment === 'opposition'     && !specialIds.has(s.id));
  const indSource  = source.filter(s => (!s.party_alignment || s.party_alignment === 'non_aligned') && !specialIds.has(s.id));

  const handleMemberClick = async (profileId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('manifesto_about, manifesto_problems, manifesto_solutions')
        .eq('id', profileId)
        .single();
      if (error) throw error;
      const base = profiles.find(p => p.id === profileId);
      if (base) setSelectedProfile({ ...base, ...data });
    } catch (err) {
      console.error('Error fetching profile details:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <div className="w-12 h-12 border-4 border-indigo-100 border-t-primary rounded-full animate-spin"></div>
        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Constructing Assembly...</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-10">

        {/* Header & Search */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-4xl font-extrabold font-headline tracking-tight text-primary">The Assembly <span className="text-secondary">Floor</span></h1>
            <p className="text-[10px] text-on-surface-variant/40 font-black uppercase tracking-[0.4em] mt-3 flex items-center gap-2 font-headline">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              Representatives of the Sovereign Will
            </p>
          </div>
          <div className="relative w-full sm:w-80">
            <input
              className="w-full bg-surface-container-high border-none rounded-full py-2.5 px-6 pl-12 focus:ring-2 focus:ring-primary/20 text-sm placeholder:text-outline outline-none"
              placeholder={`Search ${profiles.length}+ delegates...`}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline text-[16px]">search</span>
          </div>
        </header>

        {/* Tier 1: Presiding Authority */}
        <section className="flex flex-col items-center">
          <div className="px-3 py-1 bg-surface-container-high rounded-full mb-3">
            <span className="text-[9px] font-bold text-primary tracking-widest uppercase">Presiding Authority</span>
          </div>
          {speaker ? (
            <div
              onClick={() => handleMemberClick(speaker.id)}
              className="bg-surface-container-lowest p-4 rounded-xl shadow-md border border-outline-variant/10 w-72 cursor-pointer hover:shadow-xl transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary/10 rounded-lg overflow-hidden border border-primary/20 flex-shrink-0 flex items-center justify-center text-primary text-xl font-bold">
                  {speaker.photo_url
                    ? <img src={speaker.photo_url} className="w-full h-full object-cover" alt={speaker.name} />
                    : speaker.name?.charAt(0) || '?'
                  }
                </div>
                <div className="flex flex-col">
                  <h3 className="font-bold text-sm text-primary truncate max-w-[160px]">{speaker.name}</h3>
                  <p className="text-primary font-bold text-[10px]">Speaker of the House</p>
                </div>
                <div className="ml-auto">
                  <span className="material-symbols-outlined text-primary text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>crown</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/10 w-72 opacity-40 text-center">
              <p className="text-xs text-on-surface-variant">No Speaker assigned</p>
            </div>
          )}
        </section>

        {/* Deputy Speakers */}
        {deputySpeakers.length > 0 && (
          <section className="flex flex-wrap justify-center gap-3">
            {deputySpeakers.map(ds => (
              <div key={ds.id} onClick={() => handleMemberClick(ds.id)}
                className="bg-surface-container-lowest p-3 rounded-xl border border-outline-variant/10 flex items-center gap-3 cursor-pointer hover:shadow-md transition-all w-56">
                <div className="w-9 h-9 rounded-lg overflow-hidden bg-surface-container flex-shrink-0 flex items-center justify-center text-xs font-bold text-primary">
                  {ds.photo_url ? <img src={ds.photo_url} className="w-full h-full object-cover" alt={ds.name} /> : ds.name?.charAt(0)}
                </div>
                <div>
                  <h4 className="font-bold text-xs truncate">{ds.name}</h4>
                  <p className="text-[9px] text-primary font-bold uppercase tracking-wider">Deputy Speaker</p>
                </div>
              </div>
            ))}
          </section>
        )}

        {/* Tier 2 & 3: Ruling vs Opposition — side by side */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 w-full">

          {/* ── RULING COALITION ── */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b-2 border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <h3 className="font-headline font-extrabold text-emerald-700 text-sm uppercase tracking-wider">Ruling Coalition</h3>
              <span className="ml-auto text-[10px] font-bold bg-emerald-500 text-white px-2 py-0.5 rounded-full">
                {profiles.filter(s => s.party_alignment === 'ruling_party').length}
              </span>
            </div>

            {/* Prime Minister */}
            {primeMinister && (
              <SpecialRoleCard person={primeMinister} role="Prime Minister" accent="emerald" badge="crown" onClick={handleMemberClick} />
            )}

            {/* Ruling Party Leaders */}
            {rulingPartyLeaders.length > 0 && (
              <div>
                <p className="text-[8px] font-black text-on-surface-variant/40 uppercase tracking-widest mb-1.5">Party Leaders</p>
                <div className="space-y-1.5">
                  {rulingPartyLeaders.map(s => <FrontBenchCard key={s.id} person={s} accent="emerald" onClick={handleMemberClick} />)}
                </div>
              </div>
            )}

            {/* Cabinet Ministers */}
            {ministers.length > 0 && (
              <div>
                <p className="text-[8px] font-black text-on-surface-variant/40 uppercase tracking-widest mb-1.5">Cabinet Ministers</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {ministers.map(s => <FrontBenchCard key={s.id} person={s} accent="emerald" onClick={handleMemberClick} />)}
                </div>
              </div>
            )}

            {/* Regular Ruling MPs */}
            {govSource.length > 0 && (
              <div>
                <p className="text-[8px] font-black text-on-surface-variant/40 uppercase tracking-widest mb-1.5">Members of Parliament</p>
                <div className="overflow-y-auto max-h-[320px] pr-1 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-outline-variant [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent"
                  style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.5rem' }}>
                  {govSource.map(s => <AssemblyCard key={s.id} person={s} side="ruling" onClick={handleMemberClick} />)}
                </div>
              </div>
            )}
          </div>

          {/* ── OPPOSITION ── */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b-2 border-red-200">
              <span className="w-2 h-2 rounded-full bg-red-400" />
              <h3 className="font-headline font-extrabold text-red-600 text-sm uppercase tracking-wider">Opposition</h3>
              <span className="ml-auto text-[10px] font-bold bg-red-500 text-white px-2 py-0.5 rounded-full">
                {profiles.filter(s => s.party_alignment === 'opposition').length}
              </span>
            </div>

            {/* Leader of Opposition */}
            {leaderOfOpposition && (
              <SpecialRoleCard person={leaderOfOpposition} role="Leader of Opposition" accent="red" badge="campaign" onClick={handleMemberClick} />
            )}

            {/* Opposition Party Leaders */}
            {oppPartyLeaders.length > 0 && (
              <div>
                <p className="text-[8px] font-black text-on-surface-variant/40 uppercase tracking-widest mb-1.5">Party Leaders</p>
                <div className="space-y-1.5">
                  {oppPartyLeaders.map(s => <FrontBenchCard key={s.id} person={s} accent="red" onClick={handleMemberClick} />)}
                </div>
              </div>
            )}

            {/* Shadow Cabinet — same display style as Cabinet Ministers */}
            {shadowMinisters.length > 0 && (
              <div>
                <p className="text-[8px] font-black text-on-surface-variant/40 uppercase tracking-widest mb-1.5">Shadow Cabinet</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {shadowMinisters.map(s => <FrontBenchCard key={s.id} person={s} accent="red" onClick={handleMemberClick} />)}
                </div>
              </div>
            )}

            {/* Regular Opposition MPs */}
            {oppSource.length > 0 && (
              <div>
                <p className="text-[8px] font-black text-on-surface-variant/40 uppercase tracking-widest mb-1.5">Members of Parliament</p>
                <div className="overflow-y-auto max-h-[320px] pr-1 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-outline-variant [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent"
                  style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.5rem' }}>
                  {oppSource.map(s => <AssemblyCard key={s.id} person={s} side="opposition" onClick={handleMemberClick} />)}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Non-Aligned */}
        {indSource.length > 0 && (
          <section className="w-full mt-2">
            <div className="w-full flex items-center gap-4 mb-3">
              <div className="h-px flex-1 bg-outline-variant/20" />
              <span className="text-[9px] font-bold text-outline uppercase tracking-widest whitespace-nowrap">
                Non-Aligned &amp; Independent ({indSource.length})
              </span>
              <div className="h-px flex-1 bg-outline-variant/20" />
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {indSource.map(s => <PillCard key={s.id} person={s} onClick={handleMemberClick} />)}
            </div>
          </section>
        )}

      </div>

      {/* Member Profile Modal */}
      <Dialog open={!!selectedProfile} onOpenChange={() => setSelectedProfile(null)}>
        <DialogContent className="max-w-[1000px] w-[95vw] bg-transparent border-0 shadow-none p-0 overflow-hidden [&>button]:hidden">
          <DialogTitle className="sr-only">
            {selectedProfile ? `${selectedProfile.name} Profile` : 'Member Profile'}
          </DialogTitle>

          {selectedProfile && (
            <div className="bg-[#f7f9fb] w-full max-h-[88vh] rounded-[3rem] overflow-hidden relative shadow-[0_32px_128px_-16px_rgba(0,0,0,0.4)] border border-white flex flex-col">
              <button
                onClick={() => setSelectedProfile(null)}
                className="absolute top-6 right-6 z-50 w-10 h-10 bg-white/90 hover:bg-white text-slate-500 rounded-2xl flex items-center justify-center shadow-lg transition-all backdrop-blur-md group border border-white/60"
              >
                <span className="material-symbols-outlined text-[20px] transition-transform group-hover:rotate-90">close</span>
              </button>

              <div className="overflow-y-auto flex-1 px-4 md:px-8 pb-8">
                <StudentProfile profile={selectedProfile as any} variant="integrated" />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

/* ── Card sub-components ── */

// Large highlighted card for PM and LOP
const SpecialRoleCard = ({ person, role, accent, badge, onClick }: {
  person: Profile; role: string; accent: 'emerald' | 'red';
  badge: string; onClick: (id: string) => void;
}) => {
  const bg   = accent === 'emerald' ? 'bg-emerald-50 border-emerald-300/60' : 'bg-red-50 border-red-300/60';
  const text = accent === 'emerald' ? 'text-emerald-700' : 'text-red-600';
  const av   = accent === 'emerald' ? 'bg-emerald-500' : 'bg-red-500';
  const badge_bg = accent === 'emerald' ? 'bg-amber-400' : 'bg-red-500';
  return (
    <div onClick={() => onClick(person.id)}
      className={`${bg} border-2 rounded-2xl p-4 cursor-pointer flex items-center gap-4 hover:shadow-md transition-all`}>
      <div className="relative shrink-0">
        <div className="w-14 h-14 rounded-xl overflow-hidden bg-surface-container">
          {person.photo_url
            ? <img src={person.photo_url} className="w-full h-full object-cover" alt={person.name} />
            : <div className={`w-full h-full ${av} flex items-center justify-center text-white font-black text-xl`}>{person.name?.charAt(0)}</div>
          }
        </div>
        <div className={`absolute -top-1.5 -right-1.5 ${badge_bg} rounded-lg p-1 shadow`}>
          <span className="material-symbols-outlined text-white text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }}>{badge}</span>
        </div>
      </div>
      <div>
        <p className={`text-[8px] font-black tracking-widest ${text} uppercase mb-0.5`}>{role}</p>
        <h3 className="font-headline font-extrabold text-on-surface text-base leading-tight">{person.name}</h3>
        <p className="text-[10px] text-on-surface-variant/60">{person.party_name}{person.constituency ? ` · ${person.constituency}` : ''}</p>
      </div>
    </div>
  );
};

// Compact card for Party Leaders, Ministers, Shadow Ministers
const FrontBenchCard = ({ person, accent, compact, onClick }: {
  person: Profile; accent: 'emerald' | 'red'; compact?: boolean; onClick: (id: string) => void;
}) => {
  const border = accent === 'emerald' ? 'border-emerald-100 hover:border-emerald-300/50' : 'border-red-100 hover:border-red-300/50';
  const text   = accent === 'emerald' ? 'text-emerald-700' : 'text-red-600';
  const av     = accent === 'emerald' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600';
  return (
    <div onClick={() => onClick(person.id)}
      className={`border ${border} rounded-xl p-2.5 cursor-pointer flex items-center gap-2.5 hover:shadow-sm transition-all bg-white/60`}>
      <div className={`${compact ? 'w-8 h-8' : 'w-9 h-9'} rounded-lg overflow-hidden ${av} flex-shrink-0 flex items-center justify-center text-xs font-bold`}>
        {person.photo_url
          ? <img src={person.photo_url} className="w-full h-full object-cover" alt={person.name} />
          : person.name?.charAt(0)
        }
      </div>
      <div className="min-w-0 flex-1">
        <h5 className="font-bold text-xs leading-tight truncate">{person.name}</h5>
        <p className={`text-[8px] font-bold ${text} truncate uppercase tracking-wider`}>{person.position}</p>
      </div>
    </div>
  );
};

const AssemblyCard = ({ person, side, onClick }: { person: Profile; side: 'ruling' | 'opposition'; onClick: (id: string) => void }) => {
  const initials = person.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';
  const accentColor   = side === 'ruling' ? 'text-primary' : 'text-secondary';
  const hoverBorder   = side === 'ruling' ? 'hover:border-primary/30' : 'hover:border-secondary/30';
  return (
    <div
      onClick={() => onClick(person.id)}
      className={`bg-surface-container-lowest p-2 rounded-lg border border-outline-variant/10 ${hoverBorder} hover:shadow-md transition-all cursor-pointer`}
    >
      <div className="flex items-center gap-2">
        <div className={`w-7 h-7 rounded bg-surface-container-high flex items-center justify-center text-[10px] font-bold ${accentColor} overflow-hidden flex-shrink-0`}>
          {person.photo_url
            ? <img src={person.photo_url} className="w-full h-full object-cover" alt={person.name} />
            : initials
          }
        </div>
        <div className="flex-1 overflow-hidden">
          <h5 className="text-[11px] font-bold leading-none truncate">{person.name}</h5>
          <p className="text-[8px] text-on-surface-variant truncate">{person.party_name || 'Independent'}</p>
        </div>
        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${person.is_active !== false ? 'bg-on-tertiary-container' : 'bg-outline-variant/30'}`} />
      </div>
    </div>
  );
};

const PillCard = ({ person, onClick }: { person: Profile; onClick: (id: string) => void }) => {
  const initials = person.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';
  return (
    <div
      onClick={() => onClick(person.id)}
      className="bg-surface-container-low p-1.5 px-3 rounded-full border border-outline-variant/20 flex items-center gap-2 hover:bg-white hover:shadow-sm transition-all cursor-pointer"
    >
      <div className="w-5 h-5 rounded-full bg-outline-variant/30 flex items-center justify-center text-[8px] font-bold overflow-hidden flex-shrink-0">
        {person.photo_url
          ? <img src={person.photo_url} className="w-full h-full object-cover" alt={person.name} />
          : initials
        }
      </div>
      <span className="text-[10px] font-medium">{person.name}</span>
      {person.is_active !== false && (
        <div className="w-1 h-1 rounded-full bg-on-tertiary-container flex-shrink-0" />
      )}
    </div>
  );
};

export default ParliamentTree;
