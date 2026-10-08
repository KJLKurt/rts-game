# Battlefield decision clarity — local candidate

Candidate runtime **fc-d2c8a92015e0**, based on deployed production fc-194c08936126 and its verified test-selector revision da887be1. This is a separate implementation batch. Main and Pages have not been updated for it.

## Player-facing changes

- Gold, wood and population now have distinct icon/color identities. Population shows used/current capacity together and keeps the match ceiling separate. Values still come from the existing planning snapshot; income still comes from the real economy.
- Build, Recruit, inspection, placement and research prices share resource-typed, visibly labeled costs. A wood-only House no longer inherits gold styling or shows a misleading zero-gold component.
- Single-selection identity now includes a live bounded health meter plus actual numeric health, planned queue count and construction progress. Runic Turret is named correctly instead of falling back to Commander. Health/countdown changes do not invalidate the control-deck signature.
- Building Train, Research and Upgrade controls expose actual resource, population, construction, selected-producer queue, duplicate/completed upgrade and tactical-queue restrictions before a tap. Native disabled controls remain legible. Availability only invalidates the inspector at meaningful thresholds. The engine remains authoritative and unchanged.
- Placement status distinguishes unplaced, valid, blocked and legal teaching caution with icon and text. Engine errors receive one terminal punctuation mark. Population-building previews respect the match ceiling rather than promise unconditional capacity.

## Verification completed locally

TypeScript, eight-mission content validation, production build and **613 unit tests in 66 files** pass. The25 new unit cases cover typed costs/zero omission, turret identity, bounded health, punctuation/placement states, selected building availability, reserved population/refunds, stable control signatures and the60-command tactical limit. All15 simulation files and all public assets remain byte-identical to the deployed baseline.

Read-only review found no P0/P1 regression. Its tactical-limit gap and large-text inspector coverage request were addressed before runtime QA. Browser collection contains475 identities: the previous472 plus three viewport executions of the new decision-readout scenario. Existing placement assertions are strengthened, and the three-phone enlarged-text matrix now includes blocked Train/Upgrades.

## Runtime gate

Pending the existing isolated browser workflow. No passing runtime, visual-fit or deployment claim belongs to this candidate until its own terminal evidence is appended. Keep the prior clean448-pass baseline gate and the earlier selector failures in their original records.

The approved concept boards remain visual direction; no illustrative resources, costs, health or worker mechanics were copied into simulation. Original-scope reconciliation and substantive remaining work are in REQUIREMENTS_RECONCILIATION_20261008.md.

## First runtime gate and correction

Run37736705281 on c05e47c4 / fc-d2c8a92015e0 ended at the six-failure limit:321 passed,6 failed after their configured retries,16 skipped,1 interrupted and131 unexecuted. Three failures came from a rooted locator used inside a relative row filter in the new test. A portrait dock measured381.671875px against its368px limit; two landscape native-selection checks also regressed after the additional health-row geometry. These results remain failed evidence, not acceptance.

Correction candidate **fc-cb9c10dfdc4f** restores the original small-element health line and empty multi-selection line. The visual meter is absolutely positioned within that existing box, so it adds no row or wrapping height. Native interaction/size assertions remain unchanged. Row assertions use the already-found button's immediate parent. Type/content/build and613 unit tests pass again; source review confirms the bounded correction. Its own complete runtime gate remains pending. No main/Pages deployment has occurred for either clarity candidate.

## Bounded diagnostic evidence

Run37742847961 selected only the portrait enlarged-text matrix and landscape Ironwatch Retry, with one worker and zero retries. Ironwatch passed unchanged; its prior failure is retained and its cause remains unproven. The portrait matrix timed out waiting for Upgrades after the test unnecessarily reselected the already-selected Keep and touch landed on Focus. Native screenshots showed the commander selected. This is not a full-suite pass.

Candidate **fc-45389cdde446** switches tabs on the already-selected building and asserts that identity. Visual inspection also exposed clipped large health numbers at360px/130% text. Portrait now shows the exact current HP compactly; the meter accessibility value and expanded Details retain the full current/maximum pair. Cancel retires only its matching placement instruction, preserving concurrent battle warnings. Type/content/build and614 unit tests pass. The same two-case scoped verification is required before restoring the normal full gate. No clarity candidate is deployed.


## Scoped correction verified; full acceptance pending

Run 37744368115 on QA commit 100688b61e63415c6d534f1957bbcbeb3de239c7 passed both scoped cases on their first attempts, with zero retries (36.4 seconds). This covers the portrait 360/390/430px enlarged-text sheet matrix and landscape Ironwatch Retry only. The native image artifact was downloaded and SHA256 verified as b64fbd42071807ffe1d1fd39afc98d1021a7f39bea1740f7159369361aed6f78.

Actual screenshots confirm compact current HP, explicit wood prices and removal of stale placement instructions. Long selected-building names still truncate in the smallest dock; expanded Details retains the full name. This is Chromium touch emulation, not physical-phone acceptance.

The original unfiltered Playwright configuration is restored for the final 475-identity gate. Runtime remains fc-45389cdde446; simulation and public asset bytes remain unchanged. No main or Pages deployment is included.


## Final multipart browser acceptance

Runtime **fc-45389cdde446** is covered by two complementary runs, with every one of the 475 identities reconciled exactly once:

- Full run [37745260925](https://github.com/KJLKurt/rts-game/actions/runs/37745260925), QA commit 926d6c1bb6967c5e60128529a3f23ebc24f37351: 366 first-attempt passes and 20 skips before the existing 25-minute job limit cancelled it. No failure or retry event was observed; 89 identities lacked terminal evidence. Its artifact step was skipped by job cancellation.
- Exact remainder run [37748319688](https://github.com/KJLKurt/rts-game/actions/runs/37748319688), test-config-only commit d3378d9969b673eac587f5b335418847bf5278d7: 85 first-attempt passes and 4 skips in 6.9 minutes, zero retries. The 89 selected identities were verified to have no overlap with the first run's terminal results.

Combined: **451 first-attempt passes, 24 skips, zero failures, zero retries, zero unaccounted identities**. This is multipart coverage, not a single clean full run. Skips retain the existing 21 viewport/input conditions and 3 previous-dist upgrade cases. All four ordinary PWA cases passed. Physical-device/Safari and previous-production-cache migration remain outside this evidence.

The release uses the full original Playwright configuration, with no diagnostic filter. Local 614 unit tests, TypeScript, content validation and production build passed. All 15 simulation files and all 35 public asset files remain byte-identical to production 493a475. That production commit is the direct rollback target for this milestone.

Actual downloaded Chromium phone screenshots were reviewed at 360/390/430px and enlarged text. The native placement preview shows explicit resource cost, legal-location feedback and large Confirm controls. The compact health line fits current HP; Details retains full health and identity. Long names still truncate in the smallest compact dock. The milestone improves clarity and does not claim complete concept fidelity, physical-phone acceptance or completion of the original 56-section scope.
