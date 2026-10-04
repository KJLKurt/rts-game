import { parseBoundedJSON, MAX_SAVE_JSON_BYTES } from "../sim/validation";
const PREFIX = "frontier-command:rts-game:v1:";
const DB = "frontier-command-rts-game";
export interface Preferences {
  master: number;
  muted: boolean;
  music: number;
  sfx: number;
  reducedMotion: boolean;
  showTips: boolean;
  tutorialSeen: boolean;
  uiScale: number;
}
export interface Profile {
  version: 1;
  games: number;
  wins: number;
  seconds: number;
  kills: number;
  bestStreak: number;
  streak: number;
  unlocked: string[];
  campaign: number;
  campaignProgress: Record<string, number>;
  expedition: number;
}
export const defaultPreferences: Preferences = {
  master: 0.85,
  muted: false,
  music: 0.32,
  sfx: 0.65,
  reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
  showTips: true,
  tutorialSeen: false,
  uiScale: 1,
};
export const defaultProfile: Profile = {
  version: 1,
  games: 0,
  wins: 0,
  seconds: 0,
  kills: 0,
  bestStreak: 0,
  streak: 0,
  unlocked: [],
  campaign: 0,
  campaignProgress: {},
  expedition: 0,
};
export function readLocal<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(PREFIX + key);
    const safe = structuredClone(fallback);
    if (!v) return safe;
    const parsed = parseBoundedJSON(v, 256 * 1024);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return safe;
    for (const [field, sample] of Object.entries(fallback as object)) {
      const value = (parsed as Record<string, unknown>)[field];
      const matches = Array.isArray(sample)
        ? Array.isArray(value)
        : sample !== null && typeof sample === "object"
          ? value !== null && typeof value === "object" && !Array.isArray(value)
          : typeof value === typeof sample &&
            (typeof value !== "number" || Number.isFinite(value));
      if (matches) (safe as Record<string, unknown>)[field] = value;
    }
    return safe;
  } catch {
    return structuredClone(fallback);
  }
}
export function writeLocal(key: string, value: unknown) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {}
}
async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore("records");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
export async function saveRecord(key: string, value: unknown) {
  let db: IDBDatabase | undefined;
  try {
    db = await database();
    await new Promise<void>((resolve, reject) => {
      const tx = db!.transaction("records", "readwrite");
      tx.objectStore("records").put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } finally {
    db?.close();
  }
}
export async function loadRecord<T>(key: string): Promise<T | null> {
  let db: IDBDatabase | undefined;
  try {
    db = await database();
    const data = await new Promise<T | undefined>((resolve, reject) => {
      const r = db!.transaction("records").objectStore("records").get(key);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    if (data !== undefined)
      return parseBoundedJSON(JSON.stringify(data), MAX_SAVE_JSON_BYTES) as T;
  } catch {
  } finally {
    db?.close();
  }
  try {
    return parseBoundedJSON(
      localStorage.getItem(PREFIX + key) || "null",
      MAX_SAVE_JSON_BYTES,
    ) as T;
  } catch {
    return null;
  }
}
export async function removeRecord(key: string) {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {}
  let db: IDBDatabase | undefined;
  try {
    db = await database();
    await new Promise<void>((resolve, reject) => {
      const tx = db!.transaction("records", "readwrite");
      tx.objectStore("records").delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch {
  } finally {
    db?.close();
  }
}
