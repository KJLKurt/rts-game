# Learning guidance candidate — 9 October 2026

Status: local candidate only, not browser-accepted or released. Baseline is published commit `f9378101770085bae49d8b2ebdc21eb0edf86770`, build `fc-7592049128ac`.

## Bounded changes

- First-walk instructions now request clear ground at least three tiles from the starting spot. The existing completion rule remains a deliberate logged movement plus displacement strictly greater than two tiles. A completed short walk receives an explanation; the minimized guide also changes its title to “Move farther to continue.” No destination marker or unverified walk target is added.
- Only a floating commander strip intersecting the learning guide is hidden. Its geometry remains measurable through `visibility`, preventing hide/show oscillation. It returns when the overlap clears. Existing phone suppression and ordinary-battle HUD rules remain intact.
- The inherited high-specificity lesson action rule now explicitly requires a 44px minimum height. Its previous 40px minimum overrode later lower-specificity 44px rules. This discrepancy was found during source review; it was not introduced by this candidate. Native size and center-hit assertions remain intact.
- The first ordinary Conquest briefing explains enemy-keep victory and relic gold/wood income. Domination and Relic wording is unchanged. The normalized active mode selects the copy.

All 16 simulation files and all 78 public files match the published source archive. No balance, cost, save-schema, AI, map or asset changes are included.

## Local verification

- Build: `fc-3dce7db7d71b`
- Runtime: `assets/index-Anxo8s4-.js`
- CSS: `assets/index-txElQ2m-.css`
- Offline cache: `f78c84d1aa19`; 81 precached files, 83 total distribution files
- TypeScript: passed
- Unit/contract suite: 1,044 passed in 86 files
- Production build: passed; all eight authored missions validated
- Full browser collection: 764 distinct identities in 60 files; collection is not execution
- Focused collection: 27 distinct identities in five files

The new unit cases cover the exact two-tile boundary, logged-action requirement, the observed short destination, restored short-walk feedback, active versus completed movement, repeated overlap measurement, zero/hidden layouts, class cleanup, collision thresholds, mode-specific briefing copy, and the high-specificity 44px lesson-action rule.

During preparation, an initial test-only TypeScript fixture omitted `directControl.until`; after correction, one new fixture still used the default map instead of the demonstrated tiny practice map. Both were corrected without weakening assertions. Final local results above supersede those intermediate failures. The read-only review found two additional test/product details, both corrected: screenshot capture now precedes the CTA that changes deck state, and the short-walk test rejects routes crossing the completion threshold at any canonical simulation tick. Collapsed short feedback is tested before expansion.

No browser was launched, no CI submitted, no GitHub ref changed, and no deployment performed during this preparation.

## Exact focused acceptance gate

Run once in an authorized isolated Chromium environment against these frozen production bytes:

```sh
npm run check
npm test -- --pool=forks --maxWorkers=1
npm run build
npx playwright test --config playwright-learning-qa.config.ts
```

The configuration sets zero retries, no failure cutoff, two workers and a ten-minute global bound. It uses the normal isolated production server unless an explicitly supplied test URL is selected. Do not point it at the live player's browser or reuse live storage.

The 27 collected identities comprise, for desktop, phone portrait and phone landscape:

- One native short-walk then farther-walk test
- Two existing peaceful-learning tests, including the full eight lessons and save/reload
- One existing large-text guide/objective-clearance test
- Three existing HUD-collision tests
- Two existing owned-save House-recovery tests

One existing phone-landscape ordinary-field-guide case intentionally skips because that ordinary guide is hidden on short screens. Expected accounting is 26 executed identities and that one unchanged intentional skip, not 27 claimed passes. Preserve all failures and unexecuted identities; do not silently retry or replace the gate with a broad rerun.

The complete learning path now pauses real paid three-soldier training and a real paid House upgrade. It checks native guide actions, center hit targets, preserved normal Commander controls, expanded/collapsed decks, 100%/130% text, stable dimensions across repeated paints, and exact paused-game equality. Desktop adds 1184×760, 1184×900, 600/601-pixel width and 500/501-pixel height boundaries. Screenshots are captured before actions change the measured layout. These are scripted native-input checks, not uncoached usability evidence.

Preserve `learning-identity-ledger.json`, `learning-report/`, `test-results-learning/` and screenshots/geometry attachments. Verify the runtime Build ID is `fc-3dce7db7d71b` before interpreting results.

## Explicit remaining risk and release boundary

At 1184×501, inherited objective-only guide positioning may leave part of an expanded guide behind the deck. This is a source-based risk, not a measured browser failure. The candidate does not broaden production layout changes for it. The new checks require native CTA center access and record full guide/deck intersection and scrolling geometry; passing a CTA center alone must not be described as proof that every guide pixel is readable. Explicit pre-CTA screenshots and geometry are retained for both 1184×500 and 1184×501 before hit assertions, so evidence survives a failing CTA. Positive intersections receive a `whole-guide-review-pending` annotation and remain pending obstruction review even if the CTA center works. Review those artifacts during acceptance, and report any actual obstruction before adding a further fix.

Browser execution, subjective teaching quality, physical-device behavior, PWA update acceptance and publication remain pending. Before any release, use the established separate update gate with the exact previous-live `fc-7592049128ac` distribution, preserving paid queues/state and update consent. Do not run host-root-changing previous-cache tests in parallel with the focused gate.
