import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
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
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);

  useEffect(() => {
    fetchProfiles();
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
        .order('name');
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

  const source = searchTerm ? filteredProfiles : profiles;

  const speaker = profiles.find(p => p.position?.toLowerCase().includes('speaker') && !p.position?.toLowerCase().includes('deputy'));
  const rulingMembers   = profiles.filter(p => p.party_alignment === 'ruling_party');
  const oppositionMembers = profiles.filter(p => p.party_alignment === 'opposition');
  const independentMembers = profiles.filter(p => !p.party_alignment || p.party_alignment === 'non_aligned');

  const leaderOfHouse = rulingMembers.find(p => p.position?.toLowerCase().includes('leader of the house'));
  const ministers = rulingMembers.filter(p =>
    (p.ministry && p.ministry.length > 0) || p.position?.toLowerCase().includes('minister')
  );

  // Deduplicated front bench (leader + ministers)
  const frontBenchMap = new Map<string, Profile>();
  if (leaderOfHouse) frontBenchMap.set(leaderOfHouse.id, leaderOfHouse);
  ministers.forEach(m => frontBenchMap.set(m.id, m));
  const frontBench = Array.from(frontBenchMap.values());

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

  const govSource  = source.filter(p => p.party_alignment === 'ruling_party' && p.id !== speaker?.id);
  const oppSource  = source.filter(p => p.party_alignment === 'opposition');
  const indSource  = source.filter(p => !p.party_alignment || p.party_alignment === 'non_aligned');
  const fbSource   = searchTerm ? frontBench.filter(p => source.some(s => s.id === p.id)) : frontBench;

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

        {/* Tier 2: Executive Front Bench */}
        {fbSource.length > 0 && (
          <section className="w-full">
            <div className="flex flex-col items-center mb-4">
              <div className="px-3 py-1 bg-surface-container-high rounded-full">
                <span className="text-[9px] font-bold text-primary tracking-widest uppercase">Executive Front Bench</span>
              </div>
            </div>
            <div className="flex flex-wrap justify-center gap-4 max-w-5xl mx-auto px-4 pb-2">
              {fbSource.map(person => (
                <ExecutiveCard key={person.id} person={person} onClick={handleMemberClick} />
              ))}
            </div>
          </section>
        )}

        {/* Tier 3: Assembly Floor Grid */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 w-full">

          {/* Government Alliance */}
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b-2 border-primary/10 pb-2">
              <div className="flex items-baseline gap-2">
                <h3 className="font-headline font-extrabold text-primary text-sm uppercase tracking-wider">Government Alliance</h3>
                <span className="text-[9px] text-on-surface-variant font-bold tracking-widest uppercase">Treasury Benches</span>
              </div>
              <span className="text-[10px] font-bold bg-primary text-white px-2 py-0.5 rounded-full shadow-sm">
                {rulingMembers.filter(p => p.id !== speaker?.id).length} Members
              </span>
            </div>
            <div
              className="overflow-y-auto max-h-[400px] pr-1 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-outline-variant [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent"
              style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem' }}
            >
              {govSource.map(p => (
                <AssemblyCard key={p.id} person={p} side="ruling" onClick={handleMemberClick} />
              ))}
              {govSource.length === 0 && (
                <p className="text-xs text-on-surface-variant/50 italic col-span-full text-center py-4">No members found</p>
              )}
            </div>
          </div>

          {/* Opposition Union */}
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b-2 border-secondary/10 pb-2">
              <div className="flex items-baseline gap-2">
                <h3 className="font-headline font-extrabold text-secondary text-sm uppercase tracking-wider">Opposition Union</h3>
                <span className="text-[9px] text-on-surface-variant font-bold tracking-widest uppercase">Loyal Opposition</span>
              </div>
              <span className="text-[10px] font-bold bg-secondary text-white px-2 py-0.5 rounded-full shadow-sm">
                {oppositionMembers.length} Members
              </span>
            </div>
            <div
              className="overflow-y-auto max-h-[400px] pr-1 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-outline-variant [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent"
              style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem' }}
            >
              {oppSource.map(p => (
                <AssemblyCard key={p.id} person={p} side="opposition" onClick={handleMemberClick} />
              ))}
              {oppSource.length === 0 && (
                <p className="text-xs text-on-surface-variant/50 italic col-span-full text-center py-4">No members found</p>
              )}
            </div>
          </div>
        </section>

        {/* Tier 4: Non-Aligned & Independent */}
        {(indSource.length > 0 || (!searchTerm && independentMembers.length > 0)) && (
          <section className="w-full mt-4">
            <div className="w-full flex items-center gap-4 mb-4">
              <div className="h-px flex-1 bg-outline-variant/20"></div>
              <span className="text-[9px] font-bold text-outline uppercase tracking-widest whitespace-nowrap">
                Non-Aligned &amp; Independent ({independentMembers.length})
              </span>
              <div className="h-px flex-1 bg-outline-variant/20"></div>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              {indSource.map(person => (
                <PillCard key={person.id} person={person} onClick={handleMemberClick} />
              ))}
              {indSource.length === 0 && searchTerm && (
                <p className="text-xs text-on-surface-variant/50 italic">No independent delegates match your search</p>
              )}
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

const ExecutiveCard = ({ person, onClick }: { person: Profile; onClick: (id: string) => void }) => {
  const initials = person.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';
  return (
    <div
      onClick={() => onClick(person.id)}
      className="bg-surface-container-lowest p-3 rounded-xl shadow-sm border border-outline-variant/10 w-56 flex-shrink-0 cursor-pointer hover:scale-[1.02] transition-transform"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg overflow-hidden bg-surface-container flex-shrink-0 flex items-center justify-center text-xs font-bold text-primary">
          {person.photo_url
            ? <img src={person.photo_url} className="w-full h-full object-cover" alt={person.name} />
            : initials
          }
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-xs truncate">{person.name}</h4>
          <p className="text-primary text-[9px] font-bold truncate">{person.position}</p>
          <span className="px-1.5 py-0.5 bg-secondary-fixed text-on-secondary-fixed text-[7px] rounded uppercase font-bold mt-0.5 inline-block">Govt</span>
        </div>
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
