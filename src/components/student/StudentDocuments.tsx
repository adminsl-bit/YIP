import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { extractTextFromFile, buildSummary } from '@/lib/documentSummary';
import { FileText, Upload, Download, Trash2, Sparkles, FolderOpen } from 'lucide-react';

const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ['.pdf', '.docx'];

interface StudentDocument {
  id: string;
  user_id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
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

export const StudentDocuments = () => {
  const { user, profile } = useAuth();
  const [documents, setDocuments] = useState<StudentDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [summarizingId, setSummarizingId] = useState<string | null>(null);
  const [summaryDialog, setSummaryDialog] = useState<{ open: boolean; fileName: string; summary: string; wordCount: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocuments = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('student_documents' as any)
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setDocuments((data as any) || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
    if (!user) return;

    const channel = supabase
      .channel(`student_documents:${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'student_documents', filter: `user_id=eq.${user.id}` }, () => fetchDocuments())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !user) return;

    const lowerName = file.name.toLowerCase();
    if (!ALLOWED_EXTENSIONS.some(ext => lowerName.endsWith(ext))) {
      toast.error('Only PDF and DOCX files are supported');
      return;
    }
    if (file.size > MAX_DOCUMENT_BYTES) {
      toast.error('File too large — max 10MB');
      return;
    }

    setUploading(true);
    try {
      const path = `${user.id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('student-documents')
        .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('student-documents').getPublicUrl(path);

      const { error: insertError } = await supabase
        .from('student_documents' as any)
        .insert({
          user_id: user.id,
          event_id: (profile as any)?.event_id ?? null,
          file_name: file.name,
          file_url: data.publicUrl,
          file_type: file.type,
          file_size: file.size,
        });
      if (insertError) throw insertError;

      toast.success('Document uploaded');
      fetchDocuments();
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (doc: StudentDocument) => {
    try {
      const path = doc.file_url.split('/student-documents/')[1];
      if (path) {
        await supabase.storage.from('student-documents').remove([path]);
      }
      const { error } = await supabase.from('student_documents' as any).delete().eq('id', doc.id);
      if (error) throw error;
      setDocuments(prev => prev.filter(d => d.id !== doc.id));
      toast.success('Document deleted');
    } catch (err: any) {
      toast.error(err.message || 'Delete failed');
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

      setSummaryDialog({ open: true, fileName: doc.file_name, summary, wordCount });
    } catch (err: any) {
      toast.error(err.message || 'Could not generate summary');
    } finally {
      setSummarizingId(null);
    }
  };

  return (
    <div>
      <header className="mb-10">
        <h1 className="text-4xl font-extrabold font-headline tracking-tight text-primary">
          My <span className="text-secondary">Documents</span>
        </h1>
        <p className="text-[10px] text-on-surface-variant/40 font-black uppercase tracking-[0.4em] mt-3 flex items-center gap-2 font-headline">
          <FolderOpen className="w-3 h-3" />
          Bills & Reference Material
        </p>
      </header>

      {/* Upload card */}
      <div className="bg-white rounded-3xl border border-outline-variant/10 shadow-sm p-8 mb-6 flex flex-col sm:flex-row items-center justify-between gap-5">
        <div>
          <h2 className="text-lg font-extrabold font-headline text-on-surface">Upload a document</h2>
          <p className="font-body text-on-surface-variant text-sm mt-1">PDF or DOCX, up to 10MB. Use Summarize for a quick preview of the contents.</p>
        </div>
        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="bg-primary hover:bg-primary/90 text-white font-bold px-6 py-5 rounded-2xl shrink-0"
        >
          <Upload className="w-4 h-4 mr-2" />
          {uploading ? 'Uploading…' : 'Upload Document'}
        </Button>
        <input ref={fileInputRef} type="file" accept=".pdf,.docx" onChange={handleFileChange} className="hidden" />
      </div>

      {/* Document list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : documents.length === 0 ? (
        <div className="bg-white rounded-3xl border border-outline-variant/10 shadow-sm p-12 text-center">
          <FileText className="w-10 h-10 text-on-surface-variant/30 mx-auto mb-4" />
          <p className="font-body text-on-surface-variant font-medium">No documents uploaded yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {documents.map((doc) => (
            <div key={doc.id} className="bg-white rounded-3xl border border-outline-variant/10 shadow-sm p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0 font-headline font-black text-[10px]">
                {fileExt(doc.file_name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold font-headline text-on-surface text-sm truncate">{doc.file_name}</p>
                <p className="text-[10px] text-on-surface-variant/40 font-black uppercase tracking-widest font-headline mt-1">
                  {formatFileSize(doc.file_size)} · {new Date(doc.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
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
                <Button variant="ghost" size="icon" className="rounded-xl text-error hover:text-error" onClick={() => handleDelete(doc)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
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
