import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { extractTextFromFile, buildSummary, requestAiSummary } from '@/lib/documentSummary';
import { FileText, Download, Sparkles, WandSparkles, ListPlus, X, Play, SkipForward, Gavel } from 'lucide-react';

interface StudentDocument {
  id: string;
  user_id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
  is_selected: boolean;
  discussion_order: number | null;
  is_discussing: boolean;
  is_shared?: boolean;
}

interface ProfileLite {
  user_id: string;
  name: string;
  party_name?: string | null;
  committee?: string | null;
}

const formatFileSize = (bytes: number | null) => {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const fileExt = (name: string) => {
  const match = name.toLowerCase().match(/\.(pdf|docx)$/);
  return match ? match[1].toUpperCase() : 'FILE';
};

const StatCard = ({ value, label, icon }: { value: string | number; label: string; icon: string }) => (
  <div className="bg-white p-6 rounded-3xl border border-outline-variant/10 shadow-sm">
    <div className="w-11 h-11 bg-primary/8 text-primary rounded-xl flex items-center justify-center mb-4">
      <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
    </div>
    <p className="text-[10px] text-on-surface-variant/50 font-black uppercase tracking-[0.2em] mb-1 font-headline">{label}</p>
    <h3 className="text-2xl font-extrabold font-headline tracking-tight text-primary">{value}</h3>
  </div>
);

export const StudentDocumentsTable = ({ showShareToggle = false }: { showShareToggle?: boolean }) => {
  const { profile } = useAuth();
  const eventId = (profile as any)?.event_id ?? null;
  const [documents, setDocuments] = useState<StudentDocument[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});
  const [loading, setLoading] = useState(true);
  const [summarizingId, setSummarizingId] = useState<string | null>(null);
  const [summaryDialog, setSummaryDialog] = useState<{ open: boolean; fileName: string; summary: string; wordCount: number; fullText: string; aiSummary: string | null; aiLoading: boolean } | null>(null);

  const fetchDocuments = async () => {
    try {
      let query = supabase
        .from('student_documents' as any)
        .select('*')
        .order('created_at', { ascending: false });
      if (eventId) query = query.eq('event_id', eventId);

      const { data, error } = await query;
      if (error) throw error;
      const docs = (data as any as StudentDocument[]) || [];
      setDocuments(docs);

      const userIds = [...new Set(docs.map(d => d.user_id))];
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, name, party_name, committee')
          .in('user_id', userIds);
        const map: Record<string, ProfileLite> = {};
        (profilesData || []).forEach((p: any) => { map[p.user_id] = p; });
        setProfiles(map);
      }
    } catch (error) {
      console.error('Error fetching student documents:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();

    const channel = supabase
      .channel('student_documents_organizer')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'student_documents' }, () => fetchDocuments())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId]);

  const stats = useMemo(() => ({
    total: documents.length,
    students: new Set(documents.map(d => d.user_id)).size,
    pdfCount: documents.filter(d => fileExt(d.file_name) === 'PDF').length,
    docxCount: documents.filter(d => fileExt(d.file_name) === 'DOCX').length,
  }), [documents]);

  // Bills selected for discussion, ordered by their queue position
  const selectedDocs = useMemo(
    () => documents
      .filter(d => d.is_selected)
      .sort((a, b) => (a.discussion_order ?? 0) - (b.discussion_order ?? 0)),
    [documents]
  );
  const currentDocIndex = selectedDocs.findIndex(d => d.is_discussing);

  const handleToggleQueue = async (doc: StudentDocument) => {
    try {
      if (doc.is_selected) {
        const { error } = await supabase
          .from('student_documents' as any)
          .update({ is_selected: false, is_discussing: false, discussion_order: null })
          .eq('id', doc.id);
        if (error) throw error;
      } else {
        const maxOrder = documents.reduce((max, d) => Math.max(max, d.discussion_order ?? 0), 0);
        const { error } = await supabase
          .from('student_documents' as any)
          .update({ is_selected: true, discussion_order: maxOrder + 1 })
          .eq('id', doc.id);
        if (error) throw error;
      }
    } catch (err: any) {
      toast.error(err.message || 'Could not update discussion queue');
    }
  };

  const handleAdvance = async () => {
    try {
      if (currentDocIndex !== -1) {
        const { error } = await supabase
          .from('student_documents' as any)
          .update({ is_discussing: false })
          .eq('id', selectedDocs[currentDocIndex].id);
        if (error) throw error;
      }
      const next = selectedDocs[currentDocIndex + 1];
      if (next) {
        const { error } = await supabase
          .from('student_documents' as any)
          .update({ is_discussing: true })
          .eq('id', next.id);
        if (error) throw error;
      }
    } catch (err: any) {
      toast.error(err.message || 'Could not advance discussion queue');
    }
  };

  const handleSummarize = async (doc: StudentDocument) => {
    setSummarizingId(doc.id);
    try {
      const res = await fetch(doc.file_url);
      if (!res.ok) throw new Error('Failed to fetch document');
      const blob = await res.blob();
      const file = new File([blob], doc.file_name, { type: doc.file_type || blob.type });

      const text = await extractTextFromFile(file);
      const { summary, wordCount } = buildSummary(text);

      setSummaryDialog({ open: true, fileName: doc.file_name, summary, wordCount, fullText: text, aiSummary: null, aiLoading: false });
    } catch (err: any) {
      toast.error(err.message || 'Could not generate summary');
    } finally {
      setSummarizingId(null);
    }
  };

  const handleAiSummarize = async () => {
    if (!summaryDialog) return;
    if (!navigator.onLine) {
      toast.error('AI summary requires an internet connection.');
      return;
    }
    setSummaryDialog(prev => prev && { ...prev, aiLoading: true });
    try {
      const aiSummary = await requestAiSummary(summaryDialog.fullText);
      setSummaryDialog(prev => prev && { ...prev, aiSummary, aiLoading: false });
    } catch (err: any) {
      toast.error(err.message || 'AI summary failed — please try again.');
      setSummaryDialog(prev => prev && { ...prev, aiLoading: false });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard value={stats.total} label="Total Documents" icon="description" />
        <StatCard value={stats.students} label="Students Submitted" icon="group" />
        <StatCard value={stats.pdfCount} label="PDF Files" icon="picture_as_pdf" />
        <StatCard value={stats.docxCount} label="Word Documents" icon="article" />
      </div>

      {documents.length === 0 ? (
        <div className="bg-white rounded-3xl border border-outline-variant/10 shadow-sm p-12 text-center">
          <FileText className="w-10 h-10 text-on-surface-variant/30 mx-auto mb-4" />
          <p className="font-body text-on-surface-variant font-medium">No documents uploaded by students yet.</p>
        </div>
      ) : (
        <>
        {/* Discussion queue */}
        <div className="bg-white rounded-3xl border border-outline-variant/10 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Gavel className="w-4 h-4 text-primary" />
              <h2 className="text-lg font-extrabold font-headline text-on-surface">Discussion Queue</h2>
            </div>
            <Button
              onClick={handleAdvance}
              disabled={selectedDocs.length === 0}
              className="bg-primary hover:bg-primary/90 text-white font-bold rounded-2xl text-xs"
            >
              {currentDocIndex === -1 ? (
                <><Play className="w-3.5 h-3.5 mr-1.5" /> Start Discussion</>
              ) : currentDocIndex < selectedDocs.length - 1 ? (
                <><SkipForward className="w-3.5 h-3.5 mr-1.5" /> Next Bill</>
              ) : (
                <><X className="w-3.5 h-3.5 mr-1.5" /> Finish Discussion</>
              )}
            </Button>
          </div>

          {selectedDocs.length === 0 ? (
            <p className="font-body text-on-surface-variant text-sm">
              No bills selected yet — use "Add to Queue" on a document below to build the discussion order.
            </p>
          ) : (
            <div className="space-y-2">
              {selectedDocs.map((doc, idx) => {
                const p = profiles[doc.user_id];
                const stateLabel = doc.is_discussing ? 'Discussing' : idx < currentDocIndex ? 'Done' : idx === currentDocIndex + 1 ? 'Up Next' : 'Queued';
                const stateCls = doc.is_discussing
                  ? 'bg-secondary/15 text-secondary'
                  : idx < currentDocIndex
                  ? 'bg-surface-variant text-on-surface-variant'
                  : 'bg-primary/10 text-primary';
                return (
                  <div
                    key={doc.id}
                    className={`flex items-center gap-4 px-4 py-3 rounded-2xl ${doc.is_discussing ? 'bg-secondary/5 border border-secondary/20' : 'bg-surface-container-low'}`}
                  >
                    <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-black text-xs shrink-0">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold font-headline text-on-surface text-sm truncate">{doc.file_name}</p>
                      <p className="text-[10px] text-on-surface-variant/60 font-black uppercase tracking-widest font-headline mt-0.5">
                        Moved by {p?.name || 'Unknown'} {p?.party_name ? `· ${p.party_name}` : p?.committee ? `· ${p.committee}` : ''}
                      </p>
                    </div>
                    <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full font-headline shrink-0 ${stateCls}`}>
                      {stateLabel}
                    </span>
                    <Button variant="ghost" size="icon" className="rounded-xl text-error hover:text-error shrink-0" onClick={() => handleToggleQueue(doc)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white rounded-3xl border border-outline-variant/10 shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Party / Committee</TableHead>
                <TableHead>Document</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((doc) => {
                const p = profiles[doc.user_id];
                return (
                  <TableRow key={doc.id}>
                    <TableCell className="font-bold font-headline text-on-surface">{p?.name || 'Unknown'}</TableCell>
                    <TableCell className="text-on-surface-variant text-sm">{p?.party_name || p?.committee || '—'}</TableCell>
                    <TableCell className="font-medium text-sm">{doc.file_name}</TableCell>
                    <TableCell>
                      <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-primary/10 text-primary font-headline">
                        {fileExt(doc.file_name)}
                      </span>
                    </TableCell>
                    <TableCell className="text-on-surface-variant text-sm">{formatFileSize(doc.file_size)}</TableCell>
                    <TableCell className="text-on-surface-variant text-sm">
                      {new Date(doc.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSummarize(doc)}
                          disabled={summarizingId === doc.id}
                          className="rounded-xl font-bold text-xs"
                        >
                          <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                          {summarizingId === doc.id ? 'Reading…' : 'Summarize'}
                        </Button>
                        <a href={doc.file_url} target="_blank" rel="noopener noreferrer" download={doc.file_name}>
                          <Button variant="ghost" size="icon" className="rounded-xl">
                            <Download className="w-4 h-4" />
                          </Button>
                        </a>
                        <Button
                          variant={doc.is_selected ? 'secondary' : 'outline'}
                          size="sm"
                          onClick={() => handleToggleQueue(doc)}
                          className="rounded-xl font-bold text-xs"
                        >
                          {doc.is_selected ? (
                            <><X className="w-3.5 h-3.5 mr-1.5" /> In Queue</>
                          ) : (
                            <><ListPlus className="w-3.5 h-3.5 mr-1.5" /> Add to Queue</>
                          )}
                        </Button>
                        {showShareToggle && (
                          <Button
                            variant={doc.is_shared ? 'default' : 'outline'}
                            size="sm"
                            onClick={async () => {
                              const { error } = await (supabase.from('student_documents' as any) as any)
                                .update({ is_shared: !doc.is_shared })
                                .eq('id', doc.id);
                              if (error) toast.error('Failed to update sharing');
                              else { toast.success(doc.is_shared ? 'Removed from shared' : 'Shared with all students'); fetchDocuments(); }
                            }}
                            className="rounded-xl font-bold text-xs"
                          >
                            <span className="material-symbols-outlined text-[14px] mr-1" style={{ fontVariationSettings: doc.is_shared ? "'FILL' 1" : "'FILL' 0" }}>share</span>
                            {doc.is_shared ? 'Shared' : 'Share'}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        </>
      )}

      {/* Summary dialog */}
      <Dialog open={!!summaryDialog?.open} onOpenChange={(open) => !open && setSummaryDialog(null)}>
        <DialogContent className="rounded-3xl max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-headline font-extrabold text-on-surface flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              Quick Summary
            </DialogTitle>
            <DialogDescription className="font-body text-on-surface-variant">
              {summaryDialog?.fileName} · auto-extracted preview
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <p className="font-body text-on-surface text-sm leading-relaxed whitespace-pre-wrap">
              {summaryDialog?.summary}
            </p>
            {summaryDialog && (
              <p className="text-[10px] text-on-surface-variant/40 font-black uppercase tracking-widest font-headline">
                {summaryDialog.wordCount.toLocaleString()} words total
              </p>
            )}

            <div className="pt-4 border-t border-outline-variant/10 space-y-3">
              {summaryDialog?.aiSummary ? (
                <>
                  <p className="text-[10px] text-primary font-black uppercase tracking-widest font-headline flex items-center gap-1.5">
                    <WandSparkles className="w-3 h-3" />
                    AI Summary
                  </p>
                  <p className="font-body text-on-surface text-sm leading-relaxed whitespace-pre-wrap">
                    {summaryDialog.aiSummary}
                  </p>
                </>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAiSummarize}
                  disabled={summaryDialog?.aiLoading}
                  className="rounded-xl font-bold text-xs"
                >
                  <WandSparkles className="w-3.5 h-3.5 mr-1.5" />
                  {summaryDialog?.aiLoading ? 'Generating AI summary…' : 'Generate AI Summary'}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
