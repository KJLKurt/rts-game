import { devices, type Browser, type CDPSession, type Page, type TestInfo } from '@playwright/test';
import type { Point } from '../../src/sim/types';
import { test, expect, action, home } from './helpers';

// Opt-in investigation only. It is not a replacement for editor-name-retention.spec.ts.
// Run with FRONTIER_TOOLS_INPUT_DIAGNOSTIC=1 and the two phone projects.
const enabled = process.env.FRONTIER_TOOLS_INPUT_DIAGNOSTIC === '1';
const variants = [
  { session: 'persistent', contactMs: 0 },
  { session: 'persistent', contactMs: 100 },
  { session: 'reopened', contactMs: 0 },
  { session: 'reopened', contactMs: 100 },
] as const;
type Variant = typeof variants[number];
type Scenario = 'mythic-paint' | 'christmas-pan';
type Entry = Record<string, unknown>;
type Probe = { attempt: string | null; events: Entry[]; mutations: Entry[] };
type ProbeWindow = Window & { __toolsInputProbe: Probe };

const map = (page: Page) => page.evaluate(() => structuredClone(window.__FRONTIER__.state.map));
const camera = (page: Page) => page.evaluate(() => ({ ...window.__FRONTIER__.renderer.camera }));
const waitUntil = async (epochMs: number) => {
  const remaining = epochMs - Date.now();
  if (remaining > 0) await new Promise(resolve => setTimeout(resolve, remaining));
};

async function installProbe(page: Page) {
  await page.addInitScript(() => {
    const probe: Probe = { attempt: null, events: [], mutations: [] };
    (window as unknown as ProbeWindow).__toolsInputProbe = probe;
    const identities = new WeakMap<Element, number>();
    let nextIdentity = 1;
    const identity = (element: Element | null) => {
      if (!element) return null;
      if (!identities.has(element)) identities.set(element, nextIdentity++);
      return identities.get(element);
    };
    const types = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel',
      'gotpointercapture', 'lostpointercapture', 'touchstart', 'touchmove', 'touchend',
      'touchcancel', 'mousedown', 'mouseup', 'click', 'dblclick', 'contextmenu'];
    for (const type of types) for (const capture of [true, false]) {
      document.addEventListener(type, event => {
        // Record setup and measured Tools attempts, including the preceding drag.
        if (!probe.attempt) return;
        const target = event.target instanceof Element ? event.target : null;
        const pointer = event as PointerEvent;
        const touch = event as TouchEvent;
        const touches = (list?: TouchList) => list && Array.from(list, point => ({
          id: point.identifier, x: point.clientX, y: point.clientY,
        }));
        probe.events.push({
          attempt: probe.attempt, type, phase: capture ? 'capture' : 'bubble',
          eventTime: event.timeStamp, observedTime: performance.now(), trusted: event.isTrusted,
          defaultPrevented: event.defaultPrevented, cancelable: event.cancelable,
          target: target?.id || target?.tagName, node: identity(target), connected: target?.isConnected,
          action: target?.closest('[data-action]')?.getAttribute('data-action') ?? null,
          x: pointer.clientX, y: pointer.clientY, pointerId: pointer.pointerId,
          pointerType: pointer.pointerType, buttons: pointer.buttons, detail: pointer.detail,
          touches: touches(touch.touches), changedTouches: touches(touch.changedTouches),
          panelClass: document.querySelector('.editor-tools')?.className ?? null,
        });
      }, { capture, passive: true });
    }
    new MutationObserver(records => {
      if (!probe.attempt) return;
      for (const record of records) {
        const element = record.target as Element;
        if (record.type === 'attributes' && element.matches('.editor-tools')) {
          probe.mutations.push({
            attempt: probe.attempt, observedTime: performance.now(), node: identity(element),
            connected: element.isConnected, oldClass: record.oldValue, newClass: element.className,
          });
        }
      }
    }).observe(document, { subtree: true, attributes: true, attributeFilter: ['class'], attributeOldValue: true });
  });
}

async function markAttempt(page: Page, attempt: string | null) {
  await page.evaluate(attempt => { (window as unknown as ProbeWindow).__toolsInputProbe.attempt = attempt; }, attempt);
}

async function snapshot(page: Page) {
  return page.evaluate(() => {
    const button = document.querySelector<HTMLButtonElement>('[data-action="toggle-editor-tools"]')!;
    const panel = document.querySelector<HTMLElement>('.editor-tools')!;
    const rect = button.getBoundingClientRect();
    const center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    const ancestors = [];
    for (let element: Element | null = button; element; element = element.parentElement)
      ancestors.push({ tag: element.tagName, id: element.id, className: element.className,
        touchAction: getComputedStyle(element).touchAction });
    return {
      center, buttonConnected: button.isConnected, buttonDisabled: button.disabled,
      centerHitsButton: button.contains(document.elementFromPoint(center.x, center.y)),
      panelConnected: panel.isConnected, panelClass: panel.className,
      panelVisible: getComputedStyle(panel).display !== 'none' && panel.getClientRects().length > 0,
      documentHidden: document.hidden, viewportScale: visualViewport?.scale,
      maxTouchPoints: navigator.maxTouchPoints, ancestors,
    };
  });
}

async function captureAttempt(page: Page, name: string, before: Awaited<ReturnType<typeof snapshot>>, error: string | null) {
  const after = await snapshot(page);
  const evidence = await page.evaluate(name => {
    const probe = (window as unknown as ProbeWindow).__toolsInputProbe;
    return {
      events: probe.events.filter(event => event.attempt === name),
      mutations: probe.mutations.filter(event => event.attempt === name),
    };
  }, name);
  await markAttempt(page, null);
  return { name, before, after, ...evidence, error };
}

function checkActivation(attempt: Awaited<ReturnType<typeof captureAttempt>>, visible: boolean) {
  const events = attempt.events.filter(event => event.phase === 'capture' && event.action === 'toggle-editor-tools');
  expect(attempt.error, `${attempt.name}: visibility postcondition`).toBeNull();
  expect(events.filter(event => event.type === 'pointerdown'), `${attempt.name}: exactly one native contact`).toHaveLength(1);
  expect(events.filter(event => event.type === 'pointerup'), `${attempt.name}: one completed contact`).toHaveLength(1);
  expect(events.filter(event => event.type === 'pointercancel'), `${attempt.name}: no canceled contact`).toHaveLength(0);
  const clicks = events.filter(event => event.type === 'click');
  expect(clicks, `${attempt.name}: exactly one browser-generated activation`).toHaveLength(1);
  expect(clicks[0]).toMatchObject({ trusted: true, connected: true, pointerType: 'touch' });
  expect(attempt.mutations, `${attempt.name}: exactly one panel class transition`).toHaveLength(1);
  expect(attempt.after.panelVisible).toBe(visible);
  expect(attempt.after.buttonConnected).toBe(true);
}

/** Same four clear projected tile centers as the original acceptance tests. */
async function visibleStroke(page: Page) {
  return page.evaluate(() => {
    const { state: s, renderer: r } = window.__FRONTIER__;
    const clear = (point: Point) => [-24, 0, 24].every(dx => [-24, 0, 24].every(dy =>
      document.elementFromPoint(point.x + dx, point.y + dy)?.id === 'world'));
    const candidates: { points: Point[]; indices: number[]; distance: number }[] = [];
    for (let y = 2; y < s.map.height - 2; y++) for (let x = 2; x < s.map.width - 5; x++) {
      const indices = [0, 1, 2, 3].map(dx => y * s.map.width + x + dx);
      if (indices.some(index => s.map.tiles[index] === 'snow')) continue;
      const points = [0, 1, 2, 3].map(dx => r.worldToScreen(x + dx + .5, y + .5));
      if (points.every(clear)) candidates.push({ points, indices,
        distance: Math.hypot(points[1].x - innerWidth / 2, points[1].y - innerHeight / 2) });
    }
    candidates.sort((a, b) => a.distance - b.distance);
    if (!candidates.length) throw new Error('No unobscured four-tile stroke.');
    return candidates[0];
  });
}

async function runScenario(browser: Browser, info: TestInfo, scenario: Scenario, variant: Variant) {
  const context = await browser.newContext({
    ...devices['Pixel 7'], viewport: info.project.use.viewport, baseURL: info.project.use.baseURL,
  });
  const page = await context.newPage();
  const runtimeErrors: string[] = [];
  page.on('pageerror', error => runtimeErrors.push(error.message));
  const attempts: Awaited<ReturnType<typeof captureAttempt>>[] = [];
  const commands: Entry[] = [];
  const checks: string[] = [];
  let cdp: CDPSession | undefined;
  let scenarioError: string | null = null;
  const send = async (type: 'touchStart' | 'touchMove' | 'touchEnd', points: Point[], timestamp = Date.now() / 1000) => {
    commands.push({ type, timestamp, points, session: variant.session, sentEpochMs: Date.now() });
    await cdp!.send('Input.dispatchTouchEvent', {
      type, timestamp, touchPoints: points.map(point => ({ ...point, id: 1 })),
    });
  };
  try {
    await installProbe(page);
    await home(page);
    await action(page, 'settings').tap();
    const theme = scenario === 'mythic-paint' ? 'mythic' : 'christmas';
    await page.getByLabel('Visual theme', { exact: true }).selectOption(theme);
    await expect.poll(() => page.evaluate(() =>
      (window.__FRONTIER__.renderer as unknown as { visualTheme: string }).visualTheme)).toBe(theme);
    await page.getByRole('button', { name: 'Done', exact: true }).tap();
    await action(page, 'editor').tap();
    await action(page, 'new-editor').tap();
    await expect(page.locator('.editor-tools')).toBeVisible();
    const original = await map(page);
    const beforeCamera = await camera(page);
    if (scenario === 'mythic-paint') {
      await action(page, 'brush-snow').tap();
      await page.locator('#brush-size').selectOption('1');
    } else await action(page, 'editor-pan').tap();

    await markAttempt(page, 'setup-hide');
    const beforeHide = await snapshot(page);
    let hideError: string | null = null;
    try {
      await action(page, 'toggle-editor-tools').tap();
      await expect(page.locator('.editor-tools')).toBeHidden({ timeout: 8_000 });
    } catch (error) { hideError = String(error); }
    const hide = await captureAttempt(page, 'setup-hide', beforeHide, hideError);
    attempts.push(hide);
    checkActivation(hide, false);

    // Read-only actionability/geometry checks precede the timed sequence.
    await action(page, 'toggle-editor-tools').tap({ trial: true });
    const beforeShow = await snapshot(page);
    expect(beforeShow.centerHitsButton).toBe(true);
    const stroke = await visibleStroke(page);
    await markAttempt(page, 'post-drag-show');
    cdp = await context.newCDPSession(page);
    const dragStart = Date.now();
    await send('touchStart', [stroke.points[0]]);
    for (let index = 1; index < stroke.points.length; index++) {
      await waitUntil(dragStart + 40 * index);
      await send('touchMove', [stroke.points[index]]);
    }
    await waitUntil(dragStart + 160);
    const dragEnd = Date.now();
    await send('touchEnd', [], dragEnd / 1000);
    if (variant.session === 'reopened') {
      await cdp.detach();
      cdp = await context.newCDPSession(page);
    }
    // All variants get the same planned 200 ms gap after touchEnd. Actual
    // protocol/event timestamps are retained so scheduling overruns are visible.
    await waitUntil(dragEnd + 200);
    const tapStart = Date.now();
    commands.push({ marker: 'tap-schedule', plannedGapMs: 200, actualGapMs: tapStart - dragEnd,
      plannedContactMs: variant.contactMs });
    if (variant.contactMs === 0) {
      // Match Playwright 1.63's concurrent touchStart/touchEnd dispatch.
      await Promise.all([send('touchStart', [beforeShow.center], tapStart / 1000),
        send('touchEnd', [], tapStart / 1000)]);
    } else {
      await send('touchStart', [beforeShow.center], tapStart / 1000);
      await waitUntil(tapStart + variant.contactMs);
      await send('touchEnd', []);
    }
    let showError: string | null = null;
    try { await expect(page.locator('.editor-tools')).toBeVisible({ timeout: 8_000 }); }
    catch (error) { showError = String(error); }
    // Observation only after the one contact: catch delayed duplicate activation.
    // This does not postpone, repeat, or repair the measured input.
    await page.waitForTimeout(400);
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));
    const show = await captureAttempt(page, 'post-drag-show', beforeShow, showError);
    attempts.push(show);

    const after = await map(page);
    if (scenario === 'mythic-paint') {
      for (const index of stroke.indices) expect(after.tiles[index]).toBe('snow');
      expect(after.tiles).not.toEqual(original.tiles);
      checks.push('The original four-tile snow stroke painted.');
    } else {
      expect(await camera(page)).not.toEqual(beforeCamera);
      expect(after).toEqual(original);
      checks.push('Pan changed the camera and left the map unchanged.');
    }
    checkActivation(show, true);
    expect(runtimeErrors).toEqual([]);
    checks.push('One trusted click and one panel transition followed one Tools contact.');
  } catch (error) { scenarioError = String(error); }
  finally {
    const remaining = await page.evaluate(() => (window as unknown as ProbeWindow).__toolsInputProbe).catch(() => null);
    let screenshotError: string | null = null;
    if (scenarioError) {
      try {
        await info.attach(`${scenario}-${variant.session}-${variant.contactMs}ms-failed-viewport`, {
          body: await page.screenshot(), contentType: 'image/png',
        });
      } catch (error) { screenshotError = String(error); }
    }
    await info.attach(`${scenario}-${variant.session}-${variant.contactMs}ms-first-attempt`, {
      body: JSON.stringify({ scenario, variant, commands, attempts, checks, runtimeErrors,
        scenarioError, screenshotError, uncollected: remaining?.attempt ? remaining : null }, null, 2),
      contentType: 'application/json',
    });
    if (cdp) await cdp.detach().catch(() => {});
    await context.close();
  }
  return { scenario, error: scenarioError };
}

for (const variant of variants) {
  test(`post-drag Tools diagnostic ${variant.session} session ${variant.contactMs}ms contact`, async ({ browser, isMobile }, info) => {
    test.skip(!enabled || !isMobile, 'Opt-in diagnostic on the two phone projects only.');
    test.setTimeout(90_000);
    info.annotations.push({ type: 'read-only-game-inspection', description:
      'Unchanged production app; single native Tools contact after a matched native canvas drag. Separate fresh contexts cover mythic paint and Christmas Pan. No forced clicks, fallback taps, or app-state writes.' });
    const results = [];
    for (const scenario of ['mythic-paint', 'christmas-pan'] as const)
      results.push(await runScenario(browser, info, scenario, variant));
    expect(results.filter(result => result.error), JSON.stringify(results, null, 2)).toEqual([]);
  });
}
