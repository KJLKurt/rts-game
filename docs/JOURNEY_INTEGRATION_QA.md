# Recovered journey/audio integration QA

Date: 2026-10-04. This records freshly reconstructed local candidate evidence. The previous workspace's 419-test result is not reused as evidence for this source.

## Reconstructed runtime

- Two campaigns/eight chapters are reachable through the real menus, with graph unlocks, required/optional objective briefings and checklist, retry, saved identity, and explicit successor buttons.
- Expedition menus drive all seven node classes: battle, elite, village, shop, relic, event, and boss. Rewards, shop prices, charter tradeoffs, player-only modifiers, defeat/completion/replay, and journal validation use the existing tested reducer.
- A separate validated expedition encounter checkpoint survives replacement of ordinary Continue by a skirmish. Choices commit before advancing; duplicate async input and stale navigation are guarded. Missing encounter data restarts only the current valid stop.
- Raw v1 profile migration preserves previous progress. V2 records include 30 achievements, six categories, progress/hidden/timestamp state, army/resource and faction/commander usage statistics, history, and earned cosmetic/charter/challenge choices.
- Result recording shares alliance and scripted-mission semantics. Workshop tests still bypass profile, battle, and expedition persistence. Setup's large-army warning and novice HUD/queue work are preserved.
- Audio selects menu/exploration/tension/combat/victory/defeat. `start` arms music; only trusted pointer/keyboard gestures call `unlock`; result transitions are idempotent; user volumes remain independent.

## Fresh verification

- `npm run check`: passed.
- Full Vitest: **441 tests across 43 files passed** on recovered integrated source.
- `npm run build`: passed; content validation sees **8 story missions**, and the service worker contains **24** scoped cache entries.
- `git diff --check`: passed.
- `tests/journey-integration.test.ts`: 16 tests check shared content/view contracts, stable chapter save identity, fired triggers, invalid metadata, independent expedition checkpoints, replay/damage recovery, and real profile storage migration.
- The Outpost regression now references the authored wagon at 75 seconds. The Ironwatch assertion requires a genuinely destroyed rival keep and the authored objective result. No simulation mechanics were changed for these assertions.
- `tests/browser/journeys.spec.ts --list` discovers six scenarios in desktop/phone-portrait/phone-landscape projects: 18 cases. Discovery is not execution.

## Runtime gates

This integration task has not executed the recovered production-browser cases. They are provided for the independent browser-capable QA executor. Existing pre-loss browser failures or successes do not establish the recovered candidate's behavior.

The new browser scenarios cover both chapter menus/objective UI/save-Continue, result idempotency and title/category persistence, chapter defeat/retry, an independent expedition checkpoint after a skirmish, route/shop/reload/elite/relic/boss/completion/defeat/replay, and gesture-gated six-state audio. Outcome fixtures intentionally isolate result UI/persistence; they do not claim human-playthrough balance. Objective fulfillment and real siege commands are covered separately in simulation tests.

Run the journey, audio-codec, workshop, first-candidate, and full browser suites on the supplied final build. Also do ordinary first-time desktop/native-touch playthroughs, long-dialog scrolling, 44px chapter controls, repeated choices, interrupted navigation, storage failures, and offline recovery. Audition full loops/seams and results on headphones and a physical phone speaker. Musical quality and physical-device listening remain open.

## Private QA bundle

Extract the source and dist archives into the same empty directory. The dist archive includes `dist/` and the already-used static test host. From that directory run:

```sh
node tests/browser/serve-production.mjs
```

It serves only `http://127.0.0.1:4181/rts-game/`; no repository publication or deployment is needed. With existing compatible Playwright dependencies, use `FRONTIER_TEST_URL=http://127.0.0.1:4181/rts-game/` to avoid rebuilding the supplied candidate. Full source/test files and configuration are included separately; neither archive includes node_modules, Git internals, or private execution logs.
