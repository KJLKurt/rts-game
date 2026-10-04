import { describe, expect, it } from 'vitest';
import { createGame, issueCommand, restoreGame, serializeGame, spawnEntity, stepGame, updateFog, type GameState, type Point } from '../../src/sim';

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
function fixture(commander = false) {
    const state = createGame({ seed: 'active-defense', difficulty: 'easy' });
    state.players.forEach(p => p.ai = false);
    state.map.tiles.fill('grass');
    state.entities = state.entities.filter(e => e.kind === 'building');
    state.entities.forEach(e => e.damage = 0);
    const node = state.map.nodes.find(n => n.kind === 'relic')!;
    const guard = spawnEntity(state, 0, commander ? 'commander' : 'unit', commander ? 'warlord' : 'swordsman', node.x, node.y);
    const home = { x: guard.x, y: guard.y };
    const ally = spawnEntity(state, 0, 'unit', 'cavalry', home.x, home.y + 2);
    ally.order = { type: 'hold' };
    ally.damage = 0;
    ally.hp = ally.maxHp = 10000;
    const enemy = spawnEntity(state, 1, 'unit', 'archer', home.x + 5.4, home.y + 2);
    enemy.hp = enemy.maxHp = 10000;
    enemy.order = { type: 'hold' };
    updateFog(state);
    const attack = (id = ally.id) => issueCommand(state, { type: 'attack', team: 1, entityIds: [enemy.id], targetId: id });
    return { state, node, guard, home, ally, enemy, attack };
}
function maximumDistance(state: GameState, guardId: string, home: Point, seconds: number) {
    let maximum = 0;
    for (let i = 0; i < seconds * 10; i++) {
        stepGame(state, .1);
        const guard = state.entities.find(e => e.id === guardId)!;
        maximum = Math.max(maximum, distance(guard, home));
    }
    return maximum;
}

describe('bounded retaliation against actual local attackers', () => {
    it('reacts to a ranged unit that actually damages the guard', () => {
        const { state, guard, home, enemy, attack } = fixture();
        enemy.y = home.y;
        expect(attack(guard.id).ok).toBe(true);
        stepGame(state, 3);
        expect(guard.hp).toBeLessThan(guard.maxHp);
        expect(distance(guard, home)).toBeGreaterThan(2);
        expect(enemy.hp).toBeLessThan(enemy.maxHp);
        expect(guard.guardAnchor).toEqual(home);
        expect(guard.order.type).toBe('idle');
    });

    it('wakes a Warlord and nearby soldiers to defend their guarded cluster', () => {
        const { state, guard, home, enemy, attack } = fixture(true);
        const soldier = spawnEntity(state, 0, 'unit', 'swordsman', home.x, home.y - .7);
        const soldierHome = { x: soldier.x, y: soldier.y };
        attack();
        stepGame(state, 3);
        expect(guard.hp).toBe(guard.maxHp); // It intervenes before being personally hit.
        expect(distance(guard, home)).toBeGreaterThan(2);
        expect(distance(soldier, soldierHome)).toBeGreaterThan(2);
        expect(enemy.hp).toBeLessThan(enemy.maxHp);
        expect(guard.guardAnchor).toEqual(home);
        expect(soldier.guardAnchor).toEqual(soldierHome);
    });

    it('does not wake for an unrelated visible camper or an attack order that has not fired', () => {
        const { state, guard, home, enemy, attack } = fixture();
        enemy.attackCooldown = 100;
        attack();
        stepGame(state, 5);
        expect(state.events.some(e => e.type === 'hit')).toBe(false);
        expect(distance(guard, home)).toBeLessThan(.01);
        expect(guard.targetId).toBeNull();
    });

    it('leaves a visible nonattacking camper outside the normal guard leash alone', () => {
        const { state, guard, home, enemy } = fixture(true);
        enemy.damage = 0;
        stepGame(state, 5);
        expect(state.events.some(e => e.type === 'hit')).toBe(false);
        expect(distance(guard, home)).toBeLessThan(.01);
        expect(enemy.hp).toBe(enemy.maxHp);
    });

    it('does not infer actual damage from a projectile stopped by invulnerability', () => {
        const { state, guard, home, ally, attack } = fixture();
        ally.invulnerableUntil = 100;
        attack();
        stepGame(state, 2);
        expect(state.events.some(e => e.type === 'projectile')).toBe(true);
        expect(state.events.some(e => e.type === 'hit')).toBe(false);
        expect(distance(guard, home)).toBeLessThan(.01);
    });

    it('can protect the cluster after an ally is killed by the first shot', () => {
        const { state, guard, home, ally, attack } = fixture(true);
        ally.hp = 1;
        attack();
        stepGame(state, 1.3);
        expect(state.entities.some(e => e.id === ally.id)).toBe(false);
        expect(distance(guard, home)).toBeGreaterThan(2);
        expect(guard.guardAnchor).toEqual(home);
    });

    it('ignores real attacks against friendly units outside the guarded cluster', () => {
        const { state, guard, home, ally, enemy, attack } = fixture();
        ally.y = home.y + 4;
        enemy.x = home.x + 4;
        enemy.y = home.y + 4;
        attack();
        stepGame(state, 4);
        expect(ally.hp).toBeLessThan(ally.maxHp);
        expect(distance(guard, home)).toBeLessThan(.01);
    });

    it('does not identify a hidden attacker from private hit attribution', () => {
        const { state, guard, home, ally, attack } = fixture();
        state.entities.filter(e => e.team === 0).forEach(e => e.vision = 1);
        updateFog(state);
        attack();
        stepGame(state, 3);
        expect(ally.hp).toBeLessThan(ally.maxHp);
        expect(distance(guard, home)).toBeLessThan(.01);
        expect(guard.targetId).toBeNull();
    });

    it('ignores an active attacker beyond 7.5 tiles from its unchanged anchor', () => {
        const { state, guard, home, ally, enemy, attack } = fixture();
        enemy.x = home.x + 8;
        enemy.y = home.y;
        enemy.range = 12; // Isolate the response bound from ordinary weapon range.
        attack();
        stepGame(state, 3);
        expect(ally.hp).toBeLessThan(ally.maxHp);
        expect(distance(guard, home)).toBeLessThan(.01);
    });

    it('does not pursue a source that died after its attributed hit', () => {
        const { state, guard, home, ally, enemy, attack } = fixture();
        attack();
        stepGame(state, .1);
        expect(ally.hp).toBeLessThan(ally.maxHp);
        enemy.hp = 0;
        stepGame(state, 3);
        expect(distance(guard, home)).toBeLessThan(.01);
        expect(guard.targetId).toBeNull();
    });

    it('keeps explicit Hold stationary while still allowing attacks within weapon range', () => {
        const { state, guard, home, enemy, attack } = fixture(true);
        issueCommand(state, { type: 'hold', team: 0, entityIds: [guard.id] });
        attack();
        stepGame(state, 3);
        expect(distance(guard, home)).toBeLessThan(.01);
        enemy.x = home.x + 1.5;
        enemy.y = home.y;
        stepGame(state, 1);
        expect(enemy.hp).toBeLessThan(enemy.maxHp);
        expect(distance(guard, home)).toBeLessThan(.01);
        expect(guard.order.type).toBe('hold');
    });

    it('caps pursuit at six tiles and returns after the attacker retreats beyond the response boundary', () => {
        const { state, guard, home, enemy, attack } = fixture();
        attack();
        stepGame(state, 2);
        expect(distance(guard, home)).toBeGreaterThan(2);
        enemy.x = home.x + 7.4;
        enemy.y = home.y;
        enemy.range = 10;
        let maximum = maximumDistance(state, guard.id, home, 3);
        enemy.x = home.x + 14;
        maximum = Math.max(maximum, maximumDistance(state, guard.id, home, 6));
        expect(maximum).toBeLessThanOrEqual(6.15);
        expect(distance(guard, home)).toBeLessThan(.31);
        expect(guard.guardAnchor).toEqual(home);
    });

    it('returns when damage stops for 2.5 seconds even if the former attacker remains visible', () => {
        const { state, guard, home, enemy, attack } = fixture();
        attack();
        stepGame(state, 2);
        expect(distance(guard, home)).toBeGreaterThan(2);
        enemy.damage = 0;
        enemy.attackCooldown = 100;
        stepGame(state, 6);
        expect(distance(guard, home)).toBeLessThan(.31);
        expect(guard.targetId).toBeNull();
    });

    it('does not chain its anchor outward when a second distant attacker joins', () => {
        const { state, guard, home, enemy, attack } = fixture();
        attack();
        stepGame(state, 2);
        enemy.damage = 0;
        enemy.x = home.x + 13;
        const second = spawnEntity(state, 1, 'unit', 'archer', home.x + 10, home.y);
        second.range = 12;
        second.hp = second.maxHp = 10000;
        updateFog(state);
        issueCommand(state, { type: 'attack', team: 1, entityIds: [second.id], targetId: guard.id });
        const maximum = maximumDistance(state, guard.id, home, 4);
        expect(maximum).toBeLessThanOrEqual(6.15);
        expect(distance(guard, home)).toBeLessThan(.31);
        expect(guard.guardAnchor).toEqual(home);
    });

    it('temporarily defends a completed Capture objective and then returns to its original point', () => {
        const { state, node, guard, home, enemy, attack } = fixture(true);
        node.owner = 0;
        issueCommand(state, { type: 'capture', team: 0, entityIds: [guard.id], nodeId: node.id });
        attack();
        stepGame(state, 3);
        expect(distance(guard, home)).toBeGreaterThan(2);
        expect(distance(guard, home)).toBeLessThanOrEqual(6.15);
        enemy.damage = 0;
        stepGame(state, 6);
        expect(distance(guard, home)).toBeLessThan(.31);
        expect(guard.order.type).toBe('capture');
        expect(guard.guardAnchor).toEqual(home);
        expect(node.owner).toBe(0);
    });

    it('records source and victim attribution without duplicating the hit or its damage', () => {
        const { state, ally, enemy, attack } = fixture();
        const before = ally.hp;
        attack();
        stepGame(state, .1);
        const hits = state.events.filter(e => e.type === 'hit' && e.entityId === ally.id);
        expect(hits).toHaveLength(1);
        expect(hits[0].sourceId).toBe(enemy.id);
        expect(hits[0].targetTeam).toBe(0);
        expect(before - ally.hp).toBeCloseTo(state.players[1].stats.damageDealt, 10);
        expect(hits[0].value).toBe(Math.round(before - ally.hp));
    });

    it('preserves attributed response and guard anchors across save/resume', () => {
        const { state, guard, home, attack } = fixture(true);
        attack();
        stepGame(state, 1.2);
        const loaded = restoreGame(serializeGame(state));
        expect(loaded.events.some(e => e.type === 'hit' && e.sourceId && e.targetTeam === 0)).toBe(true);
        stepGame(state, 2);
        stepGame(loaded, 2);
        expect(serializeGame(loaded)).toBe(serializeGame(state));
        expect(loaded.entities.find(e => e.id === guard.id)!.guardAnchor).toEqual(home);
    });

    it('anchors a revived commander at the keep instead of walking back to its death location', () => {
        const { state, guard, home } = fixture(true);
        guard.hp = 0;
        guard.respawnAt = .1;
        guard.guardAnchor = { ...home };
        stepGame(state, .1);
        const refuge = { x: guard.x, y: guard.y };
        expect(distance(refuge, home)).toBeGreaterThan(10);
        expect(guard.guardAnchor).toEqual(refuge);
        stepGame(state, 3);
        expect(distance(guard, refuge)).toBeLessThan(.01);
    });

    it('safely migrates missing anchors and never infers an attacker from legacy unattributed events', () => {
        const { state, guard, attack } = fixture(true);
        attack();
        stepGame(state, .1);
        const raw = JSON.parse(serializeGame(state));
        for (const entity of raw.entities) {
            delete entity.guardAnchor;
            if (entity.team === 1) entity.attackCooldown = 100;
        }
        for (const event of raw.events) {
            delete event.sourceId;
            delete event.targetTeam;
        }
        const loaded = restoreGame(raw), restoredGuard = loaded.entities.find(e => e.id === guard.id)!;
        const home = { x: restoredGuard.x, y: restoredGuard.y };
        expect(restoredGuard.guardAnchor).toEqual(home);
        stepGame(loaded, 3);
        expect(distance(restoredGuard, home)).toBeLessThan(.01);
        expect(restoredGuard.guardAnchor).toEqual(home);
        expect(restoredGuard.targetId).toBeNull();
    });
});
