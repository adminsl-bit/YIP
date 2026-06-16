// Keeps bulk-import progress/results alive across tab switches within the
// Organizer dashboard. The import itself runs as a fire-and-forget async
// loop that keeps executing (and writing to the DB) even after the
// StudentBulkImport component unmounts — this store lets the UI pick the
// run back up when the user returns to the tab, and persists the last
// completed result to localStorage so it survives a full page reload.

export interface ImportCredential {
  serialNumber: number;
  name: string;
  school: string;
  email: string;
  phone?: string;
  password: string;
}

export interface ImportResults {
  success: number;
  failed: number;
  errors: string[];
  credentials?: ImportCredential[];
}

export interface BulkImportState {
  isUploading: boolean;
  progress: number;
  results: ImportResults | null;
  fileName: string | null;
  importMode: 'full' | 'scores-only';
}

const STORAGE_KEY = 'yip_bulk_import_last_result';

const loadPersisted = (): Pick<BulkImportState, 'results' | 'fileName' | 'importMode'> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { results: null, fileName: null, importMode: 'full' };
    const parsed = JSON.parse(raw);
    return {
      results: parsed.results ?? null,
      fileName: parsed.fileName ?? null,
      importMode: parsed.importMode ?? 'full',
    };
  } catch {
    return { results: null, fileName: null, importMode: 'full' };
  }
};

let state: BulkImportState = {
  isUploading: false,
  progress: 0,
  ...loadPersisted(),
};

const listeners = new Set<() => void>();

export const getBulkImportState = (): BulkImportState => state;

export const setBulkImportState = (partial: Partial<BulkImportState>): void => {
  state = { ...state, ...partial };
  listeners.forEach(listener => listener());

  if ('results' in partial || 'fileName' in partial || 'importMode' in partial) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        results: state.results,
        fileName: state.fileName,
        importMode: state.importMode,
      }));
    } catch {
      // Storage unavailable — non-fatal, just skip persistence.
    }
  }
};

export const subscribeBulkImportState = (callback: () => void): (() => void) => {
  listeners.add(callback);
  return () => listeners.delete(callback);
};
