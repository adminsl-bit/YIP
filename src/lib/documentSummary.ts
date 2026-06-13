import * as pdfjsLib from 'pdfjs-dist';
// Use Vite worker plugin to bundle pdf.js worker locally
// @ts-ignore - Vite worker import type
import PDFWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker&inline';
import * as mammoth from 'mammoth';

const ensurePdfWorker = () => {
  const g: any = pdfjsLib as any;
  if (g.GlobalWorkerOptions && !g.GlobalWorkerOptions.workerPort) {
    try {
      // @ts-ignore create worker instance
      const workerInstance: Worker = new (PDFWorker as any)();
      g.GlobalWorkerOptions.workerPort = workerInstance as any;
    } catch (e) {
      console.warn('Failed to init pdf.js worker, falling back to no-worker mode', e);
    }
  }
};

const extractPdfText = async (buffer: ArrayBuffer): Promise<string> => {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;
  ensurePdfWorker();

  const pdf = await (pdfjsLib as any).getDocument({
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
    isEvalSupported: false,
  }).promise;

  const pageTexts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    pageTexts.push(
      textContent.items.map((item: any) => item.str).join(' ')
    );
  }
  return pageTexts.join('\n');
};

const extractDocxText = async (buffer: ArrayBuffer): Promise<string> => {
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  return result.value;
};

/** Extracts plain text from a PDF or DOCX file for client-side preview/summary. */
export const extractTextFromFile = async (file: File): Promise<string> => {
  const name = file.name.toLowerCase();
  const buffer = await file.arrayBuffer();

  if (name.endsWith('.pdf') || file.type === 'application/pdf') {
    return extractPdfText(buffer);
  }
  if (name.endsWith('.docx') || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return extractDocxText(buffer);
  }
  throw new Error('Unsupported file type — only PDF and DOCX are supported.');
};

export interface DocumentSummary {
  summary: string;
  wordCount: number;
  truncated: boolean;
}

const MAX_SUMMARY_SENTENCES = 6;
const MAX_SUMMARY_CHARS = 600;

/**
 * Heuristic extractive "summary": the first few sentences of the document,
 * capped by length. This is a quick preview, not an AI-generated summary.
 */
export const buildSummary = (text: string): DocumentSummary => {
  const normalized = text.replace(/\s+/g, ' ').trim();
  const wordCount = normalized ? normalized.split(' ').length : 0;

  if (!normalized) {
    return { summary: 'No readable text could be extracted from this document.', wordCount: 0, truncated: false };
  }

  const sentences = normalized.match(/[^.!?]+[.!?]+/g) ?? [normalized];
  let summary = sentences.slice(0, MAX_SUMMARY_SENTENCES).join(' ').trim();
  let truncated = sentences.length > MAX_SUMMARY_SENTENCES;

  if (summary.length > MAX_SUMMARY_CHARS) {
    summary = summary.slice(0, MAX_SUMMARY_CHARS).trim();
    truncated = true;
  }

  return { summary: truncated ? `${summary}…` : summary, wordCount, truncated };
};
