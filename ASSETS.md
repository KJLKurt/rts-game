# Asset provenance

The production sprite atlas under `public/assets/render/` was generated from user-supplied reference artwork specifically for this project. It is not copied from a commercial game. See `docs/ART_DIRECTION.md` for the source-selection and generation details. Do not infer a CC0/public-domain license from generation or user supply.

Canvas terrain, flags, icons, particle effects, interface design and the original generative sound program were authored for this implementation. No external font service or asset CDN is required. System fonts are used.

All six music states—menu, exploration, tension, combat, victory and defeat—use original procedurally composed and synthesized scores created for this game, provided in Ogg Vorbis and MP3. They use no commercial recordings or external sample library. The replacement contract is in `docs/AUDIO_REPLACEMENT.md`; per-track metadata is in `public/assets/audio/manifest.json`.

The optional attack-only sprite trial adds three four-pose attack strips generated specifically for this game from the approved atlas. The source PNG is preserved unchanged; only its accepted attack cells are referenced in production metadata. Walking rows remain inactive. Exact scope, hashes, generation provenance and runtime QA limits are in `docs/ATTACK_ANIMATION_TRIAL.md`.

The faction tower, branching-antler and rune-crystal crests and their steel/timber/crystal overlays are original code-native vectors in `src/render/factionIdentity.ts`. They do not modify the supplied sprite pixels. Six separate team color/glyph combinations remain the allegiance signal. The in-game Credits / About screen repeats the provenance and reference-art licensing uncertainty; neither that screen nor this file is a project-wide license grant or a commercial-clearance claim.

The shipped JavaScript includes Vite 6.4.3’s MIT-licensed modulepreload helper. Its copyright and permission notice is distributed at [`public/THIRD_PARTY_NOTICES.txt`](public/THIRD_PARTY_NOTICES.txt), copied into the production site and offline cache. This is runtime code attribution; no third-party music, sample library, external font service or image asset pack was identified in the shipped files.

The owner already authorized use, improvement and publication of the brother-supplied references for this game. The remaining evidence concerns the selected reference’s creator/source-generation record, authority for derivative/public/commercial redistribution and any third-party inputs or conditions. The exact nine-file inventory, retained generation records, audio playback measurements and remaining evidence are in [ASSET_AUDIO_CONTENT_AUDIT_20261005.md](docs/ASSET_AUDIO_CONTENT_AUDIT_20261005.md). No project-wide license grant or CC0 designation is inferred.
