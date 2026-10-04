# Frontier Command

A mobile-first, offline-capable fantasy RTS. Lead a commander directly, capture finite resource deposits, recruit a combined-arms army, and contest a central relic.

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

The deterministic engine, mobile/desktop interface, isometric renderer, seeded skirmishes, data-driven story missions, three-battle expedition, map workshop, save system, synthesized audio, and scoped PWA cache are implemented. Initial build/typecheck and 23 engine/map tests pass, including 400 generated maps. Browser verification is in progress; this checkpoint is not a final release.

The initial implementation is being actively playtested and expanded. No GitHub Actions workflow is enabled during early iteration to avoid unnecessary runner usage.

## Controls

- Tap a friendly unit to select; tap ground to move, an enemy to attack, or a resource to capture.
- Drag the battlefield to pan; pinch or scroll to zoom.
- Phone thumbstick and desktop WASD directly move the commander.
- Q / E: commander abilities. Space: tactical pause. 1: commander. 2: army.
- Recruit, build, and research from the bottom command deck.
- Save and continue on the same device. App updates require an explicit restart.

See `docs/ENGINE.md` for simulation contracts and `docs/ART_DIRECTION.md` for art provenance and limitations.
