# Commercial-readiness work plan and scope

## Current allied-ability checkpoint — 5 October 2026

The current allied-ability checkpoint is **Build `fc-10d287331fd1`**.
536 unit tests in 57 files, TypeScript, eight mission validations and the
production build pass. The full production browser run recorded **319 cases:
298 passed, 21 intentional skips, zero failures/flakes**. Three separate actual
previous-cache upgrades fulfill three skips, giving **301 distinct passes and
18 remaining skips across the same 319 cases**. The focused 15 ability cases
are a subset, not added again. Earlier focused locator corrections remain
documented separately. All 15 simulation files are unchanged. See
[ALLY_ABILITY_NATURAL_ROUTE_QA_20261005.md](ALLY_ABILITY_NATURAL_ROUTE_QA_20261005.md)
for exact tests, owned-save continuity, earned progression and evidence limits.

The dated scope and prior receipts below remain historical. Commercial readiness,
physical-device coverage, later natural-route completion and broad balance are
not established by this release.

## Prior Practice recovery checkpoint — 5 October 2026

The current Practice recovery checkpoint is **Build `fc-3c40d8eec6cf`**.
533 unit/contract tests in 57 files pass, with TypeScript, eight mission
validations and the production build. The full 304-case browser run initially
recorded 282 passes, 21 skips and one campaign-Continue timing failure. After
waiting for the actual asynchronous restore, that case passed in all three
viewports; three previous-production-cache upgrade cases also passed. Reconciled
distinct coverage is **286 passed, 18 intentional skips, no unresolved failures**.
This is not a claim of a failure-free first full run. All 15 simulation files
remain unchanged. See [PRACTICE_RECOVERY_QA.md](PRACTICE_RECOVERY_QA.md) for exact
scope, preserved failure evidence, actual-input results and limitations.

The dated scope and prior receipts below remain historical evidence. This
checkpoint does not establish commercial readiness or complete device/balance coverage.

## Prior guidance publication checkpoint — 5 October 2026

The current guidance checkpoint is **Build `fc-9011b0514b9c`**: 525 unit/contract
tests passed; TypeScript and production build passed; 127 unique scoped browser
cases finished with 120 passed, seven intentional skips and zero final failures
or flakes. This is scoped coverage, not a full-suite rerun. The frozen prior
`fc-7f2be308bbca` release separately passed 253 of 274 full-suite cases, with
21 intentional skips. All 15 simulation files are unchanged. See
[DEFEAT_GUIDANCE_QA.md](DEFEAT_GUIDANCE_QA.md) and [QA.md](QA.md) for the current
receipt, actual-input evidence and limitations.

The detailed scope and usability receipts below are retained from the previous
checkpoint; their references to a current candidate or test totals describe
that earlier checkpoint. This update does not establish commercial readiness,
physical-device coverage, later natural-route completion or broad balance.

## Retained prior-checkpoint scope

Updated 5 October 2026 after the scoped usability release verification. **The local candidate passes its runnable browser gate; it remains a testing preview and is not declared commercially ready.** Linux Chromium and emulated phone touch were tested; physical iPhone/Safari, installed-device lifecycle/performance, subjective soundtrack listening, full natural campaign/expedition routes, broad balance and exact deployed-release checks remain open. Asset provenance and distribution licensing still need commercial review.

## Authority and scope

1. **Original requirement:** the 56-section Frontier Command brief asks for a polished, replayable proof-of-concept/vertical slice, with real systems and final execution checks. Its section 53 explicitly permits extensible architecture plus a useful working subset and documented expansion when the full system cannot reasonably reach useful quality. It does not authorize fake actions, broken advertised flows or replacing final verification with documentation.
2. **Later owner feedback:** progressive first-time learning, reliable direct controls, clear building purposes/actions/upgrades, visible capture income/queues/population, easier neighboring placement, collapsible HUD, larger/configurable matches and editor pan/drag-paint are current acceptance goals. A two-house practice lesson and preview/confirm placement are concrete responses to that feedback, not verbatim clauses from the original.
3. **Conditional/future ideas:** preserve the original qualifiers rather than converting every example into a mandatory feature. Named battle slots/backups were not required; formation/grouping is “where practical”; a graphics-quality setting is “if helpful”; keyboard navigation is “where reasonable.” Full online multiplayer, all eventual biomes and naval expansion are future architecture.
4. **Supplemental visual requests:** theme/style packs and full directional frames come from later discussions and remain separately tracked below. Their absence must not be silently treated as cancellation, nor incorrectly attributed to the original brief.
5. **Repository override:** the owner's later instruction selects [KJLKurt/rts-game](https://github.com/KJLKurt/rts-game). The production base is `/rts-game/`. This supersedes the copied original brief's `kjljon/frontier-command` destination; preserve current hosting paths.

Gold and wood come from captured deposits and the keep stipend; no worker micromanagement is required. Stone is scenery, not a spendable resource.

## Current evidence boundary

- The isolated usability candidate identifies itself as **Build `fc-7f2be308bbca`** in the menu footer and Credits / About. It passes **519 unit/contract tests in 55 files**, TypeScript checks and the production build. A fresh focused browser run covers **109 cases: 102 passed, seven intentional skips, zero failures/flakes**; the separate actual previous-cache upgrade adds **one passing case**, for **110 scoped cases / 103 passed / seven skipped**. This focused run does not replace the prior full-suite receipt. Runtime `index-eiI64Ww3.js` / `index-BmuM_yap.css`; worker cache `35e0f9b54183`; 24 precached files; base `/rts-game/`. A repeat build produced identical bytes in all 26 output files. See [USABILITY_RELEASE_QA.md](USABILITY_RELEASE_QA.md).
- The published clarity checkpoint `779745debf48ea9f18f93a5874e92cf4d8a5355a` had 516 unit tests in 54 files and a full 262-case browser run: 244 passed, 18 intentional skips, zero failures/flakes. Its runtime was `index-DJ5oCh_8.js` / `index-BLaajxx7.css`, worker cache `c8affbd450ca`. That remains prior-source evidence, not a new full run of this candidate.
- Native desktop input earned the prior checkpoint’s Outpost win at 43.8 game seconds. Further actual-input play on the published clarity checkpoint ended a Balanced expedition in first-battle defeat at **408.4 game seconds (6:48)**, saved the result once and opened its defeated route with 0/4 victories. Quick-, Standard- and Epic-derived skirmish openings were played with real UI input and saved unfinished; their exact bounded observations are in [NATIVE_PLAY_20261005.md](NATIVE_PLAY_20261005.md). No successful four-battle route, guaranteed match duration or subjective fun verdict is claimed. All 15 simulation source files remain unchanged in this usability pass.
- Earlier 441/493/494/505-test receipts and historical deployed runs are retained as history, not current verification. The fresh cloud environment ran sandbox-enabled Chromium; the prior Linux socket/infrastructure block was not bypassed.
- Performance evidence: the archived 4 October investigation (`frontier-profiling-2026-10-04.tar.gz`, SHA256 `66a7674b2cdc70fb1d1a5c133a28fd0d7349c129a57607b2558d1ac3f28946d5`, `frontier-profiling/REPORT.md` and `applied.json`) measures an applied dense-combat p95 of **65.75ms**, versus baseline repeats **77.0–96.3ms**. Cold mass movement still peaks at **223.63ms wall / 221.503ms main-thread CPU** for a 100ms simulation tick. These synthetic headless figures exclude rendering, phone thermals and input; the 600-population ceiling is not a smooth-play guarantee.
- [REQUIREMENTS_STATUS.md](REQUIREMENTS_STATUS.md) is the current implementation/verification summary. [MATCH_SCALES.md](MATCH_SCALES.md), [BEGINNER_FLOW_QA.md](BEGINNER_FLOW_QA.md) and [JOURNEY_INTEGRATION_QA.md](JOURNEY_INTEGRATION_QA.md) retain their dated, bounded evidence.

## Release sequence and gates

| Stage | Current implementation | Remaining acceptance gate |
|---|---|---|
| 1. Understand, inspect and control | Peaceful eight-step practice with progressive choices; two neighboring completed houses and upgrade; explicit Outpost transition; building Details and economy/population inspection; independently collapsible deck/map/guide | Uncoached desktop/touch completion, accurate resource/victory understanding, useful playfield and consistent movement/stop. Actual-input learning passes all three viewports; uncoached human understanding remains open |
| 2. Build and grow | Snapped preview/confirm/repeat/cancel placement; compact access-preserving footprints; production jobs, progress, producer routing, batches, refunds and reservations; visible building levels | Browser placement/queue/cancel/reload/rotation checks pass. Continue broader natural combat/resource stress and physical-device input review |
| 3. Play at the desired scale | Quick/Standard/Epic/custom settings, 32–160 maps, 4–180-minute targets, slots/alliances/economy/population summaries; fresh finite headless pacing samples; bounded dense-combat optimization | Ordinary real-time short/standard/long matches; final-source cold group movement and renderer/device profiling. Do not turn a finite sample into a duration or FPS guarantee |
| 4. Create battlefields | Pan/Paint, interpolated drag brush, sizes, undo/redo; dimensions/biome/entities/camps/teams/rules; named map library, clone/import/export and test-return | Actual UI author/save/import/export/test-return and touch pan/paint/draft-recovery checks pass; custom-scenario quality remains a human review task |
| 5. Replayable content/progression | Two authored campaigns/eight chapters, typed triggers/objectives; branching seven-stop expedition; persistent choices, 30 achievements and statistics; real research paths/level progression | Outpost natural win and local research/persistence checks pass; branch/node-class outcomes were fixture-driven. Later earned campaign/expedition routes and broad balance remain open |
| 6. Presentation/accessibility | Independent faction crests/material adornments and team shapes; Credits/About; six-state audio; scalable text on key surfaces, 44px HUD disclosure targets and reduced motion | Pixel inspection on small/large viewports, dense-battle faction readability, long-dialog/focus continuity, scaled text and subjective audio review. Full theme/frame packs remain separate |
| 7. Harden the candidate | Versioned newest-record recovery, abort settlement/tombstones; staged result save with retry and update/navigation blocking; independent app suspension with explicit resume and unchanged tactical-pause quota | Actual local storage failures/retries, result/update races, foreground recovery and offline checks pass. Physical installed-device and deployed-update lifecycle remain open |
| 8. Release and verify | Correct authorized repository/base and extension documents; local candidate and private QA bundle available | Fix acceptance failures, establish asset distribution rights, publish only through authorized flow, and verify exact remote/build/deployment/assets/update/Continue/public play. An intermediate deployment is not completion |

## Original brief coverage, sections 1–56

This audits the **current recovered/hardened source**, not the old `85dc40b` implementation. “Present” means implemented in source, with local checks where stated; it does not close the browser, play or rights gates above.

| Section | Current coverage / explicit limitation | Gate |
|---|---|---|
| 1 Browser/mobile/PWA | Present responsive browser/PWA implementation at the later-authorized `/rts-game/` base | 1, 7–8 |
| 2 Offline first | Scoped cached shell/content/art/audio and local persistence; expanded local offline flows passed | 7 |
| 3 Safe updates | Explicit consent; versioned storage; staged result/retry and pending-save update protection now implemented | 7–8 |
| 4 Isometric rendering | Canvas2D implementation and documented Phaser/PixiJS comparison; simple/procedural animation plus three attack strips | 3, 6 |
| 5 Simulation separation | Typed commands/fixed simulation separated from rendering, persistence and UI; main orchestration remains substantial | 7 |
| 6 Commanders | Warlord/Ranger/Engineer, six abilities, direct steering, targeted orders and inspection; current Engineer toolkit is turret/repair | 1, 6 |
| 7 Tactical pause | Queues and limited-difficulty rules; app interruption now separate from tactical-pause accounting | 2, 7 |
| 8 Resources | Capture-based gold/wood, finite reserves, rates, depletion, keep/depot/research effects | 1–3 |
| 9 Buildings | Nine meaningful types, prerequisites/build times/population and level 1–3 upgrades; preview/confirm adjacency | 2 |
| 10 Units/counters | Six core types, moderate counters and visible roles/stats | 1–3 |
| 11 Commands | Individual/commander/whole-army selection and move/attack/attack-move/hold/rally; arbitrary saved groups/formations not implemented and conditional in original | 1, 3 |
| 12 Factions | Three mechanical identities plus new distinct faction crests/material overlays independent of team signals; shared base sprites remain | 6 |
| 13 Scale/duration | Quick/Standard/Epic/custom, 32–160-tile worlds and 4–180-minute pacing targets; not guaranteed endings | 3 |
| 14 Escalation | Objective escalation and Conquest storm endings; Rush has shrinking territory | 3 |
| 15 Biomes | Four gameplay-affecting biomes meet the several-biome slice target; remaining listed environments are eventual examples | 3, 6 |
| 16 Generation | Deterministic versioned maps; exposed resources/terrain/water/camps/objectives/symmetry/weirdness and portable codes | 3–4 |
| 17 Validation | Reachability/fairness/forces/footprints/teams with deterministic seed regressions and actionable editor errors | 4, 7 |
| 18 Setup | Dimensions/seed/biome/slots/alliances/difficulty/personality/economy/caps/speed/mode exposed; one human command surface | 3 |
| 19 AI | Six personalities, same economic rules, bounded vision, recruitment/build/research/attack and headless metrics | 3, 5 |
| 20 Campaigns | Two authored campaigns/eight chapters plus a genuine branching expedition with seven node classes/rewards | 5 |
| 21 Authoring | Typed definitions, build validation and campaign guide with missions/objectives/rewards/triggers/unlocks | 5, 8 |
| 22 Triggers | Structured conditions/actions including unit/region/resource/objective/building cases, alliance and defeat; no arbitrary-script execution | 5, 7 |
| 23 Editor | Dimensions/biome/terrain/resources/spawns/forces/objectives/camps/teams/victory plus save/load/clone/import/export/validation | 4 |
| 24 Progression | Per-match technologies/buildings; persistent titles, campaign options, expedition charters and challenge choices | 5 |
| 25 Upgrades | Data-driven effects; new research construction-path and sequential-level tree with real costs/queue/lock states; no invented cross-tech dependencies | 2, 5–6 |
| 26 Achievements | 30 with counters/categories/hidden state/timestamps/persistence and command-record UI | 5, 7 |
| 27 Statistics | Usage, army/resources, wins/losses, campaign progress, fastest wins, time and bounded local history | 5, 7 |
| 28 Modes | Conquest/Domination/relic/Rush and scripted objectives exceed the required initial subset; allied/FFA AI supported | 3, 5 |
| 29 Multiplayer boundary | Command/state separation and future-network guide; online backend, invite codes and multiple human clients deliberately not implemented | 8 |
| 30 Saves | Autosave/manual/Continue, migrations/errors, independent expedition checkpoint and staged result recovery. Named battle slots/backups were not required | 7 |
| 31 Music | Six state tracks, transitions and independent persisted Master/Music/Effects/mute | 6–7 |
| 32 SFX | Synthesized capped event/action audio; final audibility and repetition review pending | 6 |
| 33 Effects | Combat/capture/building/ability/selection feedback, adaptive quality and reduced motion; manual quality setting is optional in original | 6–7 |
| 34 Fog | Real visible/explored state and vision-limited tactical AI, including allied vision rules | 3, 7 |
| 35 Minimap | Terrain/forces/bases/objectives/alerts/camera; collapse and touch navigation | 1, 3, 6 |
| 36 UI | Main modes, editor, record/achievements/statistics, settings, help and new Credits/About; complete contextual HUD | 1, 6 |
| 37 Accessibility | Actual scaled text on key surfaces, keyboard menu paths/focus, six team shapes, sound controls/reduced motion; final target/overflow review pending | 6 |
| 38 Manifest | Scoped start/scope/icons/standalone at current owner-authorized base; installed launch still needs candidate evidence | 7–8 |
| 39 Worker | Scoped cache/consent update; source maps excluded; local offline and scope-isolation assertions passed; deployed/installed-device checks remain open | 7–8 |
| 40 Tests | 519 unit tests in 55 files; focused 110 browser cases: 103 passed, seven intentional skips, zero failures/flakes. Prior full 262-case receipt stays separately labeled | All |
| 41 Bot play | Headless/accelerated AI matches and metrics; finite policy/scale comparisons; perfect balance was explicitly not requested | 3 |
| 42 Debug | Nonintrusive reveal/resources/spawn/speed/seed/FPS subset; the listed debug tools were suggestions, not every-item mandates | 3, 7 |
| 43 Performance | Dense-query/separation optimization with exact-equivalence checks; cold 223.63ms movement spike and renderer/mobile evidence remain open | 3, 6–7 |
| 44 Pathfinding | Cached-grid A*, blocked terrain/buildings/groups/chokepoints, footprint access and steering slide; larger-world profiling continues | 2–3 |
| 45 Assets | Provenance documented in source and Credits/About; underlying reference rights and distribution license unverified | 6, 8 |
| 46 Data definitions | Typed units/buildings/techs/commanders/factions/biomes/campaigns/objectives/achievements/upgrades; build validation | 5, 7 |
| 47 Documentation | Required developer/authoring guides exist; current status and plan reconciled here; final release evidence still to append | 8 |
| 48 Pages | Current owner-selected repo/base implemented; final hardened source/deployment/public checks not yet verified | 7–8 |
| 49 Content breadth | Current counts meet/exceed approximate slice targets; quality and usable depth matter more than further count growth | All |
| 50 Teaching campaign | Rise of the Frontier's five progressive chapters plus standalone eight-step practice and second campaign; current ordinary route review pending | 1, 5 |
| 51 Game feel | Responsiveness/feedback/placement/control work implemented; novice feedback remains an ordinary-play acceptance gate | All |
| 52 Iteration | Bounded fixes/tests/profiling with failures tracked; final browser findings must drive the next corrections | All |
| 53 Working subsets | Original expressly permits useful extensible subsets with documented expansion; no broken or misleading advertised feature is excused | All |
| 54 Autonomy | Reasonable engineering/design choices remain authorized; only actual blocking ambiguity needs owner input | All |
| 55 Final verification | Clean final install/checks/build, production base/assets/manifest/worker/offline/save/modes/desktop/mobile execution remain release gates | 7–8 |
| 56 Delivery | Final concise summary, verified play destination, extension instructions and candid limits follow actual acceptance | 8 |

## Supplemental visual/content requests

Later source discussions request space, mythic, old-time, Christmas, Halloween and Street Kids themes; toon/realistic/sticker styles; themed music; directional movement/attack frames; day/night; reusable faction recoloring; visible finite resources; and a real Rush Arena. These are **separate later scope**, not additional clauses in the recovered original.

Current code has one coherent sprite theme, four biome palettes, three authored attack strips, procedural locomotion/effects, day/night tint, finite resources, Rush survival, six-state music and new faction adornments. Complete theme/style variants and full directional frame coverage remain unimplemented. No unfinished pack should appear as a selectable finished feature. Keep any later explicit commitment open until delivered or its scope is explicitly changed; the original section 53 cannot silently cancel newer promises.

## Remaining decisions and closure

- No new decision is needed to execute the current QA bundle, fix observed defects or improve the documented cold-movement bottleneck within the authorized game work.
- Asset rights/licensing require evidence before redistribution can be represented as commercially cleared. Generated or owner-supplied references alone are not proof of rights; do not invent a license grant.
- Physical-device lifecycle/performance and subjective listening are distinct evidence categories. Original section 55 explicitly requires representative desktop/mobile viewport testing; do not call that a physical-device certification requirement, or claim emulation proves hardware performance.
- Record final checks against the exact candidate/revision. A local test pass, a production build, a prepared QA bundle or a deployed preview alone cannot close first-time usability or commercial readiness. Resolve verified blocking failures, then provide the section 56 handoff with remaining limits stated precisely.
