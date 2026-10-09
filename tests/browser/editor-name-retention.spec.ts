import type { Locator, Page } from '@playwright/test';
import type { Point } from '../../src/sim/types';
import type { ProfileV2 } from '../../src/ui/progression/profile';
import { test, expect, home, action, acknowledgeFirstBriefing } from './helpers';

const themes = ['christmas', 'mythic'] as const;
const nameInput = (page: Page) => page.locator('#editor-map-name');
const map = (page: Page) => page.evaluate(() => structuredClone(window.__FRONTIER__.state.map));
const profile = (page: Page) => page.evaluate(() => structuredClone(window.__FRONTIER__.profile));
const camera = (page: Page) => page.evaluate(() => ({ ...window.__FRONTIER__.renderer.camera }));

async function press(page: Page, target: string | Locator) {
  const control = typeof target === 'string' ? action(page, target) : target;
  if (test.info().project.use.hasTouch) await control.tap();
  else await control.click();
}

async function openWorkshop(page: Page, theme: typeof themes[number] = 'christmas') {
  test.info().annotations.push({
    type: 'read-only-game-inspection',
    description: 'Native controls and mouse/CDP touch gestures perform edits. The exposed game API is read only for map, camera, profile, theme, and unobscured tile geometry.',
  });
  await home(page);
  await press(page, 'settings');
  await page.getByLabel('Visual theme', { exact: true }).selectOption(theme);
  await expect.poll(() => page.evaluate(() =>
    (window.__FRONTIER__.renderer as unknown as { visualTheme: string }).visualTheme,
  )).toBe(theme);
  await expect(page.getByLabel('Visual theme', { exact: true })).toBeEnabled();
  await press(page, page.getByRole('button', { name: 'Done', exact: true }));
  await press(page, 'editor');
  await press(page, 'new-editor');
  await expect(page.locator('.editor-header')).toBeVisible();
  await expect(action(page, 'editor-undo')).toBeDisabled();
}

async function toolsVisible(page: Page, visible: boolean) {
  if (await page.locator('.editor-tools').isVisible() !== visible)
    await press(page, 'toggle-editor-tools');
}

async function prepareSnow(page: Page) {
  await toolsVisible(page, true);
  await press(page, 'brush-snow');
  await page.locator('#brush-size').selectOption('1');
  await toolsVisible(page, false);
}

/** Read actual projected tile centers; keep native touch's entire contact area off UI. */
async function visibleStroke(page: Page, roomForPinch = false) {
  return page.evaluate(roomForPinch => {
    const { state: s, renderer: r } = window.__FRONTIER__;
    const clear = (p: Point) => [-24, 0, 24].every(dx => [-24, 0, 24].every(dy =>
      document.elementFromPoint(p.x + dx, p.y + dy)?.id === 'world',
    ));
    const candidates: { points: Point[]; indices: number[]; distance: number }[] = [];
    for (let y = 2; y < s.map.height - 2; y++) for (let x = 2; x < s.map.width - 5; x++) {
      const indices = [0, 1, 2, 3].map(dx => y * s.map.width + x + dx);
      if (indices.some(i => s.map.tiles[i] === 'snow')) continue;
      const points = [0, 1, 2, 3].map(dx => r.worldToScreen(x + dx + .5, y + .5));
      if (!points.every(clear)) continue;
      if (roomForPinch && ![-15, 0, 25, 50, 70].every(dx =>
        clear({ x: points[1].x + dx, y: points[1].y }),
      )) continue;
      candidates.push({ points, indices, distance: Math.hypot(points[1].x - innerWidth / 2, points[1].y - innerHeight / 2) });
    }
    candidates.sort((a, b) => a.distance - b.distance);
    if (!candidates.length) throw new Error('No unobscured four-tile contrasting snow stroke.');
    return candidates[0];
  }, roomForPinch);
}

async function drag(page: Page, points: Point[]) {
  if (test.info().project.use.hasTouch) {
    const cdp = await page.context().newCDPSession(page);
    try {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...points[0], id: 1 }] });
      for (const point of points.slice(1))
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...point, id: 1 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } finally { await cdp.detach(); }
  } else {
    await page.mouse.move(points[0].x, points[0].y);
    await page.mouse.down();
    try {
      for (const point of points.slice(1)) await page.mouse.move(point.x, point.y, { steps: 3 });
    } finally { await page.mouse.up(); }
  }
}

async function expectName(page: Page, name: string) {
  await expect(nameInput(page)).toHaveValue(name);
  expect((await map(page)).name).toBe(name);
}

for (const theme of themes) {
  test(`${theme} inline name survives one-stroke Undo/Redo, save, reload, and test return`, async ({ page, isMobile }) => {
    await openWorkshop(page, theme);
    const original = await map(page), originalProfile = await profile(page);
    await prepareSnow(page);
    const stroke = await visibleStroke(page);
    await drag(page, stroke.points);
    const painted = await map(page);
    for (const index of stroke.indices) expect(painted.tiles[index]).toBe('snow');
    expect(painted.tiles).not.toEqual(original.tiles);
    await toolsVisible(page, true);

    const beforeUndo = `${theme} before Undo`, beforeRedo = `${theme} after Undo`;
    await nameInput(page).fill(beforeUndo);
    await press(page, 'editor-undo');
    await expectName(page, beforeUndo);
    expect((await map(page)).tiles).toEqual(original.tiles);
    await expect(action(page, 'editor-undo')).toBeDisabled();
    await expect(action(page, 'editor-redo')).toBeEnabled();

    await nameInput(page).fill(beforeRedo);
    await press(page, 'editor-redo');
    await expectName(page, beforeRedo);
    expect((await map(page)).tiles).toEqual(painted.tiles);
    await expect(action(page, 'editor-undo')).toBeEnabled();
    await expect(action(page, 'editor-redo')).toBeDisabled();
    await press(page, 'save-map');
    await expect(page.getByRole('status')).toContainText('Workshop saved');
    const saved = await map(page), savedCamera = await camera(page);
    expect(saved.validation.valid).toBe(true);
    await press(page, 'exit-editor');
    await expect(page.locator('.workshop-library-entry h3')).toHaveText(beforeRedo);
    await page.reload();
    await expect(action(page, 'editor')).toBeVisible();
    await press(page, 'editor');
    await press(page, 'resume-editor');
    await expectName(page, beforeRedo);
    expect(await map(page)).toEqual(saved);
    expect(await camera(page)).toEqual(savedCamera);
    expect(await profile(page)).toEqual(originalProfile);

    await press(page, 'test-map');
    await expect(page.locator('.hud')).toBeVisible();
    await acknowledgeFirstBriefing(page);
    await press(page, page.locator('.workshop-test-return [data-action="return-to-editor"]'));
    await expectName(page, beforeRedo);
    expect(await map(page)).toEqual(saved);
    expect(await camera(page)).toEqual(savedCamera);
    expect(await profile(page)).toEqual(originalProfile);
    // The same one-stroke history must survive both persistence and a real test battle.
    await press(page, 'editor-undo');
    await expectName(page, beforeRedo);
    expect((await map(page)).tiles).toEqual(original.tiles);
    await expect(action(page, 'editor-undo')).toBeDisabled();
    await press(page, 'editor-redo');
    expect(await map(page)).toEqual(saved);
    if (isMobile) {
      await nameInput(page).scrollIntoViewIfNeeded();
      await expect(nameInput(page)).toBeInViewport();
      await expect(action(page, 'editor-undo')).toBeInViewport();
      await expect(action(page, 'editor-redo')).toBeInViewport();
      await page.screenshot({ path: test.info().outputPath(`${theme}-retained-name-and-history.png`) });
    }
  });
}

test('explicit settings rename stays undoable and blank inline names leave history untouched', async ({ page, isMobile }) => {
  await openWorkshop(page);
  const original = await map(page), originalProfile = await profile(page);
  await press(page, 'workshop-settings');
  const form = page.locator('#workshop-settings-form');
  await form.locator('[name="map-name"]').fill('Explicit settings rename');
  await press(page, form.getByRole('button', { name: 'Apply settings', exact: true }));
  await expect(form).toHaveCount(0);
  await expectName(page, 'Explicit settings rename');
  const renamed = await map(page);
  await nameInput(page).fill('   ');
  await press(page, 'editor-undo');
  await expect(page.getByRole('status')).toContainText('Give your map a name between 1 and 120 characters');
  await expect(nameInput(page)).toHaveValue('   ');
  expect(await map(page)).toEqual(renamed);
  await expect(action(page, 'editor-undo')).toBeEnabled();
  await expect(action(page, 'editor-redo')).toBeDisabled();
  if (!isMobile) {
    await nameInput(page).blur();
    await page.keyboard.press('Control+z');
    await expect(page.getByRole('status')).toContainText('Give your map a name between 1 and 120 characters');
    expect(await map(page)).toEqual(renamed);
    await expect(action(page, 'editor-undo')).toBeEnabled();
    await expect(action(page, 'editor-redo')).toBeDisabled();
  }
  await nameInput(page).fill('Explicit settings rename');
  await press(page, 'editor-undo');
  await expectName(page, original.name!);
  expect(await map(page)).toEqual(original);
  await expect(action(page, 'editor-undo')).toBeDisabled();
  await press(page, 'editor-redo');
  await expectName(page, 'Explicit settings rename');
  expect(await map(page)).toEqual(renamed);
  expect(await profile(page)).toEqual(originalProfile);
});

test('native Pan never paints; phone touchcancel and pinch discard unfinished strokes', async ({ page, isMobile }) => {
  await openWorkshop(page);
  const original = await map(page), originalProfile = await profile(page);
  await press(page, 'editor-pan');
  await toolsVisible(page, false);
  const panStroke = await visibleStroke(page), beforePan = await camera(page);
  await drag(page, panStroke.points);
  expect(await camera(page)).not.toEqual(beforePan);
  expect(await map(page)).toEqual(original);
  await toolsVisible(page, true);
  await expect(action(page, 'editor-undo')).toBeDisabled();
  await prepareSnow(page);

  if (isMobile) {
    const cdp = await page.context().newCDPSession(page);
    try {
      for (const cancel of ['touchcancel', 'pinch']) {
        const { points } = await visibleStroke(page, true), before = await map(page);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...points[0], id: 1 }] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...points[1], id: 1 }] });
        expect((await map(page)).tiles, `${cancel} must interrupt real in-progress paint`).not.toEqual(before.tiles);
        if (cancel === 'touchcancel') {
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
        } else {
          const beforePinch = await camera(page);
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [
            { ...points[1], id: 1 }, { x: points[1].x + 50, y: points[1].y, id: 2 },
          ] });
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [
            { x: points[1].x - 15, y: points[1].y, id: 1 },
            { x: points[1].x + 70, y: points[1].y, id: 2 },
          ] });
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
          expect((await camera(page)).zoom).not.toBe(beforePinch.zoom);
        }
        expect(await map(page)).toEqual(before);
        await toolsVisible(page, true);
        await expect(action(page, 'editor-undo')).toBeDisabled();
        await expect(action(page, 'editor-redo')).toBeDisabled();
        await toolsVisible(page, false);
      }
    } finally { await cdp.detach(); }
  }
  // A completed gesture still works after cancellation and is exactly one Undo.
  const completed = await visibleStroke(page);
  await drag(page, completed.points);
  expect((await map(page)).tiles).not.toEqual(original.tiles);
  await toolsVisible(page, true);
  await press(page, 'editor-undo');
  expect(await map(page)).toEqual(original);
  await expect(action(page, 'editor-undo')).toBeDisabled();
  expect(await profile(page)).toEqual(originalProfile);
});

test('controlled pending achievement card explains the next eligible battle without awarding it', async ({ page }) => {
  test.info().annotations.push({
    type: 'controlled-fixture',
    description: 'Fresh isolated Playwright context only: one in-memory locked Foundations record has progress 5/5. Native Command record navigation renders the card. No real hosted profile or persisted reward is modified.',
  });
  await home(page);
  await page.evaluate(() => {
    const p = window.__FRONTIER__.profile as ProfileV2;
    p.achievements.builder = { progress: 5, unlocked: false, unlockedAt: null };
  });
  const fixtureProfile = await profile(page);
  await press(page, 'record');
  await press(page, page.locator('[data-action="record-category"][data-id="economy"]'));
  const card = page.locator('.achievement').filter({ has: page.getByRole('heading', { name: 'Foundations', exact: true }) });
  await card.scrollIntoViewIfNeeded();
  await expect(card).not.toHaveClass(/unlocked/);
  await expect(card.locator('progress')).toHaveAttribute('value', '5');
  await expect(card.locator('progress')).toHaveAttribute('max', '5');
  await expect(card.locator('.achievement-pending')).toHaveText('Progress recorded. Awarded after you finish another battle without surrender.');
  await expect(card.locator('.achievement-pending')).toBeInViewport();
  await expect(card.locator('.achievement-date')).toHaveCount(0);
  expect(await profile(page)).toEqual(fixtureProfile);
  await card.screenshot({ path: test.info().outputPath('controlled-pending-foundations-card.png') });
});
