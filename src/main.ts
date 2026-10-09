import { observeControlDeck, battlefieldCenterY } from "./ui/deck-layout";
import { troopSummaryPosition, type ScreenRect } from "./render/troop-summary";
import { aboutHTML } from "./ui/about";
import { BUILD_ID } from "./platform/build-info";
import { renderResearchTree } from "./ui/research";
import { buildingRequirementView, recruitRequirementView } from "./ui/prerequisites";
import { EditorHistory, strokeTiles } from "./ui/editor-tools";
import {
  WorkshopLibrary,
  WorkshopTestSession,
  ensureWorkshopMap,
  createWorkshopPreview,
  validateWorkshopMap,
  renderWorkshopSettings,
  readWorkshopSettings,
  renderWorkshopPalette,
  placeWorkshopObject,
  importWorkshopMap,
  exportWorkshopMap,
  type WorkshopMap,
  type WorkshopPlacementOptions,
  type WorkshopBookmark,
} from "./ui/workshop";
import { DEFAULT_SETTINGS } from "./sim/content";
import { SETUP_SPEEDS, selectSetupScale, prepareSetup } from "./ui/setup-model";
import {
  renderSetupControls,
  renderSetupSummary,
  readSetupControls,
} from "./ui/setup-view";
import {
  LESSONS,
  advanceLearning,
  learningTarget,
  learningActionAvailable,
  learningPanelHint,
  restoreLearning,
  type LearningProgress,
} from "./ui/learning";
import { snapConstruction } from "./sim/construction";
import "./style.css";
import { VISUAL_THEMES, normalizeVisualTheme, type VisualThemeId } from "./render/visualThemes";
import {
  inspectionHTML,
  productionHTML,
  economyHTML,
  refreshInspection,
  recruitProducer,
  trainingSeconds,
  capacityGainText,
  constructionProgressText,
  inspectionAvailabilitySignature,
} from "./ui/inspection";
import { updateLiveHTML } from "./ui/live-html";
import { tacticalPausePresentation } from "./ui/tactical-pause";
import { expeditionOpeningGuidance, rallyDestination, recruitDestination, resourceTargetName, selectedOrderDescription, rangedSpacingDescription } from "./ui/command-guidance";
import {
  populationBreakdown,
  technologyCost,
  nextBuildingUpgrade,
  PRODUCTION_QUEUE_LIMIT,
} from "./sim/progression";
import { relicSummary, nearestRelic, relicControlDescription } from "./ui/objectives";
import { battleDefeatAdvice, battleResultReason } from "./ui/results";
import { buildingUnderAttack } from "./ui/battle-guidance";
import { advanceTutorial, restoreTutorial } from "./ui/tutorial";
import { getEconomyRates } from "./sim/economy";
import { encodeMapCode } from "./ui/map-code";
import { chooseAbilityTarget } from "./ui/targeting";
import { findBreachTarget } from "./sim/ability-targeting";
import { plannedBuildResult } from "./ui/placement";
import { findLearningHouseSite, houseHasRoom, learningHouseGuidance } from "./ui/learning-placement";
import {
  createGame,
  issueCommand,
  serializeGame,
  restoreGame,
  UNITS,
  BUILDINGS,
  COMMANDERS,
  FACTIONS,
  TECHNOLOGIES,
  BIOMES,
  RUSH_UPGRADES,
  canBuild,
  isWalkable,
  getUnitCost,
  projectPendingCommands,
  areAllied,
  allianceMembers,
  playerAllianceWon,
  canPlayerContinue,
  hasBattleEnded,
  playerOutcomeStatus,
} from "./sim";
import type {
  GameState,
  GameSettings,
  GameCommand,
  Entity,
  BuildingId,
  UnitId,
  TechId,
  Point,
} from "./sim/types";
import { Battlefield, renderMinimap } from "./render/Battlefield";
import { AudioDirector } from "./platform/audio";
import {
  loadRecord,
  saveRecord,
  removeRecord,
  readLocal,
  writeLocal,
  defaultPreferences,
  loadProfile,
} from "./platform/storage";
import { setupPWA, UpdateUnavailableError } from "./platform/pwa";
import { SaveQueue } from "./platform/save-queue";
import { ResultCommit } from "./platform/result-commit";
import { BattleSuspension } from "./platform/battle-suspension";
import { escapeText as esc } from "./ui/escape";
import { MAX_MAP_JSON_BYTES } from "./sim/validation";
import { CAMPAIGNS, ACHIEVEMENTS } from "./ui/content";
import { FRONTIER_CAMPAIGN } from "./ui/campaigns/authored";
import {
  availableMissionIds,
  createCampaignSession,
  installMission,
  missionObjectiveProgress,
  nextMissions,
  type CampaignSession,
} from "./ui/campaigns/runtime";
import {
  campaignCardsHTML,
  missionCardsHTML,
  missionBriefingHTML,
  missionObjectivesHTML,
  expeditionHTML,
} from "./ui/campaigns/view";
import {
  startUnlockedExpedition,
  visitExpeditionNode,
  chooseExpeditionReward,
  finishExpeditionBattle,
  expeditionBattle,
  restoreExpedition,
  saveExpedition,
  type ExpeditionRun,
  type ExpeditionLoadout,
} from "./ui/campaigns/expedition";
import {
  expeditionCheckpoint,
  restoreExpeditionCheckpoint,
  restoreBattleJourney,
} from "./ui/campaigns/session";
import {
  recordBattleResult,
  selectProfileBanner,
  challengeSettings,
  type AchievementCategory,
} from "./ui/progression/profile";
import {
  commandRecordHTML,
  ACHIEVEMENT_CATEGORIES,
} from "./ui/progression/view";
import { icon, unitIcons } from "./ui/icons";

import { resourceCostHTML, selectionName, selectionHealthHTML, placementFeedback, isPlacementInstruction } from "./ui/battle-readouts";
import { selectableTroops, pruneTroopSelection, toggleTroop, setTroopTypeSelection, troopSelectionGroups } from "./ui/troop-selection";
import { troopPickerHTML } from "./ui/troop-picker";
import { queuedConstructionPlans, type PlannedConstruction } from "./ui/queued-construction";
import { feedbackHasExpired, troopSelectionFeedback, armySelectionFeedback, type FeedbackLifetime } from "./ui/feedback";

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `<canvas id="world" aria-label="Isometric battlefield"></canvas><div id="screen"></div><div id="modal-root"></div><div id="suspension-root"></div><div id="toast" role="status" aria-live="polite" aria-atomic="true"></div><div id="update"></div>`;
const canvas = document.querySelector<HTMLCanvasElement>("#world")!,
  screen = document.querySelector<HTMLDivElement>("#screen")!,
  modal = document.querySelector<HTMLDivElement>("#modal-root")!;
const toastElement = document.querySelector<HTMLDivElement>("#toast")!;
const renderer = new Battlefield(canvas),
  audio = new AudioDirector();
const battleSuspension = new BattleSuspension();
let troopSummaryObstacles: ScreenRect[] = [];
let commanderFrameObstacles: ScreenRect[] = [];
const suspensionRoot = document.querySelector<HTMLDivElement>("#suspension-root")!;
let suspensionFocus: HTMLElement | null = null;
let audioInterrupted = false;
let preferences = readLocal("preferences", defaultPreferences),
  profile = loadProfile();
preferences.visualTheme = normalizeVisualTheme(preferences.visualTheme);
const initialVisualTheme = preferences.visualTheme;
void applyVisualTheme(initialVisualTheme).then(ready => {
  if (!ready && preferences.visualTheme === initialVisualTheme)
    preferences.visualTheme = renderer.visualTheme;
});
document.documentElement.style.setProperty(
  "--ui-scale",
  String(Math.max(1, Math.min(1.3, preferences.uiScale))),
);
audio.setMaster(preferences.master, preferences.muted);
audio.setVolumes(preferences.music, preferences.sfx);
let state: GameState,
  playing = false,
  selection = new Set<string>(),
  panel = "army",
  deckCollapsed = true,
  minimapCollapsed = false,
  recruitBatch = 1,
  rallyBuildingId: string | null = null,
  placement: BuildingId | null = null,
  repeatPlacement = false,
  targetPoint: Point | null = null,
  followCommander = true,
  modalOpen = false,
  menuPage = "home",
  speed = 1,
  lastFrame = 0,
  hudClock = 0,
  autosaveClock = 0,
  lastEvent = 0,
  toastTimer = 0,
  resultShown = false,
  missionIndex: number | null = null,
  expeditionBattleActive = false,
  tutorialStep = 0,
  tutorialSupplyCaptured = false,
  uiAction = "move";
let toastLifetime: FeedbackLifetime | null = null;
let troopSelectionDraft: Set<string> | null = null;
let armedOrder: "move" | "attack" | "attackMove" | null = null;
let targetError = "", selectedResourceId: string | null = null;
let placementMode: "place" | "pan" = "place", draggingPreview = false;
let inspectTab: "train" | "upgrades" | "info" = "info";
const battleSaves = new SaveQueue();
let savedGame: unknown = null,
  pointerDown: Point | null = null,
  pointerLast: Point | null = null,
  dragged = false,
  joystickVector: Point = { x: 0, y: 0 },
  joystickPointer: number | null = null,
  lastJoystick = 0;
let settings: Partial<GameSettings> = {
  seed: randomSeed(),
  biome: "grasslands",
  mapSize: "medium",
  mapGenerationVersion: 5,
  neutralCamps: 0,
  matchScale: "custom",
  populationCap: 80,
  difficulty: "normal",
  faction: "ironhold",
  commander: "warlord",
  duration: 18,
  mode: "domination",
  aiPlayers: 1,
  preset: "balanced",
};
let activeCampaign = CAMPAIGNS[0];
let campaignSession: CampaignSession | null = null;
let battleMatchId = "";
let pendingResult: {
  commit: ResultCommit;
  battle: ReturnType<typeof battleSnapshot>;
  profile: typeof profile;
  expedition: ExpeditionRun | null;
  expeditionActive: boolean;
  flight: Promise<boolean> | null;
} | null = null;
let expeditionRun: ExpeditionRun | null = null;
let savedExpeditionBattle: unknown | null = null;
let expeditionLoaded = false;
let recordCategory: AchievementCategory | "all" = "all";
let navigationVersion = 0;
const initialBattle = loadRecord("battle");
const expeditionReady = Promise.all([loadRecord("expedition"), initialBattle]).then(([saved, battle]) => {
  const restored = restoreExpeditionCheckpoint(saved);
  expeditionRun = restored?.run ?? null;
  savedExpeditionBattle = restored?.battle ?? null;
  // A profile failure may leave a newer finished battle outside the route's
  // older checkpoint. Resume that result instead of replaying the encounter.
  if (restored && battle) {
    const recovery = restoreExpeditionCheckpoint(expeditionCheckpoint(restored.run, battle));
    if (recovery?.battle) {
      const record = recovery.battle as { game: string };
      if (!canPlayerContinue(restoreGame(record.game)))
        savedExpeditionBattle = recovery.battle;
    }
  }
  expeditionLoaded = true;
  if (!playing && !editing && !modalOpen && menuPage === "expedition")
    renderExpedition();
});
function newMatchId() {
  return `battle:${crypto.randomUUID()}`;
}
function activeMission() {
  return missionIndex === null ? null : activeCampaign.missions[missionIndex];
}
async function saveExpeditionRoute() {
  const checkpoint = expeditionRun
    ? expeditionCheckpoint(expeditionRun, savedExpeditionBattle)
    : null;
  return battleSaves.run(async () => {
    if (checkpoint) await saveRecord("expedition", checkpoint);
    else await removeRecord("expedition");
  });
}
/** Commit a choice before exposing it; failed storage leaves the old route usable. */
async function commitExpeditionRoute(next: ExpeditionRun | null) {
  const checkpoint = next ? expeditionCheckpoint(next, null) : null;
  await battleSaves.run(async () => {
    if (checkpoint) await saveRecord("expedition", checkpoint);
    else await removeRecord("expedition");
  });
  expeditionRun = next;
  savedExpeditionBattle = null;
}
let learningGuideSkipped = false;
let learningProgress: LearningProgress | null = null,
  guideCollapsed = false,
  learningCompletionShown = false;
let tutorialOrigin: Point | null = null;
let previousFocus: HTMLElement | null = null;
let surrenderConfirmationMatchId: string | null = null;
let applyingUpdate = false;
let frameRate = 60;
let runtimeFailed = false;
let lastDeckSignature = "";
let planningSignature = "",
  planningSnapshot: GameState | null = null,
  planningSource: GameState | null = null;
function planningState() {
  if (!state.paused || !state.pendingCommands.length) return state;
  // Queue content, not only length, keeps restored/replaced plans accurate.
  const signature = JSON.stringify([state.tick, state.nextId, state.players.map(player => [player.gold, player.wood, player.defeated]), state.pendingCommands]);
  if (state !== planningSource || signature !== planningSignature || !planningSnapshot) {
    planningSnapshot = projectPendingCommands(state);
    planningSource = state;
    planningSignature = signature;
  }
  return planningSnapshot;
}
let queuedConstructionSource: GameState | null = null,
  queuedConstructionProjection: GameState | null = null,
  queuedConstructionSnapshot: readonly PlannedConstruction[] = [];
function visibleConstructionPlans(): readonly PlannedConstruction[] {
  if (!playing || editing || !state.paused || hasBattleEnded(state)) return [];
  const projected = planningState();
  if (queuedConstructionSource !== state || queuedConstructionProjection !== projected) {
    queuedConstructionSnapshot = queuedConstructionPlans(state, 0, projected);
    queuedConstructionSource = state;
    queuedConstructionProjection = projected;
  }
  return queuedConstructionSnapshot;
}
const hudHTML = new Map<string, string>();
let playfieldCenterY = innerHeight / 2;
let commanderFocusFitted = false;
let commanderFrameCache: { key: string; point: Point | undefined } | undefined;
let stopDeckObservation = () => {};
const debugEnabled = new URLSearchParams(location.search).has("debug");
let debugReveal = false;
const pointers = new Map<number, Point>();
let pinchDistance = 0;
let pinchCenter: Point | null = null;
function randomSeed() {
  return `FRONTIER-${Math.floor(Math.random() * 999999)
    .toString()
    .padStart(6, "0")}`;
}
function time(n: number) {
  return `${Math.floor(n / 60)}:${Math.floor(n % 60)
    .toString()
    .padStart(2, "0")}`;
}
function button(
  label: string,
  action: string,
  cls = "",
  ico?: string,
  extra = "",
) {
  return `<button class="${cls}" data-action="${action}" ${extra.includes("aria-label=") ? "" : `aria-label="${esc(label)}"`} ${extra}>${ico ? icon(ico) : ""}<span>${esc(label)}</span></button>`;
}
function positionBattleGuide() {
  const guide = document.querySelector<HTMLElement>("#battle-hint");
  const objective = document.querySelector<HTMLElement>("#objective");
  if (!guide || !objective) return;
  const reset = () => ["top", "max-height", "overflow-y"].forEach(name => guide.style.removeProperty(name));
  if (!playing || editing || guide.classList.contains("critical")) { reset(); delete guide.dataset.clearanceKey; return; }
  const o = objective.getBoundingClientRect(), deck = document.querySelector(".command-deck")?.getBoundingClientRect();
  const key = [innerWidth, innerHeight, o.x, o.y, o.width, o.height, deck?.top, guide.className, guide.textContent].join("/");
  if (guide.dataset.clearanceKey === key) return;
  guide.dataset.clearanceKey = key; reset();
  const r = guide.getBoundingClientRect();
  if (!r.width || !r.height || r.right <= o.left || r.left >= o.right || r.top >= o.bottom + 8 || r.bottom <= o.top) return;
  const top = Math.ceil(o.bottom + 8);
  guide.style.top = `${top}px`;
  const space = Math.min(innerHeight - 8, deck?.top ?? innerHeight - 8) - top - 8;
  if (space >= 44 && r.height > space) {
    guide.style.maxHeight = `${space}px`;
    guide.style.overflowY = "auto";
  }
}

function resetToastPosition() {
  ["top", "left", "width", "max-width", "transform", "transition-property", "padding"].forEach(name => toastElement.style.removeProperty(name));
}
/** Keep the sole live region alive before a dialog's HTML is replaced. */
function releaseDialogToast() {
  if (!modal.contains(toastElement)) return;
  app.append(toastElement);
  resetToastPosition();
  delete toastElement.dataset.positionKey;
}
function positionBattleToast() {
  const el = toastElement;
  const reset = resetToastPosition;
  const slot = el.closest<HTMLElement>(".dialog-feedback-slot");
  if (slot) {
    reset();
    delete el.dataset.positionKey;
    if (el.classList.contains("show")) {
      slot.dataset.hasFeedback = "true";
      // Expiry must not move a dialog control beneath an ongoing touch.
      slot.style.minHeight = `${Math.max(parseFloat(slot.style.minHeight) || 0, Math.ceil(el.getBoundingClientRect().height) + 12)}px`;
    }
    return;
  }
  if (!playing || editing) { reset(); delete el.dataset.positionKey; return; }
  if (!el.classList.contains("show")) return;
  const controls = [...document.querySelectorAll<HTMLElement>(".hud,.objective-bar,.battle-hint,.minimap-wrap,.map-controls,.commander-strip,#joystick,.ability-dock,.command-deck,.paused-ribbon,.placement-toolbar,.target-toolbar,#update")].flatMap(node => {
    const style = getComputedStyle(node), r = node.getBoundingClientRect();
    return style.display === "none" || style.visibility === "hidden" || !Number(style.opacity) || !r.width || !r.height ? [] : [{x:r.x,y:r.y,w:r.width,h:r.height}];
  });
  const key = [battleMatchId, el.textContent, innerWidth, innerHeight, ...controls.map(r => `${r.x},${r.y},${r.w},${r.h}`)].join("/");
  if (el.dataset.positionKey === key) return;
  reset(); el.dataset.positionKey = key; el.style.transitionProperty = "opacity";
  const z = renderer.camera.zoom;
  const silhouettes = state.entities.filter(e => e.hp > 0 && e.kind !== "building" && (e.team === 0 || state.fog.visible[0]?.[Math.floor(e.y) * state.map.width + Math.floor(e.x)])).map(e => {
    const p = renderer.worldToScreen(e.x,e.y); return {x:p.x-44*z,y:p.y-86*z,w:88*z,h:116*z};
  });
  const hud = document.querySelector(".hud")?.getBoundingClientRect(), objective = document.querySelector(".objective-bar")?.getBoundingClientRect();
  const anchor = {x:innerWidth/2,y:Math.max(hud?.bottom ?? 0,objective?.bottom ?? 0)+96};
  const widest = Math.min(560,innerWidth-16);
  const edges = [8,innerWidth-8,...controls.flatMap(r => [r.x-4,r.x+r.w+4])];
  const widths = [...new Set([widest,...[360,280,220,180].map(w => Math.min(widest,w)),...edges.flatMap(left => edges.map(right => right-left))])]
    .filter(w => w >= 140 && w <= widest).sort((a,b) => b-a);
  for (const compact of [false,true]) {
    if (compact) el.style.padding = "3px 12px";
  for (const width of widths) {
    el.style.width = `${width}px`; el.style.maxWidth = "none";
    const r = el.getBoundingClientRect();
    const point = troopSummaryPosition(anchor,{w:r.width,h:r.height},{w:innerWidth,h:innerHeight},controls,[],silhouettes);
    if (point) { el.style.left = `${point.x}px`; el.style.top = `${point.y}px`; el.style.transform = "none"; return; }
  }
  }
  reset(); // Preserve the established fallback if the viewport has no free rectangle.
}

function clearToast() {
  clearTimeout(toastTimer);
  toastTimer = 0;
  const el = document.querySelector<HTMLDivElement>("#toast")!;
  el.className = "";
  el.textContent = "";
  delete el.dataset.positionKey;
  toastLifetime = null;
}
function clearObsoleteBattleToast(nextMatchId: string | null) {
  if (feedbackHasExpired(toastLifetime, { battleMatchId: nextMatchId, paused: !!state?.paused }))
    clearToast();
}
function toast(text: string, tone = "", options: { untilResume?: boolean } = {}) {
  const el = document.querySelector<HTMLDivElement>("#toast")!;
  toastLifetime = { battleMatchId: playing && !editing ? battleMatchId : null, untilResume: options.untilResume === true };
  el.textContent = text;
  el.className = `show ${tone}`;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(clearToast, 3500);
  positionBattleToast();
  // A save/error can arrive while a long dialog is scrolled to its actions.
  if (el.closest(".dialog-feedback-slot")) el.scrollIntoView({ block: "nearest" });
  measureTroopSummaryObstacles();
}
function commander() {
  return state.entities.find(
    (e) => e.team === 0 && e.kind === "commander" && e.hp > 0,
  );
}
function cost(c: { gold: number; wood: number }) {
  return resourceCostHTML(c);
}
function affordable(c: { gold: number; wood: number }) {
  const player = planningState().players[0];
  return player.gold >= c.gold && player.wood >= c.wood;
}
function resourceShortfall(c: { gold: number; wood: number }) {
  const player = planningState().players[0];
  const missing = [player.gold < c.gold ? "gold" : "", player.wood < c.wood ? "wood" : ""].filter(Boolean);
  return missing.length ? `Need more ${missing.join(" and ")}` : "";
}
function showMenu(page = "home") {
  troopSelectionDraft = null;
  stopDeckObservation();
  resetAppSuspension();
  navigationVersion++;
  playing = false;
  editing = false;
  clearObsoleteBattleToast(null);
  document.body.classList.remove("in-editor");
  cancelMapTargeting();
  menuPage = page;
  modalOpen = false;
  releaseDialogToast();
  modal.innerHTML = "";
  placement = null;
  audio.start("menu");
  document.body.classList.remove("in-game", "rush-mode");
  if (!state) {
    state = createGame({
      seed: "MENU-FRONTIER",
      mapSize: "small",
      biome: "grasslands",
      aiControlPlayer: false,
    });
    renderer.centerOn(state.map.width / 2, state.map.height / 2);
    renderer.camera.zoom = 0.95;
  }
  if (page === "home") {
    screen.innerHTML = `<div class="menu-scrim"></div><main class="home"><div class="brandmark">${icon("crown")}<span>A WORLD WORTH FIGHTING FOR</span></div><h1>FRONTIER<br><em>COMMAND</em></h1><p class="home-lede">Build your stronghold. Lead from the front.<br>Turn one small army into a legend.</p><div class="home-actions">${button(preferences.learningComplete ? "Practice the basics" : "Learn to command · start here", "learn", preferences.learningComplete ? "secondary" : "primary large", "book")}${button("Play skirmish", "skirmish", "primary large", "sword")}${button("Rush Arena · 4 minute survival", "rush", "secondary rush-entry", "lightning")}${savedGame ? button("Continue battle", "continue", "secondary", "play") : ""}${button("Story campaigns", "campaign", "secondary", "flag")}${button("Frontier expedition", "expedition", "secondary", "map")}</div><div class="home-links">${button("How to play", "help", "", "book")}${button("Map workshop", "editor", "", "map")}${button("Command record", "record", "", "star")}${button("Settings", "settings", "", "gear")}${button("Credits / About", "about", "", "book")}</div><footer><span class="offline-dot"></span> <span id="offline-status">${navigator.serviceWorker?.controller ? "Offline ready" : "Offline after first full load"}</span> · Solo strategy <span class="version">v0.1 · Testing preview <span class="build-identifier" data-build-id="${esc(BUILD_ID)}">Build ${esc(BUILD_ID)}</span></span></footer></main><aside class="home-aside"><div class="vertical-rule"></div><span>YOUR BANNER.<br>YOUR FRONTIER.</span></aside>`;
  } else if (page === "skirmish") renderSetup();
  else if (page === "campaign") renderCampaign();
  else if (page === "expedition") renderExpedition();
  else if (page === "record") renderRecord();
  else if (page === "editor") renderEditorMenu();
}
function pageHeader(eyebrow: string, title: string, description: string) {
  return `<header class="page-header">${button("Back", "home", "back", "back")}<span class="eyebrow">${esc(eyebrow)}</span><h1>${esc(title)}</h1><p>${esc(description)}</p></header>`;
}
function completeSetup(): GameSettings {
  return { ...DEFAULT_SETTINGS, ...settings };
}
function renderSetup() {
  const current = completeSetup();
  screen.innerHTML = `<div class="menu-scrim solid"></div><main class="setup-page">${pageHeader("SKIRMISH", "Choose your frontier", "Choose a complete match scale or customize every commander, alliance, and resource.")}<form id="setup-form"><section class="setup-section"><div class="section-label"><b>01</b> Your commander</div><div class="commander-grid">${Object.values(
    COMMANDERS,
  )
    .map(
      (c) =>
        `<button type="button" data-action="choose-commander" data-id="${esc(c.id)}" class="commander-card ${current.commander === c.id ? "chosen" : ""}"><div class="commander-portrait ${esc(c.id)}"><canvas class="portrait-canvas" data-portrait="${esc(c.id)}" width="220" height="180" aria-hidden="true"></canvas></div><span class="tag">${c.id === "warlord" ? "HOLD THE LINE" : c.id === "ranger" ? "STRIKE & VANISH" : "BUILD TO LAST"}</span><h3>${c.name}</h3><p>${esc(c.description)}</p><span class="chosen-check">${icon("check")}</span></button>`,
    )
    .join(
      "",
    )}</div></section>${renderSetupControls(current)}<section id="setup-summary" aria-live="polite">${renderSetupSummary(current)}</section><div class="launch-bar"><p>${icon("book")} New commander? Learn the basics from the main menu.</p>${button("To the frontier", "launch", "primary large", "arrow", 'type="submit"')}</div></form></main>`;
  screen
    .querySelectorAll<HTMLCanvasElement>("[data-portrait]")
    .forEach((c) => void renderer.renderPortrait(c, c.dataset.portrait as any));
}
function refreshSetupSummary() {
  const summary = document.querySelector("#setup-summary");
  if (summary) summary.innerHTML = renderSetupSummary(completeSetup());
}
function renderCampaign(opened = false) {
  screen.innerHTML = `<div class="menu-scrim solid"></div><main class="content-page">${
    opened
      ? pageHeader(
          "STORY CAMPAIGN",
          activeCampaign.title,
          activeCampaign.description,
        ) + missionCardsHTML(activeCampaign, profile)
      : pageHeader(
          "STORY CAMPAIGNS",
          "Chronicles of the frontier",
          "Eight authored chapters. Two campaigns. Each story keeps its own progress.",
        ) + campaignCardsHTML(CAMPAIGNS, profile)
  }</main>`;
}
function renderExpedition() {
  screen.innerHTML = `<div class="menu-scrim solid"></div><main class="content-page">${pageHeader("BRANCHING EXPEDITION", "Beyond the map", "Seven stops. Four battles. Persistent choices shape your route.")}${expeditionLoaded ? expeditionHTML(expeditionRun, profile) : '<p role="status">Loading your saved route…</p>'}</main>`;
}
function renderRecord() {
  screen.innerHTML = `<div class="menu-scrim solid"></div><main class="content-page">${pageHeader("COMMAND RECORD", "Your legacy", "Small victories become great stories.")}${commandRecordHTML(profile, recordCategory)}</main>`;
}
function launchExpeditionEncounter() {
  if (!expeditionRun) throw new Error("Start an expedition first.");
  const battle = expeditionBattle(expeditionRun);
  launchGame(battle.settings, null, expeditionRun);
}
function launchGame(
  options: Partial<GameSettings> = settings,
  mission: number | null = null,
  expedition: ExpeditionRun | null = null,
  workshop = false,
) {
  if (pendingResult)
    throw new Error("Save the finished result before starting another battle.");
  navigationVersion++;
  if (
    mission !== null &&
    (!activeCampaign.missions[mission] ||
      !availableMissionIds(activeCampaign, profile).has(
        activeCampaign.missions[mission].id,
      ))
  )
    throw new Error("Complete the previous chapter to unlock this mission.");
  if (!workshop) workshopTest.clear();
  battleMatchId = newMatchId();
  campaignSession =
    mission === null
      ? null
      : createCampaignSession(
          activeCampaign.id,
          activeCampaign.missions[mission].id,
          battleMatchId,
        );
  state = createGame({
    ...(options === settings
      ? settings
      : { faction: settings.faction, commander: settings.commander }),
    ...options,
  });
  editing = false;
  document.body.classList.remove("in-editor");
  cancelMapTargeting();
  clearObsoleteBattleToast(battleMatchId);
  planningSnapshot = null;
  planningSignature = "";
  deckCollapsed = true;
  commanderFocusFitted = false;
  commanderFrameCache = undefined;
  recruitBatch = 1;
  learningProgress = state.settings.learning
    ? restoreLearning(state, null)
    : null;
  learningCompletionShown = false;
  learningGuideSkipped = false;
  guideCollapsed = false;
  missionIndex = mission;
  expeditionBattleActive = expedition !== null;
  if (mission !== null) installMission(state, activeCampaign.missions[mission]);
  if (expedition) {
    expeditionRun = expedition;
    const battle = expeditionBattle(expedition);
    state.triggers = structuredClone(battle.triggers);
    state.objectiveText = battle.objective;
  }
  playing = true;
  document.body.classList.toggle("rush-mode", !!state.rush);
  resultShown = false;
  lastEvent = 0;
  troopSelectionDraft = null;
  selection.clear();
  if (commander()) {
    selection.add(commander()!.id);
    tutorialOrigin = { x: commander()!.x, y: commander()!.y };
  }
  followCommander = true;
  placement = null;
  targetPoint = null;
  panel = "army";
  speed = state.settings.gameSpeed ?? 1;
  tutorialStep = 0;
  tutorialSupplyCaptured = false;
  document.body.classList.add("in-game");
  audio.start("exploration");
  audio.setVolumes(preferences.music, preferences.sfx);
  renderer.camera.zoom =
    innerHeight < 500 && innerWidth > 600
      ? 0.85
      : innerWidth < 600
        ? 1.05
        : 1.3;
  const c = commander() || state.map.spawns[0];
  renderer.centerOn(c.x, c.y);
  renderGameShell();
  void persist();
  if (state.settings.learning)
    showDialog(
      "Your first settlement",
      `<p class="story">You’ll start with one commander and a small keep. Learn one action at a time, then turn your settlement into an army.</p><p>This peaceful practice has no enemy raids or time limit. Gold and timber gather automatically after you capture them. The guide will point out each next step.</p>${button("Start learning", "begin-briefing", "primary large", "play")}`,
    );
  else if (mission !== null) showBriefing(mission);
  else if (expedition) {
    const battle = expeditionBattle(expedition);
    showDialog(
      battle.title,
      `<p class="story">${esc(battle.objective)}</p>${expeditionOpeningGuidance(battle.nodeId)}<p>Your expedition bonuses apply only to your forces. A defeat ends this run.</p>${button("Begin encounter", "begin-briefing", "primary large", "play")}`,
    );
  } else if (
    !state.rush &&
    profile.games === 0 &&
    preferences.showTips &&
    !preferences.tutorialSeen
  )
    showFirstBriefing();
  else
    toast(
      state.rush
        ? "Survive four minutes. Keep moving, claim supplies, and use your abilities."
        : "Capture supplies. Raise an army. Claim the frontier.",
    );
}
function renderGameShell() {
  stopDeckObservation();
  hudHTML.clear();
  screen.innerHTML = `<header class="hud"><button class="brand-button" data-action="pause-menu" aria-label="Battle menu">${icon("crown")}</button><div class="resources"><button data-action="economy" data-resource="gold" title="Gold and income sources" aria-label="Gold and income sources">${icon("gold")}<b id="gold">0</b></button><button data-action="economy" data-resource="wood" title="Wood and income sources" aria-label="Wood and income sources">${icon("wood")}<b id="wood">0</b></button><button data-action="economy" data-resource="population" title="Population and maximum capacity" aria-label="Population and maximum capacity">${icon("population")}<b id="population">0</b></button></div><div class="hud-clock"><div class="hud-time" id="match-time">0:00</div><div class="paused-ribbon" id="paused-ribbon"></div></div><button class="pause-button" data-action="pause" aria-label="Tactical pause">${icon("pause")}<span>Pause</span></button></header><div class="objective-bar" id="objective"></div><div class="battle-hint" id="battle-hint"></div><div class="map-controls">${button("Focus commander", "focus", "square", "crosshair")}${button("Zoom in", "zoom-in", "square", "plus")}${button("Zoom out", "zoom-out", "square", "minus")}</div><div class="minimap-wrap"><button class="minimap-toggle" data-action="toggle-minimap" aria-label="Minimize minimap">Map −</button><canvas id="minimap" width="160" height="120" aria-label="Minimap: tap to move camera"></canvas><span id="map-seed"></span></div><div class="commander-strip" id="commander-strip"></div><div id="joystick" aria-label="Drag to move commander" role="application"><div class="joystick-ring"></div><div class="joystick-stick">${icon("crosshair")}</div></div><div class="ability-dock" id="abilities"></div><section class="command-deck"><div class="selection-row"><div class="selection-info" id="selection-info"></div><div class="selection-tools">${button("Minimize panel", "toggle-deck", "deck-toggle", "minus")}${button("Commander", "select-commander", "", "crown")}${button("Army", "select-army", "", "flag")}${button("Relic", "march-relic", "relic-command", "spark", 'aria-label="March to relic"')}</div></div><div class="primary-orders">${button("Move", "order-move", "", "arrow")}${button("Attack", "order-attack", "", "crossedSwords")}${button("Hold", "hold", "", "hold")}</div><div id="resource-actions"></div><div id="compact-production"></div><nav class="deck-tabs">${button("Details", "panel-inspect", "", "book")}${button("Recruit", "panel-army", "active", "sword")}${button("Build", "panel-build", "", "house")}${button("Research", "panel-research", "", "spark")}${button("Orders", "panel-orders", "", "flag")}</nav><div class="deck-content" id="deck-content"></div></section><div id="target-controls"></div><div id="placement-controls"></div>`;
  if (workshopTest.active)
    screen.insertAdjacentHTML(
      "beforeend",
      `<div class="workshop-test-return">${button("Return to workshop", "return-to-editor", "", "back")}</div>`,
    );
  measurePlayfield();
  renderDeck();
  updateHUD();
  const deck = document.querySelector(".command-deck");
  if (deck) stopDeckObservation = observeControlDeck(deck, measurePlayfield);
  setupJoystick();
  const hero = commander();
  if (hero) centerCommander(hero);
  document.querySelector("#minimap")?.addEventListener("pointerdown", (e) => {
    const ev = e as PointerEvent;
    const box = (ev.currentTarget as HTMLElement).getBoundingClientRect();
    renderer.centerOn(
      ((ev.clientX - box.left) / box.width) * state.map.width,
      ((ev.clientY - box.top) / box.height) * state.map.height,
    );
    followCommander = false;
  });
}
function cardArt(type: string) {
  const frame = renderer.atlas.frames[type];
  if (!renderer.atlas.ready || !frame) return icon(unitIcons[type]);
  const scale = Math.min(32 / frame.w, 36 / frame.h);
  return `<span class="sprite-icon" aria-hidden="true" style="width:${frame.w * scale}px;height:${frame.h * scale}px;background-image:url('${esc(renderer.atlas.image!.src)}');background-size:${renderer.atlas.image!.naturalWidth * scale}px ${renderer.atlas.image!.naturalHeight * scale}px;background-position:${-frame.x * scale}px ${-frame.y * scale}px"></span>`;
}
function currentDeckSignature(): string {
  const planned = planningState();
  const player = planned.players[0];
  return JSON.stringify([
    panel,
    inspectTab,
    placement,
    [...selection],
    recruitBatch,
    learningProgress?.step,
    player.populationCap,
    player.maxPopulation,
    player.rangedSpacing,
    state.paused,
    state.pendingCommands,
    Object.values(BUILDINGS).map(building => buildingRequirementView(state, building.id, 0, planned).status),
    panel === "inspect" ? inspectionAvailabilitySignature(planningState(), selection, state.paused && state.pendingCommands.length >= 60) : null,
    renderer.atlas.ready,
    renderer.atlas.image?.src,
    state.entities
      .filter((e) => e.team === 0 && e.kind === "building" && e.hp > 0)
      .map((e) => [
        e.id,
        e.type,
        e.buildProgress >= 1,
        e.buildingLevel,
        e.rally,
        e.queue.map((q) => [q.type, q.id, q.queueId]),
      ]),
    Object.values(UNITS).map((u) => {
      const price = getUnitCost(state, 0, u.id);
      return affordable({
        gold: price.gold * recruitBatch,
        wood: price.wood * recruitBatch,
      });
    }),
    Object.values(BUILDINGS).map((b) => affordable(b.cost)),
    Object.values(TECHNOLOGIES).map((t) => [
      affordable(technologyCost(state, 0, t.id)),
      player.research[t.id] || 0,
    ]),
  ]);
}
function refreshDeckState() {
  if (playing && currentDeckSignature() !== lastDeckSignature) renderDeck();
}
function renderDeck() {
  if (!playing) return;
  // Explicit tab/action renders satisfy the same signature as the next HUD tick.
  // Real resource, queue, selection or progression changes still invalidate it.
  lastDeckSignature = currentDeckSignature();
  document
    .querySelectorAll(".deck-tabs button")
    .forEach((b) =>
      b.classList.toggle(
        "active",
        b.getAttribute("data-action") === `panel-${panel}`,
      ),
    );
  const el = document.querySelector("#deck-content")!;
  const oldScroll = el.querySelector(".action-cards")?.scrollLeft || 0;
  const oldTop = el.scrollTop;
  const productionStrip = el.querySelector<HTMLElement>("#production-strip");
  const queueScroll = [
    ...(productionStrip?.querySelectorAll<HTMLElement>("ol") ?? []),
  ].map((queue) => ({ queue, left: queue.scrollLeft }));
  const active = document.activeElement as HTMLElement;
  const focused = el.contains(active)
    ? { action: active.dataset.action, id: active.dataset.id }
    : null;
  if (state.rush) {
    if (!el.querySelector("#rush-status")) {
      el.innerHTML = `<div id="rush-status"></div>`;
      hudHTML.delete("rush-status");
    }
    return;
  }
  const learningStep = learningProgress?.step;
  const planned = planningState();
  const lessonHint = (tab: "army" | "build" | "research") => {
    const hint = learningPanelHint(learningStep, tab);
    return hint ? `<p class="deck-tip learning-panel-hint">${hint}</p>` : "";
  };
  if (panel === "inspect")
    el.innerHTML = inspectionHTML(planningState(), selection, learningStep, inspectTab, state.paused && state.pendingCommands.length >= 60);
  else if (panel === "army")
    el.innerHTML = `${lessonHint("army")}${learningActionAvailable(learningStep, "recruit", "swordsman") ? `<div class="recruit-controls"><span>Queue at a time</span>${[1, 3, 5].map((n) => button(String(n), "recruit-batch", recruitBatch === n ? "active" : "", undefined, `data-id="${n}" aria-label="Queue ${n} at a time"`)).join("")}<small>Tap a troop to add ${recruitBatch} to production.</small></div>` : ""}<div class="action-cards">${Object.values(
      UNITS,
    )
      .filter((u) => learningActionAvailable(learningStep, "recruit", u.id))
      .map((u) => {
        const producer = recruitProducer(
          planningState(),
          u.id,
          selectedBuilding()?.id,
        );
        const ready = !!producer;
        const requirement = ready ? null : recruitRequirementView(state, u.id, selectedBuilding()?.id, 0, planned);
        const price = getUnitCost(state, 0, u.id);
        const batchCost = {
          gold: price.gold * recruitBatch,
          wood: price.wood * recruitBatch,
        };
        const queueFull = !!producer && producer.queue.length + recruitBatch > PRODUCTION_QUEUE_LIMIT;
        const queueReason = producer && producer.queue.length < PRODUCTION_QUEUE_LIMIT ? `Not enough queue space for ${recruitBatch} troops` : "Production queue full";
        const descriptionIds = [requirement ? `recruit-requirement-${u.id}` : "", queueFull ? `recruit-queue-${u.id}` : ""].filter(Boolean);
        return `<button class="action-card ${!ready ? "unavailable" : ""} ${affordable(batchCost) ? "" : "funds-low"}" data-action="recruit" data-id="${u.id}" title="${esc(u.description + (producer ? ` ${recruitDestination(producer)}. ${rallyDestination(producer)}` : ""))}" aria-label="Recruit ${u.name}"${descriptionIds.length ? ` aria-describedby="${descriptionIds.join(" ")}"` : ""}><span class="action-icon">${cardArt(u.id)}</span><strong>${u.name}</strong>${cost(batchCost)}<small${requirement ? ` id="recruit-requirement-${u.id}" class="recruit-requirement" data-prerequisite-state="${requirement.status}"` : ""}>${requirement ? esc(requirement.label) : `${Math.ceil(trainingSeconds(planned, u.id, producer!))}s each · ${u.population} pop`}</small>${queueFull ? `<small id="recruit-queue-${u.id}" class="availability-reason recruit-queue-reason">${queueReason}</small>` : ""}${resourceShortfall(batchCost) ? `<small class="availability-reason">⚠ ${resourceShortfall(batchCost)}</small>` : ready && planned.players[0].population + u.population * recruitBatch > planned.players[0].populationCap ? `<small class="availability-reason">⚠ Needs population capacity</small>` : ""}${producer ? `<small class="recruit-producer">${esc(recruitDestination(producer))}</small>` : ""}<small class="unit-counter">${{ swordsman: "Frontline", spearman: "Counters cavalry", archer: "Counters infantry", cavalry: "Counters archers", siege: "Breaks buildings", support: "Heals your army" }[u.id]}</small></button>`;
      })
      .join("")}</div>`;
  else if (panel === "build")
    el.innerHTML = `${lessonHint("build")}<div class="action-cards">${Object.values(BUILDINGS)
      .filter((b) => b.id !== "keep" && learningActionAvailable(learningStep, "build", b.id))
      .map(
        (b) => {
          const requirements = b.prerequisites.map(id => buildingRequirementView(state, id, 0, planned));
          return `<button class="action-card ${placement === b.id ? "selected" : ""}" data-action="build" data-id="${b.id}" title="${esc(b.description)}" aria-label="Build ${b.name}"${requirements.length ? ` aria-describedby="${requirements.map(view => `build-prerequisite-${b.id}-${view.id}`).join(" ")}"` : ""}><span class="action-icon">${cardArt(b.id)}</span><strong>${b.name}</strong>${cost(b.cost)}<small>${b.buildTime}s · ${b.population ? capacityGainText(planned, b.population) : b.description.split(".")[0]}</small>${resourceShortfall(b.cost) ? `<small class="availability-reason">⚠ ${resourceShortfall(b.cost)}</small>` : ""}${requirements.map(view => `<small id="build-prerequisite-${b.id}-${view.id}" class="build-prerequisite" data-prerequisite-state="${view.status}">${esc(view.label)}</small>`).join("")}</button>`;
        },
      )
      .join("")}</div>`;
  else if (panel === "research")
    el.innerHTML = learningProgress && learningProgress.step < LESSONS.length
      ? `<p class="deck-tip">${learningPanelHint(learningProgress.step, "research")}</p>`
      : renderResearchTree(planned, 0, selectedBuilding()?.id, state);
  else {
    const spacing = !!planningState().players[0].rangedSpacing;
    el.innerHTML = `<div class="order-cards">${button("Choose troops", "choose-troops", "", "population")}${button("Attack-move", "order-attackMove", armedOrder === "attackMove" ? "chosen" : "", "sword")}${button(`Keep distance: ${spacing ? "on" : "off"}`, "ranged-spacing", spacing ? "chosen" : "", "shield", `aria-pressed="${spacing}"`)}${button("Rally current producers here", "rally-all", "", "flag")}${button("Save battle", "save", "", "save")}${button(`${speed}× speed`, "speed", "", "clock")}</div><p class="deck-tip">Keep distance lets your current and future archers, Menders and ranged commander step back between shots when melee troops approach. Their damage, speed and range stay the same. Move, Hold and direct commander control take priority; they advance normally against buildings. Short retreats stay near the engagement. Move and Attack-move use your next valid map tap as a destination. Attack requires an enemy target. Cancel returns to selection. Ordinary taps select friendly units and buildings; empty terrain clears selection. Choose troops lets you pick types or individual troops. On desktop, Shift-click adds or removes a friendly troop; Shift-click empty ground keeps your group. Choose Attack before tapping an enemy. Select a deposit and choose Capture to send troops. Hold does not pursue. Rally current producers here sets a fixed point for existing buildings. New buildings need their own rally point; it does not follow the commander.</p>`;
  }
  if (productionStrip) {
    el.append(productionStrip);
    for (const { queue, left } of queueScroll) queue.scrollLeft = left;
  } else {
    el.insertAdjacentHTML("beforeend", `<div id="production-strip"></div>`);
    hudHTML.delete("production-strip");
  }
  el.scrollTop = oldTop;
  updateDeckLayout();
  const cards = el.querySelector(".action-cards");
  if (cards) cards.scrollLeft = oldScroll;
  if (focused?.action) {
    const next = el.querySelector<HTMLElement>(
      `[data-action="${focused.action}"]${focused.id ? `[data-id="${focused.id}"]` : ""}`,
    );
    next?.focus({ preventScroll: true });
  }
}
function updateDeckLayout() {
  const deck = document.querySelector<HTMLElement>(".command-deck");
  deck?.classList.toggle("collapsed", deckCollapsed);
  const toggle = deck?.querySelector<HTMLButtonElement>(
    '[data-action="toggle-deck"]',
  );
  if (toggle) {
    toggle.setAttribute(
      "aria-label",
      deckCollapsed ? "Expand panel" : "Minimize panel",
    );
    toggle.innerHTML = icon(deckCollapsed ? "plus" : "minus") + `<span>${deckCollapsed ? "More" : "Less"}</span>`;
    toggle.setAttribute("aria-expanded", String(!deckCollapsed));
  }
  document
    .querySelector(".minimap-wrap")
    ?.classList.toggle("collapsed", minimapCollapsed);
  const minimapToggle = document.querySelector<HTMLButtonElement>('[data-action="toggle-minimap"]');
  if (minimapToggle) {
    minimapToggle.setAttribute("aria-expanded", String(!minimapCollapsed));
    minimapToggle.setAttribute("aria-controls", "minimap");
    minimapToggle.setAttribute("aria-label", minimapCollapsed ? "Expand minimap" : "Minimize minimap");
  }
  measurePlayfield();
}
function cancelMapTargeting() {
  armedOrder = null;
  targetError = "";
  selectedResourceId = null;
  if (uiAction === "rally") uiAction = "move";
  rallyBuildingId = null;
}
function selectedBuilding() {
  const entities = state.entities.filter(
    (e) => selection.has(e.id) && e.team === 0 && e.hp > 0,
  );
  return entities.length === 1 && entities[0].kind === "building"
    ? entities[0]
    : undefined;
}
function dispatch(
  command: GameCommand,
  sound: "order" | "build" | "recruit" | "ability" = "order",
) {
  if (battleSuspension.suspended || applyingUpdate) return false;
  const learningId = command.type === "recruit" ? command.unit
    : command.type === "build" ? command.building
      : command.type === "research" ? command.technology
        : command.type === "upgradeBuilding"
          ? state.entities.find((e) => e.id === command.buildingId)?.type
          : undefined;
  if (learningId && ["recruit", "build", "research", "upgradeBuilding"].includes(command.type) &&
      !learningActionAvailable(learningProgress?.step, command.type as "recruit" | "build" | "research" | "upgradeBuilding", learningId)) {
    toast("That option opens later in the guide. Finish the current lesson first.");
    return false;
  }
  const result = issueCommand(state, command);
  if (!result.ok) {
    audio.play("error");
    toast(result.error || "That order cannot be completed.", "warning");
    return false;
  }
  audio.play(sound);
  if (result.queued)
    toast(
      `Order queued · ${state.pendingCommands.length} ready when you resume`,
      "", { untilResume: true },
    );
  updateHUD();
  return true;
}
function updateHUD() {
  if (!playing) return;
  clearObsoleteBattleToast(battleMatchId);
  if (armedOrder && !state.entities.some(e => selection.has(e.id) && e.team === 0 && e.kind !== "building" && e.hp > 0)) {
    cancelMapTargeting();
    toast("Selected troops are no longer available. Order canceled.", "warning");
  }
  refreshDeckState();
  const details = document.querySelector<HTMLElement>("#deck-content");
  if (panel === "inspect" && details)
    refreshInspection(details, planningState(), selection);
  const p = planningState().players[0],
    c = commander();
  const set = (id: string, html: string) => {
    const el = document.querySelector(`#${id}`);
    if (el && hudHTML.get(id) !== html) {
      // Keep pressed/focused live controls while updating their labels and data.
      updateLiveHTML(el as HTMLElement, html);
      hudHTML.set(id, html);
      return true;
    }
    return false;
  };
  const economy = getEconomyRates(state);
  for (const resource of ["gold", "wood"] as const) {
    const rate =
      resource === "gold" ? economy.goldPerSecond : economy.woodPerSecond;
    set(
      resource,
      `${Math.floor(p[resource])}${state.rush ? "" : `<small class="resource-income">+${rate.toFixed(1)}/s</small>`}`,
    );
    const slot = document.querySelector(`#${resource}`)?.parentElement;
    const name = resource === "gold" ? "Gold" : "Wood";
    const label = `${name}: ${Math.floor(p[resource])}${state.rush ? "" : `. Income: ${rate.toFixed(1)} per game second`}`;
    slot?.setAttribute("aria-label", label);
    if (slot) slot.title = label;
  }
  set(
    "population",
    state.rush
      ? `${p.population}<small> squad</small>`
      : `${p.population}/${p.populationCap}<small>max ${p.maxPopulation}</small>`,
  );
  const populationButton = document.querySelector("#population")?.parentElement;
  const populationLabel = state.rush
    ? `Squad population: ${p.population}`
    : `Population: ${p.population} of ${p.populationCap} capacity. Match maximum: ${p.maxPopulation}. Open economy details.`;
  populationButton?.setAttribute("aria-label", populationLabel);
  if (populationButton) populationButton.title = populationLabel;
  set(
    "production-strip",
    productionHTML(planningState(), selectedBuilding()?.id) +
      (state.paused && state.pendingCommands.length
        ? `<p class="planned-orders">${state.pendingCommands.length} planned orders · ${Math.floor(state.players[0].gold - planningState().players[0].gold)} gold / ${Math.floor(state.players[0].wood - planningState().players[0].wood)} wood reserved. Resume to begin.</p>`
        : ""),
  );
  set(
    "match-time",
    `${time(state.time)}${speed !== 1 ? ` <small>${speed}×</small>` : ""}`,
  );
  set("map-seed", `${esc(state.settings.seed)} · v${state.map.version}`);
  const allies = allianceMembers(state, 0),
    allianceScore = allies.reduce((total, ally) => total + ally.score, 0);
  const enemy = state.players.filter(
    (pl) =>
      !pl.neutral &&
      !pl.closed &&
      !pl.defeated &&
      !areAllied(state, 0, pl.team),
  );
  const rivalScore = Math.max(
    0,
    ...enemy.map((pl) =>
      allianceMembers(state, pl.team).reduce(
        (total, ally) => total + ally.score,
        0,
      ),
    ),
  );
  // Resolve the final objective variant before a single DOM update. A chapter
  // must never briefly render the generic skirmish objective between HUD ticks.
  let objectiveHTML = "";
  const maxScore = Math.max(1, state.scoreTarget);
  const control = relicSummary(state);
  if (!state.rush)
    objectiveHTML = `<span title="${esc(state.objectiveText)}">${icon(state.settings.mode === "conquest" ? "sword" : "spark")} <span class="objective-description">${missionIndex !== null ? esc(state.objectiveText) : state.settings.mode === "conquest" ? "Destroy the enemy keeps" : "Relics earn victory points"}</span><small class="objective-income">${control.owned} / ${control.total} relics controlled · ${state.settings.mode === "conquest" ? "Relics fund your siege" : `+${control.pointsPerSecond.toFixed(1)} points / sec`}</small></span><div class="score-track"><i style="width:${Math.min(100, (allianceScore / maxScore) * 100)}%"></i><b>${state.settings.mode === "conquest" ? `${enemy.length} enemy keep${enemy.length === 1 ? "" : "s"} remain` : `${allies.length > 1 ? "ALLIANCE" : "YOU"} ${Math.floor(allianceScore)} / ${maxScore}`}</b>${state.settings.mode === "conquest" ? "" : `<em>RIVAL ${Math.floor(rivalScore)}</em>`}</div>`;
  if (state.settings.learning)
    objectiveHTML = '<span class="objective-description">Peaceful practice · no raids or time limit</span>';
  const mission = activeMission();
  if (mission) {
    const objectives = missionObjectiveProgress(state, mission).filter(
      ({ objective }) => !objective.optional,
    );
    objectiveHTML = `${button(`${objectives.filter((item) => item.complete).length} / ${objectives.length} chapter objectives`, "mission-objectives", "chapter-objective-button", "book")}<span class="objective-description">${esc(mission.title)} · Protect your keep</span>`;
    set("mission-progress", missionObjectivesHTML(state, mission));
  }
  const relicControl = document.querySelector<HTMLButtonElement>(
    '[data-action="march-relic"]',
  );
  if (relicControl) {
    relicControl.hidden = !!state.rush || !!placement;
    relicControl.title = "Send your army toward the nearest unclaimed relic.";
  }
  const chosen = state.entities.filter((e) => selection.has(e.id) && e.hp > 0);
  const currentOrder = armedOrder
    ? armedOrder === "attack" ? "Choose an enemy to attack" : `Choose ${armedOrder === "attackMove" ? "attack-move" : "move"} destination`
    : chosen.length === 1 && chosen[0].kind === "building" && chosen[0].buildProgress < 1
      ? constructionProgressText(chosen[0])
      : selectedOrderDescription(planningState(), selection);
  const spacingDescription = rangedSpacingDescription(planningState(), selection);
  set(
    "selection-info",
    `${chosen.length === 1 ? cardArt(chosen[0].type) : icon("flag")}<div><strong>${placement ? `Place ${BUILDINGS[placement].name}` : chosen.length === 1 ? selectionName(chosen[0]) : chosen.length ? `${chosen.length} units selected` : "Select a unit"}</strong>${placement ? "<small>Tap open ground near your frontier</small>" : chosen.length === 1 ? selectionHealthHTML(chosen[0], planningState().entities.find(e => e.id === chosen[0].id)?.queue.length ?? 0) : "<small></small>"}${!placement ? `<small class="current-order" title="${esc(currentOrder)}">${esc(currentOrder)}</small>${spacingDescription ? `<small class="ranged-spacing-status" title="${esc(spacingDescription)}">${esc(spacingDescription)}</small>` : ""}` : ""}</div>${""}`,
  );
  const mobileSelection = chosen.some(e => e.team === 0 && e.kind !== "building");
  document.querySelector(".command-deck")?.classList.toggle("building-selected", !!selectedBuilding());
  for (const action of ["order-move", "order-attack", "hold"]) {
    const control = document.querySelector<HTMLButtonElement>(`.primary-orders [data-action="${action}"]`);
    if (control) {
      control.disabled = !mobileSelection;
      control.classList.toggle("chosen", action === "hold" ? !armedOrder && chosen.length > 0 && chosen.every(e => e.order.type === "hold") : armedOrder === (action === "order-move" ? "move" : "attack"));
      control.setAttribute("aria-pressed", String(control.classList.contains("chosen")));
    }
  }
  const resource = state.map.nodes.find(n => n.id === selectedResourceId);
  set("resource-actions", resource ? `<div class="resource-context"><span><b>${esc(resourceTargetName(resource))}</b><small>${resource.kind === "relic" ? relicControlDescription(state) : "Captured deposits gather automatically"}</small></span>${button("Capture", "capture-resource", "primary", "flag")}</div>` : "");
  const targetInstruction = uiAction === "rally" && rallyBuildingId ? "Rally · tap clear terrain" : armedOrder === "attack" ? "Attack · tap an enemy" : armedOrder === "attackMove" ? "Attack-move · tap a destination" : armedOrder ? "Move · tap a destination" : "";
  const targetControlsChanged = set("target-controls", targetInstruction ? `<div class="target-toolbar"><span role="status" aria-live="polite" aria-atomic="true"><b>${icon(armedOrder === "attack" ? "sword" : "arrow")}${targetInstruction}</b><small>${esc(targetError || "Drag to pan · pinch to zoom")}</small></span>${button("Cancel", "cancel-order", "", "close", 'aria-label="Cancel destination order"')}</div>` : "");
  const queuedBuildings = planningState().entities.filter(e => e.team === 0 && e.kind === "building" && e.hp > 0 && e.queue.length);
  const firstJob = queuedBuildings[0]?.queue[0];
  set("compact-production", firstJob ? `${icon("clock")}<span>${queuedBuildings.reduce((n,b) => n + b.queue.length, 0)} queued · ${Math.ceil(firstJob.remaining)}s next</span>` : "");
  if (targetControlsChanged) measurePlayfield();
  const site =
    placement && targetPoint
      ? plannedBuildResult(state, 0, placement, targetPoint.x, targetPoint.y)
      : null;
  const houseLesson = learningProgress?.step === 5 && placement === "house";
  const siteFeedback = placementFeedback(site, !!(houseLesson && targetPoint && !houseHasRoom(state, targetPoint)));
  const placementControlsChanged = set(
    "placement-controls",
    placement
      ? `<div class="placement-toolbar"><div><span class="placement-art">${cardArt(placement)}</span><b>Place ${BUILDINGS[placement].name}</b>${cost(BUILDINGS[placement].cost)}<small>${BUILDINGS[placement].buildTime}s · ${esc(BUILDINGS[placement].population ? capacityGainText(planningState(), BUILDINGS[placement].population) : BUILDINGS[placement].description)}</small><small class="placement-status" role="status" data-placement-state="${siteFeedback.state}">${icon(siteFeedback.icon)}<span>${esc(siteFeedback.text)}</span></small></div><div class="placement-modes">${button("Place", "placement-place", placementMode === "place" ? "active" : "", "crosshair", `aria-pressed="${placementMode === "place"}"`)}${button("Pan", "placement-pan", placementMode === "pan" ? "active" : "", "map", `aria-pressed="${placementMode === "pan"}"`)}</div><div class="placement-actions">${button("Cancel", "cancel-build", "", "close")}${houseLesson ? button("Find pair site", "learning-house-site", "", "crosshair") : button(repeatPlacement ? "Repeat on" : "Repeat off", "repeat-placement", repeatPlacement ? "active" : "")}${button("Confirm build", "confirm-placement", "primary", site?.ok ? "check" : "shield", site?.ok ? "" : "disabled")}</div></div>`
      : "",
  );
  document.body.classList.toggle("placing-building", !!placement);
  document.body.classList.toggle("targeting-order", !!armedOrder || uiAction === "rally");
  // Status changes can wrap the toolbar; measure only changed content, not every HUD tick.
  if (placementControlsChanged) measurePlayfield();
  set(
    "commander-strip",
    c
      ? `<button data-action="focus" aria-label="Focus commander">${icon(unitIcons[c.type])}<span><b>${COMMANDERS[state.settings.commander].name}</b><i><em style="width:${(c.hp / c.maxHp) * 100}%"></em></i></span><small>${Math.ceil(c.hp)}</small></button>`
      : `<span class="respawning">${playerOutcomeStatus(state) === "spectating" ? "Your keep fell. Watching your surviving allies." : "Commander recovering at the keep…"}</span>`,
  );
  updateAbilities(c);
  const pause = document.querySelector<HTMLButtonElement>(".pause-button");
  if (pause) {
    const presentation = tacticalPausePresentation(
      state.settings.difficulty,
      state.paused,
      state.players[0].stats.pauses,
    );
    if (pause.getAttribute("aria-label") !== presentation.accessibleLabel) {
      pause.innerHTML = icon(state.paused ? "play" : "pause") + `<span class="pause-copy"><span class="pause-label">${presentation.label}</span><small class="pause-budget">${presentation.budget}</small></span>`;
      pause.setAttribute("aria-label", presentation.accessibleLabel);
      pause.title = presentation.accessibleLabel;
    }
    pause.disabled = presentation.disabled;
    pause.dataset.pauseState = presentation.state;
    pause.classList.toggle("active", state.paused);
  }
  set(
    "paused-ribbon",
    state.paused
      ? `<span>Paused</span><small>${state.pendingCommands.length} queued</small>`
      : "",
  );
  document
    .querySelector("#paused-ribbon")
    ?.classList.toggle("visible", state.paused);
  if (state.rush) {
    const rush = state.rush;
    objectiveHTML = `<span>${icon("lightning")} RUSH ARENA · SURVIVE THE RIFT</span><div class="score-track"><i style="width:${Math.min(100, (state.time / rush.surviveUntil) * 100)}%"></i><b>${time(Math.max(0, rush.surviveUntil - state.time))} remaining</b><em>Wave ${rush.wave}</em></div>`;
    set(
      "rush-status",
      `<div class="rush-metrics"><span><b>${rush.wave}</b> wave</span><span><b>${rush.kills}</b> defeated</span><span><b>${Math.ceil(Math.max(0, rush.nextWaveAt - state.time))}s</b> next wave</span>${rush.upgradeAvailable ? button("Choose an upgrade", "rush-upgrade", "primary", "spark") : `<small>Next upgrade in ${Math.ceil(Math.max(0, rush.nextUpgradeAt - state.time))}s</small>`}</div><p class="deck-tip">Stay inside the ward. Dodge marked strikes. Collect glowing supplies.</p>`,
    );
  }
  set("objective", objectiveHTML);
  updateTutorial();
  // The guide and damage alerts outrank a duplicate pause banner. Keep the
  // always-visible top Resume button; recompute visibility after rotation.
  const hint = document.querySelector<HTMLElement>("#battle-hint");
  document
    .querySelector("#paused-ribbon")
    ?.classList.toggle(
      "hint-visible",
      !!hint?.textContent && hint.getBoundingClientRect().height > 0,
    );
  const mini = document.querySelector<HTMLCanvasElement>("#minimap");
  if (mini) renderer.renderMinimap(mini, state);
  positionBattleGuide();
  positionBattleToast();
  measureTroopSummaryObstacles();
}
function updateAbilities(c: Entity | undefined) {
  const dock = document.querySelector<HTMLElement>("#abilities");
  if (!dock) return;
  const definitions = COMMANDERS[state.settings.commander].abilities;
  if (dock.dataset.commander !== state.settings.commander) {
    dock.innerHTML = definitions
      .map(
        (ability, index) =>
          `<button class="ability" data-action="ability" data-id="${ability.id}" aria-label="${ability.name}" title="${esc(ability.description)}">${icon(ability.id === "breach" ? "siege" : index === 0 ? "lightning" : state.settings.commander === "engineer" ? "gear" : "flag")}<b>${ability.name}</b><kbd>${esc(ability.key)}</kbd></button>`,
      )
      .join("");
    dock.dataset.commander = state.settings.commander;
  }
  for (const ability of definitions) {
    const control = dock.querySelector<HTMLButtonElement>(
      `[data-id="${ability.id}"]`,
    )!;
    const remaining = c?.abilityCooldowns[ability.id] || 0;
    const queued =
      state.paused &&
      state.pendingCommands.some(
        (cmd) =>
          cmd.type === "ability" &&
          cmd.team === 0 &&
          cmd.ability === ability.id,
      );
    control.disabled = !c || remaining > 0 || queued;
    control.classList.toggle("cooling", remaining > 0 || queued);
    const lacksStructure = ability.id === "breach" && !!c && !findBreachTarget(state, c);
    control.title = ability.description + (ability.id === "breach" ? " Uses your current building Attack target, otherwise the nearest eligible structure." : "") + (lacksStructure ? " Move within 6 tiles of a visible enemy building. No cooldown is spent without a valid target." : "");
    control.setAttribute("aria-description", control.title);
    const text = queued
      ? "Queued"
      : remaining > 0
        ? String(Math.ceil(remaining))
        : lacksStructure ? "Buildings only" : ability.name;
    const label = control.querySelector("b")!;
    if (label.textContent !== text) label.textContent = text;
  }
}
function showFirstBriefing() {
  preferences.tutorialSeen = true;
  writeLocal("preferences", preferences);
  showDialog(
    "Your first frontier",
    `<span class="eyebrow">THE BATTLE WAITS WHILE YOU GET YOUR BEARINGS</span><div class="help-grid"><article>${icon("flag")}<h3>Lead together</h3><p>Select Army, choose Move, then tap a destination for your commander and soldiers. Idle troops guard their position.</p></article><article>${icon("gold")}<h3>Claim and grow</h3><p>Capture gold and timber for steady income. Recruit soldiers, then claim a relic. Build Houses for more troops and Watchtowers to defend your base.</p></article><article>${icon("spark")}<h3>Take the center</h3><p>Relics earn victory points; gold and wood fund your army. The gold Relic button sends your army toward an objective. Use your commander’s abilities in close fights. The Engineer’s Breach Charge strikes nearby enemy buildings.</p></article><article>${icon("pause")}<h3>Take your time</h3><p>${state.settings.difficulty === "easy" ? "Easy opponents spend the first minute consolidating their own side. " : ""}Use the pause button to plan orders${state.settings.difficulty === "hard" ? " (three tactical pauses on Hard)" : state.settings.difficulty === "brutal" ? " (tactical pause is disabled on Brutal)" : ""}.</p></article></div>${button("Start battle", "begin-briefing", "primary large", "play")}`,
    "wide",
  );
}
function updateTutorial() {
  // The final HUD refresh must not advance lessons or write preferences while
  // result persistence is being prepared or committed.
  if (resultShown) return;
  const el = document.querySelector("#battle-hint");
  if (!el) return;
  document.body.classList.toggle("learning-guide-visible", !!state.settings.learning && !!learningProgress && (learningGuideSkipped || learningProgress.step < LESSONS.length));
  if (state.settings.learning && learningProgress) {
    if (learningGuideSkipped) {
      const html = `<span>PEACEFUL PRACTICE</span><b>Explore at your pace</b>${button("Replay guide", "replay-guide", "lesson-action", "book")}`;
      el.classList.add("learning-guide");
      if (hudHTML.get("battle-hint") !== html) { updateLiveHTML(el as HTMLElement, html); hudHTML.set("battle-hint", html); }
      return;
    }
    learningProgress = advanceLearning(state, learningProgress);
    if (learningProgress.step >= LESSONS.length) {
      el.innerHTML = "";
      if (!learningCompletionShown) {
        learningCompletionShown = true;
        preferences.learningComplete = true;
        writeLocal("preferences", preferences);
        showDialog(
          "Your settlement is ready",
          `<p class="story">You captured gold and timber, trained an army, built two neighboring Houses, upgraded one, and claimed a relic.</p><p>In a real battle, defend your deposits and keep while growing toward the map’s objectives. Pause whenever you need time to plan. Building Details and the resource bar always explain your options.</p>${button("Play The Outpost", "learning-campaign", "primary large", "flag")}${button("Keep practicing", "close-dialog", "", "play")}${button("Main menu", "save-leave", "", "back")}`,
        );
      }
      return;
    }
    const lesson = LESSONS[learningProgress.step];
    const text = learningProgress.step === 5 ? learningHouseGuidance(state) : learningProgress.step === 0
      ? armedOrder === "move" ? "Tap clear ground for the destination. Drag to pan; Cancel keeps your commander still."
        : selection.has(commander()?.id ?? "") ? "Choose Move, then tap clear ground. You can also hold the thumbstick."
          : "Tap your commander or choose Commander to select it. Then choose Move."
      : lesson.text;
    const html = `<button data-action="toggle-guide" aria-label="${guideCollapsed ? "Expand guide" : "Minimize guide"}">${icon(guideCollapsed ? "plus" : "minus")}</button><span>LEARN TO COMMAND · ${learningProgress.step + 1}/${LESSONS.length}</span><b>${lesson.title}</b>${button("Skip guide", "skip-guide", "guide-skip")}${guideCollapsed ? "" : `<p>${text}</p>${button(learningProgress.step === 5 ? "Find House site" : lesson.action, "learning-help", "lesson-action", "crosshair")}`}`;
    el.classList.add("learning-guide");
    if (hudHTML.get("battle-hint") !== html) {
      updateLiveHTML(el as HTMLElement, html);
      hudHTML.set("battle-hint", html);
    }
    return;
  }
  el.classList.remove("learning-guide");
  if (tutorialOrigin) {
    const progress = advanceTutorial(state, {
      step: tutorialStep, origin: tutorialOrigin, supplyCaptured: tutorialSupplyCaptured,
    });
    tutorialStep = progress.step;
    tutorialSupplyCaptured = progress.supplyCaptured === true;
  }
  const attacked = buildingUnderAttack(state);
  el.classList.toggle("critical", !!attacked);
  if (attacked) {
    const name =
      attacked.type === "keep"
        ? "Keep"
        : BUILDINGS[attacked.type as BuildingId].name;
    const warning = button(
      `${name} under attack · View`,
      "view-attacked-building",
      "",
      "shield",
      `data-id="${esc(attacked.id)}"`,
    );
    el.setAttribute("role", "alert");
    if (hudHTML.get("battle-hint") !== warning) {
      updateLiveHTML(el as HTMLElement, warning);
      hudHTML.set("battle-hint", warning);
    }
    return;
  }
  el.removeAttribute("role");
  if (
    !state.rush &&
    preferences.showTips &&
    tutorialStep >= 2 &&
    getEconomyRates(state).goldDeposits === 0
  ) {
    const warning =
      "<b>No gold mine held</b><p>Claim fresh gold to keep recruiting.</p>";
    if (hudHTML.get("battle-hint") !== warning) {
      updateLiveHTML(el as HTMLElement, warning);
      hudHTML.set("battle-hint", warning);
    }
    return;
  }
  if (state.rush || !preferences.showTips || state.time > 200) {
    el.innerHTML = "";
    hudHTML.delete("battle-hint");
    return;
  }
  const tips = [
    [
      "Step into the frontier",
      "Select Commander, choose Move, then tap a destination. Drag to pan; pinch to zoom.",
    ],
    [
      "Claim fresh supplies",
      "Capture a fresh gold mine or timber camp while keeping both supplies. Each deposit pays until it runs out.",
    ],
    [
      "Raise your army",
      "Tap Recruit, then Swordsman. New troops move to your commander’s position when training finishes; set a safe rally point in building Details.",
    ],
    [
      "Take the center",
      "Hold relics to score. Keep recruiting, capture fresh gold, and protect your keep.",
    ],
  ];
  const tipHTML = `<button data-action="dismiss-tips" aria-label="Dismiss tips">${icon("close")}</button><span>COMMANDER’S FIELD GUIDE · ${tutorialStep + 1}/4</span><b>${tips[tutorialStep][0]}</b><p>${tips[tutorialStep][1]}</p>`;
  if (hudHTML.get("battle-hint") !== tipHTML) {
    updateLiveHTML(el as HTMLElement, tipHTML);
    hudHTML.set("battle-hint", tipHTML);
  }
}
function showDialog(title: string, body: string, cls = "") {
  surrenderConfirmationMatchId = null;
  troopSelectionDraft = null;
  if (playing && commander()?.directControl)
    issueCommand(state, { type: "steer", team: 0, dx: 0, dy: 0 });
  keys.clear();
  joystickVector = { x: 0, y: 0 };
  if (!modalOpen) previousFocus = document.activeElement as HTMLElement;
  modalOpen = true;
  releaseDialogToast();
  modal.innerHTML = `<div class="modal-backdrop"><section class="dialog ${cls}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><header><h2>${esc(title)}</h2>${cls.split(" ").includes("result-dialog") ? "" : button("Close", "close-dialog", "square", "close", 'aria-label="Close dialog"')}</header><div class="dialog-feedback-slot"></div>${body}</section></div>`;
  modal.querySelector(".dialog-feedback-slot")!.append(toastElement);
  positionBattleToast();
  [...modal.querySelectorAll<HTMLButtonElement>("button")]
    .find(control => !control.disabled && !control.hidden && control.getClientRects().length)?.focus();
}
function closeDialog() {
  if (pendingResult) {
    void persistResult();
    return;
  }
  troopSelectionDraft = null;
  surrenderConfirmationMatchId = null;
  modalOpen = false;
  releaseDialogToast();
  modal.innerHTML = "";
  positionBattleToast();
  measureTroopSummaryObstacles();
  if (previousFocus?.isConnected) previousFocus.focus();
}
function showTroopPicker() {
  if (!playing || hasBattleEnded(state)) return;
  const draft = new Set(pruneTroopSelection(state, selection));
  showDialog("Choose troops", troopPickerHTML(state, draft), "troop-picker-dialog");
  troopSelectionDraft = draft;
  refreshTroopPicker();
}
function refreshTroopPicker() {
  if (!troopSelectionDraft) return;
  troopSelectionDraft = new Set(pruneTroopSelection(state, troopSelectionDraft));
  const count = modal.querySelector("#troop-selection-count");
  if (count) count.textContent = `${troopSelectionDraft.size} selected`;
  for (const group of troopSelectionGroups(state, troopSelectionDraft)) {
    const control = modal.querySelector<HTMLInputElement>(`[data-troop-type="${group.typeKey}"]`);
    if (control) { control.checked = group.checked; control.indeterminate = group.indeterminate; }
    const label = modal.querySelector(`[data-troop-type-count="${group.typeKey}"]`);
    if (label) label.textContent = `${group.selectedCount} / ${group.total} selected`;
  }
  for (const control of modal.querySelectorAll<HTMLInputElement>("[data-troop-id]"))
    control.checked = troopSelectionDraft.has(control.dataset.troopId!);
}
function showBriefing(index: number) {
  const m = activeCampaign.missions[index];
  showDialog(
    m.title,
    `${missionBriefingHTML(m)}${button("Raise the banner", "begin-mission", "primary large", "arrow")}`,
  );
}
function showHelp() {
  showDialog(
    "Command the frontier",
    `<div class="help-grid"><article>${icon("crosshair")}<h3>Lead from the front</h3><p>Select your commander, choose Move, then tap a destination. Orders → Choose troops selects a subset by type or individual; desktop Shift-click toggles troops. Drag the lower-left thumbstick on phones. On desktop, use WASD or arrow keys.</p></article><article>${icon("gold")}<h3>Claim your economy</h3><p>Stand near gold and timber to capture them. Held deposits generate resources until depleted. Enemy troops can contest them.</p></article><article>${icon("flag")}<h3>Build a fighting force</h3><p>Recruit troops from your keep and military buildings. Houses raise your population cap. Spearmen beat cavalry; cavalry hunt archers; siege breaks walls.</p></article><article>${icon("spark")}<h3>Turn the tide</h3><p>Hold relics to gain victory points. In Conquest, relics instead fund your siege; destroy every enemy keep to win. Commander abilities Q and E can win a close fight. Engineer’s C Breach Charge damages a nearby visible enemy building; bring an escort.</p></article><article>${icon("pause")}<h3>Take a breath</h3><p>Tactical pause freezes the fight. Queue movement, recruitment, and construction, then resume. Confirmed builds remain as dashed gold Queued footprints until Resume. Cancel closes only the active preview. Space pauses; Escape opens the menu.</p></article><article>${icon("save")}<h3>Make it yours</h3><p>Battles autosave every 30 seconds and when leaving the app. Load once online to play offline after the cache installs.</p></article></div>${learningGuideSkipped ? button("Replay practice guide", "replay-guide", "", "book") : ""}${button("Ready to lead", "close-dialog", "primary", "check")}`,
    "wide",
  );
}
function showAbout() {
  showDialog("Credits / About", aboutHTML() + button("Done", "close-dialog", "primary", "check"), "about-dialog");
}
async function applyVisualTheme(id: VisualThemeId, remember = false): Promise<boolean> {
  const ready = await renderer.setVisualTheme(id);
  if (!ready || renderer.visualTheme !== id) return false;
  preferences.visualTheme = id;
  if (remember) writeLocal("preferences", preferences);
  document.querySelectorAll<HTMLCanvasElement>("[data-portrait]")
    .forEach(c => void renderer.renderPortrait(c, c.dataset.portrait!));
  if (playing) refreshDeckState();
  return true;
}
function showSettings() {
  showDialog(
    "Settings",
    `<div class="settings-fields"><label>Visual theme <select id="visual-theme" aria-label="Visual theme">${Object.entries(VISUAL_THEMES).map(([id, theme]) => `<option value="${id}" ${preferences.visualTheme === id ? "selected" : ""}>${esc(theme.name)}</option>`).join("")}</select></label><p id="theme-status" class="muted" aria-live="polite">Choose the look of your units, strongholds and deposits. Artwork choices work offline and are saved on this device.</p><label>Interface text size <select id="ui-scale" aria-label="Interface text size"><option value="1" ${preferences.uiScale === 1 ? "selected" : ""}>Standard</option><option value="1.15" ${preferences.uiScale === 1.15 ? "selected" : ""}>Larger · 115%</option><option value="1.3" ${preferences.uiScale === 1.3 ? "selected" : ""}>Largest · 130%</option></select></label><label>Master volume <output id="master-value">${Math.round(preferences.master * 100)}%</output><input id="master-slider" aria-label="Master volume" type="range" min="0" max="1" step=".05" value="${preferences.master}"></label><label class="check-field"><input id="mute-audio" type="checkbox" ${preferences.muted ? "checked" : ""}> Mute all audio</label><label>Music <output id="music-value">${Math.round(preferences.music * 100)}%</output><input id="music-slider" aria-label="Music" type="range" min="0" max="1" step=".05" value="${preferences.music}"></label><label>Sound effects <output id="sfx-value">${Math.round(preferences.sfx * 100)}%</output><input id="sfx-slider" aria-label="Sound effects" type="range" min="0" max="1" step=".05" value="${preferences.sfx}"></label><label class="check-field"><input id="reduced-motion" type="checkbox" ${preferences.reducedMotion ? "checked" : ""}> Reduced motion and effects</label><label class="check-field"><input id="show-tips" type="checkbox" ${preferences.showTips ? "checked" : ""}> Commander’s field guide</label><p class="muted">Teams use six distinct banner and ground shapes alongside their colors. Faction crests add a separate identity; Credits / About explains the symbols. Music and effects work offline. The soundtrack can be replaced later through the repository’s audio manifest; see docs/AUDIO_REPLACEMENT.md for file names and loop settings.</p></div>${button("Done", "close-dialog", "primary", "check")}`,
  );
}
function showPauseMenu() {
  showDialog(
    "Take a breath",
    `<p class="muted">The battle is paused. Your frontier will wait.</p><p class="mission-goal">${icon("flag")} ${esc(state.objectiveText)}</p>${activeMission() ? `<div id="mission-progress">${missionObjectivesHTML(state, activeMission()!)}</div>` : ""}<div class="menu-stack">${button("Return to battle", "resume-dialog", "primary", "play")}${workshopTest.active ? button("Return to workshop", "return-to-editor", "", "back") : ""}${button("Save battle", "save", "", "save")}${button("Copy map code", "copy-map-code", "", "map")}${button("How to play", "help", "", "book")}${button("Settings", "settings", "", "gear")}${button("Credits / About", "about", "", "book")}${button("Save & leave", "save-leave", "", "back")}${canOfferSurrender() ? button("Surrender battle", "surrender", "surrender-action", "flag") : ""}</div>`,
  );
  updateHUD();
}
function canOfferSurrender() {
  return playing && !applyingUpdate && !editing && !workshopTest.active && !state.settings.learning &&
    !resultShown && !pendingResult && canPlayerContinue(state);
}
function showSurrenderConfirmation() {
  if (!canOfferSurrender()) return;
  // A planned-order notice is unrelated to the choice to end this battle.
  clearToast();
  const consequence = expeditionBattleActive
    ? "This also ends your expedition run. Your journal and earlier rewards are kept, but you will need to start a new expedition."
    : activeMission()
      ? "This attempt won’t complete the chapter or unlock rewards. You can try again from the result screen."
      : "You can start a fresh battle from the result screen.";
  showDialog(
    "Surrender this battle?",
    `<p>This ends the current battle and records a defeat. You won’t earn rewards.</p><p>${consequence}</p><p class="muted">Use Save &amp; leave if you want to continue this battle later.</p><div class="result-actions">${button("Cancel", "cancel-surrender", "primary", "back")}${button("Confirm surrender", "confirm-surrender", "surrender-action", "flag")}</div>`,
    "surrender-dialog",
  );
  surrenderConfirmationMatchId = battleMatchId;
}
function battleSnapshot() {
  return {
    version: 2,
    game: serializeGame(state),
    matchId: battleMatchId,
    campaignSession,
    expedition:
      expeditionBattleActive && expeditionRun
        ? saveExpedition(expeditionRun)
        : null,
    tutorial: tutorialOrigin
      ? resultShown
        ? { step: tutorialStep, origin: { ...tutorialOrigin }, ...(tutorialSupplyCaptured ? { supplyCaptured: true } : {}) }
        : advanceTutorial(state, { step: tutorialStep, origin: tutorialOrigin, supplyCaptured: tutorialSupplyCaptured })
      : undefined,
    learningProgress,
    learningGuideSkipped,
    missionIndex,
    campaignId: activeCampaign.id,
    savedAt: Date.now(),
  };
}
async function persist(): Promise<boolean> {
  if (workshopTest.active) return true;
  // An update/restart can arrive before the next frame has rendered the result.
  if (playing && !canPlayerContinue(state) && !resultShown) showResult();
  if (pendingResult) return persistResult();
  if (!playing || !canPlayerContinue(state)) return true;
  // Capture now, even if a startup/autosave transaction is still in flight.
  const record = battleSnapshot();
  const checkpoint =
    expeditionBattleActive && expeditionRun
      ? expeditionCheckpoint(expeditionRun, record)
      : null;
  return battleSaves.run(async () => {
    try {
      if (checkpoint) {
        await saveRecord("expedition", checkpoint);
        if (
          expeditionBattleActive &&
          expeditionRun?.phase === "battle" &&
          battleMatchId === record.matchId
        )
          savedExpeditionBattle = record;
      }
      await saveRecord("battle", record);
      savedGame = record;
      return true;
    } catch {
      toast("Could not save. Your browser storage may be full.", "warning");
      return false;
    }
  });
}
async function continueGame(checkpoint?: unknown) {
  const navigation = ++navigationVersion;
  await Promise.all([battleSaves.idle(), expeditionReady]);
  const record: any = checkpoint ?? (await loadRecord("battle"));
  if (applyingUpdate || navigation !== navigationVersion) return;
  if (!record) return toast("No saved battle yet.");
  try {
    const restoredState = restoreGame(record.game);
    const journey = restoreBattleJourney(
      record,
      restoredState,
      `legacy:${record.savedAt ?? Date.now()}`,
    );
    const restoredExpedition = journey.expedition
      ? restoreExpedition(journey.expedition)
      : null;
    const completedExpedition = restoredExpedition && !canPlayerContinue(restoredState)
      ? finishExpeditionBattle(restoredExpedition, playerAllianceWon(restoredState))
      : null;
    if (
      restoredExpedition &&
      expeditionRun &&
      JSON.stringify(saveExpedition(restoredExpedition)) !== JSON.stringify(saveExpedition(expeditionRun)) &&
      (!completedExpedition ||
        JSON.stringify(saveExpedition(completedExpedition)) !== JSON.stringify(saveExpedition(expeditionRun)))
    )
      throw new Error("This encounter belongs to an older expedition route.");
    state = restoredState;
    battleMatchId = journey.matchId;
    campaignSession = journey.campaign;
    expeditionBattleActive = !!restoredExpedition;
    if (restoredExpedition) expeditionRun = restoredExpedition;
    speed = state.settings.gameSpeed ?? 1;
    workshopTest.clear();
    cancelMapTargeting();
    planningSnapshot = null;
    planningSignature = "";
    deckCollapsed = true;
    activeCampaign =
      CAMPAIGNS.find(
        (campaign) => campaign.id === campaignSession?.campaignId,
      ) ?? CAMPAIGNS[0];
    missionIndex = campaignSession
      ? activeCampaign.missions.findIndex(
          (mission) => mission.id === campaignSession!.missionId,
        )
      : null;
    learningProgress = state.settings.learning
      ? restoreLearning(state, record.learningProgress)
      : null;
    learningGuideSkipped = record.learningGuideSkipped === true;
    learningCompletionShown = learningGuideSkipped;
    const tutorial = restoreTutorial(state, record.tutorial);
    tutorialStep = tutorial.step;
    tutorialOrigin = tutorial.origin;
    tutorialSupplyCaptured = tutorial.supplyCaptured === true;
    state.paused = true;
    playing = true;
    document.body.classList.toggle("rush-mode", !!state.rush);
    resultShown = false;
    lastEvent = state.nextEventId;
    selection = new Set(commander() ? [commander()!.id] : []);
    commanderFocusFitted = false;
    commanderFrameCache = undefined;
    document.body.classList.add("in-game");
    renderer.camera.zoom =
      innerHeight < 500 && innerWidth > 600
        ? 0.85
        : innerWidth < 600
          ? 1.05
          : 1.3;
    const c = commander() || state.map.spawns[0];
    renderer.centerOn(c.x, c.y);
    followCommander = true;
    renderGameShell();
    audio.start("exploration");
    if (!canPlayerContinue(state)) showResult();
    else toast("Battle restored. Resume when you’re ready.", "", { untilResume: true });
  } catch (error) {
    toast(
      "This save could not be loaded. Your record is still safe.",
      "warning",
    );
    console.error(error);
  }
}
function updateResultSaveStatus(message: string, retry = false) {
  const status = document.querySelector<HTMLElement>("#result-save-status");
  if (status) status.textContent = message;
  const button = document.querySelector<HTMLButtonElement>('[data-action="result-save"]');
  if (button) button.hidden = !retry;
}
function persistResult(): Promise<boolean> {
  const pending = pendingResult;
  if (!pending) return Promise.resolve(true);
  if (pending.flight) return pending.flight;
  updateResultSaveStatus("Saving your result…");
  pending.flight = battleSaves.run(async () => {
    try {
      await pending.commit.commit();
      profile = pending.profile;
      if (pending.expeditionActive) {
        expeditionRun = pending.expedition;
        savedExpeditionBattle = null;
      }
      savedGame = null;
      pendingResult = null;
      updateResultSaveStatus("Result saved on this device.");
      return true;
    } catch {
      if (pending.commit.recoverable) savedGame = pending.battle;
      const message = pending.commit.recoverable
        ? "Your finished battle is saved, but its command record or route could not be committed. Free browser storage and retry. Continue can recover this result after a reload."
        : "Could not save this result. Keep this page open, free browser storage, and retry before leaving.";
      updateResultSaveStatus(message, true);
      toast("Result not saved. Free browser storage, then Retry saving result.", "warning");
      return false;
    }
  }).finally(() => { pending.flight = null; });
  return pending.flight;
}
function showResult() {
  if (resultShown) return;
  resultShown = true;
  updateHUD();
  const win = playerAllianceWon(state);
  audio.setState(win ? "victory" : "defeat");
  if (workshopTest.active) {
    showDialog(
      "Workshop test finished",
      `<p>${esc(battleResultReason(state))}</p><p>Your original draft, camera, and undo history are ready.</p>${button("Return to workshop", "return-to-editor", "primary", "back")}`,
      "result-dialog",
    );
    return;
  }
  const mission = activeMission();
  const expeditionNode = expeditionBattleActive
    ? (expeditionRun?.activeNode ?? undefined)
    : undefined;
  const battle = battleSnapshot();
  const resultExpedition = expeditionBattleActive && expeditionRun?.phase === "battle"
    ? finishExpeditionBattle(expeditionRun, win)
    : expeditionRun;
  const result = recordBattleResult(profile, state, {
    matchId: battleMatchId,
    ...(campaignSession
      ? {
          campaignId: campaignSession.campaignId,
          missionId: campaignSession.missionId,
          unlocks: mission?.unlocks,
        }
      : {}),
    expeditionNode,
    expeditionCompleted:
      expeditionBattleActive && resultExpedition?.phase === "completed",
  });
  pendingResult = {
    commit: new ResultCommit({
      battle,
      profile: result.profile,
      expedition: expeditionBattleActive && resultExpedition
        ? expeditionCheckpoint(resultExpedition, null)
        : null,
    }, { saveRecord, writeLocal, removeRecord }),
    battle,
    profile: result.profile,
    expedition: resultExpedition,
    expeditionActive: expeditionBattleActive,
    flight: null,
  };
  const next = mission ? nextMissions(activeCampaign, mission) : [];
  const primary = expeditionBattleActive
    ? button(
        win
          ? resultExpedition?.phase === "completed"
            ? "View completed expedition"
            : "Choose your next stop"
          : "View expedition result",
        "result-expedition",
        "primary",
        "map",
      )
    : mission
      ? win && next.length
        ? next
            .map((chapter) =>
              button(
                next.length === 1 ? "Next chapter" : chapter.title,
                "next-mission",
                "primary",
                "arrow",
                `data-id="${activeCampaign.missions.indexOf(chapter)}"`,
              ),
            )
            .join("")
        : button(
            win ? "View campaign" : "Try again",
            win ? "result-campaign" : "retry",
            "primary",
            "play",
          )
      : button(
          win ? "Another frontier" : "Try again",
          win ? "rematch" : "retry",
          "primary",
          "play",
        );
  const advice = win ? null : battleDefeatAdvice(state);
  const adviceHTML = advice ? `<aside class="defeat-guidance" aria-label="Next battle advice"><b>${esc(advice.title)}</b><p>${esc(advice.text)}</p></aside>` : "";
  showDialog(
    win ? "The frontier is yours." : "The banner will rise again.",
    `<div class="result-emblem ${win ? "win" : ""}">${icon(win ? "crown" : "shield")}</div><p class="result-reason">${esc(battleResultReason(state))}</p><div class="record-stats"><div><b>${time(state.time)}</b><span>Battle time</span></div><div><b>${state.players[0].stats.kills}</b><span>Enemies defeated</span></div><div><b>${state.players[0].stats.captures}</b><span>Points captured</span></div></div>${adviceHTML}${win && mission ? `<p>Reward: ${esc(mission.reward)}</p>` : ""}${result.earned.length ? `<div class="new-achievements">${result.earned.map((id) => `<span>${icon("star")}${esc(ACHIEVEMENTS.find((achievement) => achievement.id === id)?.name ?? id)}</span>`).join("")}</div>` : ""}<p id="result-save-status" aria-live="polite">Saving your result…</p>${button("Retry saving result", "result-save", "", "save", "hidden")}<div class="result-actions">${primary}${!win ? button("Practice the basics", "learn", "", "book") : ""}${button("Command record", "result-record", "", "star")}${button("Main menu", "result-home", "", "back")}</div>`,
    "result-dialog",
  );
  void persistResult();
}
function showDebug() {
  if (!debugEnabled || !playing) return;
  showDialog(
    "Frontier diagnostics",
    `<p class="muted">${Math.round(frameRate)} FPS · ${state.entities.length} entities · tick ${state.tick}<br>Seed: ${esc(state.settings.seed)}<br>Map validation: ${state.map.validation.valid ? "valid" : "invalid"}</p><div class="menu-stack">${button(debugReveal ? "Restore fog" : "Reveal map", "debug-reveal", "", "map")}${button("Add 1,000 gold and wood", "debug-resources", "", "gold")}${button("Simulation speed 4×", "debug-speed", "", "clock")}</div><p class="muted">${state.players
      .filter((p) => p.ai)
      .map((p) => `${esc(p.name)}: ${esc(p.aiPhase)}`)
      .join("<br>")}</p>`,
  );
}
function showRushSetup() {
  showDialog(
    "Rush Arena",
    `<span class="eyebrow">FOUR MINUTES. ONE COMMANDER. NO SECOND CHANCES.</span><p class="story">The rift is closing. Lead a small squad through escalating waves, collect field supplies, and choose a new upgrade every 45 seconds.</p><div class="rush-commanders">${Object.values(
      COMMANDERS,
    )
      .map(
        (c) =>
          `<button data-action="rush-commander" data-id="${esc(c.id)}" class="${settings.commander === c.id ? "chosen" : ""}">${icon(unitIcons[c.id])}<b>${c.name}</b></button>`,
      )
      .join(
        "",
      )}</div><p class="muted">Move to dodge the marked strikes. Your commander attacks nearby enemies automatically. Use your abilities often. Engineer’s Breach Charge only targets buildings.</p>${button("Enter the arena", "launch-rush", "primary large", "lightning")}`,
  );
}
function showRushUpgrade() {
  if (!state.rush?.upgradeAvailable) return;
  showDialog(
    "A moment of power",
    `<span class="eyebrow">CHOOSE YOUR FIELD UPGRADE</span><p class="muted">The battle waits while you choose. Every upgrade lasts for this run.</p><div class="upgrade-choices">${state.rush.offeredUpgrades
      .map((id) => {
        const u = RUSH_UPGRADES[id];
        return `<button data-action="choose-rush-upgrade" data-id="${id}">${icon(id === "bulwark" ? "shield" : id === "reinforcements" ? "flag" : id === "renewal" ? "support" : "spark")}<span><b>${u.name}</b><small>${u.description}</small></span>${icon("arrow")}</button>`;
      })
      .join("")}</div>`,
  );
}
function readSetup(validate = true): boolean {
  const form = document.querySelector<HTMLFormElement>("#setup-form");
  if (!form) return true;
  try {
    const next = readSetupControls(new FormData(form), completeSetup());
    if (next.mode === "rush") {
      settings = {
        ...settings,
        seed: next.seed,
        commander: next.commander,
        faction: next.faction,
      };
      renderSetup();
      showRushSetup();
      return false;
    }
    settings = next;
    refreshSetupSummary();
    if (validate) settings = prepareSetup(next);
    return true;
  } catch (error) {
    toast(
      error instanceof Error ? error.message : "Check your match settings.",
      "warning",
    );
    return false;
  }
}
async function showSetupCode() {
  if (!readSetup()) return;
  const current = prepareSetup(completeSetup()),
    code = encodeMapCode(current, current.mapGenerationVersion ?? 5);
  try {
    await navigator.clipboard.writeText(code);
    toast(
      current.mapGenerationVersion === 5
        ? "Complete match code copied, including armies, alliances, and rules."
        : "Legacy terrain code copied. Use generator v5 to share full match rules.",
    );
  } catch {
    showDialog(
      "Your match code",
      `<p>Paste this into Map seed or match code on the skirmish screen.</p><textarea class="map-code-box" readonly aria-label="Match code">${esc(code)}</textarea>${button("Done", "close-dialog", "primary")}`,
    );
  }
}
// Workshop drafts are independent of live battles and Continue/profile records.
let editing = false,
  editorBrush = "grass",
  editorMode: "paint" | "pan" = "paint",
  editorBrushSize = 1,
  editorTeam = 0,
  editorToolsCollapsed = false,
  editorSession = 0,
  editorLibraryId: string | undefined;
let editorHistory = new EditorHistory(),
  editorStrokeStart: WorkshopMap | null = null,
  editorLastPaint: Point | null = null,
  editorStrokeError = "",
  editorDraft: WorkshopBookmark | null = null;
const workshopLibrary = new WorkshopLibrary({
  load: loadRecord,
  save: saveRecord,
});
const workshopTest = new WorkshopTestSession();
let editorLibraryRequest = 0;
function workshopView() {
  return {
    camera: { ...renderer.camera },
    mode: editorMode,
    brush: editorBrush,
    brushSize: editorBrushSize,
    team: editorTeam,
  };
}
function rememberEditorDraft() {
  finishEditorStroke();
  const input = document.querySelector<HTMLInputElement>("#editor-map-name");
  if (input) {
    const name = input.value.trim();
    if (!name || name.length > 120)
      throw new Error("Give your map a name between 1 and 120 characters.");
    (state.map as WorkshopMap).name = name;
  }
  editorDraft = {
    version: 1,
    map: structuredClone(state.map),
    view: workshopView(),
  };
}
async function storeEditorDraft() {
  if (editing) rememberEditorDraft();
  if (!editorDraft) return;
  await saveRecord("workshop-draft", {
    bookmark: editorDraft,
    history: editorHistory.export(),
    libraryId: editorLibraryId,
  });
}
async function renderEditorMenu() {
  const request = ++editorLibraryRequest;
  screen.innerHTML = `<div class="menu-scrim solid"></div><main class="content-page">${pageHeader("MAP WORKSHOP", "Make your frontier", "Author terrain, armies, alliances, camps, and victory rules.")}<div class="workshop-library-intro"><p>Save named drafts on this device, export JSON to share them, and test a separate copy without losing your work. Unfinished drafts can be saved and reopened.</p><div class="menu-stack">${button("Create a map", "new-editor", "primary", "plus")}${button("Return to draft", "resume-editor", "", "back")}${button("Open most recent saved map", "load-editor", "", "save")}<label class="file-button">${icon("map")} Import map JSON<input type="file" id="import-map" accept="application/json,.json"></label></div></div><section id="workshop-library" aria-label="Saved maps"><p>Loading saved maps…</p></section></main>`;
  try {
    const entries = await workshopLibrary.list();
    if (request !== editorLibraryRequest || menuPage !== "editor" || editing)
      return;
    const target = document.querySelector("#workshop-library");
    if (target)
      target.innerHTML = `<h2>Saved frontiers <small>${entries.length} / 24</small></h2>${entries.length ? entries.map((entry) => `<article class="workshop-library-entry"><div><h3>${esc(entry.name)}</h3><p>Saved ${esc(new Date(entry.updatedAt).toLocaleString())}</p></div>${button("Open", "open-workshop-map", "", "map", `data-id="${esc(entry.id)}"`)}${button("Clone", "clone-workshop-map", "", "plus", `data-id="${esc(entry.id)}"`)}</article>`).join("") : "<p>No named maps yet. Create or import your first frontier.</p>"}`;
  } catch (error) {
    const target = document.querySelector("#workshop-library");
    if (request === editorLibraryRequest && target)
      target.textContent =
        error instanceof Error
          ? error.message
          : "Could not load the workshop library.";
  }
}
function openEditor(
  map?: GameState["map"],
  options: {
    keepHistory?: boolean;
    view?: WorkshopBookmark["view"];
    libraryId?: string;
  } = {},
) {
  navigationVersion++;
  const draft = ensureWorkshopMap(
    map ??
      createGame({
        seed: randomSeed(),
        mapSize: "tiny",
        mapGenerationVersion: 5,
        aiPlayers: 1,
        neutralCamps: 0,
      }).map,
  );
  const next = createWorkshopPreview(draft);
  editorSession++;
  editorLibraryRequest++;
  if (!options.keepHistory) editorHistory = new EditorHistory();
  editorStrokeStart = null;
  editorLastPaint = null;
  editorLibraryId = options.libraryId;
  playing = false;
  editing = true;
  placement = null;
  targetPoint = null;
  selection.clear();
  keys.clear();
  pointers.clear();
  workshopTest.clear();
  audio.start("menu");
  state = next;
  renderer.invalidateTerrain();
  if (options.view) {
    Object.assign(renderer.camera, options.view.camera);
    editorMode = options.view.mode;
    editorBrush = options.view.brush;
    editorBrushSize = options.view.brushSize;
    editorTeam = options.view.team;
  } else {
    renderer.centerOn(state.map.width / 2, state.map.height / 2);
    renderer.camera.zoom = innerWidth < 600 ? 0.55 : 0.75;
    editorTeam = 0;
  }
  if (
    state.map.scenario?.slots[editorTeam]?.controller === "closed" ||
    editorTeam >= state.map.spawns.length
  )
    editorTeam = 0;
  document.body.classList.remove("rush-mode");
  document.body.classList.add("in-game", "in-editor");
  renderEditorShell();
  rememberEditorDraft();
}
function renderEditorShell() {
  stopDeckObservation();
  const map = state.map as WorkshopMap;
  screen.innerHTML = `<header class="editor-header">${button("Workshop", "exit-editor", "back", "back")}<h2>Map workshop</h2>${button("Tools", "toggle-editor-tools", "", "map")}${button("Save", "save-map", "", "save")}${button("Test map", "test-map", "primary", "play")}</header><aside class="editor-tools ${editorToolsCollapsed ? "collapsed" : ""}" aria-label="Workshop tools"><label class="field"><span>Map name</span><input id="editor-map-name" maxlength="120" value="${esc(map.name ?? map.seed)}"></label>${button("Dimensions, biome & rules", "workshop-settings", "", "gear")}<div class="editor-mode-tools">${button("Paint", "editor-paint", editorMode === "paint" ? "active" : "", "map")}${button("Pan", "editor-pan", editorMode === "pan" ? "active" : "", "crosshair")}${button("Undo", "editor-undo", "", "back")}${button("Redo", "editor-redo", "", "arrow")}</div><label class="brush-size">Brush size <select id="brush-size" aria-label="Brush size">${[1, 3, 5].map((n) => `<option value="${n}" ${n === editorBrushSize ? "selected" : ""}>${n} tile${n === 1 ? "" : "s"}</option>`).join("")}</select></label><details open><summary>Terrain</summary><div class="brushes">${["grass", "forest", "water", "rock", "sand", "snow", "road", "marsh"].map((b) => button(b, `brush-${b}`, b === editorBrush ? "active" : "", "map")).join("")}</div></details>${renderWorkshopPalette(map, editorTeam)}<p id="editor-tool-help">Paint: drag terrain and erase brushes; tap once to place a force, camp, deposit, or spawn. Pan: drag the map. Two fingers always pan/zoom. Undo reverses one stroke. Ctrl/⌘ Z undoes; Shift Z redoes.</p><div id="map-validation" aria-live="polite"></div>${button("Validate", "validate-map", "", "check")}${button("Save a named copy", "clone-current-map", "", "plus")}${button("Export JSON", "export-map", "", "save")}</aside><div class="editor-map-controls">${button("Zoom in", "zoom-in", "square", "plus")}${button("Zoom out", "zoom-out", "square", "minus")}${button("Center map", "center-editor", "square", "crosshair")}</div><div class="editor-bottom"><span>${map.width} × ${map.height} · ${esc(map.biome)} · ${map.scenario!.slots.filter((s) => s.controller !== "closed").length} players</span>${button("Regenerate", "regenerate-map", "", "spark")}</div>`;
  refreshEditorTools();
  void validateEditor();
}
function refreshEditorTools() {
  screen
    .querySelectorAll<HTMLButtonElement>(
      ".brushes button,[data-action='workshop-brush']",
    )
    .forEach((b) =>
      b.classList.toggle(
        "active",
        (b.dataset.id ?? b.dataset.action?.slice(6)) === editorBrush,
      ),
    );
  screen
    .querySelectorAll<HTMLButtonElement>(".editor-mode-tools button")
    .forEach((b) => {
      b.classList.toggle("active", b.dataset.action === `editor-${editorMode}`);
      if (b.dataset.action === "editor-paint" || b.dataset.action === "editor-pan")
        b.setAttribute("aria-pressed", String(b.dataset.action === `editor-${editorMode}`));
      if (b.dataset.action === "editor-undo")
        b.disabled = !editorHistory.canUndo;
      if (b.dataset.action === "editor-redo")
        b.disabled = !editorHistory.canRedo;
    });
}
function refreshEditorPreview(map = state.map) {
  state = createWorkshopPreview(map);
  renderer.invalidateTerrain();
  if (
    editorTeam >= state.map.spawns.length ||
    state.map.scenario?.slots[editorTeam]?.controller === "closed"
  )
    editorTeam = 0;
  refreshEditorTools();
  void validateEditor();
}
async function validateEditor() {
  state.map.validation = validateWorkshopMap(state.map);
  const result = state.map.validation,
    target = document.querySelector("#map-validation");
  if (target)
    target.innerHTML = result.valid
      ? `<p class="valid">${icon("check")} Playable · ${Math.round(result.reachablePercent * 100)}% reachable</p>${result.warnings.map((w) => `<p>${esc(w)}</p>`).join("")}`
      : `<p class="invalid">${result.errors.map(esc).join("<br>")}</p>`;
  return result.valid;
}
function editorPlacementOptions(): WorkshopPlacementOptions {
  const value = (name: string, fallback: string) =>
      screen.querySelector<HTMLInputElement>(`[name="${name}"]`)?.value ??
      fallback,
    owner = value("node-owner", "neutral");
  return {
    team: editorTeam,
    buildingLevel: Number(value("workshop-level", "1")) as 1 | 2 | 3,
    camp: {
      unit: value("camp-unit", "spearman") as UnitId,
      count: Number(value("camp-count", "3")),
      radius: Number(value("camp-radius", "2")),
      rewardGold: Number(value("camp-gold", "100")),
      rewardWood: Number(value("camp-wood", "100")),
    },
    node: {
      owner: owner === "neutral" ? null : Number(owner),
      amount: Number(value("node-amount", "1600")),
    },
  };
}
const terrainBrushes = new Set([
  "grass",
  "forest",
  "water",
  "rock",
  "sand",
  "snow",
  "road",
  "marsh",
]);
function paintEditorStroke(point: Point) {
  const continuous =
    terrainBrushes.has(editorBrush) || editorBrush === "erase-objects";
  if (!continuous && editorLastPaint) return;
  const tiles = continuous
      ? strokeTiles(
          editorLastPaint ?? point,
          point,
          state.map.width,
          state.map.height,
        )
      : [{ x: Math.floor(point.x), y: Math.floor(point.y) }],
    radius = continuous ? Math.floor(editorBrushSize / 2) : 0;
  for (const tile of tiles)
    for (let dy = -radius; dy <= radius; dy++)
      for (let dx = -radius; dx <= radius; dx++) {
        const x = tile.x + dx,
          y = tile.y + dy;
        if (x < 0 || y < 0 || x >= state.map.width || y >= state.map.height)
          continue;
        try {
          if (terrainBrushes.has(editorBrush))
            state.map.tiles[y * state.map.width + x] =
              editorBrush as GameState["map"]["tiles"][number];
          else
            state.map = placeWorkshopObject(
              state.map,
              editorBrush,
              { x: x + 0.5, y: y + 0.5 },
              editorPlacementOptions(),
            );
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "That object cannot be placed here.";
          if (editorStrokeError !== message) toast(message, "warning");
          editorStrokeError = message;
        }
      }
  editorLastPaint = point;
  renderer.invalidateTerrain();
}
function finishEditorStroke() {
  if (editorStrokeStart) {
    editorHistory.record(editorStrokeStart, state.map);
    refreshEditorPreview();
  }
  editorStrokeStart = null;
  editorLastPaint = null;
  editorStrokeError = "";
}
function returnToEditor() {
  const saved = workshopTest.restore() ?? editorDraft;
  if (!saved) return toast("No workshop draft is available.", "warning");
  closeDialog();
  openEditor(saved.map, {
    keepHistory: true,
    view: saved.view,
    libraryId: editorLibraryId,
  });
  toast("Back in your draft. Test battle changes were discarded.");
}
function downloadMap() {
  rememberEditorDraft();
  const url = URL.createObjectURL(
      new Blob([exportWorkshopMap(state.map)], { type: "application/json" }),
    ),
    a = document.createElement("a");
  a.href = url;
  a.download = `frontier-${((state.map as WorkshopMap).name ?? state.map.seed).replace(/[^a-z0-9-]/gi, "-")}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const pendingWorkshopActions = new Set<string>();
async function handleAction(action: string, id?: string) {
  if (battleSuspension.suspended && action !== "resume-app") return;
  if (action === "resume-app") {
    if (battleSuspension.resume(document.hidden)) {
      resetAppSuspension();
      // Never apply time spent away, even on browsers that stop animation frames.
      lastFrame = 0;
      updateHUD();
    }
    return;
  }
  const guarded = [
      "save-map",
      "clone-current-map",
      "clone-workshop-map",
      "test-map",
      "exit-editor",
      "resume-editor",
      "load-editor",
      "open-workshop-map",
    ].includes(action),
    key = ["save-map", "clone-current-map"].includes(action)
      ? "save-map"
      : action;
  if (guarded && pendingWorkshopActions.has(key)) return;
  if (guarded) pendingWorkshopActions.add(key);
  try {
    await performAction(action, id);
  } finally {
    if (guarded) pendingWorkshopActions.delete(key);
  }
}
async function performAction(action: string, id?: string) {
  if (applyingUpdate) return;
  const navigation = navigationVersion;
  // Do not replace a pending result/checkpoint with a new battle or route.
  if (pendingResult && !(await persistResult())) return;
  if (applyingUpdate || navigation !== navigationVersion) return;
  if (action.startsWith("panel-")) {
    panel = action.slice(6);
    deckCollapsed = false;
    renderDeck();
    return;
  }
  if (action.startsWith("brush-") || action === "workshop-brush") {
    finishEditorStroke();
    editorBrush =
      action === "workshop-brush" ? (id ?? "grass") : action.slice(6);
    editorMode = "paint";
    refreshEditorTools();
    return;
  }
  switch (action) {
    case "editor-paint":
    case "editor-pan":
      finishEditorStroke();
      editorMode = action === "editor-paint" ? "paint" : "pan";
      refreshEditorTools();
      break;
    case "editor-undo":
    case "editor-redo": {
      // Capture and validate the inline name before history rebuilds the shell.
      // Terrain-only history preserves it; settings transactions may rename.
      rememberEditorDraft();
      const map =
        action === "editor-undo"
          ? editorHistory.undo(state.map)
          : editorHistory.redo(state.map);
      if (map) {
        refreshEditorPreview(map);
        renderEditorShell();
      } else
        toast(
          action === "editor-undo" ? "Nothing to undo." : "Nothing to redo.",
        );
      break;
    }
    case "toggle-editor-tools":
      editorToolsCollapsed = !editorToolsCollapsed;
      screen
        .querySelector(".editor-tools")
        ?.classList.toggle("collapsed", editorToolsCollapsed);
      break;
    case "center-editor":
      renderer.centerOn(state.map.width / 2, state.map.height / 2);
      break;
    case "workshop-settings":
      rememberEditorDraft();
      showDialog(
        "Battlefield settings",
        `<form id="workshop-settings-form">${renderWorkshopSettings(state.map)}<div class="result-actions"><button type="submit" class="primary">Apply settings</button>${button("Cancel", "close-dialog")}</div><p id="workshop-settings-error" role="alert"></p></form>`,
        "wide",
      );
      break;
    case "return-to-editor":
      returnToEditor();
      break;
    case "learn":
      launchGame({
        learning: true,
        seed: "FIRST-SETTLEMENT",
        mapSize: "tiny",
        difficulty: "easy",
        aiPlayers: 1,
        commander: "warlord",
        faction: "ironhold",
        duration: 18,
        mode: "domination",
        startingGold: 180,
        startingWood: 160,
        populationCap: 40,
      });
      break;
    case "toggle-guide":
      guideCollapsed = !guideCollapsed;
      updateHUD();
      break;
    case "learning-campaign": {
      closeDialog();
      activeCampaign = FRONTIER_CAMPAIGN;
      const outpostIndex = activeCampaign.missions.findIndex((mission) => mission.id === "outpost");
      launchGame(activeCampaign.missions[outpostIndex].settings, outpostIndex);
      break;
    }
    case "skip-guide":
      if (learningProgress && state.settings.learning) {
        learningGuideSkipped = true;
        learningProgress = {...learningProgress, step:LESSONS.length};
        learningCompletionShown = true;
        renderDeck(); updateHUD();
        toast("Guide skipped. Practice stays peaceful; Replay guide is available.");
      }
      break;
    case "replay-guide":
      if (modalOpen) closeDialog();
      if (learningProgress && state.settings.learning) {
        learningGuideSkipped = false;
        learningCompletionShown = false;
        learningProgress = restoreLearning(state, {...learningProgress, step:0});
        guideCollapsed = false;
        renderDeck(); updateHUD();
        toast("Practice guide replayed.");
      }
      break;
    case "learning-help": {
      if (!learningProgress) break;
      if (learningProgress.step === 5) {
        await performAction("learning-house-site");
      } else if (learningProgress.step === 4) {
        panel = "army";
        deckCollapsed = false;
        renderDeck();
      } else {
        const target = learningTarget(state, learningProgress.step);
        if (target) {
          deckCollapsed = true;
          guideCollapsed = true;
          updateDeckLayout();
          centerCommander(target);
          followCommander = false;
          targetPoint = { x: target.x, y: target.y };
          updateHUD();
        }
      }
      break;
    }
    case "repeat-placement":
      repeatPlacement = !repeatPlacement;
      updateHUD();
      break;
    case "confirm-placement": {
      if (!placement || !targetPoint) break;
      const building = placement,
        point = snapConstruction(targetPoint),
        check = plannedBuildResult(state, 0, building, point.x, point.y);
      if (!check.ok) {
        toast(check.error ?? "Choose another site.", "warning");
        updateHUD();
        break;
      }
      if (dispatch({ type: "build", team: 0, building, ...point }, "build")) {
        toast(
          state.paused
            ? `${BUILDINGS[building].name} planned. Resume to build.`
            : `${BUILDINGS[building].name} under construction.`,
          "", { untilResume: state.paused },
        );
        if (repeatPlacement && learningProgress?.step !== 5)
          targetPoint = snapConstruction({
            x: point.x + BUILDINGS[building].size * 2 + 0.5,
            y: point.y,
          });
        else {
          placement = null;
          targetPoint = null;
        }
        renderDeck();
        updateHUD();
      }
      break;
    }
    case "toggle-deck":
      deckCollapsed = !deckCollapsed;
      updateDeckLayout();
      break;
    case "toggle-minimap":
      minimapCollapsed = !minimapCollapsed;
      updateDeckLayout();
      break;
    case "economy":
      showDialog(
        "Your economy and army",
        (state.paused && state.pendingCommands.length
          ? '<p class="planned-orders">Available resources and training population include your planned orders. Resume to begin them.</p>'
          : "") +
          economyHTML(planningState()) +
          button("Back to battle", "close-dialog", "primary"),
        "wide",
      );
      break;
    case "economy-build":
      closeDialog();
      panel = "build";
      deckCollapsed = false;
      renderDeck();
      break;
    case "find-gold":
    case "find-wood": {
      closeDialog();
      const kind = action === "find-gold" ? "gold" : "wood",
        c = commander() ?? state.map.spawns[0];
      const node = state.map.nodes
        .filter(
          (n) =>
            n.kind === kind &&
            (n.owner === null || !areAllied(state, 0, n.owner)) &&
            n.amount > 0 &&
            state.fog.explored[0][
              Math.floor(n.y) * state.map.width + Math.floor(n.x)
            ],
        )
        .sort(
          (a, b) =>
            Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y),
        )[0];
      if (node) {
        renderer.centerOn(node.x, node.y);
        followCommander = false;
        toast(
          `Tap this ${kind === "gold" ? "mine" : "timber camp"} to send your selected troops to capture it.`,
        );
      } else toast("Explore beyond your frontier to find another deposit.");
      break;
    }
    case "view-resource": {
      closeDialog();
      const n = state.map.nodes.find((n) => n.id === id);
      if (n) {
        renderer.centerOn(n.x, n.y);
        followCommander = false;
      }
      break;
    }
    case "recruit-batch":
      recruitBatch = Number(id) || 1;
      renderDeck();
      break;
    case "inspect-building": {
      cancelMapTargeting();
      const b = state.entities.find(
        (e) => e.id === id && e.team === 0 && e.hp > 0,
      );
      if (b) {
        if (learningProgress && b.type === "keep")
          learningProgress.inspectedKeep = true;
        selection = new Set([b.id]);
        cancelMapTargeting();
        inspectTab = BUILDINGS[b.type as BuildingId]?.recruits.length ? "train" : "upgrades";
        panel = "inspect";
        deckCollapsed = false;
        renderDeck();
        updateHUD();
      }
      break;
    }
    case "inspect-tab":
      if (["train", "upgrades", "info"].includes(id ?? "")) inspectTab = id as typeof inspectTab;
      renderDeck();
      break;
    case "placement-place":
    case "placement-pan":
      placementMode = action === "placement-pan" ? "pan" : "place";
      updateHUD();
      break;
    case "capture-resource": {
      const node = state.map.nodes.find(n => n.id === selectedResourceId);
      if (!node) break;
      const troops = state.entities.filter(e => selection.has(e.id) && e.team === 0 && e.kind !== "building" && e.hp > 0);
      if (!troops.length) { const hero = commander(); if (hero) selection = new Set([hero.id]); }
      if (dispatch({type: "capture", team: 0, entityIds: [...selection], nodeId: node.id})) {
        targetPoint = {x: node.x, y: node.y};
        cancelMapTargeting();
        toast(`${resourceTargetName(node)}: capture and defend; engages nearby enemies.`);
      }
      updateHUD();
      break;
    }
    case "set-rally":
      cancelMapTargeting();
      rallyBuildingId = id ?? selectedBuilding()?.id ?? null;
      uiAction = "rally";
      deckCollapsed = true;
      updateDeckLayout();
      updateHUD();
      break;
    case "upgrade-building":
      if (id)
        dispatch({ type: "upgradeBuilding", team: 0, buildingId: id }, "build");
      renderDeck();
      break;
    case "cancel-production": {
      const [buildingId, queueId] = (id ?? "").split("|");
      if (buildingId && queueId)
        dispatch({ type: "cancelProduction", team: 0, buildingId, queueId });
      renderDeck();
      break;
    }

    case "debug-reveal":
      debugReveal = !debugReveal;
      closeDialog();
      break;
    case "debug-resources":
      state.players[0].gold += 1000;
      state.players[0].wood += 1000;
      closeDialog();
      break;
    case "debug-speed":
      speed = 4;
      closeDialog();
      break;
    case "home":
      editing = false;
      showMenu();
      break;
    case "rush":
      showRushSetup();
      break;
    case "rush-commander":
      settings.commander = id as any;
      showRushSetup();
      break;
    case "launch-rush":
      closeDialog();
      launchGame({
        mode: "rush",
        duration: 4,
        mapSize: "tiny",
        difficulty: "normal",
        seed: randomSeed(),
      });
      break;
    case "rush-upgrade":
      showRushUpgrade();
      break;
    case "choose-rush-upgrade":
      if (
        dispatch({ type: "upgrade", team: 0, upgrade: id as any }, "ability")
      ) {
        closeDialog();
        toast("Upgrade claimed. Keep moving!");
      }
      break;
    case "skirmish":
      showMenu("skirmish");
      break;
    case "choose-campaign":
      activeCampaign = CAMPAIGNS.find((c) => c.id === id) ?? CAMPAIGNS[0];
      renderCampaign(true);
      break;
    case "campaign":
      showMenu("campaign");
      break;
    case "expedition":
      showMenu("expedition");
      break;
    case "record":
      showMenu("record");
      break;
    case "record-category":
      recordCategory =
        id === "all" ||
        ACHIEVEMENT_CATEGORIES.some((category) => category.id === id)
          ? (id as AchievementCategory | "all")
          : "all";
      renderRecord();
      break;
    case "profile-banner": {
      const next = selectProfileBanner(profile, id ?? "");
      if (!writeLocal("profile", next))
        throw new Error("Could not save your command title. Free browser storage and try again.");
      profile = next;
      renderRecord();
      break;
    }
    case "profile-challenge":
      if (id !== "challenge-iron-oath") throw new Error("Unknown challenge.");
      launchGame(challengeSettings(profile, randomSeed()));
      break;
    case "mission-objectives":
      if (activeMission())
        showDialog(
          activeMission()!.title,
          `<div id="mission-progress">${missionObjectivesHTML(state, activeMission()!)}</div>${button("Return to battle", "close-dialog", "primary", "play")}`,
        );
      break;
    case "editor":
      showMenu("editor");
      break;
    case "help":
      showHelp();
      break;
    case "about":
      showAbout();
      break;
    case "settings":
      showSettings();
      break;
    case "close-dialog":
      if (modal.querySelector(".result-dialog")) break;
      closeDialog();
      break;
    case "choose-commander":
      if (!readSetup(false)) break;
      settings.commander = id as GameSettings["commander"];
      if (settings.slots) settings.slots[0].commander = settings.commander;
      renderSetup();
      break;
    case "choose-scale":
      if (!readSetup(false)) break;
      settings = selectSetupScale(
        completeSetup(),
        id as "quick" | "standard" | "epic" | "custom",
      );
      renderSetup();
      break;
    case "copy-setup-code":
      await showSetupCode();
      break;
    case "preview-setup": {
      if (!readSetup()) break;
      const preview = createGame(prepareSetup(completeSetup()));
      showDialog(
        "Your battlefield preview",
        `<canvas id="setup-minimap" class="setup-minimap" width="400" height="300" aria-label="Preview of generated battlefield"></canvas>${renderSetupSummary(preview.settings)}<p class="muted">Generated from this exact seed and generator version.</p>${button("Back to settings", "close-dialog", "primary")}`,
        "wide",
      );
      const minimap =
        document.querySelector<HTMLCanvasElement>("#setup-minimap");
      if (minimap) renderMinimap(minimap, preview, { reveal: true });
      break;
    }
    case "new-seed":
      if (!readSetup(false)) break;
      settings.seed = randomSeed();
      renderSetup();
      break;
    case "launch":
      if (readSetup()) launchGame();
      break;
    case "continue":
      await continueGame();
      break;
    case "mission":
      launchGame(activeCampaign.missions[Number(id)].settings, Number(id));
      break;
    case "begin-briefing":
    case "begin-mission":
    case "resume-dialog":
      closeDialog();
      issueCommand(state, { type: "pause", team: 0, paused: false });
      updateHUD();
      break;
    case "pause":
      dispatch({ type: "pause", team: 0, paused: !state.paused });
      break;
    case "pause-menu":
      showPauseMenu();
      break;
    case "surrender":
      showSurrenderConfirmation();
      break;
    case "cancel-surrender":
      if (surrenderConfirmationMatchId === battleMatchId && canOfferSurrender()) showPauseMenu();
      break;
    case "confirm-surrender": {
      if (!canOfferSurrender() || surrenderConfirmationMatchId !== battleMatchId ||
          !modal.querySelector(".surrender-dialog") || battleSuspension.suspended) break;
      surrenderConfirmationMatchId = null;
      const result = issueCommand(state, { type: "surrender", team: 0 });
      if (!result.ok) { toast(result.error || "This battle cannot be surrendered.", "warning"); break; }
      placement = null;
      targetPoint = null;
      cancelMapTargeting();
      planningSnapshot = null;
      planningSignature = "";
      showResult();
      break;
    }
    case "view-attacked-building": {
      const building = state.entities.find(
        (e) => e.id === id && e.team === 0 && e.kind === "building" && e.hp > 0,
      );
      if (building) {
        followCommander = false;
        centerCommander(building);
        audio.play("select");
      }
      break;
    }
    case "focus":
    case "select-commander": {
      if (action === "focus") document.querySelector("#toast")?.classList.remove("show");
      cancelMapTargeting();
      const c = commander();
      if (c) {
        selection = new Set([c.id]);
        // Both commander controls must reveal the selected actor, including
        // default-zoom phones with the guide and recruitment panel open.
        centerCommander(c, true);
        followCommander = true;
        placement = null;
        audio.play("select");
        updateHUD();
      }
      break;
    }
    case "march-relic": {
      cancelMapTargeting();
      const troops = state.entities.filter(
        (e) => e.team === 0 && e.kind !== "building" && e.hp > 0,
      );
      if (!troops.length) {
        toast("Wait for your commander or recruit troops first.");
        break;
      }
      const target = nearestRelic(state, commander() ?? state.map.spawns[0]);
      if (target) {
        selection = new Set(troops.map((e) => e.id));
        placement = null;
        followCommander = true;
        if (
          dispatch({
            type: "capture",
            team: 0,
            entityIds: [...selection],
            nodeId: target.id,
          })
        ) {
          targetPoint = { x: target.x, y: target.y };
          toast(
            state.paused
              ? `${resourceTargetName(target)} march queued; engages nearby enemies.`
              : state.settings.mode === "conquest"
                ? `${resourceTargetName(target)}: capture and defend to fund your siege.`
                : `${resourceTargetName(target)}: capture and defend for victory points.`,
            "", { untilResume: state.paused },
          );
        }
      }
      break;
    }
    case "choose-troops":
      showTroopPicker();
      break;
    case "troop-select-all":
    case "troop-select-none":
      if (troopSelectionDraft) {
        troopSelectionDraft = new Set(action === "troop-select-all" ? selectableTroops(state).map(entity => entity.id) : []);
        refreshTroopPicker();
      }
      break;
    case "troop-select-apply":
      if (troopSelectionDraft) {
        const next = new Set(pruneTroopSelection(state, troopSelectionDraft));
        cancelMapTargeting();
        if (placement) { placement = null; targetPoint = null; }
        selection = next;
        followCommander = false;
        closeDialog();
        renderDeck(); updateHUD();
        // Applying may rebuild Orders; restore focus to the new opener node.
        screen.querySelector<HTMLButtonElement>('[data-action="choose-troops"]')?.focus();
        audio.play("select");
        toast(troopSelectionFeedback(next.size));
      }
      break;
    case "select-army":
      cancelMapTargeting();
      selection = new Set(
        state.entities
          .filter((e) => e.team === 0 && e.kind !== "building" && e.hp > 0)
          .map((e) => e.id),
      );
      placement = null;
      audio.play("select");
      toast(armySelectionFeedback(selection.size));
      updateHUD();
      break;
    case "hold":
      cancelMapTargeting();
      dispatch({ type: "hold", team: 0, entityIds: [...selection] });
      break;
    case "recruit":
      if (
        dispatch(
          {
            type: "recruit",
            team: 0,
            unit: id as UnitId,
            count: panel === "inspect" ? 1 : recruitBatch,
            ...(selectedBuilding() &&
            BUILDINGS[
              selectedBuilding()!.type as BuildingId
            ]?.recruits.includes(id as UnitId)
              ? { buildingId: selectedBuilding()!.id }
              : {}),
          },
          "recruit",
        )
      )
        toast(
          state.paused
            ? `${UNITS[id as UnitId].name} order queued`
            : `${UNITS[id as UnitId].name} queued for training`,
          "", { untilResume: state.paused },
        );
      break;
    case "learning-house-site":
      if (learningProgress?.step !== 5) break;
      id = "house";
    case "build": {
      if (!learningActionAvailable(learningProgress?.step, "build", id ?? "")) {
        toast(learningPanelHint(learningProgress?.step, "build"));
        break;
      }
      const def = BUILDINGS[id as BuildingId];
      if (!affordable(def.cost)) {
        toast("Gather more resources first.", "warning");
        audio.play("error");
        break;
      }
      cancelMapTargeting();
      placement = id as BuildingId;
      placementMode = "place";
      targetPoint = null;
      const anchor = commander() ?? state.map.spawns[0];
      const houseLesson = learningProgress?.step === 5 && placement === "house";
      if (houseLesson) targetPoint = findLearningHouseSite(state, anchor) ?? null;
      for (let radius = 3; radius <= 8 && !targetPoint && !houseLesson; radius += 1)
        for (let i = 0; i < 12 && !targetPoint; i++) {
          const point = snapConstruction({
            x: anchor.x + Math.cos((i * Math.PI) / 6) * radius,
            y: anchor.y + Math.sin((i * Math.PI) / 6) * radius,
          });
          if (plannedBuildResult(state, 0, placement, point.x, point.y).ok)
            targetPoint = point;
        }
      if (!houseLesson) targetPoint ??= snapConstruction(anchor);
      deckCollapsed = true;
      if (houseLesson) guideCollapsed = true;
      followCommander = false;
      const homes = houseLesson ? state.entities.filter(e => e.team === 0 && e.type === "house" && e.hp > 0) : [];
      const suggestedNeighbor = targetPoint && homes.some(house => {
        const distance = Math.hypot(house.x - targetPoint!.x, house.y - targetPoint!.y);
        return distance >= 2.25 && distance <= 3;
      });
      toast(
        houseLesson && !targetPoint
          ? "No clear pair site nearby. Move troops away, or move to an open area and try Find pair site again."
          : houseLesson && homes.length && !suggestedNeighbor
          ? "Keep your existing Houses. This site starts a new pair; build another beside it to continue."
          : houseLesson && homes.length > 1
          ? "Keep your existing Houses. This additional House finishes a neighboring pair."
          : `Drag the ${def.name} preview, then choose Confirm build. Drag elsewhere to pan or pinch to zoom.`,
      );
      renderDeck();
      updateHUD();
      // The placement bar participates in the usable viewport before centering the anchor.
      measurePlayfield();
      if (houseLesson && targetPoint) centerCommander(targetPoint);
      else if (innerHeight < 500 && innerWidth > 600) centerCommander(anchor);
      break;
    }
    case "cancel-build":
      if (placement && isPlacementInstruction(document.querySelector("#toast")?.textContent ?? "", BUILDINGS[placement].name)) clearToast();
      placement = null;
      targetPoint = null;
      renderDeck();
      updateHUD();
      break;
    case "research":
      if (
        dispatch(
          {
            type: "research",
            team: 0,
            technology: id as TechId,
            ...(selectedBuilding()?.type === TECHNOLOGIES[id as TechId].building
              ? { buildingId: selectedBuilding()!.id }
              : {}),
          },
          "build",
        )
      )
        toast(
          state.paused
            ? `${TECHNOLOGIES[id as TechId].name} order queued`
            : `${TECHNOLOGIES[id as TechId].name} research started`,
          "", { untilResume: state.paused },
        );
      renderDeck();
      break;
    case "ability": {
      const c = commander();
      if (c) {
        // A stale movement/build point must never redirect a siege strike.
        const aimingState = id === "breach" ? planningState() : state;
        const aimingCommander = aimingState.entities.find(entity => entity.id === c.id) ?? c;
        const point = chooseAbilityTarget(aimingState, aimingCommander, id!, targetPoint);
        const used = dispatch(
          { type: "ability", team: 0, ability: id!, x: point.x, y: point.y },
          "ability",
        );
        if (used && id === "breach") toast(state.paused ? "Breach Charge queued. Resume to strike the enemy structure." : "Breach Charge struck the enemy structure.", "", { untilResume: state.paused });
      }
      break;
    }
    case "zoom-in":
      renderer.zoomAt(1.2);
      break;
    case "zoom-out":
      renderer.zoomAt(1 / 1.2);
      break;
    case "order-move":
    case "order-attack":
    case "order-attackMove": {
      if (!state.entities.some(e => selection.has(e.id) && e.team === 0 && e.kind !== "building" && e.hp > 0)) {
        toast("Select Commander or Army before choosing a destination.");
        break;
      }
      cancelMapTargeting();
      armedOrder = action === "order-attackMove" ? "attackMove" : action === "order-attack" ? "attack" : "move";
      deckCollapsed = true;
      updateDeckLayout();
      uiAction = armedOrder;
      renderDeck();
      updateHUD();
      break;
    }
    case "ranged-spacing": {
      const enabled = !planningState().players[0].rangedSpacing;
      if (dispatch({ type: "rangedSpacing", team: 0, enabled })) {
        renderDeck();
        toast(`Keep distance ${enabled ? "on" : "off"}${state.paused ? " when you resume" : ""}. Applies to current and future ranged troops; Move and Hold take priority.`, "", { untilResume: state.paused });
      }
      break;
    }
    case "cancel-order":
      cancelMapTargeting();
      renderDeck();
      updateHUD();
      break;
    case "rally-all": {
      const c = commander();
      if (c)
        for (const b of state.entities.filter(
          (e) => e.team === 0 && e.kind === "building",
        ))
          issueCommand(state, {
            type: "rally",
            team: 0,
            buildingId: b.id,
            x: c.x,
            y: c.y,
          });
      toast(c ? "Current buildings now send recruits to this fixed position. New buildings need their own rally point; it will not follow your commander." : "Your commander is recovering. Set a building rally point in Details.");
      break;
    }
    case "copy-map-code": {
      if (state.settings.customMap) {
        toast("Share this workshop map with Export JSON in the editor.");
        break;
      }
      const code = encodeMapCode(state.settings, state.map.version);
      try {
        await navigator.clipboard.writeText(code);
        toast("Map setup copied, including its seed and generator version.");
      } catch {
        showDialog(
          "Your map code",
          `<p class="muted">Copy this into Map seed on the skirmish screen to recreate the terrain and supplies.</p><textarea class="map-code-box" readonly aria-label="Map code">${esc(code)}</textarea>${button("Done", "close-dialog", "primary", "check")}`,
        );
      }
      break;
    }
    case "retry": {
      const mission = missionIndex,
        previous = { ...state.settings };
      closeDialog();
      launchGame(
        mission === null ? previous : activeCampaign.missions[mission].settings,
        mission,
      );
      break;
    }
    case "save":
      if (workshopTest.active) {
        toast(
          "Your workshop draft is safe. Return to the workshop to save or export it.",
        );
        break;
      }
      if (await persist()) toast("Battle saved on this device.");
      break;
    case "save-leave": {
      if (workshopTest.active) {
        returnToEditor();
        break;
      }
      const leavingMatch = battleMatchId;
      if (await persist()) {
        // A newer result/navigation must not be hidden by an older save finishing.
        if (applyingUpdate || navigation !== navigationVersion || leavingMatch !== battleMatchId ||
            resultShown || pendingResult || !canPlayerContinue(state)) break;
        closeDialog();
        showMenu();
      }
      break;
    }
    case "speed":
      speed =
        SETUP_SPEEDS[
          (SETUP_SPEEDS.indexOf(speed as (typeof SETUP_SPEEDS)[number]) + 1) %
            SETUP_SPEEDS.length
        ];
      state.settings.gameSpeed = speed;
      renderDeck();
      break;
    case "dismiss-tips":
      preferences.showTips = false;
      writeLocal("preferences", preferences);
      updateHUD();
      break;
    case "rematch":
      closeDialog();
      launchGame({
        ...state.settings,
        seed: randomSeed(),
        customMap: undefined,
      });
      break;
    case "result-save":
      if (await persistResult()) toast("Result saved on this device.");
      break;
    case "result-home":
      closeDialog();
      showMenu();
      break;
    case "result-record":
      closeDialog();
      showMenu("record");
      break;
    case "result-campaign":
      closeDialog();
      showMenu("campaign");
      renderCampaign(true);
      break;
    case "next-mission": {
      const mission = activeMission(),
        next = Number(id);
      if (
        !mission ||
        !nextMissions(activeCampaign, mission).includes(
          activeCampaign.missions[next],
        )
      )
        throw new Error("Choose a chapter on this story's route.");
      closeDialog();
      launchGame(activeCampaign.missions[next].settings, next);
      break;
    }
    case "result-expedition":
      closeDialog();
      showMenu("expedition");
      break;
    case "expedition-start":
      await expeditionReady;
      if (expeditionRun)
        throw new Error("Finish or restart your current expedition first.");
      await commitExpeditionRoute(
        startUnlockedExpedition(profile, randomSeed(), {
          faction: settings.faction,
          commander: settings.commander,
          loadout: id as ExpeditionLoadout,
        }),
      );
      if (navigation === navigationVersion && menuPage === "expedition")
        renderExpedition();
      break;
    case "expedition-node":
      await expeditionReady;
      if (!expeditionRun) throw new Error("Start an expedition first.");
      await commitExpeditionRoute(visitExpeditionNode(expeditionRun, id ?? ""));
      if (navigation !== navigationVersion || menuPage !== "expedition") break;
      if (expeditionRun.phase === "battle") launchExpeditionEncounter();
      else renderExpedition();
      break;
    case "expedition-choice":
      if (!expeditionRun) throw new Error("Start an expedition first.");
      await commitExpeditionRoute(
        chooseExpeditionReward(expeditionRun, id ?? ""),
      );
      if (navigation === navigationVersion && menuPage === "expedition")
        renderExpedition();
      break;
    case "expedition-resume":
      await expeditionReady;
      if (navigation !== navigationVersion) break;
      if (savedExpeditionBattle) await continueGame(savedExpeditionBattle);
      else launchExpeditionEncounter();
      break;
    case "expedition-new":
      if (
        expeditionRun &&
        !["completed", "defeated"].includes(expeditionRun.phase)
      )
        throw new Error("Your current expedition is still in progress.");
      await commitExpeditionRoute(null);
      if (navigation === navigationVersion && menuPage === "expedition")
        renderExpedition();
      break;
    case "expedition-save":
      await saveExpeditionRoute();
      toast("Expedition route saved on this device.");
      break;
    case "new-editor":
      openEditor();
      break;
    case "resume-editor": {
      if (editorDraft) {
        openEditor(editorDraft.map, {
          keepHistory: true,
          view: editorDraft.view,
          libraryId: editorLibraryId,
        });
        break;
      }
      const request = ++editorLibraryRequest,
        saved: any = await loadRecord("workshop-draft");
      if (request !== editorLibraryRequest || menuPage !== "editor" || editing)
        break;
      if (!saved?.bookmark) {
        toast("Create or open a map to begin your draft.");
        break;
      }
      workshopTest.resume(saved.bookmark);
      const bookmark = workshopTest.restore()!,
        history = new EditorHistory();
      if (saved.history) history.resume(saved.history);
      editorHistory = history;
      openEditor(bookmark.map, {
        keepHistory: true,
        view: bookmark.view,
        libraryId:
          typeof saved.libraryId === "string" ? saved.libraryId : undefined,
      });
      break;
    }
    case "load-editor": {
      const request = ++editorLibraryRequest,
        entries = await workshopLibrary.list();
      if (entries.length) {
        const entry = await workshopLibrary.load(entries[0].id);
        if (
          request !== editorLibraryRequest ||
          menuPage !== "editor" ||
          editing
        )
          break;
        openEditor(entry.map, { libraryId: entry.id });
      } else {
        const legacy = await loadRecord<GameState["map"]>("editor-map");
        if (
          request !== editorLibraryRequest ||
          menuPage !== "editor" ||
          editing
        )
          break;
        if (legacy) openEditor(legacy);
        else toast("No workshop saved yet. Create your first map.");
      }
      break;
    }
    case "open-workshop-map":
    case "clone-workshop-map": {
      const request = ++editorLibraryRequest,
        entry =
          action === "clone-workshop-map"
            ? await workshopLibrary.clone(id!)
            : await workshopLibrary.load(id!);
      if (request !== editorLibraryRequest || menuPage !== "editor" || editing)
        break;
      openEditor(entry.map, { libraryId: entry.id });
      if (action === "clone-workshop-map")
        toast("A separate named copy is ready to edit.");
      break;
    }
    case "exit-editor": {
      const session = editorSession;
      await storeEditorDraft();
      if (editing && editorSession === session) showMenu("editor");
      break;
    }
    case "save-map":
    case "clone-current-map": {
      const session = editorSession;
      rememberEditorDraft();
      const name = (state.map as WorkshopMap).name ?? state.map.seed;
      const entry = await workshopLibrary.save(
        state.map,
        action === "clone-current-map" ? `${name.slice(0, 115)} copy` : name,
        action === "save-map" ? editorLibraryId : undefined,
      );
      if (!editing || editorSession !== session) break;
      editorLibraryId = entry.id;
      const input =
        document.querySelector<HTMLInputElement>("#editor-map-name");
      if (input?.value.trim() === name) {
        (state.map as WorkshopMap).name = entry.name;
        input.value = entry.name;
      }
      await storeEditorDraft();
      toast(
        action === "save-map"
          ? "Workshop saved on this device."
          : "Saved a separate named copy.",
      );
      break;
    }
    case "export-map":
      downloadMap();
      break;
    case "validate-map":
      await validateEditor();
      break;
    case "test-map": {
      const session = editorSession;
      finishEditorStroke();
      if (await validateEditor()) {
        rememberEditorDraft();
        const options = workshopTest.begin(state.map, workshopView());
        await storeEditorDraft();
        if (editing && editorSession === session)
          launchGame(options, null, null, true);
      } else toast("Fix the map validation errors before playing.", "warning");
      break;
    }
    case "regenerate-map":
      showDialog(
        "Regenerate this frontier?",
        `<p>Your current map and undo history will be replaced. Save or export first if you want to keep it.</p><div class="result-actions">${button("Keep editing", "close-dialog", "primary")}${button("Regenerate map", "confirm-regenerate")}</div>`,
      );
      break;
    case "confirm-regenerate":
      closeDialog();
      openEditor();
      break;
  }
}
function unlockAudio(event: Event) {
  if (!event.isTrusted || document.hidden || battleSuspension.suspended) return;
  if (audioInterrupted) {
    audioInterrupted = false;
    audio.setMaster(preferences.master, preferences.muted);
    audio.start(audio.getState());
  }
  audio.unlock();
}
app.addEventListener("pointerdown", unlockAudio, { capture: true });
addEventListener("keydown", unlockAudio, { capture: true });
app.addEventListener("click", (e) => {
  unlockAudio(e);
  const b = (e.target as HTMLElement).closest<HTMLElement>("[data-action]");
  if (b && !(b as HTMLButtonElement).disabled) {
    e.preventDefault();
    void handleAction(b.dataset.action!, b.dataset.id).catch((error) =>
      toast(
        error instanceof Error
          ? error.message
          : "That action could not be completed.",
        "warning",
      ),
    );
    // The recovery action clears suspension synchronously. Unlock from this
    // trusted click rather than from a focus/visibility event or timer.
    if (b.dataset.action === "resume-app") unlockAudio(e);
  }
});
app.addEventListener("submit", (e) => {
  e.preventDefault();
  if ((e.target as HTMLElement).id === "workshop-settings-form") {
    try {
      const before = state.map,
        next = readWorkshopSettings(e.target as HTMLFormElement, before);
      editorHistory.record(before, next);
      renderer.camera.x += Math.floor((next.width - before.width) / 2);
      renderer.camera.y += Math.floor((next.height - before.height) / 2);
      refreshEditorPreview(next);
      closeDialog();
      renderEditorShell();
      rememberEditorDraft();
      toast("Battlefield settings applied. Undo restores the previous draft.");
    } catch (error) {
      const target = document.querySelector("#workshop-settings-error");
      if (target)
        target.textContent =
          error instanceof Error
            ? error.message
            : "Check the battlefield settings.";
    }
    return;
  }
  if ((e.target as HTMLElement).id === "setup-form") {
    if (readSetup()) launchGame();
  }
});
app.addEventListener("input", (e) => {
  const t = e.target as HTMLInputElement;
  if (troopSelectionDraft && t.closest(".troop-picker")) {
    if (t.dataset.troopType) troopSelectionDraft = new Set(setTroopTypeSelection(state, troopSelectionDraft, t.dataset.troopType, t.checked));
    else if (t.dataset.troopId) {
      if (t.checked) troopSelectionDraft.add(t.dataset.troopId); else troopSelectionDraft.delete(t.dataset.troopId);
      troopSelectionDraft = new Set(pruneTroopSelection(state, troopSelectionDraft));
    }
    refreshTroopPicker();
    return;
  }
  if (t.id === "ui-scale") {
    preferences.uiScale = Math.max(1, Math.min(1.3, Number(t.value)));
    document.documentElement.style.setProperty(
      "--ui-scale",
      String(preferences.uiScale),
    );
    measurePlayfield();
  }
  if (t.id === "brush-size") {
    editorBrushSize = Number(t.value);
    return;
  }
  if (t.id === "master-slider") {
    preferences.master = Number(t.value);
    audio.setMaster(preferences.master, preferences.muted);
    document.querySelector("#master-value")!.textContent =
      `${Math.round(preferences.master * 100)}%`;
  } else if (t.id === "mute-audio") {
    preferences.muted = t.checked;
    audio.setMaster(preferences.master, preferences.muted);
  } else if (t.id === "music-slider" || t.id === "sfx-slider") {
    preferences[t.id === "music-slider" ? "music" : "sfx"] = Number(t.value);
    audio.setVolumes(preferences.music, preferences.sfx);
    document.querySelector(`#${t.id.split("-")[0]}-value`)!.textContent =
      `${Math.round(Number(t.value) * 100)}%`;
  } else if (t.id === "reduced-motion") preferences.reducedMotion = t.checked;
  else if (t.id === "show-tips") preferences.showTips = t.checked;
  writeLocal("preferences", preferences);
});
app.addEventListener("change", async (e) => {
  const input = e.target as HTMLInputElement;
  if (input.closest(".troop-picker")) return;
  if (input.id === "visual-theme") {
    const id = normalizeVisualTheme(input.value), status = document.querySelector("#theme-status");
    input.disabled = true;
    if (status) status.textContent = "Loading artwork…";
    const ready = await applyVisualTheme(id, true);
    input.disabled = false;
    if (!ready) input.value = renderer.visualTheme;
    if (status) status.textContent = ready ? "Artwork ready." : "Could not load this artwork. Your current set is still available.";
    return;
  }
  if (input.closest("#setup-form")) {
    if (
      readSetup(false) &&
      ([
        "playerCount",
        "mapGenerationVersion",
        "difficulty",
        "slot-0-difficulty",
        "slot-0-commander",
        "slot-0-faction",
      ].includes(input.name) ||
        (input.name === "seed" && /^FC\d+\|/.test(input.value.trim())))
    )
      renderSetup();
    return;
  }
  if (input.name === "workshop-team") {
    editorTeam = Number(input.value);
    return;
  }
  if (input.id === "import-map" && input.files?.[0]) {
    try {
      const file = input.files[0];
      if (file.size > MAX_MAP_JSON_BYTES)
        throw new Error("Map file is too large.");
      openEditor(importWorkshopMap(await file.text()));
    } catch (error) {
      toast(
        `That file is not a supported Frontier map. ${error instanceof Error ? error.message : ""}`,
        "warning",
      );
    }
  }
});
function canvasPoint(e: PointerEvent): Point {
  const r = canvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}
canvas.addEventListener("pointerdown", (e) => {
  if ((!playing && !editing) || modalOpen || battleSuspension.suspended) return;
  // Audio is unlocked only by the trusted capture-phase gesture handler.
  canvas.setPointerCapture(e.pointerId);
  const point = canvasPoint(e);
  pointers.set(e.pointerId, point);
  if (pointers.size >= 2) {
    if (editing && editorStrokeStart) {
      refreshEditorPreview(editorStrokeStart);
      editorStrokeStart = null;
      editorLastPaint = null;
      renderer.invalidateTerrain();
    }
    const ps = [...pointers.values()];
    pinchDistance = Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y);
    pinchCenter = { x: (ps[0].x + ps[1].x) / 2, y: (ps[0].y + ps[1].y) / 2 };
    dragged = true;
  } else {
    pointerDown = point;
    pointerLast = point;
    const world = renderer.screenToWorld(point.x, point.y);
    draggingPreview = !!placement && placementMode === "place" && !!targetPoint && Math.hypot(world.x-targetPoint.x, world.y-targetPoint.y) <= BUILDINGS[placement].size + 1;
    dragged = false;
    if (editing && editorMode === "paint") {
      editorStrokeStart = structuredClone(state.map);
      paintEditorStroke(renderer.screenToWorld(point.x, point.y));
    }
  }
});
canvas.addEventListener("pointermove", (e) => {
  const point = canvasPoint(e);
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, point);
  if (pointers.size >= 2) {
    const ps = [...pointers.values()],
      d = Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y);
    const center = { x: (ps[0].x + ps[1].x) / 2, y: (ps[0].y + ps[1].y) / 2 };
    if (pinchCenter)
      renderer.pan(center.x - pinchCenter.x, center.y - pinchCenter.y);
    pinchCenter = center;
    if (pinchDistance)
      renderer.zoomAt(
        d / pinchDistance,
        (ps[0].x + ps[1].x) / 2,
        (ps[0].y + ps[1].y) / 2,
      );
    pinchDistance = d;
    followCommander = false;
    return;
  }
  if (pointerDown && pointerLast) {
    if (Math.hypot(point.x - pointerDown.x, point.y - pointerDown.y) > 8)
      dragged = true;
    if (editing && editorMode === "paint" && editorStrokeStart) {
      paintEditorStroke(renderer.screenToWorld(point.x, point.y));
    } else if (dragged && placement && draggingPreview && placementMode === "place") {
      targetPoint = snapConstruction(renderer.screenToWorld(point.x, point.y));
      updateHUD();
    } else if (dragged) {
      renderer.pan(point.x - pointerLast.x, point.y - pointerLast.y);
      followCommander = false;
    }
    pointerLast = point;
  }
});
function releasePointer(e: PointerEvent) {
  const point = canvasPoint(e);
  if (!pointers.has(e.pointerId)) return;
  pointers.delete(e.pointerId);
  if (pointers.size) return;
  if (editing) {
    finishEditorStroke();
    pointerDown = null;
    pointerLast = null;
    pinchDistance = 0;
    pinchCenter = null;
    return;
  }
  if (!dragged && pointerDown && !modalOpen) {
    const world = renderer.screenToWorld(point.x, point.y);
    if (placement) {
      if (placementMode === "place") targetPoint = snapConstruction(world);
      updateHUD();
    } else if (state.rush && !armedOrder && !renderer.pick(state, point.x, point.y)) {
      const hero = commander();
      if (hero && isWalkable(state.map, world.x, world.y)) {
        selection = new Set([hero.id]);
        dispatch({type: "move", team: 0, entityIds: [hero.id], x: world.x, y: world.y});
        targetPoint = world;
        followCommander = false;
        renderDeck();
      }
    } else if (armedOrder || (uiAction === "rally" && rallyBuildingId)) {
      const item = renderer.pick(state, point.x, point.y);
      if (armedOrder === "attack") {
        if (!item || !("team" in item) || item.team === 0 || areAllied(state, 0, item.team))
          targetError = "Choose an enemy unit or building.";
        else if (dispatch({type: "attack", team: 0, entityIds: [...selection], targetId: item.id})) {
          targetPoint = {x:item.x,y:item.y}; cancelMapTargeting();
        }
      } else if (!isWalkable(state.map, world.x, world.y)) {
        targetError = "Blocked terrain. Choose walkable ground.";
      } else {
        const ok = uiAction === "rally" && rallyBuildingId
          ? dispatch({type: "rally", team: 0, buildingId: rallyBuildingId, x:world.x,y:world.y})
          : dispatch({type: armedOrder as "move" | "attackMove", team: 0, entityIds:[...selection],x:world.x,y:world.y});
        if (ok) { targetPoint = world; cancelMapTargeting(); renderDeck(); }
        else targetError = "That order could not be submitted. Choose another target.";
      }
    } else {
      const item = renderer.pick(state, point.x, point.y);
      cancelMapTargeting();
      const additive = e.pointerType === "mouse" && e.shiftKey;
      if (item && "team" in item && item.team === 0) {
        if (additive && item.kind !== "building" && item.hp > 0) {
          selection = new Set(toggleTroop(state, selection, item.id));
          followCommander = false;
        } else if (additive && item.kind === "building") {
          toast("Shift-click adds troops. Use an ordinary click to inspect a building.");
          renderDeck(); updateHUD();
          pointerDown = null; pointerLast = null; pinchDistance = 0; pinchCenter = null;
          return;
        } else {
          selection = new Set([item.id]);
          followCommander = item.kind === "commander";
        }
        audio.play("select");
        if (item.kind === "building") {
          if (learningProgress && item.type === "keep") learningProgress.inspectedKeep = true;
          inspectTab = BUILDINGS[item.type as BuildingId]?.recruits.length ? "train" : "upgrades";
          panel = "inspect"; deckCollapsed = false;
        }
      } else if (item && "owner" in item) {
        selectedResourceId = item.id;
      } else if (item && "team" in item) {
        toast(areAllied(state, 0, item.team) ? "Your ally commands these forces." : "Choose Attack, then tap this enemy.");
      } else if (!additive) {
        selection.clear(); followCommander = false;
      }
      renderDeck();
    }
    updateHUD();
  }
  pointerDown = null;
  pointerLast = null;
  pinchDistance = 0;
  pinchCenter = null;
}
canvas.addEventListener("pointerup", releasePointer);
canvas.addEventListener("pointercancel", () => {
  if (editing && editorStrokeStart) {
    refreshEditorPreview(editorStrokeStart);
    editorStrokeStart = null;
    editorLastPaint = null;
    renderer.invalidateTerrain();
  }
  pointers.clear();
  pointerDown = null;
  pointerLast = null;
  pinchDistance = 0;
  pinchCenter = null;
});
canvas.addEventListener("contextmenu", (e) => e.preventDefault());
canvas.addEventListener(
  "wheel",
  (e) => {
    if (playing || editing) {
      e.preventDefault();
      renderer.zoomAt(Math.exp(-e.deltaY * 0.001), e.clientX, e.clientY);
      followCommander = false;
    }
  },
  { passive: false },
);
function setupJoystick() {
  const el = document.querySelector<HTMLElement>("#joystick")!;
  const update = (e: PointerEvent) => {
    const r = el.getBoundingClientRect(),
      dx = e.clientX - r.left - r.width / 2,
      dy = e.clientY - r.top - r.height / 2;
    const length = Math.hypot(dx, dy),
      limit = 30;
    joystickVector = {
      x: length < 5 ? 0 : dx / Math.max(length, limit),
      y: length < 5 ? 0 : dy / Math.max(length, limit),
    };
    const stick = el.querySelector<HTMLElement>(".joystick-stick")!;
    stick.style.transform = `translate(${joystickVector.x * limit}px,${joystickVector.y * limit}px)`;
  };
  el.addEventListener("pointerdown", (e) => {
    if (joystickPointer !== null || battleSuspension.suspended || modalOpen) return;
    e.preventDefault();
    // Audio is unlocked only by the trusted capture-phase gesture handler.
    joystickPointer = e.pointerId;
    el.setPointerCapture(e.pointerId);
    update(e);
    const c = commander();
    if (c) selection = new Set([c.id]);
    followCommander = true;
  });
  el.addEventListener("pointermove", (e) => {
    if (e.pointerId === joystickPointer) update(e);
  });
  const end = () => {
    const c = commander();
    if (c) issueCommand(state, { type: "steer", team: 0, dx: 0, dy: 0 });
    joystickVector = { x: 0, y: 0 };
    joystickPointer = null;
    el.querySelector<HTMLElement>(".joystick-stick")!.style.transform = "";
  };
  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", end);
  el.addEventListener("lostpointercapture", end);
}
const keys = new Set<string>();
window.addEventListener("keydown", (e) => {
  if (battleSuspension.suspended) {
    // One explicit resume control; Escape and battle hotkeys cannot bypass it.
    if (e.key === "Tab" || e.key === "Escape") {
      e.preventDefault();
      suspensionRoot.querySelector<HTMLButtonElement>("button")?.focus();
    }
    return;
  }
  if (modalOpen && e.key === "Escape") {
    e.preventDefault();
    // Terminal screens keep their explicit retry/menu exits reachable.
    if (modal.querySelector(".result-dialog")) return;
    closeDialog();
    return;
  }
  if (modalOpen && e.key === "Tab") {
    const focusables = [
      ...modal.querySelectorAll<HTMLElement>(
        'button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex="0"]',
      ),
    ].filter(element => {
      if (!element.getClientRects().length) return false;
      for (let ancestor = element.parentElement; ancestor && ancestor !== modal; ancestor = ancestor.parentElement) {
        if (ancestor instanceof HTMLDetailsElement && !ancestor.open && !ancestor.querySelector(":scope > summary")?.contains(element)) return false;
      }
      return true;
    });
    const first = focusables[0],
      last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first?.focus();
    }
    return;
  }
  if (modalOpen) return;
  if (debugEnabled && e.key === "`") {
    showDebug();
    return;
  }
  if ((e.target as HTMLElement).matches("input,select,textarea")) return;
  if (editing) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      void handleAction(e.shiftKey ? "editor-redo" : "editor-undo").catch((error) =>
        toast(error instanceof Error ? error.message : "That edit could not be restored.", "warning"),
      );
    } else if (e.key.toLowerCase() === "p") void handleAction("editor-pan");
    else if (e.key.toLowerCase() === "b") void handleAction("editor-paint");
    return;
  }
  keys.add(e.key.toLowerCase());
  if (!playing || e.repeat) return;
  if (e.key === "Escape") {
    if (placement) {
      placement = null;
      renderDeck();
    } else if (armedOrder) {
      cancelMapTargeting();
      renderDeck();
      updateHUD();
    } else if (modalOpen) closeDialog();
    else showPauseMenu();
  }
  if (e.code === "Space" && !(e.target as HTMLElement).closest("button")) {
    e.preventDefault();
    void handleAction("pause");
  }
  const shortcutAbility = COMMANDERS[state.settings.commander].abilities.find(ability => ability.key.toLowerCase() === e.key.toLowerCase());
  if (shortcutAbility && !e.ctrlKey && !e.metaKey && !e.altKey && !e.isComposing) void handleAction("ability", shortcutAbility.id);
  if (e.key.toLowerCase() === "m") void handleAction("order-move");
  if (e.key.toLowerCase() === "f") void handleAction("order-attack");
  if (e.key.toLowerCase() === "h") void handleAction("hold");
  if (e.key === "1") void handleAction("select-commander");
  if (e.key === "2") void handleAction("select-army");
  if (e.key.toLowerCase() === "b") void handleAction("panel-build");
  if (e.key.toLowerCase() === "r") void handleAction("panel-army");
});
window.addEventListener("keyup", (e) => {
  keys.delete(e.key.toLowerCase());
  if (
    playing &&
    [
      "w",
      "a",
      "s",
      "d",
      "arrowup",
      "arrowdown",
      "arrowleft",
      "arrowright",
    ].includes(e.key.toLowerCase()) &&
    ![...keys].some((k) =>
      [
        "w",
        "a",
        "s",
        "d",
        "arrowup",
        "arrowdown",
        "arrowleft",
        "arrowright",
      ].includes(k),
    )
  ) {
    const c = commander();
    // A key released while scrolling a dialog is not a steering command.
    if (c?.directControl) issueCommand(state, { type: "steer", team: 0, dx: 0, dy: 0 });
  }
});
function clearInterruptedInput() {
  if (editing) finishEditorStroke();
  keys.clear();
  joystickVector = { x: 0, y: 0 };
  const joystick = document.querySelector<HTMLElement>("#joystick");
  if (joystickPointer !== null && joystick?.hasPointerCapture(joystickPointer))
    joystick.releasePointerCapture(joystickPointer);
  joystickPointer = null;
  for (const pointer of pointers.keys())
    if (canvas.hasPointerCapture(pointer)) canvas.releasePointerCapture(pointer);
  pointers.clear();
  pointerDown = null;
  pointerLast = null;
  dragged = false;
  pinchDistance = 0;
  pinchCenter = null;
  const stick = joystick?.querySelector<HTMLElement>(".joystick-stick");
  if (stick) stick.style.transform = "";
}
function resetAppSuspension() {
  battleSuspension.reset();
  suspensionRoot.innerHTML = "";
  screen.inert = modal.inert = canvas.inert = false;
  if (suspensionFocus?.isConnected) suspensionFocus.focus();
  suspensionFocus = null;
}
function suspendApp() {
  // Browser interruptions must work even with Brutal or exhausted Hard pauses.
  // Clear direct steering before the checkpoint so no held input survives it.
  const interruptedBattle = playing && !hasBattleEnded(state);
  const changed = interruptedBattle && battleSuspension.suspend(state);
  clearInterruptedInput();
  audioInterrupted = true;
  audio.setMaster(preferences.master, true);
  audio.stop();
  if (changed) {
    suspensionFocus = document.activeElement as HTMLElement;
    screen.inert = modal.inert = canvas.inert = true;
    suspensionRoot.innerHTML = `<div class="modal-backdrop"><section class="dialog" role="dialog" aria-modal="true" aria-labelledby="suspension-title" aria-describedby="suspension-description"><header><h2 id="suspension-title">Battle suspended</h2></header><p id="suspension-description">The battle stopped when you left the app. Continue when you’re ready. Your tactical pauses and queued orders are unchanged.</p>${button(modalOpen ? "Return to dialog" : state.paused ? "Return to paused battle" : "Resume battle", "resume-app", "primary large", "play")}</section></div>`;
    if (!document.hidden)
      suspensionRoot.querySelector<HTMLButtonElement>("button")?.focus();
  }
  if (playing) void persist();
}
window.addEventListener("blur", suspendApp);
window.addEventListener("pagehide", suspendApp);
window.addEventListener("focus", () => {
  if (battleSuspension.suspended && !document.hidden)
    suspensionRoot.querySelector<HTMLButtonElement>("button")?.focus();
});
/** Cache HTML exclusions when HUD/layout changes, rather than reading DOM every paint. */
function measureTroopSummaryObstacles() {
  commanderFrameObstacles = [];
  troopSummaryObstacles = [...document.querySelectorAll<HTMLElement>(".hud,.objective-bar,.battle-hint,.minimap-wrap,.map-controls,.commander-strip,#joystick,.ability-dock,.command-deck,.paused-ribbon,.placement-toolbar,.target-toolbar,#toast,#update")].flatMap(el => {
    const style=getComputedStyle(el),r=el.getBoundingClientRect();
    if(style.display==="none"||style.visibility==="hidden"||(!Number(style.opacity)&&!el.matches("#toast.show"))||!r.width||!r.height)return [];
    const rect = {x:r.x,y:r.y,w:r.width,h:r.height};
    // Temporary messages must not move the camera during a native body tap.
    if (el.id !== "toast") commanderFrameObstacles.push(rect);
    return [rect];
  });
}
function measurePlayfield() {
  const hud = document.querySelector(".hud")?.getBoundingClientRect();
  const deckElement = document.querySelector(".command-deck");
  const deck = deckElement && getComputedStyle(deckElement).display !== "none" ? deckElement.getBoundingClientRect() : undefined;
  const minimap = document.querySelector(".minimap-wrap")?.getBoundingClientRect();
  if (hud)
    document.documentElement.style.setProperty("--hud-height", `${Math.ceil(hud.bottom)}px`);
  if (minimap)
    document.documentElement.style.setProperty("--minimap-height", `${Math.ceil(minimap.height)}px`);
  const abilities = document.querySelector<HTMLElement>(".ability-dock");
  document.documentElement.style.setProperty("--deck-height", deck ? `${Math.ceil(innerHeight - deck.top)}px` : "0px");
  const landscape = innerHeight < 500 && innerWidth > 600;
  if (abilities) abilities.style.bottom = "";
  const objective = landscape
    ? document.querySelector(".objective-bar")?.getBoundingClientRect()
    : undefined;
  const toolbar = landscape && placement
    ? document.querySelector(".placement-toolbar")?.getBoundingClientRect()
    : undefined;
  playfieldCenterY = battlefieldCenterY({
    height: innerHeight,
    landscape,
    hudBottom: hud?.bottom,
    objectiveBottom: objective?.bottom,
    deckTop: deck?.top ?? toolbar?.top,
    placementTop: toolbar?.top,
  });
  positionBattleGuide();
  positionBattleToast();
  measureTroopSummaryObstacles();
}
/** Include the commander's silhouette, health bar and banner in the clear area.
 * Reuse the existing control exclusions and cache layout work between HUD changes. */
function commanderFrame(): Point | undefined {
  const zoom = renderer.camera.zoom;
  const key = `${innerWidth}/${innerHeight}/${zoom}/${commanderFrameObstacles.map(r => `${r.x},${r.y},${r.w},${r.h}`).join(";")}`;
  if (commanderFrameCache?.key === key) return commanderFrameCache.point;
  const above = 86 * zoom, below = 30 * zoom, halfWidth = 44 * zoom;
  const rect = troopSummaryPosition(
    { x: innerWidth / 2, y: playfieldCenterY + below },
    { w: halfWidth * 2, h: above + below },
    { w: innerWidth, h: innerHeight }, commanderFrameObstacles, [], [],
  );
  const point = rect ? { x: rect.x + halfWidth, y: rect.y + above } : undefined;
  commanderFrameCache = { key, point };
  return point;
}
function cameraFocus(point: Point): Point {
  const framed = (point as Partial<Entity>).kind === "commander" && commanderFocusFitted
    ? commanderFrame() : undefined;
  const middle = renderer.screenToWorld(innerWidth / 2, innerHeight / 2),
    shifted = renderer.screenToWorld(
      innerWidth - (framed?.x ?? innerWidth / 2),
      innerHeight - (framed?.y ?? playfieldCenterY),
    );
  return {
    x: point.x + shifted.x - middle.x,
    y: point.y + shifted.y - middle.y,
  };
}
function centerCommander(point: Point, revealCommander = false) {
  if (revealCommander && (point as Partial<Entity>).kind === "commander") {
    commanderFocusFitted = true;
    measurePlayfield();
    // Commander selection should reveal the actor. Keep the chosen zoom when it fits;
    // otherwise free the panel space before fitting the largest clear view.
    if (!commanderFrame() && !deckCollapsed) {
      deckCollapsed = true;
      updateDeckLayout();
    }
    while (!commanderFrame() && renderer.camera.zoom > .42)
      renderer.camera.zoom = Math.max(.42, Math.round((renderer.camera.zoom - .05) * 100) / 100);
  }
  const focus = cameraFocus(point);
  renderer.centerOn(focus.x, focus.y);
}
function resize() {
  if (editing) finishEditorStroke();
  if (joystickPointer !== null && playing && !state.paused) {
    const hero = commander();
    if (hero)
      issueCommand(state, { type: "hold", team: 0, entityIds: [hero.id] });
  }
  joystickVector = { x: 0, y: 0 };
  joystickPointer = null;
  pointers.clear();
  pointerDown = null;
  pointerLast = null;
  pinchDistance = 0;
  const stick = document.querySelector<HTMLElement>(".joystick-stick");
  if (stick) stick.style.transform = "";
  renderer.resize(
    document.documentElement.clientWidth,
    document.documentElement.clientHeight,
    devicePixelRatio,
  );
  if (playing) {
    measurePlayfield();
    if (placement && targetPoint) centerCommander(targetPoint);
  }
}
addEventListener("resize", resize);
resize();
function frame(now: number) {
  if (runtimeFailed) return;
  const rawDelta = (now - (lastFrame || now)) / 1000;
  const dt = Math.min(0.1, rawDelta);
  if (rawDelta > 0)
    frameRate = frameRate * 0.95 + Math.min(120, 1 / rawDelta) * 0.05;
  lastFrame = now;
  try {
    if (playing) {
      // An async launch can finish after visibilitychange already fired.
      if (document.hidden && !hasBattleEnded(state) && !battleSuspension.suspended)
        suspendApp();
      if (
        !modalOpen &&
        !applyingUpdate &&
        !battleSuspension.suspended &&
        !document.hidden &&
        !hasBattleEnded(state)
      ) {
        const dx =
            (keys.has("d") || keys.has("arrowright") ? 1 : 0) -
            (keys.has("a") || keys.has("arrowleft") ? 1 : 0) +
            joystickVector.x,
          dy =
            (keys.has("s") || keys.has("arrowdown") ? 1 : 0) -
            (keys.has("w") || keys.has("arrowup") ? 1 : 0) +
            joystickVector.y;
        if ((dx || dy) && !state.paused && now - lastJoystick > 60) {
          const c = commander();
          if (c) {
            const wx = dx + dy * 2,
              wy = dy * 2 - dx,
              length = Math.hypot(wx, wy) || 1;
            const magnitude = Math.min(1, Math.hypot(dx, dy));
            issueCommand(state, {
              type: "steer",
              team: 0,
              dx: (wx / length) * magnitude,
              dy: (wy / length) * magnitude,
            });
            followCommander = true;
          }
          lastJoystick = now;
        }
      }
      battleSuspension.step(state, dt * speed, modalOpen || applyingUpdate || document.hidden);
      if (followCommander) {
        const c = commander();
        if (c) {
          const blend = 1 - Math.exp(-dt * 6);
          const focus = cameraFocus(c);
          renderer.camera.x += (focus.x - renderer.camera.x) * blend;
          renderer.camera.y += (focus.y - renderer.camera.y) * blend;
        }
      }
      for (const event of state.events) {
        if (event.id <= lastEvent) continue;
        if (event.type === "capture" && event.team === 0) {
          audio.play("capture");
          toast(event.text || "New territory claimed.");
        }
        if (event.type === "dialogue") toast(event.text || "");
        if (event.type === "alert" && event.team === 0) {
          audio.play("alert");
          toast(event.text || "Your frontier is under attack.", "warning");
        }
        if (
          event.type === "hit" &&
          (event.team === 0 || event.targetTeam === 0)
        )
          audio.play("hit");
        if (event.type === "death" && event.team === 0) audio.play("destroy");
        if (event.type === "research" && event.team === 0) {
          audio.play("research");
          toast(event.text || "Research complete.");
          renderDeck();
        }
        lastEvent = Math.max(lastEvent, event.id);
      }
      audio.setCombat(
        modalOpen || state.paused || battleSuspension.suspended
          ? 0
          : state.events.filter(
              (e) =>
                e.type === "hit" &&
                (e.team === 0 || e.targetTeam === 0) &&
                state.time - e.time < 2,
            ).length / 20,
      );
      hudClock += dt;
      if (!battleSuspension.suspended && !document.hidden) autosaveClock += dt;
      if (hudClock > 0.22) {
        updateHUD();
        hudClock = 0;
      }
      if (autosaveClock > 30 && !hasBattleEnded(state)) {
        void persist();
        autosaveClock = 0;
      }
      if (!canPlayerContinue(state)) showResult();
    }
    if (state) {
      const activePlacementResult = placement && targetPoint
        ? plannedBuildResult(state, 0, placement, targetPoint.x, targetPoint.y)
        : undefined;
      renderer.render(state, playing ? selection : [], {
        time: playing ? state.time + state.accumulator : now / 1000,
        reveal: !playing || debugReveal,
        quality: frameRate < 35 ? "low" : "high",
        reducedMotion: preferences.reducedMotion,
        screenObstacles: playing ? troopSummaryObstacles : [],
        plannedConstruction: visibleConstructionPlans(),
        placement:
          placement && targetPoint
            ? {
                type: placement,
                x: targetPoint.x,
                y: targetPoint.y,
                valid: activePlacementResult!.ok,
                size: BUILDINGS[placement].size,
                reason: activePlacementResult!.error,
              }
            : undefined,
        target:
          targetPoint && playing ? { ...targetPoint, radius: 0.45 } : undefined,
      });
    }
  } catch (error) {
    console.error(error);
    runtimeFailed = true;
    if (!document.querySelector(".fatal-error")) {
      const box = document.createElement("div");
      box.className = "fatal-error";
      box.innerHTML =
        '<b>The battlefield hit a snag.</b><p>Reload to return to the menu. Any saved battle will be available under Continue.</p><button onclick="location.reload()">Reload</button>';
      app.append(box);
    }
  }
  requestAnimationFrame(frame);
}
showMenu();
void initialBattle.then((saved) => {
  savedGame = saved;
  if (!playing && !editing && !modalOpen && menuPage === "home") showMenu();
});
requestAnimationFrame(frame);
void setupPWA(
  (apply) => {
    const el = document.querySelector("#update")!;
    el.innerHTML = `<span>A new frontier is ready.</span><button id="apply-update">Update & restart</button>`;
    const updateButton = el.querySelector("button")!;
    updateButton.addEventListener("click", () => {
      if (applyingUpdate) return;
      // Freeze new actions until activation so the durable checkpoint cannot be
      // superseded by a surrender or another battle while the update is saving.
      applyingUpdate = true;
      updateButton.disabled = true;
      updateButton.textContent = "Saving & restarting…";
      void apply().catch((error) => {
        applyingUpdate = false;
        updateButton.disabled = false;
        updateButton.textContent = "Update & restart";
        toast(error instanceof UpdateUnavailableError
          ? "This update is no longer waiting. Your battle is still open."
          : "Update postponed because the battle could not be saved.", "warning");
      });
    });
  },
  async () => {
    if (editing || workshopTest.active) await storeEditorDraft();
    if (!(await persist())) throw new Error("Save failed before update");
  },
);
document.addEventListener("visibilitychange", () => {
  if (document.hidden && editing)
    void storeEditorDraft().catch(() =>
      toast(
        "Could not autosave the workshop draft. Save or export before leaving.",
        "warning",
      ),
    );
  if (document.hidden) suspendApp();
  else if (battleSuspension.suspended)
    suspensionRoot.querySelector<HTMLButtonElement>("button")?.focus();
});
Object.defineProperty(window, "__FRONTIER__", {
  value: {
    get state() {
      return state;
    },
    get playing() {
      return playing;
    },
    get profile() {
      return profile;
    },
    get campaignSession() {
      return campaignSession;
    },
    get expedition() {
      return expeditionRun;
    },
    get matchId() {
      return battleMatchId;
    },
    get audioState() {
      return audio.getState();
    },
    command: (c: GameCommand) => dispatch(c),
    save: persist,
    renderer,
    start: launchGame,
  },
});

if ("serviceWorker" in navigator)
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    const el = document.querySelector("#offline-status");
    if (el) el.textContent = "Offline ready";
  });
