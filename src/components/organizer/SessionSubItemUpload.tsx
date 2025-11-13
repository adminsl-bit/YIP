import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, FileText, FileSpreadsheet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from 'xlsx';

interface SessionSubItemUploadProps {
  sessionId: string;
  onUploadComplete: () => void;
}

export const SessionSubItemUpload = ({ sessionId, onUploadComplete }: SessionSubItemUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const parseExcel = async (file: File) => {
    return new Promise<any[]>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);
          resolve(jsonData);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsBinaryString(file);
    });
  };

  const parsePDF = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        // Simple text extraction - splits by line breaks
        resolve(text);
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const fileType = file.name.toLowerCase();
    
    if (!fileType.endsWith('.xlsx') && !fileType.endsWith('.xls') && !fileType.endsWith('.pdf')) {
      toast({
        title: "Invalid file type",
        description: "Please upload an Excel (.xlsx, .xls) or PDF file",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      let items: any[] = [];

      if (fileType.endsWith('.xlsx') || fileType.endsWith('.xls')) {
        // Parse Excel
        const excelData = await parseExcel(file);
        items = excelData.map((row: any, index) => ({
          parent_session_id: sessionId,
          title: row.Title || row.title || row.Question || row.question || `Item ${index + 1}`,
          description: row.Description || row.description || '',
          content: row.Content || row.content || JSON.stringify(row),
          sort_order: index,
        }));
      } else if (fileType.endsWith('.pdf')) {
        // Parse PDF - extract lines as items
        const pdfText = await parsePDF(file);
        const lines = pdfText.split('\n').filter(line => line.trim().length > 0);
        items = lines.map((line, index) => ({
          parent_session_id: sessionId,
          title: line.trim(),
          description: '',
          content: line.trim(),
          sort_order: index,
        }));
      }

      if (items.length === 0) {
        throw new Error("No items found in file");
      }

      // Insert items into database
      const { error } = await supabase
        .from('session_sub_items')
        .insert(items);

      if (error) throw error;

      toast({
        title: "Success",
        description: `${items.length} items uploaded successfully`,
      });

      onUploadComplete();
      
      // Reset input
      event.target.value = '';
    } catch (error) {
      console.error('Error uploading file:', error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload file",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Input
        type="file"
        accept=".xlsx,.xls,.pdf"
        onChange={handleFileUpload}
        disabled={uploading}
        className="hidden"
        id={`upload-${sessionId}`}
      />
      <label htmlFor={`upload-${sessionId}`}>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          asChild
        >
          <span className="cursor-pointer">
            <Upload className="h-4 w-4 mr-2" />
            {uploading ? "Uploading..." : "Upload Items"}
          </span>
        </Button>
      </label>
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <FileSpreadsheet className="h-3 w-3" />
        <FileText className="h-3 w-3" />
        <span>Excel or PDF</span>
      </div>
    </div>
  );
};
