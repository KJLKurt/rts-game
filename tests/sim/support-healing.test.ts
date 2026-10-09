import { describe, expect, it } from 'vitest';
import { createGame, issueCommand, restoreGame, serializeGame, spawnEntity, stepGame, updateFog } from '../../src/sim';

function lethalEncounter(team: number, commander = false, faction: 'ironhold' | 'arcanists' = 'ironhold') {
    const s = createGame({ seed: 'support-living-target', mapSize: 'medium', faction });
    s.players.forEach(p => p.ai = false);
    s.map.tiles.fill('grass');
    s.entities = s.entities.filter(e => e.kind === 'building');
    s.entities.forEach(e => e.damage = 0);
    // The attacker acts before the Mender in the same simulation tick.
    const attacker = spawnEntity(s, 1 - team, 'unit', 'swordsman', 24, 24);
    const victim = commander
        ? spawnEntity(s, team, 'commander', s.players[team].commander, 25, 24)
        : spawnEntity(s, team, 'unit', 'archer', 25, 24);
    const wounded = spawnEntity(s, team, 'unit', 'swordsman', 26, 25);
    const mender = spawnEntity(s, team, 'unit', 'support', 27, 24);
    attacker.damage = 100;
    victim.hp = 1;
    wounded.hp = 30;
    for (const e of [victim, wounded, mender]) {
        e.order = { type: 'hold' };
        e.damage = 0;
    }
    updateFog(s);
    expect(issueCommand(s, { type: 'attack', team: attacker.team, entityIds: [attacker.id], targetId: victim.id }).ok).toBe(true);
    return { s, attacker, victim, wounded, mender };
}

describe('Mender living-target eligibility', () => {
    for (const [team, faction, heal] of [[0, 'ironhold', 16], [1, 'ironhold', 16], [0, 'arcanists', 20]] as const)
        it(`does not revive a same-tick casualty, and still heals a living ally (${team}/${team === 1 ? 'wildborn' : faction})`, () => {
            const { s, attacker, victim, wounded, mender } = lethalEncounter(team, false, faction);
            const losses = s.players[team].stats.unitsLost;
            const kills = s.players[attacker.team].stats.kills;
            const livingBefore = s.entities.filter(e => e.team === team && e.kind === 'unit' && e.hp > 0).length;
            stepGame(s, .1);
            expect(s.events.filter(e => e.type === 'death' && e.entityId === victim.id)).toHaveLength(1);
            expect(s.entities.some(e => e.id === victim.id)).toBe(false);
            expect(s.players[team].stats.unitsLost).toBe(losses + 1);
            expect(s.players[attacker.team].stats.kills).toBe(kills + 1);
            expect(s.entities.filter(e => e.team === team && e.kind === 'unit' && e.hp > 0)).toHaveLength(livingBefore - 1);
            expect(wounded.hp).toBe(30 + heal);
            expect(mender.attackCooldown).toBe(1.5);
        });

    it('keeps a fallen commander dead until its scheduled respawn', () => {
        const { s, victim, wounded } = lethalEncounter(1, true);
        stepGame(s, .1);
        expect(victim.hp).toBe(0);
        expect(s.entities).toContain(victim);
        expect(victim.respawnAt).toBe(s.time + 24);
        expect(s.players[1].stats.commanderDeaths).toBe(1);
        expect(s.players[1].stats.unitsLost).toBe(0);
        expect(wounded.hp).toBe(46);
        stepGame(s, 1);
        expect(victim.hp).toBe(0);
        const restored = restoreGame(serializeGame(s));
        stepGame(restored, 22.9);
        expect(restored.entities.find(e => e.id === victim.id)?.hp).toBe(0);
        stepGame(restored, .1);
        const respawned = restored.entities.find(e => e.id === victim.id)!;
        expect(respawned.hp).toBe(respawned.maxHp);
        expect(respawned.respawnAt).toBeNull();
        expect(restored.players[1].stats.commanderDeaths).toBe(1);
    });

    it('does not spend a healing cooldown when only a fallen target needs healing', () => {
        const { s, victim, wounded, mender } = lethalEncounter(0);
        wounded.hp = wounded.maxHp;
        stepGame(s, .1);
        expect(s.entities.some(e => e.id === victim.id)).toBe(false);
        expect(s.events.filter(e => e.type === 'heal')).toHaveLength(0);
        expect(mender.attackCooldown).toBe(0);
    });
});
