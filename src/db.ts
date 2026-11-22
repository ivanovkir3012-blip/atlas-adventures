export type Cat = 'Охота' | 'Рыбалка' | 'Кемпинг' | 'Путешествия';

export type TimelineEntry = {
  id: string;
  time?: string;
  title: string;
  description?: string;
};

export type SavedPlace = { id: string; title: string; type: 'Избранное место' | 'Стоянка' | 'Рыбалка' | 'Наблюдение' | 'Другое'; category: Cat; lat: number; lng: number; description: string; createdAt: string; updatedAt: string };

export type FuturePlace = {
  id: string;
  title: string;
  country?: string;
  region?: string;
  category: Cat;
  lat: number;
  lng: number;
  description: string;
  priority: 'Низкий' | 'Средний' | 'Высокий';
  note?: string;
  linkedSavedPlaceId?: string;
  linkedOutingId?: string;
  createdAt: string;
  updatedAt: string;
};

export type RouteWaypoint = {
  id: string;
  title: string;
  lat: number;
  lng: number;
  kind: 'start' | 'stop' | 'finish';
  note?: string;
};

export type AdventureRoute = {
  id: string;
  title: string;
  coverMediaId?: string;
  date: string;
  description: string;
  category: Cat;
  linkedOutingId?: string;
  waypoints: RouteWaypoint[];
  /** Ordered [longitude, latitude] pairs; geometry is stored, never inferred as a straight line. */
  geometry: [number, number][];
  distanceKm?: number;
  notes: string;
  photoMediaIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type JournalPhoto = { id: string; name: string; mimeType: string; size: number; blob: Blob };
export type JournalEntry = { id: string; title: string; type: 'Наблюдения' | 'Заметки' | 'События'; date: string; place: string; description: string; photos: JournalPhoto[]; createdAt: string; updatedAt: string };

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
const FUTURE_PLACES = 'futurePlaces';
const ROUTES = 'routes';

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
      if (!database.objectStoreNames.contains(FUTURE_PLACES)) {
        database.createObjectStore(FUTURE_PLACES, { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains(ROUTES)) {
        database.createObjectStore(ROUTES, { keyPath: 'id' });
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


/** Future destinations are stored separately from visited places and outings. */
export async function allFuturePlaces(): Promise<FuturePlace[]> {
  const database = await openDb();
  const tx = database.transaction(FUTURE_PLACES, 'readonly');
  const rows = await requestResult(tx.objectStore(FUTURE_PLACES).getAll()) as FuturePlace[];
  await transactionDone(tx);
  database.close();
  return rows.sort((a,b) => b.priority.localeCompare(a.priority, 'ru') || a.title.localeCompare(b.title, 'ru'));
}

export async function putFuturePlace(value: FuturePlace): Promise<void> {
  const database = await openDb();
  const tx = database.transaction(FUTURE_PLACES, 'readwrite');
  tx.objectStore(FUTURE_PLACES).put(value);
  await transactionDone(tx);
  database.close();
}

export async function deleteFuturePlace(id: string): Promise<void> {
  const database = await openDb();
  const tx = database.transaction(FUTURE_PLACES, 'readwrite');
  tx.objectStore(FUTURE_PLACES).delete(id);
  await transactionDone(tx);
  database.close();
}

/** Routes keep ordered stops and an explicit saved path geometry. */
export async function allRoutes(): Promise<AdventureRoute[]> {
  const database = await openDb();
  const tx = database.transaction(ROUTES, 'readonly');
  const rows = await requestResult(tx.objectStore(ROUTES).getAll()) as AdventureRoute[];
  await transactionDone(tx);
  database.close();
  return rows.sort((a,b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt));
}

export async function putRoute(value: AdventureRoute): Promise<void> {
  const database = await openDb();
  const tx = database.transaction(ROUTES, 'readwrite');
  tx.objectStore(ROUTES).put(value);
  await transactionDone(tx);
  database.close();
}

export async function deleteRoute(id: string): Promise<void> {
  const database = await openDb();
  const tx = database.transaction(ROUTES, 'readwrite');
  tx.objectStore(ROUTES).delete(id);
  await transactionDone(tx);
}
