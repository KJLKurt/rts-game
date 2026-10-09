# Asset provenance

Current checkpoint: **fc-0f1a6b425705**, with the complete final **400-pass / 18-intentional-skip / zero-failure** 418-case gate. Prior candidate, publication-hold and pending-gate statements below retain their historical context. Later UI design and campaign work are separate. See the current [README](README.md).

The production sprite atlas under `public/assets/render/` was generated from user-supplied reference artwork specifically for this project. It is not copied from a commercial game. See `docs/ART_DIRECTION.md` for the source-selection and generation details. Do not infer a CC0/public-domain license from generation or user supply.

Canvas terrain, flags, icons, particle effects, interface design and the original generative sound program were authored for this implementation. No external font service or asset CDN is required. System fonts are used.

All six music states—menu, exploration, tension, combat, victory and defeat—use original procedurally composed and synthesized scores created for this game, provided in Ogg Vorbis and MP3. They use no commercial recordings or external sample library. The replacement contract is in `docs/AUDIO_REPLACEMENT.md`; per-track metadata is in `public/assets/audio/manifest.json`.

The optional attack-only sprite trial adds three four-pose attack strips generated specifically for this game from the approved atlas. The source PNG is preserved unchanged; only its accepted attack cells are referenced in production metadata. Walking rows remain inactive. Exact scope, hashes, generation provenance and runtime QA limits are in `docs/ATTACK_ANIMATION_TRIAL.md`.

The faction tower, branching-antler and rune-crystal crests and their steel/timber/crystal overlays are original code-native vectors in `src/render/factionIdentity.ts`. They do not modify the supplied sprite pixels. Six separate team color/glyph combinations remain the allegiance signal. The in-game Credits / About screen repeats the provenance and reference-art licensing uncertainty; neither that screen nor this file is a project-wide license grant or a commercial-clearance claim.

The shipped JavaScript includes Vite 6.4.3’s MIT-licensed modulepreload helper. Its copyright and permission notice is distributed at [`public/THIRD_PARTY_NOTICES.txt`](public/THIRD_PARTY_NOTICES.txt), copied into the production site and offline cache. This is runtime code attribution; no third-party music, sample library, external font service or image asset pack was identified in the shipped files.

The owner already authorized use, improvement and publication of the brother-supplied references for this game. The remaining evidence concerns the selected reference’s creator/source-generation record, authority for derivative/public/commercial redistribution and any third-party inputs or conditions. The exact nine-file inventory, retained generation records, audio playback measurements and remaining evidence are in [ASSET_AUDIO_CONTENT_AUDIT_20261005.md](docs/ASSET_AUDIO_CONTENT_AUDIT_20261005.md). No project-wide license grant or CC0 designation is inferred.

The lead subsequently read the [original shared chat](https://chatgpt.com/s/cx_6ac1b0da014c819191530a31ce211050) and reports text-only toon/realistic prompts labeled as using the built-in image tool, with README confirmation of generation. That is attributed evidence for the supplied references' generated lineage. It does not identify the exact selected combined JPEG `F0C6LR8K4U9`, the main production-atlas tool call or its input list, or separately document the brother's commercial redistribution grant. The lead found no concrete commercial-use prohibition. This evidence does not remove the owner's existing project-use/publication authorization or establish blanket license clearance. See [EARNED_ALLIANCE_TERMINAL_QA_20261005.md](docs/EARNED_ALLIANCE_TERMINAL_QA_20261005.md).

## Mythic visual content batch, 5 October 2026

`public/assets/render/themes/mythic-toon/` provides the complete nonseasonal 36-role toy-3D set derived with the authorized built-in ImageGen tool from the project atlas. The Ranger candidate atlas supplies 144 accepted frames: sixteen headings, one idle, four walk and four attack phases each. All 80 previously accepted idle/walk crops remain pixel-identical. The prior 64 rejected attacks remain excluded, along with new rejected aim/re-nock iterations preserved outside production. Accepted RGBA crops are packed unchanged, with measured hood-to-boot height and boot-contact roots. The packed PNG is 3584×2240, 11,494,625 bytes and 30.625 MiB decoded RGBA. The static PNG remains 1254×1254, 1,644,299 bytes. Existing events/cooldowns drive attacks; no gameplay or renderer source changed. See [RANGER_ATTACK_QA_20261005.md](docs/RANGER_ATTACK_QA_20261005.md) for candidate evidence.

Exact prompts, accepted source/frame hashes and production-file hashes are in [`provenance.json`](public/assets/render/themes/mythic-toon/provenance.json). Private raw outputs, rejected-sheet receipts and source-to-packed pixel verification accompany the lead handoff. This new receipt documents the generated batch and preserves the underlying supplied-reference rights boundary above. No third-party image/font/music was fetched. [VISUAL_CONTENT_INVENTORY_20261005.md](docs/VISUAL_CONTENT_INVENTORY_20261005.md) distinguishes original requirements, qualified expansion and later active unfinished scope.

## Mythic Swordsman directional candidate — 5 October

The isolated next-actor batch adds144 authored Swordsman frames across16 headings: one idle, four walk and four attack phases per heading. Its independent1792×2752 texture decodes to18.8125 MiB and is loaded with the whole Mythic set before an atomic switch. The existing Ranger PNG and manifest remain byte-identical. Original ImageGen PNGs, exact prompts and source/crop/packed RGBA hashes are retained in the handoff and theme provenance. Packing copies selected crops unchanged; no resampling, mirroring, masking or recoloring is used. The rejected WSW passing pose and ESE windup remain archived. Native presentation QA is separate from these provenance facts.

Existing simulation melee attack/damage events supply strike timing; presentation does not create damage or modify gameplay stats. This batch changes no audio. Two Mythic actors represent288/1296 family frames; seven actors1008 frames and other active themes/styles/music remain open. Desktop/emulated-phone evidence does not establish physical-device memory, thermals or FPS.

## Mythic Archer directional candidate — 6 October

The isolated next-actor batch adds144 unique Archer frames across16 headings: idle/four walk/four attack phases. The independent1536×2816 atlas decodes to16.5 MiB, above the original16 MiB target and below the documented20 MiB cap. ImageGen compact redraws precede unchanged-pixel cropping/packing; no packed-source pixel resampling, mirroring, masking or recoloring occurs. All25 original outputs/requests, rejected aim/release/scale iterations and source/crop/packed/readback hashes are retained. Ranger and Swordsman assets stay byte-identical. Existing simulation projectiles and damage events drive attacks; no rules, stats or audio change. Three actors cover432/1296 Mythic family frames, with six actors864 frames still open. Their directional textures total65.9375 MiB decoded plus static art; physical-phone performance is unmeasured. See [ARCHER_ANIMATION_QA_20261006.md](docs/ARCHER_ANIMATION_QA_20261006.md) for exact build attribution, native human attacks, retained fixture failures and save/offline evidence.


### Mythic Spearman directional animation — 6 October 2026

The optional Mythic set now includes 144 unique female Spearman idle, walk and thrust frames over sixteen headings. One right-hand spear and left-hand blue/gold sun shield preserve the approved static identity. Separate `spearman-directional.png` and `.json` assets use exact unchanged ImageGen crops: 2560×1664 RGBA, 16.25 MiB decoded (the initial 16 MiB target misses by 0.25 MiB; the 20 MiB cap passes). Eleven original sources/prompts include two rejected oversized pilots and subsequent ImageGen size edits. Ranger, Swordsman and Archer assets remain exact. The family has 576/1296 frames; five actors and 720 frames remain. Evidence and limits are in `docs/SPEARMAN_ANIMATION_QA_20261006.md`. No new source-rights or redistribution clearance is established.


## Cavalry directional animation — local reviewed candidate 2026-10-06

Cavalry adds 144 original frames at sixteen headings, 14.25 MiB decoded, bringing five complete actors to 720/1296 frames. Candidate fc-fe6ef97ce9bd has 588 unit passes, 52 focused browser passes, three cache upgrades and 48 real native combat scenes. Three owned match continuations produced 39/34/41 human attack hits with exact online/offline saves; all recruits died by the final screenshots. Full 376-case receipt is required separately. Depot/crest/caption occlusion and dense picking remain visible quality issues. See [Cavalry local QA](docs/CAVALRY_ANIMATION_QA_20261006.md). Accepted source does not imply publication; parent main remains last confirmed 40b4a3d. Preserve existing publication history and locator cleanup when merging this append-only addition.


## 2026-10-06 visibility and native picking review

The isolated Swordsman-baseline visibility candidate changes renderer picking, scenery transparency, ground faction markers, captions and pause HUD placement without changing any actor asset. See [visibility/picking review](docs/VISIBILITY_PICKING_QA_20261006.md). Full regression acceptance is a separate publication gate; unpublished actor packets remain separate.


### Superseding visibility ground-marker correction — 2026-10-06

Hold first-stage `fc-9708c3913116`: native commander ground-marker taps queued a tiny Move. Corrected `fc-48ef95e814c0` preserves painted ground-marker selection below opaque sprite pixels; 21 targeted native checks pass, including all three commanders/both themes/three widths, and three earned continuations each produce eight Ranger damage hits with exact offline restoration. Full394 acceptance is reported separately. No new actor art. See [corrected review](docs/VISIBILITY_PICKING_QA_20261006.md).


## Combined actor and corrected visibility candidate — 2026-10-06

Frozen pre-full buildfc-4a71fd4dca98 passes588units/64files,8missions,TS/build,40exactrepeat outputs and3first-attempt earned native targeting/offline continuations. Five unchanged actor packs cover720/1296frames; corrected visibility code is combined without sim/content/audio changes. Full412 gate remains separately required. See docs/COMBINED_ACTOR_VISIBILITY_QA_20261006.md (repository root) and COMBINED_REQUIREMENTS_AUDIT_20261006.md. No publication; four UI boards remain proposals.
# Hollow Lanterns static art and soundtrack — 9 October 2026

The Halloween candidate adds 36 newly generated semantic role images in one 1200×1200 RGBA atlas and six original sample-free musical arrangements in twelve codecs. Exact art prompts, generation IDs, source hashes, frame transforms and packed hashes are in `docs/HALLOWEEN_ART_PROVENANCE.json` and `docs/HALLOWEEN_ART_PACKING.json`. Whole-source uniform resampling is documented; originals and rejected/alternate samples remain preserved. This does not add authored directional frames or new gameplay systems for reserved atlas roles.

Music composition/provenance and signal evidence are in `scripts/audio/compose_hollow_lanterns.py`, its retained core module and `docs/HALLOWEEN_AUDIO_PROVENANCE.md` / `HALLOWEEN_AUDIO_VALIDATION.json`. No commercial recording, external sample library or paid art was used. Existing Christmas/Mythic assets remain unchanged. See `docs/HALLOWEEN_THEME_20261009.md` for the exact candidate gate and remaining subjective/device/rights limitations; generation alone does not establish public-domain status or redistribution clearance.

