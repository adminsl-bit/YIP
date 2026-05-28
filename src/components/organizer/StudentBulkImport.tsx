import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Upload, FileSpreadsheet, Download, CheckCircle, AlertCircle, Info, Trash2 } from "lucide-react";
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
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Bulk Student Import
          </CardTitle>
          <CardDescription>
            Upload an Excel file to import multiple students with their photos and details
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Import Mode Selection */}
          <div className="space-y-3 p-4 border rounded-lg bg-muted/50">
            <label className="text-sm font-semibold">Import Mode:</label>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                type="button"
                variant={importMode === 'full' ? 'default' : 'outline'}
                onClick={() => setImportMode('full')}
                className="flex-1"
              >
                <Upload className="w-4 h-4 mr-2" />
                Full Import (Override All Data)
              </Button>
              <Button
                type="button"
                variant={importMode === 'scores-only' ? 'default' : 'outline'}
                onClick={() => setImportMode('scores-only')}
                className="flex-1"
              >
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Pre-Event Scores Only
              </Button>
            </div>
            {importMode === 'scores-only' && (
              <Alert>
                <Info className="w-4 h-4" />
                <AlertDescription className="text-xs">
                  In this mode, only <strong>Serial Number</strong> and <strong>Preevent Scores</strong> columns are required. 
                  All other student data will remain unchanged.
                </AlertDescription>
              </Alert>
            )}
          </div>

          <Alert>
            <Info className="w-4 h-4" />
            <AlertDescription>
              {importMode === 'full' ? (
                <>
                  <strong>Required columns:</strong> Serial no, Name, seat role, Login, password
                  <br />
                  <strong>Optional columns:</strong> Alliance, Party, Party Name, Committee, constituency, state, home city, Preevent scores
                  <br />
                  <strong>Role Assignment:</strong> "Administrator" → Admin access, "Journalist" → Publishing access, Others → Student access
                  <br />
                  <strong>Re-upload support:</strong> Existing students will be updated with new data
                </>
              ) : (
                <>
                  <strong>Required columns:</strong> Serial no, Preevent scores
                  <br />
                  <strong>Mode:</strong> Updates pre-event scores only. All other data remains unchanged.
                  <br />
                  <strong>Note:</strong> Students must already exist in the system (use Full Import first)
                </>
              )}
            </AlertDescription>
          </Alert>

          <div className="flex justify-between items-center">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="destructive" 
                  disabled={isDeleting}
                  className="flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  {isDeleting ? "Deleting..." : "Delete All Students"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>⚠️ Delete All Students?</AlertDialogTitle>
                  <AlertDialogDescription className="space-y-2">
                    <p>This will permanently delete:</p>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      <li>All student login credentials</li>
                      <li>All student profiles and data</li>
                      <li>All assessments, votes, and related records</li>
                    </ul>
                    <p className="text-red-600 font-semibold mt-4">
                      This action cannot be undone!
                    </p>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleDeleteAllStudents}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Yes, Delete All Students
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <Button
              onClick={downloadTemplate}
              variant="outline"
              disabled={isDownloadingTemplate}
              className="flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              {isDownloadingTemplate ? 'Downloading...' : 'Download Template'}
            </Button>
            
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
                className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-gray-400 transition-colors"
              >
                <FileSpreadsheet className="w-5 h-5" />
                {file ? file.name : "Select Excel file"}
              </label>
            </div>
          </div>

          {file && (
            <Button
              onClick={handleFileUpload}
              disabled={isUploading}
              className="w-full"
            >
              {isUploading ? "Importing..." : "Import Students"}
            </Button>
          )}

          {isUploading && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Importing students...</span>
                <span>{progress.toFixed(0)}%</span>
              </div>
              <Progress value={progress} className="w-full" />
            </div>
          )}

          {results && (
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="w-4 h-4" />
                  <span>{results.success} successful</span>
                </div>
                <div className="flex items-center gap-2 text-red-600">
                  <AlertCircle className="w-4 h-4" />
                  <span>{results.failed} failed</span>
                </div>
              </div>

              {results.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="w-4 h-4" />
                  <AlertDescription>
                    <div className="space-y-1">
                      <p className="font-semibold">Import errors:</p>
                      <ul className="list-disc list-inside text-sm space-y-1">
                        {results.errors.slice(0, 5).map((error, index) => (
                          <li key={index}>{error}</li>
                        ))}
                        {results.errors.length > 5 && (
                          <li>... and {results.errors.length - 5} more errors</li>
                        )}
                      </ul>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};