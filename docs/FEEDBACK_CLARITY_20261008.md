# Contextual battle feedback and natural-play evidence

8 October 2026. This milestone follows the troop-selection release `4d252eaecd71aad371cc3840d84c8abfefa12297` / `fc-3bdb15e026b6`.

## Observed usability problems and bounded implementation

Actual play and the approved-concept comparison exposed stacked instructions over the battlefield, pause-dependent notices surviving Resume, and restored-save feedback covering troop-picker controls. The same play also showed singular/empty-army wording and a Conquest relic described as earning victory points despite the siege-income objective.

- Move, Attack, Attack-move and Rally now use one persistent, polite live instruction next to their native Cancel button. Error announcements and actual command acknowledgments remain.
- Feedback has explicit match/pause lifetime. Resume retires notices that depend on being paused; ordinary save confirmations and errors retain their normal lifetime. No string matching classifies training queues.
- The same feedback live-region node sits in normal flow below an open dialog's header. Its reserved space remains through expiry until dismissal so controls do not jump beneath a touch. Closing/replacing dialogs safely preserves the node.
- Selection feedback handles zero, one and multiple troops. Empty Army selection explains recruitment/recovery instead of claiming units are ready.
- Relic context describes Conquest income, ordinary score modes, authored mission objectives, practice and Rush accurately.

Simulation, renderer, platform/save code and shipped artwork are unchanged. This is not a balance change or a full visual redesign. Approved concept 05/06 still show more cohesive terrain/prop detail and less accumulated secondary HUD clutter than the game. Those broader gaps remain open.

## Natural full-match result on the preceding shipped build

The owned `BREACH-NATURAL-EASY-2026` Conquest match continued from the real paused 4:01 checkpoint. Native controls were used for retreat, turret/repair, recruiting, rally, capture, range construction, pause and built-in speed settings. No simulation state, resources, winner, progression or debug clock was injected.

The forward Engineer engagement was already under heavy pressure. Retreat failed and the commander recovered at the keep. A temporary counterattack held the initial archer pressure; a later relic push and increasingly outnumbered defense failed. The actual result was **defeat at 7:25**, own Keep destroyed, **83 enemies defeated, one point captured, 23 troops lost**. This single loss is not evidence that Easy difficulty is generally unbalanced: the session deliberately exercised different controls, included risky advances and used tactical pause.

The result visibly saved. Native Try again restarted the same seed with full Engineer health and initial resources. Save/leave and a reload preserved exactly one recorded battle, zero wins and one defeat. Four achievements were earned: Stake Your Claim, Foundations, Raise the Banner and Time to Think. The retry did not duplicate the result or grant the campaign title. An immediate post-reload menu action entered Continue instead of the intended record view; that driver/menu-hydration timing is retained as a qualification. Waiting for the settled menu and using its record control succeeded.

The cloud desktop browser initially advanced unusually slowly at normal speed and later recovered without debug or security changes. This is not physical-device performance evidence. Native phone evidence comes separately from standard Chromium touch emulation.

## Genuine campaign victory and persisted reward

A separate natural **OUTPOST-01** first chapter on the same preceding shipped build ended in victory at **4:38**, with all five required objectives complete, **44 kills, two captures and 13 troops lost**. Early unsupported advances lost troops and the first house; there was no fixture reset or injected victory. Rebuilding the house farther back, setting both producers to a sheltered fixed rally, holding reserves and then advancing a massed force secured the relic with 16 Spearmen alive. The commander had died repeatedly, so no lossless-commander achievement is claimed. This is one successful strategy under coached play and tactical pause, not novice-comprehension or general balance proof.

The result saved and granted **Founder of the Frontier** plus **Hold the Line**. Native Next chapter opened the second chapter. Its ordinary paused opening was saved for later continuation. After reload, Command record showed exactly **two battles: one win and one defeat**, 127 cumulative kills, eight achievements and the two separate history entries. The earned Founder title was selected through Use title and survived another reload. Campaign UI retained The Outpost as completed, Hold the Line ready, and later chapters locked. No second-chapter victory, full campaign or full expedition is claimed.

## Verification

Local final-source verification: **697 unit tests in 69 files passed**, content validation, TypeScript and production build passed. Initial candidate runtime: `fc-c2338a9bfbfb`; landscape-spacing revision: `fc-e944760b1669`; final footer-clearance revision: `fc-3fdc0658bda9`.

The single focused zero-retry native gate contains **87 identities in seven files**, covering feedback, approved mobile controls, match lifecycle, toast placement, commander framing and troop subsets. It runs through the unchanged isolated browser workflow on QA commit `661b58520f76db36c22497b12de36894cce4a63d`, run [37767616667](https://github.com/KJLKurt/rts-game/actions/runs/37767616667). The gate completed with **86 first-attempt passes, five conditional skips, zero failures, zero retries and zero unexecuted cases** across 91 identities. Its existing PWA project also ran four tests in addition to the intended 87 targeted identities; all four passed. The five skips are inapplicable viewport/input cases. This is a focused gate, not a full 523-case matrix. The 208 MB artifact exceeded the local supported download size, so two unchanged-runtime portrait/landscape capture identities run separately to make their pixels locally reviewable (QA commit `2538b551e5ef4bba34fc6d52239065acc80f9669`, run 37769075147). The release must retain the full unfiltered browser configuration.

Independent source review found no blocking regressions. The first two-identity capture run passed and supplied locally verified portrait/landscape PNGs. Pixel review found only about 50 CSS px of roster in landscape at 130% text. A scoped padding/header correction then passed three affected identities in run [37769944356](https://github.com/KJLKurt/rts-game/actions/runs/37769944356), with actual 124.34 CSS px of roster, an exposed first checkbox, 44px minimum targets, stable expiry and native scrolling/focus. That image review then caught a clipped footer focus outline; the final spacing correction restores six-pixel outline clearance without reducing touch targets. The final footer uses 8px padding around the existing 6px outline, preserving the original 16px vertical budget. Its final three-identity continuation uses QA commit `32fa25c0ecf52b6ea9aa9cd7a6868e8ee944231a`, run [37771027227](https://github.com/KJLKurt/rts-game/actions/runs/37771027227); all three identities passed first attempt with zero skips/retries/failures. Final pixels were inspected: 112.34 CSS px of landscape roster remain visible with the notice, the first checkbox is unobstructed, minimum targets remain 44px, and the complete 6px keyboard outline is visible with no clipping ancestor. The three checks are a final scoped continuation, not a repeat or replacement of the earlier 91-identity gate. A helper's singular picker summary is immediately replaced by the established “N selected” refresh; tests of the helper alone do not claim that wording is the displayed runtime summary.

## Remaining acceptance limits

One natural match and focused regressions do not establish all campaign/expedition routes, novice comprehension, broad balance, subjective fun, physical Safari/installed-device performance, complete art-theme/directional coverage or asset redistribution rights. The original wider scope remains open.
