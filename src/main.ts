import "./style.css";
import { encodeMapCode, decodeMapCode } from "./ui/map-code";
import { chooseAbilityTarget } from "./ui/targeting";
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
let state: GameState,
  playing = false,
  selection = new Set<string>(),
  panel = "army",
  placement: BuildingId | null = null,
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
let savePromise: Promise<boolean> | null = null;
let savedGame: unknown = null,
  saveBusy = false,
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
let tutorialOrigin: Point | null = null;
let previousFocus: HTMLElement | null = null;
let frameRate = 60;
let runtimeFailed = false;
let lastDeckSignature = "";
const debugEnabled = new URLSearchParams(location.search).has("debug");
let debugReveal = false;
const pointers = new Map<number, Point>();
let pinchDistance = 0;
const esc = (s: unknown) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
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
  return `<button class="${cls}" data-action="${action}" ${extra.includes("aria-label=") ? "" : `aria-label="${esc(label)}"`} ${extra}>${ico ? icon(ico) : ""}<span>${label}</span></button>`;
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
  return state.players[0].gold >= c.gold && state.players[0].wood >= c.wood;
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
    screen.innerHTML = `<div class="menu-scrim"></div><main class="home"><div class="brandmark">${icon("crown")}<span>A WORLD WORTH FIGHTING FOR</span></div><h1>FRONTIER<br><em>COMMAND</em></h1><p class="home-lede">Build your stronghold. Lead from the front.<br>Turn one small army into a legend.</p><div class="home-actions">${button("Play skirmish", "skirmish", "primary large", "sword")}${button("Rush Arena · 4 minute survival", "rush", "secondary rush-entry", "lightning")}${savedGame ? button("Continue battle", "continue", "secondary", "play") : ""}${button("Rise of the Frontier", "campaign", "secondary", "flag")}${button("Frontier expedition", "expedition", "secondary", "map")}</div><div class="home-links">${button("How to play", "help", "", "book")}${button("Map workshop", "editor", "", "map")}${button("Command record", "record", "", "star")}${button("Settings", "settings", "", "gear")}</div><footer><span class="offline-dot"></span> <span id="offline-status">${navigator.serviceWorker?.controller ? "Offline ready" : "Offline after first full load"}</span> · Solo strategy <span class="version">v0.1 · Testing preview</span></footer></main><aside class="home-aside"><div class="vertical-rule"></div><span>YOUR BANNER.<br>YOUR FRONTIER.</span></aside>`;
  } else if (page === "skirmish") renderSetup();
  else if (page === "campaign") renderCampaign();
  else if (page === "expedition") renderExpedition();
  else if (page === "record") renderRecord();
  else if (page === "editor") renderEditorMenu();
}
function pageHeader(eyebrow: string, title: string, description: string) {
  return `<header class="page-header">${button("Back", "home", "back", "back")}<span class="eyebrow">${eyebrow}</span><h1>${title}</h1><p>${description}</p></header>`;
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
        `<button type="button" data-action="choose-commander" data-id="${c.id}" class="commander-card ${settings.commander === c.id ? "chosen" : ""}"><div class="commander-portrait ${c.id}"><canvas class="portrait-canvas" data-portrait="${c.id}" width="220" height="180" aria-hidden="true"></canvas></div><span class="tag">${c.id === "warlord" ? "HOLD THE LINE" : c.id === "ranger" ? "STRIKE & VANISH" : "BUILD TO LAST"}</span><h3>${c.name}</h3><p>${c.description}</p><span class="chosen-check">${icon("check")}</span></button>`,
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
    screen.innerHTML = `<div class="menu-scrim solid"></div><main class="content-page">${pageHeader("STORY CAMPAIGNS", "Chronicles of the frontier", "Choose a story. Each campaign keeps its own progress.")}<div class="mission-list">${CAMPAIGNS.map((c) => `<button class="mission-card" data-action="choose-campaign" data-id="${c.id}"><span class="mission-number">${icon("book")}</span><div><h2>${c.title}</h2><p>${c.description}</p><span class="mission-meta">${c.missions.length} chapters</span></div>${icon("arrow")}</button>`).join("")}</div></main>`;
    return;
  }
  const progress = currentChapter();
  screen.innerHTML = `<div class="menu-scrim solid"></div><main class="content-page">${pageHeader("STORY CAMPAIGN", activeCampaign.title, activeCampaign.description)}<div class="mission-list">${activeCampaign.missions.map((m, i) => `<button class="mission-card ${i <= progress ? "available" : "locked"}" data-action="mission" data-id="${i}" ${i > progress ? "disabled" : ""}><span class="mission-number">${i < progress ? icon("check") : String(i + 1).padStart(2, "0")}</span><div><span class="eyebrow">${m.subtitle}</span><h2>${m.title}</h2><p>${m.briefing}</p><span class="mission-meta">${m.settings.biome} · ${m.settings.duration} min · ${i < progress ? "Completed" : i === progress ? "Next chapter" : "Locked"}</span></div>${icon("arrow")}</button>`).join("")}</div></main>`;
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
  renderer.camera.zoom = innerWidth < 600 ? 1.05 : 1.3;
  const c = commander() || state.map.spawns[0];
  renderer.centerOn(c.x, c.y);
  renderGameShell();
  void persist();
  if (mission !== null) showBriefing(mission);
  else
    toast(
      state.rush
        ? "Survive four minutes. Keep moving, claim supplies, and use your abilities."
        : "Capture supplies. Raise an army. Claim the frontier.",
    );
}
function renderGameShell() {
  screen.innerHTML = `<header class="hud"><button class="brand-button" data-action="pause-menu" aria-label="Battle menu">${icon("crown")}</button><div class="resources"><span title="Gold">${icon("gold")}<b id="gold">0</b></span><span title="Wood">${icon("wood")}<b id="wood">0</b></span><span title="Population">${icon("flag")}<b id="population">0</b></span></div><div class="hud-time" id="match-time">0:00</div><button class="pause-button" data-action="pause" aria-label="Tactical pause">${icon("pause")}</button></header><div class="objective-bar" id="objective"></div><div class="battle-hint" id="battle-hint"></div><div class="map-controls">${button("Focus commander", "focus", "square", "crosshair")}${button("Zoom in", "zoom-in", "square", "plus")}${button("Zoom out", "zoom-out", "square", "minus")}</div><div class="minimap-wrap"><canvas id="minimap" width="160" height="120" aria-label="Minimap: tap to move camera"></canvas><span id="map-seed"></span></div><div class="commander-strip" id="commander-strip"></div><div id="joystick" aria-label="Drag to move commander" role="application"><div class="joystick-ring"></div><div class="joystick-stick">${icon("crosshair")}</div></div><div class="ability-dock" id="abilities"></div><section class="command-deck"><div class="selection-row"><div class="selection-info" id="selection-info"></div><div class="selection-tools">${button("Commander", "select-commander", "", "crown")}${button("Army", "select-army", "", "flag")}${button("Hold", "hold", "", "hold")}</div></div><nav class="deck-tabs">${button("Recruit", "panel-army", "active", "sword")}${button("Build", "panel-build", "", "house")}${button("Research", "panel-research", "", "spark")}${button("Orders", "panel-orders", "", "flag")}</nav><div class="deck-content" id="deck-content"></div></section><div class="paused-ribbon" id="paused-ribbon"></div>`;
  renderDeck();
  updateHUD();
  setupJoystick();
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
    renderer.atlas.ready,
    state.entities
      .filter((e) => e.team === 0 && e.kind === "building" && e.hp > 0)
      .map((e) => [e.type, e.buildProgress >= 1]),
    Object.values(UNITS).map((u) => affordable(getUnitCost(state, 0, u.id))),
    Object.values(BUILDINGS).map((b) => affordable(b.cost)),
    Object.values(TECHNOLOGIES).map((t) => [
      affordable(t.cost),
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
  if (panel === "army")
    el.innerHTML = `<div class="action-cards">${Object.values(UNITS)
      .map((u) => {
        const ready = state.entities.some(
          (e) =>
            e.team === 0 &&
            e.kind === "building" &&
            BUILDINGS[e.type as BuildingId]?.recruits.includes(u.id) &&
            e.buildProgress >= 1,
        );
        return `<button class="action-card ${!ready ? "unavailable" : ""} ${affordable(getUnitCost(state, 0, u.id)) ? "" : "funds-low"}" data-action="recruit" data-id="${u.id}" title="${esc(u.description)}" aria-label="Recruit ${u.name}"><span class="action-icon">${cardArt(u.id)}</span><strong>${u.name}</strong>${cost(getUnitCost(state, 0, u.id))}<small>${ready ? `${Math.round(u.trainTime * (state.players[0].research.logistics ? 0.85 : 1))}s · ${u.population} pop` : `Needs ${BUILDINGS[u.building].name}`}</small><small class="unit-counter">${{ swordsman: "Frontline", spearman: "Counters cavalry", archer: "Counters infantry", cavalry: "Counters archers", siege: "Breaks buildings", support: "Heals your army" }[u.id]}</small></button>`;
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
          `<button class="action-card ${(state.players[0].research[t.id] || 0) >= t.maxLevel ? "completed" : ""}" data-action="research" data-id="${t.id}" title="${esc(t.description)}"><span class="action-icon">${icon("spark")}</span><strong>${t.name}</strong>${cost(t.cost)}<small>${state.players[0].research[t.id] || 0} / ${t.maxLevel} · ${t.description}</small></button>`,
      )
      .join("")}</div>`;
  else
    el.innerHTML = `<div class="order-cards">${button("Move", "order-move", uiAction === "move" ? "chosen" : "", "arrow")}${button("Attack-move", "order-attackMove", uiAction === "attackMove" ? "chosen" : "", "sword")}${button("Rally at commander", "rally-all", "", "flag")}${button("Save battle", "save", "", "save")}${button(`${speed}× speed`, "speed", "", "clock")}</div><p class="deck-tip">Tap a friendly to select. Tap ground to command. Drag the map to look around.</p>`;
  const cards = el.querySelector(".action-cards");
  if (cards) cards.scrollLeft = oldScroll;
  if (focused?.action) {
    const next = el.querySelector<HTMLElement>(
      `[data-action="${focused.action}"]${focused.id ? `[data-id="${focused.id}"]` : ""}`,
    );
    next?.focus({ preventScroll: true });
  }
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
  const p = state.players[0],
    c = commander();
  const set = (id: string, html: string) => {
    const el = document.querySelector(`#${id}`);
    if (el && el.innerHTML !== html) el.innerHTML = html;
  };
  set("gold", Math.floor(p.gold).toString());
  set("wood", Math.floor(p.wood).toString());
  set("population", `${p.population}<small>/${p.populationCap}</small>`);
  set(
    "match-time",
    `${time(state.time)}${speed !== 1 ? ` <small>${speed}×</small>` : ""}`,
  );
  set("map-seed", `${esc(state.settings.seed)} · v${state.map.version}`);
  const enemy = state.players.filter((pl) => pl.team !== 0 && !pl.defeated);
  const maxScore = Math.max(1, state.scoreTarget);
  set(
    "objective",
    `<span>${icon(state.settings.mode === "conquest" ? "sword" : "spark")} ${esc(state.objectiveText || "Claim territory. Hold the relic.")}</span><div class="score-track"><i style="width:${Math.min(100, (p.score / maxScore) * 100)}%"></i><b>${state.settings.mode === "conquest" ? `${enemy.length} enemy keep${enemy.length === 1 ? "" : "s"} remain` : `${Math.floor(p.score)} / ${maxScore}`}</b>${state.settings.mode === "conquest" ? "" : `<em>${Math.floor(Math.max(...enemy.map((e) => e.score), 0))}</em>`}</div>`,
  );
  const chosen = state.entities.filter((e) => selection.has(e.id) && e.hp > 0);
  set(
    "selection-info",
    `${icon(chosen.length === 1 ? unitIcons[chosen[0].type] : "flag")}<div><strong>${placement ? `Place ${BUILDINGS[placement].name}` : chosen.length === 1 ? (UNITS as any)[chosen[0].type]?.name || (BUILDINGS as any)[chosen[0].type]?.name || (COMMANDERS as any)[chosen[0].type]?.name || "Commander" : `${chosen.length} units selected`}</strong><small>${placement ? "Tap open ground near your frontier" : chosen.length === 1 ? `${Math.ceil(chosen[0].hp)} / ${Math.ceil(chosen[0].maxHp)} health${chosen[0].queue.length ? ` · ${chosen[0].queue.length} queued` : ""}` : "Tap the battlefield to give an order"}</small></div>${placement ? button("Cancel", "cancel-build", "cancel", "close") : ""}`,
  );
  set(
    "commander-strip",
    c
      ? `<button data-action="focus" aria-label="Focus commander">${icon(unitIcons[c.type])}<span><b>${COMMANDERS[state.settings.commander].name}</b><i><em style="width:${(c.hp / c.maxHp) * 100}%"></em></i></span><small>${Math.ceil(c.hp)}</small></button>`
      : `<span class="respawning">Commander recovering at the keep…</span>`,
  );
  set(
    "abilities",
    COMMANDERS[state.settings.commander].abilities
      .map((a, i) => {
        const remaining = c?.abilityCooldowns[a.id] || 0;
        return `<button class="ability ${remaining > 0 ? "cooling" : ""}" data-action="ability" data-id="${a.id}" aria-label="${a.name}" title="${esc(a.description)}" ${!c || remaining > 0 ? "disabled" : ""}>${icon(i === 0 ? "lightning" : state.settings.commander === "engineer" ? "gear" : "flag")}<b>${remaining > 0 ? Math.ceil(remaining) : a.name}</b><kbd>${i === 0 ? "Q" : "E"}</kbd></button>`;
      })
      .join(""),
  );
  const pause = document.querySelector(".pause-button");
  if (pause) {
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
  const mini = document.querySelector<HTMLCanvasElement>("#minimap");
  if (mini) renderer.renderMinimap(mini, state);
}
function updateTutorial() {
  const el = document.querySelector("#battle-hint");
  if (!el) return;
  if (state.rush || !preferences.showTips || state.time > 200) {
    el.innerHTML = "";
    return;
  }
  const currentCommander = commander();
  if (
    currentCommander &&
    tutorialOrigin &&
    Math.hypot(
      currentCommander.x - tutorialOrigin.x,
      currentCommander.y - tutorialOrigin.y,
    ) > 3
  )
    tutorialStep = Math.max(tutorialStep, 1);
  if (state.players[0].stats.captures > 0)
    tutorialStep = Math.max(tutorialStep, 2);
  if (state.players[0].stats.unitsCreated > 4)
    tutorialStep = Math.max(tutorialStep, 3);
  const tips = [
    [
      "Step into the frontier",
      "Tap open ground to move. Your commander fights nearby enemies automatically.",
    ],
    [
      "Claim fresh supplies",
      "Tap a neutral gold or timber deposit. Stay close until your banner rises.",
    ],
    [
      "Raise your army",
      "Tap Recruit below, then Swordsman. New soldiers join your commander.",
    ],
    [
      "Take the center",
      "Select Army, then tap a glowing relic. Build houses to grow. Use both abilities.",
    ],
  ];
  el.innerHTML = `<button data-action="dismiss-tips" aria-label="Dismiss tips">${icon("close")}</button><span>COMMANDER’S FIELD GUIDE · ${tutorialStep + 1}/4</span><b>${tips[tutorialStep][0]}</b><p>${tips[tutorialStep][1]}</p>`;
}
function showDialog(title: string, body: string, cls = "") {
  if (!modalOpen) previousFocus = document.activeElement as HTMLElement;
  modalOpen = true;
  modal.innerHTML = `<div class="modal-backdrop"><section class="dialog ${cls}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><header><h2>${title}</h2>${button("Close", "close-dialog", "square", "close", 'aria-label="Close dialog"')}</header>${body}</section></div>`;
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
    `<span class="eyebrow">${m.subtitle}</span><p class="story">${m.story}</p><div class="briefing-objective">${icon("flag")}<p>${m.briefing}</p></div>${button("Raise the banner", "begin-mission", "primary large", "arrow")}`,
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
    `<div class="settings-fields"><label>Music <output id="music-value">${Math.round(preferences.music * 100)}%</output><input id="music-slider" type="range" min="0" max="1" step=".05" value="${preferences.music}"></label><label>Sound effects <output id="sfx-value">${Math.round(preferences.sfx * 100)}%</output><input id="sfx-slider" type="range" min="0" max="1" step=".05" value="${preferences.sfx}"></label><label class="check-field"><input id="reduced-motion" type="checkbox" ${preferences.reducedMotion ? "checked" : ""}> Reduced motion and effects</label><label class="check-field"><input id="show-tips" type="checkbox" ${preferences.showTips ? "checked" : ""}> Commander’s field guide</label><p class="muted">Teams use blue circles and coral diamonds, as well as banners. Sound is generated locally and works offline.</p></div>${button("Done", "close-dialog", "primary", "check")}`,
  );
}
function showPauseMenu() {
  showDialog(
    "Take a breath",
    `<p class="muted">The battle is paused. Your frontier will wait.</p><div class="menu-stack">${button("Return to battle", "resume-dialog", "primary", "play")}${button("Save battle", "save", "", "save")}${button("Copy map code", "copy-map-code", "", "map")}${button("How to play", "help", "", "book")}${button("Settings", "settings", "", "gear")}${button("Save & leave", "save-leave", "", "back")}</div>`,
  );
  updateHUD();
}
async function persist(): Promise<boolean> {
  if (!playing || state.winner !== null || state.players[0].defeated)
    return true;
  if (savePromise) return savePromise;
  saveBusy = true;
  savePromise = (async () => {
    try {
      const record = {
        version: 1,
        game: serializeGame(state),
        missionIndex,
        campaignId: activeCampaign.id,
        expeditionStage,
        savedAt: Date.now(),
      };
      await saveRecord("battle", record);
      savedGame = record;
      return true;
    } catch {
      toast("Could not save. Your browser storage may be full.", "warning");
      return false;
    } finally {
      saveBusy = false;
      savePromise = null;
    }
  })();
  return savePromise;
}
async function continueGame() {
  const record: any = await loadRecord("battle");
  if (!record) return toast("No saved battle yet.");
  try {
    state = restoreGame(record.game);
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
    state.paused = true;
    playing = true;
    document.body.classList.toggle("rush-mode", !!state.rush);
    resultShown = false;
    lastEvent = state.nextEventId;
    selection = new Set(commander() ? [commander()!.id] : []);
    document.body.classList.add("in-game");
    renderer.camera.zoom = innerWidth < 600 ? 1.05 : 1.3;
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
  void (savePromise ?? Promise.resolve()).then(() => removeRecord("battle"));
  savedGame = null;
  audio.play(win ? "victory" : "defeat");
  showDialog(
    win ? "The frontier is yours." : "The banner will rise again.",
    `<div class="result-emblem ${win ? "win" : ""}">${icon(win ? "crown" : "shield")}</div><p class="result-reason">${esc(state.players[0].defeated && state.winner === null ? "Your Command Keep has fallen." : state.victoryReason || "The battle has ended.")}</p><div class="record-stats"><div><b>${time(state.time)}</b><span>Battle time</span></div><div><b>${state.players[0].stats.kills}</b><span>Enemies defeated</span></div><div><b>${state.players[0].stats.captures}</b><span>Points captured</span></div></div>${earned.length ? `<div class="new-achievements">${earned.map((id) => `<span>${icon("star")}${ACHIEVEMENTS.find((a) => a.id === id)?.name}</span>`).join("")}</div>` : ""}<div class="result-actions">${win && missionIndex !== null && missionIndex < activeCampaign.missions.length - 1 ? button("Next chapter", "next-mission", "primary", "arrow") : win && expeditionStage !== null && expeditionStage < 2 ? button("Choose your next frontier", "next-expedition", "primary", "arrow") : win ? button("Another frontier", "rematch", "primary", "arrow") : button(expeditionStage !== null ? "Start a new expedition" : "Try again", "retry", "primary", "play")}${button("Command record", "result-record", "", "star")}${button("Main menu", "result-home", "", "back")}</div>`,
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
          `<button data-action="rush-commander" data-id="${c.id}" class="${settings.commander === c.id ? "chosen" : ""}">${icon(unitIcons[c.id])}<b>${c.name}</b></button>`,
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
  editorBrush = "grass";
function renderEditorMenu() {
  screen.innerHTML = `<div class="menu-scrim solid"></div><main class="content-page">${pageHeader("MAP WORKSHOP", "Make your frontier", "Start from a generated world. Paint terrain, move spawns, and place resources.")}<div class="expedition-intro">${icon("map")}<h2>A blank page is optional.</h2><p>Open a fresh seeded map, or return to your saved workshop. Export a JSON map to share it. Validation checks keep every spawn, supply, and objective reachable.</p><div class="menu-stack">${button("Create a map", "new-editor", "primary", "plus")}${button("Open saved map", "load-editor", "", "save")}<label class="file-button">${icon("map")} Import map JSON<input type="file" id="import-map" accept="application/json,.json"></label></div></div></main>`;
}
function openEditor(map?: GameState["map"]) {
  playing = false;
  editing = true;
  state = createGame({
    seed: randomSeed(),
    mapSize: "tiny",
    ...(map ? { customMap: map } : {}),
  });
  if (map) state.map = map;
  renderer.invalidateTerrain();
  renderer.centerOn(state.map.width / 2, state.map.height / 2);
  renderer.camera.zoom = innerWidth < 600 ? 0.55 : 0.75;
  document.body.classList.add("in-game");
  screen.innerHTML = `<header class="editor-header">${button("Workshop", "exit-editor", "back", "back")}<h2>Map workshop</h2>${button("Save", "save-map", "", "save")}${button("Test map", "test-map", "primary", "play")}</header><aside class="editor-tools"><span class="eyebrow">PAINT THE FRONTIER</span><div class="brushes">${["grass", "forest", "water", "rock", "sand", "snow", "road", "marsh", "gold", "wood", "relic", "spawn-0", "spawn-1", "erase"].map((b) => button(b.replace("-", " "), `brush-${b}`, b === editorBrush ? "active" : "", b === "gold" ? "gold" : b === "wood" ? "wood" : b === "relic" ? "spark" : "map")).join("")}</div><p>Tap to paint. Drag to pan. Pinch or scroll to zoom.</p><div id="map-validation"></div>${button("Validate", "validate-map", "", "check")}${button("Export JSON", "export-map", "", "save")}</aside><div class="editor-bottom"><span>${state.map.width} × ${state.map.height} · ${esc(state.map.seed)}</span>${button("Regenerate", "regenerate-map", "", "spark")}</div>`;
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
    state.map.nodes.push({
      id: `editor-${Date.now()}`,
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
    renderDeck();
    return;
  }
  if (action.startsWith("brush-")) {
    editorBrush = action.slice(6);
    screen
      .querySelectorAll(".brushes button")
      .forEach((b) =>
        b.classList.toggle("active", b.getAttribute("data-action") === action),
      );
    return;
  }
  switch (action) {
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
    case "focus":
    case "select-commander": {
      const c = commander();
      if (c) {
        selection = new Set([c.id]);
        renderer.centerOn(c.x, c.y);
        followCommander = true;
        placement = null;
        audio.play("select");
        updateHUD();
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
      if (dispatch({ type: "recruit", team: 0, unit: id as UnitId }, "recruit"))
        toast(`${UNITS[id as UnitId].name} queued for training`);
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
      followCommander = false;
      toast(`Tap open ground near your keep to place ${def.name}.`);
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
          { type: "research", team: 0, technology: id as TechId },
          "build",
        )
      )
        toast(`${TECHNOLOGIES[id as TechId].name} research started`);
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
  if (t.id === "music-slider" || t.id === "sfx-slider") {
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
      const map = JSON.parse(await input.files[0].text());
      if (
        !Number.isInteger(map.width) ||
        map.width < 16 ||
        map.width > 100 ||
        !Number.isInteger(map.height) ||
        map.height < 16 ||
        map.height > 100 ||
        !Array.isArray(map.tiles) ||
        map.tiles.length !== map.width * map.height ||
        !Array.isArray(map.spawns) ||
        map.spawns.length < 2 ||
        !Array.isArray(map.nodes)
      )
        throw new Error("Invalid map structure.");
      openEditor(map);
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
    const ps = [...pointers.values()];
    pinchDistance = Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y);
    dragged = true;
  } else {
    pointerDown = point;
    pointerLast = point;
    dragged = false;
  }
});
canvas.addEventListener("pointermove", (e) => {
  const point = canvasPoint(e);
  if (placement) targetPoint = renderer.screenToWorld(point.x, point.y);
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, point);
  if (pointers.size === 2) {
    const ps = [...pointers.values()],
      d = Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y);
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
    if (dragged) {
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
  if (!dragged && pointerDown && !modalOpen) {
    const world = renderer.screenToWorld(point.x, point.y);
    if (editing) paintEditor(world);
    else if (placement) {
      if (
        dispatch(
          {
            type: "build",
            team: 0,
            building: placement,
            x: world.x,
            y: world.y,
          },
          "build",
        )
      ) {
        toast(`${BUILDINGS[placement].name} under construction`);
        placement = null;
        targetPoint = null;
        renderDeck();
      }
    } else {
      const item = renderer.pick(state, point.x, point.y);
      if (item && "team" in item) {
        if (item.team === 0) {
          selection = new Set([item.id]);
          audio.play("select");
          followCommander = item.kind === "commander";
          if (item.kind === "building") {
            panel = BUILDINGS[item.type as BuildingId]?.recruits.length
              ? "army"
              : "build";
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
        if (selected.length === 1 && selected[0].kind === "building")
          dispatch({
            type: "rally",
            team: 0,
            buildingId: selected[0].id,
            x: world.x,
            y: world.y,
          });
        else
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
}
canvas.addEventListener("pointerup", releasePointer);
canvas.addEventListener("pointercancel", () => {
  pointers.clear();
  pointerDown = null;
  pointerLast = null;
  pinchDistance = 0;
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
      x: dx / Math.max(length, limit),
      y: dy / Math.max(length, limit),
    };
    const stick = el.querySelector<HTMLElement>(".joystick-stick")!;
    stick.style.transform = `translate(${joystickVector.x * limit}px,${joystickVector.y * limit}px)`;
  };
  el.addEventListener("pointerdown", (e) => {
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
    if (c && !state.paused)
      issueCommand(state, { type: "hold", team: 0, entityIds: [c.id] });
    joystickVector = { x: 0, y: 0 };
    joystickPointer = null;
    el.querySelector<HTMLElement>(".joystick-stick")!.style.transform = "";
  };
  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", end);
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
    if (c && !state.paused)
      issueCommand(state, { type: "hold", team: 0, entityIds: [c.id] });
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
function resize() {
  renderer.resize(innerWidth, innerHeight, devicePixelRatio);
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
        if ((dx || dy) && !state.paused && now - lastJoystick > 100) {
          const c = commander();
          if (c) {
            const a = renderer.screenToWorld(innerWidth / 2, innerHeight / 2),
              b = renderer.screenToWorld(
                innerWidth / 2 + dx * 60,
                innerHeight / 2 + dy * 60,
              );
            issueCommand(state, {
              type: "move",
              team: 0,
              entityIds: [c.id],
              x: c.x + (b.x - a.x),
              y: c.y + (b.y - a.y),
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
          renderer.camera.x += (c.x - renderer.camera.x) * blend;
          renderer.camera.y += (c.y - renderer.camera.y) * blend;
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
        time: now / 1000,
        reveal: !playing || debugReveal,
        quality: frameRate < 35 ? "low" : "high",
        reducedMotion: preferences.reducedMotion,
        placement:
          placement && targetPoint
            ? {
                type: placement,
                x: targetPoint.x,
                y: targetPoint.y,
                valid: canBuild(
                  state,
                  0,
                  placement,
                  targetPoint.x,
                  targetPoint.y,
                ).ok,
                size: BUILDINGS[placement].size,
                reason: canBuild(
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
        '<b>The battlefield hit a snag.</b><p>Your last autosave is safe. Reload to continue.</p><button onclick="location.reload()">Reload</button>';
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
