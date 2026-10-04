# Rendering and combat feedback

`Battlefield` reads the simulation and paints a Canvas2D isometric view. It never
issues commands, changes health, resolves hits, or creates simulation events.

## What is animated

The baseline atlas contains one original cutout for each unit. Its movement is a
presentation treatment: horizontal facing, a small walking cadence, and optional
sprite transforms. It is **not** an eight-direction locomotion sheet or a full
set of authored combat/death frames.

The optional attack-only trial adds four authored attack poses for Warlord,
Swordsman and Archer, while preserving original idle/walking art and all missing-
asset fallbacks. See `ATTACK_ANIMATION_TRIAL.md` for exact scope, fixed scales,
pivots, event timing, provenance and remaining browser validation. No walking
strip is enabled.

Combat feedback is synchronized to simulation events:

- `attack` triggers a short directional melee lunge, recovery, and swipe arc.
- `projectile` triggers ranged recoil and a brief directional projectile trace.
- The end of an existing attack cooldown can produce a small anticipation pose,
  but only when the tracked target remains in range. The first attack has no
  invented windup; the engine attacks immediately.
- `hit` triggers an independent short hit pulse. Commander blows can show their
  actual event damage number; ordinary army hits avoid a cloud of text.
- `death` produces a temporary falling/fading copy of the last-seen silhouette,
  dust, and a crossed-out team crest. These are non-gory transforms of existing
  art, not authored death sprites. Fallen silhouettes are not selectable and do
  not block movement.

The engine currently applies damage immediately when it emits an attack. The
brief projectile trace is cosmetic, not a delayed damage carrier. The renderer
never postpones the actual health display or applies a second hit on arrival.

## Bounded, private-to-the-view state

`CombatFeedback` keeps recent attack, hit, casualty, and last-seen-entity records.
Each collection is capped at 256 entries. Attacks, hits, and casualties expire in
under two seconds, and observations of removed/hidden entities are discarded.
Events are consumed only once. An event skipped while hidden does not replay
when fog later reveals its location. Switching matches or rewinding a save
clears all presentation records.

The presentation clock interpolates at most one 100 ms simulation step for
smooth effects. Tactical pause freezes that clock. All simulation data remains
unchanged, which is covered by tests.

## Reduced motion

Reduced motion removes attack lunges, recoil movement, falling rotations,
traveling projectiles, dust motion, and floating damage-number travel. Stable hit
marks, brief aim streaks, fading casualty silhouettes, health, team crests, and
critical Rush warning areas remain visible. Damage and hazard timing are
unchanged.

## Checks

Run `npx vitest run tests/render/combat-feedback.test.ts` for event ordering,
visibility, interpolation, tactical pause, anticipation, bounded storage,
casualty expiry, match reset, and read-only simulation guarantees. Browser
verification is still required for visual quality; these tests do not establish
that new image assets are stylistically consistent or properly registered.

## Resource and relic touch picking

Resource/relic painting and picking share the same sprite name, native aspect,
size and ground-pivot geometry. Tapping a tall relic star, treetop or upper gold
formation therefore targets its node rather than the unrelated ground behind it.
A quarter-resolution alpha mask is cached once per atlas to avoid selecting
transparent upper corners; a six-CSS-pixel touch tolerance preserves usability.
If image readback is unavailable, registered sprite bounds remain the fallback.

Overlapping entity/node silhouettes follow the same front-to-back depth as the
renderer. Equal-depth hits use the nearest visual centre. Outside silhouettes,
the existing capture-radius hit area is preserved and resolves to the nearest
node, independent of map array order. Nodes still require explored terrain;
public minimap relic landmarks do not reveal hidden world targets or enemy units.
Tests in `tests/render/node-picking.test.ts` cover upper art, zoom, overlaps,
alpha holes, fog, absent art, and ground fallback.
