import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BUILDINGS,
  canBuild,
  createGame,
  issueCommand,
  projectPendingCommands,
  restoreGame,
  serializeGame,
} from "../src/sim";
import type { BuildingId, GameCommand, GameState } from "../src/sim";
import * as engine from "../src/sim/engine";
import { plannedBuildResult } from "../src/ui/placement";
import { queuedConstructionPlans } from "../src/ui/queued-construction";

type BuildCommand = Extract<GameCommand, { type: "build" }>;
const game = () =>
  createGame({
    seed: "QUEUED-CONSTRUCTION",
    startingGold: 2000,
    startingWood: 2000,
  });

function buildAtFreeSite(
  state: GameState,
  building: BuildingId = "house",
  team = 0,
): BuildCommand {
  const projected = projectPendingCommands(state);
  for (let y = 2.5; y < state.map.height - 2; y++)
    for (let x = 2.5; x < state.map.width - 2; x++)
      if (canBuild(projected, team, building, x, y).ok)
        return { type: "build", team, building, x, y };
  throw new Error(`No valid ${building} site for team ${team}.`);
}

function queueBuild(
  state: GameState,
  building: BuildingId = "house",
  team = 0,
) {
  const command = buildAtFreeSite(state, building, team);
  expect(issueCommand(state, command)).toEqual({ ok: true, queued: true });
  return command;
}

function expected(command: BuildCommand, ordinal = 1) {
  const definition = BUILDINGS[command.building];
  return {
    building: command.building,
    name: definition.name,
    x: command.x,
    y: command.y,
    size: definition.size,
    ordinal,
  };
}

function freezeDeep(value: object): void {
  for (const child of Object.values(value))
    if (child && typeof child === "object") freezeDeep(child);
  Object.freeze(value);
}

afterEach(() => vi.restoreAllMocks());

describe("queued construction presentation model", () => {
  it("describes accepted builds without creating or exposing live entities", () => {
    const state = game();
    state.paused = true;
    const command = queueBuild(state, "tower");
    const before = serializeGame(state);
    const plans = queuedConstructionPlans(state);
    expect(plans).toEqual([expected(command)]);
    expect(Object.isFrozen(plans)).toBe(true);
    expect(Object.isFrozen(plans[0])).toBe(true);
    expect(plans[0]).not.toHaveProperty("id");
    expect(plans[0]).not.toHaveProperty("hp");
    expect(serializeGame(state)).toBe(before);
    expect(state.entities.some((entity) => entity.type === "tower")).toBe(false);
  });

  it("numbers only own successful builds among mixed and foreign orders", () => {
    const state = game();
    state.players[0].alliance = 0;
    state.players[1].alliance = 0;
    state.paused = true;
    expect(issueCommand(state, { type: "hold", team: 0 }).ok).toBe(true);
    const first = queueBuild(state);
    const foreign = queueBuild(state, "house", 1);
    expect(
      issueCommand(state, { type: "recruit", team: 0, unit: "swordsman" }).ok,
    ).toBe(true);
    const second = queueBuild(state, "tower");
    expect(queuedConstructionPlans(state)).toEqual([
      expected(first),
      expected(second, 2),
    ]);
    expect(queuedConstructionPlans(state, 1)).toEqual([expected(foreign)]);
  });

  it("keeps actual completed and in-progress buildings out of the plans", () => {
    const state = game();
    const actual = buildAtFreeSite(state);
    expect(issueCommand(state, actual).ok).toBe(true);
    state.paused = true;
    const planned = queueBuild(state);
    // This rejected duplicate cannot relabel the existing construction.
    state.pendingCommands.unshift(actual);
    expect(queuedConstructionPlans(state)).toEqual([expected(planned)]);
    expect(state.entities.some((entity) => entity.buildProgress === 0)).toBe(true);
  });

  it.each(["running", "finished", "defeated", "neutral", "closed"])(
    "has no plans for a %s player or battle",
    (condition) => {
      const state = game();
      state.paused = true;
      queueBuild(state);
      if (condition === "running") state.paused = false;
      if (condition === "finished") state.winner = 0;
      if (condition === "defeated") state.players[0].defeated = true;
      if (condition === "neutral") state.players[0].neutral = true;
      if (condition === "closed") state.players[0].closed = true;
      expect(queuedConstructionPlans(state)).toEqual([]);
    },
  );

  it("has no plans for missing or invalid teams, empty queues, or other orders", () => {
    const state = game();
    state.paused = true;
    expect(queuedConstructionPlans(state)).toEqual([]);
    expect(issueCommand(state, { type: "hold", team: 0 }).ok).toBe(true);
    expect(queuedConstructionPlans(state)).toEqual([]);
    queueBuild(state);
    for (const team of [-1, 0.5, 100, NaN])
      expect(queuedConstructionPlans(state, team)).toEqual([]);
  });

  it("ignores invalid building IDs, sites, foreign owners and failed duplicates", () => {
    const state = game();
    state.paused = true;
    const command = queueBuild(state);
    state.pendingCommands.push(
      { ...command },
      { ...command, building: "missing" as BuildingId },
      { ...command, building: "keep" },
      { ...command, x: NaN },
      { ...command, y: Infinity },
      { ...command, x: -1 },
      { ...command, x: state.map.width },
      { ...command, team: 100 },
    );
    expect(queuedConstructionPlans(state)).toEqual([expected(command)]);
  });

  it("includes only the builds affordable after earlier queued costs", () => {
    const state = game();
    state.paused = true;
    const first = queueBuild(state);
    queueBuild(state);
    state.players[0].wood = BUILDINGS.house.cost.wood;
    const before = serializeGame(state);
    expect(queuedConstructionPlans(state)).toEqual([expected(first)]);
    expect(state.pendingCommands).toHaveLength(2);
    expect(serializeGame(state)).toBe(before);
  });

  it("respects recruitment costs rather than treating build orders in isolation", () => {
    const state = game();
    state.paused = true;
    const command = buildAtFreeSite(state);
    state.players[0].wood = 70;
    expect(
      issueCommand(state, { type: "recruit", team: 0, unit: "swordsman" }).ok,
    ).toBe(true);
    expect(issueCommand(state, command).ok).toBe(false);
    state.pendingCommands.push(command);
    expect(queuedConstructionPlans(state)).toEqual([]);
  });

  it("uses a queued production refund that makes the subsequent build affordable", () => {
    const state = game();
    const command = buildAtFreeSite(state);
    const producer = state.entities.find(
      (entity) => entity.team === 0 && entity.type === "barracks",
    )!;
    expect(
      issueCommand(state, {
        type: "recruit",
        team: 0,
        unit: "swordsman",
        buildingId: producer.id,
      }).ok,
    ).toBe(true);
    state.players[0].wood = 55;
    state.paused = true;
    expect(issueCommand(state, command).ok).toBe(false);
    expect(
      issueCommand(state, {
        type: "cancelProduction",
        team: 0,
        buildingId: producer.id,
        queueId: producer.queue[0].queueId!,
      }).ok,
    ).toBe(true);
    expect(issueCommand(state, command)).toEqual({ ok: true, queued: true });
    const before = serializeGame(state);
    expect(queuedConstructionPlans(state)).toEqual([expected(command)]);
    expect(serializeGame(state)).toBe(before);
    expect(producer.queue).toHaveLength(1);
    expect(state.players[0].wood).toBe(55);
  });

  it("orders successful builds correctly when an earlier duplicate needs a later refund", () => {
    const state = game();
    const producer = state.entities.find(
      (entity) => entity.team === 0 && entity.type === "barracks",
    )!;
    expect(
      issueCommand(state, {
        type: "recruit",
        team: 0,
        unit: "swordsman",
        buildingId: producer.id,
      }).ok,
    ).toBe(true);
    state.paused = true;
    const barracks = queueBuild(state, "barracks");
    const house = queueBuild(state);
    state.players[0].gold = 10;
    state.players[0].wood = 165;
    // Model altered queue input: the first barracks cannot execute, while its
    // later duplicate can use the cancelled job's 45 gold / 10 wood refund.
    state.pendingCommands = [
      barracks,
      house,
      {
        type: "cancelProduction",
        team: 0,
        buildingId: producer.id,
        queueId: producer.queue[0].queueId!,
      },
      { ...barracks },
    ];
    expect(queuedConstructionPlans(state)).toEqual([
      expected(house),
      expected(barracks, 2),
    ]);
  });

  it("does not count placement preview or its cancellation as queued construction", () => {
    const state = game();
    state.paused = true;
    const command = queueBuild(state);
    const preview = buildAtFreeSite(state, "tower");
    const before = serializeGame(state);
    expect(
      plannedBuildResult(state, 0, preview.building, preview.x, preview.y).ok,
    ).toBe(true);
    // Dismissing the local preview dispatches no build/undo command.
    expect(queuedConstructionPlans(state)).toEqual([expected(command)]);
    expect(serializeGame(state)).toBe(before);
  });

  it("reflects queue removal, reorder and same-length replacement without a cache", () => {
    const state = game();
    state.paused = true;
    const first = queueBuild(state);
    const second = queueBuild(state);
    expect(queuedConstructionPlans(state)).toHaveLength(2);
    state.pendingCommands.reverse();
    expect(queuedConstructionPlans(state)).toEqual([
      expected(second),
      expected(first, 2),
    ]);
    state.pendingCommands = [second];
    expect(queuedConstructionPlans(state)).toEqual([expected(second)]);
    const replacement: BuildCommand = { ...first, building: "tower" };
    state.pendingCommands = [replacement];
    expect(queuedConstructionPlans(state)).toEqual([expected(replacement)]);
    state.pendingCommands = [];
    expect(queuedConstructionPlans(state)).toEqual([]);
  });

  it("disappears on resume as the queued builds become actual construction", () => {
    const state = game();
    state.paused = true;
    const command = queueBuild(state);
    expect(queuedConstructionPlans(state)).toEqual([expected(command)]);
    expect(issueCommand(state, { type: "pause", team: 0, paused: false }).ok).toBe(
      true,
    );
    expect(queuedConstructionPlans(state)).toEqual([]);
    expect(state.pendingCommands).toEqual([]);
    expect(
      state.entities.find(
        (entity) => entity.x === command.x && entity.y === command.y,
      ),
    ).toMatchObject({ type: "house", buildProgress: 0 });
    state.paused = true;
    expect(queuedConstructionPlans(state)).toEqual([]);
  });

  it("reuses a supplied current projection without mutating either snapshot", () => {
    const state = game();
    state.paused = true;
    const command = queueBuild(state);
    const projected = projectPendingCommands(state);
    const before = serializeGame(state);
    const projectedBefore = serializeGame(projected);
    freezeDeep(state);
    freezeDeep(projected);
    const project = vi.spyOn(engine, "projectPendingCommands");
    expect(queuedConstructionPlans(state, 0, projected)).toEqual([
      expected(command),
    ]);
    expect(project).not.toHaveBeenCalled();
    expect(queuedConstructionPlans(state)).toEqual([expected(command)]);
    expect(project).toHaveBeenCalledOnce();
    expect(serializeGame(state)).toBe(before);
    expect(serializeGame(projected)).toBe(projectedBefore);
  });

  it("does not fabricate a plan when the supplied projection did not materialize it", () => {
    const state = game();
    state.paused = true;
    queueBuild(state);
    expect(queuedConstructionPlans(state, 0, structuredClone(state))).toEqual([]);
  });

  it("fails closed if projection fails, leaving the original queue untouched", () => {
    const state = game();
    state.paused = true;
    queueBuild(state);
    const before = serializeGame(state);
    vi.spyOn(engine, "projectPendingCommands").mockImplementation(() => {
      throw new Error("Projection unavailable");
    });
    expect(queuedConstructionPlans(state)).toEqual([]);
    expect(serializeGame(state)).toBe(before);
  });

  it("derives the same plans after serialization and restoration with no new fields", () => {
    const state = game();
    state.paused = true;
    queueBuild(state);
    queueBuild(state, "tower");
    const serialized = serializeGame(state);
    const plans = queuedConstructionPlans(state);
    const restored = restoreGame(serialized);
    const restoredBefore = serializeGame(restored);
    expect(queuedConstructionPlans(restored)).toEqual(plans);
    expect(serializeGame(state)).toBe(serialized);
    expect(serializeGame(restored)).toBe(restoredBefore);
    expect(restored.pendingCommands).toEqual(state.pendingCommands);
    expect(Object.keys(restored)).toEqual(Object.keys(state));
  });
});
