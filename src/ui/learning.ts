import type { GameState, Point } from "../sim";
import { BUILDING_CLEARANCE } from "../sim/construction";
export interface LearningProgress {
  step: number;
  origin: Point;
  inspectedKeep: boolean;
}
export const LESSONS = [
  {
    title: "Move your commander",
    text: "Start with one commander and a small keep. Tap clear ground to walk there, or hold the thumbstick. Release the stick to stop. Drag empty ground to look around.",
    action: "Show commander",
  },
  {
    title: "Claim a gold mine",
    text: "Tap the marked gold mine. Stay beside it while the capture ring fills. Once your banner rises, the mine gathers gold automatically. No workers are needed.",
    action: "Show gold mine",
  },
  {
    title: "Claim a timber camp",
    text: "Wood pays for buildings and archers. Tap the marked timber camp to capture it. Your gold mine keeps paying even after you leave it.",
    action: "Show timber camp",
  },
  {
    title: "Discover your keep",
    text: "Tap your Command Keep. Its Details panel shows what it does, what it trains, its research, and upgrades. Tap a resource number at the top to inspect all your income.",
    action: "Show keep",
  },
  {
    title: "Queue three soldiers",
    text: "Open Recruit, choose 3, then Swordsman. The queue shows each soldier, time remaining, and Cancel. Wait for all three to finish. You can minimize the panel while they train.",
    action: "Open Recruit",
  },
  {
    title: "Make room to grow",
    text: "Open Build and place two Houses side by side, leaving a small gap. Each completed House adds 8 population capacity for troops, not workers. Watch your capacity rise by 16, up to the match ceiling. Wait for both to finish.",
    action: "Open Build",
  },
  {
    title: "Improve a building",
    text: "Tap either completed House and choose its Townhouse upgrade. It adds 4 more population capacity without another footprint. Details shows the cost, benefit, and current and maximum level. Wait for the upgrade to finish.",
    action: "Show your house",
  },
  {
    title: "Claim the frontier",
    text: "Select Army, then tap the marked relic. Relics earn victory points in real battles; gold and wood fund your army. Your force will hold the captured site. Finish this lesson to open every practice option.",
    action: "Show relic",
  },
];

/** Small gaps between non-overlapping footprints count as a compact settlement. */
export function hasNeighboringHouses(state: GameState): boolean {
  const houses = state.entities.filter(
    (e) =>
      e.team === 0 && e.type === "house" && e.hp > 0 && e.buildProgress >= 1,
  );
  return houses.some((a, index) =>
    houses.slice(index + 1).some((b) => {
      const gap = Math.hypot(a.x - b.x, a.y - b.y) - a.radius - b.radius;
      return gap >= BUILDING_CLEARANCE - 0.001 && gap <= 1;
    }),
  );
}

export type LearningAction =
  | "build"
  | "recruit"
  | "research"
  | "upgradeBuilding";
/** Presentation/input gate only. Normal matches and completed practice stay unrestricted. */
export function learningActionAvailable(
  step: number | null | undefined,
  action: LearningAction,
  id: string,
): boolean {
  if (step == null || step >= LESSONS.length) return true;
  if (action === "recruit") return step >= 4 && id === "swordsman";
  if (action === "build") return step >= 5 && id === "house";
  if (action === "upgradeBuilding") return step >= 6 && id === "house";
  return false;
}

export function learningPanelHint(
  step: number | null | undefined,
  panel: "army" | "build" | "research",
): string {
  if (step == null || step >= LESSONS.length) return "";
  if (panel === "army")
    return step < 4
      ? "Recruit opens after you capture gold and timber and inspect your keep. Follow the guide above."
      : "Start with Swordsmen from your keep. More troops open after the final lesson.";
  if (panel === "build")
    return step < 5
      ? "Build opens after your first three soldiers finish training. Follow the guide above."
      : "Place two neighboring Houses with a small gap. Each adds 8 population capacity; other buildings open after the final lesson.";
  return "Research opens after the final lesson. First learn to capture income, recruit, build Houses, and upgrade one in Details.";
}

export function advanceLearning(
  state: GameState,
  progress: LearningProgress,
): LearningProgress {
  let step = progress.step;
  const hero = state.entities.find(
    (e) => e.team === 0 && e.kind === "commander",
  );
  const predicates = [
    !!hero &&
      Math.hypot(hero.x - progress.origin.x, hero.y - progress.origin.y) > 2 &&
      state.commandLog.some(
        ({ command }) =>
          command.team === 0 &&
          ["steer", "move", "capture"].includes(command.type),
      ),
    state.map.nodes.some((n) => n.kind === "gold" && n.owner === 0),
    state.map.nodes.some((n) => n.kind === "wood" && n.owner === 0),
    progress.inspectedKeep,
    state.entities.filter((e) => e.team === 0 && e.kind === "unit" && e.hp > 0)
      .length >= 3,
    hasNeighboringHouses(state),
    state.entities.some(
      (e) =>
        e.team === 0 &&
        e.type === "house" &&
        e.hp > 0 &&
        (e.buildingLevel ?? 1) >= 2,
    ),
    state.map.nodes.some((n) => n.kind === "relic" && n.owner === 0),
  ];
  while (step < predicates.length && predicates[step]) step++;
  return { ...progress, step };
}
export function learningTarget(
  state: GameState,
  step: number,
): Point | undefined {
  const origin = state.map.spawns[0];
  if (step === 0)
    return state.entities.find((e) => e.team === 0 && e.kind === "commander");
  if (step === 3)
    return state.entities.find((e) => e.team === 0 && e.type === "keep");
  if (step === 6)
    return state.entities.find(
      (e) => e.team === 0 && e.type === "house" && e.hp > 0,
    );
  const kind =
    step === 1 ? "gold" : step === 2 ? "wood" : step === 7 ? "relic" : null;
  return kind
    ? state.map.nodes
        .filter((n) => n.kind === kind)
        .sort(
          (a, b) =>
            Math.hypot(a.x - origin.x, a.y - origin.y) -
            Math.hypot(b.x - origin.x, b.y - origin.y),
        )[0]
    : undefined;
}
export function restoreLearning(
  state: GameState,
  value: unknown,
): LearningProgress {
  const hero = state.entities.find(
    (e) => e.team === 0 && e.kind === "commander",
  )!;
  const initial = {
    step: 0,
    origin: {
      x: hero?.x ?? state.map.spawns[0].x,
      y: hero?.y ?? state.map.spawns[0].y,
    },
    inspectedKeep: false,
  };
  if (!value || typeof value !== "object") return initial;
  const saved = value as Partial<LearningProgress>;
  if (
    Number.isInteger(saved.step) &&
    saved.step! >= 0 &&
    saved.step! <= LESSONS.length
  )
    initial.step = saved.step!;
  if (
    saved.origin &&
    Number.isFinite(saved.origin.x) &&
    Number.isFinite(saved.origin.y) &&
    saved.origin.x >= 0 &&
    saved.origin.y >= 0 &&
    saved.origin.x < state.map.width &&
    saved.origin.y < state.map.height
  )
    initial.origin = { ...saved.origin };
  initial.inspectedKeep = saved.inspectedKeep === true;
  return advanceLearning(state, initial);
}
