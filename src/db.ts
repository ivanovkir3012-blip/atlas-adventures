export type Cat = 'Охота' | 'Рыбалка' | 'Кемпинг' | 'Путешествия';

export type TimelineEntry = {
  id: string;
  time?: string;
  title: string;
  description?: string;
};

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
const VERSION = 2;
const OUTINGS = 'outings';
const MEDIA = 'media';
const SETTINGS = 'settings';

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
  const expired = rows.filter(row => row.deletedAt && now - Date.parse(row.deletedAt) >= 30 * 24 * 60 * 60 * 1000);
  if (!expired.length) return 0;
  const database = await openDb();
  const tx = database.transaction([OUTINGS, MEDIA], 'readwrite');
  for (const row of expired) {
    tx.objectStore(OUTINGS).delete(row.id);
    const mediaStore = tx.objectStore(MEDIA);
    const media = await requestResult(mediaStore.index('outingId').getAllKeys(row.id));
    media.forEach(key => mediaStore.delete(key));
  }
  await transactionDone(tx);
  database.close();
  return expired.length;
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
