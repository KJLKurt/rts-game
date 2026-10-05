# Stable live-HUD controls

Date: 2026-10-05. Narrow correction for the independently reproduced V3 chapter-objective click loss.

## Confirmed baseline

V3 (`index-CxpIZzwO.js`) passed the prior landscape placement and portrait card-stability checks. Independent native input diagnostics nevertheless recorded a detached chapter-objectives button during held presses. The retained diagnostic shows a desktop 149ms press with the intended initial hit target, `originalConnected: false`, and no resulting objectives dialog; phone presses also detached the original node even though their click delivery recovered. The parent also reported desktop reproductions at 108ms and 226ms.

## Root cause and correction

`updateHUD` first rendered the generic skirmish objective and then rendered the chapter objective into the same element on every tick. That guaranteed replacement even when the chapter count had not changed.

The corrected code computes the same final objective variant, preserving existing mode precedence, and writes it once. HUD readouts use the existing in-place DOM reconciler. Interactive controls are matched by their action and target rather than by changing labels. Explicit production-queue keys still take precedence. A genuinely different action/target receives a new node, so an old press is not silently redirected to another command.

The adjacent live-control audit covered:

- chapter progress labels and objective dialogs;
- commander health / Focus commander;
- placement status and Confirm / Cancel / Repeat controls;
- selected-unit readouts and their Cancel control;
- pause queue counts / Resume;
- Rush countdown/status / Choose an upgrade;
- field-guide / warning buttons;
- existing production queue controls.

Labels, health bars, disabled states, status text and objective progress still update. No HUD cadence, simulation updates or click timing is suppressed. Rush also retains its existing status container when another real deck-signature change occurs, instead of clearing and rebuilding its live upgrade button.

## Validation

The final local production receipt is recorded in [QA.md](QA.md); earlier diagnostic receipts remain historical.

- Unit coverage checks stable semantic keys, target/action changes, explicit-key priority and collision-safe key encoding.
- New browser cases assert actual node identity through several HUD ticks; native mouse/touch holds at the reported timings; a real progress-label change during a press; commander focus through a health update; and Rush status changes plus a genuine deck invalidation.
- These cases executed in the fresh complete local release suite on desktop and both emulated phone views. The intentionally hidden short-landscape commander strip is excluded from its visible-control test.
- Held mouse/touch objective presses, changing progress labels, commander health focus and Rush status/deck transitions pass on the final production build. Six additional portrait held-input repeats pass; earlier V3 failures remain historical.

The exact Settings Done, learning HP tolerance, native begin-mission, unobstructed lesson-action and battlefield Focus fixtures are reconciled in the final suite. These harness corrections preserve the behavioral assertions.
