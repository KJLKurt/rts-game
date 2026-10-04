# Attack animation trial

This candidate addition is separate from the browser-accepted core checkpoint
`4afcfbd`. It enables **attack poses only** for Warlord, Swordsman and Archer.
It is not a complete animated-unit or eight-direction sprite system.

## Enabled art and playback

The production manifest references 12 accepted images: four attack poses for
three actors. The immutable RGBA PNG also contains unused walking rows, but the
production manifest has empty walk arrays and omits their frame records. The
live loader exposes only `attackFrame`, and its draw method refuses walking or
another actor's frame. Ordinary locomotion, idle, missing states, and casualties
continue to use the original atlas and procedural fallback.

The shared fixed southeast view is mirrored for the opposite screen direction.
All frames retain their original aspect ratio. Each actor uses one constant
body scale, rather than shrinking the whole sprite when a weapon is raised:

| Actor | Body height | Source reference height | Scale |
| --- | ---: | ---: | ---: |
| Warlord | 55 px | 146 px | 55 / 146 |
| Swordsman | 44 px | 171 px | 44 / 171 |
| Archer | 36 px | 155 px | 36 / 155 |

Each source cell is drawn around its explicit pixel `groundPivot`; that pivot
lands exactly on the entity's ground point. Procedural bob, stretch, lunge,
rotation and hit displacement are suppressed while an authored attack frame is
shown, so they cannot compound the pose or move its registered feet.

## Timing and fallback

- Poses 0 and 1 are ready/windup. They appear only during the end of an existing
  attack cooldown while the target remains in range.
- Pose 2 is release/impact. It begins on the existing simulation attack or
  projectile event. First attacks correctly skip an invented windup.
- Pose 3 is recovery. At its end, the original idle/walk treatment returns.
- No health, attack cooldown, command or simulation event is created or changed
  by this system. Damage remains immediate and exclusively simulation-owned.
- Reduced motion keeps the original static art and stable hit feedback instead
  of switching pose frames.
- An absent manifest, invalid metadata, incompatible image dimensions or failed
  image decode leaves ordinary rendering fully available. The optional atlas
  loads asynchronously; startup never waits for it.

## Validation and remaining review

The generated PNG was visually inspected against the original atlas and at
native gameplay scale. Body scale, silhouette isolation, pose order and ground
registration were reviewed. Archer's body scale was reduced to avoid inflating
it relative to the original tall-bow idle image.

Automated renderer tests cover the actual production manifest, all actor/frame
pivot calculations, fixed body scale, anticipation/release/recovery transitions,
idle fallback, absent assets, invalid metadata, decode failure, reduced motion,
refusal of walk frames, and refusal of cross-actor frames. They do not replace
live browser playback review. This trial has not yet been published or verified
as a running browser animation.

## Provenance

- Generated specifically for Frontier Command with built-in `image_gen.imagegen`
  on 2026-10-04, using the existing approved project atlas as the identity and
  style reference. No external account, paid API, commercial-game sprite source
  or API credential was used.
- The PNG is the unchanged final generated RGBA output. Source pixels were not
  manually cropped, painted or flattened. Source rectangles in the JSON select
  the accepted cells.
- PNG dimensions: 1024 × 1536.
- PNG SHA-256:
  `664b416192cbd297655a63fd8ec048f1b79030b35b3c0af7a3fc9ecd4073758f`
- Reference atlas SHA-256:
  `7a6c1f79fece96ce65464831cb161b6a4fb60c098afaf3717b271812b20f87ed`
- The three generation passes are preserved in
  `ANIMATION_GENERATION_PROMPTS.json`.
- Do not infer a public-domain or CC0 license merely from generated or
  user-provided provenance.

Walking rows remain deliberately unaccepted: their leg alternation is subtle,
particularly for Archer, and no polished four-phase gait is claimed.
