import { describe, expect, it } from "vitest";
import { SaveQueue } from "../src/platform/save-queue";

describe("serialized battle snapshots", () => {
  it("writes a requested newer snapshot after an unfinished startup snapshot", async () => {
    const queue = new SaveQueue();
    let release!: () => void;
    const delayed = new Promise<void>((resolve) => {
      release = resolve;
    });
    const committed: number[] = [];
    const startup = queue.run(async () => {
      await delayed;
      committed.push(0);
    });
    let leftBattle = false;
    const saveAndLeave = queue
      .run(async () => {
        committed.push(0.3);
      })
      .then(() => {
        leftBattle = true;
      });
    await Promise.resolve();
    expect(leftBattle).toBe(false);
    expect(committed).toEqual([]);
    release();
    await startup;
    await saveAndLeave;
    expect(committed).toEqual([0, 0.3]);
    expect(leftBattle).toBe(true);
  });

  it("preserves distinct rapid requests and waits for all of them before a read", async () => {
    const queue = new SaveQueue(),
      written: number[] = [];
    for (const time of [0, 0.2, 0.4, 0.8])
      void queue.run(async () => {
        written.push(time);
      });
    await queue.idle();
    expect(written).toEqual([0, 0.2, 0.4, 0.8]);
  });

  it("reports a failed operation without preventing a later successful save", async () => {
    const queue = new SaveQueue();
    const failure = queue.run(async () => {
      throw new Error("quota");
    });
    const retry = queue.run(async () => "saved");
    await expect(failure).rejects.toThrow("quota");
    await expect(retry).resolves.toBe("saved");
    await queue.idle();
  });

  it("removes the completed battle before saving a quick rematch", async () => {
    const queue = new SaveQueue();
    let saved: string | null = null;
    const old = queue.run(async () => {
      saved = "old";
    });
    const remove = queue.run(async () => {
      saved = null;
    });
    const rematch = queue.run(async () => {
      saved = "new";
    });
    await Promise.all([old, remove, rematch]);
    expect(saved).toBe("new");
  });
});
