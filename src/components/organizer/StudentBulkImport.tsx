import React, { useState } from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import * as XLSX from 'xlsx';

interface StudentData {
  serialNumber: number;
  loginId: string;
  name: string;
  seatRole: string;
  alliance?: string;
  party?: string;
  partyName?: string;
  committee?: string;
  constituency?: string;
  state?: string;
  city?: string;
  password: string;
  preeventScores?: number;
}

export const StudentBulkImport = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importMode, setImportMode] = useState<'full' | 'scores-only'>('full');
  const [results, setResults] = useState<{
    success: number;
    failed: number;
    errors: string[];
  } | null>(null);

  const convertGoogleDriveUrl = (url: string): string => {
    if (!url || !url.includes('drive.google.com')) return url;
    
    // Extract file ID from various Google Drive URL formats
    const fileIdMatch = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (fileIdMatch) {
      const fileId = fileIdMatch[1];
      return `https://drive.google.com/uc?export=view&id=${fileId}`;
    }
    
    return url;
  };

  const parseExcelFile = (file: File, mode: 'full' | 'scores-only' = 'full'): Promise<StudentData[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);

          const students: StudentData[] = jsonData.map((row: any, index) => {
            // Handle various column name formats
            const getColumnValue = (possibleNames: string[]) => {
              const keys = Object.keys(row);
              const findKey = (target: string) => keys.find(k => k.toString().trim().toLowerCase() === target.trim().toLowerCase());
              for (const name of possibleNames) {
                const exact = findKey(name);
                if (exact) return row[exact];
              }
              // Loose match: allow headers like "Party Code" or "Party Letter"
              const targets = possibleNames.map(n => n.trim().toLowerCase());
              const loose = keys.find(k => targets.some(t => k.toString().trim().toLowerCase().includes(t)));
              if (loose) return row[loose];
              return '';
            };

            const serialNumber = getColumnValue(['Serial no', 'serial_no', 'S.No', 'Serial No', 'SNo']);
            const loginId = getColumnValue(['Login', 'login', 'login_id', 'Login ID']);
            const name = getColumnValue(['Name', 'name', 'student_name']);
            const seatRole = getColumnValue(['seat role', 'seat_role', 'Seat Role', 'Role']);
            const alliance = getColumnValue(['Alliance', 'alliance']);
            const party = getColumnValue(['Party', 'party', 'PARTY', 'Party Code', 'party code', 'Party Letter', 'party letter', 'Party (A-E)']);
            const partyName = getColumnValue(['Party Name', 'party_name']);
            const committee = getColumnValue(['Committee', 'committee']);
            const constituency = getColumnValue(['constituency', 'Constituency']);
            const state = getColumnValue(['state', 'State']);
            const city = getColumnValue(['home city', 'city', 'City', 'Home City']);
            const password = getColumnValue(['password', 'Password']);
            const preeventScores = getColumnValue(['Preevent scores', 'preevent_scores', 'Pre-event scores']);

            if (mode === 'scores-only') {
              if (!serialNumber) {
                throw new Error(`Row ${index + 2}: Missing required field (Serial no)`);
              }
            } else {
              if (!name || !serialNumber || !loginId || !password) {
                throw new Error(`Row ${index + 2}: Missing required fields (Serial no, Login, Name, or Password)`);
              }
            }

            return {
              serialNumber: parseInt(serialNumber.toString()) || index + 1,
              loginId: loginId.toString().trim(),
              name: name.toString().trim(),
              seatRole: seatRole?.toString().trim() || 'Member of Parliament',
              alliance: alliance?.toString().trim(),
              party: party?.toString().trim(),
              partyName: partyName?.toString().trim(),
              committee: committee?.toString().trim(),
              constituency: constituency?.toString().trim(),
              state: state?.toString().trim(),
              city: city?.toString().trim(),
              password: password.toString().trim(),
              preeventScores: preeventScores ? parseFloat(preeventScores.toString()) : undefined,
            };
          });

          resolve(students);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  };

  const importStudents = async (students: StudentData[]) => {
    const results = { success: 0, failed: 0, errors: [] as string[] };
    
    try {
      // Get current session for authorization
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');

      // Use edge function for bulk import with admin privileges
      const response = await fetch('https://ybxktwmpxdnpkfeewrpe.supabase.co/functions/v1/bulk-import-students', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ students, mode: importMode }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const importResults = await response.json();
      return importResults;
    } catch (error) {
      results.errors.push(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      results.failed = students.length;
      return results;
    }
  };

  const handleFileUpload = async () => {
    if (!file) {
      toast.error("Please select a file first");
      return;
    }

    setIsUploading(true);
    setProgress(0);
    setResults(null);

    try {
      const students = await parseExcelFile(file, importMode);
      const importResults = await importStudents(students);
      setResults(importResults);
      
      if (importResults.success > 0) {
        toast.success(`Successfully imported ${importResults.success} students`);
      }
      if (importResults.failed > 0) {
        toast.error(`Failed to import ${importResults.failed} students`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to process file');
    } finally {
      setIsUploading(false);
      setProgress(0);
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

      const response = await fetch('https://ybxktwmpxdnpkfeewrpe.supabase.co/functions/v1/delete-all-students', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (result.success) {
        toast.success(result.message);
        setResults(null); // Clear any previous import results
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
          { 'Serial no': 1, 'Name': 'John Doe', 'seat role': 'Member of Parliament', 'Alliance': 'Ruling', 'Party': 'A', 'Party Name': 'SAMPLE PARTY', 'Committee': '1', 'constituency': 'Mumbai Central', 'state': 'Maharashtra', 'home city': 'Mumbai', 'Login': 'YIP0001', 'password': 'student123', 'Preevent scores': '' },
          { 'Serial no': 2, 'Name': 'Jane Smith', 'seat role': 'Administrator', 'Alliance': 'Neutral', 'Party': 'No Party', 'Party Name': 'No Party', 'Committee': '1', 'constituency': 'Delhi', 'state': 'NCT Delhi', 'home city': 'Delhi', 'Login': 'YIP0002', 'password': 'admin123', 'Preevent scores': '' },
          { 'Serial no': 3, 'Name': 'Bob Reporter', 'seat role': 'Journalist', 'Alliance': 'Neutral', 'Party': 'No Party', 'Party Name': 'No Party', 'Committee': '1', 'constituency': 'Bangalore', 'state': 'Karnataka', 'home city': 'Bangalore', 'Login': 'YIP0003', 'password': 'journalist123', 'Preevent scores': '' },
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
                {['Serial no', 'Name', 'seat role', 'Login', 'password'].map(col => (
                  <div key={col} className="flex items-center gap-2 py-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-error shrink-0" />
                    <span className="font-mono text-xs text-on-surface">{col}</span>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant/60 mb-2 font-headline">Optional</p>
                {['Alliance', 'Party', 'Party Name', 'Committee', 'constituency', 'state', 'home city', 'Preevent scores'].map(col => (
                  <div key={col} className="flex items-center gap-2 py-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-outline shrink-0" />
                    <span className="font-mono text-xs text-on-surface-variant">{col}</span>
                  </div>
                ))}
              </div>
              <div className="md:col-span-2 mt-1 pt-3 border-t border-outline-variant/10 space-y-1 text-xs text-on-surface-variant font-body">
                <p><span className="font-bold text-on-surface">Role logic:</span> "Administrator" → admin access · "Journalist" → publishing access · others → student</p>
                <p><span className="font-bold text-on-surface">Re-upload safe:</span> Existing students are updated, not duplicated</p>
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
              accept=".xlsx,.xls"
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
                <p className="font-bold text-sm">{file ? file.name : 'Select Excel file (.xlsx / .xls)'}</p>
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

            {results.errors.length > 0 && (
              <div className="bg-error/5 rounded-2xl p-5 space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-error font-headline flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[14px]">warning</span>
                  Import Errors
                </p>
                <ul className="space-y-1">
                  {results.errors.slice(0, 5).map((err, i) => (
                    <li key={i} className="text-xs text-on-surface-variant font-body flex items-start gap-2">
                      <span className="text-error/60 shrink-0 mt-0.5">·</span>{err}
                    </li>
                  ))}
                  {results.errors.length > 5 && (
                    <li className="text-xs text-on-surface-variant/60 font-body">…and {results.errors.length - 5} more</li>
                  )}
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