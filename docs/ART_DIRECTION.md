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

## Faction identity overlay pass

Ironhold uses a tower crest and riveted square steel trim; Wildborn uses branching antlers, carved timber and forked standards; Arcanists uses a faceted rune crystal and geometric brass/crystal motifs. These original Canvas/SVG overlays are defined in `src/render/factionIdentity.ts` and repeat in the setup legend and Credits / About. They preserve the existing atlas, role silhouettes, team-colored ground plates and health bars. They are a coherent shared-atlas treatment, not three independent animated sprite sets.

Six team glyphs (cross, diamond, circle, square, triangle and saltire) and six colors identify allegiance independently of the faction motifs. The crest paths are cached. This pass has renderer contract tests, but new actual-browser pixel review is still required; see `docs/PRESENTATION_GAPS_QA.md`.

## Complete Mythic static set and directional Ranger batch

The Christmas artwork described above remains the default and is unchanged. Settings can switch to a second complete Mythic toy-3D set: navy/teal fabrics, aged brass, oak, warm ore and turquoise relics. Its 36 semantic roles match the original manifest; portraits and deck cards use the active atlas. A whole static/attack/directional set loads before an atomic swap. A failed or superseded load retains the previous working set. All shipped files are included in the scoped offline cache.

Mythic Ranger has sixteen authored screen-heading slots with one idle and four walk poses each. The world facing vector is projected into the isometric screen compass; these poses are drawn without western mirroring. Locomotion frames follow measured travel, stop on idle, and reduced motion keeps the appropriate idle heading. Adjacent headings can look similar at the native 59px body height. The other eight actors still use the shared static/procedural treatment. Existing simulation attack events drive recoil/projectiles; there is no newly authored directional bow attack, hit or death sequence. Generated bow sheets failed aim-direction review and remain excluded.

Per-frame metadata measures teal hood centre, ground-contact boot and hood-to-ground body height to keep generated source scale variation from changing native body size. Packing copies the accepted generated RGBA rectangles unchanged, leaves a transparent gutter and verifies each rectangle hash. The 2048×2048 packed atlas decodes to16 MiB; its PNG is6.1 MB. The complete Mythic image working set is approximately22 MiB RGBA. This byte budget is not a physical-phone performance result. Native browser screenshots, walk sampling and frame-gallery review are in the batch QA handoff.

See [VISUAL_CONTENT_INVENTORY_20261005.md](VISUAL_CONTENT_INVENTORY_20261005.md) for mandatory-versus-qualified original scope, later active theme/style/frame commitments and exact shipped coverage. Theme choice currently changes figure/building/deposit art; terrain rules and existing soundtrack are shared. Four other theme families, realistic/sticker styles, themed music and complete actor/directional attack coverage remain open.
