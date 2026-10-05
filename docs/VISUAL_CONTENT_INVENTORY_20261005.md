# Visual content requirements and actual delivery

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

The recovered original prompt does not list six theme families, three style packs or full 16-direction animation. These remain active later scope under the current owner's instruction. The retained authorization supports continued development. Exact theme wording was not independently recovered in that record. The pre-existing commercial-readiness document and current lead delegation record the active later scope. No unverified eighteen-combination theme×style matrix is invented.

## Later active visual commitments

| Commitment | Actually available after this batch | Remaining work |
|---|---|---|
| Theme families: space, mythic, old-time, Christmas, Halloween, Street Kids | Christmas and Mythic each have all 36 semantic static roles, selectable as complete sets | Space, old-time, Halloween and Street Kids remain undelivered. Theme choice changes artwork; it does not advertise changed rules, terrain or soundtrack. |
| Styles: toon, realistic, sticker | One coherent toy-3D stylized family, with toon proportions, in two themes | Independently selectable realistic and sticker art remain undelivered. Supplied JPEG examples are inputs, not shipped style packs. |
| Full directional movement/attack frames | Mythic Ranger: sixteen authored heading slots, one idle and four walking frames each, 80 accepted frames. Adjacent headings may have similar silhouettes at native size. No directional mirroring for this actor | Remaining eight actor identities, Christmas directional sets, and complete directional attack coverage remain open. Authored hit/death packs are also absent; their precise expanded requirement was not independently recovered. Four 16-cell bow attack sheets were generated but rejected because aiming did not consistently match heading; none of those 64 attack frames is shipped. |
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
| `themes/mythic-toon/ranger-directional.png` | Packed RGBA; 80 accepted frames, dimensions and byte budgets in its manifest/provenance | One idle plus four walk phases per sixteen headings. Runtime projects actual world facing into screen headings; walking follows measured travel; reduced motion selects the heading's idle frame. Bow attacks use existing simulation-driven procedural feedback. |
| Original vector/procedural content | Four terrain palettes, three faction crests/material families, six team symbols, shadows/effects/UI icons | Shared coherent surroundings and allegiance markers; no external font/CDN |
| Existing audio | Six states × two codecs, twelve files | Unchanged offline soundtrack and browser-synthesized event sounds |

Production PNGs and manifests are under `public/assets/render/`. Their selected-image hashes, source prompts, packing semantics and accepted/rejected counts are recorded in `themes/mythic-toon/provenance.json`; raw generated outputs and browser evidence are retained in the private handoff bundle. Rejected images never become selectable features. Per-frame packing verification compares source and packed RGBA hashes, with source pixels copied unchanged.

## Acceptance evidence

The separate final visual QA report records exact build/runtime/cache identifiers, unit/browser totals, native gameplay inputs, screenshots, theme persistence, unchanged earned history, offline/subpath behavior and any limitations. Native-size art-gallery fixtures are labeled as renderer pixel evidence, not naturally played matches or proof that the game is fun. The existing simulation rules and owned eight-game/three-win profile are preserved.
