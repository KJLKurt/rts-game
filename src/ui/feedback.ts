/** Presentation lifetime only; this never changes commands or tactical pause. */
export interface FeedbackLifetime {
  battleMatchId: string | null;
  untilResume: boolean;
}

export function feedbackHasExpired(
  feedback: FeedbackLifetime | null,
  context: { battleMatchId: string | null; paused: boolean },
): boolean {
  return feedback !== null && feedback.battleMatchId !== null && (
    feedback.battleMatchId !== context.battleMatchId ||
    (feedback.untilResume && !context.paused)
  );
}

export function troopSelectionFeedback(count: number): string {
  return count
    ? `${count} troop${count === 1 ? "" : "s"} selected. Choose Move, Attack, or Hold.`
    : "Selection cleared.";
}

export function armySelectionFeedback(count: number): string {
  return count
    ? `${count} unit${count === 1 ? "" : "s"} ready. Choose Move, Attack, or Hold.`
    : "No troops available. Recruit reinforcements or wait for your commander to recover.";
}
