import { playerAllianceWon, playerOutcomeStatus } from "../sim/alliances";
import type { GameState } from "../sim/types";

/** Present the result from the local player’s perspective, including early elimination. */
export function battleResultReason(state: GameState): string {
  if (playerOutcomeStatus(state) === "spectating")
    return "Your Command Keep has fallen. Your allies are still fighting.";
  if (!state.rush && !playerAllianceWon(state) && state.players[0].defeated)
    return "Your Command Keep has fallen.";
  return state.victoryReason || "The battle has ended.";
}
