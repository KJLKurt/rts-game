# Queued construction visibility — 8 October 2026

## Change and contract

Runtime `fc-4cb2e295f85f`, offline cache `c78628090f59`. Direct rollback is production `c8843a6368dde68058639dc0c5433c88b1f05fb8`.

This addresses an observed usability gap in ordinary Hold the Line play: confirmed paused building orders previously disappeared from the map until Resume. Queued successful builds now remain as dashed gold ground diamonds with “Queued House” or the actual building name. The active valid/invalid ghost remains teal/red; completed buildings and construction sites keep their existing art. Markers paint beneath actors, follow visibility/fog, create no hit areas and do not change selection or orders. Labels may be occluded by actors or suppressed where they collide with controls or other labels; the ground diamond remains.

The display derives from the existing command projection, including reserved resources and intervening production refunds. It never creates entities or pays costs. Cancel closes the active preview only. There is no newly invented tactical queued-build Undo; map-editor Undo remains separate. Resume executes existing commands once and removes planned markers; save/Continue restores paused plans. Help and About explain this distinction.

Simulation, persistence/platform, public art and audio bytes are identical to the rollback source.

## Local validation

727 unit tests passed in 71 files; TypeScript, eight story mission content validation and production build passed. New model/render tests cover successful-only projection, malformed/inactive inputs, own-team filtering, refunds, queue replacement/removal, restore, purity, fog/culling, obstacle labels and static draw geometry. Independent source review also exercised the actual planning-cache logic. Full normal browser collection: 538 identities in 45 files. The complete matrix was not executed for this UI-only batch.

## Focused native results, preserving history

1. QA source commit `6c971887ec2bd2091287c83fb063f93da850bedf`, run [37780152987](https://github.com/KJLKurt/rts-game/actions/runs/37780152987): 27 identities, 19 first-attempt passes, 2 intentional phone skips for desktop Escape, 6 failures, zero retries and none unexecuted. All five new landscape scenarios passed. Five portrait tests stopped at a driver attempting a CSS-hidden Zoom button; desktop picking could not locate its overconstrained foreground-only unit fixture.
2. Test-only revision `3c088a5175c3ef9f2ada70687323381ae550825e`, run [37782930461](https://github.com/KJLKurt/rts-game/actions/runs/37782930461): 7 affected checks passed, zero failures, retries or skips. The portrait driver uses native two-finger pinch when zoom controls are hidden. The picking fixture checks either footprint, validates both builds remain legal, and requires opaque painted sprite pixels plus real renderer picking before native input. All production source bytes are unchanged between runs.

Reconciled result: **25 passing identities and 2 intentional skips**, established across two runs. This is not a single clean run and does not erase the original failures. Every original assertion remains meaningful. The final release restores the unfiltered default browser configuration.

Native coverage includes two queued footprints and a moving active ghost, Repeat/Cancel, reserved costs and overlap rejection, same-length queue replacement, save/Continue, once-only Resume execution, real troop picking and Move through a noninteractive planned footprint, workshop Undo and new-battle isolation, and existing clear-ground orders in both themes. Inputs use normal Chromium mouse/touch and controlled, explicitly labelled fixtures; this is not physical-device or natural-match acceptance.

## Pixel evidence

Four small CSS-resolution PNGs were captured during the two runs: Christmas and Mythic at 390×844 and 844×390. All were visually reviewed. Gold dashed footprints remain distinct from the solid teal preview, while mobile Confirm/Cancel controls remain legible. Units deliberately remain above the ground markers. No image editing was applied.

First artifact: 24,889,762 bytes, SHA256 `44d9361ac2423b9e068e890730d4b65df34db9292586714548bd5dcfe1c0b86a`. Continuation artifact: 785,184 bytes, SHA256 `ec2dd001db4ceae37257be8de3bf1190a4dc10b2cad32c4b04ba983a524361fd`.

## Remaining scope

The saved Broken Alliance opening remains untouched by this implementation batch. Earlier natural Hold the Line loss and earned six-minute victory/reward/unlock stay attributed to `c8843a6`. Further ordinary campaign and full expedition progression, novice usability, art completion, subjective audio review, physical-phone/Safari and installed performance remain open. This focused change does not establish full-game acceptance or fun.
