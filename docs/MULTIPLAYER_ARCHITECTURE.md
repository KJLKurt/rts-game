# Multiplayer extension path

No multiplayer or networking backend is shipped. The engine is intentionally presentation-free and driven by typed commands, fixed ticks, seeded random state, and serializable snapshots. AI and human orders use the same validation path.

A future authoritative server can accept `{tick, playerId, sequence, command}`, validate team ownership, order commands deterministically, and periodically send snapshots/hashes. Clients should interpolate render positions without mutating simulation truth. Preserve command IDs for retries and acknowledgments, and test command reordering, disconnect/rejoin, version mismatches, and snapshot integrity.

Current JavaScript floating-point and iteration behavior is deterministic within the supported runtime tests, not a proven cross-platform lockstep protocol. Before peer lockstep, replace ambiguous numerical paths or use an authoritative simulation. Do not trust client-side debug hooks, fog, resource costs, or local saves in a competitive server.

Rush is currently solo survival. It could support co-op through the same command interface, but needs explicit shared upgrades, revive rules, ownership, and network-safe lifecycle work.
