# Confirmed surrender and durable results — 8 October 2026

Runtime `fc-5dd3992fdd55`, offline cache `c379e9c8dd62`. Direct rollback: `4a14e682b0a0b3d5f04e9b3c605f2cb276c67149`.

## Problem and behavior

Ordinary Broken Alliance play reached 20:02 with the truce/gold requirements complete, no relics owned, exhausted nearby supplies and a surviving defended Keep. The campaign has no forced deadline, and the battle menu offered no concession or direct retry. This was an unfinished position, not a proven impossible economy or earned defeat. The original brief calls for polished repeat play, a pause menu, termination testing and satisfying pacing; it does not explicitly name a surrender button.

Battle menu now offers **Surrender battle**. A separate confirmation explains that the battle ends as a defeat with no new rewards. Cancel, Close and Escape cancel the confirmation. Campaign copy explains retry; expedition copy explicitly warns that the run ends while its journal and earlier rewards remain. Save & leave keeps its existing unfinished-save behavior. Learning and workshop tests keep their own exit paths and do not offer surrender.

Confirmation issues one immediate, deterministic, logged command, including during tactical pause. It clears unexecuted orders and produces “You surrendered.” without pretending the Keep fell. Existing entities, resources and alliance defeat flags stay intact. Outcome helpers treat concession as a terminal local loss, including a custom battle with no eligible rival winner. Restore validates the reserved reason and final local command together. Repeat commands and repeated result commits cannot add another loss.

The profile records played statistics and one defeat, but grants no new achievements, cosmetic choices, chapter completion, victory or expedition rewards. Prior rewards remain. An active expedition follows its existing defeated-run contract: no new route choices, journal retained. An unrelated stored expedition is not part of a normal campaign result transaction.

## Result persistence and interruption protections

Existing ResultCommit ordering remains: finished-battle recovery checkpoint, profile, active expedition checkpoint, then battle-key cleanup. A stable match ID deduplicates recovery after reload. A save failure keeps result recovery/retry available and blocks replacing the unfinished commit.

Independent review found and closed related hazards: an older Save & leave completion could hide a newly created result; generic result Close/Escape could strand Retry; null-winner concessions needed consistent terminal UI guards; and Update & restart could race a newer result while saving. Result screens now retain explicit navigation. Update preparation blocks new commands and simulation until activation, restores controls on failure and rejects stale update offers. No authentication, permissions, workflow or network-security settings changed.

## Local checks

769 unit tests in 73 files passed. TypeScript, eight story mission content validation and production build passed. New tests cover immediate/duplicate/paused surrender, alliances and null-winner saves, deterministic replay, corrupt restore rejection, explicit reason/advice, no new rewards, campaign and expedition progression, all four result-save failure stages, terminal inspection/render behavior and stale update handling. Artwork/audio bytes are unchanged.

The released default browser configuration remains full and unfiltered: **557 identities in 46 files**. That complete matrix was not executed for this batch.

## Focused native evidence

- [Run 37849339590](https://github.com/KJLKurt/rts-game/actions/runs/37849339590), QA commit `f8dca3beab397e719fa74d1a185ae603eb658f01`: **32 passed**, zero failures, skips, retries or unexecuted cases. Eighteen new surrender identities across desktop/portrait/landscape, nine existing result regressions and five PWA cases.
- Pixel review found that the transient queued-order toast pushed the landscape confirmation button below the initial dialog edge, although scrolling worked. The follow-up removes that irrelevant notice on opening confirmation and places short-landscape actions side by side. Assertions now check initial button visibility before scrolling.
- [Run 37850395217](https://github.com/KJLKurt/rts-game/actions/runs/37850395217), QA commit `e5e708237a4cbe6dcddb07f18d98c22579038419`: **8 affected checks passed**, zero failures/skips/retries. Core simulation and persistence bytes remain identical to the 32-case gate. This is staged evidence, not a claim that all 32 cases ran on the final layout revision.

Four final CSS-resolution phone PNGs (short and expedition confirmations in portrait/landscape) were visually reviewed. Both buttons are fully visible initially and remain at least 44 CSS pixels tall.

Native cases use real mouse/touch controls and clearly labelled storage/lifecycle fixtures. They cover repeated Cancel, interruption, Save & leave/Continue, immediate concession, clean retry, campaign reward protection, explicit expedition consequences, reload recovery, duplicate-save prevention, delayed Save & leave races, update/restart races and ordinary results. Mobile evidence is Chromium emulation, not physical-phone/Safari acceptance.

Initial artifact: 1,964,780 bytes, SHA256 `2ee880288bcfabbffdc9160d30fb9752786dfa1793108a13c374096c7baeb447`. Layout artifact: 810,096 bytes, SHA256 `3de9aeeedd081e843eb5e3318adb79ce69ea4e6b2622d974ace36a4030225287`.

## Natural-play attribution and remaining scope

The source observation comes from an ordinary saved Broken Alliance attempt on prior runtime `fc-4cb2e295f85f`. It reached 20:02 without a terminal result. Its checkpoint was saved and reloaded through normal controls. Any later use of Surrender on that checkpoint is a **player-conceded defeat**, not a combat-earned loss, natural victory or balance acceptance. No chapter/reward should unlock from it.

Further campaign victories, full expedition completion, novice balance/fun, art completion, physical-device/Safari behavior and installed performance remain open. This feature supplies an honest exit from a long losing position; it does not establish that the mission is balanced or that the full game is complete.
