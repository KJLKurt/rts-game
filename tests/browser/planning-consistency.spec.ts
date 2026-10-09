import type { Locator, Page } from '@playwright/test';
import { BUILDINGS, canBuild, productionRate, productionRefund, projectPendingCommands } from '../../src/sim';
import type { GameState, Point } from '../../src/sim/types';
import type { RenderOptions } from '../../src/render/Battlefield';
import { action, expect, home, tap, test } from './helpers';

// Three desktop red-first identities. No test calls the command/start/save bridge,
// changes DOM controls, or clicks through an obstruction. The named setup writes
// below are controlled fixtures, not an earned upgrade or a natural-play claim.
// All measured actions after each setup boundary use native user controls.
test.describe.configure({ retries: 0 });
test.beforeEach(async ({ isMobile }) => {
  test.skip(isMobile, 'Desktop red-first reproduction; phone expansion follows confirmed failure and fix.');
});
type RendererProbe = Window['__FRONTIER__']['renderer'] & { lastOptions: RenderOptions };
const snapshot = (page: Page): Promise<GameState> => page.evaluate(() => structuredClone(window.__FRONTIER__.state));
const jobs = (state: GameState) => state.entities.filter(e => e.team === 0 && e.kind === 'building' && e.hp > 0 && e.queue.length);
const houses = (state: GameState) => state.entities.filter(e => e.team === 0 && e.type === 'house');
const purse = (state: GameState) => ({ gold: state.players[0].gold, wood: state.players[0].wood });

async function press(page: Page, control: Locator) {
  await control.scrollIntoViewIfNeeded();
  if (await page.evaluate(() => navigator.maxTouchPoints > 0)) await control.tap();
  else await control.click();
}
async function painted(page: Page) {
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}
async function setPaused(page: Page, value: boolean) {
  if ((await snapshot(page)).paused !== value) await press(page, action(page, 'pause'));
  await expect.poll(() => page.evaluate(() => window.__FRONTIER__.state.paused)).toBe(value);
}
async function collapse(page: Page) {
  if (!await page.locator('.command-deck').evaluate(node => node.classList.contains('collapsed')))
    await press(page, action(page, 'toggle-deck'));
}
async function launchMode(page: Page, mode: 'domination' | 'conquest', keepTips = false, speed = 1) {
  await home(page);
  await press(page, action(page, 'skirmish'));
  await page.getByLabel('Map seed', { exact: true }).fill('QA-FRONTIER-2026');
  await page.locator('select[name="mapGenerationVersion"]').selectOption('4');
  await page.locator('select[name="mapSize"]').selectOption('small');
  await page.locator('select[name="difficulty"]').selectOption('easy');
  await page.locator('select[name="mode"]').selectOption(mode);
  await page.getByLabel('Game speed · × real time', { exact: true }).fill(String(speed));
  await press(page, action(page, 'launch'));
  await expect.poll(() => page.evaluate(() => window.__FRONTIER__.playing)).toBe(true);
  const briefing = page.getByRole('dialog', { name: 'Your first frontier', exact: true });
  if (await briefing.count()) {
    await expect(briefing).toContainText(mode === 'conquest' ? 'Destroy the enemy keeps to win.' : 'Relics earn victory points');
    await press(page, page.getByRole('button', { name: 'Start battle', exact: true }));
  }
  await setPaused(page, true);
  if (!keepTips && await action(page, 'dismiss-tips').isVisible()) await press(page, action(page, 'dismiss-tips'));
  // Initial peaceful test setup only. Terrain, forces, supplies, capture evidence,
  // command history, and all ordinary win conditions remain generated and intact.
  await page.evaluate(() => window.__FRONTIER__.state.players.forEach(p => { p.ai = false; }));
  test.info().annotations.push({ type: 'controlled-fixture', description: `${mode}: AI disabled while paused before measured input; generated map and forces retained. No earned-victory claim.` });
  expect((await snapshot(page)).settings).toMatchObject({ mode, mapGenerationVersion: 4, mapSize: 'small', difficulty: 'easy', gameSpeed: speed });
}

/** Preserve the actual state and hit/clip geometry before any defect assertion. */
async function evidence(page: Page, name: string, details: unknown) {
  await painted(page);
  const observed = await page.evaluate(() => {
    const selectors = ['#battle-hint', '#battle-hint p', '#objective', '#compact-production', '.command-deck', '#production-strip', '#placement-controls', '[data-action="confirm-placement"]'];
    const geometry = selectors.flatMap(selector => [...document.querySelectorAll<HTMLElement>(selector)].map(node => {
      const r = node.getBoundingClientRect(), style = getComputedStyle(node);
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      const clips = [];
      for (let parent = node.parentElement; parent; parent = parent.parentElement) {
        const s = getComputedStyle(parent), box = parent.getBoundingClientRect();
        if (/(auto|scroll|hidden|clip)/.test(s.overflowX + s.overflowY)) clips.push({ tag: parent.tagName, id: parent.id, className: parent.className, rect: box.toJSON(), clientWidth: parent.clientWidth, clientHeight: parent.clientHeight });
      }
      return { selector, text: node.textContent, rect: r.toJSON(), display: style.display, visibility: style.visibility, centerHit: hit?.id || hit?.className || hit?.tagName, containsCenterHit: !!hit && (node.contains(hit) || hit.contains(node)), clips };
    }));
    const r = window.__FRONTIER__.renderer as RendererProbe;
    return { state: structuredClone(window.__FRONTIER__.state), viewport: { width: innerWidth, height: innerHeight, touch: navigator.maxTouchPoints }, camera: { ...r.camera }, geometry, placement: r.lastOptions.placement ?? null, plans: r.lastOptions.plannedConstruction ?? [], compact: document.querySelector('#compact-production')?.textContent, expanded: [...document.querySelectorAll('.producer')].map(node => ({ id: (node as HTMLElement).dataset.liveKey, text: node.textContent })) };
  });
  await test.info().attach(`${name}-ledger`, { body: JSON.stringify({ details, ...observed }, null, 2), contentType: 'application/json' });
  await test.info().attach(`${name}-screen`, { body: await page.screenshot({ scale: 'css' }), contentType: 'image/png' });
  return observed;
}

/** Read current canvas geometry and use genuine picking to avoid sprite/overlay errors. */
async function resourcePoint(page: Page, id: string) {
  await painted(page);
  const point = await page.evaluate(id => {
    const { state, renderer } = window.__FRONTIER__, node = state.map.nodes.find(n => n.id === id)!;
    const center = renderer.worldToScreen(node.x, node.y), margin = navigator.maxTouchPoints ? 22 : 3;
    for (const radius of [0, 8, 16, 24, 32, 48, 64]) for (let i = 0; i < 16; i++) {
      const p = { x: center.x + Math.cos(i * Math.PI / 8) * radius, y: center.y + Math.sin(i * Math.PI / 8) * radius };
      if ([-margin, 0, margin].some(dx => [-margin, 0, margin].some(dy => document.elementFromPoint(p.x + dx, p.y + dy)?.id !== 'world'))) continue;
      const picked = renderer.pick(state, p.x, p.y) as { id?: string } | null;
      if (picked?.id === id) return p;
    }
    return null;
  }, id);
  expect(point, `Visible resource ${id} needs an unobscured, native canvas target`).not.toBeNull();
  return point!;
}

async function reachFourthGuideStep(page: Page, mode: 'domination' | 'conquest') {
  await launchMode(page, mode, true, 2);
  const initial = await snapshot(page);
  const hero = initial.entities.find(e => e.team === 0 && e.kind === 'commander')!;
  const gold = initial.map.nodes.filter(n => n.kind === 'gold' && n.owner === null && n.amount > 0 && initial.fog.explored[0][Math.floor(n.y) * initial.map.width + Math.floor(n.x)])
    .sort((a, b) => Math.hypot(a.x - hero.x, a.y - hero.y) - Math.hypot(b.x - hero.x, b.y - hero.y))[0];
  expect(gold, 'The generated map provides a real unexplored-to-owned supply milestone').toBeDefined();
  await press(page, action(page, 'select-army'));
  await press(page, action(page, 'economy').first());
  await press(page, action(page, 'find-gold'));
  // Find gold deliberately releases commander-follow and centers the real node.
  await expect(page.locator('#toast')).not.toHaveClass(/show/);
  await tap(page, await resourcePoint(page, gold.id));
  await press(page, action(page, 'capture-resource'));
  expect((await snapshot(page)).pendingCommands).toContainEqual(expect.objectContaining({ type: 'capture', nodeId: gold.id }));
  await setPaused(page, false);
  await expect.poll(() => page.evaluate(id => window.__FRONTIER__.state.map.nodes.find(n => n.id === id)?.owner, gold.id), { timeout: 35_000 }).toBe(0);
  await expect(page.locator('#battle-hint > span')).toHaveText('COMMANDER’S FIELD GUIDE · 3/4');
  await setPaused(page, true);
  const captured = await snapshot(page);
  expect(captured.players[0].stats.captures).toBeGreaterThan(initial.players[0].stats.captures);
  expect(captured.commandLog.some(e => e.command.type === 'capture' && e.command.team === 0)).toBe(true);
  await press(page, action(page, 'panel-army'));
  await press(page, page.getByRole('button', { name: 'Recruit Swordsman', exact: true }));
  await setPaused(page, false);
  await expect.poll(() => page.evaluate(() => window.__FRONTIER__.state.players[0].stats.unitsCreated), { timeout: 20_000 }).toBeGreaterThan(4);
  await expect(page.locator('#battle-hint > span')).toHaveText('COMMANDER’S FIELD GUIDE · 4/4');
  await setPaused(page, true); await collapse(page);
  const final = await snapshot(page);
  expect(final.commandLog.some(e => e.command.type === 'recruit' && e.command.team === 0)).toBe(true);
  await expect(page.locator('#battle-hint p')).toBeVisible();
  return { initial, captured, final, capturedNode: gold.id, setup: 'Only AI disabled; native generated deposit capture and paid recruitment completed; no tutorial progress/event injection.' };
}

test('C1 fourth field-guide step teaches the active victory mode after real capture and recruitment', async ({ page }) => {
  test.setTimeout(160_000);
  const control = await reachFourthGuideStep(page, 'domination');
  await evidence(page, 'C1-domination-control-fourth-step', control);
  await expect(page.locator('#battle-hint p')).toContainText(/relics.*(?:score|victory points)/i);
  await expect(page.locator('#objective')).toContainText('Relics earn victory points');
  await press(page, action(page, 'pause-menu')); await press(page, action(page, 'save-leave'));
  await expect(action(page, 'continue')).toBeVisible();
  const conquest = await reachFourthGuideStep(page, 'conquest');
  await evidence(page, 'C1-conquest-fourth-step-before-assertion', conquest);
  await expect(page.locator('#objective')).toContainText('Destroy the enemy keeps');
  await expect(page.locator('#objective')).toContainText('Relics fund your siege');
  // Intended current-production red assertion: ordinary fourth-step text says
  // “Hold relics to score” despite the active Conquest victory rules.
  await expect(page.locator('#battle-hint p'), 'Conquest field guide must explain the actual keep-destruction victory condition').toContainText(/destroy.*(?:enemy |opposing )?keeps?/i);
  await expect(page.locator('#battle-hint p')).toContainText(/(?:gold|wood|income|fund|siege)/i);
  await expect(page.locator('#battle-hint p')).not.toContainText(/(?:to score|victory points)/i);
});

test('C2 compact next countdown agrees with the earliest rate-adjusted paid parallel producer', async ({ page }) => {
  test.setTimeout(60_000);
  await launchMode(page, 'domination');
  // Controlled upgrade setup before recruiting. No queue or remaining time is
  // injected. The upgrade is not claimed as earned; both jobs will be paid.
  await page.evaluate(() => { window.__FRONTIER__.state.entities.find(e => e.team === 0 && e.type === 'barracks')!.buildingLevel = 3; });
  test.info().annotations.push({ type: 'controlled-fixture', description: 'Initial Barracks buildingLevel=3; existing Keep stays level 1. All recruitment, payment, pause and completion use native UI.' });
  const before = await snapshot(page);
  await press(page, action(page, 'panel-army'));
  await press(page, page.getByRole('button', { name: 'Recruit Swordsman', exact: true }));
  await press(page, page.getByRole('button', { name: 'Recruit Swordsman', exact: true }));
  expect((await snapshot(page)).pendingCommands.filter(c => c.type === 'recruit')).toHaveLength(2);
  await setPaused(page, false);
  await expect.poll(async () => jobs(await snapshot(page)).length).toBe(2);
  await setPaused(page, true);
  const paid = await snapshot(page);
  expect(paid.pendingCommands).toEqual([]);
  const heads = jobs(paid).map(b => ({ buildingId: b.id, building: b.type, queueId: b.queue[0].queueId!, remaining: b.queue[0].remaining, type: b.queue[0].type, rate: b.queue[0].type === 'buildingUpgrade' ? 1 : productionRate(b), paidCost: b.queue[0].paidCost! }));
  expect(heads).toHaveLength(2);
  for (const head of heads) expect(head.paidCost).toEqual({ gold: 45, wood: 10 });
  expect(paid.players[0].wood - before.players[0].wood - (paid.players[0].stats.woodCollected - before.players[0].stats.woodCollected)).toBeCloseTo(-20, 8);
  const earliest = heads.reduce((a, b) => a.remaining / a.rate < b.remaining / b.rate ? a : b);
  const expectedSeconds = Math.ceil(earliest.remaining / earliest.rate);
  expect(earliest.building).toBe('barracks');
  expect(heads[0].building).toBe('keep');
  expect(expectedSeconds).toBeLessThan(Math.ceil(heads[0].remaining));
  const expanded = [];
  for (const head of heads) {
    const row = page.locator(`.producer[data-live-key="${head.buildingId}"]`);
    await row.scrollIntoViewIfNeeded();
    await expect(row).toContainText(`${Math.ceil(head.remaining / head.rate)}s remaining`);
    expanded.push({ ...head, visibleText: await row.innerText() });
  }
  await evidence(page, 'C2-expanded-paid-parallel-queues', { before, heads, earliest, expectedSeconds, expanded });
  await collapse(page);
  await evidence(page, 'C2-compact-before-assertion', { paid, heads, earliest, expectedSeconds, expanded, units: 'game seconds; playback speed 1' });
  await expect(page.locator('#compact-production')).toBeVisible();
  // Intended current-production red: first Keep raw time, instead of the
  // later Barracks head's earlier completion after its production-rate bonus.
  await expect(page.locator('#compact-production')).toHaveText(`2 queued · ${expectedSeconds}s next`);
  // Post-fix continuation: the displayed next job must actually complete first.
  await setPaused(page, false);
  await expect.poll(() => page.evaluate(({ buildingId, queueId }) => !window.__FRONTIER__.state.entities.find(e => e.id === buildingId)!.queue.some(q => q.queueId === queueId), earliest), { timeout: 15_000, intervals: [50] }).toBe(true);
  await setPaused(page, true);
  const completed = await snapshot(page);
  expect(completed.time - paid.time).toBeGreaterThanOrEqual(earliest.remaining / earliest.rate - .11);
  expect(completed.time - paid.time).toBeLessThanOrEqual(earliest.remaining / earliest.rate + .8);
  expect(completed.entities.find(e => e.id === heads[0].buildingId)!.queue.some(q => q.queueId === heads[0].queueId)).toBe(true);
  expect(completed.players[0].stats.unitsCreated).toBe(paid.players[0].stats.unitsCreated + 1);
  await evidence(page, 'C2-observed-next-completion', { earliest, elapsedGameSeconds: completed.time - paid.time, expectedGameSeconds: earliest.remaining / earliest.rate });
});

/** Select a real legal projected site using only a copied state. We intentionally
 * do not use plannedBuildResult here: that is the affordance under test.
 */
async function projectedHouseSite(page: Page) {
  await expect(page.locator('#toast')).not.toHaveClass(/show/);
  await painted(page);
  const read = await page.evaluate(() => {
    const { state, renderer } = window.__FRONTIER__;
    const hero = state.entities.find(e => e.team === 0 && e.kind === 'commander')!;
    const margin = navigator.maxTouchPoints ? 22 : 6;
    const candidates: { world: Point; screen: Point }[] = [];
    for (let y = Math.max(2, Math.floor(hero.y - 9)); y <= Math.min(state.map.height - 2, hero.y + 9); y += .5)
      for (let x = Math.max(2, Math.floor(hero.x - 9)); x <= Math.min(state.map.width - 2, hero.x + 9); x += .5) {
        const world = { x, y }, screen = renderer.worldToScreen(x, y);
        if (!state.fog.visible[0][Math.floor(y) * state.map.width + Math.floor(x)]) continue;
        if (screen.x < 30 || screen.y < 120 || screen.x > innerWidth - 30 || screen.y > innerHeight - 40) continue;
        if ([-margin, 0, margin].some(dx => [-margin, 0, margin].some(dy => document.elementFromPoint(screen.x + dx, screen.y + dy)?.id !== 'world'))) continue;
        if (renderer.pick(state, screen.x, screen.y)) continue;
        candidates.push({ world, screen });
      }
    return { state: structuredClone(state), candidates };
  });
  const projected = projectPendingCommands(read.state);
  const site = read.candidates.find(candidate => canBuild(projected, 0, 'house', candidate.world.x, candidate.world.y).ok);
  expect(site, 'A generated legal projected site must exist; no live terrain/positions/funds are changed to create one').toBeDefined();
  return { ...site!, current: canBuild(read.state, 0, 'house', site!.world.x, site!.world.y), projected: canBuild(projected, 0, 'house', site!.world.x, site!.world.y), currentPurse: purse(read.state), projectedPurse: purse(projected), candidateCount: read.candidates.length };
}

test('C4 a real queued full refund enables House confirmation and survives Save Continue Resume exactly once', async ({ page }) => {
  test.setTimeout(75_000);
  await launchMode(page, 'domination');
  await press(page, action(page, 'panel-army'));
  await press(page, page.getByRole('button', { name: 'Queue 3 at a time', exact: true }));
  await press(page, page.getByRole('button', { name: 'Recruit Swordsman', exact: true }));
  await setPaused(page, false);
  await expect.poll(async () => jobs(await snapshot(page)).reduce((count, b) => count + b.queue.length, 0)).toBe(3);
  await setPaused(page, true);
  const recruited = await snapshot(page), producer = jobs(recruited)[0], tail = producer.queue[2];
  expect(tail.remaining).toBe(tail.total);
  expect(tail.paidCost).toEqual({ gold: 45, wood: 10 });
  const refund = productionRefund(recruited, producer, tail);
  expect(refund).toEqual({ gold: 45, wood: 10 });
  const cancel = page.locator(`[data-action="cancel-production"][data-id="${producer.id}|${tail.queueId}"]`);
  await cancel.scrollIntoViewIfNeeded();
  await expect(cancel).toHaveAccessibleName('Cancel Swordsman; refund 45 gold and 10 wood');
  await evidence(page, 'C4-real-paid-unstarted-refund-before-budget-setup', { producerId: producer.id, tail, refund });
  // One-time harder-budget setup, after the native paid-job provenance above.
  // No queue, progress, income, geometry, terrain or command history is altered.
  // This is the final live-state write in this test. Subsequent actions are native.
  await page.evaluate(() => { window.__FRONTIER__.state.players[0].wood = 55; });
  test.info().annotations.push({ type: 'controlled-fixture', description: 'After native paid recruitment and paused full-refund verification, set only current wood to 55. All Cancel/Build/Save/Continue/Resume actions thereafter are native; no later state writes.' });
  const before = await snapshot(page);
  expect(before.players[0].wood).toBe(55);
  expect(before.entities.find(e => e.id === producer.id)!.queue[2]).toEqual(tail);
  await press(page, cancel);
  await expect.poll(async () => (await snapshot(page)).pendingCommands).toEqual([{ type: 'cancelProduction', team: 0, buildingId: producer.id, queueId: tail.queueId }]);
  const cancelled = await snapshot(page), projected = projectPendingCommands(cancelled);
  expect(purse(cancelled)).toEqual(purse(before));
  expect(projected.players[0].wood).toBe(65);
  expect(projected.players[0].gold).toBe(before.players[0].gold + 45);
  await press(page, action(page, 'panel-build'));
  await press(page, page.getByRole('button', { name: 'Build House', exact: true }));
  await expect(page.locator('.placement-toolbar')).toBeVisible();
  if (await action(page, 'zoom-out').isVisible()) await press(page, action(page, 'zoom-out'));
  const site = await projectedHouseSite(page);
  expect(site.current.ok).toBe(false);
  expect(site.projected.ok).toBe(true);
  // Placement has already released follow mode. Re-read the current projection,
  // rather than reusing coordinates across a camera/control layout transition.
  const target = await page.evaluate(world => {
    const point = window.__FRONTIER__.renderer.worldToScreen(world.x, world.y);
    const margin = navigator.maxTouchPoints ? 22 : 6;
    return { ...point, clear: [-margin, 0, margin].every(dx => [-margin, 0, margin].every(dy => document.elementFromPoint(point.x + dx, point.y + dy)?.id === 'world')) };
  }, site.world);
  expect(target.clear).toBe(true);
  await tap(page, target);
  await expect.poll(() => page.evaluate(() => (window.__FRONTIER__.renderer as RendererProbe).lastOptions.placement)).toMatchObject({ type: 'house', ...site.world });
  await evidence(page, 'C4-refund-affordability-before-assertion', { setup: 'Native paid third job verified unstarted; only wood set to 55 before cancellation', recruited, before, cancelled, tail, refund, site, target });
  // Intended current-production red: preview rejects actual 55 wood before it
  // considers the preceding real 10-wood refund in the tactical projection.
  await expect(action(page, 'confirm-placement'), '65 projected wood must enable this canonically legal 65-wood House').toBeEnabled();
  await press(page, action(page, 'confirm-placement'));
  const queued = await snapshot(page);
  expect(queued.pendingCommands).toEqual([...cancelled.pendingCommands, { type: 'build', team: 0, building: 'house', ...site.world }]);
  expect(purse(queued)).toEqual(purse(before));
  expect(houses(queued)).toEqual(houses(before));
  expect(projectPendingCommands(queued).players[0].wood).toBe(0);
  await press(page, action(page, 'pause-menu')); await press(page, action(page, 'save-leave'));
  await expect(action(page, 'continue')).toBeVisible();
  await page.reload(); await press(page, action(page, 'continue'));
  await expect.poll(() => page.evaluate(() => window.__FRONTIER__.playing)).toBe(true);
  const restored = await snapshot(page);
  expect(restored.paused).toBe(true);
  expect(restored.time).toBe(queued.time);
  expect(restored.pendingCommands).toEqual(queued.pendingCommands);
  expect(purse(restored)).toEqual(purse(queued));
  expect(restored.entities.find(e => e.id === producer.id)!.queue).toEqual(queued.entities.find(e => e.id === producer.id)!.queue);
  // Do not attempt canvas input while Continue's commander follow is active.
  // Only native Resume and Pause are needed to verify execution and accounting.
  await setPaused(page, false);
  await expect.poll(async () => houses(await snapshot(page)).length).toBe(houses(before).length + 1);
  await setPaused(page, true);
  const executed = await snapshot(page);
  expect(executed.pendingCommands).toEqual([]);
  expect(houses(executed).filter(h => h.x === site.world.x && h.y === site.world.y)).toHaveLength(1);
  expect(executed.entities.find(e => e.id === producer.id)!.queue.some(q => q.queueId === tail.queueId)).toBe(false);
  expect(executed.commandLog.filter(e => e.command.type === 'cancelProduction')).toHaveLength(1);
  expect(executed.commandLog.filter(e => e.command.type === 'build')).toHaveLength(1);
  for (const resource of ['gold', 'wood'] as const) {
    const income = resource === 'gold' ? 'goldCollected' : 'woodCollected';
    expect(executed.players[0][resource] - before.players[0][resource] - (executed.players[0].stats[income] - before.players[0].stats[income])).toBeCloseTo(refund[resource] - BUILDINGS.house.cost[resource], 8);
  }
  await setPaused(page, false); await setPaused(page, true);
  const repeated = await snapshot(page);
  expect(houses(repeated).map(h => h.id)).toEqual(houses(executed).map(h => h.id));
  expect(repeated.commandLog.filter(e => ['cancelProduction', 'build'].includes(e.command.type))).toEqual(executed.commandLog.filter(e => ['cancelProduction', 'build'].includes(e.command.type)));
  await evidence(page, 'C4-save-continue-resume-once-only', { before, queued, restored, executed, repeated, refund, site });
});
