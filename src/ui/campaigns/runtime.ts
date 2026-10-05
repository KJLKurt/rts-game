import type { GameState, ScriptCondition } from "../../sim/types";
import { evaluateScriptCondition } from "../../sim/triggers";
import type { ProfileV2 } from "../progression/profile";
import {
  STORY_CAMPAIGNS,
  type AuthoredCampaign,
  type AuthoredMission,
  type MissionObjective,
} from "./authored";
export interface CampaignSession {
  version: 1;
  campaignId: string;
  missionId: string;
  matchId: string;
}
export interface ObjectiveProgress {
  objective: MissionObjective;
  complete: boolean;
  current: number;
  target: number;
  text: string;
}
export function completedMissionIds(
  campaign: AuthoredCampaign,
  profile: Pick<
    ProfileV2,
    "campaign" | "campaignProgress" | "completedMissions"
  >,
): Set<string> {
  const ids = new Set(profile.completedMissions[campaign.id] ?? []);
  if (Object.hasOwn(profile.completedMissions, campaign.id)) return ids;
  const legacy =
    profile.campaignProgress[campaign.id] ??
    (campaign.id === "rise-of-the-frontier" ? profile.campaign : 0);
  for (const chapter of campaign.missions.slice(0, legacy)) ids.add(chapter.id);
  return ids;
}
export function availableMissionIds(
  campaign: AuthoredCampaign,
  profile: Pick<
    ProfileV2,
    "campaign" | "campaignProgress" | "completedMissions"
  >,
): Set<string> {
  const completed = completedMissionIds(campaign, profile),
    available = new Set([campaign.entry, ...completed]);
  for (const chapter of campaign.missions)
    if (completed.has(chapter.id))
      chapter.next.forEach((id) => available.add(id));
  return available;
}
export function nextMissions(
  campaign: AuthoredCampaign,
  chapter: AuthoredMission,
): AuthoredMission[] {
  return chapter.next
    .map((id) => campaign.missions.find((item) => item.id === id))
    .filter((item): item is AuthoredMission => !!item);
}
export function createCampaignSession(
  campaignId: string,
  missionId: string,
  matchId: string,
): CampaignSession {
  if (
    !STORY_CAMPAIGNS.some(
      (campaign) =>
        campaign.id === campaignId &&
        campaign.missions.some((mission) => mission.id === missionId),
    )
  )
    throw new Error("That campaign chapter could not be found.");
  if (!/^[a-zA-Z0-9:_-]{1,150}$/.test(matchId))
    throw new Error("The chapter needs a valid match ID.");
  return { version: 1, campaignId, missionId, matchId };
}
export function restoreCampaignSession(value: unknown): CampaignSession | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const saved = value as CampaignSession;
  if (
    saved.version !== 1 ||
    typeof saved.campaignId !== "string" ||
    typeof saved.missionId !== "string" ||
    typeof saved.matchId !== "string"
  )
    return null;
  try {
    return createCampaignSession(
      saved.campaignId,
      saved.missionId,
      saved.matchId,
    );
  } catch {
    return null;
  }
}
export function installMission(
  state: GameState,
  mission: AuthoredMission,
): void {
  if (state.tick !== 0)
    throw new Error(
      "Install chapter triggers only at a fresh battle launch; restored battles already contain their fired trigger state.",
    );
  state.triggers = structuredClone(mission.triggers);
  state.objectiveText = mission.briefing;
  state.settings.scriptedVictory = true;
}
const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
function values(
  state: GameState,
  condition: ScriptCondition,
): { current: number; target: number; text: string } {
  let current = 0,
    target = 1,
    text = "";
  switch (condition.type) {
    case "time":
      current = state.time;
      target = condition.seconds;
      text = `${clock(current)} / ${clock(target)}`;
      break;
    case "owned":
      current = state.map.nodes.filter(
        (node) => node.kind === condition.kind && node.owner === condition.team,
      ).length;
      target = condition.count;
      break;
    case "units":
      current = state.entities.filter(
        (entity) =>
          entity.team === condition.team &&
          entity.kind === "unit" &&
          entity.hp > 0 &&
          entity.buildProgress >= 1 &&
          (!condition.unit || entity.type === condition.unit),
      ).length;
      target = condition.count;
      break;
    case "buildings":
      current = state.entities.filter(
        (entity) =>
          entity.team === condition.team &&
          entity.kind === "building" &&
          entity.hp > 0 &&
          entity.buildProgress >= 1 &&
          (!condition.building || entity.type === condition.building),
      ).length;
      target = condition.count;
      break;
    case "stat":
      current = state.players[condition.team]?.stats[condition.stat] ?? 0;
      target = condition.amount;
      break;
    case "resource":
      current = state.players[condition.team]?.[condition.resource] ?? 0;
      target = condition.amount;
      break;
    case "research":
      current =
        state.players[condition.team]?.research[condition.technology] ?? 0;
      target = condition.level;
      break;
    case "all":
      current = condition.conditions.filter((child) =>
        evaluateScriptCondition(state, child),
      ).length;
      target = condition.conditions.length;
      break;
    case "any":
      current = Number(evaluateScriptCondition(state, condition));
      text = current ? "Complete" : "Complete either route";
      break;
    default:
      current = Number(evaluateScriptCondition(state, condition));
      text = current ? "Complete" : "In progress";
  }
  return {
    current: Math.min(target, current),
    target,
    text: text || `${Math.floor(Math.min(target, current))} / ${target}`,
  };
}
export function missionObjectiveProgress(
  state: GameState,
  mission: AuthoredMission,
): ObjectiveProgress[] {
  return mission.objectives.map((objective) => ({
    objective,
    complete: evaluateScriptCondition(state, objective.condition),
    ...values(state, objective.condition),
  }));
}
