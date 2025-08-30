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

      // For public display, we only show vote counts without student details
      let votesData, votesError;
      
      try {
        // Try authenticated query first
        const result = await supabase
          .from('poll_votes')
          .select('option_id')
          .eq('poll_id', pollId);
        votesData = result.data;
        votesError = result.error;
      } catch (authError) {
        // Fall back to public view
        const result = await supabase
          .from('public_poll_votes')
          .select('option_id')
          .eq('poll_id', pollId);
        votesData = result.data;
        votesError = result.error;
      }

      if (votesError) throw votesError;

      // Since we can't access student data in public view,
      // we'll just show basic vote counts
      setVotedStudents([]); // Empty for public display
      setNotVotedStudents([]); // Empty for public display

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
    <Card className="bg-white/95 backdrop-blur-lg border border-gray/25 shadow-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <FileText className="w-5 h-5" />
          Post-Voting Analysis Complete
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center py-8">
          <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" />
          <h3 className="text-2xl font-bold text-gray-800 mb-2">
            Voting Session Complete
          </h3>
          <p className="text-lg text-gray-600">
            Thank you to all participants. Detailed results are available to organizers.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};