import { describe, it, expect } from "vitest";
import { createGame } from "../src/sim";
import { relicSummary, nearestRelic, relicControlDescription, firstBattleObjectiveCopy, fieldGuideObjectiveCopy } from "../src/ui/objectives";
import { getEconomyRates } from "../src/sim/economy";
import { STORY_CAMPAIGNS } from "../src/ui/campaigns/authored";

describe("first ordinary battle briefing", () => {
  it("teaches Conquest's keep victory and relic income without promising victory points", () => {
    const copy = firstBattleObjectiveCopy("conquest");
    expect(copy.title).toBe("Destroy the enemy keeps");
    expect(copy.text).toBe("Hold relics for gold and wood to fund your siege. Destroy the enemy keeps to win.");
    expect(copy.text).not.toContain("victory points");
  });
  it.each(["domination", "relic"] as const)("preserves the existing %s point-mode copy exactly", mode => {
    expect(firstBattleObjectiveCopy(mode)).toEqual({
      title: "Take the center",
      text: "Relics earn victory points; gold and wood fund your army.",
    });
  });
});

describe("fourth commander field-guide step", () => {
  it("agrees with ordinary Conquest victory and income without teaching scoring", () => {
    const state = createGame({ mode: "conquest" });
    const before = JSON.stringify(state);
    const copy = fieldGuideObjectiveCopy(state.settings);
    expect(copy).toEqual({
      title: "Destroy the enemy keeps",
      text: "Relics pay gold and wood. Destroy the enemy keeps to win, and protect your own keep.",
    });
    expect(copy.text).not.toMatch(/to score|victory points/);
    expect(firstBattleObjectiveCopy(state.settings.mode).title).toBe(copy.title);
    expect(relicControlDescription(state)).toBe("Hold for gold and wood income");
    expect(relicSummary(state).pointsPerSecond).toBe(0);
    expect(JSON.stringify(state)).toBe(before);
  });
  it.each(["domination", "relic"] as const)("preserves the ordinary %s scoring tip exactly", mode => {
    expect(fieldGuideObjectiveCopy({ mode })).toEqual({
      title: "Take the center",
      text: "Hold relics to score. Keep recruiting, capture fresh gold, and protect your keep.",
    });
  });
  it.each(["domination", "relic", "conquest"] as const)("prioritizes authored objectives over generic %s victory advice", mode => {
    const copy = fieldGuideObjectiveCopy({ mode, scriptedVictory: true });
    expect(copy.title).toBe("Follow your mission");
    expect(copy.text).toContain("Complete the mission objectives");
    expect(copy.text).not.toMatch(/to score|victory points|keeps to win/);
  });
});

describe("selected relic guidance", () => {
  it("describes Conquest income, matching the economy's actual gold and wood stipend", () => {
    const state = createGame({ mode: "conquest" });
    const before = getEconomyRates(state);
    state.map.nodes.find(node => node.kind === "relic")!.owner = 0;
    const after = getEconomyRates(state);
    expect(after.goldPerSecond).toBeGreaterThan(before.goldPerSecond);
    expect(after.woodPerSecond).toBeGreaterThan(before.woodPerSecond);
    expect(relicControlDescription(state)).toBe("Hold for gold and wood income");
    expect(relicSummary(state).pointsPerSecond).toBe(0);
  });
  it.each(["domination", "relic"] as const)("retains victory points under ordinary %s rules", mode => {
    expect(relicControlDescription(createGame({ mode }))).toBe("Hold to earn victory points");
  });
  it("does not promise score victory in authored campaigns, practice or Rush", () => {
    for (const mission of STORY_CAMPAIGNS.flatMap(campaign => campaign.missions)) {
      const state = createGame(mission.settings);
      expect(relicControlDescription(state)).toBe(state.settings.mode === "conquest"
        ? "Hold for gold and wood income"
        : "Capture and defend · follow mission objectives");
    }
    expect(relicControlDescription(createGame({ learning: true }))).toBe("Capture and defend in peaceful practice");
    expect(relicControlDescription(createGame({ mode: "rush" }))).toBe("Relics do not score in Rush");
  });
  it("follows the custom map's normalized mode rather than the requested setup mode", () => {
    const map = createGame().map;
    map.scenario = {
      version: 1,
      slots: [0, 1].map(team => ({ name: `Team ${team}`, controller: team === 0 ? "human" : "ai", alliance: team, faction: "ironhold", commander: "warlord", personality: "defensive", difficulty: "easy" })),
      rules: { mode: "conquest", duration: 18, populationCap: 80, startingGold: 300, startingWood: 300, startingForces: "standard" },
      startingEntities: [], camps: [],
    };
    const state = createGame({ customMap: map, mode: "domination" });
    expect(state.settings.mode).toBe("conquest");
    expect(firstBattleObjectiveCopy(state.settings.mode).title).toBe("Destroy the enemy keeps");
    expect(relicControlDescription(state)).toBe("Hold for gold and wood income");
  });
});

describe("objective clarity", () => {
  it("reports actual controlled relics and score income", () => {
    const s = createGame(),
      nodes = s.map.nodes.filter((n) => n.kind === "relic");
    expect(relicSummary(s)).toEqual({ owned: 0, total: 3, pointsPerSecond: 0 });
    nodes[0].owner = 0;
    s.escalation = 2;
    expect(relicSummary(s).pointsPerSecond).toBe(1);
    nodes[1].owner = 0;
    expect(relicSummary(s).pointsPerSecond).toBe(2);
    s.settings.mode = "conquest";
    expect(relicSummary(s).pointsPerSecond).toBe(0);
  });
  it("routes toward a public unowned landmark without needing hidden enemy data", () => {
    const s = createGame(),
      nodes = s.map.nodes.filter((n) => n.kind === "relic"),
      origin = { ...nodes[0] };
    nodes[0].owner = 0;
    s.fog.visible[0].fill(0);
    const target = nearestRelic(s, origin)!;
    expect(target.kind).toBe("relic");
    expect(target.id).not.toBe(nodes[0].id);
    expect(relicSummary(s).owned).toBe(1);
  });
});

it("counts allied relics and targets a non-allied relic", () => {
  const state = createGame({ aiPlayers: 2 });
  state.players[0].alliance = 0;
  state.players[2].alliance = 0;
  const relics = state.map.nodes.filter((n) => n.kind === "relic");
  relics[0].owner = 2;
  relics[1].owner = 0;
  expect(relicSummary(state)).toMatchObject({ owned: 2, pointsPerSecond: 1 });
  expect(nearestRelic(state, relics[0])?.id).toBe(relics[2].id);
});
