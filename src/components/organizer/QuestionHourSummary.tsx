import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDistanceToNow } from 'date-fns';

interface QuestionRow {
  id: string;
  ministry: string;
  content: string;
  answer: string | null;
  votes_count: number;
  status: 'pending' | 'addressed' | 'rejected';
  is_discussing: boolean;
  created_at: string;
  author: string;
  party: string;
}

interface MinistryStat {
  ministry: string;
  total: number;
  pending: number;
  completed: number;
  live: number;
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-surface-variant text-on-surface-variant',
  addressed: 'bg-tertiary-fixed text-on-tertiary-fixed',
  rejected: 'bg-error-container text-error',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'PENDING',
  addressed: 'COMPLETED',
  rejected: 'REJECTED',
};

const StatCard = ({ value, label, icon }: { value: number; label: string; icon: string }) => (
  <div className="bg-white p-6 rounded-3xl border border-outline-variant/10 shadow-sm">
    <div className="w-11 h-11 bg-primary/8 text-primary rounded-xl flex items-center justify-center mb-4">
      <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
    </div>
    <p className="text-[10px] text-on-surface-variant/50 font-black uppercase tracking-[0.2em] mb-1 font-headline">{label}</p>
    <h3 className="text-2xl font-extrabold font-headline tracking-tight text-primary">{value.toLocaleString()}</h3>
  </div>
);

export const QuestionHourSummary = () => {
  const { profile } = useAuth();
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null);

  const fetchData = async () => {
    try {
      const { data, error } = await supabase
        .from('questions' as any)
        .select('id, ministry, content, answer, status, is_discussing, created_at, profiles (name, party_name, party_alignment)')
        .eq('event_id', profile?.event_id ?? '')
        .order('created_at', { ascending: false });
      if (error) throw error;

      const { data: votes } = await supabase.from('question_votes' as any).select('question_id');
      const voteMap: Record<string, number> = {};
      ((votes as any[]) || []).forEach((v: any) => { voteMap[v.question_id] = (voteMap[v.question_id] || 0) + 1; });

      setQuestions(((data as any[]) || []).map((q: any) => {
        const profileData = Array.isArray(q.profiles) ? q.profiles[0] : q.profiles;
        return {
          id: q.id,
          ministry: q.ministry,
          content: q.content,
          answer: q.answer ?? null,
          votes_count: voteMap[q.id] || 0,
          status: q.status,
          is_discussing: q.is_discussing,
          created_at: q.created_at,
          author: profileData?.name || 'Unknown Delegate',
          party: profileData?.party_name || profileData?.party_alignment || '',
        };
      }));
    } catch {
      toast.error('Failed to load Question Hour summary');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const channel = supabase.channel('public:questions-summary')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'questions' }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const ministryStats: MinistryStat[] = useMemo(() => {
    const map = new Map<string, MinistryStat>();
    questions.forEach(q => {
      const entry = map.get(q.ministry) || { ministry: q.ministry, total: 0, pending: 0, completed: 0, live: 0 };
      entry.total += 1;
      if (q.status === 'addressed') entry.completed += 1;
      else if (q.status === 'pending') entry.pending += 1;
      if (q.is_discussing) entry.live += 1;
      map.set(q.ministry, entry);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [questions]);

  const totals = useMemo(() => ({
    total: questions.length,
    pending: questions.filter(q => q.status === 'pending').length,
    completed: questions.filter(q => q.status === 'addressed').length,
    live: questions.filter(q => q.is_discussing).length,
  }), [questions]);

  const handleExportExcel = () => {
    setExporting('excel');
    try {
      const summarySheet = XLSX.utils.json_to_sheet(ministryStats.map(m => ({
        Ministry: m.ministry,
        'Total Questions': m.total,
        Pending: m.pending,
        Completed: m.completed,
        'Currently Live': m.live,
      })));
      const questionsSheet = XLSX.utils.json_to_sheet(questions.map(q => ({
        Ministry: q.ministry,
        Author: q.author,
        Party: q.party,
        Question: q.content,
        Answer: q.answer || '',
        Status: STATUS_LABELS[q.status] || q.status,
        Support: q.votes_count,
        Live: q.is_discussing ? 'Yes' : 'No',
        Submitted: new Date(q.created_at).toLocaleString(),
      })));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, summarySheet, 'Ministry Summary');
      XLSX.utils.book_append_sheet(wb, questionsSheet, 'All Questions');
      XLSX.writeFile(wb, `question-hour-summary-${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Excel report downloaded');
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(null);
    }
  };

  const handleExportPDF = () => {
    setExporting('pdf');
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      pdf.setFillColor(19, 41, 143);
      pdf.rect(0, 0, 210, 20, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      pdf.setTextColor(255, 255, 255);
      pdf.text('NATIONAL YOUTH PARLIAMENT', 14, 8);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7.5);
      pdf.text('QUESTION HOUR — SUMMARY REPORT', 14, 14);
      pdf.setFontSize(7);
      pdf.text(new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).toUpperCase(), 196, 11, { align: 'right' });

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(16);
      pdf.setTextColor(19, 41, 143);
      pdf.text('Question Hour Summary', 14, 32);

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(69, 70, 83);
      pdf.text(`Total: ${totals.total}   Pending: ${totals.pending}   Completed: ${totals.completed}   Live: ${totals.live}`, 14, 39);

      autoTable(pdf, {
        head: [['Ministry', 'Total', 'Pending', 'Completed', 'Live']],
        body: ministryStats.map(m => [m.ministry.replace('Ministry of ', ''), String(m.total), String(m.pending), String(m.completed), String(m.live)]),
        startY: 45,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [19, 41, 143] },
        theme: 'striped',
        margin: { left: 14, right: 14 },
      });

      const afterSummaryY = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.setTextColor(19, 41, 143);
      pdf.text('All Questions', 14, afterSummaryY);

      autoTable(pdf, {
        head: [['Ministry', 'Author', 'Party', 'Question', 'Answer', 'Status', 'Support']],
        body: questions.map(q => [
          q.ministry.replace('Ministry of ', ''),
          q.author,
          q.party,
          q.content,
          q.answer || '—',
          STATUS_LABELS[q.status] || q.status,
          String(q.votes_count),
        ]),
        startY: afterSummaryY + 4,
        styles: { fontSize: 6.5, cellPadding: 2 },
        headStyles: { fillColor: [19, 41, 143] },
        theme: 'striped',
        margin: { left: 14, right: 14 },
        columnStyles: {
          0: { cellWidth: 22 }, 1: { cellWidth: 20 }, 2: { cellWidth: 18 },
          3: { cellWidth: 54 }, 4: { cellWidth: 54 }, 5: { cellWidth: 16 }, 6: { cellWidth: 8 },
        },
      });

      pdf.save(`question-hour-summary-${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success('PDF report downloaded');
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(null);
    }
  };

  if (loading) {
    return (
      <div className="py-20 flex justify-center">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">

      {/* ── Top stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard value={totals.total} label="Questions Posted" icon="forum" />
        <StatCard value={totals.pending} label="Pending Response" icon="hourglass_empty" />
        <StatCard value={totals.completed} label="Completed" icon="task_alt" />
        <StatCard value={totals.live} label="Currently Live" icon="campaign" />
      </div>

      {/* ── Export actions ── */}
      <div className="flex items-center justify-end gap-3">
        <button
          onClick={handleExportExcel}
          disabled={exporting !== null || questions.length === 0}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-surface-container-low hover:bg-surface-container-high text-on-surface text-[11px] font-black uppercase tracking-widest font-headline transition-colors disabled:opacity-40"
        >
          <span className="material-symbols-outlined text-[16px]">grid_on</span>
          {exporting === 'excel' ? 'Exporting…' : 'Export Excel'}
        </button>
        <button
          onClick={handleExportPDF}
          disabled={exporting !== null || questions.length === 0}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-primary text-white hover:bg-primary-container text-[11px] font-black uppercase tracking-widest font-headline transition-colors disabled:opacity-40"
        >
          <span className="material-symbols-outlined text-[16px]">picture_as_pdf</span>
          {exporting === 'pdf' ? 'Exporting…' : 'Export PDF'}
        </button>
      </div>

      {/* ── Per-ministry breakdown ── */}
      <div className="bg-white rounded-3xl border border-outline-variant/10 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-outline-variant/10">
          <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-primary font-headline">Portfolio Breakdown</h3>
        </div>
        {ministryStats.length === 0 ? (
          <p className="px-6 py-8 text-center text-xs text-on-surface-variant/40 font-body">No questions have been submitted yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[9px] font-black uppercase tracking-widest text-on-surface-variant/40 font-headline">
                  <th className="px-6 py-3">Ministry</th>
                  <th className="px-4 py-3 text-center">Total</th>
                  <th className="px-4 py-3 text-center">Pending</th>
                  <th className="px-4 py-3 text-center">Completed</th>
                  <th className="px-4 py-3 text-center">Live</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {ministryStats.map(m => (
                  <tr key={m.ministry} className="hover:bg-surface-container-lowest transition-colors">
                    <td className="px-6 py-3 font-bold text-on-surface font-body">{m.ministry.replace('Ministry of ', '')}</td>
                    <td className="px-4 py-3 text-center font-headline font-black text-primary">{m.total}</td>
                    <td className="px-4 py-3 text-center text-on-surface-variant/60">{m.pending}</td>
                    <td className="px-4 py-3 text-center text-on-surface-variant/60">{m.completed}</td>
                    <td className="px-4 py-3 text-center">
                      {m.live > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-error/10 text-error">
                          <span className="w-1.5 h-1.5 bg-error rounded-full animate-pulse-live" />
                          {m.live}
                        </span>
                      ) : (
                        <span className="text-on-surface-variant/30">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Full question list ── */}
      <div className="bg-white rounded-3xl border border-outline-variant/10 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-outline-variant/10">
          <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-primary font-headline">All Questions</h3>
        </div>
        {questions.length === 0 ? (
          <p className="px-6 py-8 text-center text-xs text-on-surface-variant/40 font-body">No questions have been submitted yet.</p>
        ) : (
          <div className="divide-y divide-outline-variant/10">
            {questions.map(q => (
              <div key={q.id} className="px-6 py-4 flex flex-col gap-1.5">
                <div className="flex items-center gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                      <span className="text-[9px] font-black uppercase tracking-widest text-primary/70 font-headline shrink-0">
                        {q.ministry.replace('Ministry of ', '')}
                      </span>
                      <span className="text-[10px] text-on-surface-variant/40 font-body shrink-0">· {q.author}</span>
                      {q.party && <span className="text-[9px] font-bold text-on-surface-variant/40 font-body shrink-0">({q.party})</span>}
                      {q.votes_count > 0 && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-black text-primary/60 font-headline shrink-0">
                          <span className="material-symbols-outlined text-[11px]">thumb_up</span>
                          {q.votes_count}
                        </span>
                      )}
                      {q.is_discussing && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-error/10 text-error shrink-0">
                          <span className="w-1.5 h-1.5 bg-error rounded-full animate-pulse-live" />
                          Live
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-bold text-on-surface font-body" title={q.content}>{q.content}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`px-3 py-1 rounded-full text-[9px] font-black tracking-wider font-headline ${STATUS_STYLES[q.status] || STATUS_STYLES.pending}`}>
                      {STATUS_LABELS[q.status] || 'PENDING'}
                    </span>
                    <span className="text-[9px] font-black text-on-surface-variant/30 uppercase tracking-widest font-headline hidden sm:inline">
                      {formatDistanceToNow(new Date(q.created_at), { addSuffix: true })}
                    </span>
                  </div>
                </div>
                {q.answer && (
                  <div className="ml-2 pl-3 border-l-2 border-tertiary/40">
                    <p className="text-[9px] font-black uppercase tracking-widest text-tertiary font-headline mb-0.5">Official Response</p>
                    <p className="text-xs text-on-surface-variant italic font-body">{q.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default QuestionHourSummary;
