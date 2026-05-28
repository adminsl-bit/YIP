import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Download, Users, Calendar, CheckCircle, XCircle, UserMinus, MoreHorizontal } from "lucide-react";
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
  created_at?: string;
  student: Student;
}

interface DetailedPollResultsProps {
  pollId: string;
  pollTitle: string;
  pollHeading?: string;
  options: Array<{ id: string; text: string } | string>;
  isOrganizer?: boolean;
  isActive?: boolean;
}

const getOptionDisplay = (option: { id: string; text: string } | string): { id: string; text: string } => {
  if (typeof option === 'string') return { id: option, text: option };
  return option;
};

const abbrevPos = (pos: string): string => {
  if (!pos) return '?.';
  const words = pos.trim().split(/\s+/);
  return words.map(w => w[0]?.toUpperCase() ?? '').join('').substring(0, 2) + '.';
};

const partyLabel = (num: number | null | undefined): string => {
  if (num == null) return 'PNONE';
  return `P${(['NONE', 'A', 'B', 'C', 'D', 'E'] as string[])[num] ?? num}`;
};

export const DetailedPollResults = ({
  pollId, pollTitle, pollHeading, options, isOrganizer = false, isActive = false
}: DetailedPollResultsProps) => {
  const [votesWithStudents, setVotesWithStudents] = useState<VoteWithStudent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    const [{ data: votesData }, { data: studentsData }] = await Promise.all([
      supabase.from('poll_votes').select('voter_id, option_id, created_at').eq('poll_id', pollId),
      supabase.from('profiles').select('user_id, name, position, party_number, constituency, state, photo_url').eq('user_type', 'student').eq('is_active', true),
    ]);

    const studentMap = new Map((studentsData || []).map((s: any) => [s.user_id, s]));
    const voterSet = new Set((votesData || []).map((v: any) => v.voter_id));

    const result: VoteWithStudent[] = [
      ...(votesData || [])
        .filter((v: any) => studentMap.has(v.voter_id))
        .map((v: any) => ({ voter_id: v.voter_id, option_id: v.option_id, created_at: v.created_at, student: studentMap.get(v.voter_id) as Student })),
      ...(studentsData || [])
        .filter((s: any) => !voterSet.has(s.user_id))
        .map((s: any) => ({ voter_id: s.user_id, option_id: 'did_not_vote', student: s as Student })),
    ];

    setVotesWithStudents(result);
    setLoading(false);
  };

  useEffect(() => {
    setLoading(true);
    fetchData();
    const ch = supabase
      .channel(`dpoll_${pollId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'poll_votes', filter: `poll_id=eq.${pollId}` } as any, fetchData)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [pollId]);

  const getVotesForOption = (optId: string) => votesWithStudents.filter(v => v.option_id === optId);

  const totalDelegates = votesWithStudents.length;
  const actualVotes = votesWithStudents.filter(v => v.option_id !== 'did_not_vote').length;
  const turnoutPct = totalDelegates > 0 ? (actualVotes / totalDelegates * 100).toFixed(1) : '0.0';

  const optionDisplays = options.map(getOptionDisplay);
  const yesOpt = optionDisplays.find(o => ['yes', 'aye'].includes(o.text.toLowerCase()));
  const noOpt = optionDisplays.find(o => ['no', 'nay'].includes(o.text.toLowerCase()));
  const affirmCount = yesOpt ? getVotesForOption(yesOpt.id).length : (optionDisplays[0] ? getVotesForOption(optionDisplays[0].id).length : 0);
  const dissentCount = noOpt ? getVotesForOption(noOpt.id).length : (optionDisplays[1] ? getVotesForOption(optionDisplays[1].id).length : 0);
  const affirmPct = actualVotes > 0 ? affirmCount / actualVotes * 100 : 0;
  const dissentPct = actualVotes > 0 ? dissentCount / actualVotes * 100 : 0;
  const affirmLabel = (yesOpt?.text || optionDisplays[0]?.text || 'AYE').toUpperCase();

  const momentumBuckets = useMemo(() => {
    const now = Date.now();
    return Array.from({ length: 15 }, (_, i) => {
      const start = now - (15 - i) * 60000;
      const end = now - (14 - i) * 60000;
      return votesWithStudents.filter(v => {
        if (!v.created_at) return false;
        const t = new Date(v.created_at).getTime();
        return t >= start && t < end;
      }).length;
    });
  }, [votesWithStudents]);

  const currentVPM = momentumBuckets[14] ?? 0;
  const maxBucket = Math.max(...momentumBuckets, 1);
  const hasActivity = momentumBuckets.some(b => b > 0);

  const downloadCSV = () => {
    try {
      const rows: string[][] = [['Option', 'Delegate Name', 'Position', 'Party', 'State', 'Constituency']];
      [...options, { id: 'did_not_vote', text: 'Did Not Vote' }].forEach(opt => {
        const o = getOptionDisplay(opt);
        getVotesForOption(o.id).forEach(v => {
          rows.push([o.text, v.student.name, v.student.position, partyLabel(v.student.party_number), v.student.state || '', v.student.constituency || '']);
        });
      });
      const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
      const a = Object.assign(document.createElement('a'), { href: url, download: `poll-${pollTitle.replace(/[^a-zA-Z0-9]/g, '-')}.csv` });
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("CSV downloaded");
    } catch { toast.error("CSV export failed"); }
  };

  const downloadPDF = () => {
    try {
      const pdf = new jsPDF();
      const margin = 20;
      let y = margin;
      pdf.setFontSize(20); pdf.text(`Poll Results: ${pollTitle}`, margin, y); y += 20;
      pdf.setFontSize(12);
      pdf.text(`Total Students: ${votesWithStudents.length}`, margin, y); y += 10;
      pdf.text(`Generated on: ${new Date().toLocaleString()}`, margin, y); y += 20;
      [...options, { id: 'did_not_vote', text: 'Did Not Vote' }].forEach(opt => {
        const o = getOptionDisplay(opt);
        const votes = getVotesForOption(o.id);
        pdf.setFontSize(14); pdf.text(`${o.text}: ${votes.length} students`, margin, y); y += 15;
        votes.forEach(v => {
          if (y > 280) { pdf.addPage(); y = margin; }
          pdf.setFontSize(10);
          pdf.text(`${v.student.name} - ${v.student.position} - ${partyLabel(v.student.party_number)}`, margin + 10, y); y += 8;
        });
        y += 10;
      });
      pdf.save(`poll-${pollTitle.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`);
      toast.success("PDF downloaded");
    } catch { toast.error("PDF export failed"); }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();

  return (
    <div className="h-full flex flex-col p-4 gap-3 bg-slate-50 overflow-hidden">

      {/* ── Header ── */}
      <header className="flex justify-between items-end pb-3 border-b border-slate-200 shrink-0">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="bg-primary text-white p-1 rounded">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 8h10"/><path d="M7 12h10"/><path d="M7 16h10"/>
              </svg>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Legislative Analytics</span>
          </div>
          <h1 className="text-3xl font-extrabold italic tracking-tight text-primary leading-none">
            {pollHeading || pollTitle}
          </h1>
          {pollHeading && (
            <p className="text-xs font-semibold text-slate-400 mt-0.5">{pollTitle}</p>
          )}
          <div className="flex items-center gap-4 mt-2">
            <span className="flex items-center gap-1 text-xs font-semibold text-slate-500">
              <Users className="w-3.5 h-3.5" />{totalDelegates} DELEGATES
            </span>
            <span className="flex items-center gap-1 text-xs font-semibold text-slate-500">
              <Calendar className="w-3.5 h-3.5" />{today}
            </span>
            {isOrganizer && (
              <div className="flex items-center gap-2 ml-2">
                <button onClick={downloadCSV} className="flex items-center gap-1 px-3 py-1 bg-white border border-slate-200 rounded text-xs font-bold text-primary hover:bg-primary hover:text-white transition-colors shadow-sm">
                  <Download className="w-3 h-3" /> CSV
                </button>
                <button onClick={downloadPDF} className="flex items-center gap-1 px-3 py-1 bg-primary text-white rounded text-xs font-bold hover:opacity-90 transition-opacity shadow-sm">
                  <Download className="w-3 h-3" /> PDF
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Compact stat bars */}
        <div className="flex gap-6 items-center shrink-0">
          <div className="w-44">
            <div className="flex justify-between items-baseline mb-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">House Turnout</span>
              <span className="text-xs font-bold text-primary">{turnoutPct}%</span>
            </div>
            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
              <div className="bg-primary h-full transition-all duration-500" style={{ width: `${turnoutPct}%` }} />
            </div>
            <p className="text-[9px] mt-1 text-slate-500 font-medium">{actualVotes} / {totalDelegates} Delegates</p>
          </div>
          <div className="w-44">
            <div className="flex justify-between items-baseline mb-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Live Alignment</span>
              <span className="text-xs font-bold text-emerald-600">{affirmPct.toFixed(0)}% {affirmLabel}</span>
            </div>
            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden flex">
              <div className="bg-primary h-full transition-all duration-500" style={{ width: `${affirmPct}%` }} />
              <div className="bg-rose-500 h-full transition-all duration-500" style={{ width: `${dissentPct}%` }} />
            </div>
            <div className="flex justify-between mt-1 text-[9px] text-slate-500 font-medium">
              <span>{affirmCount} Affirmative</span>
              <span>{dissentCount} Dissenting</span>
            </div>
          </div>
        </div>
      </header>

      {/* ── Main grid ── */}
      <div className="flex-1 grid grid-cols-12 gap-3 min-h-0 overflow-hidden">

        {/* Left column: momentum + summary */}
        <div className="col-span-3 flex flex-col gap-3 min-h-0">

          {/* Voting Momentum */}
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4 flex-1 flex flex-col min-h-0">
            <div className="flex justify-between items-start mb-3 shrink-0">
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Voting Momentum</h3>
                <p className="text-[10px] text-slate-500">Activity over last 15 min</p>
              </div>
              <div className="text-right">
                <span className="text-xl font-bold text-emerald-500">+{currentVPM}</span>
                <p className="text-[8px] font-bold text-slate-400 uppercase">VOTES / MIN</p>
              </div>
            </div>
            {hasActivity ? (
              <div className="flex items-end gap-0.5 h-14 border-t border-dashed border-slate-200 pt-1.5 shrink-0">
                {momentumBuckets.map((count, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-primary rounded-sm transition-all duration-300"
                    style={{ height: `${Math.max(count / maxBucket * 100, count > 0 ? 8 : 0)}%`, opacity: 0.3 + 0.7 * (i / 14) }}
                  />
                ))}
              </div>
            ) : (
              <div className="flex-1 border-t border-dashed border-slate-200 flex items-center justify-center py-2">
                <span className="text-[10px] text-slate-300 italic text-center px-2">No activity in the last 15 minutes.</span>
              </div>
            )}
          </div>

          {/* Technical Summary */}
          <div className="bg-slate-100/60 border border-slate-100 rounded-lg p-4 shrink-0">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase mb-3">Technical Summary</h3>
            <ul className="space-y-2.5">
              <li className="flex justify-between text-[11px]">
                <span className="text-slate-500">Quorum Requirement</span>
                <span className="font-bold">50% + 1</span>
              </li>
              <li className="flex justify-between text-[11px]">
                <span className="text-slate-500">Voting Mechanism</span>
                <span className="font-bold">Simple Majority</span>
              </li>
              <li className="flex justify-between text-[11px]">
                <span className="text-slate-500">Live Status</span>
                <span className={`flex items-center gap-1 font-bold ${isActive ? 'text-emerald-500' : 'text-slate-400'}`}>
                  {isActive && <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse inline-block" />}
                  {isActive ? 'ACTIVE' : 'CLOSED'}
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Right column: vote option blocks */}
        <div className="col-span-9 flex flex-col gap-2 min-h-0 overflow-hidden">
          {[...options, { id: 'did_not_vote', text: 'Did Not Vote' }].map((option) => {
            const optDis = getOptionDisplay(option);
            const votes = getVotesForOption(optDis.id);
            const pct = totalDelegates > 0 ? (votes.length / totalDelegates * 100).toFixed(1) : '0.0';

            const isYes = ['yes', 'aye'].includes(optDis.text.toLowerCase());
            const isNo = ['no', 'nay'].includes(optDis.text.toLowerCase());
            const isDNV = optDis.id === 'did_not_vote';

            const accentBorder = isYes ? 'border-l-primary' : isNo ? 'border-l-rose-600' : isDNV ? 'border-l-slate-400' : 'border-l-slate-500';
            const accentText = isYes ? 'text-primary' : isNo ? 'text-rose-600' : 'text-slate-500';
            const iconBg = isYes ? 'bg-blue-50' : isNo ? 'bg-red-50' : 'bg-slate-100';
            const avatarBg = isYes ? 'bg-primary' : isNo ? 'bg-rose-600' : 'bg-slate-400';
            const badgeBg = isYes ? 'bg-blue-50/70 border border-blue-100' : isNo ? 'bg-red-50/70 border border-red-100' : 'bg-slate-50 border border-slate-200';
            const partyTextColor = isYes ? 'text-primary' : isNo ? 'text-rose-500' : 'text-slate-400';

            const flexClass = isDNV
              ? 'flex-[2] min-h-0 flex flex-col'
              : votes.length > 0
              ? 'flex-1 min-h-0 flex flex-col'
              : 'shrink-0';

            return (
              <section
                key={optDis.id}
                className={`bg-white border border-slate-200 border-l-4 ${accentBorder} rounded-lg shadow-sm ${flexClass} p-4`}
              >
                <div className="flex justify-between items-center mb-2 shrink-0">
                  <div className="flex items-center gap-2">
                    <div className={`${iconBg} ${accentText} p-1.5 rounded-full`}>
                      {isYes ? <CheckCircle className="w-3.5 h-3.5" strokeWidth={3} /> :
                       isNo ? <XCircle className="w-3.5 h-3.5" strokeWidth={3} /> :
                       isDNV ? <UserMinus className="w-3.5 h-3.5" strokeWidth={3} /> :
                       <MoreHorizontal className="w-3.5 h-3.5" />}
                    </div>
                    <h2 className={`text-sm font-black italic ${accentText} uppercase tracking-tight`}>{optDis.text}</h2>
                  </div>
                  <div className="text-right">
                    <span className={`text-lg font-extrabold ${accentText}`}>{pct}%</span>
                    <span className="text-[10px] font-bold text-slate-400 ml-2">{votes.length} DELEGATES</span>
                  </div>
                </div>

                {votes.length > 0 ? (
                  <div className="flex-1 min-h-0 overflow-y-auto grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-7 gap-1.5 content-start">
                    {votes.map(vote => (
                      <div key={vote.voter_id} className={`flex items-center gap-1.5 px-2 py-1 rounded-md ${badgeBg}`}>
                        {vote.student.photo_url ? (
                          <img src={vote.student.photo_url} alt={vote.student.name} className="w-[18px] h-[18px] rounded-full object-cover shrink-0" />
                        ) : (
                          <div className={`w-[18px] h-[18px] rounded-full flex items-center justify-center font-black text-[8px] text-white shrink-0 ${avatarBg}`}>
                            {vote.student.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="flex flex-col leading-none min-w-0">
                          <span className="font-bold truncate text-[10px] text-slate-800">
                            {vote.student.name.split(' ')[0]}
                          </span>
                          <span className={`text-[8px] uppercase font-bold ${partyTextColor}`}>
                            {abbrevPos(vote.student.position)} · {partyLabel(vote.student.party_number)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-center text-slate-300 italic uppercase font-semibold py-2 tracking-widest shrink-0">
                    {isDNV ? 'Universal participation achieved.' : 'No parliamentary alignment found.'}
                  </p>
                )}
              </section>
            );
          })}
        </div>
      </div>

      {/* ── Footer ── */}
      <footer className="flex justify-between items-center text-[10px] text-slate-400 font-semibold border-t border-slate-200 pt-2 shrink-0">
        <div className="flex gap-4">
          <span>DEVICE: WEB_PORTAL_01</span>
          <span>SECURITY: ENCRYPTED_LEDGER</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 bg-primary rounded-sm" />
          <span>YIP PARLIAMENT HUB · LEGISLATIVE ANALYTICS</span>
        </div>
      </footer>
    </div>
  );
};
