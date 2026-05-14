import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Download, Users, Loader2 } from "lucide-react";
import jsPDF from "jspdf";
import { toast } from "@/hooks/use-toast";

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
      <div className="bg-[#ffffff] rounded-[2.5rem] p-12 border border-[#e0e3e5]/50 shadow-sm flex flex-col items-center justify-center min-h-[300px]">
        <Loader2 className="w-10 h-10 text-[#13298f] animate-spin mb-4" />
        <p className="text-[#13298f] font-bold font-headline uppercase tracking-widest text-xs">Compiling Results...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#ffffff] rounded-[2.5rem] p-12 border border-[#e0e3e5]/50 shadow-sm flex flex-col items-center justify-center min-h-[300px]">
        <span className="material-symbols-outlined text-5xl text-[#ba1a1a] mb-4">error</span>
        <h3 className="text-xl font-black font-headline text-[#191c1e] mb-2">Unable to Load Results</h3>
        <p className="text-[#757684] text-sm">{error}</p>
      </div>
    );
  }

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
      
      toast({ title: "PDF Downloaded", description: "Poll results have been downloaded as PDF" });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({ title: "Error", description: "Failed to generate PDF", variant: "destructive" });
    }
  };

  return (
    <div className="bg-[#f8fafc] rounded-[3rem] border border-white shadow-[0_32px_128px_-16px_rgba(0,0,0,0.1)] w-full flex flex-col max-h-full overflow-hidden">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 p-10 pb-6 shrink-0 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full -mr-32 -mt-32 blur-3xl"></div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-2xl bg-[#13298f] flex items-center justify-center shadow-[0_8px_16px_rgba(19,41,143,0.2)]">
              <span className="material-symbols-outlined text-white text-2xl">analytics</span>
            </div>
            <h2 className="text-sm font-black font-headline text-[#13298f] uppercase tracking-[0.2em]">Detailed Analytics</h2>
          </div>
          <h1 className="text-2xl md:text-3xl font-black font-headline text-[#191c1e] leading-tight max-w-2xl">
            {pollHeading || pollTitle}
          </h1>
          {pollHeading && (
            <p className="text-[#757684] font-bold font-headline mt-1 text-sm uppercase tracking-widest opacity-60">
              {pollTitle}
            </p>
          )}
          <div className="flex items-center gap-4 mt-6">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 rounded-full">
              <Users className="w-3.5 h-3.5 text-[#13298f]" />
              <span className="text-[10px] font-black uppercase tracking-[0.1em] text-[#13298f]">{votesWithStudents.length} Delegates</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-full">
              <span className="material-symbols-outlined text-[14px] text-slate-500">event</span>
              <span className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-500">{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
            </div>
          </div>
        </div>
        
        {isOrganizer && (
          <button 
            onClick={downloadPDF}
            className="flex items-center gap-2 px-6 py-3 bg-white text-[#13298f] hover:bg-[#13298f] hover:text-white rounded-2xl font-bold shadow-sm hover:shadow-md transition-all text-sm shrink-0 relative z-10 border border-slate-200/50"
          >
            <Download className="w-4 h-4" /> Export PDF
          </button>
        )}
      </div>

      <div className="space-y-10 overflow-y-auto p-10 pt-4 min-h-0 custom-scrollbar [scrollbar-gutter:stable]">
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

          let headerColor = 'bg-[#f2f4f6] text-[#191c1e]';
          let icon = 'how_to_vote';
          let iconColor = 'text-[#757684]';
          
          if (isAye) {
            headerColor = 'bg-[#13298f]/10 text-[#13298f]';
            icon = 'thumb_up';
            iconColor = 'text-[#13298f]';
          } else if (isNo) {
            headerColor = 'bg-[#ba1a1a]/10 text-[#ba1a1a]';
            icon = 'thumb_down';
            iconColor = 'text-[#ba1a1a]';
          } else if (isNonVoteOption) {
            headerColor = 'bg-slate-100 text-slate-500';
            icon = 'person_off';
            iconColor = 'text-slate-500';
          }

          return (
            <div key={optionDisplay.id} className="rounded-[2.5rem] border border-white shadow-[0_8px_32px_rgba(0,0,0,0.04)] overflow-hidden bg-white/50 backdrop-blur-sm shrink-0">
              <div className={`flex flex-col sm:flex-row sm:items-center justify-between p-8 ${headerColor} border-b border-white/20`}>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-white/40 flex items-center justify-center backdrop-blur-md">
                    <span className={`material-symbols-outlined text-2xl ${iconColor}`}>{icon}</span>
                  </div>
                  <h3 className="text-xl font-black font-headline uppercase tracking-tight">{optionDisplay.text}</h3>
                </div>
                <div className="mt-4 sm:mt-0 flex flex-col items-start sm:items-end">
                  <span className="text-3xl font-black font-headline leading-none mb-1">{percentage}%</span>
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">{optionVotes.length} Delegates</span>
                </div>
              </div>

              {optionVotes.length > 0 ? (
                <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {optionVotes.map((vote) => (
                    <div key={vote.voter_id} className="flex items-center gap-4 p-4 rounded-3xl bg-white border border-slate-100 hover:border-[#13298f]/20 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 group">
                      <Avatar className="w-12 h-12 border-4 border-[#f8fafc] shadow-sm shrink-0 group-hover:scale-110 transition-transform">
                        <AvatarImage src={vote.student.photo_url || ''} alt={vote.student.name} />
                        <AvatarFallback className="bg-slate-100 text-[#757684] text-xs font-black uppercase">
                          {vote.student.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-[#191c1e] truncate font-headline group-hover:text-[#13298f] transition-colors">{vote.student.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] font-black text-[#757684] uppercase tracking-wider truncate">
                            {vote.student.position}
                          </span>
                          <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                          <span className="text-[10px] font-black text-[#13298f] uppercase tracking-wider">
                             P{['No Party', 'A', 'B', 'C', 'D', 'E'][vote.student.party_number] || vote.student.party_number}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center bg-[#f7f9fb]">
                  <p className="text-sm font-bold text-[#757684]">
                    {isNonVoteOption ? 'All delegates have cast their vote.' : 'No delegates selected this option.'}
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
