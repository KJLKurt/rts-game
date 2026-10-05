import type { GameState } from "../../sim/types";
import { restoreGame } from "../../sim/engine";
import { STORY_CAMPAIGNS } from "./authored";
import { restoreCampaignSession, type CampaignSession } from "./runtime";
import {
  expeditionBattle,
  restoreExpedition,
  saveExpedition,
  type ExpeditionRun,
  type ExpeditionSave,
} from "./expedition";

export interface BattleJourney {
  matchId: string;
  campaign: CampaignSession | null;
  expedition: ExpeditionSave | null;
}
export interface ExpeditionCheckpoint {
  version: 1;
  run: ExpeditionSave;
  battle: unknown | null;
}
const object = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
export function isMatchId(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9:_-]{1,150}$/.test(value);
}
/** Journey metadata identifies a battle, but never replaces its saved engine state. */
export function restoreBattleJourney(
  value: unknown,
  state: GameState,
  legacyMatchId: string,
): BattleJourney {
  const record = object(value);
  if (record.version !== 2)
    return { matchId: legacyMatchId, campaign: null, expedition: null };
  if (!isMatchId(record.matchId))
    throw new Error("The saved battle has no valid match identity.");
  const campaign =
    record.campaignSession === null
      ? null
      : restoreCampaignSession(record.campaignSession);
  const expedition =
    record.expedition === null ? null : restoreExpedition(record.expedition);
  if (
    (record.campaignSession !== null && !campaign) ||
    (record.expedition !== null && !expedition) ||
    (campaign && expedition)
  )
    throw new Error("The saved journey does not match this battle.");
  if (campaign) {
    const chapter = STORY_CAMPAIGNS.find(
      (item) => item.id === campaign.campaignId,
    )!.missions.find((item) => item.id === campaign.missionId)!;
    if (
      campaign.matchId !== record.matchId ||
      state.settings.seed !== chapter.settings.seed ||
      !state.settings.scriptedVictory ||
      !state.triggers.some((trigger) => trigger.id === "mission-complete")
    )
      throw new Error("The saved chapter does not match this battle.");
  }
  if (
    expedition &&
    (expedition.phase !== "battle" ||
      expeditionBattle(expedition).settings.seed !== state.settings.seed)
  )
    throw new Error(
      "The saved expedition encounter does not match this battle.",
    );
  return {
    matchId: record.matchId,
    campaign,
    expedition: expedition ? saveExpedition(expedition) : null,
  };
}
export function expeditionCheckpoint(
  run: ExpeditionRun,
  battle: unknown | null,
): ExpeditionCheckpoint {
  return {
    version: 1,
    run: saveExpedition(run),
    battle: structuredClone(battle),
  };
}
export function restoreExpeditionCheckpoint(
  value: unknown,
): { run: ExpeditionRun; battle: unknown | null } | null {
  const record = object(value),
    run = restoreExpedition(record.run);
  if (record.version !== 1 || !run) return null;
  // Only journal decisions rebuild rewards. Completed stops discard stale saves.
  if (run.phase !== "battle" || !record.battle) return { run, battle: null };
  const battle = object(record.battle);
  try {
    const state = restoreGame(battle.game as string);
    const journey = restoreBattleJourney(battle, state, "legacy");
    if (
      !journey.expedition ||
      JSON.stringify(journey.expedition) !== JSON.stringify(saveExpedition(run))
    )
      return { run, battle: null };
    return { run, battle: structuredClone(battle) };
  } catch {
    return { run, battle: null };
  }
}
