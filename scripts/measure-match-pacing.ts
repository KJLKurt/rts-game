import { performance } from 'node:perf_hooks';
import { writeFileSync } from 'node:fs';
import { createGame, stepGame, DEFAULT_SETTINGS, MAP_DIMENSIONS, type AIPersonality, type MapSize } from '../src/sim';
import { applyMatchScale, defaultMatchSlots } from '../src/sim/scales';

const args: Record<string, string | undefined> = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, '').split('=')));
const scales = (args.scales ?? 'quick,standard,epic').split(',').filter((s): s is 'quick' | 'standard' | 'epic' => ['quick', 'standard', 'epic'].includes(s));
const personalities = (args.policies ?? 'aggressive,defensive,economic').split(',').filter((s): s is AIPersonality => ['aggressive', 'defensive', 'economic', 'adaptive', 'raider', 'expansionist'].includes(s));
const results = [];
for (const scale of scales) for (const personality of personalities) {
    const settings = applyMatchScale({ ...DEFAULT_SETTINGS, seed: `PACING-${scale}-${personality}`, aiControlPlayer: true, aiPersonality: personality }, scale);
    if (args.duration && Number.isFinite(Number(args.duration)) && Number(args.duration) >= 4 && Number(args.duration) <= 180) { settings.duration = Number(args.duration); settings.matchScale = 'custom'; }
    if (args.players && Number.isInteger(Number(args.players)) && Number(args.players) >= 2 && Number(args.players) <= 6) settings.aiPlayers = Number(args.players) - 1;
    if (args.size && Object.hasOwn(MAP_DIMENSIONS, args.size)) settings.mapSize = args.size as MapSize;
    settings.populationCap = Math.min(settings.populationCap, Math.floor(600 / (settings.aiPlayers + 1)));
    settings.slots = defaultMatchSlots(settings);
    const state = createGame(settings), begin = performance.now(), peaks = state.players.map(() => 0);
    const limit = settings.duration * 180 + 1;
    while (state.winner === null && state.time < limit) { stepGame(state, 1); state.players.forEach((p, i) => peaks[i] = Math.max(peaks[i], p.population)); }
    const result = { scale: settings.matchScale, personality, seed: settings.seed, targetMinutes: settings.duration, mapTiles: state.map.width, activePlayers: state.players.filter(p => !p.neutral).length, minutes: +(state.time / 60).toFixed(2), terminated: state.winner !== null, winner: state.winner, reason: state.victoryReason, cpuSeconds: +((performance.now() - begin) / 1000).toFixed(2), players: state.players.filter(p => !p.neutral).map(p => ({ name: p.name, personality: p.personality, peakPopulation: peaks[p.team], score: Math.round(p.score), recruited: p.stats.unitsCreated, kills: p.stats.kills, losses: p.stats.unitsLost, captures: p.stats.captures, buildings: p.stats.buildingsCreated, goldCollected: Math.round(p.stats.goldCollected), woodCollected: Math.round(p.stats.woodCollected) })) };
    results.push(result); console.log(JSON.stringify(result));
    if (args.output) writeFileSync(args.output, `${JSON.stringify({ note: 'Fresh recovered-source deterministic samples; headless timing excludes rendering. Duration targets are not guarantees.', plannedCases: scales.length * personalities.length, completedCases: results.length, results }, null, 2)}\n`);
}
if (args.output) writeFileSync(args.output, `${JSON.stringify({ note: 'Finite deterministic AI policy samples; pacing targets are not guarantees. Headless CPU timing excludes rendering.', results }, null, 2)}\n`);
