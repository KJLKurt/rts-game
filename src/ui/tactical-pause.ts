import type { Difficulty } from "../sim/types";

/** Presentation of the existing engine rules; this never spends a pause. */
export function tacticalPauseRule(difficulty: Difficulty): string {
  const name = difficulty[0].toUpperCase() + difficulty.slice(1);
  const rule = difficulty === "hard"
    ? "3 tactical pauses per battle"
    : difficulty === "brutal"
      ? "Tactical pause disabled"
      : "Unlimited tactical pauses";
  return `${name} difficulty · ${rule}`;
}

export function tacticalPausePresentation(
  difficulty: Difficulty,
  paused: boolean,
  pausesUsed: number,
) {
  const remaining = Math.max(0, 3 - pausesUsed);
  const budget = difficulty === "hard"
    ? `${remaining}/3 left`
    : difficulty === "brutal" ? "Brutal" : "Unlimited";
  const allowance = difficulty === "hard"
    ? `${remaining} of 3 tactical pauses remaining.`
    : difficulty === "brutal"
      ? "Tactical pause is disabled on Brutal."
      : "Unlimited tactical pauses.";

  // Resuming is always available, even on the third Hard pause or a paused save.
  if (paused)
    return {
      state: "paused",
      label: "Resume",
      budget,
      accessibleLabel: `Resume battle. ${allowance}`,
      disabled: false,
    };
  if (difficulty === "brutal")
    return {
      state: "disabled",
      label: "Pause off",
      budget,
      accessibleLabel: `Pause off. ${allowance}`,
      disabled: true,
    };
  if (difficulty === "hard" && remaining === 0)
    return {
      state: "exhausted",
      label: "No pauses",
      budget,
      accessibleLabel: "No pauses. All three tactical pauses have been used.",
      disabled: true,
    };
  return {
    state: "available",
    label: "Pause",
    budget,
    accessibleLabel: `Tactical pause. ${allowance}`,
    disabled: false,
  };
}
