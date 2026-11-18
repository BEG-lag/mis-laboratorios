/**
 * Persistencia opcional, sólo si la persona la activa: IndexedDB en este navegador.
 * Nada se guarda por omisión. "Borrar todo" elimina la base completa.
 */
import type { LabResult, Lang, Study } from './types.ts';

export const DB_NAME = 'mis-laboratorios';
const STORE = 'estado';
const KEY = 'v1';

export interface SavedState {
  version: 1;
  savedAt: string;
  studies: Study[];
  results: LabResult[];
  settings: { lang: Lang };
}

function available(): boolean {
  try {
    return typeof indexedDB !== 'undefined';
  } catch {
    return false;
  }
}

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Abre la base. Con createIfMissing=false no la crea si no existía. */
function open(createIfMissing: boolean): Promise<IDBDatabase | null> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    let aborted = false;
    req.onupgradeneeded = (event) => {
      if (!createIfMissing && event.oldVersion === 0) {
        aborted = true;
        req.transaction?.abort();
        return;
      }
      req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => (aborted ? resolve(null) : reject(req.error));
    req.onblocked = () => resolve(null);
  });
}

export async function hasSaved(): Promise<boolean> {
  if (!available()) return false;
  try {
    if ('databases' in indexedDB) {
      const list = await indexedDB.databases();
      if (!list.some((d) => d.name === DB_NAME)) return false;
    }
    const db = await open(false);
    if (!db) return false;
    db.close();
    return true;
  } catch {
    return false;
  }
}

export async function loadState(): Promise<SavedState | null> {
  if (!(await hasSaved())) return null;
  const db = await open(false);
  if (!db) return null;
  try {
    const tx = db.transaction(STORE, 'readonly');
    const value = (await promisify(tx.objectStore(STORE).get(KEY))) as SavedState | undefined;
    return value && value.version === 1 && Array.isArray(value.studies) && Array.isArray(value.results) ? value : null;
  } finally {
    db.close();
  }
}

export async function saveState(state: SavedState): Promise<void> {
  if (!available()) return;
  const db = await open(true);
  if (!db) return;
  try {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(state, KEY);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function wipeState(): Promise<void> {
  if (!available()) return;
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}
