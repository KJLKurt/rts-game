import { describe, expect, it } from "vitest";
import { createGame, issueCommand, stepGame } from "../src/sim";
import { advanceTutorial, restoreTutorial } from "../src/ui/tutorial";
function fixture() {
  const state = createGame({ seed: "TUTORIAL-SAVE", difficulty: "easy" }),
    hero = state.entities.find((e) => e.team === 0 && e.kind === "commander")!;
  return { state, hero, origin: { x: hero.x, y: hero.y } };
}
describe("saved commander field guide", () => {
  it("preserves every saved stage even after returning home or command-log truncation", () => {
    const { state, origin } = fixture();
    for (let step = 0; step < 4; step++)
      expect(
        restoreTutorial(state, JSON.parse(JSON.stringify({ step, origin }))),
      ).toEqual({ step, origin });
  });
  it("does not treat fresh ownership or autonomous movement as deliberate progress", () => {
    const { state, hero, origin } = fixture();
    hero.x += 5;
    expect(advanceTutorial(state, { step: 0, origin }).step).toBe(0);
    expect(restoreTutorial(state, undefined).step).toBe(0);
  });
  it("advances only through deliberate movement, actual supply capture and recruitment", () => {
    const { state, hero, origin } = fixture();
    hero.x += 5;
    state.commandLog.push({
      tick: 0,
      command: {
        type: "move",
        team: 0,
        entityIds: [hero.id],
        x: hero.x,
        y: hero.y,
      },
    });
    expect(advanceTutorial(state, { step: 0, origin }).step).toBe(1);
    state.players[0].stats.captures = 1;
    // A relic raises the same counter; only an actual supply capture earns credit.
    expect(advanceTutorial(state, { step: 0, origin }).step).toBe(1);
    state.events.push({ id: state.nextEventId++, type: "capture", team: 0, time: state.time, x: hero.x, y: hero.y, subtype: "gold" });
    expect(advanceTutorial(state, { step: 0, origin }).step).toBe(2);
    state.players[0].stats.unitsCreated = 5;
    expect(advanceTutorial(state, { step: 2, origin }).step).toBe(2);
    state.commandLog.push({
      tick: 1,
      command: { type: "recruit", team: 0, unit: "swordsman" },
    });
    expect(advanceTutorial(state, { step: 2, origin }).step).toBe(3);
  });
  it("does not infer a supply capture from an old generic capture counter", () => {
    const { state, hero } = fixture();
    state.players[0].stats.captures = 1;
    state.commandLog.push({
      tick: 0,
      command: {
        type: "move",
        team: 0,
        entityIds: [hero.id],
        x: hero.x + 5,
        y: hero.y,
      },
    });
    expect(restoreTutorial(state, undefined).step).toBe(1);
  });
  it("rejects relic and enemy supply captures even with starting gold and timber held", () => {
    const { state, hero, origin } = fixture();
    hero.x += 5;
    state.commandLog.push({ tick: 0, command: { type: "move", team: 0, x: hero.x, y: hero.y } });
    state.events.push({ id: state.nextEventId++, type: "capture", team: 0, time: 0, x: hero.x, y: hero.y, subtype: "relic" });
    state.events.push({ id: state.nextEventId++, type: "capture", team: 1, time: 0, x: hero.x, y: hero.y, subtype: "gold" });
    expect(advanceTutorial(state, { step: 0, origin })).toEqual({ step: 1, origin });
  });
  it("retains a real expansion capture after the event expires and the guide is saved", () => {
    const { state, hero, origin } = fixture();
    state.players.forEach((player) => player.ai = false);
    const node = state.map.nodes.find((candidate) => candidate.kind === "gold" && candidate.owner !== 0)!;
    hero.x = node.x; hero.y = node.y;
    expect(issueCommand(state, { type: "capture", team: 0, entityIds: [hero.id], nodeId: node.id }).ok).toBe(true);
    let progress = { step: 0, origin };
    for (let i = 0; i < 100 && !state.players[0].stats.captures; i++) {
      stepGame(state, .1);
      progress = advanceTutorial(state, progress);
    }
    expect(node.owner).toBe(0);
    expect(progress).toEqual({ step: 2, origin, supplyCaptured: true });
    state.events = [];
    hero.x = origin.x; hero.y = origin.y;
    expect(restoreTutorial(state, JSON.parse(JSON.stringify(progress)))).toEqual(progress);
  });
  it("rejects invalid stages and out-of-bounds or non-finite origins without changing the game", () => {
    const { state } = fixture(),
      before = JSON.stringify(state),
      fresh = restoreTutorial(state, undefined);
    for (const saved of [
      { step: 99, origin: { x: Infinity, y: 0 } },
      { step: -1, origin: { x: -5, y: 0 } },
      { step: "3", origin: { x: 0, y: NaN } },
      { step: 2.5, origin: { x: 1e9, y: 1e9 } },
      [],
      null,
    ])
      expect(restoreTutorial(state, saved)).toEqual(fresh);
    expect(JSON.stringify(state)).toBe(before);
  });
});
