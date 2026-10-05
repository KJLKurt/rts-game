import { BUILDINGS, COMMANDERS, FACTIONS, UNITS } from "./content";
import { footprintsOverlap } from "./construction";
import type {
  MapPlayerSlot,
  MapRules,
  MapScenario,
  WorkshopMap,
} from "./scenario-types";
import type { Point } from "./types";

export const MAX_SCENARIO_ENTITIES = 512;
export const MAX_SCENARIO_CAMPS = 32;
export const SCENARIO_MAX_DURATION = 180;
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const fields = (value: Record<string, unknown>, allowed: string[]) =>
  Object.keys(value).every((key) => allowed.includes(key));
const finite = (value: unknown, min: number, max: number): value is number =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= min &&
  value <= max;
const integer = (value: unknown, min: number, max: number): value is number =>
  finite(value, min, max) && Number.isInteger(value);
const text = (value: unknown, max: number): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= max;
const known = (definitions: object, value: unknown) =>
  typeof value === "string" && Object.hasOwn(definitions, value);
const personalities = [
  "aggressive",
  "defensive",
  "economic",
  "raider",
  "expansionist",
  "adaptive",
];
const difficulties = ["easy", "normal", "hard", "brutal"];

/** Call after the containing JSON has passed validateDataSafety. Draft checks omit playability. */
export function validateMapPlayerSlots(
  input: unknown,
  playable = true,
): string[] {
  if (!Array.isArray(input) || input.length < 2 || input.length > 6)
    return ["Use between two and six player slots."];
  const errors: string[] = [];
  input.forEach((slot, index) => {
    if (
      !record(slot) ||
      !fields(slot, [
        "name",
        "controller",
        "alliance",
        "faction",
        "commander",
        "personality",
        "difficulty",
      ]) ||
      !text(slot.name, 80) ||
      !["human", "ai", "closed"].includes(slot.controller as string) ||
      !integer(slot.alliance, 0, 5) ||
      !known(FACTIONS, slot.faction) ||
      !known(COMMANDERS, slot.commander) ||
      !personalities.includes(slot.personality as string) ||
      !difficulties.includes(slot.difficulty as string)
    ) {
      errors.push(
        `Player ${index + 1} needs a valid name, controller, alliance, faction, commander, personality, and difficulty.`,
      );
      return;
    }
    if (index > 0 && slot.controller === "human")
      errors.push("Only player 1 can use human control in an offline match.");
    if (index === 0 && slot.controller === "closed")
      errors.push("Player 1 cannot be closed.");
  });
  if (!errors.length && playable) {
    const active = (input as MapPlayerSlot[]).filter(
      (slot) => slot.controller !== "closed",
    );
    if (active.length < 2)
      errors.push("Open at least two player slots before testing.");
    if (new Set(active.map((slot) => slot.alliance)).size < 2)
      errors.push("Assign at least two opposing alliances before testing.");
  }
  return errors;
}

export function validateMapRules(input: unknown): string[] {
  if (
    !record(input) ||
    !fields(input, [
      "mode",
      "duration",
      "populationCap",
      "startingGold",
      "startingWood",
      "startingForces",
      "scoreTarget",
      "gameSpeed",
      "incomeRate",
    ])
  )
    return ["Scenario rules contain an unsupported field."];
  const errors: string[] = [];
  if (!["domination", "conquest", "relic"].includes(input.mode as string))
    errors.push("Choose Domination, Conquest, or Relic race victory.");
  if (!finite(input.duration, 4, SCENARIO_MAX_DURATION))
    errors.push("Match duration must be between 4 and 180 minutes.");
  if (!integer(input.populationCap, 12, 200))
    errors.push("Army ceiling must be a whole number from 12 to 200.");
  if (
    !integer(input.startingGold, 0, 100_000) ||
    !integer(input.startingWood, 0, 100_000)
  )
    errors.push(
      "Starting gold and wood must be whole numbers from 0 to 100,000.",
    );
  if (!["standard", "authored"].includes(input.startingForces as string))
    errors.push("Choose standard or authored starting forces.");
  if (
    input.scoreTarget !== undefined &&
    !integer(input.scoreTarget, 100, 100_000)
  )
    errors.push("Score target must be a whole number from 100 to 100,000.");
  if (input.gameSpeed !== undefined && !finite(input.gameSpeed, 0.5, 2))
    errors.push("Game speed must be between 0.5× and 2×.");
  if (input.incomeRate !== undefined && !finite(input.incomeRate, 0.5, 3))
    errors.push("Income rate must be between 0.5× and 3×.");
  return errors;
}

export function validateMapScenario(
  input: unknown,
  width: number,
  height: number,
  spawnCount: number,
  playable = true,
): string[] {
  if (
    !record(input) ||
    !fields(input, [
      "version",
      "slots",
      "rules",
      "startingEntities",
      "camps",
    ]) ||
    input.version !== 1
  )
    return ["Scenario must use version 1 and supported declarative fields."];
  const errors = [
    ...validateMapPlayerSlots(input.slots, playable),
    ...validateMapRules(input.rules),
  ];
  if (!Array.isArray(input.slots) || input.slots.length !== spawnCount)
    errors.push("Every spawn must have exactly one player slot.");
  if (
    !Array.isArray(input.startingEntities) ||
    input.startingEntities.length > MAX_SCENARIO_ENTITIES
  )
    errors.push(
      `Use at most ${MAX_SCENARIO_ENTITIES} placed units and buildings.`,
    );
  if (!Array.isArray(input.camps) || input.camps.length > MAX_SCENARIO_CAMPS)
    errors.push(`Use at most ${MAX_SCENARIO_CAMPS} neutral camps.`);
  if (errors.length) return errors;
  const scenario = input as unknown as MapScenario,
    ids = new Set<string>();
  const point = (value: Record<string, unknown>) =>
    finite(value.x, 0, width) &&
    value.x < width &&
    finite(value.y, 0, height) &&
    value.y < height;
  for (const item of scenario.startingEntities as unknown[]) {
    if (
      !record(item) ||
      !fields(item, [
        "id",
        "x",
        "y",
        "team",
        "kind",
        "type",
        "buildingLevel",
      ]) ||
      !text(item.id, 128) ||
      ids.has(item.id) ||
      !point(item) ||
      !integer(item.team, 0, spawnCount - 1) ||
      !(
        (item.kind === "unit" && known(UNITS, item.type)) ||
        (item.kind === "building" && known(BUILDINGS, item.type)) ||
        (item.kind === "commander" && known(COMMANDERS, item.type))
      ) ||
      (item.buildingLevel !== undefined &&
        (item.kind !== "building" || !integer(item.buildingLevel, 1, 3)))
    ) {
      errors.push(
        "Placed entities need unique IDs, valid types, player indices, levels, and map coordinates.",
      );
      continue;
    }
    ids.add(item.id);
    if (playable && scenario.slots[item.team].controller === "closed")
      errors.push(
        `Move or remove ${item.id}: player ${item.team + 1} is closed.`,
      );
  }
  for (const camp of scenario.camps as unknown[]) {
    if (
      !record(camp) ||
      !fields(camp, [
        "id",
        "x",
        "y",
        "unit",
        "count",
        "radius",
        "rewardGold",
        "rewardWood",
      ]) ||
      !text(camp.id, 128) ||
      ids.has(camp.id) ||
      !point(camp) ||
      !known(UNITS, camp.unit) ||
      !integer(camp.count, 1, 12) ||
      !finite(camp.radius, 1, 8) ||
      !integer(camp.rewardGold, 0, 10_000) ||
      !integer(camp.rewardWood, 0, 10_000)
    ) {
      errors.push(
        "Neutral camps need unique IDs, valid units, 1–12 defenders, a 1–8 tile radius, and rewards from 0 to 10,000.",
      );
      continue;
    }
    ids.add(camp.id);
  }
  if (!errors.length && playable)
    scenario.slots.forEach((slot, team) => {
      if (slot.controller === "closed") return;
      const entities = scenario.startingEntities.filter(
        (item) => item.team === team,
      );
      const keeps = entities.filter(
        (item) => item.kind === "building" && item.type === "keep",
      );
      if (entities.filter((item) => item.kind === "commander").length > 1)
        errors.push(`Player ${team + 1} has more than one commander.`);
      const population = entities.reduce(
        (total, item) =>
          total + (item.kind === "unit" ? UNITS[item.type].population : 0),
        scenario.rules.startingForces === "standard" ? 4 : 0,
      );
      if (population > scenario.rules.populationCap)
        errors.push(
          `Player ${team + 1} starts with ${population} population, above the ${scenario.rules.populationCap} army ceiling.`,
        );
      if (scenario.rules.startingForces === "authored" && keeps.length !== 1)
        errors.push(
          `Player ${team + 1} needs exactly one Command Keep with authored starting forces.`,
        );
      if (
        scenario.rules.startingForces === "standard" &&
        (keeps.length || entities.some((item) => item.kind === "commander"))
      )
        errors.push(
          `Player ${team + 1} already receives a keep and commander. Choose authored starting forces to place your own.`,
        );
    });
  return errors;
}

/** Separate geometry checks keep incomplete, structurally safe drafts editable. */
export function validateScenarioGeometry(map: WorkshopMap): string[] {
  if (!map.scenario) return [];
  const structural = validateMapScenario(
    map.scenario,
    map.width,
    map.height,
    map.spawns.length,
    false,
  );
  if (structural.length) return structural;
  const { startingEntities, camps, slots, rules } = map.scenario,
    errors: string[] = [];
  const walkable = (x: number, y: number) =>
    x >= 0 &&
    y >= 0 &&
    x < map.width &&
    y < map.height &&
    !["water", "rock"].includes(
      map.tiles[Math.floor(y) * map.width + Math.floor(x)],
    );
  const buildable = (x: number, y: number) =>
    walkable(x, y) &&
    !["forest", "marsh"].includes(
      map.tiles[Math.floor(y) * map.width + Math.floor(x)],
    );
  const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
  const unitRadius = (type: string) =>
    type === "cavalry" ? 0.42 : type === "siege" ? 0.48 : 0.27;
  const buildings: (Point & {
    radius: number;
    id: string;
    authored: boolean;
    team: number;
  })[] = startingEntities.flatMap((item) =>
    item.kind === "building"
      ? [{ ...item, radius: BUILDINGS[item.type].size, authored: true }]
      : [],
  );
  if (rules.startingForces === "standard")
    map.spawns.forEach((spawn, team) => {
      if (slots[team].controller === "closed") return;
      const center = { x: map.width / 2 + 0.5, y: map.height / 2 + 0.5 },
        length = dist(spawn, center);
      const inward =
        length > 0.001
          ? {
              x: (center.x - spawn.x) / length,
              y: (center.y - spawn.y) / length,
            }
          : { x: 1, y: 0 };
      buildings.push({
        ...spawn,
        radius: BUILDINGS.keep.size,
        id: `Player ${team + 1} starting keep`,
        authored: false,
        team,
      });
      buildings.push({
        x: spawn.x - inward.x * 3 - inward.y * 3,
        y: spawn.y - inward.y * 3 + inward.x * 3,
        radius: BUILDINGS.barracks.size,
        id: `Player ${team + 1} starting barracks`,
        authored: false,
        team,
      });
    });
  for (const building of buildings.filter((item) => item.authored)) {
    let clear = true;
    for (
      let y = building.y - building.radius;
      y <= building.y + building.radius;
      y += 0.5
    )
      for (
        let x = building.x - building.radius;
        x <= building.x + building.radius;
        x += 0.5
      )
        if (!buildable(x, y)) clear = false;
    if (!clear)
      errors.push(
        `${building.id}: the full building footprint needs clear, dry ground inside the map.`,
      );
    if (
      buildings.some(
        (other) =>
          other !== building &&
          footprintsOverlap(building, building.radius, other, other.radius),
      )
    )
      errors.push(
        `${building.id}: leave a small gap between building footprints.`,
      );
    if (map.nodes.some((node) => dist(node, building) < building.radius + 1.4))
      errors.push(`${building.id}: leave room around the resource or relic.`);
  }
  for (const item of startingEntities.filter(
    (item) => item.kind !== "building",
  )) {
    if (!walkable(item.x, item.y))
      errors.push(`${item.id}: place troops on walkable terrain.`);
    if (
      buildings.some(
        (building) =>
          dist(item, building) <
          building.radius +
            (item.kind === "commander" ? 0.42 : unitRadius(item.type)),
      )
    )
      errors.push(`${item.id}: move this unit outside the building footprint.`);
  }
  for (const camp of camps) {
    if (!walkable(camp.x, camp.y))
      errors.push(`${camp.id}: the camp center needs walkable terrain.`);
    if (
      camp.x - camp.radius < 1 ||
      camp.y - camp.radius < 1 ||
      camp.x + camp.radius >= map.width - 1 ||
      camp.y + camp.radius >= map.height - 1
    )
      errors.push(
        `${camp.id}: move the camp and its patrol radius inside the map.`,
      );
    let room = 0;
    for (
      let y = Math.floor(camp.y - camp.radius);
      y <= Math.ceil(camp.y + camp.radius);
      y++
    )
      for (
        let x = Math.floor(camp.x - camp.radius);
        x <= Math.ceil(camp.x + camp.radius);
        x++
      )
        if (
          dist({ x: x + 0.5, y: y + 0.5 }, camp) <= camp.radius &&
          walkable(x, y) &&
          !buildings.some(
            (building) =>
              dist({ x: x + 0.5, y: y + 0.5 }, building) <
              building.radius + unitRadius(camp.unit),
          )
        )
          room++;
    if (room < camp.count)
      errors.push(
        `${camp.id}: clear enough walkable ground for all ${camp.count} defenders.`,
      );
  }
  if (errors.length) return [...new Set(errors)];
  // Individual legal footprints can collectively seal a route. Match runtime blocker clearance.
  const blocked = new Set<number>();
  for (const building of buildings)
    for (
      let y = Math.max(0, Math.floor(building.y - building.radius));
      y <= Math.min(map.height - 1, Math.floor(building.y + building.radius));
      y++
    )
      for (
        let x = Math.max(0, Math.floor(building.x - building.radius));
        x <= Math.min(map.width - 1, Math.floor(building.x + building.radius));
        x++
      )
        if (dist({ x: x + 0.5, y: y + 0.5 }, building) < building.radius + 0.25)
          blocked.add(y * map.width + x);
  const free = (x: number, y: number) =>
    walkable(x, y) && !blocked.has(Math.floor(y) * map.width + Math.floor(x));
  const access = (point: Point, radius: number) => {
    const candidates: number[] = [];
    for (
      let y = Math.max(0, Math.floor(point.y - radius));
      y <= Math.min(map.height - 1, Math.floor(point.y + radius));
      y++
    )
      for (
        let x = Math.max(0, Math.floor(point.x - radius));
        x <= Math.min(map.width - 1, Math.floor(point.x + radius));
        x++
      )
        if (dist({ x: x + 0.5, y: y + 0.5 }, point) <= radius && free(x, y))
          candidates.push(y * map.width + x);
    return candidates;
  };
  const firstKeep = buildings.find(
    (item) =>
      item.team === 0 &&
      (item.id.includes("starting keep") ||
        startingEntities.some(
          (entity) => entity.id === item.id && entity.type === "keep",
        )),
  );
  const start = firstKeep ?? map.spawns[0],
    initial = access(start, firstKeep ? firstKeep.radius + 1.5 : 2)[0];
  if (initial === undefined)
    return ["Player 1 needs an open route out of the starting position."];
  const seen = new Set([initial]),
    queue = [initial];
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head],
      x = current % map.width,
      y = Math.floor(current / map.width);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const index = (y + dy) * map.width + x + dx;
      if (free(x + dx, y + dy) && !seen.has(index)) {
        seen.add(index);
        queue.push(index);
      }
    }
  }
  for (const node of map.nodes)
    if (!seen.has(Math.floor(node.y) * map.width + Math.floor(node.x)))
      errors.push(
        `${node.id}: placed buildings block access to this resource or relic.`,
      );
  for (const item of [
    ...startingEntities.filter((item) => item.kind !== "building"),
    ...camps,
  ])
    if (!seen.has(Math.floor(item.y) * map.width + Math.floor(item.x)))
      errors.push(`${item.id}: clear a route to the rest of the battlefield.`);
  for (const building of buildings)
    if (
      !access(building, building.radius + 1.5).some((index) => seen.has(index))
    )
      errors.push(`${building.id}: leave an open route around this building.`);
  return [...new Set(errors)];
}

export function defaultMapRules(): MapRules {
  return {
    mode: "domination",
    duration: 18,
    populationCap: 80,
    startingGold: 230,
    startingWood: 260,
    startingForces: "standard",
  };
}
