# Requirements reconciliation — 8 October 2026

This is an evidence overlay, not a replacement for the original 56-section brief or prior release/QA history. The preserved original brief is 31,588 bytes, SHA256 `0754dac68b733d6127874287c2842dce7f82a4afacf8b31d93496da6c9db64cf`. The later authorized destination is `KJLKurt/rts-game`, `/rts-game/`.

## Current verified checkpoint

Production `493a475dee2aa97314a04d2036bcfe9e692d1855`, runtime **fc-194c08936126**, is deployed. Its direct rollback parent is `db11398f254b3c0f19cef024ad0a71d9636b0707`. [Pages run 37728830091](https://github.com/KJLKurt/rts-game/actions/runs/37728830091) passed. Fresh locked installation, TypeScript/content/build and 588 unit tests in 64 files passed.

[Browser run 37732161638](https://github.com/KJLKurt/rts-game/actions/runs/37732161638) on test-only revision `da887be17f9099699832865d97d4d7b8648a2795` completed 472 identities: **448 first-attempt passes, 24 skips, 0 failures, 0 interruptions, 0 unexecuted cases, 0 retry events**. Production bytes remain identical to the deployed build. Skips comprise 21 explicit viewport/input conditions and 3 previous-production-cache upgrades requiring a previous-dist fixture. All four ordinary PWA cases passed. This supersedes the interrupted aggregate blocker; it does not establish physical-device/Safari acceptance or complete original/supplemental scope.

The earlier run 37729970246 remains recorded: 414 passes, 6 selector failures (each failed again on its allowed retry),24 skips, 1 interrupted, 27 unexecuted. The new discrimination test had matched two Focus controls. A test-only precise map-control selector corrected that fixture; the production runtime did not change. The original portrait Move assertions pass with the clear-contact-region fixture. No game fix or erased failure history is claimed.

Bounded hosted desktop native play verified the displayed build, explicit update, Move/queue/Resume, invalid Attack/Cancel, paid production, blocked/valid placement and visible saved-order recovery. It is not whole-state equality or naturally completed campaign evidence.

## Source and evidence status by original section

“Implemented subset” records source support, not blanket acceptance. Case mappings overlap and are not a percentage of the 56 requirements completed. The new battlefield decision-clarity changes are a separate unaccepted local candidate until their own checks are recorded.

### 1. Browser/mobile/PWA

Present responsive browser/PWA implementation at the later-authorized `/rts-game/` base

Current qualification: Implemented source coverage retained. The clean current Chromium regression supersedes stale run counts; final quality remains bounded by the evidence and open gates above.

### 2. Offline first

Scoped cached shell/content/art/audio and local persistence; expanded local offline flows passed

Current qualification: Implemented source coverage retained. The clean current Chromium regression supersedes stale run counts; final quality remains bounded by the evidence and open gates above.

### 3. Safe updates

Explicit consent; versioned storage; staged result/retry and pending-save update protection now implemented

Current qualification: Implemented source coverage retained. The clean current Chromium regression supersedes stale run counts; final quality remains bounded by the evidence and open gates above.

### 4. Isometric rendering

Canvas2D implementation and documented Phaser/PixiJS comparison; simple/procedural animation plus three attack strips

Current qualification: Implemented source coverage retained. The clean current Chromium regression supersedes stale run counts; final quality remains bounded by the evidence and open gates above.

### 5. Simulation separation

Typed commands/fixed simulation separated from rendering, persistence and UI; main orchestration remains substantial

Current qualification: Implemented source coverage retained. The clean current Chromium regression supersedes stale run counts; final quality remains bounded by the evidence and open gates above.

### 6. Commanders

Warlord/Ranger/Engineer, six abilities, direct steering, targeted orders and inspection; current Engineer toolkit is turret/repair

Current qualification: Partial archetype scope: Warlord/Ranger/Engineer exist; Engineer has turret/repair, but the original siege-related ability is not identified in current implementation.

### 7. Tactical pause

Queues and limited-difficulty rules; app interruption now separate from tactical-pause accounting

Current qualification: Implemented source coverage retained. The clean current Chromium regression supersedes stale run counts; final quality remains bounded by the evidence and open gates above.

### 8. Resources

Capture-based gold/wood, finite reserves, rates, depletion, keep/depot/research effects

Current qualification: Implemented source coverage retained. The clean current Chromium regression supersedes stale run counts; final quality remains bounded by the evidence and open gates above.

### 9. Buildings

Nine meaningful types, prerequisites/build times/population and level 1–3 upgrades; preview/confirm adjacency

Current qualification: Implemented source coverage retained. The clean current Chromium regression supersedes stale run counts; final quality remains bounded by the evidence and open gates above.

### 10. Units/counters

Six core types, moderate counters and visible roles/stats

Current qualification: Implemented source coverage retained. The clean current Chromium regression supersedes stale run counts; final quality remains bounded by the evidence and open gates above.

### 11. Commands

Individual/commander/whole-army selection and move/attack/attack-move/hold/rally; arbitrary saved groups/formations not implemented and conditional in original

Current qualification: Implemented subset: single unit, commander and whole-army selection. Additive/subset selection is absent. Formations/saved groups were conditional, not silently mandatory.

### 12. Factions

Three mechanical identities plus new distinct faction crests/material overlays independent of team signals; shared base sprites remain

Current qualification: Implemented source coverage retained. The clean current Chromium regression supersedes stale run counts; final quality remains bounded by the evidence and open gates above.

### 13. Scale/duration

Quick/Standard/Epic/custom, 32–160-tile worlds and 4–180-minute pacing targets; not guaranteed endings

Current qualification: Configurable scales and pacing targets exist; natural 15–20 minute pacing and broad long-match acceptance remain unproven.

### 14. Escalation

Objective escalation and Conquest storm endings; Rush has shrinking territory

Current qualification: Implemented source coverage retained. The clean current Chromium regression supersedes stale run counts; final quality remains bounded by the evidence and open gates above.

### 15. Biomes

Four gameplay-affecting biomes meet the several-biome slice target; remaining listed environments are eventual examples

Current qualification: Implemented source coverage retained. The clean current Chromium regression supersedes stale run counts; final quality remains bounded by the evidence and open gates above.

### 16. Generation

Deterministic versioned maps; exposed resources/terrain/water/camps/objectives/symmetry/weirdness and portable codes

Current qualification: Implemented source coverage retained. The clean current Chromium regression supersedes stale run counts; final quality remains bounded by the evidence and open gates above.

### 17. Validation

Reachability/fairness/forces/footprints/teams with deterministic seed regressions and actionable editor errors

Current qualification: Implemented source coverage retained. The clean current Chromium regression supersedes stale run counts; final quality remains bounded by the evidence and open gates above.

### 18. Setup

Dimensions/seed/biome/slots/alliances/difficulty/personality/economy/caps/speed/mode exposed; one human command surface

Current qualification: Implemented source coverage retained. The clean current Chromium regression supersedes stale run counts; final quality remains bounded by the evidence and open gates above.

### 19. AI

Six personalities, same economic rules, bounded vision, recruitment/build/research/attack and headless metrics

Current qualification: Strategic AI exists and acts in native play. Broad faction/difficulty balance remains open; automated wins are not novice-fun evidence.

### 20. Campaigns

Two authored campaigns/eight chapters plus a genuine branching expedition with seven node classes/rewards

Current qualification: Two authored campaigns/eight chapters and branching Expedition exist. Full naturally earned campaigns and a current successful four-battle Expedition remain open.

### 21. Authoring

Typed definitions, build validation and campaign guide with missions/objectives/rewards/triggers/unlocks

Current qualification: Implemented source coverage retained. The clean current Chromium regression supersedes stale run counts; final quality remains bounded by the evidence and open gates above.

### 22. Triggers

Structured conditions/actions including unit/region/resource/objective/building cases, alliance and defeat; no arbitrary-script execution

Current qualification: Implemented source coverage retained. The clean current Chromium regression supersedes stale run counts; final quality remains bounded by the evidence and open gates above.

### 23. Editor

Dimensions/biome/terrain/resources/spawns/forces/objectives/camps/teams/victory plus save/load/clone/import/export/validation

Current qualification: Editor implementation and browser regression pass within Chromium coverage. This does not establish every physical-device gesture lifecycle.

### 24. Progression

Per-match technologies/buildings; persistent titles, campaign options, expedition charters and challenge choices

Current qualification: Implemented source coverage retained. The clean current Chromium regression supersedes stale run counts; final quality remains bounded by the evidence and open gates above.

### 25. Upgrades

Data-driven effects; new research construction-path and sequential-level tree with real costs/queue/lock states; no invented cross-tech dependencies

Current qualification: Upgrade framework exists. Contextual cost/population/queue reasons were a real presentation gap; next local clarity candidate addresses this without adding invented tech prerequisites.

### 26. Achievements

30 with counters/categories/hidden state/timestamps/persistence and command-record UI

Current qualification: Implemented source coverage retained. The clean current Chromium regression supersedes stale run counts; final quality remains bounded by the evidence and open gates above.

### 27. Statistics

Usage, army/resources, wins/losses, campaign progress, fastest wins, time and bounded local history

Current qualification: Implemented source coverage retained. The clean current Chromium regression supersedes stale run counts; final quality remains bounded by the evidence and open gates above.

### 28. Modes

Conquest/Domination/relic/Rush and scripted objectives exceed the required initial subset; allied/FFA AI supported

Current qualification: Implemented source coverage retained. The clean current Chromium regression supersedes stale run counts; final quality remains bounded by the evidence and open gates above.

### 29. Multiplayer boundary

Command/state separation and future-network guide; online backend, invite codes and multiple human clients deliberately not implemented

Current qualification: Implemented source coverage retained. The clean current Chromium regression supersedes stale run counts; final quality remains bounded by the evidence and open gates above.

### 30. Saves

Autosave/manual/Continue, migrations/errors, independent expedition checkpoint and staged result recovery. Named battle slots/backups were not required

Current qualification: Implemented source coverage retained. The clean current Chromium regression supersedes stale run counts; final quality remains bounded by the evidence and open gates above.

### 31. Music

Six state tracks, transitions and independent persisted Master/Music/Effects/mute

Current qualification: Six generated state tracks and controls exist. Complete subjective listening, repetition and device audibility remain open.

### 32. SFX

Synthesized capped event/action audio; final audibility and repetition review pending

Current qualification: Event sounds exist. Subjective feedback quality and dense-combat repetition remain open.

### 33. Effects

Combat/capture/building/ability/selection feedback, adaptive quality and reduced motion; manual quality setting is optional in original

Current qualification: Effects and five Mythic directional actors exist. Four remaining directional families and later style/theme requests are not complete.

### 34. Fog

Real visible/explored state and vision-limited tactical AI, including allied vision rules

Current qualification: Implemented source coverage retained. The clean current Chromium regression supersedes stale run counts; final quality remains bounded by the evidence and open gates above.

### 35. Minimap

Terrain/forces/bases/objectives/alerts/camera; collapse and touch navigation

Current qualification: Implemented source coverage retained. The clean current Chromium regression supersedes stale run counts; final quality remains bounded by the evidence and open gates above.

### 36. UI

Main modes, editor, record/achievements/statistics, settings, help and new Credits/About; complete contextual HUD

Current qualification: Core screens/contextual phone UI exist. Current source audit found typed resource-cost identity, selected health, building availability and placement copy gaps; local clarity work is separate from accepted baseline.

### 37. Accessibility

Actual scaled text on key surfaces, keyboard menu paths/focus, six team shapes, sound controls/reduced motion; final target/overflow review pending

Current qualification: Chromium viewport/enlarged-text/input tests pass with explicit skips. Real device/Safari, broader accessibility and uncoached usability remain open.

### 38. Manifest

Scoped start/scope/icons/standalone at current owner-authorized base; installed launch still needs candidate evidence

Current qualification: Implemented source coverage retained. The clean current Chromium regression supersedes stale run counts; final quality remains bounded by the evidence and open gates above.

### 39. Worker

Scoped cache/consent update; source maps excluded; local offline and scope-isolation assertions passed; deployed/installed-device checks remain open

Current qualification: Implemented source coverage retained. The clean current Chromium regression supersedes stale run counts; final quality remains bounded by the evidence and open gates above.

### 40. Tests

Unit, simulation/procedural, browser and PWA test infrastructure exists; current verified counts are stated above.

Current qualification: Current baseline: 588 unit tests and 448/472 browser identities pass with 24 qualified skips; not full-scope completion.

### 41. Bot play

Headless/accelerated AI matches and metrics; finite policy/scale comparisons; perfect balance was explicitly not requested

Current qualification: Implemented source coverage retained. The clean current Chromium regression supersedes stale run counts; final quality remains bounded by the evidence and open gates above.

### 42. Debug

Nonintrusive reveal/resources/spawn/speed/seed/FPS subset; the listed debug tools were suggestions, not every-item mandates

Current qualification: Implemented source coverage retained. The clean current Chromium regression supersedes stale run counts; final quality remains bounded by the evidence and open gates above.

### 43. Performance

Dense-query/separation optimization with exact-equivalence checks; cold 223.63ms movement spike and renderer/mobile evidence remain open

Current qualification: Known historical dense-render 30–32 ms medians and 223.63 ms cold movement spike remain qualified profiling evidence. Current physical-phone smoothness not established.

### 44. Pathfinding

Cached-grid A*, blocked terrain/buildings/groups/chokepoints, footprint access and steering slide; larger-world profiling continues

Current qualification: Implemented source coverage retained. The clean current Chromium regression supersedes stale run counts; final quality remains bounded by the evidence and open gates above.

### 45. Assets

Provenance documented in source and Credits/About; underlying reference rights and distribution license unverified

Current qualification: Project-generated/adapted assets are documented; underlying selected-reference redistribution/commercial-rights evidence remains unresolved.

### 46. Data definitions

Typed units/buildings/techs/commanders/factions/biomes/campaigns/objectives/achievements/upgrades; build validation

Current qualification: Implemented source coverage retained. The clean current Chromium regression supersedes stale run counts; final quality remains bounded by the evidence and open gates above.

### 47. Documentation

Required developer/authoring guides exist; current status and plan reconciled here; final release evidence still to append

Current qualification: Implemented source coverage retained. The clean current Chromium regression supersedes stale run counts; final quality remains bounded by the evidence and open gates above.

### 48. Pages

Current owner-selected repository/base implemented; production 493a475 and its visible hosted runtime are verified at the checkpoint above.

Current qualification: Authorized repository/base is implemented and actual hosted build verified after successful Pages deployment.

### 49. Content breadth

Current counts meet/exceed approximate slice targets; quality and usable depth matter more than further count growth

Current qualification: Content counts substantially meet vertical-slice targets; meaningful use, balance and remaining explicit archetype/content gaps still require work.

### 50. Teaching campaign

Rise of the Frontier's five chapters plus eight-step practice and second campaign; Outpost/Hold the Line earned, Broken Alliance opens. Remaining full natural route review pending

Current qualification: Teaching campaign exists. Previously earned first chapters and genuine later losses remain evidence; complete natural campaign acceptance remains open.

### 51. Game feel

Responsiveness/feedback/placement/control work implemented; novice feedback remains an ordinary-play acceptance gate

Current qualification: Actual hosted controls work in bounded desktop smoke. Combat readability, responsive tactical selection, audio and pacing need further hands-on refinement.

### 52. Iteration

Bounded fixes/tests/profiling with failures tracked; final browser findings must drive the next corrections

Current qualification: Implemented source coverage retained. The clean current Chromium regression supersedes stale run counts; final quality remains bounded by the evidence and open gates above.

### 53. Working subsets

Original expressly permits useful extensible subsets with documented expansion; no broken or misleading advertised feature is excused

Current qualification: Original explicitly allows useful documented subsets; this does not excuse broken advertised behavior or silently cancel supplemental commitments.

### 54. Autonomy

Reasonable engineering/design choices remain authorized; only actual blocking ambiguity needs owner input

Current qualification: Routine engineering/game-design autonomy is ongoing, bounded by current authorization and evidence.

### 55. Final verification

Clean final install/checks/build, production base/assets/manifest/worker/offline/save/modes/desktop/mobile execution remain release gates

Current qualification: Fresh installation/build/units and one complete Chromium gate pass for baseline; 3 previous-dist upgrades and physical/Safari/subjective/broadnaturalplay remain unverified.

### 56. Delivery

Final concise summary, verified play destination, extension instructions and candid limits follow actual acceptance

Current qualification: Deployed testing preview, source history, documentation and evidence are delivered; overall game/commercial completion is not claimed.

## Prioritized remaining batches

1. Battlefield decision clarity: resource-typed prices, actual health/capacity, contextual unavailable-action reasons and legible placement status. Preserve existing costs, engine revalidation, paid queues, saves and touch targets.
2. Tactical control and measured responsiveness: useful subset selection, crowd/occlusion clarity and input/render profiling at ordinary as well as dense scales. Fix measured bottlenecks without changing simulation correctness.
3. Complete playable progression: resolve Engineer siege identity, play later chapters and a full current Expedition naturally, then tune demonstrated pacing/dead ends/counter usefulness.

Supplemental unfinished art remains separate: full directional Warlord, Engineer, Runebreaker and Mender; four more theme families; realistic/sticker styles and themed music. Online multiplayer, all eventual biomes, naval expansion and optional formation/graphics features remain qualified future scope rather than invented present blockers.
