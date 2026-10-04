# Actual playtests and limits

Automated simulation is useful for determinism and balance probes; it does not establish fun. These are actual browser/UI observations, kept separate from scripted state fixtures.

| Build                             | Match / input                                                                                                        | Observed result                                                                                                                                                                                                                                                                                                |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `82c323` production runner        | Engineer Rush, normal speed, movement/abilities/five upgrades through UI                                             | Victory at 240s, wave 14, 80 kills, five survivors. Results/profile/retry worked. An earlier attempt lost at 114s outside the ward.                                                                                                                                                                             |
| `31e64fe` clean production runner | Phone Easy skirmish, UI 1.5× speed; gold/timber expansion, recruiting, defenses, relic orders, abilities and retreats | Victory at 575.5 game-seconds, 640–309, 12 captures, 124 kills, one commander death. Restart worked; no page errors.                                                                                                                                                                                            |
| Hosted `4afcfbd`                  | Normal-speed Easy/Quick/Small, Ironhold Warlord, seed `SCOUT-LIVE-002`; tactical pause for planning                  | Defeat by relic domination at 8:48, 90–640, 83 kills, three captures. Range/House construction, research, commander respawn, recruitment, recovery, results, achievements and same-seed retry worked. Long tool interaction gaps and low command cadence affected this run; it is not a fair win-rate estimate. |

## What the sessions changed

- Beginner starter troops initially chased into combat while instructions were read. Fixed idle guards and a frozen first briefing were verified: reported seed `FRONTIER-549665` retained six troops and 713 commander HP through 81s after early recruitment; `OUTPOST-01` retained four starters and 713 HP through 60s after the reported joystick movement.
- A preserved pre-fix pursuit save lacked guard anchors. The separate runner restored it paused at 50s and observed the formerly wandering archer stay within 0.24 tiles after resume. This supplements the genuine historical JSON regression fixture.
- Rally/Charge had useful visible impact on the first hosted fight. Losing an army did not end the run immediately: recruitment, commander recovery and purchased mastery enabled another push.
- Capture orders could chase beyond the captured objective; the current candidate anchors objective defense and preserves aggressive Attack-move separately.
- Natural taps on the upper relic star could miss its ground-radius hit target. The current candidate uses pivot/silhouette-aware picking.
- Invalid paused building locations were not rejected until Resume. The current candidate validates immediately, retains the placement preview on error and reserves space around queued buildings.
- Stockpiles hid the need to protect income, and damaged buildings lacked a persistent inspectable warning. Current candidate HUD feedback addresses both without resource/HP bonuses or automated recalls.

## Focused polish review

Independent browser review of `b41af521` / static preview `5ad7c5b` passed natural upper-gold/relic taps, immediate Keep overlap and queued-House overlap rejection, completed Capture holding (20 seconds at gold, 16 at a relic), income and relic rates, a natural Keep-under-attack View action, portrait–landscape–portrait joystick use/release, exact gameplay/settings save continuity, and every live attack frame for Warlord, Swordsman and Archer without obvious pivot/scale jumps. Desktop battle and 390×844 phone screenshots were inspected.

That review caught guide stage resetting on Continue and a tactical-pause ribbon covering guide instructions. The follow-up correction persists per-battle guide progress, conservatively restores older saves, and suppresses the duplicate banner while a visible guide or raid warning needs the space. Focused confirmation and final acceptance results are recorded in `QA.md` when complete.

## Remaining limits

Complete manual campaign and expedition runs, broad difficulty/faction win-rate balancing, installed-app lifecycle on physical phone hardware, and subjective music listening remain unverified. Codec metrics, decoded buffers and an unlocked AudioContext do not establish that the music was subjectively heard. A full browser suite does not replace physical-device performance or repeated human play.

## Advertised-mode follow-up

Hosted `2b2141f`, Outpost story chapter, first ordinary-UI attempt: defeat by relic score at 8:29, 125–640, 59 kills,seven captures. The run used recruitment, ranged/healing/cavalry unlocks, buildings, economy research, capture, tactical pause and recovery; an overextended opening and long command gaps contributed to failure. Results and Try again restored the correct Outpost briefing, seed, 0:00, starting stocks and army. This establishes a normal loss/retry path, not chapter unlocking; a second staged-opening attempt and an independent expedition run are still in progress.

The second hosted Outpost attempt used a protected Range/House and a staged mixed army, then explicit counterattacks, captures and cavalry. It ended in Keep destruction at 8:08, with 76 kills and three captures. Active recovery stopped at 5:05; the remaining decline was observed at the ordinary 2× UI speed, so it is not a sustained-play balance measurement. It exposed the local guard-retaliation gap documented in `ENGINE.md` and a result-copy perspective defect. Both corrections are in a candidate; chapter unlocking remains an outstanding ordinary-UI check.
