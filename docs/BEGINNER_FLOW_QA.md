# Beginner-flow recovery

The home-screen **Learn to command** mode is peaceful practice with eight persistent lessons: move; capture gold; capture timber; inspect the keep; train three soldiers; complete two neighboring houses; upgrade one house; capture a relic.

## Interaction changes

- Practice starts with no build/recruit/research choices. Tabs explain the next unlock instead of showing the full catalog.
- The recruitment lesson exposes Swordsman. The housing lesson exposes House. The upgrade lesson enables House development in Details. Finishing all eight lessons opens all options for continued practice.
- Those restrictions are confined to the practice UI/input path. Normal skirmishes and story chapters retain all their ordinary choices.
- Two living, completed houses must have non-overlapping footprints and an edge-to-edge gap of 0.25–1 tile. One house, unfinished houses, overlapping houses and distant houses do not complete the lesson. The second House preview suggests a legal neighboring site; players can still reposition it.
- Instructions explain that houses give troop population capacity, do not create workers, add 8 each (subject to the match ceiling), and can be upgraded for 4 more capacity.
- Target-help buttons fold the guide/panel and focus the playable area. The practice guide remains available in phone landscape, with scrolling for long instructions.
- Completion explicitly launches Rise of the Frontier / The Outpost, even when the player previously selected The Ember Road.

## Checks

- `npm run check`: passed after integration.
- `npm test`: 493 tests passed in 49 files across the integrated checkout.
- `npm test -- tests/learning.test.ts tests/inspection.test.ts`: 12 tests passed.
- `npm run build`: content validation, TypeScript, Vite production build and service-worker generation passed.
- `tests/browser/learning.spec.ts` adds a fully real-input eight-lesson route, a real save/reload milestone route, and normal-campaign option checks. Both run on desktop, phone portrait and phone landscape. State reads inspect evidence/geometry; no test mutates game state, issues debug commands, replaces a save, or sets tutorial progress.
- Local browser launch was blocked before any page opened by Chromium's socket restriction. The new browser tests require execution in the supported independent QA environment; they are not represented as locally passing.

## Peaceful-practice combat regression, 2026-10-05

Independent phone QA completed the eight lessons and save/reload/Outpost route, but observed commander health falling from 713 to 639 near the final relic. The old practice initializer retained every team's keep while disabling AI planning. Fortification auto-fire does not depend on AI planning, so the original no-raid test did not cover this hazard.

The corrected initializer keeps only the player's commander and keep. The shared hostility predicate additionally treats practice as noncombat, protecting checkpoints created before this fix that still contain rival keeps. This does not merge alliances, resource ownership or income, and does not delete or replace old progress, buildings or production queues. Ordinary battles continue to use the original hostile relationships and fortification damage.

`tests/learning-peace.test.ts` covers:

- One-, three- and five-rival layouts start without rival entities.
- Actual move/capture commands reach every gold, timber and relic site and former rival spawn with zero damage, losses or forced result.
- An older-style checkpoint retaining a rival keep preserves its recruitment queue, then remains safe on a two-tile sample grid across walkable districts, including the old keep's firing radius.
- Ordinary keeps still damage a nearby commander with AI planning disabled.

Three of these four tests failed on the pre-fix code; all four passed after the fix. The existing eight-lesson browser regression now asserts zero cumulative damage and zero wounded troops at completion, so passive healing cannot conceal a temporary hit. That strengthened browser assertion has not been executed locally; the available local browser runner remains blocked before launch.
