import { COMMANDERS, UNITS } from "../sim/content";
import type { CommanderId, Entity, GameState, UnitId } from "../sim/types";

const unitOrder = Object.keys(UNITS);
const commanderOrder = Object.keys(COMMANDERS);
const typeRank = (entity: Entity) =>
  entity.kind === "commander"
    ? commanderOrder.indexOf(entity.type)
    : commanderOrder.length + unitOrder.indexOf(entity.type);

export interface TroopSelectionGroup {
  typeKey: string;
  label: string;
  entities: Entity[];
  total: number;
  selectedCount: number;
  checked: boolean;
  indeterminate: boolean;
}

/** A sorted view of living troops owned by this player, never allied armies. */
export function selectableTroops(state: GameState, team = 0): Entity[] {
  const seen = new Set<string>();
  return state.entities
    .filter((entity) => {
      if (
        entity.team !== team ||
        !(entity.hp > 0) ||
        entity.kind === "building" ||
        (entity.kind === "commander" && entity.respawnAt !== null) ||
        seen.has(entity.id)
      )
        return false;
      seen.add(entity.id);
      return true;
    })
    .sort(
      (a, b) =>
        typeRank(a) - typeRank(b) ||
        a.type.localeCompare(b.type, "en") ||
        a.id.localeCompare(b.id, "en", { numeric: true }) ||
        a.id.localeCompare(b.id, "en"),
    );
}

/** Resolve a snapshot of exact IDs. No type-based intent or future recruits persist. */
export function pruneTroopSelection(
  state: GameState,
  ids: Iterable<string>,
  team = 0,
): string[] {
  const selected = new Set(ids);
  return selectableTroops(state, team)
    .filter((entity) => selected.has(entity.id))
    .map((entity) => entity.id);
}

export function toggleTroop(
  state: GameState,
  ids: Iterable<string>,
  id: string,
  team = 0,
): string[] {
  const selected = new Set(ids);
  if (selected.has(id)) selected.delete(id);
  else selected.add(id);
  return pruneTroopSelection(state, selected, team);
}

export function setTroopTypeSelection(
  state: GameState,
  ids: Iterable<string>,
  typeKey: string,
  checked: boolean,
  team = 0,
): string[] {
  const selected = new Set(ids);
  for (const entity of selectableTroops(state, team)) {
    if (entity.type !== typeKey) continue;
    if (checked) selected.add(entity.id);
    else selected.delete(entity.id);
  }
  return pruneTroopSelection(state, selected, team);
}

export function troopSelectionGroups(
  state: GameState,
  ids: Iterable<string>,
  team = 0,
): TroopSelectionGroup[] {
  const selected = new Set(ids);
  const groups = new Map<string, TroopSelectionGroup>();
  for (const entity of selectableTroops(state, team)) {
    let group = groups.get(entity.type);
    if (!group) {
      group = {
        typeKey: entity.type,
        label:
          entity.kind === "commander"
            ? `Commander · ${COMMANDERS[entity.type as CommanderId]?.name ?? "Commander"}`
            : (UNITS[entity.type as UnitId]?.name ?? entity.type),
        entities: [],
        total: 0,
        selectedCount: 0,
        checked: false,
        indeterminate: false,
      };
      groups.set(entity.type, group);
    }
    group.entities.push(entity);
    group.total++;
    if (selected.has(entity.id)) group.selectedCount++;
  }
  return [...groups.values()].map((group) => ({
    ...group,
    checked: group.selectedCount === group.total,
    indeterminate: group.selectedCount > 0 && group.selectedCount < group.total,
  }));
}
