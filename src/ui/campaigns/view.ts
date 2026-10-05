import "./campaigns.css";
import type { GameState } from "../../sim/types";
import { escapeText as esc } from "../escape";
import type { ProfileV2 } from "../progression/profile";
import type { AuthoredCampaign, AuthoredMission } from "./authored";
import {
  availableMissionIds,
  completedMissionIds,
  missionObjectiveProgress,
} from "./runtime";
import {
  EXPEDITION_NODES,
  EXPEDITION_LOADOUTS,
  currentExpeditionNode,
  expeditionBonusSummary,
  expeditionOptions,
  isExpeditionBattle,
  type ExpeditionRun,
} from "./expedition";
export function campaignCardsHTML(
  campaigns: AuthoredCampaign[],
  profile: ProfileV2,
): string {
  return `<div class="mission-list">${campaigns.map((campaign) => `<button class="mission-card" data-action="choose-campaign" data-id="${esc(campaign.id)}"><span class="mission-number" aria-hidden="true">${completedMissionIds(campaign, profile).size === campaign.missions.length ? "✓" : "⚑"}</span><div><h2>${esc(campaign.title)}</h2><p>${esc(campaign.description)}</p><span class="mission-meta">${completedMissionIds(campaign, profile).size} / ${campaign.missions.length} chapters completed · ${esc(campaign.commander)}</span></div></button>`).join("")}</div>`;
}
export function missionCardsHTML(
  campaign: AuthoredCampaign,
  profile: ProfileV2,
): string {
  const available = availableMissionIds(campaign, profile),
    completed = completedMissionIds(campaign, profile);
  return `<div class="mission-list">${campaign.missions.map((mission, index) => `<button class="mission-card ${available.has(mission.id) ? "available" : "locked"}" data-action="mission" data-id="${index}" ${available.has(mission.id) ? "" : "disabled"}><span class="mission-number">${completed.has(mission.id) ? "✓" : String(index + 1).padStart(2, "0")}</span><div><span class="eyebrow">${esc(mission.subtitle)}</span><h2>${esc(mission.title)}</h2><p>${esc(mission.briefing)}</p><span class="mission-meta">${esc(mission.settings.biome)} · ${completed.has(mission.id) ? "Completed · replay available" : available.has(mission.id) ? "Ready to play" : "Complete the previous chapter"}</span><p class="mission-reward">Reward: ${esc(mission.reward)}</p></div></button>`).join("")}</div>`;
}
export function missionBriefingHTML(mission: AuthoredMission): string {
  return `<span class="eyebrow">${esc(mission.subtitle)}</span><p class="story">${esc(mission.story)}</p><div class="briefing-objective"><p>${esc(mission.briefing)}</p></div><ol class="mission-objectives">${mission.objectives.map((objective) => `<li><strong>${esc(objective.title)}</strong><p>${esc(objective.description)}</p></li>`).join("")}</ol><p class="muted">Victory: complete every required objective. Defeat: lose your Command Keep. You can save, leave, continue, or retry this chapter.</p><p>Reward: ${esc(mission.reward)}</p>`;
}
export function missionObjectivesHTML(
  state: GameState,
  mission: AuthoredMission,
): string {
  return `<div class="mission-checklist" aria-label="Chapter objectives">${missionObjectiveProgress(
    state,
    mission,
  )
    .map(
      ({ objective, complete, current, target, text }) =>
        `<div class="mission-objective ${complete ? "complete" : ""}"><strong>${complete ? "✓ " : ""}${esc(objective.title)}</strong><span>${esc(text)}</span><progress max="${target || 1}" value="${current}" aria-label="${esc(objective.title)}"></progress><small>${esc(objective.description)}</small></div>`,
    )
    .join("")}</div>`;
}
const action = (label: string, actionName: string, id = "", disabled = false) =>
  `<button class="button secondary" data-action="${actionName}" data-id="${esc(id)}" ${disabled ? "disabled" : ""}>${esc(label)}</button>`;
export function expeditionHTML(
  run: ExpeditionRun | null,
  profile: ProfileV2,
): string {
  if (!run)
    return `<div class="expedition-intro"><h2>Seven stops. Four battles. Your route.</h2><p>Fight regular, elite, and boss encounters. Choose villages, shops, relics, and events between them. Supplies and upgrades apply to your next battles. One defeat ends the run.</p><p>Your route and choices are saved between stops. A saved battle resumes the same encounter.</p><div class="route-choices">${EXPEDITION_LOADOUTS.map((loadout) => `<article class="route-choice"><h3>${esc(loadout.title)}</h3><p>${esc(loadout.description)}</p>${action(loadout.unlock && !profile.choices.includes(loadout.unlock) ? "Earn this charter in the story" : "Begin expedition", "expedition-start", loadout.id, !!loadout.unlock && !profile.choices.includes(loadout.unlock))}</article>`).join("")}</div></div>`;
  const node = currentExpeditionNode(run),
    visited = new Set(run.journal.map((entry) => entry.nodeId));
  const banner = `<div class="expedition-summary"><h2>${run.phase === "completed" ? "The Hollow Crown has fallen" : run.phase === "defeated" ? "The expedition has ended" : "Beyond the map"}</h2><p>${run.victories} / 4 battles won · ${esc(run.commander)} · ${esc(run.faction)}</p><p>${expeditionBonusSummary(run).map(esc).join(" · ")}</p><small>Gold and wood are bonuses at the start of each future battle. Damage and health apply only to your forces during this run.</small></div>`;
  const map = `<ol class="expedition-map" aria-label="Expedition route">${Array.from(
    { length: 7 },
    (_, tier) =>
      `<li><span>Stop ${tier + 1}</span><div>${EXPEDITION_NODES.filter(
        (item) => item.tier === tier,
      )
        .map(
          (item) =>
            `<span class="expedition-stop ${visited.has(item.id) ? "visited" : run.route.includes(item.id) ? "available" : ""}">${visited.has(item.id) ? "✓ " : ""}${esc(item.title)} <small>${esc(item.kind)}</small></span>`,
        )
        .join("")}</div></li>`,
  ).join("")}</ol>`;
  let content = "";
  if (run.phase === "route")
    content = `<h3>Choose your next stop</h3><div class="route-choices">${expeditionOptions(
      run,
    )
      .map(
        (item) =>
          `<article class="route-choice"><span class="eyebrow">${esc(item.kind)}</span><h3>${esc(item.title)}</h3><p>${esc(item.description)}</p>${action(isExpeditionBattle(item) ? "Prepare for battle" : "Visit this stop", "expedition-node", item.id)}</article>`,
      )
      .join("")}</div>`;
  if (run.phase === "choice" && node)
    content = `<h3>${esc(node.title)}</h3><p>${esc(node.description)}</p><div class="route-choices">${node.choices!.map((choice) => `<article class="route-choice"><h3>${esc(choice.title)}</h3><p>${esc(choice.description)}</p>${action((choice.cost ?? 0) > run.crowns ? `Need ${choice.cost} crowns` : "Choose", "expedition-choice", choice.id, (choice.cost ?? 0) > run.crowns)}</article>`).join("")}</div>`;
  if (run.phase === "battle" && node)
    content = `<h3>${esc(node.title)}</h3><p>${esc(node.description)}</p>${action("Continue encounter", "expedition-resume")}`;
  if (run.phase === "completed" || run.phase === "defeated")
    content = `<p>${run.phase === "completed" ? "The expedition is complete. Your Wayfinder title is recorded; a new run starts fresh." : "Your command record is kept. A new expedition starts with fresh supplies and resets this run’s bonuses and route."}</p>${action("Start a new expedition", "expedition-new")}${run.phase === "defeated" ? `<p>Gather a mixed army at a safe rally point, defend your supplies, then push toward a relic.</p>${action("Practice the basics", "learn")}` : ""}`;
  return `${banner}${content}<p>${action("Save route", "expedition-save")}</p><details class="expedition-route-details"><summary>Inspect the whole route</summary>${map}</details>`;
}
