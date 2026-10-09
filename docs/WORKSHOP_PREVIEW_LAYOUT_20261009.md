# Workshop preview navigation without objective overlap

## Scope and observed baseline

This bounded layout candidate follows exact live `43d4dad361c2e32f14ecd092c3a1c74ed8553fbc` / `fc-f9ca19483611`. During the accepted C5 duration review, the portrait live Test map screen showed Return to workshop covering part of the objective strip. Return itself remained operable. That screenshot and the prior release's full evidence remain preserved; this is a demonstrated layout follow-up, not a change to match rules or duration validation.

The existing Return control now participates in the preview HUD's measured flow. The preview-only HUD wraps when necessary, retains the actual clock and resource controls, and exposes its changed height to the existing playfield/guide positioning. A preview-only size observer is disconnected together with the existing deck observer when a menu, editor or replacement battle shell opens. Portrait preview minimaps also clear the measured objective bottom; the baseline screenshot showed this adjacent overlap. Ordinary battles retain their existing markup and responsive styles.

Only `src/main.ts` and `src/style.css` change production behavior. Simulation, economy, maps, persistence, artwork and music remain unchanged.

## Red-first and local verification

The initial source-contract suite failed two checks with one passing control: fixed battlefield positioning and lack of preview HUD resize observation. These structural checks are not native geometry evidence. The retained actual portrait screenshot independently shows the overlap. The same positive native geometry assertion is prepared against exact previous-live production: "Return to workshop must not overlap the objective strip".

Final TypeScript, 1,166 unit tests across 89 files, and the production build with eight validated missions passed. Native acceptance remains pending. Source review found no confirmed blocker but specifically identified narrow widths just above the 600px breakpoint as an acceptance target. The new native flow includes 600px and 601px resize checks at 130% interface text size, in addition to the primary viewports.

## Bounded native gate

The planned single coherent gate preserves one intended previous-live portrait failure, then executes four new preview round trips at 1440×900, 390×844, 844×390 and 1184×501, plus the existing ordinary HUD regression on desktop/portrait/landscape. The unchanged returning-cache update identity is sequentially gated afterward. Automatic retries are disabled; actual failures, skipped or unrun stages remain explicit.

The preview flow uses ordinary editor, Pan, Zoom, Test map, pause, Settings, panel and Return controls. It records trusted input, passive geometry and screenshots before assertions. Both standard and 130% text, paused/running states, guide visibility, minimap/deck states and a second preview launch are exercised. A translated, non-default-zoom draft, full settings and the profile must return unchanged. A later ordinary skirmish must have neither preview navigation nor its HUD class.

These are short Chromium mouse/touch-emulation previews, not physical-device or long-match acceptance. Source-contract assertions, native geometry, ordinary hosted profile verification and full commercial scope are separate evidence categories.

## Prior release qualifications retained

The C3/C5 release passed 33 native feature/regression identities and one returning-cache update; its old worker-bootstrap failure and packaging-only failure remain recorded. Its hosted single-click update eventually completed after roughly a minute, with the cause unresolved. Direct public verification matched 61 of 83 responses before request-path errors and proxy restrictions; that route is not being retried. The real fresh record remains 0 wins, 1 defeat and 1 battle at 7:33, with 4/30 achievements. No continuity with the lost earlier profile is claimed.

The original and expanded requirements audit remains open for wider natural pacing, uncoached usability, dense physical-device performance, Safari/PWA lifecycle, subjective listening, later campaign/Expedition outcomes and unfinished directional/theme/style commitments.

## First native gate and bounded driver correction

Run 38002015229 stopped during old-build setup, before the positive overlap oracle. The test filled the name and then asserted the map model before using a normal commit action. The editor intentionally commits that field on Save, Test or exit; the trusted input trace showed typing, zoom and pan worked. One unexpected setup failure is retained, with zero candidate or update executions. The strict classifier correctly rejected it as product-red evidence. Both 83-file production proofs passed.

The test-only correction verifies the visible name field and presses ordinary Save before taking the full draft snapshot. It requires the save status and trusted Save input. No production source or bytes change, and the same positive old/candidate overlap oracle remains. The continuation covers only the previously unexecuted intended old red, seven candidate/regression identities and one sequential update.
