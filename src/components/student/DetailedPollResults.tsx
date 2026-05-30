import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Download } from "lucide-react";
import { motion } from "framer-motion";
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
  if (typeof option === "string") return { id: option, text: option };
  return option;
};

const abbrevPos = (pos: string): string => {
  if (!pos) return "?.";
  return pos.trim().split(/\s+/).map(w => w[0]?.toUpperCase() ?? "").join("").substring(0, 2) + ".";
};

const partyLabel = (num: number | null | undefined): string => {
  if (num == null) return "PNONE";
  return `P${(["NONE", "A", "B", "C", "D", "E"] as string[])[num] ?? num}`;
};

/* ── Per-option bar style config ── */
interface BarStyle {
  label: string;
  barFrom: string;
  barTo: string;
  textColor: string;
  avatarBg: string;
  icon: string;
}

const getBarStyle = (text: string, idx: number, isWinner: boolean): BarStyle => {
  const t = text.toLowerCase();
  if (t === "yes" || t === "aye") return {
    label: text.toUpperCase(),
    barFrom: "#00583b", barTo: "#4edea3",
    textColor: "text-on-tertiary-container",
    avatarBg: "bg-tertiary-container",
    icon: isWinner ? "crown" : "check_circle",
  };
  if (t === "no" || t === "nay") return {
    label: text.toUpperCase(),
    barFrom: "#ac3509", barTo: "#fe6f42",
    textColor: "text-secondary",
    avatarBg: "bg-secondary",
    icon: isWinner ? "crown" : "gavel",
  };
  const others = [
    { from: "#13298f", to: "#3042a6", text: "text-primary", bg: "bg-primary" },
    { from: "#7c43bd", to: "#b47aed", text: "text-tertiary", bg: "bg-tertiary" },
  ];
  const c = others[idx % others.length];
  return {
    label: text.toUpperCase(),
    barFrom: c.from, barTo: c.to,
    textColor: c.text, avatarBg: c.bg,
    icon: isWinner ? "crown" : "how_to_vote",
  };
};

export const DetailedPollResults = ({
  pollId, pollTitle, pollHeading, options, isOrganizer = false, isActive = false,
}: DetailedPollResultsProps) => {
  const [votesWithStudents, setVotesWithStudents] = useState<VoteWithStudent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    const { data: pollRow } = await supabase
      .from("polls").select("event_id, created_at").eq("id", pollId).single();

    let profilesQuery = supabase
      .from("profiles")
      .select("user_id, name, position, party_number, constituency, state, photo_url")
      .eq("user_type", "student")
      .eq("is_active", true);
    if (pollRow?.event_id) {
      profilesQuery = profilesQuery.eq("event_id", pollRow.event_id);
    }
    if (pollRow?.created_at) {
      profilesQuery = profilesQuery.lte("created_at", pollRow.created_at);
    }

    const [{ data: votesData }, { data: studentsData }] = await Promise.all([
      supabase.from("poll_votes").select("voter_id, option_id, created_at").eq("poll_id", pollId),
      profilesQuery,
    ]);
    // Only MPs are eligible voters — exclude journalists and administrators
    const mpStudents = (studentsData || []).filter((s: any) => {
      const pos = (s.position ?? "").toLowerCase();
      return !pos.includes("journalist") && !pos.includes("administrator") && !pos.includes("admin");
    });
    const studentMap = new Map(mpStudents.map((s: any) => [s.user_id, s]));
    const voterSet = new Set((votesData || []).map((v: any) => v.voter_id));
    setVotesWithStudents([
      ...(votesData || []).filter((v: any) => studentMap.has(v.voter_id)).map((v: any) => ({
        voter_id: v.voter_id, option_id: v.option_id, created_at: v.created_at,
        student: studentMap.get(v.voter_id) as Student,
      })),
      ...mpStudents.filter((s: any) => !voterSet.has(s.user_id)).map((s: any) => ({
        voter_id: s.user_id, option_id: "did_not_vote", student: s as Student,
      })),
    ]);
    setLoading(false);
  };

  useEffect(() => {
    setLoading(true);
    fetchData();
    const ch = supabase
      .channel(`dpoll_${pollId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "poll_votes", filter: `poll_id=eq.${pollId}` } as any, fetchData)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [pollId]);

  const getVotesForOption = (optId: string) => votesWithStudents.filter(v => v.option_id === optId);
  const totalDelegates = votesWithStudents.length;
  const actualVotes = votesWithStudents.filter(v => v.option_id !== "did_not_vote").length;
  const dnvCount = totalDelegates - actualVotes;
  const turnoutPct = totalDelegates > 0 ? (actualVotes / totalDelegates * 100).toFixed(1) : "0.0";

  const optionDisplays = options.map(getOptionDisplay);

  const momentumBuckets = useMemo(() => {
    const now = Date.now();
    return Array.from({ length: 15 }, (_, i) => {
      const start = now - (15 - i) * 60000;
      const end   = now - (14 - i) * 60000;
      return votesWithStudents.filter(v => {
        if (!v.created_at) return false;
        const t = new Date(v.created_at).getTime();
        return t >= start && t < end;
      }).length;
    });
  }, [votesWithStudents]);

  const currentVPM = momentumBuckets[14] ?? 0;
  const maxBucket  = Math.max(...momentumBuckets, 1);
  const hasActivity = momentumBuckets.some(b => b > 0);

  const downloadCSV = () => {
    try {
      const rows: string[][] = [["Option", "Delegate Name", "Position", "Party", "State", "Constituency"]];
      [...options, { id: "did_not_vote", text: "Did Not Vote" }].forEach(opt => {
        const o = getOptionDisplay(opt);
        getVotesForOption(o.id).forEach(v => {
          rows.push([o.text, v.student.name, v.student.position, partyLabel(v.student.party_number), v.student.state || "", v.student.constituency || ""]);
        });
      });
      const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
      const a = Object.assign(document.createElement("a"), { href: url, download: `poll-${pollTitle.replace(/[^a-zA-Z0-9]/g, "-")}.csv` });
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("CSV downloaded");
    } catch { toast.error("CSV export failed"); }
  };

  const downloadPDF = () => {
    try {
      const pdf = new jsPDF();
      const margin = 20; let y = margin;
      pdf.setFontSize(20); pdf.text(`Poll Results: ${pollTitle}`, margin, y); y += 20;
      pdf.setFontSize(12);
      pdf.text(`Total Delegates: ${totalDelegates}`, margin, y); y += 10;
      pdf.text(`Generated on: ${new Date().toLocaleString()}`, margin, y); y += 20;
      [...options, { id: "did_not_vote", text: "Did Not Vote" }].forEach(opt => {
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
      pdf.save(`poll-${pollTitle.replace(/[^a-zA-Z0-9]/g, "-")}.pdf`);
      toast.success("PDF downloaded");
    } catch { toast.error("PDF export failed"); }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-surface">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  /* ── Organizer compact view (embedded inside PollManagement) ── */
  if (isOrganizer) {
    return (
      <div className="space-y-4">
        <div className="flex gap-6 items-center text-[11px] font-headline text-on-surface-variant/60 border-b border-outline-variant/10 pb-3">
          <span>{totalDelegates} delegates · {actualVotes} voted · {turnoutPct}% turnout</span>
          {isOrganizer && (
            <div className="ml-auto flex gap-1.5">
              <button onClick={downloadCSV} title="Download CSV"
                className="w-8 h-8 rounded-full bg-surface-container border border-outline-variant/10 flex items-center justify-center text-on-surface-variant/60 hover:bg-primary hover:text-white transition-all">
                <Download className="w-3 h-3" />
              </button>
              <button onClick={downloadPDF} title="Download PDF"
                className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white hover:opacity-80 transition-all">
                <Download className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
        {[...optionDisplays, { id: "did_not_vote", text: "Did Not Vote" }].map((opt, idx) => {
          const votes = getVotesForOption(opt.id);
          const pct = totalDelegates > 0 ? (votes.length / totalDelegates * 100) : 0;
          const isDNV = opt.id === "did_not_vote";
          const isYes = ["yes", "aye"].includes(opt.text.toLowerCase());
          const isNo  = ["no", "nay"].includes(opt.text.toLowerCase());
          const accentText = isYes ? "text-on-tertiary-container" : isNo ? "text-secondary" : isDNV ? "text-on-surface-variant/40" : "text-primary";
          const barBg = isYes ? "bg-tertiary-container" : isNo ? "bg-secondary" : isDNV ? "bg-outline-variant/30" : "bg-primary";
          const badgeBg = isYes ? "bg-on-tertiary-container/5 border-outline-variant/10" : isNo ? "bg-secondary/5 border-outline-variant/10" : "bg-surface-container border-outline-variant/10";
          return (
            <div key={opt.id}>
              <div className="flex justify-between items-baseline mb-1">
                <span className={`text-xs font-black uppercase tracking-wide font-headline ${accentText}`}>{opt.text}</span>
                <span className="text-xs font-bold text-on-surface font-headline">{votes.length} <span className="font-normal text-on-surface-variant/40">({pct.toFixed(1)}%)</span></span>
              </div>
              <div className="w-full h-1.5 bg-surface-container-high rounded-full overflow-hidden mb-2">
                <div className={`h-full rounded-full transition-all duration-700 ${barBg}`} style={{ width: `${pct}%` }} />
              </div>
              {votes.length > 0 && !isDNV && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {votes.map(vote => (
                    <div key={vote.voter_id} className={`flex items-center gap-1 px-1.5 py-0.5 rounded border ${badgeBg}`}>
                      {vote.student.photo_url
                        ? <img src={vote.student.photo_url} alt={vote.student.name} className="w-[14px] h-[14px] rounded-full object-cover shrink-0" />
                        : <div className={`w-[14px] h-[14px] rounded-full flex items-center justify-center font-black text-[6px] text-white shrink-0 ${isYes ? "bg-tertiary-container" : isNo ? "bg-secondary" : "bg-primary"}`}>
                            {vote.student.name.split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase()}
                          </div>
                      }
                      <span className="text-[9px] font-medium text-on-surface truncate max-w-[56px]">{vote.student.name.split(" ")[0]}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {/* Voting Momentum (compact) */}
        {hasActivity && (
          <div className="border-t border-outline-variant/10 pt-3">
            <p className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant/40 font-headline mb-1.5">
              Voting Momentum <span className="ml-2 text-primary">+{currentVPM}/min</span>
            </p>
            <div className="flex items-end gap-0.5 h-8">
              {momentumBuckets.map((count, i) => (
                <div key={i} className="flex-1 bg-primary rounded-sm transition-all duration-300"
                  style={{ height: `${Math.max(count / maxBucket * 100, count > 0 ? 8 : 0)}%`, opacity: 0.2 + 0.8 * (i / 14) }} />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ── Open Display (Sovereign Bloom) ── */
  const maxVotes = Math.max(...optionDisplays.map(o => getVotesForOption(o.id).length), 0);

  return (
    <div className="h-full flex flex-col bg-surface overflow-hidden relative">

      {/* ── Ambient background blobs ── */}
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-primary/5 rounded-full blur-[100px] pointer-events-none z-0" />
      <div className="absolute top-1/2 -right-48 w-[600px] h-[600px] bg-tertiary-container/5 rounded-full blur-[120px] pointer-events-none z-0" />

      {/* ── Timer-style header ── */}
      <header className="relative z-10 flex justify-between items-center px-10 py-4 shrink-0">
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
          <div className="bg-white/70 backdrop-blur-[20px] px-5 py-2.5 rounded-full flex items-center gap-3 border border-outline-variant/20 shadow-sm">
            <span className={`w-2 h-2 rounded-full shrink-0 ${isActive ? "bg-on-tertiary-container animate-pulse" : "bg-outline-variant"}`} />
            <span className="font-headline font-bold text-on-surface-variant text-sm tracking-wide truncate max-w-[280px]">
              {pollHeading || pollTitle}
            </span>
            <div className="w-px h-4 bg-outline-variant/30" />
            <span className="font-headline font-black text-[10px] uppercase tracking-widest text-on-surface-variant/60">
              {isActive ? "LIVE VOTING" : "CLOSED"}
            </span>
          </div>
          {isOrganizer && (
            <div className="flex items-center gap-1.5">
              <button onClick={downloadCSV} title="Download CSV"
                className="w-9 h-9 rounded-full bg-surface-container-lowest border border-outline-variant/10 flex items-center justify-center text-on-surface-variant/60 hover:bg-primary hover:text-white transition-all shadow-sm">
                <Download className="w-3.5 h-3.5" />
              </button>
              <button onClick={downloadPDF} title="Download PDF"
                className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-white hover:opacity-80 transition-all shadow-sm shadow-primary/20">
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ── Main area — no scroll, fills remaining height ── */}
      <div className="relative z-10 flex-1 min-h-0 overflow-hidden flex flex-col px-6 md:px-14 lg:px-24 pt-4 pb-4 selection:bg-primary/20">

        {/* Poll question hero */}
        <h2 className="shrink-0 font-display text-2xl md:text-4xl font-extrabold tracking-tight text-primary leading-tight text-center mb-3 max-w-5xl mx-auto">
          {pollTitle}
        </h2>

        {/* Stats pill */}
        <div className="shrink-0 flex flex-wrap gap-4 md:gap-8 items-center justify-center bg-surface-container-low/80 backdrop-blur-md border border-white/20 shadow-xl shadow-primary/5 px-6 md:px-10 py-2.5 rounded-full mb-4 mx-auto">
          <div className="flex items-center gap-1.5 text-on-surface-variant font-body font-semibold">
            <span className="material-symbols-outlined text-[16px]">groups</span>
            <span className="text-xs">Total Votes: <strong className="text-on-surface">{actualVotes}</strong></span>
          </div>
          <div className="w-px h-4 bg-outline-variant/30" />
          <div className="flex items-center gap-1.5 text-on-surface-variant font-body font-semibold">
            <span className="material-symbols-outlined text-[16px]">analytics</span>
            <span className="text-xs">House Turnout: <strong className="text-primary">{turnoutPct}%</strong></span>
          </div>
          <div className="w-px h-4 bg-outline-variant/30" />
          <div className="flex items-center gap-1.5 text-on-surface-variant font-body font-semibold">
            <span className="material-symbols-outlined text-[16px]">people</span>
            <span className="text-xs">Delegates: <strong className="text-on-surface">{totalDelegates}</strong></span>
          </div>
          <div className="w-px h-4 bg-outline-variant/30" />
          <div className={`flex items-center gap-1.5 font-bold font-body ${isActive ? "text-on-tertiary-container" : "text-on-surface-variant/40"}`}>
            <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>sensors</span>
            <span className={`text-xs ${isActive ? "animate-pulse" : ""}`}>
              {isActive ? "Live Status" : "Session Closed"}
            </span>
          </div>
        </div>

        {/* Vote option bars — fill remaining space, evenly distributed */}
        <div className="flex-1 min-h-0 w-full max-w-5xl mx-auto flex flex-col justify-evenly gap-2">
          {optionDisplays.map((opt, idx) => {
            const votes = getVotesForOption(opt.id);
            const count = votes.length;
            const pct = totalDelegates > 0 ? (count / totalDelegates) * 100 : 0;
            const isWinner = count === maxVotes && count > 0;
            const style = getBarStyle(opt.text, idx, isWinner);
            const barWidth = Math.max(pct, count > 0 ? 4 : 0);

            return (
              <div key={opt.id} className="flex flex-col min-h-0">
                {/* Label row */}
                <div className="flex items-end justify-between mb-1.5 px-2 shrink-0">
                  <span className={`font-display text-xl font-bold ${style.textColor}`}>{style.label}</span>
                  <div className="flex items-baseline gap-2">
                    <span className={`font-display text-4xl font-extrabold ${style.textColor} transition-all`}>
                      {pct.toFixed(0)}%
                    </span>
                    <span className="font-body text-on-surface-variant text-base">{count} votes</span>
                  </div>
                </div>

                {/* Animated bar */}
                <div className="relative w-full bg-surface-container rounded-full overflow-hidden shadow-inner shrink-0" style={{ height: 'clamp(40px, 7vh, 80px)' }}>
                  <motion.div
                    key={`${opt.id}-${count}`}
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: `${barWidth}%`, opacity: 1 }}
                    transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute top-0 left-0 h-full rounded-full flex items-center justify-end pr-5"
                    style={{ background: `linear-gradient(to right, ${style.barFrom}, ${style.barTo})` }}
                  >
                    {barWidth > 10 && (
                      <span
                        className="material-symbols-outlined text-white text-3xl drop-shadow-md"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        {style.icon}
                      </span>
                    )}
                  </motion.div>
                  {count === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-[11px] font-black uppercase tracking-[0.3em] text-on-surface-variant/20 font-headline">
                        No parliamentary alignment
                      </span>
                    </div>
                  )}
                </div>

                {/* Delegate avatar strip */}
                {votes.length > 0 && (
                  <div className="mt-1.5 px-2 flex items-center gap-2 overflow-hidden shrink-0">
                    <div className="flex -space-x-1.5">
                      {votes.slice(0, 12).map((vote) => (
                        vote.student.photo_url ? (
                          <img
                            key={vote.voter_id}
                            src={vote.student.photo_url}
                            alt={vote.student.name}
                            title={vote.student.name}
                            className="w-6 h-6 rounded-full border-2 border-surface object-cover"
                          />
                        ) : (
                          <div
                            key={vote.voter_id}
                            title={vote.student.name}
                            className={`w-6 h-6 rounded-full border-2 border-surface flex items-center justify-center text-[8px] font-bold text-white ${style.avatarBg}`}
                          >
                            {vote.student.name.split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase()}
                          </div>
                        )
                      ))}
                    </div>
                    {votes.length > 12 && (
                      <span className="text-[11px] font-bold text-on-surface-variant/40 font-headline">
                        +{votes.length - 12} more
                      </span>
                    )}
                    <div className="ml-2 flex gap-2 overflow-hidden">
                      {votes.slice(0, 8).map(vote => (
                        <span key={vote.voter_id} className="text-[10px] font-medium text-on-surface-variant/50 font-body whitespace-nowrap">
                          {vote.student.name.split(" ")[0]}
                          <span className="text-on-surface-variant/30 ml-1">{abbrevPos(vote.student.position)}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Did Not Vote — slim inline bar (always shown; MPs only, admins/journalists excluded) */}
          {(
            <div className="shrink-0 flex items-center gap-4 px-2 opacity-40">
              <span className="font-display text-sm font-bold text-on-surface-variant uppercase tracking-wide whitespace-nowrap">Did Not Vote</span>
              <div className="relative flex-1 h-4 bg-surface-container rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${totalDelegates > 0 ? (dnvCount / totalDelegates) * 100 : 0}%` }}
                  transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute top-0 left-0 h-full bg-outline-variant/50 rounded-full"
                />
              </div>
              <span className="font-display text-sm font-extrabold text-on-surface-variant whitespace-nowrap">
                {totalDelegates > 0 ? ((dnvCount / totalDelegates) * 100).toFixed(0) : 0}% · {dnvCount}
              </span>
            </div>
          )}
        </div>

      </div>

    </div>
  );
};
