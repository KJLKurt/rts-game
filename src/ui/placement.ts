import { BUILDINGS, canBuild } from "../sim";
import type { BuildingId, CommandResult, GameState } from "../sim/types";

/** Preview the same construction rules before accepting a tactical queue entry. */
export function plannedBuildResult(
  state: GameState,
  team: number,
  building: BuildingId,
  x: number,
  y: number,
): CommandResult {
  const current = canBuild(state, team, building, x, y);
  if (!current.ok) return current;
  for (const command of state.pendingCommands) {
    if (command.type !== "build" || command.team !== team) continue;
    const other = BUILDINGS[command.building];
    if (
      Math.hypot(command.x - x, command.y - y) <
      other.size + BUILDINGS[building].size + 1.2
    )
      return {
        ok: false,
        error: `Too close to your queued ${other.name}. Pick another spot.`,
      };
  }
  return current;
}
