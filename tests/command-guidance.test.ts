import { describe, expect, it } from "vitest";
import { createGame, issueCommand, stepGame } from "../src/sim";
import { expeditionOpeningGuidance, orderDescription, rallyDestination, recruitDestination, resourceTargetName, selectedOrderDescription } from "../src/ui/command-guidance";

function fixture() {
  const state = createGame({ seed: "COMMAND-CLARITY", startingGold: 2000, startingWood: 2000 });
  state.players.forEach((player) => player.ai = false);
  const producer = state.entities.find((entity) => entity.team === 0 && entity.type === "keep")!;
  const hero = state.entities.find((entity) => entity.team === 0 && entity.kind === "commander")!;
  return { state, producer, hero };
}
describe("guidance matches actual command destinations", () => {
  it("new troops use the commander position at completion, without tracking later movement", () => {
    const { state, producer, hero } = fixture();
    const oldIds = new Set(state.entities.map((entity) => entity.id));
    expect(issueCommand(state, { type: "recruit", team: 0, unit: "swordsman", buildingId: producer.id }).ok).toBe(true);
    producer.queue[0].remaining = .1;
    hero.x = producer.x + 9; hero.y = producer.y + 3;
    const completion = { x: hero.x, y: hero.y };
    stepGame(state, .1);
    const troop = state.entities.find((entity) => !oldIds.has(entity.id) && entity.team === 0)!;
    expect(troop.order).toMatchObject({ type: "move", ...completion });
    hero.x += 3;
    expect(troop.order).toMatchObject({ type: "move", ...completion });
    expect(rallyDestination(producer)).toContain("when training finishes; they do not keep following");
    expect(recruitDestination(producer)).toContain("commander’s position at completion");
  });
  it("a fixed rally snapshots its coordinates and gives recruits attack-move orders", () => {
    const { state, producer, hero } = fixture();
    const point = { x: producer.x + 9, y: producer.y + 3 };
    const oldIds = new Set(state.entities.map((entity) => entity.id));
    expect(issueCommand(state, { type: "rally", team: 0, buildingId: producer.id, ...point }).ok).toBe(true);
    hero.x = point.x + 4; hero.y = point.y;
    expect(issueCommand(state, { type: "recruit", team: 0, unit: "swordsman", buildingId: producer.id }).ok).toBe(true);
    producer.queue[0].remaining = .1;
    stepGame(state, .1);
    const troop = state.entities.find((entity) => !oldIds.has(entity.id) && entity.team === 0)!;
    expect(producer.rally).toEqual(point);
    expect(troop.order).toMatchObject({ type: "attackMove", ...point });
    expect(rallyDestination(producer)).toContain(`(${point.x.toFixed(1)}, ${point.y.toFixed(1)})`);
    expect(rallyDestination(producer)).toContain("does not follow the commander");
  });
  it("names the selected capture landmark and explains pursuit, without consulting hidden entities", () => {
    const { state, hero } = fixture();
    const node = state.map.nodes.find((candidate) => candidate.kind === "relic")!;
    expect(issueCommand(state, { type: "capture", team: 0, entityIds: [hero.id], nodeId: node.id }).ok).toBe(true);
    const expected = `Capture / defend ${resourceTargetName(node)}; engages nearby enemies`;
    expect(orderDescription(state, hero)).toBe(expected);
    expect(selectedOrderDescription(state, [hero.id])).toBe(expected);
    state.entities = state.entities.filter((entity) => entity.team === 0);
    expect(orderDescription(state, hero)).toBe(expected);
  });
  it("gives distinct gold, timber and relic labels and does not disguise mixed orders", () => {
    const { state, hero } = fixture();
    for (const [kind, name] of [["gold", "Gold mine"], ["wood", "Timber camp"], ["relic", "Relic"]] as const)
      expect(resourceTargetName(state.map.nodes.find((node) => node.kind === kind)!)).toMatch(new RegExp(`^${name} \\(`));
    const troop = state.entities.find((entity) => entity.team === 0 && entity.kind === "unit")!;
    troop.order = { type: "hold" };
    expect(selectedOrderDescription(state, [hero.id, troop.id])).toContain("Mixed orders");
  });
  it("teaches first-encounter economy and safe staging without promising changed balance", () => {
    expect(expeditionOpeningGuidance("foothold")).toContain("capture another gold mine and timber camp");
    expect(expeditionOpeningGuidance("foothold")).toContain("set a safe rally point");
    expect(expeditionOpeningGuidance("foothold")).toContain("tap a particular relic");
    expect(expeditionOpeningGuidance("unknown")).toBe("");
  });
});
