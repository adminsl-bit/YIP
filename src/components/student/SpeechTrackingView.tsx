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
      <Card className="p-4 bg-blue-50 border-blue-200">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-blue-500 rounded-lg flex-shrink-0">
            <Eye className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-sm mb-1">Speech Tracking View</h3>
            <p className="text-xs text-muted-foreground">
              You can view speech tracking data for all students. This is a read-only view managed by admin students and organizers.
            </p>
          </div>
        </div>
      </Card>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Students</p>
              <p className="text-2xl font-bold">{totalCount}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Have Spoken</p>
              <p className="text-2xl font-bold">
                {students.filter((s) => s.speech_count > 0).length}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-500/10">
              <XCircle className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Not Spoken</p>
              <p className="text-2xl font-bold">
                {students.filter((s) => s.speech_count === 0).length}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <Mic className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Speeches</p>
              <p className="text-2xl font-bold">
                {students.reduce((sum, s) => sum + s.speech_count, 0)}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-semibold">Filters</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name..."
              value={filters.searchQuery}
              onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
              className="pl-10"
            />
          </div>

          <Select
            value={filters.partyNumber?.toString() || 'all'}
            onValueChange={(value) => 
              setFilters({ ...filters, partyNumber: value === 'all' ? null : parseInt(value) })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="All Parties" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Parties</SelectItem>
              {uniqueParties.map((party) => (
                <SelectItem key={party} value={party.toString()}>
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
            <SelectTrigger>
              <SelectValue placeholder="Speech Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Students</SelectItem>
              <SelectItem value="spoken">Have Spoken</SelectItem>
              <SelectItem value="not-spoken">Not Spoken</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="mt-4 text-sm text-muted-foreground">
          Showing {filteredCount} of {totalCount} students
        </div>
      </Card>

      {/* Student List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {students.map((student) => (
          <Card
            key={student.user_id}
            className="p-4 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3 flex-1">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={student.photo_url || undefined} />
                  <AvatarFallback>{student.name.substring(0, 2)}</AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-base truncate">
                      {student.name}
                    </h4>
                    <Badge variant="outline" className="text-xs">
                      #{student.serial_number}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <PartyBadge partyNumber={student.party_number} />
                    <span className="text-xs text-muted-foreground">
                      {student.position}
                    </span>
                  </div>

                  {student.last_speech_at && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>
                        Last spoke{' '}
                        {formatDistanceToNow(new Date(student.last_speech_at), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col items-end gap-2 ml-4">
                <div className="flex items-center gap-2">
                  <Badge
                    variant={student.speech_count > 0 ? 'default' : 'secondary'}
                    className="text-lg font-bold px-3 py-1"
                  >
                    <Mic className="h-4 w-4 mr-1" />
                    {student.speech_count}
                  </Badge>
                </div>
              </div>
            </div>
          </Card>
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
