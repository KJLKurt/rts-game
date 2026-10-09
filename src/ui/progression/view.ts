import "./progression.css";
import { escapeText as esc } from "../escape";
import {
  ACHIEVEMENT_DEFINITIONS,
  PERSISTENT_CHOICES,
  profileBanner,
  type AchievementCategory,
  type ProfileV2,
} from "./profile";
export const ACHIEVEMENT_CATEGORIES: {
  id: AchievementCategory;
  label: string;
}[] = [
  { id: "milestones", label: "Milestones" },
  { id: "economy", label: "Economy" },
  { id: "tactics", label: "Tactics" },
  { id: "commanders", label: "Commanders" },
  { id: "stories", label: "Stories" },
  { id: "challenges", label: "Challenges" },
];
const time = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
const number = (value: number) => Math.floor(value).toLocaleString("en");
export function achievementGridHTML(
  profile: ProfileV2,
  category: AchievementCategory | "all" = "all",
): string {
  return `<nav class="achievement-filters" aria-label="Achievement category">${[{ id: "all", label: "All" }, ...ACHIEVEMENT_CATEGORIES].map((item) => `<button class="button ${item.id === category ? "active" : ""}" data-action="record-category" data-id="${item.id}" aria-pressed="${item.id === category}">${item.label}</button>`).join("")}</nav><div class="achievement-grid">${ACHIEVEMENT_DEFINITIONS.filter(
    (item) => category === "all" || item.category === category,
  )
    .map((achievement) => {
      const record = profile.achievements[achievement.id] ?? {
          unlocked: false,
          progress: 0,
          unlockedAt: null,
        },
        hidden = achievement.hidden && !record.unlocked,
        pending =
          !hidden && !record.unlocked && record.progress >= achievement.target;
      return `<article class="achievement ${record.unlocked ? "unlocked" : ""}"><div><span class="eyebrow">${esc(achievement.category)}${record.unlocked ? " · earned" : ""}</span><h3>${hidden ? "Secret achievement" : esc(achievement.name)}</h3><p>${hidden ? "Keep exploring the frontier to discover this challenge." : esc(achievement.description)}</p>${hidden ? "" : `<progress max="${achievement.target}" value="${record.progress}" aria-label="${esc(achievement.name)} progress"></progress><small>${number(record.progress)} / ${number(achievement.target)}</small>`}${pending ? `<small class="achievement-pending">Progress recorded. Awarded after you finish another battle without surrender.</small>` : ""}${record.unlocked ? `<small class="achievement-date">${record.unlockedAt ? `Earned ${esc(new Date(record.unlockedAt).toLocaleDateString("en", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }))} (UTC)` : "Earned before detailed records began"}</small>` : ""}</div></article>`;
    })
    .join("")}</div>`;
}
export function commandRecordHTML(
  profile: ProfileV2,
  category: AchievementCategory | "all" = "all",
): string {
  const metric = (value: string | number, label: string) =>
    `<div><b>${esc(value)}</b><span>${esc(label)}</span></div>`;
  return `<p class="profile-title">${esc(profileBanner(profile))}</p><div class="record-stats">${metric(profile.wins, "Victories")}${metric(profile.games - profile.wins, "Defeats")}${metric(profile.games, "Battles")}${metric(profile.bestStreak, "Best streak")}${metric(time(profile.seconds), "Total play time")}${metric(profile.fastestVictory === null ? "—" : time(profile.fastestVictory), "Fastest victory")}</div><details class="record-details"><summary>Army, resources, and commander use</summary><div class="record-stats">${metric(number(profile.kills), "Enemies defeated")}${metric(number(profile.totals.unitsCreated), "Units fielded")}${metric(number(profile.totals.unitsLost), "Units lost")}${metric(number(profile.totals.buildingsCreated), "Buildings created")}${metric(number(profile.totals.buildingsDestroyed), "Enemy buildings destroyed")}${metric(number(profile.totals.goldCollected), "Gold collected")}${metric(number(profile.totals.woodCollected), "Wood collected")}${metric(number(profile.totals.captures), "Captures")}</div><h3>Faction use</h3><ul>${Object.entries(
    profile.factionUsage,
  )
    .map(
      ([id, value]) =>
        `<li>${esc(id)}: ${value.games} battles · ${value.wins} wins · ${time(value.seconds)}</li>`,
    )
    .join("")}</ul><h3>Commander use</h3><ul>${Object.entries(
    profile.commanderUsage,
  )
    .map(
      ([id, value]) =>
        `<li>${esc(id)}: ${value.games} battles · ${value.wins} wins · ${time(value.seconds)}</li>`,
    )
    .join(
      "",
    )}</ul><p class="muted">Detailed army and usage statistics begin with this version. Earlier victories and achievement unlocks are preserved.</p></details><h2 class="section-title">Achievements <small>${profile.unlocked.length} / ${ACHIEVEMENT_DEFINITIONS.length}</small></h2>${achievementGridHTML(profile, category)}<h2 class="section-title">Earned choices</h2><p>Titles change your command record. Expedition charters offer tradeoffs for that mode. Ordinary skirmishes receive no permanent power bonuses.</p><div class="achievement-grid">${PERSISTENT_CHOICES.map((choice) => `<article class="achievement ${profile.choices.includes(choice.id) ? "unlocked" : ""}"><div><span class="eyebrow">${choice.kind}</span><h3>${esc(choice.title)}</h3><p>${esc(choice.description)}</p>${profile.choices.includes(choice.id) ? (choice.kind === "cosmetic" ? `<button class="button" data-action="profile-banner" data-id="${choice.id}" ${profile.selectedBanner === choice.id ? "disabled" : ""}>${profile.selectedBanner === choice.id ? "Current title" : "Use title"}</button>` : choice.kind === "challenge" ? `<button class="button" data-action="profile-challenge" data-id="${choice.id}">Play challenge</button>` : "<small>Available when starting an expedition</small>") : `<small>${esc(choice.requirement)}</small>`}</div></article>`).join("")}</div><h2 class="section-title">Recent battles <small>Last ${profile.history.length} of up to 50</small></h2>${profile.history.length ? `<ol class="match-history">${profile.history.map((match) => `<li><strong>${match.victory ? "Victory" : "Defeat"} · ${esc(match.missionId ?? match.expeditionNode ?? match.mode)}</strong><span>${time(match.seconds)} · ${esc(match.faction)} / ${esc(match.commander)} · ${esc(match.difficulty)}</span><p>${esc(match.reason)}</p><small>${esc(match.endedAt.slice(0, 16).replace("T", " "))} UTC · ${match.stats.kills} kills · ${match.stats.unitsLost} troops lost · seed ${esc(match.seed)}</small></li>`).join("")}</ol>` : "<p>Your next completed battle will begin the detailed history.</p>"}`;
}
