// 端末内だけの保存（IndexedDB）。通信はしない。
// 学習記録・施設プロフィール・自施設メモをここに置き、JSONで書き出し・読み込みできる。

import type { DayLog, DrillLog, FacilityProfile, LearningState, Lookup, Mark, Snapshot, Trouble } from '../types';

const DB_NAME = 'rinsho-app';
const DB_VERSION = 2;

export const STORES = ['profiles', 'settings', 'learning', 'lookups', 'drillLogs', 'days', 'snapshots', 'marks', 'troubles'] as const;
export type StoreName = (typeof STORES)[number];

let dbp: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      // 版を上げたときは、ない入れ物だけを足す（いまの記録は残す）
      const make = (name: StoreName, opts?: IDBObjectStoreParameters) => {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, opts);
      };
      make('profiles', { keyPath: 'id' });
      make('settings');
      make('learning', { keyPath: 'cardId' });
      make('lookups', { keyPath: 'id', autoIncrement: true });
      make('drillLogs', { keyPath: 'id', autoIncrement: true });
      make('days', { keyPath: 'date' });
      make('snapshots', { keyPath: 'date' });
      make('marks', { keyPath: 'id', autoIncrement: true });
      make('troubles', { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

function wrap<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(store: StoreName, mode: IDBTransactionMode): Promise<IDBObjectStore> {
  const db = await open();
  return db.transaction(store, mode).objectStore(store);
}

export async function getAll<T>(store: StoreName): Promise<T[]> {
  return wrap((await tx(store, 'readonly')).getAll() as IDBRequest<T[]>);
}
export async function get<T>(store: StoreName, key: IDBValidKey): Promise<T | undefined> {
  return wrap((await tx(store, 'readonly')).get(key) as IDBRequest<T | undefined>);
}
export async function put(store: StoreName, value: unknown, key?: IDBValidKey): Promise<IDBValidKey> {
  return wrap((await tx(store, 'readwrite')).put(value, key));
}
export async function del(store: StoreName, key: IDBValidKey): Promise<void> {
  await wrap((await tx(store, 'readwrite')).delete(key));
}

// ---- 設定 ----
export type SettingKey = 'activeProfileId' | 'lastExportAt' | 'firstUseAt' | 'persisted';
export const getSetting = <T>(k: SettingKey) => get<T>('settings', k);
export const setSetting = (k: SettingKey, v: unknown) => put('settings', v, k);

// ---- 型つきの入口 ----
export const listProfiles = () => getAll<FacilityProfile>('profiles');
export const saveProfile = (p: FacilityProfile) => put('profiles', p);
export const deleteProfile = (id: string) => del('profiles', id);

export async function listLearning(): Promise<Map<string, LearningState>> {
  const all = await getAll<LearningState>('learning');
  return new Map(all.map((s) => [s.cardId, s]));
}
export const saveLearning = (s: LearningState) => put('learning', s);

export const listLookups = () => getAll<Lookup>('lookups');

/** 現場で開いた記録。同じカードを10分以内に開き直した分は重ねない（再読み込みなど）。 */
export async function addLookup(l: Lookup): Promise<void> {
  const all = await listLookups();
  const dup = all.some((x) => x.cardId === l.cardId && x.mode === l.mode && Math.abs(l.at - x.at) < 10 * 60 * 1000);
  if (!dup) await put('lookups', l);
}

export const addDrillLog = (d: DrillLog) => put('drillLogs', d);
export const listDays = () => getAll<DayLog>('days');
export async function recordDayIfFirst(d: DayLog): Promise<void> {
  const existing = await get<DayLog>('days', d.date);
  if (!existing) await put('days', d);
}
export const listMarks = () => getAll<Mark>('marks');
export async function addMarks(ms: Mark[]): Promise<void> {
  for (const m of ms) await put('marks', m);
}
export const listTroubles = () => getAll<Trouble>('troubles');
export const addTrouble = async (t: Trouble): Promise<number> => (await put('troubles', t)) as number;
export const deleteTrouble = (id: number) => del('troubles', id);
export const listSnapshots = () => getAll<Snapshot>('snapshots');
export const saveSnapshot = (s: Snapshot) => put('snapshots', s);

// ---- 書き出し・読み込み（端末の引越し用） ----
export const EXPORT_FORMAT = 'rinsho-app-export';
export const EXPORT_VERSION = 1;

export interface ExportFile {
  format: typeof EXPORT_FORMAT;
  version: number;
  exportedAt: number;
  data: Record<StoreName, unknown[]>;
}

export async function exportAll(now: number): Promise<ExportFile> {
  const data = {} as Record<StoreName, unknown[]>;
  for (const s of STORES) {
    if (s === 'settings') {
      const store = await tx('settings', 'readonly');
      const keys = (await wrap(store.getAllKeys())) as IDBValidKey[];
      const vals = await getAll<unknown>('settings');
      data.settings = keys.map((k, i) => ({ key: k, value: vals[i] }));
    } else {
      data[s] = await getAll<unknown>(s);
    }
  }
  return { format: EXPORT_FORMAT, version: EXPORT_VERSION, exportedAt: now, data };
}

/** 読み込みは置き換え。読み込む前に今の中身は消える。 */
export async function importAll(file: unknown): Promise<void> {
  const f = file as ExportFile;
  if (!f || f.format !== EXPORT_FORMAT || typeof f.version !== 'number' || !f.data) {
    throw new Error('このアプリの書き出しファイルではありません');
  }
  if (f.version > EXPORT_VERSION) throw new Error('新しい版のアプリで書き出したファイルです');
  const db = await open();
  const t = db.transaction([...STORES], 'readwrite');
  for (const s of STORES) {
    const store = t.objectStore(s);
    store.clear();
    for (const row of f.data[s] ?? []) {
      if (s === 'settings') {
        const r = row as { key: IDBValidKey; value: unknown };
        store.put(r.value, r.key);
      } else {
        store.put(row);
      }
    }
  }
  await new Promise<void>((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}
