import type { GameState } from "../sim/types";

/** Present the result from the local player’s perspective, including early elimination. */
export function battleResultReason(state: GameState): string {
  if (!state.rush && state.winner !== 0 && state.players[0].defeated)
    return "Your Command Keep has fallen.";
  return state.victoryReason || "The battle has ended.";
}
