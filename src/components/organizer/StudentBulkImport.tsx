import React, { useState, useSyncExternalStore, useEffect } from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import * as XLSX from 'xlsx';
import { getBulkImportState, setBulkImportState, subscribeBulkImportState, validateEventId, type ImportCredential } from '@/lib/bulkImportStore';

interface StudentData {
  // Full import
  name?: string;
  school?: string;
  email?: string;
  phone?: string;
  // Scores-only import
  serialNumber?: number;
  preeventScores?: number;
}

export const StudentBulkImport = () => {
  const { profile, user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
  const [isEmailing, setIsEmailing] = useState(false);

  // Import progress/results live in a module-level store so they survive
  // switching tabs away from this component and back.
  const { isUploading, progress, results, importMode, fileName } = useSyncExternalStore(subscribeBulkImportState, getBulkImportState);

  // Clear stale results from a different event on mount / event change.
  useEffect(() => {
    if (profile?.event_id) validateEventId(profile.event_id);
  }, [profile?.event_id]);
  const setImportMode = (mode: 'full' | 'scores-only') => setBulkImportState({ importMode: mode });

  // Known column keywords — at least one must appear in the header row so we
  // don't mistake a two-column title row (e.g. "Event Name | City") for headers.
  const HEADER_KEYWORDS = ['name', 'student', 'email', 'school', 'phone', 'mobile',
    'contact', 'serial', 'sno', 's no', 'participant', 'delegate', 'sl'];

  const parseExcelFile = (
    file: File,
    mode: 'full' | 'scores-only' = 'full',
  ): Promise<{ students: StudentData[]; parseErrors: string[] }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];

          // Read all rows as raw arrays so we can locate the header row ourselves,
          // handling blank rows or title rows that appear above the actual headers.
          // Column order in the sheet is irrelevant — we match by header name.
          const rawRows = XLSX.utils.sheet_to_json<(string | number | null)[]>(
            worksheet, { header: 1, defval: null }
          );

          // Normalize: trim, lowercase, collapse whitespace / underscores / dashes.
          const norm = (v: unknown) =>
            (v ?? '').toString().trim().toLowerCase().replace(/[\s_\-./]+/g, ' ');

          // Header row = first row that has ≥2 non-empty cells AND at least one cell
          // matching a known column keyword. This prevents event-title rows like
          // "YIP Mizoram 2024 | Registration Sheet" from being picked as the header.
          const headerRowIdx = rawRows.findIndex(row => {
            const nonEmpty = row.filter(c => c !== null && c !== '');
            if (nonEmpty.length < 2) return false;
            return nonEmpty.some(c =>
              HEADER_KEYWORDS.some(kw => norm(c).includes(kw))
            );
          });
          if (headerRowIdx === -1) throw new Error(
            'Could not find a header row. Make sure the sheet has column headers like "Name", "School", "Email", "Phone".'
          );

          const headers = rawRows[headerRowIdx].map(norm);

          // Data rows: everything after the header minus completely blank rows.
          const dataRows = rawRows
            .slice(headerRowIdx + 1)
            .filter(row => row.some(c => c !== null && c !== ''));

          if (dataRows.length === 0) throw new Error('No data rows found after the header.');

          // Fuzzy column finder: exact match → starts-with/prefix → substring (first win).
          const findCol = (...aliases: string[]): number => {
            const targets = aliases.map(norm);
            for (const t of targets) { const i = headers.indexOf(t); if (i !== -1) return i; }
            for (const t of targets) {
              const i = headers.findIndex(h => h.startsWith(t) || t.startsWith(h));
              if (i !== -1) return i;
            }
            for (const t of targets) {
              const i = headers.findIndex(h => h.includes(t) || t.includes(h));
              if (i !== -1) return i;
            }
            return -1;
          };

          const cell = (row: (string | number | null)[], col: number) =>
            col === -1 ? '' : (row[col] ?? '').toString().trim();

          if (mode === 'scores-only') {
            const serialCol = findCol('serial no', 'serial number', 's no', 'sno', 'serial', 'sl no', 'sl');
            const scoreCol  = findCol('preevent scores', 'pre event scores', 'preevent score', 'score');
            const students: StudentData[] = [];
            const parseErrors: string[] = [];
            dataRows.forEach((row, i) => {
              const serialVal = cell(row, serialCol);
              if (!serialVal || isNaN(Number(serialVal))) {
                parseErrors.push(`Row ${headerRowIdx + i + 2}: skipped — no valid Serial No`);
                return;
              }
              students.push({
                serialNumber: parseInt(serialVal) || (i + 1),
                preeventScores: scoreCol !== -1 ? parseFloat(cell(row, scoreCol)) || undefined : undefined,
              });
            });
            return resolve({ students, parseErrors });
          }

          // Full import — only Name is required. School, Email, Phone are optional.
          // Broad alias list covers common regional sheet formats.
          const nameCol   = findCol(
            'name', 'student name', 'full name', 'name of student',
            'participant name', 'name of participant', 'delegate name',
            'students name', 'delegate', 'participant',
          );
          const emailCol  = findCol('email', 'email address', 'email id', 'e mail', 'mail', 'email id');
          const schoolCol = findCol(
            'school', 'school name', 'institution', 'college',
            'organization', 'institution name', 'college name', 'school institution',
          );
          const phoneCol  = findCol(
            'phone', 'phone number', 'mobile', 'mobile number',
            'contact', 'contact number', 'cell', 'phone no', 'mob no',
          );

          if (nameCol === -1) throw new Error(
            `Could not find a "Name" column. Headers found: ${headers.filter(Boolean).join(', ')}. ` +
            'Rename the name column to "Name" or "Student Name" and try again.'
          );

          // Skip rows with a blank name — don't throw. This allows rows like
          // sub-totals, section headers, or trailing blank rows to be ignored
          // gracefully rather than aborting the entire import.
          const students: StudentData[] = [];
          const parseErrors: string[] = [];

          dataRows.forEach((row, i) => {
            const name = cell(row, nameCol);
            if (!name) {
              parseErrors.push(`Row ${headerRowIdx + i + 2}: skipped — Name is blank`);
              return;
            }
            const email = cell(row, emailCol).toLowerCase();
            students.push({
              name,
              school: cell(row, schoolCol) || undefined,
              email: email || undefined,
              phone: cell(row, phoneCol) || undefined,
            });
          });

          if (students.length === 0) throw new Error(
            parseErrors.length > 0
              ? `No valid student rows found. First issue: ${parseErrors[0]}`
              : 'No student data found in the file.'
          );

          resolve({ students, parseErrors });
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  };

  // Imported in small batches so the UI can show real progress and each
  // request stays well under the edge function's execution time limit.
  const IMPORT_BATCH_SIZE = 20;

  const importStudents = async (students: StudentData[]) => {
    const aggregate = { success: 0, failed: 0, errors: [] as string[], credentials: [] as ImportCredential[] };

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      aggregate.errors.push('Import failed: No active session');
      aggregate.failed = students.length;
      return aggregate;
    }

    const total = students.length;
    setBulkImportState({ progress: total > 0 ? 1 : 100 });

    for (let i = 0; i < total; i += IMPORT_BATCH_SIZE) {
      const batch = students.slice(i, i + IMPORT_BATCH_SIZE);
      // Guard against a hung edge function invocation freezing the UI
      // indefinitely — give up on this batch after 60s and move on.
      const timeoutController = new AbortController();
      const timeoutId = setTimeout(() => timeoutController.abort(), 60_000);
      try {
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bulk-import-students`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            students: batch,
            mode: importMode,
            event_id: profile?.event_id ?? null,
            is_last_batch: i + batch.length >= total,
          }),
          signal: timeoutController.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const batchResult = await response.json();
        aggregate.success += batchResult.success ?? 0;
        aggregate.failed += batchResult.failed ?? 0;
        aggregate.errors.push(...(batchResult.errors ?? []));
        aggregate.credentials.push(...(batchResult.credentials ?? []));
      } catch (error) {
        const message = error instanceof Error && error.name === 'AbortError'
          ? 'Request timed out after 60s'
          : error instanceof Error ? error.message : 'Unknown error';
        aggregate.errors.push(`Rows ${i + 1}-${i + batch.length}: ${message}`);
        aggregate.failed += batch.length;
      } finally {
        clearTimeout(timeoutId);
      }

      setBulkImportState({
        progress: Math.round((Math.min(i + batch.length, total) / total) * 100),
        results: { ...aggregate },
      });
    }

    return aggregate;
  };

  const handleFileUpload = async () => {
    if (!file) {
      toast.error("Please select a file first");
      return;
    }

    if (!profile?.event_id) {
      toast.error('Your account is not assigned to an event. Contact your administrator before importing.');
      return;
    }

    setBulkImportState({ isUploading: true, progress: 0, results: null, fileName: file.name });

    try {
      const { students, parseErrors } = await parseExcelFile(file, importMode);
      const importResults = await importStudents(students);
      // Rows skipped during parsing (blank name, bad serial) count as failures
      // so the organizer can see the full picture in the error report.
      if (parseErrors.length > 0) {
        importResults.failed += parseErrors.length;
        importResults.errors.push(...parseErrors);
      }
      setBulkImportState({ results: importResults, _eventId: profile?.event_id ?? null });

      if (importResults.success > 0) {
        toast.success(`Successfully imported ${importResults.success} students`);
      }
      if (importResults.failed > 0) {
        toast.error(`Failed to import ${importResults.failed} students — see the error report below`);
      }

      // A full import means rosters are now managed by the organizer —
      // close public self-registration so students can't create duplicate
      // accounts alongside the imported ones.
      if (importMode === 'full' && importResults.success > 0) {
        // Upsert (not update) — the registration_enabled row may not exist
        // yet, in which case a plain .update() silently matches zero rows.
        const { error: settingError } = await supabase
          .from('system_settings')
          .upsert({ setting_key: 'registration_enabled', setting_value: false, updated_by: user?.id }, { onConflict: 'setting_key' });

        if (!settingError) {
          toast.info('Public registration has been turned off since students were bulk-imported.');
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to process file');
    } finally {
      setBulkImportState({ isUploading: false, progress: 0 });
    }
  };

  const handleDeleteAllStudents = async () => {
    setIsDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('No active session');
        return;
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-all-students`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (result.success) {
        toast.success(result.message);
        setBulkImportState({ results: null, fileName: null }); // Clear any previous import results
      } else {
        toast.error(result.error || 'Failed to delete students');
      }
    } catch (error) {
      console.error('Error deleting students:', error);
      toast.error('Failed to delete students');
    } finally {
      setIsDeleting(false);
    }
  };

  const downloadTemplate = async () => {
    setIsDownloadingTemplate(true);
    try {
      if (importMode === 'scores-only') {
        const { data, error } = await supabase
          .from('profiles')
          .select('serial_number, name, position, party_number, party_name, constituency, state, city')
          .eq('user_type', 'student')
          .eq('event_id', profile?.event_id ?? '')
          .order('serial_number');
        if (error) throw error;
        if (!data || data.length === 0) {
          toast.error('No students found — run a Full Import first');
          return;
        }
        const rows = data.map(s => ({
          'Serial no': s.serial_number,
          'Name': s.name,
          'seat role': s.position || '',
          'Party': s.party_number || '',
          'Party Name': s.party_name || '',
          'constituency': s.constituency || '',
          'state': s.state || '',
          'home city': s.city || '',
          'Preevent scores': '',
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Students');
        XLSX.writeFile(wb, 'preevent_scores_template.xlsx');
        toast.success(`Downloaded ${rows.length} students — fill in "Preevent scores" and re-upload`);
      } else {
        const template = [
          { 'Name': 'John Doe', 'School': 'Delhi Public School', 'Email': 'john.doe@example.com', 'Phone': '9876543210' },
          { 'Name': 'Jane Smith', 'School': "St. Xavier's School", 'Email': 'jane.smith@example.com', 'Phone': '9876543211' },
          { 'Name': 'Asha Rao', 'School': 'Bishop Cotton School', 'Email': 'asha.rao@example.com', 'Phone': '9876543212' },
        ];
        const ws = XLSX.utils.json_to_sheet(template);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Students');
        XLSX.writeFile(wb, 'student_import_template.xlsx');
        toast.success('Template downloaded — replace sample rows with your delegate data');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to download template');
    } finally {
      setIsDownloadingTemplate(false);
    }
  };

  const handleBulkEmail = async () => {
    if (!results?.credentials || results.credentials.length === 0) return;

    // Only email students who have a real email address
    const emailable = results.credentials.filter(c => !!c.email);
    if (emailable.length === 0) {
      toast.error('No students have email addresses — download the credentials sheet to share login codes manually.');
      return;
    }

    setIsEmailing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('No active session');
        return;
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-login-emails`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          credentials: emailable.map(c => ({ name: c.name, email: c.email, password: c.password })),
          site_url: window.location.origin,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || 'Failed to send login emails');
        return;
      }

      if (result.sent > 0) {
        toast.success(`Sent login details to ${result.sent} student${result.sent === 1 ? '' : 's'}`);
      }
      if (result.failed > 0) {
        toast.error(`Failed to email ${result.failed} student${result.failed === 1 ? '' : 's'}`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send login emails');
    } finally {
      setIsEmailing(false);
    }
  };

  const downloadCredentials = () => {
    if (!results?.credentials || results.credentials.length === 0) return;

    const rows = results.credentials.map(c => ({
      'Serial No': c.serialNumber,
      'Name': c.name,
      'School': c.school,
      'Email (Login)': c.email || '—',
      'Login Code': c.password,
      'Phone': c.phone || '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Credentials');
    XLSX.writeFile(wb, 'student_login_credentials.xlsx');
    toast.success(`Downloaded login credentials for ${rows.length} students`);
  };

  const downloadErrorReport = () => {
    if (!results?.errors || results.errors.length === 0) return;

    const rows = results.errors.map((err, i) => ({ '#': i + 1, 'Error': err }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Import Errors');
    XLSX.writeFile(wb, 'student_import_errors.xlsx');
    toast.success(`Downloaded ${rows.length} error${rows.length === 1 ? '' : 's'}`);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-700">

      {/* Main import card */}
      <section className="bg-surface-container-low rounded-[2rem] p-8 space-y-8">

        {/* Mode selector */}
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-on-surface-variant/50 font-headline mb-3">Import Mode</p>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setImportMode('full')}
              className={`flex items-center gap-2 py-2.5 px-5 rounded-full text-sm font-bold transition-all active:scale-95 font-body ${importMode === 'full' ? 'bg-primary text-white shadow-[0_4px_12px_rgba(19,41,143,0.25)]' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}`}
            >
              <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>database</span>
              Full Import
            </button>
            <button
              onClick={() => setImportMode('scores-only')}
              className={`flex items-center gap-2 py-2.5 px-5 rounded-full text-sm font-bold transition-all active:scale-95 font-body ${importMode === 'scores-only' ? 'bg-primary text-white shadow-[0_4px_12px_rgba(19,41,143,0.25)]' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}`}
            >
              <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>score</span>
              Pre-Event Scores Only
            </button>
          </div>
        </div>

        {/* Column reference card */}
        <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-[0_32px_32px_-12px_rgba(19,41,143,0.06)]">
          <div className="flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-primary text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>info</span>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant font-headline">
              {importMode === 'full' ? 'Full Import — Column Reference' : 'Scores Only — Column Reference'}
            </p>
          </div>
          {importMode === 'full' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm font-body">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-error mb-2 font-headline">Required</p>
                {['Name'].map(col => (
                  <div key={col} className="flex items-center gap-2 py-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-error shrink-0" />
                    <span className="font-mono text-xs text-on-surface">{col}</span>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant/60 mb-2 font-headline">Optional</p>
                {['School', 'Email', 'Phone'].map(col => (
                  <div key={col} className="flex items-center gap-2 py-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-outline shrink-0" />
                    <span className="font-mono text-xs text-on-surface-variant">{col}</span>
                  </div>
                ))}
              </div>
              <div className="md:col-span-2 mt-1 pt-3 border-t border-outline-variant/10 space-y-1 text-xs text-on-surface-variant font-body">
                <p><span className="font-bold text-on-surface">Auto-generated by the app:</span> A unique 6-digit login code (also the password), position (Member of Parliament), party, committee and constituency.</p>
                <p><span className="font-bold text-on-surface">School:</span> Defaults to "Independent" if blank. New names are added to the event's school directory automatically.</p>
                <p><span className="font-bold text-on-surface">Email:</span> Optional — students without email still get a 6-digit login code and can sign in with it. Only students with email can receive bulk emails.</p>
                <p><span className="font-bold text-on-surface">Re-upload safe:</span> Matched by email (if provided) or by name within the event — existing students are updated, not duplicated.</p>
                <p><span className="font-bold text-on-surface">After import:</span> download the credentials sheet to share each student's login code.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3 text-sm font-body">
              <div className="flex gap-6">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-error mb-2 font-headline">Required</p>
                  {['Serial no', 'Preevent scores'].map(col => (
                    <div key={col} className="flex items-center gap-2 py-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-error shrink-0" />
                      <span className="font-mono text-xs text-on-surface">{col}</span>
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-xs text-on-surface-variant pt-1 border-t border-outline-variant/10">Updates pre-event scores only. All other student data remains unchanged. Students must already exist (run Full Import first).</p>
            </div>
          )}
        </div>

        {/* Event context — always visible so the organizer knows which event they're importing into */}
        <div className={`flex items-center gap-3 px-5 py-3 rounded-2xl text-sm font-body ${profile?.event_id ? 'bg-primary/5 border border-primary/15' : 'bg-error/8 border border-error/20'}`}>
          <span className={`material-symbols-outlined text-[20px] shrink-0 ${profile?.event_id ? 'text-primary' : 'text-error'}`} style={{ fontVariationSettings: "'FILL' 1" }}>
            {profile?.event_id ? 'event_available' : 'event_busy'}
          </span>
          {profile?.event_id ? (
            <p className="text-on-surface-variant font-medium">
              Importing into event <span className="font-black text-primary font-mono text-xs">{profile.event_id.slice(0, 8)}…</span>
              {profile.city ? <span> · <span className="font-bold text-on-surface">{profile.city}</span></span> : null}
            </p>
          ) : (
            <p className="text-error font-bold">No event assigned to your account — import is blocked. Contact your administrator.</p>
          )}
        </div>

        {/* File upload + download row */}
        <div className="flex flex-col sm:flex-row gap-4">
          <button
            onClick={downloadTemplate}
            disabled={isDownloadingTemplate}
            className="flex items-center gap-2 py-3.5 px-6 rounded-2xl bg-surface-container text-on-surface-variant hover:bg-surface-container-high font-bold text-sm transition-all active:scale-95 font-body disabled:opacity-50 shrink-0"
          >
            <span className="material-symbols-outlined text-[20px]">download</span>
            {isDownloadingTemplate ? 'Downloading…' : 'Download Template'}
          </button>

          <div className="flex-1">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="hidden"
              id="excel-upload"
            />
            <label
              htmlFor="excel-upload"
              className={`flex items-center justify-center gap-3 p-5 rounded-2xl cursor-pointer transition-all border border-dashed font-body ${
                file
                  ? 'bg-primary/5 border-primary/30 text-primary'
                  : 'bg-surface-container border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high hover:border-outline-variant/60'
              }`}
            >
              <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                {file ? 'table_chart' : 'upload_file'}
              </span>
              <div>
                <p className="font-bold text-sm">{file ? file.name : 'Select file (.xlsx, .xls or .csv)'}</p>
                {!file && <p className="text-[11px] text-on-surface-variant/60 mt-0.5">Click to browse</p>}
              </div>
              {file && (
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); setFile(null); }}
                  className="ml-auto p-1 rounded-full hover:bg-primary/10 transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              )}
            </label>
          </div>
        </div>

        {/* Import CTA */}
        {file && (
          <button
            onClick={handleFileUpload}
            disabled={isUploading}
            className="w-full py-4 bg-gradient-to-r from-primary to-primary-container text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-[0_8px_24px_rgba(19,41,143,0.25)] hover:scale-[1.01] active:scale-98 transition-all font-body disabled:opacity-60 flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              {isUploading ? 'sync' : 'cloud_upload'}
            </span>
            {isUploading ? 'Importing…' : `Import ${importMode === 'scores-only' ? 'Pre-Event Scores' : 'Students'}`}
          </button>
        )}

        {/* Import progress */}
        {isUploading && (
          <div className="space-y-2">
            <Progress value={progress} className="h-2 bg-surface-container" />
            <p className="text-xs text-on-surface-variant font-body text-center">
              {fileName ? `Importing ${fileName} — ` : ''}{progress}% complete
            </p>
          </div>
        )}

        {/* Results */}
        {results && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-tertiary-container/10 rounded-2xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-on-tertiary-container/20 rounded-xl flex items-center justify-center">
                  <span className="material-symbols-outlined text-on-tertiary-container text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                </div>
                <div>
                  <p className="text-2xl font-black text-on-surface font-headline">{results.success}</p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant font-body">Successful</p>
                </div>
              </div>
              <div className="bg-error/8 rounded-2xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-error/15 rounded-xl flex items-center justify-center">
                  <span className="material-symbols-outlined text-error text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>cancel</span>
                </div>
                <div>
                  <p className="text-2xl font-black text-on-surface font-headline">{results.failed}</p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant font-body">Failed</p>
                </div>
              </div>
            </div>

            {results.credentials && results.credentials.length > 0 && (() => {
              const emailableCount = results.credentials.filter(c => !!c.email).length;
              const total = results.credentials.length;
              return (
                <div className="bg-primary/5 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-primary font-headline flex items-center gap-1.5 mb-1">
                      <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>key</span>
                      New Login Credentials
                    </p>
                    <p className="text-sm text-on-surface-variant font-body">
                      {total} new account{total === 1 ? '' : 's'} created.
                      {emailableCount < total && (
                        <span> {emailableCount} have email — {total - emailableCount} will need the downloaded sheet.</span>
                      )}
                      {emailableCount === total && ' Download the sheet or email each student their 6-digit login code.'}
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                    <button
                      onClick={downloadCredentials}
                      className="flex items-center justify-center gap-2 py-3 px-5 rounded-2xl bg-primary text-white font-bold text-sm transition-all hover:bg-primary/90 active:scale-95 font-body shadow-[0_4px_12px_rgba(19,41,143,0.25)]"
                    >
                      <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>download</span>
                      Download All ({total})
                    </button>
                    {emailableCount > 0 && (
                      <button
                        onClick={handleBulkEmail}
                        disabled={isEmailing}
                        className="flex items-center justify-center gap-2 py-3 px-5 rounded-2xl bg-surface-container-lowest border border-primary/20 text-primary font-bold text-sm transition-all hover:bg-primary/5 active:scale-95 font-body disabled:opacity-60"
                      >
                        <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                          {isEmailing ? 'sync' : 'mail'}
                        </span>
                        {isEmailing ? 'Sending…' : `Email ${emailableCount} Student${emailableCount === 1 ? '' : 's'}`}
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}

            {results.errors.length > 0 && (
              <div className="bg-error/5 rounded-2xl p-5 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-error font-headline flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px]">warning</span>
                    Import Errors ({results.errors.length})
                  </p>
                  <button
                    onClick={downloadErrorReport}
                    className="flex items-center gap-1.5 py-1.5 px-3 rounded-xl bg-error/10 text-error font-bold text-[11px] transition-all hover:bg-error/20 active:scale-95 font-body shrink-0"
                  >
                    <span className="material-symbols-outlined text-[14px]">download</span>
                    Download Report
                  </button>
                </div>
                <ul className="space-y-1 max-h-64 overflow-y-auto pr-1">
                  {results.errors.map((err, i) => (
                    <li key={i} className="text-xs text-on-surface-variant font-body flex items-start gap-2">
                      <span className="text-error/60 shrink-0 mt-0.5">·</span>{err}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Danger zone */}
      <section className="bg-error/5 rounded-[2rem] p-8">
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-error/70 font-headline mb-1">Danger Zone</p>
            <p className="font-bold text-on-surface font-headline">Delete All Students</p>
            <p className="text-sm text-on-surface-variant font-body mt-1">Permanently removes all student accounts, profiles, assessments and votes. This cannot be undone.</p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                disabled={isDeleting}
                className="shrink-0 flex items-center gap-2 py-3 px-5 rounded-2xl bg-error text-white font-bold text-sm transition-all hover:bg-error/90 active:scale-95 font-body disabled:opacity-50 shadow-[0_4px_12px_rgba(186,26,26,0.25)]"
              >
                <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>delete_forever</span>
                {isDeleting ? 'Deleting…' : 'Delete All'}
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-[2rem] border-none bg-surface-container-lowest shadow-2xl">
              <div className="absolute top-0 inset-x-0 h-1.5 bg-error rounded-t-[2rem]" />
              <AlertDialogHeader className="pt-4">
                <AlertDialogTitle className="text-xl font-black text-on-surface font-headline flex items-center gap-2">
                  <span className="material-symbols-outlined text-error text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
                  Delete All Students?
                </AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-3 text-sm text-on-surface-variant font-body">
                    <p>This will permanently delete:</p>
                    <ul className="space-y-1 ml-2">
                      {['All student login credentials', 'All student profiles and data', 'All assessments, votes, and related records'].map(item => (
                        <li key={item} className="flex items-center gap-2">
                          <span className="w-1 h-1 rounded-full bg-error/60 shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                    <p className="font-bold text-error">This action cannot be undone.</p>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="gap-3">
                <AlertDialogCancel className="rounded-xl border-none bg-surface-container font-bold">Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteAllStudents}
                  className="rounded-xl bg-error text-white font-bold hover:bg-error/90"
                >
                  Yes, Delete All
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </section>

    </div>
  );
};
