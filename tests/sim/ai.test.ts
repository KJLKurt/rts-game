import { describe, it, expect } from 'vitest';
import { createGame, stepGame, type GameSettings } from '../../src/sim';
describe('headless strategic AI matches', () => {
    const cases: Partial<GameSettings>[] = [{ seed: 'ai-quick-a', duration: 8, mapSize: 'small', mode: 'domination' }, { seed: 'ai-fourway', duration: 8, mapSize: 'medium', mode: 'domination', aiPlayers: 3 }, { seed: 'ai-relic', duration: 8, mapSize: 'small', mode: 'relic', biome: 'snow' }, { seed: 'ai-quick-b', duration: 8, mapSize: 'small', mode: 'conquest' }];
    for (const config of cases)
        it(`${config.seed}: terminates with recruitment, expansion and real combat`, () => {
            const s = createGame({ ...config, aiControlPlayer: true });
            while (s.winner === null && s.time < (config.duration ?? 8) * 180 + 1)
                stepGame(s, 1);
            expect(s.winner).not.toBeNull();
            expect(s.players.reduce((n, p) => n + p.stats.unitsCreated, 0)).toBeGreaterThan(20);
            expect(s.players.reduce((n, p) => n + p.stats.kills, 0)).toBeGreaterThan(5);
            expect(s.players.reduce((n, p) => n + p.stats.buildingsCreated, 0)).toBeGreaterThan(6);
            for (const p of s.players) {
                expect(p.gold).toBeGreaterThanOrEqual(0);
                expect(p.wood).toBeGreaterThanOrEqual(0);
                expect(Number.isFinite(p.score)).toBe(true);
            }
            expect(s.entities.every(e => Number.isFinite(e.x) && Number.isFinite(e.hp))).toBe(true);
        }, 30000);
    it('uses the same deterministic decisions and resources in a resumed match', () => {
        const a = createGame({ seed: 'ai-determinism', aiControlPlayer: true, mapSize: 'small', duration: 8 }), b = createGame({ seed: 'ai-determinism', aiControlPlayer: true, mapSize: 'small', duration: 8 });
        stepGame(a, 90);
        for (let i = 0; i < 900; i++)
            stepGame(b, .1);
        expect(a.players).toEqual(b.players);
        expect(a.entities).toEqual(b.entities);
        expect(a.commandLog).toEqual(b.commandLog);
    });
});
