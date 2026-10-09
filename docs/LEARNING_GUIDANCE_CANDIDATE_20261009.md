# Learning guidance candidate — 9 October 2026

Status: local candidate only, not browser-accepted or released. Baseline is published commit `f9378101770085bae49d8b2ebdc21eb0edf86770`, build `fc-7592049128ac`.

## Bounded changes

- First-walk instructions now request clear ground at least three tiles from the starting spot. The existing completion rule remains a deliberate logged movement plus displacement strictly greater than two tiles. A completed short walk receives an explanation; the minimized guide also changes its title to “Move farther to continue.” No destination marker or unverified walk target is added.
- Only a floating commander strip intersecting the learning guide is hidden. Its geometry remains measurable through `visibility`, preventing hide/show oscillation. It returns when the overlap clears. Existing phone suppression and ordinary-battle HUD rules remain intact.
- The inherited high-specificity lesson action rule now explicitly requires a 44px minimum height. Its previous 40px minimum overrode later lower-specificity 44px rules. This discrepancy was found during source review; it was not introduced by this candidate. Native size and center-hit assertions remain intact.
- A measured learning-only correction now handles the demonstrated minimap collision at desktop heights 501–550px and widths above 600px. It measures the original objective-cleared guide and actual minimap, moves only a colliding guide beside the map, and bounds readable scrolling above the deck. A measured full target plus padding and borders is required. External layout keys preserve the user’s scroll across HUD refreshes; overrides reset outside this regime. Native DOMRect prototype getters are handled explicitly. Existing ≤500px, narrow, taller and ordinary-HUD layouts are unchanged.
- The first ordinary Conquest briefing explains enemy-keep victory and relic gold/wood income. Domination and Relic wording is unchanged. The normalized active mode selects the copy.

All 16 simulation files and all 78 public files match the published source archive. No balance, cost, save-schema, AI, map or asset changes are included.

## Local verification

- Build: `fc-088b668ca425`
- Runtime: `assets/index-DAvHaGrL.js`
- CSS: `assets/index-txElQ2m-.css`
- Offline cache: `d76e737853ea`; 81 precached files, 83 total distribution files
- TypeScript: passed
- Unit/contract suite: 1,066 passed in 86 files
- Production build: passed; all eight authored missions validated
- Full browser collection: 764 distinct identities in 60 files; collection is not execution
- Focused collection: 27 distinct identities in five files

The 22 added short-layout cases cover native DOMRect getters, measured expanded/collapsed map/deck positions, actual large-text target height plus padding/borders, insufficient target room, forty cached updates, scroll retention across external geometry changes, objective-only clipping and sideways objective entry, and exact positive/negative scope boundaries.

The earlier unit cases cover the exact two-tile boundary, logged-action requirement, the observed short destination, restored short-walk feedback, active versus completed movement, repeated overlap measurement, zero/hidden layouts, class cleanup, collision thresholds, mode-specific briefing copy, and the high-specificity 44px lesson-action rule.

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

The complete learning path now pauses real paid three-soldier training and a real paid House upgrade. It checks native guide actions, center hit targets, preserved normal Commander controls, expanded/collapsed decks, 100%/130% text, stable dimensions across repeated paints, and exact paused-game equality. Desktop adds 1184×760, 1184×900, 600/601-pixel width and 500/501/550-pixel height boundaries. At 501 and 550px, native mouse-wheel scrolling exposes each non-space lesson label/title/body character; character-range hit tests and full-CTA nine-point hit tests are retained with top/bottom screenshots, zero minimap/objective/deck collision assertions, and 1.1 seconds of stable guide geometry/scroll across HUD updates. At 501px the minimap is also minimized/restored using actual controls. These checks are authored and collected, not executed locally. Screenshots are captured before actions change the measured layout. These are scripted native-input checks, not uncoached usability evidence.

Preserve `learning-identity-ledger.json`, `learning-report/`, `test-results-learning/` and screenshots/geometry attachments. Verify the runtime Build ID is `fc-088b668ca425` before interpreting results.

## Failed evidence and smallest continuation

The previous frozen teaching build `fc-3dce7db7d71b` failed run `37975194638`, QA commit `6e012a6b6e45b9d80c2a5671cec92e7df9835605`: 25 passed, one desktop full-learning failure, one intentional phone-landscape skip, no retries. Its screenshots demonstrate the minimap covering real lesson text and Open Recruit at 1184×501, both deck states. Commander-strip suppression worked. At 500px the guide rendered above the deck despite positive geometric intersection, and remained readable; that layout is not changed. Preserve the entire failed freeze and run as evidence, not acceptance.

The smallest continuation is the existing desktop full-learning identity only, on this new frozen runtime, with zero retries and no failure cutoff. Both the real paid three-soldier queue and the real paid House upgrade now receive the same desktop boundary/scroll matrix. The desktop identity has a documented 360-second bound (phones retain 240 seconds, focused aggregate 600 seconds): prior phone full paths took 119–124 seconds and desktop previously failed after 56 seconds, so two expanded native-scroll matrices with over 26 seconds of deliberate stability sampling require explicit additional headroom. Its helper retains every prior native center-hit and state-preservation assertion and adds the reading/scroll evidence above. Preserve screenshots before CTA actions and before failure assertions; review actual pixels in addition to the numerical assertions. A residual Skip guide/title obstruction must be reported if the new evidence shows it; no speculative title-layout change is included.

Collection command (not browser execution):

`npx playwright test --config=playwright-learning-qa.config.ts --project=desktop tests/browser/learning.spec.ts --grep='all eight peaceful lessons use real input, teach neighboring houses, and launch the named Outpost' --list`

For the authorized browser continuation, omit only `--list`. Keep the 25 previously passing identities and one intentional skip as historical evidence from their exact old runtime. They are not 25 new-runtime passes and must not be double-counted. Report the desktop identity’s failure and changed-runtime follow-up as separate attempts/records, not a retry of the same frozen source.

Only after that desktop continuation passes, run the still-unexecuted separate previous-live update gate sequentially with the exact `f9378101770085bae49d8b2ebdc21eb0edf86770` / `fc-7592049128ac` distribution and `FRONTIER_EXPECT_BUILD_ID=fc-088b668ca425`. Its one existing desktop identity proves paid-queue/state preservation and explicit update consent. Do not run this host-root-changing gate concurrently with any focused test. Inspect frozen distribution hashes before and after both gates.

The 27-identity full focused gate remains available unchanged in membership (26 executable, one intentional skip), but it is not the smallest changed-path continuation. No browser was run locally; the denied Chromium workaround was not used. Browser acceptance, subjective teaching quality, physical-device behavior, update acceptance and release remain pending. There were no GitHub, deployment or live-browser-profile changes in this local correction.
