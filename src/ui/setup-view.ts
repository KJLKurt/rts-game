import { factionLegendHTML } from "./about";
import { BIOMES, COMMANDERS, FACTIONS, MAP_DIMENSIONS } from "../sim/content";
import {
  currentMatchScale,
  defaultMatchSlots,
  MATCH_LIMITS,
  MAX_TOTAL_POPULATION,
} from "../sim/scales";
import type { MapPlayerSlot } from "../sim/scenario-types";
import type { GameSettings } from "../sim/types";
import { escapeText as esc } from "./escape";
import { decodeMapCode } from "./map-code";
import { MATCH_SCALE_PRESETS, setupSlots, summarizeSetup } from "./setup-model";
const DIFFICULTIES = ["easy", "normal", "hard", "brutal"] as const;
const PERSONALITIES = [
  "adaptive",
  "aggressive",
  "defensive",
  "economic",
  "raider",
  "expansionist",
] as const;
const SLOT_FIELDS = [
  "name",
  "controller",
  "alliance",
  "faction",
  "commander",
  "personality",
  "difficulty",
] as const;
type Choice = readonly [string | number, string];
const title = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
const choices = (values: readonly string[]): Choice[] =>
  values.map((value) => [value, title(value)]);
const namedChoices = (values: Record<string, { name: string }>): Choice[] =>
  Object.entries(values).map(([id, value]) => [id, value.name]);
function select(
  label: string,
  name: string,
  value: string | number,
  options: readonly Choice[],
): string {
  return `<label class="field"><span>${esc(label)}</span><select name="${esc(name)}">${options.map(([id, text]) => `<option value="${esc(id)}"${String(value) === String(id) ? " selected" : ""}>${esc(text)}</option>`).join("")}</select></label>`;
}
function numberField(
  label: string,
  name: keyof typeof MATCH_LIMITS,
  value: number,
): string {
  const limits = MATCH_LIMITS[name];
  return `<label class="field"><span>${esc(label)}</span><input name="${name}" type="number" required min="${limits.min}" max="${limits.max}" step="${["populationCap", "startingGold", "startingWood"].includes(name) ? 1 : "any"}" value="${esc(value)}"></label>`;
}
/** Field HTML only; the host owns the form, actions, preview, and launch. */
export function renderSetupControls(settings: GameSettings): string {
  const version = settings.mapGenerationVersion ?? 4,
    scale = currentMatchScale(settings),
    slots = setupSlots(settings);
  const scales = Object.values(MATCH_SCALE_PRESETS)
    .map(
      (preset) =>
        `<button type="button" data-action="choose-scale" data-id="${preset.id}" class="scale-card${scale === preset.id ? " chosen" : ""}" aria-pressed="${scale === preset.id}"><b>${preset.name}</b><span>${preset.durationLabel}</span><small>${esc(preset.description)}</small></button>`,
    )
    .join("");
  const slotControls = slots
    .map(
      (slot, index) =>
        `<fieldset class="setup-slot"><legend>Player ${index + 1}${index === 0 ? " · your command surface" : ""}</legend><div class="field-grid"><label class="field"><span>Player ${index + 1} name</span><input name="slot-${index}-name" maxlength="80" required value="${esc(slot.name)}"></label>${select(
          "Controller",
          `slot-${index}-controller`,
          slot.controller,
          index === 0
            ? [
                ["human", "Human"],
                ["ai", "AI observer match"],
              ]
            : [
                ["ai", "AI"],
                ["closed", "Closed"],
              ],
        )}${select(
          "Alliance",
          `slot-${index}-alliance`,
          slot.alliance,
          Array.from(
            { length: 6 },
            (_, i) => [i, `Alliance ${i + 1}`] as const,
          ),
        )}${select("Faction", `slot-${index}-faction`, slot.faction, namedChoices(FACTIONS))}${select("Commander", `slot-${index}-commander`, slot.commander, namedChoices(COMMANDERS))}${select("AI personality", `slot-${index}-personality`, slot.personality, choices(PERSONALITIES))}${select("AI difficulty", `slot-${index}-difficulty`, slot.difficulty, choices(DIFFICULTIES))}</div></fieldset>`,
    )
    .join("");
  return `<section class="setup-section"><h2 class="section-label">Match scale</h2><div class="scale-grid">${scales}<button type="button" data-action="choose-scale" data-id="custom" class="scale-card${scale === "custom" ? " chosen" : ""}" aria-pressed="${scale === "custom"}"><b>Custom</b><span>Your pacing and army size</span><small>Duration is a pacing target, not a guaranteed ending.</small></button></div></section>
<section class="setup-section"><h2 class="section-label">Battlefield and rules</h2><div class="field-grid">${select(
    "Map dimensions",
    "mapSize",
    settings.mapSize,
    Object.entries(MAP_DIMENSIONS).map(([id, size]) => [
      id,
      `${title(id)} · ${size} × ${size} tiles${size >= 120 ? " · v5" : ""}`,
    ]),
  )}${select("Biome", "biome", settings.biome, namedChoices(BIOMES))}${select(
    "Victory",
    "mode",
    settings.mode,
    [
      ["domination", "Domination · territory and score"],
      ["conquest", "Conquest · destroy opposing keeps"],
      ["relic", "Relic race · hold the center"],
    ],
  )}${select("Map generator", "mapGenerationVersion", version, [
    [5, "v5 · complete match setup"],
    [4, "v4 · mirrored reserves (legacy)"],
    [3, "v3 · legacy maps"],
  ])}${numberField("Pacing target · game-minutes", "duration", settings.duration)}${numberField("Game speed · × real time", "gameSpeed", settings.gameSpeed ?? 1)}${select("Match difficulty / tactical pause", "difficulty", settings.difficulty, choices(DIFFICULTIES))}${select("New AI slot personality", "aiPersonality", settings.aiPersonality, choices(PERSONALITIES))}</div><p class="muted">Easy/Normal allow tactical pause; Hard allows three pauses; Brutal disables it. Individual AI difficulty is set below. Giant/Colossal maps, targets over 90 minutes, teams, closed slots and camps require v5. Choosing a legacy generator removes custom slots and camps.</p><label class="field seed-field"><span>Seed or complete FC3 / FC4 / FC5 code</span><input name="seed" maxlength="12000" aria-label="Map seed" required value="${esc(settings.seed)}" aria-describedby="setup-code-help"></label><p id="setup-code-help" class="muted">A plain seed uses these settings. A pasted code replaces its encoded settings. FC5 includes every rule and player slot; FC3/FC4 contain battlefield settings and retain current army/economy rules.</p><div class="setup-code-actions"><button type="button" data-action="new-seed">New seed</button><button type="button" data-action="preview-setup">Preview battlefield</button><button type="button" data-action="copy-setup-code">Copy ${version === 5 ? "complete FC5 match" : `FC${version} map`} code</button></div></section>
<section class="setup-section"><h2 class="section-label">Economy and generation</h2><div class="field-grid">${numberField("Population ceiling per active player", "populationCap", settings.populationCap)}${numberField("Starting gold per player", "startingGold", settings.startingGold)}${numberField("Starting wood per player", "startingWood", settings.startingWood)}${numberField("Deposit income multiplier", "incomeRate", settings.incomeRate ?? 1)}${numberField("Resource reserves multiplier", "resourceAbundance", settings.resourceAbundance)}${select(
    "Generation preset / symmetry",
    "preset",
    settings.preset,
    [
      ["balanced", "Balanced · mirrored starts"],
      ["competitive", "Competitive · equal starting zones"],
      ["wild", "Wild · irregular terrain"],
      ["chaotic", "Chaotic · experimental terrain"],
    ],
  )}${numberField("Terrain roughness", "terrainRoughness", settings.terrainRoughness)}${numberField("Water density", "water", settings.water)}${numberField("Objective density", "objectiveDensity", settings.objectiveDensity)}${numberField("Weirdness", "weirdness", settings.weirdness)}<fieldset class="setup-camp-control"${version !== 5 ? " disabled" : ""}>${numberField("Neutral camp density · v5", "neutralCamps", version === 5 ? (settings.neutralCamps ?? 0) : 0)}</fieldset></div><p class="muted">At most ${MAX_TOTAL_POPULATION} total population across active players. Closed slots use no budget. Reserves are finite; income changes collection speed equally for every player.</p></section>
<section class="setup-section"><h2 class="section-label">Players and alliances</h2>${factionLegendHTML()}<div class="field-grid">${select(
    "Player slots",
    "playerCount",
    settings.aiPlayers + 1,
    [2, 3, 4, 5, 6].map((count) => [count, `${count} slots`]),
  )}${
    version !== 5
      ? `${select("Your faction", "faction", settings.faction, namedChoices(FACTIONS))}${select("Your commander", "commander", settings.commander, namedChoices(COMMANDERS))}${select(
          "Your controller",
          "aiControlPlayer",
          String(settings.aiControlPlayer),
          [
            ["false", "Human"],
            ["true", "AI observer match"],
          ],
        )}`
      : ""
  }</div><p class="muted">Only player 1 can use human controls. Match alliances to cooperate, with shared vision and allied victory. Keep two active players in opposing alliances. Changing slot count preserves remaining choices.</p>${version !== 5 ? '<p class="setup-warning">Legacy generator preserved. Choose v5 to edit player slots, or choose a Quick/Standard/Epic preset.</p>' : ""}<fieldset class="setup-slots"${version !== 5 ? " disabled" : ""}><legend>Player slot settings${version !== 5 ? " · requires v5" : ""}</legend>${slotControls}</fieldset></section>`;
}
export function renderSetupSummary(settings: GameSettings): string {
  const summary = summarizeSetup(settings);
  if (
    summary.activePlayers * settings.populationCap >= 500 ||
    MAP_DIMENSIONS[settings.mapSize] >= 120
  )
    summary.warnings.push(
      "Large-army warning: concentrated maximum armies may run slowly. Reduce population or player slots if needed. The total budget is not a smooth-performance guarantee.",
    );
  return `<section class="setup-summary" aria-label="Match setup summary"><h2>${esc(summary.headline)}</h2><ul>${summary.details.map((detail) => `<li>${esc(detail)}</li>`).join("")}</ul>${summary.warnings.map((w) => `<p class="setup-warning">${esc(w)}</p>`).join("")}${summary.errors.length ? `<div class="setup-errors" role="alert"><b>Before preview or launch:</b><ul>${summary.errors.map((error) => `<li>${esc(error)}</li>`).join("")}</ul></div>` : '<p class="setup-valid">Ready to preview or launch.</p>'}</section>`;
}
function readText(form: FormData, name: string): string | undefined {
  const values = form.getAll(name);
  if (!values.length) return undefined;
  if (values.length !== 1 || typeof values[0] !== "string")
    throw new Error(`Use one text value for ${name}.`);
  return values[0];
}
function readNumber(form: FormData, name: string): number | undefined {
  const value = readText(form, name);
  if (value === undefined) return undefined;
  if (
    !value.trim() ||
    !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim()) ||
    !Number.isFinite(Number(value))
  )
    throw new Error(`Enter a finite number for ${name}.`);
  return Number(value);
}
function readChoice<T extends string>(
  form: FormData,
  name: string,
  allowed: readonly T[],
): T | undefined {
  const value = readText(form, name);
  if (value === undefined) return undefined;
  if (!allowed.includes(value as T))
    throw new Error(`Choose a supported value for ${name}.`);
  return value as T;
}
/** Atomic full-form or sparse patch. Logical errors stay visible and are enforced by prepareSetup. */
export function readSetupControls(
  form: FormData,
  previous: GameSettings,
): GameSettings {
  const seed = readText(form, "seed");
  if (seed !== undefined && /^FC\d+\|/.test(seed.trim()))
    return {
      ...structuredClone(previous),
      ...decodeMapCode(seed),
      customMap: undefined,
    };
  if (seed !== undefined && (!seed.trim() || seed.length > 80))
    throw new Error(
      "Use a seed from 1 to 80 characters, or paste a complete FC3/FC4/FC5 code.",
    );
  const next = structuredClone(previous);
  if (seed !== undefined) next.seed = seed;
  const version = readNumber(form, "mapGenerationVersion");
  if (version !== undefined) {
    if (![3, 4, 5].includes(version))
      throw new Error("Choose generator v3, v4, or v5.");
    next.mapGenerationVersion = version as 3 | 4 | 5;
  }
  const count = readNumber(form, "playerCount") ?? previous.aiPlayers + 1;
  if (!Number.isInteger(count) || count < 2 || count > 6)
    throw new Error("Choose two to six player slots.");
  next.aiPlayers = count - 1;
  for (const key of Object.keys(
    MATCH_LIMITS,
  ) as (keyof typeof MATCH_LIMITS)[]) {
    const value = readNumber(form, key);
    if (value !== undefined) next[key] = value;
  }
  const enums = {
    biome: Object.keys(BIOMES),
    mapSize: Object.keys(MAP_DIMENSIONS),
    faction: Object.keys(FACTIONS),
    commander: Object.keys(COMMANDERS),
    difficulty: DIFFICULTIES,
    aiPersonality: PERSONALITIES,
    mode: ["domination", "conquest", "relic", "rush"],
    preset: ["balanced", "competitive", "wild", "chaotic"],
  };
  for (const [key, allowed] of Object.entries(enums)) {
    const value = readChoice(form, key, allowed);
    if (value !== undefined) Object.assign(next, { [key]: value });
  }
  const control = readChoice(form, "aiControlPlayer", ["true", "false"]);
  if (control !== undefined) next.aiControlPlayer = control === "true";
  if (next.mapGenerationVersion === 5) {
    next.slots = defaultMatchSlots(next).map((fallback, index) => {
      const slot: MapPlayerSlot = { ...(previous.slots?.[index] ?? fallback) };
      for (const field of SLOT_FIELDS) {
        const name = `slot-${index}-${field}`;
        if (field === "alliance") {
          const value = readNumber(form, name);
          if (value !== undefined) slot.alliance = value;
        } else {
          const value = readText(form, name);
          if (value !== undefined) Object.assign(slot, { [field]: value });
        }
      }
      return slot;
    });
    const local = next.slots[0];
    if (next.difficulty !== previous.difficulty)
      local.difficulty = next.difficulty;
    next.difficulty = local.difficulty;
    next.faction = local.faction;
    next.commander = local.commander;
    next.aiControlPlayer = local.controller === "ai";
    if (JSON.stringify(next.slots) !== JSON.stringify(previous.slots))
      next.matchScale = "custom";
  } else {
    next.slots = undefined;
    next.neutralCamps = 0;
    next.matchScale = "custom";
  }
  next.matchScale = currentMatchScale(next);
  next.customMap = undefined;
  return next;
}
