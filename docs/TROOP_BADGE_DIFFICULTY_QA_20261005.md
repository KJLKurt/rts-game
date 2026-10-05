# Troop badge correction and Broken Alliance diagnosis — 5 October 2026

The canvas troop summary now avoids visible HTML controls, including the commander strip, expanded command deck, minimap and touch joystick. Short landscape wraps the composition line when a full-width badge cannot fit. Broken Alliance now provides specific preparation and combat guidance in its briefing and its live objectives dialog. Its envoy is correctly identified as Arcanist, and the optional eight-troop objective is described as an early milestone.

The controlled comparisons identify a substantial territory/income gap and a reproducible control asymmetry: Normal AI ranged units automatically kite between shots; player units require manual movement orders. They do not establish a hidden AI currency bonus or justify a general faction nerf. All fifteen simulation files and all campaign settings, triggers, objective predicates, rewards and unlocks remain unchanged. No new naturally earned chapter win or full route is claimed.

## Runtime, authority and final gate

Candidate **`fc-9ad03334aff3`** runs the production `/rts-game/` build in actual sandbox-enabled Linux Chromium 151 with Playwright 1.63. Desktop uses 1440×900 CSS pixels; emulated touch uses 390×844 and 844×390. JavaScript is `index-CIPt5Qwh.js`, CSS `index-C9pWTGt4.css`, worker cache `f55d6fa99347`, with 25 precached files and 27 distribution files.

The final gate passes **536 unit/contract tests in 57 files**, TypeScript/build and eight mission validations. The full **322-case** production browser run has **301 passes / 21 intentional skips / zero failures or flakes**. Three separately executed upgrades from the actual previous production cache fulfill three skipped cases, giving **304 verified / 18 remaining skips within the same 322 cases**; all four PWA cases pass. A repeat build reproduces all 27 distribution files byte-for-byte. The earlier six-case focused badge receipt is separate; its six cases are already included in the final full run and do not inflate the count.

The lead reports published main/feature `59bc7bdf9227af1d71865fe4e07937c92c30dd6c`, runtime `fc-ecbc0d4070f9`, Pages run `37329609504` attempt 1, 236 source and 27 distribution hashes verified. These remain attributed publication facts. This candidate is local, has not been pushed/deployed by cloud QA and must preserve the parent's additional publication document/history. No GitHub workflow, deployment, unrelated-repository change, new account/secret/service or browser security change is performed. The earlier hosted proxy denial is not retried.

## Reproduction and readable badge evidence

1. Open the published production build on a 390×844 phone viewport with an expanded Research deck. Put a dense visible friendly troop group where its summary would lie beneath the commander strip. The retained natural 423.1-second phone screenshot exhibits this overlap.
2. The new controlled presentation regression places 21 ordinary unit sprites in that screen region, retaining the actual commander/buildings. Its read-only Canvas observer records the actual painted badge rectangle. Baseline reproduction fails on desktop, portrait and landscape because the badge intersects visible controls.
3. The correction passes expanded Research, collapsed deck, collapsed minimap, rotation and 130% interface-text states in all three viewports. The badge stays inside the viewport with clearance from visible controls. The full simulation JSON remains unchanged throughout these layout states; ordinary Army/Commander selection still works without issuing commands.

The renderer receives cached rectangles measured when HUD/layout changes, rather than reading DOM geometry every paint. Controls and previous badges are hard exclusions; landmark silhouettes remain a soft preference. If no full-width location exists, the composition wraps into a narrower badge. If no readable location remains, the renderer omits that badge rather than painting over a control. Existing visible/on-screen/living troop filtering and fog privacy remain intact. Counts describe visible troops, not formations or the whole army.

Evidence includes baseline and corrected raw reports/logs, before/after screenshots and the geometry attachments under `evidence/`. The baseline three failures are expected reproduction evidence, not failures waived in the candidate gate. An intermediate harness used an ambiguous close-dialog selector; it was corrected to the exact native Done button. An intermediate landscape failure exposed the real remaining width problem and led to wrapped text. All raw runs are retained.

## Native preparation gap and implemented guidance

The old briefing named the two-relic/gold objectives and truce deadline but did not explain competing claims on allied deposits, the danger of a roaming reinforcement destination, manual ranged spacing or the Engineer's area healing. It also called the actual Arcanist rival a Wildborn envoy and could make the optional eight-troop milestone sound like a sufficient final army.

The new four-item Plan this chapter section covers early gold/timber expansion and a fixed home rally, growth beyond eight troops and a protected mixed line, Farshot plus Attack-move/Hold/manual kiting, and the Arcanist Engineer, Menders and siege. It remains accessible in the objectives dialog during battle. Its tactics are preparation advice, not a guaranteed winning script. In particular, a cavalry switch does not erase a large enemy resource advantage.

Using the **naturally earned seven-game / three-win profile**, native campaign clicks open Broken Alliance while Ironwatch remains locked. Each of the four tips can be scrolled into an unobscured visible position at 130% interface text on desktop and both phone orientations. The briefing leaves the entire game JSON frozen. Native Begin and the live objectives control expose the same guidance. Browser observations confirm Rival 2 is Arcanists/Engineer; no profile unlock, winner or resource mutation is used.

The preserved necessary retry is separately continued at **556.4 seconds**, paused, winner null and Keep 5,600/5,600. Online and then offline reload/Continue preserve the **entire browser storage state exactly**, including serialized game, profile, match/campaign identity, battle envelope and separate expedition. Match remains `battle:28b1a176-a8e6-466d-b466-0b7cfd010b4c`, profile seven games / three wins. Only the storage origin is remapped to this isolated localhost host. This is compatibility/readability evidence, not a new played victory. The native driver reports zero uncaught browser errors and retains eleven screenshots.

## Controlled counter study

`evidence/difficulty-study.mjs` imports the actual engine/content and records **13 arena comparisons, 35 damage/range/cost rows and seven full-mission comparisons**. These are explicit controlled fixtures, not earned play or fun evidence. Flat arena geometry, disabled strategic AI/fortification fire and prescribed troop positions isolate counters and orders. Canonical attacks, damage, costs and step rules remain in use. Army prices omit infrastructure and research costs; wood/population are reported separately, so near-equal gold does not mean equal total investment.

| Comparison | Gold / wood investment | Actual result |
| --- | --- | --- |
| 15 Wildborn Archers vs 10 Arcanist Swordsmen, ordinary Attack-move | 480/480 vs 470/110 | All archers lost at 11.8s; six swordsmen survive |
| Exactly the same fixture; only ranged combat auto-kiting enabled for player 0 | Same | Fourteen archers survive; all swordsmen lost at 10.7s |
| 15 Spearmen vs the same swordsmen | 480/270 vs 470/110 | All spearmen lost at 13.5s; eight swordsmen survive |
| Add two enemy Menders to the archer/swordsman fixture | 480/480 vs 626/184 | All archers lost at 9.4s; all twelve enemy troops survive |
| Same Mender fixture, Farshot two | Same troop investment; extra research excluded | All archers lost at 13.6s; four swordsmen and two Menders survive |
| Ten Archers, five Swordsmen, two Menders vs ten swordsmen/two Menders | 661/429 vs 626/184 | Friendly force lost at 13.8s; nine swordsmen/two Menders survive |
| Same mixed fixture, only Farshot two added | Same troop investment; extra research excluded | Ten archers and one Mender survive at 14.6s; enemy force lost |
| Twenty Archers, three Spearmen, two Menders vs thirty Swordsmen, three Menders, three siege | 872/758 vs 2,064/735 | Capture/Attack-move/Hold all lose at 6.1/6.6/8.4s, respectively |

The auto-kiting comparison sets player 0's `ai` flag and puts its strategic `aiNextThink` beyond the experiment; the only active behavioral difference is the engine's ranged retreat branch. Normal AI retreats between shots near melee targets; human-controlled troops do not. It is a reproducible, consequential control asymmetry worth a product decision, especially with mobile whole-army selection. It is not a shared-economy rule discrepancy. The chapter guidance describes manual short Move then Hold because ordinary moving player troops do not fire.

The large-column enemy army costs **2.37 times as much gold**. Repeated canonical Ranger Trap with Hold eliminates its infantry/healers in this fixture but leaves three siege and loses all friendly field troops at 81.2s. A similar-gold cavalry variant, with scripted siege/healer priority attacks, also loses: 7.9s without Trap and 12.1s with it. Those results do not support promising that a small cavalry flank solves the observed larger army.

Canonical content explains further pressure: an Arcanist Mender heals 20 HP every 1.5s versus 16 for other factions. Engineer Field Repair restores 110 HP to **each** nearby friendly troop within seven tiles, or 260 to buildings, on a 20-second cooldown. The arena comparisons exclude the Engineer; the mission variants include it. Capture's normal target search is capped at five tiles, while Archer vision is nine and Farshot extends attack range. Advancing directly under Capture can therefore squander some upgraded spacing; Hold after clearing an approach is useful.

## Income and full-mission comparisons

The retained native opening at 0.2s gives all three players equal starting purses and **2.382 gold / 2.612 wood per second**, one active deposit of each kind and no resource/health modifiers. At 134.5s, player 0 has earned 424.90 gold and holds one active gold/two wood deposits; Rival 2 has earned 1,229.19 and holds five of each. Allied claims cannot be recaptured during the truce. At the preserved 556.4s, player 0 has earned 1,841.63 gold versus Rival 2's 6,805.42. Player 0 owns two gold/two wood nodes but only one of each is still productive; Rival 2 owns four of each with four gold/three wood productive. The rival has 36 living troops, including three siege and three Menders; player 0 has none after 37 losses. These are territorial/depletion facts from earned saves, not fixture-generated income.

All-AI mission comparisons use the authored `ALLIANCE-03` seed and canonical victory predicates, ending at a terminal or 600s. Player 0's strategic AI is enabled solely for these diagnostic runs. No owned save/profile or unlock is changed.

| Mission diagnostic | Result |
| --- | --- |
| Authored mission, repeated twice | Required-objective win at 442.8s both times; entire final serialized-state SHA256 identical |
| Only the truce begin/end triggers removed | Required-objective win at 310.6s |
| Only player 0 commander changed to Engineer | Unfinished at 600s |
| Only player 0 faction changed to Arcanists | Unfinished at 600s |
| Player 0 changed to Arcanists and Engineer | Required-objective win at 188.2s |
| Only home 0/2 spawns and initial resource ownership swapped, same terrain | Required-objective win at 180.0s |

These outcomes show that the mission can finish under the existing rules and that spawn/territory, truce and faction/hero combinations affect this seed. Two identical runs test reproducibility, not a multi-seed balance sample. Changing only the commander or only the faction does not independently fix the diagnostic. The evidence supports clearer preparation and a review of control parity/start-location pacing before an indiscriminate enemy-health/income nerf.

The first study's milestone records retained mutable references to player stats, contaminating those historical snapshots with later values. The raw report/log remain retained and are not used for milestone conclusions. The final script snapshots through `structuredClone`; its corrected complete report supplies the tables above. A replay using the final source and byte-preserved portable native inputs reproduces every arena and mission result; only CPU wall-time measurements and input path names differ. This is a corrected diagnostic harness issue, not a production simulation error.

## Remaining work

The earned first attempt ended naturally at 729.3s and is still recorded once; the necessary retry remains preserved rather than replaced by another identical coached push. See [EARNED_ALLIANCE_TERMINAL_QA_20261005.md](EARNED_ALLIANCE_TERMINAL_QA_20261005.md). Full natural campaigns and a successful four-battle expedition remain unverified. So do uncoached comprehension/enjoyment, broader faction/seed/difficulty balance, physical iPhone/Safari, installed-device lifecycle/performance, subjective soundtrack listening and exact hosted browser play. No sound output device is present. No fun or commercial-readiness verdict follows from the automated gates or controlled wins.

The next gameplay decision is whether to offer shared automatic ranged spacing or keep manual micro with clearer controls, followed by multi-seed testing of the truce economy/start locations. Those are lead-owned simulation/product changes. This batch adds the verified badge correction, specific guidance and the six previously pending documentation updates together; the earlier frozen Library artifacts remain immutable.
