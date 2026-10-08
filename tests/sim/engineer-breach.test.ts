import { describe, expect, it } from 'vitest';
import { COMMANDERS, createGame, getCommander, issueCommand, projectPendingCommands, restoreGame, serializeGame, spawnEntity, stepGame, tileIndex, updateFog, type Entity, type GameCommand, type GameState, type Point } from '../../src/sim';
import { BREACH_DAMAGE, BREACH_RANGE, findBreachTarget } from '../../src/sim/ability-targeting';

function fixture() {
    const state = createGame({ seed: 'engineer-breach', commander: 'engineer', mapSize: 'small', neutralCamps: 0 });
    state.players.forEach(player => { player.ai = false; player.population = 0; });
    const commander = getCommander(state)!;
    state.entities = state.entities.filter(entity => entity === commander || entity.type === 'keep');
    Object.assign(commander, { x: 20, y: 20, guardAnchor: { x: 20, y: 20 }, order: { type: 'hold' } });
    for (const entity of state.entities) {
        entity.attackCooldown = 1000;
        if (entity.type === 'keep') Object.assign(entity, entity.team === 0 ? { x: 5, y: 5 } : { x: 35, y: 35 });
    }
    updateFog(state);
    return { state, commander };
}

function building(state: GameState, team = 1, x = 25, y = 20) {
    const target = spawnEntity(state, team, 'building', 'tower', x, y);
    target.attackCooldown = 1000;
    updateFog(state);
    return target;
}

function breach(state: GameState, point?: Partial<Point>) {
    return issueCommand(state, { type: 'ability', team: 0, ability: 'breach', ...(point ? { x: point.x, y: point.y } : {}) });
}

function rejectsWithoutChanges(state: GameState, point?: Partial<Point>) {
    const before = serializeGame(state);
    expect(breach(state, point).ok).toBe(false);
    expect(serializeGame(state)).toBe(before);
    expect(getCommander(state)!.abilityCooldowns.breach).toBeUndefined();
}

describe('Engineer Breach Charge', () => {
    it('adds the C siege ability while preserving Q turret and E repair', () => {
        expect(COMMANDERS.engineer.abilities.map(({ id, key, cooldown }) => ({ id, key, cooldown }))).toEqual([
            { id: 'turret', key: 'Q', cooldown: 25 },
            { id: 'repair', key: 'E', cooldown: 20 },
            { id: 'breach', key: 'C', cooldown: 28 },
        ]);
        expect(BREACH_RANGE).toBe(6);
        expect(BREACH_DAMAGE).toBe(180);
    });

    it('hits exactly one targeted building, records actual damage and emits its named impact', () => {
        const { state, commander } = fixture(), target = building(state), nearby = building(state, 1, 23, 21);
        const troop = spawnEntity(state, 1, 'unit', 'swordsman', 24, 20), troopHp = troop.hp;
        const ally = building(state, 0, 22, 19), allyHp = ally.hp;
        const targetHp = target.hp, nearbyHp = nearby.hp, damageBefore = state.players[0].stats.damageDealt;
        expect(breach(state, target)).toEqual({ ok: true });
        expect(target.hp).toBe(targetHp - 180);
        expect([nearby.hp, troop.hp, ally.hp]).toEqual([nearbyHp, troopHp, allyHp]);
        expect(state.players[0].stats.damageDealt - damageBefore).toBe(180);
        expect(commander.abilityCooldowns.breach).toBe(28);
        expect(state.events.filter(event => event.type === 'hit')).toEqual([expect.objectContaining({ entityId: target.id, sourceId: commander.id, value: 180 })]);
        expect(state.events.find(event => event.type === 'ability' && event.subtype === 'breach')).toMatchObject({ x: target.x, y: target.y, text: 'Breach Charge', entityId: commander.id });
        expect(state.commandLog.at(-1)?.command).toMatchObject({ type: 'ability', ability: 'breach', x: target.x, y: target.y });
        expect(breach(state, target).error).toContain('recharging');
        expect(target.hp).toBe(targetHp - 180);
    });

    it('uses a pure deterministic nearest-eligible helper for untargeted casts', () => {
        const { state, commander } = fixture(), farther = building(state), nearest = building(state, 1, 23, 20);
        building(state, 0, 21, 20);
        const hidden = building(state, 1, 22, 21);
        state.fog.visible[0][tileIndex(state.map, hidden.x, hidden.y)] = 0;
        const before = serializeGame(state), farHp = farther.hp, nearHp = nearest.hp;
        expect(findBreachTarget(state, commander)?.id).toBe(nearest.id);
        expect(serializeGame(state)).toBe(before);
        expect(breach(state).ok).toBe(true);
        expect(nearest.hp).toBe(nearHp - 180);
        expect(farther.hp).toBe(farHp);
    });

    it('accepts a point on the structure edge without broad area damage', () => {
        const { state } = fixture(), target = building(state), before = target.hp;
        expect(breach(state, { x: target.x + target.radius, y: target.y }).ok).toBe(true);
        expect(target.hp).toBe(before - 180);
    });

    it('accepts exactly six center tiles but rejects a building whose edge alone is in range', () => {
        const { state } = fixture(), target = building(state, 1, 26.001, 20);
        rejectsWithoutChanges(state, target);
        target.x = 26;
        expect(breach(state, target).ok).toBe(true);
    });

    for (const kind of ['own', 'allied', 'hidden', 'dead', 'defeated', 'closed'] as const)
        it(`rejects an explicit ${kind} structure without retargeting or spending a cooldown`, () => {
            const { state, commander } = fixture();
            const valid = building(state, 1, 25.9, 20), target = building(state, kind === 'own' ? 0 : 1, 24.9, 20);
            if (kind === 'allied') state.players[1].alliance = state.players[0].alliance = 0;
            if (kind === 'hidden') {
                state.fog.visible[0][tileIndex(state.map, target.x, target.y)] = 0;
                state.fog.explored[0][tileIndex(state.map, target.x, target.y)] = 1;
            }
            if (kind === 'dead') target.hp = 0;
            if (kind === 'defeated') state.players[1].defeated = true;
            if (kind === 'closed') state.players[1].closed = true;
            expect(findBreachTarget(state, commander, target)).toBeUndefined();
            rejectsWithoutChanges(state, { x: target.x, y: target.y });
            expect(valid.hp).toBe(valid.maxHp);
        });

    for (const point of [undefined, { x: 10, y: 10 }, { x: NaN, y: 20 }, { x: 20, y: Infinity }, { x: -1, y: 20 }, { x: 42, y: 20 }, { x: 20 }, { y: 20 }])
        it(`rejects a missing or invalid structure target ${JSON.stringify(point)} without cooldown`, () => {
            const { state } = fixture();
            rejectsWithoutChanges(state, point);
        });

    it('does not substitute a nearby structure for an explicit empty-ground point', () => {
        const { state } = fixture();
        building(state);
        rejectsWithoutChanges(state, { x: 20, y: 24 });
    });

    for (const position of [{ x: -1, y: 20 }, { x: 42, y: 20 }, { x: 20, y: -1 }, { x: 20, y: 42 }, { x: NaN, y: 20 }, { x: 20, y: Infinity }])
        it(`rejects off-map or nonfinite entity coordinates ${JSON.stringify(position)}, including aliased fog tiles`, () => {
            const { state, commander } = fixture(), target = building(state);
            Object.assign(target, position);
            Object.assign(commander, { x: Math.max(1, Math.min(40, position.x)), y: Math.max(1, Math.min(40, position.y)) });
            state.fog.visible[0].fill(1);
            expect(findBreachTarget(state, commander)).toBeUndefined();
            rejectsWithoutChanges(state);
        });

    it('cannot target troops or commanders, even while they are visible and in range', () => {
        const { state } = fixture();
        const troop = spawnEntity(state, 1, 'unit', 'siege', 24, 20);
        const enemyCommander = spawnEntity(state, 1, 'commander', 'ranger', 22, 22);
        updateFog(state);
        rejectsWithoutChanges(state, troop);
        rejectsWithoutChanges(state, enemyCommander);
        rejectsWithoutChanges(state);
    });

    for (const condition of ['defeated', 'closed', 'dead commander', 'wrong commander', 'ended', 'learning'] as const)
        it(`rejects a cast from an inactive context: ${condition}`, () => {
            const { state, commander } = fixture(), target = building(state);
            if (condition === 'defeated') state.players[0].defeated = true;
            if (condition === 'closed') state.players[0].closed = true;
            if (condition === 'dead commander') commander.hp = 0;
            if (condition === 'wrong commander') commander.type = 'ranger';
            if (condition === 'ended') state.winner = 0;
            if (condition === 'learning') state.settings.learning = true;
            expect(findBreachTarget(state, commander, target)).toBeUndefined();
            rejectsWithoutChanges(state, target);
        });

    it('uses normal kill, building-destruction, keep-defeat and victory accounting', () => {
        const { state } = fixture(), target = state.entities.find(entity => entity.team === 1 && entity.type === 'keep')!;
        Object.assign(target, { x: 25, y: 20, hp: 80 });
        updateFog(state);
        const navigation = state.navigationVersion;
        expect(breach(state, target).ok).toBe(true);
        expect(target.hp).toBe(0);
        expect(state.players[0].stats.damageDealt).toBe(80);
        expect(state.players[0].stats.buildingsDestroyed).toBe(1);
        expect(state.players[0].stats.kills).toBe(0);
        expect(state.navigationVersion).toBe(navigation + 1);
        expect(state.players[1].defeated).toBe(true);
        expect(state.events.find(event => event.type === 'death' && event.entityId === target.id)).toBeDefined();
        stepGame(state, .1);
        expect(state.winner).toBe(0);
    });

    it('respects existing damage invulnerability', () => {
        const { state, commander } = fixture(), target = building(state);
        target.invulnerableUntil = 5;
        expect(breach(state, target).ok).toBe(true);
        expect(target.hp).toBe(target.maxHp);
        expect(state.players[0].stats.damageDealt).toBe(0);
        expect(commander.abilityCooldowns.breach).toBe(28);
    });

    it('preserves mastery and Runic Focus cooldown modifiers', () => {
        const state = createGame({ seed: 'breach-focus', mode: 'rush', commander: 'engineer' });
        const commander = getCommander(state)!;
        state.players[0].research.veterancy = 1;
        state.rush!.upgrades = ['focus', 'focus'];
        const target = building(state, 1, commander.x + 4, commander.y);
        expect(breach(state, target).ok).toBe(true);
        expect(commander.abilityCooldowns.breach).toBe(28 * .8 * .75 ** 2);
    });

    it('allows the next cast only after the normal 28-second recharge', () => {
        const { state, commander } = fixture(), target = building(state);
        expect(breach(state, target).ok).toBe(true);
        stepGame(state, 27.9);
        expect(breach(state, target).error).toContain('recharging');
        stepGame(state, .1);
        expect(commander.abilityCooldowns.breach).toBe(0);
        expect(breach(state, target).ok).toBe(true);
        expect(target.hp).toBe(target.maxHp - 360);
    });

    it('queues exactly one cast, projects its damage and cooldown, and applies it once on resume', () => {
        const { state, commander } = fixture(), target = building(state), beforeHp = target.hp;
        expect(issueCommand(state, { type: 'pause', team: 0, paused: true }).ok).toBe(true);
        expect(breach(state, { x: target.x, y: target.y })).toEqual({ ok: true, queued: true });
        expect(breach(state, target).error).toContain('recharging');
        const before = serializeGame(state), projected = projectPendingCommands(state);
        expect(serializeGame(state)).toBe(before);
        expect(projected.entities.find(entity => entity.id === target.id)!.hp).toBe(beforeHp - 180);
        expect(getCommander(projected)!.abilityCooldowns.breach).toBe(28);
        stepGame(state, 3);
        expect(state.time).toBe(0);
        expect(target.hp).toBe(beforeHp);
        expect(commander.abilityCooldowns.breach).toBeUndefined();
        expect(state.pendingCommands).toHaveLength(1);
        expect(issueCommand(state, { type: 'pause', team: 0, paused: false }).ok).toBe(true);
        expect(target.hp).toBe(beforeHp - 180);
        expect(state.pendingCommands).toHaveLength(0);
        expect(state.commandLog.filter(entry => entry.command.type === 'ability' && entry.command.ability === 'breach')).toHaveLength(1);
    });

    it('revalidates a paused target on resume without redirecting or spending cooldown', () => {
        const { state, commander } = fixture(), target = building(state), alternative = building(state, 1, 23, 20);
        issueCommand(state, { type: 'pause', team: 0, paused: true });
        expect(breach(state, { x: target.x, y: target.y }).queued).toBe(true);
        state.fog.visible[0][tileIndex(state.map, target.x, target.y)] = 0;
        issueCommand(state, { type: 'pause', team: 0, paused: false });
        expect(target.hp).toBe(target.maxHp);
        expect(alternative.hp).toBe(alternative.maxHp);
        expect(commander.abilityCooldowns.breach).toBeUndefined();
        expect(state.events.some(event => event.type === 'alert' && event.text?.includes('visible enemy building'))).toBe(true);
    });

    it('round-trips legacy Engineer saves, queued Breach commands, cooldowns and deterministic continuation', () => {
        const { state } = fixture(), target = building(state);
        const legacy = restoreGame(serializeGame(state));
        expect(legacy.version).toBe(1);
        expect(getCommander(legacy)!.abilityCooldowns).toEqual({});
        issueCommand(state, { type: 'pause', team: 0, paused: true });
        expect(breach(state, { x: target.x, y: target.y }).queued).toBe(true);
        const restored = restoreGame(serializeGame(state));
        expect(restored.pendingCommands).toEqual(state.pendingCommands);
        for (const current of [state, restored]) {
            issueCommand(current, { type: 'pause', team: 0, paused: false });
            stepGame(current, .3);
        }
        expect(serializeGame(restored)).toBe(serializeGame(state));
        const resumed = restoreGame(serializeGame(state));
        expect(getCommander(resumed)!.abilityCooldowns.breach).toBeCloseTo(27.7);
        for (const current of [state, resumed]) stepGame(current, 1);
        expect(serializeGame(resumed)).toBe(serializeGame(state));
    });

    it('rejects malformed saved Breach coordinates and unsupported commander abilities', () => {
        const { state } = fixture();
        for (const command of [
            { type: 'ability', team: 0, ability: 'breach', x: 25 },
            { type: 'ability', team: 0, ability: 'breach', x: 99, y: 20 },
            { type: 'ability', team: 1, ability: 'breach', x: 25, y: 20 },
        ]) {
            const saved = JSON.parse(serializeGame(state));
            saved.paused = true;
            saved.pendingCommands = [command];
            expect(() => restoreGame(saved)).toThrow(/queued order/);
        }
    });

    it('replays existing xy command-log entries to the same complete state', () => {
        const { state } = fixture(), target = building(state), start = serializeGame(state);
        const commands: GameCommand[] = [
            { type: 'ability', team: 0, ability: 'breach', x: target.x, y: target.y },
            { type: 'ability', team: 0, ability: 'turret' },
            { type: 'ability', team: 0, ability: 'repair' },
        ];
        for (const command of commands) {
            expect(issueCommand(state, command).ok).toBe(true);
            stepGame(state, .2);
        }
        const replay = restoreGame(start);
        for (const entry of state.commandLog) {
            stepGame(replay, (entry.tick - replay.tick) * .1);
            expect(issueCommand(replay, entry.command).ok).toBe(true);
        }
        stepGame(replay, (state.tick - replay.tick) * .1);
        expect(serializeGame(replay)).toBe(serializeGame(state));
    });

    for (const targetStatus of ['visible', 'hidden', 'out of range'] as const)
        it(`only lets normal AI breach a valid nearby structure: ${targetStatus}`, () => {
            const { state, commander } = fixture(), target = building(state, 1, targetStatus === 'out of range' ? 27 : 25, 20);
            state.players[0].ai = true;
            state.players[0].aiNextThink = 0;
            state.players[0].gold = state.players[0].wood = 0;
            state.lastFogTick = 0;
            if (targetStatus === 'hidden') state.fog.visible[0][tileIndex(state.map, target.x, target.y)] = 0;
            stepGame(state, .1);
            expect(target.hp).toBe(target.maxHp - (targetStatus === 'visible' ? 180 : 0));
            expect(commander.abilityCooldowns.breach).toBe(targetStatus === 'visible' ? 28 : undefined);
        });

    for (const armedTarget of [false, true])
        it(`AI reserves its charge for armed fortifications even beside a closer house: ${armedTarget}`, () => {
            const { state, commander } = fixture();
            const house = spawnEntity(state, 1, 'building', 'house', 23, 20);
            const tower = armedTarget ? building(state, 1, 25.5, 20) : undefined;
            updateFog(state);
            state.players[0].ai = true;
            state.players[0].aiNextThink = 0;
            state.players[0].gold = state.players[0].wood = 0;
            stepGame(state, .1);
            expect(house.hp).toBe(house.maxHp);
            expect(commander.abilityCooldowns.breach).toBe(armedTarget ? 28 : undefined);
            if (tower) expect(tower.hp).toBe(tower.maxHp - 180);
        });

    it('preserves original turret deployment and allied unit/building repairs', () => {
        const { state, commander } = fixture(), ally = building(state, 0, 23, 20), enemy = building(state, 1, 25, 20);
        const troop: Entity = spawnEntity(state, 0, 'unit', 'swordsman', 21, 22);
        ally.hp -= 300; troop.hp = 10; commander.hp -= 150; enemy.hp -= 200;
        const enemyHp = enemy.hp;
        expect(issueCommand(state, { type: 'ability', team: 0, ability: 'turret' }).ok).toBe(true);
        expect(state.entities.find(entity => entity.type === 'turret')).toMatchObject({ team: 0, kind: 'building', lifetime: 30 });
        expect(commander.abilityCooldowns.turret).toBe(25);
        expect(issueCommand(state, { type: 'ability', team: 0, ability: 'repair' }).ok).toBe(true);
        expect(ally.hp).toBe(ally.maxHp - 40);
        expect(troop.hp).toBe(120);
        expect(commander.hp).toBe(commander.maxHp - 40);
        expect(enemy.hp).toBe(enemyHp);
        expect(commander.abilityCooldowns.repair).toBe(20);
    });
});
