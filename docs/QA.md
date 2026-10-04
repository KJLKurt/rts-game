# QA and reproducible verification

## What has actually been checked

Local verification on 2026-10-04 (latest aggregate: 05:16 UTC):

- TypeScript: `npm run check` passed.
- Unit/contract suite: `npm test` passed 149 tests across 19 files, covering engine, maps, strategic AI, Rush Arena, content, save restoration, input targeting, combat feedback, audio controls, and platform storage/PWA. The map suite includes 400 deterministic generated maps.
- Production: `npm run build` passed, including generated service worker and 14 precached files at this checkpoint. Asset counts can change as art/audio are integrated.
- Browser suite: `npx playwright test --list` discovered 93 cases, including intentional platform-specific skips. Discovery and TypeScript compilation are **not browser execution**.
- Real browser execution in the original workspace was blocked by Chromium socket sandbox EPERM. A separate attempted executor escalation failed at infrastructure setup. Cloud browser navigation to that workspace's loopback URL was also blocked. No browser pass, offline-reload pass, touch pass, screenshot review, or audible-audio verification is claimed from that workspace. Do not weaken sandbox/browser security to work around this.

Separate supported cloud-runner playtesting on the earlier preview reported a complete 240-second Engineer Rush victory, service-worker update consent with save preservation, and phone offline play with the atlas loaded. Those are useful real-browser results, but the newest onboarding/guard/HUD/audio-control fix batch is not yet included in that preview. The first isolated90-case Playwright run is recorded below; do not describe manual checks as a full automated-suite pass. The then-public `3937eef` preview predates this batch.

This is a checkpoint, not a permanent assertion that later edits passed. Rerun the commands after integration. Record the exact commit and final results when the supported browser runner is available.

## Run it

```sh
npm ci
npm run check
npm test
npm run build
npx playwright install chromium
npm run test:browser
```

Playwright automatically builds and starts a production-only loopback host at `http://127.0.0.1:4181/rts-game/`. It never silently substitutes the development server, where the service worker is disabled. The test host is outside `public/` and is not shipped. Stop any conflicting listener before running the suite.

Use an already installed, supported browser with:

```sh
PLAYWRIGHT_EXECUTABLE_PATH=/path/to/chromium npm run test:browser
```

To test an already served deployment instead:

```sh
FRONTIER_TEST_URL=https://example.test/rts-game/ npm run test:browser
```

An external deployment skips only the synthetic-new-release test because it has no test-only release endpoint. Offline reload and manifest/worker checks still execute. Use an isolated browser profile/context; test saves must never replace a player's real save.

Inspect failures with:

```sh
npx playwright show-report
npx playwright show-trace test-results/.../trace.zip
```

Screenshots and traces are retained under ignored output directories. CI videos are disabled; the report contains failure traces/screenshots without a second copied trace/video tree. The skirmish test also captures the battlefield in each tested viewport.

## Coverage and evidence boundaries

### Actual browser flows

Three projects exercise desktop 1440×900, phone portrait 390×844, and phone landscape 844×390. Tests cover:

- Main menu, repeated help/settings Escape dismissal, setup choice persistence, achievements and expedition entry.
- Delayed real IndexedDB request completion: the menu appears immediately and late Continue hydration cannot replace a new active match.
- Configured skirmish launch at the repository base path; helpers explicitly acknowledge the first-skirmish briefing instead of clicking through its overlay.
- First-run briefing freezes tick, time, entity positions, health and losses until Start battle is acknowledged, and does not repeat on the next skirmish.
- An ElementHandle for Windstep remains connected and identifies the same button while idle, through a full cooldown, and after readiness returns.
- The field guide stays on its movement step after a first recruit finishes when the commander has not moved/captured.
- A newly built Archery Range updates visible Archer readiness without switching/reopening Recruit, then accepts a real recruitment order. This waits for actual construction at the UI's 2× speed.
- Commander focus centers the hero on an unobscured battlefield location in all tested orientations.
- Real map clicks/taps, army selection, hold orders, WASD/space, and Chromium touch input to the joystick, including cancellation.
- Recruitment through the UI followed by actual production time.
- Tactical pause freezing time while move, build, and research orders queue, then execute on resume. A queued House reports a queued build and is not created before resume.
- Repeated building-placement cancel without spending resources.
- Save/leave, page reload, repeated Continue, retained queued orders and mission identity.
- Master volume, mute, Music/Effects and reduced-motion persistence plus dialog dismissal. Range sliders use native Home/ArrowRight interaction; unsupported range-input fill is not used.
- Viewport containment, horizontal overflow, and rotation.
- Brutal's ordinary menu suspending simulation despite restrictions on tactical pause.
- Unsupported-save recovery without a dead-end menu.
- Rush setup/cancel/reopen, real commander input, the first naturally spawned enemy wave, and a turret ability.
- Rush squad population has an honest squad label rather than a zero population cap. Rush upgrade offer/dismiss/reopen/claim, run save/continue, and completed-run save/profile protection. Rush upgrade and terminal tests shorten the next scheduled simulation deadline solely to reach the relevant UI state; they do not prove survival balance or a full four-minute playthrough.
- Editor paint, save/open, downloaded JSON, import, validation, and test-map round trip; malformed imports.
- Manifest/icon paths, service-worker scope and precache, offline launch/continue/campaign/editor/new game.
- New worker discovery waiting for consent, save-before-restart, and restored battle after update.

The existing `window.__FRONTIER__` bridge is used for assertions and geometry lookup. Gameplay is initiated and commanded through the real UI. The corrupt-save fixture intentionally changes storage to exercise error recovery. It is not used to fake a gameplay success. No twenty-minute wait substitutes for engine simulation coverage. Rush terminal tests explicitly shorten a survival deadline as a fixture to exercise the real end-of-run UI transition; an independently played full match remains a manual acceptance item.

The update test uses a test-only POST endpoint to alter the served worker's cache version. That triggers the browser's actual update lifecycle. It does not change a production deployment or delete player data.

### Node platform contracts

`tests/platform.test.ts` tests storage namespacing, cloned defaults, corrupt JSON, denied storage, IndexedDB transaction completion, local fallback, quota failure propagation, and scoped deletion. The IndexedDB object is a minimal in-memory test double. It is **not evidence of real-browser IndexedDB durability**.

PWA coordinator tests mock browser event targets to check scope, explicit update consent, pre-activation save ordering, save rejection, update discovery, and registration failure. A separate temporary production fixture runs the actual worker generator and evaluates the result in a VM to inspect precache membership, activation messages and sibling-cache isolation. These checks complement real offline/update tests; they do not replace them. Three additional real-engine corruption regressions now require missing fog, unknown commander settings, and missing commander cooldown state to be rejected clearly or safely repaired before gameplay. These initially failed; all three passed after save hardening in the latest 68-test aggregate run.

### Simulation

The engine/maps/Rush tests are maintained alongside their implementation. They cover deterministic stepping and serialization, commands, pause rules, economy, capture, unit counters, prerequisites, production, upgrades, fog, victory, seeded map validity, and the dedicated arena loop. Headless balancing/simulation runs should record seed, settings, final time, winner and unit/building counts separately from browser results.

## Manual acceptance still required

Automated checks cannot establish that the game feels good. On at least one real phone and a desktop:

1. Start from a cold production URL; inspect full battlefield screenshots and startup errors.
2. Play an uninterrupted standard match to an actual ending, then retry. Check pathing, readable combat, capture feedback, building placement and AI pressure.
3. Rotate mid-drag, interrupt a joystick with a menu/backgrounding, and return. No stuck movement or unintended orders should remain.
4. Install the PWA; close it, disconnect network, reopen and continue. Check campaigns, editor and media from the installed surface.
5. Hear music/SFX after a real tap. Confirm gain, mute, transitions and persistence. Decoded buffers or running AudioContext alone do not establish audibility.
6. Inspect unit silhouettes, team symbols, selection/health overlays, depleted deposits, construction, fog and animation pivots at 390px width and low zoom.
7. Review keyboard focus order, modal focus containment/return, accessible labels, touch target sizes, reduced motion, and text contrast.
8. On a production-like host, deploy a new release while a battle is open; verify it stays running until consent and the latest save survives the restart.

## Findings to recheck after integration

Code review found the following issues and sent them to the integration owner. Listing a fix below is not a claim of browser verification:

- Landscape-phone joystick was hidden by width-only media rules.
- Brutal pause menu claimed suspension while the simulation continued behind its modal.
- Save success toast could overwrite a storage-failure toast.
- A completed match could be re-saved on blur/update and counted again when continued.
- Damaged saves with absent fog/cooldown data or unknown commander settings escaped restore validation and crashed presentation/simulation; real-engine regressions were added.
- Worker generator initially passed an array to `crypto.update`; fixed before the successful production build above.
- Recruitment readiness used a single canonical building rather than each actual producer's roster; integration owner reported a fix.

Keep regressions as tests rather than suppressing them to obtain a green report. When a browser failure is a test-fixture problem, explain that distinction and repair the fixture without weakening the product assertion.

## Separate production-runner evidence

The separate browser runner materialized the exact checkpoint02 production build and verified every asset hash. It rendered the real atlas on desktop and phone. It exercised movement, selection, recruitment, construction, captures, combat, abilities, tactical queued orders, saving/reloading, pan/pinch, and loss/restart. Its production service worker activated within `/rts-game/`, cached all14assets, and a phone save resumed and advanced with network disabled. These checks are narrower than execution of the entire Playwright suite, and they do not establish a complete skirmish win or repeated-match fun. A first normal-input Rush attempt ended in defeat at 114 seconds outside the shrinking ward. The next normal-speed Engineer attempt won at 240 seconds, wave 14, with 80 kills and five survivors using actual movement, abilities and five upgrades. A complete phone skirmish ended in defeat at 510.6 seconds, with five captures and 76 kills; recruitment, commander respawn, house capacity and restart were exercised. Those results establish functioning repeated match loops, not broad difficulty balance.

The v4 checkpoint was also installed from a clean archive using `npm ci` with the lockfile and then passed typecheck, all90 tests present at that point, and production build. Later validation additions are covered by the final aggregate above.

## Fair opening and objective-clarity release

The first skirmish now waits on a frozen briefing. Idle troops use a fixed two-tile guard anchor and return locally rather than chasing through camps; Easy consolidates its home side for its first minute and still defends real attacks. Relic control and actual score income are visible in the HUD. Public relic landmarks appear as neutral gold minimap symbols before exploration, and the gold Relic button gives an explicit army capture order. Unknown enemy ownership and hidden troops remain concealed. Camera focus accounts for HUD and command-deck occlusion.

The browser suite now also checks visible relic income, one queued capture order, public-landmark routing, fog privacy and actual army movement in all three viewports. New render tests cover one-shot event feedback, hidden-event privacy and minimap markers. New Master/mute controls are covered by audio routing contracts and browser persistence cases. The newest batch still needs its isolated actual-browser execution and manual visual recheck.

Outpost opening regression uses the reported 1.5-second diagonal joystick displacement at 4.5s and confirms all four starters remain full health at 6.2s. A genuine save produced by deployed3937eef, with idle troops already pursuing and an injured archer, restores without healing or economy changes, fixes guard anchors once and remains deterministic for 80 seconds.

## First isolated browser run: 2026-10-04, 05:04 UTC

Exact source `1a6b1ae72be0eef5f33de86dcb82a77196db1803`, [run37178182518](https://github.com/KJLKurt/rts-game/actions/runs/37178182518): **63 passed,19 failed,1 flaky,7 skipped** in12.2minutes. The run is not green and was not promoted to Pages.

Confirmed causes and follow-up fixes:

- A shared helper attempted to dismiss a landscape-hidden guide, accounting for the broad landscape timeout cluster. It now clicks only a visible control. No product assertions were removed.
- Campaign briefing used modal suspension rather than the internal tactical-pause flag. The fixture now checks that actual time,tick and entities freeze, then resume through the real button.
- Build-site fixtures copied obsolete spacing rules. They now run canonical `canBuild` on a read-only state snapshot, while placement remains a real screen tap.
- **Genuine save race:** an immediate Rush Save & leave reused the startup save promise and its older time0 snapshot. Each new request now captures its own snapshot and enters an ordered write queue. Save/delete/continue ordering is tested, and the exact saved-state browser assertion remains intact. The related flaky landscape Rush save had the same time0 symptom and is treated as the same defect, not dismissed as harmless flakiness.
- All three actual PWA tests passed: scoped worker/assets, offline save/continue/new game/campaign/editor, and explicit update consent with save-before-restart.

The seven skips are deliberate input-applicability exclusions: keyboard movement on two touch projects; desktop Escape dismissal on two touch projects for each of two cases; and phone joystick on the desktop project. The counterpart input paths remain tested. No PWA case was skipped on the isolated production host.

CI now stops after six failures to bound systemic fixture waste. Videos are disabled, traces are recorded only on the first retry (original failures still retain screenshots), duplicate result/trace trees are omitted, and future artifacts retain two days. The original archive remains unchanged pending owner approval for cleanup; its full traces/screenshots were preserved and a concise failure summary retained locally. The corrected93-case run adds a deterministic delayed-IndexedDB save-race check in all three viewports. It is pending; do not claim a passing full suite.

## Corrected run: 2026-10-04, 05:23 UTC

Exact source `31e64feabb19448b55e0aaaea3ded6ee08a131a7`, [run37179505878](https://github.com/KJLKurt/rts-game/actions/runs/37179505878): **84 passed,2 failed,7 skipped** in4.7minutes. All three deterministic delayed-save tests passed, as did all PWA cases; no flaky result was reported.

The two remaining failures were diagnosed from the downloaded report and actual trace/screenshots:

- Rush's older fixture reloaded immediately after clicking Save & leave, before its asynchronous completion/menu acknowledgement. It now waits for visible Continue and a closed dialog, then checks exactly the same saved seed/time/Rush state. The deterministic in-flight-write test remains unchanged.
- Real landscape→portrait defect: the prior fixed pixel canvas display width retained an844px mobile layout viewport after a390px rotation, shrinking the whole interface. The backing buffer remains pixel-sized, but CSS now controls display dimensions responsively and root overflow is bounded. Rotation checks now assert exact layout viewport dimensions before and after opening/dismissing a dialog, plus the existing control bounds.

The second artifact ZIP was31,556,860bytes with two-day retention, versus the first1,544,649,507byte archive. The next acceptance run is pending.
