# Editor names and pending achievements

## Evidence and intended behavior

On the deployed b277e214 build, ordinary workshop input reproduced a lost rename: paint a tile, enter a new inline map name, then Undo. The terrain reverted and the unrelated name silently reverted too. The same desktop pass verified paint strokes, pan, save/reopen, a 96x80 authored map, and a 60-minute test-map return. A separate natural 13:56 skirmish defeat awarded Watchful Commander after prior concessions had advanced its progress without awarding it; reload retained exactly one result.

This batch captures the inline name before Undo/Redo rebuilds the editor. New history entries record whether the transaction itself changed the name: terrain-only edits preserve the current name; an explicit settings rename remains part of its undoable settings transaction. Optional name flags extend the existing version-1 history format; older saved histories retain their original full-map semantics. Blank names block the operation with a validation message and leave the history intact, including the keyboard shortcut path.

Visible, unearned achievements at their target now explain: “Progress recorded. Awarded after you finish another battle without surrender.” Hidden achievements stay secret and earned cards retain their earned date. No reward, surrender, simulation, or asset behavior changes.

## Validation status

Focused history tests cover inline rename across undo/redo/reload, explicit settings rename, legacy history, malformed flags, and bounded history. View tests exercise below/at/above target, earned/hidden cards, and surrender-to-ordinary-defeat behavior against the existing reward policy. Native browser and visual acceptance receipts will be recorded after execution; this document does not claim a pending test has passed.

Physical phones/Safari, long maximum-map matches, full current browser matrix, later campaign chapters, full expedition, and broader art/balance acceptance remain open.
