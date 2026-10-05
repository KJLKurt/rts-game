import { describe, expect, it } from 'vitest';
import { areAllied, createGame, evaluateScriptCondition, getEconomyRates, issueCommand, restoreGame, serializeGame, spawnEntity, stepGame, updateFog, validateTriggers } from '../../src/sim';
import type { ScriptCondition, ScriptTrigger } from '../../src/sim';
function state() { const s = createGame({ seed: 'script-contract', mapGenerationVersion: 4, scriptedVictory: true }); s.players.forEach(p => p.ai = false); s.entities.forEach(e => e.damage = 0); return s; }
function trigger(when: ScriptCondition): ScriptTrigger { return { id: 'test', when, actions: [{ type: 'objective', text: 'Done' }] }; }

describe('declarative mission predicates and actions', () => {
    it('requires nested goals and counts completed buildings only', () => {
        const s = state(), house = spawnEntity(s, 0, 'building', 'house', 23.5, 25.5, false);
        const condition: ScriptCondition = { type: 'all', conditions: [
            { type: 'buildings', team: 0, building: 'house', count: 1 },
            { type: 'any', conditions: [{ type: 'units', team: 0, unit: 'cavalry', count: 1 }, { type: 'stat', team: 0, stat: 'kills', amount: 3 }] },
        ] };
        expect(evaluateScriptCondition(s, condition)).toBe(false); house.buildProgress = 1; expect(evaluateScriptCondition(s, condition)).toBe(false);
        s.players[0].stats.kills = 3; expect(evaluateScriptCondition(s, condition)).toBe(true); house.hp = 0; expect(evaluateScriptCondition(s, condition)).toBe(false);
    });
    it('requires each resource kind and current ownership', () => {
        const s = state(); s.map.nodes.forEach(n => n.owner = null);
        const gold = s.map.nodes.find(n => n.kind === 'gold')!, wood = s.map.nodes.find(n => n.kind === 'wood')!;
        const condition: ScriptCondition = { type: 'all', conditions: [{ type: 'owned', team: 0, kind: 'gold', count: 1 }, { type: 'owned', team: 0, kind: 'wood', count: 1 }] };
        gold.owner = 0; s.players[0].stats.captures = 30; expect(evaluateScriptCondition(s, condition)).toBe(false);
        wood.owner = 0; expect(evaluateScriptCondition(s, condition)).toBe(true); gold.owner = 1; expect(evaluateScriptCondition(s, condition)).toBe(false);
    });
    it('matches exact living entities, research levels and defeated players', () => {
        const s = state(), commander = s.entities.find(e => e.team === 0 && e.kind === 'commander')!;
        const location: ScriptCondition = { type: 'entityLocation', entityId: commander.id, x: commander.x, y: commander.y, radius: 1 };
        expect(evaluateScriptCondition(s, location)).toBe(true); commander.hp = 0; expect(evaluateScriptCondition(s, location)).toBe(false);
        expect(evaluateScriptCondition(s, { type: 'research', team: 0, technology: 'economy', level: 2 })).toBe(false);
        s.players[0].research.economy = 2; expect(evaluateScriptCondition(s, { type: 'research', team: 0, technology: 'economy', level: 2 })).toBe(true);
        s.players[1].defeated = true; expect(evaluateScriptCondition(s, { type: 'teamDefeated', team: 1 })).toBe(true);
    });
    it('blocks score and elimination shortcuts while honoring authored success', () => {
        const s = state(); s.players[0].score = s.scoreTarget * 2; s.players[1].defeated = true; stepGame(s, 1); expect(s.winner).toBeNull();
        s.triggers = [{ id: 'goals', when: { type: 'time', seconds: 2 }, actions: [{ type: 'victory', team: 0 }] }]; stepGame(s, 1);
        expect(s.winner).toBe(0); expect(s.victoryReason).toBe('Mission objectives complete');
    });
    it('preserves human loss before a simultaneous success predicate', () => {
        const s = state(); s.players[0].defeated = true;
        s.triggers = [{ id: 'goals', when: { type: 'time', seconds: 0 }, actions: [{ type: 'victory', team: 0 }] }];
        stepGame(s, .1); expect(s.winner).toBe(1); expect(s.triggers[0].fired).toBeUndefined();
    });
    it('defeat actions stop orders and release owned resources', () => {
        const s = state(); s.triggers = [{ id: 'loss', when: { type: 'time', seconds: 0 }, actions: [{ type: 'defeat', team: 0 }] }]; stepGame(s, .1);
        expect(s.players[0].defeated).toBe(true); expect(s.winner).toBe(1); expect(s.map.nodes.some(n => n.owner === 0 || n.captureTeam === 0)).toBe(false);
        expect(issueCommand(s, { type: 'recruit', team: 0, unit: 'swordsman' }).ok).toBe(false);
    });
    it('authored defeat takes precedence over later success actions in the tick', () => {
        const s = state(); s.triggers = [{ id: 'loss-first', when: { type: 'time', seconds: 0 }, actions: [{ type: 'defeat', team: 0 }, { type: 'victory', team: 0 }] }];
        stepGame(s, .1); expect(s.winner).toBe(1); expect(s.players[0].defeated).toBe(true);
    });
    it('alliance actions cancel friendly attacks and survive serialization', () => {
        const s = state(), first = spawnEntity(s, 0, 'unit', 'archer', 23.5, 24.5), other = spawnEntity(s, 1, 'unit', 'archer', 25.5, 24.5);
        first.damage = other.damage = 0; updateFog(s); expect(issueCommand(s, { type: 'attack', team: 0, entityIds: [first.id], targetId: other.id }).ok).toBe(true);
        s.triggers = [{ id: 'truce', when: { type: 'time', seconds: 0 }, actions: [{ type: 'alliance', team: 1, alliance: 0 }] }]; stepGame(s, .1);
        expect(areAllied(s, 0, 1)).toBe(true); expect(first.order.type).toBe('idle'); expect(areAllied(restoreGame(serializeGame(s)), 0, 1)).toBe(true);
    });
    it('fires rewards only once across save/resume', () => {
        const s = state(); s.triggers = [{ id: 'supplies', when: { type: 'time', seconds: .1 }, actions: [{ type: 'resources', team: 0, gold: 500, wood: 300 }] }];
        stepGame(s, .1); const resumed = restoreGame(serializeGame(s)), gold = resumed.players[0].gold; stepGame(resumed, 1);
        expect(resumed.players[0].gold - gold).toBeLessThan(50); expect(resumed.triggers[0].fired).toBe(true);
    });
    it('rejects empty/deep conditions, unknown stats, fields, teams and actions', () => {
        let deep: ScriptCondition = { type: 'time', seconds: 0 }; for (let i = 0; i < 8; i++) deep = { type: 'all', conditions: [deep] };
        const invalid = [trigger(deep), trigger({ type: 'all', conditions: [] }), { ...trigger({ type: 'time', seconds: 0 }), when: { type: 'stat', team: 0, stat: 'constructor', amount: 1 } }, { ...trigger({ type: 'time', seconds: 0 }), when: { type: 'units', team: 9, unit: 'archer', count: 1 } }, { ...trigger({ type: 'time', seconds: 0 }), actions: [{ type: 'alliance', team: 0, alliance: 99 }] }, { ...trigger({ type: 'time', seconds: 0 }), when: { type: 'time', seconds: 0, eval: 'true' } }];
        for (const candidate of invalid) expect(validateTriggers([candidate], { teamCount: 2 }).length).toBeGreaterThan(0);
    });
});

describe('explicit expedition player bonuses', () => {
    it('accelerates capture work only for the rewarded player', () => {
        const plain = createGame({ seed: 'capture-bonuses', mapGenerationVersion: 4 });
        const boosted = createGame({ seed: 'capture-bonuses', mapGenerationVersion: 4, modifiers: { players: { 0: { captureSpeed: 2 } } } });
        for (const s of [plain, boosted]) {
            s.players.forEach(player => player.ai = false); s.entities = s.entities.filter(entity => entity.kind === 'building');
            for (const team of [0, 1]) { const node = s.map.nodes.find(node => node.owner === team && node.kind === 'gold')!; node.owner = null; spawnEntity(s, team, 'unit', 'swordsman', node.x, node.y); }
            stepGame(s, 10);
        }
        const nodeFor = (s: typeof plain, team: number) => s.map.nodes.find(node => node.kind === 'gold' && Math.hypot(node.x - s.map.spawns[team].x, node.y - s.map.spawns[team].y) < 5)!;
        expect(nodeFor(boosted, 0).owner).toBe(0); expect(nodeFor(plain, 0).owner).toBeNull(); expect(nodeFor(boosted, 1).owner).toBeNull(); expect(nodeFor(boosted, 1).captureProgress).toBeCloseTo(nodeFor(plain, 1).captureProgress);
    });
    it('adds resources and boosts only the selected player', () => {
        const plain = createGame({ seed: 'bonuses', mapGenerationVersion: 4 });
        const boosted = createGame({ seed: 'bonuses', mapGenerationVersion: 4, modifiers: { players: { 0: { income: 2, captureSpeed: 2, startingGold: 120, startingWood: 70, health: 1.2, damage: 1.1 } } } });
        expect(boosted.players[0].gold - plain.players[0].gold).toBe(120); expect(boosted.players[1].gold).toBe(plain.players[1].gold);
        expect(boosted.players[0].wood - plain.players[0].wood).toBe(70); expect(boosted.players[1].wood).toBe(plain.players[1].wood);
        expect(getEconomyRates(boosted, 1)).toEqual(getEconomyRates(plain, 1)); expect(getEconomyRates(boosted, 0).goldPerSecond).toBeGreaterThan(getEconomyRates(plain, 0).goldPerSecond);
        const commander = (s: typeof plain, team: number) => s.entities.find(e => e.team === team && e.kind === 'commander')!;
        expect(commander(boosted, 0).maxHp).toBeCloseTo(commander(plain, 0).maxHp * 1.2); expect(commander(boosted, 1).maxHp).toBe(commander(plain, 1).maxHp);
        expect(restoreGame(serializeGame(boosted)).settings.modifiers?.players?.[0]?.income).toBe(2);
    });
    it('rejects malformed bonus recipients and values', () => {
        const raw = JSON.parse(serializeGame(state())); raw.settings.modifiers = { players: { 7: { income: 2 } } }; expect(() => restoreGame(raw)).toThrow(/modifiers/);
        raw.settings.modifiers = { players: { 0: { health: 0 } } }; expect(() => restoreGame(raw)).toThrow(/modifiers/);
        raw.settings.modifiers = { players: { 0: { startingGold: '100' } } }; expect(() => restoreGame(raw)).toThrow(/modifiers/);
    });
});

describe('mission personal survival', () => {
    it('a temporary alliance cannot rescue a mission after the player keep falls', () => {
        const s = state(); s.players[1].alliance = 0; s.players[0].defeated = true;
        s.triggers = [{ id: 'success', when: { type: 'time', seconds: 0 }, actions: [{ type: 'victory', team: 0 }] }]; stepGame(s, .1);
        expect(s.winner).toBe(1); expect(s.triggers[0].fired).toBeUndefined();
    });
});
