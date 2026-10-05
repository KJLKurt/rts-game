import { performance } from 'node:perf_hooks';
import { writeFileSync } from 'node:fs';
import { createGame, stepGame, spawnEntity, issueCommand, updateFog, generateMap, findPath, DEFAULT_SETTINGS, type GameMap } from '../src/sim';

/** Synthetic headless CPU evidence, not a renderer/FPS or physical-device benchmark. */
const args: Record<string, string | undefined> = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, '').split('=')));
const limit = (value: string | undefined, fallback: number, low: number, high: number) => Math.min(high, Math.max(low, Number(value) || fallback));
const ticks = Math.floor(limit(args.ticks, 120, 20, 1200));
const populations = (args.population ?? '80,200').split(',').map(p => Math.floor(limit(p, 80, 12, 200)));
const widths = (args.width ?? '54,120,160').split(',').map(p => Math.floor(limit(p, 54, 32, 160)));
const players = Math.floor(limit(args.players, 2, 2, 6));
const measure = (fn: () => void, repetitions = 1) => { const values: number[] = []; for (let n = 0; n < repetitions; n++) { const start = performance.now(); fn(); values.push(performance.now() - start); } values.sort((a, b) => a - b); return { mean: +(values.reduce((a, b) => a + b, 0) / values.length).toFixed(3), p50: +values[Math.floor(values.length * .5)].toFixed(3), p95: +values[Math.min(values.length - 1, Math.floor(values.length * .95))].toFixed(3), max: +values.at(-1)!.toFixed(3) }; };
function stressMap(width: number): GameMap {
    const map = generateMap({ ...DEFAULT_SETTINGS, seed: `SCALE-STRESS-${width}`, mapSize: 'medium', aiPlayers: players - 1 });
    const scale = width / map.width, old = map.width;
    map.tiles = Array.from({ length: width * width }, (_, i) => { const x = i % width, y = Math.floor(i / width); return x === 0 || y === 0 || x === width - 1 || y === width - 1 ? 'rock' : map.tiles[Math.floor(y / scale) * old + Math.floor(x / scale)]; });
    map.width = width; map.height = width;
    const oldSpawns = map.spawns;
    map.spawns = map.spawns.map(p => ({ x: Math.floor(p.x * scale) + .5, y: Math.floor(p.y * scale) + .5 }));
    map.nodes = map.nodes.map(p => ({ ...p, x: p.owner === null ? Math.floor(p.x * scale) + .5 : map.spawns[p.owner].x + p.x - oldSpawns[p.owner].x, y: p.owner === null ? Math.floor(p.y * scale) + .5 : map.spawns[p.owner].y + p.y - oldSpawns[p.owner].y }));
    for (const p of map.nodes) if (p.owner !== null) for (let y = Math.floor(p.y) - 2; y <= p.y + 2; y++) for (let x = Math.floor(p.x) - 2; x <= p.x + 2; x++) map.tiles[y * width + x] = 'grass';
    return map;
}
const results = [];
for (const width of widths) {
    const generation = measure(() => { stressMap(width); }, 3), map = stressMap(width);
    const path = measure(() => { if (!findPath(map, map.spawns[0], map.spawns[1]).length) throw new Error('Stress route unreachable'); }, 20);
    for (const population of populations) {
        const state = createGame({ seed: `SCALE-STRESS-${width}`, customMap: map, populationCap: Math.min(population, Math.floor(600 / players)), aiPlayers: players - 1 });
        state.players.forEach(p => p.ai = false);
        for (const p of state.players) {
            const spawn = state.map.spawns[p.team];
            for (let n = state.entities.filter(e => e.team === p.team && e.kind === 'unit').length; n < population; n++) { const ring = Math.floor(n / 20), angle = n * Math.PI / 10; spawnEntity(state, p.team, 'unit', 'swordsman', spawn.x + Math.cos(angle) * (5 + ring * .5), spawn.y + Math.sin(angle) * (5 + ring * .5)); }
        }
        const fog = measure(() => updateFog(state), 20), idle = measure(() => stepGame(state, .1), ticks);
        for (const p of state.players) issueCommand(state, { type: 'attackMove', team: p.team, entityIds: state.entities.filter(e => e.team === p.team && e.kind !== 'building').map(e => e.id), x: width / 2 + .5, y: width / 2 + .5 });
        const marching = measure(() => stepGame(state, .1), ticks);
        for (const p of state.players) state.entities.filter(e => e.team === p.team && e.kind !== 'building').forEach((e, n) => { e.x = width / 2 + (p.team % 2 ? 2 : -2) + (n % 10) * .15; e.y = width / 2 + Math.floor(n / 10) * .15; e.path = []; e.pathTarget = null; e.order = { type: 'hold' }; e.hp = e.maxHp; });
        updateFog(state);
        const combat = measure(() => stepGame(state, .1), ticks);
        const result = { width, players, populationPerPlayer: population, supportedBudget: population * players <= 600, initialEntities: players * (population + 3), finalEntities: state.entities.length, generationMs: generation, pathMs: path, fogMs: fog, idleTickMs: idle, marchingTickMs: marching, combatTickMs: combat };
        results.push(result); console.log(JSON.stringify(result));
    }
}
const report = { note: 'Synthetic headless CPU benchmark. Each simulation tick is 100ms game time. No renderer, browser, mobile, power or FPS conclusions. Scaled v4 stress layouts are fixtures, not advertised v5 maps.', node: process.version, ticksPerPhase: ticks, results };
if (args.output) writeFileSync(args.output, `${JSON.stringify(report, null, 2)}\n`);
