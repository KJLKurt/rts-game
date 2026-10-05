import { describe, expect, it } from "vitest";
import { createGame } from "../src/sim";
import { battleDefeatAdvice, battleResultReason } from "../src/ui/results";
describe("local battle result wording", () => {
  it.each([1, null])(
    "uses the local Keep loss instead of the winner perspective when winner=%s",
    (winner) => {
      const state = createGame();
      state.winner = winner;
      state.players[0].defeated = true;
      state.victoryReason = "All enemy Command Keeps destroyed";
      expect(battleResultReason(state)).toBe("Your Command Keep has fallen.");
    },
  );
  it("retains the won conquest reason", () => {
    const state = createGame();
    state.winner = 0;
    state.victoryReason = "All enemy Command Keeps destroyed";
    expect(battleResultReason(state)).toBe(state.victoryReason);
  });
  it("retains a score defeat where the Keep survived", () => {
    const state = createGame();
    state.winner = 1;
    state.victoryReason = "Relic domination";
    expect(battleResultReason(state)).toBe("Relic domination");
  });
  it("retains Rush reasons without inventing a Keep", () => {
    const state = createGame({ mode: "rush" });
    state.winner = 1;
    state.players[0].defeated = true;
    state.victoryReason = "The commander has fallen";
    const before = JSON.stringify(state);
    expect(battleResultReason(state)).toBe("The commander has fallen");
    expect(JSON.stringify(state)).toBe(before);
  });
});

it("retains allied victory after local elimination, while scripted missions still require the local keep", () => {
  const state = createGame({ aiPlayers: 2 });
  state.players[0].alliance = 0;
  state.players[2].alliance = 0;
  state.players[0].defeated = true;
  expect(battleResultReason(state)).toContain("allies are still fighting");
  state.winner = 2;
  state.victoryReason = "Allied frontier victory";
  expect(battleResultReason(state)).toBe(state.victoryReason);
  state.settings.scriptedVictory = true;
  expect(battleResultReason(state)).toBe("Your Command Keep has fallen.");
});


describe("defeat preparation advice", () => {
  it("responds to the local Keep loss even when the rival wins through conquest", () => {
    const state = createGame(); state.winner = 1; state.players[0].defeated = true;
    state.victoryReason = "All enemy Command Keeps destroyed";
    const before = JSON.stringify(state);
    expect(battleDefeatAdvice(state)?.title).toBe("Protect your keep");
    expect(battleDefeatAdvice(state)?.text).toContain("safe rally point");
    expect(JSON.stringify(state)).toBe(before);
  });
  it.each(["domination", "relic"] as const)("explains a %s score loss when the Keep survived", mode => {
    const state = createGame({ mode }); state.winner = 1;
    expect(battleDefeatAdvice(state)?.title).toBe("Contest the relics");
  });
  it("gives Rush movement advice without inventing a Keep", () => {
    const state = createGame({ mode: "rush" }); state.winner = 1;
    expect(battleDefeatAdvice(state)?.title).toBe("Keep moving");
    expect(battleDefeatAdvice(state)?.text).not.toContain("keep");
  });
  it("keeps scripted objectives distinct from an ordinary score race", () => {
    const state = createGame({ scriptedVictory: true }); state.winner = 1;
    expect(battleDefeatAdvice(state)?.title).toBe("Prepare your next push");
  });
  it("adds no defeat advice to live games or allied victories", () => {
    const state = createGame({ aiPlayers: 2 });
    expect(battleDefeatAdvice(state)).toBeNull();
    state.players[0].alliance = 0; state.players[2].alliance = 0; state.players[0].defeated = true; state.winner = 2;
    expect(battleDefeatAdvice(state)).toBeNull();
  });
});
