import type { Entity, GameState, Point } from "../sim/types";
import { areHostile } from "../sim/alliances";
/** Touch abilities use visible threats; defensive movement must never auto-dodge into one. */
export function chooseAbilityTarget(
  state: GameState,
  commander: Entity,
  ability: string,
  fallback: Point | null,
): Point {
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
