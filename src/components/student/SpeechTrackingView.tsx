// Read-only speech tracker for the Speaker / Deputy Speaker role.
// Same Civic Canvas visual design as AdminSpeechTracker, but with
// no +1 / Undo action buttons — view only.
import { useAdminSpeechTracking } from '@/hooks/useAdminSpeechTracking';
import { formatDistanceToNow } from 'date-fns';

const PARTY_COLORS: Record<number, string> = {
  0: 'bg-error-container text-on-error-container',
  1: 'bg-primary-fixed text-on-primary-fixed-variant',
  2: 'bg-secondary-fixed text-on-secondary-fixed-variant',
  3: 'bg-tertiary-fixed/30 text-tertiary-container',
  4: 'bg-primary-fixed-dim/30 text-on-primary-fixed-variant',
};
const partyColor = (n: number) => PARTY_COLORS[n] ?? 'bg-surface-container text-on-surface-variant';
const partyLabel = (n: number) => (['No Party', 'A', 'B', 'C', 'D', 'E'] as const)[n] ?? String(n);

const StatCard = ({
  value, label, icon, color = 'text-primary',
}: { value: number; label: string; icon: string; color?: string }) => (
  <div className="bg-white p-6 rounded-3xl border border-outline-variant/10 shadow-sm">
    <div className="w-11 h-11 bg-primary/8 rounded-xl flex items-center justify-center mb-4">
      <span className={`material-symbols-outlined text-xl ${color}`} style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
    </div>
    <p className="text-[10px] text-on-surface-variant/50 font-black uppercase tracking-[0.2em] mb-1 font-headline">{label}</p>
    <h3 className="text-2xl font-extrabold font-headline tracking-tight text-primary">{value.toLocaleString()}</h3>
  </div>
);

export const SpeechTrackingView = () => {
  const {
    students,
    loading,
    filters,
    setFilters,
    totalCount,
    filteredCount,
  } = useAdminSpeechTracking();

  const uniqueParties = Array.from(new Set(students.map(s => s.party_number))).sort((a, b) => a - b);

  const spokeCount       = students.filter(s => s.speech_count > 0).length;
  const notSpokeCount    = students.filter(s => s.speech_count === 0).length;
  const totalSpeeches    = students.reduce((sum, s) => sum + s.speech_count, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const FilterPill = ({
    active, onClick, icon, label,
  }: { active: boolean; onClick: () => void; icon: string; label: string }) => (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[11px] font-black font-headline uppercase tracking-wide transition-all ${
        active
          ? 'bg-primary text-white shadow-[0_2px_8px_rgba(19,41,143,0.25)]'
          : 'bg-surface-container-lowest border border-outline-variant/20 text-on-surface-variant hover:border-primary/20 hover:text-primary'
      }`}
    >
      {icon && <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }}>{icon}</span>}
      {label}
    </button>
  );

  // Get party name from the students list (use party_name if available, else Party A/B/C)
  const getPartyLabel = (partyNum: number) => {
    const sample = students.find(s => s.party_number === partyNum);
    return (sample as any)?.party_name || `Party ${partyLabel(partyNum)}`;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard value={totalCount}     label="Total Delegates"  icon="group"    color="text-primary" />
        <StatCard value={spokeCount}     label="Have Spoken"      icon="mic"       color="text-tertiary" />
        <StatCard value={notSpokeCount}  label="Not Spoken Yet"   icon="mic_off"   color="text-secondary" />
        <StatCard value={totalSpeeches}  label="Total Speeches"   icon="campaign"  color="text-primary" />
      </div>

      {/* ── Search + Filters ── */}
      <div className="space-y-3">
        {/* Search */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-3 bg-white border border-outline-variant/20 rounded-2xl flex-1 shadow-sm">
            <span className="material-symbols-outlined text-outline text-[20px]">search</span>
            <input
              className="flex-1 bg-transparent border-none focus:ring-0 text-sm font-medium font-body outline-none placeholder:text-on-surface-variant/40 text-on-surface"
              placeholder="Search by name or serial number..."
              value={filters.searchQuery}
              onChange={e => setFilters({ ...filters, searchQuery: e.target.value })}
            />
            {filters.searchQuery && (
              <button onClick={() => setFilters({ ...filters, searchQuery: '' })} className="text-outline hover:text-on-surface transition-colors">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            )}
          </div>
          <span className="text-xs text-on-surface-variant/60 font-body shrink-0">
            <span className="font-bold text-on-surface">{filteredCount}</span> / {totalCount}
          </span>
        </div>

        {/* Filter pills */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Speech status */}
          <FilterPill active={filters.hasSpeech === 'all'}         onClick={() => setFilters({ ...filters, hasSpeech: 'all' })}         icon="group"   label="All" />
          <FilterPill active={filters.hasSpeech === 'spoken'}      onClick={() => setFilters({ ...filters, hasSpeech: 'spoken' })}      icon="mic"     label="Spoken" />
          <FilterPill active={filters.hasSpeech === 'not-spoken'}  onClick={() => setFilters({ ...filters, hasSpeech: 'not-spoken' })}  icon="mic_off" label="Not Spoken" />

          {/* Party pills */}
          {uniqueParties.length > 0 && (
            <>
              <div className="w-px h-5 bg-outline-variant/30 mx-0.5" />
              <FilterPill active={filters.partyNumber === null} onClick={() => setFilters({ ...filters, partyNumber: null })} icon="flag" label="All Parties" />
              {uniqueParties.map(party => (
                <FilterPill
                  key={party}
                  active={filters.partyNumber === party}
                  onClick={() => setFilters({ ...filters, partyNumber: party })}
                  icon="groups"
                  label={getPartyLabel(party)}
                />
              ))}
            </>
          )}
        </div>
      </div>

      {/* ── Student rows (read-only) ── */}
      {students.length === 0 ? (
        <div className="bg-white rounded-3xl border border-outline-variant/10 shadow-sm px-8 py-16 text-center">
          <span className="material-symbols-outlined text-[48px] text-on-surface-variant/20 block mb-3" style={{ fontVariationSettings: "'FILL' 1" }}>group</span>
          <p className="text-sm text-on-surface-variant/50 font-body">No students found. Try adjusting your filters.</p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-outline-variant/10 shadow-sm overflow-hidden">
          <div className="divide-y divide-outline-variant/10">
            {students.map(student => (
              <div key={student.user_id} className="flex items-center gap-4 px-6 py-4 hover:bg-surface-container-lowest transition-colors">

                {/* Serial */}
                <span className="text-[11px] font-black text-primary/60 font-headline w-10 text-center shrink-0">
                  #{student.serial_number}
                </span>

                {/* Avatar */}
                <div className="relative shrink-0">
                  {student.photo_url ? (
                    <img src={student.photo_url} alt={student.name} className="w-11 h-11 rounded-2xl object-cover" />
                  ) : (
                    <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-headline font-bold text-primary">
                        {student.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                      </span>
                    </div>
                  )}
                  {student.speech_count > 0 && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-primary rounded-full border-2 border-white" />
                  )}
                </div>

                {/* Name + position */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-headline font-bold text-on-surface text-sm">{student.name}</span>
                    <span className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-widest rounded-md font-headline ${partyColor(student.party_number)}`}>
                      {getPartyLabel(student.party_number)}
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-variant/50 font-body truncate mt-0.5">
                    {student.position}{student.constituency ? ` · ${student.constituency}` : ''}
                  </p>
                  {student.last_speech_at && (
                    <p className="text-[10px] text-on-surface-variant/40 font-body flex items-center gap-1 mt-0.5">
                      <span className="material-symbols-outlined text-[11px]">schedule</span>
                      Last: {formatDistanceToNow(new Date(student.last_speech_at), { addSuffix: true })}
                    </p>
                  )}
                </div>

                {/* Speech count badge — read only, no action buttons */}
                <div className={`flex items-center gap-2 px-4 py-2 rounded-2xl font-headline font-black text-sm shrink-0 ${
                  student.speech_count > 0
                    ? 'bg-primary/8 text-primary'
                    : 'bg-surface-container text-on-surface-variant/40'
                }`}>
                  <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>mic</span>
                  {student.speech_count} {student.speech_count === 1 ? 'speech' : 'speeches'}
                </div>

              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
