import type { Entity, GameState } from "../sim/types";

/** Own building damage is known even when the attacker is outside sight. */
export function buildingUnderAttack(
  state: GameState,
  team = 0,
): Entity | undefined {
  if (state.rush) return;
  return state.entities
    .filter(
      (entity) =>
        entity.team === team &&
        entity.kind === "building" &&
        entity.type !== "turret" &&
        entity.hp > 0 &&
        entity.lastHitAt >= 0 &&
        state.time >= entity.lastHitAt &&
        state.time - entity.lastHitAt <= 6,
    )
    .sort(
      (a, b) =>
        Number(b.type === "keep") - Number(a.type === "keep") ||
        b.lastHitAt - a.lastHitAt,
    )[0];
}

export function hasClaimedSupplies(state: GameState, team = 0): boolean {
  return ["gold", "wood"].every((kind) =>
    state.map.nodes.some((node) => node.owner === team && node.kind === kind),
  );
}
