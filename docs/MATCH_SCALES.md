# Match scales and deterministic worlds

The skirmish presets pair world size, players, economy, population and victory pacing. Durations are game-minute targets. A keep assault can end a match early; contested objectives can take longer. Playback speed changes real time without changing economic or combat rules.

| Preset | Target | World | Commanders | Population each | Starting gold / wood | Deposit income | Reserve abundance |
|---|---|---|---|---|---|---|---|
| Quick | 8–12 minutes | Small, 42 × 42 | 2 | 60 | 300 / 320 | 1.25× | 1.2× |
| Standard | 15–20 minutes | Large, 68 × 68 | 3 | 100 | 230 / 260 | 1× | 1× |
| Epic | 30–45+ minutes | Giant, 120 × 120 | 4 | 150 | 350 / 400 | 1× | 1.5× |
| Custom | 4–180 minute target | 32–160 tiles per side | 2–6 active slots | Up to 200 | Editable | 0.5–3× | 0.3–5× |

The new-game population budget is 600 across active slots. Two commanders can select 200 each, four can select 150, and six can select 100. Houses still supply actual capacity in the match. This is not a frame-rate guarantee for any device. Quick is the conservative starting point for a slower device. Legal legacy saves above this total remain resumable without changing existing armies.

Slots retain player indices when closed. Player one may be human or AI; other slots are AI or closed. Each slot has faction, commander, difficulty, personality and alliance settings. At least two opposing alliances are required. Allies retain separate economies and orders while cooperating in combat, capture, vision and victory.

V5 large maps provide economic stepping stones. Resource reserves scale linearly with the duration target. Optional neutral camps stay away from starting settlements. Radial multiplayer relic approaches provide comparable travel distances. Greater objective density adds relics; weirdness paints patches of unusual terrain. Competitive validation checks approach fairness. Closed authored slots do not require a personal economy or traversable spawn, but all retained resource points must remain reachable.

V3/V4 layouts remain frozen, including reserves and terrain. These versions support the original five sizes through 84 × 84. FC3/FC4 codes preserve generator inputs. FC5 also preserves all starting resources, population, income, playback speed, camps and player slots. Authored workshop maps require JSON export to preserve their terrain and placements.

Escalation begins halfway through the target. Conquest's frontier storm starts after twice the target and resolves survival at three times it. Sparse v5 relic maps have score targets scaled to their attainable income.

## Verification workflow

These files were reconstructed from retained source context after the earlier working tree became unavailable. Earlier timing summaries are historical evidence, not verification of this reconstruction. Use fresh test and benchmark output for the recovered candidate.

```sh
npx vitest run tests/setup-model.test.ts tests/map-code.test.ts tests/sim/maps.test.ts tests/sim/scales.test.ts tests/sim/spatial.test.ts
node --import tsx scripts/profile-scales.ts --width=160 --population=100 --players=6 --ticks=120 --output=/tmp/scales.json
node --import tsx scripts/measure-match-pacing.ts --output=/tmp/pacing.json
node --import tsx scripts/measure-match-pacing.ts --scales=epic --policies=economic --duration=90 --players=6 --size=colossal --output=/tmp/long-match.json
```

The stress script independently measures generation, pathfinding, fog, idle troops, marching and clustered combat using scaled legacy maps as fixtures. It may deliberately spawn beyond the normal army budget for comparison; `supportedBudget` records the distinction. It excludes rendering, browser layout, audio, device thermal behavior and touch input, so it is neither an FPS test nor physical-phone evidence.

Pacing samples record actual ending time and cause, recruitment, losses, captured sites, peak population, collected resources and construction. Finite deterministic samples are not guarantees or substitutes for ordinary playtesting. Pin results to the final candidate and keep device/render verification separate.

## Fresh reconstruction evidence

Fresh focused tests on the recovered checkout passed: 26 tests covering setup, portable codes, frozen v3/v4 hashes, 72 large worlds, all 35 competitive size/player combinations, closed slots, and spatial equivalence against full scans. Strict TypeScript checking of the reconstructed scale modules, their tests, and their measurement scripts also passed. These results were rerun on the reconstruction; they are not copied from the unavailable earlier tree.

The reconstructed engine completed all nine preset/policy samples:

| Preset | Aggressive | Defensive | Economic | Mean |
|---|---|---|---|---|
| Quick | 6.02 min | 10.07 min | 11.17 min | 9.09 min |
| Standard | 15.95 min | 15.11 min | 14.75 min | 15.27 min |
| Epic | 44.89 min | 43.29 min | 43.10 min | 43.76 min |

Inputs and complete new results are in [benchmarks/recovered-pacing.json](benchmarks/recovered-pacing.json). These are one deterministic seed per policy, with real keep destruction or relic wins. Further integration changes require another candidate-specific check. Physical-device and renderer evidence remain separate.

A fresh 90-minute custom target at 160 × 160, with six economic AIs and a 100-population ceiling each, ended naturally by relic domination after 79.28 game-minutes. Two armies reached their full population ceiling. All six players recruited hundreds of troops and captured many sites. The complete new result is [benchmarks/recovered-long-custom.json](benchmarks/recovered-long-custom.json). This is one long-match sample, not a duration guarantee.

Fresh headless stress on the shared recovery executor was slower than the historical machine measurements. On 160 × 160, two armies of 200 recorded 22.40 ms mean / 41.75 ms p95 per 100 ms combat tick. Six armies of 100 recorded 72.72 ms mean / 134.80 ms p95, with a 172.71 ms maximum. The fully clustered six-player case exceeds a 100 ms simulation budget at its upper percentiles on this executor. The 600 total is an advanced configuration ceiling, not a smooth-play guarantee; retain setup warnings and separate device/render checks. Results are in [recovered-duel-stress.json](benchmarks/recovered-duel-stress.json) and [recovered-six-player-stress.json](benchmarks/recovered-six-player-stress.json). Shared-host load affects these wall-time measurements.
