import { describe, expect, it, vi } from "vitest";
import { ResultCommit } from "../src/platform/result-commit";
import { createGame, restoreGame, serializeGame } from "../src/sim";
import {
  createProfile,
  migrateProfile,
  recordBattleResult,
} from "../src/ui/progression/profile";
import { SaveQueue } from "../src/platform/save-queue";

const context = {
  matchId: "battle:recovery-fixture",
  endedAt: "2026-10-04T23:00:00Z",
  campaignId: "rise-of-the-frontier",
  missionId: "outpost",
  unlocks: ["banner-founder"],
};
function fixture() {
  const state = createGame({
    seed: "RESULT-COMMIT-RECOVERY",
    mapSize: "small",
  });
  state.winner = 0;
  state.time = 123;
  const result = recordBattleResult(createProfile(), state, context);
  const snapshot = {
    battle: {
      version: 2,
      game: serializeGame(state),
      matchId: context.matchId,
    },
    profile: result.profile,
    expedition: {
      version: 1,
      run: { journal: [{ nodeId: "foothold", victory: true }] },
    },
  };
  const records = new Map<string, unknown>();
  let profile: unknown = null;
  const storage = {
    saveRecord: vi.fn(async (key: string, value: unknown) => {
      records.set(key, structuredClone(value));
    }),
    writeLocal: vi.fn((_key: string, value: unknown) => {
      profile = structuredClone(value);
      return true;
    }),
    removeRecord: vi.fn(async (key: string) => {
      records.delete(key);
    }),
  };
  return { snapshot, records, storage, profile: () => migrateProfile(profile) };
}

describe("durable result commits", () => {
  it("preserves the finished battle when the profile write fails, then retries once", async () => {
    const f = fixture();
    f.storage.writeLocal.mockReturnValueOnce(false);
    const commit = new ResultCommit(f.snapshot, f.storage);
    await expect(commit.commit()).rejects.toThrow("command record");
    expect(commit.recoverable).toBe(true);
    expect(f.records.get("battle")).toEqual(f.snapshot.battle);
    expect(f.profile().games).toBe(0);
    expect(f.storage.removeRecord).not.toHaveBeenCalled();
    expect(f.records.has("expedition")).toBe(false);
    await commit.commit();
    await commit.commit();
    expect(f.storage.saveRecord.mock.calls.map(([key]) => key)).toEqual([
      "battle",
      "expedition",
    ]);
    expect(f.storage.writeLocal).toHaveBeenCalledTimes(2);
    expect(f.profile().games).toBe(1);
    expect(f.profile().completedMissions[context.campaignId]).toEqual([
      "outpost",
    ]);
    expect(f.profile().choices).toContain("banner-founder");
    expect(f.records.has("battle")).toBe(false);
  });
  it("a reload replays an unrecorded finished checkpoint without losing rewards", async () => {
    const f = fixture();
    f.storage.writeLocal.mockReturnValueOnce(false);
    await expect(
      new ResultCommit(f.snapshot, f.storage).commit(),
    ).rejects.toThrow();
    const recovered = f.records.get("battle") as typeof f.snapshot.battle;
    const result = recordBattleResult(
      f.profile(),
      restoreGame(recovered.game),
      { ...context, matchId: recovered.matchId },
    );
    await new ResultCommit(
      { ...f.snapshot, profile: result.profile },
      f.storage,
    ).commit();
    expect(f.profile().games).toBe(1);
    expect(f.profile().wins).toBe(1);
    expect(f.profile().recordedMatchIds).toEqual([context.matchId]);
    expect(f.profile().choices).toContain("banner-founder");
  });
  it("replaying after a durable profile but failed route does not award twice", async () => {
    const f = fixture();
    const save = f.storage.saveRecord.getMockImplementation()!;
    f.storage.saveRecord.mockImplementation(async (key, value) => {
      if (key === "expedition") throw new Error("Route quota");
      return save(key, value);
    });
    await expect(
      new ResultCommit(f.snapshot, f.storage).commit(),
    ).rejects.toThrow("Route quota");
    expect(f.profile().games).toBe(1);
    expect(f.records.has("battle")).toBe(true);
    const recovered = f.records.get("battle") as typeof f.snapshot.battle;
    const result = recordBattleResult(
      f.profile(),
      restoreGame(recovered.game),
      context,
    );
    expect(result.recorded).toBe(false);
    expect(result.earned).toEqual([]);
    f.storage.saveRecord.mockImplementation(save);
    await new ResultCommit(
      { ...f.snapshot, profile: result.profile },
      f.storage,
    ).commit();
    expect(f.profile().games).toBe(1);
    expect(f.profile().wins).toBe(1);
    expect(f.profile().history).toHaveLength(1);
  });
  it("retries only unfinished stages when cleanup fails", async () => {
    const f = fixture();
    f.storage.removeRecord.mockRejectedValueOnce(new Error("Cleanup quota"));
    const commit = new ResultCommit(f.snapshot, f.storage);
    await expect(commit.commit()).rejects.toThrow("Cleanup quota");
    await commit.commit();
    expect(f.storage.saveRecord).toHaveBeenCalledTimes(2);
    expect(f.storage.writeLocal).toHaveBeenCalledOnce();
    expect(f.storage.removeRecord).toHaveBeenCalledTimes(2);
    expect(f.profile().games).toBe(1);
  });
  it("does not publish a profile if neither backend can preserve the finished checkpoint", async () => {
    const f = fixture();
    f.storage.saveRecord.mockRejectedValueOnce(
      new Error("Both backends failed"),
    );
    const commit = new ResultCommit(f.snapshot, f.storage);
    await expect(commit.commit()).rejects.toThrow("Both backends failed");
    expect(commit.recoverable).toBe(false);
    expect(f.storage.writeLocal).not.toHaveBeenCalled();
    expect(f.storage.removeRecord).not.toHaveBeenCalled();
  });
  it("coalesces repeated saves, captures snapshots, and waits for completion before restart", async () => {
    const f = fixture();
    const save = f.storage.saveRecord.getMockImplementation()!;
    let release!: () => void;
    const delayed = new Promise<void>((resolve) => {
      release = resolve;
    });
    f.storage.saveRecord.mockImplementation(async (key, value) => {
      if (key === "battle") await delayed;
      return save(key, value);
    });
    const commit = new ResultCommit(f.snapshot, f.storage);
    const queued = new SaveQueue();
    const saving = queued.run(() => commit.commit());
    const restart = vi.fn();
    const beforeRestart = saving.then(restart);
    await Promise.resolve();
    const sameCommit = commit.commit();
    f.snapshot.profile.games = 99;
    expect(restart).not.toHaveBeenCalled();
    release();
    await Promise.all([saving, sameCommit, beforeRestart]);
    expect(f.profile().games).toBe(1);
    expect(f.storage.writeLocal).toHaveBeenCalledOnce();
    expect(f.storage.removeRecord).toHaveBeenCalledOnce();
    expect(restart).toHaveBeenCalledOnce();
  });
});
