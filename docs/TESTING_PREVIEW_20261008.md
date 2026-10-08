> Evidence update: the unchanged production runtime fc-194c08936126 subsequently passed 448 browser cases with 24 qualified skips in run 37732161638, using the precise test-only selector revision da887be1. No failed, interrupted, unrun or retried cases remained in that invocation. See [current original-requirements reconciliation](REQUIREMENTS_RECONCILIATION_20261008.md). The publication-time record below is retained as history.

# Testing preview checkpoint — 8 October 2026

Runtime build: **fc-194c08936126**. This is a published testing candidate for hosted browser QA, not a completed browser acceptance or commercial-ready release.

## Exact composition

The preserved 291-file fc-a05bbde7e55b source snapshot contains the approved phone-first UI and default-zoom Select Commander framing. The separate Scout material pass changes only src/style.css: navy/cyan panel materials, gold selected states, readable disabled controls, gold Confirm and teal production accents. The test-only fixture correction changes tests/browser/helpers.ts and adds touch-target-discrimination.spec.ts. Production simulation, assets, audio and economy remain unchanged from the prior published checkpoint.

Prior publication and recovery documents are preserved from main instead of replaced by stale copies from the candidate archive. The previous published rollback commit remains db11398f254b3c0f19cef024ad0a71d9636b0707, build fc-0f1a6b425705, retained as this publication's parent. Reverting the candidate commit restores the previous published source without rewriting history.

## Verified before publication

All three source/delta ZIP SHA256s and all 291 baseline source hashes were verified during recovery. Fresh locked dependency installation, TypeScript, eight mission validations, production build and 588 unit tests in 64 files passed on Scout's machine on 8 October. The resulting runtime identity is fc-194c08936126. GitHub Pages also runs its existing unit/build gates before deployment.

## Browser evidence and open issues

The earlier a05 aggregate was interrupted: 415 of 466 cases had terminal observations (392 passed, 21 skipped, 2 failed); 51 had no terminal evidence and no final process exit/report exists. This is not an accepted aggregate.

Both original portrait Move assertions reproduced in separate read-only diagnostics. A point whose center hit-tested as canvas produced native touch events targeting the nearby Focus Commander button; the subsequent Focus click cancelled Move. Camera drift was ruled out by stable camera and world-coordinate evidence. Attribution to product versus test fixture remains qualified, and physical-device behavior has not been established.

The test-only clear-ground helper now requires a 20px canvas-only touch contact region. New native-input cases distinguish an intentional Focus tap from a clear canvas tap and require one queued Move, unchanged paused time and unchanged profile. This is a fixture correction awaiting browser validation, not a proven gameplay fix.

The styling candidate and corrected fixture have **not yet passed runtime browser QA**. Previous local Chromium startup and cloud artifact transfer limitations prevented those runs. Hosted QA should first run the two original portrait Move cases, six native discrimination cases, selection/visibility regressions, and representative desktop/portrait/landscape visual review. A complete aggregate, save/PWA upgrades, physical-device/Safari checks, subjective audio/novice play and broader natural campaigns remain open. Preserve original failures rather than relabel them clean.

## Hosted review

The authorized Pages base is /rts-game/. Main uses the existing Pages workflow; the isolated browser-acceptance workflow is not triggered by this publication. After deployment, verify the actual page and runtime build identity, exercise phone Move/Attack/Cancel and pause/queue/resume, inspect Train/Upgrades and valid/blocked placement, and check enlarged text plus setup/campaign/editor. The user explicitly authorized deployment to make hosted browser QA possible despite the previous transfer blocker.
