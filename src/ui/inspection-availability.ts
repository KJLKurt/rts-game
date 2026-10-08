import {
  BUILDINGS,
  TECHNOLOGIES,
  UNITS,
  PRODUCTION_QUEUE_LIMIT,
  getUnitCost,
  isCompetitivePlayer,
  nextBuildingUpgrade,
  populationBreakdown,
  technologyCost,
} from "../sim";
import type {
  BuildingId,
  Cost,
  Entity,
  GameState,
  TechId,
  UnitId,
} from "../sim";

export interface InspectionActionAvailability {
  available: boolean;
  reason: string;
}

const availability = (reason = ""): InspectionActionAvailability => ({
  available: !reason,
  reason,
});

/** State must already include any tactical-planning reservations. Never simulates commands. */
export function buildingInspectionAvailability(
  state: GameState,
  producer: Entity,
  tacticalQueueFull = state.paused && state.pendingCommands.length >= 60,
) {
  const player = state.players[producer.team];
  const restricted =
    state.winner !== null
      ? "The battle has ended."
      : !isCompetitivePlayer(player) || player.defeated
        ? "Player is not active."
        : tacticalQueueFull
          ? "Tactical queue full (60/60). Resume to execute planned orders."
          : state.rush
            ? "In Rush Arena, find supplies and choose field upgrades."
            : "";
  const construction =
    producer.buildProgress < 1 ? "Finish construction first." : "";
  const queueFull =
    producer.queue.length >= PRODUCTION_QUEUE_LIMIT
      ? `Production queue full (${PRODUCTION_QUEUE_LIMIT}/${PRODUCTION_QUEUE_LIMIT}). Wait or cancel a job.`
      : "";
  // Full required prices keep explanations stable while income accumulates below a threshold.
  const resources = (cost: Cost): string => {
    const missing = [
      ...(player.gold < cost.gold ? [`${cost.gold} gold`] : []),
      ...(player.wood < cost.wood ? [`${cost.wood} wood`] : []),
    ];
    return missing.length ? `Requires ${missing.join(" and ")} total.` : "";
  };
  const population = populationBreakdown(state, producer.team);
  const free = population.capacity - population.fielded - population.reserved;
  const recruits: Partial<Record<UnitId, InspectionActionAvailability>> = {};
  for (const id of BUILDINGS[producer.type as BuildingId].recruits) {
    const needed = UNITS[id].population;
    const capacity =
      free < needed
        ? `Needs ${needed} free population. ${
            population.capacity >= population.ceiling
              ? `Match ceiling ${population.ceiling} reached; Houses cannot raise it.`
              : "Build or upgrade a House for more capacity."
          }`
        : "";
    recruits[id] = availability(
      restricted ||
        construction ||
        queueFull ||
        resources(getUnitCost(state, producer.team, id)) ||
        capacity,
    );
  }

  const research: Partial<Record<TechId, InspectionActionAvailability>> = {};
  const queuedResearch = new Set(
    state.entities
      .filter((entity) => entity.team === producer.team)
      .flatMap((entity) =>
        entity.queue
          .filter((job) => job.type === "research")
          .map((job) => job.id),
      ),
  );
  for (const tech of Object.values(TECHNOLOGIES).filter(
    (tech) => tech.building === producer.type,
  )) {
    research[tech.id] = availability(
      restricted ||
        ((player.research[tech.id] ?? 0) >= tech.maxLevel
          ? "Research is complete."
          : "") ||
        (queuedResearch.has(tech.id)
          ? "Research is already queued for your army."
          : "") ||
        construction ||
        queueFull ||
        resources(technologyCost(state, producer.team, tech.id)),
    );
  }

  const next = nextBuildingUpgrade(producer);
  const upgrade = availability(
    restricted ||
      construction ||
      (!next ? "This building has reached its maximum level." : "") ||
      (producer.queue.some((job) => job.type === "buildingUpgrade")
        ? "Building upgrade is already queued."
        : "") ||
      queueFull ||
      (next ? resources(next.cost) : ""),
  );
  return { recruits, research, upgrade };
}

/** Invalidates inspector controls only at availability/status thresholds, never every income tick. */
export function inspectionAvailabilitySignature(
  state: GameState,
  selection: Iterable<string>,
  tacticalQueueFull = state.paused && state.pendingCommands.length >= 60,
): string {
  const chosen = new Set(selection);
  const entities = state.entities.filter(
    (entity) => chosen.has(entity.id) && entity.hp > 0,
  );
  if (
    entities.length !== 1 ||
    entities[0].kind !== "building" ||
    entities[0].type === "turret"
  )
    return "";
  const producer = entities[0];
  const view = buildingInspectionAvailability(
    state,
    producer,
    tacticalQueueFull,
  );
  return JSON.stringify([
    producer.id,
    Object.values(view.recruits).map((action) => action.reason),
    Object.values(view.research).map((action) => action.reason),
    view.upgrade.reason,
  ]);
}
