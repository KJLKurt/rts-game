# Engineer Breach Charge milestone

Original brief section 6 requires an Engineer siege-related ability but names no mechanic. This milestone adds **Breach Charge (C)** alongside unchanged Runic Turret (Q) and Field Repair (E). It deals **180 damage to one visible, living hostile building within 6 center-to-center tiles**, with a **28-second cooldown**. It does not damage troops. This is a documented initial balance choice, not a user-specified damage value.

Use Attack on a building to choose it deliberately; otherwise the mobile button chooses the nearest eligible structure. Paused Attack orders supply the same intent. Invalid, hidden, allied, dead and out-of-range targets spend no cooldown or order. An old move/build point never redirects this ability. Without a valid structure the button says Buildings only and explains the range on use. Keyboard modifiers do not cast.

The ability uses existing commands, damage statistics, kill/victory accounting, tactical projection, cooldowns, replay and version-1 saves. No new save fields are required. AI reserves the strike for armed fortifications. An initial unrestricted AI implementation prolonged Ironwatch to 2774.2 seconds, failing its existing pacing assertion. The corrected rule preserves that assertion and finishes at 983.3 seconds versus 988.7 seconds on the prior baseline. Historical failure evidence is retained.

Local verification: 664 unit tests in 67 files passed, including 48 focused Breach cases and the existing conquest suite. TypeScript, authored-content validation and production build passed. Source review corrected unreachable selection intent, modified-C shortcuts, generic Rush copy and native-test stale pixel targeting.

Planned browser gate: 61 identities from Engineer Breach, ability allegiance, HUD collisions, commander framing/selection and ordinary PWA suites, using the existing isolated QA workflow with zero retries. This is a focused regression gate, not a new full-matrix acceptance. Native input includes missing-target feedback, keyboard/button casts, queued save/reload execution, three portrait widths with 130% text, and explicit Attack targeting of a farther structure. Mechanic fixtures are labeled and do not count as natural progression.

Runtime, actual screenshot review and unmodified-state natural Engineer siege play remain pending. The previous deployed release is 7e5090af1786d7f9ac7d200e8a0e7c3e07dd19cd / fc-45389cdde446. No broader 56-section completion is claimed.


## Focused runtime gate completed

The 61 planned identities are now accounted for: **60 first-attempt passes on their final test revision and 1 conditional viewport skip**, with zero retry-only passes. This is focused multipart coverage, not a new full 490-case run.

- [37752262986](https://github.com/KJLKurt/rts-game/actions/runs/37752262986): 29 passes, 4 new-test failures, 1 interrupted, 27 unexecuted. Settings used an ambiguous close selector; two save tests reloaded before asynchronous Save & leave returned to the menu.
- [37753401336](https://github.com/KJLKurt/rts-game/actions/runs/37753401336): exact 32-case continuation, 30 passes, 1 conditional skip, 1 landscape native-target failure. Corrected save tests wait for the durable return to the menu and pass on all viewports.
- [37754541818](https://github.com/KJLKurt/rts-game/actions/runs/37754541818): one-case diagnostic reproduced the target miss. The native pointer hit canvas, but the temporary Attack hint retired and the camera moved between captured pixel and input. Downloaded screenshots corroborate it.
- [37755134064](https://github.com/KJLKurt/rts-game/actions/runs/37755134064): that one case passed after the test waited for the hint to retire and observed camera stability before choosing a painted target. Native down/up/click each resolved to the intended building; the queued Attack and Breach coordinates matched it. No production gameplay change was made for these test corrections.

Runtime remains **fc-cd4082ff52f9**. The release restores the full unfiltered Playwright configuration. Actual downloaded landscape screenshots were reviewed; the third ability remains readable and separately tappable. Portrait/landscape native-input and 360/390/430px large-text assertions passed, but these are Chromium emulation rather than physical-device acceptance. Natural hosted conquest and legacy-save upgrade observations will be recorded separately after deployment.
