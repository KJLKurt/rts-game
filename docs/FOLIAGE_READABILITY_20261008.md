# Local foliage readability — 8 October 2026

Runtime `fc-4b3559c7c391`, offline cache `41188eb65d28`. Previous live checkpoint: `fe1ec7cb4499350f8026ab3d194c4541daa43ff7` (`fc-5dd3992fdd55`).

## Problem and change

Ordinary Broken Alliance play exposed a Ranger whose body was hidden by foreground desert tree crowns. Original brief sections 4, 11, 33 and 34 require clear silhouettes, selection feedback, legible effects and faithful fog visibility. Decorative trees had bypassed existing structure/deposit visibility protection.

Trees now fade only when their painted canopy overlaps a live, already-visible actor behind them. Current authored sprite frames, pivots, stride, mirroring and recoil inform the overlap mask. A spatial lookup and cached alpha masks avoid repeated image readbacks after warm-up. Overlapping trees share a maximum cumulative foliage-opacity budget of 0.32; unrelated trees retain normal depth and opacity. Hidden, dead and respawning actors do not reveal themselves by fading foliage. Rocks and ruins are unchanged. Simulation, resources, saves, selection and picking semantics, assets and audio are byte-identical to the previous release.

Conservative two-pixel transformed mask rectangles and a bounds fallback for unavailable pixel reads can fade slightly more canopy than the exact opaque body. The opacity budget concerns tree layers, not total scene brightness under fog or other artwork.

## Evidence

- 793 unit tests in 74 files passed; TypeScript, content validation and production build passed.
- Focused native Chromium gate: [run 37853668260](https://github.com/KJLKurt/rts-game/actions/runs/37853668260), QA commit `657e5bfc8c303d808bcde14ffbd9bb8271f28dab`.
- 18 distinct identities passed on their first attempt, zero failures, retries, skips or unexecuted cases. Twelve new identities cover two foliage cases across Mythic/Christmas and desktop/phone portrait/phone landscape; six existing foreground-depot selection/attack identities also passed.
- Native inputs selected Ranger and several troop bodies, issued Move and observed displacement. Bounded renderer fixtures cover selected/unselected actors, visible/hidden enemies, death/respawn, foreground/background position, moving away, biomes, quality, reduced motion and zoom; authored-frame edge cases cover Cavalry, Archer, Spearman and Swordsman.
- Eight actual phone PNGs were visually reviewed: before/after in both themes and orientations. Bodies hidden in the opaque-tree comparison become readable, while unoccupied nearby trees remain opaque.
- These images use controlled forest tiles and production-generated decor/assets. The paired comparison temporarily forces tree opacity to 1 in the test, then restores the actual renderer. They are controlled gameplay-render captures, not natural-match evidence or generated concept art. No test override ships in production.
- Artifact 11582464006: 17,333,137 bytes; SHA256 `b757ebc0602ac849b0e0e23177a9957b53f559842238090a2f9c94c5a450bf48`.

The full default collection contains 569 identities in 47 files and is restored in released source; it was not rerun as a full matrix for this bounded renderer change. Phone checks use Chromium touch emulation, not physical phones or Safari. Whole-renderer, cold-cache and physical-device performance remain unverified. The helper-only synthetic benchmark is not an FPS claim.

## Preserved gameplay and open scope

The saved fresh Broken Alliance retry and separate Forager expedition are preserved. Prior Broken Alliance completion was an explicit player concession, not a combat-earned victory. No campaign completion or reward claim follows from these fixtures. Broken Alliance and later campaign victories, the four-battle expedition, broader art completion, subjective usability/listening and physical-device acceptance remain open. See the retained surrender, queued-construction and original requirements evidence for earlier results.
