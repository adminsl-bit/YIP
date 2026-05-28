import { useAdminSpeechTracking } from '@/hooks/useAdminSpeechTracking';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';

const PARTY_COLORS: Record<number, string> = {
  0: 'bg-error-container text-on-error-container',
  1: 'bg-primary-fixed text-on-primary-fixed-variant',
  2: 'bg-secondary-fixed text-on-secondary-fixed-variant',
  3: 'bg-tertiary-fixed/30 text-tertiary-container',
  4: 'bg-primary-fixed-dim/30 text-on-primary-fixed-variant',
};
const partyColor = (n: number) => PARTY_COLORS[n] ?? 'bg-surface-container text-on-surface-variant';
const partyLabel = (n: number) => (['No Party', 'A', 'B', 'C', 'D', 'E'] as const)[n] ?? String(n);

export const AdminSpeechTracker = () => {
  const { profile } = useAuth();
  const {
    students,
    loading,
    filters,
    setFilters,
    recordSpeech,
    undoLastSpeech,
    totalCount,
    filteredCount,
  } = useAdminSpeechTracking();

  const isOrganizer = profile?.user_type === 'organizer';
  const uniqueParties = Array.from(new Set(students.map(s => s.party_number))).sort((a, b) => a - b);

  const spokeCount    = students.filter(s => s.speech_count > 0).length;
  const notSpokeCount = students.filter(s => s.speech_count === 0).length;
  const scoredCount   = students.filter(s => s.has_jury_score).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-4">
          <span className="material-symbols-outlined text-[40px] text-primary animate-spin block mx-auto">refresh</span>
          <p className="text-sm text-on-surface-variant font-body">Loading student data…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-700">

      {/* ── Organizer override banner ── */}
      {isOrganizer && (
        <div className="p-4 bg-primary-container/10 border border-primary-container/20 rounded-2xl flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-primary-container text-white flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[20px]">shield_person</span>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-headline font-bold text-sm text-primary">Organizer Override Mode</h3>
            <p className="text-xs text-on-surface-variant font-body mt-0.5">
              You can track speeches for all students and override recordings made by admin students.
            </p>
          </div>
          <div className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-full shrink-0 font-headline">
            Active Mode
          </div>
        </div>
      )}

      {/* ── Stats bento grid ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-surface-container-lowest p-6 rounded-[2rem] shadow-sm flex flex-col justify-between border-b-4 border-primary/10">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-black uppercase tracking-widest text-outline font-headline">Total Students</span>
            <span className="material-symbols-outlined text-primary/30">group</span>
          </div>
          <div className="mt-4">
            <span className="text-4xl font-extrabold text-primary font-headline">{String(totalCount).padStart(2, '0')}</span>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-6 rounded-[2rem] shadow-sm flex flex-col justify-between border-b-4 border-tertiary-fixed-dim/20">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-black uppercase tracking-widest text-outline font-headline">Have Spoken</span>
            <span className="material-symbols-outlined text-tertiary-fixed-dim/40">mic</span>
          </div>
          <div className="mt-4">
            <span className="text-4xl font-extrabold text-tertiary-container font-headline">{String(spokeCount).padStart(2, '0')}</span>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-6 rounded-[2rem] shadow-sm flex flex-col justify-between border-b-4 border-secondary-container/20">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-black uppercase tracking-widest text-outline font-headline">Not Spoken</span>
            <span className="material-symbols-outlined text-secondary-container/30">mic_off</span>
          </div>
          <div className="mt-4">
            <span className="text-4xl font-extrabold text-secondary font-headline">{String(notSpokeCount).padStart(2, '0')}</span>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-6 rounded-[2rem] shadow-sm flex flex-col justify-between border-b-4 border-primary-fixed-dim/30">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-black uppercase tracking-widest text-outline font-headline">Jury Scored</span>
            <span className="material-symbols-outlined text-primary-fixed-dim/40">grading</span>
          </div>
          <div className="mt-4">
            <span className="text-4xl font-extrabold text-on-primary-fixed-variant font-headline">{String(scoredCount).padStart(2, '0')}</span>
          </div>
        </div>
      </div>

      {/* ── Filter shell ── */}
      <div className="bg-surface-container-low rounded-[1.5rem] p-4 space-y-3">
        {/* Search row */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-surface-container-lowest rounded-2xl border border-outline-variant/20 flex-1">
            <span className="material-symbols-outlined text-outline text-[20px]">search</span>
            <input
              className="w-full bg-transparent border-none focus:ring-0 text-sm font-medium font-body outline-none placeholder:text-on-surface-variant/40 text-on-surface"
              placeholder="Search by name or serial..."
              value={filters.searchQuery}
              onChange={e => setFilters({ ...filters, searchQuery: e.target.value })}
            />
          </div>
          <span className="text-xs text-outline font-medium font-body shrink-0">
            <span className="font-bold text-on-surface">{filteredCount}</span> / <span className="font-bold text-on-surface">{totalCount}</span> students
          </span>
        </div>

        {/* Pill filters row */}
        <div className="flex flex-wrap items-center gap-2">

          {/* Speech status pills */}
          {([
            { value: 'all',       label: 'All',        icon: 'group' },
            { value: 'spoken',    label: 'Spoken',     icon: 'mic' },
            { value: 'not-spoken',label: 'Not Spoken', icon: 'mic_off' },
          ] as const).map(opt => (
            <button
              key={opt.value}
              onClick={() => setFilters({ ...filters, hasSpeech: opt.value })}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-black font-headline uppercase tracking-wide transition-all ${
                filters.hasSpeech === opt.value
                  ? 'bg-gradient-to-r from-primary to-primary-container text-white shadow-[0_2px_8px_rgba(19,41,143,0.25)]'
                  : 'bg-surface-container-lowest text-on-surface-variant border border-outline-variant/20 hover:border-primary/20 hover:text-primary'
              }`}
            >
              <span className="material-symbols-outlined text-[13px]">{opt.icon}</span>
              {opt.label}
            </button>
          ))}

          {/* Divider */}
          <div className="w-px h-5 bg-outline-variant/30 mx-1" />

          {/* Score status pills */}
          {([
            { value: 'all',        label: 'All Scores', icon: 'star_border' },
            { value: 'scored',     label: 'Scored',     icon: 'star' },
            { value: 'not-scored', label: 'No Score',   icon: 'star_half' },
          ] as const).map(opt => (
            <button
              key={opt.value}
              onClick={() => setFilters({ ...filters, hasScore: opt.value })}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-black font-headline uppercase tracking-wide transition-all ${
                filters.hasScore === opt.value
                  ? 'bg-gradient-to-r from-primary to-primary-container text-white shadow-[0_2px_8px_rgba(19,41,143,0.25)]'
                  : 'bg-surface-container-lowest text-on-surface-variant border border-outline-variant/20 hover:border-primary/20 hover:text-primary'
              }`}
            >
              <span className="material-symbols-outlined text-[13px]" style={{ fontVariationSettings: opt.value === 'scored' ? "'FILL' 1" : "'FILL' 0" }}>{opt.icon}</span>
              {opt.label}
            </button>
          ))}

          {/* Divider */}
          {uniqueParties.length > 0 && <div className="w-px h-5 bg-outline-variant/30 mx-1" />}

          {/* Party pills */}
          {uniqueParties.length > 0 && (
            <>
              <button
                onClick={() => setFilters({ ...filters, partyNumber: null })}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-black font-headline uppercase tracking-wide transition-all ${
                  filters.partyNumber === null
                    ? 'bg-gradient-to-r from-primary to-primary-container text-white shadow-[0_2px_8px_rgba(19,41,143,0.25)]'
                    : 'bg-surface-container-lowest text-on-surface-variant border border-outline-variant/20 hover:border-primary/20 hover:text-primary'
                }`}
              >
                <span className="material-symbols-outlined text-[13px]">flag</span>
                All Parties
              </button>
              {uniqueParties.map(party => (
                <button
                  key={party}
                  onClick={() => setFilters({ ...filters, partyNumber: party })}
                  className={`px-4 py-1.5 rounded-full text-xs font-black font-headline uppercase tracking-wide transition-all ${
                    filters.partyNumber === party
                      ? 'bg-gradient-to-r from-primary to-primary-container text-white shadow-[0_2px_8px_rgba(19,41,143,0.25)]'
                      : 'bg-surface-container-lowest text-on-surface-variant border border-outline-variant/20 hover:border-primary/20 hover:text-primary'
                  }`}
                >
                  Party {partyLabel(party)}
                </button>
              ))}
            </>
          )}
        </div>
      </div>

      {/* ── Student rows ── */}
      {students.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-[2rem] px-8 py-16 text-center shadow-sm">
          <span className="material-symbols-outlined text-[48px] text-on-surface-variant/20 block mb-3" style={{ fontVariationSettings: "'FILL' 1" }}>group</span>
          <p className="text-sm text-on-surface-variant/50 font-body">No students found. Try adjusting your filters.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {students.map(student => (
            <div
              key={student.user_id}
              className="group bg-surface-container-lowest rounded-3xl p-4 flex items-center justify-between shadow-sm hover:shadow-md transition-all border border-transparent hover:border-primary-fixed-dim/30"
            >
              {/* Left: serial + avatar + info */}
              <div className="flex items-center gap-5 min-w-0">
                {/* Serial */}
                <div className="text-xs font-bold text-primary bg-primary/5 px-3 py-1.5 rounded-lg w-16 text-center shrink-0 font-headline">
                  {student.serial_number}
                </div>

                {/* Avatar */}
                <div className="relative shrink-0">
                  {student.photo_url ? (
                    <img
                      src={student.photo_url}
                      alt={student.name}
                      className="w-12 h-12 rounded-2xl object-cover bg-surface-container"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                      <span className="text-base font-headline font-bold text-primary">
                        {student.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                      </span>
                    </div>
                  )}
                  {student.speech_count > 0 && (
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-tertiary-fixed rounded-full border-2 border-white animate-pulse" />
                  )}
                </div>

                {/* Name + position */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-headline font-bold text-on-surface">{student.name}</h4>
                    <span className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-widest rounded-md ${partyColor(student.party_number)}`}>
                      Party {partyLabel(student.party_number)}
                    </span>
                  </div>
                  <p className="text-xs text-outline font-medium font-body truncate">
                    {student.position}{student.constituency ? ` · ${student.constituency}` : ''}
                  </p>
                  {student.last_speech_at && (
                    <p className="text-[10px] text-on-surface-variant/50 font-body flex items-center gap-1 mt-0.5">
                      <span className="material-symbols-outlined text-[11px]">schedule</span>
                      {formatDistanceToNow(new Date(student.last_speech_at), { addSuffix: true })}
                    </p>
                  )}
                </div>
              </div>

              {/* Right: speech+score stats + actions */}
              <div className="flex items-center gap-10 shrink-0">
                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-1 text-[10px] text-outline font-bold font-body">
                    <span className="material-symbols-outlined text-[14px]">voice_chat</span>
                    {student.speech_count} Speech{student.speech_count !== 1 ? 'es' : ''}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-outline font-bold font-body">
                    <span className="material-symbols-outlined text-[14px]">star</span>
                    {student.has_jury_score ? `${student.assessment_count} Score${student.assessment_count !== 1 ? 's' : ''}` : 'No Score'}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={e => { e.preventDefault(); e.stopPropagation(); recordSpeech(student.user_id); }}
                    className="bg-primary hover:bg-primary-container text-white h-12 px-6 rounded-2xl flex items-center gap-2 font-bold font-body transition-all active:scale-95 shadow-[0_4px_12px_rgba(19,41,143,0.2)] hover:shadow-[0_6px_16px_rgba(19,41,143,0.3)]"
                  >
                    <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>mic</span>
                    +1
                  </button>
                  {student.speech_count > 0 && (
                    <button
                      type="button"
                      onClick={e => { e.preventDefault(); e.stopPropagation(); undoLastSpeech(student.user_id); }}
                      className="h-12 px-4 rounded-2xl bg-surface-container text-on-surface-variant flex items-center gap-1.5 font-bold text-sm font-body hover:bg-surface-container-high transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <span className="material-symbols-outlined text-[16px]">undo</span>
                      Undo
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
