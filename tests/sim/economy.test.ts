import { describe, expect, it } from 'vitest';
import { createGame, getCommander, getEconomyRates, issueCommand, serializeGame, spawnEntity, stepGame, FIXED_STEP, type GameState } from '../../src/sim';

const quiet = (settings: Parameters<typeof createGame>[0] = {}) => {
    const state = createGame({ seed: 'economy-tests', ...settings });
    state.players.forEach(player => player.ai = false);
    return state;
};
const ownGold = (state: GameState) => state.map.nodes.find(node => node.owner === 0 && node.kind === 'gold')!;
const ownWood = (state: GameState) => state.map.nodes.find(node => node.owner === 0 && node.kind === 'wood')!;

describe('shared pure economy rates', () => {
    it('reports initial rates per game-second and live owned deposit counts without mutation', () => {
        const state = quiet(), before = serializeGame(state);
        const rate = getEconomyRates(state);
        expect(rate.goldPerSecond).toBeCloseTo(2.55);
        expect(rate.woodPerSecond).toBeCloseTo(2.8);
        expect(rate.goldDeposits).toBe(1);
        expect(rate.woodDeposits).toBe(1);
        expect(rate.withdrawals).toHaveLength(2);
        expect(serializeGame(state)).toBe(before);
        const stock = state.players[0].gold;
        stepGame(state, FIXED_STEP);
        expect(state.players[0].gold - stock).toBeCloseTo(rate.goldPerSecond * FIXED_STEP);
    });

    it('retains only the scaled passive stipend with no owned deposits', () => {
        const state = quiet({ biome: 'forest', modifiers: { income: 0 } });
        state.map.nodes.forEach(node => node.owner = null);
        state.players[0].research.economy = 2;
        state.escalation = 2;
        const rate = getEconomyRates(state);
        expect(rate).toEqual({ goldPerSecond: .9, woodPerSecond: .9, goldDeposits: 0, woodDeposits: 0, withdrawals: [] });
    });

    it('updates after a real capture and removes income immediately on losing ownership', () => {
        const state = quiet(), node = state.map.nodes.find(n => n.owner === null && n.kind === 'gold')!;
        const commander = getCommander(state)!;
        commander.x = node.x;
        commander.y = node.y;
        expect(issueCommand(state, { type: 'capture', team: 0, nodeId: node.id }).ok).toBe(true);
        stepGame(state, 10);
        expect(node.owner).toBe(0);
        expect(getEconomyRates(state).goldDeposits).toBe(2);
        expect(getEconomyRates(state).goldPerSecond).toBeCloseTo(4.65);
        node.owner = 1;
        expect(getEconomyRates(state).goldDeposits).toBe(1);
        expect(getEconomyRates(state).goldPerSecond).toBeCloseTo(2.55);
        expect(getEconomyRates(state, 1).goldDeposits).toBe(2);
    });

    it('caps a nearly exhausted deposit to its final partial tick and emits depletion once', () => {
        const state = quiet(), node = ownGold(state);
        node.amount = .04;
        const before = state.players[0].gold;
        const rate = getEconomyRates(state);
        expect(rate.goldPerSecond).toBeCloseTo(.85);
        expect(rate.goldDeposits).toBe(1);
        expect(rate.withdrawals.find(w => state.map.nodes[w.nodeIndex].id === node.id)!.amount).toBe(.04);
        expect(getEconomyRates(state, 0, 1).goldPerSecond).toBeCloseTo(.49);
        stepGame(state, .1);
        expect(state.players[0].gold - before).toBeCloseTo(.085);
        expect(node.amount).toBe(0);
        expect(getEconomyRates(state).goldPerSecond).toBe(.45);
        expect(getEconomyRates(state).goldDeposits).toBe(0);
        stepGame(state, .2);
        expect(state.events.filter(e => e.type === 'alert' && e.text?.includes('Gold mine depleted'))).toHaveLength(1);
    });

    it('combines research, biome and income modifiers only on resource deposits', () => {
        const state = quiet({ biome: 'forest', modifiers: { income: 1.4 } });
        state.players[0].research.economy = 2;
        state.escalation = 2;
        const rate = getEconomyRates(state);
        expect(rate.goldPerSecond).toBeCloseTo(.9 + 2.1 * 1.5 * 1.08 * 1.4);
        expect(rate.woodPerSecond).toBeCloseTo(.9 + 2.35 * 1.5 * 1.08 * 1.4);
    });

    it('uses only an active living friendly depot strictly within seven tiles, with no stacking', () => {
        const state = quiet(), node = ownGold(state);
        const depot = spawnEntity(state, 0, 'building', 'depot', node.x + 2, node.y, false);
        depot.buildProgress = .99;
        expect(getEconomyRates(state).goldPerSecond).toBeCloseTo(2.55);
        depot.buildProgress = 1;
        expect(getEconomyRates(state).goldPerSecond).toBeCloseTo(.45 + 2.1 * 1.35);
        depot.hp = 0;
        expect(getEconomyRates(state).goldPerSecond).toBeCloseTo(2.55);
        depot.hp = depot.maxHp;
        depot.team = 1;
        expect(getEconomyRates(state).goldPerSecond).toBeCloseTo(2.55);
        depot.team = 0;
        depot.x = node.x + 7;
        expect(getEconomyRates(state).goldPerSecond).toBeCloseTo(2.55);
        depot.x -= .001;
        spawnEntity(state, 0, 'building', 'depot', node.x + 1, node.y);
        expect(getEconomyRates(state).goldPerSecond).toBeCloseTo(.45 + 2.1 * 1.35);
    });

    it('adds Conquest relic stipends through escalation without counting relics as deposits', () => {
        const state = quiet({ mode: 'conquest', modifiers: { income: 0 } });
        state.escalation = 2;
        state.map.nodes.filter(n => n.kind === 'relic').slice(0, 2).forEach(n => n.owner = 0);
        const rate = getEconomyRates(state);
        expect(rate.goldPerSecond).toBe((.45 + 2 * .6) * 2);
        expect(rate.woodPerSecond).toBe((.45 + 2 * .35) * 2);
        expect(rate.goldDeposits).toBe(1);
        expect(rate.woodDeposits).toBe(1);
        state.settings.mode = 'domination';
        expect(getEconomyRates(state).goldPerSecond).toBe(.9);
        expect(getEconomyRates(state).woodPerSecond).toBe(.9);
    });

    it('distinguishes income from stockpile spending and unrelated purchase queues', () => {
        const state = quiet(), before = getEconomyRates(state), gold = state.players[0].gold;
        expect(issueCommand(state, { type: 'recruit', team: 0, unit: 'swordsman' }).ok).toBe(true);
        expect(state.players[0].gold).toBeLessThan(gold);
        expect(getEconomyRates(state)).toEqual(before);
        expect(issueCommand(state, { type: 'research', team: 0, technology: 'economy' }).ok).toBe(true);
        expect(getEconomyRates(state)).toEqual(before);
        stepGame(state, 36); // Keep trains the queued swordsman before the 25s research.
        expect(getEconomyRates(state).goldPerSecond).toBeCloseTo(.45 + 2.1 * 1.25);
    });

    it('keeps displayed game-second rates during pause while accrual and deposits stop', () => {
        const state = quiet(), rate = getEconomyRates(state), gold = state.players[0].gold, remaining = ownGold(state).amount;
        expect(issueCommand(state, { type: 'pause', team: 0, paused: true }).ok).toBe(true);
        stepGame(state, 20);
        expect(state.time).toBe(0);
        expect(state.players[0].gold).toBe(gold);
        expect(ownGold(state).amount).toBe(remaining);
        expect(getEconomyRates(state)).toEqual(rate);
    });

    it('accrues by simulation seconds independently of rendering or playback speed', () => {
        const normal = quiet(), fast = quiet(), chunks = quiet(), startingGold = normal.players[0].gold;
        for (let i = 0; i < 10; i++) stepGame(normal, .1);
        for (let i = 0; i < 10; i++) stepGame(fast, .2); // same wall-frame count at 2x speed
        for (let i = 0; i < 20; i++) stepGame(chunks, .1);
        expect(normal.time).toBe(1);
        expect(fast.time).toBe(2);
        expect(fast.players[0].gold - startingGold).toBeCloseTo((normal.players[0].gold - startingGold) * 2);
        expect(getEconomyRates(fast)).toEqual(getEconomyRates(normal));
        expect(fast.players).toEqual(chunks.players);
        expect(fast.map.nodes).toEqual(chunks.map.nodes);
    });

    it('returns no economic activity for defeated teams, missing teams or Rush Arena', () => {
        const state = quiet();
        state.players[0].defeated = true;
        const zero = { goldPerSecond: 0, woodPerSecond: 0, goldDeposits: 0, woodDeposits: 0, withdrawals: [] };
        expect(getEconomyRates(state)).toEqual(zero);
        expect(getEconomyRates(state, 99)).toEqual(zero);
        expect(getEconomyRates(createGame({ mode: 'rush' }))).toEqual(zero);
        expect(() => getEconomyRates(state, 0, 0)).toThrow(RangeError);
        expect(() => getEconomyRates(state, 0, Infinity)).toThrow(RangeError);
    });

    it('matches exact financial outputs recorded from frozen engine 3089403', () => {
        // Golden values generated using that commit's unchanged simulation modules.
        // The fixture combines fractional depletion, depot/research/biome/modifier,
        // Conquest income and changing escalation across 37 actual fixed ticks.
        const state = quiet({ seed: 'economy-parity', biome: 'forest', mode: 'conquest', duration: 4, modifiers: { income: 1.4 } });
        state.entities = state.entities.filter(e => e.kind === 'building');
        state.players[0].research.economy = 2;
        const [gold, wood, extra] = state.map.nodes;
        gold.amount = .13;
        wood.amount = .61;
        extra.owner = 0;
        extra.amount = 3.14159;
        state.map.nodes.find(n => n.kind === 'relic')!.owner = 0;
        spawnEntity(state, 0, 'building', 'depot', extra.x + 1, extra.y);
        state.tick = 1500;
        state.time = 150;
        state.escalation = 1.175;
        stepGame(state, 3.7);
        expect(state.players.map(p => ({ gold: p.gold, wood: p.wood, goldCollected: p.stats.goldCollected, woodCollected: p.stats.woodCollected }))).toEqual([
            { gold: 237.87952374999998, wood: 264.1208066666667, goldCollected: 7.879523750000001, woodCollected: 4.120806666666667 },
            { gold: 243.7230687500001, wood: 275.1216687499999, goldCollected: 13.72306875, woodCollected: 15.121668750000003 },
        ]);
        expect(state.map.nodes.map(n => n.amount)).toEqual([0, 0, 0, 820.8, 672.251760000002, 670.8531599999998, 820.8, 820.8, 0, 0, 0, 1231.2, 1231.2, 1231.2, 1231.2]);
        expect(state.nextEventId).toBe(19);
    });
});
