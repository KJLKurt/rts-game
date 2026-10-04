# Legacy simulation fixtures

`outpost-3937eef-3s.json` is an actual plain-JSON save emitted by the engine from deployed commit `3937eefceefcb5b9dc1f27fe24279f909f8c9ceb`, before idle guard anchors were added. It is not a current save with fields deleted.

Reproduction: load that commit's `src/sim` modules, call `createGame` with the authored `outpost` mission settings, clone its triggers and copy its briefing to `objectiveText`, issue `{type: 'move', team: 0, x: 7, y: 20}`, advance three seconds, then call `serializeGame`. No army commands, invulnerability, or resource/stat edits were applied.

The snapshot catches all four idle starter troops pursuing the enemy Ranger, with persisted target/path state and one already-damaged archer. None has `guardAnchor`. The current migration must anchor those troops at their saved positions exactly once, retain damage/economy/map data, and remain deterministic across a second save/restore. It must not heal an already injured army or silently relocate it to its original spawn.
