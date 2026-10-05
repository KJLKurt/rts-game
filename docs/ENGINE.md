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

Nine building types provide population, recruitment, defense, economic expansion, and research. Building placement requires clear terrain, footprint clearance, and proximity to friendly command or territory. Costs are paid immediately; construction then completes over simulation time. House capacity matters, and queued recruits reserve their population so multiple queues cannot oversubscribe the army cap. Recruits attack-move to an explicitly chosen building rally point. Without a rally, they move directly to the commander's current position and then guard, so recruiting does not silently authorize an offensive pursuit. In settlement modes, idle soldiers and commanders keep a fixed anchor where they spawned or finished their last order. Unrelated targets retain a two-tile movement leash; recent, attributed damage to the guard or its local cluster can trigger the bounded active-defense response below. They can still attack threats in weapon range beyond the movement radius. Explicit attack, attack-move and capture commands replace the guard anchor; Hold stays stationary. Rush companions retain their automatic escort behavior.

Six troops have moderate counter bonuses: spears counter cavalry, cavalry punish exposed ranged/support, archers are efficient against infantry, and siege is essential against armored fortifications. Menders heal nearby injured troops. Faction multipliers are defined in content, not scattered in unit update code. Military, economy, logistics, and commander research reset each match.

The Warlord has a damaging charge and healing rally; Ranger has a dodge and targeted slow/damage area; Engineer has a temporary turret and field repair. Abilities have cooldowns and generate explicit events. A commander defeated in combat revives at the keep after 24 seconds. After seven seconds without damage, commanders recover 3 HP/s in the field or 10 HP/s near their own keep. Fortifications do not automatically regenerate; Engineer repair remains valuable. Losing the keep eliminates the player, so commander risk is recoverable while base defense remains consequential.

## Victory and pacing

Conquest ends when one Command Keep remains. Domination and Relic Race additionally allow territorial victory. One held relic produces 0.5 points per second, two produce 1, and three produce 1.4. The victory target is requested match minutes × 80. Escalation grows after half the requested duration and increases points and late-game troop damage to buildings. Relic Race produces points 15% faster.

A conquest-only frontier storm starts after twice the requested duration and wears keeps down to 1 HP, so a final assault can end a stalemate. At three times the requested duration, the storm awards victory to the surviving army with the strongest health/damage record, with team ID as a deterministic tie-break. This bounded fallback is deliberately specific to conquest. Normal domination matches should end through played objectives rather than a universal timer.

The duration setting is a pacing target, not a promised exact length. Uncontested victories and destructive attacks can end sooner. The pre-guard-fix six-seed Standard sweep on generator v4 finished in 13:47–17:34, with a 15:03 median. The pre-guard-fix twenty-seed Quick Conquest sweep had a 9:07 median and ranged from 6:02–14:57. All twenty ended in headquarters destruction before the storm began. These measurements are headless AI outcomes, not human completion-time promises. Full settings and outcomes are recorded in `tests/sim/balance-results.json`.

## AI

The same command handlers serve humans and AI. AI has no income, health, or damage bonuses. Difficulty changes planning intervals, commander ability use, and retreat behavior. During Easy's first 60 simulation seconds, AI expands only to deposits safely on its home side, then gathers its opening army. It continues paying normal recruitment and construction costs and still defends a genuine attack on its keep. At 60 seconds, ordinary expansion and pressure resume. This opening strategy gives a beginner a planning window without invulnerability, statistical bonuses, or permanent enemy passivity. Personalities alter expansion/defense priorities. It recruits, raises capacity, builds production, researches, prioritizes scarce-resource deposits, contests relics, creates a small secondary patrol, and rallies reinforcements. Conquest troops stage into combined siege columns; infantry and commanders avoid outrunning their artillery on an attack-move, while gunners can focus a visible enemy keep. Timed staging limits prevent waiting forever for an unaffordable ideal army. Commander retreats use hysteresis and recovery at the keep. Aggressive, defensive, economic, raider, expansionist, and adaptive priorities are separate data-selected planning choices.

Tactical enemy observations come only from currently visible entities. Map topology, starting locations, and objective locations are public strategic knowledge. A faction is not allowed to target an unseen entity through the attack command. Unit production priorities react to sighted troop composition. `Player.aiPhase` exposes a human-readable explanation for debug overlays.

The current planner is a compact heuristic, not a generalized behavior-tree or trained agent. It can mishandle narrow crowded approaches or sacrifice troops into a strong position. Its state and command boundary allow replacement without touching rendering or input.

## Maps, fog, and navigation

Generation uses a deterministic seed hash and PRNG, a versioned generation seed, biome rules, size, player count, and preset. New maps default to generator version 4. Pass `mapGenerationVersion: 3` to reproduce legacy layouts; four full-map SHA-256 fixtures protect that branch byte for byte. Share the seed, `map.version`, and complete map settings together: that is the reproducibility boundary. Explicit saved and imported maps retain their original tiles, nodes, and version instead of being regenerated. Old saves missing the new setting infer version 3 from their stored map. Dimensions range from 32×32 to 84×84. Two-player starts are opposing; larger games use a ring. Terrain clusters create forests, rocks and water; deterministic clearings and paths join all starts, nearby resources, expansions and objectives. Competitive/balanced maps mirror obstacle clusters. Version 4 provides paired central gold and timber reserves with equal amounts on both flanks, joined by guaranteed clear routes. Version 3 intentionally retains its original one-gold/one-timber central reserve placement so historical seeds stay reproducible. Forest and snow affect movement and sight, desert favors open sight and lower income, and roads reward route choice.

Validation performs a flood fill, checks spawn terrain and inter-player connectivity, nearby gold/wood, reachable objectives, basic owner validity, tile counts, and objective distance fairness. Editor maps use the same validator. Generated terrain is valid by construction through carved corridors; invalid authored maps are refused at match creation. Tests exercise hundreds of seeds rather than relying on a single screenshot.

Navigation uses eight-direction A* with a binary heap, terrain travel costs, blocked-building footprints, and no diagonal cutting across blocked corners. A sampled straight-line fast path avoids A* on open terrain. Buildings update a navigation version; derived blocker grids are kept in a `WeakMap`, outside serialized state. A unit searches only when its destination changes materially, its route ends, or an obstacle invalidates movement. Failed routes back off before retrying. Local deterministic separation keeps troops legible, including initially coincident spawn positions; units do not become hard impassable obstacles. Initial barracks and troops are rotated inward for every start. Recruits leave toward their rally point, and commanders revive toward the map center, avoiding a systematic behind-the-keep exit on the right side.

Fog updates twice per simulation second and distinguishes explored terrain from current visibility. Vision circles come from living, completed units and buildings, plus captured points. Forest-biome sight is reduced. This slice does not implement height-aware or line-of-sight occlusion through individual forest tiles; that is an explicit future enhancement.

## Data-driven content and campaign triggers

`content.ts` defines units, buildings, commanders, abilities, technologies, factions, biomes, defaults, dimensions, and team signals. `validateTriggers(input, {teamCount, width?, height?})` is a shared pure-data schema validator for campaign builds and save restoration; it rejects invalid teams, coordinates, amounts, spawn IDs/counts, and malformed conditions/actions before execution. `validateContent()` validates references and fundamental numeric invariants. Adding an ordinary unit or building requires updating its typed ID, definition, and the presentation asset mapping. Its behavior follows the common stats/counter/production systems. Bespoke active abilities currently require a handler in `useAbility`.

`GameState.triggers` accepts serializable `ScriptTrigger[]`:

- Conditions: elapsed time, captured points, owned gold/wood/relic counts, resource thresholds, destroyed entities, living entities inside a region, an exact entity location, completed unit/building counts, player-stat thresholds, research levels, and defeated players. `all` and `any` compose predicates to six nested levels, with at most 128 predicates per trigger. `evaluateScriptCondition` is shared by simulation and objective presentation.
- Actions: dialogue, resources, spawn a troop group, update objective text, reveal explored terrain, victory, defeat a player, and change a player’s alliance. An alliance change clears now-friendly attack orders and refreshes shared vision.
- Each trigger has a stable ID and a persisted fired bit; save/load does not repeat a reward.

Campaign content never executes arbitrary JavaScript. `scriptedVictory` disables automatic score, enemy-elimination and storm success; authored triggers decide success. Losing player zero’s own keep still ends a scripted mission, even during a temporary alliance, and takes precedence over success in the same tick. Ordinary skirmishes use alliance survival instead.

## Save, replay, and multiplayer boundaries

`serializeGame` stores the complete version-1 state. `restoreGame` rejects malformed JSON, unsupported versions, invalid maps/entities, corrupt player values, invalid numeric modifiers, malformed queued commands, and invalid mission triggers. Missing transient fog, paths, and fog-refresh timing are reconstructed; definition lookup does not accept inherited object-property names as content IDs. Persisted file/database schema and migration policy belong to the platform layer; simulation schema upgrades should add explicit migration functions before changing `version`.

`commandLog` records accepted commands with their exact simulation tick. The seed, generation version, settings, and ordered commands are the start of a replay format. Rendering effects, camera, selection, and audio are deliberately excluded from authority. Future lockstep/authoritative multiplayer can validate team ownership server-side, transport commands tagged by tick/sequence, exchange periodic checksums, and snapshot/resynchronize complete state. A Worker/Durable Object can own a room and command stream without importing browser APIs. This does not yet implement networking, rollback, alliance teams, or cross-engine floating-point guarantees.

## Tests and expansion cautions

Run `npm test -- tests/sim`. Tests cover command timing, deterministic stepping, pause, economy/depletion, capture/contestation, queues/population, technology, counters, abilities, fog, JSON round trips, scripts, content references, generation, and navigation. AI simulation tests exercise actual headless matches and assert terminal winners and useful combat/economy activity.

Known vertical-slice tradeoffs: damage resolves immediately while the renderer animates a visual projectile; no naval transport; no simultaneous-team alliances; no arbitrary campaign scripts; no network layer; simple unit separation instead of flow fields. Command history is intentionally preserved and can grow during a very long match; a future replay checkpoint/compaction policy should bound it when supporting multi-hour sessions. These should be expanded deliberately without moving rules into UI code.

## Rush Arena

`createGame({mode:'rush'})` creates a separate four-minute survival ruleset: commander plus four autonomous squad members, no settlement buildings or resource-point economy, and a fully revealed 42×42 arena. Fourteen escalating attack waves approach from the frontier ring. The safe radius closes from 18 to 5.8 tiles; standing outside damages either side. Marked runic hazards show a 2.8-second warning before exploding. The commander can keep moving while automatically attacking nearby targets, and companions regroup around their leader.

Supply pickups restore squad health, add soldiers, or reset ability cooldowns. A field upgrade becomes available every 45 seconds. `state.rush.offeredUpgrades` supplies three deterministic choices from six definitions in `RUSH_UPGRADES`; submit `{type:'upgrade',team:0,upgrade:id}` to choose. Upgrades, wave state, supplies, hazards, PRNG, zone, and timers are all serialized. Picking an upgrade does not pause the run; tactical pause remains subject to the selected difficulty.

A commander death ends the run immediately. Surviving to simulation second 240 wins. Automated active-play bots can survive with all three archetypes; inactive normal runs typically fail before the third minute. These are feasibility checks, not a substitute for human touch-control testing or a balance guarantee.

## Verified limitations from AI stress tests

The latest generator-v4 mixed-matchup sweep produced twenty headquarters victories, all before the storm began, and zero timed adjudications. Player zero won 8/20. That is not a side-bias statistic: this sweep varies player-zero faction and commander while the opponent remains Wildborn/Ranger.

A separate forty-match control set used Wildborn/Ranger on BOTH sides, otherwise equal settings, and twenty seeds per generator version. Player zero won 12/20 on v3 and 12/20 on v4; both sets had twenty headquarters victories. This small sample does not establish competitive balance or isolate a single causal variable, because generator-version changes also change terrain. Version 4's equal central-resource pairs are a structural fairness correction independently of win rates. Earlier mixed-matchup observations and full run data are preserved in `tests/sim/balance-results.json` instead of being represented as a clean side-bias experiment.

The authored Ironwatch mission also reaches a real siege victory in the regression suite. A separate version-pinned player-command regression demonstrates a focused artillery assault with commander abilities. The engine rejects construction that newly cuts off connected terrain and leaves troop-clear build footprints, preventing the spawn-exit enclosure discovered by stress tests. The AI reserves funds for chosen troop types and technologies instead of spending every available coin on the cheapest infantry. Further work should prioritize human touch-control playtests, wider difficulty/personality sweeps, stronger terrain-aware tactics, and matchup balance rather than adding statistical bonuses to the AI.

## Browser-reported opening regression

On generator v4 seed `FRONTIER-549665`, Medium / Quick 8 / Easy / Domination with an idle player and Swordsman + Spearman recruits, the old idle logic chased visible enemies without an anchor: the first two troop losses occurred at 30.5 and 33.2 seconds, while the commander remained untouched. The enemy had chained neutral captures across the map into the player's outer timber camp. The bounded guard and Easy opening fixes keep all six troops alive with untouched starter HP and no starter displacement through 60 seconds on this reproduction. Enemy pressure resumes afterward; remaining idle indefinitely can still lose the game. Ten targeted regression tests cover retreating bait, explicit offensive orders, recruit routing, persistent guard anchors, this exact opening, home-side planning, and defense against a genuine early attack. Existing Rush, siege, and match-termination regressions also remain required.

The tiny authored `OUTPOST-01` mission exposed a second issue: an Easy AI staging **attack-move** let the Ranger abandon its home-side rally to chase visible starter troops. Noncombat opening staging now uses Move and no offensive rally; actual defense still attacks. The precise browser gesture (idle to 4.5s, screen-right stick for 1.5s, release) is replayed as commander-only +worldX/−worldY movement. At 6.2s the commander reaches within 0.02 tiles of the recorded `(12.936694, 13.075195)`, retains 713 HP, and all four starters retain full HP and their guard positions. Forward and retreat cases additionally preserve the 65-second supply trigger and later enemy pressure.

`tests/sim/fixtures/outpost-3937eef-3s.json` is a genuine pre-fix deployed-engine snapshot with idle troops already chasing and no `guardAnchor`. Its provenance is recorded beside the fixture. Restoration anchors each idle troop at its saved position once, preserves existing damage and resources, and remains deterministic through another save/resume. Migration does not recreate an anchor at each movement tick, heal troops, or move them back to their initial spawn.

## Capture-order defense

Capture/March orders now secure and guard their objective. Units and commanders anchor to the objective when arriving within its capture area, or immediately when ordered to reinforce an already-owned objective. They normally fight within a two-tile movement leash, can fire at targets inside their weapon range, and return to the objective when a threat retreats. Actual attacks against their local cluster can invoke the bounded active-defense response below. Reinforcements outside the leash still route around terrain to reach it. The anchor persists through saves and remains valid if the point is lost, so the order can recapture it. Explicit Attack and Attack-move replace this defensive assignment. Charge still performs its explicit dash and leaves the commander Idle; resuming an assault afterward is a separate command.

A controlled reproduction using the `SCOUT-LIVE-002` seed and flattened test terrain confirmed that the old Capture target filter permitted a swordsman to chase retreating bait 5.08 tiles off an already-owned relic. This was an order-semantics defect; the test does not claim the seed's terrain caused the live event. The fixed unit stayed within 1.99 tiles and returned. Six dedicated regressions cover whole-army/commander arrival, capture-to-retreat, offensive override, old-save return, obstacle navigation, and recapture. The stronger positional defense changes some battle outcomes: the former four-gun test's blind keep-directed Charges lost its escort fight; aiming Charge at nearby visible troops and explicitly resuming Attack-move preserves a real player-issued siege victory without weakening the opponent.

## Active local defense

Ordinary Outpost play exposed a consequence of the original anti-chase fix: a full-health idle Warlord could stand beside a group losing soldiers to ranged fire, because the shooter was beyond the default leash. The response uses only actual recent damage facts, not a universal larger acquisition radius.

- A living, visible hostile unit must have dealt damage within the last 2.5 seconds to the guard or to a friendly target within three tiles of the unchanged anchor. Buildings do not become chase targets.
- The attacker must remain within 7.5 tiles of that anchor. Response movement caps at six tiles, then returns when the threat expires, dies, becomes hidden or leaves the boundary. Another distant attacker cannot advance the anchor.
- Explicit Hold never pursues. Idle nonthreatening camps, unrelated visible enemies and shots blocked by invulnerability do not qualify. Completed Capture orders retain their objective anchor.
- Hit events have optional source/victim attribution. Older saves without it never invent an attacker. No new damage or duplicate hit event is introduced. A revived commander starts with a fresh anchor at the keep.

Nineteen dedicated regressions cover these boundaries and serialized continuation. The original non-incursion opening and exact reported joystick regressions remain strict. Only forward or historical-save guards with actual attributed local damage may use the wider response bound; the quiet home-retreat case additionally requires full health and less than0.01-tile drift.


## Authored scenarios, alliances and neutral camps

`GameMap.scenario` is optional version-1 declarative data defined in `scenario-types.ts`. Legacy terrain-only v3/v4 maps and saves retain their behavior. A scenario records stable player slots, separate alliance IDs, match rules, authored entity placements and neutral camps. Closed slots keep their indices, produce no forces and release their deposits to neutral ownership. Only slot zero can have human control. Authored-only starting forces require one keep per active slot; standard forces supply the normal settlement and permit placed extras. Authored IDs and exact coordinates survive hydration and save/resume. Building levels use the same effects as paid progression.

Alliance membership never grants control of another player's orders, money or production. Allies share current vision and exploration history, receive friendly healing/buffs, do not attack each other, combine capture pressure and preserve allied deposit ownership. Each owner receives its own deposit income. Relics produce one alliance score rate partitioned across owners; victory sums the members' scores, preventing duplicate points from extra allies. AI excludes allied targets, uses slot difficulty and spends the same costs as humans, including occasional surplus-funded building upgrades.

`alliances.ts` exports `areAllied`, `areHostile`, `competitivePlayers`, `playerAllianceWon`, `playerAllianceDefeated`, `canPlayerContinue` and `playerOutcomeStatus`. In ordinary team matches a destroyed personal keep enters spectator mode while surviving allies can still win. Save/Continue and tactical pause remain available; the defeated slot cannot issue gameplay orders. The lowest player index in the winning alliance is its result representative. Scripted missions retain personal keep survival.

Neutral camps use one appended, noncompetitive player. Guards spawn on distinct legal cells within their authored radius, may contest nearby captures, and never gather income, capture, score, produce units or enter keep-elimination victory. The final defender's actual attacker receives the configured reward exactly once, with a `campCleared` feedback event. Restore validates neutral ownership, defender membership, anchored orders, reward attribution and cleared state. Neutral guards are hostile combat targets but are excluded from rival-player UI and victory counts.

`modifiers.players[team]` supports income, capture speed, health, damage and additive starting gold/wood for one player. Expedition rewards use this form. Legacy global income/captureSpeed and player-zero playerHealth/playerDamage retain their meaning. `incomeRate` affects all players' deposits equally. Modifiers and recipients are validated before play or restore.

Scenario structural validation runs before allocation. Playing additionally checks terrain, legal footprints, initial forces, camp room and routes around combined buildings. An editor may call `hydrateScenarioEntities(state, {preview:true})` with a structurally valid prepared state to display an incomplete draft without ticking it. Invalid draft previews are never saved as live battles. New setups have a 600-total configured population budget; restore preserves legal pre-budget v3/v4 scalar-only saves without changing their existing ceilings.

## Spatial simulation checks

Combat acquisition, guard retaliation and support searches use an order-preserving spatial broad phase. Queries retain the exact target filters and pad snapshot buckets for possible movement during a tick. Huge finite query bounds fall back to a bounded snapshot scan. Local separation remains unchanged. Concentrated armies can still require quadratic work because every unit is nearby. Headless measurements do not establish browser frame rates or physical-device performance; the reconstructed source requires fresh verification rather than inheriting prior test counts.
