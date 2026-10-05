# Allied ability targeting, earned route and pacing QA

5 October 2026. Candidate **`fc-10d287331fd1`**, based on the supplied frozen `fc-3c40d8eec6cf` source. The parent subsequently confirmed publication of that base as `59a5c2d78bcbcae173812c15b9b032bfa3bf2e1a`. Runtime `index-BlQ4ObkR.js`, CSS `index-CH0dYD5l.css`, worker cache `728b201bd90f`, 24 precached files, 26 output files, base `/rts-game/`.

## Fixed functional problem

In an allied match, the touch ability helper considered every other team a threat. A closer allied troop could receive the Charge or Thorn Trap destination, direct Runic Turret placement, or make Windstep evade the ally while moving toward an actual enemy. The engine already protected allies from damage; the UI nevertheless wasted the intended direction or target.

The helper now uses the existing `areHostile` relationship. This respects alliances, closed slots, peaceful practice and hostile neutral defenders. Damage, training, income, ability effects, cooldowns and AI are unchanged. **All 15 simulation files are byte-identical to the supplied base.** This is a targeting correction, not a balance adjustment.

The browser reproduction places an allied troop 1.5 tiles west of the commander and a visible hostile five tiles east, pauses normally, then clicks the real ability button. On the published base all five desktop cases fail their destination assertions. Charge selects the ally at x=8 instead of the hostile at x=14.5; Windstep moves east toward the enemy instead of west away from it. The other cases cover Thorn Trap, Runic Turret and a fog-hidden hostile with an ally present. These are explicitly controlled allegiance fixtures, separate from natural play.

The corrected five cases pass at 1440×900 desktop, 390×844 touch portrait and 844×390 touch landscape: **15/15**. Three additional unit contracts cover allegiance, fallback and hostile neutral defenders. The first focused candidate run passed all target assertions but reported three failures in a final auxiliary pause-button assertion: its locator matched two legitimate buttons. The locator was narrowed with `.first()` and all 15 cases passed. Both raw runs are retained.

## Exact candidate gate

- **536 unit tests / 57 files**, all passing; TypeScript and the production build pass; eight story missions validate.
- Full production suite: **319 cases / 298 passed / 21 intentional skips / zero failures or flakes**. The separate real-cache upgrade fulfills three skipped cases, giving **301 passed / 18 remaining skips across 319 distinct cases**. The 15 focused ability cases are included in this total, not added again. All four PWA cases pass.
- An actual previous-worker upgrade from `index-BgCslPTG.js` to this candidate passes separately in all three viewports. It preserves three paid Swordsman jobs, the pending House, funds, clock, population and profile; only one owned new cache remains after consent and reload.
- The legitimately earned paused expedition save below resumes through ordinary Continue on the candidate. Its entire serialized game state equals the saved JSON, including players, entities, map, fog, command log, clock, settings and pending orders. The profile remains one game/one win; the expedition remains one victory, 80 crowns and +80 gold/+80 wood. No runtime browser errors occur.
- A repeat production build produces identical bytes in all 26 output files. The source patch also reproduces the complete candidate snapshot when applied to an isolated copy of the supplied base.

The full-suite runner uses sandbox-enabled Linux Chromium on an isolated local port. Initial runner configuration encountered an already occupied default port before any tests ran; the existing process was left alone and a single-server configuration used a fresh port. Those startup logs are retained. No GitHub Actions, hosted-proxy retries, pushes or deployments were performed by this cloud task.

## Earned phone expedition

This actual-input run uses the published base `fc-3c40d8eec6cf`, not a manufactured victory fixture. It continues the previously owned **195.5-second** paused Foothold save for seed `FRONTIER-533506`, Ironhold/Warlord, Founder's banner. Only the saved browser origin's local port is remapped; no game, profile or expedition values are edited. The owned starting save has no earlier profile, so its recorded history begins at zero games/zero wins.

The player captures the third relic, recruits a mixed army and healers, changes producer rally points, uses explicit orders and defends the objectives through repeated rival attacks. The natural result is **Relic domination at 550.1 game seconds (9:10)**, 640 points, **107 kills and 10 captures**. Raw counters are 38 units created, 38 units lost and two commander deaths. Those raw creation/loss counters are not asserted to be unique infantry deaths; commander losses also contribute to the loss counter.

After the result commit completes, the run has one of four victories, 130 crowns and a journal entry for the earned Foothold win. The profile has exactly one game, one win and one history entry. The player visits the Caravan and spends 50 earned crowns on its supply contract. The run now has **80 crowns and recurring +80 gold/+80 wood**, with an earned journal recording the battle and choice. Native Save route and reload preserve the entire expedition and profile exactly.

Whisperwood opens as a Normal forest Domination battle, 42×42, one adaptive rival, a 60 population ceiling and a 12-minute target/960 points. The human actually starts with **310 gold and 340 wood**. The recorded settings specify zero starting-resource bonuses for the rival. This verifies reward application without treating a factory-created run as earned progression.

Two later-encounter attempts remain **unfinished**. The first is preserved at 262.3 seconds after failed early expansion. The second restores the legitimately earned supply-contract checkpoint and uses a safer rally behind the Keep. At 279.8 seconds it has six archers, four spearmen, two menders and a full-health commander, but the subsequent northern push suffers repeated Ranger traps and concentrated fire. The player then captures the northern relic with the respawned commander via a separate flank.

The final continuation is paused at **372.5 seconds**: the commander has 713/713 health; the Keep has 6063.1/6720; the north relic belongs to the human; the run is still the same active Whisperwood encounter with its earned bonuses and journal. The exact saved clock, player, nodes, living owned entities and pending orders match the native observation. The independent expedition record retains the same journal and active encounter. The new candidate's ordinary Continue additionally reproduces the complete serialized game state exactly.

No later encounter victory or complete four-battle expedition is claimed. The first later attempt is not silently combined with the second. Six recovered driver errors remain in the raw evidence: an unavailable building locator, a disabled Rally button, an incorrect briefing locator and three requested construction sites rejected by canonical placement rules. There are zero runtime/page errors in this native run. Record-name numbers were planning labels; each observation's actual `time` is authoritative.

## Longer match pacing

Fresh deterministic samples use the unchanged simulation source. They terminate through normal Relic domination and are explicitly **headless AI simulation evidence**, excluding rendering, input, physical-device performance and subjective fun.

| Configuration | Policy | Target | Natural finish | Winner |
|---|---|---:|---:|---:|
| Epic, 120×120, four players, ceiling 150 each | Aggressive | 40 min | 44.89 min | 2 |
| Epic, same settings | Defensive | 40 min | 43.29 min | 0 |
| Epic, same settings | Economic | 40 min | 43.10 min | 2 |
| Custom, 160×160, six players, ceiling 100 each | Economic | 90 min | 79.28 min | 3 |

The longer custom sample is a fresh repeat of the documented deterministic configuration, not a new balance policy. Duration is a target, not a guarantee. The six-player ceiling is 600 total; observed populations and headless timing do not certify smooth phone play. The custom run's 155.24-second measured process duration overlapped browser work and is not presented as a CPU optimization comparison.

## Remaining acceptance and delivery boundaries

The original requirements audit and current code identify earned later campaign/expedition success, complete natural routes, ordinary fully played long matches, novice understanding, broad balance, physical Safari/installed-device lifecycle and performance, subjective audio review, full supplemental theme/directional-art commitments and asset distribution rights as still open. This evidence does not close them. The allied targeting fix removes a reproducible functional error from larger team matches; the Normal route's difficulty still needs successful natural play and human feedback.

The source snapshot starts from the supplied 230-file base and adds this note plus the new browser specification. Apply the four-path patch to current main and preserve any parent-added publication documentation. The immutable source/dist/evidence handoff contains checksums, original expected-defect failures, corrected focused results, full-suite receipts, cache upgrades, actual native inputs/screenshots, owned continuation saves and pacing samples. The parent owns publication; this cloud task does not modify the unrelated saved workspace repository.
