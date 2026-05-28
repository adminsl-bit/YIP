import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Download, Users, Loader2, Calendar, LayoutPanelLeft, UserMinus, CheckCircle, XCircle, MoreHorizontal } from "lucide-react";
import jsPDF from "jspdf";
import { toast } from "sonner";

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
  pollHeading?: string;
  options: Array<{ id: string; text: string } | string>;
  isOrganizer?: boolean;
}

export const DetailedPollResults = ({ pollId, pollTitle, pollHeading, options, isOrganizer = false }: DetailedPollResultsProps) => {
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

      const { data: votesData, error: votesError } = await supabase
        .from('poll_votes')
        .select('voter_id, option_id')
        .eq('poll_id', pollId);

      if (votesError) throw votesError;

      const { data: allStudentsData, error: allStudentsError } = await supabase
        .from('profiles')
        .select('user_id, name, position, party_number, constituency, state, photo_url')
        .eq('user_type', 'student')
        .eq('is_active', true);

      if (allStudentsError) throw allStudentsError;

      const allStudentsMap = new Map();
      (allStudentsData || []).forEach(student => {
        allStudentsMap.set(student.user_id, student);
      });

      const voterMap = new Map();
      (votesData || []).forEach(vote => {
        voterMap.set(vote.voter_id, vote.option_id);
      });

      const transformedVotes: VoteWithStudent[] = [];
      
      (votesData || []).forEach(vote => {
        const student = allStudentsMap.get(vote.voter_id);
        if (student) {
          transformedVotes.push({
            voter_id: vote.voter_id,
            option_id: vote.option_id,
            student
          });
        }
      });

      (allStudentsData || []).forEach(student => {
        if (!voterMap.has(student.user_id)) {
          transformedVotes.push({
            voter_id: student.user_id,
            option_id: 'did_not_vote',
            student
          });
        }
      });

      setVotesWithStudents(transformedVotes);

    } catch (error: any) {
      console.error('Error fetching detailed results:', error);
      setError(error.message || 'Failed to load detailed results');
    } finally {
      setLoading(false);
    }
  };

  const getVotesForOption = (optionId: string) => {
    return votesWithStudents.filter(vote => vote.option_id === optionId);
  };

  const getOptionDisplay = (option: { id: string; text: string } | string): { id: string; text: string } => {
    if (typeof option === 'string') {
      return { id: option, text: option };
    }
    return option;
  };

  if (loading) {
    return (
      <div className="bg-surface-container-lowest rounded-[3rem] p-16 shadow-2xl border border-outline-variant/10 flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="w-12 h-12 text-primary animate-spin mb-6" />
        <p className="text-primary font-bold font-display uppercase tracking-[0.2em] text-label-sm">Compiling Verdict...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-surface-container-lowest rounded-[3rem] p-16 shadow-2xl border border-outline-variant/10 flex flex-col items-center justify-center min-h-[400px]">
        <XCircle className="w-16 h-16 text-secondary mb-6" />
        <h3 className="text-display-xs font-display font-bold text-on-surface uppercase italic mb-4">Legislative Deadlock</h3>
        <p className="text-on-surface-variant/40 text-body-md font-medium">{error}</p>
      </div>
    );
  }

  const downloadCSV = () => {
    try {
      const rows: string[][] = [
        ['Option', 'Delegate Name', 'Position', 'Party', 'State', 'Constituency'],
      ];
      [...options, { id: 'did_not_vote', text: 'Did Not Vote' }].forEach(option => {
        const opt = getOptionDisplay(option);
        getVotesForOption(opt.id).forEach(vote => {
          const partyLabel = vote.student.party_number
            ? `Party ${['None', 'A', 'B', 'C', 'D', 'E'][vote.student.party_number] ?? vote.student.party_number}`
            : 'N/A';
          rows.push([
            opt.text,
            vote.student.name,
            vote.student.position,
            partyLabel,
            vote.student.state || '',
            vote.student.constituency || '',
          ]);
        });
      });
      const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `poll-results-${pollTitle.replace(/[^a-zA-Z0-9]/g, '-')}.csv`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("CSV downloaded");
    } catch {
      toast.error("CSV export failed");
    }
  };

  const downloadPDF = () => {
    try {
      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 20;
      let yPosition = margin;

      pdf.setFontSize(20);
      pdf.text(`Poll Results: ${pollTitle}`, margin, yPosition);
      yPosition += 20;

      pdf.setFontSize(12);
      pdf.text(`Total Students: ${votesWithStudents.length}`, margin, yPosition);
      yPosition += 10;
      pdf.text(`Generated on: ${new Date().toLocaleString()}`, margin, yPosition);
      yPosition += 20;

      [...options, { id: 'did_not_vote', text: 'Did Not Vote' }].forEach((option) => {
        const optionDisplay = getOptionDisplay(option);
        const optionVotes = getVotesForOption(optionDisplay.id);
        
        pdf.setFontSize(14);
        pdf.text(`${optionDisplay.text}: ${optionVotes.length} students`, margin, yPosition);
        yPosition += 15;

        optionVotes.forEach((vote) => {
          if (yPosition > 280) {
            pdf.addPage();
            yPosition = margin;
          }
          
          pdf.setFontSize(10);
          const partyLetter = ['No Party', 'A', 'B', 'C', 'D', 'E'][vote.student.party_number] || vote.student.party_number;
          const studentInfo = `${vote.student.name} - ${vote.student.position} - Party ${partyLetter}`;
          pdf.text(studentInfo, margin + 10, yPosition);
          yPosition += 8;
        });
        
        yPosition += 10;
      });

      pdf.save(`poll-results-${pollTitle.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`);
      
      toast.success("Political Dossier Exported: Poll results have been downloaded as PDF");
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error("Export Failed: Could not generate the parliamentary report.");
    }
  };

  return (
    <div className="bg-surface-container-lowest rounded-[3rem] shadow-2xl border border-outline-variant/10 w-full flex flex-col max-h-full overflow-hidden">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-10 p-12 lg:p-14 shrink-0 relative overflow-hidden bg-surface-container-low border-b border-outline-variant/5">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full -mr-48 -mt-48 blur-3xl"></div>
        
        <div className="relative z-10 flex-1">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-sm">
              <LayoutPanelLeft className="w-7 h-7 text-primary" />
            </div>
            <h2 className="text-label-md font-bold font-display text-primary uppercase tracking-[0.2em]">Legislative Analytics</h2>
          </div>
          <h1 className="text-display-lg font-display font-bold text-on-surface leading-tight uppercase italic tracking-tight mb-4">
            {pollHeading || pollTitle}
          </h1>
          {pollHeading && (
            <p className="text-on-surface-variant/60 font-bold font-display text-body-sm uppercase tracking-widest">
              {pollTitle}
            </p>
          )}
          <div className="flex items-center gap-10 mt-10">
            <div className="flex items-center gap-4 px-8 py-3 bg-primary/5 border border-primary/10 rounded-full">
              <Users className="w-6 h-6 text-primary" />
              <span className="text-label-lg font-bold uppercase tracking-widest text-primary">{votesWithStudents.length} Delegates</span>
            </div>
            <div className="flex items-center gap-4 px-8 py-3 bg-surface-container rounded-full border border-outline-variant/10">
              <Calendar className="w-6 h-6 text-on-surface-variant/40" />
              <span className="text-label-lg font-bold uppercase tracking-widest text-on-surface-variant/60">{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
            </div>
          </div>
        </div>
        
        {isOrganizer && (
          <div className="flex items-center gap-3 shrink-0 relative z-10">
            <button
              onClick={downloadCSV}
              className="flex items-center gap-3 px-8 py-5 bg-white text-primary hover:bg-primary hover:text-on-primary rounded-[2rem] font-bold shadow-xl hover:shadow-primary/20 transition-all text-label-md uppercase tracking-[0.1em] border border-primary/10 active:scale-95"
            >
              <Download className="w-5 h-5" /> CSV
            </button>
            <button
              onClick={downloadPDF}
              className="flex items-center gap-3 px-8 py-5 bg-primary text-white hover:bg-primary-container rounded-[2rem] font-bold shadow-xl hover:shadow-primary/20 transition-all text-label-md uppercase tracking-[0.1em] active:scale-95"
            >
              <Download className="w-5 h-5" /> PDF
            </button>
          </div>
        )}
      </div>

      <div className="space-y-16 overflow-y-auto p-12 lg:p-16 pt-10 min-h-0 custom-scrollbar [scrollbar-gutter:stable] no-scrollbar">
        {[...options, { id: 'did_not_vote', text: 'Did Not Vote' }].map((option) => {
          const optionDisplay = getOptionDisplay(option);
          const optionVotes = getVotesForOption(optionDisplay.id);
          const totalStudents = votesWithStudents.length;
          const percentage = totalStudents > 0 
            ? ((optionVotes.length / totalStudents) * 100).toFixed(1)
            : 0;

          const isNonVoteOption = optionDisplay.id === 'did_not_vote';
          const isAye = optionDisplay.text.toLowerCase() === 'aye' || optionDisplay.text.toLowerCase() === 'yes';
          const isNo = optionDisplay.text.toLowerCase() === 'no' || optionDisplay.text.toLowerCase() === 'nay';

          let headerColor = 'bg-surface-container-low text-on-surface';
          let icon = <MoreHorizontal className="w-10 h-10" />;
          let iconColor = 'text-on-surface-variant/40';
          
          if (isAye) {
            headerColor = 'bg-primary/5 text-primary';
            icon = <CheckCircle className="w-10 h-10" />;
            iconColor = 'text-primary';
          } else if (isNo) {
            headerColor = 'bg-secondary/5 text-secondary';
            icon = <XCircle className="w-10 h-10" />;
            iconColor = 'text-secondary';
          } else if (isNonVoteOption) {
            headerColor = 'bg-surface-container text-on-surface-variant/40';
            icon = <UserMinus className="w-10 h-10" />;
            iconColor = 'text-on-surface-variant/40';
          }

          return (
            <div key={optionDisplay.id} className="rounded-[4rem] border border-outline-variant/10 overflow-hidden bg-surface-container-lowest shadow-lg hover:shadow-2xl transition-all duration-500">
              <div className={`flex flex-col sm:flex-row sm:items-center justify-between p-12 ${headerColor} border-b border-outline-variant/10`}>
                <div className="flex items-center gap-8">
                  <div className="w-20 h-20 rounded-[2rem] bg-white/50 flex items-center justify-center backdrop-blur-md shadow-inner">
                    <div className={iconColor}>{icon}</div>
                  </div>
                  <h3 className="text-display-sm font-display font-bold uppercase italic tracking-tight">{optionDisplay.text}</h3>
                </div>
                <div className="mt-8 sm:mt-0 flex flex-col items-start sm:items-end">
                  <span className="text-display-md font-display font-bold leading-none mb-2">{percentage}%</span>
                  <span className="text-label-lg font-bold uppercase tracking-[0.2em] opacity-40">{optionVotes.length} Delegates</span>
                </div>
              </div>

              {optionVotes.length > 0 ? (
                <div className="p-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
                  {optionVotes.map((vote) => (
                    <div key={vote.voter_id} className="flex items-center gap-6 p-6 rounded-[2rem] bg-surface-container-low border border-outline-variant/10 hover:border-primary/30 hover:shadow-2xl hover:-translate-y-1 transition-all duration-500 group">
                      <Avatar className="w-16 h-16 border-4 border-white shadow-lg shrink-0 group-hover:scale-110 transition-transform duration-500">
                        <AvatarImage src={vote.student.photo_url || ''} alt={vote.student.name} />
                        <AvatarFallback className="bg-surface-container-highest text-on-surface-variant/60 text-label-md font-bold uppercase">
                          {vote.student.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-body-lg font-bold text-on-surface truncate font-display group-hover:text-primary transition-colors">{vote.student.name}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-body-sm font-bold text-on-surface-variant/60 uppercase tracking-widest truncate">
                            {vote.student.position}
                          </span>
                          <span className="w-1.5 h-1.5 rounded-full bg-on-surface-variant/20"></span>
                          <span className="text-body-sm font-bold text-primary uppercase tracking-[0.1em]">
                             P{['NONE', 'A', 'B', 'C', 'D', 'E'][vote.student.party_number] || vote.student.party_number}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-16 text-center bg-surface-container-low/50">
                  <p className="text-label-lg font-bold text-on-surface-variant/40 uppercase tracking-[0.2em] italic">
                    {isNonVoteOption ? 'Universal participation achieved.' : 'No parliamentary alignment found.'}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
