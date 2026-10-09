import { writeFile } from 'node:fs/promises';
import type { Locator, Page } from '@playwright/test';
import { test, expect, action } from './helpers';

type PointerRecord = { type: string; trusted: boolean; action: string | null; pointerType?: string; target: string | null; x?: number; y?: number };

/** Passive diagnostics only. All product changes use ordinary visible controls;
 * no map imports, storage fixtures, engine/start/save bridge, DOM activation,
 * force clicks, CSS overrides or game-state writes are used in this acceptance. */
async function traceInput(page: Page) {
  await page.addInitScript(() => {
    const telemetry = window as Window & { __previewInput?: PointerRecord[] };
    telemetry.__previewInput = [];
    for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'click', 'input', 'change']) {
      document.addEventListener(type, event => {
        const p = event as PointerEvent, node = event.target instanceof Element ? event.target : null;
        telemetry.__previewInput!.push({ type, trusted: event.isTrusted,
          action: node?.closest('[data-action]')?.getAttribute('data-action') ?? null,
          pointerType: p.pointerType, target: node?.id || node?.tagName || null,
          x: p.clientX, y: p.clientY,
        });
      }, { capture: true, passive: true });
    }
  });
}

async function press(page: Page, target: string | Locator) {
  const control = typeof target === 'string' ? action(page, target) : target;
  await control.scrollIntoViewIfNeeded();
  if (test.info().project.use.hasTouch) await control.tap();
  else await control.click();
}

async function record(page: Page, label: string, screenshot = false, draft = false) {
  // Allow native layout and ResizeObserver delivery to settle; this does not
  // wait for a desired geometry value or conceal an overlapping layout.
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  const ledger = await page.evaluate(includeDraft => {
    const f = window.__FRONTIER__;
    const rect = (element: Element) => {
      const r = element.getBoundingClientRect(), style = getComputedStyle(element);
      return { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom,
        visible: style.display !== 'none' && style.visibility !== 'hidden' && r.width > 0 && r.height > 0,
        text: element.textContent?.trim(), clientWidth: element.clientWidth, scrollWidth: element.scrollWidth };
    };
    const selectors = ['.hud', '.workshop-test-return button', '#objective', '.objective-description', '.objective-income', '.score-track',
      '#battle-hint', '.minimap-wrap', '.map-controls', '.command-deck', '.commander-strip', '.ability-dock', '#joystick',
      '.hud .brand-button', '.resources', '.pause-button', '#match-time', '#paused-ribbon'];
    const geometry = Object.fromEntries(selectors.map(selector => [selector,
      document.querySelector(selector) ? rect(document.querySelector(selector)!) : null]));
    const back = document.querySelector('.workshop-test-return button');
    const hits = back ? [[.1, .1], [.9, .1], [.5, .5], [.1, .9], [.9, .9]].map(([px, py]) => {
      const r = back.getBoundingClientRect();
      return document.elementFromPoint(r.x + r.width * px, r.y + r.height * py)?.closest('[data-action]')?.getAttribute('data-action');
    }) : [];
    return {
      url: location.href, runtime: document.querySelector('script[src]')?.getAttribute('src'),
      viewport: { width: innerWidth, height: innerHeight, touchPoints: navigator.maxTouchPoints },
      textScale: getComputedStyle(document.documentElement).getPropertyValue('--ui-scale').trim() || '1',
      geometry, hits, playing: f?.playing, paused: f?.state.paused, time: f?.state.time,
      previewHudCount: document.querySelectorAll('.workshop-preview-hud').length,
      returnCount: document.querySelectorAll('.workshop-test-return').length,
      guideText: document.querySelector('#battle-hint')?.textContent,
      deckExpanded: document.querySelector('[data-action="toggle-deck"]')?.getAttribute('aria-expanded'),
      mapExpanded: document.querySelector('[data-action="toggle-minimap"]')?.getAttribute('aria-expanded'),
      camera: f ? { ...f.renderer.camera } : null,
      profile: f ? structuredClone(f.profile) : null,
      draft: includeDraft && f ? { map: structuredClone(f.state.map), settings: structuredClone(f.state.settings) } : null,
      editorMode: document.querySelector('.editor-mode-tools .active')?.getAttribute('data-action'),
      inputEvents: (window as Window & { __previewInput?: PointerRecord[] }).__previewInput ?? [],
    };
  }, draft);
  const json = test.info().outputPath(`${label}.json`);
  await writeFile(json, JSON.stringify(ledger, null, 2));
  await test.info().attach(`${label}.json`, { path: json, contentType: 'application/json' });
  if (screenshot) {
    const path = test.info().outputPath(`${label}.png`);
    await page.screenshot({ path, scale: 'css' });
    await test.info().attach(`${label}.png`, { path, contentType: 'image/png' });
  }
  return ledger;
}

type Ledger = Awaited<ReturnType<typeof record>>;
type Box = NonNullable<Ledger['geometry'][string]>;
const overlaps = (a: Box, b: Box) => a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y;

function assertClear(ledger: Ledger, battlefieldPairs = true) {
  const back = ledger.geometry['.workshop-test-return button']!, objective = ledger.geometry['#objective']!;
  expect(back, 'Existing Return to workshop control is present').not.toBeNull();
  expect(objective, 'Existing objective strip is present').not.toBeNull();
  expect(back.visible).toBe(true);
  expect(objective.visible).toBe(true);
  expect(back.text).toBe('Return to workshop');
  expect(objective.text).toContain('Relics earn victory points');
  // The SAME positive oracle runs on old production and the candidate. Old
  // portrait must fail here with real intersecting rectangles, not in setup.
  expect(overlaps(back, objective), 'Return to workshop must not overlap the objective strip').toBe(false);
  expect(back.h).toBeGreaterThanOrEqual(44);
  expect(back.w).toBeGreaterThanOrEqual(44);
  expect(back.scrollWidth, 'Return label fits its visible control').toBeLessThanOrEqual(back.clientWidth);
  expect(back.x).toBeGreaterThanOrEqual(0);
  expect(back.y).toBeGreaterThanOrEqual(0);
  expect(back.right).toBeLessThanOrEqual(ledger.viewport.width);
  expect(back.bottom).toBeLessThanOrEqual(ledger.viewport.height);
  expect(ledger.hits, 'Return receives native input across its target').toEqual(Array(5).fill('return-to-editor'));
  for (const [selector, box] of Object.entries(ledger.geometry)) {
    if (selector === '.hud' || selector === '.workshop-test-return button' || !box?.visible) continue;
    expect(overlaps(back, box), `Return stays clear of ${selector}`).toBe(false);
  }
  const hud = ledger.geometry['.hud']!;
  expect(back.x).toBeGreaterThanOrEqual(hud.x);
  expect(back.right).toBeLessThanOrEqual(hud.right);
  expect(back.y).toBeGreaterThanOrEqual(hud.y);
  expect(back.bottom).toBeLessThanOrEqual(hud.bottom);
  expect(objective.y, 'Objective follows the full measured HUD').toBeGreaterThanOrEqual(hud.bottom);
  const slots = ['.hud .brand-button', '.resources', '.pause-button', '#match-time', '#paused-ribbon']
    .map(selector => ({ selector, box: ledger.geometry[selector] })).filter(slot => slot.box?.visible);
  for (const { selector, box } of slots) {
    expect(box!.x, `${selector} stays inside the HUD`).toBeGreaterThanOrEqual(hud.x);
    expect(box!.right, `${selector} stays inside the HUD`).toBeLessThanOrEqual(hud.right);
    expect(box!.y, `${selector} stays inside the HUD`).toBeGreaterThanOrEqual(hud.y);
    expect(box!.bottom, `${selector} stays inside the HUD`).toBeLessThanOrEqual(hud.bottom);
  }
  for (let i = 0; i < slots.length; i++) for (const other of slots.slice(i + 1))
    expect(overlaps(slots[i].box!, other.box!), `${slots[i].selector} stays clear of ${other.selector}`).toBe(false);
  if (battlefieldPairs) for (const [first, second] of [
    ['#objective', '#battle-hint'], ['#objective', '.minimap-wrap'], ['#objective', '.map-controls'],
    ['#battle-hint', '.minimap-wrap'], ['#battle-hint', '.map-controls'],
    ['.minimap-wrap', '.command-deck'], ['.map-controls', '.command-deck'],
  ]) {
    const a = ledger.geometry[first], b = ledger.geometry[second];
    if (a?.visible && b?.visible) expect(overlaps(a, b), `${first} stays clear of ${second}`).toBe(false);
  }
}

function nativeAction(ledger: Ledger, name: string) {
  expect(ledger.inputEvents.some(event => event.type === 'pointerdown' && event.action === name
    && event.trusted && event.pointerType === (test.info().project.use.hasTouch ? 'touch' : 'mouse')), `${name}: trusted pointerdown`).toBe(true);
  expect(ledger.inputEvents.some(event => event.type === 'click' && event.action === name && event.trusted), `${name}: trusted click`).toBe(true);
}

function preserved(actual: Ledger, draft: Ledger) {
  expect(actual.draft, 'Full draft and settings restored').toEqual(draft.draft);
  expect(actual.camera, 'Translated, non-default-zoom editor camera restored').toEqual(draft.camera);
  expect(actual.profile, 'Whole original profile remains unchanged').toEqual(draft.profile);
  expect(actual.editorMode).toBe('editor-pan');
  expect(actual.playing).toBe(false);
  expect(actual.returnCount).toBe(0);
  expect(actual.previewHudCount).toBe(0);
}

async function panEditor(page: Page) {
  // Find a clear native drag corridor; this reads only DOM hit testing.
  const points = await page.evaluate(() => {
    for (let y = Math.round(innerHeight / 2); y < innerHeight - 100; y += 20) {
      for (let x = Math.round(innerWidth / 3); x < innerWidth - 100; x += 20) {
        const points = [0, 16, 32, 48].map(dx => ({ x: x + dx, y: y + dx / 3 }));
        if (points.every(p => [-12, 0, 12].every(dx => [-12, 0, 12].every(dy =>
          document.elementFromPoint(p.x + dx, p.y + dy)?.id === 'world')))) return points;
      }
    }
    throw new Error('No unobscured editor pan corridor.');
  });
  if (test.info().project.use.hasTouch) {
    const cdp = await page.context().newCDPSession(page);
    try {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...points[0], id: 1 }] });
      for (const point of points.slice(1)) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...point, id: 1 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } finally { await cdp.detach(); }
  } else {
    await page.mouse.move(points[0].x, points[0].y);
    await page.mouse.down();
    try { for (const p of points.slice(1)) await page.mouse.move(p.x, p.y, { steps: 3 }); }
    finally { await page.mouse.up(); }
  }
}

async function launchPreview(page: Page) {
  await press(page, 'test-map');
  await page.locator('.hud').waitFor({ state: 'visible' });
  const briefing = page.getByRole('button', { name: 'Start battle', exact: true });
  if (await briefing.count()) await press(page, briefing);
  await page.waitForFunction(() => window.__FRONTIER__.playing && window.__FRONTIER__.state.time > 0);
}

async function setPreviewText(page: Page, size: string, tips: boolean) {
  await press(page, 'pause-menu');
  await press(page, 'settings');
  await page.getByLabel('Interface text size', { exact: true }).selectOption(size);
  await page.getByLabel('Commander’s field guide', { exact: true }).setChecked(tips);
  await press(page, page.getByRole('dialog', { name: 'Settings', exact: true }).getByRole('button', { name: 'Done', exact: true }));
  await page.waitForFunction(show => show
    ? document.querySelector('#battle-hint')?.textContent?.includes('COMMANDER’S FIELD GUIDE')
    : document.querySelector('#battle-hint')?.textContent === '', tips);
}

test.afterEach(async ({ page }) => {
  if (test.info().status === test.info().expectedStatus || page.isClosed()) return;
  try { await record(page, 'failure-final-state', true, true); }
  catch (error) { await test.info().attach('failure-evidence-unavailable.txt', { body: String(error), contentType: 'text/plain' }); }
});

test('native workshop preview keeps Return clear through text, pause, guide and panel changes, then restores the draft', async ({ page }) => {
  test.setTimeout(120_000);
  test.info().annotations.push({ type: 'native-workshop-preview-layout', description: 'Ordinary native editor/Test/Return controls; passive geometry and pointer traces. Brief live previews only, not long-match or physical-device acceptance.' });
  await traceInput(page);
  await page.goto('./');
  await action(page, 'editor').waitFor({ state: 'visible' });
  await press(page, 'editor');
  await press(page, 'new-editor');
  await page.locator('.editor-header').waitFor({ state: 'visible' });
  const original = await record(page, '01-original-editor', false, true);
  if (!(await page.locator('.editor-tools').isVisible())) await press(page, 'toggle-editor-tools');
  await page.locator('#editor-map-name').fill('Native preview layout round trip');
  await press(page, 'editor-pan');
  await press(page, 'toggle-editor-tools');
  await press(page, 'zoom-in');
  await panEditor(page);
  const draft = await record(page, '02-authored-translated-draft', true, true);
  expect(draft.draft!.map.name).toBe('Native preview layout round trip');
  expect(draft.camera!.zoom).toBeGreaterThan(original.camera!.zoom);
  expect({ x: draft.camera!.x, y: draft.camera!.y }).not.toEqual({ x: original.camera!.x, y: original.camera!.y });
  expect(draft.profile).toEqual(original.profile);

  await launchPreview(page);
  const standard = await record(page, '03-standard-running-positive-overlap-oracle', true);
  assertClear(standard);
  nativeAction(standard, 'test-map');
  expect(standard.profile).toEqual(draft.profile);
  await press(page, 'pause');
  await page.waitForFunction(() => window.__FRONTIER__.state.paused);
  const paused = await record(page, '04-standard-paused', false);
  assertClear(paused);
  nativeAction(paused, 'pause');

  for (const [index, expanded] of [true, false, true].entries()) {
    if ((await action(page, 'toggle-deck').getAttribute('aria-expanded') === 'true') !== expanded) await press(page, 'toggle-deck');
    if ((await action(page, 'toggle-minimap').getAttribute('aria-expanded') === 'true') !== expanded) await press(page, 'toggle-minimap');
    const state = await record(page, `05-standard-${index}-${expanded ? 'expanded' : 'collapsed'}`);
    assertClear(state);
    expect(state.deckExpanded).toBe(String(expanded));
    expect(state.mapExpanded).toBe(String(expanded));
  }
  await setPreviewText(page, '1.3', true);
  const large = await record(page, '06-largest-text-expanded-guide', true);
  assertClear(large);
  expect(large.textScale).toBe('1.3');
  expect(large.guideText).toContain('COMMANDER’S FIELD GUIDE');
  if (large.geometry['#battle-hint']?.visible) {
    await press(page, 'dismiss-tips');
  } else {
    // Ordinary tips intentionally hide in short landscape. Exercise the actual
    // setting there rather than forcing invisible controls or changing CSS.
    await setPreviewText(page, '1.3', false);
  }
  const dismissed = await record(page, '07-largest-text-guide-dismissed');
  assertClear(dismissed);
  expect(dismissed.guideText).toBe('');
  await setPreviewText(page, '1.3', true);
  const reopened = await record(page, '08-largest-text-guide-reopened');
  assertClear(reopened);
  expect(reopened.guideText).toContain('COMMANDER’S FIELD GUIDE');
  await press(page, 'toggle-deck');
  await press(page, 'toggle-minimap');
  const compact = await record(page, '09-largest-text-collapsed', true);
  assertClear(compact);
  nativeAction(compact, 'toggle-deck');
  nativeAction(compact, 'toggle-minimap');
  const originalViewport = page.viewportSize()!;
  for (const width of [600, 601]) {
    await page.setViewportSize({ width, height: originalViewport.height });
    const resized = await record(page, `09-largest-text-resized-${width}`, true);
    // Boundary probes establish HUD width/Return clearance. The temporary
    // 600px width on a 390px-tall view uses the existing portrait controls;
    // full battlefield acceptance is kept at the four requested viewports.
    assertClear(resized, false);
    expect(resized.textScale).toBe('1.3');
    expect(resized.profile).toEqual(draft.profile);
  }
  await page.setViewportSize(originalViewport);
  const restoredViewport = await record(page, '09-original-viewport-restored');
  assertClear(restoredViewport);
  await press(page, 'pause');
  await page.waitForFunction(() => !window.__FRONTIER__.state.paused);
  const resumed = await record(page, '10-largest-text-running');
  assertClear(resumed);
  await press(page, page.locator('.workshop-test-return [data-action="return-to-editor"]'));
  await page.locator('.editor-header').waitFor({ state: 'visible' });
  const returned = await record(page, '11-returned-from-running-preview', true, true);
  preserved(returned, draft);
  nativeAction(returned, 'return-to-editor');

  // A second native launch catches stale HUD classes and observer teardown.
  await launchPreview(page);
  await press(page, 'pause');
  await page.waitForFunction(() => window.__FRONTIER__.state.paused);
  const repeated = await record(page, '12-repeated-preview-paused', true);
  assertClear(repeated);
  await press(page, page.locator('.workshop-test-return [data-action="return-to-editor"]'));
  await page.locator('.editor-header').waitFor({ state: 'visible' });
  const secondReturn = await record(page, '13-returned-from-paused-preview', false, true);
  preserved(secondReturn, draft);

  await press(page, 'exit-editor');
  await press(page, 'home');
  await press(page, 'skirmish');
  await page.locator('select[name="mapSize"]').selectOption('small');
  await press(page, 'launch');
  await page.locator('.hud').waitFor({ state: 'visible' });
  const briefing = page.getByRole('button', { name: 'Start battle', exact: true });
  if (await briefing.count()) await press(page, briefing);
  const ordinary = await record(page, '14-later-ordinary-skirmish', true);
  expect(ordinary.returnCount).toBe(0);
  expect(ordinary.previewHudCount).toBe(0);
  expect(ordinary.playing).toBe(true);
  expect(ordinary.profile).toEqual(draft.profile);
});
