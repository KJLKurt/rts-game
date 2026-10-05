import { describe, expect, it } from 'vitest';
import { areAllied, canPlayerContinue, competitivePlayers, createGame, getEconomyRates, isVisible, issueCommand, playerAllianceWon, playerOutcomeStatus, restoreGame, serializeGame, spawnEntity, stepGame, updateFog } from '../../src/sim';
import type { GameMap, MapPlayerSlot, GameState } from '../../src/sim';

const slots = (): MapPlayerSlot[] => [0, 1, 2].map(team => ({ name: `Side ${team}`, controller: team === 0 ? 'human' : 'ai', alliance: team < 2 ? 0 : 2, faction: 'ironhold', commander: 'warlord', personality: 'defensive', difficulty: 'easy' }));
function mapWithScenario(camp = false): GameMap {
    const map = structuredClone(createGame({ seed: 'scenario-fixture', mapGenerationVersion: 4, mapSize: 'medium', aiPlayers: 2 }).map);
    map.tiles.fill('grass');
    map.scenario = { version: 1, slots: slots(), rules: { mode: 'domination', duration: 18, populationCap: 80, startingGold: 230, startingWood: 260, startingForces: 'standard' }, startingEntities: [], camps: camp ? [{ id: 'watch-camp', x: 24.5, y: 24.5, unit: 'swordsman', count: 1, radius: 3, rewardGold: 75, rewardWood: 40 }] : [] };
    return map;
}
function setup(camp = false): GameState {
    const state = createGame({ customMap: mapWithScenario(camp), mapGenerationVersion: 4 });
    state.players.forEach(player => player.ai = false);
    state.entities.forEach(entity => entity.damage = 0);
    return state;
}
function clearTroops(state: GameState) { state.entities = state.entities.filter(entity => entity.kind === 'building' || entity.campId); }

describe('scenario ownership, alliances and camps', () => {
    it('keeps closed indices stable and neutralizes their starting deposits', () => {
        const map = mapWithScenario(); map.scenario!.slots[1].controller = 'closed';
        const state = createGame({ customMap: map });
        expect(state.players.map(p => p.team)).toEqual([0, 1, 2]);
        expect(state.players[1]).toMatchObject({ closed: true, defeated: true, ai: false });
        expect(state.entities.some(e => e.team === 1)).toBe(false);
        expect(state.map.nodes.some(n => n.owner === 1)).toBe(false);
        expect(competitivePlayers(state).map(p => p.team)).toEqual([0, 2]);
        expect(restoreGame(serializeGame(state)).players[1].closed).toBe(true);
    });
    it('hydrates authored IDs, building levels and only authored forces', () => {
        const map = mapWithScenario(); map.scenario!.rules.startingForces = 'authored';
        map.scenario!.startingEntities = map.spawns.map((spawn, team) => ({ id: `fort-${team}`, team, kind: 'building', type: 'keep', buildingLevel: 3, ...spawn }));
        map.scenario!.startingEntities.push({ id: 'e100', team: 0, kind: 'unit', type: 'archer', x: 24.5, y: 25.5 });
        const state = createGame({ customMap: map });
        expect(state.entities).toHaveLength(4);
        expect(state.entities.find(e => e.id === 'fort-0')).toMatchObject({ buildingLevel: 3 });
        expect(state.entities.find(e => e.id === 'fort-0')!.maxHp).toBeGreaterThan(1500);
        state.nextId = 100;
        expect(spawnEntity(state, 0, 'unit', 'spearman', 25.5, 25.5).id).toBe('e101');
        expect(restoreGame(serializeGame(state)).entities.find(e => e.id === 'e100')?.type).toBe('archer');
    });
    it('rejects friendly fire and never acquires an allied target', () => {
        const state = setup(); clearTroops(state);
        const first = spawnEntity(state, 0, 'unit', 'swordsman', 24.5, 24.5), ally = spawnEntity(state, 1, 'unit', 'swordsman', 25.1, 24.5);
        updateFog(state); const hp = ally.hp;
        expect(issueCommand(state, { type: 'attack', team: 0, entityIds: [first.id], targetId: ally.id })).toMatchObject({ ok: false });
        stepGame(state, 2);
        expect(ally.hp).toBe(hp); expect(first.targetId).toBeNull();
    });
    it('shares allied vision while keeping hostile sight private', () => {
        const state = setup(); state.entities = [];
        spawnEntity(state, 1, 'unit', 'archer', 24.5, 24.5); spawnEntity(state, 2, 'unit', 'archer', 45.5, 45.5);
        state.map.nodes.forEach(node => node.owner = null); updateFog(state);
        expect(isVisible(state, 0, 24.5, 24.5)).toBe(true);
        expect(isVisible(state, 0, 45.5, 45.5)).toBe(false);
        expect(isVisible(state, 2, 24.5, 24.5)).toBe(false);
    });
    it('combines allied capture pressure and preserves an allied owner', () => {
        const state = setup(); clearTroops(state);
        const node = state.map.nodes.find(node => node.kind === 'relic')!; node.owner = null;
        const first = spawnEntity(state, 0, 'unit', 'swordsman', node.x, node.y), second = spawnEntity(state, 1, 'unit', 'swordsman', node.x + .7, node.y);
        first.damage = second.damage = 0; stepGame(state, 10);
        expect(node.owner).toBe(0); expect(state.players[0].stats.captures).toBe(1);
        node.owner = 1; stepGame(state, 20);
        expect(node.owner).toBe(1); expect(state.players[0].stats.captures).toBe(1);
    });
    it('uses a shared score total without multiplying points per ally', () => {
        const state = setup(); clearTroops(state);
        const relics = state.map.nodes.filter(node => node.kind === 'relic'); relics.forEach((node, index) => node.owner = index % 2);
        const count = relics.length, rate = count === 1 ? .5 : count === 2 ? 1 : 1.4 + (count - 3) * .3;
        stepGame(state, 1); expect(state.players[0].score + state.players[1].score).toBeCloseTo(rate);
        state.players[0].score = state.scoreTarget / 2; state.players[1].score = state.scoreTarget / 2; stepGame(state, .1);
        expect(state.winner).toBe(0); expect(playerAllianceWon(state, 1)).toBe(true);
    });
    it('supports spectator saves after personal elimination and awards the team win', () => {
        const state = setup(true); state.players[0].defeated = true;
        expect(canPlayerContinue(state)).toBe(true); expect(playerOutcomeStatus(state)).toBe('spectating');
        const resumed = restoreGame(serializeGame(state)); resumed.players[2].defeated = true; stepGame(resumed, .1);
        expect(resumed.winner).toBe(0); expect(playerOutcomeStatus(resumed)).toBe('won');
        expect(resumed.players.at(-1)?.neutral).toBe(true);
    });
    it('neutral guards contest deposits without income or capturing', () => {
        const state = setup(true); clearTroops(state);
        const neutral = state.players.at(-1)!, camp = state.entities.find(e => e.campId)!;
        const node = state.map.nodes.find(n => n.kind === 'relic')!; node.x = camp.x; node.y = camp.y; node.owner = null;
        const soldier = spawnEntity(state, 0, 'unit', 'swordsman', camp.x + .8, camp.y); soldier.damage = 0; stepGame(state, 20);
        expect(node.owner).toBeNull(); expect(node.captureProgress).toBe(0);
        expect(neutral).toMatchObject({ gold: 0, wood: 0, score: 0, ai: false });
        expect(getEconomyRates(state, neutral.team).goldPerSecond).toBe(0);
        expect(issueCommand(state, { type: 'move', team: neutral.team, x: 10, y: 10 }).ok).toBe(false);
    });
    it('pays a cleared camp once to the final attacker across save/resume', () => {
        const state = setup(true); clearTroops(state);
        const camp = state.entities.find(e => e.campId)!; camp.hp = 1;
        const attacker = spawnEntity(state, 1, 'unit', 'archer', camp.x + 1, camp.y); updateFog(state);
        const before = state.players[1].gold;
        expect(issueCommand(state, { type: 'attack', team: 1, entityIds: [attacker.id], targetId: camp.id }).ok).toBe(true); stepGame(state, .1);
        expect(state.camps![0]).toMatchObject({ cleared: true, defeatedBy: 1 }); expect(state.players[1].gold - before).toBeGreaterThanOrEqual(75);
        expect(state.events.some(event => event.subtype === 'campCleared' && event.team === 1)).toBe(true);
        const resumed = restoreGame(serializeGame(state)), gold = resumed.players[1].gold; stepGame(resumed, .1);
        expect(resumed.players[1].gold - gold).toBeLessThan(10);
    });
    it('rejects malformed or missing camp state', () => {
        for (const mutate of [
            (state: GameState) => { delete state.camps; },
            (state: GameState) => { state.players.at(-1)!.neutral = false; },
            (state: GameState) => { state.camps![0].rewardGold += 5; },
            (state: GameState) => { state.entities.find(e => e.campId)!.team = 0; },
        ]) { const state = setup(true); mutate(state); expect(() => restoreGame(serializeGame(state))).toThrow(/neutral camp|neutral defender/); }
    });
    it('preserves legacy saves without adding new flags', () => {
        const resumed = restoreGame(serializeGame(createGame({ mapGenerationVersion: 3 })));
        expect(areAllied(resumed, 0, 1)).toBe(false); expect(resumed.camps).toBeUndefined();
    });
    it('preserves legal pre-budget v3/v4 population ceilings', () => {
        for (const version of [3, 4] as const) {
            const legacy = createGame({ seed: 'legacy-six-slots', mapGenerationVersion: version, aiPlayers: 5, populationCap: 100 });
            legacy.settings.populationCap = 120; legacy.players.forEach(player => player.maxPopulation = 120);
            const resumed = restoreGame(serializeGame(legacy));
            expect(resumed.settings.populationCap).toBe(120); expect(resumed.players.every(player => player.maxPopulation === 120)).toBe(true); expect(resumed.players).toHaveLength(6);
        }
    });
});

describe('fair AI scenario rules', () => {
    it('uses slot difficulty without changing costs or resources', () => {
        const map = mapWithScenario(); map.scenario!.slots[1].difficulty = 'easy'; map.scenario!.slots[2].difficulty = 'brutal';
        const state = createGame({ customMap: map }); state.players[1].aiNextThink = state.players[2].aiNextThink = 0; stepGame(state, .1);
        expect(state.players[1].aiNextThink).toBeCloseTo(4.3); expect(state.players[2].aiNextThink).toBeCloseTo(.9);
        const spent = (team: number, resource: 'gold' | 'wood') => state.entities.filter(entity => entity.team === team).flatMap(entity => entity.queue).reduce((total, job) => total + (job.paidCost?.[resource] ?? 0), 0);
        expect(state.players[1].gold + spent(1, 'gold')).toBeCloseTo(state.players[2].gold + spent(2, 'gold'));
        expect(state.players[1].wood + spent(1, 'wood')).toBeCloseTo(state.players[2].wood + spent(2, 'wood'));
    });
    it('spends surplus on real building upgrades while retaining reserves', () => {
        const state = setup(), player = state.players[1]; player.ai = true; player.gold = 5000; player.wood = 5000; player.research.economy = 1; player.aiNextThink = 0;
        const at = state.map.spawns[1];
        for (const type of ['range', 'blacksmith', 'workshop'] as const) spawnEntity(state, 1, 'building', type, at.x - 2, at.y - 4);
        for (let i = 0; i < 4; i++) spawnEntity(state, 1, 'unit', 'spearman', at.x - 1, at.y - 1);
        state.time = 300; state.tick = 3000; stepGame(state, .1);
        expect(state.commandLog.some(entry => entry.command.type === 'upgradeBuilding')).toBe(true); expect(player.gold).toBeLessThan(5000); expect(player.wood).toBeLessThan(5000);
        expect(state.entities.some(entity => entity.team === 1 && entity.queue.some(job => job.type === 'buildingUpgrade' && job.paidCost!.gold > 0))).toBe(true);
    });
    it('keeps Rush a two-player arena with v5 team settings selected', () => {
        const state = createGame({ mode: 'rush', mapGenerationVersion: 5, mapSize: 'colossal', slots: slots(), neutralCamps: 2 });
        expect(state.settings.mode).toBe('rush'); expect(state.rush).toBeDefined(); expect(state.players).toHaveLength(2);
        expect(state.map.scenario).toBeUndefined(); expect(state.camps).toBeUndefined(); expect(restoreGame(serializeGame(state)).rush?.surviveUntil).toBe(240);
    });
});
