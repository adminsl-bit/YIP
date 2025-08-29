import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle, XCircle, Users, FileText } from "lucide-react";

interface Student {
  user_id: string;
  name: string;
  position: string;
  party_number: number;
  constituency?: string;
  state?: string;
}

interface VoteData {
  voter_id: string;
  option_id: string;
}

interface PostVotingAnalysisProps {
  pollId: string;
  pollTitle: string;
}

export const PostVotingAnalysis = ({ pollId, pollTitle }: PostVotingAnalysisProps) => {
  const [votedStudents, setVotedStudents] = useState<(Student & { vote: string })[]>([]);
  const [notVotedStudents, setNotVotedStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVotingAnalysis();
  }, [pollId]);

  const fetchVotingAnalysis = async () => {
    try {
      setLoading(true);

      // Fetch all students
      const { data: allStudents, error: studentsError } = await supabase
        .from('profiles')
        .select('user_id, name, position, party_number, constituency, state')
        .eq('user_type', 'student')
        .eq('is_active', true)
        .order('party_number', { ascending: true });

      if (studentsError) throw studentsError;

      // Fetch all votes for this poll
      const { data: votes, error: votesError } = await supabase
        .from('poll_votes')
        .select('voter_id, option_id')
        .eq('poll_id', pollId);

      if (votesError) throw votesError;

      // Create vote lookup map
      const voteMap = new Map<string, string>();
      (votes || []).forEach((vote: VoteData) => {
        voteMap.set(vote.voter_id, vote.option_id);
      });

      // Separate students into voted and not voted
      const voted: (Student & { vote: string })[] = [];
      const notVoted: Student[] = [];

      (allStudents || []).forEach((student: Student) => {
        const vote = voteMap.get(student.user_id);
        if (vote) {
          voted.push({ ...student, vote });
        } else {
          notVoted.push(student);
        }
      });

      setVotedStudents(voted);
      setNotVotedStudents(notVoted);

    } catch (error) {
      console.error('Error fetching voting analysis:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="bg-white/95 backdrop-blur-lg border border-gray/25 shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <FileText className="w-5 h-5" />
            Post-Voting Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-green-50/80 border-green-200">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center shadow-lg">
                <CheckCircle className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="text-3xl font-black text-green-700">{votedStudents.length}</div>
                <div className="text-base text-green-600 font-medium">Students Voted</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-red-50/80 border-red-200">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-red-500 rounded-xl flex items-center justify-center shadow-lg">
                <XCircle className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="text-3xl font-black text-red-700">{notVotedStudents.length}</div>
                <div className="text-base text-red-600 font-medium">Students Not Voted</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-blue-50/80 border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center shadow-lg">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="text-3xl font-black text-blue-700">{votedStudents.length + notVotedStudents.length}</div>
                <div className="text-base text-blue-600 font-medium">Total Students</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Students Who Voted */}
      <Card className="bg-white/95 backdrop-blur-lg border border-gray/25 shadow-xl">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-3 text-green-700 text-xl">
            <CheckCircle className="w-6 h-6" />
            Students Who Voted ({votedStudents.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {votedStudents.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Party #</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Constituency</TableHead>
                  <TableHead>Vote</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {votedStudents.map((student) => (
                  <TableRow key={student.user_id}>
                    <TableCell className="font-bold">{student.party_number}</TableCell>
                    <TableCell className="font-medium">{student.name}</TableCell>
                    <TableCell>{student.position}</TableCell>
                    <TableCell>{student.constituency || 'N/A'}</TableCell>
                    <TableCell>
                      <Badge 
                        className={
                          student.vote.toLowerCase().includes('yes') 
                            ? 'bg-green-500 text-white' 
                            : 'bg-red-500 text-white'
                        }
                      >
                        {student.vote}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No students have voted yet.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Students Who Haven't Voted */}
      <Card className="bg-white/95 backdrop-blur-lg border border-gray/25 shadow-xl">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-3 text-red-700 text-xl">
            <XCircle className="w-6 h-6" />
            Students Who Haven't Voted ({notVotedStudents.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {notVotedStudents.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Party #</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Constituency</TableHead>
                  <TableHead>State</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {notVotedStudents.map((student) => (
                  <TableRow key={student.user_id}>
                    <TableCell className="font-bold">{student.party_number}</TableCell>
                    <TableCell className="font-medium">{student.name}</TableCell>
                    <TableCell>{student.position}</TableCell>
                    <TableCell>{student.constituency || 'N/A'}</TableCell>
                    <TableCell>{student.state || 'N/A'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-green-600">
              <CheckCircle className="w-12 h-12 mx-auto mb-4" />
              <p className="text-lg font-semibold">Excellent! All students have voted.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};