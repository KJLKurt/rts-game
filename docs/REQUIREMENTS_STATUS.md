# Vertical-slice requirement status

This file distinguishes implemented behavior from planned scope. Passing simulation tests does not prove browser usability or fun. See `QA.md` for dated execution evidence and browser limitations.

| Area | Current implementation | Verification / remaining scope |
|---|---|---|
| Browser/mobile | TypeScript/Vite, responsive DOM HUD, Canvas2D battlefield, touch selection/pan/pinch, landscape thumbstick, keyboard shortcuts | Compiles; desktop/portrait/landscape Playwright flows prepared; real browser pass pending |
| Offline/PWA | Scoped manifest/icons, full shell/art/audio precache, offline navigation, explicit update prompt, save-before-restart | Build and mocked lifecycle tests pass; real offline/update browser cases pending |
| Simulation | 10 Hz fixed step, deterministic seeded commands/state, serialization and replay log | Deterministic chunking, commands, save continuation tested |
| Commander action | Warlord/Ranger/Engineer, six abilities, direct movement and movement-compatible attacks | Engine mechanics tested; touch feel awaiting real play |
| Tactical pause | Unlimited easy/normal, three hard pauses, disabled brutal; queued orders | Engine tests; modal menus separately freeze local simulation |
| Economy | Finite gold/wood deposits, capture/contest, visible staged depletion, keep stipend, depot/research bonuses | Income, depletion and capture tests |
| Army/building depth | Six troop types, moderate counters, nine building types, six technologies, population and production queues | Combat/recruit/research tests; placement and AI refinement ongoing |
| Factions | Ironhold/Wildborn/Arcanists with health/speed/cost/damage mechanics; team shapes/banners/colors | Mechanical definitions work; dedicated faction-specific art sets not supplied |
| Procedural maps | Five dimensions, four biomes, seed, generation presets, 2–6 supported players, validated paths and starts | 400 automated seed combinations; setup UI exposes common subset |
| Fog/minimap | Separate visible/explored state; vision-limited tactical AI; last-seen resources; camera minimap | Engine and renderer contract checks; visual mobile review pending |
| AI | Six heuristic personalities, same costs/resources, expansion/building/research, composition response, ability use | Standard objective matches terminate around target; conquest siege planning still being tuned |
| Victory/escalation | Domination, relic race, conquest; objectives escalate; conquest storm fallback | Engine victory tests; conquest can run substantially longer than requested pacing target |
| Rush Arena | Real four-minute survival, waves, shrinking safe zone, supplies, marked strikes, field upgrades, three commanders, retry | Wave/zone/hazard/save/upgrade/AFK-vs-active tests; UI cases prepared |
| Story campaign | Five missions, text/briefings, declarative conditions/actions, chapter unlocks, authored settings | Content build validator and mission startup tests; complete manual campaign pass pending |
| Roguelite | Three-battle expedition, route choice between biomes, persistent per-run supply bonuses, loss ends run | Working bounded subset; shops/events/relic inventory and large branching graph deferred |
| Editor | Generated map painting, resource/relic/spawn placement, local save/load, JSON import/export, validation/test | Working bounded subset; direct entity placement, visual triggers, team/victory panels deferred |
| Progression | Per-match research, chapter progression, 22 achievements, lifetime record and streak | Content identity tested; browser result-idempotency checks prepared |
| Save/migrations | IndexedDB with local fallback, autosave/manual/continue, versioned state validation and safe field reconstruction | Corruption and transaction tests; no cloud sync |
| Audio | Original 80s exploration/combat loops, crossfade, Ogg/MP3 fallback, generated event SFX, sliders | Codec/loudness/loop metrics verified; subjective listening and browser unlock pending |
| Art/game feel | 36-sprite original/user-reference-derived atlas, terrain details, walk/attack presentation, particles, selection/placement feedback, day/night tint | Alpha/atlas and renderer contract checked; one-view art rather than authored directional animations |
| Accessibility | Labels, visible focus, system fonts, team shapes, reduced motion, audio sliders, touch dock | Keyboard/menu/mobile tests prepared; full screen-reader battlefield and scalable-UI setting deferred |
| Multiplayer | Command/state/network extension documentation | Architecture only; no multiplayer backend or matchmaking |
| Themes | Coherent current supplied art with four biome palettes | Full space/mythic/old-time/holiday/street themes and styles deferred; manifest boundary makes replacement possible |
| Deployment | `/rts-game/` base everywhere, production build, periodic repository checkpoints | Pages workflow intentionally deferred until tested release to conserve Actions quota |

## Quality rule

No unimplemented menu claims are shown as working buttons. Partial systems are labeled here by the concrete subset they do. Add a requirement as complete only after checking its actual runtime behavior, not because a definition, screen, or test stub exists.
