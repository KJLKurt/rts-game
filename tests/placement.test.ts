import { describe, expect, it } from "vitest";
import {
  BUILDINGS,
  createGame,
  canBuild,
  spawnEntity,
  issueCommand,
  productionRefund,
  projectPendingCommands,
  serializeGame,
} from "../src/sim";
import type { GameCommand } from "../src/sim";
import { plannedBuildResult } from "../src/ui/placement";

function constructionGame() {
  const state = createGame({
    seed: "PLANNED-BUILD-REFUND",
    faction: "ironhold",
    startingGold: 2000,
    startingWood: 2000,
  });
  state.map.tiles.fill("grass");
  state.map.nodes = [];
  state.entities = state.entities.filter((entity) => entity.team !== 0);
  spawnEntity(state, 0, "building", "keep", 10, 10);
  const producer = spawnEntity(state, 0, "building", "barracks", 10, 15);
  return { state, producer };
}

function pendingRefund(wood: number, remainingFraction = 1) {
  const { state, producer } = constructionGame();
  const command: Extract<GameCommand, { type: "build" }> = {
    type: "build",
    team: 0,
    building: "house",
    x: 14,
    y: 10,
  };
  expect(canBuild(state, 0, "house", command.x, command.y)).toEqual({ ok: true });
  expect(
    issueCommand(state, {
      type: "recruit",
      team: 0,
      unit: "swordsman",
      buildingId: producer.id,
    }),
  ).toEqual({ ok: true });
  producer.queue[0].remaining = producer.queue[0].total * remainingFraction;
  const refund = productionRefund(state, producer, producer.queue[0]);
  state.players[0].wood = wood;
  state.paused = true;
  expect(
    issueCommand(state, {
      type: "cancelProduction",
      team: 0,
      buildingId: producer.id,
      queueId: producer.queue[0].queueId!,
    }),
  ).toEqual({ ok: true, queued: true });
  return { state, producer, command, refund };
}

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
    const before = serializeGame(state);
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
    expect(serializeGame(state)).toBe(before);
  });

  it.each([
    { label: "full", wood: 55, remainingFraction: 1, refundedWood: 10 },
    { label: "partial", wood: 60, remainingFraction: 0.5, refundedWood: 5 },
  ])(
    "allows a house funded exactly by a queued $label production refund without mutating live state",
    ({ wood, remainingFraction, refundedWood }) => {
      const { state, producer, command, refund } = pendingRefund(
        wood,
        remainingFraction,
      );
      expect(refund.wood).toBe(refundedWood);
      expect(canBuild(state, 0, "house", command.x, command.y)).toEqual({
        ok: false,
        error: "Need 0 gold and 65 wood.",
      });
      const projected = projectPendingCommands(state);
      expect(projected.players[0].wood).toBe(BUILDINGS.house.cost.wood);
      expect(projected.entities.find((entity) => entity.id === producer.id)!.queue)
        .toHaveLength(0);
      expect(canBuild(projected, 0, "house", command.x, command.y)).toEqual({
        ok: true,
      });
      // The engine already accepts this exact order; the UI must agree before
      // it appends the House, without applying the cancellation to live state.
      expect(issueCommand(structuredClone(state), command)).toEqual({
        ok: true,
        queued: true,
      });
      const before = serializeGame(state);
      const previews = [
        plannedBuildResult(state, 0, "house", command.x, command.y),
        plannedBuildResult(state, 0, "house", command.x, command.y),
      ];
      expect(serializeGame(state)).toBe(before);
      expect(state.players[0].wood).toBe(wood);
      expect(producer.queue).toHaveLength(1);
      expect(state.pendingCommands).toHaveLength(1);
      expect(previews).toEqual([{ ok: true }, { ok: true }]);
    },
  );

  it("rejects an insufficient partial refund without spending or cancelling live production", () => {
    const { state, producer, command, refund } = pendingRefund(55, 0.5);
    expect(refund).toEqual({ gold: 22, wood: 5 });
    expect(projectPendingCommands(state).players[0].wood).toBe(60);
    const expected = { ok: false, error: "Need 0 gold and 65 wood." };
    expect(issueCommand(structuredClone(state), command)).toEqual(expected);
    const before = serializeGame(state);
    expect(plannedBuildResult(state, 0, "house", command.x, command.y)).toEqual(
      expected,
    );
    expect(serializeGame(state)).toBe(before);
    expect(state.players[0].wood).toBe(55);
    expect(producer.queue).toHaveLength(1);
    expect(state.pendingCommands).toHaveLength(1);
  });

  it("does not spend a pending refund when the battle is running", () => {
    const { state, command } = pendingRefund(55);
    state.paused = false;
    const before = serializeGame(state);
    expect(plannedBuildResult(state, 0, "house", command.x, command.y)).toEqual({
      ok: false,
      error: "Need 0 gold and 65 wood.",
    });
    expect(serializeGame(state)).toBe(before);
  });

  it("reserves an earlier queued house after its production refund is projected", () => {
    const { state, command } = pendingRefund(120);
    expect(issueCommand(state, command)).toEqual({ ok: true, queued: true });
    expect(projectPendingCommands(state).players[0].wood).toBe(65);
    const before = serializeGame(state);
    expect(plannedBuildResult(state, 0, "house", command.x, command.y)).toEqual({
      ok: false,
      error: "Too close to your queued House. Pick another spot.",
    });
    expect(plannedBuildResult(state, 0, "house", 6, 10)).toEqual({ ok: true });
    expect(serializeGame(state)).toBe(before);
  });

  it("does not let an unfinished queued building extend construction territory", () => {
    const { state } = constructionGame();
    state.paused = true;
    expect(
      issueCommand(state, {
        type: "build",
        team: 0,
        building: "house",
        x: 18,
        y: 10,
      }),
    ).toEqual({ ok: true, queued: true });
    const expected = {
      ok: false,
      error: "Build near your commander, base, or captured territory.",
    };
    expect(canBuild(projectPendingCommands(state), 0, "house", 23, 10)).toEqual(
      expected,
    );
    const before = serializeGame(state);
    expect(plannedBuildResult(state, 0, "house", 23, 10)).toEqual(expected);
    expect(serializeGame(state)).toBe(before);
  });

  it("does not treat a queued blacksmith as a completed workshop prerequisite", () => {
    const { state } = constructionGame();
    state.paused = true;
    expect(
      issueCommand(state, {
        type: "build",
        team: 0,
        building: "blacksmith",
        x: 14,
        y: 10,
      }),
    ).toEqual({ ok: true, queued: true });
    const expected = { ok: false, error: "Requires Blacksmith." };
    expect(canBuild(projectPendingCommands(state), 0, "workshop", 6, 10)).toEqual(
      expected,
    );
    const before = serializeGame(state);
    expect(plannedBuildResult(state, 0, "workshop", 6, 10)).toEqual(expected);
    expect(serializeGame(state)).toBe(before);
  });
});
