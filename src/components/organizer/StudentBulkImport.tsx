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
  name: string;
  partyName: string;
  partyNumber: number;
  role: string;
  photoUrl?: string;
  constituency?: string;
  state?: string;
  city?: string;
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

            const serialNumber = getColumnValue(['S.No', 'Serial No', 'SNo', 's.no', 'serial_number', 'Serial Number']);
            const name = getColumnValue(['Name', 'name', 'student_name', 'Student Name']);
            const partyName = getColumnValue(['Party Name', 'party_name', 'Party', 'party']);
            const partyNumber = getColumnValue(['Party Number', 'party_number', 'Party No', 'party_no']);
            const role = getColumnValue(['Role', 'role', 'Position', 'position']);
            const photoUrl = getColumnValue(['Photo URL', 'photo_url', 'Photo Link', 'photo_link', 'Photo', 'photo']);
            const constituency = getColumnValue(['Constituency', 'constituency']);
            const state = getColumnValue(['State', 'state']);
            const city = getColumnValue(['City', 'city']);

            if (!name || !serialNumber) {
              throw new Error(`Row ${index + 2}: Missing required fields (Name or Serial Number)`);
            }

            return {
              serialNumber: parseInt(serialNumber.toString()) || index + 1,
              name: name.toString().trim(),
              partyName: partyName?.toString().trim() || '',
              partyNumber: parseInt(partyNumber?.toString()) || 1,
              role: role?.toString().trim() || 'Member of Parliament',
              photoUrl: photoUrl ? convertGoogleDriveUrl(photoUrl.toString().trim()) : undefined,
              constituency: constituency?.toString().trim(),
              state: state?.toString().trim(),
              city: city?.toString().trim(),
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
    
    for (let i = 0; i < students.length; i++) {
      const student = students[i];
      setProgress(((i + 1) / students.length) * 100);

      try {
        // First, create a user account
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email: `${student.serialNumber}@parliament.local`,
          password: `student${student.serialNumber}`,
          email_confirm: true,
        });

        if (authError) {
          results.errors.push(`${student.name}: Failed to create auth user - ${authError.message}`);
          results.failed++;
          continue;
        }

        // Then create the profile
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            user_id: authData.user.id,
            serial_number: student.serialNumber,
            name: student.name,
            position: student.role,
            party_number: student.partyNumber,
            constituency: student.constituency,
            state: student.state,
            city: student.city,
            photo_url: student.photoUrl,
            user_type: 'student',
            email: `${student.serialNumber}@parliament.local`,
          });

        if (profileError) {
          results.errors.push(`${student.name}: Failed to create profile - ${profileError.message}`);
          results.failed++;
        } else {
          results.success++;
        }
      } catch (error) {
        results.errors.push(`${student.name}: Unexpected error - ${error instanceof Error ? error.message : 'Unknown error'}`);
        results.failed++;
      }
    }

    return results;
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
        'S.No': 1,
        'Name': 'John Doe',
        'Party Name': 'Progressive Party',
        'Party Number': 1,
        'Role': 'Member of Parliament',
        'Constituency': 'Mumbai Central',
        'State': 'Maharashtra',
        'City': 'Mumbai',
        'Photo URL': 'https://drive.google.com/file/d/1ABC123/view?usp=sharing'
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
              <strong>Required columns:</strong> S.No, Name, Party Name, Party Number, Role
              <br />
              <strong>Optional columns:</strong> Constituency, State, City, Photo URL
              <br />
              <strong>Google Drive photos:</strong> Use shareable links - they'll be converted automatically
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