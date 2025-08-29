import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, FileSpreadsheet, Download, CheckCircle, AlertCircle, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import * as XLSX from 'xlsx';

interface StudentData {
  serialNumber: number;
  loginId: string;
  name: string;
  seatRole: string;
  partyNumber: number;
  constituency?: string;
  state?: string;
  city?: string;
  photoUrl?: string;
  password: string;
}

export const StudentBulkImport = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
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

  const parseExcelFile = (file: File): Promise<StudentData[]> => {
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
              for (const name of possibleNames) {
                if (row[name] !== undefined) return row[name];
              }
              return '';
            };

            const serialNumber = getColumnValue(['serial_no', 'Serial no', 'S.No', 'Serial No', 'SNo', 's.no', 'serial_number']);
            const loginId = getColumnValue(['login_id', 'login id', 'Login ID', 'LoginId']);
            const name = getColumnValue(['name', 'Name', 'student_name', 'Student Name']);
            const seatRole = getColumnValue(['seat_role', 'seat role', 'Seat Role', 'Role', 'role', 'Position', 'position']);
            const partyNumber = getColumnValue(['party_number', 'partynumber', 'Party Number', 'Party No', 'party_no']);
            const constituency = getColumnValue(['constituency', 'Constituency']);
            const state = getColumnValue(['state', 'State']);
            const city = getColumnValue(['city', 'home city', 'Home City', 'City']);
            const photoUrl = getColumnValue(['photo_url', 'photo url', 'Photo URL', 'Photo Link', 'photo_link']);
            const password = getColumnValue(['password', 'Password']);

            if (!name || !serialNumber || !loginId || !password) {
              throw new Error(`Row ${index + 2}: Missing required fields (Serial no, Login ID, Name, or Password)`);
            }

            return {
              serialNumber: parseInt(serialNumber.toString()) || index + 1,
              loginId: loginId.toString().trim(),
              name: name.toString().trim(),
              seatRole: seatRole?.toString().trim() || 'Member of Parliament',
              partyNumber: parseInt(partyNumber?.toString()) || 1,
              constituency: constituency?.toString().trim(),
              state: state?.toString().trim(),
              city: city?.toString().trim(),
              photoUrl: photoUrl ? convertGoogleDriveUrl(photoUrl.toString().trim()) : undefined,
              password: password.toString().trim(),
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
        body: JSON.stringify({ students }),
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
      const students = await parseExcelFile(file);
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

  const downloadTemplate = () => {
    const template = [
      {
        'Serial no': 1,
        'login id': '11',
        'name': 'John Doe',
        'seat role': 'Speaker',
        'partynumber': 1,
        'constituency': 'Mumbai Central',
        'state': 'Maharashtra',
        'home city': 'Mumbai',
        'photo url': 'https://drive.google.com/file/d/1ABC123/view?usp=sharing',
        'password': 'student123'
      }
    ];
    
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Students');
    XLSX.writeFile(wb, 'student_import_template.xlsx');
    toast.success("Template downloaded successfully");
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
          <Alert>
            <Info className="w-4 h-4" />
            <AlertDescription>
              <strong>Required columns:</strong> Serial no, login id, name, password
              <br />
              <strong>Optional columns:</strong> seat role, partynumber, constituency, state, home city, photo url
              <br />
              <strong>Google Drive photos:</strong> Use shareable links - they'll be converted automatically
              <br />
              <strong>Re-upload support:</strong> Existing students will be updated with new data
            </AlertDescription>
          </Alert>

          <div className="flex flex-col sm:flex-row gap-4">
            <Button
              onClick={downloadTemplate}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download Template
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