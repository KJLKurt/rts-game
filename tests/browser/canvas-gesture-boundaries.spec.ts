import type { Locator, Page } from '@playwright/test';
import type { Point } from '../../src/sim/types';
import { test, expect, action, home } from './helpers';

type Entry = Record<string, unknown>;
type Probe = { stage: string | null; events: Entry[]; dropped: number };
type ProbeWindow = Window & { __canvasBoundaryProbe: Probe };
const map = (page: Page) => page.evaluate(() => structuredClone(window.__FRONTIER__.state.map));
const camera = (page: Page) => page.evaluate(() => ({ ...window.__FRONTIER__.renderer.camera }));
const battle = (page: Page) => page.evaluate(() => {
  const s = window.__FRONTIER__.state;
  return structuredClone({ time: s.time, tick: s.tick, paused: s.paused, pending: s.pendingCommands,
    log: s.commandLog, orders: s.entities.filter(e => e.team === 0).map(e => ({ id: e.id, order: e.order })) });
});
async function press(page: Page, control: string | Locator) {
  const locator = typeof control === 'string' ? action(page, control) : control;
  if (test.info().project.use.hasTouch) await locator.tap();
  else await locator.click();
}
async function installProbe(page: Page) {
  await page.addInitScript(() => {
    const probe: Probe = { stage: null, events: [], dropped: 0 };
    (window as unknown as ProbeWindow).__canvasBoundaryProbe = probe;
    for (const type of ['pointerdown', 'pointerup', 'pointercancel', 'touchstart', 'touchmove', 'touchend', 'touchcancel', 'click']) {
      window.addEventListener(type, event => {
        if (!probe.stage) return;
        if (probe.events.length >= 100) { probe.dropped++; return; }
        const node = event.target instanceof Element ? event.target : null;
        const touch = event as TouchEvent, pointer = event as PointerEvent;
        const record: Entry = { type, time: event.timeStamp, trusted: event.isTrusted, target: node?.id || node?.tagName,
          action: node?.closest('[data-action]')?.getAttribute('data-action') ?? null,
          scroller: node?.closest('.editor-tools') ? 'editor' : node?.closest('#deck-content') ? 'deck' : null,
          cancelable: event.cancelable, defaultPrevented: event.defaultPrevented,
          pointerType: pointer.pointerType, pointerId: pointer.pointerId,
          touches: touch.touches && Array.from(touch.touches, point => ({ id: point.identifier, x: point.clientX, y: point.clientY })) };
        probe.events.push(record);
        setTimeout(() => { record.finalDefaultPrevented = event.defaultPrevented; }, 0);
      }, { capture: true, passive: true });
    }
  });
}
async function mark(page: Page, stage: string) {
  await page.evaluate(stage => {
    const probe = (window as unknown as ProbeWindow).__canvasBoundaryProbe;
    probe.stage = stage; probe.events = []; probe.dropped = 0;
  }, stage);
}
async function receipt(page: Page) {
  return page.evaluate(async () => {
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    const probe = (window as unknown as ProbeWindow).__canvasBoundaryProbe;
    const result = { ...probe, events: [...probe.events] };
    probe.stage = null;
    return result;
  });
}
function oneClick(evidence: Probe, name: string) {
  const clicks = evidence.events.filter(event => event.type === 'click' && event.action === name);
  expect(clicks, `${evidence.stage}: one native ${name} activation`).toHaveLength(1);
  expect(clicks[0].trusted).toBe(true);
  expect(evidence.dropped).toBe(0);
}
async function theme(page: Page, name: string) {
  await home(page);
  await press(page, 'settings');
  await page.getByLabel('Visual theme', { exact: true }).selectOption(name);
  await expect.poll(() => page.evaluate(() =>
    (window.__FRONTIER__.renderer as unknown as { visualTheme: string }).visualTheme)).toBe(name);
  await press(page, page.getByRole('button', { name: 'Done', exact: true }));
}

/** Read-only geometry discovery, including clearance for native contact targeting. */
async function canvasPoints(page: Page, paint = false) {
  return page.evaluate(paint => {
    const { state: s, renderer: r } = window.__FRONTIER__;
    const clear = (point: Point) => [-24, 0, 24].every(dx => [-24, 0, 24].every(dy =>
      document.elementFromPoint(point.x + dx, point.y + dy)?.id === 'world'));
    const candidates: { points: Point[]; indices: number[]; distance: number }[] = [];
    if (paint) {
      for (let y = 2; y < s.map.height - 2; y++) for (let x = 2; x < s.map.width - 5; x++) {
        const indices = [0, 1, 2, 3].map(dx => y * s.map.width + x + dx);
        const points = [0, 1, 2, 3].map(dx => r.worldToScreen(x + dx + .5, y + .5));
        if (indices.every(index => s.map.tiles[index] !== 'snow') && points.every(clear))
          candidates.push({ points, indices, distance: Math.hypot(points[1].x - innerWidth / 2, points[1].y - innerHeight / 2) });
      }
    } else {
      for (let y = 100; y < innerHeight - 80; y += 12) for (let x = 84; x < innerWidth - 84; x += 12) {
        // This region supports both the four-point pan and the two-finger spread.
        const points = [0, 1, 2, 3].map(i => ({ x: x - 30 + i * 20, y: y + i * 4 }));
        if (points.every(clear) && [-50, -25, 25, 50].every(dx => clear({ x: x + dx, y })))
          candidates.push({ points, indices: [], distance: Math.hypot(x - innerWidth / 2, y - innerHeight * .4) });
      }
    }
    candidates.sort((a, b) => a.distance - b.distance);
    if (!candidates.length) throw new Error('No unobscured native canvas gesture region.');
    return candidates[0];
  }, paint);
}
async function gesture(page: Page, points: Point[], kind: 'pan' | 'pinch' | 'cancel' = 'pan') {
  if (!test.info().project.use.hasTouch) {
    await page.mouse.move(points[0].x, points[0].y);
    await page.mouse.down();
    try { for (const point of points.slice(1)) await page.mouse.move(point.x, point.y, { steps: 3 }); }
    finally { await page.mouse.up(); }
    return;
  }
  const cdp = await page.context().newCDPSession(page);
  try {
    if (kind === 'pinch') {
      const center = { x: points[0].x + 30, y: points[0].y };
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [
        { x: center.x - 25, y: center.y, id: 1 }, { x: center.x + 25, y: center.y, id: 2 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [
        { x: center.x - 50, y: center.y, id: 1 }, { x: center.x + 50, y: center.y, id: 2 }] });
    } else {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...points[0], id: 1 }] });
      for (const point of points.slice(1)) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...point, id: 1 }] });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: kind === 'cancel' ? 'touchCancel' : 'touchEnd', touchPoints: [] });
  } finally { await cdp.detach(); }
}

async function scrollPanel(page: Page, selector: string, report: Entry[]) {
  const scroller = page.locator(selector);
  const before = await scroller.evaluate(element => {
    const box = element.getBoundingClientRect();
    return { top: element.scrollTop, extent: element.scrollHeight - element.clientHeight,
      x: box.x + box.width / 2, y: box.y, height: box.height };
  });
  expect(before.extent, `${selector} must exercise real overflow`).toBeGreaterThan(30);
  const top = before.y + 18, bottom = before.y + before.height - 18;
  expect(bottom - top).toBeGreaterThan(35);
  const points = [0, 1, 2, 3].map(i => ({ x: before.x, y: bottom + (top - bottom) * i / 3 }));
  expect(await scroller.evaluate((element, points) => points.every(point =>
    element.contains(document.elementFromPoint(point.x, point.y))), points), 'Scroll contact path stays inside the native panel').toBe(true);
  // Opening the battle deck can reframe a followed commander. Observe that
  // settling before attributing any later camera movement to panel scrolling.
  await expect.poll(() => page.evaluate(async () => {
    const before = { ...window.__FRONTIER__.renderer.camera };
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    const after = window.__FRONTIER__.renderer.camera;
    return Math.hypot(after.x - before.x, after.y - before.y) < .00001;
  })).toBe(true);
  const beforeMap = await map(page), beforeCamera = await camera(page);
  await mark(page, `${selector}-native-scroll`);
  if (test.info().project.use.hasTouch) await gesture(page, points);
  else { await page.mouse.move(before.x, bottom); await page.mouse.wheel(0, 240); }
  await expect.poll(() => scroller.evaluate(element => element.scrollTop)).toBeGreaterThan(before.top + 10);
  // Legitimate native panel scrolling may have inertia. Wait for measured scroll
  // stability before a distinct input; never add this wait to canvas/control checks.
  await expect.poll(() => scroller.evaluate(async element => {
    const tops: number[] = [];
    for (let i = 0; i < 3; i++) {
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      tops.push(element.scrollTop);
    }
    return Math.max(...tops) - Math.min(...tops) < .5;
  })).toBe(true);
  const evidence = await receipt(page);
  report.push({ ...evidence, before, scrollTopAfter: await scroller.evaluate(element => element.scrollTop) });
  if (test.info().project.use.hasTouch) {
    const moves = evidence.events.filter(event => event.type === 'touchmove');
    expect(moves.length, 'Native touch scroll reached the outside panel').toBeGreaterThan(0);
    expect(moves.every(event => event.target !== 'world' && event.scroller && event.finalDefaultPrevented === false),
      'Canvas prevention must not reach editor/HUD panel scrolling').toBe(true);
  }
  expect(evidence.events.filter(event => event.type === 'click'), 'Scrolling does not activate a control').toHaveLength(0);
  expect(await map(page), 'Panel scroll never paints').toEqual(beforeMap);
  const afterCamera = await camera(page);
  expect(afterCamera.zoom, 'Panel scroll never zooms the canvas').toBe(beforeCamera.zoom);
  expect(afterCamera.x, 'Panel scroll never pans the canvas horizontally').toBeCloseTo(beforeCamera.x, 3);
  expect(afterCamera.y, 'Panel scroll never pans the canvas vertically').toBeCloseTo(beforeCamera.y, 3);
}

for (const name of ['christmas', 'mythic'] as const) {
  test(`${name} editor canvas leaves panel scrolling, naming, and keyboard controls native`, async ({ page, isMobile }, info) => {
    const report: Entry[] = [];
    try {
      await installProbe(page); await theme(page, name);
      await press(page, 'editor'); await press(page, 'new-editor');
      await expect(page.locator('.editor-tools')).toBeVisible();
      const original = await map(page);
      await press(page, 'brush-snow'); await page.locator('#brush-size').selectOption('1');
      await press(page, 'toggle-editor-tools'); await expect(page.locator('.editor-tools')).toBeHidden();
      const stroke = await canvasPoints(page, true);
      await mark(page, 'editor-paint-then-Tools');
      await gesture(page, stroke.points);
      const painted = await map(page);
      for (const index of stroke.indices) expect(painted.tiles[index]).toBe('snow');
      await press(page, 'toggle-editor-tools');
      const afterPaint = await receipt(page); report.push(afterPaint); oneClick(afterPaint, 'toggle-editor-tools');
      await expect(page.locator('.editor-tools')).toBeVisible();
      if (!isMobile) {
        await action(page, 'toggle-editor-tools').press('ControlOrMeta+z');
        expect((await map(page)).tiles).toEqual(original.tiles);
        await action(page, 'toggle-editor-tools').press('ControlOrMeta+Shift+z');
        expect((await map(page)).tiles).toEqual(painted.tiles);
        await action(page, 'toggle-editor-tools').press('p');
      } else await press(page, 'editor-pan');
      await expect(action(page, 'editor-pan')).toHaveClass(/active/);
      await press(page, 'toggle-editor-tools'); await expect(page.locator('.editor-tools')).toBeHidden();
      const pan = await canvasPoints(page), beforePan = await camera(page);
      await mark(page, 'editor-pan-then-Tools');
      await gesture(page, pan.points);
      expect(await camera(page)).not.toEqual(beforePan);
      expect(await map(page)).toEqual(painted);
      await press(page, 'toggle-editor-tools');
      const afterPan = await receipt(page); report.push(afterPan); oneClick(afterPan, 'toggle-editor-tools');
      await expect(page.locator('.editor-tools')).toBeVisible();
      if (!isMobile) {
        await action(page, 'toggle-editor-tools').press('b');
        await expect(action(page, 'editor-paint')).toHaveClass(/active/);
      }
      await scrollPanel(page, '.editor-tools', report);
      const title = `${name} gesture boundary`;
      const input = page.locator('#editor-map-name');
      await input.press('ControlOrMeta+a'); await input.pressSequentially(title);
      await expect(input).toHaveValue(title);
      await mark(page, 'keyboard-Save');
      await action(page, 'save-map').press('Enter');
      await expect(page.getByRole('status')).toContainText('Workshop saved');
      const saved = await receipt(page); report.push(saved); oneClick(saved, 'save-map');
      expect((await map(page)).name).toBe(title);
      expect((await map(page)).tiles).toEqual(painted.tiles);
      if (isMobile) await page.screenshot({ path: info.outputPath(`${name}-native-editor-boundaries.png`), scale: 'css' });
      await press(page, 'exit-editor'); await page.reload();
      await press(page, 'editor'); await press(page, 'resume-editor');
      await expect(page.locator('#editor-map-name')).toHaveValue(title);
      expect((await map(page)).tiles).toEqual(painted.tiles);
    } finally {
      report.push({ final: await receipt(page).catch(() => null) });
      await info.attach('editor-boundary-events', { body: JSON.stringify({ theme: name, report }), contentType: 'application/json' });
    }
  });

  test(`${name} battle canvas gestures preserve orders and outside HUD controls`, async ({ page, isMobile }, info) => {
    const report: Entry[] = [];
    try {
      await installProbe(page); await theme(page, name);
      await press(page, 'skirmish');
      await page.getByLabel('Map seed', { exact: true }).fill('QA-CANVAS-BOUNDARY');
      await page.locator('select[name="mapSize"]').selectOption('small');
      await page.locator('select[name="difficulty"]').selectOption('easy');
      await press(page, page.locator('[data-action="choose-commander"][data-id="ranger"]'));
      await press(page, 'launch'); await expect(page.locator('.hud')).toBeVisible();
      const briefing = page.getByRole('button', { name: 'Start battle', exact: true });
      if (await briefing.count()) await press(page, briefing);
      const dismiss = action(page, 'dismiss-tips'); if (await dismiss.isVisible()) await press(page, dismiss);
      await press(page, 'pause'); await expect.poll(() => page.evaluate(() => window.__FRONTIER__.state.paused)).toBe(true);
      await press(page, 'select-commander');
      const original = await battle(page);
      for (const kind of (isMobile ? ['pan', 'pinch', 'cancel'] : ['pan']) as ('pan' | 'pinch' | 'cancel')[]) {
        await press(page, 'order-move'); await expect(page.locator('.target-toolbar')).toBeVisible();
        const region = await canvasPoints(page), before = await camera(page);
        await mark(page, `battle-${kind}-then-Focus`);
        await gesture(page, region.points, kind);
        const after = await camera(page);
        expect(kind === 'pinch' ? after.zoom : after).not.toEqual(kind === 'pinch' ? before.zoom : before);
        await press(page, page.locator('.map-controls [data-action="focus"]'));
        const evidence = await receipt(page); report.push({ ...evidence, before, after }); oneClick(evidence, 'focus');
        if (kind === 'cancel') expect(evidence.events.some(event => event.type === 'pointercancel' && event.target === 'world')).toBe(true);
        if (kind === 'pinch') expect(evidence.events.some(event => event.type === 'touchmove' && Array.isArray(event.touches) && event.touches.length === 2)).toBe(true);
        await expect(page.locator('.target-toolbar')).toHaveCount(0);
        expect(await battle(page), `${kind} and Focus must not issue or replace orders`).toEqual(original);
      }
      if (await action(page, 'toggle-deck').getAttribute('aria-expanded') === 'false') await press(page, 'toggle-deck');
      await press(page, 'panel-build');
      await scrollPanel(page, '#deck-content', report);
      await mark(page, 'keyboard-economy');
      const gold = page.locator('.hud button[data-action="economy"][data-resource="gold"]');
      await expect(gold).toHaveCount(1);
      await expect(gold).toHaveAccessibleName(/^Gold: \d+\. Income: \d+\.\d per game second$/);
      await gold.press('Enter');
      await expect(page.getByRole('dialog', { name: 'Your economy and army', exact: true })).toBeVisible();
      const economy = await receipt(page); report.push(economy); oneClick(economy, 'economy');
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);
      expect(await battle(page), 'HUD scrolling and keyboard controls preserve battle orders').toEqual(original);
    } finally {
      report.push({ final: await receipt(page).catch(() => null) });
      await info.attach('battle-boundary-events', { body: JSON.stringify({ theme: name, report }), contentType: 'application/json' });
    }
  });
}
