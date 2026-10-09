import { describe, expect, it } from "vitest";
import {
  createGame,
  getUnitCost,
  issueCommand,
  productionRefund,
  projectPendingCommands,
  restoreGame,
  serializeGame,
  spawnEntity,
} from "../src/sim";
import type { GameState, ProductionItem } from "../src/sim";
import {
  compactProductionSummary,
  productionHTML,
  productionRemainingSeconds,
} from "../src/ui/inspection";

const game = () =>
  createGame({ startingGold: 2000, startingWood: 2000, populationCap: 40 });
const producer = (state: GameState, type = "barracks", team = 0) =>
  state.entities.find((e) => e.team === team && e.type === type)!;
const job = (
  type: ProductionItem["type"] = "unit",
  remaining = 10,
): ProductionItem => ({
  type,
  id: type === "unit" ? "swordsman" : type === "research" ? "fletching" : "range",
  total: Math.max(10, remaining),
  remaining,
});
const recruit = (state: GameState, buildingId: string, count = 1) => {
  expect(
    issueCommand(state, {
      type: "recruit",
      team: 0,
      unit: "swordsman",
      buildingId,
      count,
    }).ok,
  ).toBe(true);
};

describe("compact production summary", () => {
  it.each([
    { level: 1, rate: 1 },
    { level: 2, rate: 1.15 },
    { level: 3, rate: 1.3 },
  ])("shares level $level unit and research timing with expanded queues", ({ level, rate }) => {
    const state = game();
    const building = spawnEntity(state, 0, "building", "range", 8, 8);
    building.buildingLevel = level;
    for (const type of ["unit", "research"] as const) {
      const item = job(type);
      building.queue = [item];
      expect(productionRemainingSeconds(item, building)).toBeCloseTo(10 / rate);
      expect(compactProductionSummary(state).queued).toBe(1);
      expect(compactProductionSummary(state).nextSeconds).toBeCloseTo(10 / rate);
      expect(productionHTML(state)).toContain(`${Math.ceil(10 / rate)}s remaining`);
    }
  });

  it.each([1, 2])("does not accelerate a level %i building upgrade", (level) => {
    const state = game(), building = producer(state);
    building.buildingLevel = level;
    expect(issueCommand(state, { type: "upgradeBuilding", team: 0, buildingId: building.id }).ok).toBe(true);
    building.queue[0].remaining = 10;
    expect(productionRemainingSeconds(building.queue[0], building)).toBe(10);
    expect(compactProductionSummary(state)).toEqual({ queued: 1, nextSeconds: 10 });
    expect(productionHTML(state)).toContain("10s remaining");
  });

  it("reports the earliest parallel head regardless of producer order, retaining every queued job", () => {
    const state = game(), keep = producer(state, "keep"), barracks = producer(state);
    barracks.buildingLevel = 3;
    recruit(state, keep.id);
    recruit(state, barracks.id, 2);
    const before = serializeGame(state);
    expect(keep.queue[0].remaining).toBe(10);
    expect(barracks.queue[0].remaining).toBe(10);
    expect(compactProductionSummary(state)).toEqual({ queued: 3, nextSeconds: 10 / 1.3 });
    expect(Math.ceil(compactProductionSummary(state).nextSeconds!)).toBe(8);
    expect(compactProductionSummary({ entities: [...state.entities].reverse() })).toEqual(
      compactProductionSummary(state),
    );
    for (const selected of [keep.id, barracks.id]) {
      const expanded = productionHTML(state, selected);
      expect(expanded).toContain("10s remaining");
      expect(expanded).toContain("8s remaining");
      expect(expanded).toContain("8s · waiting");
    }
    expect(serializeGame(state)).toBe(before);
  });

  it("compares adjusted time rather than raw remaining work", () => {
    const state = game(), keep = producer(state, "keep"), barracks = producer(state);
    keep.queue = [job("unit", 9)];
    barracks.buildingLevel = 3;
    barracks.queue = [job("unit", 10)];
    expect(compactProductionSummary(state)).toEqual({ queued: 2, nextSeconds: 10 / 1.3 });
  });

  it("counts waiting jobs without treating them as parallel active heads", () => {
    const state = game(), keep = producer(state, "keep"), barracks = producer(state);
    keep.queue = [job("unit", 10), job("unit", 1)];
    barracks.buildingLevel = 3;
    barracks.queue = [job("buildingUpgrade", 11), job("unit", 1)];
    expect(compactProductionSummary(state)).toEqual({ queued: 4, nextSeconds: 10 });
    keep.queue = [];
    expect(compactProductionSummary(state)).toEqual({ queued: 2, nextSeconds: 11 });
  });

  it("returns an empty summary when there are no qualifying queues", () => {
    const state = game();
    expect(compactProductionSummary(state)).toEqual({ queued: 0, nextSeconds: null });
    const dead = producer(state);
    dead.hp = 0;
    dead.queue = [job()];
    producer(state, "keep", 1).queue = [job()];
    state.entities.find((e) => e.team === 0 && e.kind === "unit")!.queue = [job()];
    expect(compactProductionSummary(state)).toEqual({ queued: 0, nextSeconds: null });
  });

  it("filters dead buildings, other teams and nonbuildings while supporting a requested team", () => {
    const state = game(), keep = producer(state, "keep"), barracks = producer(state);
    keep.queue = [job("unit", 10), job("unit", 10)];
    barracks.hp = -1;
    barracks.queue = [job("unit", 1)];
    producer(state, "keep", 1).queue = [job("unit", 3)];
    state.entities.find((e) => e.team === 0 && e.kind === "commander")!.queue = [job("unit", 1)];
    expect(compactProductionSummary(state)).toEqual({ queued: 2, nextSeconds: 10 });
    expect(compactProductionSummary(state, 1)).toEqual({ queued: 1, nextSeconds: 3 });
  });

  it.each([0.5, 1, 2, 4])("keeps game-second durations at %sx playback speed, including paused state", (gameSpeed) => {
    const state = game(), building = producer(state);
    building.buildingLevel = 3;
    state.settings.gameSpeed = gameSpeed;
    recruit(state, building.id);
    const expected = { queued: 1, nextSeconds: 10 / 1.3 };
    expect(compactProductionSummary(state)).toEqual(expected);
    expect(issueCommand(state, { type: "pause", team: 0, paused: true }).ok).toBe(true);
    expect(compactProductionSummary(state)).toEqual(expected);
  });

  it("does not apply Logistics twice to already-discounted paid work", () => {
    const state = game(), building = producer(state);
    state.players[0].research.logistics = 1;
    building.buildingLevel = 3;
    recruit(state, building.id);
    expect(building.queue[0].remaining).toBe(8.5);
    expect(compactProductionSummary(state)).toEqual({ queued: 1, nextSeconds: 8.5 / 1.3 });
    expect(productionHTML(state)).toContain("7s remaining");
  });

  it("reads projected refunds and recruits without changing the paid or planned state", () => {
    const state = game(), building = producer(state), keep = producer(state, "keep");
    building.buildingLevel = 3;
    recruit(state, building.id, 2);
    recruit(state, keep.id);
    building.queue[0].remaining = 2.6;
    const cancelled = building.queue[0];
    const refund = productionRefund(state, building, cancelled);
    const unitCost = getUnitCost(state, 0, "swordsman");
    expect(issueCommand(state, { type: "pause", team: 0, paused: true }).ok).toBe(true);
    expect(issueCommand(state, {
      type: "cancelProduction", team: 0, buildingId: building.id, queueId: cancelled.queueId!,
    }).ok).toBe(true);
    recruit(state, building.id, 2);
    const paidBefore = serializeGame(state);
    const planned = projectPendingCommands(state), plannedBefore = serializeGame(planned);
    expect(compactProductionSummary(state)).toEqual({ queued: 3, nextSeconds: 2 });
    expect(compactProductionSummary(planned)).toEqual({ queued: 4, nextSeconds: 10 / 1.3 });
    expect(planned.players[0].gold).toBe(state.players[0].gold + refund.gold - 2 * unitCost.gold);
    expect(planned.players[0].wood).toBe(state.players[0].wood + refund.wood - 2 * unitCost.wood);
    expect(productionHTML(planned)).toContain("8s remaining");
    expect(productionHTML(planned)).toContain("Cancel refund: 45 gold · 10 wood");
    expect(serializeGame(state)).toBe(paidBefore);
    expect(serializeGame(planned)).toBe(plannedBefore);
    expect(issueCommand(state, { type: "pause", team: 0, paused: false }).ok).toBe(true);
    expect(compactProductionSummary(state)).toEqual(compactProductionSummary(planned));
  });

  it("round-trips paid and projected summaries through normal battle save restoration", () => {
    const state = game(), building = producer(state), keep = producer(state, "keep");
    building.buildingLevel = 3;
    recruit(state, building.id, 2);
    recruit(state, keep.id);
    const paid = restoreGame(serializeGame(state));
    expect(compactProductionSummary(paid)).toEqual(compactProductionSummary(state));
    expect(productionHTML(paid)).toBe(productionHTML(state));
    expect(issueCommand(state, { type: "pause", team: 0, paused: true }).ok).toBe(true);
    expect(issueCommand(state, {
      type: "cancelProduction", team: 0, buildingId: building.id, queueId: building.queue[0].queueId!,
    }).ok).toBe(true);
    recruit(state, building.id, 2);
    const saved = serializeGame(state), restored = restoreGame(saved);
    expect(compactProductionSummary(restored)).toEqual(compactProductionSummary(state));
    expect(compactProductionSummary(projectPendingCommands(restored))).toEqual(
      compactProductionSummary(projectPendingCommands(state)),
    );
    expect(serializeGame(state)).toBe(saved);
  });
});
