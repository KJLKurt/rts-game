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

## Still to inspect in the candidate

Attack frame transitions and pivot continuity; upper-art taps on real pixels; short-phone/landscape HUD and warnings; completed Capture holding behavior; queued placement feedback; save/update/offline continuity with the new assets. Codec metrics, decoded buffers and an unlocked AudioContext do not establish that the music was subjectively heard. Physical-phone hardware performance remains unverified.
