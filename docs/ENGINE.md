# Frontier Command simulation

## Public integration contract

Import from `src/sim/index.ts`. The module contains no DOM, Canvas, audio, browser storage, timers, or network access. All world coordinates use tile units. A tile at column 3, row 4 has its center at `{x:3.5,y:4.5}`.

```ts
const state = createGame({ seed: 'JON-492817', biome: 'forest', duration: 18 });
issueCommand(state, { type: 'move', team: 0, x: 14.5, y: 23.5 });
stepGame(state, elapsedSeconds);
const save = serializeGame(state);
const resumed = restoreGame(save);
```

`GameState` is JSON data. `stepGame` mutates it in place. `issueCommand` returns `{ok,error?,queued?}` and never needs rendering state. Full schemas live in `types.ts`. Useful additional exports include `canBuild`, `getCommander`, `getUnitCost`, `combatDamage`, `isVisible`, `generateMap`, `validateMap`, `findPath`, and `spawnEntity` for authored encounters and debugging.

Simulation updates are fixed at 10 Hz. Callers can supply any finite positive elapsed duration. Fractional time remains in a serialized accumulator. Pausing preserves it; the simulation clock, construction, income, combat, and ability cooldowns all stop together. Paused orders are stored, then validated/executed in order on resume. Normal/easy have unlimited pause, hard has three activations, and brutal disables tactical pause.

`entities` is a flat array of commanders, troops, and buildings. IDs are deterministic counters. Dead troops and structures become short-lived events; commanders retain their entity identity while waiting for revival. Every entity carries explicit health, combat stats, order, path, production queue, timers, and facing. `map.tiles` is a row-major terrain array. Fog is `visible[team][tileIndex]` and `explored[team][tileIndex]`. `events` is a rolling 2.5-second feed with unique IDs, enabling consumers to play each sound or notification once.

## Match loop and player decisions

The opening provides a keep, barracks, commander, four soldiers, and two already-held finite deposits. Neutral deposits lie on the approach; three relics create separated fronts. Capture requires uncontested nearby troops: one soldier takes 18 seconds, a commander 9 seconds, and three effective capturers 6 seconds. Enemy presence contests capture. Ownership remains after moving away.

Gold and wood are finite visible deposits. Deposits pay automatically to their owner, and depletion generates an alert. A keep provides a small continuing stipend that scales with escalation, avoiding an absolute zero-resource trap. In Conquest, each held relic additionally generates 0.6 gold and 0.35 wood per second before escalation; controlling the middle funds late siege production. Depots improve nearby deposit income by 35%; economy research improves income by 25% per level. These improvements accelerate consumption rather than creating unlimited deposits.

Nine building types provide population, recruitment, defense, economic expansion, and research. Building placement requires clear terrain, footprint clearance, and proximity to friendly command or territory. Costs are paid immediately; construction then completes over simulation time. House capacity matters, and queued recruits reserve their population so multiple queues cannot oversubscribe the army cap. Recruits automatically attack-move to their building's rally point or the current commander position.

Six troops have moderate counter bonuses: spears counter cavalry, cavalry punish exposed ranged/support, archers are efficient against infantry, and siege is essential against armored fortifications. Menders heal nearby injured troops. Faction multipliers are defined in content, not scattered in unit update code. Military, economy, logistics, and commander research reset each match.

The Warlord has a damaging charge and healing rally; Ranger has a dodge and targeted slow/damage area; Engineer has a temporary turret and field repair. Abilities have cooldowns and generate explicit events. A commander defeated in combat revives at the keep after 24 seconds. After seven seconds without damage, commanders recover 3 HP/s in the field or 10 HP/s near their own keep. Fortifications do not automatically regenerate; Engineer repair remains valuable. Losing the keep eliminates the player, so commander risk is recoverable while base defense remains consequential.

## Victory and pacing

Conquest ends when one Command Keep remains. Domination and Relic Race additionally allow territorial victory. One held relic produces 0.5 points per second, two produce 1, and three produce 1.4. The victory target is requested match minutes × 80. Escalation grows after half the requested duration and increases points and late-game troop damage to buildings. Relic Race produces points 15% faster.

A conquest-only frontier storm starts after twice the requested duration and wears keeps down to 1 HP, so a final assault can end a stalemate. At three times the requested duration, the storm awards victory to the surviving army with the strongest health/damage record, with team ID as a deterministic tie-break. This bounded fallback is deliberately specific to conquest. Normal domination matches should end through played objectives rather than a universal timer.

The duration setting is a pacing target, not a promised exact length. Uncontested victories and destructive attacks can end sooner. The latest six-seed Standard sweep finished in 13:56–17:24, with a 14:48 median. The latest twenty-seed Quick Conquest sweep had a median of 11:35 and ranged from 5:53–19:47. These measurements are headless AI outcomes, not human completion-time promises. Full settings and outcomes are recorded in `tests/sim/balance-results.json`.

## AI

The same command handlers serve humans and AI. AI has no income, health, or damage bonuses. Difficulty changes planning intervals, commander ability use, and retreat behavior. Personalities alter expansion/defense priorities. It recruits, raises capacity, builds production, researches, prioritizes scarce-resource deposits, contests relics, creates a small secondary patrol, and rallies reinforcements. Conquest troops stage into combined siege columns; infantry and commanders avoid outrunning their artillery on an attack-move, while gunners can focus a visible enemy keep. Timed staging limits prevent waiting forever for an unaffordable ideal army. Commander retreats use hysteresis and recovery at the keep. Aggressive, defensive, economic, raider, expansionist, and adaptive priorities are separate data-selected planning choices.

Tactical enemy observations come only from currently visible entities. Map topology, starting locations, and objective locations are public strategic knowledge. A faction is not allowed to target an unseen entity through the attack command. Unit production priorities react to sighted troop composition. `Player.aiPhase` exposes a human-readable explanation for debug overlays.

The current planner is a compact heuristic, not a generalized behavior-tree or trained agent. It can mishandle narrow crowded approaches or sacrifice troops into a strong position. Its state and command boundary allow replacement without touching rendering or input.

## Maps, fog, and navigation

Generation uses a deterministic seed hash and PRNG, a versioned generation seed, biome rules, size, player count, and preset. Dimensions range from 32×32 to 84×84. Two-player starts are opposing; larger games use a ring. Terrain clusters create forests, rocks and water; deterministic clearings and paths join all starts, nearby resources, expansions and objectives. Competitive/balanced maps mirror obstacle clusters. Forest and snow affect movement and sight, desert favors open sight and lower income, and roads reward route choice.

Validation performs a flood fill, checks spawn terrain and inter-player connectivity, nearby gold/wood, reachable objectives, basic owner validity, tile counts, and objective distance fairness. Editor maps use the same validator. Generated terrain is valid by construction through carved corridors; invalid authored maps are refused at match creation. Tests exercise hundreds of seeds rather than relying on a single screenshot.

Navigation uses eight-direction A* with a binary heap, terrain travel costs, blocked-building footprints, and no diagonal cutting across blocked corners. A sampled straight-line fast path avoids A* on open terrain. Buildings update a navigation version; derived blocker grids are kept in a `WeakMap`, outside serialized state. A unit searches only when its destination changes materially, its route ends, or an obstacle invalidates movement. Failed routes back off before retrying. Local deterministic separation keeps troops legible, including initially coincident spawn positions; units do not become hard impassable obstacles. Initial barracks and troops are rotated inward for every start. Recruits leave toward their rally point, and commanders revive toward the map center, avoiding a systematic behind-the-keep exit on the right side.

Fog updates twice per simulation second and distinguishes explored terrain from current visibility. Vision circles come from living, completed units and buildings, plus captured points. Forest-biome sight is reduced. This slice does not implement height-aware or line-of-sight occlusion through individual forest tiles; that is an explicit future enhancement.

## Data-driven content and campaign triggers

`content.ts` defines units, buildings, commanders, abilities, technologies, factions, biomes, defaults, dimensions, and team signals. `validateContent()` validates references and fundamental numeric invariants. Adding an ordinary unit or building requires updating its typed ID, definition, and the presentation asset mapping. Its behavior follows the common stats/counter/production systems. Bespoke active abilities currently require a handler in `useAbility`.

`GameState.triggers` accepts serializable `ScriptTrigger[]`:

- Conditions: elapsed time, captured point, resource threshold, destroyed entity, or friendly entity inside a region.
- Actions: dialogue, resources, spawn a troop group, update objective text, reveal explored terrain, or mission victory.
- Each trigger has a stable ID and a persisted fired bit; save/load does not repeat a reward.

Campaign content never executes arbitrary JavaScript. Story missions in `src/ui/content.ts` combine regular map settings with these triggers. Richer campaign graphs, alliances, escort targeting, survival wave logic, and run rewards can be added as explicit schema additions. The current action surface deliberately stays small and auditable.

## Save, replay, and multiplayer boundaries

`serializeGame` stores the complete version-1 state. `restoreGame` rejects malformed JSON, unsupported versions, invalid maps, invalid entities, and corrupt player values. Persisted file/database schema and migration policy belong to the platform layer; simulation schema upgrades should add explicit migration functions before changing `version`.

`commandLog` records accepted commands with their exact simulation tick. The seed, generation version, settings, and ordered commands are the start of a replay format. Rendering effects, camera, selection, and audio are deliberately excluded from authority. Future lockstep/authoritative multiplayer can validate team ownership server-side, transport commands tagged by tick/sequence, exchange periodic checksums, and snapshot/resynchronize complete state. A Worker/Durable Object can own a room and command stream without importing browser APIs. This does not yet implement networking, rollback, alliance teams, or cross-engine floating-point guarantees.

## Tests and expansion cautions

Run `npm test -- tests/sim`. Tests cover command timing, deterministic stepping, pause, economy/depletion, capture/contestation, queues/population, technology, counters, abilities, fog, JSON round trips, scripts, content references, generation, and navigation. AI simulation tests exercise actual headless matches and assert terminal winners and useful combat/economy activity.

Known vertical-slice tradeoffs: damage resolves immediately while the renderer animates a visual projectile; no naval transport; no simultaneous-team alliances; no arbitrary campaign scripts; no network layer; simple unit separation instead of flow fields. Command history is intentionally preserved and can grow during a very long match; a future replay checkpoint/compaction policy should bound it when supporting multi-hour sessions. These should be expanded deliberately without moving rules into UI code.

## Rush Arena

`createGame({mode:'rush'})` creates a separate four-minute survival ruleset: commander plus four autonomous squad members, no settlement buildings or resource-point economy, and a fully revealed 42×42 arena. Fourteen escalating attack waves approach from the frontier ring. The safe radius closes from 18 to 5.8 tiles; standing outside damages either side. Marked runic hazards show a 2.8-second warning before exploding. The commander can keep moving while automatically attacking nearby targets, and companions regroup around their leader.

Supply pickups restore squad health, add soldiers, or reset ability cooldowns. A field upgrade becomes available every 45 seconds. `state.rush.offeredUpgrades` supplies three deterministic choices from six definitions in `RUSH_UPGRADES`; submit `{type:'upgrade',team:0,upgrade:id}` to choose. Upgrades, wave state, supplies, hazards, PRNG, zone, and timers are all serialized. Picking an upgrade does not pause the run; tactical pause remains subject to the selected difficulty.

A commander death ends the run immediately. Surviving to simulation second 240 wins. Automated active-play bots can survive with all three archetypes; inactive normal runs typically fail before the third minute. These are feasibility checks, not a substitute for human touch-control testing or a balance guarantee.

## Verified limitations from AI stress tests

The latest twenty-seed Conquest sweep produced twenty headquarters victories and zero timed adjudications. Sixteen ended before the storm began; four longer battles benefited from storm pressure, so they are not counted as storm-free victories. Player zero won 16/20 in this mixed-faction sample. An intermediate isolated spawn-orientation revision had reduced that share from 18/20 to 12/20; later escort/targeting improvements changed outcomes again. This is evidence that spawn placement mattered, not proof of competitive balance. Faction strength, central reserve symmetry, and broader human-versus-AI testing still need attention.

The authored Ironwatch mission also reaches a real siege victory in the regression suite. A separate player-command regression demonstrates a focused artillery assault with commander abilities. The engine rejects construction that newly cuts off connected terrain and leaves troop-clear build footprints, preventing the spawn-exit enclosure discovered by stress tests. The AI reserves funds for chosen troop types and technologies instead of spending every available coin on the cheapest infantry.
