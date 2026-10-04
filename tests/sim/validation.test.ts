import { describe, it, expect } from 'vitest';
import { createGame, restoreGame, serializeGame, stepGame, validateTriggers } from '../../src/sim';
import { CAMPAIGNS } from '../../src/ui/content';
const snapshot = () => JSON.parse(serializeGame(createGame()));
describe('mission data and resume safety', () => {
    it('validates every authored mission using the shared simulation schema', () => {
        for (const campaign of CAMPAIGNS)
            for (const mission of campaign.missions)
                expect(validateTriggers(mission.triggers, { teamCount: (mission.settings.aiPlayers ?? 1) + 1 }), mission.id).toEqual([]);
    });
    it('rejects unknown teams and malformed spawn or resource rewards', () => {
        const condition = { type: 'time', seconds: 0 };
        for (const action of [{ type: 'resources', team: 99, gold: 10, wood: 10 }, { type: 'spawn', team: 0, unit: 'constructor', count: 2, x: 5, y: 5 }, { type: 'spawn', team: 0, unit: 'archer', count: -1, x: 5, y: 5 }])
            expect(validateTriggers([{ id: 'bad', when: condition, actions: [action] }], { teamCount: 2 }).length).toBeGreaterThan(0);
    });
    it('refuses corrupt mission rewards during restore, before they can fire', () => {
        const raw = snapshot();
        raw.triggers = [{ id: 'bad', when: { type: 'time', seconds: 0 }, actions: [{ type: 'resources', team: 99, gold: 10, wood: 10 }] }];
        expect(() => restoreGame(raw)).toThrow(/mission triggers/);
    });
    it('rejects nonnumeric modifiers instead of poisoning income with NaN', () => {
        const raw = snapshot();
        raw.settings.modifiers = { income: 'broken' };
        expect(() => restoreGame(raw)).toThrow(/multipliers/);
        raw.settings.modifiers = { playerHealth: 0 };
        expect(() => restoreGame(raw)).toThrow(/multipliers/);
    });
    it('reconstructs a missing fog refresh timer so resumed exploration advances', () => {
        const raw = snapshot();
        delete raw.lastFogTick;
        const state = restoreGame(raw);
        stepGame(state, 1);
        expect(state.lastFogTick).toBeGreaterThan(0);
        expect(state.tick - state.lastFogTick).toBeLessThan(5);
        expect(Number.isFinite(state.players[0].gold)).toBe(true);
    });
    it('rejects inherited object property names as content IDs', () => {
        for (const id of ['constructor', '__proto__', 'toString']) {
            const raw = snapshot();
            raw.settings.commander = id;
            expect(() => restoreGame(raw)).toThrow(/settings/);
            const entity = snapshot();
            entity.entities.find((e: {
                kind: string;
            }) => e.kind === 'unit').type = id;
            expect(() => restoreGame(entity)).toThrow(/unknown types/);
        }
    });
});
