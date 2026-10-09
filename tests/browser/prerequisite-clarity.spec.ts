import type { Locator, Page } from '@playwright/test';
import { BUILDINGS, canBuild, projectPendingCommands } from '../../src/sim';
import type { BuildingId, GameState, Point } from '../../src/sim/types';
import { plannedBuildResult } from '../../src/ui/placement';
import { action, clearGround, expect, home, tap, test } from './helpers';

// Evidence plan: three flows × two themes × the existing desktop, 390×844,
// and 844×390 projects = 18 identities. Only phones save four CSS-pixel frames
// per theme: Build ready, missing, queued, and Research queued (16 PNGs total).
// The first flow explicitly changes one starting Barracks as a controlled UI
// fixture. The other two use native placement, confirmation, save, and Resume.
type Theme = 'christmas' | 'mythic';
type Status = 'ready' | 'missing' | 'constructing' | 'queued';
type RendererProbe = Window['__FRONTIER__']['renderer'] & {
  visualTheme: string;
  atlas: { ready: boolean; image: HTMLImageElement | null };
};
const buildCard = (page: Page, id: BuildingId) => page.locator(`#deck-content [data-action="build"][data-id="${id}"]`);
const recruitCard = (page: Page) => page.getByRole('button', { name: 'Recruit Archer', exact: true });
const researchNode = (page: Page, id: 'steel' | 'fletching') => page.locator(`#deck-content [data-action="research"][data-id="${id}"]`);
const researchPath = (page: Page, name: string) => page.getByRole('region', { name: `${name} research`, exact: true })
  .locator('.research-path > span[data-prerequisite-state]').filter({ hasText: name });

async function press(page: Page, control: Locator) {
  await control.scrollIntoViewIfNeeded();
  if (await page.evaluate(() => navigator.maxTouchPoints > 0)) await control.tap();
  else await control.click();
}
async function snapshot(page: Page): Promise<GameState> {
  return page.evaluate(() => structuredClone(window.__FRONTIER__.state));
}
async function setPaused(page: Page, paused: boolean) {
  if ((await snapshot(page)).paused !== paused) await press(page, action(page, 'pause'));
  await expect.poll(() => page.evaluate(() => window.__FRONTIER__.state.paused)).toBe(paused);
}
async function startBattle(page: Page, theme: Theme) {
  await home(page);
  await press(page, action(page, 'settings'));
  await page.getByLabel('Visual theme', { exact: true }).selectOption(theme);
  await expect.poll(() => page.evaluate(() => (window.__FRONTIER__.renderer as RendererProbe).visualTheme)).toBe(theme);
  await press(page, page.getByRole('button', { name: 'Done', exact: true }));
  await press(page, action(page, 'skirmish'));
  await page.getByLabel('Map seed', { exact: true }).fill('QA-FRONTIER-2026');
  await page.locator('select[name="mapSize"]').selectOption('small');
  await page.locator('select[name="difficulty"]').selectOption('easy');
  await press(page, action(page, 'launch'));
  const briefing = page.getByRole('button', { name: 'Start battle', exact: true });
  if (await briefing.count()) await press(page, briefing);
  await expect(page.locator('.hud')).toBeVisible();
  if (await action(page, 'dismiss-tips').isVisible()) await press(page, action(page, 'dismiss-tips'));
  await setPaused(page, true);
}
async function fasterConstruction(page: Page) {
  await press(page, action(page, 'panel-orders'));
  await press(page, action(page, 'speed'));
  await press(page, action(page, 'speed'));
  expect((await snapshot(page)).settings.gameSpeed).toBe(2);
}

/** Check the rendered text itself, including scroll clipping and hit visibility. */
async function readable(page: Page, text: Locator) {
  await text.scrollIntoViewIfNeeded();
  await expect(text).toBeVisible();
  const evidence = await text.evaluate(node => {
    const rect = node.getBoundingClientRect();
    const clipped: string[] = [];
    for (let ancestor = node.parentElement; ancestor; ancestor = ancestor.parentElement) {
      const style = getComputedStyle(ancestor), box = ancestor.getBoundingClientRect();
      const left = box.left + ancestor.clientLeft, top = box.top + ancestor.clientTop;
      if (/(auto|scroll|hidden|clip)/.test(style.overflowX) && (rect.left < left - 1 || rect.right > left + ancestor.clientWidth + 1)) clipped.push(`${ancestor.className}:x`);
      if (/(auto|scroll|hidden|clip)/.test(style.overflowY) && (rect.top < top - 1 || rect.bottom > top + ancestor.clientHeight + 1)) clipped.push(`${ancestor.className}:y`);
    }
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return {
      clipped, selfOverflow: node.scrollWidth > node.clientWidth + 1 || node.scrollHeight > node.clientHeight + 1,
      left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom,
      hit: !!hit && (node.contains(hit) || hit.contains(node)),
    };
  });
  expect(evidence.clipped, 'Prerequisite text must not be clipped by an overflow container').toEqual([]);
  expect(evidence.selfOverflow, 'Prerequisite text must not be ellipsized or vertically cut off').toBe(false);
  expect(evidence.hit, 'Prerequisite text must not be covered by another control').toBe(true);
  const viewport = page.viewportSize()!;
  expect(evidence.left).toBeGreaterThanOrEqual(-1); expect(evidence.top).toBeGreaterThanOrEqual(-1);
  expect(evidence.right).toBeLessThanOrEqual(viewport.width + 1); expect(evidence.bottom).toBeLessThanOrEqual(viewport.height + 1);
}
async function expectBuild(page: Page, id: BuildingId, state: Status, text: string) {
  const card = buildCard(page, id), status = card.locator('.build-prerequisite');
  await expect(card).toHaveAccessibleName(`Build ${BUILDINGS[id].name}`);
  await expect(status).toHaveAttribute('data-prerequisite-state', state);
  await expect(status).toHaveText(text);
  await expect(card).toHaveAccessibleDescription(text);
  if (state !== 'ready') await expect(status).not.toContainText(/ready|complete/i);
  await readable(page, status);
}
async function expectPath(page: Page, name: string, state: Status, text: string) {
  const path = researchPath(page, name);
  await expect(path).toHaveAttribute('data-prerequisite-state', state);
  await expect(path.locator('small')).toHaveText(text);
  if (state !== 'ready') await expect(path).not.toHaveClass(/\bready\b/);
  await readable(page, path.locator('small'));
}
async function phoneFrame(page: Page, theme: Theme, name: string) {
  if (!test.info().project.name.startsWith('phone-')) return;
  await page.evaluate(() => document.fonts.ready);
  await expect.poll(() => page.evaluate(() => {
    const renderer = window.__FRONTIER__.renderer as RendererProbe;
    return renderer.atlas.ready && !!renderer.atlas.image?.complete && renderer.atlas.image.naturalWidth > 0;
  })).toBe(true);
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await page.screenshot({ path: test.info().outputPath(`prerequisite-${theme}-${name}-${test.info().project.name}.png`), scale: 'css', animations: 'disabled' });
}
async function queueBuilding(page: Page, id: 'blacksmith' | 'range') {
  await press(page, action(page, 'panel-build'));
  await press(page, buildCard(page, id));
  await tap(page, await clearGround(page, id));
  await expect(action(page, 'confirm-placement')).toBeEnabled();
  await press(page, action(page, 'confirm-placement'));
  await expect.poll(() => page.evaluate(() => window.__FRONTIER__.state.pendingCommands)).toEqual([
    expect.objectContaining({ type: 'build', team: 0, building: id }),
  ]);
  expect((await snapshot(page)).entities.filter(e => e.team === 0 && e.type === id)).toEqual([]);
}
async function saveLeaveReload(page: Page) {
  const before = await snapshot(page), profile = await page.evaluate(() => window.__FRONTIER__.profile);
  await press(page, action(page, 'pause-menu'));
  await press(page, page.getByRole('button', { name: 'Save & leave', exact: true }));
  await expect(action(page, 'continue')).toBeVisible();
  await page.reload();
  await press(page, action(page, 'continue'));
  await expect(page.locator('.hud')).toBeVisible();
  expect(await snapshot(page)).toEqual(before);
  expect(await page.evaluate(() => window.__FRONTIER__.profile)).toEqual(profile);
}

/** Read-only geometry probe: find a site that would be legal AFTER Blacksmith
 * completion. Only this detached snapshot gets completed; the browser's real
 * queued prerequisite remains untouched and must reject native confirmation. */
async function blockedWorkshopSite(page: Page): Promise<Point> {
  const fixture = await page.evaluate(() => {
    const { state, renderer } = window.__FRONTIER__, candidates: { world: Point; screen: Point }[] = [];
    const clearance = navigator.maxTouchPoints ? 22 : 4;
    for (let y = 1.5; y < state.map.height - 1; y += .5) for (let x = 1.5; x < state.map.width - 1; x += .5) {
      const screen = renderer.worldToScreen(x, y);
      if (screen.x < clearance || screen.x > innerWidth - clearance || screen.y < 100 || screen.y > innerHeight - clearance) continue;
      if ([-clearance, 0, clearance].every(dx => [-clearance, 0, clearance].every(dy => document.elementFromPoint(screen.x + dx, screen.y + dy)?.id === 'world')) && !renderer.pick(state, screen.x, screen.y)) candidates.push({ world: { x, y }, screen });
    }
    return { state, candidates };
  });
  const completedProbe = projectPendingCommands(fixture.state);
  for (const entity of completedProbe.entities) if (entity.team === 0 && entity.type === 'blacksmith') entity.buildProgress = 1;
  // Use actual pre-payment balances for geometry discovery, matching the first
  // canBuild check in plannedBuildResult. Projected reservation costs would
  // otherwise mask the prerequisite that this native rejected tap isolates.
  completedProbe.players[0].gold = fixture.state.players[0].gold;
  completedProbe.players[0].wood = fixture.state.players[0].wood;
  const candidate = fixture.candidates.find(({ world }) => canBuild(completedProbe, 0, 'workshop', world.x, world.y).ok);
  expect(candidate, 'A reachable site must isolate prerequisite rejection from terrain/overlap errors').toBeDefined();
  expect(plannedBuildResult(fixture.state, 0, 'workshop', candidate!.world.x, candidate!.world.y)).toEqual({ ok: false, error: 'Requires Blacksmith.' });
  return candidate!.screen;
}

for (const theme of ['christmas', 'mythic'] as const) {
  test.describe(`prerequisite clarity · ${theme}`, () => {
    test('controlled Barracks states refresh Build readiness without reopening', async ({ page }) => {
      test.info().annotations.push({ type: 'controlled-fixture', description: 'One existing starting Barracks is destroyed, removed, restored unfinished, then restored complete while paused. No combat or earned-building claim.' });
      await startBattle(page, theme);
      await press(page, action(page, 'panel-build'));
      const before = await snapshot(page), barracks = before.entities.find(e => e.team === 0 && e.type === 'barracks')!;
      expect(barracks.buildProgress).toBe(1);
      await expectBuild(page, 'stable', 'ready', 'Barracks ready');
      await expectBuild(page, 'blacksmith', 'ready', 'Barracks ready');
      await phoneFrame(page, theme, 'build-ready');
      await page.evaluate(id => { window.__FRONTIER__.state.entities.find(e => e.id === id)!.hp = 0; }, barracks.id);
      await expectBuild(page, 'stable', 'missing', 'Needs Barracks');
      await expectBuild(page, 'blacksmith', 'missing', 'Needs Barracks');
      await phoneFrame(page, theme, 'build-destroyed-missing');
      await page.evaluate(id => { const state = window.__FRONTIER__.state; state.entities = state.entities.filter(e => e.id !== id); }, barracks.id);
      await expectBuild(page, 'stable', 'missing', 'Needs Barracks');
      await page.evaluate(original => { window.__FRONTIER__.state.entities.push({ ...original, buildProgress: .4, hp: original.maxHp * .4 }); }, barracks);
      await expectBuild(page, 'stable', 'constructing', 'Barracks under construction');
      await expectBuild(page, 'blacksmith', 'constructing', 'Barracks under construction');
      await page.evaluate(original => { const state = window.__FRONTIER__.state; state.entities[state.entities.findIndex(e => e.id === original.id)] = original; }, barracks);
      await expectBuild(page, 'stable', 'ready', 'Barracks ready');
      await expectBuild(page, 'blacksmith', 'ready', 'Barracks ready');
      const after = await snapshot(page);
      expect(after.time).toBe(before.time); expect(after.pendingCommands).toEqual(before.pendingCommands);
      expect(after.players).toEqual(before.players);
      expect([...after.entities].sort((a, b) => a.id.localeCompare(b.id))).toEqual([...before.entities].sort((a, b) => a.id.localeCompare(b.id)));
    });

    test('native queued Blacksmith stays pending through save reload and gates Workshop until built', async ({ page }) => {
      test.setTimeout(60_000);
      await startBattle(page, theme); await fasterConstruction(page);
      await press(page, action(page, 'panel-build'));
      await expectBuild(page, 'workshop', 'missing', 'Needs Blacksmith');
      const before = await snapshot(page);
      await queueBuilding(page, 'blacksmith');
      const queued = await snapshot(page);
      expect(queued.players[0].gold).toBe(before.players[0].gold); expect(queued.players[0].wood).toBe(before.players[0].wood);
      await press(page, action(page, 'panel-build'));
      await expectBuild(page, 'workshop', 'queued', 'Blacksmith queued · Resume to start');
      await phoneFrame(page, theme, 'build-queued');
      await press(page, buildCard(page, 'workshop'));
      await tap(page, await blockedWorkshopSite(page));
      await expect(page.locator('#placement-controls [data-placement-state]')).toContainText('Requires Blacksmith.');
      await expect(action(page, 'confirm-placement')).toBeDisabled();
      expect((await snapshot(page)).pendingCommands).toEqual(queued.pendingCommands);
      await press(page, action(page, 'cancel-build'));
      await press(page, action(page, 'panel-research'));
      await expectPath(page, 'Blacksmith', 'queued', 'Queued · Resume to start');
      await expect(researchNode(page, 'steel')).toBeDisabled();
      await expect(researchNode(page, 'steel')).toContainText(/Blacksmith queued.*Resume to start/);
      await phoneFrame(page, theme, 'research-queued');
      await saveLeaveReload(page);
      await press(page, action(page, 'panel-build'));
      await expectBuild(page, 'workshop', 'queued', 'Blacksmith queued · Resume to start');
      await press(page, action(page, 'panel-research'));
      await expectPath(page, 'Blacksmith', 'queued', 'Queued · Resume to start');
      await expect(researchNode(page, 'steel')).toBeDisabled();
      await setPaused(page, false);
      await expect.poll(() => page.evaluate(() => window.__FRONTIER__.state.entities.some(e => e.team === 0 && e.type === 'blacksmith' && e.buildProgress < 1))).toBe(true);
      await setPaused(page, true);
      await expectPath(page, 'Blacksmith', 'constructing', 'Under construction');
      await expect(researchNode(page, 'steel')).toBeDisabled();
      await expect(researchNode(page, 'steel')).toContainText('Blacksmith under construction');
      await press(page, action(page, 'panel-build'));
      await expectBuild(page, 'workshop', 'constructing', 'Blacksmith under construction');
      await setPaused(page, false);
      await expect.poll(() => page.evaluate(() => window.__FRONTIER__.state.entities.some(e => e.team === 0 && e.type === 'blacksmith' && e.buildProgress >= 1)), { timeout: 20_000 }).toBe(true);
      await expectBuild(page, 'workshop', 'ready', 'Blacksmith ready');
      await setPaused(page, true);
      const completed = await snapshot(page);
      expect(completed.pendingCommands).toEqual([]);
      expect(completed.entities.filter(e => e.team === 0 && e.type === 'blacksmith')).toHaveLength(1);
      expect(completed.commandLog.filter(e => e.command.type === 'build' && e.command.building === 'blacksmith')).toHaveLength(1);
      expect(completed.players[0].wood - before.players[0].wood - (completed.players[0].stats.woodCollected - before.players[0].stats.woodCollected)).toBeCloseTo(-BUILDINGS.blacksmith.cost.wood, 5);
      await press(page, action(page, 'panel-research'));
      await expectPath(page, 'Blacksmith', 'ready', 'Ready');
      await expect(researchNode(page, 'steel')).toBeEnabled();
      await expect(researchNode(page, 'steel')).toContainText('Research level 1');
    });

    test('native Range construction updates Recruit and Research without false readiness or card churn', async ({ page }) => {
      test.setTimeout(60_000);
      await startBattle(page, theme); await fasterConstruction(page);
      await press(page, action(page, 'panel-army'));
      await expect(recruitCard(page)).toHaveClass(/unavailable/);
      await expect(recruitCard(page)).toContainText('Needs Archery Range');
      await expect(recruitCard(page)).toHaveAccessibleDescription(/Needs Archery Range/);
      await queueBuilding(page, 'range');
      await press(page, action(page, 'panel-army'));
      await expect(recruitCard(page)).toHaveClass(/unavailable/);
      await expect(recruitCard(page)).toContainText('Archery Range queued · Resume to start');
      await expect(recruitCard(page)).toHaveAccessibleDescription(/Archery Range queued · Resume to start/);
      await readable(page, recruitCard(page).locator('[data-prerequisite-state="queued"]'));
      await press(page, action(page, 'panel-research'));
      await expectPath(page, 'Archery Range', 'queued', 'Queued · Resume to start');
      await expect(researchNode(page, 'fletching')).toBeDisabled();
      await setPaused(page, false);
      await expect.poll(() => page.evaluate(() => window.__FRONTIER__.state.entities.some(e => e.team === 0 && e.type === 'range' && e.buildProgress < 1))).toBe(true);
      await setPaused(page, true);
      await expectPath(page, 'Archery Range', 'constructing', 'Under construction');
      await expect(researchNode(page, 'fletching')).toBeDisabled();
      await press(page, action(page, 'panel-army'));
      await expect(recruitCard(page)).toHaveClass(/unavailable/);
      await expect(recruitCard(page)).toContainText('Archery Range under construction');
      await expect(recruitCard(page)).toHaveAccessibleDescription(/Archery Range under construction/);
      await readable(page, recruitCard(page).locator('[data-prerequisite-state="constructing"]'));
      const pausedCard = await recruitCard(page).elementHandle();
      await setPaused(page, false);
      // Resume is a real status transition and may replace the card. Capture
      // only after that transition; fractional progress alone must not churn it.
      await expect.poll(() => pausedCard!.evaluate(node => node.isConnected)).toBe(false);
      await pausedCard!.dispose();
      await expect(recruitCard(page)).toContainText('Archery Range under construction');
      const handle = await recruitCard(page).elementHandle();
      const progress = (await snapshot(page)).entities.find(e => e.team === 0 && e.type === 'range')!.buildProgress;
      await expect.poll(() => page.evaluate(() => window.__FRONTIER__.state.entities.find(e => e.team === 0 && e.type === 'range')!.buildProgress)).toBeGreaterThan(progress + .05);
      expect(await handle!.evaluate(node => node.isConnected)).toBe(true);
      await expect(recruitCard(page)).toHaveClass(/unavailable/);
      await expect.poll(() => page.evaluate(() => window.__FRONTIER__.state.entities.some(e => e.team === 0 && e.type === 'range' && e.buildProgress >= 1)), { timeout: 20_000 }).toBe(true);
      await expect(recruitCard(page)).not.toHaveClass(/unavailable/);
      await expect(recruitCard(page)).not.toContainText(/Needs Archery Range|under construction|Resume to start/);
      await handle!.dispose();
      await setPaused(page, true);
      await press(page, recruitCard(page));
      expect((await snapshot(page)).pendingCommands).toEqual([expect.objectContaining({ type: 'recruit', team: 0, unit: 'archer' })]);
      await press(page, action(page, 'panel-research'));
      await expectPath(page, 'Archery Range', 'ready', 'Ready');
      await expect(researchNode(page, 'fletching')).toBeEnabled();
      await expect(researchNode(page, 'fletching')).toContainText('Research level 1');

      // Bounded capacity fixture after the native construction/recruit flow:
      // copy the real paid Archer job to eight/twelve occupied slots. These
      // jobs are controlled UI fixtures, not earned purchases or natural play.
      test.info().annotations.push({ type: 'controlled-fixture', description: 'Final queue-capacity phase duplicates the one natively paid Archer production job to 8 and 12 slots while paused. Batch selection and rejected recruitment use native inputs.' });
      await setPaused(page, false); await setPaused(page, true);
      const production = (await snapshot(page)).entities.find(e => e.team === 0 && e.type === 'range')!;
      expect(production.queue).toHaveLength(1);
      expect((await snapshot(page)).pendingCommands).toEqual([]);
      await page.evaluate(({ id, job }) => {
        window.__FRONTIER__.state.entities.find(e => e.id === id)!.queue = Array.from({ length: 8 }, (_, i) => ({ ...job, queueId: `prerequisite-capacity-${i}` }));
      }, { id: production.id, job: production.queue[0] });
      await press(page, action(page, 'panel-army'));
      await press(page, page.getByRole('button', { name: 'Queue 5 at a time', exact: true }));
      await expect(recruitCard(page)).not.toHaveClass(/unavailable/);
      await expect(recruitCard(page)).not.toContainText(/Needs Archery Range|Production queue full/);
      await expect(recruitCard(page)).toContainText('Not enough queue space for 5 troops');
      await expect(recruitCard(page)).toHaveAccessibleDescription('Not enough queue space for 5 troops');
      await readable(page, recruitCard(page).locator('#recruit-queue-archer'));
      await press(page, recruitCard(page));
      await expect(page.locator('#toast')).toContainText('Recruitment queue is full.');
      expect((await snapshot(page)).pendingCommands).toEqual([]);
      expect((await snapshot(page)).entities.find(e => e.id === production.id)!.queue).toHaveLength(8);
      await press(page, page.getByRole('button', { name: 'Queue 1 at a time', exact: true }));
      await expect(recruitCard(page)).not.toContainText('Not enough queue space');
      await page.evaluate(({ id, job }) => {
        window.__FRONTIER__.state.entities.find(e => e.id === id)!.queue = Array.from({ length: 12 }, (_, i) => ({ ...job, queueId: `prerequisite-capacity-${i}` }));
      }, { id: production.id, job: production.queue[0] });
      await expect(recruitCard(page)).not.toHaveClass(/unavailable/);
      await expect(recruitCard(page)).not.toContainText('Needs Archery Range');
      await expect(recruitCard(page)).toContainText('Production queue full');
      await expect(recruitCard(page)).toHaveAccessibleDescription('Production queue full');
      await readable(page, recruitCard(page).locator('#recruit-queue-archer'));
      await press(page, recruitCard(page));
      expect((await snapshot(page)).pendingCommands).toEqual([]);
      expect((await snapshot(page)).entities.find(e => e.id === production.id)!.queue).toHaveLength(12);
    });
  });
}
