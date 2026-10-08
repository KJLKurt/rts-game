# Tactical subset selection milestone

Original brief section 11 explicitly requires multi-selection and touch-first group controls. Formation/grouping is qualified “where practical.” This UI-only milestone adds Orders → Choose troops and desktop mouse Shift-click. The main battlefield HUD receives no extra row or permanent control. Saved control groups, marquee selection and custom formations remain outside this batch.

The troop sheet drafts a snapshot of living owned troop IDs. Type checkboxes add/remove the current members of a type; expandable rows allow individual choices. Mixed type selection is shown with native indeterminate state. All/None affect only the draft. Apply commits exact IDs and cancels an unsubmitted map target; Cancel, Close and Escape discard the draft and preserve existing selection/targeting. Newly recruited or respawned units do not automatically join. Buildings, other players’ forces and dead/recovering units are excluded.

Desktop Shift-click toggles a friendly troop in ordinary selection mode. Empty Shift-click retains the group; buildings cannot be mixed into it. Normal taps, drag-to-pan, pinch and armed Move/Attack/rally/placement retain precedence. Existing Commander and Army controls remain unchanged.

The simulation, renderer, public assets and save schema are byte-identical to the Engineer release. Actual commands continue to carry immutable entity-ID arrays. Continue keeps the established commander selection behavior rather than introducing UI-selection persistence. Opening the sheet uses the existing modal suspension behavior, including release of active direct steering.

Review found an existing keyup edge case: releasing an arrow/WASD key while scrolling a modal could issue steer(0,0) and replace an ordinary movement order. Keyup now releases only actual directControl. Modal keyboard focus includes disclosure summaries, excludes closed-details descendants, and returns to the recreated opener after Apply.

Local verification: 679 unit tests in 68 files, TypeScript, authored-content validation and production build pass. Fifteen new pure-helper tests cover ownership, deterministic ordering, stale/duplicate pruning, exact toggles and type groups, source immutability, escaped metadata, nonselected orders, paused snapshots and save/restore. Native browser scenarios are prepared for arbitrary subsets, separate queued orders, save reload, cancellation, live-dialog interruption, keyboard order preservation, narrow/enlarged-text layout and Shift-click precedence. Runtime and natural-play acceptance remain pending.


## First native gate and visual review

Run 37760860210 on 7b789e17291798b03baae5efaac2bd98957b696a completed 100 identities: 88 passed, 11 conditional skips, one failed, zero retries or unexecuted cases. Every new subset scenario passed. The remaining existing Attack-move case failed before input because its helper assumed a building’s world-center anchor would select the sprite. The helper now searches a verified selectable body point, retaining the same actual native input and command/selection assertions.

Downloaded native screenshots at 320px enlarged text and short landscape also showed excessive explanatory text consuming roster space. The help copy is now the concise “New recruits stay unselected.” Desktop Shift-click guidance remains in Orders and Help. Header spacing is tightened and footer focus rings have room. The corrected candidate requires all 18 subset identities plus the 9 existing identities sharing the building-target helper. This is a scoped visual/test correction, not a simulation or renderer change.


## Corrected native gate and release checkpoint

[Run 37762556406](https://github.com/KJLKurt/rts-game/actions/runs/37762556406) on QA revision 9dcb760730d21a06ef611be2a5ed5cce6665a548 passed all 25 applicable identities, with two desktop-only Shift-click skips, zero failures and zero retries. This re-executed every subset test and all nine tests sharing the corrected building-target helper.

Across the milestone, the 100-identity ledger now contains 89 passes and 11 conditional skips. The final compact-copy/CSS revision rechecked its 27 affected identities; 73 unaffected identities retain the earlier candidate's evidence. This is focused, cross-revision coverage, not a single full run of the 508 collected default identities. Earlier failure evidence is preserved.

Final runtime: **fc-3bdb15e026b6**. All 679 local unit tests, TypeScript, content validation and build pass. The full unfiltered Playwright configuration is restored for release. Simulation, renderer, platform/save and public assets remain byte-identical to the Engineer release. Downloaded actual phone-emulation pixels at 320px and 844×390 landscape were reviewed after the copy/layout correction. Physical devices and Safari remain outside this evidence.

Hosted natural-play selection and saved-order observations will be recorded separately after deployment. Direct rollback is the prior Engineer release, 384707d11994231c7c6750e6ed4815bb7a09bbfb. Saved control groups and formations remain open rather than silently claimed complete.
