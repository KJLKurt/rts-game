import { BIOMES, MAP_DIMENSIONS } from '../sim/content';
import { parseBoundedJSON } from '../sim/validation';
import { defaultMatchSlots, validateScaleSettings } from '../sim/scales';
import { validateSetup } from './setup-model';
import type { GameSettings } from '../sim/types';

const MAX_CODE_LENGTH = 12_000;
/** FC3/FC4 are frozen generator codes; FC5 includes complete rules and slots. */
export function encodeMapCode(settings: GameSettings, version: number): string {
    if (![3, 4, 5].includes(version)) throw new Error('Unsupported map code version.');
    const fields: (number | string)[] = [`FC${version}`, encodeURIComponent(settings.seed), settings.biome, settings.mapSize, settings.aiPlayers, settings.preset, settings.duration, settings.resourceAbundance, settings.terrainRoughness, settings.water, settings.objectiveDensity, settings.weirdness, settings.mode];
    if (version === 5) {
        const complete = { ...settings, mapGenerationVersion: 5 as const, slots: settings.slots ?? defaultMatchSlots(settings) };
        const errors = validateSetup(complete);
        if (errors.length) throw new Error(errors.join(' '));
        fields.push(encodeURIComponent(JSON.stringify({
            matchScale: settings.matchScale ?? 'custom', difficulty: settings.difficulty, faction: settings.faction, commander: settings.commander, aiControlPlayer: settings.aiControlPlayer, aiPersonality: settings.aiPersonality,
            populationCap: settings.populationCap, startingGold: settings.startingGold, startingWood: settings.startingWood, gameSpeed: settings.gameSpeed ?? 1, incomeRate: settings.incomeRate ?? 1, neutralCamps: settings.neutralCamps ?? 0, slots: complete.slots,
        })));
    }
    return fields.join('|');
}
export function decodeMapCode(code: string): Partial<GameSettings> {
    if (typeof code !== 'string' || code.length > MAX_CODE_LENGTH) throw new Error('That map code exceeds the supported size.');
    const parts = code.trim().split('|');
    if (!/^FC[345]$/.test(parts[0]) || parts.length !== (parts[0] === 'FC5' ? 14 : 13)) throw new Error('That map code is incomplete or from an unsupported version.');
    let seed: string;
    try { seed = decodeURIComponent(parts[1]); } catch { throw new Error('That map code has an invalid seed encoding.'); }
    const version = Number(parts[0].slice(2)) as 3 | 4 | 5;
    if (!seed.trim() || seed.length > 80 || !Object.hasOwn(BIOMES, parts[2]) || !Object.hasOwn(MAP_DIMENSIONS, parts[3]) || !['balanced', 'competitive', 'wild', 'chaotic'].includes(parts[5]) || !['domination', 'conquest', 'relic', 'rush'].includes(parts[12])) throw new Error('That map code has an invalid seed or setting.');
    const indices = [4, 6, 7, 8, 9, 10, 11];
    if (indices.some(i => parts[i].trim() === '')) throw new Error('That map code has a missing number.');
    const values = indices.map(i => Number(parts[i]));
    if (values.some(n => !Number.isFinite(n)) || values[0] < 1 || values[0] > 5 || !Number.isInteger(values[0]) || values[1] < 4 || values[1] > (version === 5 ? 180 : 90) || values[2] < .3 || values[2] > 5 || values.slice(3).some(n => n < 0 || n > 2)) throw new Error('That map code has an invalid range.');
    const settings: Partial<GameSettings> = { seed, mode: parts[12] as GameSettings['mode'], mapGenerationVersion: version, biome: parts[2] as GameSettings['biome'], mapSize: parts[3] as GameSettings['mapSize'], aiPlayers: values[0], preset: parts[5] as GameSettings['preset'], duration: values[1], resourceAbundance: values[2], terrainRoughness: values[3], water: values[4], objectiveDensity: values[5], weirdness: values[6] };
    if (version < 5) Object.assign(settings, { slots: undefined, neutralCamps: 0, matchScale: 'custom', customMap: undefined });
    if (version === 5) {
        let data: unknown;
        try { data = parseBoundedJSON(decodeURIComponent(parts[13]), 8000); } catch { throw new Error('That match code contains invalid rules.'); }
        const allowed = ['matchScale', 'difficulty', 'faction', 'commander', 'aiControlPlayer', 'aiPersonality', 'populationCap', 'startingGold', 'startingWood', 'gameSpeed', 'incomeRate', 'neutralCamps', 'slots'];
        if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).some(key => !allowed.includes(key)) || allowed.some(key => !Object.hasOwn(data, key))) throw new Error('That match code contains incomplete or unsupported rules.');
        Object.assign(settings, data);
        const errors = validateSetup(settings as GameSettings);
        if (errors.length) throw new Error(errors.join(' '));
    }
    const errors = validateScaleSettings(settings);
    if (errors.length) throw new Error(errors.join(' '));
    return settings;
}
