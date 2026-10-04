import { describe, expect, it } from "vitest";
import { createGame, spawnEntity } from "../src/sim";
import {
  buildingUnderAttack,
  hasClaimedSupplies,
} from "../src/ui/battle-guidance";

describe("visible economy and base guidance", () => {
  it("requires both gold and timber, not just a relic, for the supply lesson", () => {
    const state = createGame();
    state.map.nodes.forEach((node) => {
      node.owner = null;
    });
    state.map.nodes.find((n) => n.kind === "relic")!.owner = 0;
    expect(hasClaimedSupplies(state)).toBe(false);
    state.map.nodes.find((n) => n.kind === "wood")!.owner = 0;
    expect(hasClaimedSupplies(state)).toBe(false);
    state.map.nodes.find((n) => n.kind === "gold")!.owner = 0;
    expect(hasClaimedSupplies(state)).toBe(true);
  });

  it("does not warn from unseen enemy presence or undamaged construction", () => {
    const state = createGame();
    state.time = 100;
    state.fog.visible[0].fill(0);
    const keep = state.entities.find((e) => e.team === 0 && e.type === "keep")!;
    spawnEntity(state, 1, "unit", "siege", keep.x + 10, keep.y);
    const house = spawnEntity(
      state,
      0,
      "building",
      "house",
      keep.x + 5,
      keep.y,
      false,
    );
    expect(house.hp).toBeLessThan(house.maxHp);
    expect(buildingUnderAttack(state)).toBeUndefined();
  });

  it("prioritizes the keep, extends with real hits and expires in game time", () => {
    const state = createGame();
    const keep = state.entities.find((e) => e.team === 0 && e.type === "keep")!;
    const barracks = state.entities.find(
      (e) => e.team === 0 && e.type === "barracks",
    )!;
    state.time = 100;
    keep.lastHitAt = 96;
    barracks.lastHitAt = 100;
    const original = JSON.stringify(state);
    expect(buildingUnderAttack(state)?.id).toBe(keep.id);
    expect(JSON.stringify(state)).toBe(original);
    state.paused = true;
    expect(buildingUnderAttack(state)?.id).toBe(keep.id);
    state.time = 103;
    expect(buildingUnderAttack(state)?.id).toBe(barracks.id);
    keep.lastHitAt = 103;
    expect(buildingUnderAttack(state)?.id).toBe(keep.id);
    state.time = 110;
    expect(buildingUnderAttack(state)).toBeUndefined();
  });

  it("ignores destroyed targets, enemy buildings and temporary turrets", () => {
    const state = createGame();
    state.time = 10;
    const keep = state.entities.find((e) => e.team === 0 && e.type === "keep")!;
    keep.lastHitAt = 10;
    keep.hp = 0;
    const enemy = state.entities.find(
      (e) => e.team === 1 && e.type === "keep",
    )!;
    enemy.lastHitAt = 10;
    const turret = spawnEntity(state, 0, "building", "turret", 15, 15);
    turret.lastHitAt = 10;
    expect(buildingUnderAttack(state)).toBeUndefined();
  });
});
