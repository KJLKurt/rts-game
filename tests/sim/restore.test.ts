import { describe, it, expect } from 'vitest';
import { createGame, restoreGame, serializeGame, stepGame, issueCommand } from '../../src/sim';
const snapshot = () => JSON.parse(serializeGame(createGame({ seed: 'restore-fixture' })));
describe('save corruption and migration defenses', () => {
    it('reconstructs absent transient fog and navigation fields', () => { const raw = snapshot(); delete raw.fog; delete raw.entities[2].path; const restored = restoreGame(raw); expect(restored.fog.visible[0]).toHaveLength(restored.map.width * restored.map.height); expect(restored.entities[2].path).toEqual([]); expect(() => stepGame(restored, 1)).not.toThrow(); });
    it('rejects unknown commander, faction, biome, map size and mode IDs', () => {
        for (const key of ['commander', 'faction', 'biome', 'mapSize', 'mode']) {
            const raw = snapshot();
            raw.settings[key] = 'corrupt-content-id';
            expect(() => restoreGame(raw), key).toThrow(/settings/);
        }
    });
    it('rejects unknown entity types and nonfinite or off-map coordinates', () => { const raw = snapshot(); raw.entities[2].type = 'dragon'; expect(() => restoreGame(raw)).toThrow(/entities/); const second = snapshot(); second.entities[2].x = 9999; expect(() => restoreGame(second)).toThrow(/locations/); });
    it('rejects invalid queued abilities before a future resume can crash', () => { const raw = snapshot(); raw.paused = true; raw.pendingCommands = [{ type: 'ability', team: 0 }]; expect(() => restoreGame(raw)).toThrow(/queued order/); raw.pendingCommands = [{ type: 'build', team: 0, building: 'invented', x: 4, y: 5 }]; expect(() => restoreGame(raw)).toThrow(/queued order/); });
    it('retains valid tactical queues and applies them after loading', () => { const s = createGame(); issueCommand(s, { type: 'pause', team: 0, paused: true }); issueCommand(s, { type: 'recruit', team: 0, unit: 'swordsman' }); const restored = restoreGame(serializeGame(s)); expect(restored.pendingCommands).toHaveLength(1); issueCommand(restored, { type: 'pause', team: 0, paused: false }); expect(restored.pendingCommands).toHaveLength(0); });
    it('rejects malformed economy, production, fog, and resource records', () => { const a = snapshot(); a.players[0].gold = -10; expect(() => restoreGame(a)).toThrow(/player/); const b = snapshot(); b.entities[0].queue = [{ type: 'unit', id: 'unknown', total: 10, remaining: 5 }]; expect(() => restoreGame(b)).toThrow(/production/); const c = snapshot(); c.fog.visible[0] = []; expect(() => restoreGame(c)).toThrow(/fog/); const d = snapshot(); d.map.nodes[0].x = 999; expect(() => restoreGame(d)).toThrow(/resource/); });
    it('rejects duplicate entity IDs and invalid Rush Arena upgrades', () => { const a = snapshot(); a.entities[1].id = a.entities[0].id; expect(() => restoreGame(a)).toThrow(/IDs/); const b = JSON.parse(serializeGame(createGame({ mode: 'rush' }))); b.rush.upgrades = ['infinite-health']; expect(() => restoreGame(b)).toThrow(/upgrades/); });
});
