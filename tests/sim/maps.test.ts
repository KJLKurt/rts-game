import { describe, it, expect } from 'vitest';
import { generateMap, validateMap, DEFAULT_SETTINGS, findPath, isWalkable, BIOMES, MAP_DIMENSIONS, type BiomeId, type MapSize } from '../../src/sim';
describe('seeded map generation', () => {
    it('reproduces exact terrain and nodes', () => { const a = generateMap({ ...DEFAULT_SETTINGS, seed: 'JON-492817' }), b = generateMap({ ...DEFAULT_SETTINGS, seed: 'JON-492817' }); expect(a).toEqual(b); expect(generateMap({ ...DEFAULT_SETTINGS, seed: 'OTHER' }).tiles).not.toEqual(a.tiles); });
    it('validates 400 maps across seeds, biomes, sizes and player counts', () => {
        for (let seed = 0; seed < 400; seed++) {
            const biome = Object.keys(BIOMES)[seed % 4] as BiomeId, mapSize = Object.keys(MAP_DIMENSIONS)[Math.floor(seed / 4) % 5] as MapSize;
            const map = generateMap({ ...DEFAULT_SETTINGS, seed: `map-test-${seed}`, biome, mapSize, aiPlayers: seed % 5 + 1, preset: seed % 3 === 0 ? 'competitive' : 'balanced' });
            const result = validateMap(map);
            expect(result.errors, `${seed}/${biome}/${mapSize}`).toEqual([]);
            expect(result.reachablePercent).toBeGreaterThan(.8);
        }
    }, 30000);
    it('finds a valid path between opponents without crossing blocked terrain', () => {
        const map = generateMap(DEFAULT_SETTINGS), path = findPath(map, map.spawns[0], map.spawns[1]);
        expect(path.length).toBeGreaterThan(0);
        for (const p of path)
            expect(isWalkable(map, p.x, p.y)).toBe(true);
    });
    it('rejects unreachable spawns and malformed maps', () => { const map = generateMap(DEFAULT_SETTINGS); map.tiles.fill('water'); expect(validateMap(map).valid).toBe(false); map.tiles = []; expect(validateMap(map).errors).toContain('Terrain count does not match map dimensions.'); });
});
