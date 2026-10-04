import { describe, it, expect } from 'vitest';
import { createGame, stepGame, issueCommand, spawnEntity, isVisible, type BiomeId, type FactionId, type CommanderId } from '../../src/sim';
import { CAMPAIGN } from '../../src/ui/content';
describe('siege planning regression', () => {
    for (const index of [0, 1, 2, 6, 7, 9, 13, 19])
        it(`BALANCE-${index}: reaches headquarters victory without timed adjudication`, () => {
            const s = createGame({ seed: `BALANCE-${index}`, mode: 'conquest', duration: 8, mapSize: 'small', aiControlPlayer: true, biome: (['grasslands', 'forest', 'desert', 'snow'] as BiomeId[])[index % 4], faction: (['ironhold', 'wildborn', 'arcanists'] as FactionId[])[index % 3], commander: (['warlord', 'ranger', 'engineer'] as CommanderId[])[index % 3] });
            stepGame(s, 1441);
            expect(s.victoryReason).toBe('All enemy Command Keeps destroyed');
            expect(s.time).toBeLessThan(1440);
            expect(s.commandLog.some(c => c.command.type === 'recruit' && c.command.unit === 'siege')).toBe(true);
        }, 10000);
    it('the authored Ironwatch campaign mission can end through a real siege', () => { const mission = CAMPAIGN.missions.find(m => m.id === 'ironwatch')!; const s = createGame({ ...mission.settings, aiControlPlayer: true }); s.triggers = structuredClone(mission.triggers); stepGame(s, 3241); expect(s.victoryReason).toBe('All enemy Command Keeps destroyed'); expect(s.time).toBeLessThan(2160); }, 10000);
    it('player-issued combined arms orders can destroy a fortified keep', () => {
        const s = createGame({ seed: 'siege-probe', mapSize: 'small', mode: 'conquest', duration: 8 });
        const start = s.map.spawns[0];
        for (let i = 0; i < 4; i++)
            spawnEntity(s, 0, 'unit', 'siege', start.x + 5, start.y + i * .7);
        for (let i = 0; i < 8; i++)
            spawnEntity(s, 0, 'unit', i % 3 === 0 ? 'spearman' : 'swordsman', start.x + 7, start.y + (i % 4) * .7);
        for (let i = 0; i < 2; i++)
            spawnEntity(s, 0, 'unit', 'support', start.x + 4, start.y + i * .8);
        issueCommand(s, { type: 'attackMove', team: 0, entityIds: s.entities.filter(e => e.team === 0 && e.kind !== 'building').map(e => e.id), ...s.map.spawns[1] });
        for (let second = 0; second < 240 && s.winner === null; second++) {
            const keep = s.entities.find(e => e.type === 'keep' && e.team === 1)!;
            if (second % 3 === 0) {
                for (const ability of ['charge', 'rally'])
                    issueCommand(s, { type: 'ability', team: 0, ability, x: keep.x, y: keep.y });
                if (isVisible(s, 0, keep.x, keep.y))
                    issueCommand(s, { type: 'attack', team: 0, entityIds: s.entities.filter(e => e.team === 0 && e.type === 'siege').map(e => e.id), targetId: keep.id });
            }
            stepGame(s, 1);
        }
        expect(s.winner).toBe(0);
        expect(s.victoryReason).toBe('All enemy Command Keeps destroyed');
    }, 10000);
});
