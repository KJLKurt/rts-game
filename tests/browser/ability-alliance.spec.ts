import { action, expect, launch, pause, test } from './helpers';

/** Controlled allegiance fixture. The ability is always invoked through its real UI. */
async function nearbyTeams(page: import('@playwright/test').Page, commander: string, hideEnemy = false) {
  await launch(page, { commander, difficulty: 'easy' });
  await pause(page);
  return page.evaluate((hideEnemy) => {
    const s = window.__FRONTIER__.state;
    s.players.forEach(p => p.ai = false);
    s.players[0].alliance = 0;
    s.players[1].alliance = 1;
    s.players.push({ ...structuredClone(s.players[1]), team: 2, name: 'Allied scouts', alliance: 0 });
    const c = s.entities.find(e => e.team === 0 && e.kind === 'commander')!;
    const troop = s.entities.find(e => e.team === 0 && e.kind === 'unit')!;
    const ally = { ...structuredClone(troop), id: 'qa-nearby-ally', team: 2, x: c.x - 1.5, y: c.y };
    const enemy = { ...structuredClone(troop), id: 'qa-visible-hostile', team: 1, x: c.x + 5, y: c.y };
    s.entities.push(ally, enemy);
    s.fog.visible[0].fill(1);
    if (hideEnemy) s.fog.visible[0][Math.floor(enemy.y) * s.map.width + Math.floor(enemy.x)] = 0;
    return { commander: { x: c.x, y: c.y, facing: c.facing }, ally: { x: ally.x, y: ally.y }, enemy: { x: enemy.x, y: enemy.y } };
  }, hideEnemy);
}

async function abilityTarget(page: import('@playwright/test').Page, label: string) {
  await page.getByRole('button', { name: label, exact: true }).click();
  const command = await page.evaluate(() => window.__FRONTIER__.state.pendingCommands.at(-1));
  expect(command?.type).toBe('ability');
  return command as { type: 'ability'; x: number; y: number };
}

test('Charge targets a visible hostile instead of a closer allied troop', async ({ page }) => {
  const f = await nearbyTeams(page, 'warlord');
  const target = await abilityTarget(page, 'Charge');
  expect(target.x).toBeCloseTo(f.enemy.x, 5);
  expect(target.y).toBeCloseTo(f.enemy.y, 5);
  await page.screenshot({ path: test.info().outputPath('allied-charge.png') });
});

test('Thorn Trap targets a visible hostile instead of a closer allied troop', async ({ page }) => {
  const f = await nearbyTeams(page, 'ranger');
  const target = await abilityTarget(page, 'Thorn Trap');
  expect(target.x).toBeCloseTo(f.enemy.x, 5);
  expect(target.y).toBeCloseTo(f.enemy.y, 5);
});

test('Windstep evades the hostile rather than moving toward it to evade an ally', async ({ page }) => {
  const f = await nearbyTeams(page, 'ranger');
  const target = await abilityTarget(page, 'Windstep');
  expect(target.x).toBeCloseTo(f.commander.x - 4, 5);
  expect(target.y).toBeCloseTo(f.commander.y, 5);
});

test('Runic Turret is placed toward the hostile instead of toward an allied troop', async ({ page }) => {
  const f = await nearbyTeams(page, 'engineer');
  const target = await abilityTarget(page, 'Runic Turret');
  expect(target.x).toBeCloseTo(f.commander.x + 3, 5);
  expect(target.y).toBeCloseTo(f.commander.y, 5);
});

test('allies do not override the normal fallback when the hostile is hidden by fog', async ({ page }) => {
  const f = await nearbyTeams(page, 'warlord', true);
  const target = await abilityTarget(page, 'Charge');
  expect(target.x).toBeCloseTo(f.commander.x + Math.cos(f.commander.facing) * 4, 5);
  expect(target.y).toBeCloseTo(f.commander.y + Math.sin(f.commander.facing) * 4, 5);
  await expect(action(page, 'pause').first()).toBeVisible();
});
