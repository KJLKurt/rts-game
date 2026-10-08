import { action, clearGround, expect, launch, pause, resume, tap, test } from './helpers';
import type { Locator, Page } from '@playwright/test';

async function press(page: Page, control: Locator) {
  await control.scrollIntoViewIfNeeded();
  if (await page.evaluate(() => navigator.maxTouchPoints > 0)) await control.tap();
  else await control.click();
}
async function picker(page: Page) {
  await press(page, action(page, 'panel-orders'));
  await press(page, action(page, 'choose-troops'));
  await expect(page.getByRole('dialog', { name: 'Choose troops', exact: true })).toBeVisible();
}
const snapshot = (page: Page) => page.evaluate(() => JSON.stringify(window.__FRONTIER__.state));
async function retired(page: Page) {
  await expect(page.locator('#toast')).toHaveText('');
  await expect(page.locator('#toast')).not.toHaveClass(/show/);
}
async function assertDialogFeedbackClear(page: Page) {
  const proof = await page.locator('#toast').evaluate(el => {
    const dialog = el.closest<HTMLElement>('.dialog')!, r = el.getBoundingClientRect();
    const overlap = (other: DOMRect) => Math.max(0, Math.min(r.right, other.right) - Math.max(r.left, other.left)) * Math.max(0, Math.min(r.bottom, other.bottom) - Math.max(r.top, other.top));
    return {
      inSlot: !!el.closest('.dialog-feedback-slot'),
      slotBoxSizing: getComputedStyle(el.closest('.dialog-feedback-slot')!).boxSizing,
      position: getComputedStyle(el).position,
      fits: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight && el.scrollWidth <= el.clientWidth + 1,
      overlaps: [...dialog.querySelectorAll('button,input,summary')].map(control => overlap(control.getBoundingClientRect())),
    };
  });
  expect(proof.inSlot).toBe(true); expect(proof.slotBoxSizing).toBe('border-box'); expect(proof.position).toBe('static'); expect(proof.fits).toBe(true);
  expect(proof.overlaps.every(area => area === 0)).toBe(true);
  await expect(page.locator('#toast')).toHaveCount(1);
}

test('Move, Attack and Attack-move keep one live targeting instruction and a native Cancel', async ({ page }) => {
  await launch(page, { difficulty: 'easy' }); await pause(page);
  for (const order of ['move', 'attack', 'attackMove']) {
    if (order === 'attackMove') await press(page, action(page, 'panel-orders'));
    await press(page, action(page, `order-${order}`));
    const status = page.locator('.target-toolbar [role="status"]');
    await expect(status).toHaveAttribute('aria-live', 'polite');
    await expect(status).toHaveAttribute('aria-atomic', 'true');
    await expect(status).toContainText(order === 'attack' ? 'Attack · tap an enemy' : `${order === 'move' ? 'Move' : 'Attack-move'} · tap a destination`);
    await expect(page.locator('#toast')).not.toContainText(/(?:Move|Attack|Attack-move): tap/);
    const cancel = action(page, 'cancel-order'), node = await cancel.elementHandle();
    if (order === 'attack') {
      await tap(page, await clearGround(page));
      await expect(status).toContainText('Choose an enemy unit or building.');
      expect(await node!.evaluate(el => el === document.querySelector('[data-action="cancel-order"]'))).toBe(true);
    }
    await press(page, cancel); await expect(page.locator('#target-controls')).toBeEmpty();
    expect(await page.evaluate(() => window.__FRONTIER__.state.pendingCommands)).toEqual([]);
  }
});

for (const viaDialog of [false, true]) test(`queued feedback retires on ${viaDialog ? 'dialog' : 'HUD'} Resume without losing orders`, async ({ page }) => {
  await launch(page, { difficulty: 'easy' }); await pause(page);
  await press(page, action(page, 'hold'));
  await expect(page.locator('#toast')).toContainText('ready when you resume');
  const before = await snapshot(page);
  if (viaDialog) {
    await press(page, action(page, 'pause-menu'));
    await expect(page.locator('#toast')).toHaveClass(/show/);
    await assertDialogFeedbackClear(page);
    expect(await snapshot(page)).toBe(before);
    await press(page, action(page, 'resume-dialog'));
  } else await resume(page);
  await retired(page);
  expect(await page.evaluate(() => ({ paused: window.__FRONTIER__.state.paused, pending: window.__FRONTIER__.state.pendingCommands.length }))).toEqual({ paused: false, pending: 0 });
  expect(await page.evaluate(() => window.__FRONTIER__.state.entities.find(e => e.team === 0 && e.kind === 'commander')!.order.type)).toBe('hold');
});

test('restored guidance clears on Resume and stays clear of large-text troop controls through expiry', async ({ page }) => {
  await launch(page, { difficulty: 'easy', commander: 'ranger' }); await pause(page);
  await press(page, action(page, 'pause-menu')); await press(page, action(page, 'settings'));
  await page.getByLabel('Interface text size', { exact: true }).selectOption('1.3');
  await press(page, page.getByRole('button', { name: 'Done', exact: true }));
  await press(page, action(page, 'pause-menu')); await press(page, action(page, 'save-leave'));
  await expect(action(page, 'continue')).toBeVisible(); await page.reload();
  await press(page, action(page, 'continue'));
  await expect(page.locator('#toast')).toHaveText('Battle restored. Resume when you’re ready.');
  await resume(page); await retired(page);
  // Reload the same owned checkpoint to inspect the immediate restored notice.
  await page.reload(); await press(page, action(page, 'continue'));
  await expect(page.locator('#toast')).toHaveText('Battle restored. Resume when you’re ready.');
  const before = await snapshot(page), toastNode = await page.locator('#toast').elementHandle();
  await picker(page); await assertDialogFeedbackClear(page);
  const controls = () => page.locator('.troop-picker-dialog').evaluate(el => [...el.querySelectorAll('header button,.troop-picker-toolbar button,.troop-picker-footer button')].map(control => control.getBoundingClientRect().toJSON()));
  const positions = await controls();
  await page.screenshot({ path: test.info().outputPath('restored-feedback-inside-troop-sheet.png') });
  await expect(page.locator('#toast')).not.toHaveClass(/show/, { timeout: 5000 });
  expect(await controls()).toEqual(positions);
  expect(await snapshot(page)).toBe(before);
  await press(page, page.getByRole('button', { name: 'Cancel', exact: true }));
  await expect(action(page, 'choose-troops')).toBeFocused();
  expect(await toastNode!.evaluate(el => el.isConnected && !el.closest('.dialog'))).toBe(true);
  await press(page, action(page, 'choose-troops')); await press(page, action(page, 'troop-select-apply'));
  await expect(page.locator('#toast')).toHaveText('1 troop selected. Choose Move, Attack, or Hold.');
  await expect(action(page, 'choose-troops')).toBeFocused();
  expect(await snapshot(page)).toBe(before);
});

test('fresh save and error announcements survive dialog replacement and Resume', async ({ page }) => {
  await launch(page, { difficulty: 'easy', commander: 'engineer' }); await pause(page);
  await press(page, action(page, 'pause-menu')); await press(page, action(page, 'save'));
  await expect(page.locator('#toast')).toHaveText('Battle saved on this device.');
  await assertDialogFeedbackClear(page);
  const toastNode = await page.locator('#toast').elementHandle();
  await press(page, action(page, 'settings'));
  expect(await toastNode!.evaluate(el => el.isConnected && !!el.closest('.dialog-feedback-slot'))).toBe(true);
  await expect(page.locator('#toast')).toHaveText('Battle saved on this device.');
  await press(page, page.getByRole('button', { name: 'Done', exact: true }));
  await resume(page); await expect(page.locator('#toast')).toHaveText('Battle saved on this device.');
  await expect(page.locator('#toast')).toHaveClass(/show/);
  await pause(page); await press(page, page.getByRole('button', { name: 'Breach Charge', exact: true }));
  await expect(page.locator('#toast')).toHaveClass(/warning/);
  const warning = await page.locator('#toast').textContent();
  await picker(page); await assertDialogFeedbackClear(page);
  await press(page, page.getByRole('button', { name: 'Cancel', exact: true }));
  await resume(page);
  await expect(page.locator('#toast')).toHaveText(warning!); await expect(page.locator('#toast')).toHaveClass(/show.*warning/);
});
