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

The deterministic engine, mobile/desktop interface, isometric renderer, seeded skirmishes, data-driven story missions, three-battle expedition, map workshop, save system, original adaptive music and event audio, and scoped PWA cache are implemented. Build/typecheck and the current unit/contract suite pass, including 400 generated maps and natural siege-victory regressions. The final tested release passed 101 browser cases (plus 7 input-specific skips) and 226 local tests, with actual full-match wins/losses, offline/update checks and independent combat/touch review. Exact source and test provenance are recorded in docs/QA.md; this is still a testing preview.

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
- Save and continue on the same device. App updates require an explicit restart.

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
