import type { Page } from '@playwright/test';
import { BUILDINGS, canBuild, projectPendingCommands } from '../../src/sim';
import type { GameCommand, GameState, Point } from '../../src/sim/types';
import type { RenderOptions } from '../../src/render/Battlefield';
import { plannedBuildResult } from '../../src/ui/placement';
import { footprintsOverlap } from '../../src/sim/construction';
import { action, acknowledgeFirstBriefing, expect, launch, pause, resume, tap, test } from './helpers';

// Evidence plan: only the two-plan + active-preview frame gets screenshots, once
// per theme in each existing phone project. CSS scale keeps them 390/844 px wide;
// desktop uses the same assertions and compact draw diagnostics without extra art.
// No tactical construction Undo exists. The only Undo below is the workshop's.
type BuildCommand = Extract<GameCommand, { type: 'build' }>;
type RendererProbe = Window['__FRONTIER__']['renderer'] & {
  lastOptions: RenderOptions;
  context: CanvasRenderingContext2D;
  visualTheme: string;
  entityHits: Map<string, {
    image: HTMLImageElement;
    frame: { x: number; y: number; w: number; h: number };
    bounds: { x: number; y: number; width: number; height: number };
    matrix: DOMMatrix;
  }>;
};
const houseCost = BUILDINGS.house.cost;
const placementStatus = (page: Page) => page.locator('#placement-controls [data-placement-state]');
const cancelPreview = (page: Page) => page.locator('#placement-controls [data-action="cancel-build"]').click();

async function nextFrame(page: Page) {
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}
async function rendered(page: Page) {
  await nextFrame(page);
  return page.evaluate(() => {
    const r = window.__FRONTIER__.renderer as RendererProbe;
    return { plans: r.lastOptions.plannedConstruction ?? [], placement: r.lastOptions.placement ?? null };
  });
}
async function snapshot(page: Page) {
  return page.evaluate(() => structuredClone(window.__FRONTIER__.state));
}
function houses(state: GameState) {
  return state.entities.filter(e => e.team === 0 && e.type === 'house');
}
function builds(state: GameState) {
  return state.pendingCommands.filter((c): c is BuildCommand => c.type === 'build' && c.team === 0);
}
function money(state: GameState) {
  const p = state.players[0];
  return { gold: p.gold, wood: p.wood };
}
async function openRepeat(page: Page) {
  await action(page, 'panel-build').click();
  await page.getByRole('button', { name: 'Build House', exact: true }).click();
  await expect(page.locator('.placement-toolbar')).toBeVisible();
  await action(page, 'repeat-placement').click();
  await expect(action(page, 'repeat-placement')).toHaveText('Repeat on');
  // Make room through normal controls, particularly for the short-landscape bar.
  const zoomSteps = page.viewportSize()!.width < 1000 ? 2 : 1;
  if (await action(page, 'zoom-out').isVisible()) {
    for (let i = 0; i < zoomSteps; i++) await action(page, 'zoom-out').click();
  } else {
    await expect(page.locator('#toast')).not.toHaveClass(/show/);
    // Portrait CSS intentionally hides zoom buttons; there is no control expander.
    // Use the supported native two-finger pinch, never force a hidden control.
    const center = await page.evaluate(() => {
      const candidates: Point[] = [];
      for (let y = 160; y < innerHeight - 100; y += 12) for (let x = 92; x < innerWidth - 92; x += 12) {
        if ([-70, -48, 48, 70].every(dx => [-20, 0, 20].every(dy => document.elementFromPoint(x + dx, y + dy)?.id === 'world'))) candidates.push({ x, y });
      }
      candidates.sort((a, b) => Math.hypot(a.x - innerWidth / 2, a.y - innerHeight * .4) - Math.hypot(b.x - innerWidth / 2, b.y - innerHeight * .4));
      if (!candidates.length) throw new Error('No unobscured native two-finger pinch region.');
      return candidates[0];
    });
    const before = await page.evaluate(() => window.__FRONTIER__.renderer.camera.zoom);
    const cdp = await page.context().newCDPSession(page);
    try {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: center.x - 70, y: center.y }, { x: center.x + 70, y: center.y }] });
      const radius = 70 / 1.2 ** zoomSteps;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: center.x - radius, y: center.y }, { x: center.x + radius, y: center.y }] });
    } finally {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await cdp.detach();
    }
    await expect.poll(() => page.evaluate(() => window.__FRONTIER__.renderer.camera.zoom)).toBeLessThan(before);
  }
  await expect(page.locator('#toast')).not.toHaveClass(/show/);
  await nextFrame(page);
}

/** Read-only fixture discovery: native touch clearance plus canonical reservation rules.
 * Snap-aligned world points are reprojected just before each native input. No terrain,
 * camera, commands, or construction state is changed to make a site work.
 */
async function legalSites(page: Page, count: number): Promise<Point[]> {
  const fixture = await page.evaluate(() => {
    const { state, renderer } = window.__FRONTIER__;
    const hero = state.entities.find(e => e.team === 0 && e.kind === 'commander')!;
    const candidates: { world: Point; distance: number }[] = [];
    const clearance = navigator.maxTouchPoints ? 22 : 8;
    const rx = 64 * renderer.camera.zoom, ry = 32 * renderer.camera.zoom;
    for (let y = Math.max(2, hero.y - 9); y < Math.min(state.map.height - 2, hero.y + 9); y += .5) {
      for (let x = Math.max(2, hero.x - 9); x < Math.min(state.map.width - 2, hero.x + 9); x += .5) {
        const world = { x: Math.round(x * 2) / 2, y: Math.round(y * 2) / 2 };
        const p = renderer.worldToScreen(world.x, world.y);
        if (p.x < rx + 6 || p.x > innerWidth - rx - 6 || p.y < 110 + ry || p.y > innerHeight - ry - 24) continue;
        if (!state.fog.visible[0]?.[Math.floor(world.y) * state.map.width + Math.floor(world.x)]) continue;
        // Check both the native contact square and the drawn diamond corners.
        const offsets = [[-clearance, -clearance], [clearance, -clearance], [-clearance, clearance], [clearance, clearance], [0, 0], [-rx - 4, 0], [rx + 4, 0], [0, -ry - 4], [0, ry + 4]];
        if (offsets.some(([dx, dy]) => document.elementFromPoint(p.x + dx, p.y + dy)?.id !== 'world')) continue;
        if (renderer.pick(state, p.x, p.y)) continue;
        candidates.push({ world, distance: Math.hypot(p.x - innerWidth / 2, p.y - innerHeight * .42) });
      }
    }
    return { state: structuredClone(state), candidates: candidates.sort((a, b) => a.distance - b.distance) };
  });
  // Work only on the copied snapshot. Each choice reserves its real footprint,
  // budget and access routes before the next choice is considered.
  const valid = fixture.candidates.filter(c => canBuild(fixture.state, 0, 'house', c.world.x, c.world.y).ok);
  // Limit alternative starts rather than making all-pairs projected clones when
  // the viewport has no valid triple. Cheap canonical overlap checks run first.
  for (const first of valid.slice(0, 12)) {
    const planned = structuredClone(fixture.state), chosen: Point[] = [];
    for (const candidate of [first, ...valid.filter(c => c !== first)]) {
      const p = candidate.world;
      if (chosen.some(other => footprintsOverlap(other, BUILDINGS.house.size, p, BUILDINGS.house.size))) continue;
      if (!plannedBuildResult(planned, 0, 'house', p.x, p.y).ok) continue;
      chosen.push(p);
      planned.pendingCommands.push({ type: 'build', team: 0, building: 'house', ...p });
      if (chosen.length === count) return chosen;
    }
  }
  throw new Error(`Read-only fixture found no ${count} legal, visible House sites with native toolbar clearance (${fixture.candidates.length} candidates).`);
}
async function nativePoint(page: Page, world: Point) {
  // Let ordinary temporary feedback retire instead of force-clicking through it.
  await expect(page.locator('#toast')).not.toHaveClass(/show/);
  await nextFrame(page);
  const point = await page.evaluate(world => {
    const p = window.__FRONTIER__.renderer.worldToScreen(world.x, world.y);
    const clearance = navigator.maxTouchPoints ? 22 : 4;
    const clear = [-clearance, 0, clearance].every(dx => [-clearance, 0, clearance].every(dy => document.elementFromPoint(p.x + dx, p.y + dy)?.id === 'world'));
    return { ...p, clear };
  }, world);
  expect(point.clear, 'The native contact region must be canvas, including after toolbar/camera changes').toBe(true);
  return point;
}
async function previewAt(page: Page, world: Point) {
  await tap(page, await nativePoint(page, world));
  await expect.poll(async () => (await rendered(page)).placement).toMatchObject({ type: 'house', ...world });
}
async function queueAt(page: Page, world: Point, count: number) {
  await previewAt(page, world);
  await expect(action(page, 'confirm-placement')).toBeEnabled();
  await action(page, 'confirm-placement').click();
  await expect.poll(async () => (await rendered(page)).plans.length).toBe(count);
  expect(builds(await snapshot(page))).toHaveLength(count);
}
async function twoPlans(page: Page) {
  await openRepeat(page);
  const sites = await legalSites(page, 3);
  await queueAt(page, sites[0], 1);
  await queueAt(page, sites[1], 2);
  await previewAt(page, sites[2]);
  return sites;
}

/** Observe real Canvas strokes during ordinary RAFs; never trigger or replace a render.
 * Forward every original call and restore the methods before returning. The small
 * result proves dashed gold diamonds were drawn, rather than trusting options alone.
 */
async function drawEvidence(page: Page) {
  return page.evaluate(async () => {
    const c = (window.__FRONTIER__.renderer as RendererProbe).context;
    const original = { beginPath: c.beginPath, moveTo: c.moveTo, lineTo: c.lineTo, stroke: c.stroke };
    let path: Point[] = [];
    const plans: { points: Point[]; dash: number[]; width: number }[] = [];
    let activeStrokes = 0;
    c.beginPath = function () { path = []; return original.beginPath.call(this); };
    c.moveTo = function (x, y) { path.push({ x, y }); return original.moveTo.call(this, x, y); };
    c.lineTo = function (x, y) { path.push({ x, y }); return original.lineTo.call(this, x, y); };
    c.stroke = function (shape?: Path2D) {
      if (this.strokeStyle === '#edc36b' && this.getLineDash().length) plans.push({ points: [...path], dash: this.getLineDash(), width: this.lineWidth });
      if (this.strokeStyle === '#a7efcf' && !this.getLineDash().length) activeStrokes++;
      if (shape) original.stroke.call(this, shape); else (original.stroke as () => void).call(this);
    };
    try {
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    } finally {
      Object.assign(c, original);
    }
    const unique = [...new Map(plans.map(p => [JSON.stringify(p), p])).values()];
    return { goldDiamonds: unique, solidActiveStrokes: activeStrokes };
  });
}
async function expectPlansDrawn(page: Page, expected: Point[], active: boolean) {
  const evidence = await drawEvidence(page);
  expect(evidence.goldDiamonds).toHaveLength(expected.length);
  const centers = await page.evaluate(points => points.map(p => window.__FRONTIER__.renderer.worldToScreen(p.x, p.y)), expected);
  for (const center of centers) {
    const diamond = evidence.goldDiamonds.find(d => d.points.length === 4 && Math.abs(d.points[0].x - center.x) < .01 && Math.abs(d.points[1].y - center.y) < .01);
    expect(diamond, `Dashed gold ground diamond at ${JSON.stringify(center)}`).toBeDefined();
    expect(diamond!.dash).toEqual([6, 5]);
    expect(diamond!.width).toBe(2);
  }
  if (active) expect(evidence.solidActiveStrokes).toBeGreaterThan(0);
  return evidence;
}

// Five focused scenarios run in the repository's existing desktop and phone projects.
test('Repeat keeps two paused plans distinct from the moving active ghost in both themes', async ({ page, isMobile }) => {
  test.setTimeout(60_000);
  await launch(page, { difficulty: 'easy' }); await pause(page);
  const original = await snapshot(page), sites = await twoPlans(page);
  const queued = await snapshot(page), plans = (await rendered(page)).plans;
  expect(plans).toEqual(sites.slice(0, 2).map((p, i) => ({ building: 'house', name: 'House', ...p, size: BUILDINGS.house.size, ordinal: i + 1 })));
  expect(houses(queued)).toEqual(houses(original));
  expect(money(queued)).toEqual(money(original));
  expect(queued.time).toBe(original.time);
  const projected = projectPendingCommands(queued);
  expect(money(projected)).toEqual({ gold: original.players[0].gold - 2 * houseCost.gold, wood: original.players[0].wood - 2 * houseCost.wood });

  for (const theme of ['christmas', 'mythic']) {
    await action(page, 'pause-menu').click(); await action(page, 'settings').click();
    await page.getByLabel('Visual theme', { exact: true }).selectOption(theme);
    await expect.poll(() => page.evaluate(() => (window.__FRONTIER__.renderer as RendererProbe).visualTheme)).toBe(theme);
    await page.getByRole('dialog', { name: 'Settings', exact: true }).getByRole('button', { name: 'Done', exact: true }).click();
    expect((await rendered(page)).plans).toEqual(plans);
    expect((await rendered(page)).placement).toMatchObject({ ...sites[2], valid: true });
    const proof = await expectPlansDrawn(page, sites.slice(0, 2), true);
    await test.info().attach(`${theme}-native-repeat-draw-proof`, { body: JSON.stringify({ sites, planCount: plans.length, noRealConstructionWhilePaused: true, ...proof }), contentType: 'application/json' });
    if (isMobile) await test.info().attach(`${theme}-two-plans-active-ghost`, { body: await page.screenshot({ scale: 'css' }), contentType: 'image/png' });
  }
  // Move the preview back onto an existing plan: it becomes invalid but cannot move
  // or consume either queued footprint. Cancel dismisses only that active preview.
  await previewAt(page, sites[0]);
  await expect(action(page, 'confirm-placement')).toBeDisabled();
  expect((await rendered(page)).plans).toEqual(plans);
  await cancelPreview(page);
  expect(await rendered(page)).toEqual({ plans, placement: null });
  expect(await snapshot(page)).toEqual(queued);
  await expectPlansDrawn(page, sites.slice(0, 2), false);
  const planningHelp = 'Confirmed builds remain as dashed gold Queued footprints until Resume. Cancel closes only the active preview.';
  await action(page, 'pause-menu').click(); await action(page, 'help').click();
  await expect(page.getByRole('dialog', { name: 'Command the frontier', exact: true })).toContainText(planningHelp);
  await page.getByRole('button', { name: 'Ready to lead', exact: true }).click();
  await action(page, 'pause-menu').click(); await action(page, 'about').click();
  await expect(page.getByRole('dialog', { name: 'Credits / About', exact: true })).toContainText(planningHelp);
  await page.getByRole('dialog', { name: 'Credits / About', exact: true }).getByRole('button', { name: 'Done', exact: true }).click();
  expect(await snapshot(page)).toEqual(queued);
});

test('queued footprints retain overlap rejection and reserve exactly two House costs', async ({ page }) => {
  await launch(page, { difficulty: 'easy' }); await pause(page); await openRepeat(page);
  const sites = await legalSites(page, 3);
  // Controlled budget fixture only: retain generated terrain/entities and native
  // construction input, but leave precisely enough wood for two queued Houses.
  await page.evaluate(wood => { window.__FRONTIER__.state.players[0].wood = wood; }, 2 * houseCost.wood);
  const before = await snapshot(page);
  await queueAt(page, sites[0], 1); await queueAt(page, sites[1], 2);
  const queued = await snapshot(page), plans = (await rendered(page)).plans;
  await previewAt(page, sites[0]);
  await expect(placementStatus(page)).toContainText('Too close to your queued House. Pick another spot.');
  await expect(action(page, 'confirm-placement')).toBeDisabled();
  await previewAt(page, sites[2]);
  await expect(placementStatus(page)).toContainText(`Need ${houseCost.gold} gold and ${houseCost.wood} wood.`);
  await expect(action(page, 'confirm-placement')).toBeDisabled();
  expect(money(await snapshot(page))).toEqual(money(before));
  expect(projectPendingCommands(queued).players[0].wood).toBe(0);
  expect(houses(queued)).toEqual(houses(before));
  expect((await rendered(page)).plans).toEqual(plans);
  await cancelPreview(page);
  expect(await snapshot(page)).toEqual(queued);
  // Controlled cache diagnostic, separate from the native budget/overlap flow:
  // replace one valid queued site without changing queue length, tick, or nextId.
  await page.evaluate(site => {
    const s = window.__FRONTIER__.state, first = s.pendingCommands[0];
    if (first.type !== 'build') throw new Error('Expected the first queued build.');
    s.pendingCommands[0] = { ...first, ...site };
  }, sites[2]);
  const replaced = [{ ...plans[0], ...sites[2] }, plans[1]];
  await expect.poll(async () => (await rendered(page)).plans).toEqual(replaced);
  const afterReplacement = await snapshot(page);
  expect(afterReplacement.pendingCommands).toHaveLength(queued.pendingCommands.length);
  expect({ ...afterReplacement, pendingCommands: queued.pendingCommands }).toEqual(queued);
  await expectPlansDrawn(page, [sites[2], sites[1]], false);
  await test.info().attach('reserved-budget-proof', { body: JSON.stringify({ fixture: 'Only player wood set to exactly two House costs before native confirmation', actualWood: queued.players[0].wood, projectedWood: projectPendingCommands(queued).players[0].wood, queuedBuilds: builds(queued) }), contentType: 'application/json' });
});

test('save and Continue restore plans, then Resume creates each House only once', async ({ page }) => {
  await launch(page, { difficulty: 'easy' }); await pause(page);
  const sites = await twoPlans(page); await cancelPreview(page);
  const before = await snapshot(page), plans = (await rendered(page)).plans;
  await action(page, 'pause-menu').click(); await action(page, 'save-leave').click();
  await expect(action(page, 'continue')).toBeVisible();
  expect((await rendered(page)).plans).toEqual([]);
  await page.reload(); await action(page, 'continue').click();
  await expect(page.locator('.hud')).toBeVisible();
  await expect.poll(async () => (await rendered(page)).plans).toEqual(plans);
  const restored = await snapshot(page);
  expect(restored.paused).toBe(true); expect(restored.time).toBe(before.time);
  expect(restored.pendingCommands).toEqual(before.pendingCommands);
  expect(houses(restored)).toEqual(houses(before)); expect(money(restored)).toEqual(money(before));
  expect((await rendered(page)).placement).toBeNull();
  await resume(page);
  await expect.poll(async () => houses(await snapshot(page)).length).toBe(houses(before).length + 2);
  await pause(page);
  const executed = await snapshot(page);
  expect(executed.pendingCommands).toEqual([]); expect((await rendered(page)).plans).toEqual([]);
  for (const site of sites.slice(0, 2)) expect(houses(executed).filter(e => e.x === site.x && e.y === site.y)).toHaveLength(1);
  expect(executed.commandLog.filter(e => e.command.type === 'build')).toHaveLength(2);
  // Account for genuine income between native Resume and Pause instead of freezing
  // simulation through a fixture or pretending every resource delta is a purchase.
  expect(executed.players[0].wood - before.players[0].wood - (executed.players[0].stats.woodCollected - before.players[0].stats.woodCollected)).toBeCloseTo(-2 * houseCost.wood, 5);
  await resume(page); await pause(page);
  const again = await snapshot(page);
  expect(houses(again).map(e => e.id)).toEqual(houses(executed).map(e => e.id));
  expect(again.commandLog.filter(e => e.command.type === 'build')).toHaveLength(2);
  expect((await rendered(page)).plans).toEqual([]);
});

test('real troop picking and native Move take precedence over noninteractive plan ground', async ({ page }) => {
  await launch(page, { difficulty: 'easy' }); await pause(page);
  const sites = await twoPlans(page); await cancelPreview(page);
  const plans = (await rendered(page)).plans;
  // Controlled visual-occlusion fixture: reposition an existing swordsman so its
  // sprite overlaps a footprint while its physical body remains clear of BOTH
  // construction sites. Validate each candidate with the real projected rules.
  // No entity or command is created, and all subsequent selection/Move input is native.
  const initial = await snapshot(page);
  const unit = initial.entities.find(e => e.team === 0 && e.type === 'swordsman' && e.hp > 0);
  expect(unit, 'A native starting swordsman is available').toBeDefined();
  const unitId = unit!.id;
  let troopPoint: Point | undefined, moveSite = sites[1];
  const tried: { footprint: number; offset: Point; builds: number; picked: boolean }[] = [];
  // Either footprint may be the rear one. Inspect both instead of assuming the
  // first site's foreground remains free of the second reserved House.
  for (const footprint of [0, 1]) {
    for (const [dx, dy] of [[1.5, 1.5], [1.75, 1.75], [2, 2], [2, 1], [1, 2], [2.5, 1], [1, 2.5], [2.5, 1.5], [1.5, 2.5]]) {
      const position = { x: sites[footprint].x + dx, y: sites[footprint].y + dy };
      const candidate = structuredClone(initial), soldier = candidate.entities.find(e => e.id === unitId)!;
      Object.assign(soldier, position);
      const projectedBuilds = houses(projectPendingCommands(candidate)).length - houses(initial).length;
      const attempt = { footprint, offset: { x: dx, y: dy }, builds: projectedBuilds, picked: false };
      tried.push(attempt);
      if (projectedBuilds !== 2) continue;
      await page.evaluate(({ id, position }) => Object.assign(window.__FRONTIER__.state.entities.find(e => e.id === id)!, position), { id: unitId, position });
      await nextFrame(page);
      troopPoint = await page.evaluate(({ id, sites }) => {
        const { state, renderer } = window.__FRONTIER__;
        const center = renderer.worldToScreen(sites[0].x, sites[0].y), other = renderer.worldToScreen(sites[1].x, sites[1].y);
        if (renderer.pick(state, other.x, other.y)) return undefined;
        const hit = (renderer as RendererProbe).entityHits.get(id);
        if (!hit) return undefined;
        const bitmap = document.createElement('canvas');
        bitmap.width = hit.frame.w; bitmap.height = hit.frame.h;
        const pixels = bitmap.getContext('2d', { willReadFrequently: true })!;
        pixels.drawImage(hit.image, hit.frame.x, hit.frame.y, hit.frame.w, hit.frame.h, 0, 0, bitmap.width, bitmap.height);
        const alpha = pixels.getImageData(0, 0, bitmap.width, bitmap.height).data, inverse = hit.matrix.inverse();
        const rx = 64 * renderer.camera.zoom, ry = 32 * renderer.camera.zoom, clearance = navigator.maxTouchPoints ? 22 : 4;
        for (let dy = -ry; dy <= ry; dy += 2) for (let dx = -rx; dx <= rx; dx += 2) {
          if (Math.abs(dx / rx) + Math.abs(dy / ry) > .95) continue;
          const p = { x: center.x + dx, y: center.y + dy };
          const local = new DOMPoint(p.x, p.y).matrixTransform(inverse), b = hit.bounds;
          const px = Math.floor((local.x - b.x) / b.width * bitmap.width), py = Math.floor((local.y - b.y) / b.height * bitmap.height);
          if (px < 0 || py < 0 || px >= bitmap.width || py >= bitmap.height || alpha[(py * bitmap.width + px) * 4 + 3] < 96) continue;
          if ((renderer.pick(state, p.x, p.y) as { id?: string } | undefined)?.id !== id) continue;
          if ([-clearance, 0, clearance].every(x => [-clearance, 0, clearance].every(y => document.elementFromPoint(p.x + x, p.y + y)?.id === 'world'))) return p;
        }
        return undefined;
      }, { id: unitId, sites: [sites[footprint], sites[1 - footprint]] });
      attempt.picked = !!troopPoint;
      if (troopPoint) { moveSite = sites[1 - footprint]; break; }
    }
    if (troopPoint) break;
  }
  await test.info().attach('occlusion-fixture-candidates', { body: JSON.stringify({ sites: sites.slice(0, 2), tried }), contentType: 'application/json' });
  expect(troopPoint, 'Real troop art must remain pickable inside a queued ground diamond').toBeDefined();
  await tap(page, troopPoint!);
  await expect(page.locator('#selection-info')).toContainText('Swordsman');
  expect(builds(await snapshot(page))).toHaveLength(2);
  const emptyPlan = await nativePoint(page, moveSite);
  expect(await page.evaluate(p => window.__FRONTIER__.renderer.pick(window.__FRONTIER__.state, p.x, p.y) ?? null, emptyPlan)).toBeNull();
  await action(page, 'order-move').click();
  await tap(page, await nativePoint(page, moveSite));
  await expect.poll(() => page.evaluate(() => window.__FRONTIER__.state.pendingCommands.at(-1))).toMatchObject({ type: 'move', entityIds: [unitId] });
  const queued = await snapshot(page), move = queued.pendingCommands.at(-1)!;
  if (move.type !== 'move') throw new Error('Expected the native Move command.');
  expect(move.x).toBeCloseTo(moveSite.x, 1); expect(move.y).toBeCloseTo(moveSite.y, 1);
  expect(queued.pendingCommands.map(c => c.type)).toEqual(['build', 'build', 'move']);
  expect((await rendered(page)).plans).toEqual(plans);
  await expect(page.getByRole('button', { name: /queued house|planned house/i })).toHaveCount(0);
  await test.info().attach('plan-picking-proof', { body: JSON.stringify({ fixture: 'Existing swordsman sprite overlaps queued ground; physical body remains clear under canonical construction rules', unitId, pickedRealUnit: true, emptyPlanPick: null, pendingTypes: queued.pendingCommands.map(c => c.type), nativeMove: move }), contentType: 'application/json' });
});

test('workshop Undo and a new battle cannot inherit tactical construction plans', async ({ page }) => {
  await launch(page, { difficulty: 'easy' }); await pause(page); await twoPlans(page);
  await cancelPreview(page); await action(page, 'pause-menu').click(); await action(page, 'save-leave').click();
  await action(page, 'editor').click(); await action(page, 'new-editor').click();
  await expect(page.locator('.editor-header')).toBeVisible();
  expect((await rendered(page)).plans).toEqual([]);
  expect((await snapshot(page)).pendingCommands).toEqual([]);
  await action(page, 'brush-road').click();
  if (!(await page.locator('.editor-tools').getAttribute('class'))?.includes('collapsed')) await action(page, 'toggle-editor-tools').click();
  const target = await page.evaluate(() => {
    const { state, renderer } = window.__FRONTIER__;
    for (let y = 3; y < state.map.height - 3; y++) for (let x = 3; x < state.map.width - 3; x++) {
      const p = renderer.worldToScreen(x + .5, y + .5), index = y * state.map.width + x;
      if (state.map.tiles[index] === 'road') continue;
      if ([-24, 0, 24].every(dx => [-24, 0, 24].every(dy => document.elementFromPoint(p.x + dx, p.y + dy)?.id === 'world'))) return { point: p, index, before: state.map.tiles[index] };
    }
    throw new Error('No native-contact-clear workshop paint tile.');
  });
  await tap(page, target.point);
  await expect.poll(() => page.evaluate(i => window.__FRONTIER__.state.map.tiles[i], target.index)).toBe('road');
  await action(page, 'toggle-editor-tools').click(); await action(page, 'editor-undo').click();
  expect(await page.evaluate(i => window.__FRONTIER__.state.map.tiles[i], target.index)).toBe(target.before);
  expect((await rendered(page)).plans).toEqual([]);
  await action(page, 'exit-editor').click(); await action(page, 'home').click();
  // Same document/session, rather than launch()'s navigation reset: detect leaked
  // renderer/UI state when starting a different battle through the real menus.
  await action(page, 'skirmish').click();
  await page.getByLabel('Map seed', { exact: true }).fill('QUEUED-PLAN-FRESH-SESSION');
  await page.locator('select[name="mapSize"]').selectOption('small');
  await page.locator('select[name="difficulty"]').selectOption('easy');
  await action(page, 'launch').click(); await expect(page.locator('.hud')).toBeVisible();
  await acknowledgeFirstBriefing(page); await pause(page);
  expect((await snapshot(page)).settings.seed).toBe('QUEUED-PLAN-FRESH-SESSION');
  expect((await snapshot(page)).pendingCommands).toEqual([]);
  expect(await rendered(page)).toEqual({ plans: [], placement: null });
});
