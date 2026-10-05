# Usability release receipt — 5 October 2026

The isolated usability candidate identifies itself as **Build `fc-7f2be308bbca`** in the menu footer and Credits / About. It passes **519 unit/contract tests in 55 files**, TypeScript checks and the production build. A fresh focused browser run covers **109 cases: 102 passed, seven intentional skips, zero failures/flakes**; the separate actual previous-cache upgrade adds **one passing case**, for **110 scoped cases / 103 passed / seven skipped**. This focused run does not replace the prior full-suite receipt. Runtime `index-eiI64Ww3.js` / `index-BmuM_yap.css`; worker cache `35e0f9b54183`; 24 precached files; base `/rts-game/`. A repeat build produced identical bytes in all 26 output files. See [USABILITY_RELEASE_QA.md](USABILITY_RELEASE_QA.md).

The published clarity checkpoint `779745debf48ea9f18f93a5874e92cf4d8a5355a` had 516 unit tests in 54 files and a full 262-case browser run: 244 passed, 18 intentional skips, zero failures/flakes. Its runtime was `index-DJ5oCh_8.js` / `index-BLaajxx7.css`, worker cache `c8affbd450ca`. That remains prior-source evidence, not a new full run of this candidate.

## Concrete changes and reproduction

1. At desktop 1440×900, touch portrait 390×844 and landscape 844×390, launch a skirmish, pause, expand Recruit, select batch three and recruit Swordsmen. Keep the production list open and select Army. The prior checkpoint intercepts western minimap targets in all three views: the growing deck on desktop, pause ribbon in portrait, and right-side controls/deck in landscape. Its three-case before run fails the actual hit check. This candidate passes all six sampled map positions and an actual western tap pans the camera while retaining Army selection. Desktop reserves measured deck height; portrait positions the ribbon below measured map height; landscape gives map and thumbstick separate space in the left column.
2. Open Orders and read **Rally current producers here**. Help and confirmation explain that new producers need their own rally point. Tactical pause queues one rally command for each existing building. Construct a Range later with native preview/confirm/resume: its default destination stays the commander’s position at production completion. No rally mechanics changed.
3. Read **Build fc-7f2be308bbca** in the footer and Credits / About. The ID hashes sorted shipped source/assets and build inputs, including the lockfile and Vite/worker configuration. It is independent of Git, checkout path, time and documentation/test output. It identifies content, not a Git revision or semantic version. Save/leave, reload and Continue preserve the exact battle seed/time and the ID. Footer text is at least 11 CSS pixels and stays within the tested viewport.

## Executed gate

- `npm run check`: passed.
- `npm test -- --reporter=json`: 519 tests in 55 files, all passed.
- `npm run build`: passed, including eight authored mission validations and scoped PWA generation. A second build matches all 26 output files byte for byte.
- Fresh scoped Playwright run: 109 cases, 102 passed, seven intentional input/layout skips, zero failures/flakes. It covers release usability, live held-control identity, HUD collisions, all eight native practice lessons, placement/larger text, command clarity, presentation, interruption, storage recovery and four local PWA cases. A separate release-usability run passed nine cases. The historical full 262-case suite was not repeated for this candidate.
- Previous production cache → identified build: one additional passing desktop case. Native worker discovery waits for consent; restart restores three paid Swordsman jobs, a pending House build, gold, wood, population, exact game time and profile. The old cache retires and one current cache remains. The test-only host appends a QA cache suffix to trigger a native update; shipped worker bytes are unchanged.
- Natural gameplay/pacing evidence is separately attributed to the prior published checkpoint in [NATIVE_PLAY_20261005.md](NATIVE_PLAY_20261005.md). All 15 simulation files and the published source/dist remain unchanged. This isolated copy has not been independently pushed or published.

Raw screenshots were inspected for the exposed map in all three viewports, readable menu/Credits IDs, and the actual defeat/route result. Early new-test failures compared an asynchronous restore too soon, clicked an ambiguous pause control, read executed rally state while commands were paused, and compared different whitespace APIs. Final tests wait for the durable menu/restore, use the native resume helper and inspect queued rally targets. Camera/selection assertions remain. No forced click or outcome injection cleared these checks.

## Reproduce the previous-cache check

Keep a previous production dist separate, then run:

```sh
FRONTIER_PREVIOUS_DIST=/absolute/path/to/previous/dist npm run test:browser -- tests/browser/release-update.spec.ts --project=desktop
```

The repository test-only server accepts `/__qa/previous` only when this variable is set; its release endpoint returns to the current dist. The fixture never ships. Without a previous dist, or against an external deployment, this optional case skips. Use an isolated context to preserve player saves.

Local sandbox-enabled Linux Chromium and emulated phone touch were tested. Hosted HTTPS access was denied by this cloud environment before assets loaded (proxy 403 / browser ERR_TUNNEL_CONNECTION_FAILED); hosted gameplay, asset matching and cache lifecycle therefore remain unverified here. The owner separately confirmed the updated public UI was visible, which is not a full playtest. Physical Safari/devices, installed-device lifecycle/performance, full later natural routes, broad balance, soundtrack listening and commercial asset rights remain open. No GitHub workflow or deployment was run for this QA pass.
