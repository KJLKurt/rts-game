# Architecture and rendering decision

## Runtime boundaries

- `src/sim`: serializable fixed-tick simulation, commands, AI, combat/economy, finite deposits, map generator, pathfinding, fog, mission triggers, Rush Arena.
- `src/render`: read-only Canvas2D view, camera conversion, cached isometric terrain, sprite atlas, interpolated visual positions, particles, minimap, Rush telegraphs. Rendering never applies damage.
- `src/main.ts`: menu and HUD orchestration, selection and mobile/desktop input, player-facing lifecycle, campaign and expedition transitions.
- `src/ui`: data-driven story content, achievements, icon vocabulary.
- `src/platform`: IndexedDB/local storage, Web Audio and replaceable score manifest, explicit service-worker updates.

There is no React or other DOM framework in the simulation. Input emits the same typed commands used by bots and tests. World coordinates are tiles; simulation runs at 10 Hz independent of browser frame rate. Presentation interpolates movement for smoothness.

## Phaser, PixiJS, and the selected foundation

Phaser offers scenes, input, audio, cameras, and game-object update orchestration. Its integrated systems are useful for general 2D games, but this RTS already needs an independent deterministic simulation and a dedicated DOM touch interface. PixiJS offers a focused WebGL/WebGPU renderer and asset system, making it the closer future migration path if large armies exceed Canvas throughput.

This vertical slice uses a small dedicated Canvas2D renderer instead. The measured production application code is around 150 KB before compression, no rendering library needs caching, and the rendering contract remains easy to exercise independently. Static terrain is cached, sprites are depth-sorted/cropped, invisible objects culled, DPR capped at 2, and enormous terrain canvases capped at 4096 pixels. This is a deliberate bounded-content choice, not a claim that Canvas beats GPU batching at every army size.

Primary references reviewed:
- https://docs.phaser.io/phaser/concepts/scenes
- https://docs.phaser.io/phaser/concepts/physics
- https://pixijs.com/8.x/guides/concepts/architecture
- https://pixijs.com/8.x/guides/components/application

## Mobile design

Tap friendly to select, then ground/enemy/resource to issue context-sensitive orders. Drag pans and pinch zooms. Direct movement uses a thumbstick on coarse-pointer devices, including landscape. Whole-army and commander selection avoid tiny multi-select gestures. Abilities auto-target an appropriate nearby threat, or the current ground target. Desktop adds WASD/arrows, Q/E, Space, 1/2, B/R.

The responsive bottom dock scrolls cards horizontally instead of shrinking targets. Tactical pause queues commands, while modal menus freeze the local render-loop simulation without consuming difficulty-limited tactical pauses.

## Limits and expansion

The current implementation is single-player only. Local browser storage is device-specific. Single-frame supplied sprites use procedural stride/attack presentation, not an authored eight-direction animation set. Five additional theme families, authored naval units, and generalized multiplayer are extension points rather than finished content.
