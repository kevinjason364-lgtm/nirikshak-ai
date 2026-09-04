import type {
  InspectionReport,
  InspectionHistoryEntry,
} from '@/types';

const HISTORY_KEY = 'nirikshak_inspection_history';
const REPORT_PREFIX = 'nirikshak_report_';
const IDB_NAME = 'nirikshak_images';
const IDB_STORE = 'blobs';
const IDB_VERSION = 1;

/** localStorage adapter for inspection metadata and history */
export const storage = {
  getHistory(): InspectionHistoryEntry[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  saveHistory(history: InspectionHistoryEntry[]): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  },

  addToHistory(entry: InspectionHistoryEntry): void {
    const history = this.getHistory();
    // Remove existing entry with the same id if any
    const filtered = history.filter((h) => h.id !== entry.id);
    filtered.unshift(entry);
    this.saveHistory(filtered);
  },

  getReport(id: string): InspectionReport | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(REPORT_PREFIX + id);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  saveReport(report: InspectionReport): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(REPORT_PREFIX + report.id, JSON.stringify(report));

    // Also update history
    const entry: InspectionHistoryEntry = {
      id: report.id,
      productName: report.productName,
      brand: report.brand,
      category: report.category,
      overallStatus: report.overallStatus,
      complianceScore: report.complianceScore,
      createdAt: report.createdAt,
      resultCounts: {
        pass: report.results.filter((r) => r.status === 'pass').length,
        warning: report.results.filter((r) => r.status === 'warning').length,
        fail: report.results.filter((r) => r.status === 'fail').length,
        needsReview: report.results.filter((r) => r.status === 'needs-review').length,
        notApplicable: report.results.filter((r) => r.status === 'not-applicable').length,
      },
    };
    this.addToHistory(entry);
  },

  deleteReport(id: string): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(REPORT_PREFIX + id);
    const history = this.getHistory().filter((h) => h.id !== id);
    this.saveHistory(history);
  },

  clearAll(): void {
    if (typeof window === 'undefined') return;
    const keys = Object.keys(localStorage).filter(
      (k) => k.startsWith(REPORT_PREFIX) || k === HISTORY_KEY
    );
    keys.forEach((k) => localStorage.removeItem(k));
  },
};

/** IndexedDB adapter for image blobs */
function openImageDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('IndexedDB not available on server'));
      return;
    }
    const request = indexedDB.open(IDB_NAME, IDB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export const imageStorage = {
  async saveBlob(key: string, blob: Blob): Promise<void> {
    const db = await openImageDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(blob, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async getBlob(key: string): Promise<Blob | null> {
    const db = await openImageDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  },

  async deleteBlob(key: string): Promise<void> {
    const db = await openImageDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
};
