import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Mic,
  Undo2,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Users,
  Clock,
  Info,
} from 'lucide-react';
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

  const uniqueParties = Array.from(new Set(students.map((s) => s.party_number))).sort(
    (a, b) => a - b
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-muted-foreground">Loading student data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Organizer Info Banner */}
      {isOrganizer && (
        <Card className="p-4 bg-blue-50 border-blue-200">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-500 rounded-lg flex-shrink-0">
              <Info className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-sm mb-1">Organizer Override Mode</h3>
              <p className="text-xs text-muted-foreground">
                You can track speeches for all students and override recordings made by admin students. 
                Use the +1 button to add speech counts and Undo to remove the last speech entry for any student.
              </p>
            </div>
          </div>
        </Card>
      )}

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
            <div className="p-2 rounded-lg bg-blue-500/10">
              <TrendingUp className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Jury Scored</p>
              <p className="text-2xl font-bold">
                {students.filter((s) => s.has_jury_score).length}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-4 w-4" />
          <h3 className="font-semibold">Filters</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or serial..."
              value={filters.searchQuery}
              onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
              className="pl-10"
            />
          </div>

          <Select
            value={filters.hasSpeech}
            onValueChange={(value: any) => setFilters({ ...filters, hasSpeech: value })}
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

          <Select
            value={filters.hasScore}
            onValueChange={(value: any) => setFilters({ ...filters, hasScore: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Score Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Students</SelectItem>
              <SelectItem value="scored">Jury Scored</SelectItem>
              <SelectItem value="not-scored">Not Scored</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.partyNumber?.toString() || 'all'}
            onValueChange={(value) =>
              setFilters({
                ...filters,
                partyNumber: value === 'all' ? null : parseInt(value),
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Party" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Parties</SelectItem>
              {uniqueParties.map((party) => {
                const partyLetter = ['No Party', 'A', 'B', 'C', 'D', 'E'][party] || party;
                return (
                  <SelectItem key={party} value={party.toString()}>
                    Party {partyLetter}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          Showing {filteredCount} of {totalCount} students
        </p>
      </Card>

      {/* Student List */}
      <div className="space-y-3">
        {students.map((student) => (
          <Card
            key={student.user_id}
            className="p-4 hover:shadow-lg transition-all duration-200"
          >
            <div className="flex items-center gap-4">
              {/* Serial Number Badge */}
              <div className="flex-shrink-0">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-lg font-bold text-primary">
                    {student.serial_number}
                  </span>
                </div>
              </div>

              {/* Avatar */}
              <Avatar className="h-14 w-14 border-2 border-border">
                <AvatarImage src={student.photo_url || undefined} alt={student.name} />
                <AvatarFallback className="text-lg">
                  {student.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-lg truncate">{student.name}</h3>
                  <PartyBadge partyNumber={student.party_number} size="sm" />
                </div>
                <p className="text-sm text-muted-foreground truncate">
                  {student.position} • {student.constituency || 'N/A'}
                </p>
                {student.last_speech_at && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <Clock className="h-3 w-3" />
                    Last speech:{' '}
                    {formatDistanceToNow(new Date(student.last_speech_at), {
                      addSuffix: true,
                    })}
                  </p>
                )}
              </div>

              {/* Status Badges */}
              <div className="flex flex-col gap-2">
                <Badge
                  variant={student.speech_count > 0 ? 'default' : 'secondary'}
                  className="justify-center"
                >
                  <Mic className="h-3 w-3 mr-1" />
                  {student.speech_count} Speech{student.speech_count !== 1 ? 'es' : ''}
                </Badge>
                <Badge
                  variant={student.has_jury_score ? 'default' : 'outline'}
                  className="justify-center"
                >
                  {student.has_jury_score ? (
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                  ) : (
                    <XCircle className="h-3 w-3 mr-1" />
                  )}
                  {student.has_jury_score
                    ? `${student.assessment_count} Score${
                        student.assessment_count !== 1 ? 's' : ''
                      }`
                    : 'No Score'}
                </Badge>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    recordSpeech(student.user_id);
                  }}
                  className="gap-2"
                >
                  <Mic className="h-4 w-4" />
                  +1
                </Button>
                {student.speech_count > 0 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      undoLastSpeech(student.user_id);
                    }}
                    className="gap-2"
                  >
                    <Undo2 className="h-4 w-4" />
                    Undo
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}

        {students.length === 0 && (
          <Card className="p-12">
            <div className="text-center text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No students found</p>
              <p className="text-sm">Try adjusting your filters</p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};
