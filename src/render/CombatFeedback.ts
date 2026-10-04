import type { Entity, GameEvent, GameState, Point } from "../sim/types";

/** Read-only, bounded presentation memory. Nothing here issues commands or deals damage. */
export interface AttackBeat {
  entityId: string;
  time: number;
  ranged: boolean;
  direction: Point;
}
export interface HitBeat {
  entityId: string;
  time: number;
  damage: number;
}
export interface Casualty extends Point {
  id: string;
  time: number;
  team: number;
  type: Entity["type"];
  kind: Entity["kind"];
  facing: number;
  radius: number;
}
export interface LocomotionBeat {
  x: number;
  y: number;
  time: number;
  distance: number;
  speed: number;
  moving: boolean;
}
export interface CombatPose {
  /** Seconds since an actual attack event; Infinity means no recent release. */
  age: number;
  anticipation: number;
  release: number;
  recovery: number;
  ranged: boolean;
  direction: Point;
}
interface SeenEntity extends Point {
  id: string;
  type: Entity["type"];
  kind: Entity["kind"];
  team: number;
  facing: number;
  radius: number;
}
const BUILDINGS = new Set([
  "keep",
  "house",
  "barracks",
  "range",
  "stable",
  "workshop",
  "tower",
  "depot",
  "blacksmith",
  "turret",
]);
const COMMANDERS = new Set(["warlord", "ranger", "engineer"]);
const MAX_RECORDS = 256;
const clamp = (v: number) => Math.max(0, Math.min(1, v));
function bounded<K, V>(map: Map<K, V>) {
  while (map.size > MAX_RECORDS) map.delete(map.keys().next().value as K);
}
function direction(x: number, y: number): Point {
  const length = Math.hypot(x, y);
  return length > 0 ? { x: x / length, y: y / length } : { x: 1, y: 0 };
}

export class CombatFeedback {
  readonly attacks = new Map<string, AttackBeat>();
  readonly hits = new Map<string, HitBeat>();
  readonly casualties = new Map<string, Casualty>();
  readonly locomotion = new Map<string, LocomotionBeat>();
  private seenEntities = new Map<string, SeenEntity>();
  private lastEvent = -1;
  private lastGameTime = -1;
  private sampleWallTime = 0;
  private map: GameState["map"] | null = null;
  time = 0;
  reset() {
    this.attacks.clear();
    this.hits.clear();
    this.casualties.clear();
    this.locomotion.clear();
    this.seenEntities.clear();
    this.lastEvent = -1;
    this.lastGameTime = -1;
    this.map = null;
    this.time = 0;
  }
  update(
    state: GameState,
    wallSeconds: number,
    visible: (x: number, y: number) => boolean,
    team = 0,
  ): void {
    if (this.map !== state.map || state.time < this.lastGameTime) this.reset();
    this.map = state.map;
    if (state.time !== this.lastGameTime) {
      this.sampleWallTime = wallSeconds;
      this.lastGameTime = state.time;
    }
    // Interpolate only within the simulation's 100ms step; tactical pause freezes feedback too.
    this.time =
      state.time +
      (state.paused || state.winner !== null
        ? 0
        : Math.min(0.1, Math.max(0, wallSeconds - this.sampleWallTime)));
    for (const event of state.events) {
      if (event.id <= this.lastEvent) continue;
      this.lastEvent = Math.max(this.lastEvent, event.id);
      if (
        state.time - event.time > 1.7 ||
        event.time > state.time ||
        !visible(event.x, event.y)
      )
        continue;
      const id = event.entityId;
      if (id && (event.type === "attack" || event.type === "projectile")) {
        this.attacks.set(id, {
          entityId: id,
          time: event.time,
          ranged: event.type === "projectile",
          direction: direction(
            (event.targetX ?? event.x + 1) - event.x,
            (event.targetY ?? event.y) - event.y,
          ),
        });
      } else if (id && event.type === "hit") {
        this.hits.set(id, {
          entityId: id,
          time: event.time,
          damage: event.value ?? 0,
        });
      } else if (event.type === "death") this.recordCasualty(event);
    }
    for (const [id, attack] of this.attacks)
      if (this.time - attack.time > 1.5) this.attacks.delete(id);
    for (const [id, hit] of this.hits)
      if (this.time - hit.time > 0.7) this.hits.delete(id);
    for (const [id, casualty] of this.casualties)
      if (
        this.time - casualty.time >
        (casualty.kind === "building" ? 1.8 : 1.35)
      )
        this.casualties.delete(id);
    const live = new Set<string>();
    for (const entity of state.entities) {
      if (
        entity.hp <= 0 ||
        entity.respawnAt !== null ||
        !(entity.team === team || visible(entity.x, entity.y))
      )
        continue;
      live.add(entity.id);
      const prior = this.locomotion.get(entity.id);
      if (!prior)
        this.locomotion.set(entity.id, {
          x: entity.x,
          y: entity.y,
          time: state.time,
          distance: 0,
          speed: 0,
          moving: false,
        });
      else if (state.time > prior.time) {
        const distance = Math.hypot(entity.x - prior.x, entity.y - prior.y),
          elapsed = state.time - prior.time;
        const moved = distance > 0.012 && distance < 2;
        this.locomotion.set(entity.id, {
          x: entity.x,
          y: entity.y,
          time: state.time,
          distance: prior.distance + (distance < 2 ? distance : 0),
          speed: moved ? distance / elapsed : 0,
          moving: moved,
        });
      }
      this.seenEntities.set(entity.id, {
        id: entity.id,
        type: entity.type,
        kind: entity.kind,
        team: entity.team,
        x: entity.x,
        y: entity.y,
        facing: entity.facing,
        radius: entity.radius,
      });
    }
    for (const id of this.seenEntities.keys())
      if (!live.has(id)) this.seenEntities.delete(id);
    for (const id of this.locomotion.keys())
      if (!live.has(id)) this.locomotion.delete(id);
    bounded(this.locomotion);
    bounded(this.attacks);
    bounded(this.hits);
    bounded(this.casualties);
    bounded(this.seenEntities);
  }
  private recordCasualty(event: GameEvent) {
    const id = event.entityId ?? `event-${event.id}`,
      seen = this.seenEntities.get(id),
      type = seen?.type ?? (event.subtype as Entity["type"]);
    if (!type) return;
    this.casualties.set(id, {
      id,
      time: event.time,
      x: event.x,
      y: event.y,
      team: event.team,
      type,
      kind:
        seen?.kind ??
        (BUILDINGS.has(type)
          ? "building"
          : COMMANDERS.has(type)
            ? "commander"
            : "unit"),
      facing: seen?.facing ?? 0,
      radius: seen?.radius ?? 0.4,
    });
    this.attacks.delete(id);
    this.hits.delete(id);
  }
  pose(
    entity: Entity,
    entities: readonly Entity[],
    simulationTime: number,
  ): CombatPose {
    const beat = this.attacks.get(entity.id),
      age = beat ? Math.max(0, this.time - beat.time) : Infinity;
    const ranged = beat?.ranged ?? entity.range > 2;
    const facing = beat?.direction ?? {
      x: Math.cos(entity.facing),
      y: Math.sin(entity.facing),
    };
    const release =
      age < 0.13 ? Math.sin(Math.min(1, age / 0.13) * Math.PI) : 0;
    const recovery = age >= 0.08 && age < 0.43 ? 1 - (age - 0.08) / 0.35 : 0;
    let anticipation = 0;
    const cooldown =
      entity.attackCooldown - Math.max(0, this.time - simulationTime);
    if (age > 0.43 && cooldown > 0 && cooldown < 0.2 && entity.targetId) {
      const target = entities.find((e) => e.id === entity.targetId && e.hp > 0);
      if (
        target &&
        Math.hypot(target.x - entity.x, target.y - entity.y) <=
          entity.range + target.radius + 0.1
      )
        anticipation = clamp(1 - cooldown / 0.2);
    }
    return { age, anticipation, release, recovery, ranged, direction: facing };
  }
  hitStrength(id: string): number {
    const hit = this.hits.get(id);
    return hit ? clamp(1 - (this.time - hit.time) / 0.2) : 0;
  }
}
