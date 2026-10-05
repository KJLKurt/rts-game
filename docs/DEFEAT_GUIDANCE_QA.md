# Defeat guidance and explicit destinations — 5 October 2026

This isolated candidate is **Build `fc-9011b0514b9c`**, based on the frozen usability release `fc-7f2be308bbca` (published as `aedd9fbb755003029f1f195016c6f82e3bfb7c48`). Runtime `index-Db8gSij3.js`, CSS `index-CH0dYD5l.css`, worker cache `ed78bf95fc58`, 24 precached files, 26 dist files, `/rts-game/` base. It has not been independently pushed or deployed.

## Behavior and reproduction

Launch a skirmish, pause, select Army, open Orders and choose Move. Minimize the panel if it covers the battlefield, pan using the minimap, and tap the center of your Barracks. The frozen release selects the Barracks and loses the requested army destination. Desktop and portrait reproduce this directly; the corrected landscape harness reproduces it after native panel minimization. The first landscape attempt hit the panel, so that attempt alone was not gameplay evidence.

This candidate arms the next map tap as the chosen destination before contextual picking. Move and Attack-move preserve the selected army even over a friendly sprite, then consume the explicit destination. A visible prompt and a minimum 44×44 Cancel control make the mode clear. Cancel, Commander, Army, Hold, construction and menu/navigation transitions clear pending targeting. Ordinary taps again select friendly actors/buildings or issue contextual attack/capture. An unchosen destination is UI state and is not persisted as a hidden order.

After a loss, the result card gives advice for the actual loss category: protect the keep, contest relics, dodge Rush strikes, or prepare for scripted objectives. **Practice the basics** opens the existing peaceful tutorial. It shares the existing durable-result guard: a failed profile/route commit cannot discard the finished match by entering Practice. A defeated expedition explains which route/bonuses reset and which command record survives; it also offers Practice. Win presentation and difficulty are unchanged.

## Executed checks on this candidate

- 525 unit/contract tests in 55 files passed, including six outcome/advice cases. TypeScript, eight mission validations and the production build passed.
- 127 unique scoped browser cases: **120 passed, seven intentional view/input skips, zero final failures or flakes**. The existing scope contributes 99 passed/seven skipped, including four local offline/subpath/update cases; seven new tests across three viewports contribute 21 passed. Three additional scroll/Practice executions pass without being counted again.
- Desktop 1440×900, touch portrait 390×844 and landscape 844×390 use sandbox-enabled Chromium 151 / Playwright 1.63.0. Tests verify actual queued entity IDs and commander movement, Attack-move one-shot consumption, native cancellation, Escape/dialog priority, unchosen-order save/reload, durable result/Practice and profile-write failure recovery.
- New guidance, landscape scrolling/actions, armed prompts and friendly-target movement screenshots were inspected. Landscape result content scrolls normally; advice and Practice are reachable with native input.
- All 15 `src/sim` files are byte-identical to the frozen release. No AI, income, map, difficulty, troop or combat parameters changed.

The first scoped run had two landscape harness failures at a covered canvas center. After correcting the harness with native deck minimization, all 21 new cases passed; original scope JSON/log evidence is retained. A controls rerun replaced the original scoped screenshot output, so only the new cases have raw screenshots in that directory. Separate frozen baseline failure screenshots remain. Results, traces and presentation fixtures are not claimed as earned gameplay outcomes.

## Actual input and owned saves

On this candidate, an origin-only copy of the genuinely defeated expedition save opened the new route explanation and Practice action. Native touch moved the commander and captured gold, reaching lesson **3/8 at 19.2 game seconds**. Save acknowledgment, reload and Continue preserved the exact time, visible lesson, army/map, profile count of one, and the defeated route. The owned IndexedDB checkpoint records learning step 2 (zero-based). The runtime bridge has no learningProgress getter; verification uses the recorded UI and actual saved record, not equality of undefined bridge values.

A native Normal replica continued its existing unfinished save from 118.1 to **201.8 seconds (3:21)**. Explicit Move retained four selected troops over the Barracks; an Attack-move flank secured one extra wood point (capture count two → three), followed by recruiting and regrouping. The match remains unfinished with no relics controlled, rival score about 202/640, and Keep 6645/6720. Save/reload matched time, settings, player/resources, troops, nodes, rivals and profile exactly. One mistaken `train` automation locator timed out while paused; the existing `recruit` action corrected it. No forced input or match state injection was used in these sessions.

## Separate frozen full-suite and natural-match evidence

The unchanged usability release completed a full **274-case run: 253 passed, 21 intentional skips, zero failures/flakes**. That is prior-runtime evidence; this guidance candidate received the focused scope above. Three optional previous-dist cache cases skipped because that fixture was absent; the earlier separate actual production-cache check passed and is not double-counted.

Actual Standard-derived play on the frozen release ended in Keep defeat at **863.5 seconds (14:23)**: 39 kills, ten captures, six commander deaths and 37 pauses. The profile stored one game/history entry; native Try again reset the same seed/settings and reload preserved the new paused battle exactly. A repeated actual Easy expedition opening is saved unfinished at 195.5 seconds with two relics, extra gold/wood, 41 kills, zero commander deaths and Keep 6716/6720. The first expedition encounter already uses Easy; it has no difficulty selector.

Matched custom Easy/Normal replicas share an exact generated map, but source-informed coarse input and two short trials are insufficient for balance or fun conclusions. At 118.1 seconds, Easy held one relic versus Normal none; the later Normal continuation above remains unfinished. No successful full expedition route or natural victory for this candidate is claimed.

Hosted HTTPS testing was blocked before assets by the cloud proxy (403 / ERR_TUNNEL_CONNECTION_FAILED), with no retries or security bypass. Physical Safari/devices, installed-device lifecycle/performance, later natural routes, broad balance and subjective fun remain unverified. No GitHub workflow, push or deployment was performed for this batch.
