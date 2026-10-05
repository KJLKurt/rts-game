# Map workshop

Open **Map workshop → Create a map** to begin with a playable seeded frontier. Workshop drafts are separate from the live battle, Continue save, and profile progress.

## Paint, navigate, and undo

- **Paint** draws terrain continuously along a held drag, including between sparse pointer events. Choose a one-, three-, or five-tile brush. Grass, forest, water, rock, sand, snow, road, and marsh are available.
- **Pan** moves the camera without painting. Two fingers always pan/zoom; adding the second finger cancels that gesture's unfinished stroke. Scroll or the zoom buttons changes the view. **Center map** brings the world back into reach.
- Tap once to place a building, unit, commander, neutral camp, resource, relic, or spawn. Placement errors explain terrain, edge, overlap, ownership, and clearance requirements. **Erase objects** removes entities, camps, and resources, preserving terrain/spawns.
- **Undo/Redo** covers whole strokes, placements, and settings changes, retaining 24 edits. Ctrl/⌘ Z undoes; Ctrl/⌘ Shift Z redoes. B selects Paint; P selects Pan.
- **Tools** collapses the palette to leave more visible map on a small screen.

## Complete battlefield settings

**Dimensions, biome & rules** opens an atomic settings form. Width and height each support 16–160 tiles. Resizing centers existing terrain and moves objects with it. Shrinks that would cut off an object are rejected without changing the draft. Biome changes replace the previous biome's primary ground.

Configure the map name, two to six player slots, faction, commander, personality/difficulty, alliances, human/AI/closed control, and starting forces. Only player one supports human control. Closed slots retain their spawn index. New slots need reachable spawns, gold, and timber; shrinking the slot list cannot silently delete occupied content.

Choose standard settlements plus placed extras, or only authored forces. The latter exposes Keep and commander placement. Palette options cover building levels, resource ownership/reserves, camp guard type/count/radius, and gold/wood rewards.

Victory supports Domination, Conquest, or Relic Race with pacing target, population ceiling, starting economy, game speed, income multiplier, and optional explicit score target. At most 600 population is configured across active slots; that is a safety budget, not a performance guarantee. Concentrated maximum armies can run slowly. Reduce population or player count on slower devices.

Allies cooperate in vision/combat and share victory while retaining separate economies and orders. A personally eliminated player can spectate surviving allies in ordinary matches. Scripted missions can require the local Keep to survive.

## Save, share, and test

**Save** creates or updates the current named entry in the device library. **Save a named copy** creates a separate entry. The library holds up to 24 maps with **Open** and **Clone** actions. **Open most recent saved map** also supports the older single-map save format.

**Export JSON** preserves terrain, entities, camps, slots, alliances, and rules. **Import map JSON** accepts current/legacy maps and rejects unsafe structures before replacing the draft. Structurally valid unfinished maps may be saved/exported/reopened.

**Validate** reports playability problems and warnings. **Test map** requires validation and launches a separate copy. **Return to workshop** is available in the HUD, pause menu, and test result. It restores the draft, camera, tools, selected player, and undo/redo history. Test changes are discarded and never replace Continue or earn profile progress.

Leaving the workshop preserves a return draft including camera/history. **Return to draft** supports reopening after reload. Hidden-page and consented-update handling save the draft; storage errors are shown. Export JSON remains the portable backup because browser storage can be cleared by the user or platform.

## Scope and evidence

Visual trigger authoring remains separate; campaign triggers use typed mission data. This workshop covers terrain, forces, camps, teams, and core victory/economy rules.

Local tests cover structure, placement geometry, preview hydration, complete round trips, named libraries, test bookmarks, and history. Browser scenarios in `tests/browser/workshop-complete.spec.ts` cover settings, named copies, test-return/reload, Pan/Paint, presets, slots, preview, and speed. A fresh reconstruction browser attempt was blocked before the page launched: Chromium could not create its process socket (`Operation not permitted`). None of these three new UI scenarios executed. Current source tests do not establish browser or physical-device usability; old pre-recovery totals are historical evidence only.
