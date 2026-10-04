import type { GameState, Point, ResourceNode } from "../sim/types";
export function relicSummary(state: GameState, team = 0) {
  const relics = state.map.nodes.filter((n) => n.kind === "relic");
  const owned = relics.filter((n) => n.owner === team).length;
  const base =
    owned === 0
      ? 0
      : owned === 1
        ? 0.5
        : owned === 2
          ? 1
          : 1.4 + (owned - 3) * 0.3;
  return {
    owned,
    total: relics.length,
    pointsPerSecond:
      state.settings.mode === "conquest"
        ? 0
        : base *
          state.escalation *
          (state.settings.mode === "relic" ? 1.15 : 1),
  };
}
/** Relic locations are public strategic landmarks; enemy entities are never consulted. */
export function nearestRelic(
  state: GameState,
  origin: Point,
  team = 0,
): ResourceNode | undefined {
  const relics = state.map.nodes.filter((n) => n.kind === "relic");
  const targets = relics.some((n) => n.owner !== team)
    ? relics.filter((n) => n.owner !== team)
    : relics;
  return targets.sort(
    (a, b) =>
      Math.hypot(a.x - origin.x, a.y - origin.y) -
      Math.hypot(b.x - origin.x, b.y - origin.y),
  )[0];
}
