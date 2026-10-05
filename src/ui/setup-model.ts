import { BIOMES, COMMANDERS, FACTIONS, MAP_DIMENSIONS } from '../sim/content';
import { applyMatchScale, currentMatchScale, defaultMatchSlots, MATCH_SCALE_PRESETS, MAX_TOTAL_POPULATION, scaleLoadWarning, validateScaleSettings, type MatchScaleId } from '../sim/scales';
import { validateMapPlayerSlots } from '../sim/scenarios';
import type { MapPlayerSlot } from '../sim/scenario-types';
import type { GameSettings } from '../sim/types';

export { MATCH_SCALE_PRESETS };
export const SETUP_SPEEDS = [.5, .75, 1, 1.5, 2] as const;
export const SETUP_POPULATIONS = [40, 60, 80, 100, 120, 150, 200] as const;
export const SETUP_RESOURCES = [0, 150, 230, 350, 500, 1000, 2500, 10000] as const;
export function setupSlots(settings: GameSettings): MapPlayerSlot[] {
    return settings.slots ? structuredClone(settings.slots) : defaultMatchSlots(settings);
}
export function selectSetupScale(settings: GameSettings, scale: MatchScaleId): GameSettings {
    const next = applyMatchScale(settings, scale);
    return { ...next, slots: next.mapGenerationVersion === 5 ? setupSlots(next) : undefined };
}
export function setSetupSlot(settings: GameSettings, index: number, patch: Partial<MapPlayerSlot>): GameSettings {
    const slots = setupSlots(settings);
    if (!Number.isInteger(index) || !slots[index]) throw new RangeError('Choose an existing player slot.');
    slots[index] = { ...slots[index], ...patch };
    return { ...settings, slots, matchScale: 'custom', mapGenerationVersion: 5, aiPlayers: slots.length - 1, aiControlPlayer: slots[0].controller === 'ai', faction: slots[0].faction, commander: slots[0].commander };
}
export function setSetupPlayerCount(settings: GameSettings, count: number): GameSettings {
    if (!Number.isInteger(count) || count < 2 || count > 6) throw new RangeError('Choose two to six player slots.');
    const previous = setupSlots(settings), defaults = defaultMatchSlots({ ...settings, aiPlayers: count - 1 });
    const slots = defaults.map((slot, index) => previous[index] ?? slot);
    return { ...settings, slots, aiPlayers: count - 1, matchScale: 'custom', mapGenerationVersion: 5 };
}
export function validateSetup(settings: GameSettings): string[] {
    const errors = validateScaleSettings(settings);
    if (typeof settings.seed !== 'string' || !settings.seed.trim() || settings.seed.length > 80) errors.push('Use a seed from 1 to 80 characters.');
    if (!Object.hasOwn(BIOMES, settings.biome) || !Object.hasOwn(FACTIONS, settings.faction) || !Object.hasOwn(COMMANDERS, settings.commander)) errors.push('Choose a known biome, faction, and commander.');
    if (!['easy', 'normal', 'hard', 'brutal'].includes(settings.difficulty) || !['aggressive', 'defensive', 'economic', 'raider', 'expansionist', 'adaptive'].includes(settings.aiPersonality)) errors.push('Choose a known AI difficulty and personality.');
    if (!['domination', 'conquest', 'relic', 'rush'].includes(settings.mode) || !['balanced', 'competitive', 'wild', 'chaotic'].includes(settings.preset)) errors.push('Choose a known victory mode and generation preset.');
    if (typeof settings.aiControlPlayer !== 'boolean') errors.push('AI player control must be on or off.');
    errors.push(...validateMapPlayerSlots(settings.slots === undefined ? defaultMatchSlots(settings) : settings.slots));
    if (settings.slots && settings.slots.length !== settings.aiPlayers + 1) errors.push('Player count must match the configured slots.');
    if (settings.mapGenerationVersion !== 5 && ((settings.neutralCamps ?? 0) > 0 || settings.slots)) errors.push('Custom player slots and neutral camps require generator v5.');
    return errors;
}
export interface SetupSummary { headline: string; details: string[]; warnings: string[]; errors: string[]; activePlayers: number; allianceCount: number; maximumPopulationPerPlayer: number }
export function summarizeSetup(settings: GameSettings): SetupSummary {
    const slots = setupSlots(settings), active = slots.filter(slot => slot.controller !== 'closed');
    const allianceCount = new Set(active.map(slot => slot.alliance)).size;
    const width = MAP_DIMENSIONS[settings.mapSize], speed = settings.gameSpeed ?? 1;
    const maximumPopulationPerPlayer = Math.min(200, Math.floor(MAX_TOTAL_POPULATION / Math.max(1, active.length)));
    const scale = currentMatchScale(settings);
    const title = scale === 'custom' ? 'Custom' : MATCH_SCALE_PRESETS[scale].name;
    const warning = scaleLoadWarning(settings), warnings = warning ? [warning] : [];
    if (settings.duration > 45) warnings.push('Long custom match: supply reserves and escalation follow the longer pacing target.');
    const details = [
        `${active.length} commanders in ${allianceCount} opposing alliances · ${width} × ${width} tiles`,
        `${settings.populationCap} population per player · ${active.length * settings.populationCap}/${MAX_TOTAL_POPULATION} total budget · current setup supports ${maximumPopulationPerPlayer} each`,
        `${settings.startingGold} gold + ${settings.startingWood} wood per player · ${settings.incomeRate ?? 1}× deposit income · ${settings.resourceAbundance}× reserves`,
        `${speed}× game speed · ${Math.round(settings.duration / speed * 10) / 10} real-minute pacing target`,
        `Escalation begins at ${settings.duration / 2} game-minutes; victories can come earlier or later.`,
    ];
    if (settings.mode === 'conquest') details.push(`Frontier storm begins at ${settings.duration * 2} game-minutes; survival is resolved by ${settings.duration * 3}.`);
    return { headline: `${title} · ${settings.duration} game-minute target`, details, warnings, errors: validateSetup(settings), activePlayers: active.length, allianceCount, maximumPopulationPerPlayer };
}
/** Canonical conversion before preview, launch or copying complete match rules. */
export function prepareSetup(settings: GameSettings): GameSettings {
    const errors = validateSetup(settings);
    if (errors.length) throw new Error(errors.join(' '));
    return { ...settings, slots: settings.mapGenerationVersion === 5 ? setupSlots(settings) : undefined, gameSpeed: settings.gameSpeed ?? 1, incomeRate: settings.incomeRate ?? 1, neutralCamps: settings.neutralCamps ?? 0 };
}
