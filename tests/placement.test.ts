import { describe, expect, it } from "vitest";
import { createGame, canBuild, spawnEntity, issueCommand } from "../src/sim";
import { plannedBuildResult } from "../src/ui/placement";

describe("tactical construction planning", () => {
  it("allows neighboring houses while rejecting overlapping footprints", () => {
    const state = createGame({ seed: "ADJACENT-HOUSES", startingWood: 1000 });
    state.map.tiles.fill("grass");
    state.map.nodes = [];
    state.entities = state.entities.filter(
      (e) => e.kind === "building" || e.team !== 0,
    );
    const house = spawnEntity(state, 0, "building", "house", 12, 12);
    expect(canBuild(state, 0, "house", house.x + 2, house.y).ok).toBe(false);
    expect(canBuild(state, 0, "house", house.x + 2.5, house.y).ok).toBe(true);
    expect(
      issueCommand(state, {
        type: "build",
        team: 0,
        building: "house",
        x: house.x + 2.5,
        y: house.y,
      }).ok,
    ).toBe(true);
  });
  it("rejects an invalid site before it can become a queued order", () => {
    const state = createGame();
    state.paused = true;
    const keep = state.entities.find((e) => e.team === 0 && e.type === "keep")!;
    const before = JSON.stringify(state);
    expect(plannedBuildResult(state, 0, "house", keep.x, keep.y)).toEqual(
      canBuild(state, 0, "house", keep.x, keep.y),
    );
    expect(plannedBuildResult(state, 0, "house", keep.x, keep.y).ok).toBe(
      false,
    );
    expect(JSON.stringify(state)).toBe(before);
  });

  it("reserves space around a pending building while preserving a valid separate site", () => {
    const state = createGame();
    state.paused = true;
    const valid: { x: number; y: number }[] = [];
    for (let y = 2; y < state.map.height - 2; y++)
      for (let x = 2; x < state.map.width - 2; x++)
        if (canBuild(state, 0, "house", x + 0.5, y + 0.5).ok)
          valid.push({ x: x + 0.5, y: y + 0.5 });
    const first = valid[0];
    expect(first).toBeDefined();
    state.pendingCommands.push({
      type: "build",
      team: 0,
      building: "house",
      ...first,
    });
    expect(
      plannedBuildResult(state, 0, "house", first.x, first.y),
    ).toMatchObject({
      ok: false,
      error: "Too close to your queued House. Pick another spot.",
    });
    const separate = valid.find(
      (p) => Math.hypot(p.x - first.x, p.y - first.y) > 6,
    )!;
    expect(separate).toBeDefined();
    expect(
      plannedBuildResult(state, 0, "house", separate.x, separate.y).ok,
    ).toBe(true);
    expect(state.pendingCommands).toHaveLength(1);
  });
});
