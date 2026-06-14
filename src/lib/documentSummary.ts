import * as pdfjsLib from 'pdfjs-dist';
// Use Vite worker plugin to bundle pdf.js worker locally
// @ts-ignore - Vite worker import type
import PDFWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker&inline';
import * as mammoth from 'mammoth';
import { supabase } from '@/integrations/supabase/client';

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
const MAX_SUMMARY_CHARS = 700;

// Common English words that carry little topical signal — excluded when scoring sentences.
const STOPWORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'any', 'can', 'had', 'her', 'was',
  'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'man', 'new', 'now', 'old',
  'see', 'two', 'way', 'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use',
  'that', 'with', 'have', 'this', 'will', 'your', 'from', 'they', 'know', 'want', 'been',
  'good', 'much', 'some', 'time', 'very', 'when', 'come', 'here', 'just', 'like', 'long',
  'make', 'many', 'over', 'such', 'take', 'than', 'them', 'well', 'were', 'what', 'into',
  'also', 'more', 'than', 'then', 'were', 'which', 'their', 'about', 'would', 'there',
  'these', 'other', 'shall', 'should', 'could', 'while', 'where', 'being', 'between',
]);

const tokenizeWords = (sentence: string): string[] =>
  sentence.toLowerCase().match(/[a-z0-9']+/g) ?? [];

/**
 * Heuristic extractive "summary": ranks sentences by how many topically-significant
 * (frequent, non-stopword) terms they contain, with a small boost for early sentences,
 * then returns the top-scoring sentences in their original order. This is a quick
 * client-side preview, not an AI-generated summary — see requestAiSummary for that.
 */
export const buildSummary = (text: string): DocumentSummary => {
  const normalized = text.replace(/\s+/g, ' ').trim();
  const wordCount = normalized ? normalized.split(' ').length : 0;

  if (!normalized) {
    return { summary: 'No readable text could be extracted from this document.', wordCount: 0, truncated: false };
  }

  const sentences = (normalized.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [normalized])
    .map(s => s.trim())
    .filter(Boolean);

  const capToLength = (value: string): { value: string; truncated: boolean } => {
    if (value.length <= MAX_SUMMARY_CHARS) return { value, truncated: false };
    return { value: value.slice(0, MAX_SUMMARY_CHARS).trim(), truncated: true };
  };

  if (sentences.length <= MAX_SUMMARY_SENTENCES) {
    const { value, truncated } = capToLength(sentences.join(' '));
    return { summary: truncated ? `${value}…` : value, wordCount, truncated };
  }

  // Word frequency across the whole document (excluding stopwords/short tokens).
  const frequency = new Map<string, number>();
  for (const sentence of sentences) {
    for (const word of tokenizeWords(sentence)) {
      if (word.length < 3 || STOPWORDS.has(word)) continue;
      frequency.set(word, (frequency.get(word) ?? 0) + 1);
    }
  }

  // Score each sentence by its average term frequency, with a small boost for
  // sentences near the start (often introduce the topic) and a penalty for
  // very short, heading-like fragments.
  const scored = sentences.map((sentence, index) => {
    const words = tokenizeWords(sentence).filter(w => w.length >= 3 && !STOPWORDS.has(w));
    const score = words.length
      ? words.reduce((sum, w) => sum + (frequency.get(w) ?? 0), 0) / words.length
      : 0;
    const positionBonus = index < 3 ? score * 0.5 : 0;
    const shortPenalty = words.length < 4 ? score * 0.5 : 0;
    return { sentence, index, score: score + positionBonus - shortPenalty };
  });

  const topSentences = [...scored]
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_SUMMARY_SENTENCES)
    .sort((a, b) => a.index - b.index)
    .map(s => s.sentence);

  const { value } = capToLength(topSentences.join(' '));
  return { summary: `${value}…`, wordCount, truncated: true };
};

// Cap what's sent to the edge function — keeps the request small and leaves
// room for the model's own truncation of its ~1024-token input limit.
const MAX_AI_INPUT_CHARS = 8000;

/**
 * Requests an AI-generated abstractive summary via the `summarize-document`
 * edge function (Hugging Face Inference API). Requires an internet connection —
 * callers should check `navigator.onLine` first and surface a friendly message
 * when offline.
 */
export const requestAiSummary = async (text: string): Promise<string> => {
  const input = text.replace(/\s+/g, ' ').trim().slice(0, MAX_AI_INPUT_CHARS);
  if (!input) throw new Error('No readable text could be extracted from this document.');

  const { data, error } = await supabase.functions.invoke('summarize-document', {
    body: { text: input },
  });

  if (error) throw new Error(error.message || 'AI summary request failed.');
  if (!data?.success) throw new Error(data?.error || 'AI summary request failed.');

  return data.summary as string;
};
