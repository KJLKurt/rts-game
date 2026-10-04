import { BUILDINGS, TECHNOLOGIES, UNITS } from "./content";
import type {
  BuildingId,
  Cost,
  Entity,
  GameState,
  ProductionItem,
  TechId,
  UnitId,
} from "./types";

export const PRODUCTION_QUEUE_LIMIT = 12;
export interface BuildingUpgrade {
  name: string;
  description: string;
  cost: Cost;
  time: number;
  health: number;
  population: number;
  production: number;
  damage: number;
  range: number;
}
const upgrade = (
  name: string,
  description: string,
  gold: number,
  wood: number,
  time: number,
  extra: Partial<BuildingUpgrade> = {},
): BuildingUpgrade => ({
  name,
  description,
  cost: { gold, wood },
  time,
  health: 0.25,
  population: 0,
  production: 0,
  damage: 0,
  range: 0,
  ...extra,
});
export const BUILDING_UPGRADES: Record<BuildingId, BuildingUpgrade[]> = {
  keep: [
    upgrade(
      "Stronghold",
      "+25% durability and 4 population capacity.",
      180,
      160,
      35,
      { population: 4 },
    ),
    upgrade(
      "Citadel",
      "+25% durability and another 4 population capacity.",
      300,
      240,
      45,
      { population: 4 },
    ),
  ],
  house: [
    upgrade(
      "Townhouse",
      "+4 population capacity and 25% durability.",
      40,
      60,
      15,
      { population: 4 },
    ),
    upgrade(
      "Manor",
      "+4 population capacity and another 25% durability.",
      75,
      90,
      20,
      { population: 4 },
    ),
  ],
  barracks: [
    upgrade(
      "Drill Hall",
      "Trains troops 15% faster. +25% durability.",
      90,
      90,
      25,
      { production: 0.15 },
    ),
    upgrade(
      "War Academy",
      "Another 15% faster training and 25% durability.",
      150,
      120,
      35,
      { production: 0.15 },
    ),
  ],
  range: [
    upgrade(
      "Bowyer’s Hall",
      "Trains troops 15% faster. +25% durability.",
      90,
      100,
      25,
      { production: 0.15 },
    ),
    upgrade(
      "Ranger Lodge",
      "Another 15% faster training and 25% durability.",
      150,
      140,
      35,
      { production: 0.15 },
    ),
  ],
  stable: [
    upgrade(
      "Breeding Grounds",
      "Trains cavalry 15% faster. +25% durability.",
      120,
      100,
      30,
      { production: 0.15 },
    ),
    upgrade(
      "Royal Stables",
      "Another 15% faster training and 25% durability.",
      190,
      150,
      40,
      { production: 0.15 },
    ),
  ],
  workshop: [
    upgrade(
      "Runic Foundry",
      "Builds siege 15% faster. +25% durability.",
      150,
      130,
      35,
      { production: 0.15 },
    ),
    upgrade(
      "Grand Foundry",
      "Another 15% faster production and 25% durability.",
      220,
      180,
      45,
      { production: 0.15 },
    ),
  ],
  tower: [
    upgrade(
      "Guard Tower",
      "+15% damage, +0.5 range and +25% durability.",
      85,
      100,
      25,
      { damage: 0.15, range: 0.5 },
    ),
    upgrade(
      "Runic Bastion",
      "Another +15% damage, +0.5 range and +25% durability.",
      140,
      150,
      35,
      { damage: 0.15, range: 0.5 },
    ),
  ],
  depot: [
    upgrade(
      "Warehouse",
      "Nearby deposit bonus rises from 35% to 50%. +25% durability.",
      90,
      110,
      25,
    ),
    upgrade(
      "Trade Hub",
      "Nearby deposit bonus rises to 65%. +25% durability.",
      160,
      170,
      35,
    ),
  ],
  blacksmith: [
    upgrade(
      "Master Forge",
      "Research completes 15% faster. +25% durability.",
      120,
      100,
      30,
      { production: 0.15 },
    ),
    upgrade(
      "Runic Forge",
      "Another 15% faster research and 25% durability.",
      200,
      160,
      40,
      { production: 0.15 },
    ),
  ],
};
export function buildingLevel(entity: Entity) {
  return entity.buildingLevel ?? 1;
}
export function buildingUpgrades(entity: Entity): BuildingUpgrade[] {
  return entity.kind === "building" && entity.type !== "turret"
    ? BUILDING_UPGRADES[entity.type as BuildingId]
    : [];
}
export function nextBuildingUpgrade(entity: Entity) {
  return buildingUpgrades(entity)[buildingLevel(entity) - 1];
}
export function buildingPopulation(entity: Entity) {
  return (
    BUILDINGS[entity.type as BuildingId].population +
    buildingUpgrades(entity)
      .slice(0, buildingLevel(entity) - 1)
      .reduce((n, u) => n + u.population, 0)
  );
}
export function productionRate(entity: Entity) {
  return (
    1 +
    buildingUpgrades(entity)
      .slice(0, buildingLevel(entity) - 1)
      .reduce((n, u) => n + u.production, 0)
  );
}
export function technologyCost(
  state: GameState,
  team: number,
  id: TechId,
): Cost {
  const multiplier = (state.players[team].research[id] ?? 0) + 1,
    base = TECHNOLOGIES[id].cost;
  return { gold: base.gold * multiplier, wood: base.wood * multiplier };
}
export function queueItemCost(
  state: GameState,
  entity: Entity,
  item: ProductionItem,
): Cost {
  if (item.paidCost) return { ...item.paidCost };
  if (item.type === "buildingUpgrade")
    return {
      ...(BUILDING_UPGRADES[entity.type as BuildingId][
        buildingLevel(entity) - 1
      ]?.cost ?? { gold: 0, wood: 0 }),
    };
  if (item.type === "research")
    return technologyCost(state, entity.team, item.id as TechId);
  const cost = UNITS[item.id as UnitId].cost;
  const faction = state.players[entity.team].faction;
  const multiplier =
    faction === "wildborn" ? 0.9 : faction === "arcanists" ? 1.03 : 1;
  return {
    gold: Math.ceil(cost.gold * multiplier),
    wood: Math.ceil(cost.wood * multiplier),
  };
}
/** Unstarted jobs refund fully; completed work is paid proportionally. */
export function productionRefund(
  state: GameState,
  entity: Entity,
  item: ProductionItem,
): Cost {
  const cost = queueItemCost(state, entity, item),
    fraction = Math.max(0, Math.min(1, item.remaining / item.total));
  return {
    gold: Math.floor(cost.gold * fraction + 1e-6),
    wood: Math.floor(cost.wood * fraction + 1e-6),
  };
}
export function populationBreakdown(state: GameState, team = 0) {
  let fielded = 0,
    reserved = 0;
  for (const e of state.entities)
    if (e.team === team && e.hp > 0) {
      if (e.kind === "unit") fielded += UNITS[e.type as UnitId].population;
      for (const q of e.queue)
        if (q.type === "unit") reserved += UNITS[q.id as UnitId].population;
    }
  return {
    fielded,
    reserved,
    capacity: state.players[team].populationCap,
    ceiling: state.players[team].maxPopulation,
  };
}
