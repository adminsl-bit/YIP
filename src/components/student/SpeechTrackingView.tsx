import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Mic,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Users,
  Clock,
  Info,
  Eye,
} from 'lucide-react';
import { useAdminSpeechTracking } from '@/hooks/useAdminSpeechTracking';
import { PartyBadge } from '@/components/ui/party-badge';
import { formatDistanceToNow } from 'date-fns';

export const SpeechTrackingView = () => {
  const {
    students,
    loading,
    filters,
    setFilters,
    totalCount,
    filteredCount,
  } = useAdminSpeechTracking();

  const uniqueParties = Array.from(new Set(students.map((s) => s.party_number))).sort(
    (a, b) => a - b
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-muted-foreground">Loading speech data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="bg-[#13298f]/5 rounded-3xl p-4 border border-[#13298f]/10 flex items-start gap-4">
        <div className="p-2.5 bg-[#13298f] rounded-2xl flex-shrink-0 shadow-lg shadow-indigo-900/20">
          <Eye className="h-5 w-5 text-white" />
        </div>
        <div>
          <h3 className="font-headline font-black text-sm text-[#13298f] mb-1">Speaker's Oversight</h3>
          <p className="text-xs text-[#13298f]/60 font-medium leading-relaxed">
            Real-time monitoring of parliamentary discourse. Track delegate engagement and manage floor time effectively.
          </p>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Delegates', value: totalCount, icon: Users, color: 'bg-indigo-50 text-[#13298f]' },
          { label: 'Participated', value: students.filter((s) => s.speech_count > 0).length, icon: CheckCircle2, color: 'bg-emerald-50 text-emerald-600' },
          { label: 'Awaiting Turn', value: students.filter((s) => s.speech_count === 0).length, icon: XCircle, color: 'bg-rose-50 text-rose-600' },
          { label: 'Total Speeches', value: students.reduce((sum, s) => sum + s.speech_count, 0), icon: Mic, color: 'bg-amber-50 text-amber-600' },
        ].map((stat, i) => (
          <div key={i} className="bg-white rounded-3xl p-4 border border-slate-50 shadow-sm flex items-center gap-4 group hover:shadow-md transition-all">
            <div className={`p-2.5 rounded-2xl ${stat.color} group-hover:scale-110 transition-transform`}>
              <stat.icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest leading-none mb-1">{stat.label}</p>
              <p className="text-xl font-headline font-black text-[#191c1e] leading-none">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-3xl p-6 border border-slate-50 shadow-sm">
        <div className="flex items-center gap-4 mb-6">
          <div className="p-2.5 bg-slate-50 rounded-2xl">
            <Filter className="h-4 w-4 text-slate-400" />
          </div>
          <h3 className="font-headline font-black text-sm text-[#191c1e] uppercase tracking-widest">Parliamentary Filters</h3>
          <span className="ml-auto text-[10px] font-black text-slate-300 uppercase tracking-widest">
            {filteredCount} / {totalCount} Delegates
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 transition-colors group-focus-within:text-[#13298f]" />
            <Input
              placeholder="Search by name..."
              value={filters.searchQuery}
              onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
              className="pl-11 bg-slate-50/50 border-transparent focus:bg-white focus:ring-2 focus:ring-[#13298f]/5 rounded-2xl h-11 text-xs font-bold transition-all"
            />
          </div>

          <Select
            value={filters.partyNumber?.toString() || 'all'}
            onValueChange={(value) => 
              setFilters({ ...filters, partyNumber: value === 'all' ? null : parseInt(value) })
            }
          >
            <SelectTrigger className="bg-slate-50/50 border-transparent rounded-2xl h-11 text-xs font-bold px-4">
              <SelectValue placeholder="All Parties" />
            </SelectTrigger>
            <SelectContent className="rounded-2xl border-slate-100 shadow-xl">
              <SelectItem value="all" className="text-xs font-bold py-2.5">All Parties</SelectItem>
              {uniqueParties.map((party) => (
                <SelectItem key={party} value={party.toString()} className="text-xs font-bold py-2.5">
                  Party {String.fromCharCode(64 + party)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.hasSpeech}
            onValueChange={(value: 'all' | 'spoken' | 'not-spoken') => 
              setFilters({ ...filters, hasSpeech: value })
            }
          >
            <SelectTrigger className="bg-slate-50/50 border-transparent rounded-2xl h-11 text-xs font-bold px-4">
              <SelectValue placeholder="Speech Status" />
            </SelectTrigger>
            <SelectContent className="rounded-2xl border-slate-100 shadow-xl">
              <SelectItem value="all" className="text-xs font-bold py-2.5">All Students</SelectItem>
              <SelectItem value="spoken" className="text-xs font-bold py-2.5">Have Spoken</SelectItem>
              <SelectItem value="not-spoken" className="text-xs font-bold py-2.5">Not Spoken</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Student List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {students.map((student) => (
          <div
            key={student.user_id}
            className="bg-white rounded-3xl p-4 border border-slate-50 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all group/card"
          >
            <div className="flex items-start gap-4">
              <div className="relative shrink-0">
                <Avatar className="h-14 w-14 rounded-2xl border-4 border-white shadow-md">
                  <AvatarImage src={student.photo_url || undefined} className="object-cover" />
                  <AvatarFallback className="bg-slate-50 text-[#13298f] font-black text-xl">
                    {student.name.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-1 -right-1">
                  <PartyBadge partyNumber={student.party_number} size="sm" />
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h4 className="font-headline font-black text-[#191c1e] text-sm truncate group-hover/card:text-[#13298f] transition-colors">
                    {student.name}
                  </h4>
                  <span className="text-[10px] font-black text-slate-300">#{student.serial_number}</span>
                </div>

                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 truncate">
                  {student.position || "Delegate"}
                </p>

                <div className="flex items-center justify-between mt-auto">
                  <div className={`px-3 py-1.5 rounded-xl font-black text-xs flex items-center gap-2 ${student.speech_count > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'}`}>
                    <Mic className="h-3 w-3" />
                    {student.speech_count} Speeches
                  </div>
                  
                  {student.last_speech_at && (
                    <div className="flex items-center gap-1 text-[9px] font-black text-slate-300 uppercase tracking-tighter">
                      <Clock className="h-2.5 w-2.5" />
                      {formatDistanceToNow(new Date(student.last_speech_at), { addSuffix: true })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {students.length === 0 && (
        <Card className="p-12">
          <div className="text-center space-y-2">
            <Users className="h-12 w-12 text-muted-foreground mx-auto" />
            <h3 className="text-lg font-semibold">No Students Found</h3>
            <p className="text-muted-foreground">
              Try adjusting your filters to see more results.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
};
