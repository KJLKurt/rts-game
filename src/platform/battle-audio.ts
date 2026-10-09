import type { GameEvent, GameState } from "../sim/types";
import type { SoundEffect } from "./audio";

/** Presentation only. Hidden enemy releases must not reveal activity through sound. */
export function battleSound(event: GameEvent, state: GameState): SoundEffect | null {
  const own = event.team === 0;
  if (event.type === "build") return own && event.subtype === "complete" ? "complete" : null;
  if (event.type === "capture") return own ? "capture" : null;
  if (event.type === "alert") return own ? "alert" : null;
  if (event.type === "research") return own ? "research" : null;
  if (event.type === "death") return own ? "destroy" : null;
  if (event.type === "hit") return own || event.targetTeam === 0 ? "hit" : null;
  if (event.type !== "attack" && event.type !== "projectile") return null;
  const x = Math.floor(event.x), y = Math.floor(event.y);
  const visible = x >= 0 && y >= 0 && x < state.map.width && y < state.map.height
    && !!state.fog.visible[0]?.[y * state.map.width + x];
  if (!own && !visible) return null;
  if (event.type === "attack") return "melee";
  return event.subtype === "archer" || event.subtype === "ranger" ? "arrow" : null;
}

/** nextEventId belongs to the next future event, not the last saved event. */
export function restoredEventCursor(state: Pick<GameState, "nextEventId">): number {
  return state.nextEventId - 1;
}
