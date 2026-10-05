# Short-landscape placement and redundant-deck-render corrections

Date: 2026-10-05. These are two separately reviewable changes.

## A. Placement layout / camera viewport

Independent V2 browser QA confirmed the previous ordinary-guide and Rush pointer fixes, then reproduced a new short-landscape placement obstruction in `index-DEOQ555k.js` at 844×390.

The supplied before-touch screenshot was inspected. Its exact geometry recorded the commander footprint at approximately (422, 194) behind the toolbar's text DIV. The toolbar occupied x=152, y=157.20, width=540, height=123.80. The still-visible command deck and duplicate pause ribbon consumed additional vertical space. A native touch reached the overlay instead of the battlefield.

The correction:

- In short landscape only, placement uses a compact horizontal status/actions row above the selection strip. Confirm, Repeat and Cancel remain at least 44px.
- The selection strip and its existing Cancel are preserved. Redundant deck navigation/content hide only during placement; they return after Cancel/Confirm. The header still supplies Resume while the duplicate pause ribbon is hidden during placement.
- `battlefieldCenterY` includes the real placement toolbar top in the usable landscape viewport.
- Starting landscape placement centers its anchor using those updated bounds. Rotation recenters the active preview. Dragging and changing site validation do not continually recenter the camera.
- A changed placement status remeasures its potentially wrapped text; unchanged HUD ticks do not trigger this extra measurement.

The original `landscape placement keeps the commander footprint on unobscured canvas` regression in `tests/browser/game.spec.ts` was not weakened, forced, or marked expected-to-fail. A new native-input regression checks the commander hit target, compact bar bounds, 44px action targets, standard/130% text, preserved selection-row Cancel and actual confirmed construction.

## B. Explicit render signature synchronization

A separate source audit found a guaranteed redundant DOM replacement after panel navigation: `performAction(panel-*)` called `renderDeck()` immediately without updating the cached signature. The next 220ms HUD tick necessarily saw the changed panel signature and replaced `#deck-content.innerHTML` again. A card pressed during that window could be detached before its click bubbled to the delegated handler.

This is a concrete input-stability risk. **It is not yet proven to be the cause of the reported intermittent portrait tactical-build failure.**

The correction extracts the same canonical signature calculation and records it on every explicit render. The HUD still rerenders when real resource, queue, selection, atlas-ready or progression values change. It does not defer or suppress legitimate simulation/UI changes.

Separate browser regressions check card identity through the next HUD tick, a 300ms native touch/mouse press, successful Build House activation, and a real affordability change that must still invalidate the deck. The identity fixture first waits for the atlas, so a legitimate asset-ready transition is not mistaken for a redundant update.

## Verification and limits

- Focused tests and typecheck passed during implementation.
- Final aggregate unit, typecheck, build, diff-check and browser discovery logs are in `artifacts/placement-layout-evidence/`.
- New browser tests are authored/discovered, not executed here. No post-fix screenshot, native touch success, or pixel approval is claimed.
- The permitted independent QA route must retest the corrected build, including the unchanged exact landscape gate and the portrait tactical-build flow.
- `placement-layout.patch` and `deck-signature.patch` in the evidence directory separate the two implementation changes. The complete source snapshot and hashes identify the integrated checkpoint.
