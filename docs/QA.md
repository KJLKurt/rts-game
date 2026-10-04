# QA and reproducible verification

## What has actually been checked

Local verification on 2026-10-04 (latest aggregate: 03:53 UTC):

- TypeScript: `npm run check` passed.
- Unit/contract suite: `npm test` passed 96 tests across engine, maps, strategic AI, Rush Arena, content, save restoration, and platform storage/PWA. The map suite includes 400 deterministic generated maps.
- Production: `npm run build` passed, including generated service worker and 14 precached files at this checkpoint. Asset counts can change as art/audio are integrated.
- Browser suite: `npx playwright test --list` discovered 72 cases, including intentional platform-specific skips. Discovery and TypeScript compilation are **not browser execution**.
- Real browser execution in the original workspace was blocked by Chromium socket sandbox EPERM. A separate attempted executor escalation failed at infrastructure setup. Cloud browser navigation to that workspace's loopback URL was also blocked. No browser pass, offline-reload pass, touch pass, screenshot review, or audible-audio verification is claimed from that workspace. Do not weaken sandbox/browser security to work around this.

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

Screenshots, traces, and failure videos are retained under ignored output directories. The skirmish test also captures the battlefield in each tested viewport.

## Coverage and evidence boundaries

### Actual browser flows

Three projects exercise desktop 1440×900, phone portrait 390×844, and phone landscape 844×390. Tests cover:

- Main menu, repeated help/settings Escape dismissal, setup choice persistence, achievements and expedition entry.
- Delayed real IndexedDB request completion: the menu appears immediately and late Continue hydration cannot replace a new active match.
- Configured skirmish launch at the repository base path.
- Real map clicks/taps, army selection, hold orders, WASD/space, and Chromium touch input to the joystick, including cancellation.
- Recruitment through the UI followed by actual production time.
- Tactical pause freezing time while move, build, and research orders queue, then execute on resume.
- Repeated building-placement cancel without spending resources.
- Save/leave, page reload, repeated Continue, retained queued orders and mission identity.
- Settings persistence and dialog dismissal.
- Viewport containment, horizontal overflow, and rotation.
- Brutal's ordinary menu suspending simulation despite restrictions on tactical pause.
- Unsupported-save recovery without a dead-end menu.
- Rush setup/cancel/reopen, real commander input, the first naturally spawned enemy wave, and a turret ability.
- Rush upgrade offer/dismiss/reopen/claim, run save/continue, and completed-run save/profile protection. Rush upgrade and terminal tests shorten the next scheduled simulation deadline solely to reach the relevant UI state; they do not prove survival balance or a full four-minute playthrough.
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

The separate browser runner materialized the exact checkpoint02 production build and verified every asset hash. It rendered the real atlas on desktop and phone. It exercised movement, selection, recruitment, construction, captures, combat, abilities, tactical queued orders, saving/reloading, pan/pinch, and loss/restart. Its production service worker activated within `/rts-game/`, cached all14assets, and a phone save resumed and advanced with network disabled. These checks are narrower than execution of the entire Playwright suite, and they do not establish a complete skirmish win or repeated-match fun. A first normal-input Rush attempt ended in defeat at114seconds outside the shrinking ward; a retry remained under review.

The v4 checkpoint was also installed from a clean archive using `npm ci` with the lockfile and then passed typecheck, all90 tests present at that point, and production build. Later validation additions are covered by the final aggregate above.
