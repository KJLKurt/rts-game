import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { DEFAULT_SETTINGS, MAP_DIMENSIONS } from '../../src/sim/content';
import { generateMap, distance, findPath, validateMap } from '../../src/sim/maps';
import { applyMatchScale } from '../../src/sim/scales';
import { decodeMapCode, encodeMapCode } from '../../src/ui/map-code';
import type { MapSize } from '../../src/sim/types';

describe('version 5 expanded frontiers', () => {
    it('replays complete codes including terrain, supplies and camps', () => {
        const settings = { ...applyMatchScale(DEFAULT_SETTINGS, 'epic'), seed: 'FRONTIER-V5', weirdness: 1 };
        const map = generateMap(settings), replay = generateMap({ ...DEFAULT_SETTINGS, ...decodeMapCode(encodeMapCode(settings, 5)) });
        expect(replay).toEqual(map); expect(map.width).toBe(120);
        expect(map.scenario?.camps.length).toBeGreaterThan(0);
        expect(map.nodes.filter(n => n.kind === 'relic')).toHaveLength(7);
        expect(map.nodes.filter(n => n.kind !== 'relic' && n.owner === null).length).toBeGreaterThan(12);
    });
    it('validates 72 large worlds and reachable safe camps across varied inputs', () => {
        for (let seed = 0; seed < 72; seed++) {
            const mapSize: MapSize = seed % 2 ? 'giant' : 'colossal', aiPlayers = seed % 5 + 1;
            const settings = { ...DEFAULT_SETTINGS, seed: `v5-${seed}`, mapGenerationVersion: 5 as const, mapSize, aiPlayers, populationCap: 100, neutralCamps: 1.5, terrainRoughness: seed % 3 * .65, water: seed % 2 * .7, weirdness: seed % 3, objectiveDensity: seed % 3 * .75, biome: (['grasslands', 'forest', 'desert', 'snow'] as const)[seed % 4] };
            const map = generateMap(settings);
            expect(map.width).toBe(MAP_DIMENSIONS[mapSize]); expect(map.validation.errors, settings.seed).toEqual([]);
            expect(validateMap(map).valid).toBe(true);
            expect(findPath(map, map.spawns[0], map.spawns.at(-1)!).length).toBeGreaterThan(0);
            for (const camp of map.scenario?.camps ?? []) {
                expect(map.spawns.every(spawn => distance(spawn, camp) >= 17)).toBe(true);
                expect(findPath(map, map.spawns[0], camp).length).toBeGreaterThan(0);
            }
        }
    }, 20000);
    it('keeps competitive approaches fair at all 35 size/player-count combinations', () => {
        for (const mapSize of Object.keys(MAP_DIMENSIONS) as MapSize[]) for (let aiPlayers = 1; aiPlayers <= 5; aiPlayers++) {
            const map = generateMap({ ...DEFAULT_SETTINGS, mapGenerationVersion: 5, seed: 'V5-COMPETITIVE', mapSize, aiPlayers, populationCap: 100, preset: 'competitive' });
            expect(map.validation.errors, `${mapSize}/${aiPlayers}`).toEqual([]); expect(map.validation.fairness).toBeGreaterThanOrEqual(.75);
        }
    });
    it('makes weirdness and long reserves meaningful while preserving the prior v4 byte hash', () => {
        const base = { ...DEFAULT_SETTINGS, mapGenerationVersion: 5 as const };
        expect(generateMap({ ...base, weirdness: 1 }).tiles).not.toEqual(generateMap(base).tiles);
        expect(generateMap({ ...base, duration: 90 }).nodes[0].amount).toBe(generateMap(base).nodes[0].amount * 5);
        const v4 = generateMap({ ...DEFAULT_SETTINGS, mapGenerationVersion: 4, seed: 'LEGACY-0', mapSize: 'small' });
        expect(createHash('sha256').update(JSON.stringify(v4)).digest('hex')).toBe('893f9b6596e5fe5c1289ad79ed2ebb7ccae253429c44ded9ddc98db34c8209b2');
    });
    it('does not demand an economy or walkable spawn for an authored closed slot', () => {
        const map = generateMap(applyMatchScale(DEFAULT_SETTINGS, 'standard'));
        map.scenario!.slots[1].controller = 'closed'; map.spawns[1] = { x: .5, y: .5 };
        expect(validateMap(map, true).errors).toEqual([]);
        map.scenario!.slots[1].controller = 'ai'; expect(validateMap(map).errors.join(' ')).toContain('Player 2');
    });
});
