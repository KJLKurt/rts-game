import { describe, expect, it } from "vitest";
import { createGame } from "../src/sim";
import { battleResultReason } from "../src/ui/results";
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
