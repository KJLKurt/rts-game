# Asset provenance

The production sprite atlas under `public/assets/render/` was generated from user-supplied reference artwork specifically for this project. It is not copied from a commercial game. See `docs/ART_DIRECTION.md` for the source-selection and generation details. Do not infer a CC0/public-domain license from generation or user supply.

Canvas terrain, flags, icons, particle effects, interface design and the original generative sound program were authored for this implementation. No external font service or asset CDN is required. System fonts are used.

The exploration cue “Lanterns in the Pines” and combat cue “Clockwork Brigade” are original procedurally composed and synthesized scores created for this game, provided in Ogg Vorbis and MP3. They use no commercial recordings or external sample library. The replacement contract is in `docs/AUDIO_REPLACEMENT.md`; per-track metadata is in `public/assets/audio/manifest.json`.

The optional attack-only sprite trial adds three four-pose attack strips generated specifically for this game from the approved atlas. The source PNG is preserved unchanged; only its accepted attack cells are referenced in production metadata. Walking rows remain inactive. Exact scope, hashes, generation provenance and runtime QA limits are in `docs/ATTACK_ANIMATION_TRIAL.md`.

The faction tower, branching-antler and rune-crystal crests and their steel/timber/crystal overlays are original code-native vectors in `src/render/factionIdentity.ts`. They do not modify the supplied sprite pixels. Six separate team color/glyph combinations remain the allegiance signal. The in-game Credits / About screen repeats the provenance and reference-art licensing uncertainty; neither that screen nor this file is a project-wide license grant or a commercial-clearance claim.
