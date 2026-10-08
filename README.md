> **Current testing preview: fc-5dd3992fdd55 (8 October 2026).** Adds an explicit confirmed Surrender battle action, labelled defeat and safe retry/recovery, without new rewards. Local type/content/build checks and 769 unit tests pass. A 32-case native result/PWA gate passed, followed by eight passing affected checks after landscape pixel review. See [surrender and campaign evidence](docs/SURRENDER_BATTLE_20261008.md). The full unfiltered browser collection is 557 identities and has not been rerun as a single final-build matrix. [Earlier queued-building evidence](docs/QUEUED_CONSTRUCTION_20261008.md) is retained. Wider campaign, art, physical-device performance and subjective usability scope remains open.

### Initial restored-preview notice (historical, superseded)

> **Current testing candidate: fc-194c08936126 (8 October 2026).** The newer phone interface and material pass are deployed for hosted browser QA. Type/build and 588 unit tests pass; browser acceptance remains pending, including the documented native-touch fixture issue. See [current testing status](docs/TESTING_PREVIEW_20261008.md). The prior published checkpoint and its evidence remain below as history.

# Frontier Command

A mobile-first, offline-capable fantasy RTS. Lead a commander directly, capture finite resource deposits, recruit a combined-arms army, and contest a central relic.

[Play Frontier Command](https://kjlkurt.github.io/rts-game/) · Start with Rush Arena for a four-minute match.

## Development

```sh
npm ci
npm run dev -- --host 127.0.0.1
npm run check
npm test -- --pool=forks --maxWorkers=1
npm run build
npm run preview -- --host 127.0.0.1
```

Open `/rts-game/` on the development or preview server. Production paths target `https://kjlkurt.github.io/rts-game/`.

## Earlier frozen Focus checkpoint (historical)

Build **`fc-0f1a6b425705`** combines the reviewed Mythic Archer, Spearman and Cavalry packs with corrected troop visibility, sprite-body and ground-marker selection, lower-quality overlay caching, and explicit Focus framing outside HUD controls. Focus retains enlarged zoom when the commander and health bar fit; short landscape layouts can minimize the panel and reduce zoom. All fifteen simulation files, campaign rules, costs and audio remain unchanged. Later campaign work and UI redesign are outside this frozen checkpoint.

The final production candidate passed **588 unit tests**, TypeScript/build, eight mission validations and an exact 40-file repeat build. Its **418-case browser gate completed in one invocation: 400 passed, 18 unchanged intentional skips, zero failures, retries, reruns or flaky cases**, with exit code zero. All 412 prior identities remain; six framing cases were added. Four PWA tests and three upgrades from published Swordsman passed. All 283 frozen worker-source files and 40 build files remained exact; publication preserves the additional earlier recovery document and release-history edits.

Three earned-save continuations each produced eight new Ranger damage hits with active enemy AI and exact whole-game, storage and profile restoration online/offline. These samples do not establish a newly earned win or uncoached fun. Historical evidence remains intact: the first visibility candidate had three ground-marker failures; the corrected version passed separately; the optimized-renderer gate required three skipped upgrade cases to be completed after a runner flag was supplied. The final 418-case result belongs to this exact combined Focus build. The early focused PNG-retention mistake remains documented; final framing screenshots are preserved.

Runtime `index-C1T2QmHm.js`, CSS `index-BWAZawEF.css`, cache `bbbcd65d8a1a`; 40 build files. See [Focus and live-combat QA](docs/LIVE_COMBAT_CAMERA_QA_20261006.md), [combined requirements audit](docs/COMBINED_REQUIREMENTS_AUDIT_20261006.md) and [renderer performance QA](docs/DENSE_OVERLAY_CACHE_QA_20261006.md).

The separate paired renderer experiment measured 600-unit median rendering-CPU reductions of 22.6% desktop, 38.1% portrait and 34.8% landscape. Those paused fixtures are not physical-phone FPS or live-combat speed proof; dense phone-width rendering still cost about 30–32 ms. Five complete Mythic actors cover 720/1296 directional frames; four actor packs and other requested content remain unfinished. Asset memory, physical-device/Safari and installed-PWA behavior, subjective listening, the original requirements audit and full usability/fun acceptance remain open. Fresh dependency installation in the QA environment was blocked by a registry proxy and an empty package cache; existing locked dependencies supported the recorded tests. Publication CI performs its own installation and build.

## Prior Swordsman release receipt

The following describes the preceding Swordsman build and its own test evidence.

Build **`fc-4d0b2bae4d0c`** adds a separate 144-frame Mythic Swordsman atlas, with sixteen headings and idle, four walk and four attack phases. Both actor textures load together before switching themes; a failed load retains the complete working set. Ranger assets, all fifteen simulation files, unit definitions, campaign rules and audio remain unchanged. About correctly describes Ranger and Swordsman coverage. **573 unit tests in 61 files**, TypeScript/build, eight mission validations and 34 repeat-build outputs are verified. The current complete browser gate passed **340 cases with 18 intentional input-mode skips across 358 distinct identities**, in one invocation with **zero failures, automatic retries or manual reruns**. It retains all 352 prior identities and adds exactly six Swordsman cases. The full gate includes all four PWA cases and three real Ranger-to-Swordsman cache upgrades. All 260 frozen worker-source hashes and 34 dist hashes remained exact. Earlier focused bootstrap failures and art-driver corrections remain separate historical evidence; the clean full gate does not erase them. The separate bootstrap robustness patch and next-actor experiments are excluded.

Runtime `index-PchgsAwL.js`, CSS `index-CtTVqhIs.css`, cache `77c82bef9b34`; 32 precached files and 34 repeat-build outputs. Art/combat evidence was collected on `fc-3e87188cade6`; the final candidate preserves its renderer/assets and changes only About text and one blank line. Its 48 native combat fixtures and three natural campaign continuations remain attributed to that art-stage build. The 352 observed natural Swordsman events came from teams 1 and 2; human-team natural melee coverage and a new terminal win are not established. Whole saved state/profile remained intact online/offline. The Swordsman texture decodes to 18.8125 MiB and the two directional textures total 49.4375 MiB; physical-device performance remains unverified. Seven actor sets and known picking/occlusion issues remain open. See [SWORDSMAN_ANIMATION_QA_20261005.md](docs/SWORDSMAN_ANIMATION_QA_20261005.md).

## Prior Ranger release receipt

The following is the preceding released Ranger build and its own regression gate.

Build **`fc-5106dd6e9270`** adds four authored Mythic Ranger attack phases across sixteen headings. The 144-frame atlas preserves all 80 prior idle/walk crops and adds 64 unique attacks without resampling or mirroring. Existing projectile events and cooldowns drive the animation; gameplay and renderer source are unchanged. **568 unit tests in 60 files**, TypeScript/build and eight mission validations pass. The current complete browser gate reconciles **334 passes and 18 intentional skips across the same 352 case identities**, with zero unresolved cases. Its first full invocation recorded **331 passes, 18 skips and three failed cache-upgrade setups** because the owned QA host lacked its previous-build directory; those failures happened before gameplay. Correcting only that host configuration and rerunning the same three cases once yielded three passes, with automatic retries disabled. The raw failures and rerun remain preserved; this is not a single clean full invocation. All 255 frozen worker-source hashes and 32 dist hashes remained exact. The separate 48 native-input combat fixtures and 192 Canvas excerpts supply attack-specific evidence; they are not added to the 352-case total.

Runtime `index-BwfnWx6D.js`, CSS `index-CtTVqhIs.css`, offline cache `237e248a87d0`; 30 precached files and 32 repeat-build outputs. Three natural continuations of the same earned campaign produce 13 real Ranger shots per view with enemy AI active; whole game/storage and the eight-game/three-win profile survive online/offline reload. These continuations establish no new terminal win or novice-fun result. The atlas uses 30.625 MiB decoded, a measured asset budget rather than physical-device performance proof. Existing resource captions and team crests can still obscure parts of the actor. See [RANGER_ATTACK_QA_20261005.md](docs/RANGER_ATTACK_QA_20261005.md).

## Prior combined visual and deposit receipt

The following receipt describes the preceding published build and its separate reconciled test gate.

The current checkpoint is **Build `fc-716214f4a418`**. Settings offers complete Christmas and Mythic artwork sets. Mythic adds 36 static roles and 80 accepted Ranger idle/walk frames across sixteen authored headings; 64 rejected attack cells are excluded. Tall deposits fade when their opaque pixels cover a friendly commander or selected troop, keeping captions, ownership and picking intact. All fifteen simulation files, campaign rules and existing assets are byte-identical to the preceding stance release.

The integrated candidate is **Build `fc-716214f4a418`**. The complete gate reconciles **334 passing cases and 18 intentional input-mode skips across the same 352 original case identities**, with zero unresolved cases. The first full invocation recorded **330 passes, 18 intentional skips, one landscape lesson failure and three dependency-blocked upgrades**. A test-only correction selects visible opaque House artwork through the real picker before actual input; all three eight-lesson views then pass with every lesson and named Outpost assertion retained. Three actual prior-production-cache upgrades pass separately and replace the blocked identities. All four PWA cases pass. This is a reconciled gate, not a clean first-run claim. Runtime/assets are unchanged; **564 unit/contract tests in 60 files**, TypeScript/build and eight mission validations remain verified. Earlier failed reports and corrected checks are retained separately. See [DEPOSIT_READABILITY_QA_20261005.md](docs/DEPOSIT_READABILITY_QA_20261005.md) for the focused and final receipts, and [VISUAL_CONTENT_QA_20261005.md](docs/VISUAL_CONTENT_QA_20261005.md) for the prior visual build. Runtime `index-DxH8uJ7G.js`, CSS `index-CtTVqhIs.css`, cache `88a7ecdba8bc`; 30 precached files, 32 dist files.

The earned profile remains eight games/three wins. Native normal Broken Alliance play demonstrates the updated artwork and readable mine overlap; it does not establish a new chapter win or broad balance. Other visual families/styles, other directional actors and attacks, subjective audio, physical-device performance, full natural routes and novice enjoyment remain open.

## Prior stance checkpoint receipt

The following receipt describes the published stance build and its own test gate.

The current checkpoint is **Build `fc-f640a7afaf56`**. **Orders → Keep distance** enables shared player/AI ranged spacing for current and future ranged troops. The battle-wide choice defaults to off for human players and persists through saves, including a queued toggle while paused. Move, Hold and direct commander control take priority. Short retreats stay within nine tiles of enemy contact; Guard/Capture leashes remain intact. Combat statistics, costs, income, campaign rules and public assets are unchanged. The simulation change is confined to `engine.ts` and `types.ts`; the other thirteen simulation files are byte-identical.

**548 unit/contract tests in 58 files**, TypeScript/build and eight mission validations pass. The full **331-case** browser run records **310 passes, 21 intentional skips and zero final failures/flakes**; three actual previous-cache upgrades fulfill three skips, yielding **313 distinct passes and 18 remaining skips across the same 331 cases**. All four PWA cases and nine new stance cases pass. Runtime `index-Km_qtfl8.js`, CSS `index-CtTVqhIs.css`, worker `09c141f63351`; 25 precached files, 27 dist files. [RANGED_SPACING_QA_20261005.md](docs/RANGED_SPACING_QA_20261005.md) retains the earlier fixture, save-driver and landscape-layout failures and their corrections.

The earned Broken Alliance retry remains unfinished at 556.4 seconds with seven games/three wins. Entire saved storage matches online/offline before and after the single native queued opt-in. A controlled fifteen-archer/ten-swordsman fixture produces the same fourteen archer survivors for the player stance and AI spacing. That fixture establishes access to the shared mechanic; it does not establish a new natural win, broad balance or novice enjoyment.

## Prior badge checkpoint receipt

The following receipt describes the preceding badge build and its separate diagnostic work.

The current checkpoint is **Build `fc-9ad03334aff3`**. Dense troop badges avoid visible HUD controls and wrap in short landscape. Broken Alliance offers preparation/combat guidance in its briefing and live objectives. All 15 simulation files and campaign settings, triggers, objective predicates, rewards and unlocks remain unchanged. **536 unit tests in 57 files**, TypeScript/build and eight mission validations pass. The full **322-case** browser run records **301 passes, 21 intentional skips and zero failures/flakes**; three actual previous-cache upgrades fulfill three skips, yielding **304 distinct passes and 18 remaining skips across the same 322 cases**. All four PWA cases pass. Runtime `index-CIPt5Qwh.js`, CSS `index-C9pWTGt4.css`, worker `f55d6fa99347`; 25 precached files, 27 dist files. See [TROOP_BADGE_DIFFICULTY_QA_20261005.md](docs/TROOP_BADGE_DIFFICULTY_QA_20261005.md).

The earlier Broken Alliance attempt ended at 729.3 seconds and is recorded once. Its separate earned retry stays unfinished at 556.4 seconds; complete online/offline storage equality preserves the seven-game/three-win profile. Controlled counter/mission studies are explicitly diagnostic: enabling only canonical combat auto-kiting changes the same 15-archer/10-swordsman fixture from an archer loss to 14 archers surviving. That is not a newly earned win, broad balance proof or a deployed simulation change.

## Prior content checkpoint receipt

The following receipt describes the preceding content build, not a fresh run
of this candidate.

The current content checkpoint is **Build `fc-ecbc0d4070f9`**: it corrects Ironwatch’s Barracks → Blacksmith → Workshop instruction and ships Vite’s MIT notice in the offline cache. The previous alliance runtime is `fc-10d287331fd1`; its receipts below remain historical. [ASSET_AUDIO_CONTENT_AUDIT_20261005.md](docs/ASSET_AUDIO_CONTENT_AUDIT_20261005.md) records the exact supplied-art provenance, all six scores and the content inventory. Continued earned Broken Alliance is saved/reloaded unfinished at 465.8 seconds with two of three objectives; no later unlock or full-route victory is claimed. The candidate passes **536 unit/contract tests in 57 files**, TypeScript and the production build with eight validated missions. Its full **319-case** desktop/portrait/landscape/PWA run has **298 passes, 21 intentional skips, zero failures/flakes**; three separately executed upgrades from the actual published cache fulfill three skips, giving **301 verified cases / 18 remaining skips within the same 319 cases**. All four PWA cases pass. Candidate runtime `index-DOFdeVPS.js` / `index-CH0dYD5l.css`; cache `410dfd12508c`; 25 precached files; 27 byte-identical repeat-build outputs; `/rts-game/` base. Three native Ironwatch before/after candidate views, complete owned-save equality online/offline and real WebAudio signal checks provide separate bounded evidence, without inflating the suite count.

## Previous alliance checkpoint

The published alliance-targeting checkpoint is **Build `fc-10d287331fd1`**. It passes **536 unit/contract tests in 57 files**, TypeScript and the production build; all eight story missions validate. The full production browser suite has **319 distinct cases: 298 passed, 21 intentional skips, zero failures or flakes**. Three separately executed previous-cache upgrades fulfill three skipped cases, giving **301 passed / 18 remaining skips across the same 319 cases**; the 15 focused ability cases are already included. All four PWA cases pass. Runtime `index-BlQ4ObkR.js` / `index-CH0dYD5l.css`; worker cache `728b201bd90f`; 24 precached files; 26 byte-identical repeat-build outputs; `/rts-game/` base. See [ALLY_ABILITY_NATURAL_ROUTE_QA_20261005.md](docs/ALLY_ABILITY_NATURAL_ROUTE_QA_20261005.md) for the exact test, update and earned-route evidence. Earlier guidance/usability reports remain dated prior-build history.

The published clarity checkpoint `779745debf48ea9f18f93a5874e92cf4d8a5355a` had 516 unit tests in 54 files and a full 262-case browser run: 244 passed, 18 intentional skips, zero failures/flakes. Its runtime was `index-DJ5oCh_8.js` / `index-BLaajxx7.css`, worker cache `c8affbd450ca`. That remains prior-source evidence, not a new full run of this candidate.

Actual phone input earned the earlier Foothold expedition win at **550.1 seconds**, bought the Caravan supply contract, and continued Whisperwood to a genuine Keep defeat at **565.4 seconds**. On this exact runtime it then earned Outpost at **42.7 seconds** and Hold the Line at **360.0 seconds** after two failed retries. The saved profile is six games/three wins; reload preserves both chapter completions, the Forager charter and playable Broken Alliance. The earned charter starts and reloads a distinct new expedition through native controls. See [NATURAL_ROUTE_RESULT_CAMPAIGN_QA_20261005.md](docs/NATURAL_ROUTE_RESULT_CAMPAIGN_QA_20261005.md). No successful four-battle route, broad balance or subjective fun verdict is claimed. All 15 simulation source files remain unchanged. Earlier actual gameplay remains dated history in [NATIVE_PLAY_20261005.md](docs/NATIVE_PLAY_20261005.md).



Local sandbox-enabled Linux Chromium and emulated phone touch were tested. Hosted HTTPS access was denied by this cloud environment before assets loaded (proxy 403 / browser ERR_TUNNEL_CONNECTION_FAILED); hosted gameplay, asset matching and cache lifecycle therefore remain unverified here. The lead reports published commit `4643ba69cab0b2c8992b48c7e2f31096188f1ab5`, successful Pages run `37311208194` attempt 1 and 233 remote source hashes; these publication checks do not establish hosted gameplay. Physical Safari/devices, installed-device lifecycle/performance, full later natural routes, broad balance, soundtrack listening and commercial asset rights remain open. No GitHub workflow or deployment was run for this QA pass.

The initial implementation is being actively playtested and expanded. A minimal GitHub Pages workflow is enabled for final-stage testing. It runs only for game/build changes on main, or a manual dispatch. Documentation-only checkpoints do not consume deployment runs. Complete-match loops are verified; broader device and difficulty coverage remains ongoing.

The Rush Arena side mode is a complete four-minute commander survival loop with waves, field upgrades, supplies, shrinking territory, and telegraphed hazards.

## Earlier publication observations

These paragraphs retain the earlier checkpoints before the natural continuation
reported above. Their unfinished encounters and test scopes are historical.

The current checkpoint is **Build `fc-10d287331fd1`**. Touch Charge, Thorn Trap, Windstep and Runic Turret now use the existing hostility relationship rather than treating allied teams as threats. All 15 simulation files remain unchanged. **536 unit tests in 57 files**, TypeScript and build checks pass. The full production browser run recorded **298 passed, 21 intentional skips and zero failures/flakes across 319 cases**; three actual previous-cache upgrades fulfill three skips, yielding **301 distinct passes and 18 remaining skips**. Runtime `index-BlQ4ObkR.js`, CSS `index-CH0dYD5l.css`, worker cache `728b201bd90f`; 24 precache entries under `/rts-game/`. See [ALLY_ABILITY_NATURAL_ROUTE_QA_20261005.md](docs/ALLY_ABILITY_NATURAL_ROUTE_QA_20261005.md).

Earlier Practice-recovery native phone input ended an owned Normal battle in Keep defeat at **398.2 seconds (6:38)**, then completed fresh Practice with exactly two neighboring Houses. Practice completed at 142.8 seconds; the later paused checkpoint saved and reloaded at **143.4 seconds**, with profile preserved. No new Outpost win or broad balance verdict is claimed.

Earned phone play on the previous published build won Foothold at **550.1 seconds (9:10)** and spent earned Caravan crowns on recurring +80 gold/+80 wood. Ordinary Continue on this candidate preserves the full owned game state and the one-win route. A further current-build Whisperwood attempt remains unfinished at 279.8 seconds; no later victory or complete expedition is claimed.

Native input on the frozen usability release completed a Standard-derived battle in defeat at **14:23**, verified same-seed retry and exact reload, and saved an improved actual Easy expedition opening unfinished at **3:15**. On this candidate, the earned expedition defeat opened Practice, reached lesson 3/8 and reloaded at exactly 19.2 seconds; a Normal replica continued with native orders/recruiting and reloaded exactly at 3:21. No successful four-battle route, broad balance or subjective fun verdict is claimed. All 15 simulation source files remain unchanged. Earlier actual gameplay remains documented in [NATIVE_PLAY_20261005.md](docs/NATIVE_PLAY_20261005.md).

Local sandbox-enabled Linux Chromium and emulated phone touch were tested. Hosted HTTPS access was denied by this cloud environment before assets loaded (proxy 403 / browser ERR_TUNNEL_CONNECTION_FAILED); hosted gameplay, asset matching and cache lifecycle therefore remain unverified here. The owner separately confirmed the updated public UI was visible, which is not a full playtest. Physical Safari/devices, installed-device lifecycle/performance, full later natural routes, broad balance, soundtrack listening and commercial asset rights remain open. No GitHub workflow or deployment was run for this QA pass.

## Controls

- Tap a friendly unit to select; tap ground to move, an enemy to attack, or a resource to capture.
- Orders → Move or Attack-move makes the next map tap a destination, including over a friendly sprite. Cancel returns to contextual selection.
- Drag the battlefield to pan; pinch or scroll to zoom.
- Phone thumbstick and desktop WASD directly move the commander.
- Q / E: commander abilities. Space: tactical pause. 1: commander. 2: army.
- Charge ends the previous march at its landing point; issue a new movement or attack order afterward.
- Recruit, build, and research from the bottom command deck.
- The gold Relic button sends your army to a victory landmark; resources fund troops, while held relics earn points.
- First skirmishes open with a frozen briefing. Easy gives you a home-side opening phase. Troops guard locally, respond to actual nearby attacks, and return. Explicit Hold keeps them stationary.
- Rally current producers here fixes the destination for existing production buildings. Set a rally point for newly built producers in Details.
- Save and continue on the same device. App updates require an explicit restart.
- Read the Build ID in the menu footer or Credits / About to identify the loaded release.

See `docs/ENGINE.md` for simulation contracts and `docs/ART_DIRECTION.md` for art provenance and limitations.

## Extending the game

Campaign registration and authoring: `docs/CREATING_CAMPAIGNS.md`. Units/factions/biomes: `docs/CREATING_UNITS_AND_FACTIONS.md`. Runtime and renderer decisions: `docs/ARCHITECTURE.md`. Multiplayer boundary: `docs/MULTIPLAYER_ARCHITECTURE.md`. Offline/update lifecycle: `docs/PWA_AND_OFFLINE.md`. Honest feature scope: `docs/REQUIREMENTS_STATUS.md`.

Headless balance sweep: `npm run simulate -- --games=20 --mode=conquest --duration=8`. Optional diagnostics: add `?debug=1` and press the backtick key during a match.

## GitHub Pages deployment

The repository publishing source must be GitHub Actions. `.github/workflows/pages.yml` installs the lockfile on Node24, runs regressions, builds `/rts-game/`, uploads only `dist`, and deploys to the protected `github-pages` environment. Official actions are pinned to verified commit SHAs. Checkout credentials are not persisted; only the deployment job receives the Pages/OIDC permissions required by GitHub.

Workflow design follows [GitHub’s custom Pages workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages). Batch game changes into meaningful checkpoints to conserve runner usage.

## Browser acceptance

`.github/workflows/browser-qa.yml` runs only on the dedicated `qa-browser-check` branch or a manual dispatch. It tests the production build on desktop, portrait/landscape touch viewports, and actual offline/update lifecycles. It never deploys Pages. Lean reports and failure traces are retained for two days; videos are disabled. See `docs/QA.md` for executed results; test discovery is not a passing run. The workflow follows [Playwright's CI guidance](https://playwright.dev/docs/ci-intro).

## Audio and animation

Master, Music, Effects and mute controls are saved per device. Replaceable soundtrack files and the audio manifest are documented in `docs/AUDIO_REPLACEMENT.md`. There is no in-app audio upload. The release includes attack-only frames for three actors; locomotion and the remaining actors retain cutout-based animation. Exact presentation and reduced-motion behavior are described in `docs/RENDERING_AND_COMBAT_FEEDBACK.md`.

The lead confirms the latest docs-only baseline on main and feature is `471e5be05232a0b00e4785f7101206516e443bed`, with 234 verified remote source hashes and no additional Actions or deployment; the published runtime identity is unchanged.

