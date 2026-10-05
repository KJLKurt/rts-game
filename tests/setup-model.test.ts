import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../src/sim/content';
import { applyMatchScale, defaultMatchSlots, dominationScoreTarget, validateScaleSettings } from '../src/sim/scales';
import { prepareSetup, selectSetupScale, setSetupPlayerCount, setSetupSlot, summarizeSetup, validateSetup } from '../src/ui/setup-model';
import { encodeMapCode, decodeMapCode } from '../src/ui/map-code';

describe('paired match scales and player slots', () => {
    it('pairs three distinct scales within the supported army budget', () => {
        for (const id of ['quick', 'standard', 'epic'] as const) {
            const settings = selectSetupScale(DEFAULT_SETTINGS, id);
            expect(validateSetup(settings)).toEqual([]);
            expect(settings.mapGenerationVersion).toBe(5);
            expect(settings.slots).toHaveLength(settings.aiPlayers + 1);
            expect(summarizeSetup(settings).errors).toEqual([]);
        }
        expect(selectSetupScale(DEFAULT_SETTINGS, 'quick').incomeRate).toBeGreaterThan(1);
        expect(selectSetupScale(DEFAULT_SETTINGS, 'standard')).toMatchObject({ duration: 18, mapSize: 'large', aiPlayers: 2, populationCap: 100 });
        expect(selectSetupScale(DEFAULT_SETTINGS, 'epic')).toMatchObject({ duration: 40, mapSize: 'giant', populationCap: 150, aiPlayers: 3 });
        expect(summarizeSetup({ ...selectSetupScale(DEFAULT_SETTINGS, 'quick'), duration: 45 }).headline).toContain('Custom');
    });
    it('supports long custom targets independently of world size and playback speed', () => {
        const settings = { ...selectSetupScale(DEFAULT_SETTINGS, 'quick'), matchScale: 'custom' as const, duration: 180, mapSize: 'colossal' as const, populationCap: 200, gameSpeed: .5 };
        expect(prepareSetup(settings)).toMatchObject({ duration: 180, populationCap: 200, gameSpeed: .5 });
        const summary = summarizeSetup(settings);
        expect(summary.details.join(' ')).toContain('360 real-minute');
        expect(summary.maximumPopulationPerPlayer).toBe(200);
        expect(summary.warnings.length).toBeGreaterThan(0);
    });
    it('keeps closed slot indices and requires an opposing alliance', () => {
        let settings = setSetupPlayerCount(selectSetupScale(DEFAULT_SETTINGS, 'standard'), 4);
        settings = setSetupSlot(settings, 1, { controller: 'closed' });
        settings = setSetupSlot(settings, 2, { alliance: 0, personality: 'economic' });
        expect(prepareSetup(settings).slots?.[1].controller).toBe('closed');
        expect(summarizeSetup(settings)).toMatchObject({ activePlayers: 3, allianceCount: 2 });
        settings = setSetupSlot(settings, 3, { alliance: 0 });
        expect(validateSetup(settings).join(' ')).toContain('opposing alliances');
        expect(validateSetup(setSetupSlot(settings, 2, { controller: 'human' })).join(' ')).toContain('Only player 1');
    });
    it('enforces numeric/version limits and 600 population without rejecting legal legacy restores', () => {
        const six = setSetupPlayerCount(selectSetupScale(DEFAULT_SETTINGS, 'standard'), 6);
        expect(validateSetup({ ...six, populationCap: 100 })).toEqual([]);
        expect(validateSetup({ ...six, populationCap: 101 }).join(' ')).toContain('600 total');
        expect(validateScaleSettings({ duration: Infinity, startingWood: -1, populationCap: 99.5 }).length).toBeGreaterThan(2);
        expect(validateScaleSettings({ mapGenerationVersion: 4, mapSize: 'giant' }).join(' ')).toContain('v5');
        expect(validateScaleSettings({ mapGenerationVersion: 4, duration: 180 }).join(' ')).toContain('v5');
        const legacy = { mapGenerationVersion: 4 as const, aiPlayers: 5, populationCap: 120 };
        expect(validateScaleSettings(legacy).join(' ')).toContain('600 total');
        expect(validateScaleSettings(legacy, { allowLegacyPopulationBudget: true })).toEqual([]);
        expect(validateScaleSettings({ ...legacy, mapGenerationVersion: 5 }, { allowLegacyPopulationBudget: true }).join(' ')).toContain('600 total');
        expect(defaultMatchSlots({ ...DEFAULT_SETTINGS, aiControlPlayer: true })[0].controller).toBe('ai');
        expect(applyMatchScale({ ...DEFAULT_SETTINGS, customMap: {} as never }, 'standard').customMap).toBeUndefined();
    });
    it('normalizes sparse relic races against attainable income', () => {
        expect(dominationScoreTarget(DEFAULT_SETTINGS, 1)).toBeLessThan(dominationScoreTarget(DEFAULT_SETTINGS, 3));
        expect(dominationScoreTarget({ ...DEFAULT_SETTINGS, mode: 'relic' }, 1)).toBeGreaterThan(dominationScoreTarget(DEFAULT_SETTINGS, 1));
    });
});

describe('version 5 match codes', () => {
    it('clears v5-only settings on legacy import', () => {
        const restored = { ...selectSetupScale(DEFAULT_SETTINGS, 'epic'), ...decodeMapCode(encodeMapCode(DEFAULT_SETTINGS, 4)) };
        expect(restored.slots).toBeUndefined(); expect(restored.neutralCamps).toBe(0);
        expect(validateSetup(restored)).toEqual([]);
    });
    it('round trips rules, names, teams and closed slots', () => {
        let settings = selectSetupScale({ ...DEFAULT_SETTINGS, seed: 'A | & 🌲', weirdness: .6, water: .3 }, 'epic');
        settings = setSetupSlot(settings, 1, { controller: 'closed' });
        settings = setSetupSlot(settings, 2, { alliance: 0, difficulty: 'hard', personality: 'economic' });
        settings = { ...settings, duration: 120, gameSpeed: .75, incomeRate: 1.5, populationCap: 200 };
        expect({ ...DEFAULT_SETTINGS, ...decodeMapCode(encodeMapCode(settings, 5)) }).toEqual(settings);
    });
    it('rejects extra fields, unsupported controllers and oversized or malformed encodings', () => {
        const settings = selectSetupScale(DEFAULT_SETTINGS, 'standard');
        const code = encodeMapCode(settings, 5), fields = code.split('|');
        const data = JSON.parse(decodeURIComponent(fields[13]));
        data.slots[1].controller = 'human'; fields[13] = encodeURIComponent(JSON.stringify(data));
        expect(() => decodeMapCode(fields.join('|'))).toThrow('Only player 1');
        data.slots[1].controller = 'ai'; data.customMap = {}; fields[13] = encodeURIComponent(JSON.stringify(data));
        expect(() => decodeMapCode(fields.join('|'))).toThrow('unsupported');
        delete data.customMap; data.slots = null; fields[13] = encodeURIComponent(JSON.stringify(data));
        expect(() => decodeMapCode(fields.join('|'))).toThrow();
        expect(() => decodeMapCode(code.replace(encodeURIComponent(settings.seed), '%ZZ'))).toThrow('encoding');
        expect(() => decodeMapCode('x'.repeat(12001))).toThrow('size');
    });
});
