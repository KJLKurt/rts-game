import { MAP_DIMENSIONS } from './content';
import type { GameSettings } from './types';

export type MatchScaleId = 'quick' | 'standard' | 'epic' | 'custom';
export const MAX_TOTAL_POPULATION = 600;
export const MATCH_LIMITS = {
    duration: { min: 4, max: 180 }, populationCap: { min: 12, max: 200 },
    gameSpeed: { min: .5, max: 2 }, incomeRate: { min: .5, max: 3 },
    startingGold: { min: 0, max: 100_000 }, startingWood: { min: 0, max: 100_000 },
    resourceAbundance: { min: .3, max: 5 }, terrainRoughness: { min: 0, max: 2 },
    water: { min: 0, max: 2 }, neutralCamps: { min: 0, max: 2 },
    objectiveDensity: { min: 0, max: 2 }, weirdness: { min: 0, max: 2 },
} as const;
export interface MatchScalePreset {
    id: Exclude<MatchScaleId, 'custom'>;
    name: string;
    durationLabel: string;
    description: string;
    settings: Pick<GameSettings, 'duration' | 'mapSize' | 'aiPlayers' | 'populationCap' | 'startingGold' | 'startingWood' | 'resourceAbundance' | 'objectiveDensity' | 'neutralCamps' | 'incomeRate' | 'gameSpeed'>;
}
/** Duration is a pacing target in game-minutes, never a guaranteed ending. */
export const MATCH_SCALE_PRESETS: Record<Exclude<MatchScaleId, 'custom'>, MatchScalePreset> = {
    quick: { id: 'quick', name: 'Quick', durationLabel: '8–12 min', description: 'A close duel with faster supply income and a compact army.', settings: { duration: 10, mapSize: 'small', aiPlayers: 1, populationCap: 60, startingGold: 300, startingWood: 320, resourceAbundance: 1.2, incomeRate: 1.25, gameSpeed: 1, objectiveDensity: 1, neutralCamps: 0 } },
    standard: { id: 'standard', name: 'Standard', durationLabel: '15–20 min', description: 'Three commanders contest a broad frontier with room to expand and field combined armies.', settings: { duration: 18, mapSize: 'large', aiPlayers: 2, populationCap: 100, startingGold: 230, startingWood: 260, resourceAbundance: 1, incomeRate: 1, gameSpeed: 1, objectiveDensity: 1, neutralCamps: .5 } },
    epic: { id: 'epic', name: 'Epic', durationLabel: '30–45+ min', description: 'Four commanders, a broad frontier, deeper reserves and larger armies.', settings: { duration: 40, mapSize: 'giant', aiPlayers: 3, populationCap: 150, startingGold: 350, startingWood: 400, resourceAbundance: 1.5, incomeRate: 1, gameSpeed: 1, objectiveDensity: 1.5, neutralCamps: 1 } },
};
export function applyMatchScale(settings: GameSettings, scale: MatchScaleId): GameSettings {
    if (scale === 'custom') return { ...settings, matchScale: 'custom' };
    const next = { ...settings, ...MATCH_SCALE_PRESETS[scale].settings, matchScale: scale, mapGenerationVersion: 5 as const };
    delete next.slots; delete next.customMap;
    return next;
}
/** Editing paired values should not keep an inaccurate preset label. */
export function currentMatchScale(settings: GameSettings): MatchScaleId {
    const selected = settings.matchScale;
    if (!selected || selected === 'custom' || !Object.hasOwn(MATCH_SCALE_PRESETS, selected)) return 'custom';
    const paired = MATCH_SCALE_PRESETS[selected].settings;
    return Object.entries(paired).every(([key, value]) => settings[key as keyof GameSettings] === value)
        && (!settings.slots || settings.slots.filter(slot => slot.controller !== 'closed').length === paired.aiPlayers + 1) ? selected : 'custom';
}
/** Shared import/restore validation; malformed input is never silently repaired. */
export function validateScaleSettings(settings: Partial<GameSettings>, options: { allowLegacyPopulationBudget?: boolean } = {}): string[] {
    const errors: string[] = [];
    for (const [key, limits] of Object.entries(MATCH_LIMITS)) {
        const value = settings[key as keyof typeof MATCH_LIMITS];
        if (value === undefined) continue;
        if (typeof value !== 'number' || !Number.isFinite(value) || value < limits.min || value > limits.max) errors.push(`${key} must be between ${limits.min} and ${limits.max}.`);
    }
    for (const key of ['populationCap', 'startingGold', 'startingWood'] as const)
        if (settings[key] !== undefined && !Number.isInteger(settings[key])) errors.push(`${key} must be a whole number.`);
    if (settings.aiPlayers !== undefined && (!Number.isInteger(settings.aiPlayers) || settings.aiPlayers < 1 || settings.aiPlayers > 5)) errors.push('Choose one to five rival slots.');
    if (settings.mapSize !== undefined && !Object.hasOwn(MAP_DIMENSIONS, settings.mapSize)) errors.push('Unknown map size.');
    if (settings.mapGenerationVersion !== undefined && ![3, 4, 5].includes(settings.mapGenerationVersion)) errors.push('Unknown map generation version.');
    if (settings.matchScale !== undefined && !['quick', 'standard', 'epic', 'custom'].includes(settings.matchScale)) errors.push('Unknown match scale.');
    if (settings.mapGenerationVersion !== 5 && (settings.mapSize === 'giant' || settings.mapSize === 'colossal')) errors.push('Giant and Colossal maps require generator v5.');
    if (settings.mapGenerationVersion !== 5 && settings.duration !== undefined && settings.duration > 90 && !settings.customMap) errors.push('Targets longer than 90 minutes require generator v5.');
    const active = Array.isArray(settings.slots) ? settings.slots.filter(slot => slot && slot.controller !== 'closed').length : (settings.aiPlayers ?? 1) + 1;
    const restoreLegacyBudget = options.allowLegacyPopulationBudget && settings.mapGenerationVersion !== 5 && !settings.slots;
    if (!restoreLegacyBudget && settings.populationCap !== undefined && active * settings.populationCap > MAX_TOTAL_POPULATION) errors.push(`These ${active} players support up to ${Math.min(200, Math.floor(MAX_TOTAL_POPULATION / active))} population each (${MAX_TOTAL_POPULATION} total).`);
    return errors;
}
/** Device-neutral load information, never a measured FPS claim. */
export function scaleLoadWarning(settings: Pick<GameSettings, 'mapSize' | 'aiPlayers' | 'populationCap' | 'slots'>): string | null {
    const active = settings.slots?.filter(s => s.controller !== 'closed').length ?? settings.aiPlayers + 1;
    if (active * settings.populationCap > 600) return 'Very large armies: lower population or player count if play slows on your device.';
    if (settings.populationCap > 120 || MAP_DIMENSIONS[settings.mapSize] >= 120) return 'Large battlefield: performance depends on your device and the armies in play.';
    return null;
}
/** Sparse custom maps scale score targets to their attainable capture income. */
export function dominationScoreTarget(settings: Pick<GameSettings, 'duration' | 'mode'>, relicCount = 3): number {
    const count = Math.min(3, Math.max(1, Math.floor(relicCount)));
    const controlRate = count === 1 ? .5 : count === 2 ? 1 : 1.4;
    return Math.round(settings.duration * 80 * controlRate / 1.4 * (settings.mode === 'relic' ? 1.15 : 1));
}
export function defaultMatchSlots(settings: Pick<GameSettings, 'aiPlayers' | 'aiControlPlayer' | 'faction' | 'commander' | 'aiPersonality' | 'difficulty'>): import('./scenario-types').MapPlayerSlot[] {
    const factions = ['ironhold', 'wildborn', 'arcanists'] as const;
    const commanders = ['warlord', 'ranger', 'engineer'] as const;
    return Array.from({ length: Math.min(6, Math.max(2, settings.aiPlayers + 1)) }, (_, index) => ({
        name: index === 0 ? 'You' : `Rival ${index}`, controller: index === 0 && !settings.aiControlPlayer ? 'human' as const : 'ai' as const,
        alliance: index, faction: index === 0 ? settings.faction : factions[index % factions.length], commander: index === 0 ? settings.commander : commanders[index % commanders.length], personality: settings.aiPersonality, difficulty: settings.difficulty,
    }));
}
