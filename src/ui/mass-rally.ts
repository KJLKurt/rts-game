import { BUILDINGS } from "../sim/content";
import { issueCommand } from "../sim/engine";
import type { BuildingId, GameState } from "../sim/types";

export interface MassRallyResult {
  accepted: number;
  total: number;
  queued: boolean;
  warning: boolean;
  message: string;
}

/** Existing, ready recruitment buildings only; the command boundary owns acceptance. */
export function rallyCurrentProducers(state: GameState): MassRallyResult {
  const producers = state.entities.filter(
    (entity) => entity.team === 0 && entity.kind === "building" &&
      entity.hp > 0 && entity.buildProgress >= 1 &&
      BUILDINGS[entity.type as BuildingId]?.recruits.length,
  );
  const result: MassRallyResult = {
    accepted: 0, total: producers.length, queued: false, warning: true, message: "",
  };
  const commander = state.entities.find(
    (entity) => entity.team === 0 && entity.kind === "commander" && entity.hp > 0,
  );
  if (!commander) {
    result.message = "Your commander is recovering. Set a building rally point in Details.";
    return result;
  }
  if (!producers.length) {
    result.message = "No completed production buildings to rally. Finish a recruitment building first.";
    return result;
  }

  const point = { x: commander.x, y: commander.y };
  const errors = new Set<string>();
  for (const producer of producers) {
    const command = issueCommand(state, {
      type: "rally", team: 0, buildingId: producer.id, ...point,
    });
    if (command.ok) {
      result.accepted++;
      result.queued ||= command.queued === true;
    } else {
      errors.add(command.error || "That order cannot be completed.");
    }
  }

  const rejected = result.total - result.accepted;
  result.warning = rejected > 0;
  if (!result.accepted) {
    result.message = `${state.paused ? "No rally orders queued." : "No rally points changed."} ${[...errors].join(" ")} Existing rally points are unchanged.`;
    return result;
  }
  const count = rejected ? `${result.accepted} of ${result.total}` : `${result.accepted}`;
  result.message = result.queued
    ? `Rally queued for ${count} current producer${result.total === 1 ? "" : "s"}. Resume to apply this fixed point.`
    : `Rally set for ${count} current producer${result.total === 1 ? "" : "s"} at this fixed position.`;
  result.message += rejected
    ? ` ${rejected} unchanged: ${[...errors].join(" ")}`
    : " New buildings need their own rally point; it will not follow your commander.";
  return result;
}
