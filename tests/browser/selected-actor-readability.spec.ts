import type {Page} from '@playwright/test';
import type {Battlefield, RenderOptions} from '../../src/render/Battlefield';
import type {ActorIndicator} from '../../src/render/actor-indicators';
import type {CombatFeedback} from '../../src/render/CombatFeedback';
import type {Entity, GameState, Point} from '../../src/sim/types';
import {createGame, spawnEntity, updateFog} from '../../src/sim/engine';
import {action, clearGround, expect, launch, pause, resume, tap, test} from './helpers';

type Theme = 'christmas' | 'mythic';
type Marker = ActorIndicator;
type Actor = Point & {value: Entity};
type PaintedRect = {x: number; y: number; w: number; h: number};
type SpriteHit = {
  image: HTMLImageElement;
  frame: {x: number; y: number; w: number; h: number};
  bounds: {x: number; y: number; width: number; height: number};
  matrix: DOMMatrix;
  opacity: number;
};
// Test-only inspection of runtime-private methods. No shipping QA toggle, input
// injection, body replacement, save mutation or screenshot baseline asset.
type RendererProbe = Omit<Battlefield, 'constructor'> & {
  constructor: new (canvas: HTMLCanvasElement) => RendererProbe;
  entityHits: Map<string, SpriteHit>;
  visualPositions: Map<string, Point>;
  combat: CombatFeedback;
  planActorIndicators(actors: readonly Actor[], selected: ReadonlySet<string>, options: RenderOptions): Marker[];
  drawActorIndicators(context: CanvasRenderingContext2D, markers: readonly Marker[], options: RenderOptions): void;
  drawTroopSummaries(context: CanvasRenderingContext2D, items: unknown[], state: GameState, options: RenderOptions, markers?: readonly Marker[]): void;
  drawFog(context: CanvasRenderingContext2D, state: GameState, options: RenderOptions): void;
  __qaSelection: string[];
  __qaMarkers: Marker[];
  __qaSummaryRects: PaintedRect[];
  __qaRestorePlanner?: RendererProbe['planActorIndicators'];
};

function controlledCrowd() {
  const state = createGame({commander: 'ranger', mapSize: 'small', aiPlayers: 1, seed: 'SELECTED-CROWD-20261009'});
  state.map.tiles.fill('grass'); state.map.nodes = [];
  state.entities = []; state.events = []; state.paused = true;
  state.players.forEach(player => { player.ai = false; });
  const commander = spawnEntity(state, 0, 'commander', 'ranger', 10.7, 11.6);
  const troop = spawnEntity(state, 0, 'unit', 'swordsman', 12, 12);
  // Deliberate overlapping ranks, not a recreated or newly earned battle.
  for (const [x, y, type] of [
    [10.9, 12.1, 'archer'], [11.5, 11.5, 'spearman'], [11.6, 12.7, 'swordsman'],
    [12.5, 12.3, 'archer'], [12.9, 11.9, 'spearman'], [12.8, 13.0, 'swordsman'],
    [13.6, 12.5, 'cavalry'], [13.4, 13.5, 'swordsman'], [10.4, 12.7, 'archer'],
    [11.0, 13.4, 'spearman'], [12.0, 13.9, 'archer'], [13.8, 11.2, 'swordsman'],
  ] as const) spawnEntity(state, 0, 'unit', type, x, y);
  const enemy = spawnEntity(state, 1, 'unit', 'swordsman', 15.2, 10.4);
  spawnEntity(state, 0, 'building', 'keep', 3, 3);
  spawnEntity(state, 1, 'building', 'keep', state.map.width - 4, state.map.height - 4);
  for (const entity of state.entities) {
    entity.facing = Math.PI / 4; entity.order = {type: 'hold'};
  }
  updateFog(state);
  return {state, commanderId: commander.id, troopId: troop.id, enemyId: enemy.id};
}

function benchmarkCrowd(actorCount: 80 | 600) {
  const fixture = controlledCrowd(), state = fixture.state;
  state.entities = state.entities.filter(entity => [fixture.commanderId, fixture.troopId].includes(entity.id));
  const columns = actorCount === 80 ? 10 : 30, spacing = actorCount === 80 ? .5 : .16;
  const rows = Math.ceil(actorCount / columns);
  for (let index = state.entities.length; index < actorCount; index++) {
    const entity = spawnEntity(state, 0, 'unit', ['swordsman', 'archer', 'spearman'][index % 3] as 'swordsman' | 'archer' | 'spearman',
      12 + (index % columns - (columns - 1) / 2) * spacing,
      12 + (Math.floor(index / columns) - (rows - 1) / 2) * spacing);
    entity.facing = Math.PI / 4; entity.order = {type: 'hold'};
  }
  state.fog.visible[0].fill(1); state.fog.explored[0].fill(1);
  return {...fixture, actorCount, label: actorCount === 80 ? 'controlled-ordinary-80' : 'controlled-dense-600'};
}

const paintedFrame = (page: Page) => page.evaluate(() => new Promise<void>(resolve =>
  requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));

async function center(page: Page, id: string) {
  await page.evaluate(id => {
    const {state, renderer} = window.__FRONTIER__, r = renderer as unknown as RendererProbe;
    const actor = state.entities.find(entity => entity.id === id)!;
    r.centerOn(actor.x, actor.y); r.camera.zoom = 1;
    if (innerHeight < 500) r.pan(0, 42);
  }, id);
  await paintedFrame(page);
}

async function prepare(page: Page, theme: Theme) {
  const fixture = controlledCrowd();
  await launch(page, {commander: 'ranger'}); await pause(page);
  await page.evaluate(async ({theme, fixture}) => {
    const live = window.__FRONTIER__, r = live.renderer as unknown as RendererProbe;
    if (!await r.setVisualTheme(theme)) throw new Error(`Could not load ${theme}`);
    Object.assign(live.state, fixture.state);
    r.invalidateTerrain(); r.visualPositions.clear(); r.combat.reset();
    const render = r.render, paintMarkers = r.drawActorIndicators, paintSummaries = r.drawTroopSummaries;
    r.__qaSelection = []; r.__qaMarkers = []; r.__qaSummaryRects = [];
    r.render = function(state, selection = [], options = {}) {
      this.__qaSelection = Array.from(selection, String);
      // Freeze presentation only so the paired frames differ in marker layering.
      return render.call(this, state, selection, {...options, reducedMotion: true});
    };
    r.drawActorIndicators = function(context, markers, options) {
      this.__qaMarkers = structuredClone([...markers]);
      return paintMarkers.call(this, context, markers, options);
    };
    r.drawTroopSummaries = function(context, items, state, options, markers) {
      const rectangles: PaintedRect[] = [], roundRect = context.roundRect, dpr = this.dpr;
      context.roundRect = function(x, y, width, height, radii) {
        const matrix = this.getTransform();
        const corners = [[x, y], [x + width, y], [x, y + height], [x + width, y + height]]
          .map(([px, py]) => new DOMPoint(px, py).matrixTransform(matrix));
        const stroke = this.lineWidth * Math.max(Math.hypot(matrix.a, matrix.b), Math.hypot(matrix.c, matrix.d)) / (2 * dpr);
        const left = Math.min(...corners.map(point => point.x)) / dpr - stroke;
        const top = Math.min(...corners.map(point => point.y)) / dpr - stroke;
        rectangles.push({x: left, y: top,
          w: Math.max(...corners.map(point => point.x)) / dpr + stroke - left,
          h: Math.max(...corners.map(point => point.y)) / dpr + stroke - top});
        return roundRect.call(this, x, y, width, height, radii);
      };
      try { return paintSummaries.call(this, context, items, state, options, markers); }
      finally { context.roundRect = roundRect; this.__qaSummaryRects = rectangles; }
    };
    r.centerOn(11.8, 12); r.camera.zoom = 1;
    if (innerHeight < 500) r.pan(0, 42);
  }, {theme, fixture});
  if (!await page.locator('.command-deck').evaluate(element => element.classList.contains('collapsed'))) {
    await action(page, 'toggle-deck').click();
  }
  await paintedFrame(page);
  await tap(page, await clearGround(page));
  await expect(page.locator('#selection-info')).toContainText('Select a unit');
  await center(page, fixture.troopId);
  return fixture;
}

async function bodyContact(page: Page, id: string) {
  return page.evaluate(id => {
    const {state, renderer} = window.__FRONTIER__, r = renderer as unknown as RendererProbe;
    const hit = r.entityHits.get(id);
    if (!hit) throw new Error(`No painted frame for ${id}`);
    const source = document.createElement('canvas'); source.width = hit.frame.w; source.height = hit.frame.h;
    const context = source.getContext('2d', {willReadFrequently: true})!;
    context.drawImage(hit.image, hit.frame.x, hit.frame.y, hit.frame.w, hit.frame.h, 0, 0, source.width, source.height);
    const alpha = context.getImageData(0, 0, source.width, source.height).data;
    const candidates: (Point & {sourceAlpha: number; score: number})[] = [];
    for (let row = 1; row < 24; row++) for (let column = 1; column < 24; column++) {
      const x = Math.min(source.width - 1, Math.floor(source.width * column / 24));
      const y = Math.min(source.height - 1, Math.floor(source.height * row / 24));
      if (alpha[(y * source.width + x) * 4 + 3] < 200) continue;
      const point = new DOMPoint(hit.bounds.x + (x + .5) / source.width * hit.bounds.width,
        hit.bounds.y + (y + .5) / source.height * hit.bounds.height).matrixTransform(hit.matrix);
      candidates.push({x: point.x, y: point.y, sourceAlpha: alpha[(y * source.width + x) * 4 + 3],
        score: Math.hypot(column / 24 - .5, row / 24 - .55)});
    }
    const clearance = navigator.maxTouchPoints > 0 ? 20 : 3;
    for (const point of candidates.sort((a, b) => a.score - b.score)) {
      const canvas = [-clearance, 0, clearance].every(dx => [-clearance, 0, clearance].every(dy =>
        document.elementFromPoint(point.x + dx, point.y + dy)?.id === 'world'));
      const exact = [-1, 0, 1].every(dx => [-1, 0, 1].every(dy => r.pick(state, point.x + dx, point.y + dy)?.id === id));
      if (canvas && exact) return {...point, clearance, pickedId: id};
    }
    throw new Error(`No exposed native body contact for exact actor ${id}`);
  }, id);
}

async function expectSelection(page: Page, ids: string[]) {
  await expect.poll(() => page.evaluate(() => (window.__FRONTIER__.renderer as unknown as RendererProbe).__qaSelection)).toEqual(ids);
}

async function stopFollowing(page: Page) {
  const point = await clearGround(page);
  if (await page.evaluate(() => navigator.maxTouchPoints > 0)) {
    const session = await page.context().newCDPSession(page);
    try {
      await session.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [point]});
      await session.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x: point.x + 12, y: point.y}]});
      await session.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
    } finally { await session.detach(); }
  } else {
    await page.mouse.move(point.x, point.y); await page.mouse.down();
    await page.mouse.move(point.x + 12, point.y, {steps: 3}); await page.mouse.up();
  }
  await paintedFrame(page);
}

const snapshot = (page: Page) => page.evaluate(() => {
  const live = window.__FRONTIER__, r = live.renderer as unknown as RendererProbe;
  return {state: JSON.stringify(live.state), profile: JSON.stringify(live.profile),
    camera: {...r.camera}, selection: [...r.__qaSelection]};
});

async function pairedScreenshots(page: Page, theme: Theme, subject: string) {
  if (test.info().project.name === 'desktop') return;
  await expect(page.locator('#toast')).not.toHaveClass(/\bshow\b/);
  const before = await snapshot(page);
  try {
    await page.evaluate(() => {
      const r = window.__FRONTIER__.renderer as unknown as RendererProbe;
      r.__qaRestorePlanner = r.planActorIndicators;
      // Empty promotion restores the existing original depth-layer indicators.
      r.planActorIndicators = () => [];
    });
    await paintedFrame(page);
    const path = test.info().outputPath(`${theme}-${subject}-controlled-crowd-before-original-layer.png`);
    await page.screenshot({path, scale: 'css'});
    await test.info().attach('Controlled crowd, original depth-layer markers; not natural gameplay', {path, contentType: 'image/png'});
  } finally {
    await page.evaluate(() => {
      const r = window.__FRONTIER__.renderer as unknown as RendererProbe;
      if (r.__qaRestorePlanner) r.planActorIndicators = r.__qaRestorePlanner;
      delete r.__qaRestorePlanner;
    });
    await paintedFrame(page);
  }
  const path = test.info().outputPath(`${theme}-${subject}-controlled-crowd-after-final-layer.png`);
  await page.screenshot({path, scale: 'css'});
  await test.info().attach('Controlled crowd, final marker layer; same camera, selection and paused state', {path, contentType: 'image/png'});
  expect(await snapshot(page), 'Only marker layering changes across the pair').toEqual(before);
}

async function prioritySummaryClearance(page: Page, selectedId: string) {
  const report = await page.evaluate(selectedId => {
    const r = window.__FRONTIER__.renderer as unknown as RendererProbe, scale = Math.max(.8, r.camera.zoom);
    // Independently include the ring's outer stroke, bar border and star/pip.
    // Text metrics use the actual browser font, not the placement helper's boxes.
    const priorities = r.__qaMarkers.flatMap(marker => {
      const health = marker.health;
      if (!health) return [];
      let left = marker.x - health.width / 2 - 1, right = marker.x + health.width / 2 + 1;
      let top = health.y - 1, bottom = health.y + health.height + 1;
      const ringStroke = (marker.stroke + 2) / 2;
      left = Math.min(left, marker.x - marker.radius - ringStroke);
      right = Math.max(right, marker.x + marker.radius + ringStroke);
      top = Math.min(top, marker.y + marker.ringY - marker.radiusY - ringStroke);
      bottom = Math.max(bottom, marker.y + marker.ringY + marker.radiusY + ringStroke);
      if (marker.commander) {
        r.context.save(); r.context.font = `bold ${10 * scale}px system-ui`;
        r.context.textAlign = 'center';
        const text = r.context.measureText('★'), baseline = health.y + health.height + 9 * scale;
        r.context.restore();
        left = Math.min(left, marker.x - text.actualBoundingBoxLeft - 1.25);
        right = Math.max(right, marker.x + text.actualBoundingBoxRight + 1.25);
        top = Math.min(top, baseline - text.actualBoundingBoxAscent - 1.25);
        bottom = Math.max(bottom, baseline + text.actualBoundingBoxDescent + 1.25);
      } else if (marker.selected) {
        const radius = 3 * scale + .65, center = health.y + health.height + 5 * scale;
        left = Math.min(left, marker.x - radius); right = Math.max(right, marker.x + radius);
        top = Math.min(top, center - radius); bottom = Math.max(bottom, center + radius);
      }
      return [{id: marker.id, commander: marker.commander, selected: marker.selected,
        x: left, y: top, w: right - left, h: bottom - top}];
    });
    const overlaps = priorities.flatMap(priority => r.__qaSummaryRects.flatMap(summary => {
      const width = Math.min(priority.x + priority.w, summary.x + summary.w) - Math.max(priority.x, summary.x);
      const height = Math.min(priority.y + priority.h, summary.y + summary.h) - Math.max(priority.y, summary.y);
      return width > 0 && height > 0 ? [{priorityId: priority.id, summary, area: width * height}] : [];
    }));
    return {selectedId, priorities, summaries: r.__qaSummaryRects, overlaps,
      viewport: {width: r.width, height: r.height, dpr: r.dpr, zoom: r.camera.zoom}};
  }, selectedId);
  expect(report.priorities.length, 'At most two priority health/identity markers').toBeLessThanOrEqual(2);
  expect(report.priorities.map(marker => marker.id), 'The exact selected actor retains its priority marker').toContain(selectedId);
  expect(report.overlaps, 'Painted troop-summary badges must not cover priority rings, health, commander star or selected pip').toEqual([]);
  return report;
}

for (const theme of ['christmas', 'mythic'] as const) {
  test(`${theme} selected readability preserves native exact actor selection and Move Attack Hold orders`, async ({page}) => {
    test.setTimeout(60_000);
    const fixture = await prepare(page, theme), before = await snapshot(page), contacts = [];
    for (const id of [fixture.troopId, fixture.commanderId]) {
      await center(page, id);
      const contact = await bodyContact(page, id); contacts.push(contact);
      await tap(page, contact); await expectSelection(page, [id]);
      expect(await page.evaluate(() => window.__FRONTIER__.state.pendingCommands)).toHaveLength(0);
      await stopFollowing(page); await center(page, id);
      await tap(page, await clearGround(page)); await expectSelection(page, []);
    }
    const afterSelection = await snapshot(page);
    expect(afterSelection.state).toBe(before.state); expect(afterSelection.profile).toBe(before.profile);
    await center(page, fixture.troopId); await tap(page, await bodyContact(page, fixture.troopId));
    await expectSelection(page, [fixture.troopId]);
    const start = await page.evaluate(id => {
      const entity = window.__FRONTIER__.state.entities.find(entity => entity.id === id)!;
      return {x: entity.x, y: entity.y};
    }, fixture.troopId);
    await action(page, 'order-move').click(); const destination = await clearGround(page); await tap(page, destination);
    await expect.poll(() => page.evaluate(() => window.__FRONTIER__.state.pendingCommands.at(-1)))
      .toMatchObject({type: 'move', entityIds: [fixture.troopId]});
    await resume(page);
    await expect.poll(() => page.evaluate(({id, start}) => {
      const entity = window.__FRONTIER__.state.entities.find(entity => entity.id === id)!;
      return Math.hypot(entity.x - start.x, entity.y - start.y);
    }, {id: fixture.troopId, start}), {timeout: 10_000}).toBeGreaterThan(.4);
    await pause(page);
    await center(page, fixture.commanderId); await tap(page, await bodyContact(page, fixture.commanderId));
    await expectSelection(page, [fixture.commanderId]); await stopFollowing(page); await center(page, fixture.commanderId);
    await action(page, 'order-move').click(); await tap(page, await clearGround(page));
    await expect.poll(() => page.evaluate(() => window.__FRONTIER__.state.pendingCommands.at(-1)))
      .toMatchObject({type: 'move', entityIds: [fixture.commanderId]});
    await action(page, 'hold').click();
    await expect.poll(() => page.evaluate(() => window.__FRONTIER__.state.pendingCommands.at(-1)))
      .toMatchObject({type: 'hold', entityIds: [fixture.commanderId]});
    await center(page, fixture.troopId); await tap(page, await bodyContact(page, fixture.troopId));
    await expectSelection(page, [fixture.troopId]);
    await action(page, 'order-attack').click(); await center(page, fixture.enemyId);
    await expect(page.locator('#toast')).not.toHaveClass(/\bshow\b/);
    // Attack adds a toolbar above the landscape deck. Frame the enemy from its
    // measured edge rather than leaving the native touch contact behind that UI.
    const targetingFrame = await page.evaluate(id => {
      if (innerHeight >= 500) return null;
      const toolbar = document.querySelector('.target-toolbar')!.getBoundingClientRect();
      const {state, renderer} = window.__FRONTIER__, r = renderer as unknown as RendererProbe;
      const actor = state.entities.find(entity => entity.id === id)!;
      const before = r.worldToScreen(actor.x, actor.y);
      r.pan(0, Math.min(0, toolbar.top - 30 - before.y));
      return {toolbarTop: toolbar.top, before, after: r.worldToScreen(actor.x, actor.y)};
    }, fixture.enemyId);
    await paintedFrame(page);
    const enemyContact = await bodyContact(page, fixture.enemyId);
    if (targetingFrame) expect(enemyContact.y + enemyContact.clearance).toBeLessThan(targetingFrame.toolbarTop);
    await tap(page, enemyContact);
    await expect.poll(() => page.evaluate(() => window.__FRONTIER__.state.pendingCommands.at(-1)))
      .toMatchObject({type: 'attack', targetId: fixture.enemyId, entityIds: [fixture.troopId]});
    await action(page, 'hold').click();
    await expect.poll(() => page.evaluate(() => window.__FRONTIER__.state.pendingCommands.at(-1)))
      .toMatchObject({type: 'hold', entityIds: [fixture.troopId]});
    expect(await page.evaluate(() => JSON.stringify(window.__FRONTIER__.profile))).toBe(before.profile);
    await test.info().attach('Native exact-ID input on a controlled crowd', {contentType: 'application/json', body: JSON.stringify({
      provenance: 'Controlled injected overlap fixture; native mouse/touch input after preparation, not natural gameplay',
      theme, project: test.info().project.name, contacts, start, destination, enemyContact, targetingFrame,
      orders: await page.evaluate(() => window.__FRONTIER__.state.pendingCommands),
    }, null, 2)});
  });

  test(`${theme} selected readability pairs controlled crowd pixels and bounds render cost`, async ({page}) => {
    test.setTimeout(90_000);
    const fixture = await prepare(page, theme);
    const benchmarks = [benchmarkCrowd(80), benchmarkCrowd(600)];
    const summaryClearance = [];
    for (const [subject, id] of [['troop', fixture.troopId], ['commander', fixture.commanderId]] as const) {
      await center(page, id); await tap(page, await bodyContact(page, id)); await expectSelection(page, [id]);
      await stopFollowing(page); await center(page, id);
      await pairedScreenshots(page, theme, subject);
      summaryClearance.push(await prioritySummaryClearance(page, id));
    }
    const evidence = await page.evaluate(async ({theme, troopId, commanderId, benchmarks}) => {
      const live = window.__FRONTIER__, liveBefore = JSON.stringify({state: live.state, profile: live.profile});
      const original = live.renderer as unknown as RendererProbe;
      const canvas = document.createElement('canvas'), r = new original.constructor(canvas);
      r.resize(innerWidth, innerHeight, devicePixelRatio);
      if (!await r.setVisualTheme(theme)) throw new Error(`Could not load ${theme}`);
      const state = structuredClone(live.state), planner = r.planActorIndicators;
      const options: RenderOptions = {time: state.time, reducedMotion: true, quality: 'high', reveal: false};
      const stateBefore = JSON.stringify(state), results = [];
      for (const id of [troopId, commanderId]) {
        const actor = state.entities.find(entity => entity.id === id)!;
        r.centerOn(actor.x, actor.y); r.camera.zoom = 1;
        const selection = [id];
        const draw = (final: boolean) => { r.planActorIndicators = final ? planner : () => []; r.render(state, selection, options); };
        const hitData = () => Array.from(r.entityHits, ([id, hit]) => ({id, frame: hit.frame, bounds: hit.bounds,
          matrix: [hit.matrix.a, hit.matrix.b, hit.matrix.c, hit.matrix.d, hit.matrix.e, hit.matrix.f], opacity: hit.opacity}));
        const picks = () => {
          const point = r.worldToScreen(actor.x, actor.y), values = [];
          for (let dy = -90; dy <= 25; dy += 5) for (let dx = -55; dx <= 55; dx += 5) {
            values.push(r.pick(state, point.x + dx, point.y + dy)?.id ?? null);
          }
          return values;
        };
        draw(false); const beforeHits = hitData(), beforePicks = picks();
        const before = r.context.getImageData(0, 0, canvas.width, canvas.height).data;
        draw(true); const afterHits = hitData(), afterPicks = picks();
        const after = r.context.getImageData(0, 0, canvas.width, canvas.height).data;
        if (JSON.stringify(beforeHits) !== JSON.stringify(afterHits)) throw new Error('Marker promotion changed painted body frame, transform or opacity');
        if (JSON.stringify(beforePicks) !== JSON.stringify(afterPicks)) throw new Error('Marker promotion changed a native pick result');
        const actors = state.entities.filter(entity => entity.kind !== 'building').map(value => ({x: value.x, y: value.y, value}));
        const markers = r.planActorIndicators(actors, new Set(selection), options);
        const overlay = document.createElement('canvas'); overlay.width = canvas.width; overlay.height = canvas.height;
        const context = overlay.getContext('2d')!; context.setTransform(r.dpr, 0, 0, r.dpr, 0, 0);
        // Grade the exact selected actor's pixels, so a clearer commander cannot
        // hide a still-obscured selected troop in an aggregate image score.
        r.drawActorIndicators(context, markers.filter(marker => marker.id === id), options);
        const reference = context.getImageData(0, 0, overlay.width, overlay.height).data;
        let samples = 0, beforeError = 0, afterError = 0, changed = 0;
        for (let index = 0; index < reference.length; index += 4) {
          if (reference[index + 3] < 245) continue;
          samples++;
          let difference = 0;
          for (let channel = 0; channel < 3; channel++) {
            beforeError += Math.abs(before[index + channel] - reference[index + channel]);
            afterError += Math.abs(after[index + channel] - reference[index + channel]);
            difference += Math.abs(after[index + channel] - before[index + channel]);
          }
          if (difference > 25) changed++;
        }
        if (samples < 50 || changed < 20 || beforeError < 1000 || afterError >= beforeError * .75) {
          throw new Error(`Final marker pixels did not become readable: ${JSON.stringify({id, samples, changed, beforeError, afterError})}`);
        }
        results.push({id, markers, samples, changed, beforeError, afterError, unchangedBodyFrames: beforeHits.length, unchangedPickSamples: beforePicks.length});
      }
      // Fixed and bounded within this same browser identity, no extra CI job.
      // Alternate order to avoid assigning warmup, thermal drift or GC to one mode.
      const batchFrames = 4, samples = 9, warmupBatchesPerMode = 4, costs = [];
      for (const benchmark of benchmarks) {
        const costState = benchmark.state, costBefore = JSON.stringify(costState), selection = [benchmark.troopId];
        r.centerOn(12, 12); r.camera.zoom = 1; r.invalidateTerrain(); r.visualPositions.clear(); r.combat.reset();
        const renderBatch = (final: boolean) => {
          r.planActorIndicators = final ? planner : () => [];
          const start = performance.now();
          for (let frame = 0; frame < batchFrames; frame++) r.render(costState, selection, options);
          return (performance.now() - start) / batchFrames;
        };
        for (let warmup = 0; warmup < warmupBatchesPerMode; warmup++) { renderBatch(false); renderBatch(true); }
        const beforeTimes: number[] = [], afterTimes: number[] = [];
        for (let sample = 0; sample < samples; sample++) {
          if (sample % 2) { afterTimes.push(renderBatch(true)); beforeTimes.push(renderBatch(false)); }
          else { beforeTimes.push(renderBatch(false)); afterTimes.push(renderBatch(true)); }
        }
        r.planActorIndicators = planner;
        const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
        const beforeMedian = median(beforeTimes), afterMedian = median(afterTimes);
        // Conservative shared-runner guard: 35% of baseline plus 1.5ms handles
        // timer granularity and modest scheduling noise; raw samples remain evidence.
        const limit = beforeMedian * 1.35 + 1.5;
        if (afterMedian > limit) throw new Error(`Marker render cost exceeded bound: ${JSON.stringify({scene: benchmark.label, beforeMedian, afterMedian, limit})}`);
        if (JSON.stringify(costState) !== costBefore) throw new Error(`${benchmark.label}: benchmark mutated simulation`);
        costs.push({scene: benchmark.label, actorCount: benchmark.actorCount, paintedActors: r.entityHits.size,
          viewport: {width: r.width, height: r.height, dpr: r.dpr, zoom: r.camera.zoom},
          quality: options.quality, reducedMotion: options.reducedMotion, batchFrames, samples,
          measuredFramesPerMode: batchFrames * samples, warmupBatchesPerMode,
          warmupFramesPerMode: batchFrames * warmupBatchesPerMode,
          beforeTimes, afterTimes, beforeMedian, afterMedian, limit,
          noiseAllowance: {baselineMultiplier: 1.35, additiveMilliseconds: 1.5}});
      }
      if (JSON.stringify(state) !== stateBefore || JSON.stringify({state: live.state, profile: live.profile}) !== liveBefore) {
        throw new Error('Paired rendering or timing mutated game state/profile');
      }
      return {provenance: 'Controlled crowd, original marker planner disabled for before frames; not natural gameplay or saved battle replay',
        theme, results, costs, costScope: 'Controlled isolated 80- and 600-actor fixtures; main-thread Canvas2D render submission only, not a real-device frame-rate or GPU measurement'};
    }, {theme, troopId: fixture.troopId, commanderId: fixture.commanderId, benchmarks});
    await test.info().attach('Controlled marker pixels, unchanged bodies and picks, bounded render cost',
      {contentType: 'application/json', body: JSON.stringify({...evidence, summaryClearance}, null, 2)});
  });

  test(`${theme} selected readability markers respect hidden dead respawning deselected and motion states`, async ({page}) => {
    test.setTimeout(60_000);
    const fixture = await prepare(page, theme);
    const evidence = await page.evaluate(async ({theme, troopId, commanderId}) => {
      const live = window.__FRONTIER__, liveBefore = JSON.stringify({state: live.state, profile: live.profile});
      const original = live.renderer as unknown as RendererProbe;
      const canvas = document.createElement('canvas'), r = new original.constructor(canvas);
      r.resize(innerWidth, innerHeight, devicePixelRatio);
      if (!await r.setVisualTheme(theme)) throw new Error(`Could not load ${theme}`);
      const base = structuredClone(live.state), sourceTroop = base.entities.find(entity => entity.id === troopId)!;
      const sourceCommander = base.entities.find(entity => entity.id === commanderId)!;
      const painter = r.drawActorIndicators, fog = r.drawFog;
      let painted: Marker[] = [], phase: string[] = [];
      r.drawActorIndicators = function(context, markers, options) {
        phase.push('markers'); painted = structuredClone([...markers]); return painter.call(this, context, markers, options);
      };
      r.drawFog = function(context, state, options) { phase.push('fog'); return fog.call(this, context, state, options); };
      const cases = [
        {name: 'selected-unit', selected: true, expect: true},
        {name: 'deselected-unit', selected: false, expect: false},
        {name: 'dead-unit', selected: true, dead: true, expect: false},
        {name: 'respawning-unit', selected: true, respawning: true, expect: false},
        {name: 'visible-selected-enemy-unit', selected: true, enemy: true, expect: true},
        {name: 'visible-unselected-enemy-unit', selected: false, enemy: true, expect: false},
        {name: 'hidden-enemy-unit', selected: true, enemy: true, hidden: true, expect: false},
        {name: 'selected-commander', commander: true, selected: true, expect: true},
        {name: 'unselected-commander', commander: true, selected: false, expect: true},
        {name: 'dead-commander', commander: true, selected: true, dead: true, expect: false},
        {name: 'respawning-commander', commander: true, selected: true, respawning: true, expect: false},
        {name: 'visible-selected-enemy-commander', commander: true, selected: true, enemy: true, expect: true},
        {name: 'visible-unselected-enemy-commander', commander: true, selected: false, enemy: true, expect: false},
        {name: 'hidden-enemy-commander', commander: true, selected: true, enemy: true, hidden: true, expect: false},
      ] as const;
      const results = [];
      for (const mode of [{zoom: .55, reducedMotion: true, quality: 'low'}, {zoom: 1.8, reducedMotion: false, quality: 'high'}] as const) {
        for (const variant of cases) {
          const state = structuredClone(base), actor = structuredClone('commander' in variant ? sourceCommander : sourceTroop);
          actor.x = 12; actor.y = 12;
          if ('dead' in variant) actor.hp = 0;
          if ('respawning' in variant) actor.respawnAt = state.time + 10;
          if ('enemy' in variant) actor.team = 1;
          state.entities = [actor]; state.events = [];
          state.fog.visible[0].fill('hidden' in variant ? 0 : 1); state.fog.explored[0].fill(1);
          const options: RenderOptions = {...mode, time: state.time, reveal: false};
          r.centerOn(12, 12); r.camera.zoom = mode.zoom; r.visualPositions.clear(); r.combat.reset();
          const before = JSON.stringify(state), selection = variant.selected ? [actor.id] : [];
          painted = []; phase = []; r.render(state, selection, options);
          const ids = painted.map(marker => marker.id);
          if (JSON.stringify(ids) !== JSON.stringify(variant.expect ? [actor.id] : [])) {
            throw new Error(`${variant.name}: wrong promoted marker IDs ${JSON.stringify(ids)}`);
          }
          for (const marker of painted) {
            if (![marker.x, marker.y, marker.radius, marker.radiusY, marker.stroke].every(Number.isFinite)
              || marker.radius <= 0 || marker.radiusY <= 0 || marker.stroke < 1.2) {
              throw new Error(`${variant.name}: invalid or unreadably thin zoomed marker`);
            }
            if (marker.health && (marker.health.width < 24 || marker.health.height < 3 || marker.health.y < 0)) {
              throw new Error(`${variant.name}: priority health marker became unreadable at zoom ${mode.zoom}`);
            }
          }
          if (phase.indexOf('markers') < 0 || phase.indexOf('markers') > phase.indexOf('fog')) throw new Error('Marker layer is not before fog');
          const geometry = JSON.stringify(painted);
          // No new pulse, bounce or marker animation when presentation time advances.
          r.render(state, selection, {...options, time: state.time + 11});
          if (JSON.stringify(painted) !== geometry) throw new Error(`${variant.name}: marker geometry changed with presentation time`);
          if ('hidden' in variant || 'dead' in variant || 'respawning' in variant) {
            const point = r.worldToScreen(actor.x, actor.y);
            if (r.entityHits.has(actor.id) || r.pick(state, point.x, point.y - 20 * mode.zoom)?.id === actor.id) {
              throw new Error(`${variant.name}: absent actor acquired a painted body or hit target`);
            }
          }
          if (JSON.stringify(state) !== before) throw new Error(`${variant.name}: renderer mutated simulation`);
          results.push({mode, variant: variant.name, markerIds: ids, markers: painted, phase});
        }
      }
      for (const variant of ['selected-unit', 'unselected-commander']) {
        const [small, large] = results.filter(result => result.variant === variant);
        if (!(large.markers[0].radius > small.markers[0].radius * 3)) throw new Error(`${variant}: ring no longer follows camera zoom`);
      }
      // The same map/entity objects survive this sequence, so stale cached plans
      // cannot be hidden by replacing the fixture between lifecycle states.
      const transitions = [];
      for (const source of [sourceTroop, sourceCommander]) {
        const changing = structuredClone(base), actor = structuredClone(source);
        actor.x = 12; actor.y = 12; changing.entities = [actor]; changing.events = [];
        changing.fog.visible[0].fill(1); r.centerOn(12, 12); r.camera.zoom = 1; r.combat.reset();
        for (const step of ['selected', 'deselected', 'reselected', 'dead', 'respawning', 'returned']) {
          actor.hp = step === 'dead' ? 0 : actor.maxHp;
          actor.respawnAt = step === 'respawning' ? changing.time + 10 : null;
          const selected = step !== 'deselected';
          const expected = (selected || actor.kind === 'commander') && !['dead', 'respawning'].includes(step);
          painted = []; phase = [];
          const before = JSON.stringify(changing);
          r.render(changing, selected ? [actor.id] : [], {reducedMotion: true, quality: 'low', time: changing.time});
          const ids = painted.map(marker => marker.id);
          if (JSON.stringify(ids) !== JSON.stringify(expected ? [actor.id] : [])) throw new Error(`${actor.kind}/${step}: stale lifecycle marker ${JSON.stringify(ids)}`);
          if (JSON.stringify(changing) !== before) throw new Error(`${actor.kind}/${step}: lifecycle render mutated state`);
          transitions.push({kind: actor.kind, step, markerIds: ids});
        }
      }
      if (JSON.stringify({state: live.state, profile: live.profile}) !== liveBefore) throw new Error('Isolated lifecycle fixture mutated live state');
      return {provenance: 'Controlled isolated renderer lifecycle fixtures, not natural gameplay', theme, results, transitions};
    }, {theme, troopId: fixture.troopId, commanderId: fixture.commanderId});
    expect(evidence.results).toHaveLength(28);
    await test.info().attach('Marker eligibility, layer order, zoom and reduced-motion evidence',
      {contentType: 'application/json', body: JSON.stringify(evidence, null, 2)});
  });
}
