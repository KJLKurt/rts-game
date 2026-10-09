import type { Locator, Page } from '@playwright/test';
import type { ProfileV2 } from '../../src/ui/progression/profile';
import { test, expect, action, home } from './helpers';

/**
 * C5 acceptance uses only the ordinary workshop UI. No storage fixture, imported
 * map, engine command, save/start bridge, synthetic DOM activation, or game-state
 * writes are used. The page script below records passive input diagnostics only.
 * Each fresh native Create a map has a random seed; its complete draft is attached.
 */
type InputEventRecord = {
  type: string;
  phase: string;
  trusted: boolean;
  pointerType?: string;
  action: string | null;
  text: string | null;
  name: string | null;
  [key: string]: unknown;
};

async function installPassiveInputTrace(page: Page) {
  await page.addInitScript(() => {
    const telemetry = window as Window & { __workshopDurationInputEvents?: InputEventRecord[] };
    telemetry.__workshopDurationInputEvents = [];
    for (const type of [
      'pointerdown', 'pointerup', 'pointercancel', 'gotpointercapture',
      'lostpointercapture', 'click', 'input', 'change', 'invalid', 'submit',
    ]) {
      document.addEventListener(type, event => {
        const pointer = event as PointerEvent;
        const target = event.target instanceof Element ? event.target : null;
        const button = target?.closest('button');
        const record = (phase: string) => {
          telemetry.__workshopDurationInputEvents!.push({
            type, phase, trusted: event.isTrusted,
            time: performance.now(), eventTime: event.timeStamp,
            pointerType: pointer.pointerType, pointerId: pointer.pointerId,
            x: pointer.clientX, y: pointer.clientY, detail: pointer.detail,
            target: target?.id || target?.tagName,
            action: target?.closest('[data-action]')?.getAttribute('data-action') ?? null,
            name: target?.getAttribute('name') ?? null,
            text: button?.textContent?.trim() ?? null,
            value: target instanceof HTMLInputElement || target instanceof HTMLSelectElement ? target.value : null,
            panelClass: document.querySelector('.editor-tools')?.className ?? null,
          });
          if (telemetry.__workshopDurationInputEvents!.length > 512)
            telemetry.__workshopDurationInputEvents!.shift();
        };
        record('capture');
        if (type === 'click') queueMicrotask(() => record('microtask'));
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

async function fill(control: Locator, value: string) {
  await control.scrollIntoViewIfNeeded();
  await control.fill(value);
}

async function observe(page: Page, label: string) {
  const ledger = await page.evaluate(() => {
    const game = window.__FRONTIER__;
    const inputs = [...document.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
      '#workshop-settings-form input, #workshop-settings-form select, #editor-map-name',
    )].map(input => ({
      id: input.id, name: input.name, value: input.value,
      min: input instanceof HTMLInputElement ? input.min : null,
      max: input instanceof HTMLInputElement ? input.max : null,
      valid: input.validity.valid,
      rangeUnderflow: input.validity.rangeUnderflow,
      rangeOverflow: input.validity.rangeOverflow,
      stepMismatch: input.validity.stepMismatch,
      validationMessage: input.validationMessage,
    }));
    return {
      url: location.href,
      runtimeScripts: [...document.querySelectorAll<HTMLScriptElement>('script[src]')].map(script => script.src),
      buildId: document.querySelector('[data-build-id]')?.getAttribute('data-build-id') ?? null,
      serviceWorker: navigator.serviceWorker?.controller?.scriptURL ?? null,
      viewport: { width: innerWidth, height: innerHeight, touchPoints: navigator.maxTouchPoints },
      map: structuredClone(game.state.map),
      settings: structuredClone(game.state.settings),
      profile: structuredClone(game.profile) as ProfileV2,
      camera: { ...game.renderer.camera },
      playing: game.playing, paused: game.state.paused, time: game.state.time,
      inputs,
      validationText: document.querySelector('#map-validation')?.textContent ?? null,
      settingsError: document.querySelector('#workshop-settings-error')?.textContent ?? null,
      activeEditorMode: document.querySelector('.editor-mode-tools .active')?.getAttribute('data-action') ?? null,
      toolsClass: document.querySelector('.editor-tools')?.className ?? null,
      dialogs: [...document.querySelectorAll('[role="dialog"]')].map(node => node.textContent),
      status: [...document.querySelectorAll('[role="status"]')].map(node => node.textContent),
      inputEvents: (window as Window & { __workshopDurationInputEvents?: InputEventRecord[] }).__workshopDurationInputEvents ?? [],
    };
  });
  await test.info().attach(`${label}-map-settings-profile-input-camera.json`, {
    body: JSON.stringify(ledger, null, 2), contentType: 'application/json',
  });
  await test.info().attach(`${label}-screen.png`, {
    body: await page.screenshot(), contentType: 'image/png',
  });
  return ledger;
}

/** Route waits also leave a ledger/screen if navigation or persistence stalls. */
async function observeWhen(page: Page, label: string, ready: () => Promise<unknown>) {
  try { await ready(); }
  catch (error) {
    await observe(page, `${label}-wait-failed`);
    throw error;
  }
  return observe(page, label);
}

async function toolsVisible(page: Page, visible: boolean) {
  const tools = page.locator('.editor-tools');
  if ((await tools.isVisible()) !== visible) await press(page, 'toggle-editor-tools');
  // Waiting here leaves all actual state assertions beside their evidence below.
  await observeWhen(page, visible ? 'tools-open' : 'tools-closed', () =>
    tools.waitFor({ state: visible ? 'visible' : 'hidden' }));
}

async function openSettings(page: Page) {
  await toolsVisible(page, true);
  await press(page, 'workshop-settings');
  const form = page.locator('#workshop-settings-form');
  await form.waitFor({ state: 'visible' });
  return form;
}

async function openWorkshop(page: Page) {
  test.info().annotations.push({
    type: 'native-workshop-duration-boundary',
    description: 'Ordinary UI only; native touch taps on touch projects and mouse clicks on desktop. Exposed state and passive input traces are read-only evidence. No command/start/save bridge or hidden-state/storage writes.',
  });
  await installPassiveInputTrace(page);
  await home(page);
  await press(page, 'editor');
  await press(page, 'new-editor');
  return observeWhen(page, 'original-native-draft', () =>
    page.locator('.editor-header').waitFor({ state: 'visible' }));
}

function expectNativeAction(ledger: Awaited<ReturnType<typeof observe>>, name: string) {
  const pointerType = test.info().project.use.hasTouch ? 'touch' : 'mouse';
  expect(ledger.inputEvents.some(event => event.type === 'pointerdown'
    && event.phase === 'capture' && event.action === name
    && event.trusted && event.pointerType === pointerType), `${name}: trusted ${pointerType} pointerdown`).toBe(true);
  expect(ledger.inputEvents.some(event => event.type === 'click'
    && event.phase === 'capture' && event.action === name && event.trusted), `${name}: trusted click`).toBe(true);
}

function expectPreserved(
  actual: Awaited<ReturnType<typeof observe>>,
  draft: Awaited<ReturnType<typeof observe>>,
  originalProfile: ProfileV2,
) {
  expect(actual.map, 'Full authored draft survives the round trip').toEqual(draft.map);
  expect(actual.settings, 'Preview settings survive the round trip').toEqual(draft.settings);
  expect(actual.camera, 'Native non-default camera survives the round trip').toEqual(draft.camera);
  expect(actual.profile, 'Workshop activity does not change the command record').toEqual(originalProfile);
  expect(actual.playing).toBe(false);
}

test.afterEach(async ({ page }) => {
  if (test.info().status === test.info().expectedStatus || page.isClosed()) return;
  try { await observe(page, 'failure-final-state'); }
  catch (error) {
    await test.info().attach('failure-evidence-unavailable.txt', {
      body: String(error), contentType: 'text/plain',
    });
  }
});

for (const duration of [90, 91, 120, 180]) {
  test(`C5 native workshop ${duration} minutes: apply, validate, test-return, save-reload-resume`, async ({ page }) => {
    test.setTimeout(120_000);
    const original = await openWorkshop(page);
    const name = `C5 native ${duration}-minute frontier`;
    const form = await openSettings(page);
    await fill(form.locator('[name="map-name"]'), name);
    await fill(form.locator('[name="duration"]'), String(duration));
    const entered = await observe(page, `${duration}-settings-entered`);
    expect(entered.inputs.find(input => input.name === 'duration')).toMatchObject({
      value: String(duration), min: '4', max: '180', valid: true,
    });
    await press(page, form.getByRole('button', { name: 'Apply settings', exact: true }));
    const applied = await observeWhen(page, `${duration}-settings-applied`, () => form.waitFor({ state: 'hidden' }));
    expect(applied.map.name).toBe(name);
    expect(applied.map.scenario?.rules.duration).toBe(duration);
    expect(applied.settings.duration).toBe(duration);
    expect(applied.profile).toEqual(original.profile);
    expect(applied.inputEvents.some(event => event.type === 'submit' && event.trusted)).toBe(true);
    expect(applied.inputEvents.some(event => event.type === 'pointerdown' && event.text === 'Apply settings'
      && event.trusted && event.pointerType === (test.info().project.use.hasTouch ? 'touch' : 'mouse'))).toBe(true);

    await toolsVisible(page, true);
    await press(page, 'validate-map');
    await page.locator('#map-validation').scrollIntoViewIfNeeded();
    const validated = await observe(page, `${duration}-validation-result`);
    // This exact positive oracle is retained on old and fixed production bytes.
    // Old C5 fails here at 91/120/180 with the erroneous generator-v5 requirement.
    expect(validated.map.validation.errors, validated.validationText ?? 'Workshop validation').toEqual([]);
    expect(validated.map.validation.valid).toBe(true);
    await expect(page.locator('#map-validation')).toContainText('Playable');
    expectNativeAction(validated, 'workshop-settings');
    expectNativeAction(validated, 'validate-map');

    await press(page, 'editor-pan');
    await toolsVisible(page, false);
    await press(page, 'zoom-in');
    const draft = await observe(page, `${duration}-draft-before-test`);
    expect(draft.map).toEqual(validated.map);
    expect(draft.camera.zoom).toBeGreaterThan(original.camera.zoom);
    expect(draft.activeEditorMode).toBe('editor-pan');
    expectNativeAction(draft, 'zoom-in');

    await press(page, 'test-map');
    await observeWhen(page, `${duration}-test-launched`, () => page.locator('.hud').waitFor({ state: 'visible' }));
    const briefing = page.getByRole('button', { name: 'Start battle', exact: true });
    if (await briefing.count()) {
      await press(page, briefing);
      await page.getByRole('dialog', { name: 'Your first frontier', exact: true }).waitFor({ state: 'hidden' });
    }
    const battle = await observeWhen(page, `${duration}-live-test`, () => page.waitForFunction(() =>
      window.__FRONTIER__.playing && window.__FRONTIER__.state.time > 0));
    expect(battle.playing).toBe(true);
    expect(battle.settings.duration).toBe(duration);
    expect(battle.map.scenario).toEqual(draft.map.scenario);
    expect(battle.map.tiles).toEqual(draft.map.tiles);
    expect(battle.map.seed).toBe(draft.map.seed);
    expect(battle.profile).toEqual(original.profile);
    expectNativeAction(battle, 'test-map');

    await press(page, page.locator('.workshop-test-return [data-action="return-to-editor"]'));
    const returned = await observeWhen(page, `${duration}-returned-draft`, () => page.locator('.editor-header').waitFor({ state: 'visible' }));
    expectPreserved(returned, draft, original.profile);
    expect(returned.activeEditorMode).toBe('editor-pan');
    expectNativeAction(returned, 'return-to-editor');

    await press(page, 'save-map');
    const saved = await observeWhen(page, `${duration}-saved-draft`, () =>
      page.getByRole('status').filter({ hasText: 'Workshop saved' }).waitFor({ state: 'visible' }));
    expectPreserved(saved, draft, original.profile);
    expectNativeAction(saved, 'save-map');
    await press(page, 'exit-editor');
    const library = await observeWhen(page, `${duration}-saved-library`, () =>
      page.locator('.workshop-library-entry h3').waitFor({ state: 'visible' }));
    await expect(page.locator('.workshop-library-entry h3')).toHaveText(name);
    expect(library.profile).toEqual(original.profile);
    expectNativeAction(library, 'exit-editor');

    await page.reload();
    const reloaded = await observeWhen(page, `${duration}-reloaded-home`, () => action(page, 'editor').waitFor({ state: 'visible' }));
    expect(reloaded.profile).toEqual(original.profile);
    await press(page, 'editor');
    await press(page, 'resume-editor');
    await page.locator('.editor-header').waitFor({ state: 'visible' });
    await toolsVisible(page, true);
    await page.locator('#editor-map-name').scrollIntoViewIfNeeded();
    const resumed = await observe(page, `${duration}-resumed-draft`);
    expectPreserved(resumed, saved, original.profile);
    expect(resumed.activeEditorMode).toBe('editor-pan');
    await expect(page.locator('#editor-map-name')).toHaveValue(name);
    expectNativeAction(resumed, 'resume-editor');

    const restoredForm = await openSettings(page);
    await restoredForm.locator('[name="duration"]').scrollIntoViewIfNeeded();
    const restoredSettings = await observe(page, `${duration}-resumed-settings`);
    expect(restoredSettings.inputs.find(input => input.name === 'duration')).toMatchObject({
      value: String(duration), valid: true,
    });
    await press(page, restoredForm.getByRole('button', { name: 'Cancel', exact: true }));
  });
}

test('C5 native workshop rejects 3 and 181 minutes atomically through Apply', async ({ page }) => {
  test.setTimeout(90_000);
  const original = await openWorkshop(page);
  for (const duration of [3, 181]) {
    const form = await openSettings(page);
    await fill(form.locator('[name="map-name"]'), `Must not commit ${duration}`);
    await fill(form.locator('[name="startingGold"]'), '777');
    await fill(form.locator('[name="duration"]'), String(duration));
    const entered = await observe(page, `${duration}-invalid-settings-entered`);
    expect(entered.inputs.find(input => input.name === 'duration')).toMatchObject({
      value: String(duration), min: '4', max: '180', valid: false,
      rangeUnderflow: duration < 4, rangeOverflow: duration > 180,
    });
    const submitCount = entered.inputEvents.filter(event => event.type === 'submit').length;
    await press(page, form.getByRole('button', { name: 'Apply settings', exact: true }));
    // The browser's own min/max guard legitimately prevents the submit event.
    // Do not disable HTML validity or manufacture a submit to reach app code.
    const rejected = await observe(page, `${duration}-native-invalid-apply`);
    expectPreserved(rejected, original, original.profile);
    await expect(form).toBeVisible();
    expect(rejected.inputs.find(input => input.name === 'duration')).toMatchObject({
      value: String(duration), valid: false,
      rangeUnderflow: duration < 4, rangeOverflow: duration > 180,
    });
    expect(rejected.inputs.find(input => input.name === 'duration')?.validationMessage).toBeTruthy();
    expect(rejected.inputEvents.filter(event => event.type === 'submit')).toHaveLength(submitCount);
    const attemptEvents = rejected.inputEvents.slice(entered.inputEvents.length);
    expect(attemptEvents.some(event => event.type === 'invalid' && event.name === 'duration'
      && event.value === String(duration) && event.trusted)).toBe(true);
    expect(attemptEvents.some(event => event.type === 'pointerdown' && event.text === 'Apply settings'
      && event.trusted && event.pointerType === (test.info().project.use.hasTouch ? 'touch' : 'mouse'))).toBe(true);
    expect(attemptEvents.some(event => event.type === 'click' && event.text === 'Apply settings' && event.trusted)).toBe(true);
    await press(page, form.getByRole('button', { name: 'Cancel', exact: true }));
    const cancelled = await observeWhen(page, `${duration}-cancelled-invalid-settings`, () => form.waitFor({ state: 'hidden' }));
    expectPreserved(cancelled, original, original.profile);
    await toolsVisible(page, true);
    await page.locator('#editor-map-name').scrollIntoViewIfNeeded();
    await expect(page.locator('#editor-map-name')).toHaveValue(original.map.name!);
    await expect(action(page, 'editor-undo')).toBeDisabled();
    await expect(action(page, 'editor-redo')).toBeDisabled();
  }
});
