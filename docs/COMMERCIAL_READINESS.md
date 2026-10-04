# Commercial-readiness work plan

Reopened 4 October 2026 following hands-on player feedback. The prior release is a tested foundation, not the completion target for this pass. A mechanic existing in the engine is not evidence that a new player can discover or use it. The release must pass both implementation checks and ordinary, uncoached play.

The original brief starts with **gold and wood earned by capturing deposits**, without worker micromanagement. Stone is not a spendable resource. The game must teach and show that rule. Repository and production paths are `KJLKurt/rts-game` and `/rts-game/`.

## Release sequence and gates

1. **Understand, inspect, and control.** A guided learning scenario starts with a commander and a small settlement, introduces one action at a time, then unlocks the wider loop. Selecting a building exposes its purpose, production, current/max upgrade level, health, progress, and rally action. Gold/wood income sources and population used/reserved/cap/ceiling are inspectable. The command panel, guide, and minimap can be collapsed independently. Direct controls respond consistently and stop on release. Gate: a fresh player captures both supplies, recruits a queue, builds two neighboring houses, explains the victory condition, and finds the map without outside instructions on phone and desktop.
2. **Build and grow.** Preview-first touch placement with an explicit confirm action, snapped footprints, immediate reason text, access-preserving adjacency, repeat placement, and cancel. Production lists show each job, progress, time, producer, batch quantity, cancellation/refund, and population reservation. Data-driven building upgrades are useful and visible. Gate: repeated paused/unpaused placements and queues survive cancellation, destruction, reload, and orientation changes without lost inputs/resources.
3. **Play at the desired scale.** Quick/Standard/Epic/custom durations and map/population/economy settings have concrete summaries; larger maps remain navigable and perform acceptably. AI, travel distance, resource reserves, escalation, and victory targets are evaluated together. Gate: contrasting economic/defensive/aggressive policies and real matches establish short, 15–20 minute, and substantially longer play; finite samples are reported honestly.
4. **Create complete battlefields.** Distinct Pan/Paint tools, held-drag interpolated brush strokes, brush size, undo/redo, editable dimensions/biome/settings, unit/building/camp/objective/team placement, save/load/clone/import/export/test-return, and actionable validation. Gate: author and replay a custom scenario through UI, touch paint and pan remain distinct, and all content survives a round trip.
5. **Complete replayable content and progression.** Authored missions teach progressively and have meaningful distinct objectives; typed triggers cover all required actions. Expedition gains genuine route/node/reward choices. Upgrade trees, achievement progress/categories/timestamps, persistent choice unlocks, and detailed local stats become visible. Gate: every advertised campaign chapter, expedition node class, win/loss/retry/unlock route, and save boundary is exercised.
6. **Finish presentation and accessibility.** Readable faction identity, coherent animation/feedback, environmental life, adaptive audio states, scalable UI, graphics settings, keyboard/touch alternatives, and clear help/reference. Supplemental theme/style packs are tracked below and must have complete terrain/unit/building/resource/audio coverage before appearing as selectable themes. Gate: visual and auditory review, input continuity, reduced-motion, and small-screen checks.
7. **Harden the complete game.** Clean dependency install, full local/seed/simulation tests, bounded browser acceptance, save migrations, offline/update/install lifecycle, larger-army profiling, hostile imports, and recovery checks. Gate: no known blocking defects in advertised flows; distinguish physical-device evidence from emulation.
8. **Release and verify.** Meaningful source commits and pushes; batch Actions and deployment near tested checkpoints. Verify exact remote source, build, Pages assets, update/Continue, and public gameplay. Publish accurate how-to guides, credits, complete status matrix, and remaining platform/quality evidence gaps. An intermediate deploy is a release candidate, not project completion.

## Original brief audit

Status describes the prior `85dc40b` runtime as inspected in code. **Present** still requires regression checking after changes. **Partial** identifies real missing behavior or discoverability, not a promise inferred from a button.

| Brief | Prior implementation / gap | Required completion and gate | Stage |
|---|---|---|---|
| 1 Browser/mobile/PWA | Present; phone UX confusing despite flow passes | Intentional touch controls, usable playfield, production subpath | 1,7 |
| 2 Offline first | Present scoped cache/storage and offline play | Exercise all expanded menus/content/editor/audio offline | 7 |
| 3 Safe updates | Present consent/save-before-restart | Migrate expanded state, old version offline, interrupted save/update | 7 |
| 4 Isometric rendering | Present custom Canvas2D; technology decision documented | Profile larger worlds; maintain readability and art consistency | 3,6 |
| 5 Simulation separation | Present deterministic commands; main UI monolithic | Extract input/editor/presentation contracts without simulation DOM coupling | 1–5 |
| 6 Commanders | Three archetypes/six abilities present | Reliable direct movement, targeting/ability explanation and visible upgrade paths | 1,5 |
| 7 Tactical pause | Present queued commands; limited Hard/no Brutal | Visible reserved costs and queued actions; cancellation; preserve modal pause | 2,7 |
| 8 Resources | Gold/wood, finite capture income, depot/research present | Teach capture-without-workers; show sources/depletion/rates; no false stone UI | 1,2 |
| 9 Buildings | Nine types; useful functions hidden; large spacing; no individual upgrades | Selected-building actions, compact valid adjacency, upgrade levels, construction feedback | 1,2 |
| 10 Units/counters | Six types with counter multipliers present | Inspect stats, role, counters, prerequisites, upgrade effects and population | 1,5 |
| 11 Commands | Select/Army/move/attack/hold/rally present; weak grouping | Direct-control contract, selectable groups/formation, explicit modes/feedback | 1,3 |
| 12 Factions | Three numerical identities; shared silhouettes | Clear faction mechanics/choices and visual identity; team symbols remain accessible | 5,6 |
| 13 Scale/duration | 32–84 tile maps, duration8/18/25/40, caps40–120 exposed | Larger/custom scales, short/standard/epic presets with paired settings; visible limits | 3 |
| 14 Escalation | Score escalation and conquest storm present | Explain timeline and verify late-game endings across durations | 3 |
| 15 Biomes | Four, with movement/vision/income differences | Inspect biome effects; extend full terrain set where useful and verify playability | 3,6 |
| 16 Generation | Deterministic v3/v4, many settings internal | Expose resource/terrain/water/camps/objective/symmetry/weirdness settings and share codes | 3,4 |
| 17 Validation | Reachability/fairness checks, hundreds of seeds | Expanded-map/entity/footprint/team checks, deterministic recovery and explanations | 3,4,7 |
| 18 Skirmish setup | Common subset; no teams/slot editing; resource sliders absent | Human/AI/closed slots, teams, settings summary, starting economy/speed/caps | 3 |
| 19 AI | Six personalities, same costs/resources, bounded vision | Account for all new construction/upgrades/scales, test scouting and actual strategic play | 2,3,5 |
| 20 Campaigns | Five data missions; simple linear unlocks; 3 battle expedition | Distinct teaching missions/objectives; proper branching expedition with non-battle choices | 5 |
| 21 Campaign authoring | Typed data and docs present | Connections/rewards/unlocks/modifiers/maps examples and build-time validation | 5 |
| 22 Triggers | Time/capture/resource/destroyed/region; actions missing alliance/defeat | Typed unit-location/kill/building conditions; alliance/defeat and objective actions | 5 |
| 23 Editor | Terrain/resources/spawns only; tap paint; one save | Pan/Paint drag, dimensions/biome/entities/teams/victory/camps, undo/clone/library/test-return | 4 |
| 24 Progression | Six research techs, chapter unlocks/achievements | Visible commander/unit/economy progression and persistent choice/cosmetic unlocks | 5 |
| 25 Upgrades | Six techs, one/two levels; no tree; cost display wrong above level1 | Correct next-level costs, dependencies, current/max levels, building and commander choices | 1,2,5 |
| 26 Achievements | 22 boolean unlocks | Progress counters, categories, hidden state, timestamps, accessible detail | 5 |
| 27 Statistics | Wins/games/kills/time/streak/campaign only | Faction/commander usage, recruited/lost/destroyed/resources, fastest wins, local match history | 5 |
| 28 Modes | Conquest/domination/relic/Rush present; no teams | Distinct objectives explained; AI team/free-for-all support, complete special mission conditions | 3,5 |
| 29 Multiplayer boundary | Command/state architecture and docs | Keep network-ready boundary; original brief explicitly does not require online backend | 7,8 |
| 30 Saves | One Continue slot, autosave/manual, migrations | Named slots/backups and clear recovery; expanded campaign/editor/progression compatibility | 5,7 |
| 31 Music | Exploration/combat loops; no full state suite | Menu/tension/victory/defeat cues, transitions, persisted controls, replaceable manifest | 6 |
| 32 SFX | Synthesized capped event SFX | Coverage/readability for every new action; subjective listening review | 6 |
| 33 Effects | Attacks/projectiles/capture/death/abilities present | Quality control/adaptive visual load; building upgrades/construction/resource work feedback | 6,7 |
| 34 Fog | Real visible/explored, tactical AI visibility | Team-shared vision/alliance rules; no UI or AI information leakage | 3,5,7 |
| 35 Minimap | Terrain/friend/visible enemy/base/relic/camera present | Expand/collapse, alerts, touch destinations, large-world navigation | 1,3 |
| 36 UI | Major screens present; building inspection, queues, limits absent | Contextual useful selection, collapsible panels, coherent menus/reference, no fake actions | 1,2,5 |
| 37 Accessibility | Focus/team shapes/audio/reduced-motion present; uiScale stored unused | Actual scalable UI, readable sizes, touch targets, alternative input, keyboard paths | 1,6 |
| 38 Manifest | Correct `/rts-game/` scope/icons/start | Install/launch and sibling-app isolation across release | 7 |
| 39 Worker | Scoped full cache and consent update present | Expanded assets cached; storage quota/recovery; no unnecessary debug assets | 7 |
| 40 Tests | 226 local/101 browser passes on prior release | Meaningful new regressions plus full final suite; first-time behavior validated separately | All |
| 41 Bot play | Headless AI metrics present | Broaden realistic economy/defense/offense policies, duration/faction/scale comparisons | 3,7 |
| 42 Debug | Reveal/resources/spawn/speed/seed/FPS subset | Entity/AI/path inspection and team testing kept out of normal play | 3,7 |
| 43 Performance | Headless profile only; renderer texture bounded | Large-world render/path/fog/AI/particle profiles and dynamic visual quality | 3,6,7 |
| 44 Pathfinding | Cached-grid A*, groups and access checks | Building adjacency and direct-control sliding, chokepoints and larger-map budgets | 1–3 |
| 45 Assets | Generated/user-reference assets and attribution present | Full used-asset provenance and distributability; no unsupported license claims | 6,8 |
| 46 Data definitions | Units/buildings/techs/maps typed; much UI data inline | Typed upgrades, themes, objectives, achievement rules, campaign node/reward definitions | 2,5,6 |
| 47 Documentation | Required documents present | Reflect complete final behavior and actual player help, not stale implementation claims | All,8 |
| 48 Pages | Works at correct Kurt repo base | Verify exact final release, minimize Actions, preserve tested main | 7,8 |
| 49 Content breadth | Approximate numeric targets met | Depth/discoverability/quality across that content, not numeric box checking | All |
| 50 Campaign example | Five named chapters, only first played to win | Rebuild progressive lesson content and play every chapter to an ending | 1,5,7 |
| 51 Game feel | Some attractive effects; novice confusion confirmed | First-time control/build/economy loop must feel intuitive; repeated independent matches | All |
| 52 Iteration | Local tests + independent/browser play in prior pass | Iterate bounded working batches; fix observed problems before adding breadth | All |
| 53 Real features | No knowingly inert main button; partial systems documented | Remove undiscoverable/ambiguous mechanics and incomplete advertised flows | All |
| 54 Autonomous decisions | Existing authorization covers normal design | Continue reasonable decisions, raise only concrete blockers | All |
| 55 Final verification | Prior gate covered foundation, not expanded scope | Clean full validation, complete advertised modes, offline/save/editor/mobile/desktop | 7,8 |
| 56 Delivery | Prior docs/summary exist | Full final status, verified play link, extension guides, candid evidence limits | 8 |

## Supplemental visual/content requests

The source discussions also request multiple themes (space, mythic, old-time, Christmas, Halloween, Street Kids), styles (toon/realistic/sticker), themed music, directional movement/attack frames, day/night, reusable faction recoloring, finite visibly depleted resources, and a real Rush Arena. Current production has one coherent theme, four biomes, three authored attack strips, procedural locomotion/effects, day/night tint, finite resources and a working Rush loop. Complete theme/style variants require terrain, resources, every building/unit, consistent animation and audio, not a character sheet alone. These remain tracked stage6 work; none may appear as a selectable unfinished pack.

## Evidence and closure rule

Code and test evidence is recorded per candidate SHA in `QA.md`; ordinary match findings in `PLAYTESTS.md`. Physical-device installation/performance and subjective audio review are separate from desktop Chromium emulation. A successful test suite alone cannot close the user’s learning, control, or game-feel feedback. Any remaining promised front stays open in this matrix until implemented and checked, or until the user explicitly changes its scope.
