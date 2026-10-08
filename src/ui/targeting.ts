import type { Entity, GameState, Point } from "../sim/types";
import { areHostile } from "../sim/alliances";
import { findBreachTarget } from "../sim/ability-targeting";
/** Touch abilities use visible threats; defensive movement must never auto-dodge into one. */
export function chooseAbilityTarget(
  state: GameState,
  commander: Entity,
  ability: string,
  fallback: Point | null,
): Point {
  if (ability === "breach") {
    // Attack is the existing native way to express a deliberate building target.
    // Preserve that intent even when invalid now; the engine rejects it for free.
    const intendedId = commander.order.type === "attack" ? commander.order.targetId : undefined;
    const intended = state.entities.find(entity => entity.id === intendedId && entity.kind === "building");
    if (intended) return {x:intended.x,y:intended.y};
    const structure = findBreachTarget(state, commander);
    return structure ? {x: structure.x, y: structure.y} : {x: commander.x, y: commander.y};
  }
  if (ability === "rally" || ability === "repair")
    return { x: commander.x, y: commander.y };
  const threat = state.entities
    .filter(
      (e) =>
        areHostile(state, commander.team, e.team) &&
        e.hp > 0 &&
        e.kind !== "building" &&
        state.fog.visible[commander.team]?.[
          Math.floor(e.y) * state.map.width + Math.floor(e.x)
        ] &&
        Math.hypot(e.x - commander.x, e.y - commander.y) < 12,
    )
    .sort(
      (a, b) =>
        Math.hypot(a.x - commander.x, a.y - commander.y) -
        Math.hypot(b.x - commander.x, b.y - commander.y),
    )[0];
  if (ability === "dodge" && threat) {
    const dx = commander.x - threat.x,
      dy = commander.y - threat.y,
      distance = Math.hypot(dx, dy) || 1;
    return {
      x: commander.x + (dx / distance) * 4,
      y: commander.y + (dy / distance) * 4,
    };
  }
  if (ability === "turret" && threat) {
    const dx = threat.x - commander.x,
      dy = threat.y - commander.y,
      distance = Math.hypot(dx, dy) || 1;
    return {
      x: commander.x + (dx / distance) * Math.min(3, distance),
      y: commander.y + (dy / distance) * Math.min(3, distance),
    };
  }
  if (threat) return { x: threat.x, y: threat.y };
  return (
    fallback ?? {
      x: commander.x + Math.cos(commander.facing) * 4,
      y: commander.y + Math.sin(commander.facing) * 4,
    }
  );
}
