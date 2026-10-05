import type { GameState, Point } from "../sim/types";
import { hasClaimedSupplies } from "./battle-guidance";

export interface TutorialProgress {
  step: number;
  origin: Point;
  /** UI evidence retained after short-lived capture events expire. */
  supplyCaptured?: boolean;
}

/** UI-only progress. Never writes simulation or advances from autonomous fighting. */
export function advanceTutorial(
  state: GameState,
  progress: TutorialProgress,
): TutorialProgress {
  let step = progress.step;
  const supplyCaptured = progress.supplyCaptured === true || state.events.some(
    (event) => event.type === "capture" && event.team === 0 &&
      (event.subtype === "gold" || event.subtype === "wood"),
  );
  const hero = state.entities.find(
    (e) => e.team === 0 && e.kind === "commander",
  );
  const moved = state.commandLog.some(
    ({ command }) =>
      command.team === 0 &&
      ["move", "attackMove", "capture", "steer"].includes(command.type),
  );
  if (
    moved &&
    hero &&
    Math.hypot(hero.x - progress.origin.x, hero.y - progress.origin.y) > 3
  )
    step = Math.max(step, 1);
  if (
    step >= 1 &&
    supplyCaptured &&
    hasClaimedSupplies(state)
  )
    step = Math.max(step, 2);
  if (
    step >= 2 &&
    state.commandLog.some(
      ({ command }) => command.team === 0 && command.type === "recruit",
    ) &&
    state.players[0].stats.unitsCreated > 4
  )
    step = Math.max(step, 3);
  return { step, origin: { ...progress.origin }, ...(supplyCaptured ? { supplyCaptured: true } : {}) };
}

/** Old saves lack UI progress; use deliberate command/capture evidence conservatively. */
export function restoreTutorial(
  state: GameState,
  saved: unknown,
): TutorialProgress {
  const spawn = state.map.spawns[0];
  const dx = state.map.width / 2 + 0.5 - spawn.x,
    dy = state.map.height / 2 + 0.5 - spawn.y;
  const distance = Math.hypot(dx, dy) || 1;
  let origin = {
    x: spawn.x + (dx / distance) * 3,
    y: spawn.y + (dy / distance) * 3,
  };
  let step = 0, supplyCaptured = false;
  if (saved && typeof saved === "object" && !Array.isArray(saved)) {
    const record = saved as Partial<TutorialProgress>;
    if (Number.isInteger(record.step) && record.step! >= 0 && record.step! <= 3)
      step = record.step!;
    supplyCaptured = record.supplyCaptured === true;
    const p = record.origin;
    if (
      p &&
      Number.isFinite(p.x) &&
      Number.isFinite(p.y) &&
      p.x >= 0 &&
      p.x <= state.map.width &&
      p.y >= 0 &&
      p.y <= state.map.height
    )
      origin = { x: p.x, y: p.y };
  } else if (
    state.players[0].stats.captures > 0 &&
    state.commandLog.some(
      ({ command }) =>
        command.team === 0 &&
        ["move", "attackMove", "capture", "steer"].includes(command.type),
    )
  ) {
    // A completed supply lesson must survive returning home before this older save.
    step = 1;
  }
  return advanceTutorial(state, { step, origin, ...(supplyCaptured ? { supplyCaptured: true } : {}) });
}
