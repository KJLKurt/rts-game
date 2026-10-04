# Units, factions, commanders, and biomes

All core definitions are in `src/sim/content.ts` with interfaces and ID unions in `src/sim/types.ts`.

## Unit

Add an ID to `UnitId`, a definition in `UNITS` (cost, health, damage, armor, range, speed, attack period, vision, population, train time, producing building, counter multipliers), and include the ID in that building's `recruits`. Add a sprite frame mapping in `src/render/SpriteAtlas.ts` and an icon in `src/ui/icons.ts`. The recruit menu reads the definition table. Moderate counter bonuses preserve positioning, support, and ability decisions.

## Faction

Add `FactionId` and a `FACTIONS` entry with name, description, symbol, and damage/health/speed/cost/building-health multipliers. The setup menu derives its choices from the table. Update the AI faction list if it should be chosen by rivals. Team identity is independent of faction costume color: retain colored ground plates plus distinct shapes and banners.

## Commander

Add `CommanderId`, definition, two ability descriptions/keys, atlas mapping, and explicit ability behavior in the command handler. New abilities require mechanics and tests, not only data labels. Preserve responsiveness while moving, cooldown feedback, and a readable silhouette.

## Building and technology

Buildings specify footprint, cost, construction duration, population contribution, prerequisites, recruitment choices, and optional defense stats. `canBuild` is the authoritative placement check. Technologies specify producer, cost, duration, and max level; add the corresponding simulation effect and save compatibility tests.

## Biome

Add a `BiomeId`/`BIOMES` entry, deterministic terrain-generation rules in `maps.ts`, and a renderer palette in `Battlefield.ts`. Gameplay modifiers include visibility, movement and income. Map validation and 400-seed tests should cover the new biome. Swapping colors alone does not establish a new terrain mechanic.

Run `npm run check`, `npm test`, and `npm run build`, then play a real mobile battle featuring the new content. See `docs/ART_DIRECTION.md` for atlas pivots and native aspect-ratio rules.
