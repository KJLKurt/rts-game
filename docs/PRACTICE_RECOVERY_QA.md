# Practice House recovery and visible troop summaries — 5 October 2026

Build `fc-3c40d8eec6cf` is based on published `b9ff8e73cb9bcf952a2061a6bce6a7eb4cd15fc5` / `fc-9011b0514b9c`. Runtime `index-BgCslPTG.js`, CSS `index-CH0dYD5l.css`, worker cache `eca59b3eb5ec`; 26 dist files and 24 precached files under `/rts-game/`. All supplied source/dist hashes and the deterministic Build ID were checked before publication. All 15 simulation files are byte-identical to the published base; no balance, AI, resource, map, construction-cost or save-schema changes are included.

## Player-facing changes

- Find House site first suggests a currently legal neighbor, otherwise a first site with room for a second House. Actual preview and confirmation retain canonical legality, funds and reservations. Detached future-footprint geometry cannot grant resources or bypass construction rules.
- A legal isolated edge site remains legal but receives a visible warning. Find pair site has a minimum 44px target. Recovery explains retaining existing Houses and starting a new pair, or adding one neighbor to distant Houses. Queued/unfinished pairs ask the player to resume and wait. No available pair site produces an explicit fallback rather than silently choosing an isolated site.
- Dense visible troops receive one compact count/type summary per team. Counts describe currently visible on-screen troops, excluding hidden/off-screen/dead/respawning actors and commanders. Labels avoid key silhouettes and each other, disappear during placement, and do not change formations, picking, selection or simulation.

## Test results and the corrected failure

533 unit/contract tests across 57 files, TypeScript checks, eight authored-mission validations and the production build passed. A repeated build preserved all 26 output files byte-for-byte; the final frozen source also passed its 533-test rerun.

The full final-runtime Chromium run discovered 304 cases and initially produced **282 passed, 21 intentionally skipped, one failed, zero flaky**. The failure was the existing desktop campaign-Continue case reading matchId immediately after asynchronous Continue. Its assertion was retained and preceded by a wait for actual playing readiness; the same case then passed desktop, portrait and landscape. The original failing log/evidence is preserved.

The previous published-production-cache upgrade passed separately in all three views, replacing three optional skips. Together, the corrected case and cache upgrades reconcile to **286 distinct passing cases plus 18 intentional skips across 304 cases**, with no unresolved failure. The three-view reruns are not added again as new unique cases. This is not a claim that the first full run was failure-free. Four local PWA cases passed, covering offline reload, scope and consented updates. Paid production jobs, pending House, funds, time, population, profile and orders survived cache replacement; the old cache retired.

Practice regressions cover fresh two-House completion, the legal isolated edge site, preserved two-House recovery saves, upgrading, relic capture, complete-save reload and named Outpost launch. Full paused serialized state is compared in the browser regressions. Owned replay fixtures are labeled and are not represented as newly earned outcomes. The source supplied no new physical-device performance or general balance proof.

## Native phone outcome and exact save boundary

Actual input continued the owned Normal checkpoint on this runtime to natural Keep defeat at **398.2 seconds (6:38)**, with 47 kills, three captures and four commander deaths. Raw units-created/lost counters both read 23; these are not distinct infantry counts. The durable result and profile/history count of one were verified.

Practice opened from that earned defeat. Native movement, supply capture, Keep inspection, three Swordsmen, two suggested Houses, a Townhouse upgrade and relic capture completed Practice at **142.8 seconds**. Exactly two Houses stood at (9.5,13) and (11.5,14.5), with the second upgraded. Closing the completion dialog and pausing allowed 0.6 active seconds, so the saved/reloaded time was **143.4 seconds**. The persisted save and reload matched the recorded time, settings, score target, player, owned entities, nodes and pending orders; profile remained unchanged at one game, and learning step was eight. Full serialized native state was not captured before save, so that stronger claim belongs to the separate browser regressions. The named Outpost briefing opened at time zero; no new Outpost win is claimed.

Native browser page errors were zero. Two driver mistakes were recovered and retained in evidence: an incorrect Hold action locator and waiting for a clock that correctly stopped at the completion dialog. A visible 28-troop rival summary became readable during the native battle and disappeared when fog/view conditions changed.

## Limits

Evidence uses sandbox-enabled local production Chromium and emulated phone viewports. Previously denied hosted HTTPS access was not retried. The source-preparation step did not independently rerun browser tests or establish hosted gameplay/cache behavior. Physical phones/Safari, installed lifecycle/performance, later natural routes, broad balance, subjective fun/audio and commercial asset rights remain open. Raw logs, screenshots, saved checkpoints and transfer artifacts remain outside the public repository.
