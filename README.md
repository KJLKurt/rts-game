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

The deterministic engine, mobile/desktop interface, renderer, seeded skirmishes, authored campaigns, expedition, map workshop, saves, audio and scoped PWA cache are implemented. The isolated usability candidate identifies itself as **Build `fc-7f2be308bbca`** in the menu footer and Credits / About. It passes **519 unit/contract tests in 55 files**, TypeScript checks and the production build. A fresh focused browser run covers **109 cases: 102 passed, seven intentional skips, zero failures/flakes**; the separate actual previous-cache upgrade adds **one passing case**, for **110 scoped cases / 103 passed / seven skipped**. This focused run does not replace the prior full-suite receipt. Runtime `index-eiI64Ww3.js` / `index-BmuM_yap.css`; worker cache `35e0f9b54183`; 24 precached files; base `/rts-game/`. A repeat build produced identical bytes in all 26 output files. See [USABILITY_RELEASE_QA.md](docs/USABILITY_RELEASE_QA.md).

The published clarity checkpoint `779745debf48ea9f18f93a5874e92cf4d8a5355a` had 516 unit tests in 54 files and a full 262-case browser run: 244 passed, 18 intentional skips, zero failures/flakes. Its runtime was `index-DJ5oCh_8.js` / `index-BLaajxx7.css`, worker cache `c8affbd450ca`. That remains prior-source evidence, not a new full run of this candidate.

Native desktop input earned the prior checkpoint’s Outpost win at 43.8 game seconds. Further actual-input play on the published clarity checkpoint ended a Balanced expedition in first-battle defeat at **408.4 game seconds (6:48)**, saved the result once and opened its defeated route with 0/4 victories. Quick-, Standard- and Epic-derived skirmish openings were played with real UI input and saved unfinished; their exact bounded observations are in [NATIVE_PLAY_20261005.md](docs/NATIVE_PLAY_20261005.md). No successful four-battle route, guaranteed match duration or subjective fun verdict is claimed. All 15 simulation source files remain unchanged in this usability pass.

Local sandbox-enabled Linux Chromium and emulated phone touch were tested. Hosted HTTPS access was denied by this cloud environment before assets loaded (proxy 403 / browser ERR_TUNNEL_CONNECTION_FAILED); hosted gameplay, asset matching and cache lifecycle therefore remain unverified here. The owner separately confirmed the updated public UI was visible, which is not a full playtest. Physical Safari/devices, installed-device lifecycle/performance, full later natural routes, broad balance, soundtrack listening and commercial asset rights remain open. No GitHub workflow or deployment was run for this QA pass.

The initial implementation is being actively playtested and expanded. A minimal GitHub Pages workflow is enabled for final-stage testing. It runs only for game/build changes on main, or a manual dispatch. Documentation-only checkpoints do not consume deployment runs. Complete-match loops are verified; broader device and difficulty coverage remains ongoing.

The Rush Arena side mode is a complete four-minute commander survival loop with waves, field upgrades, supplies, shrinking territory, and telegraphed hazards.

## Controls

- Tap a friendly unit to select; tap ground to move, an enemy to attack, or a resource to capture.
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
