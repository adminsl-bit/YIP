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
      pdf.text(`Total Delegates: ${votesWithStudents.length}`, margin, y); y += 10;
      pdf.text(`Generated on: ${new Date().toLocaleString()}`, margin, y); y += 20;
      [...options, { id: 'did_not_vote', text: 'Did Not Vote' }].forEach(opt => {
        const o = getOptionDisplay(opt);
        const votes = getVotesForOption(o.id);
        pdf.setFontSize(14); pdf.text(`${o.text}: ${votes.length} delegates`, margin, y); y += 15;
        votes.forEach(v => {
          if (y > 280) { pdf.addPage(); y = margin; }
          pdf.setFontSize(10);
          pdf.text(`${v.student.name} — ${v.student.position} — ${partyLabel(v.student.party_number)}`, margin + 10, y); y += 8;
        });
        y += 10;
      });
      pdf.save(`poll-${pollTitle.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`);
      toast.success("PDF downloaded");
    } catch { toast.error("PDF export failed"); }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-surface-container-low">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();

  return (
    <div className="h-full flex flex-col bg-surface-container-low overflow-hidden">

      {/* ── Header — mirrors Timer tab layout ── */}
      <header className="flex justify-between items-center px-10 py-4 w-full shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
            <span className="material-symbols-outlined text-white text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>how_to_vote</span>
          </div>
          <div>
            <h1 className="font-headline font-extrabold text-2xl tracking-tighter text-primary">National Youth Parliament</h1>
            <p className="font-body text-xs font-medium text-on-surface-variant uppercase tracking-widest">Legislative Analytics Display</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isOrganizer && (
            <div className="flex items-center gap-2">
              <button
                onClick={downloadCSV}
                className="flex items-center gap-1.5 px-4 py-2 bg-surface-container-lowest border border-outline-variant/10 rounded-full text-xs font-black text-primary hover:bg-primary hover:text-white transition-colors shadow-sm font-headline"
              >
                <Download className="w-3 h-3" /> CSV
              </button>
              <button
                onClick={downloadPDF}
                className="flex items-center gap-1.5 px-4 py-2 bg-gradient-primary text-white rounded-full text-xs font-black hover:opacity-90 transition-opacity shadow-sm font-headline"
              >
                <Download className="w-3 h-3" /> PDF
              </button>
            </div>
          )}
          {/* Poll status pill — mirrors Timer session pill */}
          <div className="bg-white/70 backdrop-blur-[20px] px-6 py-3 rounded-full flex items-center gap-3 border border-outline-variant/20 shadow-sm">
            <span className={`w-2 h-2 rounded-full shrink-0 ${isActive ? 'bg-tertiary-container animate-pulse' : 'bg-outline-variant'}`} />
            <span className="font-headline font-bold text-on-surface-variant text-sm tracking-wide truncate max-w-[280px]">
              {pollHeading || pollTitle}
            </span>
            <div className="w-px h-4 bg-outline-variant/30" />
            <span className="font-headline font-black text-[10px] uppercase tracking-widest text-on-surface-variant/60">
              {isActive ? 'LIVE VOTING' : 'CLOSED'}
            </span>
          </div>
        </div>
      </header>

      {/* ── Stats row ── */}
      <div className="flex items-center justify-between px-10 pb-3 shrink-0 border-b border-outline-variant/10">
        <div className="flex items-center gap-5">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-on-surface-variant/60">
            <Users className="w-3.5 h-3.5" />{totalDelegates} DELEGATES
          </span>
          <span className="flex items-center gap-1.5 text-xs font-semibold text-on-surface-variant/60">
            <Calendar className="w-3.5 h-3.5" />{today}
          </span>
        </div>
        <div className="flex gap-6 items-center">
          {/* House Turnout */}
          <div className="w-44">
            <div className="flex justify-between items-baseline mb-1">
              <span className="text-[10px] font-black text-on-surface-variant/40 uppercase font-headline">House Turnout</span>
              <span className="text-xs font-bold text-primary">{turnoutPct}%</span>
            </div>
            <div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden">
              <div className="bg-primary h-full transition-all duration-500" style={{ width: `${turnoutPct}%` }} />
            </div>
            <p className="text-[9px] mt-1 text-on-surface-variant/60 font-medium">{actualVotes} / {totalDelegates} Delegates</p>
          </div>
          {/* Live Alignment */}
          <div className="w-44">
            <div className="flex justify-between items-baseline mb-1">
              <span className="text-[10px] font-black text-on-surface-variant/40 uppercase font-headline">Live Alignment</span>
              <span className="text-xs font-bold text-primary">{affirmPct.toFixed(0)}% {affirmLabel}</span>
            </div>
            <div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden flex">
              <div className="bg-primary h-full transition-all duration-500" style={{ width: `${affirmPct}%` }} />
              <div className="bg-error h-full transition-all duration-500" style={{ width: `${dissentPct}%` }} />
            </div>
            <div className="flex justify-between mt-1 text-[9px] text-on-surface-variant/60 font-medium">
              <span>{affirmCount} Affirmative</span>
              <span>{dissentCount} Dissenting</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main grid ── */}
      <div className="flex-1 grid grid-cols-12 gap-3 min-h-0 overflow-hidden px-4 pt-3">

        {/* Left column */}
        <div className="col-span-3 flex flex-col gap-3 min-h-0">

          {/* Voting Momentum */}
          <div className="bg-surface-container-lowest border border-outline-variant/10 rounded-2xl shadow-sm p-4 flex-1 flex flex-col min-h-0">
            <div className="flex justify-between items-start mb-3 shrink-0">
              <div>
                <h3 className="text-[10px] font-black text-on-surface-variant/40 uppercase tracking-wider font-headline">Voting Momentum</h3>
                <p className="text-[10px] text-on-surface-variant/60">Activity over last 15 min</p>
              </div>
              <div className="text-right">
                <span className="text-xl font-bold text-primary">+{currentVPM}</span>
                <p className="text-[8px] font-black text-on-surface-variant/40 uppercase font-headline">VOTES / MIN</p>
              </div>
            </div>
            {hasActivity ? (
              <div className="flex items-end gap-0.5 h-14 border-t border-dashed border-outline-variant/20 pt-1.5 shrink-0">
                {momentumBuckets.map((count, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-primary rounded-sm transition-all duration-300"
                    style={{ height: `${Math.max(count / maxBucket * 100, count > 0 ? 8 : 0)}%`, opacity: 0.25 + 0.75 * (i / 14) }}
                  />
                ))}
              </div>
            ) : (
              <div className="flex-1 border-t border-dashed border-outline-variant/20 flex items-center justify-center py-2">
                <span className="text-[10px] text-on-surface-variant/20 italic text-center px-2 font-headline">
                  No activity in the last 15 minutes.
                </span>
              </div>
            )}
          </div>

          {/* Technical Summary */}
          <div className="bg-surface-container border border-outline-variant/10 rounded-2xl p-4 shrink-0">
            <h3 className="text-[10px] font-black text-on-surface-variant/40 uppercase mb-3 font-headline">Technical Summary</h3>
            <ul className="space-y-2.5">
              <li className="flex justify-between text-[11px]">
                <span className="text-on-surface-variant/60">Quorum Requirement</span>
                <span className="font-bold text-on-surface">50% + 1</span>
              </li>
              <li className="flex justify-between text-[11px]">
                <span className="text-on-surface-variant/60">Voting Mechanism</span>
                <span className="font-bold text-on-surface">Simple Majority</span>
              </li>
              <li className="flex justify-between text-[11px]">
                <span className="text-on-surface-variant/60">Live Status</span>
                <span className={`flex items-center gap-1 font-black text-[10px] font-headline ${isActive ? 'text-emerald-500' : 'text-on-surface-variant/40'}`}>
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

            const accentBorder = isYes ? 'border-l-primary' : isNo ? 'border-l-error' : isDNV ? 'border-l-outline-variant' : 'border-l-primary-container';
            const accentText = isYes ? 'text-primary' : isNo ? 'text-error' : 'text-on-surface-variant/60';
            const iconBg = isYes ? 'bg-primary/5' : isNo ? 'bg-error/5' : 'bg-surface-container';
            const avatarBg = isYes ? 'bg-primary' : isNo ? 'bg-error' : 'bg-on-surface-variant/30';
            const badgeBg = isYes ? 'bg-primary/5 border-outline-variant/10' : isNo ? 'bg-error/5 border-outline-variant/10' : 'bg-surface-container border-outline-variant/10';
            const partyTextColor = isYes ? 'text-primary' : isNo ? 'text-error' : 'text-on-surface-variant/40';

            const flexClass = isDNV
              ? 'flex-[2] min-h-0 flex flex-col'
              : votes.length > 0
              ? 'flex-1 min-h-0 flex flex-col'
              : 'shrink-0';

            return (
              <section
                key={optDis.id}
                className={`bg-surface-container-lowest border border-outline-variant/10 border-l-4 ${accentBorder} rounded-2xl shadow-sm ${flexClass} p-4`}
              >
                <div className="flex justify-between items-center mb-2 shrink-0">
                  <div className="flex items-center gap-2">
                    <div className={`${iconBg} ${accentText} p-1.5 rounded-full`}>
                      {isYes ? <CheckCircle className="w-3.5 h-3.5" strokeWidth={3} /> :
                       isNo ? <XCircle className="w-3.5 h-3.5" strokeWidth={3} /> :
                       isDNV ? <UserMinus className="w-3.5 h-3.5" strokeWidth={3} /> :
                       <MoreHorizontal className="w-3.5 h-3.5" />}
                    </div>
                    <h2 className={`text-sm font-black italic ${accentText} uppercase tracking-tight font-headline`}>
                      {optDis.text}
                    </h2>
                  </div>
                  <div className="text-right">
                    <span className={`text-lg font-extrabold ${accentText} font-headline`}>{pct}%</span>
                    <span className="text-[10px] font-bold text-on-surface-variant/40 ml-2 font-headline">{votes.length} DELEGATES</span>
                  </div>
                </div>

                {votes.length > 0 ? (
                  <div className="flex-1 min-h-0 overflow-y-auto grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-7 gap-1.5 content-start">
                    {votes.map(vote => (
                      <div key={vote.voter_id} className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border ${badgeBg}`}>
                        {vote.student.photo_url ? (
                          <img src={vote.student.photo_url} alt={vote.student.name} className="w-[18px] h-[18px] rounded-full object-cover shrink-0" />
                        ) : (
                          <div className={`w-[18px] h-[18px] rounded-full flex items-center justify-center font-black text-[8px] text-white shrink-0 ${avatarBg}`}>
                            {vote.student.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="flex flex-col leading-none min-w-0">
                          <span className="font-bold truncate text-[10px] text-on-surface">
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
                  <p className="text-[10px] text-center text-on-surface-variant/20 italic uppercase font-black py-2 tracking-widest shrink-0 font-headline">
                    {isDNV ? 'Universal participation achieved.' : 'No parliamentary alignment found.'}
                  </p>
                )}
              </section>
            );
          })}
        </div>
      </div>

      {/* ── Footer ── */}
      <footer className="flex justify-between items-center text-[10px] text-on-surface-variant/40 font-black border-t border-outline-variant/10 px-4 py-2 shrink-0 font-headline">
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
