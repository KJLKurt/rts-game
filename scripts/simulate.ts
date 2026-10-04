import { createGame, stepGame, type GameMode, type BiomeId } from "../src/sim";
import { writeFileSync } from "node:fs";
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")),
);
const count = Math.min(100, Math.max(1, Number(args.games) || 8));
const mode = (
  ["domination", "conquest", "relic"].includes(args.mode)
    ? args.mode
    : "domination"
) as GameMode;
const duration = Math.min(45, Math.max(4, Number(args.duration) || 8));
const results = [];
for (let n = 0; n < count; n++) {
  const state = createGame({
    seed: `${args.seed || "BALANCE"}-${n}`,
    aiControlPlayer: true,
    mapGenerationVersion: args["map-version"] === "3" ? 3 : 4,
    mode,
    duration,
    mapSize: duration <= 8 ? "small" : "medium",
    biome: (["grasslands", "forest", "desert", "snow"] as BiomeId[])[n % 4],
    faction: (["ironhold", "wildborn", "arcanists"] as const)[n % 3],
    commander: (["warlord", "ranger", "engineer"] as const)[n % 3],
  });
  const begin = performance.now();
  for (
    let second = 0;
    second < duration * 60 * 3 + 10 && state.winner === null;
    second++
  )
    stepGame(state, 1);
  const result = {
    seed: state.settings.seed,
    mapGenerationVersion: state.map.version,
    mode,
    biome: state.settings.biome,
    seconds: Math.round(state.time),
    winner: state.winner,
    reason: state.victoryReason,
    cpuMs: Math.round(performance.now() - begin),
    players: state.players.map((p) => ({
      team: p.team,
      faction: p.faction,
      score: Math.round(p.score),
      gold: Math.round(p.gold),
      wood: Math.round(p.wood),
      population: p.population,
      ...p.stats,
    })),
  };
  results.push(result);
  console.log(JSON.stringify(result));
}
const summary = {
  games: count,
  terminated: results.filter((r) => r.winner !== null).length,
  meanSeconds: Math.round(results.reduce((s, r) => s + r.seconds, 0) / count),
  results,
};
if (args.output)
  writeFileSync(args.output, JSON.stringify(summary, null, 2) + "\n");
console.log(
  `Completed ${summary.terminated}/${count}; mean ${(summary.meanSeconds / 60).toFixed(1)} minutes.`,
);
if (summary.terminated < count) process.exitCode = 1;
