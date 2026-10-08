# Tactical subset selection milestone

Original brief section 11 explicitly requires multi-selection and touch-first group controls. Formation/grouping is qualified “where practical.” This UI-only milestone adds Orders → Choose troops and desktop mouse Shift-click. The main battlefield HUD receives no extra row or permanent control. Saved control groups, marquee selection and custom formations remain outside this batch.

The troop sheet drafts a snapshot of living owned troop IDs. Type checkboxes add/remove the current members of a type; expandable rows allow individual choices. Mixed type selection is shown with native indeterminate state. All/None affect only the draft. Apply commits exact IDs and cancels an unsubmitted map target; Cancel, Close and Escape discard the draft and preserve existing selection/targeting. Newly recruited or respawned units do not automatically join. Buildings, other players’ forces and dead/recovering units are excluded.

Desktop Shift-click toggles a friendly troop in ordinary selection mode. Empty Shift-click retains the group; buildings cannot be mixed into it. Normal taps, drag-to-pan, pinch and armed Move/Attack/rally/placement retain precedence. Existing Commander and Army controls remain unchanged.

The simulation, renderer, public assets and save schema are byte-identical to the Engineer release. Actual commands continue to carry immutable entity-ID arrays. Continue keeps the established commander selection behavior rather than introducing UI-selection persistence. Opening the sheet uses the existing modal suspension behavior, including release of active direct steering.

Review found an existing keyup edge case: releasing an arrow/WASD key while scrolling a modal could issue steer(0,0) and replace an ordinary movement order. Keyup now releases only actual directControl. Modal keyboard focus includes disclosure summaries, excludes closed-details descendants, and returns to the recreated opener after Apply.

Local verification: 679 unit tests in 68 files, TypeScript, authored-content validation and production build pass. Fifteen new pure-helper tests cover ownership, deterministic ordering, stale/duplicate pruning, exact toggles and type groups, source immutability, escaped metadata, nonselected orders, paused snapshots and save/restore. Native browser scenarios are prepared for arbitrary subsets, separate queued orders, save reload, cancellation, live-dialog interruption, keyboard order preservation, narrow/enlarged-text layout and Shift-click precedence. Runtime and natural-play acceptance remain pending.
