import { describe, expect, it } from 'vitest';
import { createGame, issueCommand, restoreGame, serializeGame, spawnEntity, stepGame, updateFog, type GameState, type Point } from '../../src/sim';

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
function objectiveFixture() {
    const state = createGame({ seed: 'SCOUT-LIVE-002', mapSize: 'small', duration: 8, difficulty: 'easy' });
    state.players.forEach(p => p.ai = false);
    // Isolate the order semantics; the live seed does not imply a terrain cause.
    state.map.tiles.fill('grass');
    state.entities = state.entities.filter(e => e.kind === 'building');
    state.entities.forEach(e => e.damage = 0);
    const node = state.map.nodes.find(n => n.kind === 'relic')!;
    const army = [
        spawnEntity(state, 0, 'unit', 'swordsman', node.x - 4, node.y),
        spawnEntity(state, 0, 'unit', 'spearman', node.x - 4, node.y + 1),
        spawnEntity(state, 0, 'unit', 'archer', node.x - 4, node.y - 1),
        spawnEntity(state, 0, 'commander', 'warlord', node.x - 5, node.y),
    ];
    issueCommand(state, { type: 'capture', team: 0, entityIds: army.map(e => e.id), nodeId: node.id });
    stepGame(state, 10);
    expect(node.owner).toBe(0);
    return { state, node, army };
}
function bait(state: GameState, point: Point) {
    const enemy = spawnEntity(state, 1, 'unit', 'swordsman', point.x + 2, point.y);
    enemy.order = { type: 'hold' };
    enemy.damage = 0;
    enemy.hp = enemy.maxHp = 10000;
    updateFog(state);
    return enemy;
}

describe('Capture orders secure and guard their objective', () => {
    it('anchors the whole arrived army and commander while claiming the relic', () => {
        const { node, army } = objectiveFixture();
        for (const unit of army) {
            expect(unit.order.type).toBe('capture');
            expect(unit.guardAnchor).toEqual({ x: node.x, y: node.y });
            expect(distance(unit, node)).toBeLessThan(2.2);
        }
    });

    it('defends a captured relic without following retreating bait out of its two-tile leash', () => {
        const { state, node, army } = objectiveFixture(), enemy = bait(state, node);
        let maximum = 0;
        for (let tick = 0; tick < 160; tick++) {
            enemy.x = node.x + 2 + tick * .06;
            stepGame(state, .1);
            for (const unit of army) maximum = Math.max(maximum, distance(unit, node));
        }
        expect(enemy.hp).toBeLessThan(enemy.maxHp); // Defense still fights real threats.
        expect(maximum).toBeLessThanOrEqual(2.15);
        expect(node.owner).toBe(0);
        for (const unit of army) {
            expect(unit.order.type).toBe('capture');
            expect(distance(unit, node)).toBeLessThan(.7); // Formation separation is allowed.
        }
    });

    it('keeps explicit attack-move aggressive after leaving a capture assignment', () => {
        const { state, node, army } = objectiveFixture(), sword = army[0], enemy = bait(state, node);
        expect(issueCommand(state, { type: 'attackMove', team: 0, entityIds: [sword.id], x: node.x + 12, y: node.y }).ok).toBe(true);
        expect(sword.guardAnchor).toBeUndefined();
        for (let tick = 0; tick < 100; tick++) {
            enemy.x = node.x + 2 + tick * .06;
            stepGame(state, .1);
        }
        expect(distance(sword, node)).toBeGreaterThan(5);
        expect(sword.order.type).toBe('attackMove');
    });

    it('returns old captured troops from outside the leash and persists the anchor on save/load', () => {
        const { state, node, army } = objectiveFixture();
        const raw = JSON.parse(serializeGame(state));
        for (const unit of raw.entities.filter((e: { team: number; kind: string }) => e.team === 0 && e.kind !== 'building')) {
            unit.x = node.x + 5;
            unit.y = node.y;
            delete unit.guardAnchor;
        }
        const loaded = restoreGame(raw);
        stepGame(loaded, .1);
        for (const unit of loaded.entities.filter(e => army.some(a => a.id === e.id)))
            expect(unit.guardAnchor).toEqual({ x: node.x, y: node.y });
        const resumed = restoreGame(serializeGame(loaded));
        stepGame(loaded, 5);
        stepGame(resumed, 5);
        expect(serializeGame(resumed)).toBe(serializeGame(loaded));
        for (const unit of loaded.entities.filter(e => army.some(a => a.id === e.id)))
            expect(distance(unit, node)).toBeLessThan(.7);
    });

    it('allows an incoming reinforcement to route around an obstacle to an already-owned objective', () => {
        const { state, node } = objectiveFixture();
        for (let y = Math.floor(node.y) - 3; y <= Math.floor(node.y) + 3; y++)
            state.map.tiles[y * state.map.width + Math.floor(node.x) - 4] = 'water';
        const reinforcement = spawnEntity(state, 0, 'unit', 'swordsman', node.x - 6, node.y);
        issueCommand(state, { type: 'capture', team: 0, entityIds: [reinforcement.id], nodeId: node.id });
        stepGame(state, 15);
        expect(distance(reinforcement, node)).toBeLessThan(.7);
        expect(reinforcement.guardAnchor).toEqual({ x: node.x, y: node.y });
    });

    it('retains its objective anchor if ownership changes and can recapture the point', () => {
        const { state, node, army } = objectiveFixture();
        node.owner = 1;
        stepGame(state, 7);
        expect(node.owner).toBe(0);
        for (const unit of army)
            expect(unit.guardAnchor).toEqual({ x: node.x, y: node.y });
    });
});
