import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prefix = "frontier-command:rts-game:v1:";
function fixture() {
  const local = new Map<string, string>();
  const values = new Map<string, unknown>();
  let unavailable = false;
  let abort = false;
  let quota = false;
  const close = vi.fn();
  const store = {
    getItem: (key: string) => local.get(key) ?? null,
    setItem: vi.fn((key: string, value: string) => {
      if (quota) throw new Error("QuotaExceeded");
      local.set(key, value);
    }),
    removeItem: (key: string) => local.delete(key),
  };
  const db = {
    close,
    transaction: () => {
      const tx: any = { error: null };
      tx.objectStore = () => ({
        get: (key: string) => {
          const request: any = { result: structuredClone(values.get(key)) };
          queueMicrotask(() => request.onsuccess?.());
          return request;
        },
        put: (value: unknown, key: string) => {
          queueMicrotask(() => {
            if (abort) tx.onabort?.();
            else {
              values.set(key, structuredClone(value));
              tx.oncomplete?.();
            }
          });
        },
      });
      return tx;
    },
  };
  const indexedDB = {
    open: () => {
      if (unavailable) throw new Error("Unavailable");
      const request: any = { result: db };
      queueMicrotask(() => request.onsuccess?.());
      return request;
    },
  };
  vi.stubGlobal("localStorage", store);
  vi.stubGlobal("indexedDB", indexedDB);
  return {
    local,
    values,
    store,
    close,
    unavailable: (value: boolean) => {
      unavailable = value;
    },
    abort: (value: boolean) => {
      abort = value;
    },
    quota: (value: boolean) => {
      quota = value;
    },
  };
}
beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("record recovery across storage backends", () => {
  it("loads a newer fallback after a transient IndexedDB failure and a module reload", async () => {
    const f = fixture();
    f.values.set("battle", { version: 2, savedAt: 10, game: "old" });
    f.unavailable(true);
    const { saveRecord } = await import("../src/platform/storage");
    await saveRecord("battle", { version: 2, savedAt: 20, game: "new" });
    f.unavailable(false);
    vi.resetModules();
    const { loadRecord } = await import("../src/platform/storage");
    expect(await loadRecord("battle")).toEqual({
      version: 2,
      savedAt: 20,
      game: "new",
    });
  });
  it("orders legacy copies by valid savedAt, preserving their payload", async () => {
    const f = fixture();
    f.values.set("battle", { version: 2, savedAt: 10, game: "old" });
    f.local.set(
      prefix + "battle",
      JSON.stringify({ version: 2, savedAt: 20, game: "new" }),
    );
    const { loadRecord } = await import("../src/platform/storage");
    expect(await loadRecord("battle")).toEqual({
      version: 2,
      savedAt: 20,
      game: "new",
    });
  });
  it("orders un-timestamped expedition/workshop saves when time does not advance", async () => {
    const f = fixture();
    vi.spyOn(Date, "now").mockReturnValue(100);
    const { saveRecord, loadRecord } = await import("../src/platform/storage");
    await saveRecord("expedition", { version: 1, route: "old" });
    f.unavailable(true);
    await saveRecord("expedition", { version: 1, route: "fallback" });
    f.unavailable(false);
    expect(await loadRecord("expedition")).toEqual({
      version: 1,
      route: "fallback",
    });
    vi.resetModules();
    const reloaded = await import("../src/platform/storage");
    await reloaded.saveRecord("expedition", { version: 1, route: "recovered" });
    expect(await reloaded.loadRecord("expedition")).toEqual({
      version: 1,
      route: "recovered",
    });
  });
  it.each([
    "invalid-json",
    JSON.stringify({ __frontierRecord: 99, writtenAt: 9999, value: "bad" }),
    JSON.stringify({ __frontierRecord: 1, writtenAt: "9999", value: "bad" }),
    JSON.stringify({ __frontierRecord: 1, writtenAt: -1, value: "bad" }),
    JSON.stringify({ __frontierRecord: 1, writtenAt: 1.5, value: "bad" }),
    JSON.stringify({
      __frontierRecord: 1,
      writtenAt: Number.MAX_SAFE_INTEGER,
      value: "bad",
    }),
    JSON.stringify({ __frontierRecord: 1, writtenAt: 9999 }),
    JSON.stringify({ version: "2", savedAt: 9999, game: "bad" }),
    JSON.stringify({ version: 2, savedAt: "9999", game: "bad" }),
    '{"__frontierRecord":1,"writtenAt":9999,"value":{"__proto__":{}}}',
  ])(
    "ignores malformed fallback metadata without deleting the evidence (%s)",
    async (invalid) => {
      const f = fixture();
      f.values.set("battle", { version: 2, savedAt: 10, game: "safe" });
      f.local.set(prefix + "battle", invalid);
      const { loadRecord } = await import("../src/platform/storage");
      expect(await loadRecord("battle")).toEqual({
        version: 2,
        savedAt: 10,
        game: "safe",
      });
      expect(f.local.get(prefix + "battle")).toBe(invalid);
    },
  );
  it("recovers from an abort-only write and closes the database", async () => {
    const f = fixture();
    f.abort(true);
    const { saveRecord, loadRecord } = await import("../src/platform/storage");
    await saveRecord("battle", { value: "recovered" });
    expect(f.close).toHaveBeenCalledOnce();
    expect(await loadRecord("battle")).toEqual({ value: "recovered" });
  });
  it("reports abort plus quota failure and allows the next save to succeed", async () => {
    const f = fixture();
    f.abort(true);
    f.quota(true);
    const { saveRecord, loadRecord } = await import("../src/platform/storage");
    await expect(saveRecord("battle", { value: "failed" })).rejects.toThrow(
      "QuotaExceeded",
    );
    f.abort(false);
    await saveRecord("battle", { value: "saved" });
    expect(await loadRecord("battle")).toEqual({ value: "saved" });
  });
  it("retains immutable snapshots and serializes overlapping requests", async () => {
    fixture();
    const { saveRecord, loadRecord } = await import("../src/platform/storage");
    const mutable = { value: "first" };
    const first = saveRecord("battle", mutable);
    mutable.value = "mutated";
    const second = saveRecord("battle", { value: "second" });
    await Promise.all([first, second]);
    expect(await loadRecord("battle")).toEqual({ value: "second" });
  });
  it("does not resurrect an old IndexedDB record after fallback deletion", async () => {
    const f = fixture();
    const { saveRecord, loadRecord, removeRecord } = await import(
      "../src/platform/storage"
    );
    await saveRecord("battle", { value: "old" });
    f.unavailable(true);
    await removeRecord("battle");
    f.unavailable(false);
    expect(await loadRecord("battle")).toBeNull();
    await saveRecord("battle", { value: "new" });
    expect(await loadRecord("battle")).toEqual({ value: "new" });
  });
  it("discards a known stale fallback after primary recovery, including deletion", async () => {
    const f = fixture();
    const { saveRecord, loadRecord, removeRecord } = await import(
      "../src/platform/storage"
    );
    f.unavailable(true);
    await saveRecord("battle", { value: "old fallback" });
    f.unavailable(false);
    await saveRecord("battle", { value: "new primary" });
    expect(f.local.has(prefix + "battle")).toBe(false);
    f.unavailable(true);
    expect(await loadRecord("battle")).toBeNull();
    await saveRecord("battle", { value: "latest fallback" });
    f.unavailable(false);
    await removeRecord("battle");
    f.unavailable(true);
    expect(await loadRecord("battle")).toBeNull();
  });
  it("reports failed deletion and leaves both old copies recoverable", async () => {
    const f = fixture();
    const { saveRecord, loadRecord, removeRecord, writeLocal } = await import(
      "../src/platform/storage"
    );
    await saveRecord("battle", { value: "old" });
    f.unavailable(true);
    f.quota(true);
    expect(writeLocal("profile", { wins: 1 })).toBe(false);
    await expect(removeRecord("battle")).rejects.toThrow("QuotaExceeded");
    f.unavailable(false);
    expect(await loadRecord("battle")).toEqual({ value: "old" });
  });
});
