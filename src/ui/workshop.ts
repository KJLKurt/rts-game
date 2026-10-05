import {
  BIOMES,
  BUILDINGS,
  COMMANDERS,
  DEFAULT_SETTINGS,
  FACTIONS,
  UNITS,
} from "../sim/content";
import { snapConstruction } from "../sim/construction";
import {
  createGame,
  hydrateScenarioEntities,
  spawnEntity,
} from "../sim/engine";
import { isWalkable, validateMap } from "../sim/maps";
import { validateScaleSettings } from "../sim/scales";
import {
  defaultMapRules,
  validateMapPlayerSlots,
  validateMapRules,
  validateMapScenario,
  validateScenarioGeometry,
  MAX_SCENARIO_CAMPS,
  MAX_SCENARIO_ENTITIES,
} from "../sim/scenarios";
import type {
  MapEntityPlacement,
  MapNeutralCamp,
  MapPlayerSlot,
  MapRules,
  MapScenario,
  WorkshopMap,
} from "../sim/scenario-types";
import type {
  BiomeId,
  BuildingId,
  CommanderId,
  GameMap,
  GameSettings,
  GameState,
  MapValidation,
  Point,
  ResourceNode,
  TerrainType,
  UnitId,
} from "../sim/types";
import {
  MAX_MAP_JSON_BYTES,
  MAX_SAVE_JSON_BYTES,
  parseBoundedJSON,
  validateDataSafety,
  validateMapStructure,
} from "../sim/validation";

export type {
  MapEntityPlacement,
  MapNeutralCamp,
  MapPlayerSlot,
  MapRules,
  MapScenario,
  WorkshopMap,
};
export const WORKSHOP_LIBRARY_KEY = "workshop-library-v1";
export const WORKSHOP_MAX_SAVED_MAPS = 24;
const terrains: TerrainType[] = [
  "grass",
  "forest",
  "water",
  "rock",
  "sand",
  "snow",
  "road",
  "marsh",
];
const copy = <T>(value: T): T => structuredClone(value);
const fail = (errors: string[]) => {
  if (errors.length) throw new Error(errors.join(" "));
};
const finite = (value: number, minimum: number, maximum: number) =>
  Number.isFinite(value) && value >= minimum && value <= maximum;
const cleanName = (value: string) => {
  const name = value.trim();
  if (!name || name.length > 120)
    throw new Error("Give your map a name between 1 and 120 characters.");
  return name;
};
const snappedTile = (point: Point) => ({
  x: Math.floor(point.x) + 0.5,
  y: Math.floor(point.y) + 0.5,
});
const inMap = (map: GameMap, point: Point, inset = 0) =>
  finite(point.x, inset, map.width - inset) &&
  finite(point.y, inset, map.height - inset) &&
  point.x < map.width - inset &&
  point.y < map.height - inset;
const defaultSlot = (
  index: number,
  settings: Partial<GameSettings> = {},
): MapPlayerSlot => ({
  name: index === 0 ? "You" : `Rival ${index}`,
  controller: index === 0 && !settings.aiControlPlayer ? "human" : "ai",
  alliance: index,
  faction:
    index === 0
      ? (settings.faction ?? DEFAULT_SETTINGS.faction)
      : (["ironhold", "wildborn", "arcanists"] as const)[index % 3],
  commander:
    index === 0
      ? (settings.commander ?? DEFAULT_SETTINGS.commander)
      : (["warlord", "ranger", "engineer"] as const)[index % 3],
  personality: settings.aiPersonality ?? "adaptive",
  difficulty: settings.difficulty ?? "normal",
});
function bareMap(map: WorkshopMap): GameMap {
  const { scenario: _scenario, ...terrainMap } = map;
  return terrainMap;
}

/** Unfinished drafts can be safe to reopen even though they cannot start a match. */
export function validateWorkshopStructure(input: unknown): string[] {
  const safety = validateDataSafety(input, 100_000);
  if (safety.length) return safety;
  if (!input || typeof input !== "object" || Array.isArray(input))
    return ["Choose a Frontier map JSON object."];
  const map = input as WorkshopMap,
    errors = validateMapStructure(bareMap(map));
  if (errors.length) return errors;
  return map.scenario === undefined
    ? []
    : validateMapScenario(
        map.scenario,
        map.width,
        map.height,
        map.spawns.length,
        false,
      );
}
export function ensureWorkshopMap(
  input: GameMap,
  settings: Partial<GameSettings> = {},
): WorkshopMap {
  fail(validateWorkshopStructure(input));
  const map = copy(input) as WorkshopMap;
  map.name = map.name ?? map.seed;
  if (!map.scenario)
    map.scenario = {
      version: 1,
      slots: map.spawns.map((_, index) => defaultSlot(index, settings)),
      rules: {
        ...defaultMapRules(),
        mode:
          settings.mode && settings.mode !== "rush"
            ? settings.mode
            : "domination",
        duration: settings.duration ?? DEFAULT_SETTINGS.duration,
        populationCap: settings.populationCap ?? DEFAULT_SETTINGS.populationCap,
        startingGold: settings.startingGold ?? DEFAULT_SETTINGS.startingGold,
        startingWood: settings.startingWood ?? DEFAULT_SETTINGS.startingWood,
      },
      startingEntities: [],
      camps: [],
    };
  return map;
}
export function validateWorkshopMap(
  map: WorkshopMap,
  competitive = false,
): MapValidation {
  const structural = validateWorkshopStructure(map);
  if (structural.length)
    return {
      valid: false,
      errors: structural,
      warnings: [],
      fairness: 0,
      reachablePercent: 0,
    };
  const result = validateMap(map, competitive);
  if (map.scenario) {
    result.errors.push(
      ...validateMapScenario(
        map.scenario,
        map.width,
        map.height,
        map.spawns.length,
      ),
      ...validateScenarioGeometry(map),
      ...validateScaleSettings({
        ...map.scenario.rules,
        slots: map.scenario.slots,
      }),
    );
    if (map.scenario.rules.startingForces === "authored")
      map.scenario.slots.forEach((slot, team) => {
        if (
          slot.controller !== "closed" &&
          !map.scenario!.startingEntities.some(
            (item) => item.team === team && item.kind === "commander",
          )
        )
          result.warnings.push(
            `Player ${team + 1} starts without a commander; direct control and abilities will be unavailable.`,
          );
      });
  }
  result.errors = [...new Set(result.errors)];
  result.valid = result.errors.length === 0;
  return result;
}

/** Crop terrain when shrinking, but never silently discard an authored object. */
export function resizeWorkshopMap(
  input: WorkshopMap,
  width: number,
  height: number,
  options: { anchor?: "center" | "northwest" } = {},
): WorkshopMap {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 16 ||
    height < 16 ||
    width > 160 ||
    height > 160
  )
    throw new Error("Map dimensions must be whole numbers from 16 to 160.");
  const map = ensureWorkshopMap(input);
  if (width === map.width && height === map.height) return map;
  const dx =
      options.anchor === "northwest" ? 0 : Math.floor((width - map.width) / 2),
    dy =
      options.anchor === "northwest"
        ? 0
        : Math.floor((height - map.height) / 2);
  const move = <T extends Point>(point: T): T => ({
    ...point,
    x: point.x + dx,
    y: point.y + dy,
  });
  const resized: WorkshopMap = {
    ...map,
    width,
    height,
    tiles: Array(width * height).fill(BIOMES[map.biome].primary),
    spawns: map.spawns.map(move),
    nodes: map.nodes.map(move),
    scenario: {
      ...map.scenario!,
      startingEntities: map.scenario!.startingEntities.map(move),
      camps: map.scenario!.camps.map(move),
    },
  };
  const objects: (Point & { label: string; margin: number })[] = [
    ...resized.spawns.map((point, index) => ({
      ...point,
      label: `Player ${index + 1} spawn`,
      margin: resized.scenario!.rules.startingForces === "standard" ? 4 : 1,
    })),
    ...resized.nodes.map((node) => ({ ...node, label: node.id, margin: 1 })),
    ...resized.scenario!.startingEntities.map((item) => ({
      ...item,
      label: item.id,
      margin: item.kind === "building" ? BUILDINGS[item.type].size + 1 : 1,
    })),
    ...resized.scenario!.camps.map((camp) => ({
      ...camp,
      label: camp.id,
      margin: camp.radius + 1,
    })),
  ];
  const outside = objects.find((item) => !inMap(resized, item, item.margin));
  if (outside)
    throw new Error(
      `${outside.label} would be cut off. Move it toward the center or choose a larger map.`,
    );
  for (let y = 1; y < map.height - 1; y++)
    for (let x = 1; x < map.width - 1; x++) {
      const nx = x + dx,
        ny = y + dy;
      if (nx > 0 && ny > 0 && nx < width - 1 && ny < height - 1)
        resized.tiles[ny * width + nx] = map.tiles[y * map.width + x];
    }
  for (let x = 0; x < width; x++) {
    resized.tiles[x] = "rock";
    resized.tiles[(height - 1) * width + x] = "rock";
  }
  for (let y = 0; y < height; y++) {
    resized.tiles[y * width] = "rock";
    resized.tiles[y * width + width - 1] = "rock";
  }
  resized.validation = validateWorkshopMap(resized);
  return resized;
}
export function setWorkshopBiome(
  input: WorkshopMap,
  biome: BiomeId,
  replaceGround = true,
): WorkshopMap {
  if (!Object.hasOwn(BIOMES, biome))
    throw new Error("Choose a supported biome.");
  const map = ensureWorkshopMap(input),
    previous = BIOMES[map.biome].primary;
  if (replaceGround)
    map.tiles = map.tiles.map((tile) =>
      tile === previous ? BIOMES[biome].primary : tile,
    );
  map.biome = biome;
  return map;
}
export function updateWorkshopRules(
  input: WorkshopMap,
  patch: Partial<MapRules>,
): WorkshopMap {
  const map = ensureWorkshopMap(input),
    rules = { ...map.scenario!.rules, ...patch };
  fail(validateMapRules(rules));
  map.scenario!.rules = rules;
  return map;
}
export function updateWorkshopSlot(
  input: WorkshopMap,
  index: number,
  patch: Partial<MapPlayerSlot>,
): WorkshopMap {
  const map = ensureWorkshopMap(input);
  if (!Number.isInteger(index) || !map.scenario!.slots[index])
    throw new Error("Choose an existing player slot.");
  map.scenario!.slots[index] = { ...map.scenario!.slots[index], ...patch };
  fail(validateMapPlayerSlots(map.scenario!.slots, false));
  return map;
}
/** Slot removal requires reassignment first, preserving ownership and all retained indices. */
export function setWorkshopSlotCount(
  input: WorkshopMap,
  count: number,
): WorkshopMap {
  if (!Number.isInteger(count) || count < 2 || count > 6)
    throw new Error("Use between two and six player slots.");
  const map = ensureWorkshopMap(input),
    scenario = map.scenario!;
  if (
    count < map.spawns.length &&
    (scenario.startingEntities.some((item) => item.team >= count) ||
      map.nodes.some(
        (node) =>
          (node.owner !== null && node.owner >= count) ||
          (node.captureTeam !== null && node.captureTeam >= count),
      ))
  )
    throw new Error(
      "Reassign or erase objects owned by the removed players first.",
    );
  for (let index = map.spawns.length; index < count; index++) {
    const angle = Math.PI + (index * Math.PI * 2) / count;
    map.spawns.push(
      snappedTile({
        x: map.width / 2 + Math.cos(angle) * (map.width / 2 - 7),
        y: map.height / 2 + Math.sin(angle) * (map.height / 2 - 7),
      }),
    );
    scenario.slots.push(defaultSlot(index));
  }
  map.spawns.length = count;
  scenario.slots.length = count;
  return map;
}
const uniqueId = (map: WorkshopMap, prefix: string) => {
  const ids = new Set(
    [
      ...map.nodes,
      ...(map.scenario?.startingEntities ?? []),
      ...(map.scenario?.camps ?? []),
    ].map((item) => item.id),
  );
  let suffix = 1;
  while (ids.has(`${prefix}-${suffix}`)) suffix++;
  return `${prefix}-${suffix}`;
};
type NewPlacement<T> = T extends MapEntityPlacement
  ? Omit<T, "id"> & { id?: string }
  : never;
export type WorkshopEntityInput = NewPlacement<MapEntityPlacement>;

/** Supplying an existing authored ID moves/edits that object; no ID creates one. */
export function placeWorkshopEntity(
  input: WorkshopMap,
  placement: WorkshopEntityInput,
): WorkshopMap {
  const map = ensureWorkshopMap(input),
    scenario = map.scenario!;
  const entity = {
    ...placement,
    ...(placement.kind === "building"
      ? snapConstruction(placement)
      : snappedTile(placement)),
    id: placement.id ?? uniqueId(map, placement.kind),
  } as MapEntityPlacement;
  const index = scenario.startingEntities.findIndex(
    (item) => item.id === entity.id,
  );
  if (index < 0 && scenario.startingEntities.length >= MAX_SCENARIO_ENTITIES)
    throw new Error(
      `A map can contain at most ${MAX_SCENARIO_ENTITIES} placed entities.`,
    );
  if (index < 0) scenario.startingEntities.push(entity);
  else scenario.startingEntities[index] = entity;
  fail(
    validateMapScenario(
      scenario,
      map.width,
      map.height,
      map.spawns.length,
      false,
    ),
  );
  if (scenario.slots[entity.team].controller === "closed")
    throw new Error("Open that player slot before placing its forces.");
  if (
    scenario.rules.startingForces === "standard" &&
    (entity.kind === "commander" ||
      (entity.kind === "building" && entity.type === "keep"))
  )
    throw new Error(
      "Standard forces already include a keep and commander. Choose authored starting forces to place your own.",
    );
  if (
    scenario.startingEntities.filter(
      (item) => item.team === entity.team && item.kind === "commander",
    ).length > 1
  )
    throw new Error(
      "Each player can have only one commander. Erase or move the existing commander first.",
    );
  fail(
    validateScenarioGeometry(map).filter((error) =>
      error.startsWith(`${entity.id}:`),
    ),
  );
  return map;
}
export function placeWorkshopCamp(
  input: WorkshopMap,
  placement: Omit<MapNeutralCamp, "id"> & { id?: string },
): WorkshopMap {
  const map = ensureWorkshopMap(input),
    scenario = map.scenario!;
  const camp: MapNeutralCamp = {
    ...placement,
    ...snappedTile(placement),
    id: placement.id ?? uniqueId(map, "camp"),
  };
  const index = scenario.camps.findIndex((item) => item.id === camp.id);
  if (index < 0 && scenario.camps.length >= MAX_SCENARIO_CAMPS)
    throw new Error(
      `A map can contain at most ${MAX_SCENARIO_CAMPS} neutral camps.`,
    );
  if (index < 0) scenario.camps.push(camp);
  else scenario.camps[index] = camp;
  fail(
    validateMapScenario(
      scenario,
      map.width,
      map.height,
      map.spawns.length,
      false,
    ),
  );
  fail(
    validateScenarioGeometry(map).filter((error) =>
      error.startsWith(`${camp.id}:`),
    ),
  );
  return map;
}
export function placeWorkshopNode(
  input: WorkshopMap,
  kind: ResourceNode["kind"],
  point: Point,
  options: {
    id?: string;
    owner?: number | null;
    amount?: number;
    income?: number;
    radius?: number;
  } = {},
): WorkshopMap {
  const map = ensureWorkshopMap(input),
    position = snappedTile(point);
  if (!inMap(map, position, 1) || !isWalkable(map, position.x, position.y))
    throw new Error(
      "Place resources and relics on walkable ground inside the map.",
    );
  const amount = kind === "relic" ? 0 : (options.amount ?? 1600);
  const node: ResourceNode = {
    ...position,
    id: options.id ?? uniqueId(map, kind),
    kind,
    owner: options.owner ?? null,
    captureTeam: null,
    captureProgress: 0,
    radius: options.radius ?? 2.2,
    income:
      kind === "relic" ? 0 : (options.income ?? (kind === "gold" ? 2.1 : 2.35)),
    amount,
    maxAmount: amount,
  };
  const index = map.nodes.findIndex((item) => item.id === node.id);
  if (
    index < 0 &&
    map.nodes.some((item) => Math.hypot(item.x - node.x, item.y - node.y) < 1)
  )
    throw new Error(
      "A resource or relic is already here. Erase it or choose another tile.",
    );
  if (index < 0) map.nodes.push(node);
  else map.nodes[index] = node;
  fail(validateWorkshopStructure(map));
  if (
    map.scenario!.startingEntities.some(
      (item) =>
        item.kind === "building" &&
        Math.hypot(item.x - node.x, item.y - node.y) <
          BUILDINGS[item.type].size + 1.4,
    )
  )
    throw new Error("Leave room between resources and buildings.");
  return map;
}
export function eraseWorkshopObjects(
  input: WorkshopMap,
  point: Point,
  radius = 0.8,
): WorkshopMap {
  if (!inMap(input, point) || !finite(radius, 0, 12))
    throw new Error(
      "Choose a point on the map and an erase radius from 0 to 12 tiles.",
    );
  const map = ensureWorkshopMap(input),
    keep = (item: Point) =>
      Math.hypot(item.x - point.x, item.y - point.y) > radius;
  map.nodes = map.nodes.filter(keep);
  map.scenario!.startingEntities = map.scenario!.startingEntities.filter(keep);
  map.scenario!.camps = map.scenario!.camps.filter(keep);
  return map;
}
export function removeWorkshopObject(
  input: WorkshopMap,
  id: string,
): WorkshopMap {
  const map = ensureWorkshopMap(input);
  map.nodes = map.nodes.filter((item) => item.id !== id);
  map.scenario!.startingEntities = map.scenario!.startingEntities.filter(
    (item) => item.id !== id,
  );
  map.scenario!.camps = map.scenario!.camps.filter((item) => item.id !== id);
  return map;
}
export function importWorkshopMap(text: string): WorkshopMap {
  const map = parseBoundedJSON(text, MAX_MAP_JSON_BYTES);
  fail(validateWorkshopStructure(map));
  return ensureWorkshopMap(map as GameMap);
}
export function exportWorkshopMap(input: WorkshopMap): string {
  fail(validateWorkshopStructure(input));
  const json = JSON.stringify(input, null, 2);
  if (new TextEncoder().encode(json).byteLength > MAX_MAP_JSON_BYTES)
    throw new Error("Map is too large to export.");
  return json;
}
/** An isolated test never inherits learning, campaign modifiers, Rush, or unrelated setup slots. */
export function createWorkshopTest(input: WorkshopMap): Partial<GameSettings> {
  const map = ensureWorkshopMap(input),
    validation = validateWorkshopMap(map);
  fail(validation.errors);
  map.validation = validation;
  const scenario = map.scenario!,
    {
      startingForces: _startingForces,
      scoreTarget: _scoreTarget,
      ...settings
    } = scenario.rules;
  return {
    ...DEFAULT_SETTINGS,
    ...settings,
    seed: map.seed,
    biome: map.biome,
    aiPlayers: map.spawns.length - 1,
    faction: scenario.slots[0].faction,
    commander: scenario.slots[0].commander,
    difficulty: scenario.slots[0].difficulty,
    aiPersonality: scenario.slots[0].personality,
    aiControlPlayer: scenario.slots[0].controller === "ai",
    slots: copy(scenario.slots),
    customMap: map,
    learning: false,
    scriptedVictory: false,
    modifiers: undefined,
    matchScale: "custom",
    neutralCamps: 0,
    preset: "balanced",
    mapGenerationVersion: map.version as 3 | 4 | 5,
  };
}

/** Render-only state for safely incomplete drafts. Never tick or save this as a battle. */
export function createWorkshopPreview(input: WorkshopMap): GameState {
  const map = ensureWorkshopMap(input),
    scenario = map.scenario!;
  const state = createGame({
    seed: map.seed,
    mapSize: "tiny",
    mapGenerationVersion: 4,
    aiPlayers: map.spawns.length - 1,
    neutralCamps: 0,
  });
  state.map = map;
  state.settings = {
    ...state.settings,
    ...scenario.rules,
    seed: map.seed,
    biome: map.biome,
    slots: copy(scenario.slots),
    aiPlayers: map.spawns.length - 1,
  };
  state.entities = [];
  state.events = [];
  state.nextId = 1;
  state.nextEventId = 1;
  state.navigationVersion++;
  state.paused = true;
  state.objectiveText = "Map workshop preview";
  state.players.forEach((player, team) => {
    const slot = scenario.slots[team];
    Object.assign(player, {
      name: slot.name,
      faction: slot.faction,
      commander: slot.commander,
      alliance: slot.alliance,
      difficulty: slot.difficulty,
      personality: slot.personality,
      ai: false,
      closed: slot.controller === "closed",
      defeated: slot.controller === "closed",
      gold: scenario.rules.startingGold,
      wood: scenario.rules.startingWood,
      population: 0,
      maxPopulation: scenario.rules.populationCap,
      stats: Object.fromEntries(
        Object.keys(player.stats).map((key) => [key, 0]),
      ),
    });
  });
  state.fog.visible = state.players.map(() =>
    Array(map.width * map.height).fill(1),
  );
  state.fog.explored = state.players.map(() =>
    Array(map.width * map.height).fill(1),
  );
  if (scenario.rules.startingForces === "standard")
    map.spawns.forEach((spawn, team) => {
      if (scenario.slots[team].controller === "closed") return;
      const dx = map.width / 2 + 0.5 - spawn.x,
        dy = map.height / 2 + 0.5 - spawn.y,
        distance = Math.hypot(dx, dy);
      const inward =
          distance > 0.001
            ? { x: dx / distance, y: dy / distance }
            : { x: 1, y: 0 },
        side = { x: -inward.y, y: inward.x };
      spawnEntity(state, team, "building", "keep", spawn.x, spawn.y);
      spawnEntity(
        state,
        team,
        "building",
        "barracks",
        spawn.x - inward.x * 3 + side.x * 3,
        spawn.y - inward.y * 3 + side.y * 3,
      );
      spawnEntity(
        state,
        team,
        "commander",
        scenario.slots[team].commander,
        spawn.x + inward.x * 3,
        spawn.y + inward.y * 3,
      );
      (["swordsman", "swordsman", "spearman", "archer"] as const).forEach(
        (type, index) =>
          spawnEntity(
            state,
            team,
            "unit",
            type,
            spawn.x +
              inward.x * (3 + (index % 2)) -
              side.x * (1.7 + Math.floor(index / 2) * 0.9),
            spawn.y +
              inward.y * (3 + (index % 2)) -
              side.y * (1.7 + Math.floor(index / 2) * 0.9),
          ),
      );
    });
  hydrateScenarioEntities(state, { preview: true });
  state.events = [];
  map.validation = validateWorkshopMap(map);
  return state;
}

export interface WorkshopView {
  camera: { x: number; y: number; zoom: number };
  mode: "paint" | "pan";
  brush: string;
  brushSize: number;
  team: number;
}
export interface WorkshopBookmark {
  version: 1;
  map: WorkshopMap;
  view: WorkshopView;
}
export class WorkshopTestSession {
  private bookmark: WorkshopBookmark | null = null;
  begin(map: WorkshopMap, view: WorkshopView): Partial<GameSettings> {
    const settings = createWorkshopTest(map);
    this.bookmark = { version: 1, map: copy(map), view: copy(view) };
    return settings;
  }
  get active() {
    return this.bookmark !== null;
  }
  restore(): WorkshopBookmark | null {
    return this.bookmark ? copy(this.bookmark) : null;
  }
  clear() {
    this.bookmark = null;
  }
  export(): WorkshopBookmark | null {
    return this.restore();
  }
  resume(input: unknown) {
    fail(validateDataSafety(input, 100_000));
    if (!input || typeof input !== "object" || Array.isArray(input))
      throw new Error("Workshop return data is invalid.");
    const saved = input as WorkshopBookmark,
      view = saved.view;
    if (
      saved.version !== 1 ||
      !view ||
      !view.camera ||
      !finite(view.camera.x, -100_000, 100_000) ||
      !finite(view.camera.y, -100_000, 100_000) ||
      !finite(view.camera.zoom, 0.1, 5) ||
      !["paint", "pan"].includes(view.mode) ||
      typeof view.brush !== "string" ||
      view.brush.length > 80 ||
      ![1, 3, 5].includes(view.brushSize) ||
      !Number.isInteger(view.team) ||
      view.team < 0 ||
      view.team >= saved.map?.spawns?.length
    )
      throw new Error("Workshop return camera or tools are invalid.");
    fail(validateWorkshopStructure(saved.map));
    this.bookmark = copy(saved);
  }
}
export interface WorkshopLibraryEntry {
  id: string;
  name: string;
  updatedAt: string;
  map: WorkshopMap;
}
export interface WorkshopStore {
  load: (key: string) => Promise<unknown>;
  save: (key: string, value: unknown) => Promise<void>;
}
interface LibraryData {
  version: 1;
  entries: WorkshopLibraryEntry[];
}

/** Serialized writes prevent concurrent Save clicks from replacing each other's library entries. */
export class WorkshopLibrary {
  private pending = Promise.resolve();
  constructor(
    private store: WorkshopStore,
    private clock = () => new Date(),
  ) {}
  private async read(): Promise<LibraryData> {
    const input = await this.store.load(WORKSHOP_LIBRARY_KEY);
    if (input === null || input === undefined)
      return { version: 1, entries: [] };
    fail(validateDataSafety(input, 1_000_000));
    if (typeof input !== "object" || Array.isArray(input))
      throw new Error(
        "The workshop library is damaged. Import a map backup to recover it.",
      );
    const data = input as LibraryData;
    if (
      data.version !== 1 ||
      !Array.isArray(data.entries) ||
      data.entries.length > WORKSHOP_MAX_SAVED_MAPS
    )
      throw new Error("The workshop library has an unsupported format.");
    const ids = new Set<string>();
    for (const entry of data.entries) {
      if (
        !entry ||
        typeof entry.id !== "string" ||
        !/^[a-zA-Z0-9_-]{1,80}$/.test(entry.id) ||
        ids.has(entry.id) ||
        typeof entry.name !== "string" ||
        entry.name !== cleanName(entry.name) ||
        typeof entry.updatedAt !== "string" ||
        !Number.isFinite(Date.parse(entry.updatedAt))
      )
        throw new Error("The workshop library contains an invalid map record.");
      fail(validateWorkshopStructure(entry.map));
      ids.add(entry.id);
    }
    return copy(data);
  }
  async list(): Promise<Omit<WorkshopLibraryEntry, "map">[]> {
    await this.pending;
    return (await this.read()).entries
      .map(({ map: _map, ...entry }) => entry)
      .sort(
        (a, b) =>
          b.updatedAt.localeCompare(a.updatedAt) ||
          a.name.localeCompare(b.name),
      );
  }
  async load(id: string): Promise<WorkshopLibraryEntry> {
    await this.pending;
    const entry = (await this.read()).entries.find((item) => item.id === id);
    if (!entry)
      throw new Error("That saved map is no longer in this workshop library.");
    return entry;
  }
  save(
    map: WorkshopMap,
    name: string,
    id?: string,
  ): Promise<WorkshopLibraryEntry> {
    const snapshot = ensureWorkshopMap(map),
      title = cleanName(name);
    snapshot.name = title;
    const operation = this.pending.then(async () => {
      const data = await this.read(),
        index = id ? data.entries.findIndex((entry) => entry.id === id) : -1;
      if (id && index < 0)
        throw new Error(
          "That saved map no longer exists. Save a new copy instead.",
        );
      if (index < 0 && data.entries.length >= WORKSHOP_MAX_SAVED_MAPS)
        throw new Error(
          `Your workshop holds ${WORKSHOP_MAX_SAVED_MAPS} maps. Overwrite an existing map or export a backup first.`,
        );
      const now = this.clock();
      let nextId = id ?? `map-${now.getTime().toString(36)}`,
        suffix = 1;
      while (!id && data.entries.some((entry) => entry.id === nextId))
        nextId = `map-${now.getTime().toString(36)}-${suffix++}`;
      const entry: WorkshopLibraryEntry = {
        id: nextId,
        name: title,
        updatedAt: now.toISOString(),
        map: snapshot,
      };
      if (index >= 0) data.entries[index] = entry;
      else data.entries.push(entry);
      if (
        validateDataSafety(data, 1_000_000).length ||
        new TextEncoder().encode(JSON.stringify(data)).byteLength >
          MAX_SAVE_JSON_BYTES
      )
        throw new Error(
          "The workshop library has reached its storage limit. Export a backup or overwrite a smaller draft before saving another map.",
        );
      await this.store.save(WORKSHOP_LIBRARY_KEY, data);
      return copy(entry);
    });
    this.pending = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }
  async clone(id: string, name?: string): Promise<WorkshopLibraryEntry> {
    const source = await this.load(id);
    return this.save(source.map, name ?? `${source.name.slice(0, 115)} copy`);
  }
}

const esc = (value: unknown) =>
  String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ]!,
  );
const select = (
  name: string,
  value: string | number,
  options: [string, string][],
) =>
  `<select name="${esc(name)}">${options.map(([id, label]) => `<option value="${esc(id)}"${String(value) === id ? " selected" : ""}>${esc(label)}</option>`).join("")}</select>`;
const field = (label: string, input: string) =>
  `<label class="field"><span>${esc(label)}</span>${input}</label>`;
const numberField = (
  label: string,
  name: string,
  value: number | undefined,
  min: number,
  max: number,
  step = 1,
) =>
  field(
    label,
    `<input type="number" name="${esc(name)}" value="${value ?? ""}" min="${min}" max="${max}" step="${step}"${value === undefined ? ' placeholder="Automatic"' : " required"}>`,
  );
const contentOptions = (
  data: Record<string, { name: string }>,
): [string, string][] =>
  Object.entries(data).map(([id, item]) => [id, item.name]);

/** Form contents; the host supplies its existing modal, form and Apply/Cancel actions. */
export function renderWorkshopSettings(input: WorkshopMap): string {
  const map = ensureWorkshopMap(input),
    { slots, rules } = map.scenario!;
  return `<div class="workshop-settings"><div class="field-grid">${field("Map name", `<input name="map-name" maxlength="120" value="${esc(map.name)}" required>`)}${numberField("Width in tiles", "width", map.width, 16, 160)}${numberField("Height in tiles", "height", map.height, 16, 160)}${field("Biome", select("biome", map.biome, contentOptions(BIOMES)))}${numberField("Player slots", "slot-count", slots.length, 2, 6)}${field(
    "Starting forces",
    select("startingForces", rules.startingForces, [
      ["standard", "Standard settlement + placed extras"],
      ["authored", "Only the forces I place"],
    ]),
  )}</div><p class="muted">Resizing keeps your terrain and moves objects with it. A smaller map cannot cut off existing objects. New player slots need a reachable spawn, gold, and timber.</p><h3>Victory and economy</h3><div class="field-grid">${field(
    "Victory",
    select("mode", rules.mode, [
      ["domination", "Domination · territory and score"],
      ["conquest", "Conquest · destroy enemy keeps"],
      ["relic", "Relic race · hold objectives"],
    ]),
  )}${numberField("Duration in minutes", "duration", rules.duration, 4, 180)}${numberField("Army ceiling", "populationCap", rules.populationCap, 12, 200)}${numberField("Starting gold", "startingGold", rules.startingGold, 0, 100000)}${numberField("Starting wood", "startingWood", rules.startingWood, 0, 100000)}${numberField("Score target", "scoreTarget", rules.scoreTarget, 100, 100000)}${numberField("Game speed", "gameSpeed", rules.gameSpeed ?? 1, 0.5, 2, 0.1)}${numberField("Income multiplier", "incomeRate", rules.incomeRate ?? 1, 0.5, 3, 0.1)}</div><h3>Players and alliances</h3><p class="muted">Players sharing an alliance cooperate. Players 2–6 use AI or can be closed. Closed slots keep their spawn location for later use.</p>${slots
    .map(
      (slot, index) =>
        `<fieldset class="workshop-slot"><legend>Player ${index + 1}</legend><div class="field-grid">${field("Name", `<input name="slot-${index}-name" value="${esc(slot.name)}" maxlength="80" required>`)}${field(
          "Control",
          select(
            `slot-${index}-controller`,
            slot.controller,
            index === 0
              ? [
                  ["human", "Human"],
                  ["ai", "AI demonstration"],
                ]
              : [
                  ["ai", "AI opponent or ally"],
                  ["closed", "Closed"],
                ],
          ),
        )}${field(
          "Alliance",
          select(
            `slot-${index}-alliance`,
            slot.alliance,
            Array.from({ length: 6 }, (_, alliance) => [
              String(alliance),
              `Alliance ${alliance + 1}`,
            ]),
          ),
        )}${field("Faction", select(`slot-${index}-faction`, slot.faction, contentOptions(FACTIONS)))}${field("Commander", select(`slot-${index}-commander`, slot.commander, contentOptions(COMMANDERS)))}${field(
          "AI personality",
          select(
            `slot-${index}-personality`,
            slot.personality,
            [
              "adaptive",
              "aggressive",
              "defensive",
              "economic",
              "raider",
              "expansionist",
            ].map((value) => [value, value]),
          ),
        )}${field(
          "AI difficulty",
          select(
            `slot-${index}-difficulty`,
            slot.difficulty,
            ["easy", "normal", "hard", "brutal"].map((value) => [value, value]),
          ),
        )}</div></fieldset>`,
    )
    .join("")}</div>`;
}
/** Atomic application leaves the current draft untouched if any input or crop is invalid. */
export function readWorkshopSettings(
  input: FormData | HTMLFormElement,
  current: WorkshopMap,
): WorkshopMap {
  const form = input instanceof FormData ? input : new FormData(input);
  const value = (name: string) => {
    const entry = form.get(name);
    if (typeof entry !== "string")
      throw new Error(`Missing workshop setting: ${name}.`);
    return entry;
  };
  const numeric = (name: string) => {
    const raw = value(name);
    if (!raw.trim() || !Number.isFinite(Number(raw)))
      throw new Error(`Enter a number for ${name}.`);
    return Number(raw);
  };
  let map = ensureWorkshopMap(current);
  map.name = cleanName(value("map-name"));
  const rules: MapRules = {
    mode: value("mode") as MapRules["mode"],
    duration: numeric("duration"),
    populationCap: numeric("populationCap"),
    startingGold: numeric("startingGold"),
    startingWood: numeric("startingWood"),
    startingForces: value("startingForces") as MapRules["startingForces"],
    gameSpeed: numeric("gameSpeed"),
    incomeRate: numeric("incomeRate"),
  };
  const score = value("scoreTarget");
  if (score.trim()) rules.scoreTarget = Number(score);
  fail(validateMapRules(rules));
  map.scenario!.rules = rules;
  const previousCount = map.spawns.length,
    width = numeric("width"),
    height = numeric("height"),
    count = numeric("slot-count");
  if (count < previousCount) map = setWorkshopSlotCount(map, count);
  map = resizeWorkshopMap(map, width, height);
  if (count > previousCount) map = setWorkshopSlotCount(map, count);
  map = setWorkshopBiome(map, value("biome") as BiomeId);
  for (let index = 0; index < Math.min(previousCount, count); index++)
    map = updateWorkshopSlot(map, index, {
      name: value(`slot-${index}-name`).trim(),
      controller: value(
        `slot-${index}-controller`,
      ) as MapPlayerSlot["controller"],
      alliance: numeric(`slot-${index}-alliance`),
      faction: value(`slot-${index}-faction`) as MapPlayerSlot["faction"],
      commander: value(`slot-${index}-commander`) as MapPlayerSlot["commander"],
      personality: value(
        `slot-${index}-personality`,
      ) as MapPlayerSlot["personality"],
      difficulty: value(
        `slot-${index}-difficulty`,
      ) as MapPlayerSlot["difficulty"],
    });
  map.validation = validateWorkshopMap(map);
  return map;
}
export function renderWorkshopPalette(
  input: WorkshopMap,
  selectedTeam = 0,
): string {
  const map = ensureWorkshopMap(input),
    scenario = map.scenario!;
  const button = (brush: string, label: string) =>
    `<button type="button" data-action="workshop-brush" data-id="${esc(brush)}">${esc(label)}</button>`;
  return `<div class="workshop-palette">${field(
    "Place for player",
    select(
      "workshop-team",
      selectedTeam,
      scenario.slots.flatMap((slot, index): [string, string][] =>
        slot.controller === "closed"
          ? []
          : [[String(index), `${index + 1} · ${slot.name}`]],
      ),
    ),
  )}<details><summary>Buildings and commanders</summary><div class="brushes">${Object.entries(
    BUILDINGS,
  )
    .filter(
      ([id]) => id !== "keep" || scenario.rules.startingForces === "authored",
    )
    .map(([id, definition]) => button(`building:${id}`, definition.name))
    .join("")}${
    scenario.rules.startingForces === "authored"
      ? Object.entries(COMMANDERS)
          .map(([id, definition]) => button(`commander:${id}`, definition.name))
          .join("")
      : ""
  }</div>${field(
    "Building level",
    select("workshop-level", "1", [
      ["1", "Level 1"],
      ["2", "Level 2"],
      ["3", "Level 3"],
    ]),
  )}</details><details><summary>Starting units</summary><div class="brushes">${Object.entries(
    UNITS,
  )
    .map(([id, definition]) => button(`unit:${id}`, definition.name))
    .join(
      "",
    )}</div></details><details><summary>Neutral camps</summary><p>Independent guards defend their camp. Defeating every guard grants the reward.</p>${field("Guard unit", select("camp-unit", "spearman", contentOptions(UNITS)))}${numberField("Defenders", "camp-count", 3, 1, 12)}${numberField("Patrol radius", "camp-radius", 2, 1, 8)}${numberField("Gold reward", "camp-gold", 100, 0, 10000)}${numberField("Wood reward", "camp-wood", 100, 0, 10000)}${button("camp", "Place neutral camp")}</details><details><summary>Spawns and objectives</summary><div class="brushes">${map.spawns.map((_, index) => button(`spawn:${index}`, `Player ${index + 1} spawn`)).join("")}${button("gold", "Gold deposit")}${button("wood", "Timber camp")}${button("relic", "Relic objective")}${button("erase-objects", "Erase objects")}</div>${field("Resource owner", select("node-owner", "neutral", [["neutral", "Neutral"], ...scenario.slots.flatMap((slot, index): [string, string][] => (slot.controller === "closed" ? [] : [[String(index), `${index + 1} · ${slot.name}`]]))]))}${numberField("Deposit amount", "node-amount", 1600, 0, 1000000)}</details></div>`;
}
export interface WorkshopPlacementOptions {
  team?: number;
  buildingLevel?: 1 | 2 | 3;
  camp?: Partial<
    Pick<
      MapNeutralCamp,
      "unit" | "count" | "radius" | "rewardGold" | "rewardWood"
    >
  >;
  node?: { owner?: number | null; amount?: number };
}
export function placeWorkshopObject(
  input: WorkshopMap,
  brush: string,
  point: Point,
  options: WorkshopPlacementOptions = {},
): WorkshopMap {
  if (brush.startsWith("building:"))
    return placeWorkshopEntity(input, {
      ...point,
      team: options.team ?? 0,
      kind: "building",
      type: brush.slice(9) as BuildingId,
      buildingLevel: options.buildingLevel ?? 1,
    });
  if (brush.startsWith("unit:"))
    return placeWorkshopEntity(input, {
      ...point,
      team: options.team ?? 0,
      kind: "unit",
      type: brush.slice(5) as UnitId,
    });
  if (brush.startsWith("commander:"))
    return placeWorkshopEntity(input, {
      ...point,
      team: options.team ?? 0,
      kind: "commander",
      type: brush.slice(10) as CommanderId,
    });
  if (brush === "camp")
    return placeWorkshopCamp(input, {
      ...point,
      unit: "spearman",
      count: 3,
      radius: 2,
      rewardGold: 100,
      rewardWood: 100,
      ...options.camp,
    });
  if (["gold", "wood", "relic"].includes(brush))
    return placeWorkshopNode(
      input,
      brush as ResourceNode["kind"],
      point,
      options.node,
    );
  if (brush === "erase-objects") return eraseWorkshopObjects(input, point);
  const map = ensureWorkshopMap(input),
    position = snappedTile(point);
  if (!inMap(map, position)) throw new Error("Choose a tile inside the map.");
  if (brush.startsWith("spawn:")) {
    const index = Number(brush.slice(6));
    if (!Number.isInteger(index) || !map.spawns[index])
      throw new Error("Choose an existing player spawn.");
    if (!inMap(map, position, 4))
      throw new Error(
        "Leave at least four tiles between a spawn and the map edge.",
      );
    map.spawns[index] = position;
    map.tiles[Math.floor(position.y) * map.width + Math.floor(position.x)] =
      "road";
  } else if (terrains.includes(brush as TerrainType))
    map.tiles[Math.floor(position.y) * map.width + Math.floor(position.x)] =
      brush as TerrainType;
  else throw new Error("Choose a workshop brush.");
  return map;
}
