# Hollow Lanterns: Halloween static art and music

Candidate `fc-fc75c030c578` adds a third complete selectable static-art family and matching six-state soundtrack. Local 981 unit tests in 83 files and the content/TypeScript/build checks pass. The focused native gate and exact previous-live update case are planned, not yet accepted. Current live rollback is `32f1d4eabc582b1d50d85a460f2ca21ec2ae4ae2` / `fc-8228b96098aa`.

## Authored content

Hollow Lanterns uses pumpkin armor, a raven-cloaked Ranger, crooked timber and violet roofs, autumn groves, gold mines and crystal lantern relics. All 36 semantic static roles are newly authored: nine actors, eleven building images, eight resource stages, four relic states, two camps and two work cues. Arcane, wall, both camps, both cues and inactive relic are reserved atlas roles without current Battlefield callers. Their presence does not add playable systems.

All original generated RGBA images, exact prompts, output IDs, alternate/rejected samples and hashes are retained. Spearman v1 failed proportion review; v2 is selected. A raw Tower preview appeared to have a halo, but correct RGBA compositing established that the color was invisible beneath alpha zero. That correction and both Tower versions remain in the evidence. The preferred Tower is v1.

The production atlas is 1200×1200 RGBA: 1,629,809 compressed bytes and 5,760,000 decoded bytes. Uniform premultiplied-alpha resampling and measured frame/pivot transforms are explicit in `scripts/pack_halloween_atlas.py` and `HALLOWEEN_ART_PACKING.json`. This static packing process differs from older directional packs whose accepted frame pixels were copied without resampling. Original source images are unchanged. No palette-only recolor, mirroring or manual silhouette/alpha repair creates the new authored set.

Offline independent review verified all 36 IDs, original hashes, full resized RGBA blocks, packed/readback frame hashes and clean cell gutters. Source-to-packed role cues, three 220×180 commander portraits and bounded crowded proxies were inspected. Tower and Blacksmith receive transparent frame padding so their bodies clear the unchanged fixed health bars. The Swordsman retains the normal 45px height. Gold/wood/relic ground-baseline spread stays below 0.07 CSSpx. These are inspection proxies; native gameplay and physical-device acceptance remain separate.

## Original soundtrack

| State | Title | Duration |
|---|---|---:|
| Menu | The Lanternkeeper’s Gate | 40s loop |
| Exploration | Lanterns Through the Pumpkin Rows | 60s loop |
| Tension | Footsteps Beyond the Haystacks | 40s loop |
| Combat | The Scarecrow Procession | 60s loop |
| Victory | First Light at the Harvest Fair | 7.5s finite coda |
| Defeat | The Last Ember in the Field | 10s finite coda |

The sample-free 96 BPM scores use hollow wood plucks, reeds, glass harmonics and dry harvest percussion. Twelve Ogg/MP3 files total 6,151,863 bytes; the approved exploration/combat pilots remain byte-identical. All 18 master/codec formats passed exact decoded-length, stereo, clipping, DC and headroom checks. Signal plots, loop joins and finite tails were inspected. A separate offline model exercised 4,800 transition cases without clipping; this is not browser execution or subjective listening. Tension’s lossy-codec seam curvature is approximately 4× the local percentile with steps below −62 dBFS; the retained combat MP3 caveat remains documented.

Both new Python modules under `scripts/audio` are portable together and preserve accepted pilot hashes. Existing Christmas/Mythic art, codecs, composers and simulation remain byte-identical. Theme selection uses the existing atomic visual switch followed by the matching audio bank; global three-entry decode/two-source budgets and exact-zero volume behavior are unchanged. Credits now list all eighteen actual score titles and the static-animation boundary.

## Planned bounded runtime acceptance

One normal isolated QA workflow will exercise 18 eligible identities: all-role actual renderer galleries/credits, native crowd selection and exact-ID Move/save across three themes, failed/superseded loads, offline persistence, all 36 codec decodes and Halloween’s native audio signal/lifecycle contracts. Six deliberate phone skips for desktop-only failure/offline identities remain explicit. One sequential existing cache-upgrade case will build the exact previous live commit and verify all 52 non-map dist hashes before consent/update/order-preservation testing. No retries or early failure masking are configured. Default full QA settings remain in release source.

This is a complete Halloween static-art-and-music milestone only. Authored directional animation, realistic/sticker styles, space/old-time/Street Kids families, unfinished natural campaign/Expedition routes, uncoached usability and physical-device/Safari/listening acceptance remain open. The historical full644 result is still 608 passed, 10 failed and 26 skipped; no focused result rewrites it.
