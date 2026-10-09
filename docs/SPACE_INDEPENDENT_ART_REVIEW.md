# Starfall Outpost independent static-family review

Reviewed 2026-10-09 in the recovered workspace. **Accept the 36 selected source originals and the persisted 36-frame atlas for static art integration. Accept the proposed Space-only health position at ready packed frame top minus 20 pixels for the nine active building roles.** Keep the explicit reserved-Wall queue limitation below. This is an offline art/packing gate, not browser, gameplay, animation, hit-testing, performance, or release acceptance.

This verdict follows inspection of original, native grass/light/dark, grayscale/silhouette, direct-source versus packed, portrait, state-family and bounded crowd pixels. Counts and hashes support integrity; they did not determine visual acceptance.

## Artifact and provenance boundary

- Atlas: `../packed/atlas.png`, SHA-256 `8359c2819d1ca46b93b2bb40254f5db30db69dee934681194e9cd37fee2f769a`; 1,361,093 encoded bytes, 1200 × 1200 RGBA, 5,760,000 decoded bytes.
- Manifest: `../packed/atlas.json`, SHA-256 `fbc254986a1805c28afbe5081c8c534d5a021f5e97875fe34c21214757182bfa`.
- Current recipe: `../space-source-recipe.json`, SHA-256 `059b2c73ee5e7649ae63926379df0dfdbecdfc2c130307b8214311791c553359`.
- Seven actors are exact recovered originals. Twelve selected resources are recovered original tool payloads (19 recovered roles including the seven actors); the independently retained pre-loss hashes specifically corroborate gold half/sparse. The missing eight pilot roles and nine other buildings are **17 newly authored replacements**, not restoration of lost pixels. Retained rejected alternatives are outside this selected recipe.
- The old lost workspace did not achieve an independently completed packed gate. This review and its scripts were reconstructed in the recovered workspace; they are not byte recovery of lost review files.
- Three production-role provenance labels were added after the original packed run. `FINAL_RECIPE_RECONCILIATION.json` rehashes all inputs and proves all 36 source hashes, measured bounds, draw frames and pivots still match that run. Only the recipe input changed. Final contact-sheet labels incorporate that clarification; historic detailed pages retain their original labels.

## Source and native-role assessment

The full family is coherent in ivory/bronze/dark-blue structure, warm metal trim and restrained cyan detail. Meaningful alpha is intact at original edges. Low-alpha dust remains in originals; no cleanup, repainting or compositing was applied to source assets.

All nine actors retain recognisable role cues at native fit: shield/sword, spear, bow, mounted rider, wheeled siege arm, support staff, broad hammer commander, hooded bow commander and wrench commander. Spearman's body is smaller because its long spear occupies the 45-pixel full-height fit; actual helmet/body/weapon pixels remain legible alongside Swordsman. Ranger is slimmer than Warlord but clear at 59 pixels. Independently derived boot contacts, rather than default anchors, place the two new actors.

The 11 buildings share their architecture while preserving role details. House is a single dome; Barracks has twin ribbed halls and weapon storage; Range retains the target/bow rack; Stable shows stalls, horse heads and hay; Workshop has machinery/workbench/wheels; Depot exposes supplies; Blacksmith has its chimney, furnace and anvil; Arcane is an observatory; Wall retains complete end piers. The latter two are reserved art roles. Some native heights differ from author targets, but inspected pixels are readable and intact. No source regeneration is recommended.

Keep v3 has a genuine central second storey and reads as headquarters. Its body is still shorter than the 110–118-pixel authoring target. Fixed health coordinates leave a 46-pixel native gap below the health border in the persisted atlas; Barracks leaves 37 pixels. These are material attachment weaknesses in mixed crowds, and the fixed-HUD configuration is not the accepted integration proposal. Tower remains within its actual 66-pixel runtime width and approximately 86-pixel packed frame height; the older Halloween-specific 54-pixel width restriction is inapplicable.

## State identity and registration

- **Gold:** full/half/sparse/empty remain distinguishable at 78-pixel family width. Full-to-half is a subtler step than half-to-sparse; sparse retains a small ore remnant that empty removes. Common housing/ground features stay registered. Independent source landmark matching found at most about 0.092 native pixel of local shift.
- **Wood:** three/two/one/zero crowns are clear. Empty is framed with the family, never enlarged independently to 84 pixels; its source-fit visible width is 71.78 pixels. Front logs and central rock align. The far-right root retains a small local residual, about 0.96 pixel by this grayscale matcher and 1.03 pixels by the author’s RGB measurement. This is acceptable at native view and is not an exact-registration claim.
- **Relics:** single crystal, split contested crystal, enclosed captured crystal and inactive folded/dim structure remain distinct on the same base. Independent local source registration residual is at most about 0.166 pixel.
- **Camps:** guarded/cleared retain the same shelter, crates and logs, with pikes removed and door opened. Cleared v1 has a nearly uniform source-scale difference. Independently reproduced uniform scale 1.1852088311 and translation give a maximum landmark residual of 0.1104 native pixel at the proposed 103-pixel display width. This is honest normalized placement, not identical source coordinates. Camps are reserved art, not accepted runtime transitions.
- Mining/chopping cues retain distinct pick/ore versus axe/stump shapes.

All four states within each gold, wood and relic family have identical packed source-to-native transforms. Timber's 1373-pixel-wide empty original receives one transparent right column in the declared 1374 × 1145 logical packing canvas. Original RGBA bytes are copied unchanged before uniform resizing, including hidden RGB; padding is transparent black. The independent reconstruction confirms this and eliminates the previously predicted one-column packed-scale step. Integer dimension rounding produces a very small shared x/y difference for the relic family; it does not vary by state.

## Independent packing and portraits

`review_space_family.py` does not import the authoring packer. It independently opens every original, reconstructs declared padding, resamples the full original canvas and compares actual persisted atlas pixels and metadata. All 36 full resamples match exactly; all recorded source/frame hashes match; frames are isolated; gutters are transparent; semantic roles match both recipe and baseline. Maximum pivot transformation error is 5.69e-14 atlas pixel. Inputs remain unchanged.

No alpha-16 content is clipped by the draw frames. Some faint alpha below that threshold remains outside draw frames: maximum excluded packed alpha is 4, and maximum frame-edge alpha is 13. Entire resampled source canvases are preserved inside their packing cells. This is not a claim that every nonzero-alpha dust pixel is drawn at runtime.

Direct-source versus packed native sheets show no meaningful loss of role identity or new halo. Warlord, Ranger and Engineer portraits were explicitly compared at 220 × 180 and at the two smaller display derivatives. Faces, hammer, bow and wrench remain readable. Packed meaningful input footprints are 121 × 143, 134 × 170 and 101 × 154 pixels respectively; all final portraits fit the canvas. Current whole-source 192-pixel packing and decoded memory target are adequate.

The 12-troop bounded crowd at 32-pixel columns/24-pixel depth retains individual shields, helmets and weapons comparably to the two existing themes. Body-only mean/minimum unoccluded opaque fractions are 0.832/0.729 for Space, versus 0.801/0.690 Mythic and 0.769/0.649 Halloween. These numbers exclude overlay and moving-pose occlusion and are not performance or gameplay evidence.

## Packed building HUD comparison

The accepted offline proposal uses **health y = actual ready packed sprite bounds y − 20**, with queue y = health y + 7, existing fallback coordinates, and unchanged other themes. The final selected Keep/Barracks/Tower proxy uses actual manifest coordinates, not source estimates. Their health positions are −104.2604, −78.3001 and −93.9038 respectively.

Health outer border has 16 pixels of clearance above the full packed frame. Queue outer border has 9.5 pixels. Native raster alpha-top clearance is approximately 10.76/10.80/10.40 pixels for Keep/Barracks/Tower, with small raster rounding variation across the other buildings. Both bars have zero meaningful-art overlap. All nine active buildings and reserved Arcane are clear of their flags. Barracks is the closest with 1.60 pixels of geometric queue-to-flag-finial clearance. Keep's flag is separated horizontally by at least 2.5 pixels from the bar border. Front crests, all three faction adornments, selected building ellipses and name labels remain clear in the bounded selected proofs.

The closer bars visibly associate with Keep/Barracks and remain readable among rear and front troops. The earlier top−18 proposal caused about 0.40 pixel of Barracks queue/finial contact; top−20 removes it. The prior fixed coordinates remain in the comparison as evidence of why the change matters.

**Reserved Wall limitation:** its synthetic queue would intersect the flag by approximately 3.28 pixels under top−20. That hypothetical queued-Wall configuration is rejected. Wall is currently reserved art with no runtime queue, so this does not block the selected static atlas. A future queued Wall must receive separate layout validation; do not extrapolate active-role HUD acceptance to it.

Pillow strokes, glyph antialiasing and flutter are approximations of canvas rendering. Runtime checks must verify final helper selection, ready/fallback behavior, active themes and actual viewport composition. No production renderer or source file was changed by this review.

## Evidence

- `FINAL_PACKED_CONTACT_SHEET.png`: all 36 roles at native size with replacement/recovery labels.
- `packed-final/METRICS.json`, `INPUT_SHA256SUMS.txt`: independent source and packed reconstruction.
- `packed-final/source-vs-packed-native-01.png` through `04.png`: direct original versus persisted atlas.
- `packed-final/source-vs-packed-portraits.png`: commander resolution/detail comparison.
- `packed-final/packed-resource-states.png`: paired state-family view.
- `packed-final/packed-native-*.png`, `packed-value-*.png`: grass/light/dark and grayscale/silhouette review.
- `packed-final-crowd-and-keep-overlays.png`, `PACKED-FINAL_OVERLAY_METRICS.json`: existing-theme bounded comparison.
- `packed-building-attachment/building-attachment-01.png` through `03.png`: all nine additional buildings with fixed HUD and matched existing themes.
- `packed-hud-20/selected-crowd-old-vs-new.png`, `selected-three-factions-new.png`, `all-buildings-proposed.png`, `HUD_COMPARISON_METRICS.json`: accepted active-role proposal and explicit reserved-Wall limitation.
- `GOLD_REGISTRATION_INDEPENDENT.json`, `WOOD_REGISTRATION_INDEPENDENT.json`, `RECOVERED_REGISTRATION_INDEPENDENT.json`, `REPLACEMENT_BOOT_PIVOTS.json`: independent source placement measurements.
- `FINAL_RECIPE_RECONCILIATION.json`: final labels and rehashed geometry/source integrity.
