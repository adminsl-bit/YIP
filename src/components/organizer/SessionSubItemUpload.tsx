import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, FileText, FileSpreadsheet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';

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

  const parsePDF = async (file: File): Promise<string[]> => {
    // Set worker source to use unpkg CDN which works better in sandboxed environments
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const typedArray = new Uint8Array(e.target?.result as ArrayBuffer);
          const pdf = await pdfjsLib.getDocument({
            data: typedArray,
            useWorkerFetch: false,
            isEvalSupported: false,
            useSystemFonts: true
          }).promise;
          const textItems: string[] = [];
          
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items
              .map((item: any) => item.str)
              .filter((str: string) => str.trim().length > 0);
            textItems.push(...pageText);
          }
          
          resolve(textItems);
        } catch (error) {
          console.error('PDF parsing error:', error);
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
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
        // Parse PDF - extract text items
        const pdfTextItems = await parsePDF(file);
        items = pdfTextItems.map((text, index) => ({
          parent_session_id: sessionId,
          title: text.substring(0, 200), // Limit title length
          description: '',
          content: text,
          sort_order: index,
        }));
      }

      if (items.length === 0) {
        throw new Error("No items found in file");
      }

      // Insert items into database
      const { error } = await supabase
        .from('session_sub_items' as any)
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
