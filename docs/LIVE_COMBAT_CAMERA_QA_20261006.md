# Live combat and commander framing acceptance — 2026-10-06

## Final publication checkpoint verification

Build **`fc-0f1a6b425705`** combines the reviewed Mythic Archer, Spearman and Cavalry packs with corrected troop visibility, sprite-body and ground-marker selection, lower-quality overlay caching, and explicit Focus framing outside HUD controls. Focus retains enlarged zoom when the commander and health bar fit; short landscape layouts can minimize the panel and reduce zoom. All fifteen simulation files, campaign rules, costs and audio remain unchanged. Later campaign work and UI redesign are outside this frozen checkpoint.

The final production candidate passed **588 unit tests**, TypeScript/build, eight mission validations and an exact 40-file repeat build. Its **418-case browser gate completed in one invocation: 400 passed, 18 unchanged intentional skips, zero failures, retries, reruns or flaky cases**, with exit code zero. All 412 prior identities remain; six framing cases were added. Four PWA tests and three upgrades from published Swordsman passed. All 283 frozen worker-source files and 40 build files remained exact; publication preserves the additional earlier recovery document and release-history edits.

Three earned-save continuations each produced eight new Ranger damage hits with active enemy AI and exact whole-game, storage and profile restoration online/offline. These samples do not establish a newly earned win or uncoached fun. Historical evidence remains intact: the first visibility candidate had three ground-marker failures; the corrected version passed separately; the optimized-renderer gate required three skipped upgrade cases to be completed after a runner flag was supplied. The final 418-case result belongs to this exact combined Focus build. The early focused PNG-retention mistake remains documented; final framing screenshots are preserved.

The final raw report and native evidence indexes have been independently read back and checked. The earlier frozen report below records the state at packaging; any full-gate-pending wording is historical.

This isolated candidate follows the fully verified `fc-b43ee439c02d` renderer snapshot. The earlier source, dist, Library receipts and 412-case evidence remain unchanged. No publication, Git push, workflow run or security change is authorized by this batch. The original requirements' performance, game feel and observed-failure work remain active; this document records a narrow control correction, not commercial completion or a selected concept redesign.

## Reproduced obstruction

The preserved build was tested through actual desktop Zoom controls and native phone two-finger input, followed by Focus. The 36 paused, unmodified-match cases cover desktop 1440×900, phone portrait 390×844 and phone landscape 844×390; Ranger, Warlord and Engineer; Christmas and Mythic; expanded and collapsed command panels.

Seventeen cases had opaque commander-body samples behind HTML controls. In short landscape, the expanded panel cases covered roughly 70–89% of the body; collapsed cases covered 10–29%. Five expanded portrait cases also overlapped Objectives or the minimap. Desktop bodies were exposed, but body exposure alone did not establish health-bar readability. Screenshots, actual sprite-alpha samples and native input receipts are retained in the evidence packet.

## Narrow resulting behavior

Only `src/main.ts` changes production behavior. Explicit Focus at an enlarged zoom now frames the commander silhouette, health bar and banner against the existing cached HUD/control exclusions. It retains the chosen zoom when clear space exists. If the actor cannot fit, it first minimizes the command panel and then fits the largest clear zoom in 0.05 increments. Manual pinch/pan still reaches the existing 0.42–2.4 range. This does not reposition every arbitrary battlefield actor or implement any concept board.

The existing `troopSummaryPosition` helper supplies control exclusion geometry. The chosen frame is cached between zoom/layout changes rather than searching the DOM on every paint. Normal fresh-match focus remains unchanged until enlarged Focus activates the fit. Launch and Continue reset that view cache; simulation, balance, hit picking, artwork, animation and audio remain unchanged.

Two new browser tests cover all 36 commander/theme/panel combinations, opaque body and health-bar exposure, native body selection with paused simulation unchanged, enlarged text, held Focus controls and genuine keyboard/joystick movement. The first focused invocation passed all six project cases; its 36 body cases had zero covered samples and exposed health bars. Six enlarged-text/theme movement subcases passed. This initial focus gate preceded the final Continue-cache reset; the final earned-save gate exercises that reset, and the frozen full gate includes the same six tests against the final source.

Screenshot review also exposed a gap in the first enlarged-text test: its final body tap did not assert the selected actor. The final test waits for the following camera to settle, taps a stable opaque interior point, requires the correct commander selection, and verifies that no paused order or other simulation change was introduced. The original first-gate test, raw report and reviewed contact previews remain retained. The later focused runner inadvertently reused its output directory and cleared the first-gate PNG originals; the final focused and full-gate artifacts are retained separately, and this evidence limitation is recorded.

## Actual earned-save acceptance

The canonical earned campaign save starts at game time 551.3, with profile eight games/three wins and both enemy AIs active. Only its localhost storage origin was adapted. No actor, resources, fog, health, victory or simulation fixture was inserted.

The final candidate's single three-view invocation exited zero. It verified the changed path starting from a native requested 2.4 zoom, then continued real commander attacks and enemy-AI movement to game times 582.5–582.6. Each view dealt eight new positive Ranger hits strictly after the owned start; 95 positive combat hits and 63–64 moving actors were recorded per view. Whole game, browser storage and profile matched exactly after save/Continue and offline reload. Wins remained three; no new win or uncoached-fun claim follows from this route.

The owned paused Focus exposed all 3,231 sampled opaque body pixels and the sampled health bar in every view. It retained 2.4 zoom in desktop and portrait, minimizing the portrait panel where needed. Short landscape minimized the panel and fitted to 1.25. Initial controlled landscape layouts fitted to 1.15–1.3 depending on the commander and available controls.

## Live performance evidence and limits

The production application RAF was instrumented to measure whole app callback CPU, renderer CPU, and their difference. The difference includes simulation, input, HUD and audio work; it is not a pure simulation timer. A separate later five-second V8 sample window retains raw profiles and source-map attribution for engine, spatial and pathfinding functions. Profiling overhead and browser/native/idle samples are documented rather than interpreted as GPU work.

The preserved build's early eight game seconds contained roughly 60–72 visible actors. Median whole app callback CPU was 15.7 ms desktop, 13.6 ms portrait and 17.5 ms landscape. Median renderer CPU was 14.4, 12.5 and 16.1 ms; remaining app CPU was about 1.4–1.5 ms. The overall 20-game-second medians were lower because the commander subsequently recovered and most enemy sprites left player vision. This phase distinction is retained in the raw receipts. It does not justify an engine/pathfinding rewrite in this batch.

The baseline profile was completed across a retained two-view invocation plus an exact landscape recovery. Initial driver failures, including a second own-body tap that reenabled follow after a framing pan, are preserved with actual exit evidence. The final candidate completed all three views in one invocation. Its native framing changes the visible composition, so these runs are acceptance measurements, not a controlled renderer-speed improvement comparison. The previous paused 600-unit cache measurements remain their own separate evidence.

A failed earned-save pinch was diagnosed through actual trusted pointer/touch delivery: the first finger landed on a Keep-under-attack warning that appeared after the original coordinate query. The final driver waits for layout and uses clear space below the warning. Both failed attempts and the event diagnosis are retained. No security setting or blocked registry request was retried to recover it.

## Gate status and remaining acceptance

The final TypeScript/content/build gate passed, with eight story missions validated. Existing placement, HUD collision and command regressions, the 588-unit suite, repeat dist-byte verification and the frozen full browser gate are recorded separately in the final evidence index; results must be read from those actual terminal receipts. The frozen full list is expected to preserve all 412 prior identities and add six commander-framing project cases, for 418 identities across 35 test files. At source freeze, that full run is pending; this document is not subsequently rewritten during the gate.

Fresh installation remains blocked by the already documented registry CONNECT 403 and absent exact offline tarballs. Existing locked installed dependencies are reused unchanged. Physical phones, Safari, physical FPS/GPU behavior, subjective audio listening, hosted revised HTTPS/installed PWA acceptance and uncoached fun remain unverified. The remaining four directional actor families (576 frames), additional themes/styles/music and original brief's other open acceptance items remain distinct work. Existing failed and held candidate receipts remain retained.
