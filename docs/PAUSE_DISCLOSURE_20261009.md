# Campaign difficulty and tactical pause allowance

9 October 2026. Runtime `fc-987c1e7d64e6`, offline cache `f80681024319`. Previous live checkpoint and direct rollback: `fe22133d1b44b2012e938ea2cb2299251fbd804a` (`fc-4b3559c7c391`).

## Observed problem

Ordinary Siege of Ironwatch play revealed an undisclosed change from Normal to Hard difficulty. Its chapter card and opening briefing omitted the three-pause limit. After the third use, the HUD still offered an ordinary Pause button and rejected further requests only through a temporary toast. The first rejected pause was not recognized immediately, and the battle continued during inspection. That attempt later ended by explicit player concession at 4:52, with the Keep still alive. It was not a combat-earned defeat or proof the mission is unwinnable.

Original brief section 7 permits limited pauses on Hard and none on Brutal. This change communicates those existing rules; it does not change them.

## Shipped behavior

Chapter cards and initial briefings now state difficulty and the actual tactical pause rule. Hard HUD shows the remaining allowance, including 2/3 and 1/3 left. During the third tactical pause, Resume remains enabled with 0/3 left. After resuming, the control reads No pauses and is disabled with a clear accessible explanation. Brutal reads Pause off / Brutal with its reason. Easy and Normal display Unlimited. Disabled text retains readable contrast rather than inheriting the general faded-button opacity.

The display derives from the real player pause counter. Keyboard Space still uses the existing simulation guard and feedback. Menu/visibility recovery, saved queues, difficulty, simulation, authored mission data, assets, audio and save code are unchanged. All such source bytes match the previous release.

## Validation

- All 810 unit tests in 75 files passed, together with TypeScript, eight-mission content validation and production build.
- Independent source review checked engine agreement across 40 difficulty/paused/counter combinations and all eight authored chapter difficulties. No blocking defect found.
- [Native gate 37870224889](https://github.com/KJLKurt/rts-game/actions/runs/37870224889), QA commit `6026a5f709056ff6dce44d13436c208110c2b24a`: 42 distinct identities passed on their first attempt. Zero failures, retries, skips or unexecuted cases. Retries were explicitly disabled.
- Twenty-four new cases span Mythic/Christmas and desktop/phone portrait/phone landscape: Normal fourth pause; Hard countdown, third-pause native Hold queue, Save & leave/reload, Resume and rejection of a fourth pause; Brutal disabled mouse/touch and Space; Easy/Normal/Hard chapter disclosures.
- Eighteen existing cases cover four difficulty variants of focus recovery, mobile visibility recovery with a tactical queue, and Ironwatch retry state. The new UI preserves these behaviors.
- All 16 planned phone PNGs were inspected: remaining, third-paused and exhausted HUD states in both themes/orientations, plus four Ironwatch briefings. Labels fit without covering resource controls. The briefing disclosure is visible near the top; its longer mission content scrolls normally.
- Artifact 11589719877: 8,048,932 bytes; SHA256 `751308424e88d62137e7086b6989644eb673c54ef0a20ca50679c242295a0918`. Hash and the complete 42-identity result ledger were verified locally.

Native UI cases run in isolated Playwright Chromium contexts with actual mouse/touch/keyboard input. Campaign disclosure cases reuse the repository's prior earned profile, remapped only to the isolated origin; they do not establish a new campaign win. The HUD cases do not inject pause counters or commands. These are touch-emulated Chromium checks, not physical-phone or Safari acceptance.

The full default browser configuration is restored in released source. Its 593 identities in 48 files were collected, not rerun as one full matrix. No simulation/balance acceptance is inferred from this focused gate.

## Preserved progress and open work

Broken Alliance's genuine 10:44 victory remains separate from its earlier 20:02 concession and this Ironwatch concession. Profile is 3 victories, 4 defeats, 7 battles and 13 achievements; Rise remains 3/5 complete. The original Forager route remains The Old Crossing, 0/4 wins, 40 crowns and its original modifiers. Ironwatch, The Frontier, Ember Road and full expedition completion remain open, alongside broader art, physical-device performance, listening and subjective usability evaluation.
