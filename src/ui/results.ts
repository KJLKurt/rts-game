import { hasPlayerSurrendered, playerAllianceWon, playerOutcomeStatus, SURRENDER_REASON } from "../sim/alliances";
import type { GameState } from "../sim/types";

/** Present the result from the local player’s perspective, including early elimination. */
export function battleResultReason(state: GameState): string {
  if (hasPlayerSurrendered(state)) return SURRENDER_REASON;
  if (playerOutcomeStatus(state) === "spectating")
    return "Your Command Keep has fallen. Your allies are still fighting.";
  if (!state.rush && !playerAllianceWon(state) && state.players[0].defeated)
    return "Your Command Keep has fallen.";
  return state.victoryReason || "The battle has ended.";
}

/** Short preparation advice for the loss that actually ended this battle. */
export function battleDefeatAdvice(state: GameState): { title: string; text: string } | null {
  if (hasPlayerSurrendered(state)) return null;
  if (playerOutcomeStatus(state) !== "lost") return null;
  if (state.rush)
    return { title: "Keep moving", text: "Dodge the marked strikes, use your abilities, and collect supplies while your squad handles nearby enemies." };
  if (state.players[0].defeated)
    return { title: "Protect your keep", text: "Gather a mixed army at a safe rally point before pushing forward. Defend nearby gold and timber so you can replace losses, and use a tower to cover the approach to your keep." };
  if (!state.settings.scriptedVictory && ["domination", "relic"].includes(state.settings.mode))
    return { title: "Contest the relics", text: "Capture and defend a relic to earn victory points. Keep reinforcements arriving, then contest another relic when your army is ready." };
  return { title: "Prepare your next push", text: "Gather a mixed army at a safe rally point, defend your supply points, and follow the battle objectives before advancing." };
}
