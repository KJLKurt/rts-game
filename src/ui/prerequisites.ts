import { BUILDINGS, UNITS } from "../sim/content";
import type { BuildingId, GameState, UnitId } from "../sim/types";
import { queuedConstructionPlans } from "./queued-construction";

export type BuildingRequirementState = "ready" | "missing" | "constructing" | "queued";

/** Display state only: incomplete and planned buildings never satisfy a requirement. */
export function buildingRequirementView(
  state: GameState,
  id: BuildingId,
  team = 0,
  projectedState?: GameState,
  selectedId?: string,
) {
  const buildings = state.entities.filter(entity =>
    entity.team === team && entity.kind === "building" && entity.type === id &&
    entity.hp > 0 && (!selectedId || entity.id === selectedId));
  const status: BuildingRequirementState = buildings.some(entity => entity.buildProgress >= 1)
    ? "ready"
    : buildings.some(entity => entity.buildProgress < 1)
      ? "constructing"
      : !selectedId && queuedConstructionPlans(state, team, projectedState).some(plan => plan.building === id)
        ? "queued"
        : "missing";
  const name = BUILDINGS[id].name;
  const shortLabel = {
    ready: "Ready",
    missing: "Not built",
    constructing: "Under construction",
    queued: "Queued · Resume to start",
  }[status];
  const label = {
    ready: `${name} ready`,
    missing: `Needs ${name}`,
    constructing: `${name} under construction`,
    queued: `${name} queued · Resume to start`,
  }[status];
  return { id, status, label, shortLabel };
}

/** Selected producers keep their existing routing; the Keep can also train infantry. */
export function recruitRequirementView(
  state: GameState,
  unit: UnitId,
  selectedId?: string,
  team = 0,
  projectedState?: GameState,
) {
  const selected = state.entities.find(entity =>
    entity.id === selectedId && entity.team === team && entity.kind === "building" &&
    entity.hp > 0 && BUILDINGS[entity.type as BuildingId]?.recruits.includes(unit));
  if (selected)
    return buildingRequirementView(state, selected.type as BuildingId, team, projectedState, selected.id);
  const primary = UNITS[unit].building;
  const candidates = [primary, ...Object.values(BUILDINGS)
    .filter(building => building.id !== primary && building.recruits.includes(unit))
    .map(building => building.id)]
    .map(id => buildingRequirementView(state, id, team, projectedState));
  return candidates.find(view => view.status === "ready") ??
    candidates.find(view => view.status === "constructing") ??
    candidates.find(view => view.status === "queued") ?? candidates[0];
}
