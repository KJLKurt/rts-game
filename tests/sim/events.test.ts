import { describe, expect, it } from 'vitest';
import { createGame, issueCommand, spawnEntity, stepGame, updateFog } from '../../src/sim';

describe('keep destruction alerts', () => {
    for (const team of [0, 1])
        it(`uses the correct possessive for team ${team}`, () => {
            const state = createGame({ seed: 'keep-alert' });
            state.players.forEach(p => p.ai = false);
            state.entities = state.entities.filter(e => e.kind === 'building');
            state.entities.forEach(e => e.damage = 0);
            const keep = state.entities.find(e => e.type === 'keep' && e.team === team)!;
            keep.hp = 1;
            const attacker = spawnEntity(state, 1 - team, 'unit', 'siege', keep.x + 4, keep.y);
            updateFog(state);
            expect(issueCommand(state, { type: 'attack', team: attacker.team, entityIds: [attacker.id], targetId: keep.id }).ok).toBe(true);
            stepGame(state, .1);
            const alert = state.events.find(e => e.type === 'alert' && e.team === team && e.text?.includes('Command Keep has fallen'));
            expect(alert?.text).toBe(team === 0 ? 'Your Command Keep has fallen!' : "Rival 1's Command Keep has fallen!");
        });
});
