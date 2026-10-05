# HUD pointer-collision correction

Date: 2026-10-04. This is a narrow follow-on to the presentation checkpoint.

## Evidence and cause

Independent browser QA reported two pointer interception failures on the earlier 22:45 candidate. These reports were not treated as a passing or failing browser run of the corrected source.

1. **Ordinary field-guide close vs. expanded minimap.** Current-source CSS confirmed the geometric defect. At a 390px-wide CSS viewport, the ordinary hint used left 12px and width `390 - 116 = 274px`, ending at x=286. The expanded minimap used right 10px and width 116px, starting at x=264. Both occupy the upper battlefield, and the later-painted minimap overlapped the hint's right-edge dismiss target. The newer 44px map toggle changes which part of the map can intercept, but did not remove that overlap.
2. **Rush abilities vs. expanded command deck.** The older, more specific `.rush-mode .ability-dock` rule fixed its bottom at 170px on phone widths. That rule overrode the later generic deck-height-based rule. Rush's joystick and commander strip had the same obsolete fixed-offset pattern. In addition, the first deck measurement preceded population of `#rush-status`, so later natural-height changes had no observer-driven remeasurement.

The eight-lesson `.learning-guide` is a separate layout. At 390px it occupies x=10–230; it was not the ordinary `dismiss-tips` overlap described above.

## Correction

- Ordinary mobile hints reserve the full 116px expanded-map width, both outer margins and a 10px horizontal gap. At 390px they now occupy x=12–254 while the map starts at x=264. This is a geometric reservation, not a z-index override.
- `dismiss-tips` has its own 44×44px minimum target and header text space. The eight-lesson guide's controls/layout are unchanged.
- Removed only the three obsolete Rush fixed-bottom rules. Rush now shares the existing measured deck-relative offsets.
- `observeControlDeck` measures populated content immediately, then uses ResizeObserver size entries to remeasure only actual size changes. It does not force layout on every animation frame. Observers disconnect on menu, editor, and battle-shell replacement; stale queued callbacks are ignored.

## Verification

Executed command results are in `artifacts/hud-collision-evidence/`:

- Typecheck and focused observer/learning/research unit tests passed before the aggregate run.
- The aggregate unit suite, final typecheck, production build and diff-check results are recorded in the accompanying logs.
- Nine browser test configurations were authored/discovered: ordinary guide/map rectangles and hit targets, repeated Rush panel expand/collapse with actual turret activation, and a labeled dynamic-status-height fixture. The ordinary-guide case deliberately skips short landscape, where ordinary tips are hidden.

**No new actual-browser execution, screenshot review, or runtime click success is claimed here.** The browser regressions must be run against the exact corrected candidate on the permitted QA route. Inspect both normal and larger text settings, repeated expand/collapse, and portrait/landscape before closing the visual acceptance gate.
