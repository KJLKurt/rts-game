import { describe, expect, it } from "vitest";
import {
  createGame,
  issueCommand,
  spawnEntity,
  stepGame,
  serializeGame,
  restoreGame,
  buildingPopulation,
  nextBuildingUpgrade,
  productionRefund,
  productionRate,
  technologyCost,
  populationBreakdown,
  getEconomyRates,
  projectPendingCommands,
} from "../../src/sim";

function game() {
  const s = createGame({
    seed: "production-and-growth",
    startingGold: 10000,
    startingWood: 10000,
  });
  s.players.forEach((p) => (p.ai = false));
  return s;
}
describe("visible production and building progression", () => {
  it("targets the selected producer and reserves population for a batch", () => {
    const s = game(),
      b = spawnEntity(s, 0, "building", "barracks", 8, 8);
    expect(
      issueCommand(s, {
        type: "recruit",
        team: 0,
        buildingId: b.id,
        unit: "swordsman",
        count: 3,
      }).ok,
    ).toBe(true);
    expect(b.queue).toHaveLength(3);
    expect(new Set(b.queue.map((q) => q.queueId)).size).toBe(3);
    expect(populationBreakdown(s).reserved).toBe(3);
    expect(
      s.entities.find((e) => e.type === "keep" && e.team === 0)!.queue,
    ).toHaveLength(0);
  });
  it("cancels an exact unstarted job with full refund without removing its neighbor", () => {
    const s = game(),
      b = s.entities.find((e) => e.team === 0 && e.type === "keep")!;
    issueCommand(s, {
      type: "recruit",
      team: 0,
      buildingId: b.id,
      unit: "spearman",
      count: 3,
    });
    const [first, second, third] = b.queue,
      before = s.players[0].gold;
    expect(
      issueCommand(s, {
        type: "cancelProduction",
        team: 0,
        buildingId: b.id,
        queueId: second.queueId!,
      }).ok,
    ).toBe(true);
    expect(b.queue).toEqual([first, third]);
    expect(s.players[0].gold - before).toBe(second.paidCost!.gold);
    expect(populationBreakdown(s).reserved).toBe(2);
    expect(
      issueCommand(s, {
        type: "cancelProduction",
        team: 0,
        buildingId: b.id,
        queueId: second.queueId!,
      }).ok,
    ).toBe(false);
  });
  it("refunds only unfinished work for the active job", () => {
    const s = game(),
      b = s.entities.find((e) => e.team === 0 && e.type === "keep")!;
    issueCommand(s, { type: "recruit", team: 0, unit: "swordsman" });
    stepGame(s, 5);
    expect(b.queue[0].remaining).toBeCloseTo(5);
    const refund = productionRefund(s, b, b.queue[0]);
    expect(refund).toEqual({ gold: 22, wood: 5 });
    const before = { gold: s.players[0].gold, wood: s.players[0].wood };
    issueCommand(s, {
      type: "cancelProduction",
      team: 0,
      buildingId: b.id,
      queueId: b.queue[0].queueId!,
    });
    expect(s.players[0].gold - before.gold).toBe(22);
    expect(s.players[0].wood - before.wood).toBe(5);
  });
  it("upgrades a house through visible levels and refuses beyond the maximum", () => {
    const s = game(),
      h = spawnEntity(s, 0, "building", "house", 8, 8),
      initialHp = h.maxHp;
    expect(buildingPopulation(h)).toBe(8);
    expect(
      issueCommand(s, { type: "upgradeBuilding", team: 0, buildingId: h.id })
        .ok,
    ).toBe(true);
    expect(
      issueCommand(s, { type: "upgradeBuilding", team: 0, buildingId: h.id })
        .ok,
    ).toBe(false);
    stepGame(s, 15.1);
    expect(h.buildingLevel).toBe(2);
    expect(buildingPopulation(h)).toBe(12);
    expect(h.maxHp).toBeCloseTo(initialHp * 1.25);
    issueCommand(s, { type: "upgradeBuilding", team: 0, buildingId: h.id });
    stepGame(s, 20.1);
    expect(h.buildingLevel).toBe(3);
    expect(buildingPopulation(h)).toBe(16);
    expect(nextBuildingUpgrade(h)).toBeUndefined();
    expect(
      issueCommand(s, { type: "upgradeBuilding", team: 0, buildingId: h.id })
        .ok,
    ).toBe(false);
  });
  it("applies a producer upgrade to subsequent production and a depot upgrade to income", () => {
    const s = game(),
      b = spawnEntity(s, 0, "building", "barracks", 8, 8);
    issueCommand(s, { type: "upgradeBuilding", team: 0, buildingId: b.id });
    stepGame(s, 25.1);
    expect(productionRate(b)).toBeCloseTo(1.15);
    issueCommand(s, {
      type: "recruit",
      team: 0,
      buildingId: b.id,
      unit: "swordsman",
    });
    stepGame(s, 8.8);
    expect(b.queue).toHaveLength(0);
    const n = s.map.nodes.find((n) => n.owner === 0 && n.kind === "gold")!,
      d = spawnEntity(s, 0, "building", "depot", n.x + 2, n.y);
    expect(getEconomyRates(s).goldPerSecond).toBeCloseTo(0.45 + 2.1 * 1.35);
    issueCommand(s, { type: "upgradeBuilding", team: 0, buildingId: d.id });
    stepGame(s, 25.1);
    expect(getEconomyRates(s).goldPerSecond).toBeCloseTo(0.45 + 2.1 * 1.5);
  });
  it("preserves queues and upgrades across saves and migrates old jobs safely", () => {
    const s = game(),
      b = s.entities.find((e) => e.team === 0 && e.type === "keep")!;
    issueCommand(s, { type: "recruit", team: 0, unit: "spearman" });
    issueCommand(s, { type: "upgradeBuilding", team: 0, buildingId: b.id });
    const copy = restoreGame(serializeGame(s));
    expect(copy.entities.find((e) => e.id === b.id)!.queue).toEqual(b.queue);
    const legacy = JSON.parse(serializeGame(s));
    legacy.entities.find((e: { id: string }) => e.id === b.id).queue = [
      { type: "unit", id: "spearman", total: 9, remaining: 5 },
    ];
    const restored = restoreGame(JSON.stringify(legacy)),
      q = restored.entities.find((e) => e.id === b.id)!.queue[0];
    expect(q.queueId).toBe(`${b.id}-legacy-0`);
    expect(q.paidCost).toEqual({ gold: 35, wood: 20 });
  });
  it("shows the actual escalating technology cost", () => {
    const s = game();
    expect(technologyCost(s, 0, "economy")).toEqual({ gold: 100, wood: 100 });
    s.players[0].research.economy = 1;
    expect(technologyCost(s, 0, "economy")).toEqual({ gold: 200, wood: 200 });
  });
  it("reserves paused money and population before accepting another order, without charging twice", () => {
    const s = game();
    s.players[0].gold = 60;
    s.players[0].wood = 60;
    issueCommand(s, { type: "pause", team: 0, paused: true });
    expect(
      issueCommand(s, { type: "recruit", team: 0, unit: "swordsman" }).ok,
    ).toBe(true);
    expect(
      issueCommand(s, { type: "recruit", team: 0, unit: "swordsman" }).ok,
    ).toBe(false);
    const planned = projectPendingCommands(s);
    expect(s.players[0].gold).toBe(60);
    expect(planned.players[0].gold).toBe(15);
    expect(populationBreakdown(planned).reserved).toBe(1);
    issueCommand(s, { type: "pause", team: 0, paused: false });
    expect(s.players[0].gold).toBe(15);
    expect(populationBreakdown(s).reserved).toBe(1);
  });
});
