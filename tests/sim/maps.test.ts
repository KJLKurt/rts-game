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
describe('generator version and economic symmetry', () => {
    it('freezes explicit v3 map layouts byte for byte', async () => {
        const { createHash } = await import('node:crypto');
        const fixtures: [
            string,
            BiomeId,
            MapSize,
            string
        ][] = [['LEGACY-0', 'grasslands', 'small', '1c1c884274ed1627fdc019ab99f3ee348d71f8ee8e9bd9b64c0c8b749a993dd2'], ['LEGACY-1', 'forest', 'medium', 'a8d5ef0c50dd72c27ee56c695987723b0316442f5799d5907f98d6b7b2f50edb'], ['LEGACY-2', 'desert', 'tiny', 'd95c0bef67c0d007a38c0c0c687378300578613edd1fa2a3ff51a68934685878'], ['LEGACY-3', 'snow', 'large', 'c24167e40f1e5b470c53d82c6677b66e05fce711f079fa420c91033d3f495939']];
        for (const [seed, biome, mapSize, hash] of fixtures) {
            const map = generateMap({ ...DEFAULT_SETTINGS, mapGenerationVersion: 3, seed, biome, mapSize });
            expect(map.version).toBe(3);
            expect(createHash('sha256').update(JSON.stringify(map)).digest('hex')).toBe(hash);
        }
    });
    it('uses v4 by default and supplies matching gold and timber reserves on both flanks', () => {
        const map = generateMap({ ...DEFAULT_SETTINGS, mapSize: 'small', preset: 'competitive' });
        expect(map.version).toBe(4);
        const reserves = map.nodes.slice(-4);
        expect(reserves.filter(n => n.kind === 'gold')).toHaveLength(2);
        expect(reserves.filter(n => n.kind === 'wood')).toHaveLength(2);
        for (const n of reserves) {
            const mirror = reserves.find(o => o.id !== n.id && o.kind === n.kind && Math.abs(o.x - (map.width - n.x)) < .01 && Math.abs(o.y - (map.height + 1 - n.y)) < .01);
            expect(mirror).toBeDefined();
            expect(mirror!.amount).toBe(n.amount);
        }
        const legacy = generateMap({ ...DEFAULT_SETTINGS, mapSize: 'small', mapGenerationVersion: 3 });
        expect(legacy.version).toBe(3);
        expect(map.nodes.length).toBe(legacy.nodes.length + 2);
        expect(map.tiles).not.toEqual(legacy.tiles);
    });
    it('refuses unsupported generator versions', () => { expect(() => generateMap({ ...DEFAULT_SETTINGS, mapGenerationVersion: 99 as 4 })).toThrow('generation version'); });
});
