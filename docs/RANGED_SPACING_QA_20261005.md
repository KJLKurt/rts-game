# Player ranged stance — 5 October 2026

Candidate **`fc-f640a7afaf56`** adds **Orders → Keep distance** so a human army can use the same automatic spacing behavior that Normal/Hard AI already used. This is a battle-wide, opt-in control for current and future archers, Menders and ranged commanders. It costs nothing and changes no damage, HP, armor, speed, attack period, range, faction price or income rule. A new battle and an older human save start with it off.

The parent requested this simulation/UI change after the prior controlled diagnosis demonstrated a consequential control asymmetry. The parent owns integration and publication. This cloud pass changes no unrelated repository, runs no Git writes, push, workflow or deployment, and retains Chromium's sandbox.

## Actual behavior and reproduction

1. Select ranged troops or a ranged commander and open **Orders**. Toggle **Keep distance: on**. Its pressed state and the selection caption show the choice. During tactical pause the toggle is a queued command; the caption previews it and the simulation changes on Resume.
2. Give Attack-move or a direct attack against melee troops. Ranged troops step back between shots when melee approaches. Capture and Guard keep their existing objective leashes. Retreat paths stay within one ordinary archer sight radius (nine tiles) of this enemy contact; they cannot take an obstacle detour outside that bound.
3. Give **Move** or **Hold**, or steer the commander with keyboard/thumbstick. Those explicit controls take priority. The caption says **Move: spacing off** or **Hold: spacing off** while that order temporarily suppresses the enabled stance. Changing the stance does not replace an existing order. Turning it off clears active retreat paths.
4. Attack a building. Ranged troops advance/fire normally rather than treating the building as a melee pursuer. Siege troops retain their existing behavior.
5. Save, leave and Continue. Both the battle-wide choice and a paused toggle persist. New recruits inherit the battle choice without requiring individual selection. The choice resets for a new battle.

The Broken Alliance preparation tip now names the native stance, Farshot and Attack-move/Capture sequence, plus manual-order priority. The four tips remain available in the briefing and live objectives. Mission settings, triggers, victory predicates, rewards and unlock rules are unchanged.

## Controlled counter evidence

The canonical fixed arena compares fifteen Wildborn archers with ten Arcanist swordsmen. It is a combat fixture, not paid recruitment, an earned campaign win or a win-rate estimate. Army prices are **480 gold / 480 wood** and **470 gold / 110 wood**; the wood investments differ.

| Controller | Result | Time |
| --- | --- | --- |
| Human ordinary Attack-move, stance off | All archers lost; six swordsmen survive | 11.8 s |
| Human canonical stance command on | Fourteen archers survive; all swordsmen lost | 10.7 s |
| AI spacing, strategic thinking disabled | The same fourteen survivors, HP, positions, damage and time as the human stance | 10.7 s |

The exact shared-outcome comparison is asserted in the simulation regression. Three actual production browsers also use the native toggle and map Attack-move after an explicitly declared canonical arena setup. They observe live retreat anchors and combat completion through real wall time. Player strategic AI remains false and no campaign winner is injected. These input tests establish access to the mechanic, not subjective fun or a natural chapter victory.

## Regression gates

The final candidate passes **548 unit/contract tests in 58 files**, TypeScript/build and all eight mission validations. The complete **331-case** production browser run has **310 passes / 21 intentional skips / zero failures or flakes**, including all nine new stance cases and all four PWA cases. Three separately executed upgrades from the actual prior published cache fulfill three of those skips: **313 verified / 18 remaining skips within the same 331 cases**. These are distinct-case totals; repeated focused executions are not added. The full run took 18.9 minutes, and the three upgrades passed in 26.2 seconds.

The final unit suite already passes **548 tests in 58 files**. Twelve new simulation cases cover current/future troops, exact AI/player counter equivalence, Move/Hold and direct-control priority, disable behavior, a 60-second obstacle/bounded-retreat fixture, Guard/Capture leashes, building/siege targets, save continuation, paused commands, legacy omission and malformed saves. The original ten conquest/siege tests keep their assertions.

The 130% text review caught a real short-landscape layout issue: the expanded Orders deck pushed the thumbstick into the resource HUD and the pause ribbon covered the selected commander. The corrected layout clamps the thumbstick below the measured HUD and puts the pause action above the expanded deck. Orders scroll horizontally, all controls remain available, and compact captions fit without clipping. New browser assertions verify the resource separation, visible commander label, 44-pixel stance target, Hold/Move priority and actual phone touch steering. Corrected desktop, portrait and landscape screenshots were inspected.

Production remains under `/rts-game/`: `index-Km_qtfl8.js`, `index-CtTVqhIs.css`, worker cache `09c141f63351`, 25 precached files and 27 distribution files. The repeat build reproduces all 27 files byte for byte. The complete suite covers movement/selection, recruitment/paid queues, building/placement, capture, AI-facing commands, pause/order projection, results/retry, campaigns/expedition, storage/interruption and offline/update flows. Platform-specific skipped cases and fixture-derived results are distinguished from actual execution. Owned browsers and the local host were closed after verification.

## Corrections retained in evidence

- An initial six-tile retreat bound broke two existing conquest regressions. Separate bounds-only, building-target-only and legacy-motion comparisons isolated the cause. The nine-tile bound uses the ordinary archer sight radius and preserves all ten existing siege regressions and the full unit gate. A twelve-tile comparison did not preserve the legacy authored timing, illustrating fixed-seed interactions; no old assertion was relaxed to make a bound pass.
- An early legacy-save unit fixture had removed troops without correcting its population counter. Restoration correctly recomputed population. The exact legacy-save check now uses an ordinary canonical game and retains exact JSON equality.
- Two initial browser save checks reloaded before asynchronous Save & leave finished. The driver now waits for the native Continue menu before reload; the exact whole-game assertion remains intact.
- The first enlarged-landscape geometry check failed with the joystick at y = −2 against a HUD ending at y = 48. Its assertion remains in the corrected native-input case.

Raw earlier logs are retained, including the large failed fixture diff. Final receipts identify which runs describe the final candidate.

## Earned save and remaining limits

The independently earned profile has **seven games / three wins**, with Outpost and Hold the Line completed; Broken Alliance is accessible and Ironwatch remains locked. Its existing retry `battle:28b1a176-a8e6-466d-b466-0b7cfd010b4c` remains unfinished at **556.4 seconds**, paused, Keep **5600/5600**, winner null. The previous natural defeat at 729.3 seconds remains recorded once. No new natural win is claimed.

The final native driver verifies **two legacy online/offline loads with entire browser storage exactly equal** and **two opted-in online/offline loads with entire saved storage exactly equal**. The older human battle retains an absent stance field and visibly starts off. The native paused opt-in adds exactly one `rangedSpacing` pending command; all currency, entities, match, campaign and profile remain unchanged. Its on state survives native Save & leave and Continue, ready to apply on Resume. The original game SHA-256 is `27580b53940b67c94c655c8d9f99af7bf9e9722f87e62dae16054017b06b5a93`; the queued opt-in game is `3760710a755d705b19e1f0ca27b666ffae334602a900c1e2c52705061e87719d`. The full profile hash stays `cbcf05ee8184f5aa3201bb4694f0dd5762b6ccb66a32c07b6ffaeb9bd91e4860`. Three native earned-profile briefing checks at 130% text keep the game frozen and next chapter locked. Zero uncaught errors; seven screenshots. The driver only remaps the owned localhost origin and operates native controls; it inserts no currency, units, unlocks or result.

The stance is battle-wide rather than per-squad. It can help preserve ranged troops; it does not solve the prior observed territorial/income deficit or guarantee success against healing, siege or larger investments. Broad multi-seed/faction balance, full natural Rise/Ember routes and successful later expeditions still need play. Uncoached novice comprehension/enjoyment, physical iPhone/Safari, installed-device performance/lifecycle, subjective audio listening and exact hosted browser play remain unverified here. The parent reports prior publication `61337243a44834edcc7f8a417cc47ed026053268`, Pages `37345727478` attempt 1 success and 238 source hashes; those are attributed publication facts, not cloud hosted-gameplay evidence.

Prior frozen badge/terminal evidence and audit/provenance documents remain immutable. This patch applies to the latest 237-file frozen cloud source; preserve the parent's additional publication document and any later independent work.
