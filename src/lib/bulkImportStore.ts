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
  _eventId?: string | null;
}

const STORAGE_KEY = 'yip_bulk_import_last_result';

const loadPersisted = (): Pick<BulkImportState, 'results' | 'fileName' | 'importMode' | '_eventId'> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { results: null, fileName: null, importMode: 'full', _eventId: null };
    const parsed = JSON.parse(raw);
    return {
      results: parsed.results ?? null,
      fileName: parsed.fileName ?? null,
      importMode: parsed.importMode ?? 'full',
      _eventId: parsed._eventId ?? null,
    };
  } catch {
    return { results: null, fileName: null, importMode: 'full', _eventId: null };
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

  if ('results' in partial || 'fileName' in partial || 'importMode' in partial || '_eventId' in partial) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        results: state.results,
        fileName: state.fileName,
        importMode: state.importMode,
        _eventId: state._eventId,
      }));
    } catch {
      // Storage unavailable — non-fatal, just skip persistence.
    }
  }
};

// Called by the component on mount with the current organizer's event_id.
// Clears persisted results if they belong to a different event.
export const validateEventId = (currentEventId: string | null | undefined): void => {
  if (!currentEventId) return;
  if (state._eventId && state._eventId !== currentEventId) {
    setBulkImportState({ results: null, fileName: null, _eventId: currentEventId });
  } else if (!state._eventId && state.results) {
    // Legacy persisted result has no event_id — clear it to be safe.
    setBulkImportState({ results: null, fileName: null, _eventId: currentEventId });
  } else if (!state._eventId) {
    setBulkImportState({ _eventId: currentEventId });
  }
};

export const subscribeBulkImportState = (callback: () => void): (() => void) => {
  listeners.add(callback);
  return () => listeners.delete(callback);
};
