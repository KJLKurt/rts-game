import { EditorHistory, strokeTiles } from "./ui/editor-tools";
import {
  LESSONS,
  advanceLearning,
  learningTarget,
  restoreLearning,
  type LearningProgress,
} from "./ui/learning";
import { snapConstruction } from "./sim/construction";
import "./style.css";
import { inspectionHTML, productionHTML, economyHTML } from "./ui/inspection";
import {
  populationBreakdown,
  technologyCost,
  nextBuildingUpgrade,
} from "./sim/progression";
import { relicSummary, nearestRelic } from "./ui/objectives";
import { battleResultReason } from "./ui/results";
import { buildingUnderAttack } from "./ui/battle-guidance";
import { advanceTutorial, restoreTutorial } from "./ui/tutorial";
import { getEconomyRates } from "./sim/economy";
import { encodeMapCode, decodeMapCode } from "./ui/map-code";
import { chooseAbilityTarget } from "./ui/targeting";
import { plannedBuildResult } from "./ui/placement";
import {
  createGame,
  stepGame,
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
  validateMap,
  getUnitCost,
  projectPendingCommands,
} from "./sim";
import type {
  GameState,
  GameSettings,
  GameCommand,
  Entity,
  BuildingId,
  UnitId,
  TechId,
  ResourceNode,
  Point,
} from "./sim/types";
import { Battlefield } from "./render/Battlefield";
import { AudioDirector } from "./platform/audio";
import {
  loadRecord,
  saveRecord,
  removeRecord,
  readLocal,
  writeLocal,
  defaultPreferences,
  defaultProfile,
} from "./platform/storage";
import { setupPWA } from "./platform/pwa";
import { SaveQueue } from "./platform/save-queue";
import { escapeText as esc } from "./ui/escape";
import {
  MAX_MAP_JSON_BYTES,
  parseBoundedJSON,
  validateMapStructure,
} from "./sim/validation";
import { CAMPAIGN, CAMPAIGNS, ACHIEVEMENTS } from "./ui/content";
import { icon, unitIcons } from "./ui/icons";

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `<canvas id="world" aria-label="Isometric battlefield"></canvas><div id="screen"></div><div id="modal-root"></div><div id="toast" role="status" aria-live="polite"></div><div id="update"></div>`;
const canvas = document.querySelector<HTMLCanvasElement>("#world")!,
  screen = document.querySelector<HTMLDivElement>("#screen")!,
  modal = document.querySelector<HTMLDivElement>("#modal-root")!;
const renderer = new Battlefield(canvas),
  audio = new AudioDirector();
let preferences = readLocal("preferences", defaultPreferences),
  profile = readLocal("profile", defaultProfile);
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
  expeditionStage: number | null = null,
  tutorialStep = 0,
  uiAction = "move";
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
  mapGenerationVersion: 4,
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
let learningProgress: LearningProgress | null = null,
  guideCollapsed = false,
  learningCompletionShown = false;
let tutorialOrigin: Point | null = null;
let previousFocus: HTMLElement | null = null;
let frameRate = 60;
let runtimeFailed = false;
let lastDeckSignature = "";
let planningSignature = "",
  planningSnapshot: GameState | null = null;
function planningState() {
  if (!state.paused || !state.pendingCommands.length) return state;
  const signature = `${state.tick}:${state.pendingCommands.length}:${state.nextId}`;
  if (signature !== planningSignature || !planningSnapshot) {
    planningSnapshot = projectPendingCommands(state);
    planningSignature = signature;
  }
  return planningSnapshot;
}
const hudHTML = new Map<string, string>();
let playfieldCenterY = innerHeight / 2;
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
function toast(text: string, tone = "") {
  const el = document.querySelector<HTMLDivElement>("#toast")!;
  el.textContent = text;
  el.className = `show ${tone}`;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (el.className = ""), 3500);
}
function commander() {
  return state.entities.find(
    (e) => e.team === 0 && e.kind === "commander" && e.hp > 0,
  );
}
function cost(c: { gold: number; wood: number }) {
  return `<span class="cost">${c.gold ? `<span>${icon("gold")}${c.gold}</span>` : ""}${c.wood ? `<span>${icon("wood")}${c.wood}</span>` : ""}</span>`;
}
function affordable(c: { gold: number; wood: number }) {
  const player = planningState().players[0];
  return player.gold >= c.gold && player.wood >= c.wood;
}
function showMenu(page = "home") {
  playing = false;
  menuPage = page;
  modalOpen = false;
  modal.innerHTML = "";
  placement = null;
  audio.stop();
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
    screen.innerHTML = `<div class="menu-scrim"></div><main class="home"><div class="brandmark">${icon("crown")}<span>A WORLD WORTH FIGHTING FOR</span></div><h1>FRONTIER<br><em>COMMAND</em></h1><p class="home-lede">Build your stronghold. Lead from the front.<br>Turn one small army into a legend.</p><div class="home-actions">${button(preferences.learningComplete ? "Practice the basics" : "Learn to command · start here", "learn", preferences.learningComplete ? "secondary" : "primary large", "book")}${button("Play skirmish", "skirmish", "primary large", "sword")}${button("Rush Arena · 4 minute survival", "rush", "secondary rush-entry", "lightning")}${savedGame ? button("Continue battle", "continue", "secondary", "play") : ""}${button("Rise of the Frontier", "campaign", "secondary", "flag")}${button("Frontier expedition", "expedition", "secondary", "map")}</div><div class="home-links">${button("How to play", "help", "", "book")}${button("Map workshop", "editor", "", "map")}${button("Command record", "record", "", "star")}${button("Settings", "settings", "", "gear")}</div><footer><span class="offline-dot"></span> <span id="offline-status">${navigator.serviceWorker?.controller ? "Offline ready" : "Offline after first full load"}</span> · Solo strategy <span class="version">v0.1 · Testing preview</span></footer></main><aside class="home-aside"><div class="vertical-rule"></div><span>YOUR BANNER.<br>YOUR FRONTIER.</span></aside>`;
  } else if (page === "skirmish") renderSetup();
  else if (page === "campaign") renderCampaign();
  else if (page === "expedition") renderExpedition();
  else if (page === "record") renderRecord();
  else if (page === "editor") renderEditorMenu();
}
function pageHeader(eyebrow: string, title: string, description: string) {
  return `<header class="page-header">${button("Back", "home", "back", "back")}<span class="eyebrow">${esc(eyebrow)}</span><h1>${esc(title)}</h1><p>${esc(description)}</p></header>`;
}
function optionSelect(
  label: string,
  key: string,
  values: string[],
  labels?: string[],
) {
  if (
    key === "duration" &&
    settings.duration &&
    !values.includes(String(settings.duration))
  ) {
    values = [String(settings.duration), ...values];
    labels = [`${settings.duration} min · shared map`, ...(labels || [])];
  }
  return `<label class="field"><span>${label}</span><select name="${key}">${values.map((v, i) => `<option value="${v}" ${String((settings as any)[key]) === v ? "selected" : ""}>${labels?.[i] || v[0].toUpperCase() + v.slice(1)}</option>`).join("")}</select></label>`;
}
function renderSetup() {
  screen.innerHTML = `<div class="menu-scrim solid"></div><main class="setup-page">${pageHeader("SKIRMISH", "Choose your frontier", "Every seed is a new battlefield. Every decision leaves a mark.")}<form id="setup-form"><section class="setup-section"><div class="section-label"><b>01</b> Your commander</div><div class="commander-grid">${Object.values(
    COMMANDERS,
  )
    .map(
      (c) =>
        `<button type="button" data-action="choose-commander" data-id="${esc(c.id)}" class="commander-card ${settings.commander === c.id ? "chosen" : ""}"><div class="commander-portrait ${esc(c.id)}"><canvas class="portrait-canvas" data-portrait="${esc(c.id)}" width="220" height="180" aria-hidden="true"></canvas></div><span class="tag">${c.id === "warlord" ? "HOLD THE LINE" : c.id === "ranger" ? "STRIKE & VANISH" : "BUILD TO LAST"}</span><h3>${c.name}</h3><p>${esc(c.description)}</p><span class="chosen-check">${icon("check")}</span></button>`,
    )
    .join(
      "",
    )}</div></section><section class="setup-section"><div class="section-label"><b>02</b> The battlefield</div><div class="field-grid">${optionSelect(
    "Faction",
    "faction",
    Object.keys(FACTIONS),
    Object.values(FACTIONS).map((f) => f.name),
  )}${optionSelect(
    "Biome",
    "biome",
    Object.keys(BIOMES),
    Object.values(BIOMES).map((b) => b.name),
  )}${optionSelect("Match length", "duration", ["8", "18", "25", "40"], ["Quick · 8–12 min", "Standard · 15–20 min", "Long · 20–30 min", "Epic · 35–50 min"])}${optionSelect("Map size", "mapSize", ["tiny", "small", "medium", "large", "huge"])}${optionSelect("Enemy skill", "difficulty", ["easy", "normal", "hard", "brutal"])}${optionSelect("Victory", "mode", ["domination", "conquest", "relic"], ["Domination · territory & score", "Conquest · destroy every keep", "Relic race · hold the center"])}</div><details class="advanced"><summary>Advanced battlefield settings</summary><div class="field-grid">${optionSelect("Rivals", "aiPlayers", ["1", "2", "3", "4", "5"])}${optionSelect("Map generation", "preset", ["balanced", "competitive", "wild", "chaotic"])}${optionSelect("AI personality", "aiPersonality", ["adaptive", "aggressive", "defensive", "economic", "raider", "expansionist"])}${optionSelect("Army ceiling", "populationCap", ["40", "60", "80", "120"])}${optionSelect("Map generator", "mapGenerationVersion", ["4", "3"], ["v4 · mirrored reserves", "v3 · legacy maps"])}</div></details><label class="field seed-field"><span>Map seed or map code <small>Same code. Same frontier.</small></span><div><input name="seed" maxlength="2000" value="${esc(settings.seed)}" aria-label="Map seed">${button("New seed", "new-seed", "square", "spark", 'type="button"')}</div></label></section><div class="launch-bar"><p>${icon("book")} New commander? Start the campaign for a gentler first battle.</p>${button("To the frontier", "launch", "primary large", "arrow", 'type="submit"')}</div></form></main>`;
  screen
    .querySelectorAll<HTMLCanvasElement>("[data-portrait]")
    .forEach((c) => void renderer.renderPortrait(c, c.dataset.portrait as any));
}
function currentChapter() {
  return (
    profile.campaignProgress[activeCampaign.id] ??
    (activeCampaign.id === CAMPAIGN.id ? profile.campaign : 0)
  );
}
function renderCampaign(opened = false) {
  if (CAMPAIGNS.length > 1 && !opened) {
    screen.innerHTML = `<div class="menu-scrim solid"></div><main class="content-page">${pageHeader("STORY CAMPAIGNS", "Chronicles of the frontier", "Choose a story. Each campaign keeps its own progress.")}<div class="mission-list">${CAMPAIGNS.map((c) => `<button class="mission-card" data-action="choose-campaign" data-id="${esc(c.id)}"><span class="mission-number">${icon("book")}</span><div><h2>${esc(c.title)}</h2><p>${esc(c.description)}</p><span class="mission-meta">${c.missions.length} chapters</span></div>${icon("arrow")}</button>`).join("")}</div></main>`;
    return;
  }
  const progress = currentChapter();
  screen.innerHTML = `<div class="menu-scrim solid"></div><main class="content-page">${pageHeader("STORY CAMPAIGN", activeCampaign.title, activeCampaign.description)}<div class="mission-list">${activeCampaign.missions.map((m, i) => `<button class="mission-card ${i <= progress ? "available" : "locked"}" data-action="mission" data-id="${i}" ${i > progress ? "disabled" : ""}><span class="mission-number">${i < progress ? icon("check") : String(i + 1).padStart(2, "0")}</span><div><span class="eyebrow">${esc(m.subtitle)}</span><h2>${esc(m.title)}</h2><p>${esc(m.briefing)}</p><span class="mission-meta">${esc(m.settings.biome)} · ${esc(m.settings.duration)} min · ${i < progress ? "Completed" : i === progress ? "Next chapter" : "Locked"}</span></div>${icon("arrow")}</button>`).join("")}</div></main>`;
}
function renderExpedition() {
  screen.innerHTML = `<div class="menu-scrim solid"></div><main class="content-page">${pageHeader("ROGUELITE RUN", "Beyond the map", "Three frontiers. Choose your route. Each victory strengthens the next army.")}<div class="expedition-intro">${icon("map")}<h2>A fresh road, every time.</h2><p>Win three increasingly difficult battles. Between them, choose a new landscape and earn an enduring supply bonus. A defeat ends the run.</p><div class="route-line"><span>01<br>Foothold</span><i></i><span>02<br>Crossroads</span><i></i><span>03<br>Last Stand</span></div>${button("Begin expedition", "start-expedition", "primary large", "arrow")}</div></main>`;
}
function renderRecord() {
  screen.innerHTML = `<div class="menu-scrim solid"></div><main class="content-page">${pageHeader("COMMAND RECORD", "Your legacy", "Small victories become great stories.")}<div class="record-stats"><div><b>${profile.wins}</b><span>Victories</span></div><div><b>${profile.games}</b><span>Battles</span></div><div><b>${profile.kills}</b><span>Enemies defeated</span></div><div><b>${profile.bestStreak}</b><span>Best streak</span></div></div><h2 class="section-title">Achievements <small>${profile.unlocked.length} / ${ACHIEVEMENTS.length}</small></h2><div class="achievement-grid">${ACHIEVEMENTS.map((a) => `<article class="achievement ${profile.unlocked.includes(a.id) ? "unlocked" : ""}">${icon(profile.unlocked.includes(a.id) ? "star" : "shield")}<div><h3>${a.name}</h3><p>${a.description}</p></div></article>`).join("")}</div></main>`;
}
function launchGame(
  options: Partial<GameSettings> = settings,
  mission: number | null = null,
  expedition: number | null = null,
) {
  state = createGame({ ...settings, ...options });
  planningSnapshot = null;
  planningSignature = "";
  deckCollapsed = true;
  recruitBatch = 1;
  learningProgress = state.settings.learning
    ? restoreLearning(state, null)
    : null;
  learningCompletionShown = false;
  guideCollapsed = false;
  missionIndex = mission;
  expeditionStage = expedition;
  if (mission !== null) {
    state.triggers = structuredClone(activeCampaign.missions[mission].triggers);
    state.objectiveText = activeCampaign.missions[mission].briefing;
  }
  playing = true;
  document.body.classList.toggle("rush-mode", !!state.rush);
  resultShown = false;
  lastEvent = 0;
  selection.clear();
  if (commander()) {
    selection.add(commander()!.id);
    tutorialOrigin = { x: commander()!.x, y: commander()!.y };
  }
  followCommander = true;
  placement = null;
  targetPoint = null;
  panel = "army";
  speed = 1;
  tutorialStep = 0;
  document.body.classList.add("in-game");
  audio.start();
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
  else if (
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
  hudHTML.clear();
  screen.innerHTML = `<header class="hud"><button class="brand-button" data-action="pause-menu" aria-label="Battle menu">${icon("crown")}</button><div class="resources"><button data-action="economy" title="Gold and income sources" aria-label="Gold and income sources">${icon("gold")}<b id="gold">0</b></button><button data-action="economy" title="Wood and income sources" aria-label="Wood and income sources">${icon("wood")}<b id="wood">0</b></button><button data-action="economy" title="Population and maximum capacity" aria-label="Population and maximum capacity">${icon("flag")}<b id="population">0</b></button></div><div class="hud-time" id="match-time">0:00</div><button class="pause-button" data-action="pause" aria-label="Tactical pause">${icon("pause")}</button></header><div class="objective-bar" id="objective"></div><div class="battle-hint" id="battle-hint"></div><div class="map-controls">${button("Focus commander", "focus", "square", "crosshair")}${button("Zoom in", "zoom-in", "square", "plus")}${button("Zoom out", "zoom-out", "square", "minus")}</div><div class="minimap-wrap"><button class="minimap-toggle" data-action="toggle-minimap" aria-label="Minimize minimap">Map −</button><canvas id="minimap" width="160" height="120" aria-label="Minimap: tap to move camera"></canvas><span id="map-seed"></span></div><div class="commander-strip" id="commander-strip"></div><div id="joystick" aria-label="Drag to move commander" role="application"><div class="joystick-ring"></div><div class="joystick-stick">${icon("crosshair")}</div></div><div class="ability-dock" id="abilities"></div><section class="command-deck"><div class="selection-row"><div class="selection-info" id="selection-info"></div><div class="selection-tools">${button("Minimize panel", "toggle-deck", "deck-toggle", "minus")}${button("Commander", "select-commander", "", "crown")}${button("Army", "select-army", "", "flag")}${button("Relic", "march-relic", "relic-command", "spark", 'aria-label="March to relic"')}${button("Hold", "hold", "", "hold")}</div></div><nav class="deck-tabs">${button("Details", "panel-inspect", "", "book")}${button("Recruit", "panel-army", "active", "sword")}${button("Build", "panel-build", "", "house")}${button("Research", "panel-research", "", "spark")}${button("Orders", "panel-orders", "", "flag")}</nav><div class="deck-content" id="deck-content"></div></section><div id="placement-controls"></div><div class="paused-ribbon" id="paused-ribbon"></div>`;
  measurePlayfield();
  renderDeck();
  updateHUD();
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
  return `<span class="sprite-icon" aria-hidden="true" style="width:${frame.w * scale}px;height:${frame.h * scale}px;background-image:url('${import.meta.env.BASE_URL}assets/render/frontier-atlas.png');background-size:${renderer.atlas.image!.naturalWidth * scale}px ${renderer.atlas.image!.naturalHeight * scale}px;background-position:${-frame.x * scale}px ${-frame.y * scale}px"></span>`;
}
function refreshDeckState() {
  if (!playing) return;
  const player = state.players[0];
  const signature = JSON.stringify([
    panel,
    placement,
    [...selection],
    recruitBatch,
    state.pendingCommands.length,
    renderer.atlas.ready,
    state.entities
      .filter((e) => e.team === 0 && e.kind === "building" && e.hp > 0)
      .map((e) => [
        e.id,
        e.type,
        e.buildProgress >= 1,
        e.buildingLevel,
        e.queue.map((q) => [q.type, q.id, q.queueId]),
      ]),
    Object.values(UNITS).map((u) => affordable(getUnitCost(state, 0, u.id))),
    Object.values(BUILDINGS).map((b) => affordable(b.cost)),
    Object.values(TECHNOLOGIES).map((t) => [
      affordable(technologyCost(state, 0, t.id)),
      player.research[t.id] || 0,
    ]),
  ]);
  if (signature !== lastDeckSignature) {
    lastDeckSignature = signature;
    renderDeck();
  }
}
function renderDeck() {
  if (!playing) return;
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
  const active = document.activeElement as HTMLElement;
  const focused = el.contains(active)
    ? { action: active.dataset.action, id: active.dataset.id }
    : null;
  if (state.rush) {
    el.innerHTML = `<div id="rush-status"></div>`;
    return;
  }
  if (panel === "inspect")
    el.innerHTML = inspectionHTML(planningState(), selection);
  else if (panel === "army")
    el.innerHTML = `<div class="recruit-controls"><span>Queue at a time</span>${[1, 3, 5].map((n) => button(String(n), "recruit-batch", recruitBatch === n ? "active" : "", undefined, `data-id="${n}" aria-label="Queue ${n} at a time"`)).join("")}<small>Tap a troop to add ${recruitBatch} to production.</small></div><div class="action-cards">${Object.values(
      UNITS,
    )
      .map((u) => {
        const ready = state.entities.some(
          (e) =>
            e.team === 0 &&
            e.kind === "building" &&
            BUILDINGS[e.type as BuildingId]?.recruits.includes(u.id) &&
            e.buildProgress >= 1,
        );
        return `<button class="action-card ${!ready ? "unavailable" : ""} ${affordable(getUnitCost(state, 0, u.id)) ? "" : "funds-low"}" data-action="recruit" data-id="${u.id}" title="${esc(u.description)}" aria-label="Recruit ${u.name}"><span class="action-icon">${cardArt(u.id)}</span><strong>${u.name}</strong>${cost({ gold: getUnitCost(state, 0, u.id).gold * recruitBatch, wood: getUnitCost(state, 0, u.id).wood * recruitBatch })}<small>${ready ? `${Math.round(u.trainTime * (state.players[0].research.logistics ? 0.85 : 1))}s · ${u.population} pop` : `Needs ${BUILDINGS[u.building].name}`}</small><small class="unit-counter">${{ swordsman: "Frontline", spearman: "Counters cavalry", archer: "Counters infantry", cavalry: "Counters archers", siege: "Breaks buildings", support: "Heals your army" }[u.id]}</small></button>`;
      })
      .join("")}</div>`;
  else if (panel === "build")
    el.innerHTML = `<div class="action-cards">${Object.values(BUILDINGS)
      .filter((b) => b.id !== "keep")
      .map(
        (b) =>
          `<button class="action-card ${placement === b.id ? "selected" : ""}" data-action="build" data-id="${b.id}" title="${esc(b.description)}" aria-label="Build ${b.name}"><span class="action-icon">${cardArt(b.id)}</span><strong>${b.name}</strong>${cost(b.cost)}<small>${b.buildTime}s · ${b.population ? `+${b.population} pop` : b.description.split(".")[0]}</small></button>`,
      )
      .join("")}</div>`;
  else if (panel === "research")
    el.innerHTML = `<div class="action-cards">${Object.values(TECHNOLOGIES)
      .map(
        (t) =>
          `<button class="action-card ${(state.players[0].research[t.id] || 0) >= t.maxLevel ? "completed" : ""}" data-action="research" data-id="${t.id}" title="${esc(t.description)}"><span class="action-icon">${icon("spark")}</span><strong>${t.name}</strong>${cost(technologyCost(state, 0, t.id))}<small>${state.players[0].research[t.id] || 0} / ${t.maxLevel} · ${t.description}</small></button>`,
      )
      .join("")}</div>`;
  else
    el.innerHTML = `<div class="order-cards">${button("Move", "order-move", uiAction === "move" ? "chosen" : "", "arrow")}${button("Attack-move", "order-attackMove", uiAction === "attackMove" ? "chosen" : "", "sword")}${button("Rally at commander", "rally-all", "", "flag")}${button("Save battle", "save", "", "save")}${button(`${speed}× speed`, "speed", "", "clock")}</div><p class="deck-tip">Tap a friendly to select. Tap ground to command. Drag the map to look around.</p>`;
  el.insertAdjacentHTML("beforeend", `<div id="production-strip"></div>`);
  hudHTML.delete("production-strip");
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
    toggle.innerHTML = icon(deckCollapsed ? "plus" : "minus");
    toggle.setAttribute("aria-expanded", String(!deckCollapsed));
  }
  document
    .querySelector(".minimap-wrap")
    ?.classList.toggle("collapsed", minimapCollapsed);
  measurePlayfield();
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
    );
  updateHUD();
  return true;
}
function updateHUD() {
  if (!playing) return;
  refreshDeckState();
  const p = planningState().players[0],
    c = commander();
  const set = (id: string, html: string) => {
    const el = document.querySelector(`#${id}`);
    if (el && hudHTML.get(id) !== html) {
      el.innerHTML = html;
      hudHTML.set(id, html);
    }
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
      : `${p.population}<small>/${p.populationCap} · max ${p.maxPopulation}</small>`,
  );
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
  const enemy = state.players.filter((pl) => pl.team !== 0 && !pl.defeated);
  const maxScore = Math.max(1, state.scoreTarget);
  const control = relicSummary(state);
  if (!state.rush)
    set(
      "objective",
      `<span title="${esc(state.objectiveText)}">${icon(state.settings.mode === "conquest" ? "sword" : "spark")} <span class="objective-description">${missionIndex !== null ? esc(state.objectiveText) : state.settings.mode === "conquest" ? "Destroy the enemy keeps" : "Relics earn victory points"}</span><small class="objective-income">${control.owned} / ${control.total} relics controlled · ${state.settings.mode === "conquest" ? "Relics fund your siege" : `+${control.pointsPerSecond.toFixed(1)} points / sec`}</small></span><div class="score-track"><i style="width:${Math.min(100, (p.score / maxScore) * 100)}%"></i><b>${state.settings.mode === "conquest" ? `${enemy.length} enemy keep${enemy.length === 1 ? "" : "s"} remain` : `YOU ${Math.floor(p.score)} / ${maxScore}`}</b>${state.settings.mode === "conquest" ? "" : `<em>RIVAL ${Math.floor(Math.max(...enemy.map((e) => e.score), 0))}</em>`}</div>`,
    );
  const relicControl = document.querySelector<HTMLButtonElement>(
    '[data-action="march-relic"]',
  );
  if (relicControl) {
    relicControl.hidden = !!state.rush || !!placement;
    relicControl.title = "Send your army toward the nearest unclaimed relic.";
  }
  const chosen = state.entities.filter((e) => selection.has(e.id) && e.hp > 0);
  set(
    "selection-info",
    `${icon(chosen.length === 1 ? unitIcons[chosen[0].type] : "flag")}<div><strong>${placement ? `Place ${BUILDINGS[placement].name}` : chosen.length === 1 ? (UNITS as any)[chosen[0].type]?.name || (BUILDINGS as any)[chosen[0].type]?.name || (COMMANDERS as any)[chosen[0].type]?.name || "Commander" : `${chosen.length} units selected`}</strong><small>${placement ? "Tap open ground near your frontier" : chosen.length === 1 ? `${Math.ceil(chosen[0].hp)} / ${Math.ceil(chosen[0].maxHp)} health${chosen[0].queue.length ? ` · ${chosen[0].queue.length} queued` : ""}` : "Tap the battlefield to give an order"}</small></div>${placement ? button("Cancel", "cancel-build", "cancel", "close") : ""}`,
  );
  const site =
    placement && targetPoint
      ? plannedBuildResult(state, 0, placement, targetPoint.x, targetPoint.y)
      : null;
  set(
    "placement-controls",
    placement
      ? `<div class="placement-toolbar"><div><b>Place ${BUILDINGS[placement].name}</b><small>${site?.ok ? "Ready. Confirm to start construction." : (site?.error ?? "Tap ground or drag the preview. Pinch to move the map.")}</small></div><div>${button("Cancel", "cancel-build", "", "close")}${button(repeatPlacement ? "Repeat on" : "Repeat off", "repeat-placement", repeatPlacement ? "active" : "")}${button("Build here", "confirm-placement", "primary", "check", site?.ok ? "" : "disabled")}</div></div>`
      : "",
  );
  document.body.classList.toggle("placing-building", !!placement);
  set(
    "commander-strip",
    c
      ? `<button data-action="focus" aria-label="Focus commander">${icon(unitIcons[c.type])}<span><b>${COMMANDERS[state.settings.commander].name}</b><i><em style="width:${(c.hp / c.maxHp) * 100}%"></em></i></span><small>${Math.ceil(c.hp)}</small></button>`
      : `<span class="respawning">Commander recovering at the keep…</span>`,
  );
  updateAbilities(c);
  const pause = document.querySelector(".pause-button");
  if (pause) {
    if (
      pause.getAttribute("aria-label") !==
      (state.paused ? "Resume battle" : "Tactical pause")
    )
      pause.innerHTML = icon(state.paused ? "play" : "pause");
    pause.setAttribute(
      "aria-label",
      state.paused ? "Resume battle" : "Tactical pause",
    );
    pause.classList.toggle("active", state.paused);
  }
  set(
    "paused-ribbon",
    state.paused
      ? `${icon("pause")} TACTICAL PAUSE <span>Plan your next move. ${state.pendingCommands.length} orders queued.</span>${button("Resume", "pause", "", "play")}`
      : "",
  );
  document
    .querySelector("#paused-ribbon")
    ?.classList.toggle("visible", state.paused);
  if (state.rush) {
    const rush = state.rush;
    set(
      "objective",
      `<span>${icon("lightning")} RUSH ARENA · SURVIVE THE RIFT</span><div class="score-track"><i style="width:${Math.min(100, (state.time / rush.surviveUntil) * 100)}%"></i><b>${time(Math.max(0, rush.surviveUntil - state.time))} remaining</b><em>Wave ${rush.wave}</em></div>`,
    );
    set(
      "rush-status",
      `<div class="rush-metrics"><span><b>${rush.wave}</b> wave</span><span><b>${rush.kills}</b> defeated</span><span><b>${Math.ceil(Math.max(0, rush.nextWaveAt - state.time))}s</b> next wave</span>${rush.upgradeAvailable ? button("Choose an upgrade", "rush-upgrade", "primary", "spark") : `<small>Next upgrade in ${Math.ceil(Math.max(0, rush.nextUpgradeAt - state.time))}s</small>`}</div><p class="deck-tip">Stay inside the ward. Dodge marked strikes. Collect glowing supplies.</p>`,
    );
  }
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
}
function updateAbilities(c: Entity | undefined) {
  const dock = document.querySelector<HTMLElement>("#abilities");
  if (!dock) return;
  const definitions = COMMANDERS[state.settings.commander].abilities;
  if (dock.dataset.commander !== state.settings.commander) {
    dock.innerHTML = definitions
      .map(
        (ability, index) =>
          `<button class="ability" data-action="ability" data-id="${ability.id}" aria-label="${ability.name}" title="${esc(ability.description)}">${icon(index === 0 ? "lightning" : state.settings.commander === "engineer" ? "gear" : "flag")}<b>${ability.name}</b><kbd>${index === 0 ? "Q" : "E"}</kbd></button>`,
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
    const text = queued
      ? "Queued"
      : remaining > 0
        ? String(Math.ceil(remaining))
        : ability.name;
    const label = control.querySelector("b")!;
    if (label.textContent !== text) label.textContent = text;
  }
}
function showFirstBriefing() {
  preferences.tutorialSeen = true;
  writeLocal("preferences", preferences);
  showDialog(
    "Your first frontier",
    `<span class="eyebrow">THE BATTLE WAITS WHILE YOU GET YOUR BEARINGS</span><div class="help-grid"><article>${icon("flag")}<h3>Lead together</h3><p>Select Army, then tap open ground to move your commander and soldiers. Idle troops guard their position.</p></article><article>${icon("gold")}<h3>Claim and grow</h3><p>Capture gold and timber for steady income. Recruit soldiers, then claim a relic. Build Houses for more troops and Watchtowers to defend your base.</p></article><article>${icon("spark")}<h3>Take the center</h3><p>Relics earn victory points; gold and wood fund your army. The gold Relic button sends your army toward an objective. Use both abilities in close fights.</p></article><article>${icon("pause")}<h3>Take your time</h3><p>${state.settings.difficulty === "easy" ? "Easy opponents spend the first minute consolidating their own side. " : ""}Use the pause button to plan orders${state.settings.difficulty === "hard" ? " (three tactical pauses on Hard)" : state.settings.difficulty === "brutal" ? " (tactical pause is disabled on Brutal)" : ""}.</p></article></div>${button("Start battle", "begin-briefing", "primary large", "play")}`,
    "wide",
  );
}
function updateTutorial() {
  const el = document.querySelector("#battle-hint");
  if (!el) return;
  if (state.settings.learning && learningProgress) {
    learningProgress = advanceLearning(state, learningProgress);
    if (learningProgress.step >= LESSONS.length) {
      el.innerHTML = "";
      if (!learningCompletionShown) {
        learningCompletionShown = true;
        preferences.learningComplete = true;
        writeLocal("preferences", preferences);
        showDialog(
          "Your settlement is ready",
          `<p class="story">You captured gold and timber, trained an army, built and upgraded a house, and claimed a relic.</p><p>In a real battle, defend your deposits and keep while growing toward the map’s objectives. Pause whenever you need time to plan. Building Details and the resource bar always explain your options.</p>${button("Play The Outpost", "learning-campaign", "primary large", "flag")}${button("Keep practicing", "close-dialog", "", "play")}${button("Main menu", "save-leave", "", "back")}`,
        );
      }
      return;
    }
    const lesson = LESSONS[learningProgress.step];
    const html = `<button data-action="toggle-guide" aria-label="${guideCollapsed ? "Expand guide" : "Minimize guide"}">${icon(guideCollapsed ? "plus" : "minus")}</button><span>LEARN TO COMMAND · ${learningProgress.step + 1}/${LESSONS.length}</span><b>${lesson.title}</b>${guideCollapsed ? "" : `<p>${lesson.text}</p>${button(lesson.action, "learning-help", "lesson-action", "crosshair")}`}`;
    el.classList.add("learning-guide");
    if (hudHTML.get("battle-hint") !== html) {
      el.innerHTML = html;
      hudHTML.set("battle-hint", html);
    }
    return;
  }
  el.classList.remove("learning-guide");
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
      el.innerHTML = warning;
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
      el.innerHTML = warning;
      hudHTML.set("battle-hint", warning);
    }
    return;
  }
  if (state.rush || !preferences.showTips || state.time > 200) {
    el.innerHTML = "";
    hudHTML.delete("battle-hint");
    return;
  }
  if (tutorialOrigin)
    tutorialStep = advanceTutorial(state, {
      step: tutorialStep,
      origin: tutorialOrigin,
    }).step;
  const tips = [
    [
      "Step into the frontier",
      "Tap open ground to move. Your commander fights nearby enemies automatically.",
    ],
    [
      "Claim fresh supplies",
      "Capture gold and timber. Each held deposit keeps paying until it runs out.",
    ],
    [
      "Raise your army",
      "Tap Recruit below, then Swordsman. New soldiers join your commander.",
    ],
    [
      "Take the center",
      "Hold relics to score. Keep recruiting, capture fresh gold, and protect your keep.",
    ],
  ];
  const tipHTML = `<button data-action="dismiss-tips" aria-label="Dismiss tips">${icon("close")}</button><span>COMMANDER’S FIELD GUIDE · ${tutorialStep + 1}/4</span><b>${tips[tutorialStep][0]}</b><p>${tips[tutorialStep][1]}</p>`;
  if (hudHTML.get("battle-hint") !== tipHTML) {
    el.innerHTML = tipHTML;
    hudHTML.set("battle-hint", tipHTML);
  }
}
function showDialog(title: string, body: string, cls = "") {
  if (playing && commander()?.directControl)
    issueCommand(state, { type: "steer", team: 0, dx: 0, dy: 0 });
  keys.clear();
  joystickVector = { x: 0, y: 0 };
  if (!modalOpen) previousFocus = document.activeElement as HTMLElement;
  modalOpen = true;
  modal.innerHTML = `<div class="modal-backdrop"><section class="dialog ${cls}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><header><h2>${esc(title)}</h2>${button("Close", "close-dialog", "square", "close", 'aria-label="Close dialog"')}</header>${body}</section></div>`;
  modal.querySelector<HTMLButtonElement>("button")?.focus();
}
function closeDialog() {
  modalOpen = false;
  modal.innerHTML = "";
  if (previousFocus?.isConnected) previousFocus.focus();
}
function showBriefing(index: number) {
  const m = activeCampaign.missions[index];
  showDialog(
    m.title,
    `<span class="eyebrow">${esc(m.subtitle)}</span><p class="story">${esc(m.story)}</p><div class="briefing-objective">${icon("flag")}<p>${esc(m.briefing)}</p></div>${button("Raise the banner", "begin-mission", "primary large", "arrow")}`,
  );
}
function showHelp() {
  showDialog(
    "Command the frontier",
    `<div class="help-grid"><article>${icon("crosshair")}<h3>Lead from the front</h3><p>Tap ground to move your commander. Drag the lower-left thumbstick on phones. On desktop, use WASD or arrow keys.</p></article><article>${icon("gold")}<h3>Claim your economy</h3><p>Stand near gold and timber to capture them. Held deposits generate resources until depleted. Enemy troops can contest them.</p></article><article>${icon("flag")}<h3>Build a fighting force</h3><p>Recruit troops from your keep and military buildings. Houses raise your population cap. Spearmen beat cavalry; cavalry hunt archers; siege breaks walls.</p></article><article>${icon("spark")}<h3>Turn the tide</h3><p>Hold relics to gain victory points. In Conquest, relics instead fund your siege; destroy every enemy keep to win. Commander abilities Q and E can win a close fight.</p></article><article>${icon("pause")}<h3>Take a breath</h3><p>Tactical pause freezes the fight. Queue movement, recruitment, and construction, then resume. Space pauses; Escape opens the menu.</p></article><article>${icon("save")}<h3>Make it yours</h3><p>Battles autosave every 30 seconds and when leaving the app. Load once online to play offline after the cache installs.</p></article></div>${button("Ready to lead", "close-dialog", "primary", "check")}`,
    "wide",
  );
}
function showSettings() {
  showDialog(
    "Settings",
    `<div class="settings-fields"><label>Interface text size <select id="ui-scale" aria-label="Interface text size"><option value="1" ${preferences.uiScale === 1 ? "selected" : ""}>Standard</option><option value="1.15" ${preferences.uiScale === 1.15 ? "selected" : ""}>Larger · 115%</option><option value="1.3" ${preferences.uiScale === 1.3 ? "selected" : ""}>Largest · 130%</option></select></label><label>Master volume <output id="master-value">${Math.round(preferences.master * 100)}%</output><input id="master-slider" aria-label="Master volume" type="range" min="0" max="1" step=".05" value="${preferences.master}"></label><label class="check-field"><input id="mute-audio" type="checkbox" ${preferences.muted ? "checked" : ""}> Mute all audio</label><label>Music <output id="music-value">${Math.round(preferences.music * 100)}%</output><input id="music-slider" aria-label="Music" type="range" min="0" max="1" step=".05" value="${preferences.music}"></label><label>Sound effects <output id="sfx-value">${Math.round(preferences.sfx * 100)}%</output><input id="sfx-slider" aria-label="Sound effects" type="range" min="0" max="1" step=".05" value="${preferences.sfx}"></label><label class="check-field"><input id="reduced-motion" type="checkbox" ${preferences.reducedMotion ? "checked" : ""}> Reduced motion and effects</label><label class="check-field"><input id="show-tips" type="checkbox" ${preferences.showTips ? "checked" : ""}> Commander’s field guide</label><p class="muted">Teams use blue circles and coral diamonds, as well as banners. Music and effects work offline. The soundtrack can be replaced later through the repository’s audio manifest; see docs/AUDIO_REPLACEMENT.md for file names and loop settings.</p></div>${button("Done", "close-dialog", "primary", "check")}`,
  );
}
function showPauseMenu() {
  showDialog(
    "Take a breath",
    `<p class="muted">The battle is paused. Your frontier will wait.</p><p class="mission-goal">${icon("flag")} ${esc(state.objectiveText)}</p><div class="menu-stack">${button("Return to battle", "resume-dialog", "primary", "play")}${button("Save battle", "save", "", "save")}${button("Copy map code", "copy-map-code", "", "map")}${button("How to play", "help", "", "book")}${button("Settings", "settings", "", "gear")}${button("Save & leave", "save-leave", "", "back")}</div>`,
  );
  updateHUD();
}
async function persist(): Promise<boolean> {
  if (!playing || state.winner !== null || state.players[0].defeated)
    return true;
  // Capture now, even if a startup/autosave transaction is still in flight.
  const record = {
    version: 1,
    game: serializeGame(state),
    tutorial: tutorialOrigin
      ? advanceTutorial(state, { step: tutorialStep, origin: tutorialOrigin })
      : undefined,
    learningProgress,
    missionIndex,
    campaignId: activeCampaign.id,
    expeditionStage,
    savedAt: Date.now(),
  };
  return battleSaves.run(async () => {
    try {
      await saveRecord("battle", record);
      savedGame = record;
      return true;
    } catch {
      toast("Could not save. Your browser storage may be full.", "warning");
      return false;
    }
  });
}
async function continueGame() {
  await battleSaves.idle();
  const record: any = await loadRecord("battle");
  if (!record) return toast("No saved battle yet.");
  try {
    state = restoreGame(record.game);
    planningSnapshot = null;
    planningSignature = "";
    deckCollapsed = true;
    if (state.winner !== null || state.players[0].defeated) {
      await removeRecord("battle");
      savedGame = null;
      showMenu();
      toast("That battle has already finished. Start a new frontier.");
      return;
    }
    activeCampaign =
      CAMPAIGNS.find((c) => c.id === record.campaignId) ?? CAMPAIGNS[0];
    missionIndex =
      Number.isInteger(record.missionIndex) &&
      record.missionIndex >= 0 &&
      record.missionIndex < activeCampaign.missions.length
        ? record.missionIndex
        : null;
    expeditionStage =
      Number.isInteger(record.expeditionStage) &&
      record.expeditionStage >= 0 &&
      record.expeditionStage <= 2
        ? record.expeditionStage
        : null;
    learningProgress = state.settings.learning
      ? restoreLearning(state, record.learningProgress)
      : null;
    learningCompletionShown = false;
    const tutorial = restoreTutorial(state, record.tutorial);
    tutorialStep = tutorial.step;
    tutorialOrigin = tutorial.origin;
    state.paused = true;
    playing = true;
    document.body.classList.toggle("rush-mode", !!state.rush);
    resultShown = false;
    lastEvent = state.nextEventId;
    selection = new Set(commander() ? [commander()!.id] : []);
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
    audio.start();
    toast("Battle restored. Resume when you’re ready.");
  } catch (error) {
    toast(
      "This save could not be loaded. Your record is still safe.",
      "warning",
    );
    console.error(error);
  }
}
function checkAchievements(win: boolean) {
  const p = state.players[0],
    s = p.stats;
  const earned: string[] = [];
  const test = (id: string, condition: boolean) => {
    if (condition && !profile.unlocked.includes(id)) {
      profile.unlocked.push(id);
      earned.push(id);
    }
  };
  test("first-victory", profile.wins >= 1);
  test("veteran", profile.games >= 5);
  test("conqueror", profile.wins >= 5);
  test("legend", profile.campaign >= CAMPAIGN.missions.length);
  test("streak", profile.streak >= 3);
  test("century", profile.kills >= 100);
  test("thousand", profile.kills >= 1000);
  test("hour", profile.seconds >= 3600);
  test("capture", s.captures > 0);
  test("builder", s.buildingsCreated >= 5);
  test("recruiter", s.unitsCreated >= 20);
  test("economist", s.goldCollected >= 2000);
  test("woodsman", s.woodCollected >= 2000);
  test("tactician", s.pauses > 0);
  test("siege", win && state.settings.mode === "conquest");
  for (const c of ["warlord", "ranger", "engineer"])
    test(c, win && state.settings.commander === c);
  test("hard", win && ["hard", "brutal"].includes(state.settings.difficulty));
  test("expedition", profile.expedition > 0);
  test("quick", win && state.time < 480);
  test("survivor", win && s.commanderDeaths === 0);
  return earned;
}
function showResult() {
  if (resultShown) return;
  resultShown = true;
  const win = state.winner === 0;
  profile.games++;
  profile.wins += win ? 1 : 0;
  profile.seconds += state.time;
  profile.kills += state.players[0].stats.kills;
  profile.streak = win ? profile.streak + 1 : 0;
  profile.bestStreak = Math.max(profile.bestStreak, profile.streak);
  if (win && missionIndex !== null) {
    profile.campaignProgress[activeCampaign.id] = Math.max(
      currentChapter(),
      missionIndex + 1,
    );
    if (activeCampaign.id === CAMPAIGN.id)
      profile.campaign = Math.max(profile.campaign, missionIndex + 1);
  }
  if (win && expeditionStage === 2) profile.expedition++;
  const earned = checkAchievements(win);
  writeLocal("profile", profile);
  void battleSaves.run(async () => {
    await removeRecord("battle");
    savedGame = null;
  });
  savedGame = null;
  audio.play(win ? "victory" : "defeat");
  showDialog(
    win ? "The frontier is yours." : "The banner will rise again.",
    `<div class="result-emblem ${win ? "win" : ""}">${icon(win ? "crown" : "shield")}</div><p class="result-reason">${esc(battleResultReason(state))}</p><div class="record-stats"><div><b>${time(state.time)}</b><span>Battle time</span></div><div><b>${state.players[0].stats.kills}</b><span>Enemies defeated</span></div><div><b>${state.players[0].stats.captures}</b><span>Points captured</span></div></div>${earned.length ? `<div class="new-achievements">${earned.map((id) => `<span>${icon("star")}${ACHIEVEMENTS.find((a) => a.id === id)?.name}</span>`).join("")}</div>` : ""}<div class="result-actions">${win && missionIndex !== null && missionIndex < activeCampaign.missions.length - 1 ? button("Next chapter", "next-mission", "primary", "arrow") : win && expeditionStage !== null && expeditionStage < 2 ? button("Choose your next frontier", "next-expedition", "primary", "arrow") : win ? button("Another frontier", "rematch", "primary", "arrow") : button(expeditionStage !== null ? "Start a new expedition" : "Try again", "retry", "primary", "play")}${button("Command record", "result-record", "", "star")}${button("Main menu", "result-home", "", "back")}</div>`,
    "result-dialog",
  );
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
      )}</div><p class="muted">Move to dodge the marked strikes. Your commander attacks nearby enemies automatically. Use both abilities often.</p>${button("Enter the arena", "launch-rush", "primary large", "lightning")}`,
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
function readSetup(): boolean {
  const form = document.querySelector<HTMLFormElement>("#setup-form");
  if (!form) return true;
  const values = Object.fromEntries(new FormData(form).entries());
  for (const key of [
    "duration",
    "aiPlayers",
    "populationCap",
    "mapGenerationVersion",
  ])
    if (values[key]) values[key] = Number(values[key]) as any;
  let imported: Partial<GameSettings> = {};
  try {
    if (/^FC\d+\|/.test(String(values.seed)))
      imported = decodeMapCode(String(values.seed));
    else if (String(values.seed).length > 80)
      throw Error(
        "Use a seed under 80 characters, or paste a complete map code.",
      );
  } catch (error) {
    toast(
      error instanceof Error ? error.message : "Invalid map code.",
      "warning",
    );
    return false;
  }
  settings = { ...settings, ...values, ...imported } as Partial<GameSettings>;
  return true;
}
// A deliberately small, real editor: generated maps are immediately paintable, validated, exportable, and playable.
let editing = false,
  editorBrush = "grass",
  editorMode: "paint" | "pan" = "paint",
  editorBrushSize = 1;
let editorHistory = new EditorHistory(),
  editorStrokeStart: GameState["map"] | null = null,
  editorLastPaint: Point | null = null;
function renderEditorMenu() {
  screen.innerHTML = `<div class="menu-scrim solid"></div><main class="content-page">${pageHeader("MAP WORKSHOP", "Make your frontier", "Start from a generated world. Paint terrain, move spawns, and place resources.")}<div class="expedition-intro">${icon("map")}<h2>A blank page is optional.</h2><p>Open a fresh seeded map, or return to your saved workshop. Export a JSON map to share it. Validation checks keep every spawn, supply, and objective reachable.</p><div class="menu-stack">${button("Create a map", "new-editor", "primary", "plus")}${button("Open saved map", "load-editor", "", "save")}<label class="file-button">${icon("map")} Import map JSON<input type="file" id="import-map" accept="application/json,.json"></label></div></div></main>`;
}
function openEditor(map?: GameState["map"]) {
  const next = createGame({
    seed: randomSeed(),
    mapSize: "tiny",
    ...(map ? { customMap: map } : {}),
  });
  if (map) next.map = map;
  editorHistory = new EditorHistory();
  editorStrokeStart = null;
  editorLastPaint = null;
  playing = false;
  editing = true;
  state = next;
  renderer.invalidateTerrain();
  renderer.centerOn(state.map.width / 2, state.map.height / 2);
  renderer.camera.zoom = innerWidth < 600 ? 0.55 : 0.75;
  document.body.classList.add("in-game");
  screen.innerHTML = `<header class="editor-header">${button("Workshop", "exit-editor", "back", "back")}<h2>Map workshop</h2>${button("Save", "save-map", "", "save")}${button("Test map", "test-map", "primary", "play")}</header><aside class="editor-tools"><span class="eyebrow">MAP TOOLS</span><div class="editor-mode-tools">${button("Paint", "editor-paint", editorMode === "paint" ? "active" : "", "map")}${button("Pan", "editor-pan", editorMode === "pan" ? "active" : "", "crosshair")}${button("Undo", "editor-undo", "", "back")}${button("Redo", "editor-redo", "", "arrow")}</div><label class="brush-size">Brush size <select id="brush-size" aria-label="Brush size"><option value="1">1 tile</option><option value="3">3 tiles</option><option value="5">5 tiles</option></select></label><div class="brushes">${["grass", "forest", "water", "rock", "sand", "snow", "road", "marsh", "gold", "wood", "relic", "spawn-0", "spawn-1", "erase"].map((b) => button(b.replace("-", " "), `brush-${b}`, b === editorBrush ? "active" : "", b === "gold" ? "gold" : b === "wood" ? "wood" : b === "relic" ? "spark" : "map")).join("")}</div><p id="editor-tool-help">Paint: press and drag to draw. Pan: drag to move the map. Two fingers always pan/zoom. Undo reverses one stroke.</p><div id="map-validation"></div>${button("Validate", "validate-map", "", "check")}${button("Export JSON", "export-map", "", "save")}</aside><div class="editor-bottom"><span>${state.map.width} × ${state.map.height} · ${esc(state.map.seed)}</span>${button("Regenerate", "regenerate-map", "", "spark")}</div>`;
  validateEditor();
}
async function validateEditor() {
  state.map.validation = validateMap(state.map, true);
  const e = document.querySelector("#map-validation");
  if (e)
    e.innerHTML = state.map.validation.valid
      ? `<p class="valid">${icon("check")} Playable · ${Math.round(state.map.validation.reachablePercent * 100)}% reachable</p>`
      : `<p class="invalid">${state.map.validation.errors.map(esc).join("<br>")}</p>`;
  return state.map.validation.valid;
}
function paintEditor(point: Point) {
  const x = Math.floor(point.x),
    y = Math.floor(point.y);
  if (x < 0 || y < 0 || x >= state.map.width || y >= state.map.height) return;
  if (editorBrush.startsWith("spawn-")) {
    state.map.spawns[Number(editorBrush.slice(-1))] = {
      x: x + 0.5,
      y: y + 0.5,
    };
    state.map.tiles[y * state.map.width + x] = "road";
  } else if (["gold", "wood", "relic"].includes(editorBrush)) {
    state.map.nodes = state.map.nodes.filter(
      (n) => Math.hypot(n.x - x - 0.5, n.y - y - 0.5) > 1,
    );
    const used = new Set(state.map.nodes.map((n) => n.id));
    let nodeId = `editor-${state.nextId++}`;
    while (used.has(nodeId)) nodeId = `editor-${state.nextId++}`;
    state.map.nodes.push({
      id: nodeId,
      kind: editorBrush as any,
      x: x + 0.5,
      y: y + 0.5,
      owner: null,
      captureTeam: null,
      captureProgress: 0,
      radius: 1.5,
      income: 3,
      amount: editorBrush === "relic" ? 0 : 1600,
      maxAmount: editorBrush === "relic" ? 0 : 1600,
    } as ResourceNode);
    state.map.tiles[y * state.map.width + x] = "grass";
  } else if (editorBrush === "erase") {
    state.map.nodes = state.map.nodes.filter(
      (n) => Math.hypot(n.x - x - 0.5, n.y - y - 0.5) > 1.5,
    );
    state.map.tiles[y * state.map.width + x] = "grass";
  } else state.map.tiles[y * state.map.width + x] = editorBrush as any;
  renderer.invalidateTerrain();
}
function paintEditorStroke(point: Point) {
  const tiles = strokeTiles(
    editorLastPaint ?? point,
    point,
    state.map.width,
    state.map.height,
  );
  for (const tile of tiles) {
    const radius = ["gold", "wood", "relic", "spawn-0", "spawn-1"].includes(
      editorBrush,
    )
      ? 0
      : Math.floor(editorBrushSize / 2);
    for (let y = -radius; y <= radius; y++)
      for (let x = -radius; x <= radius; x++)
        paintEditor({ x: tile.x + x, y: tile.y + y });
  }
  editorLastPaint = point;
}
function finishEditorStroke() {
  if (editorStrokeStart) editorHistory.record(editorStrokeStart, state.map);
  editorStrokeStart = null;
  editorLastPaint = null;
  void validateEditor();
}
function downloadMap() {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(state.map, null, 2)], {
      type: "application/json",
    }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `frontier-${state.map.seed.replace(/[^a-z0-9-]/gi, "-")}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function handleAction(action: string, id?: string) {
  audio.unlock();
  if (action.startsWith("panel-")) {
    panel = action.slice(6);
    deckCollapsed = false;
    renderDeck();
    return;
  }
  if (action.startsWith("brush-")) {
    editorBrush = action.slice(6);
    editorMode = "paint";
    screen
      .querySelectorAll(".editor-mode-tools button")
      .forEach((b) =>
        b.classList.toggle(
          "active",
          b.getAttribute("data-action") === "editor-paint",
        ),
      );
    screen
      .querySelectorAll(".brushes button")
      .forEach((b) =>
        b.classList.toggle("active", b.getAttribute("data-action") === action),
      );
    return;
  }
  switch (action) {
    case "editor-paint":
    case "editor-pan":
      editorMode = action === "editor-paint" ? "paint" : "pan";
      screen
        .querySelectorAll(".editor-mode-tools button")
        .forEach((b) =>
          b.classList.toggle(
            "active",
            b.getAttribute("data-action") === action,
          ),
        );
      break;
    case "editor-undo":
    case "editor-redo": {
      const map =
        action === "editor-undo"
          ? editorHistory.undo(state.map)
          : editorHistory.redo(state.map);
      if (map) {
        state.map = map;
        renderer.invalidateTerrain();
        void validateEditor();
      } else
        toast(
          action === "editor-undo" ? "Nothing to undo." : "Nothing to redo.",
        );
      break;
    }
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
    case "learning-campaign":
      closeDialog();
      launchGame(activeCampaign.missions[0].settings, 0);
      break;
    case "learning-help": {
      if (!learningProgress) break;
      if (learningProgress.step === 4 || learningProgress.step === 5) {
        panel = learningProgress.step === 4 ? "army" : "build";
        deckCollapsed = false;
        renderDeck();
      } else {
        const target = learningTarget(state, learningProgress.step);
        if (target) {
          renderer.centerOn(target.x, target.y);
          followCommander = false;
          targetPoint = { x: target.x, y: target.y };
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
        );
        if (repeatPlacement)
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
        economyHTML(state) +
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
            n.owner !== 0 &&
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
      const b = state.entities.find(
        (e) => e.id === id && e.team === 0 && e.hp > 0,
      );
      if (b) {
        if (learningProgress && b.type === "keep")
          learningProgress.inspectedKeep = true;
        selection = new Set([b.id]);
        panel = "inspect";
        deckCollapsed = false;
        renderDeck();
        updateHUD();
      }
      break;
    }
    case "set-rally":
      rallyBuildingId = id ?? selectedBuilding()?.id ?? null;
      uiAction = "rally";
      deckCollapsed = true;
      updateDeckLayout();
      toast("Tap open ground to set this building’s rally point.");
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
    case "editor":
      showMenu("editor");
      break;
    case "help":
      showHelp();
      break;
    case "settings":
      showSettings();
      break;
    case "close-dialog":
      closeDialog();
      break;
    case "choose-commander":
      readSetup();
      settings.commander = id as any;
      renderSetup();
      break;
    case "new-seed":
      readSetup();
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
      const c = commander();
      if (c) {
        selection = new Set([c.id]);
        centerCommander(c);
        followCommander = true;
        placement = null;
        audio.play("select");
        updateHUD();
      }
      break;
    }
    case "march-relic": {
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
              ? "Relic march queued."
              : state.settings.mode === "conquest"
                ? "Army advancing to a relic. Hold it to fund your siege."
                : "Army advancing to a relic. Hold it to earn victory points.",
          );
        }
      }
      break;
    }
    case "select-army":
      selection = new Set(
        state.entities
          .filter((e) => e.team === 0 && e.kind !== "building" && e.hp > 0)
          .map((e) => e.id),
      );
      placement = null;
      audio.play("select");
      toast(`${selection.size} units ready. Tap a destination or enemy.`);
      updateHUD();
      break;
    case "hold":
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
        );
      break;
    case "build": {
      const def = BUILDINGS[id as BuildingId];
      if (!affordable(def.cost)) {
        toast("Gather more resources first.", "warning");
        audio.play("error");
        break;
      }
      placement = id as BuildingId;
      targetPoint = null;
      const anchor = commander() ?? state.map.spawns[0];
      for (let radius = 3; radius <= 8 && !targetPoint; radius += 1)
        for (let i = 0; i < 12 && !targetPoint; i++) {
          const point = snapConstruction({
            x: anchor.x + Math.cos((i * Math.PI) / 6) * radius,
            y: anchor.y + Math.sin((i * Math.PI) / 6) * radius,
          });
          if (plannedBuildResult(state, 0, placement, point.x, point.y).ok)
            targetPoint = point;
        }
      targetPoint ??= snapConstruction(anchor);
      deckCollapsed = true;
      followCommander = false;
      toast(
        `Drag the ${def.name} preview, then choose Build here. Pinch to pan or zoom.`,
      );
      renderDeck();
      updateHUD();
      break;
    }
    case "cancel-build":
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
        );
      renderDeck();
      break;
    case "ability": {
      const c = commander();
      if (c) {
        const point = chooseAbilityTarget(state, c, id!, targetPoint);
        dispatch(
          { type: "ability", team: 0, ability: id!, x: point.x, y: point.y },
          "ability",
        );
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
      uiAction = "move";
      renderDeck();
      break;
    case "order-attackMove":
      uiAction = "attackMove";
      renderDeck();
      toast("Attack-move: tap a destination. Your army engages along the way.");
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
      toast("New recruits will rally here.");
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
        expedition = expeditionStage,
        previous = { ...state.settings };
      closeDialog();
      if (expedition !== null) {
        void handleAction("start-expedition");
      } else launchGame(previous, mission, null);
      break;
    }
    case "save":
      if (await persist()) toast("Battle saved on this device.");
      break;
    case "save-leave":
      if (await persist()) {
        closeDialog();
        showMenu();
      }
      break;
    case "speed":
      speed = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1;
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
    case "result-home":
      closeDialog();
      showMenu();
      break;
    case "result-record":
      closeDialog();
      showMenu("record");
      break;
    case "next-mission": {
      const next = (missionIndex || 0) + 1;
      closeDialog();
      launchGame(activeCampaign.missions[next].settings, next);
      break;
    }
    case "start-expedition":
      launchGame(
        {
          seed: randomSeed(),
          mode: "domination",
          mapSize: "small",
          difficulty: "easy",
          duration: 8,
        },
        null,
        0,
      );
      break;
    case "next-expedition":
      showDialog(
        "Choose your next frontier",
        `<p class="story">Your soldiers carry experience forward. The next battle begins with +150 gold and +150 wood for each frontier already won.</p><div class="route-choices">${button("Whisperwood · covered flanks", "expedition-forest", "", "wood")}${button("Sunscar · open warfare", "expedition-desert", "", "gold")}</div>`,
      );
      break;
    case "expedition-forest":
    case "expedition-desert": {
      const stage = (expeditionStage || 0) + 1;
      closeDialog();
      launchGame(
        {
          seed: randomSeed(),
          mode: "domination",
          biome: action === "expedition-forest" ? "forest" : "desert",
          mapSize: stage === 2 ? "medium" : "small",
          difficulty: stage === 2 ? "hard" : "normal",
          duration: stage === 2 ? 15 : 12,
          startingGold: 230 + 150 * stage,
          startingWood: 260 + 150 * stage,
        },
        null,
        stage,
      );
      break;
    }
    case "new-editor":
      openEditor();
      break;
    case "load-editor": {
      const map = await loadRecord<GameState["map"]>("editor-map");
      if (map) openEditor(map);
      else toast("No workshop saved yet. Create your first map.");
      break;
    }
    case "exit-editor":
      editing = false;
      showMenu("editor");
      break;
    case "save-map":
      await saveRecord("editor-map", state.map);
      toast("Workshop saved on this device.");
      break;
    case "export-map":
      downloadMap();
      break;
    case "validate-map":
      await validateEditor();
      break;
    case "test-map":
      if (await validateEditor()) {
        const map = structuredClone(state.map);
        editing = false;
        launchGame({ customMap: map, seed: map.seed, biome: map.biome });
      } else toast("Fix the map validation errors before playing.", "warning");
      break;
    case "regenerate-map":
      openEditor();
      break;
  }
}
app.addEventListener("click", (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>("[data-action]");
  if (b && !(b as HTMLButtonElement).disabled) {
    e.preventDefault();
    void handleAction(b.dataset.action!, b.dataset.id);
  }
});
app.addEventListener("submit", (e) => {
  e.preventDefault();
  if ((e.target as HTMLElement).id === "setup-form") {
    if (readSetup()) launchGame();
  }
});
app.addEventListener("input", (e) => {
  const t = e.target as HTMLInputElement;
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
  if (input.id === "import-map" && input.files?.[0]) {
    try {
      const file = input.files[0];
      if (file.size > MAX_MAP_JSON_BYTES)
        throw new Error("Map file is too large.");
      const map = parseBoundedJSON(await file.text(), MAX_MAP_JSON_BYTES);
      if (validateMapStructure(map).length)
        throw new Error("Invalid map structure.");
      openEditor(map as GameState["map"]);
    } catch {
      toast("That file is not a supported Frontier map.", "warning");
    }
  }
});
function canvasPoint(e: PointerEvent): Point {
  const r = canvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}
canvas.addEventListener("pointerdown", (e) => {
  if ((!playing && !editing) || modalOpen) return;
  audio.unlock();
  canvas.setPointerCapture(e.pointerId);
  const point = canvasPoint(e);
  pointers.set(e.pointerId, point);
  if (pointers.size === 2) {
    if (editing && editorStrokeStart) {
      state.map = editorStrokeStart;
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
    dragged = false;
    if (editing && editorMode === "paint") {
      editorStrokeStart = structuredClone(state.map);
      paintEditorStroke(renderer.screenToWorld(point.x, point.y));
    }
  }
});
canvas.addEventListener("pointermove", (e) => {
  const point = canvasPoint(e);
  if (placement && pointers.size === 1 && pointers.has(e.pointerId))
    targetPoint = snapConstruction(renderer.screenToWorld(point.x, point.y));
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, point);
  if (pointers.size === 2) {
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
    } else if (dragged && placement) {
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
    if (editing) paintEditor(world);
    else if (placement) {
      targetPoint = snapConstruction(world);
      updateHUD();
    } else {
      const item = renderer.pick(state, point.x, point.y);
      if (item && "team" in item) {
        if (item.team === 0) {
          selection = new Set([item.id]);
          audio.play("select");
          followCommander = item.kind === "commander";
          if (item.kind === "building") {
            if (learningProgress && item.type === "keep")
              learningProgress.inspectedKeep = true;
            panel = "inspect";
            deckCollapsed = false;
            renderDeck();
          }
        } else
          dispatch({
            type: "attack",
            team: 0,
            entityIds: [...selection],
            targetId: item.id,
          });
      } else if (item && "owner" in item) {
        if (
          !state.entities.some(
            (e) =>
              selection.has(e.id) &&
              e.team === 0 &&
              e.kind !== "building" &&
              e.hp > 0,
          )
        ) {
          const hero = commander();
          if (hero) selection = new Set([hero.id]);
        }
        dispatch({
          type: "capture",
          team: 0,
          entityIds: [...selection],
          nodeId: item.id,
        });
        targetPoint = { x: item.x, y: item.y };
        toast(
          item.kind === "relic"
            ? "Claim the ancient relic. Hold it to earn victory points."
            : `Capturing ${item.kind}. Stay close until your banner rises.`,
        );
      } else {
        const selected = state.entities.filter((e) => selection.has(e.id));
        if (uiAction === "rally" && rallyBuildingId) {
          dispatch({
            type: "rally",
            team: 0,
            buildingId: rallyBuildingId,
            x: world.x,
            y: world.y,
          });
          uiAction = "move";
          rallyBuildingId = null;
          toast("Rally point set. New troops will gather here.");
        } else if (selected.length === 1 && selected[0].kind === "building") {
          toast(
            "Use this building’s Details panel to train, research, upgrade, or set a rally point.",
          );
        } else
          dispatch({
            type: uiAction === "attackMove" ? "attackMove" : "move",
            team: 0,
            entityIds: [...selection],
            x: world.x,
            y: world.y,
          });
        targetPoint = world;
      }
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
  if (editing) finishEditorStroke();
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
    if (joystickPointer !== null) return;
    e.preventDefault();
    audio.unlock();
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
  if (modalOpen && e.key === "Escape") {
    e.preventDefault();
    closeDialog();
    return;
  }
  if (modalOpen && e.key === "Tab") {
    const focusables = [
      ...modal.querySelectorAll<HTMLElement>(
        'button:not([disabled]),input,select,textarea,[tabindex="0"]',
      ),
    ];
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
  keys.add(e.key.toLowerCase());
  if (!playing || e.repeat) return;
  if (e.key === "Escape") {
    if (placement) {
      placement = null;
      renderDeck();
    } else if (modalOpen) closeDialog();
    else showPauseMenu();
  }
  if (e.code === "Space" && !(e.target as HTMLElement).closest("button")) {
    e.preventDefault();
    void handleAction("pause");
  }
  if (e.key.toLowerCase() === "q")
    void handleAction(
      "ability",
      COMMANDERS[state.settings.commander].abilities[0].id,
    );
  if (e.key.toLowerCase() === "e")
    void handleAction(
      "ability",
      COMMANDERS[state.settings.commander].abilities[1].id,
    );
  if (e.key === "1") void handleAction("select-commander");
  if (e.key === "2") void handleAction("select-army");
  if (e.key.toLowerCase() === "b") {
    panel = "build";
    renderDeck();
  }
  if (e.key.toLowerCase() === "r") {
    panel = "army";
    renderDeck();
  }
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
    if (c) issueCommand(state, { type: "steer", team: 0, dx: 0, dy: 0 });
  }
});
window.addEventListener("blur", () => {
  keys.clear();
  joystickVector = { x: 0, y: 0 };
  if (playing && state.winner === null) {
    void persist();
    issueCommand(state, { type: "pause", team: 0, paused: true });
  }
});
function measurePlayfield() {
  const hud = document.querySelector(".hud")?.getBoundingClientRect();
  const deck = document.querySelector(".command-deck")?.getBoundingClientRect();
  const abilities = document.querySelector<HTMLElement>(".ability-dock");
  if (deck)
    document.documentElement.style.setProperty(
      "--deck-height",
      `${Math.ceil(innerHeight - deck.top)}px`,
    );
  const landscape = innerHeight < 500 && innerWidth > 600;
  if (abilities) abilities.style.bottom = "";
  if (landscape && hud && deck) {
    const objective = document
      .querySelector(".objective-bar")
      ?.getBoundingClientRect();
    const top = Math.max(hud.bottom, objective?.bottom ?? hud.bottom);
    playfieldCenterY = Math.min(deck.top - 12, (top + deck.top) / 2 + 24);
  } else
    playfieldCenterY =
      hud && deck ? (hud.bottom + deck.top) / 2 : innerHeight / 2;
}
function cameraFocus(point: Point): Point {
  const middle = renderer.screenToWorld(innerWidth / 2, innerHeight / 2),
    shifted = renderer.screenToWorld(
      innerWidth / 2,
      innerHeight - playfieldCenterY,
    );
  return {
    x: point.x + shifted.x - middle.x,
    y: point.y + shifted.y - middle.y,
  };
}
function centerCommander(point: Point) {
  const focus = cameraFocus(point);
  renderer.centerOn(focus.x, focus.y);
}
function resize() {
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
  if (playing) measurePlayfield();
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
      if (!modalOpen && state.winner === null) {
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
      if (!modalOpen && !document.hidden) stepGame(state, dt * speed);
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
        if (event.type === "alert" && event.team === 0)
          toast(event.text || "Your frontier is under attack.", "warning");
        if (event.type === "research" && event.team === 0) {
          audio.play("build");
          toast(event.text || "Research complete.");
          renderDeck();
        }
        lastEvent = Math.max(lastEvent, event.id);
      }
      audio.setCombat(
        modalOpen || state.paused
          ? 0
          : state.events.filter(
              (e) => e.type === "hit" && state.time - e.time < 2,
            ).length / 20,
      );
      hudClock += dt;
      autosaveClock += dt;
      if (hudClock > 0.22) {
        updateHUD();
        hudClock = 0;
      }
      if (autosaveClock > 30 && state.winner === null) {
        void persist();
        autosaveClock = 0;
      }
      if (state.winner !== null || state.players[0].defeated) showResult();
    }
    if (state)
      renderer.render(state, playing ? selection : [], {
        time: playing ? state.time + state.accumulator : now / 1000,
        reveal: !playing || debugReveal,
        quality: frameRate < 35 ? "low" : "high",
        reducedMotion: preferences.reducedMotion,
        placement:
          placement && targetPoint
            ? {
                type: placement,
                x: targetPoint.x,
                y: targetPoint.y,
                valid: plannedBuildResult(
                  state,
                  0,
                  placement,
                  targetPoint.x,
                  targetPoint.y,
                ).ok,
                size: BUILDINGS[placement].size,
                reason: plannedBuildResult(
                  state,
                  0,
                  placement,
                  targetPoint.x,
                  targetPoint.y,
                ).error,
              }
            : undefined,
        target:
          targetPoint && playing ? { ...targetPoint, radius: 0.45 } : undefined,
      });
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
void loadRecord("battle").then((saved) => {
  savedGame = saved;
  if (!playing && !editing && !modalOpen && menuPage === "home") showMenu();
});
requestAnimationFrame(frame);
void setupPWA(
  (apply) => {
    const el = document.querySelector("#update")!;
    el.innerHTML = `<span>A new frontier is ready.</span><button id="apply-update">Update & restart</button>`;
    el.querySelector("button")!.addEventListener(
      "click",
      () =>
        void apply().catch(() =>
          toast(
            "Update postponed because the battle could not be saved.",
            "warning",
          ),
        ),
    );
  },
  async () => {
    if (!(await persist())) throw new Error("Save failed before update");
  },
);
document.addEventListener("visibilitychange", () => {
  if (document.hidden && playing) {
    void persist();
    issueCommand(state, { type: "pause", team: 0, paused: true });
  }
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
