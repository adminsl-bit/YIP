import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { FileText, Users, CheckCircle, XCircle } from "lucide-react";

interface Student {
  user_id: string;
  name: string;
  position: string;
  party_number: number;
  constituency?: string;
  state?: string;
  photo_url?: string;
}

interface VoteWithStudent {
  voter_id: string;
  option_id: string;
  student: Student;
}

interface DetailedPollResultsProps {
  pollId: string;
  pollTitle: string;
  options: string[];
}

export const DetailedPollResults = ({ pollId, pollTitle, options }: DetailedPollResultsProps) => {
  const [votesWithStudents, setVotesWithStudents] = useState<VoteWithStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDetailedResults();
  }, [pollId]);

  const fetchDetailedResults = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch votes for this poll
      const { data: votesData, error: votesError } = await supabase
        .from('poll_votes')
        .select('voter_id, option_id')
        .eq('poll_id', pollId);

      if (votesError) {
        throw votesError;
      }

      // Get unique voter IDs
      const voterIds = Array.from(new Set((votesData || []).map(vote => vote.voter_id)));

      // Fetch student information for all voters
      const { data: studentsData, error: studentsError } = await supabase
        .from('profiles')
        .select('user_id, name, position, party_number, constituency, state, photo_url')
        .in('user_id', voterIds);

      if (studentsError) {
        throw studentsError;
      }

      // Create a map of voter ID to student data
      const studentMap = new Map();
      (studentsData || []).forEach(student => {
        studentMap.set(student.user_id, student);
      });

      // Transform the data structure
      const transformedVotes: VoteWithStudent[] = (votesData || [])
        .map(vote => {
          const student = studentMap.get(vote.voter_id);
          if (!student) return null;
          
          return {
            voter_id: vote.voter_id,
            option_id: vote.option_id,
            student: {
              user_id: student.user_id,
              name: student.name,
              position: student.position,
              party_number: student.party_number,
              constituency: student.constituency,
              state: student.state,
              photo_url: student.photo_url
            }
          };
        })
        .filter(vote => vote !== null) as VoteWithStudent[];

      setVotesWithStudents(transformedVotes);

    } catch (error: any) {
      console.error('Error fetching detailed results:', error);
      setError(error.message || 'Failed to load detailed results');
    } finally {
      setLoading(false);
    }
  };

  const getVotesForOption = (option: string) => {
    return votesWithStudents.filter(vote => vote.option_id === option);
  };

  const getOptionIcon = (option: string) => {
    if (option.toLowerCase() === 'yes') return <CheckCircle className="w-4 h-4 text-green-600" />;
    if (option.toLowerCase() === 'no') return <XCircle className="w-4 h-4 text-red-600" />;
    return <FileText className="w-4 h-4 text-blue-600" />;
  };

  const getOptionColor = (option: string) => {
    if (option.toLowerCase() === 'yes') return 'bg-green-50 border-green-200';
    if (option.toLowerCase() === 'no') return 'bg-red-50 border-red-200';
    return 'bg-blue-50 border-blue-200';
  };

  if (loading) {
    return (
      <Card className="bg-white/95 backdrop-blur-lg border border-gray/25 shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <FileText className="w-5 h-5" />
            Detailed Poll Results
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

  if (error) {
    return (
      <Card className="bg-white/95 backdrop-blur-lg border border-gray/25 shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <FileText className="w-5 h-5" />
            Detailed Poll Results
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <XCircle className="w-16 h-16 mx-auto mb-4 text-red-500" />
            <h3 className="text-xl font-bold text-gray-800 mb-2">
              Unable to Load Results
            </h3>
            <p className="text-gray-600">
              {error}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white/95 backdrop-blur-lg border border-gray/25 shadow-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <FileText className="w-5 h-5" />
          Detailed Results: {pollTitle}
        </CardTitle>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Users className="w-4 h-4" />
          Total Votes: {votesWithStudents.length}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {options.map((option, index) => {
          const optionVotes = getVotesForOption(option);
          const percentage = votesWithStudents.length > 0 
            ? ((optionVotes.length / votesWithStudents.length) * 100).toFixed(1)
            : 0;

          return (
            <div key={option} className={`rounded-lg border p-4 ${getOptionColor(option)}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  {getOptionIcon(option)}
                  <h3 className="text-lg font-semibold capitalize">{option}</h3>
                </div>
                <Badge variant="secondary">
                  {optionVotes.length} votes ({percentage}%)
                </Badge>
              </div>

              {optionVotes.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Position</TableHead>
                        <TableHead>Party</TableHead>
                        <TableHead>Constituency</TableHead>
                        <TableHead>State</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {optionVotes.map((vote) => (
                        <TableRow key={vote.voter_id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="w-8 h-8">
                                <AvatarImage 
                                  src={vote.student.photo_url || ''} 
                                  alt={vote.student.name}
                                />
                                <AvatarFallback>
                                  {vote.student.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-medium">{vote.student.name}</span>
                            </div>
                          </TableCell>
                          <TableCell>{vote.student.position}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              Party {vote.student.party_number}
                            </Badge>
                          </TableCell>
                          <TableCell>{vote.student.constituency || 'N/A'}</TableCell>
                          <TableCell>{vote.student.state || 'N/A'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-gray-500 italic text-center py-4">
                  No votes for this option
                </p>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};