# Editor post-drag touch acceptance — 9 October 2026

The workshop could paint or pan correctly and then ignore one native tap on Tools. The candidate adds one nonpassive touchmove listener to the world canvas. It prevents a cancelable native touch move only while editing; existing pointer painting, panning, pinch, cancellation, click handlers and keyboard controls remain in place. Battle moves and gestures outside the canvas are not prevented. No global touch handler or pointerup activation was added.

## Diagnosis and counterfactual

The historical cumulative browser run remains **608 passed, 10 failed, 26 skipped** out of 644, with no retries. Six Range failures came from an affordability-changing test fixture. Four editor paths lacked a browser-generated click. Earlier passing instrumented probes used a different input sequence and did not resolve those failures.

[Exact-input diagnosis 37903885976](https://github.com/KJLKurt/rts-game/actions/runs/37903885976) reproduced the editor symptom in all twelve samples across six identities. Complete Chromium 153 traces showed an active browser fling and subsequent tap suppression upstream of application click handlers, despite touch-action filtering. The literal locator tap, omitted-ID protocol tap and explicit-ID protocol tap all reproduced it. Retained pointer capture, final event cancellation by the app and a removed target were not observed explanations.

[Plain-canvas comparison 37905515973](https://github.com/KJLKurt/rts-game/actions/runs/37905515973) paired CSS-only behavior with canvas-local native touchmove prevention in both phone orientations. Both controls reproduced the missing click; both prevention arms retained the pointer stroke and produced one trusted click with no fling/suppression. This comparison tests the combined nonpassive listener and prevention intervention. It does not independently attribute the effect to either part or establish physical-device behavior.

## Actual game validation

Production base: `3a7c5074fc57cc473335c5b80c2647b48e45cd41`. Candidate runtime: `fc-32890048cec6`; offline cache: `adecd58954e6`, 38 files. Only `src/main.ts` differs among the tracked application sources and assets. Its six-line insertion is the complete production delta. Local validation passed **884 unit tests in 81 files**, TypeScript, content validation and production build.

[First focused run 37907289602](https://github.com/KJLKurt/rts-game/actions/runs/37907289602), QA commit `53afced48d618f4cf4e8b61df47ce5e9e4bcd7d5`, executed all 40 identities: **34 passed, 6 failed, 0 skipped, 0 retries**, in 493.546 seconds. The original editor history, Pan, cancellation and pinch cases passed. All twelve exact-input samples produced one trusted Tools click. Their complete nonempty traces had no loss, clipping, errors, fling starts or tap-suppression markers.

All six failures occurred at the last keyboard economy-control step. The test waited for the obsolete initial accessible name “Gold and income sources”; all six retained DOMs showed the current dynamic “Gold: … Income: … per game second” label. Gesture, Focus and native panel-scroll checks had already passed. The test correction uniquely selects the gold economy button, positively checks its dynamic accessible name, then retains Enter activation, exact dialog-name visibility, one trusted click, Escape dismissal and unchanged battle-state assertions.

[Six-case continuation 37908595348](https://github.com/KJLKurt/rts-game/actions/runs/37908595348), QA commit `a2ce93c37ee0e34160e31913faae466e45445345`, passed **6 of 6**, with no retries/skips, in 87.158 seconds. Its identities exactly match the six initial failures, and all application source/asset blobs are identical to the first run. This closes the focused 40-identity scope across two runs; it is not a single clean 40-case run or a clean cumulative full suite. Both original ledgers and failure evidence remain preserved.

Recorded boundaries include both themes, desktop and both phone orientations: editor paint/Pan, discarded canceled or multitouch strokes, one-stroke Undo/Redo, native panel scrolling, naming/save/reload/test return, desktop shortcuts, battle pan/pinch/cancel, exact targeting and unchanged orders. Editor canvas moves are prevented; battle canvas and outside-panel touchmoves remain unprevented. Recorded phone Tools/Focus stages activate exactly once. ScrollTop genuinely changes without accidental controls, painting or camera movement. Positive keyboard checks cover editing, Undo/Redo, P/B, Enter and Escape. They do not establish complete Tab traversal or screen-reader acceptance.

Eight editor screenshots, two representative battle failure frames and two native target-discrimination frames were reviewed, covering both themes and orientations. The failure frames are labeled partial-path evidence, not successful final keyboard results. No artwork or layout change is part of this fix.

## Preserved limits and provenance

These tests use isolated profiles and real Chromium touch input, including CDP native contact generation. They do not touch the user's ended Forager route or hosted profile. Physical Android/iOS, Safari, installed-device behavior, uncoached usability and general game-quality acceptance remain open. The document intentionally has no page scrolling; the exercised outside-canvas scrolling is in the real workshop and HUD panels.

First artifact: `11604823531`, 27,933,983 bytes, SHA-256 `15851a4dd8ea5594c9e7c697646f190474ae7570140d24c314282a1284d17911`. Continuation artifact: `11605128505`, 7,654 bytes, SHA-256 `f5c1a166e33f201a7cdc11606933e90bc27fd279e4575c818d86bc344f7a1039`. Both were materialized and verified, and the complete identity ledger was reconciled. Default full QA configuration is retained in the release; scoped diagnostic workflows and fixture probes are not release changes. Rollback base remains `3a7c5074fc57cc473335c5b80c2647b48e45cd41`.
