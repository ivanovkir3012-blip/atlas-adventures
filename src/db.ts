export type Cat = 'Охота' | 'Рыбалка' | 'Кемпинг' | 'Путешествия';

export type TimelineEntry = {
  id: string;
  time?: string;
  title: string;
  description?: string;
};

export type SavedPlace = { id: string; title: string; type: 'Избранное место' | 'Стоянка' | 'Рыбалка' | 'Наблюдение' | 'Другое'; category: Cat; lat: number; lng: number; description: string; createdAt: string; updatedAt: string };

export type JournalPhoto = { id: string; name: string; mimeType: string; size: number; blob: Blob };
export type JournalEntry = { id: string; title: string; type: 'Наблюдения' | 'Заметки' | 'События'; date: string; place: string; description: string; photos: JournalPhoto[]; coverPhotoId?: string; createdAt: string; updatedAt: string };

export type MediaItem = {
  id: string;
  outingId: string;
  name: string;
  type: 'image' | 'video';
  mimeType: string;
  size: number;
  createdAt: string;
  /** Blob stays local until the cloud-media stage is implemented. */
  blob?: Blob;
  remoteKey?: string;
  uploadState: 'local' | 'queued' | 'uploading' | 'synced' | 'failed';
};

export type Outing = {
  id: string;
  title: string;
  category: Cat;
  date: string;
  time?: string;
  place: string;
  coordinates?: { lat: number; lng: number };
  participants: string[];
  weather?: string;
  timeline: TimelineEntry[];
  note: string;
  impressions?: string;
  conclusion?: string;
  coverMediaId?: string;
  mediaIds: string[];
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  /** Category-specific values; kept flexible while forms are being built. */
  details: Record<string, string | number | boolean | string[]>;
};

const DB = 'atlas-db';
const VERSION = 5;
const OUTINGS = 'outings';
const MEDIA = 'media';
const SETTINGS = 'settings';
const JOURNAL = 'journal';
const PLACES = 'savedPlaces';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(OUTINGS)) {
        database.createObjectStore(OUTINGS, { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains(MEDIA)) {
        const media = database.createObjectStore(MEDIA, { keyPath: 'id' });
        media.createIndex('outingId', 'outingId', { unique: false });
      }
      if (!database.objectStoreNames.contains(SETTINGS)) {
        database.createObjectStore(SETTINGS, { keyPath: 'key' });
      }
      if (!database.objectStoreNames.contains(JOURNAL)) {
        database.createObjectStore(JOURNAL, { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains(PLACES)) {
        database.createObjectStore(PLACES, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Закрой другие вкладки приложения и повтори попытку.'));
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error ?? new Error('Операция отменена.'));
  });
}

/** Adds defaults to records created by MVP 0.1 without discarding their existing fields. */
function normalizeOuting(value: Partial<Outing> & Pick<Outing, 'id' | 'title' | 'category' | 'date' | 'place' | 'note'>): Outing {
  const now = new Date().toISOString();
  return {
    ...value,
    participants: value.participants ?? [],
    timeline: value.timeline ?? [],
    mediaIds: value.mediaIds ?? [],
    favorite: value.favorite ?? false,
    createdAt: value.createdAt ?? now,
    updatedAt: value.updatedAt ?? now,
    details: value.details ?? {},
  };
}

export async function all(includeDeleted = false): Promise<Outing[]> {
  const database = await openDb();
  const tx = database.transaction(OUTINGS, 'readonly');
  const rows = await requestResult(tx.objectStore(OUTINGS).getAll()) as Outing[];
  await transactionDone(tx);
  database.close();
  return rows
    .map(row => normalizeOuting(row))
    .filter(row => includeDeleted || !row.deletedAt)
    .sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt));
}

export async function getOuting(id: string): Promise<Outing | undefined> {
  const database = await openDb();
  const tx = database.transaction(OUTINGS, 'readonly');
  const row = await requestResult(tx.objectStore(OUTINGS).get(id)) as Outing | undefined;
  await transactionDone(tx);
  database.close();
  return row ? normalizeOuting(row) : undefined;
}

export async function put(value: Outing | (Pick<Outing, 'id' | 'title' | 'category' | 'date' | 'place' | 'note'> & Partial<Outing>)): Promise<void> {
  const database = await openDb();
  const tx = database.transaction(OUTINGS, 'readwrite');
  const store = tx.objectStore(OUTINGS);
  const done = transactionDone(tx);
  const request = store.get(value.id);
  request.onsuccess = () => {
    const previous = request.result as Outing | undefined;
    const now = new Date().toISOString();
    const row = normalizeOuting({
      ...previous,
      ...value,
      createdAt: previous?.createdAt ?? value.createdAt ?? now,
      updatedAt: now,
    } as Outing);
    store.put(row);
  };
  request.onerror = () => {
    try { tx.abort(); } catch { /* transaction already finished */ }
  };
  try {
    await done;
  } finally {
    database.close();
  }
}

export async function softDelete(id: string): Promise<void> {
  const row = await getOuting(id);
  if (!row) return;
  row.deletedAt = new Date().toISOString();
  await put(row);
}

export async function restore(id: string): Promise<void> {
  const row = await getOuting(id);
  if (!row) return;
  delete row.deletedAt;
  await put(row);
}

export async function purgeExpiredTrash(now = Date.now()): Promise<number> {
  const rows = await all(true);
  const expiredIds = rows
    .filter(row => row.deletedAt && Number.isFinite(Date.parse(row.deletedAt)) && now - Date.parse(row.deletedAt) >= 30 * 24 * 60 * 60 * 1000)
    .map(row => row.id);
  if (!expiredIds.length) return 0;

  const expiredSet = new Set(expiredIds);
  const database = await openDb();
  try {
    const tx = database.transaction([OUTINGS, MEDIA], 'readwrite');
    const done = transactionDone(tx);
    const outingStore = tx.objectStore(OUTINGS);
    const mediaStore = tx.objectStore(MEDIA);

    expiredIds.forEach(id => outingStore.delete(id));
    const mediaCursor = mediaStore.openCursor();
    mediaCursor.onsuccess = () => {
      const cursor = mediaCursor.result;
      if (!cursor) return;
      const item = cursor.value as MediaItem;
      if (expiredSet.has(item.outingId)) cursor.delete();
      cursor.continue();
    };
    mediaCursor.onerror = () => {
      try { tx.abort(); } catch { /* transaction already finished */ }
    };

    await done;
    return expiredIds.length;
  } finally {
    database.close();
  }
}

export async function del(id: string): Promise<void> {
  // Compatibility alias: deletion now moves the outing to the 30-day trash.
  await softDelete(id);
}

export async function saveMedia(item: MediaItem): Promise<void> {
  const database = await openDb();
  const tx = database.transaction(MEDIA, 'readwrite');
  tx.objectStore(MEDIA).put(item);
  await transactionDone(tx);
  database.close();
}

export async function deleteMedia(id: string): Promise<void> {
  const database = await openDb();
  const tx = database.transaction(MEDIA, 'readwrite');
  tx.objectStore(MEDIA).delete(id);
  await transactionDone(tx);
  database.close();
}

export async function getMediaForOuting(outingId: string): Promise<MediaItem[]> {
  const database = await openDb();
  const tx = database.transaction(MEDIA, 'readonly');
  const rows = await requestResult(tx.objectStore(MEDIA).index('outingId').getAll(outingId)) as MediaItem[];
  await transactionDone(tx);
  database.close();
  return rows;
}


export async function allJournal(): Promise<JournalEntry[]> {
  const database = await openDb();
  const tx = database.transaction(JOURNAL, 'readonly');
  const rows = await requestResult(tx.objectStore(JOURNAL).getAll()) as JournalEntry[];
  await transactionDone(tx);
  database.close();
  return rows.sort((a,b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt));
}
export async function putJournal(value: JournalEntry): Promise<void> {
  const database = await openDb();
  const tx = database.transaction(JOURNAL, 'readwrite');
  tx.objectStore(JOURNAL).put(value);
  await transactionDone(tx);
  database.close();
}
export async function deleteJournal(id: string): Promise<void> {
  const database = await openDb();
  const tx = database.transaction(JOURNAL, 'readwrite');
  tx.objectStore(JOURNAL).delete(id);
  await transactionDone(tx);
}


export async function allSavedPlaces(): Promise<SavedPlace[]> {
  const database = await openDb();
  const tx = database.transaction(PLACES, 'readonly');
  const rows = await requestResult(tx.objectStore(PLACES).getAll()) as SavedPlace[];
  await transactionDone(tx);
  database.close();
  return rows.sort((a,b) => a.title.localeCompare(b.title, 'ru'));
}
export async function putSavedPlace(value: SavedPlace): Promise<void> {
  const database = await openDb();
  const tx = database.transaction(PLACES, 'readwrite');
  tx.objectStore(PLACES).put(value);
  await transactionDone(tx);
  database.close();
}
export async function deleteSavedPlace(id: string): Promise<void> {
  const database = await openDb();
  const tx = database.transaction(PLACES, 'readwrite');
  tx.objectStore(PLACES).delete(id);
  await transactionDone(tx);
  database.close();
}


export type StorageSummary = { photoCount: number; videoCount: number; journalPhotoCount: number; mediaBytes: number; journalPhotoBytes: number; outingCount: number; deletedOutingCount: number; journalCount: number; savedPlaceCount: number };

/** Reads local media metadata and Blob sizes without changing or deleting user data. */
export async function getStorageSummary(): Promise<StorageSummary> {
  const database = await openDb();
  try {
    const tx = database.transaction([OUTINGS, MEDIA, JOURNAL, PLACES], 'readonly');
    const [outings, media, journal, places] = await Promise.all([
      requestResult(tx.objectStore(OUTINGS).getAll()) as Promise<Outing[]>,
      requestResult(tx.objectStore(MEDIA).getAll()) as Promise<MediaItem[]>,
      requestResult(tx.objectStore(JOURNAL).getAll()) as Promise<JournalEntry[]>,
      requestResult(tx.objectStore(PLACES).count()),
    ]);
    await transactionDone(tx);
    const journalPhotos = journal.flatMap(entry => entry.photos || []);
    return {
      photoCount: media.filter(item => item.type === 'image').length,
      videoCount: media.filter(item => item.type === 'video').length,
      journalPhotoCount: journalPhotos.length,
      mediaBytes: media.reduce((sum, item) => sum + (item.blob?.size ?? item.size ?? 0), 0),
      journalPhotoBytes: journalPhotos.reduce((sum, photo) => sum + (photo.blob?.size ?? photo.size ?? 0), 0),
      outingCount: outings.filter(item => !item.deletedAt).length,
      deletedOutingCount: outings.filter(item => !!item.deletedAt).length,
      journalCount: journal.length,
      savedPlaceCount: places,
    };
  } finally { database.close(); }
}

/** Full portable backup: every IndexedDB store and every local Blob is included. */
const BACKUP_STORES = [OUTINGS, MEDIA, SETTINGS, JOURNAL, PLACES] as const;
const BACKUP_FORMAT = 'atlas-adventures-backup';
const BACKUP_VERSION = 2;

async function sha256Hex(value: string): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error('Проверка целостности недоступна в этом браузере. Открой Атлас через защищённое соединение.');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

async function encodeBackupValue(value: any): Promise<any> {
  if (value instanceof Blob) {
    const bytes = new Uint8Array(await value.arrayBuffer());
    let binary = '';
    const chunk = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunk) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + chunk));
    }
    return { __atlasBlob: true, mimeType: value.type, data: btoa(binary) };
  }
  if (Array.isArray(value)) return Promise.all(value.map(encodeBackupValue));
  if (value && typeof value === 'object') {
    const result: Record<string, any> = {};
    for (const [key, item] of Object.entries(value)) result[key] = await encodeBackupValue(item);
    return result;
  }
  return value;
}

function decodeBackupValue(value: any): any {
  if (value && typeof value === 'object' && value.__atlasBlob === true && typeof value.data === 'string') {
    const binary = atob(value.data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: String(value.mimeType || 'application/octet-stream') });
  }
  if (Array.isArray(value)) return value.map(decodeBackupValue);
  if (value && typeof value === 'object') {
    const result: Record<string, any> = {};
    for (const [key, item] of Object.entries(value)) result[key] = decodeBackupValue(item);
    return result;
  }
  return value;
}

export async function createFullBackup(): Promise<Blob> {
  const database = await openDb();
  try {
    const tx = database.transaction([...BACKUP_STORES], 'readonly');
    const done = transactionDone(tx);
    const snapshots = await Promise.all(BACKUP_STORES.map(async name => {
      const rows = await requestResult(tx.objectStore(name).getAll());
      return [name, await encodeBackupValue(rows)] as const;
    }));
    await done;
    const payload = {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      databaseVersion: VERSION,
      createdAt: new Date().toISOString(),
      stores: Object.fromEntries(snapshots),
    };
    const canonical = JSON.stringify(payload);
    const checksum = await sha256Hex(canonical);
    return new Blob([JSON.stringify({ ...payload, checksum })], { type: 'application/json' });
  } finally {
    database.close();
  }
}

export async function restoreFullBackup(file: File): Promise<{ createdAt: string; counts: Record<string, number> }> {
  const parsed = JSON.parse(await file.text());
  if (!parsed || parsed.format !== BACKUP_FORMAT || ![1, BACKUP_VERSION].includes(parsed.version) || !parsed.stores) {
    throw new Error('Файл не распознан как резервная копия Атласа приключений.');
  }
  if (parsed.version >= 2) {
    const { checksum, ...payload } = parsed;
    if (typeof checksum !== 'string' || await sha256Hex(JSON.stringify(payload)) !== checksum) {
      throw new Error('Проверка целостности не пройдена. Файл повреждён или был изменён; данные не восстановлены.');
    }
  }
  for (const name of BACKUP_STORES) {
    if (!Array.isArray(parsed.stores[name])) throw new Error('В резервной копии отсутствуют данные раздела: ' + name);
  }
  const restored = Object.fromEntries(BACKUP_STORES.map(name => [name, parsed.stores[name].map(decodeBackupValue)]));
  const database = await openDb();
  try {
    const tx = database.transaction([...BACKUP_STORES], 'readwrite');
    for (const name of BACKUP_STORES) {
      const store = tx.objectStore(name);
      store.clear();
      for (const row of restored[name]) store.put(row);
    }
    await transactionDone(tx);
    return {
      createdAt: String(parsed.createdAt || ''),
      counts: Object.fromEntries(BACKUP_STORES.map(name => [name, restored[name].length])),
    };
  } finally {
    database.close();
  }
}
