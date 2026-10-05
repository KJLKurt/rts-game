import { describe, expect, it } from "vitest";
import { BattleSuspension } from "../src/platform/battle-suspension";
import { createGame, issueCommand } from "../src/sim";
import type { GameSettings } from "../src/sim/types";

function battle(difficulty: GameSettings["difficulty"] = "normal") {
  return createGame({
    seed: "INTERRUPTION-REGRESSION",
    mapSize: "small",
    difficulty,
  });
}

for (const difficulty of ["easy", "normal", "hard", "brutal"] as const) {
  describe(`${difficulty} app interruptions`, () => {
    it("freezes independently of tactical pause and requires explicit resume", () => {
      const state = battle(difficulty);
      const lifecycle = new BattleSuspension();
      // Also cover the exhausted Hard allowance, where tactical pause is rejected.
      if (difficulty === "hard") state.players[0].stats.pauses = 3;
      const pauses = state.players[0].stats.pauses;
      lifecycle.step(state, 0.1, false);
      const time = state.time;
      expect(time).toBeGreaterThan(0);
      expect(lifecycle.suspend(state)).toBe(true);
      expect(lifecycle.suspend(state)).toBe(false);
      for (let i = 0; i < 15; i++) lifecycle.step(state, 0.1, false);
      expect(state.time).toBe(time);
      expect(state.paused).toBe(false);
      expect(state.players[0].stats.pauses).toBe(pauses);
      expect(lifecycle.resume(true)).toBe(false);
      lifecycle.step(state, 0.1, false);
      expect(state.time).toBe(time);
      expect(lifecycle.resume(false)).toBe(true);
      lifecycle.step(state, 0.1, false);
      expect(state.time).toBeGreaterThan(time);
      expect(state.players[0].stats.pauses).toBe(pauses);
    });

    it("clears direct steering immediately without moving on recovery", () => {
      const state = battle(difficulty);
      const lifecycle = new BattleSuspension();
      const hero = state.entities.find(
        (e) => e.team === 0 && e.kind === "commander",
      )!;
      expect(
        issueCommand(state, { type: "steer", team: 0, dx: 1, dy: 0 }).ok,
      ).toBe(true);
      expect(hero.directControl).toBeDefined();
      const position = { x: hero.x, y: hero.y };
      lifecycle.suspend(state);
      expect(hero.directControl).toBeUndefined();
      expect(hero.order.type).toBe("idle");
      lifecycle.resume(false);
      lifecycle.step(state, 0.1, false);
      expect({ x: hero.x, y: hero.y }).toEqual(position);
    });
  });
}

describe("interruption preserves player intent", () => {
  it("keeps tactical pause, queued orders, and allowance intact after recovery", () => {
    const state = battle("hard");
    const lifecycle = new BattleSuspension();
    const hero = state.entities.find(
      (e) => e.team === 0 && e.kind === "commander",
    )!;
    issueCommand(state, { type: "pause", team: 0, paused: true });
    issueCommand(state, { type: "hold", team: 0, entityIds: [hero.id] });
    const queue = structuredClone(state.pendingCommands);
    lifecycle.suspend(state);
    lifecycle.resume(false);
    lifecycle.step(state, 0.1, false);
    expect(state.time).toBe(0);
    expect(state.paused).toBe(true);
    expect(state.pendingCommands).toEqual(queue);
    expect(state.players[0].stats.pauses).toBe(1);
  });

  it("does not cancel ordinary army movement or queue a zero steering command", () => {
    const state = battle();
    const lifecycle = new BattleSuspension();
    const hero = state.entities.find(
      (e) => e.team === 0 && e.kind === "commander",
    )!;
    issueCommand(state, {
      type: "move",
      team: 0,
      entityIds: [hero.id],
      x: hero.x + 2,
      y: hero.y,
    });
    const order = structuredClone(hero.order);
    const log = state.commandLog.length;
    lifecycle.suspend(state);
    expect(hero.order).toEqual(order);
    expect(state.commandLog).toHaveLength(log);
    expect(state.pendingCommands).toEqual([]);
  });

  it("also respects a hidden document or open dialog outside interruption", () => {
    const state = battle("brutal");
    const lifecycle = new BattleSuspension();
    lifecycle.step(state, 0.1, true);
    expect(state.time).toBe(0);
    lifecycle.step(state, 0.1, false);
    expect(state.time).toBeGreaterThan(0);
    lifecycle.suspend(state);
    lifecycle.reset();
    expect(lifecycle.suspended).toBe(false);
  });
});
