import { describe, it, expect } from "vitest";
import { createGame, getCommander, spawnEntity, updateFog } from "../src/sim";
import { chooseAbilityTarget } from "../src/ui/targeting";
describe("touch ability targeting", () => {
  it("dodges away from the nearest visible threat", () => {
    const s = createGame({ commander: "ranger" }),
      c = getCommander(s)!;
    spawnEntity(s, 1, "unit", "swordsman", c.x + 2, c.y);
    updateFog(s);
    const p = chooseAbilityTarget(s, c, "dodge", null);
    expect(p.x).toBeLessThan(c.x);
    expect(Math.hypot(p.x - c.x, p.y - c.y)).toBeCloseTo(4);
  });
  it("keeps defensive healing centered on the commander", () => {
    const s = createGame(),
      c = getCommander(s)!;
    expect(chooseAbilityTarget(s, c, "rally", { x: 0, y: 0 })).toEqual({
      x: c.x,
      y: c.y,
    });
  });
  it("does not target enemies hidden by fog", () => {
    const s = createGame(),
      c = getCommander(s)!;
    spawnEntity(s, 1, "unit", "swordsman", c.x + 3, c.y);
    s.fog.visible[0].fill(0);
    expect(chooseAbilityTarget(s, c, "charge", { x: 5, y: 6 })).toEqual({
      x: 5,
      y: 6,
    });
  });
  it("places an offensive turret within a useful nearby position", () => {
    const s = createGame({ commander: "engineer" }),
      c = getCommander(s)!;
    spawnEntity(s, 1, "unit", "archer", c.x + 5, c.y);
    updateFog(s);
    const p = chooseAbilityTarget(s, c, "turret", null);
    expect(Math.hypot(p.x - c.x, p.y - c.y)).toBeLessThanOrEqual(3.001);
    expect(p.x).toBeGreaterThan(c.x);
  });
  it("ignores closer allied troops when aiming offensive abilities or evading threats", () => {
    const s = createGame({ aiPlayers: 2 }), c = getCommander(s)!;
    s.players[0].alliance = s.players[2].alliance = 0;
    s.players[1].alliance = 1;
    spawnEntity(s, 2, "unit", "archer", c.x - 1.5, c.y);
    const enemy = spawnEntity(s, 1, "unit", "swordsman", c.x + 5, c.y);
    updateFog(s);
    for (const ability of ["charge", "trap"])
      expect(chooseAbilityTarget(s, c, ability, null)).toEqual({ x: enemy.x, y: enemy.y });
    expect(chooseAbilityTarget(s, c, "dodge", null)).toEqual({ x: c.x - 4, y: c.y });
    expect(chooseAbilityTarget(s, c, "turret", null)).toEqual({ x: c.x + 3, y: c.y });
  });
  it("keeps the fallback when only an ally is visible", () => {
    const s = createGame({ aiPlayers: 2 }), c = getCommander(s)!;
    s.players[0].alliance = s.players[2].alliance = 0;
    spawnEntity(s, 2, "unit", "archer", c.x - 1.5, c.y);
    updateFog(s);
    expect(chooseAbilityTarget(s, c, "charge", { x: 1, y: 2 })).toEqual({ x: 1, y: 2 });
  });
  it("still targets hostile neutral defenders", () => {
    const s = createGame({ aiPlayers: 2 }), c = getCommander(s)!;
    s.players[2].neutral = true;
    const defender = spawnEntity(s, 2, "unit", "spearman", c.x + 2, c.y);
    updateFog(s);
    expect(chooseAbilityTarget(s, c, "charge", null)).toEqual({ x: defender.x, y: defender.y });
  });
});
