import type { Locator, Page } from '@playwright/test';
import { BUILDINGS, canBuild, findPath, getUnitCost, spawnEntity } from '../../src/sim';
import type { BuildingId, Entity, GameCommand, GameState, Point, UnitId } from '../../src/sim/types';
import { action, expect, home, test } from './helpers';

// Three independent identities per ordinary desktop/phone project. The single
// annotated setup boundary adds legal completed Range/House fixtures, positions
// a commander via canonical spawn clearance on a COPY, disables AI and installs
// 0/59/60 Hold orders. It is not earned construction or a natural-play claim.
// After that boundary: native input only; snapshots/geometry/trace are read-only.
// No command/start/save bridge, force clicks, DOM-value writes, clock stepping,
// or simulation mutation is used for the measured behavior or continuation.
test.describe.configure({ retries: 0 });
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const trace: unknown[] = [];
    (window as Window & { __massRallyInputTrace?: unknown[] }).__massRallyInputTrace = trace;
    for (const type of ['pointerdown', 'pointerup', 'pointercancel', 'click']) document.addEventListener(type, event => {
      const pointer = event as PointerEvent, node = event.target instanceof Element ? event.target : null;
      const app = window.__FRONTIER__;
      trace.push({ type, trusted: event.isTrusted, pointerType: pointer.pointerType, x: pointer.clientX, y: pointer.clientY,
        action: node?.closest('[data-action]')?.getAttribute('data-action'), target: node?.id || node?.tagName,
        at: performance.now(), gameTime: app?.state?.time, camera: app?.renderer ? { ...app.renderer.camera } : null });
      if (trace.length > 256) trace.shift();
    }, { passive: true, capture: true });
  });
});
const snapshot = (page: Page): Promise<GameState> => page.evaluate(() => structuredClone(window.__FRONTIER__.state));
const producers = (state: GameState) => state.entities.filter(e => e.team === 0 && e.kind === 'building' && e.hp > 0 && e.buildProgress >= 1 && BUILDINGS[e.type as BuildingId]?.recruits.length);
const rallies = (state: GameState) => state.entities.filter(e => e.kind === 'building').map(e => ({ id: e.id, rally: e.rally }));
const purse = (state: GameState) => ({ gold: state.players[0].gold, wood: state.players[0].wood });
const rallyLog = (state: GameState) => state.commandLog.filter(entry => entry.command.type === 'rally');
async function press(page: Page, control: Locator) {
  await control.scrollIntoViewIfNeeded();
  if (test.info().project.use.hasTouch) await control.tap();
  else await control.click();
}
async function setPaused(page: Page, paused: boolean) {
  if ((await snapshot(page)).paused !== paused) await press(page, action(page, 'pause'));
  await expect.poll(() => page.evaluate(() => window.__FRONTIER__.state.paused)).toBe(paused);
}
async function evidence(page: Page, name: string, details: unknown, screen = true) {
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  const observed = await page.evaluate(() => {
    const geometry = ['#toast', '[data-action="rally-all"]', '[data-action="pause"]', '.command-deck', '#deck-content', '#compact-production'].flatMap(selector =>
      [...document.querySelectorAll<HTMLElement>(selector)].map(node => {
        const rect = node.getBoundingClientRect(), style = getComputedStyle(node);
        const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
        const clips = [];
        for (let parent = node.parentElement; parent; parent = parent.parentElement) {
          const css = getComputedStyle(parent), box = parent.getBoundingClientRect();
          if (/(auto|scroll|hidden|clip)/.test(css.overflowX + css.overflowY)) clips.push({ id: parent.id, className: parent.className, rect: box.toJSON(), clientWidth: parent.clientWidth, clientHeight: parent.clientHeight });
        }
        return { selector, text: node.textContent, rect: rect.toJSON(), display: style.display, visibility: style.visibility,
          centerHit: hit?.id || hit?.className || hit?.tagName, containsCenterHit: !!hit && (node.contains(hit) || hit.contains(node)), clips };
      }));
    return { state: structuredClone(window.__FRONTIER__.state), viewport: { width: innerWidth, height: innerHeight, touch: navigator.maxTouchPoints },
      camera: { ...window.__FRONTIER__.renderer.camera }, geometry,
      inputTrace: (window as Window & { __massRallyInputTrace?: unknown[] }).__massRallyInputTrace ?? [] };
  });
  await test.info().attach(`${name}-ledger`, { body: JSON.stringify({ details, ...observed }, null, 2), contentType: 'application/json' });
  if (screen) await test.info().attach(`${name}-screen`, { body: await page.screenshot({ scale: 'css' }), contentType: 'image/png' });
  return observed;
}

function legalBuilding(copy: GameState, type: 'range' | 'house') {
  const keep = copy.entities.find(e => e.team === 0 && e.type === 'keep')!;
  const candidates: Point[] = [];
  for (let y = 2; y < copy.map.height - 2; y += .5) for (let x = 2; x < copy.map.width - 2; x += .5)
    if (Math.hypot(x - keep.x, y - keep.y) < 9) candidates.push({ x, y });
  candidates.sort((a, b) => Math.hypot(a.x - keep.x, a.y - keep.y) - Math.hypot(b.x - keep.x, b.y - keep.y));
  const point = candidates.find(p => canBuild(copy, 0, type, p.x, p.y).ok);
  if (!point) throw new Error(`No canonical legal ${type} site in generated settlement.`);
  return spawnEntity(copy, 0, 'building', type, point.x, point.y);
}
function safeCommanderPoint(copy: GameState) {
  const hero = copy.entities.find(e => e.team === 0 && e.kind === 'commander')!;
  const current = producers(copy);
  for (let y = 2.5; y < copy.map.height - 2; y++) for (let x = 2.5; x < copy.map.width - 2; x++) {
    if (current.some(e => Math.hypot(e.x - x, e.y - y) < 9 || Math.hypot(e.x - x, e.y - y) > 16)) continue;
    if (copy.entities.some(e => e.team !== 0 && Math.hypot(e.x - x, e.y - y) < 13)) continue;
    if (!findPath(copy.map, hero, { x, y }).length) continue;
    // Canonical free-position rules account for terrain and building blockers.
    // This throwaway spawn is never installed into the browser state.
    const probe = spawnEntity(structuredClone(copy), 0, 'commander', hero.type, x, y);
    if (probe.x === x && probe.y === y) return { x, y };
  }
  throw new Error('No passable, reachable initial commander point away from all producers.');
}
async function initialFixture(page: Page, pending: number) {
  await home(page); await press(page, action(page, 'skirmish'));
  await page.getByLabel('Map seed', { exact: true }).fill('QA-FRONTIER-2026');
  await page.locator('select[name="mapGenerationVersion"]').selectOption('4');
  await page.locator('select[name="mapSize"]').selectOption('small');
  await page.locator('select[name="difficulty"]').selectOption('easy');
  await page.locator('select[name="mode"]').selectOption('domination');
  await page.getByLabel('Game speed · × real time', { exact: true }).fill('1');
  await press(page, action(page, 'launch'));
  await expect.poll(() => page.evaluate(() => window.__FRONTIER__.playing)).toBe(true);
  const start = page.getByRole('button', { name: 'Start battle', exact: true });
  if (await start.count()) await press(page, start);
  await setPaused(page, true);
  if (await action(page, 'dismiss-tips').isVisible()) await press(page, action(page, 'dismiss-tips'));
  const generated = await snapshot(page), copy = structuredClone(generated);
  const range = legalBuilding(copy, 'range'), house = legalBuilding(copy, 'house');
  const point = safeCommanderPoint(copy);
  const hero = generated.entities.find(e => e.team === 0 && e.kind === 'commander')!;
  const commands: GameCommand[] = Array.from({ length: pending }, () => ({ type: 'hold', team: 0, entityIds: [hero.id] }));
  await page.evaluate(({ additions, point, heroId, commands, nextId, nextEventId, events, navigationVersion }) => {
    // The only live-state mutation boundary in this test. No earned funds,
    // terrain, research, production jobs, player stats or history are injected.
    const state = window.__FRONTIER__.state;
    state.entities.push(...additions);
    state.nextId = nextId; state.nextEventId = nextEventId; state.events = events;
    state.navigationVersion = navigationVersion;
    const commander = state.entities.find(e => e.id === heroId)!;
    commander.x = point.x; commander.y = point.y; commander.guardAnchor = { ...point };
    state.players.forEach(player => { player.ai = false; });
    state.pendingCommands = commands;
  }, { additions: [range, house], point, heroId: hero.id, commands, nextId: copy.nextId,
    nextEventId: copy.nextEventId, events: copy.events, navigationVersion: copy.navigationVersion });
  test.info().annotations.push({ type: 'controlled-fixture', description: `Generated v4 map retained; canonical legal completed Range and House added without claiming earned construction. Commander moved initially to canonical passable (${point.x}, ${point.y}) away from producers with refreshed guard anchor; AI off; ${pending} initial Hold commands. No state writes after this boundary. All measured rally, recruiting, saving, reload and Resume actions use native controls.` });
  await press(page, action(page, 'select-commander'));
  await press(page, action(page, 'panel-orders'));
  const before = await snapshot(page);
  await evidence(page, `C3-${pending}-initial-fixture`, { generated, point, additions: [range, house], commands }, false);
  expect(producers(before).map(e => e.type)).toEqual(['keep', 'barracks', 'range']);
  expect(before.pendingCommands).toEqual(commands);
  expect(purse(before)).toEqual(purse(generated));
  expect(before.time).toBe(generated.time);
  return { before, point, range, house };
}

for (const pending of [0, 59, 60] as const) test(`C3 native mass rally ${pending} pending preserves truthful acceptance through Save Continue and Resume`, async ({ page }) => {
  test.setTimeout(100_000);
  const { before, point, range, house } = await initialFixture(page, pending);
  const eligible = producers(before), accepted = Math.min(eligible.length, 60 - pending);
  const expectedMessage = pending === 60
    ? 'No rally orders queued. Tactical queue is full. Existing rally points are unchanged.'
    : pending === 59
      ? 'Rally queued for 1 of 3 current producers. Resume to apply this fixed point. 2 unchanged: Tactical queue is full.'
      : 'Rally queued for 3 current producers. Resume to apply this fixed point. New buildings need their own rally point; it will not follow your commander.';
  await press(page, action(page, 'rally-all'));
  const queued = await snapshot(page);
  const toast = await page.locator('#toast').evaluate(node => ({ text: (node as HTMLElement).innerText, className: node.className,
    rect: node.getBoundingClientRect().toJSON(), visibility: getComputedStyle(node).visibility }));
  const feedback = await evidence(page, `C3-${pending}-feedback-before-assertion`, { before, point, accepted, expectedMessage, toast });
  // The old-build full-cap identity MUST fail here on its unconditional success
  // text, after preserving actual state, visible copy, native input and geometry.
  expect(toast.text, pending === 60
    ? 'Full tactical queue must report rejection, not success'
    : 'Rally feedback must distinguish accepted queued producers from unchanged producers').toBe(expectedMessage);
  expect(toast.className).toMatch(pending ? /show warning/ : /^show\s*$/);
  expect(toast.visibility).toBe('visible');
  expect(toast.rect.width).toBeGreaterThan(0); expect(toast.rect.height).toBeGreaterThan(0);
  expect(feedback.inputTrace).toContainEqual(expect.objectContaining({ trusted: true, type: 'click', action: 'rally-all' }));
  expect(queued.pendingCommands).toEqual([...before.pendingCommands, ...eligible.slice(0, accepted).map(e => ({ type: 'rally', team: 0, buildingId: e.id, ...point }))]);
  expect(queued.pendingCommands).toHaveLength(pending + accepted);
  expect(queued.pendingCommands.some(c => c.type === 'rally' && c.buildingId === house.id)).toBe(false);
  expect(rallies(queued)).toEqual(rallies(before));
  expect(queued.time).toBe(before.time); expect(purse(queued)).toEqual(purse(before));
  expect(queued.commandLog).toEqual(before.commandLog);

  await press(page, action(page, 'pause-menu')); await press(page, action(page, 'save-leave'));
  await expect(action(page, 'continue')).toBeVisible();
  await page.reload(); await press(page, action(page, 'continue'));
  await expect.poll(() => page.evaluate(() => window.__FRONTIER__.playing)).toBe(true);
  const restored = await snapshot(page);
  await evidence(page, `C3-${pending}-restored-before-assertion`, { queued, restored });
  expect(restored.paused).toBe(true); expect(restored.time).toBe(queued.time);
  expect(restored.pendingCommands).toEqual(queued.pendingCommands);
  expect(purse(restored)).toEqual(purse(queued)); expect(rallies(restored)).toEqual(rallies(queued));
  expect(restored.entities).toEqual(queued.entities); expect(restored.commandLog).toEqual(queued.commandLog);

  await setPaused(page, false); await setPaused(page, true);
  const executed = await snapshot(page);
  await evidence(page, `C3-${pending}-executed-before-assertion`, { restored, executed, accepted }, false);
  expect(executed.pendingCommands).toEqual([]);
  expect(producers(executed).map(e => e.rally)).toEqual(eligible.map((e, index) => index < accepted ? point : e.rally));
  expect(executed.entities.find(e => e.id === house.id)!.rally).toEqual(house.rally);
  expect(rallyLog(executed).map(e => e.command)).toEqual(eligible.slice(0, accepted).map(e => ({ type: 'rally', team: 0, buildingId: e.id, ...point })));
  for (const resource of ['gold', 'wood'] as const) {
    const stat = resource === 'gold' ? 'goldCollected' : 'woodCollected';
    expect(executed.players[0][resource] - before.players[0][resource] - (executed.players[0].stats[stat] - before.players[0].stats[stat])).toBeCloseTo(0, 8);
  }
  await setPaused(page, false); await setPaused(page, true);
  const repeated = await snapshot(page);
  await evidence(page, `C3-${pending}-repeat-resume-before-assertion`, { executed, repeated }, false);
  expect(repeated.pendingCommands).toEqual([]);
  expect(rallies(repeated)).toEqual(rallies(executed)); expect(rallyLog(repeated)).toEqual(rallyLog(executed));

  // Genuine paid recruitment from the accepted Keep (0/59) and unchanged Range
  // (59/60), or both accepted (0). No selection bridge or producer state write.
  await press(page, action(page, 'panel-army'));
  await press(page, page.getByRole('button', { name: 'Recruit Swordsman', exact: true }));
  await press(page, page.getByRole('button', { name: 'Recruit Archer', exact: true }));
  const trainingPlan = await snapshot(page), oldIds = new Set(trainingPlan.entities.map(e => e.id));
  await evidence(page, `C3-${pending}-paid-plan-before-assertion`, { repeated, trainingPlan }, false);
  expect(trainingPlan.pendingCommands.filter(c => c.type === 'recruit').map(c => c.type === 'recruit' ? c.unit : null)).toEqual(['swordsman', 'archer']);
  await setPaused(page, false);
  const paid = await snapshot(page);
  const keep = paid.entities.find(e => e.id === eligible[0].id)!;
  const rangePaid = paid.entities.find(e => e.id === range.id)!;
  const receipt = [keep, rangePaid].map(e => ({ buildingId: e.id, rally: e.rally, queue: e.queue }));
  await evidence(page, `C3-${pending}-paid-jobs-before-assertion`, { trainingPlan, paid, receipt }, false);
  for (const [producer, unit] of [[keep, 'swordsman'], [rangePaid, 'archer']] as const) {
    expect(producer.queue).toHaveLength(1);
    expect(producer.queue[0]).toMatchObject({ type: 'unit', id: unit, paidCost: getUnitCost(paid, 0, unit) });
  }
  const costs = ['swordsman', 'archer'].map(unit => getUnitCost(paid, 0, unit as UnitId));
  for (const resource of ['gold', 'wood'] as const) {
    const stat = resource === 'gold' ? 'goldCollected' : 'woodCollected';
    expect(trainingPlan.players[0][resource] + paid.players[0].stats[stat] - trainingPlan.players[0].stats[stat] - paid.players[0][resource])
      .toBeCloseTo(costs.reduce((sum, cost) => sum + cost[resource], 0), 8);
  }
  const first = new Map<string, { state: GameState; entity: Entity }>();
  await expect.poll(async () => {
    const observed = await snapshot(page);
    for (const entity of observed.entities.filter(e => e.team === 0 && e.kind === 'unit' && !oldIds.has(e.id)))
      if (!first.has(entity.type)) first.set(entity.type, { state: observed, entity });
    return [...first.keys()].sort();
  }, { timeout: 20_000, intervals: [50] }).toEqual(['archer', 'swordsman']);
  await setPaused(page, true);
  const completion = await snapshot(page);
  const observations = [...first].map(([type, record]) => ({ type, ...record,
    spawn: record.state.events.find(event => event.type === 'spawn' && event.entityId === record.entity.id),
    pauseTime: completion.time }));
  await evidence(page, `C3-${pending}-first-spawn-before-assertion`, { paid, receipt, observations, completion }, false);
  for (const observation of observations) {
    const source = observation.type === 'swordsman' ? keep : rangePaid;
    const commander = observation.state.entities.find(e => e.team === 0 && e.kind === 'commander')!;
    const destination = source.rally ?? { x: commander.x, y: commander.y };
    expect(observation.spawn).toMatchObject({ team: 0, subtype: observation.type, entityId: observation.entity.id });
    expect(observation.spawn!.time).toBeGreaterThan(trainingPlan.time);
    expect(observation.state.time).toBeGreaterThanOrEqual(observation.spawn!.time);
    expect(observation.entity.order).toMatchObject({ type: source.rally ? 'attackMove' : 'move', ...destination });
  }
  // Verify movement after actual production, independently of native Pause latency.
  await setPaused(page, false);
  await expect.poll(async () => {
    const observed = await snapshot(page);
    return observations.every(record => {
      const entity = observed.entities.find(e => e.id === record.entity.id)!;
      return Math.hypot(entity.x - point.x, entity.y - point.y) < Math.hypot(record.spawn!.x - point.x, record.spawn!.y - point.y) - 1;
    });
  }, { timeout: 20_000, intervals: [100] }).toBe(true);
  await setPaused(page, true);
  await evidence(page, `C3-${pending}-paid-recruits-move-toward-destination`, { observations, completion });
});
