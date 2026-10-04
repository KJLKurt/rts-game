# Map generation and validation

The generator is seeded and versioned (`GameMap.version`). A seed plus settings reproduces the same row-major terrain and resource placement. Five map sizes span 32–84 tiles. Four biomes change palette, movement, vision and resource economics. Competitive and balanced presets preserve viable starts; wild/chaotic presets introduce more variation.

Spawns, guaranteed initial gold and wood, expansion nodes, and relics are connected by carved usable routes. Validation checks dimensions/terrain, bounds, reachable starts, resources/objectives, and competitive travel-distance fairness. Failure repair is deterministic. The current test suite generates 400 maps covering biome, size and 2–6-player combinations.

Pathfinding uses cached A* paths on the tile grid and building occupancy. Each unit follows waypoints; it does not run full-map search every frame. Navigation revisions invalidate building-dependent routes. Direct routes use a cheap fast path. Local spacing reduces complete visual overlap but is not a full crowd fluid solver.

`validateMap` is also used by the editor, game creation, and save restore. A valid map is reachable, not necessarily balanced or enjoyable: play it, contest its objectives, and inspect choke points with actual armies.

## Portable map codes

The battle menu can copy a map code containing its seed, generator version, biome, dimensions, player count, preset, requested duration, resource/terrain parameters, and mode. Paste that code into the skirmish seed field to restore those settings. Commander, faction, and difficulty remain your choices. Custom workshop maps use JSON export instead. Generator v4 has mirrored central resource types; explicit v3 maps remain supported for older shared seeds.
