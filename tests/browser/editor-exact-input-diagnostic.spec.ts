import { gzipSync } from 'node:zlib';
import { createRequire } from 'node:module';
import { devices, type Browser, type BrowserContext, type CDPSession, type Page, type TestInfo } from '@playwright/test';
import type { Point } from '../../src/sim/types';
import { test, expect, action, home } from './helpers';

// QA-only, opt-in discriminator; never replaces editor-name-retention.spec.ts.
// Three identities per phone project, two fresh-context scenarios per identity:
// FRONTIER_EXACT_INPUT_DIAGNOSTIC=1, --workers=1, --retries=0, both phone projects.
// Optional FRONTIER_EXACT_INPUT_CDP_TRACE=1 uses official Chromium tracing only.
const enabled = process.env.FRONTIER_EXACT_INPUT_DIAGNOSTIC === '1';
const traceEnabled = process.env.FRONTIER_EXACT_INPUT_CDP_TRACE === '1';
const playwrightVersion = createRequire(import.meta.url)('@playwright/test/package.json').version as string;
const arms = ['locator-tap', 'cdp-omitted-id', 'cdp-explicit-id-1'] as const;
type Arm = typeof arms[number];
type Scenario = 'mythic-paint' | 'christmas-pan';
type Entry = Record<string, unknown>;
type Rect = { x: number; y: number; width: number; height: number };
type Snapshot = {
  observedTime: number;
  button: { node: number | null; connected: boolean; disabled: boolean; visible: boolean;
    rect: Rect | null; center: Point | null; centerHitsButton: boolean; hitNode: number | null };
  panel: { node: number | null; connected: boolean; visible: boolean; className: string | null };
  captureOwners: Entry[];
};
type EventReceipt = {
  attempt: string; type: string; trusted: boolean; action: string | null;
  pointerType?: string; node: number | null; connected: boolean;
  observations: Entry[]; final?: Entry;
} & Entry;
type Probe = {
  attempt: string | null; events: EventReceipt[]; transitions: Entry[];
  droppedEvents: number; droppedTransitions: number; pendingFinal: number;
  snapshot: () => Snapshot;
};
type ProbeWindow = Window & { __exactToolsInputProbe: Probe };
const map = (page: Page) => page.evaluate(() => structuredClone(window.__FRONTIER__.state.map));
const camera = (page: Page) => page.evaluate(() => ({ ...window.__FRONTIER__.renderer.camera }));
const errorText = (error: unknown) => error instanceof Error ? `${error.name}: ${error.message}` : String(error);

async function installProbe(page: Page) {
  await page.addInitScript(() => {
    const identities = new WeakMap<Element, number>();
    const receipts = new WeakMap<Event, EventReceipt>();
    const pointerIds = new Set<number>();
    const captureCandidates = new Set<Element>();
    let nextIdentity = 1;
    const identity = (element: Element | null) => {
      if (!element) return null;
      if (!identities.has(element)) identities.set(element, nextIdentity++);
      return identities.get(element)!;
    };
    const describe = (element: Element) => ({ node: identity(element), tag: element.tagName,
      id: element.id, action: element.closest('[data-action]')?.getAttribute('data-action') ?? null,
      connected: element.isConnected });
    // Observe ownership without wrapping setPointerCapture/releasePointerCapture.
    // Candidates include event paths, all announced capture owners, canvas and Tools.
    const captureOwners = () => {
      for (const element of document.querySelectorAll('#world, [data-action="toggle-editor-tools"]'))
        captureCandidates.add(element);
      const owners: Entry[] = [];
      for (const element of captureCandidates) for (const id of pointerIds)
        if (element.hasPointerCapture(id)) owners.push({ pointerId: id, ...describe(element) });
      return owners;
    };
    const snapshot = (): Snapshot => {
      const button = document.querySelector<HTMLButtonElement>('[data-action="toggle-editor-tools"]');
      const panel = document.querySelector<HTMLElement>('.editor-tools');
      const box = button?.getBoundingClientRect();
      const rect = box ? { x: box.x, y: box.y, width: box.width, height: box.height } : null;
      const center = rect ? { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 } : null;
      const hit = center ? document.elementFromPoint(center.x, center.y) : null;
      const visible = (element: Element | null) => !!element && element.getClientRects().length > 0 &&
        !['hidden', 'collapse'].includes(getComputedStyle(element).visibility) && getComputedStyle(element).display !== 'none';
      return {
        observedTime: performance.now(),
        button: { node: identity(button), connected: !!button?.isConnected, disabled: !!button?.disabled,
          visible: visible(button), rect, center, centerHitsButton: !!button && !!hit && button.contains(hit), hitNode: identity(hit) },
        panel: { node: identity(panel), connected: !!panel?.isConnected, visible: visible(panel), className: panel?.className ?? null },
        captureOwners: captureOwners(),
      };
    };
    const probe: Probe = { attempt: null, events: [], transitions: [], droppedEvents: 0,
      droppedTransitions: 0, pendingFinal: 0, snapshot };
    (window as unknown as ProbeWindow).__exactToolsInputProbe = probe;
    const touchPoints = (list?: TouchList) => list && Array.from(list, point => ({
      id: point.identifier, x: point.clientX, y: point.clientY,
      target: identity(point.target instanceof Element ? point.target : null),
    }));
    const types = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel',
      'gotpointercapture', 'lostpointercapture', 'touchstart', 'touchmove', 'touchend', 'touchcancel',
      'mousedown', 'mousemove', 'mouseup', 'click', 'dblclick', 'contextmenu'];
    for (const type of types) for (const scope of ['window', 'document'] as const) for (const capture of [true, false]) {
      const target = scope === 'window' ? window : document;
      target.addEventListener(type, event => {
        if (!probe.attempt) return;
        const element = event.target instanceof Element ? event.target : null;
        const pointer = event as PointerEvent;
        if (typeof pointer.pointerId === 'number') pointerIds.add(pointer.pointerId);
        for (const node of event.composedPath()) if (node instanceof Element) captureCandidates.add(node);
        let receipt = receipts.get(event);
        if (!receipt) {
          if (probe.events.length >= 256) { probe.droppedEvents++; return; }
          const touch = event as TouchEvent;
          receipt = { attempt: probe.attempt, type, eventTime: event.timeStamp,
            observedTime: performance.now(), trusted: event.isTrusted, cancelable: event.cancelable,
            node: identity(element), target: element?.id || element?.tagName,
            action: element?.closest('[data-action]')?.getAttribute('data-action') ?? null,
            connected: !!element?.isConnected, x: pointer.clientX, y: pointer.clientY,
            pointerId: pointer.pointerId, pointerType: pointer.pointerType, buttons: pointer.buttons,
            detail: pointer.detail, touches: touchPoints(touch.touches), changedTouches: touchPoints(touch.changedTouches),
            snapshot: snapshot(), observations: [] };
          receipts.set(event, receipt);
          probe.events.push(receipt);
          const finalReceipt = receipt;
          probe.pendingFinal++;
          // A microtask can run between native listener callbacks. A task observes
          // defaultPrevented after dispatch, even when propagation was stopped.
          // This schedules observation only; it never schedules/repairs input.
          setTimeout(() => {
            finalReceipt.final = { observedTime: performance.now(), defaultPrevented: event.defaultPrevented,
              connected: !!element?.isConnected, panelClass: document.querySelector('.editor-tools')?.className ?? null,
              captureOwners: captureOwners() };
            probe.pendingFinal--;
          }, 0);
        }
        receipt.observations.push({ scope, phase: capture ? 'capture' : 'bubble', eventPhase: event.eventPhase,
          observedTime: performance.now(), defaultPrevented: event.defaultPrevented,
          captureOwners: captureOwners(), panelClass: document.querySelector('.editor-tools')?.className ?? null });
      }, { capture, passive: true });
    }
    new MutationObserver(records => {
      if (!probe.attempt) return;
      const changes = records.filter(record => record.target instanceof Element && record.target.matches('.editor-tools'));
      for (let i = 0; i < changes.length; i++) {
        if (probe.transitions.length >= 32) { probe.droppedTransitions++; continue; }
        const record = changes[i], element = record.target as Element;
        const next = changes.slice(i + 1).find(other => other.target === element);
        probe.transitions.push({ attempt: probe.attempt, observedTime: performance.now(), node: identity(element),
          connected: element.isConnected, oldClass: record.oldValue, newClass: next ? next.oldValue : element.className });
      }
    }).observe(document, { subtree: true, attributes: true, attributeFilter: ['class'], attributeOldValue: true });
  });
}

async function markAttempt(page: Page, attempt: string) {
  return page.evaluate(attempt => {
    const probe = (window as unknown as ProbeWindow).__exactToolsInputProbe;
    probe.attempt = attempt;
    return probe.snapshot();
  }, attempt);
}

async function collect(page: Page) {
  return page.evaluate(async () => {
    // Flush post-dispatch observations, after the sole measured contact.
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    const probe = (window as unknown as ProbeWindow).__exactToolsInputProbe;
    return { events: probe.events, transitions: probe.transitions, droppedEvents: probe.droppedEvents,
      droppedTransitions: probe.droppedTransitions, pendingFinal: probe.pendingFinal, after: probe.snapshot() };
  });
}

/** Read-only readiness: trial taps in installed Playwright 1.63 STILL inject a
 * native contact, blocked by its hit-target interceptor. Never use trial here. */
async function rawReadiness(page: Page) {
  await expect(action(page, 'toggle-editor-tools')).toBeVisible();
  await expect(action(page, 'toggle-editor-tools')).toBeEnabled();
  const samples = await page.evaluate(async () => {
    const probe = (window as unknown as ProbeWindow).__exactToolsInputProbe;
    const samples: Snapshot[] = [];
    for (let i = 0; i < 2; i++) {
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      samples.push(probe.snapshot());
    }
    return samples;
  });
  expect(samples[1].button.node, 'Same Tools node across readiness frames').toBe(samples[0].button.node);
  expect(samples[1].button.rect, 'Stable Tools bounds across readiness frames').toEqual(samples[0].button.rect);
  expect(samples[1].button).toMatchObject({ connected: true, visible: true, disabled: false, centerHitsButton: true });
  expect(samples[1].button.center).not.toBeNull();
  // Match coreBundle.js roundPoint (two decimals), for this unobscured rectangle.
  const center = samples[1].button.center!;
  return { samples, point: { x: Math.trunc(center.x * 100) / 100, y: Math.trunc(center.y * 100) / 100 } };
}

/** Same four clear projected tile centers as editor-name-retention.spec.ts. */
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

async function beginTrace(context: BrowserContext, page: Page) {
  const receipt: Entry = { requested: traceEnabled, bufferKiB: 1024, eventLimit: 1200, byteLimit: 384 * 1024,
    categories: ['input', 'latencyInfo', 'disabled-by-default-input'],
    received: 0, retained: 0, omittedByFilter: 0, clipped: 0, dataLossOccurred: null, errors: [] };
  const events: Entry[] = [];
  let session: CDPSession | undefined, started = false, retainedBytes = 0;
  let completed: Promise<void> | undefined;
  const errors = receipt.errors as string[];
  if (traceEnabled) {
    try {
      session = await context.newCDPSession(page);
      session.on('Tracing.dataCollected', ({ value }: { value: Entry[] }) => {
        for (const event of value) {
          receipt.received = Number(receipt.received) + 1;
          if (!/input|latency|gesture|touch|pointer|mouse|click/i.test(`${event.cat} ${event.name}`)) {
            receipt.omittedByFilter = Number(receipt.omittedByFilter) + 1;
            continue;
          }
          const bytes = Buffer.byteLength(JSON.stringify(event));
          if (events.length >= 1200 || retainedBytes + bytes > 384 * 1024) {
            receipt.clipped = Number(receipt.clipped) + 1;
            continue;
          }
          events.push(event);
          retainedBytes += bytes;
        }
      });
      completed = new Promise(resolve => session!.once('Tracing.tracingComplete', event => {
        receipt.dataLossOccurred = event.dataLossOccurred;
        receipt.completedEpochMs = Date.now();
        resolve();
      }));
      await session.send('Tracing.start', { transferMode: 'ReportEvents', traceConfig: {
        recordMode: 'recordUntilFull', traceBufferSizeInKb: 1024,
        includedCategories: receipt.categories as string[], excludedCategories: ['*'],
      } });
      started = true;
      receipt.startedEpochMs = Date.now();
    } catch (error) { errors.push(errorText(error)); }
  }
  return {
    receipt,
    async stop() {
      if (session && started) {
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          await Promise.race([
            (async () => { await session!.send('Tracing.end'); await completed; })(),
            new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Trace flush exceeded 5 seconds')), 5000); }),
          ]);
        } catch (error) { errors.push(errorText(error)); }
        finally { clearTimeout(timer); }
      }
      if (session) await session.detach().catch(error => errors.push(errorText(error)));
      receipt.retained = events.length;
      receipt.retainedBytes = retainedBytes;
      receipt.hasInputEvidence = events.length > 0;
      receipt.completeWithinSelectedCategories = started && events.length > 0 &&
        receipt.dataLossOccurred === false && receipt.clipped === 0 && !errors.length;
      return { receipt, traceEvents: events };
    },
  };
}

function checkActivation(evidence: Awaited<ReturnType<typeof collect>>, attempt: string, before: Snapshot, visible: boolean) {
  const events = evidence.events.filter(event => event.attempt === attempt && event.action === 'toggle-editor-tools');
  const downs = events.filter(event => event.type === 'pointerdown');
  const ups = events.filter(event => event.type === 'pointerup');
  const clicks = events.filter(event => event.type === 'click');
  expect(downs, `${attempt}: exactly one Tools contact`).toHaveLength(1);
  expect(ups, `${attempt}: exactly one completed Tools contact`).toHaveLength(1);
  expect(events.filter(event => event.type === 'pointercancel'), `${attempt}: no canceled Tools contact`).toHaveLength(0);
  expect(clicks, `${attempt}: exactly one browser-generated activation`).toHaveLength(1);
  expect(clicks[0]).toMatchObject({ trusted: true, connected: true, pointerType: 'touch' });
  const transitions = evidence.transitions.filter(change => change.attempt === attempt && change.oldClass !== change.newClass);
  expect(transitions, `${attempt}: exactly one panel class transition`).toHaveLength(1);
  expect(transitions[0].node, `${attempt}: same panel`).toBe(before.panel.node);
  expect(evidence.after.panel.node, `${attempt}: same final panel`).toBe(before.panel.node);
  expect(evidence.after.button.node, `${attempt}: stable Tools node`).toBe(before.button.node);
  expect(evidence.after.button.connected).toBe(true);
  expect(evidence.after.panel.visible).toBe(visible);
  expect(evidence.droppedEvents).toBe(0);
  expect(evidence.droppedTransitions).toBe(0);
  expect(evidence.pendingFinal).toBe(0);
  expect(evidence.events.every(event => !!event.final), 'Every event has a post-dispatch observation').toBe(true);
}

async function runScenario(browser: Browser, info: TestInfo, scenario: Scenario, arm: Arm) {
  const context = await browser.newContext({
    ...devices['Pixel 7'], viewport: info.project.use.viewport, baseURL: info.project.use.baseURL,
  });
  const page = await context.newPage();
  const runtimeErrors: string[] = [];
  page.on('pageerror', error => runtimeErrors.push(errorText(error)));
  const commands: Entry[] = [];
  const checks: string[] = [];
  const attempts: Entry[] = [];
  const failures: string[] = [];
  const sessions = new Set<CDPSession>();
  let provenance: Entry = { browserVersion: browser.version(), playwrightVersion, workers: info.config.workers };
  let tracing: Awaited<ReturnType<typeof beginTrace>> | undefined;
  let traceResult: Awaited<ReturnType<Awaited<ReturnType<typeof beginTrace>>['stop']>> | undefined;
  const timed = async <T>(name: string, operation: () => Promise<T>, details: Entry = {}): Promise<T> => {
    const receipt: Entry = { name, ...details, sentEpochMs: Date.now(), sentMonotonicMs: performance.now() };
    commands.push(receipt);
    try { return await operation(); }
    catch (error) { receipt.error = errorText(error); throw error; }
    finally { receipt.ackEpochMs = Date.now(); receipt.ackMonotonicMs = performance.now(); }
  };
  const attach = async (label: string) => {
    const session = await timed(`${label}:attach`, () => context.newCDPSession(page));
    sessions.add(session);
    return session;
  };
  const detach = async (session: CDPSession, label: string) => {
    await timed(`${label}:detach`, () => session.detach());
    sessions.delete(session);
  };
  const send = (session: CDPSession, label: string, type: 'touchStart' | 'touchMove' | 'touchEnd', points: (Point & { id?: number })[], modifiers?: number) => {
    // Omitted timestamp is deliberate in EVERY arm, including the canvas drag.
    const payload = { type, touchPoints: points, ...(modifiers === undefined ? {} : { modifiers }) };
    return timed(`${label}:${type}`, () => session.send('Input.dispatchTouchEvent', payload), { payload });
  };
  try {
    await installProbe(page);
    await home(page);
    provenance = { ...provenance, ...await page.evaluate(() => ({ userAgent: navigator.userAgent,
      maxTouchPoints: navigator.maxTouchPoints, devicePixelRatio, viewportScale: visualViewport?.scale,
      browserTimeOrigin: performance.timeOrigin })) };
    await action(page, 'settings').tap();
    const theme = scenario === 'mythic-paint' ? 'mythic' : 'christmas';
    await page.getByLabel('Visual theme', { exact: true }).selectOption(theme);
    await expect.poll(() => page.evaluate(() =>
      (window.__FRONTIER__.renderer as unknown as { visualTheme: string }).visualTheme)).toBe(theme);
    await page.getByRole('button', { name: 'Done', exact: true }).tap();
    await action(page, 'editor').tap();
    await action(page, 'new-editor').tap();
    await expect(page.locator('.editor-header')).toBeVisible();
    await expect(action(page, 'editor-undo')).toBeDisabled();
    const original = await map(page);
    if (scenario === 'mythic-paint') {
      await action(page, 'brush-snow').tap();
      await page.locator('#brush-size').selectOption('1');
    } else await action(page, 'editor-pan').tap();
    const beforeHide = await markAttempt(page, 'setup-hide');
    await action(page, 'toggle-editor-tools').tap();
    await expect(page.locator('.editor-tools')).toBeHidden();
    const hidden = await collect(page);
    attempts.push({ name: 'setup-hide', before: beforeHide, after: hidden.after });
    checkActivation(hidden, 'setup-hide', beforeHide, false);

    const stroke = await visibleStroke(page);
    const beforeCamera = await camera(page);
    const beforeShow = await markAttempt(page, 'post-drag-show');
    attempts.push({ name: 'post-drag-show', before: beforeShow, stroke });
    tracing = await beginTrace(context, page);
    const dragSession = await attach('drag');
    try {
      // Exact original untimed four-point drag: sequential sends, id:1, no timestamps.
      await send(dragSession, 'drag', 'touchStart', [{ ...stroke.points[0], id: 1 }]);
      for (const point of stroke.points.slice(1)) await send(dragSession, 'drag', 'touchMove', [{ ...point, id: 1 }]);
      await send(dragSession, 'drag', 'touchEnd', []);
    } finally { await detach(dragSession, 'drag'); }

    // Preserve the original read/assert order between drag and the Tools contact.
    if (scenario === 'christmas-pan') expect(await camera(page)).not.toEqual(beforeCamera);
    const afterDrag = await map(page);
    if (scenario === 'mythic-paint') {
      for (const index of stroke.indices) expect(afterDrag.tiles[index]).toBe('snow');
      expect(afterDrag.tiles).not.toEqual(original.tiles);
      checks.push('Original four-tile snow stroke painted.');
    } else {
      expect(afterDrag).toEqual(original);
      checks.push('Pan changed the camera and left the map unchanged.');
    }
    const panelVisibleBeforeTap = await page.locator('.editor-tools').isVisible();
    expect(panelVisibleBeforeTap, 'Original toolsVisible precondition').toBe(false);
    if (arm === 'locator-tap') {
      // Literal original locator call. Its internal protocol session is intentionally
      // untouched; timing below encloses the public action, not private wire sends.
      await timed('locator.tap', () => action(page, 'toggle-editor-tools').tap());
    } else {
      const readiness = await timed('raw-readiness', () => rawReadiness(page));
      attempts.push({ name: 'raw-readiness', ...readiness });
      const tapSession = await attach('tap');
      try {
        const point = arm === 'cdp-explicit-id-1' ? { ...readiness.point, id: 1 } : readiness.point;
        // coreBundle.js RawTouchscreenImpl.tap sends these concurrently. Both
        // raw arms use modifiers:0 and omit timestamps; only the point ID differs.
        await Promise.all([
          send(tapSession, 'tap', 'touchStart', [point], 0),
          send(tapSession, 'tap', 'touchEnd', [], 0),
        ]);
      } finally { await detach(tapSession, 'tap'); }
    }
    try { await expect(page.locator('.editor-tools'), 'Tools must open after one native contact').toBeVisible({ timeout: 8_000 }); }
    catch (error) { failures.push(errorText(error)); }
    // Two post-action frames observe transitions without a timed gap or another tap.
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    traceResult = await tracing.stop();
    tracing = undefined;
    const evidence = await collect(page);
    try { checkActivation(evidence, 'post-drag-show', beforeShow, true); }
    catch (error) { failures.push(errorText(error)); }
    expect(await map(page), 'Opening Tools must not alter the post-drag map').toEqual(afterDrag);
    expect(runtimeErrors).toEqual([]);
    if (!failures.length) checks.push('One trusted Tools click and one panel transition, with no replacement contact.');
  } catch (error) { failures.push(errorText(error)); }
  finally {
    if (tracing) traceResult = await tracing.stop();
    for (const session of sessions) await session.detach().catch(error => failures.push(errorText(error)));
    const evidence = await collect(page).catch(error => { failures.push(errorText(error)); return null; });
    if (failures.length) {
      try {
        await page.screenshot({ path: info.outputPath(`${scenario}-${arm}-failed-viewport.png`) });
      } catch (error) { failures.push(`Screenshot: ${errorText(error)}`); }
    }
    if (traceResult && traceEnabled) await info.attach(`${scenario}-${arm}-input-trace.json.gz`, {
      body: gzipSync(JSON.stringify(traceResult)), contentType: 'application/gzip',
    });
    await info.attach(`${scenario}-${arm}-exact-input.json`, {
      body: JSON.stringify({ scenario, arm, project: info.project.name, viewport: page.viewportSize(), provenance,
        limitations: [
          'Locator uses Playwright’s existing private session, native actionability and hit-target interceptor; raw arms use a new public CDP session and read-only readiness. This comparison cannot isolate session and interceptor effects.',
          'No protocol timestamps or planned input gaps. Public locator action timing is not a private protocol send/ack measurement.',
          'Passive diagnostics and optional tracing can affect wall-clock timing. Event final observations run after dispatch; capture ownership covers observed paths/owners, canvas and Tools.',
          'Node identity/connectivity is sampled at event and receipt observations. There is no child-list detachment timeline, so transient disconnection between observations is unknown.',
          'Trace is limited to selected categories around drag, contact and visibility observation; loss and clipping are explicit. Duplicate observation includes two post-action frames and receipt collection, not an indefinite late-event check.',
          'This one-worker gate differs from the original two-worker load. Passing all samples cannot exclude the original failure or establish a production fix.',
        ], commands, attempts, checks, failures, runtimeErrors, evidence, trace: traceResult?.receipt ?? { requested: traceEnabled, started: false } }),
      contentType: 'application/json',
    });
    await context.close();
  }
  return { scenario, arm, errors: failures };
}

test.use({ video: 'off', trace: 'off' });
test.describe('exact native Tools input diagnostic', () => {
  test.describe.configure({ retries: 0 });
  for (const arm of arms) test(`${arm} after original untimed drag`, async ({ browser, isMobile }, info) => {
    test.skip(!enabled || !isMobile || !['phone-portrait', 'phone-landscape'].includes(info.project.name),
      'Opt-in diagnostic on the two phone projects only.');
    test.setTimeout(90_000);
    if (traceEnabled) expect(info.config.workers, 'CDP tracing is browser-global: run one worker').toBe(1);
    info.annotations.push({ type: 'read-only-game-inspection', description:
      'Fresh local contexts; original native drag plus exactly one Tools contact. Game API reads only; no production handlers, trial contacts, fallback taps or fixed input waits.' });
    const results = [];
    for (const scenario of ['mythic-paint', 'christmas-pan'] as const)
      results.push(await runScenario(browser, info, scenario, arm));
    expect(results.filter(result => result.errors.length), JSON.stringify(results, null, 2)).toEqual([]);
  });
});
