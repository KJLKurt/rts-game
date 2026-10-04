import { describe, expect, it } from 'vitest';
import { CAMPAIGN } from '../../src/ui/content';
import oldOutpostSave from './fixtures/outpost-3937eef-3s.json';
import { createGame, getCommander, issueCommand, restoreGame, serializeGame, spawnEntity, stepGame, updateFog, type Entity, type GameState, type Point } from '../../src/sim';

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const battlefield = () => {
    const s = createGame({ seed: 'guard-fixture', mapSize: 'medium' });
    s.players.forEach(p => p.ai = false);
    s.map.tiles.fill('grass');
    s.entities = s.entities.filter(e => e.kind === 'building');
    s.entities.forEach(e => e.damage = 0);
    const guard = spawnEntity(s, 0, 'unit', 'swordsman', 22, 22);
    const enemy = spawnEntity(s, 1, 'unit', 'swordsman', 24.8, 22);
    enemy.order = { type: 'hold' };
    enemy.damage = 0;
    enemy.hp = enemy.maxHp = 10000;
    updateFog(s);
    return { s, guard, enemy };
};
const positions = (s: GameState) => s.entities.filter(e => e.team === 0 && e.kind === 'unit').map(e => ({ id: e.id, x: e.x, y: e.y }));

describe('bounded idle guard stance and beginner opening', () => {
    it('retaliates near its anchor, refuses retreating bait, and returns home', () => {
        const { s, guard, enemy } = battlefield(), home = { ...guard.guardAnchor! };
        stepGame(s, 2);
        expect(guard.x).toBeGreaterThan(home.x + .5);
        expect(enemy.hp).toBeLessThan(enemy.maxHp);
        let maximum = distance(guard, home);
        for (let i = 0; i < 200; i++) {
            enemy.x = 24.8 + i * .06;
            stepGame(s, .1);
            maximum = Math.max(maximum, distance(guard, home));
        }
        expect(maximum).toBeLessThanOrEqual(2.01);
        expect(guard.order.type).toBe('idle');
        expect(guard.guardAnchor).toEqual(home);
        expect(distance(guard, home)).toBeLessThan(.31);
    });

    it('lets an explicit attack-move leave the old guard position', () => {
        const { s, guard, enemy } = battlefield(), home = { ...guard.guardAnchor! };
        enemy.x = 32;
        expect(issueCommand(s, { type: 'attackMove', team: 0, entityIds: [guard.id], x: 30, y: 22 }).ok).toBe(true);
        expect(guard.guardAnchor).toBeUndefined();
        stepGame(s, 3);
        expect(distance(guard, home)).toBeGreaterThan(4);
    });

    it('makes default recruits move safely to the commander, while explicit rallies remain attack-moves', () => {
        const s = createGame({ seed: 'guard-recruits' });
        s.players.forEach(p => p.ai = false);
        const barracks = s.entities.find(e => e.team === 0 && e.type === 'barracks')!;
        expect(issueCommand(s, { type: 'recruit', team: 0, unit: 'spearman', buildingId: barracks.id }).ok).toBe(true);
        const count = s.entities.length;
        while (s.entities.length === count) stepGame(s, .1);
        expect(s.entities.at(-1)!.order.type).toBe('move');
        expect(issueCommand(s, { type: 'rally', team: 0, buildingId: barracks.id, x: 20, y: 27 }).ok).toBe(true);
        expect(issueCommand(s, { type: 'recruit', team: 0, unit: 'spearman', buildingId: barracks.id }).ok).toBe(true);
        while (s.entities.length === count + 1) stepGame(s, .1);
        expect(s.entities.at(-1)!.order.type).toBe('attackMove');
    });

    it('preserves a live guard anchor across save/load and migrates older idle units', () => {
        const { s, guard } = battlefield();
        stepGame(s, 1);
        const b = restoreGame(serializeGame(s));
        expect(b.entities.find(e => e.id === guard.id)!.guardAnchor).toEqual(guard.guardAnchor);
        stepGame(s, 2);
        stepGame(b, 2);
        expect(serializeGame(b)).toBe(serializeGame(s));
        const raw = JSON.parse(serializeGame(s));
        raw.entities.forEach((e: Entity) => delete e.guardAnchor);
        const restored = restoreGame(raw), oldGuard = restored.entities.find(e => e.id === guard.id)!;
        expect(oldGuard.guardAnchor).toEqual({ x: oldGuard.x, y: oldGuard.y });
        raw.entities.find((e: Entity) => e.id === guard.id).guardAnchor = { x: 9999, y: 5 };
        expect(() => restoreGame(raw)).toThrow(/guard anchor/);
    });

    it('keeps the reported Easy starter army safe while the player reads and recruits', () => {
        const s = createGame({ seed: 'FRONTIER-549665', difficulty: 'easy', duration: 8, mode: 'domination', mapSize: 'medium' });
        const starts = positions(s);
        for (const unit of ['swordsman', 'spearman'] as const)
            expect(issueCommand(s, { type: 'recruit', team: 0, unit }).ok).toBe(true);
        let maximum = 0;
        for (let i = 0; i < 600; i++) {
            stepGame(s, .1);
            for (const home of starts) {
                const unit = s.entities.find(e => e.id === home.id)!;
                maximum = Math.max(maximum, distance(unit, home));
                expect(unit.hp).toBe(unit.maxHp);
            }
        }
        expect(maximum).toBeLessThan(.01);
        expect(s.players[0].stats.unitsLost).toBe(0);
        expect(s.entities.filter(e => e.team === 0 && e.kind === 'unit' && e.hp > 0)).toHaveLength(6);
        expect(s.players[1].stats.captures).toBeGreaterThan(0);
        expect(s.players[1].stats.unitsCreated).toBeGreaterThan(4);
        expect(s.players[1].stats.buildingsCreated).toBeGreaterThan(2);
        // It is a planning window, not permanent passivity or invulnerability.
        stepGame(s, 60);
        expect(s.players[0].stats.damageDealt).toBeGreaterThan(0);
        for (const home of starts) {
            const unit = s.entities.find(e => e.id === home.id);
            if (unit) expect(distance(unit, home)).toBeLessThanOrEqual(2.15);
        }
    });

    it('consolidates the home side for one minute, then resumes normal expansion', () => {
        const s = createGame({ seed: 'FRONTIER-549665', difficulty: 'easy', duration: 8 });
        const [other, home] = s.map.spawns;
        for (let i = 0; i < 590; i++) {
            stepGame(s, .1);
            for (const unit of s.entities.filter(e => e.team === 1 && e.kind !== 'building' && e.hp > 0))
                expect(distance(unit, home)).toBeLessThan(distance(unit, other));
        }
        stepGame(s, 21);
        expect(s.entities.some(e => e.team === 1 && e.kind !== 'building' && e.hp > 0 && distance(e, other) < distance(e, home))).toBe(true);
    });

    it('still defends against an actual attack during the Easy opening', () => {
        const s = createGame({ seed: 'easy-defense', difficulty: 'easy' });
        const spawn = s.map.spawns[1];
        const invader = spawnEntity(s, 0, 'unit', 'swordsman', spawn.x - 5, spawn.y);
        invader.order = { type: 'hold' };
        updateFog(s);
        stepGame(s, 1.3);
        expect(s.players[1].aiPhase).toBe('Defending the command keep');
        expect(s.entities.some(e => e.team === 1 && e.kind === 'unit' && e.order.type === 'attackMove')).toBe(true);
    });
});


describe('deployed Outpost opening and legacy-save regressions', () => {
    it('keeps starters guarding during commander-only movement and preserves Outpost threats and triggers', () => {
        const mission = CAMPAIGN.missions.find(m => m.id === 'outpost')!;
        expect(mission.settings.seed).toBe('OUTPOST-01');
        for (const target of [{ x: 7, y: 20 }, { x: 15, y: 16 }]) {
            // Match launchGame's authored campaign setup; no army order or pause.
            const s = createGame(mission.settings);
            s.triggers = structuredClone(mission.triggers);
            s.objectiveText = mission.briefing;
            const homes = positions(s);
            expect(issueCommand(s, { type: 'move', team: 0, ...target }).ok).toBe(true);
            for (let tick = 0; tick < 600; tick++) {
                stepGame(s, .1);
                expect(s.players[0].stats.unitsLost).toBe(0);
                for (const home of homes) {
                    const troop = s.entities.find(e => e.id === home.id)!;
                    expect(troop.hp).toBeGreaterThan(0);
                    expect(troop.order.type).toBe('idle');
                    expect(troop.guardAnchor).toEqual({ x: home.x, y: home.y });
                    expect(distance(troop, home)).toBeLessThanOrEqual(2.15);
                }
            }
            expect(s.triggers.find(t => t.id === 'welcome')!.fired).toBe(true);
            const player = s.players[0], gold = player.gold, collected = player.stats.goldCollected;
            stepGame(s, 5);
            expect(s.triggers.find(t => t.id === 'reinforcements')!.fired).toBe(true);
            expect(player.gold - gold - (player.stats.goldCollected - collected)).toBeCloseTo(120);
            stepGame(s, 55);
            expect(s.players[1].stats.damageDealt).toBeGreaterThan(0);
            expect(s.players[1].aiPhase).not.toBe('Preparing the opening army');
        }
    });

    it('replays the reported screen-right joystick diagonal at 4.5 seconds without a starter casualty', () => {
        const mission = CAMPAIGN.missions.find(m => m.id === 'outpost')!;
        const s = createGame(mission.settings);
        s.triggers = structuredClone(mission.triggers);
        s.objectiveText = mission.briefing;
        const homes = positions(s);
        stepGame(s, 4.5);
        // A full screen-right stick maps to +worldX/-worldY, refreshed every 100ms.
        // Fifteen ticks reproduce the reported 1500ms hold, followed by release.
        for (let tick = 0; tick < 15; tick++) {
            const c = getCommander(s)!;
            issueCommand(s, { type: 'move', team: 0, entityIds: [c.id], x: c.x + 2, y: c.y - 2 });
            stepGame(s, .1);
        }
        const c = getCommander(s)!;
        issueCommand(s, { type: 'hold', team: 0, entityIds: [c.id] });
        stepGame(s, .2);
        expect(s.time).toBe(6.2);
        expect(distance(c, { x: 12.936694, y: 13.075195 })).toBeLessThan(.02);
        expect(c.hp).toBe(713);
        expect(s.players[0].stats.unitsLost).toBe(0);
        for (const home of homes) {
            const troop = s.entities.find(e => e.id === home.id)!;
            expect(troop.hp).toBe(troop.maxHp);
            expect(distance(troop, home)).toBeLessThan(.01);
            expect(troop.order.type).toBe('idle');
        }
    });

    it('migrates a genuine pre-fix pursuit save once and retains stable guard anchors while advancing', () => {
        expect(oldOutpostSave.settings.seed).toBe('OUTPOST-01');
        expect(oldOutpostSave.time).toBe(3);
        expect(oldOutpostSave.entities.every(e => !('guardAnchor' in e))).toBe(true);
        expect(oldOutpostSave.entities.some(e => e.team === 0 && e.kind === 'unit' && e.order.type === 'idle' && e.path.length > 0)).toBe(true);
        const s = restoreGame(oldOutpostSave), homes = positions(s);
        // Migration preserves damage, resource balances and explicit stored maps.
        expect(s.map).toEqual(oldOutpostSave.map);
        expect(s.players[0].gold).toBe(oldOutpostSave.players[0].gold);
        for (const home of homes) {
            const troop = s.entities.find(e => e.id === home.id)!;
            expect(troop.guardAnchor).toEqual({ x: home.x, y: home.y });
            expect(troop.hp).toBe(oldOutpostSave.entities.find(e => e.id === home.id)!.hp);
        }
        const resumed = restoreGame(serializeGame(s));
        for (let tick = 0; tick < 800; tick++) {
            stepGame(s, .1);
            stepGame(resumed, .1);
            for (const home of homes) {
                const troop = s.entities.find(e => e.id === home.id);
                if (!troop) continue;
                expect(troop.guardAnchor).toEqual({ x: home.x, y: home.y });
                expect(distance(troop, home)).toBeLessThanOrEqual(2.15);
            }
        }
        expect(serializeGame(resumed)).toBe(serializeGame(s));
        expect(s.time).toBe(83);
    });
});
