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

## Current checkpoint

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
