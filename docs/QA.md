# QA and reproducible verification

## Current troop badge and difficulty diagnostic receipt — 5 October 2026

Candidate **`fc-9ad03334aff3`** corrects troop-summary overlap with visible HUD controls, including wrapped composition text in short landscape, and adds Broken Alliance preparation/combat guidance in its briefing and live objectives. All fifteen simulation files and every campaign setting, trigger, objective predicate, reward and unlock remain unchanged. The final gate passes **536 unit/contract tests in 57 files**, TypeScript/build and eight mission validations. The full **322-case** production browser run has **301 passes / 21 intentional skips / zero failures or flakes**. Three separately executed upgrades from the actual previous production cache fulfill three skipped cases, giving **304 verified / 18 remaining skips within the same 322 cases**; all four PWA cases pass. See [TROOP_BADGE_DIFFICULTY_QA_20261005.md](TROOP_BADGE_DIFFICULTY_QA_20261005.md) for three-viewport geometry evidence, native earned-profile/online-offline save checks, 13 controlled counter arenas and seven mission comparisons. Normal AI automatic ranged kiting and the earned rival territory/income advantage are identified; no balance nerf or new naturally earned win is claimed.

## Prior content build and subsequent earned terminal receipt — 5 October 2026

Build **`fc-ecbc0d4070f9`** has the retained complete local gate: **536 unit/contract tests in 57 files**, TypeScript/build with eight validated missions, and **319 distinct browser cases: 298 passed / 21 intentional skips / zero failures or flakes**. Three separate actual previous-cache upgrades fulfill three skips, giving **301 verified / 18 remaining skips within the same 319 cases**. All four PWA cases pass. See [ASSET_AUDIO_CONTENT_AUDIT_20261005.md](ASSET_AUDIO_CONTENT_AUDIT_20261005.md). These are retained receipts, not a new suite run for the documentation continuation.

The same naturally earned Broken Alliance run continued to Keep defeat at **729.3 seconds**. Native result persistence and reload preserve the full profile at **seven games / three wins**, with Outpost and Hold the Line completed. The loss is recorded once; a necessary retry remains separately saved. See [EARNED_ALLIANCE_TERMINAL_QA_20261005.md](EARNED_ALLIANCE_TERMINAL_QA_20261005.md). Full natural routes, physical Safari/device testing, subjective listening and exact hosted browser play remain unverified. The lead reports publication `59bc7bdf9227af1d71865fe4e07937c92c30dd6c`; this cloud task ran no Actions/deployment.

## Prior isolated guidance receipt — 5 October 2026

Build `fc-9011b0514b9c`: **525 tests in 55 files passed**, TypeScript/eight mission validations/production build passed, and **127 unique scoped browser cases account for 120 passed/seven intentional skips/zero final failures or flakes**. This includes four local PWA cases and 21 new native-input/persistence cases. New screenshots and landscape scroll/actions were inspected. All 15 simulation files are unchanged. Earned-defeat Practice reached lesson 3/8 and reloaded exactly at 19.2 seconds; an unfinished Normal continuation reloaded exactly at 201.8 seconds. See [DEFEAT_GUIDANCE_QA.md](DEFEAT_GUIDANCE_QA.md) for reproductions, harness corrections and evidence limits.

The separate unchanged frozen usability release completed full acceptance: **274 cases, 253 passed, 21 intentional skips, zero failures/flakes**, and a natural Standard-derived defeat at 863.5 seconds (14:23), followed by verified retry/reload. These totals do not describe a full rerun of the guidance candidate. Hosted access remains blocked before assets; no push, workflow or deployment was run for this batch.

## Prior isolated usability receipt — 5 October 2026

The isolated usability candidate identifies itself as **Build `fc-7f2be308bbca`** in the menu footer and Credits / About. It passes **519 unit/contract tests in 55 files**, TypeScript checks and the production build. A fresh focused browser run covers **109 cases: 102 passed, seven intentional skips, zero failures/flakes**; the separate actual previous-cache upgrade adds **one passing case**, for **110 scoped cases / 103 passed / seven skipped**. This focused run does not replace the prior full-suite receipt. Runtime `index-eiI64Ww3.js` / `index-BmuM_yap.css`; worker cache `35e0f9b54183`; 24 precached files; base `/rts-game/`. A repeat build produced identical bytes in all 26 output files. See [USABILITY_RELEASE_QA.md](USABILITY_RELEASE_QA.md).

Native desktop input earned the prior checkpoint’s Outpost win at 43.8 game seconds. Further actual-input play on the published clarity checkpoint ended a Balanced expedition in first-battle defeat at **408.4 game seconds (6:48)**, saved the result once and opened its defeated route with 0/4 victories. Quick-, Standard- and Epic-derived skirmish openings were played with real UI input and saved unfinished; their exact bounded observations are in [NATIVE_PLAY_20261005.md](NATIVE_PLAY_20261005.md). No successful four-battle route, guaranteed match duration or subjective fun verdict is claimed. All 15 simulation source files remain unchanged in this usability pass.

Local sandbox-enabled Linux Chromium and emulated phone touch were tested. Hosted HTTPS access was denied by this cloud environment before assets loaded (proxy 403 / browser ERR_TUNNEL_CONNECTION_FAILED); hosted gameplay, asset matching and cache lifecycle therefore remain unverified here. The owner separately confirmed the updated public UI was visible, which is not a full playtest. Physical Safari/devices, installed-device lifecycle/performance, full later natural routes, broad balance, soundtrack listening and commercial asset rights remain open. No GitHub workflow or deployment was run for this QA pass.

## Prior published clarity receipt — 5 October 2026

**516 tests in 54 files passed**, TypeScript checks and the production build passed (eight story missions validated). The final local production browser run accounted for **262 cases: 244 passed, 18 intentional input/layout-specific skips, zero failures or flakes**. The run used sandbox-enabled Linux Chromium 151 and Playwright 1.63.0 with desktop 1440×900, emulated touch 390×844 and 844×390, plus four actual offline/update PWA cases. No new Actions or deployments were run.

Production fingerprints: `index-DJ5oCh_8.js` / `index-BLaajxx7.css`; service-worker cache `c8affbd450ca`; 24 precached files; `/rts-game/` base. Held portrait objective checks additionally passed six repeated executions. The main run is a fresh complete run after all product and fixture corrections.

Native input earned The Outpost at 43.8 game seconds: nine surviving troops, one troop loss, one commander death, four kills and two captures. The terminal HUD showed 5/5 and capacity 20; one win saved, the retry-saving control hid after success, and Next chapter opened Hold the Line at time 0. A fresh Balanced expedition captured extra gold and timber by 46.1 seconds, raised both incomes, and resumed at the exact saved time. Its retained supply credit survives expired capture events and tips disabled. The current expedition remains unfinished; no earned later branch is claimed.

The runnable gate covers movement/selection/stick/rotation, recruiting/refunds/reservations, construction/inspection/research, capture/fog/AI-facing commands, pause/orders, learning, win/loss/retry, Rush, editor, interruption, result durability, save/reload, audio controls and local PWA/subpath/update flows. All eight peaceful lessons use actual input; result, raid, affordability, branch and storage-failure fixtures are explicitly labeled. Those fixtures do not establish a natural win or subjective fun/balance.

Observed defects corrected: live objective-control replacement; stale terminal objectives/capacity; tutorial advancement/preferences after results; incorrect supply credit from starting ownership/relic counters; unclear recruitment/rally/capture destinations; short-landscape joystick interception of the learning action; and a saved-result retry button whose hidden attribute was overridden by CSS. The terrain/camera move fixture now uses the real battlefield Focus control; learning verifies the hit target directly. No assertions were replaced with forced input or arbitrary sleeps. All 15 simulation source files are unchanged from the supplied clarity input; no AI/economy/unit/map balance adjustments were made in this final pass.

Linux Chromium and emulated phone touch were tested; physical iPhone/Safari, installed-device lifecycle/performance, subjective soundtrack listening, full natural campaign/expedition routes, broad balance and exact deployed-release checks remain open. Asset provenance and distribution licensing still need commercial review. Publication of the final source and hosted validation are coordinated separately. See [CLARITY_VERIFICATION.md](CLARITY_VERIFICATION.md) and [REQUIREMENTS_STATUS.md](REQUIREMENTS_STATUS.md).

## Historical receipts

Everything below retains dated earlier checkpoints. Their test totals and words such as “current” or “pending” describe those checkpoints, not the usability candidate above.

## What has actually been checked

Local verification on 2026-10-04 (latest aggregate: 06:14 UTC):

- TypeScript: `npm run check` passed.
- Unit/contract suite: `npm test` passed 195 tests across 25 files, covering engine, maps, strategic AI, Rush Arena, content, save restoration, input targeting, combat feedback, audio controls, and platform storage/PWA. The map suite includes 400 deterministic generated maps.
- Production: `npm run build` passed, including generated service worker and 16 precached files in the current polish build. Asset counts can change as art/audio are integrated.
- Browser suite: `npx playwright test --list` discovered 102 cases, including intentional platform-specific skips. Discovery and TypeScript compilation are **not browser execution**.
- Real browser execution in the original workspace was blocked by Chromium socket sandbox EPERM. A separate attempted executor escalation failed at infrastructure setup. Cloud browser navigation to that workspace's loopback URL was also blocked. No browser pass, offline-reload pass, touch pass, screenshot review, or audible-audio verification is claimed from that workspace. Do not weaken sandbox/browser security to work around this.

Deployed core `4afcfbd` passed 150 unit/contract tests and the complete applicable browser suite:86 passed, 7 input-specific skips, zero failures or flakes. Its scope includes the fairness, save, rotation and objective fixes. The current attack/picking/income/raid/capture-hold polish working tree has newer local tests but is not yet browser-accepted. Independent manual outcomes are listed in `PLAYTESTS.md`.

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

The separate browser runner materialized the exact checkpoint 02 production build and verified every asset hash. It rendered the real atlas on desktop and phone. It exercised movement, selection, recruitment, construction, captures, combat, abilities, tactical queued orders, saving/reloading, pan/pinch, and loss/restart. Its production service worker activated within `/rts-game/`, cached all14assets, and a phone save resumed and advanced with network disabled. These checks are narrower than execution of the entire Playwright suite, and they do not establish a complete skirmish win or repeated-match fun. A first normal-input Rush attempt ended in defeat at 114 seconds outside the shrinking ward. The next normal-speed Engineer attempt won at 240 seconds, wave 14, with 80 kills and five survivors using actual movement, abilities and five upgrades. A complete phone skirmish ended in defeat at 510.6 seconds, with five captures and 76 kills; recruitment, commander respawn, house capacity and restart were exercised. Those results establish functioning repeated match loops, not broad difficulty balance.

The v 4 checkpoint was also installed from a clean archive using `npm ci` with the lockfile and then passed typecheck, all 90 tests present at that point, and production build. Later validation additions are covered by the final aggregate above.

## Fair opening and objective-clarity release

The first skirmish now waits on a frozen briefing. Idle troops use a fixed two-tile guard anchor and return locally rather than chasing through camps; Easy consolidates its home side for its first minute and still defends real attacks. Relic control and actual score income are visible in the HUD. Public relic landmarks appear as neutral gold minimap symbols before exploration, and the gold Relic button gives an explicit army capture order. Unknown enemy ownership and hidden troops remain concealed. Camera focus accounts for HUD and command-deck occlusion.

The browser suite now also checks visible relic income, one queued capture order, public-landmark routing, fog privacy and actual army movement in all three viewports. New render tests cover one-shot event feedback, hidden-event privacy and minimap markers. New Master/mute controls are covered by audio routing contracts and browser persistence cases. The newest batch still needs its isolated actual-browser execution and manual visual recheck.

Outpost opening regression uses the reported 1.5-second diagonal joystick displacement at 4.5s and confirms all four starters remain full health at 6.2s. A genuine save produced by deployed3937eef, with idle troops already pursuing and an injured archer, restores without healing or economy changes, fixes guard anchors once and remains deterministic for 80 seconds.

## First isolated browser run: 2026-10-04, 05:04 UTC

Exact source `1a6b1ae72be0eef5f33de86dcb82a77196db1803`, [run37178182518](https://github.com/KJLKurt/rts-game/actions/runs/37178182518): **63 passed, 19 failed, 1 flaky, 7 skipped** in12.2 minutes. The run is not green and was not promoted to Pages.

Confirmed causes and follow-up fixes:

- A shared helper attempted to dismiss a landscape-hidden guide, accounting for the broad landscape timeout cluster. It now clicks only a visible control. No product assertions were removed.
- Campaign briefing used modal suspension rather than the internal tactical-pause flag. The fixture now checks that actual time, tick and entities freeze, then resume through the real button.
- Build-site fixtures copied obsolete spacing rules. They now run canonical `canBuild` on a read-only state snapshot, while placement remains a real screen tap.
- **Genuine save race:** an immediate Rush Save & leave reused the startup save promise and its older time 0 snapshot. Each new request now captures its own snapshot and enters an ordered write queue. Save/delete/continue ordering is tested, and the exact saved-state browser assertion remains intact. The related flaky landscape Rush save had the same time 0 symptom and is treated as the same defect, not dismissed as harmless flakiness.
- All three actual PWA tests passed: scoped worker/assets, offline save/continue/new game/campaign/editor, and explicit update consent with save-before-restart.

The seven skips are deliberate input-applicability exclusions: keyboard movement on two touch projects; desktop Escape dismissal on two touch projects for each of two cases; and phone joystick on the desktop project. The counterpart input paths remain tested. No PWA case was skipped on the isolated production host.

CI now stops after six failures to bound systemic fixture waste. Videos are disabled, traces are recorded only on the first retry (original failures still retain screenshots), duplicate result/trace trees are omitted, and future artifacts retain two days. The original archive remains unchanged pending owner approval for cleanup; its full traces/screenshots were preserved and a concise failure summary retained locally. The corrected93-case run adds a deterministic delayed-IndexedDB save-race check in all three viewports. It is pending; do not claim a passing full suite.

## Corrected run: 2026-10-04, 05:23 UTC

Exact source `31e64feabb19448b55e0aaaea3ded6ee08a131a7`, [run37179505878](https://github.com/KJLKurt/rts-game/actions/runs/37179505878): **84 passed, 2 failed, 7 skipped** in4.7 minutes. All three deterministic delayed-save tests passed, as did all PWA cases; no flaky result was reported.

The two remaining failures were diagnosed from the downloaded report and actual trace/screenshots:

- Rush's older fixture reloaded immediately after clicking Save & leave, before its asynchronous completion/menu acknowledgement. It now waits for visible Continue and a closed dialog, then checks exactly the same saved seed/time/Rush state. The deterministic in-flight-write test remains unchanged.
- Real landscape→portrait defect: the prior fixed pixel canvas display width retained an844px mobile layout viewport after a390px rotation, shrinking the whole interface. The backing buffer remains pixel-sized, but CSS now controls display dimensions responsively and root overflow is bounded. Rotation checks now assert exact layout viewport dimensions before and after opening/dismissing a dialog, plus the existing control bounds.

The second artifact ZIP was31, 556, 860 bytes with two-day retention, versus the first1, 544, 649, 507byte archive. The next acceptance run is pending.

## Green core acceptance and deployment: 2026-10-04, 05:41 UTC

Exact source `4afcfbdf9c7af4664a20794c0fe63be0a518ccb1`, [run37180158825](https://github.com/KJLKurt/rts-game/actions/runs/37180158825): **86 passed, 7 input-specific skips, zero failures/flakes** in3.1 minutes. All 93 discovered cases are accounted for. The 150 local unit/contract tests and production build also passed. Pages [deployment37180481474](https://github.com/KJLKurt/rts-game/actions/runs/37180481474) completed successfully.

A real hosted Update & restart/Continue check preserved an existing Rush save's visible seed, 26-second time, wave2, 713 HP, five-squad count and paused state. This was a Rush save, not the older campaign save; legacy campaign/pursuit migration is covered by the preserved fixture and separate runner checks rather than that hosted observation.

## Current polish candidate: browser review pending

Adds three reviewed attack-only strips, upper-art resource/relic picking, income-per-game-second labels, inspectable own-building damage warnings, bounded Capture objective defense and immediate tactical-placement feedback. No AI resources/health or costs are changed. The shared economy extraction produced byte-identical final states to the frozen engine for three comparison matches before the separate intentional capture-order change.

The combined-arms siege fixture's old policy blindly charged toward the keep and stranded its commander against defenders that now hold their objective. The corrected policy charges nearby visible defenders and explicitly resumes Attack-move. Troops, opponent, settings and victory assertions are unchanged. Capture leash, command override and legacy restoration have their own focused regressions.

The new HUD browser fixtures set only explicit presentation state for four-digit resource layout and recent own-building damage; they do not prove battle balance. They retain real button interactions and assert that View does not change selections or orders. The new cases remain unrun until the next focused browser review.

## Polish review and final guide correction: 2026-10-04, 06:43 UTC

Exact polish source `b41af521ad7440d3ae11ed6bb18e38ddc4003759`, [run37182498071](https://github.com/KJLKurt/rts-game/actions/runs/37182498071): **92 passed, 3 failed, 7 input-specific skips**, no flakes. All three failures compared an `innerText` snapshot to default `textContent` in the new raid-focus fixture. Both relevant assertions now consistently use rendered text; exact unchanged selection/orders assertions are retained. The archive is 81,280,969 bytes with two-day retention.

Independent actual-browser review of the same production build passed upper-art gold/relic taps, immediate invalid and overlapping queued placements, completed Capture guard anchors, income and relic rates, natural Keep-under-attack camera focus, touch portrait–landscape–portrait rotation, exact battle/settings save continuity, and live frame-by-frame playback of all four attack poses for all three supported characters without obvious scale/pivot jumps. These checks supplement the earlier complete phone skirmish win and normal-speed Rush win; they do not claim every difficulty or physical phone has been tested.

The review found two genuine remaining guide defects: its stage reset on Continue, and the pause ribbon covered phone instructions. The correction stores bounded per-battle UI progress separately from simulation, recovers older saves conservatively from deliberate command/capture history, and prioritizes visible guide/raid text over the duplicate pause ribbon. The top Resume control stays usable, and the ribbon remains available when short landscape hides the guide. Five pure tests cover progress preservation, legacy recovery, invalid metadata and no advancement from autonomous behavior. Three browser cases exercise real Save & leave completion, reload/Continue, exact stage and battle continuity, readable paused instructions, and new-match reset. The resulting **105-case acceptance run is pending**; the prior92 passes are not a substitute for final execution after these application changes.

## Final polish acceptance: 2026-10-04, 06:51 UTC

Exact source `2b2141f62855970ae7b3cbdb4b13ec8812e30c15`, [run37183716225](https://github.com/KJLKurt/rts-game/actions/runs/37183716225): **98 passed, 7 documented input-specific skips, zero failures/flakes** in 5.3 minutes. All 105 discovered cases are accounted for. Typecheck, all 200 local tests across 26 files, content validation and production build passed. The final report archive is 7,372,164 bytes, artifact 11296391316, expiring 2026-10-06T06:51:00Z.

Independent focused confirmation on the exact production build (`qa-preview` `dd72382`) restored a native prior-polish save at guide 3/4, re-saved/reloaded/continued it with the same stage and exact simulation, and verified phone paused instructions were fully visible. The top Resume control was reachable and actually resumed. JS/CSS and all eight binary assets were hash-verified; there were no browser errors.

No known blocking defect remains in the tested single-player vertical slice. This is still a preview: physical iPhone/Safari and installed-app hardware performance, complete manual campaign/expedition playthroughs, broad difficulty/faction balance, and subjective soundtrack listening remain outside the evidence obtained. Deeper editor/roguelite systems, multiplayer, full theme packs and full directional walk animation are explicitly deferred in the requirement matrix.

Pages [deployment 37184119680](https://github.com/KJLKurt/rts-game/actions/runs/37184119680) succeeded for that exact source. The public URL loaded the matching JS/CSS bundles and completed Update & restart. Ordinary-UI campaign progression and a full expedition route are the remaining bounded mode checks; those are still in progress.

## Post-release campaign findings and defense candidate

Two ordinary-UI Outpost attempts ended cleanly (one score defeat/retry, one Keep defeat). Neither proves chapter unlocking. The staged retry exposed a genuine intuitive-defense issue: ranged attackers could damage an assembled group while a full-health idle commander stood nearby outside its weapon acquisition range. The candidate adds only attributed, visible, short-lived threat retaliation with fixed-anchor pursuit bounds; explicit Hold remains stationary and no costs, stats, AI timing or resources are changed. Full mechanics and preserved opening assertions are in `ENGINE.md`.

The same Keep loss exposed winner-perspective result text on the losing screen and “You’s Command Keep” alert wording. A pure local-perspective presenter and team-aware alert now cover both.

The candidate passes typecheck, all 226 local checks across 29 files and the production build. Nineteen new threat-response tests and two alert tests join five result-wording tests. Browser discovery is now 108 cases, adding three explicitly labeled result-presentation/retry fixtures. Those fixtures are not campaign-completion evidence. The new browser acceptance and ordinary-UI progression review remain pending.

## Final defense acceptance and campaign progression: 2026-10-04, 08:07 UTC

Exact source `85dc40b5beabd2cf07072bf85cc6758e7ac32a10`, [run 37186731321](https://github.com/KJLKurt/rts-game/actions/runs/37186731321): **101 passed, seven documented input-specific skips, zero failures/flakes** in 4.4 minutes. All 108 discovered cases are accounted for. All 226 local tests across 29 files, typecheck, content validation and production build passed. Report artifact 11297024603 is 7,439,644 bytes and expires 2026-10-06T07:49:54Z.

Independent actual-UI review of that exact production build passed bounded retaliation, unchanged anchors, stationary Hold under fire, and the protected opening. A genuine Outpost victory at 4:39 unlocked Hold the Line; its briefing and Save/reload/Continue remained correct with paused 0:00.3. The earlier complete three-stage expedition on 2b2141f is separately documented in `PLAYTESTS.md`. These close the bounded advertised-mode transition gates, not a claim that every campaign chapter or expedition branch was fully played.

A synthetic 240-unit, six-team local-guard fight measured 200 headless ticks at 4.1ms mean, 13.0ms p95 and 20.2ms maximum on the development Linux executor. This is a bounded regression check for the new response logic, not renderer or physical-phone FPS.

Remaining limitations: physical iPhone/Safari and installed-app hardware lifecycle/performance, subjective soundtrack listening, complete later-campaign playthroughs, alternate expedition routes/defeat handling and broad faction/difficulty balance. Full theme/style packs, authored directional locomotion, multiplayer and deeper editor/roguelite systems remain deliberately outside this vertical slice.

Final Pages [deployment 37187995776](https://github.com/KJLKurt/rts-game/actions/runs/37187995776) completed successfully for exact runtime `85dc40b5beabd2cf07072bf85cc6758e7ac32a10`. The public URL loaded `index-BhKQL04t.js` and `index-M-oRBJTA.css`; Update & restart completed, the prompt cleared, the menu rendered the real atlas, and no application warnings or errors were recorded in that hosted check. Final documentation is a separate documentation-only checkpoint over this tested runtime and does not trigger another deployment.

## Commercial-readiness candidate 1 — 4 October 2026

Reopens the earlier vertical slice after actual novice feedback. This candidate is not a completion claim. Local production build, type/content checks, and 243 unit/simulation/map tests pass (33 files). First independent interaction review is pending; existing browser cases require updates for intentional preview/confirm construction and collapsed-panel flows before the next batched acceptance run.

Changes: peaceful eight-step learn-by-doing settlement; selected-building purpose/actions/research/levels; level1–3 building upgrades; actual next-level research prices; stable production jobs, batch quantity, selected-producer routing, cancel/refund and paused reservations; inspectable automatic capture economy and population breakdown; collapsible deck/minimap, labeled mobile army controls and scalable text; half-tile construction preview with explicit confirmation and closer legal house adjacency; deterministic direct commander steering with obstacle sliding and stop/recovery; editor Pan/Paint, continuous interpolated strokes, brush sizes, undo/redo.

Important review targets: first-time completion without outside instructions, mobile panel geometry and labels, stick direction/stop around obstacles at multiple zooms, selected Keep/Barracks routing, paused insufficient-resource rejection and refund, two adjacent houses, placement under rotation, complete learning save/Continue, and paint-versus-pan distinction. Source and production QA branch receipts will be recorded after publication.

## Additional preserved publication receipts

These notes predate the current badge checkpoint. Their counts, outcomes and
then-open route statements remain historical and are not new suite executions.

## Prior content publication checkpoint — 5 October 2026

Build `fc-ecbc0d4070f9` corrects the Ironwatch Barracks → Blacksmith → Workshop
instruction and includes Vite's MIT notice in the offline cache. The candidate
passes 536 unit tests in 57 files, TypeScript and build checks. Its full 319-case
browser run records 298 passes, 21 intentional skips and zero failures/flakes;
three separate previous-cache upgrades fulfill three skips, yielding 301 distinct
passes and 18 remaining skips. All four PWA cases pass. Runtime `index-DOFdeVPS.js`,
CSS `index-CH0dYD5l.css`, cache `410dfd12508c`, 25 precache entries and 27 output
files are verified. All 15 simulation files and existing public assets are unchanged.

See [ASSET_AUDIO_CONTENT_AUDIT_20261005.md](ASSET_AUDIO_CONTENT_AUDIT_20261005.md)
for bounded native content/audio/save evidence and precise reference provenance.
Twelve codecs decode and browser gesture/bus/mute/volume signals are checked;
no subjective listening or music-quality verdict is claimed. Project use and
publication are already authorized; selected reference creator/source-generation
and derivative redistribution evidence remains unverified. Broken Alliance is
saved unfinished at 465.8 seconds, with six profile games/three wins; complete
owned-save equality is checked online/offline, not a chapter-completion claim.

## Prior allied-ability receipt — 5 October 2026

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

A separate current-candidate native-phone continuation remains unfinished at
279.8 seconds. It preserves the legitimately earned Foothold win, Caravan
purchase, one-game/one-win profile, one route victory, 80 crowns and recurring
+80 gold/+80 wood. Read-only Continue verification compares the complete
serialized game state exactly. The three Whisperwood attempts are separate;
none establishes a later natural victory or full-route completion. The original
Foothold win at 550.1 seconds occurred on the prior published build. Headless
Epic/custom pacing samples are simulation evidence, not played-duration or
physical-device performance proof.

## Prior Practice recovery receipt — 5 October 2026

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
