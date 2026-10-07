# Visual content requirements and actual delivery

Current checkpoint: **fc-0f1a6b425705**, with the complete final **400-pass / 18-intentional-skip / zero-failure** 418-case gate. Prior candidate, publication-hold and pending-gate statements below retain their historical context. Later UI design and campaign work are separate. See the current [README](../README.md).

This inventory separates the recovered original 56-section brief from later active commitments. It describes shipped files, not reference pictures or proposed packs. The 5 October visual batch extends the locally verified ranged-stance source; the lead integrates and publishes it separately.

## Original scope and qualifiers

| Source | Required useful behavior | Current implementation and boundary |
|---|---|---|
| §4, §51 | Polished, readable stylized isometric 2.5D; attractive buildings, colorful terrain, shadows, simple animation, particles/projectiles, selection and health feedback; desktop/mobile readability | Canvas isometric terrain, ground shadows, selection/health markers, authored static figures, bounded attack strips and procedural feedback. This batch adds a second complete static visual theme and Ranger directional locomotion. Simple animation was mandatory; a full 16-heading atlas was not stated in this section. |
| §12 | Three visually and mechanically distinct factions; allegiance readable independently of faction and accessible without color alone | Ironhold/Wildborn/Arcanists mechanics and original steel/timber/crystal adornments and crests; six separate team glyph/color combinations. Shared base figures remain. This is not three independently animated faction packs. |
| §15, §49 | Several biomes for the slice, approximately 3–4 | Four functional terrain palettes: grasslands, forest, desert and snow. Eight named eventual biomes and naval expansion retain their future qualifiers. |
| §33 | Tasteful effects, reduced motion, mobile performance; manual graphics selector if helpful | Reduced-motion preference and bounded effects exist. Browser viewport QA does not establish physical-phone thermals or FPS. An optional graphics selector is not silently promoted to mandatory scope. |
| §45 | Original/project-generated/procedural art permitted; provenance in ASSETS.md; no copied commercial-game art | Existing supplied-reference lineage and this batch's exact tool/prompt/hash records are retained. No third-party asset download, purchase or new license grant. |
| §49 | Approximate slice: three factions, three commanders, six or more troop types, 8–12 buildings | Three factions, three commanders, six core troops and nine playable building definitions. Eleven building images include arcane and wall scenery/replacement roles; those images do not imply two extra playable building systems. |
| §53 | Useful working subset and extensible architecture where full scope cannot practically reach quality; no fake advertised actions | Only genuinely shipped visual choices appear in Settings. This qualifier does not cancel later explicit commitments. |

The recovered original prompt does not list six theme families, three style packs or full 16-direction animation. These remain active later scope under the current owner's instruction. The owner’s high-priority development and saved cloud fallback authorization is retained in the private work record. Exact theme wording was not recovered there. The pre-existing commercial-readiness document and current lead delegation record the active later scope. No unverified eighteen-combination theme×style matrix is invented.

## Later active visual commitments

| Commitment | Actually available after this batch | Remaining work |
|---|---|---|
| Theme families: space, mythic, old-time, Christmas, Halloween, Street Kids | Christmas and Mythic each have all 36 semantic static roles, selectable as complete sets | Space, old-time, Halloween and Street Kids remain undelivered. Theme choice changes artwork; it does not advertise changed rules, terrain or soundtrack. |
| Styles: toon, realistic, sticker | One coherent toy-3D stylized family, with toon proportions, in two themes | Independently selectable realistic and sticker art remain undelivered. Supplied JPEG examples are inputs, not shipped style packs. |
| Full directional movement/attack frames | Mythic Ranger and Swordsman candidates each have sixteen authored headings, one idle, four walk and four attack phases each: 288 frames total. Ranger assets remain pixel-identical to fc-5106dd6e9270. Swordsman adds a separate actor-owned atlas loaded atomically with the complete theme. No directional mirroring or repeated-pixel aliases. Exact native combat acceptance is recorded in the separate actor QA reports | Seven other actors remain open: 1008 missing frames toward the nine-actor, 144-frame-per-actor Mythic family. Christmas directional coverage, other styles/themes and authored hit/death packs remain open. Prior rejected 64 attacks and new rejected aim/re-nock iterations remain excluded and preserved. |
| Themed music | Six existing procedural game-state scores in Ogg/MP3 | Alternate theme-specific score packs remain open; this batch changes no music. Subjective listening is not verified here. |
| Day/night | Existing restrained time-of-day tint | More elaborate themed lighting is not delivered by this batch. |
| Reusable faction recoloring/identity | Three original material/crest overlays plus independent team shapes/colors | Full costume recoloring and separate authored faction figure packs remain open. |
| Visible finite resources | Gold/wood depletion states, capture and income behavior; matching states in both static atlases | Broader terrain/resource theme assets can follow. |
| Rush Arena | Existing real survival mode | This asset batch does not change balance or claim a new natural Rush win. |

## Exact file inventory

| Asset | Pixels / accepted frames | Runtime use |
|---|---|---|
| `frontier-atlas.png` | 1254×1254 RGBA; 36 static frames | Preserved Christmas toy-3D set: eight resource stages, four relic states, two camp states, two work cues, six troops, three commanders, eleven building images |
| `frontier-combat-animation.png` | 1024×1536 RGBA; twelve accepted attack cells | Four fixed-view poses each for Warlord, Swordsman and Archer; western mirroring. Walking rows remain inactive. |
| `themes/mythic-toon/atlas.png` | 1254×1254 RGBA; all same 36 static semantic roles | Nonseasonal navy/teal/brass/oak/turquoise set; manifest/image swap atomically, portraits and cards use active pixels |
| `themes/mythic-toon/ranger-directional.png` | Packed RGBA; 144 accepted candidate frames, 3584×2240, 30.625 MiB decoded; hashes/budgets in manifest/provenance | One idle, four walk and four attack phases per sixteen headings. Actual facing selects heading; travel selects walking. Existing cooldowns supply anticipation and real projectile events start release. Pause freezes playback; reduced motion keeps the heading idle. |
| `themes/mythic-toon/swordsman-directional.png` | 1792×2752 RGBA; 144 candidate frames, 18.8125 MiB decoded | Sixteen headings, idle/four walk/four attack phases. Source crops copied unchanged; one corrected WSW walk frame. Renderer chooses the actor-owned atlas; tactical pause and reduced motion preserve their existing behavior. Physical-device memory/FPS remains unverified. |
| Original vector/procedural content | Four terrain palettes, three faction crests/material families, six team symbols, shadows/effects/UI icons | Shared coherent surroundings and allegiance markers; no external font/CDN |
| Existing audio | Six states × two codecs, twelve files | Unchanged offline soundtrack and browser-synthesized event sounds |

Production PNGs and manifests are under `public/assets/render/`. Their selected-image hashes, source prompts, packing semantics and accepted/rejected counts are recorded in `themes/mythic-toon/provenance.json`; raw generated outputs and browser evidence are retained in the private handoff bundle. Rejected images never become selectable features. Per-frame packing verification compares source and packed RGBA hashes, with source pixels copied unchanged.

## Acceptance evidence

The separate final visual QA report records exact build/runtime/cache identifiers, unit/browser totals, native gameplay inputs, screenshots, theme persistence, unchanged earned history, offline/subpath behavior and any limitations. Native-size art-gallery fixtures are labeled as renderer pixel evidence, not naturally played matches or proof that the game is fun. The existing simulation rules and owned eight-game/three-win profile are preserved.

## Archer candidate addendum — 6 October 2026

The current Mythic candidate includes Ranger, Swordsman and Archer:432/1296 authored family frames, each16 headings × (idle1/walk4/attack4). Six actors864 frames remain. The Archer actor-owned atlas is1536×2816,144 unique frames,16.5 MiB decoded. All three textures load atomically with the full static theme; portraits still use the approved static role. Ranger and Swordsman pixels are unchanged. Existing source projectile/damage events drive Archer firing; pause and reduced motion retain existing behavior. The earlier two-actor inventory is the previous batch, superseded for current coverage by this addendum. No other theme/style/music or authored hit/death completion is implied.

Actual native galleries, mouse/touch attacks, three natural human-team firing continuations and exact online/offline saves are recorded in [ARCHER_ANIMATION_QA_20261006.md](ARCHER_ANIMATION_QA_20261006.md). A separate full364 receipt records broad regression. Total directional decode is65.9375 MiB plus static art; physical-device memory/FPS and novice fun remain unverified.


### Spearman inventory addition — 6 October 2026

Mythic Spearman has 144 unique frames: sixteen headings with one idle, four walk and four spear-thrust phases. Unchanged ImageGen source crops pack into 2560×1664 RGBA, 16.25 MiB decoded. The initial 16 MiB target misses by 0.25 MiB; the 20 MiB cap passes. Eleven originals with exact prompts include two oversized rejected pilots. Six prior Ranger/Swordsman/Archer assets stay byte-identical. Four complete actors cover 576/1296 family frames; cavalry, siege, support, warlord and engineer still require 720 frames. All four directional textures total 82.1875 MiB decoded plus roughly 6 MiB static art; physical-phone memory and frame rate are unmeasured. Native galleries, real source/input/natural combat evidence, building/crest/caption occlusion and publication-gate limits are in `SPEARMAN_ANIMATION_QA_20261006.md`.


## Cavalry directional animation — local reviewed candidate 2026-10-06

Cavalry adds 144 original frames at sixteen headings, 14.25 MiB decoded, bringing five complete actors to 720/1296 frames. Candidate fc-fe6ef97ce9bd has 588 unit passes, 52 focused browser passes, three cache upgrades and 48 real native combat scenes. Three owned match continuations produced 39/34/41 human attack hits with exact online/offline saves; all recruits died by the final screenshots. Full 376-case receipt is required separately. Depot/crest/caption occlusion and dense picking remain visible quality issues. See [Cavalry local QA](CAVALRY_ANIMATION_QA_20261006.md). Accepted source does not imply publication; parent main remains last confirmed 40b4a3d. Preserve existing publication history and locator cleanup when merging this append-only addition.


## 2026-10-06 visibility/picking integration candidate

No new art or animation frames. A separate Swordsman-baseline renderer/HUD candidate improves scenery overlap, ground faction identity, body-clear deposit captions and actual sprite-alpha picking; it preserves all existing actor assets. Native desktop/portrait/landscape input and actual saved combat are documented in [visibility review](VISIBILITY_PICKING_QA_20261006.md). Full regression and lead publication remain separate gates.


### Superseding visibility ground-marker correction — 2026-10-06

Hold first-stage `fc-9708c3913116`: native commander ground-marker taps queued a tiny Move. Corrected `fc-48ef95e814c0` preserves painted ground-marker selection below opaque sprite pixels; 21 targeted native checks pass, including all three commanders/both themes/three widths, and three earned continuations each produce eight Ranger damage hits with exact offline restoration. Full394 acceptance is reported separately. No new actor art. See [corrected review](VISIBILITY_PICKING_QA_20261006.md).


## Combined actor and corrected visibility candidate — 2026-10-06

Frozen pre-full buildfc-4a71fd4dca98 passes588units/64files,8missions,TS/build,40exactrepeat outputs and3first-attempt earned native targeting/offline continuations. Five unchanged actor packs cover720/1296frames; corrected visibility code is combined without sim/content/audio changes. Full412 gate remains separately required. See docs/COMBINED_ACTOR_VISIBILITY_QA_20261006.md (repository root) and COMBINED_REQUIREMENTS_AUDIT_20261006.md. No publication; four UI boards remain proposals.
