import { isCompetitivePlayer } from "../sim/alliances";
import { BUILDINGS } from "../sim/content";
import { projectPendingCommands } from "../sim/engine";
import type { BuildingId, GameCommand, GameState } from "../sim/types";

/** Presentation-only geometry. A plan is never a live or selectable entity. */
export interface PlannedConstruction {
  readonly building: BuildingId;
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly size: number;
  readonly ordinal: number;
}

const NO_PLANS: readonly PlannedConstruction[] = Object.freeze([]);
type BuildCommand = Extract<GameCommand, { type: "build" }>;

/**
 * Describe only queued builds that the simulation actually materializes.
 * A supplied snapshot must be projectPendingCommands(state) for the current
 * queue; callers may share that projection with other planning readouts.
 */
export function queuedConstructionPlans(
  state: GameState,
  team = 0,
  projectedState?: GameState,
): readonly PlannedConstruction[] {
  const player = state.players[team];
  if (
    !state.paused ||
    state.winner !== null ||
    !Number.isInteger(team) ||
    !isCompetitivePlayer(player) ||
    player.defeated
  )
    return NO_PLANS;

  const commands = state.pendingCommands.filter(
    (command): command is BuildCommand =>
      command?.type === "build" &&
      command.team === team &&
      Object.hasOwn(BUILDINGS, command.building) &&
      command.building !== "keep" &&
      Number.isFinite(command.x) &&
      Number.isFinite(command.y) &&
      command.x >= 0 &&
      command.y >= 0 &&
      command.x < state.map.width &&
      command.y < state.map.height,
  );
  if (!commands.length) return NO_PLANS;

  let projected: GameState;
  try {
    projected = projectedState ?? projectPendingCommands(state);
  } catch {
    // A malformed/unavailable projection must not turn an order into a ghost.
    return NO_PLANS;
  }

  const existingIds = new Set(state.entities.map((entity) => entity.id));
  const plans: PlannedConstruction[] = [];
  // The simulator appends successful builds in command order. Reading those
  // additions also handles rejected duplicates and intervening job refunds.
  for (const entity of projected.entities) {
    if (
      existingIds.has(entity.id) ||
      entity.team !== team ||
      entity.kind !== "building" ||
      entity.hp <= 0 ||
      entity.buildProgress !== 0
    )
      continue;
    const index = commands.findIndex(
      (command) =>
        command.building === entity.type &&
        command.x === entity.x &&
        command.y === entity.y,
    );
    if (index < 0) continue;
    const [command] = commands.splice(index, 1);
    const definition = BUILDINGS[command.building];
    plans.push(
      Object.freeze({
        building: command.building,
        name: definition.name,
        x: entity.x,
        y: entity.y,
        size: definition.size,
        ordinal: plans.length + 1,
      }),
    );
  }
  return Object.freeze(plans);
}
