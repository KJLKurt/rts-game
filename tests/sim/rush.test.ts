import { describe, it, expect } from 'vitest';
import { createGame, stepGame, issueCommand, getCommander, restoreGame, serializeGame, type CommanderId } from '../../src/sim';
describe('Rush Arena', () => {
    it('creates an actual commander and squad arena without settlement systems', () => { const s = createGame({ mode: 'rush' }); expect(s.rush?.surviveUntil).toBe(240); expect(s.entities.filter(e => e.team === 0 && e.kind === 'unit')).toHaveLength(4); expect(s.entities.some(e => e.kind === 'building')).toBe(false); expect(s.map.nodes).toHaveLength(0); expect(issueCommand(s, { type: 'recruit', team: 0, unit: 'swordsman' }).ok).toBe(false); });
    it('spawns waves, closes the frontier and offers field upgrades', () => { const s = createGame({ mode: 'rush' }); getCommander(s)!.invulnerableUntil = 500; stepGame(s, 46); expect(s.rush!.wave).toBeGreaterThanOrEqual(3); expect(s.rush!.radius).toBeLessThan(s.rush!.initialRadius); expect(s.rush!.upgradeAvailable).toBe(1); expect(s.rush!.offeredUpgrades).toHaveLength(3); const choice = s.rush!.offeredUpgrades[0]; expect(issueCommand(s, { type: 'upgrade', team: 0, upgrade: choice }).ok).toBe(true); expect(s.rush!.upgrades).toContain(choice); expect(s.rush!.upgradeAvailable).toBe(0); expect(issueCommand(s, { type: 'upgrade', team: 0, upgrade: choice }).ok).toBe(false); });
    it('collects supplies through proximity', () => { const s = createGame({ mode: 'rush' }), c = getCommander(s)!; c.hp = 100; s.rush!.supplies.push({ id: 'fixture', kind: 'heal', x: c.x, y: c.y, expiresAt: 30 }); stepGame(s, .1); expect(c.hp).toBeGreaterThan(300); expect(s.rush!.supplies).toHaveLength(0); });
    it('telegraphs hazards before they detonate', () => { const s = createGame({ mode: 'rush' }), c = getCommander(s)!; s.rush!.nextWaveAt = 999; s.rush!.nextHazardAt = 1; c.order = { type: 'hold' }; stepGame(s, 1.2); expect(s.rush!.hazards).toHaveLength(1); const before = c.hp; stepGame(s, 2); expect(c.hp).toBe(before); stepGame(s, .7); expect(c.hp).toBeLessThan(before); expect(s.rush!.hazards).toHaveLength(0); });
    it('ends inactive play in a defeat and never revives the commander', () => { const s = createGame({ mode: 'rush', seed: 'rush-afk' }); stepGame(s, 240); expect(s.winner).toBe(1); expect(s.time).toBeLessThan(240); expect(getCommander(s)!.hp).toBe(0); });
    it('awards survival victory exactly at four minutes', () => { const s = createGame({ mode: 'rush' }); getCommander(s)!.invulnerableUntil = 500; stepGame(s, 241); expect(s.winner).toBe(0); expect(s.time).toBe(240); expect(s.rush!.wave).toBeGreaterThan(10); });
    it('saves the complete run, pickup and upgrade state deterministically', () => { const a = createGame({ mode: 'rush', seed: 'persist-rush' }); stepGame(a, 25); const b = restoreGame(serializeGame(a)); stepGame(a, 10); stepGame(b, 10); expect(serializeGame(a)).toBe(serializeGame(b)); });
    for (const commander of ['warlord', 'ranger', 'engineer'] as CommanderId[])
        it(`allows an active ${commander} to survive a normal arena`, () => {
            const s = createGame({ seed: 'rush-bot-1', mode: 'rush', commander, difficulty: 'normal' });
            for (let i = 0; i < 2400 && s.winner === null; i++) {
                const c = getCommander(s)!, r = s.rush!;
                if (i % 10 === 0) {
                    const supply = [...r.supplies].sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y))[0], a = s.time * .055, target = supply ?? { x: r.center.x + Math.cos(a) * r.radius * .6, y: r.center.y + Math.sin(a) * r.radius * .6 };
                    if (supply || s.time > 20)
                        issueCommand(s, { type: 'move', team: 0, x: target.x, y: target.y });
                    for (const ability of commander === 'warlord' ? ['charge', 'rally'] : commander === 'ranger' ? ['dodge', 'trap'] : ['turret', 'repair']) {
                        const enemy = s.entities.filter(e => e.team === 1 && e.hp > 0).sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y))[0];
                        const aim = ability === 'dodge' ? target : enemy;
                        issueCommand(s, { type: 'ability', team: 0, ability, x: aim?.x, y: aim?.y });
                    }
                    if (r.upgradeAvailable) {
                        const upgrade = r.offeredUpgrades.includes('renewal') ? 'renewal' : r.offeredUpgrades.includes('bulwark') ? 'bulwark' : r.offeredUpgrades[0];
                        issueCommand(s, { type: 'upgrade', team: 0, upgrade });
                    }
                }
                stepGame(s, .1);
            }
            expect(s.winner).toBe(0);
            expect(s.rush!.kills).toBeGreaterThan(25);
            expect(s.rush!.upgrades).toHaveLength(5);
        });
});
