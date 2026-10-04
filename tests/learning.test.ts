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
import { advanceLearning, restoreLearning, LESSONS } from "../src/ui/learning";
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
    s.map.nodes.find((n) => n.kind === "relic")!.owner = 0;
    p = advanceLearning(s, p);
    expect(p.step).toBe(LESSONS.length);
  });
});
