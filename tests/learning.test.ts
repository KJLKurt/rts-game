import { inspectionHTML } from "../src/ui/inspection";
import { describe, expect, it } from "vitest";
import {
  createGame,
  getCommander,
  issueCommand,
  stepGame,
  spawnEntity,
  restoreGame,
  serializeGame,
} from "../src/sim";
import {
  advanceLearning,
  restoreLearning,
  LESSONS,
  hasNeighboringHouses,
  learningActionAvailable,
  learningPanelHint,
} from "../src/ui/learning";
describe("a peaceful learn-by-doing settlement", () => {
  it("starts with only a commander and keep and never raids or scores a forced loss", () => {
    const s = createGame({ learning: true });
    expect(
      s.entities
        .filter((e) => e.team === 0)
        .map((e) => e.type)
        .sort(),
    ).toEqual(["keep", "warlord"]);
    expect(s.players.every((p) => !p.ai)).toBe(true);
    expect(s.map.nodes.every((n) => n.owner === null)).toBe(true);
    stepGame(s, 600);
    expect(s.winner).toBeNull();
    expect(s.players[0].stats.unitsLost).toBe(0);
  });
  it("progresses from deliberate action, persists across reload, and keeps buildings/queues real", () => {
    const s = createGame({ learning: true }),
      c = getCommander(s)!,
      progress = restoreLearning(s, null);
    issueCommand(s, { type: "move", team: 0, x: c.x + 4, y: c.y });
    stepGame(s, 3);
    let p = advanceLearning(s, progress);
    expect(p.step).toBe(1);
    s.map.nodes.find((n) => n.kind === "gold")!.owner = 0;
    p = advanceLearning(s, p);
    expect(p.step).toBe(2);
    s.map.nodes.find((n) => n.kind === "wood")!.owner = 0;
    p = advanceLearning(s, p);
    expect(p.step).toBe(3);
    expect(restoreLearning(restoreGame(serializeGame(s)), p)).toEqual(p);
    p.inspectedKeep = true;
    p = advanceLearning(s, p);
    expect(p.step).toBe(4);
    for (let i = 0; i < 3; i++)
      spawnEntity(s, 0, "unit", "swordsman", c.x, c.y);
    const house = spawnEntity(s, 0, "building", "house", 12, 12);
    house.buildingLevel = 2;
    spawnEntity(s, 0, "building", "house", 14.5, 12);
    s.map.nodes.find((n) => n.kind === "relic")!.owner = 0;
    p = advanceLearning(s, p);
    expect(p.step).toBe(LESSONS.length);
  });
  it("requires two completed, living, non-overlapping neighboring houses", () => {
    const s = createGame({ learning: true });
    const a = spawnEntity(s, 0, "building", "house", 12, 12);
    let p = { ...restoreLearning(s, null), step: 5 };
    expect(advanceLearning(s, p).step).toBe(5);
    const b = spawnEntity(s, 0, "building", "house", 18, 12);
    expect(hasNeighboringHouses(s)).toBe(false);
    b.x = 14.5;
    b.buildProgress = 0.99;
    expect(advanceLearning(s, p).step).toBe(5);
    b.buildProgress = 1;
    b.hp = 0;
    expect(hasNeighboringHouses(s)).toBe(false);
    b.hp = b.maxHp;
    b.x = 13;
    expect(hasNeighboringHouses(s)).toBe(false);
    b.x = 14.5;
    expect(hasNeighboringHouses(s)).toBe(true);
    expect(advanceLearning(s, p).step).toBe(6);
    a.buildingLevel = 2;
    expect(advanceLearning(s, p).step).toBe(7);
  });
  it("applies tutorial unlocks to building Details without restricting normal Details", () => {
    const s = createGame({ learning: true });
    const keep = s.entities.find((e) => e.team === 0 && e.type === "keep")!;
    const house = spawnEntity(s, 0, "building", "house", 12, 12);
    const discovery = inspectionHTML(s, [keep.id], 3);
    expect(discovery).not.toContain('data-action="recruit"');
    expect(discovery).not.toContain('data-action="research"');
    expect(discovery).not.toContain('data-action="upgrade-building"');
    const recruiting = inspectionHTML(s, [keep.id], 4);
    expect(recruiting).toContain('data-id="swordsman"');
    expect(recruiting).not.toContain('data-id="spearman"');
    expect(inspectionHTML(s, [house.id], 5)).not.toContain(
      'data-action="upgrade-building"',
    );
    expect(inspectionHTML(s, [house.id], 6)).toContain(
      'data-action="upgrade-building"',
    );
    expect(inspectionHTML(s, [keep.id])).toContain('data-action="research"');
    expect(inspectionHTML(s, [keep.id], LESSONS.length)).toContain(
      'data-id="spearman"',
    );
  });
  it("introduces only the current tools and preserves unrestricted normal/completed play", () => {
    for (const step of [0, 1, 2, 3]) {
      expect(learningActionAvailable(step, "recruit", "swordsman")).toBe(false);
      expect(learningActionAvailable(step, "build", "house")).toBe(false);
      expect(learningPanelHint(step, "army")).toContain("Recruit opens");
    }
    expect(learningActionAvailable(4, "recruit", "swordsman")).toBe(true);
    expect(learningActionAvailable(4, "recruit", "spearman")).toBe(false);
    expect(learningActionAvailable(4, "build", "house")).toBe(false);
    expect(learningActionAvailable(5, "build", "house")).toBe(true);
    expect(learningActionAvailable(5, "build", "barracks")).toBe(false);
    expect(learningActionAvailable(5, "upgradeBuilding", "house")).toBe(false);
    expect(learningActionAvailable(6, "upgradeBuilding", "house")).toBe(true);
    expect(learningActionAvailable(6, "upgradeBuilding", "keep")).toBe(false);
    expect(learningActionAvailable(7, "research", "economy")).toBe(false);
    for (const step of [null, undefined, LESSONS.length]) {
      for (const [kind, id] of [
        ["recruit", "support"],
        ["build", "workshop"],
        ["research", "steel"],
        ["upgradeBuilding", "keep"],
      ] as const)
        expect(learningActionAvailable(step, kind, id)).toBe(true);
      expect(learningPanelHint(step, "research")).toBe("");
    }
  });
});
