import {
  createProfile,
  migrateProfile,
  type ProfileV2,
} from "../ui/progression/profile";
import { parseBoundedJSON, MAX_SAVE_JSON_BYTES } from "../sim/validation";
import { SaveQueue } from "./save-queue";
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
  learningComplete: boolean;
  uiScale: number;
}
export type Profile = ProfileV2;
export const defaultPreferences: Preferences = {
  master: 0.85,
  muted: false,
  music: 0.32,
  sfx: 0.65,
  reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
  showTips: true,
  tutorialSeen: false,
  learningComplete: false,
  uiScale: 1,
};
export const defaultProfile: Profile = createProfile();
/** Read raw profile data before migration so nullable and nested v2 fields survive. */
export function loadProfile(): Profile {
  try {
    return migrateProfile(
      parseBoundedJSON(
        localStorage.getItem(PREFIX + "profile") || "null",
        256 * 1024,
      ),
    );
  } catch {
    return migrateProfile(null);
  }
}
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
/** Preferences may ignore failure; progression must check before committing. */
export function writeLocal(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    let blocked = false;
    r.onupgradeneeded = () => r.result.createObjectStore("records");
    r.onsuccess = () => {
      if (blocked) r.result.close();
      else resolve(r.result);
    };
    r.onerror = () => reject(r.error);
    r.onblocked = () => {
      blocked = true;
      reject(new Error("Browser storage is blocked by another open page."));
    };
  });
}
interface StoredRecord {
  __frontierRecord: 1;
  writtenAt: number;
  value: unknown;
}
interface Candidate {
  writtenAt: number;
  value: unknown;
}
const queues = new Map<string, SaveQueue>();
let lastWrite = 0;
const validTimestamp = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isSafeInteger(value) &&
  value >= 0 &&
  value <= 8_640_000_000_000_000;

/** Read old unwrapped saves, but never interpret a malformed envelope as legacy. */
function candidate(text: string | null): Candidate | null {
  if (!text) return null;
  try {
    const value = parseBoundedJSON(text, MAX_SAVE_JSON_BYTES);
    if (value === null) return null;
    if (typeof value === "object" && !Array.isArray(value)) {
      const data = value as Record<string, unknown>;
      if (Object.hasOwn(data, "__frontierRecord")) {
        if (
          data.__frontierRecord !== 1 ||
          !validTimestamp(data.writtenAt) ||
          !Object.hasOwn(data, "value") ||
          Object.keys(data).some(
            (key) => !["__frontierRecord", "writtenAt", "value"].includes(key),
          )
        )
          return null;
        return { writtenAt: data.writtenAt, value: data.value };
      }
      if (Object.hasOwn(data, "savedAt") && !validTimestamp(data.savedAt))
        return null;
      if (
        Object.hasOwn(data, "version") &&
        !(
          typeof data.version === "number" &&
          Number.isSafeInteger(data.version) &&
          data.version > 0
        )
      )
        return null;
      return {
        writtenAt: validTimestamp(data.savedAt) ? data.savedAt : 0,
        value,
      };
    }
    return { writtenAt: 0, value };
  } catch {
    return null;
  }
}
function localCandidate(key: string): Candidate | null {
  try {
    return candidate(localStorage.getItem(PREFIX + key));
  } catch {
    return null;
  }
}
function nextRecord(
  value: unknown,
  ...previous: (Candidate | null)[]
): StoredRecord {
  const writtenAt = Math.max(
    Date.now(),
    lastWrite + 1,
    ...previous.map((record) => (record?.writtenAt ?? 0) + 1),
  );
  if (!validTimestamp(writtenAt))
    throw new Error("The saved record has an invalid timestamp.");
  lastWrite = writtenAt;
  return { __frontierRecord: 1, writtenAt, value };
}
async function commitRecord(key: string, value: unknown) {
  let db: IDBDatabase | undefined;
  let committedAt = 0;
  const local = localCandidate(key);
  try {
    db = await database();
    await new Promise<void>((resolve, reject) => {
      const tx = db!.transaction("records", "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () =>
        reject(tx.error ?? new Error("The save transaction was aborted."));
      const store = tx.objectStore("records");
      const read = store.get(key);
      read.onerror = () => reject(read.error);
      read.onsuccess = () => {
        try {
          const old = candidate(JSON.stringify(read.result) ?? null);
          const record = nextRecord(value, local, old);
          committedAt = record.writtenAt;
          store.put(record, key);
        } catch (error) {
          reject(error);
        }
      };
    });
    // Once the primary contains a newer commit, a known old fallback must not
    // become playable again merely because a later read loses IndexedDB access.
    const stale = localCandidate(key);
    if (stale && stale.writtenAt <= committedAt) {
      try {
        localStorage.removeItem(PREFIX + key);
      } catch {
        // Replacing a large fallback with a small tombstone may still fit when
        // its removal is blocked. Report failure if neither cleanup can work.
        if (value === null)
          localStorage.setItem(
            PREFIX + key,
            JSON.stringify({
              __frontierRecord: 1,
              writtenAt: committedAt,
              value: null,
            }),
          );
      }
    }
  } catch {
    // One atomic local write carries both the payload and its ordering metadata.
    localStorage.setItem(
      PREFIX + key,
      JSON.stringify(nextRecord(value, local)),
    );
  } finally {
    db?.close();
  }
}
export function saveRecord(key: string, value: unknown): Promise<void> {
  // Capture before queuing: callers may mutate their live state while a write waits.
  let snapshot: unknown;
  try {
    snapshot = parseBoundedJSON(
      JSON.stringify(value),
      MAX_SAVE_JSON_BYTES - 128,
    );
  } catch (error) {
    return Promise.reject(error);
  }
  let queue = queues.get(key);
  if (!queue) queues.set(key, (queue = new SaveQueue()));
  return queue.run(() => commitRecord(key, snapshot));
}
export async function loadRecord<T>(key: string): Promise<T | null> {
  let db: IDBDatabase | undefined;
  let stored: Candidate | null = null;
  try {
    db = await database();
    const data = await new Promise<T | undefined>((resolve, reject) => {
      const tx = db!.transaction("records");
      tx.onabort = () =>
        reject(tx.error ?? new Error("The read transaction was aborted."));
      tx.onerror = () => reject(tx.error);
      const r = tx.objectStore("records").get(key);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    stored = candidate(JSON.stringify(data) ?? null);
  } catch {
  } finally {
    db?.close();
  }
  const local = localCandidate(key);
  const newest =
    local && (!stored || local.writtenAt > stored.writtenAt) ? local : stored;
  return (newest?.value ?? null) as T | null;
}
export function removeRecord(key: string): Promise<void> {
  // A durable tombstone prevents an older unavailable backend from resurrecting
  // a removed battle. Failure is reported exactly like any other save.
  return saveRecord(key, null);
}
