import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useAdminSpeechTracking } from '@/hooks/useAdminSpeechTracking';
import { PartyBadge } from '@/components/ui/party-badge';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';

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

      {/* Organizer info banner */}
      {isOrganizer && (
        <div className="flex items-start gap-4 p-5 bg-primary-container/30 rounded-2xl">
          <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[18px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>shield_person</span>
          </div>
          <div>
            <p className="font-headline font-bold text-on-surface text-sm">Organizer Override Mode</p>
            <p className="text-xs text-on-surface-variant font-body mt-0.5">
              You can track speeches for all students and override recordings made by admin students.
            </p>
          </div>
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        {[
          { label: 'Total Students', value: String(totalCount).padStart(2, '0'),                                          icon: 'group',        color: 'text-primary',   iconColor: 'text-primary' },
          { label: 'Have Spoken',    value: String(students.filter(s => s.speech_count > 0).length).padStart(2, '0'),     icon: 'mic',          color: 'text-tertiary',  iconColor: 'text-tertiary' },
          { label: 'Not Spoken',     value: String(students.filter(s => s.speech_count === 0).length).padStart(2, '0'),   icon: 'mic_off',      color: 'text-secondary', iconColor: 'text-secondary' },
          { label: 'Jury Scored',    value: String(students.filter(s => s.has_jury_score).length).padStart(2, '0'),       icon: 'gavel',        color: 'text-on-surface',iconColor: 'text-on-surface-variant' },
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

      {/* Filters */}
      <div className="bg-surface-container-lowest rounded-[2rem] shadow-[0_32px_64px_-16px_rgba(19,41,143,0.1)] overflow-hidden">
        <div className="px-8 py-5 border-b border-outline-variant/10 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-on-surface-variant">filter_list</span>
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-on-surface-variant/50 font-headline">Filters</span>
          </div>
          <p className="text-xs text-on-surface-variant font-body shrink-0">
            Showing <span className="font-bold text-on-surface">{filteredCount}</span> of <span className="font-bold text-on-surface">{totalCount}</span> students
          </p>
        </div>
        <div className="px-8 py-5 grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant/50">search</span>
            <input
              placeholder="Search by name or serial…"
              value={filters.searchQuery}
              onChange={e => setFilters({ ...filters, searchQuery: e.target.value })}
              className="w-full h-11 bg-surface-container border-none rounded-2xl pl-10 pr-4 text-sm font-body text-on-surface focus:ring-2 focus:ring-primary/20 outline-none"
            />
          </div>
          <Select value={filters.hasSpeech} onValueChange={(v: any) => setFilters({ ...filters, hasSpeech: v })}>
            <SelectTrigger className="h-11 bg-surface-container border-none rounded-2xl font-body text-sm">
              <SelectValue placeholder="Speech Status" />
            </SelectTrigger>
            <SelectContent className="rounded-2xl border-none bg-surface-container-lowest shadow-xl">
              <SelectItem value="all">All Students</SelectItem>
              <SelectItem value="spoken">Have Spoken</SelectItem>
              <SelectItem value="not-spoken">Not Spoken</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filters.hasScore} onValueChange={(v: any) => setFilters({ ...filters, hasScore: v })}>
            <SelectTrigger className="h-11 bg-surface-container border-none rounded-2xl font-body text-sm">
              <SelectValue placeholder="Score Status" />
            </SelectTrigger>
            <SelectContent className="rounded-2xl border-none bg-surface-container-lowest shadow-xl">
              <SelectItem value="all">All Students</SelectItem>
              <SelectItem value="scored">Jury Scored</SelectItem>
              <SelectItem value="not-scored">Not Scored</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={filters.partyNumber?.toString() || 'all'}
            onValueChange={v => setFilters({ ...filters, partyNumber: v === 'all' ? null : parseInt(v) })}
          >
            <SelectTrigger className="h-11 bg-surface-container border-none rounded-2xl font-body text-sm">
              <SelectValue placeholder="Party" />
            </SelectTrigger>
            <SelectContent className="rounded-2xl border-none bg-surface-container-lowest shadow-xl">
              <SelectItem value="all">All Parties</SelectItem>
              {uniqueParties.map(party => {
                const partyLetter = ['No Party', 'A', 'B', 'C', 'D', 'E'][party] || party;
                return <SelectItem key={party} value={party.toString()}>Party {partyLetter}</SelectItem>;
              })}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Student list */}
      <div className="bg-surface-container-lowest rounded-[2rem] shadow-[0_32px_64px_-16px_rgba(19,41,143,0.1)] overflow-hidden">
        {students.length === 0 ? (
          <div className="px-8 py-16 text-center">
            <span className="material-symbols-outlined text-[48px] text-on-surface-variant/20 block mb-3" style={{ fontVariationSettings: "'FILL' 1" }}>group</span>
            <p className="text-sm text-on-surface-variant/50 font-body">No students found. Try adjusting your filters.</p>
          </div>
        ) : (
          <div className="divide-y divide-outline-variant/5">
            {students.map(student => (
              <div key={student.user_id} className="px-8 py-5 flex items-center gap-4 hover:bg-primary-container/[0.02] transition-colors">
                {/* Serial */}
                <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-primary font-headline">{student.serial_number}</span>
                </div>

                {/* Avatar */}
                <Avatar className="h-12 w-12 border-2 border-primary/10 shrink-0">
                  <AvatarImage src={student.photo_url || undefined} alt={student.name} />
                  <AvatarFallback className="bg-primary/10 text-primary font-headline font-bold text-sm">
                    {student.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                  </AvatarFallback>
                </Avatar>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <p className="font-headline font-bold text-on-surface truncate">{student.name}</p>
                    <PartyBadge partyNumber={student.party_number} size="sm" />
                  </div>
                  <p className="text-xs text-on-surface-variant font-body truncate">
                    {student.position}{student.constituency ? ` · ${student.constituency}` : ''}
                  </p>
                  {student.last_speech_at && (
                    <p className="text-[11px] text-on-surface-variant/60 font-body flex items-center gap-1 mt-0.5">
                      <span className="material-symbols-outlined text-[12px]">schedule</span>
                      Last speech: {formatDistanceToNow(new Date(student.last_speech_at), { addSuffix: true })}
                    </p>
                  )}
                </div>

                {/* Status badges */}
                <div className="flex flex-col gap-1.5 shrink-0">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-full font-body ${student.speech_count > 0 ? 'bg-primary-fixed text-on-primary-fixed' : 'bg-surface-container text-on-surface-variant'}`}>
                    <span className="material-symbols-outlined text-[12px]">mic</span>
                    {student.speech_count} Speech{student.speech_count !== 1 ? 'es' : ''}
                  </span>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-full font-body ${student.has_jury_score ? 'bg-tertiary/10 text-tertiary-fixed-dim' : 'bg-surface-container text-on-surface-variant'}`}>
                    <span className="material-symbols-outlined text-[12px]">{student.has_jury_score ? 'check_circle' : 'radio_button_unchecked'}</span>
                    {student.has_jury_score ? `${student.assessment_count} Score${student.assessment_count !== 1 ? 's' : ''}` : 'No Score'}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={e => { e.preventDefault(); e.stopPropagation(); recordSpeech(student.user_id); }}
                    className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-primary to-primary-container text-white rounded-xl font-bold text-sm font-body shadow-[0_4px_12px_rgba(19,41,143,0.2)] hover:shadow-[0_6px_16px_rgba(19,41,143,0.3)] transition-all active:scale-[0.98]"
                  >
                    <span className="material-symbols-outlined text-[16px]">mic</span>
                    +1
                  </button>
                  {student.speech_count > 0 && (
                    <button
                      type="button"
                      onClick={e => { e.preventDefault(); e.stopPropagation(); undoLastSpeech(student.user_id); }}
                      className="flex items-center gap-1.5 px-4 py-2 bg-surface-container text-on-surface-variant rounded-xl font-bold text-sm font-body hover:bg-surface-container-high transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px]">undo</span>
                      Undo
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
