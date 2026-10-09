# Selected actor readability

Natural play exposed overlapping troop bodies and health bars. Existing foliage/structure fading helps environmental occlusion, but a selected troop's ground ring and health could still be covered by a foreground troop. This batch changes selection feedback without repainting troop bodies or changing their depth, opacity, picking, commands or simulation spacing.

A restrained marker pass runs after scene objects/events and before fog. It promotes the selected individual and the player's commander, with at most two health bars. Small selections promote up to 12 selected rings, plus the own-commander ring if separate; larger selections retain their existing depth-layer markers. A selected visible enemy can receive a selection cue in the generic renderer; hidden enemies, dead actors and respawning commanders cannot. Existing input eligibility remains unchanged.

Promoted markers replace their original annotations instead of duplicating bars. Their positions use the same interpolated world projection, with bounded separation when the two priority health bars overlap. Reduced motion adds no animation, and adaptive quality retains the same identity cues. No new controls, formation behavior or downloaded assets are introduced.

Acceptance records will distinguish controlled paired screenshots from an ordinary saved desktop sample. The controlled before path disables only promotion planning, restoring the original depth-layer marker path. Native input, body-hit records, fog exclusions and bounded 80/600-actor render submission timings are separate checks. Cloud Canvas2D timings do not establish physical-device FPS or GPU performance. The broader requirements overlay is in REQUIREMENTS_RECONCILIATION_20261009.md.

## Final reviewed candidate

Runtime fc-f928129217ac passed 842 unit tests in 77 files, TypeScript/content/build and all 45 focused native identities once in run 37880663180 (QA fb6803eac79813bcf191ad56eb34f57676534c92). No retries, skips or unexecuted cases. Full default browser collection is 629 cases in 50 files; it was not rerun.

The preceding candidate/run 37879540741 is preserved: 43 passes and two landscape fixture failures. Its fixed camera offset put the enemy behind the Attack toolbar. The fixture now uses measured toolbar clearance and normal toast expiry without weakening source-alpha, exact-ID picking or native touch clearance. Actual pixel review separately found a product issue: troop summaries covered priority indicators. Final source adds hard exclusions for at most two priority actors, including their ring-to-health area; the existing badge fallback moves or hides optional summaries. Actual painted badge geometry is checked in all three viewports.

All 16 final phone before/after frames were reviewed across both themes and orientations. Rings, priority health and identity remain visible; the short-landscape badge moves aside. The comparison disables only promotion planning, restoring the original annotation path for the same controlled paused scene. Body frames/transforms/opacity and 552 picking samples per selected actor remain identical. This is controlled rendering evidence, not naturally earned play.

Bounded timing uses separate 80- and 600-actor scenes, each with 16 warmup and 36 measured frames per mode, alternating order. All 12 project/theme/size comparisons passed the coarse baseline ×1.35 +1.5 ms guard. Final 600-actor median render-submission times range from 34.725 to 61.175 ms. These shared-cloud, main-thread Canvas2D measurements exclude GPU/compositing and physical-device thermals; they do not establish 60 FPS or a performance improvement. Raw samples are retained with the evidence.

An ordinary native Easy desktop skirmish was separately recruited and saved at 0:51 on the preceding live build for a hosted after-view. It is not a campaign win or a reconstructed historical save. The release receipt records its eventual comparison and preserved profile/expedition state.
