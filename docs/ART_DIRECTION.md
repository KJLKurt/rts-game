# Art direction and provenance

The production atlas in `public/assets/render/` contains 36 transparent sprites adapted from the user's supplied toy-3D reference sheet using image generation. It includes staged gold and timber deposits, relic states, six units, three commanders, and a matching set of buildings. This is a coherent seasonal fantasy set; its snow/holiday motifs are intentional characteristics of the supplied art.

The source was supplied for this project. Independent licensing was not verified, so it is not labeled CC0 or public domain. No commercial-game artwork was downloaded. Procedural terrain, flags, ground plates, selection effects, shadows, particles and UI icons were authored for the implementation.

## Integration contract

`frontier-atlas.json` contains tight frame rectangles and normalized ground anchors. Resolve its `image` path relative to the manifest itself. Preserve those rectangles and pivots; generated layouts are not a perfectly uniform grid. Scale by native aspect ratio so wide commanders and buildings are not stretched.

The 1254×1254 PNG has true alpha. Canvas compositing was inspected on terrain-colored panels for boxes, text, fringes and halos. Some nearly transparent pixels have saturated RGB values; correct alpha compositing handles them. Do not color-key costume reds or greens.

Units use 44–49-pixel baseline heights, commanders around57–65, with camera zoom applied afterward. Draw ground shadows separately. Team identity always uses colored ground markings plus distinct pennants/glyphs; holiday costume colors do not determine allegiance.

## Presentation animation

The atlas is single-view static artwork. The renderer adds directional mirroring, smooth position interpolation, stride bob, brief attack lean/recoil, hit feedback and projectile trails. These are genuine visible presentation effects, but they are not an authored eight-direction move/attack/defeat sprite set. Damage remains exclusively in the simulation, never animation events.

Reduced-motion mode removes decorative motion while retaining warnings, health, capture state and command feedback. Rush hazard circles use the exact projected radius of the simulation collision area.

## Replacement

To reskin, provide the same semantic frame IDs (see the JSON and `SpriteAtlas.ts`) and compatible ground anchors. Replace the manifest/image together and include both in the precache. A new themed terrain palette and audio manifest can be added independently. Do not mix disparate sprite styles without checking silhouette scale and small-screen readability.
