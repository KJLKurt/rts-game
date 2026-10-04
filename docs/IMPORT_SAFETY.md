# Imported content boundaries

The game is a static, local-first PWA. Imported map JSON is data, never executable code.

- Map files are limited to 2 MiB before reading/parsing. Saves are limited to 16 MiB; local preference/profile JSON to 256 KiB.
- Plain JSON checks reject prototype-mutating keys, unsupported object types/accessors, excessive nesting and excessive work.
- Structural map validation bounds dimensions, spawn/resource counts, IDs, coordinates, terrain, biome, generator version, ownership, and resource values before pathfinding or editor rendering.
- Mission triggers accept only known declarative conditions/actions and bounded text/spawn counts. Extra executable extension fields are rejected. There is no `eval`, script action, or runtime campaign-code importer.
- Campaign/page/dialog prose and map seeds are HTML-escaped. Numeric and boolean preferences/profile fields retain their expected types on loading.
- Saves and caches stay in the `frontier-command:rts-game` / `frontier-command-rts-game` namespaces. Worker activation deletes only its own superseded cache names, not sibling projects or player saves.

The campaign registry is currently authored TypeScript checked at build time. A future runtime campaign JSON importer must validate the outer campaign/mission schema before calling the existing typed content validator.

Focused malformed/malicious fixtures live in `tests/security.test.ts`; storage and sibling-cache contracts live in `tests/platform.test.ts`. These are bounded robustness checks, not a claim of a comprehensive security audit.
