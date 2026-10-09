import type {Locator, Page} from '@playwright/test';
import type {Battlefield, RenderOptions} from '../../src/render/Battlefield';
import type {ActorIndicator} from '../../src/render/actor-indicators';
import type {CombatFeedback} from '../../src/render/CombatFeedback';
import type {Entity, GameState, Point, ResourceNode} from '../../src/sim/types';
import {createGame, restoreGame, spawnEntity, updateFog} from '../../src/sim/engine';
import {action, clearGround, expect, home, launch, pause, resume, tap, test} from './helpers';

type Theme = 'christmas' | 'mythic' | 'halloween' | 'space';
type Hit = {
  image: HTMLImageElement; frame: {x: number; y: number; w: number; h: number};
  bounds: {x: number; y: number; width: number; height: number}; matrix: DOMMatrix; opacity: number;
};
type Probe = Omit<Battlefield, 'constructor'> & {
  constructor: new (canvas: HTMLCanvasElement) => Probe;
  entityHits: Map<string, Hit>; visualPositions: Map<string, Point>; combat: CombatFeedback;
  drawEntity(c: CanvasRenderingContext2D, e: Entity, selected: boolean, time: number, state: GameState, options: RenderOptions): void;
  drawNode(c: CanvasRenderingContext2D, n: ResourceNode, state: GameState, selected: boolean, time: number, options: RenderOptions): void;
  drawActorIndicators(c: CanvasRenderingContext2D, markers: readonly ActorIndicator[], options: RenderOptions): void;
  bar(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, value: number, color: string): void;
  __qaSelection: string[]; __qaMarkers: ActorIndicator[];
  __qaPortraits: PortraitDraw[]; __qaRestorePortraitDraw(): void;
  __qaKeepBars: BuildingBar[]; __qaRestoreKeepObservation(): void;
  __qaKeepPointers: KeepPointerReceipt[]; __qaInputPhase: KeepPointerReceipt['phase'];
  __qaKeepTargets: KeepTargetReceipt[];
};
type KeepPointerReceipt = {
  phase: 'setup' | 'clear-ground' | 'keep'; event: string; pointerId: number; pointerType: string; trusted: boolean;
  targetId: string; targetTag: string; targetAction: string | null; client: Point; canvasPoint: Point;
  camera: Point & {zoom: number}; pickedId: string | null; keepGround: Point; at: number;
};
type KeepTargetReceipt = {phase: 'clear-ground' | 'keep'; point: Point; camera: Point & {zoom: number}; pickedId: string | null; keepGround: Point};
type BuildingBar = {x: number; y: number; width: number; height: number; value: number; matrix: number[]};
type PortraitDraw = {
  role: string; frame: string; image: string; drawn: boolean; width: number; height?: number;
  canvas: {width: number; height: number}; opaquePixels: number; clippedPixels: number;
};
type Voice = {asset: string; loop: boolean; ended: boolean};
declare global {
  interface Window { __QA_STATIC_THEME_AUDIO__: {voices: Voice[]; decoded: string[]}; }
}
const THEMES = ['christmas', 'mythic', 'halloween', 'space'] as const;
const STATIC_THEMES = [
  {id: 'halloween', name: 'Halloween', towerWidth: 54, soundtrack: 'Hollow Lanterns',
    titles: ['The Lanternkeeper’s Gate', 'Lanterns Through the Pumpkin Rows', 'Footsteps Beyond the Haystacks',
      'The Scarecrow Procession', 'First Light at the Harvest Fair', 'The Last Ember in the Field']},
  {id: 'space', name: 'Space', towerWidth: 66, soundtrack: 'Starfall Outpost',
    titles: ['A Beacon at the Edge of Dawn', 'Signals Beyond the Pale Ridge', 'Motion Beneath the Silent Array',
      'Hold the Starfall Line', 'The Outpost Answers the Stars', 'One Light Beyond the Debris']},
] as const;
const MUSIC = ['menu', 'exploration', 'tension', 'combat', 'victory', 'defeat'] as const;
const SETTINGS_KEY = 'frontier-command:rts-game:v1:preferences';
const painted = (page: Page) => page.evaluate(() => new Promise<void>(resolve =>
  requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
const settings = (page: Page) => page.getByRole('dialog', {name: 'Settings', exact: true});

// Every context is Playwright's fresh per-test profile. Controlled fixtures must
// never be injected into a published/user profile, even with FRONTIER_TEST_URL.
test.beforeEach(async ({baseURL}) => {
  test.skip(!baseURL || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(baseURL).hostname),
    'Static-theme fixture acceptance is confined to a fresh local production build.');
});

async function press(page: Page, locator: Locator) {
  await locator.scrollIntoViewIfNeeded();
  if (await page.evaluate(() => navigator.maxTouchPoints > 0)) await locator.tap();
  else await locator.click();
}
async function openSettings(page: Page) {
  if (await page.evaluate(() => window.__FRONTIER__.playing)) await press(page, action(page, 'pause-menu'));
  await press(page, action(page, 'settings'));
  await expect(settings(page)).toBeVisible();
}
async function closeSettings(page: Page) {
  await press(page, settings(page).getByRole('button', {name: 'Done', exact: true}));
  await expect(page.getByRole('dialog')).toHaveCount(0);
}
async function choose(page: Page, theme: Theme) {
  const select = settings(page).getByLabel('Visual theme', {exact: true});
  await select.scrollIntoViewIfNeeded(); await select.selectOption(theme);
  await expect(select).toBeEnabled(); await expect(select).toHaveValue(theme);
  await expect.poll(() => page.evaluate(() => {
    const live = window.__FRONTIER__ as typeof window.__FRONTIER__ & {audioTheme: Theme};
    return [(live.renderer as unknown as Probe).visualTheme, live.audioTheme];
  })).toEqual([theme, theme]);
}
async function receipt(name: string, value: unknown) {
  await test.info().attach(name, {contentType: 'application/json', body: JSON.stringify(value, null, 2)});
}

/** Observe native decode/start calls; never substitute audio contexts, buffers,
 * clocks, or source scheduling. Detailed mixer acceptance lives in theme-audio. */
async function observeAudio(page: Page) {
  await page.addInitScript(() => {
    const bytes = new WeakMap<ArrayBuffer, string>(), assets = new WeakMap<AudioBuffer, string>();
    const ledger = window.__QA_STATIC_THEME_AUDIO__ = {voices: [] as Voice[], decoded: [] as string[]};
    const arrayBuffer = Response.prototype.arrayBuffer;
    Response.prototype.arrayBuffer = async function() {
      const result = await arrayBuffer.call(this);
      bytes.set(result, new URL(this.url, location.href).pathname); return result;
    };
    const decode = AudioContext.prototype.decodeAudioData;
    AudioContext.prototype.decodeAudioData = function(data, success, failure) {
      const asset = bytes.get(data) ?? 'unmapped';
      return decode.call(this, data, success, failure).then(buffer => {
        assets.set(buffer, asset); ledger.decoded.push(asset); return buffer;
      });
    };
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function(...args: Parameters<typeof start>) {
      const result = Reflect.apply(start, this, args);
      const voice = {asset: this.buffer ? assets.get(this.buffer) ?? 'unmapped' : 'missing', loop: this.loop, ended: false};
      ledger.voices.push(voice);
      this.addEventListener('ended', () => { voice.ended = true; }, {once: true});
      return result;
    };
  });
}
async function currentMusic(page: Page, theme: Theme, state = 'menu') {
  const part = `/assets/audio/${theme === 'christmas' ? '' : theme + '/'}${state}.`;
  await expect.poll(() => page.evaluate(part => {
    const voice = window.__QA_STATIC_THEME_AUDIO__.voices.at(-1);
    return !!voice && !voice.ended && voice.asset.includes(part);
  }, part)).toBe(true);
  return page.evaluate(() => window.__QA_STATIC_THEME_AUDIO__);
}

function crowdFixture() {
  const state = createGame({commander: 'ranger', mapSize: 'small', aiPlayers: 1, seed: 'HALLOWEEN-CROWD-20261009'});
  state.map.tiles.fill('grass'); state.entities = []; state.events = []; state.paused = true;
  state.players.forEach(player => { player.ai = false; });
  const commander = spawnEntity(state, 0, 'commander', 'ranger', 10.7, 11.6);
  const troop = spawnEntity(state, 0, 'unit', 'swordsman', 12, 12);
  for (const [x, y, type] of [
    [10.9, 12.1, 'archer'], [11.5, 11.5, 'spearman'], [11.6, 12.7, 'swordsman'],
    [12.5, 12.3, 'archer'], [12.9, 11.9, 'spearman'], [12.8, 13, 'swordsman'],
    [13.6, 12.5, 'cavalry'], [13.4, 13.5, 'swordsman'], [10.4, 12.7, 'archer'],
    [11, 13.4, 'spearman'], [12, 13.9, 'archer'], [13.8, 11.2, 'swordsman'],
  ] as const) spawnEntity(state, 0, 'unit', type, x, y);
  const tower = spawnEntity(state, 0, 'building', 'tower', 13.8, 10.5); tower.hp *= .6;
  spawnEntity(state, 0, 'building', 'keep', 3, 3);
  spawnEntity(state, 1, 'building', 'keep', state.map.width - 4, state.map.height - 4);
  for (const entity of state.entities) { entity.facing = Math.PI / 4; entity.order = {type: 'hold'}; }
  updateFog(state);
  // Retain the seeded resource graph and normalize population through the same
  // validated restore path used by Continue before recording exact save state.
  return {state: restoreGame(state), troopId: troop.id, commanderId: commander.id, towerId: tower.id};
}
async function center(page: Page, id: string) {
  await page.evaluate(id => {
    const {state, renderer} = window.__FRONTIER__, r = renderer as unknown as Probe;
    const actor = state.entities.find(entity => entity.id === id)!;
    r.centerOn(actor.x, actor.y); r.camera.zoom = 1;
    if (innerHeight < 500) r.pan(0, 42);
  }, id);
  await painted(page);
}
async function bodyContact(page: Page, id: string) {
  return page.evaluate(id => {
    const {state, renderer} = window.__FRONTIER__, r = renderer as unknown as Probe;
    const hit = r.entityHits.get(id);
    if (!hit) throw new Error(`No painted frame for ${id}`);
    const canvas = document.createElement('canvas'); canvas.width = hit.frame.w; canvas.height = hit.frame.h;
    const c = canvas.getContext('2d', {willReadFrequently: true})!;
    c.drawImage(hit.image, hit.frame.x, hit.frame.y, hit.frame.w, hit.frame.h, 0, 0, canvas.width, canvas.height);
    const rgba = c.getImageData(0, 0, canvas.width, canvas.height).data;
    const clearance = navigator.maxTouchPoints > 0 ? 20 : 3;
    const candidates = [];
    for (let row = 1; row < 24; row++) for (let col = 1; col < 24; col++) {
      const x = Math.floor(canvas.width * col / 24), y = Math.floor(canvas.height * row / 24);
      if (rgba[(y * canvas.width + x) * 4 + 3] < 200) continue;
      const p = new DOMPoint(hit.bounds.x + (x + .5) / canvas.width * hit.bounds.width,
        hit.bounds.y + (y + .5) / canvas.height * hit.bounds.height).matrixTransform(hit.matrix);
      candidates.push({x: p.x, y: p.y, score: Math.hypot(col / 24 - .5, row / 24 - .55)});
    }
    for (const p of candidates.sort((a, b) => a.score - b.score)) {
      const clear = [-clearance, 0, clearance].every(dx => [-clearance, 0, clearance].every(dy =>
        document.elementFromPoint(p.x + dx, p.y + dy)?.id === 'world'));
      const exact = [-1, 0, 1].every(dx => [-1, 0, 1].every(dy =>
        (r.pick(state, p.x + dx, p.y + dy) as Entity | null)?.id === id));
      if (clear && exact) return {...p, clearance, pickedId: id};
    }
    throw new Error(`No exposed opaque body contact with UI clearance for ${id}`);
  }, id);
}
const snapshot = (page: Page) => page.evaluate(() => ({
  state: JSON.stringify(window.__FRONTIER__.state), profile: JSON.stringify(window.__FRONTIER__.profile),
  selection: [...(window.__FRONTIER__.renderer as unknown as Probe).__qaSelection],
}));

/** Observe the production setup path, including its real atlas.draw calls.
 * A nonempty canvas alone could be only the portrait's decorative glow. */
async function inspectSetupPortraits(page: Page, theme: Theme) {
  const profile = await page.evaluate(() => JSON.stringify(window.__FRONTIER__.profile));
  await openSettings(page); await choose(page, theme); await closeSettings(page);
  await page.evaluate(() => {
    const r = window.__FRONTIER__.renderer as unknown as Probe, atlas = r.atlas;
    const originalDraw = atlas.draw;
    r.__qaPortraits = [];
    r.__qaRestorePortraitDraw = () => { atlas.draw = originalDraw; };
    atlas.draw = function(context, frame, width, height) {
      const drawn = originalDraw.call(this, context, frame, width, height);
      const role = context.canvas.dataset.portrait;
      if (role) {
        const f = this.frames[frame], bounds = this.bounds(frame, width, height);
        let opaquePixels = 0, clippedPixels = 0;
        if (drawn && f && bounds && this.image) {
          const sample = document.createElement('canvas'); sample.width = f.w; sample.height = f.h;
          const c = sample.getContext('2d', {willReadFrequently: true})!;
          c.drawImage(this.image, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
          const pixels = c.getImageData(0, 0, f.w, f.h).data, transform = context.getTransform();
          for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
            if (pixels[(y * f.w + x) * 4 + 3] < 16) continue;
            opaquePixels++;
            const point = new DOMPoint(bounds.x + (x + .5) / f.w * bounds.width,
              bounds.y + (y + .5) / f.h * bounds.height).matrixTransform(transform);
            if (point.x < 0 || point.y < 0 || point.x >= context.canvas.width || point.y >= context.canvas.height) clippedPixels++;
          }
        }
        r.__qaPortraits.push({role, frame, image: this.image?.src ?? '', drawn, width, height,
          canvas: {width: context.canvas.width, height: context.canvas.height}, opaquePixels, clippedPixels});
      }
      return drawn;
    };
  });
  try {
    await press(page, action(page, 'skirmish'));
    await expect(page.locator('.setup-page')).toBeVisible();
    await expect(page.locator('canvas[data-portrait]')).toHaveCount(3);
    await expect.poll(() => page.evaluate(() =>
      (window.__FRONTIER__.renderer as unknown as Probe).__qaPortraits.length)).toBe(3);
    await painted(page);
    const draws = await page.evaluate(() => (window.__FRONTIER__.renderer as unknown as Probe).__qaPortraits);
    expect(draws.map(draw => draw.role).sort()).toEqual(['engineer', 'ranger', 'warlord']);
    for (const draw of draws) {
      expect(draw.frame).toBe(draw.role); expect(draw.drawn).toBe(true);
      expect(draw.image).toContain(`/assets/render/themes/${theme}-toon/atlas.png`);
      expect(draw.canvas).toEqual({width: 220, height: 180});
      expect(draw.opaquePixels).toBeGreaterThan(0); expect(draw.clippedPixels).toBe(0);
      const card = page.locator(`[data-action="choose-commander"][data-id="${draw.role}"]`);
      await card.scrollIntoViewIfNeeded(); await expect(card).toBeVisible(); await expect(card).toBeEnabled();
      const bounds = await card.boundingBox(); expect(bounds).not.toBeNull();
      expect(bounds!.x).toBeGreaterThanOrEqual(-1);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
      const portrait = card.locator('canvas[data-portrait]');
      const png = await portrait.evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL('image/png'));
      await test.info().attach(`${theme}-${draw.role}-native-220x180-portrait`, {
        contentType: 'image/png', body: Buffer.from(png.split(',')[1], 'base64'),
      });
    }
    expect(await page.locator('.setup-page').evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
    await page.locator('.commander-grid').scrollIntoViewIfNeeded();
    await test.info().attach(`${theme}-native-setup-portraits-${test.info().project.name}`, {
      contentType: 'image/png', body: await page.screenshot({scale: 'css'}),
    });
    expect(await page.evaluate(() => JSON.stringify(window.__FRONTIER__.profile))).toBe(profile);
    await receipt('Actual setup portrait draw calls, source alpha clearance and native canvases', {
      theme, project: test.info().project.name, draws, profileUnchanged: true,
      provenance: 'Native Settings and Skirmish navigation; production renderPortrait atlas calls observed without substituting the renderer. Source-alpha clipping is checked at actual 220x180 backing dimensions.',
    });
  } finally {
    await page.evaluate(() => (window.__FRONTIER__.renderer as unknown as Probe).__qaRestorePortraitDraw());
  }
}

/** Extra visual staging only after the unmodified native Move/save/restore
 * proof. The queue below is display-only controlled input, never a paid order. */
async function inspectSpaceKeepQueue(page: Page) {
  await expect.poll(() => page.evaluate(() => (window.__FRONTIER__.renderer as unknown as Probe).visualTheme)).toBe('space');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('#toast')).not.toHaveClass(/\bshow\b/);
  test.info().annotations.push({type: 'controlled-visual-staging', description: 'After native Move/save/restore/movement proof, stage one existing Keep at 60% health with one unpaid half-complete display queue. Native body selection and production health/queue drawing are observed at zoom1. No paid recruitment or natural gameplay claim.'});
  const profile = await page.evaluate(() => JSON.stringify(window.__FRONTIER__.profile));
  const resourcesBefore = await page.evaluate(() => ({gold: window.__FRONTIER__.state.players[0].gold, wood: window.__FRONTIER__.state.players[0].wood}));
  const keepId = await page.evaluate(() => {
    const {state, renderer} = window.__FRONTIER__, r = renderer as unknown as Probe;
    if (!state.paused || r.visualTheme !== 'space') throw new Error('Keep visual staging requires the paused Space state');
    const keep = state.entities.find(entity => entity.team === 0 && entity.type === 'keep')!;
    keep.hp = keep.maxHp * .6;
    keep.queue = [{type: 'unit', id: 'swordsman', queueId: 'qa-space-keep-unpaid-display', remaining: 6, total: 12}];
    const drawEntity = r.drawEntity, bar = r.bar, render = r.render;
    let observingKeep = false;
    r.__qaKeepBars = []; r.__qaSelection = [];
    r.__qaKeepPointers = []; r.__qaKeepTargets = []; r.__qaInputPhase = 'setup';
    const pointerEvents = ['pointerdown', 'pointerup', 'pointercancel'] as const;
    const observePointer = (event: PointerEvent) => {
      const rect = r.canvas.getBoundingClientRect(), point = {x: event.clientX - rect.left, y: event.clientY - rect.top};
      const target = event.target instanceof Element ? event.target : null;
      r.__qaKeepPointers.push({phase: r.__qaInputPhase, event: event.type,
        pointerId: event.pointerId, pointerType: event.pointerType, trusted: event.isTrusted,
        targetId: target?.id ?? '', targetTag: target?.tagName ?? '', targetAction: target?.getAttribute('data-action') ?? null,
        client: {x: event.clientX, y: event.clientY}, canvasPoint: point, camera: {...r.camera},
        pickedId: (r.pick(state, point.x, point.y) as Entity | ResourceNode | null)?.id ?? null,
        keepGround: r.worldToScreen(keep.x, keep.y), at: performance.now()});
    };
    for (const name of pointerEvents) window.addEventListener(name, observePointer, {capture: true, passive: true});
    r.drawEntity = function(...args) {
      const previous = observingKeep; observingKeep = args[1].id === keep.id;
      if (observingKeep) this.__qaKeepBars = [];
      try { return drawEntity.apply(this, args); }
      finally { observingKeep = previous; }
    };
    r.bar = function(context, x, y, width, height, value, color) {
      if (observingKeep) {
        const m = context.getTransform(), d = this.dpr;
        this.__qaKeepBars.push({x, y, width, height, value, matrix: [m.a / d, m.b / d, m.c / d, m.d / d, m.e / d, m.f / d]});
      }
      return bar.call(this, context, x, y, width, height, value, color);
    };
    r.render = function(state, selection = [], options = {}) {
      this.__qaSelection = Array.from(selection, String);
      return render.call(this, state, selection, {...options, reducedMotion: true});
    };
    r.__qaRestoreKeepObservation = () => {
      r.drawEntity = drawEntity; r.bar = bar; r.render = render;
      for (const name of pointerEvents) window.removeEventListener(name, observePointer, true);
    };
    return keep.id;
  });
  try {
    if (!await page.locator('.command-deck').evaluate(node => node.classList.contains('collapsed')))
      await press(page, action(page, 'toggle-deck'));
    // Continue restores commander-follow mode. Release it through the ordinary
    // empty-ground input before this controlled camera framing; never edit the
    // private follow flag or retry a missed Keep tap.
    const clearPoint = await clearGround(page);
    const planInput = async (phase: 'clear-ground' | 'keep', point: Point) => page.evaluate(({phase, point, id}) => {
      const {state, renderer} = window.__FRONTIER__, r = renderer as unknown as Probe;
      const keep = state.entities.find(entity => entity.id === id)!;
      const plan = {phase, point, camera: {...r.camera}, pickedId: (r.pick(state, point.x, point.y) as Entity | ResourceNode | null)?.id ?? null,
        keepGround: r.worldToScreen(keep.x, keep.y)};
      r.__qaInputPhase = phase; r.__qaKeepTargets.push(plan); return plan;
    }, {phase, point, id: keepId});
    const clearPlan = await planInput('clear-ground', clearPoint);
    expect(clearPlan.pickedId).toBeNull();
    await tap(page, clearPoint); await painted(page);
    await expect.poll(() => page.evaluate(() => (window.__FRONTIER__.renderer as unknown as Probe).__qaSelection)).toEqual([]);
    const clearInput = await page.evaluate(() => (window.__FRONTIER__.renderer as unknown as Probe).__qaKeepPointers.filter(row => row.phase === 'clear-ground'));
    expect(clearInput.map(row => row.event)).toEqual(['pointerdown', 'pointerup']);
    for (const event of clearInput) expect(event).toMatchObject({targetId: 'world', trusted: true, pickedId: null});
    expect(clearInput[1].pointerId).toBe(clearInput[0].pointerId);
    await page.evaluate(() => { (window.__FRONTIER__.renderer as unknown as Probe).__qaInputPhase = 'setup'; });
    await center(page, keepId);
    const cameraProof = async () => page.evaluate(id => {
      const {state, renderer} = window.__FRONTIER__, r = renderer as unknown as Probe;
      const keep = state.entities.find(entity => entity.id === id)!, hit = r.entityHits.get(id)!;
      return {camera: {...r.camera}, keepGround: r.worldToScreen(keep.x, keep.y), paintedGround: {x: hit.matrix.e, y: hit.matrix.f}};
    }, keepId);
    const firstFrame = await cameraProof(); await painted(page); const secondFrame = await cameraProof();
    expect(secondFrame).toEqual(firstFrame);
    expect(secondFrame.keepGround.x).toBeCloseTo(page.viewportSize()!.width / 2, 8);
    expect(secondFrame.keepGround.y).toBeCloseTo(page.viewportSize()!.height / 2 + (page.viewportSize()!.height < 500 ? 42 : 0), 8);
    expect(secondFrame.paintedGround.x).toBeCloseTo(secondFrame.keepGround.x, 4);
    expect(secondFrame.paintedGround.y).toBeCloseTo(secondFrame.keepGround.y, 4);
    const contact = await bodyContact(page, keepId), keepPlan = await planInput('keep', contact);
    expect(keepPlan.pickedId).toBe(keepId); expect(keepPlan.camera).toEqual(secondFrame.camera);
    await tap(page, contact); await painted(page);
    await expect.poll(() => page.evaluate(() => (window.__FRONTIER__.renderer as unknown as Probe).__qaSelection)).toEqual([keepId]);
    const keepInput = await page.evaluate(() => (window.__FRONTIER__.renderer as unknown as Probe).__qaKeepPointers.filter(row => row.phase === 'keep'));
    expect(keepInput.map(row => row.event)).toEqual(['pointerdown', 'pointerup']);
    for (const event of keepInput) {
      expect(event).toMatchObject({targetId: 'world', trusted: true, pickedId: keepId});
      expect(event.camera).toEqual(keepPlan.camera); expect(event.keepGround).toEqual(keepPlan.keepGround);
    }
    expect(keepInput[1].pointerId).toBe(keepInput[0].pointerId);
    await page.evaluate(() => { (window.__FRONTIER__.renderer as unknown as Probe).__qaInputPhase = 'setup'; });
    // Native building selection opens Inspect. Collapse it normally before
    // grading the battlefield so phone UI cannot cover the bar/queue evidence.
    if (!await page.locator('.command-deck').evaluate(node => node.classList.contains('collapsed')))
      await press(page, action(page, 'toggle-deck'));
    await center(page, keepId);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('#toast')).not.toHaveClass(/\bshow\b/);
    const proof = await page.evaluate(id => {
      const {state, renderer} = window.__FRONTIER__, r = renderer as unknown as Probe;
      const keep = state.entities.find(entity => entity.id === id)!, hit = r.entityHits.get(id)!;
      const canvas = document.createElement('canvas'); canvas.width = hit.frame.w; canvas.height = hit.frame.h;
      const c = canvas.getContext('2d', {willReadFrequently: true})!;
      c.drawImage(hit.image, hit.frame.x, hit.frame.y, hit.frame.w, hit.frame.h, 0, 0, canvas.width, canvas.height);
      const pixels = c.getImageData(0, 0, canvas.width, canvas.height).data;
      let opaquePixels = 0, alphaTop = Infinity;
      const bars = r.__qaKeepBars.map(bar => ({...bar, alphaOverlap: 0, onCanvas: [-1, 0, 1].every(side => {
        const point = new DOMPoint(bar.x + side * (bar.width / 2 + 1), bar.y + bar.height / 2).matrixTransform(new DOMMatrix(bar.matrix));
        return document.elementFromPoint(point.x, point.y)?.id === 'world';
      })}));
      for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
        if (pixels[(y * canvas.width + x) * 4 + 3] < 128) continue;
        opaquePixels++;
        const sx = hit.bounds.x + (x + .5) / canvas.width * hit.bounds.width;
        const sy = hit.bounds.y + (y + .5) / canvas.height * hit.bounds.height;
        alphaTop = Math.min(alphaTop, sy);
        for (const bar of bars) if (sx >= bar.x - bar.width / 2 - 1 && sx <= bar.x + bar.width / 2 + 1 &&
          sy >= bar.y - 1 && sy <= bar.y + bar.height + 1) bar.alphaOverlap++;
      }
      return {id, selected: r.__qaSelection, zoom: r.camera.zoom, bounds: hit.bounds, bars, alphaTop, opaquePixels,
        queue: keep.queue, resources: {gold: state.players[0].gold, wood: state.players[0].wood}, paused: state.paused, image: hit.image.src,
        scaleX: Math.hypot(hit.matrix.a, hit.matrix.b), scaleY: Math.hypot(hit.matrix.c, hit.matrix.d)};
    }, keepId);
    expect(proof.selected).toEqual([keepId]); expect(proof.paused).toBe(true);
    expect(proof.resources).toEqual(resourcesBefore);
    expect(proof.zoom).toBe(1); expect(proof.bounds.width).toBe(132);
    expect(proof.scaleX).toBeCloseTo(1, 8); expect(proof.scaleY).toBeCloseTo(1, 8);
    expect(proof.image).toContain('/assets/render/themes/space-toon/atlas.png');
    expect(proof.opaquePixels).toBeGreaterThan(0); expect(proof.bars).toHaveLength(2);
    const [health, queue] = proof.bars;
    expect(health).toMatchObject({x: 0, width: 57, height: 3, value: .6, alphaOverlap: 0, onCanvas: true});
    expect(queue).toMatchObject({x: 0, width: 57, height: 2.5, value: .5, alphaOverlap: 0, onCanvas: true});
    expect(health.y).toBeCloseTo(proof.bounds.y - 20, 8); expect(queue.y).toBeCloseTo(health.y + 7, 8);
    expect(proof.alphaTop - (health.y + health.height + 1)).toBeGreaterThanOrEqual(16);
    expect(proof.alphaTop - (queue.y + queue.height + 1)).toBeGreaterThanOrEqual(9.5);
    expect(proof.queue).toEqual([{type: 'unit', id: 'swordsman', queueId: 'qa-space-keep-unpaid-display', remaining: 6, total: 12}]);
    expect(await page.evaluate(() => JSON.stringify(window.__FRONTIER__.profile))).toBe(profile);
    await expect(page.locator('#toast')).not.toHaveClass(/\bshow\b/);
    await test.info().attach(`space-controlled-keep-queue-${test.info().project.name}`, {
      contentType: 'image/png', body: await page.screenshot({scale: 'css'}),
    });
    await receipt('Controlled Space Keep health and unpaid queue at native renderer scale', {
      provenance: 'Additional post-save visual staging in an isolated local profile. One existing Keep receives controlled health/queue values; mouse/touch selection, production bar rendering, atlas pixels and screenshot are real. No paid recruitment or natural-gameplay claim.',
      project: test.info().project.name, clearPlan, clearInput, firstFrame, secondFrame, keepPlan, keepInput,
      contact, profileUnchanged: true, resourcesBefore, ...proof,
    });
  } finally {
    try {
      const input = await page.evaluate(() => {
        const r = window.__FRONTIER__.renderer as unknown as Probe;
        return {targets: r.__qaKeepTargets, pointers: r.__qaKeepPointers, finalCamera: {...r.camera}, finalSelection: r.__qaSelection};
      });
      await receipt('Controlled Keep input targets, passive native pointer capture and camera evidence', {
        project: test.info().project.name,
        provenance: 'Capture-phase passive observations only, before production pointer handlers. Includes ordinary empty-ground release of commander following and exactly one Keep body tap; no synthetic events or follow-state mutation.', ...input,
      });
    } finally {
      await page.evaluate(() => (window.__FRONTIER__.renderer as unknown as Probe).__qaRestoreKeepObservation());
    }
  }
}

for (const focus of STATIC_THEMES) {
const focusTheme = focus.id;
test(`${focus.name} all36 role gallery uses actual renderer sizes and keeps building alpha clear of health`, async ({page}) => {
  test.setTimeout(60_000);
  test.info().annotations.push({type: 'controlled-gallery', description: 'Isolated production renderer, source-scale cells; seven reserved roles use SpriteAtlas directly. Not natural gameplay.'});
  const fixture = crowdFixture(), galleryState = fixture.state;
  const entities: Record<string, Entity> = {};
  for (const type of ['swordsman', 'spearman', 'archer', 'cavalry', 'siege', 'support'] as const)
    entities[type] = spawnEntity(galleryState, 0, 'unit', type, 12, 12);
  for (const type of ['ranger', 'warlord', 'engineer'] as const)
    entities[type] = spawnEntity(galleryState, 0, 'commander', type, 12, 12);
  for (const type of ['keep', 'house', 'barracks', 'range', 'stable', 'workshop', 'tower', 'depot', 'blacksmith'] as const)
    entities[type] = spawnEntity(galleryState, 0, 'building', type, 12, 12);
  await home(page);
  const evidence = await page.evaluate(async ({state, entities, theme}) => {
    const live = window.__FRONTIER__, before = JSON.stringify({state: live.state, profile: live.profile});
    const canvas = document.createElement('canvas'), source = live.renderer as unknown as Probe;
    const r = new source.constructor(canvas); r.resize(960, 1044, 1);
    if (!await r.setVisualTheme(theme)) throw new Error(`${theme} atlas did not decode`);
    r.centerOn(12, 12); r.camera.zoom = 1; state.fog.visible[0].fill(1);
    const stateBefore = JSON.stringify(state), c = r.context, options = {time: state.time, quality: 'high', reducedMotion: true} as const;
    const roles = Object.keys(r.atlas.frames), draws: {role: string; frame: string; width: number; height?: number; drawn: boolean}[] = [];
    const bars: {role: string; x: number; y: number; width: number; height: number}[] = [];
    const realDraw = r.atlas.draw.bind(r.atlas), realBar = r.bar.bind(r);
    let role = '';
    r.atlas.draw = (ctx, frame, width, height) => {
      const drawn = realDraw(ctx, frame, width, height); draws.push({role, frame, width, height, drawn}); return drawn;
    };
    r.bar = (ctx, x, y, width, height, value, color) => {
      if (entities[role]?.kind === 'building') bars.push({role, x, y, width, height});
      realBar(ctx, x, y, width, height, value, color);
    };
    const reserved: string[] = [], silhouettes = [];
    for (let index = 0; index < roles.length; index++) {
      role = roles[index]; const x = index % 6 * 160, y = Math.floor(index / 6) * 174;
      c.fillStyle = index % 2 ? '#d7dfc5' : '#304947'; c.fillRect(x, y, 160, 174);
      c.save(); c.translate(x + 80, y + 140);
      if (entities[role]) r.drawEntity(c, entities[role], true, 0, state, options);
      else if (/^(gold|wood)-/.test(role) || ['relic-neutral', 'relic-contested', 'relic-captured'].includes(role)) {
        const [kind, stage] = role.split('-') as [ResourceNode['kind'], string];
        const node: ResourceNode = {id: role, x: 12, y: 12, kind, radius: 1, income: 1,
          amount: stage === 'empty' ? 0 : stage === 'sparse' ? 100 : stage === 'half' ? 500 : 1000, maxAmount: 1000,
          owner: stage === 'neutral' ? null : 0, captureTeam: stage === 'contested' ? 1 : null,
          captureProgress: stage === 'contested' ? .5 : 0};
        r.drawNode(c, node, state, true, 0, options);
      } else {
        reserved.push(role);
        // These seven atlas roles have no production Battlefield caller.
        // Relics retain the nodeVisual height91; other reserved art uses the
        // established generic structure width103, explicitly labeled below.
        r.atlas.draw(c, role, role === 'relic-inactive' ? 75 : 103, role === 'relic-inactive' ? 91 : undefined);
      }
      c.restore(); c.fillStyle = index % 2 ? '#172d35' : '#fff3cf';
      c.font = '11px system-ui'; c.textAlign = 'center';
      c.fillText(role + (reserved.includes(role) ? ' [reserved]' : ''), x + 80, y + 165);
      const f = r.atlas.frames[role], sample = document.createElement('canvas'); sample.width = f.w; sample.height = f.h;
      const sc = sample.getContext('2d')!; sc.drawImage(r.atlas.image!, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
      const pixels = sc.getImageData(0, 0, f.w, f.h).data;
      let left = f.w, top = f.h, right = -1, bottom = -1, opaque = 0;
      for (let py = 0; py < f.h; py++) for (let px = 0; px < f.w; px++) {
        if (pixels[(py * f.w + px) * 4 + 3] < 16) continue;
        left = Math.min(left, px); top = Math.min(top, py); right = Math.max(right, px); bottom = Math.max(bottom, py); opaque++;
      }
      if (!opaque) throw new Error(`Empty authored role: ${role}`);
      const draw = draws.at(-1)!;
      if (!draw.drawn || draw.frame !== role) throw new Error(`Renderer used fallback/wrong role for ${role}`);
      const bounds = r.atlas.bounds(role, draw.width, draw.height)!;
      const width = (right + 1 - left) / f.w * bounds.width, height = (bottom + 1 - top) / f.h * bounds.height;
      let healthOverlap = 0;
      if (entities[role]?.kind === 'building') for (let py = 0; py < f.h; py++) for (let px = 0; px < f.w; px++) {
        if (pixels[(py * f.w + px) * 4 + 3] < 128) continue;
        const sx = bounds.x + (px + .5) / f.w * bounds.width, sy = bounds.y + (py + .5) / f.h * bounds.height;
        if (bars.some(b => b.role === role && sx >= b.x - b.width / 2 - 1 && sx <= b.x + b.width / 2 + 1 && sy >= b.y - 1 && sy <= b.y + b.height + 1)) healthOverlap++;
      }
      silhouettes.push({role, width, height, opaque, healthOverlap, bounds, sourceAlphaThreshold: 16});
    }
    if (JSON.stringify(state) !== stateBefore || JSON.stringify({state: live.state, profile: live.profile}) !== before)
      throw new Error('Isolated gallery mutated simulation or profile');
    return {png: canvas.toDataURL('image/png'), roles, draws, silhouettes, bars, reserved,
      provenance: 'Controlled actual renderer gallery at zoom1/dpr1; reserved frames are atlas-only inspection, not natural gameplay'};
  }, {state: galleryState, entities, theme: focusTheme});
  expect(evidence.roles).toHaveLength(36);
  expect(evidence.draws).toHaveLength(36);
  expect(evidence.reserved.sort()).toEqual(['arcane', 'camp-cleared', 'camp-guarded', 'chopping-cue', 'mining-cue', 'relic-inactive', 'wall']);
  const tower = evidence.silhouettes.find(row => row.role === 'tower')!;
  expect(tower.width).toBeLessThanOrEqual(focus.towerWidth); expect(tower.height).toBeLessThanOrEqual(102);
  expect(evidence.bars).toHaveLength(9);
  for (const bar of evidence.bars) {
    expect(evidence.silhouettes.find(row => row.role === bar.role)!.healthOverlap, `${bar.role} clears its actual health bar`).toBe(0);
  }
  if (focusTheme === 'halloween') {
    expect(evidence.bars).toContainEqual({role: 'tower', x: 0, y: -107, width: 57, height: 3});
  } else for (const bar of evidence.bars) {
    const bounds = evidence.silhouettes.find(row => row.role === bar.role)!.bounds;
    expect(bar).toEqual({role: bar.role, x: 0, y: bounds.y - 20, width: 57, height: 3});
  }
  const {png, ...metrics} = evidence;
  // Native-size canvas capture is bounded to 960x1044. Phone readability is
  // separately captured in the true viewport in the native-input test below.
  await test.info().attach('Controlled all36 renderer gallery, source scale', {contentType: 'image/png', body: Buffer.from(png.split(',')[1], 'base64')});
  await receipt('All36 production draw calls and all9 building alpha health clearance', metrics);
  await press(page, action(page, 'about'));
  const credits = page.getByRole('dialog', {name: 'Credits / About', exact: true});
  await expect(credits.locator('.soundtrack-credits li')).toHaveCount(24);
  await expect(credits).toContainText('Halloween uses static role artwork');
  await expect(credits).toContainText(`${focus.name} uses static role artwork`);
  await expect(credits).toContainText('The Scarecrow Procession');
  const bankCredits = credits.locator('.soundtrack-credits').nth(THEMES.indexOf(focusTheme));
  await expect(bankCredits.locator('li b')).toHaveText([...focus.titles]);
  await credits.getByRole('heading', {name: focus.soundtrack, exact: true}).scrollIntoViewIfNeeded();
  await test.info().attach('Four-theme soundtrack credits in actual viewport', {
    contentType: 'image/png', body: await page.screenshot({scale: 'css'}),
  });
  await press(page, credits.getByRole('button', {name: 'Done', exact: true}));
  await expect(credits).toHaveCount(0);
  await inspectSetupPortraits(page, focusTheme);
});

test(`${focus.name} native crowd selection and Move survive all four themes and a saved battle`, async ({page}) => {
  test.setTimeout(60_000);
  test.info().annotations.push({type: 'controlled-fixture', description: 'Paused crowd with AI disabled and two keeps; real native body selection, Move, settings, save and reload. Not natural gameplay.'});
  const fixture = crowdFixture();
  await observeAudio(page); await launch(page, {commander: 'ranger'}); await pause(page);
  await openSettings(page); await choose(page, focusTheme); await closeSettings(page);
  await page.evaluate(fixture => {
    const live = window.__FRONTIER__, r = live.renderer as unknown as Probe;
    Object.assign(live.state, fixture.state); r.invalidateTerrain(); r.visualPositions.clear(); r.combat.reset();
    const render = r.render, paintMarkers = r.drawActorIndicators;
    r.__qaSelection = []; r.__qaMarkers = [];
    r.render = function(state, selection = [], options = {}) {
      this.__qaSelection = Array.from(selection, String);
      return render.call(this, state, selection, {...options, reducedMotion: true});
    };
    r.drawActorIndicators = function(context, markers, options) {
      this.__qaMarkers = structuredClone([...markers]); return paintMarkers.call(this, context, markers, options);
    };
  }, fixture);
  if (!await page.locator('.command-deck').evaluate(e => e.classList.contains('collapsed'))) await press(page, action(page, 'toggle-deck'));
  await center(page, fixture.troopId);
  await tap(page, await clearGround(page)); await center(page, fixture.troopId);
  const contact = await bodyContact(page, fixture.troopId); await tap(page, contact); await painted(page);
  await expect.poll(() => page.evaluate(() => (window.__FRONTIER__.renderer as unknown as Probe).__qaSelection)).toEqual([fixture.troopId]);
  const markers = await page.evaluate(() => (window.__FRONTIER__.renderer as unknown as Probe).__qaMarkers);
  expect(markers.find(row => row.id === fixture.troopId)).toMatchObject({selected: true, health: {width: 30, height: 3}});
  expect(markers.find(row => row.id === fixture.commanderId)).toMatchObject({commander: true});
  const overlayPixels = await page.evaluate(id => {
    const r = window.__FRONTIER__.renderer as unknown as Probe;
    const marker = r.__qaMarkers.find(row => row.id === id)!;
    const overlay = document.createElement('canvas'); overlay.width = r.canvas.width; overlay.height = r.canvas.height;
    const c = overlay.getContext('2d')!; c.setTransform(r.dpr, 0, 0, r.dpr, 0, 0);
    // Draw the same production marker on transparent canvas, then compare its
    // solid pixels to the already painted complete scene (including crowd/fog).
    const savedMarkers = r.__qaMarkers;
    r.drawActorIndicators(c, [marker], {reducedMotion: true}); r.__qaMarkers = savedMarkers;
    const reference = c.getImageData(0, 0, overlay.width, overlay.height).data;
    const scene = r.context.getImageData(0, 0, overlay.width, overlay.height).data;
    let samples = 0, matching = 0;
    for (let index = 0; index < reference.length; index += 4) {
      if (reference[index + 3] < 245) continue;
      samples++;
      const difference = Math.abs(reference[index] - scene[index]) + Math.abs(reference[index + 1] - scene[index + 1])
        + Math.abs(reference[index + 2] - scene[index + 2]);
      // Allows edge antialias and the real renderer's mild final vignette.
      if (difference < 65) matching++;
    }
    const health = marker.health!;
    const healthOnCanvas = [marker.x - health.width / 2, marker.x, marker.x + health.width / 2].every(x =>
      document.elementFromPoint(x, health.y + health.height / 2)?.id === 'world');
    return {samples, matching, fraction: matching / samples, healthOnCanvas};
  }, fixture.troopId);
  expect(overlayPixels.samples).toBeGreaterThan(50);
  expect(overlayPixels.fraction).toBeGreaterThan(.9); expect(overlayPixels.healthOnCanvas).toBe(true);
  await expect(page.locator('#toast')).not.toHaveClass(/\bshow\b/);
  const screenshot = test.info().outputPath(`${focusTheme}-controlled-crowd-tower-native-viewport.png`);
  await page.screenshot({path: screenshot, scale: 'css'});
  await test.info().attach('Controlled crowd, selected actor overlays and tower in actual viewport', {path: screenshot, contentType: 'image/png'});
  await expect(action(page, 'order-move')).toBeVisible();
  await expect(action(page, 'order-move')).toBeEnabled();
  await press(page, action(page, 'order-move'));
  const destination = await clearGround(page); await tap(page, destination);
  await expect.poll(() => page.evaluate(() => window.__FRONTIER__.state.pendingCommands.at(-1)))
    .toMatchObject({type: 'move', entityIds: [fixture.troopId]});
  const before = await snapshot(page), switches = [];
  for (const theme of [...THEMES.filter(theme => theme !== focusTheme), focusTheme]) {
    await openSettings(page); await choose(page, theme); await closeSettings(page); await painted(page);
    expect(await snapshot(page), `Changing to ${theme} preserves exact paused state, orders, selection and profile`).toEqual(before);
    const art = await page.evaluate(() => ({
      atlas: (window.__FRONTIER__.renderer as unknown as Probe).atlas.image!.src,
      icons: Array.from(document.querySelectorAll('.sprite-icon')).map(e => getComputedStyle(e).backgroundImage),
    }));
    const path = theme === 'christmas' ? '/assets/render/frontier-atlas.png' : `/assets/render/themes/${theme}-toon/atlas.png`;
    expect(art.atlas).toContain(path); expect(art.icons.length).toBeGreaterThan(0);
    expect(art.icons.every(image => image.includes(path))).toBe(true);
    switches.push({theme, art, audio: await currentMusic(page, theme, 'exploration')});
  }
  await press(page, action(page, 'pause-menu')); await press(page, action(page, 'save'));
  await expect(page.locator('#toast')).toContainText('Battle saved on this device');
  const stored = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('frontier-command-rts-game', 1);
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    try {
      const record = await new Promise<{value: {game: string}}>((resolve, reject) => {
        const request = db.transaction('records').objectStore('records').get('battle');
        request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
      });
      return record.value.game;
    } finally { db.close(); }
  });
  expect(stored).toBe(before.state);
  await page.reload(); await expect(action(page, 'continue')).toBeVisible(); await press(page, action(page, 'continue'));
  await expect(page.locator('.hud')).toBeVisible();
  const restored = await page.evaluate(() => ({state: window.__FRONTIER__.state, profile: JSON.stringify(window.__FRONTIER__.profile)}));
  const saved = JSON.parse(before.state) as GameState;
  expect(restored.state.entities.map(e => ({id: e.id, order: e.order, x: e.x, y: e.y})))
    .toEqual(saved.entities.map(e => ({id: e.id, order: e.order, x: e.x, y: e.y})));
  expect(restored.state.pendingCommands).toEqual(saved.pendingCommands);
  expect(restored.state.players).toEqual(saved.players); expect(restored.state.time).toBe(saved.time);
  expect(restored.profile).toBe(before.profile);
  const start = restored.state.entities.find(e => e.id === fixture.troopId)!;
  await resume(page);
  await expect.poll(() => page.evaluate(id => {
    const e = window.__FRONTIER__.state.entities.find(e => e.id === id)!; return {x: e.x, y: e.y};
  }, fixture.troopId)).not.toEqual({x: start.x, y: start.y});
  await pause(page);
  await receipt('Exact native IDs, all-theme atomic preservation and real stored battle', {
    provenance: 'Controlled paused fixture; source-alpha-guided exposed-body picking followed by real mouse/touch selection, Move, settings and save. This does not measure human crowd discoverability or natural survival.',
    project: test.info().project.name, contact, destination, selectedId: fixture.troopId, markers, overlayPixels,
    queued: saved.pendingCommands, switches, savedEntityIds: saved.entities.map(e => e.id), savedStateVerified: true,
  });
  if (focusTheme === 'space') await inspectSpaceKeepQueue(page);
});

test.describe(`${focus.name} controlled failed and superseded loads`, () => {
  test.use({serviceWorkers: 'block'}); // A worker cache must not bypass a deliberate network hold/failure.
  test.beforeEach(() => { test.skip(test.info().project.name !== 'desktop', 'One bounded native desktop failure identity.'); });

  const identity = (page: Page) => page.evaluate(key => {
    const live = window.__FRONTIER__ as typeof window.__FRONTIER__ & {audioTheme: Theme}, r = live.renderer as unknown as Probe;
    return {art: r.visualTheme, image: r.atlas.image?.src, audio: live.audioTheme,
      preferences: localStorage.getItem(key), profile: JSON.stringify(live.profile)};
  }, SETTINGS_KEY);

  test(`failed ${focus.name} image retains actual working art, audio and persisted profile`, async ({page}) => {
    await observeAudio(page); await home(page); await openSettings(page); await choose(page, 'mythic');
    await currentMusic(page, 'mythic'); const before = await identity(page);
    let failures = 0;
    await page.route(`**/themes/${focusTheme}-toon/atlas.png`, route => { failures++; return route.abort(); });
    const select = settings(page).getByLabel('Visual theme', {exact: true}); await select.selectOption(focusTheme);
    await expect(select).toBeEnabled(); await expect(select).toHaveValue('mythic');
    await expect(settings(page).locator('#theme-status')).toContainText('current set');
    expect(failures).toBe(1); expect(await identity(page)).toEqual(before);
    const audio = await currentMusic(page, 'mythic');
    expect(audio.voices.some(v => v.asset.includes(`/audio/${focusTheme}/`))).toBe(false);
    await receipt('Controlled failed atlas image, complete previous art/audio/preferences retained', {before, after: await identity(page), audio});
  });

  test(`superseded ${focus.name} load cannot overwrite the latest native settings choice or start its music`, async ({page}) => {
    await observeAudio(page); await home(page); await openSettings(page); await choose(page, 'mythic');
    await currentMusic(page, 'mythic'); const before = await identity(page);
    let held = false, release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    await page.route(`**/themes/${focusTheme}-toon/atlas.png`, async route => { held = true; await gate; await route.continue(); });
    const first = settings(page).getByLabel('Visual theme', {exact: true}); await first.selectOption(focusTheme);
    try {
      await expect.poll(() => held).toBe(true); await expect(first).toBeDisabled();
      expect(await identity(page)).toEqual(before);
      // Done remains available while the old select is loading. Reopen settings
      // through actual UI so a new enabled select can request the latest theme.
      await closeSettings(page); await openSettings(page);
      const latest = settings(page).getByLabel('Visual theme', {exact: true}); await latest.selectOption('christmas');
      await expect(latest).toBeDisabled(); expect(await identity(page)).toEqual(before);
      release(); await expect(latest).toBeEnabled(); await expect(latest).toHaveValue('christmas');
      await currentMusic(page, 'christmas');
      const after = await identity(page), audio = await page.evaluate(() => window.__QA_STATIC_THEME_AUDIO__);
      expect(after.art).toBe('christmas'); expect(after.audio).toBe('christmas');
      expect(after.image).toContain('/assets/render/frontier-atlas.png'); expect(after.profile).toBe(before.profile);
      expect(JSON.parse(after.preferences!).visualTheme).toBe('christmas');
      expect(audio.voices.some(v => v.asset.includes(`/audio/${focusTheme}/`))).toBe(false);
      await receipt('Controlled delayed image superseded through native settings', {before, after, audio});
    } finally { release(); }
  });
});

test(`${focus.name} persists and switches all four themes offline at the production subpath`, async ({page, context}) => {
  test.skip(test.info().project.name !== 'desktop', 'One bounded offline service-worker identity.');
  test.setTimeout(60_000);
  await observeAudio(page); await home(page); await openSettings(page); await choose(page, focusTheme);
  await currentMusic(page, focusTheme); await closeSettings(page);
  expect(new URL(page.url()).pathname).toBe('/rts-game/');
  const profile = await page.evaluate(() => JSON.stringify(window.__FRONTIER__.profile));
  await page.waitForFunction(async () => navigator.serviceWorker.controller &&
    (await caches.keys()).some(name => name.startsWith('frontier-command-rts-game-')));
  const cached = await page.evaluate(async () => {
    const names = await caches.keys(), cache = await caches.open(names.find(name => name.startsWith('frontier-command-rts-game-'))!);
    return (await cache.keys()).map(request => new URL(request.url).pathname);
  });
  for (const suffix of ['atlas.json', 'atlas.png']) expect(cached).toContain(`/rts-game/assets/render/themes/${focusTheme}-toon/${suffix}`);
  expect(cached).toContain(`/rts-game/assets/audio/${focusTheme}/manifest.json`);
  for (const state of MUSIC) for (const extension of ['ogg', 'mp3'])
    expect(cached).toContain(`/rts-game/assets/audio/${focusTheme}/${state}.${extension}`);
  await context.setOffline(true); await page.reload(); await expect(action(page, 'settings')).toBeVisible();
  await openSettings(page);
  await expect(settings(page).getByLabel('Visual theme', {exact: true})).toHaveValue(focusTheme);
  await currentMusic(page, focusTheme);
  const music = [];
  for (const theme of THEMES) { await choose(page, theme); music.push({theme, audio: await currentMusic(page, theme)}); }
  expect(await page.evaluate(() => JSON.stringify(window.__FRONTIER__.profile))).toBe(profile);
  expect(await page.evaluate(() => (window.__FRONTIER__.renderer as unknown as Probe).atlas.image!.naturalWidth)).toBeGreaterThan(0);
  await receipt(`Offline subpath, all four complete themes and ${focus.name} six-state cached soundtrack`, {cached, music, profileUnchanged: true});
});

}
