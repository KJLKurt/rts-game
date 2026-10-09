import { createRequire } from 'node:module';
import { gzipSync } from 'node:zlib';
import { devices, test, expect, type Browser, type CDPSession, type Page, type TestInfo } from '@playwright/test';

// Opt-in plain-page mechanism experiment. No app imports, state, or handler edits.
// FRONTIER_FLING_FIXTURE=1, the two phone projects, one worker, zero retries.
const enabled = process.env.FRONTIER_FLING_FIXTURE === '1';
const playwrightVersion = createRequire(import.meta.url)('@playwright/test/package.json').version as string;
const arms = ['css-only', 'cancel-canvas-touchmove'] as const;
type Arm = typeof arms[number];
type Entry = Record<string, unknown>;
type Point = { x: number; y: number };
type Fixture = {
  starts: number; moves: number; ends: number; cancels: number; paintPoints: Point[];
  clicks: { trusted: boolean; time: number }[]; transitions: number; preventedMoves: number;
  events: Entry[]; droppedEvents: number; pendingFinal: number;
};
type FixtureWindow = Window & { __flingFixture: Fixture };
const errorText = (error: unknown) => error instanceof Error ? `${error.name}: ${error.message}` : String(error);

// Source: exact-input gate 37903885976, portrait/mythic/locator control.
// Original command offsets were 0, 32, 72, 104, 157 ms; locator invocation
// was 268 ms, actual button contact 314 ms (157 ms after drag touchEnd).
// Replaying the invocation cannot prescribe locator.tap's actionability duration.
const cadence = { dragMs: [0, 32, 72, 104, 157], locatorCallMs: 268, observationMs: 400 };

async function installFixture(page: Page, arm: Arm, landscape: boolean) {
  const button = landscape ? { x: 458.984375, y: 12.5, width: 102.421875 } : { x: 138.96875, y: 8, width: 68.109375 };
  await page.setContent(`<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1">
    <style>html,body{margin:0;width:100%;height:100%;overflow:hidden}canvas{position:fixed;inset:0;width:100%;height:100%;touch-action:none;background:#edf2f5}
    button{position:fixed;left:${button.x}px;top:${button.y}px;width:${button.width}px;height:44px;z-index:1}
    aside{position:fixed;top:65px;left:8px;background:white;padding:8px}</style>
    <canvas id="world"></canvas><button id="tools" type="button">Tools</button><aside id="panel" hidden>Tools panel</aside>`);
  return page.evaluate(arm => {
    const canvas = document.querySelector<HTMLCanvasElement>('#world')!;
    const button = document.querySelector<HTMLButtonElement>('#tools')!;
    const panel = document.querySelector<HTMLElement>('#panel')!;
    canvas.width = innerWidth; canvas.height = innerHeight;
    const paint = canvas.getContext('2d')!;
    paint.strokeStyle = '#28637a'; paint.lineWidth = 4;
    const fixture: Fixture = { starts: 0, moves: 0, ends: 0, cancels: 0, paintPoints: [],
      clicks: [], transitions: 0, preventedMoves: 0, events: [], droppedEvents: 0, pendingFinal: 0 };
    (window as unknown as FixtureWindow).__flingFixture = fixture;
    let activePointer: number | null = null;
    for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'gotpointercapture',
      'lostpointercapture', 'touchstart', 'touchmove', 'touchend', 'touchcancel', 'mousedown', 'mouseup', 'click']) {
      window.addEventListener(type, event => {
        if (fixture.events.length >= 128) { fixture.droppedEvents++; return; }
        const pointer = event as PointerEvent, touch = event as TouchEvent;
        const target = event.target instanceof Element ? event.target : null;
        const points = (list?: TouchList) => list && Array.from(list, point => ({ id: point.identifier, x: point.clientX, y: point.clientY }));
        const receipt: Entry = { type, target: target?.id, time: performance.now(), eventTime: event.timeStamp,
          trusted: event.isTrusted, cancelable: event.cancelable, defaultPrevented: event.defaultPrevented,
          pointerId: pointer.pointerId, pointerType: pointer.pointerType, x: pointer.clientX, y: pointer.clientY,
          capturedByCanvas: typeof pointer.pointerId === 'number' && canvas.hasPointerCapture(pointer.pointerId),
          touches: points(touch.touches), changedTouches: points(touch.changedTouches) };
        fixture.events.push(receipt);
        fixture.pendingFinal++;
        // Task observation sees prevention after all event listeners have run.
        setTimeout(() => { receipt.finalDefaultPrevented = event.defaultPrevented; fixture.pendingFinal--; }, 0);
      }, { capture: true, passive: true });
    }
    canvas.addEventListener('pointerdown', event => {
      activePointer = event.pointerId;
      canvas.setPointerCapture(event.pointerId);
      fixture.starts++;
      fixture.paintPoints.push({ x: event.clientX, y: event.clientY });
      paint.beginPath(); paint.moveTo(event.clientX, event.clientY);
    });
    canvas.addEventListener('pointermove', event => {
      if (event.pointerId !== activePointer) return;
      fixture.moves++;
      fixture.paintPoints.push({ x: event.clientX, y: event.clientY });
      paint.lineTo(event.clientX, event.clientY); paint.stroke();
    });
    canvas.addEventListener('pointerup', event => { if (event.pointerId === activePointer) { fixture.ends++; activePointer = null; } });
    canvas.addEventListener('pointercancel', () => { fixture.cancels++; activePointer = null; });
    // This listener is the ONLY behavioral difference between fixture arms.
    if (arm === 'cancel-canvas-touchmove') canvas.addEventListener('touchmove', event => {
      if (event.cancelable) { event.preventDefault(); fixture.preventedMoves++; }
    }, { passive: false });
    button.addEventListener('click', event => {
      fixture.clicks.push({ trusted: event.isTrusted, time: performance.now() });
      panel.hidden = !panel.hidden;
      fixture.transitions++;
    });
    return { userAgent: navigator.userAgent, browserTimeOrigin: performance.timeOrigin,
      maxTouchPoints: navigator.maxTouchPoints, viewport: { width: innerWidth, height: innerHeight },
      canvasTouchAction: getComputedStyle(canvas).touchAction,
      button: button.getBoundingClientRect().toJSON(), canvas: canvas.getBoundingClientRect().toJSON() };
  }, arm);
}

async function startTrace(session: CDPSession) {
  const events: Entry[] = [], errors: string[] = [];
  const receipt = { bufferKiB: 1024, eventLimit: 1200, byteLimit: 384 * 1024,
    received: 0, retainedBytes: 0, clipped: 0, omitted: 0, dataLossOccurred: null as boolean | null,
    started: false, errors, complete: false };
  session.on('Tracing.dataCollected', ({ value }: { value: Entry[] }) => {
    for (const event of value) {
      receipt.received++;
      if (!/input|latency|gesture|touch|pointer|mouse|click/i.test(`${event.cat} ${event.name}`)) { receipt.omitted++; continue; }
      const bytes = Buffer.byteLength(JSON.stringify(event));
      if (events.length >= receipt.eventLimit || receipt.retainedBytes + bytes > receipt.byteLimit) { receipt.clipped++; continue; }
      events.push(event); receipt.retainedBytes += bytes;
    }
  });
  const complete = new Promise<void>(resolve => session.once('Tracing.tracingComplete', event => {
    receipt.dataLossOccurred = event.dataLossOccurred; resolve();
  }));
  try {
    await session.send('Tracing.start', { transferMode: 'ReportEvents', traceConfig: {
      recordMode: 'recordUntilFull', traceBufferSizeInKb: receipt.bufferKiB,
      includedCategories: ['input', 'latencyInfo', 'disabled-by-default-input'], excludedCategories: ['*'],
    } });
    receipt.started = true;
  } catch (error) { errors.push(errorText(error)); }
  return async () => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (receipt.started) try {
      await Promise.race([
        (async () => { await session.send('Tracing.end'); await complete; })(),
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Trace flush exceeded 5 seconds')), 5000); }),
      ]);
    } catch (error) { errors.push(errorText(error)); }
    finally { clearTimeout(timer); }
    receipt.complete = receipt.started && events.length > 0 && receipt.dataLossOccurred === false && !receipt.clipped && !errors.length;
    return { receipt, traceEvents: events };
  };
}

async function sample(browser: Browser, info: TestInfo, arm: Arm) {
  const context = await browser.newContext({ ...devices['Pixel 7'], viewport: info.project.use.viewport });
  const page = await context.newPage();
  const errors: string[] = [], runtimeErrors: string[] = [], commands: Entry[] = [];
  page.on('pageerror', error => runtimeErrors.push(errorText(error)));
  let evidence: Fixture | null = null, provenance: Entry = {};
  let stopTrace: Awaited<ReturnType<typeof startTrace>> | undefined;
  let trace: Awaited<ReturnType<Awaited<ReturnType<typeof startTrace>>>> | undefined;
  let observer: CDPSession | undefined, drag: CDPSession | undefined;
  const landscape = info.project.name === 'phone-landscape';
  const points = landscape
    ? [{ x: 395, y: 168 }, { x: 422, y: 181.5 }, { x: 449, y: 195 }, { x: 476, y: 208.5 }]
    : [{ x: 175.2, y: 402.2 }, { x: 195, y: 412.1 }, { x: 214.8, y: 422 }, { x: 234.6, y: 431.9 }];
  let start = 0;
  const timed = async (name: string, operation: () => Promise<unknown>, details: Entry = {}) => {
    const command: Entry = { name, ...details, sentEpochMs: Date.now(), offsetMs: performance.now() - start };
    commands.push(command);
    try { await operation(); } catch (error) { command.error = errorText(error); throw error; }
    finally { command.ackOffsetMs = performance.now() - start; }
  };
  const at = async (offsetMs: number) => {
    const remaining = start + offsetMs - performance.now();
    if (remaining > 0) await new Promise(resolve => setTimeout(resolve, remaining));
  };
  try {
    provenance = { ...await installFixture(page, arm, landscape), browserVersion: browser.version(), playwrightVersion,
      workers: info.config.workers, sourceGate: '37903885976', sourceSample: 'phone-portrait-mythic-paint-locator-tap' };
    await expect(page.getByRole('button', { name: 'Tools', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tools', exact: true })).toBeEnabled();
    observer = await context.newCDPSession(page);
    stopTrace = await startTrace(observer);
    drag = await context.newCDPSession(page);
    start = performance.now();
    for (let i = 0; i < cadence.dragMs.length; i++) {
      await at(cadence.dragMs[i]);
      const payload = { type: i === 0 ? 'touchStart' as const : i === 4 ? 'touchEnd' as const : 'touchMove' as const,
        touchPoints: i === 4 ? [] : [{ ...points[i], id: 1 }] };
      await timed(payload.type, () => drag!.send('Input.dispatchTouchEvent', payload), { plannedMs: cadence.dragMs[i], payload });
    }
    await timed('drag:detach', () => drag!.detach());
    drag = undefined;
    await at(cadence.locatorCallMs);
    // Exactly one literal native action. No trial, raw replacement, or fallback.
    await timed('locator.tap', () => page.getByRole('button', { name: 'Tools', exact: true }).tap(), { plannedMs: cadence.locatorCallMs });
    // Identical post-input observation window catches delayed clicks; it cannot
    // alter the cadence or repair the measured contact that already happened.
    await page.waitForTimeout(cadence.observationMs);
  } catch (error) { errors.push(errorText(error)); }
  finally {
    if (stopTrace) trace = await stopTrace();
    if (drag) await drag.detach().catch(error => errors.push(errorText(error)));
    if (observer) await observer.detach().catch(error => errors.push(errorText(error)));
    evidence = await page.evaluate(async () => {
      await new Promise<void>(resolve => setTimeout(resolve, 0));
      return (window as unknown as FixtureWindow).__flingFixture;
    }).catch(error => { errors.push(errorText(error)); return null; });
    await context.close();
  }
  const names = trace?.traceEvents ?? [];
  const markers = {
    flingStarts: names.filter(event => event.name === 'FlingController::HandlingGestureFling' && event.ph === 'b').length,
    tapSuppression: names.filter(event => event.name === 'FilterTapSuppression').length,
    touchActionFiltered: names.filter(event => event.name === 'FilteredForTouchAction').length,
  };
  const events = evidence?.events ?? [];
  const dragEnd = events.find(event => event.type === 'touchend' && event.target === 'world');
  const buttonDown = events.find(event => event.type === 'pointerdown' && event.target === 'tools');
  const timing = { cadence, actualDragEndToButtonContactMs: dragEnd && buttonDown ? Number(buttonDown.eventTime) - Number(dragEnd.eventTime) : null };
  const result = { arm, errors, runtimeErrors, evidence, trace: trace?.receipt ?? null, markers, timing };
  await info.attach(`${arm}-fling-fixture.json`, { body: JSON.stringify({ ...result, provenance, commands, points,
    limits: ['Plain fixture only; a passing candidate does not authorize a game handler change or establish game regression safety.',
      'Fixed cadence replays recorded original command timing; actual CDP acknowledgments and locator contact timing may differ.',
      'Baseline reproduction and complete nonempty traces are required. Missing markers or activation loss without those markers is inconclusive.',
      'One sample per arm/orientation; finite post-input observation, selected trace categories and explicit truncation bounds.'] }), contentType: 'application/json' });
  if (trace) await info.attach(`${arm}-fling-trace.json.gz`, { body: gzipSync(JSON.stringify(trace)), contentType: 'application/gzip' });
  return result;
}

test.use({ video: 'off', trace: 'off', screenshot: 'off' });
test.describe('plain canvas fling discriminator', () => {
  test.describe.configure({ retries: 0 });
  test('CSS-only baseline versus canceled canvas touchmove', async ({ browser, isMobile }, info) => {
    test.skip(!enabled || !isMobile || !['phone-portrait', 'phone-landscape'].includes(info.project.name), 'Opt-in two-phone fixture only.');
    test.setTimeout(60_000);
    expect(info.config.workers, 'Browser-global tracing requires one worker').toBe(1);
    const results = [];
    for (const arm of arms) results.push(await sample(browser, info, arm));
    const [baseline, candidate] = results;
    for (const result of results) {
      expect(result.errors, `${result.arm}: fixture execution`).toEqual([]);
      expect(result.runtimeErrors).toEqual([]);
      expect(result.trace?.complete, `${result.arm}: INCONCLUSIVE without a complete nonempty trace`).toBe(true);
      expect(result.evidence).toMatchObject({ starts: 1, moves: 3, ends: 1, cancels: 0, droppedEvents: 0, pendingFinal: 0 });
      expect(result.evidence!.paintPoints).toHaveLength(4);
      const contacts = result.evidence!.events.filter(event => event.type === 'pointerdown' && event.target === 'tools');
      expect(contacts, `${result.arm}: exactly one Tools contact`).toHaveLength(1);
      expect(contacts[0].trusted).toBe(true);
      expect(result.evidence!.events.filter(event => event.type === 'pointerup' && event.target === 'tools')).toHaveLength(1);
      expect(result.evidence!.events.filter(event => event.type === 'gotpointercapture' && event.target === 'world')).toHaveLength(1);
      expect(result.evidence!.events.filter(event => event.type === 'lostpointercapture' && event.target === 'world')).toHaveLength(1);
    }
    expect(baseline.markers.flingStarts, 'INCONCLUSIVE: CSS-only baseline must reproduce the recorded browser fling').toBeGreaterThan(0);
    expect(baseline.markers.touchActionFiltered, 'INCONCLUSIVE: baseline must retain touch-action filtering').toBeGreaterThan(0);
    expect(baseline.markers.tapSuppression, 'INCONCLUSIVE: baseline must reproduce browser tap suppression').toBeGreaterThan(0);
    expect(baseline.evidence!.clicks, 'INCONCLUSIVE: baseline must reproduce missing Tools activation').toHaveLength(0);
    expect(baseline.evidence!.transitions).toBe(0);
    expect(baseline.evidence!.preventedMoves).toBe(0);
    expect(baseline.evidence!.events.every(event => event.finalDefaultPrevented === false), 'Baseline has no DOM default prevention').toBe(true);
    expect(candidate.evidence!.preventedMoves, 'Candidate handler must actually prevent cancelable canvas movement').toBeGreaterThan(0);
    expect(candidate.markers.flingStarts, 'Candidate must prevent the browser fling').toBe(0);
    expect(candidate.markers.tapSuppression, 'Candidate must avoid browser tap suppression').toBe(0);
    expect(candidate.evidence!.clicks).toEqual([{ trusted: true, time: expect.any(Number) }]);
    expect(candidate.evidence!.transitions).toBe(1);
  });
});
