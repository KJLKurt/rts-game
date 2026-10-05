import { BUILDINGS, canBuild, projectPendingCommands } from "../sim";
import { BUILDING_CLEARANCE, snapConstruction } from "../sim/construction";
import type { Entity, GameState, Point } from "../sim";
import { hasNeighboringHouses } from "./learning";
import { plannedBuildResult } from "./placement";

// Half-tile offsets cover every snapped site accepted by the lesson's gap rule.
const neighbors: Point[] = [];
for (let y = -3; y <= 3; y += .5)
  for (let x = -3; x <= 3; x += .5) {
    const distance = Math.hypot(x, y);
    if (distance >= 2 + BUILDING_CLEARANCE && distance <= 3)
      neighbors.push({ x, y });
  }
neighbors.sort((a, b) => Math.abs(Math.hypot(a.x, a.y) - 2.5) - Math.abs(Math.hypot(b.x, b.y) - 2.5));

const geometryCache = new WeakMap<GameState, { key: string; state: GameState; room: Map<string, boolean>; guidance?: string }>();
/** Future room is independent of today's funds and movable troops. Only detached
 * preview copies receive a budget/footprint; real placement still uses canBuild. */
function geometry(state: GameState) {
  const key = `${state.navigationVersion}:${JSON.stringify(state.pendingCommands)}`;
  const cached = geometryCache.get(state);
  if (cached?.key === key) return cached;
  const projected = state.paused && state.pendingCommands.length ? projectPendingCommands(state) : state;
  const copy: GameState = {
    ...projected, paused: false, pendingCommands: [],
    entities: projected.entities.filter(e => e.kind === "building").map(e =>
      e.team === 0 && e.type === "house" ? { ...e, buildProgress: 1 } : e),
    players: projected.players.map(p => ({ ...p, wood: Math.max(p.wood, BUILDINGS.house.cost.wood) })),
  };
  const value: { key: string; state: GameState; room: Map<string, boolean>; guidance?: string } = { key, state: copy, room: new Map<string, boolean>() };
  geometryCache.set(state, value);
  return value;
}
function houses(state: GameState) {
  return state.entities.filter(e => e.team === 0 && e.type === "house" && e.hp > 0);
}
function beside(a: Point, b: Point) {
  const distance = Math.hypot(a.x - b.x, a.y - b.y);
  return distance >= 2 + BUILDING_CLEARANCE - .001 && distance <= 3;
}
function neighboringSite(state: GameState, house: Point): Point | undefined {
  for (const offset of neighbors) {
    const point = { x: house.x + offset.x, y: house.y + offset.y };
    if (canBuild(state, 0, "house", point.x, point.y).ok) return point;
  }
}
/** Whether a legal first House would leave a legal footprint for its neighbor. */
export function houseHasRoom(state: GameState, point: Point): boolean {
  const cached = geometry(state), key = `${point.x},${point.y}`;
  if (cached.room.has(key)) return cached.room.get(key)!;
  const source = cached.state;
  let room = houses(source).some(house => beside(house, point));
  if (!room) {
    const template = source.entities.find(e => e.team === 0 && e.kind === "building");
    if (template) {
      const preview: Entity = { ...template, ...point, id: "practice-preview", type: "house", radius: BUILDINGS.house.size, hp: 1, buildProgress: 1 };
      const future = { ...source, entities: [...source.entities, preview], navigationVersion: source.navigationVersion + 1 };
      room = !!neighboringSite(future, point);
    }
  }
  cached.room.set(key, room);
  return room;
}

export function learningHouseGuidance(state: GameState): string {
  const cached = geometry(state);
  return cached.guidance ??= describeHouses(cached.state);
}
function describeHouses(future: GameState): string {
  const homes = houses(future);
  if (hasNeighboringHouses(future))
    return "Your neighboring Houses are placed. Wait for both to finish; resume if paused. Each adds 8 population capacity, up to the match ceiling.";
  if (!homes.length)
    return "Build two neighboring Houses with a small gap. Find House site suggests room for both. Each completed House adds 8 population capacity, up to the match ceiling. Wait for both to finish.";
  const openNeighbor = homes.some(house => !!neighboringSite(future, house));
  if (openNeighbor && homes.length === 1)
    return "Build the second House beside your first. Find House site suggests its neighbor. Wait for both to finish to add 16 population capacity, up to the match ceiling.";
  if (openNeighbor)
    return "Your Houses are too far apart. Keep them and build one more beside a House with room. Find House site marks that neighbor. Wait for the neighboring pair to finish.";
  return `There is no room for a neighbor beside ${homes.length === 1 ? "this House" : "your Houses"}. Keep ${homes.length === 1 ? "it" : "them"} and build a new pair in an open area. Find House site suggests room for two more Houses. Move troops clear and gather wood if needed.`;
}

/** Choose a currently legal neighbor first, otherwise a site with future room.
 * Never silently substitute an isolated House when no pair site is available. */
export function findLearningHouseSite(state: GameState, anchor: Point): Point | undefined {
  const future = geometry(state).state;
  for (const house of houses(future))
    for (const offset of neighbors) {
      const point = { x: house.x + offset.x, y: house.y + offset.y };
      if (plannedBuildResult(state, 0, "house", point.x, point.y).ok) return point;
    }
  for (let radius = 3; radius <= 10; radius++)
    for (let i = 0; i < 24; i++) {
      const point = snapConstruction({ x: anchor.x + Math.cos(i * Math.PI / 12) * radius, y: anchor.y + Math.sin(i * Math.PI / 12) * radius });
      if (plannedBuildResult(state, 0, "house", point.x, point.y).ok && houseHasRoom(state, point)) return point;
    }
  return undefined;
}
