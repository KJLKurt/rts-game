# Frontier Command production art

## Deliverables

- `frontier-atlas.png`: production 1254×1254 true-alpha RGBA atlas, 36 sprites, 2.3 MB.
- `frontier-atlas.json`: exact source rectangles, normalized ground anchors, category and suggested display height.
- `atlas-proofsheet.png` / `.pdf`: transparency and gameplay-size QA. Green panels are proofsheet background only, never in the source sprite.
- `preview.html`: standalone Canvas2D atlas viewer; serve this folder to inspect in a browser.
- `build_metadata.py`: reproducible alpha component analysis. Reads source PNG, writes metadata only. Does not edit source pixels.
- `render_proofsheet.py`: PDF QA document rendering. Does not edit source pixels.

## Production integration

Copy PNG and JSON together into the repository's public asset directory; e.g. `public/assets/render/`. Resolve both through Vite `import.meta.env.BASE_URL` so GitHub Pages `/frontier-command/` remains supported. Include PNG and JSON in offline precache.

JSON shape:

```
{ "image": "frontier-atlas.png", "width": 1254, "height": 1254,
  "frames": { "swordsman": { "x":843,"y":445,"w":174,"h":187,
                 "anchorX":0.5,"anchorY":0.96,"category":"unit","suggestedHeight":44 } } }
```

`x,y,w,h` are tight source rectangles. `anchorX,anchorY` are normalized coordinates within that rectangle at which to place the sprite's world ground position. They deliberately differ for units and static structures. Do not derive frames from a uniform grid: generated rows are not exactly uniform.

Display height should determine width from `w / h`. Avoid independently stretching width and height. Suggested base scale: infantry44–49px high, commanders57–65px high, cavalry/siege44–49px high. Warlord and engineer have broad silhouettes and need72–80px width at commander scale. Fortresses and resource art can use fit-to-envelope rendering. Add soft ellipse shadows separately below characters; sprites have minimal ambient occlusion rather than strong cast shadows.

## Frame inventory

Resource stages:
- `gold-full`, `gold-half`, `gold-sparse`, `gold-empty`
- `wood-full`, `wood-half`, `wood-sparse`, `wood-empty`

Suggested stage thresholds relative to original resource amount: >0.67 full; >0.33 half; >0 sparse; <=0 empty. Keep depleted nodes visible, with empty/stump visuals, so depletion is legible. Gold can have a brief single sparkle on harvesting; avoid continuous noisy particles on every node.

Objectives:
- `relic-neutral`, `relic-contested`, `relic-captured`, `relic-inactive`
- `camp-guarded`, `camp-cleared`
- `mining-cue`, `chopping-cue` (best as UI/economy cues, not extra large map props)

Units:
- `swordsman`, `spearman`, `archer`, `cavalry`, `siege`, `support`
- `warlord`, `ranger`, `engineer`

Buildings:
- `keep`, `house`, `barracks`, `range`, `stable`, `workshop`, `tower`, `depot`, `blacksmith`, `arcane`, `wall`

## Team readability

The source costumes contain reds and greens, so costume color must never indicate team identity by itself. Add all of:
1. Team-colored ground ring or plate.
2. Distinct shape glyph on a small team pennant/crest (friendly circle/chevron, enemy diamond, neutral square).
3. Contrasting selection outline/healthbar border and selected unit portrait/team text in UI.

Suggested player palettes: cyan `#65d7ff`, coral `#ff9067`, violet `#c6a4ff`, amber `#ffe28a`. Retain shape differentiation with color-blind settings. Draw rings/pennants at readable sizes and use one consistent team signal on buildings and units. Team rings should remain separate from the holiday red/green costume colors.

## Animation and effects

Sprites are one-angle static art, not multi-direction animation sheets. Horizontal flip by travel direction is supported visually. Add mild positional bob only when moving (1–2px infantry; less for siege), a short attack lean, damage flash, and projectile trail. Use ease-out recoil rather than constant scale pumping. Avoid bobbing buildings. Reduced-motion mode should remove bob/shake but preserve attack/capture indicators.

## Provenance and selection rationale

All nine source images were supplied by the user. Do not label them CC0 or public domain: independent licensing was not verified. No commercial-game assets were downloaded or copied.

Selected source: `9dd83781-0453-4565-a619-7e68facd2898.jpeg` (1440²). It is the most coherent complete toy-3D set, with 36 matching objects and strong small-screen silhouettes. Source contains Christmas/winter styling, preserved intentionally rather than mixing three incompatible styles.

Other inspected inputs:
- `51cf41f0…`: nine detailed more-realistic units, white background.
- `5afed023…`: twelve detailed buildings, white background.
- `682e5034…`: cartoon outlined resource/relic sheet, white background.
- `7b7fe2f6…`: realistic full atlas, dark background and baked labels.
- `acbab107…`: toy-3D resources/relics, white background.
- `b091613e…`: strongly outlined cartoon units, white background.
- `c7f9ac06…`: realistic resource/relic sheet, white background.
- `e37e8c8d…`: strongly outlined cartoon full atlas, dark background/labels.

Production PNG was created with OpenAI's built-in `image_gen.imagegen` in background-extraction/edit mode, from the selected user-supplied sheet, with transparent_background=true. The model preserved/refined all 36 subjects and removed dark backing and baked labels. No Python/ImageMagick background-removal or pixel editing was performed. Only source-alpha analysis and rectangular renderer frame selection were used after generation.

Generated output: `exec-dc4c2caa-8f71-4077-a5c8-7a24746e3ba8.png`, preserved under the generation directory and copied unmodified into this folder.

The exact generation prompt is in `generation-prompt.txt`.

## Verification and limitations

- Verified PNG mode RGBA, 1254², alpha range0–255.
- Verified36 substantial sprite components,36metadata frames, all within image bounds.
- Composited proofsheet has no visible background boxes, text, white fringes, or colored edge halos.
- Inspected gameplay-scale silhouettes on green terrain; units/commanders remain distinguishable by equipment.
- Some transparent-edge RGB values are saturated colors with alpha1–2/255. Native viewers displaying RGB without proper alpha may misleadingly show speckles. Ordinary alpha compositing is correct; do not apply a color-key shader or remove red pixels.
- Sprite sheet has one view and no skeletal or directional animation. Sprite color does not distinguish factions; team overlays must.
- Seasonal snow/holiday styling is present in the supplied assets and retained in this pass. If the full game's art direction becomes non-seasonal, create a dedicated coherent replacement sheet rather than recoloring individual pieces inconsistently.
