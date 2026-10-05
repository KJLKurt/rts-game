import { describe, it, expect } from "vitest";
import { createGame } from "../src/sim";
import { relicSummary, nearestRelic } from "../src/ui/objectives";
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
