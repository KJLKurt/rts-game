import { issueCommand, stepGame } from "../sim";
import type { GameState } from "../sim/types";

/** App interruptions are separate from the player's limited tactical pauses. */
export class BattleSuspension {
  private interrupted = false;

  get suspended() {
    return this.interrupted;
  }

  suspend(state: GameState) {
    // Zero steering before saving. Do not cancel ordinary movement orders or
    // touch the tactical order queue when there is no direct input to release.
    if (state.entities.some((e) => e.team === 0 && e.directControl))
      issueCommand(state, { type: "steer", team: 0, dx: 0, dy: 0 });
    const changed = !this.interrupted;
    this.interrupted = true;
    return changed;
  }

  /** Only an explicit foreground user action may dismiss the interruption. */
  resume(hidden: boolean) {
    if (hidden || !this.interrupted) return false;
    this.interrupted = false;
    return true;
  }

  reset() {
    this.interrupted = false;
  }

  step(state: GameState, elapsed: number, blocked: boolean) {
    if (!this.interrupted && !blocked) stepGame(state, elapsed);
  }
}
