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
import { extractTextFromFile, buildSummary } from '@/lib/documentSummary';
import { FileText, Download, Sparkles } from 'lucide-react';

interface StudentDocument {
  id: string;
  user_id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
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

export const StudentDocumentsTable = () => {
  const { profile } = useAuth();
  const eventId = (profile as any)?.event_id ?? null;
  const [documents, setDocuments] = useState<StudentDocument[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});
  const [loading, setLoading] = useState(true);
  const [summarizingId, setSummarizingId] = useState<string | null>(null);
  const [summaryDialog, setSummaryDialog] = useState<{ open: boolean; fileName: string; summary: string; wordCount: number } | null>(null);

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

  const handleSummarize = async (doc: StudentDocument) => {
    setSummarizingId(doc.id);
    try {
      const res = await fetch(doc.file_url);
      if (!res.ok) throw new Error('Failed to fetch document');
      const blob = await res.blob();
      const file = new File([blob], doc.file_name, { type: doc.file_type || blob.type });

      const text = await extractTextFromFile(file);
      const { summary, wordCount } = buildSummary(text);

      setSummaryDialog({ open: true, fileName: doc.file_name, summary, wordCount });
    } catch (err: any) {
      toast.error(err.message || 'Could not generate summary');
    } finally {
      setSummarizingId(null);
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
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
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
          <p className="font-body text-on-surface text-sm leading-relaxed max-h-[50vh] overflow-y-auto whitespace-pre-wrap">
            {summaryDialog?.summary}
          </p>
          {summaryDialog && (
            <p className="text-[10px] text-on-surface-variant/40 font-black uppercase tracking-widest font-headline">
              {summaryDialog.wordCount.toLocaleString()} words total
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
