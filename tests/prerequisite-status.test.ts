import { afterEach, describe, expect, it, vi } from "vitest";
import {
  areAllied, canBuild, createGame, issueCommand, projectPendingCommands,
  restoreGame, serializeGame,
} from "../src/sim";
import * as engine from "../src/sim/engine";
import type { BuildingId, GameCommand, GameState } from "../src/sim";
import { recruitProducer } from "../src/ui/inspection";
import { buildingRequirementView, recruitRequirementView } from "../src/ui/prerequisites";
import { renderResearchTree, researchView } from "../src/ui/research";

type BuildCommand = Extract<GameCommand, { type: "build" }>;
const game = () => createGame({ seed: "QUEUED-CONSTRUCTION", startingGold: 2000, startingWood: 2000 });
const own = (state: GameState, type: BuildingId) => state.entities.find(entity => entity.team === 0 && entity.type === type)!;
function freeSite(state: GameState, building: BuildingId): BuildCommand {
  const projected = projectPendingCommands(state);
  for (let y = 2.5; y < state.map.height - 2; y++)
    for (let x = 2.5; x < state.map.width - 2; x++)
      if (canBuild(projected, 0, building, x, y).ok)
        return { type: "build", team: 0, building, x, y };
  throw new Error(`No valid ${building} site.`);
}
function queuedBuild(state: GameState, building: BuildingId) {
  state.paused = true;
  const command = freeSite(state, building);
  expect(issueCommand(state, command)).toEqual({ ok: true, queued: true });
  return command;
}

afterEach(() => vi.restoreAllMocks());

describe("building prerequisite labels", () => {
  it("matches the engine across ready, damaged, destroyed, absent and construction states", () => {
    const state = game(), barracks = own(state, "barracks");
    const stable = freeSite(state, "stable");
    const allowed = () => canBuild(state, 0, "stable", stable.x, stable.y).ok;
    expect(buildingRequirementView(state, "barracks")).toMatchObject({ status: "ready", label: "Barracks ready" });
    expect(allowed()).toBe(true);
    barracks.hp = 1;
    expect(buildingRequirementView(state, "barracks").status).toBe("ready");
    expect(allowed()).toBe(true);
    barracks.hp = 0;
    expect(buildingRequirementView(state, "barracks")).toMatchObject({ status: "missing", label: "Needs Barracks" });
    expect(allowed()).toBe(false);
    barracks.hp = barracks.maxHp;
    barracks.buildProgress = .99;
    expect(buildingRequirementView(state, "barracks")).toMatchObject({ status: "constructing", label: "Barracks under construction" });
    expect(allowed()).toBe(false);
    barracks.buildProgress = 1;
    expect(allowed()).toBe(true);
    state.entities = state.entities.filter(entity => entity !== barracks);
    expect(buildingRequirementView(state, "barracks").status).toBe("missing");
    expect(allowed()).toBe(false);
  });

  it("requires this player's building even when another owner is allied", () => {
    const state = game(), barracks = own(state, "barracks");
    const stable = freeSite(state, "stable");
    state.players[0].alliance = 0;
    state.players[1].alliance = 0;
    expect(areAllied(state, 0, 1)).toBe(true);
    barracks.team = 1;
    expect(buildingRequirementView(state, "barracks").status).toBe("missing");
    expect(canBuild(state, 0, "stable", stable.x, stable.y).ok).toBe(false);
  });

  it("prioritizes an existing completed building over copies still being built", () => {
    const state = game(), barracks = own(state, "barracks");
    state.entities.push({ ...structuredClone(barracks), id: "another-barracks", buildProgress: 0 });
    expect(buildingRequirementView(state, "barracks").status).toBe("ready");
    barracks.hp = 0;
    expect(buildingRequirementView(state, "barracks").status).toBe("constructing");
  });

  it("labels only successfully projected construction queued and keeps its dependent build locked", () => {
    const state = game();
    queuedBuild(state, "blacksmith");
    const projected = projectPendingCommands(state), before = serializeGame(state);
    const smith = own(projected, "blacksmith");
    const completed = structuredClone(projected);
    own(completed, "blacksmith").buildProgress = 1;
    const workshop = freeSite(completed, "workshop");
    expect(buildingRequirementView(state, "blacksmith", 0, projected)).toMatchObject({ status: "queued", label: "Blacksmith queued · Resume to start" });
    expect(canBuild(projected, 0, "workshop", workshop.x, workshop.y).ok).toBe(false);
    expect(smith.buildProgress).toBe(0);
    expect(own(state, "blacksmith")).toBeUndefined();
    expect(serializeGame(state)).toBe(before);
  });

  it("does not call an actual building queued because a duplicate order was rejected", () => {
    const state = game(), command = freeSite(state, "range");
    expect(issueCommand(state, command).ok).toBe(true);
    state.paused = true;
    state.pendingCommands.push(command);
    expect(buildingRequirementView(state, "range").status).toBe("constructing");
  });

  it.each(["unaffordable", "invalid site", "unmet prerequisite", "foreign owner"])(
    "ignores a pending command with %s", reason => {
      const state = game(), command = queuedBuild(state, "blacksmith");
      if (reason === "unaffordable") state.players[0].wood = 0;
      if (reason === "invalid site") command.x = -1;
      if (reason === "unmet prerequisite") own(state, "barracks").hp = 0;
      if (reason === "foreign owner") command.team = 1;
      // issueCommand stores a copy, so replace it with the changed external queue input.
      state.pendingCommands = [command];
      expect(buildingRequirementView(state, "blacksmith").status).toBe("missing");
    },
  );

  it("updates after same-length queue replacement or removal, and doesn't turn a preview into a plan", () => {
    const state = game(), command = queuedBuild(state, "blacksmith");
    expect(buildingRequirementView(state, "blacksmith").status).toBe("queued");
    state.pendingCommands = [{ ...command, building: "house" }];
    expect(buildingRequirementView(state, "blacksmith").status).toBe("missing");
    expect(buildingRequirementView(state, "house").status).toBe("queued");
    state.pendingCommands = [];
    expect(buildingRequirementView(state, "house").status).toBe("missing");
    const preview = freeSite(state, "blacksmith");
    expect(canBuild(state, 0, preview.building, preview.x, preview.y).ok).toBe(true);
    expect(buildingRequirementView(state, "blacksmith").status).toBe("missing");
  });

  it("restores the same labels without save fields and moves queued to construction only on resume", () => {
    const state = game();
    queuedBuild(state, "blacksmith");
    const saved = serializeGame(state), restored = restoreGame(saved);
    expect(buildingRequirementView(restored, "blacksmith")).toEqual(buildingRequirementView(state, "blacksmith"));
    expect(serializeGame(state)).toBe(saved);
    expect(Object.keys(restored)).toEqual(Object.keys(state));
    expect(issueCommand(restored, { type: "pause", team: 0, paused: false }).ok).toBe(true);
    expect(buildingRequirementView(restored, "blacksmith").status).toBe("constructing");
    own(restored, "blacksmith").buildProgress = 1;
    expect(buildingRequirementView(restored, "blacksmith").status).toBe("ready");
  });

  it("reuses the supplied current projection, and fails closed if projection cannot be obtained", () => {
    const state = game();
    queuedBuild(state, "blacksmith");
    const projected = projectPendingCommands(state);
    const before = serializeGame(state), projectedBefore = serializeGame(projected);
    const project = vi.spyOn(engine, "projectPendingCommands");
    expect(buildingRequirementView(state, "blacksmith", 0, projected).status).toBe("queued");
    expect(project).not.toHaveBeenCalled();
    expect(serializeGame(state)).toBe(before);
    expect(serializeGame(projected)).toBe(projectedBefore);
    project.mockImplementation(() => { throw new Error("Unavailable projection"); });
    expect(buildingRequirementView(state, "blacksmith").status).toBe("missing");
  });
});

describe("recruitment and research prerequisite consistency", () => {
  it("describes the selected unfinished Barracks even when the Keep could train the unit", () => {
    const state = game(), barracks = own(state, "barracks");
    barracks.buildProgress = .5;
    expect(recruitProducer(state, "swordsman", barracks.id)).toBeUndefined();
    expect(recruitRequirementView(state, "swordsman", barracks.id)).toMatchObject({ status: "constructing", label: "Barracks under construction" });
    expect(recruitProducer(state, "swordsman")?.type).toBe("keep");
    expect(recruitRequirementView(state, "swordsman").status).toBe("ready");
    expect(issueCommand(state, { type: "recruit", team: 0, unit: "swordsman", buildingId: barracks.id }).ok).toBe(false);
  });

  it.each([{ queued: 12, count: 1 }, { queued: 8, count: 5 }])("does not mistake a selected queue of $queued that cannot fit $count for a missing building", ({ queued, count }) => {
    const state = game(), barracks = own(state, "barracks");
    barracks.queue = Array.from({ length: queued }, (_, i) => ({ type: "unit", id: "swordsman", remaining: 10, total: 10, queueId: `full-${i}` }));
    expect(recruitProducer(state, "swordsman", barracks.id)).toBe(barracks);
    expect(recruitRequirementView(state, "swordsman", barracks.id).status).toBe("ready");
    expect(issueCommand(state, { type: "recruit", team: 0, unit: "swordsman", buildingId: barracks.id, count }).error).toBe("Recruitment queue is full.");
  });

  it("agrees on queued and constructing Archery Range without unlocking recruitment or research", () => {
    const state = game();
    queuedBuild(state, "range");
    const projected = projectPendingCommands(state);
    expect(recruitRequirementView(state, "archer", undefined, 0, projected).label).toBe("Archery Range queued · Resume to start");
    expect(recruitProducer(projected, "archer")).toBeUndefined();
    expect(researchView(projected, "fletching", 0, undefined, state)).toMatchObject({ available: false, status: "Archery Range queued · Resume to start" });
    const html = renderResearchTree(projected, 0, undefined, state);
    expect(html).toContain('class="queued" data-prerequisite-state="queued">Archery Range<small>Queued · Resume to start</small>');
    expect(issueCommand(state, { type: "pause", team: 0, paused: false }).ok).toBe(true);
    expect(recruitRequirementView(state, "archer").label).toBe("Archery Range under construction");
    expect(researchView(state, "fletching")).toMatchObject({ available: false, status: "Archery Range under construction" });
  });

  it("keeps a destroyed ancestor informational when a completed Blacksmith already exists", () => {
    const state = game();
    const command = freeSite(state, "blacksmith");
    expect(issueCommand(state, command).ok).toBe(true);
    own(state, "blacksmith").buildProgress = 1;
    own(state, "barracks").hp = 0;
    expect(buildingRequirementView(state, "barracks").status).toBe("missing");
    expect(researchView(state, "steel")).toMatchObject({ available: true, status: "Research level 1" });
    expect(renderResearchTree(state)).toContain('class="ready" data-prerequisite-state="ready">Blacksmith<small>Ready</small>');
    expect(issueCommand(state, { type: "research", team: 0, technology: "steel" }).ok).toBe(true);
  });
});
