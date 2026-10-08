import type {Page} from '@playwright/test';
import type {Entity, GameState, Point} from '../../src/sim/types';
import type {Battlefield, RenderOptions} from '../../src/render/Battlefield';
import type {CombatFeedback} from '../../src/render/CombatFeedback';
import type {DirectionalAtlas} from '../../src/render/DirectionalAtlas';
import {createGame, spawnEntity, updateFog} from '../../src/sim/engine';
import {action, clearGround, expect, launch, pause, resume, tap, test} from './helpers';

type Theme = 'christmas' | 'mythic';
type Decoration = Point & {kind: 'tree' | 'rock' | 'ruin'; variant: number; size: number};
type SpriteHit = {
  image: HTMLImageElement;
  frame: {x: number; y: number; w: number; h: number};
  bounds: {x: number; y: number; width: number; height: number};
  matrix: DOMMatrix;
  opacity: number;
};
// Runtime-private renderer members are inspected only here; no shipping QA toggle.
type RendererProbe = Omit<Battlefield, 'constructor'> & {
  constructor: new (canvas: HTMLCanvasElement) => RendererProbe;
  ensureTerrain(map: GameState['map']): {decor: Decoration[]};
  decorationSprite(decoration: Decoration, biome: string): HTMLCanvasElement;
  decorationOpacity(decoration: Decoration): number;
  directionalFor(actor: string): DirectionalAtlas;
  entityHits: Map<string, SpriteHit>;
  readableActors: {value: Entity}[];
  visualPositions: Map<string, Point>;
  lastOptions: RenderOptions;
  combat: CombatFeedback;
  __qaRestoreFoliage?: (decoration: Decoration) => number;
};

const troops = [
  {type: 'ranger', kind: 'commander', tile: {x: 13, y: 12}, offset: {x: -.13, y: -.10}},
  {type: 'swordsman', kind: 'unit', tile: {x: 10, y: 11}, offset: {x: -.20, y: -.12}},
  {type: 'archer', kind: 'unit', tile: {x: 13, y: 8}, offset: {x: -.10, y: -.20}},
  {type: 'spearman', kind: 'unit', tile: {x: 9, y: 15}, offset: {x: -.15, y: -.15}},
] as const;

function controlledScene() {
  const state = createGame({commander: 'ranger', mapSize: 'small', aiPlayers: 1, seed: 'FOLIAGE-READABILITY-20261008'});
  state.map.biome = 'desert';
  state.map.tiles.fill('grass');
  state.map.nodes = [];
  state.entities = [];
  state.events = [];
  state.paused = true;
  state.players.forEach(player => { player.ai = false; });
  // These controlled forest tiles use production decoration generation, including the two
  // overlapping rounded crowns at (13, 12). Nearby trees have no actor behind them.
  for (const {x, y} of [...troops.map(troop => troop.tile), {x: 12, y: 14}, {x: 15, y: 12}]) {
    state.map.tiles[y * state.map.width + x] = 'forest';
  }
  const actors = troops.map(troop => {
    const entity = spawnEntity(state, 0, troop.kind, troop.type, troop.tile.x + .4, troop.tile.y + .4);
    entity.facing = Math.PI / 4;
    entity.order = {type: 'hold'};
    return {...troop, id: entity.id};
  });
  spawnEntity(state, 0, 'building', 'keep', 3, 3);
  spawnEntity(state, 1, 'building', 'keep', state.map.width - 4, state.map.height - 4);
  updateFog(state);
  return {state, actors};
}

async function paintedFrame(page: Page) {
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}

async function centerActor(page: Page, id: string) {
  await page.evaluate(id => {
    const {state, renderer} = window.__FRONTIER__;
    const actor = state.entities.find(entity => entity.id === id)!;
    const r = renderer as unknown as RendererProbe;
    r.camera.zoom = 1;
    r.centerOn(actor.x, actor.y);
    if (innerHeight < 500) r.pan(0, 45);
  }, id);
  await paintedFrame(page);
}

async function prepare(page: Page, theme: Theme) {
  const fixture = controlledScene();
  await launch(page, {commander: 'ranger'});
  await pause(page);
  await page.evaluate(async ({theme, fixture}) => {
    const live = window.__FRONTIER__, r = live.renderer as unknown as RendererProbe;
    if (!await r.setVisualTheme(theme)) throw new Error(`Could not load ${theme} artwork`);
    Object.assign(live.state, fixture.state);
    r.invalidateTerrain();
    r.combat.reset();
    const decor = r.ensureTerrain(live.state.map).decor;
    for (const actor of fixture.actors) {
      const tree = decor.find(item => item.kind === 'tree' && item.size > .7 && Math.floor(item.x) === actor.tile.x && Math.floor(item.y) === actor.tile.y);
      if (!tree) throw new Error(`No generated tree for ${actor.type}`);
      const entity = live.state.entities.find(entity => entity.id === actor.id)!;
      entity.x = tree.x + actor.offset.x;
      entity.y = tree.y + actor.offset.y;
    }
    r.visualPositions.clear();
    const hero = live.state.entities.find(entity => entity.id === fixture.actors[0].id)!;
    r.centerOn(hero.x, hero.y);
    r.camera.zoom = 1;
  }, {theme, fixture});
  if (!await page.locator('.command-deck').evaluate(element => element.classList.contains('collapsed'))) {
    await action(page, 'toggle-deck').click();
  }
  await paintedFrame(page);
  // An ordinary native empty-ground tap clears selection and camera following.
  await tap(page, await clearGround(page));
  await expect(page.locator('#selection-info')).toContainText('Select a unit');
  await centerActor(page, fixture.actors[0].id);
  return fixture;
}

async function bodyContact(page: Page, id: string) {
  return page.evaluate(id => {
    const {state, renderer} = window.__FRONTIER__, r = renderer as unknown as RendererProbe;
    const hit = r.entityHits.get(id);
    if (!hit) throw new Error(`No painted source frame for ${id}`);
    const source = document.createElement('canvas');
    source.width = hit.frame.w; source.height = hit.frame.h;
    const context = source.getContext('2d', {willReadFrequently: true})!;
    context.drawImage(hit.image, hit.frame.x, hit.frame.y, hit.frame.w, hit.frame.h, 0, 0, source.width, source.height);
    const pixels = context.getImageData(0, 0, source.width, source.height).data;
    const candidates: {x: number; y: number; sourceAlpha: number; score: number}[] = [];
    // A bounded grid of actual source-frame pixels, never a transparent hit box.
    for (let row = 2; row <= 14; row++) for (let column = 2; column <= 14; column++) {
      const x = Math.min(source.width - 1, Math.floor(source.width * column / 16));
      const y = Math.min(source.height - 1, Math.floor(source.height * row / 16));
      const alpha = pixels[(y * source.width + x) * 4 + 3];
      if (alpha < 200) continue;
      const point = new DOMPoint(hit.bounds.x + (x + .5) / source.width * hit.bounds.width, hit.bounds.y + (y + .5) / source.height * hit.bounds.height).matrixTransform(hit.matrix);
      candidates.push({x: point.x, y: point.y, sourceAlpha: alpha, score: Math.hypot(column / 16 - .5, row / 16 - .55)});
    }
    const clearance = navigator.maxTouchPoints > 0 ? 20 : 3;
    for (const point of candidates.sort((a, b) => a.score - b.score).slice(0, 64)) {
      const canvasContact = [-clearance, 0, clearance].every(dx => [-clearance, 0, clearance].every(dy => document.elementFromPoint(point.x + dx, point.y + dy)?.id === 'world'));
      const bodyPicked = [-2, 0, 2].every(dx => [-2, 0, 2].every(dy => r.pick(state, point.x + dx, point.y + dy)?.id === id));
      if (canvasContact && bodyPicked) return {...point, clearance, spriteOpacity: hit.opacity};
    }
    throw new Error(`No unobstructed native contact on a painted body pixel for ${id}`);
  }, id);
}

async function opacityReport(page: Page, id: string) {
  return page.evaluate(id => {
    const {state, renderer} = window.__FRONTIER__, r = renderer as unknown as RendererProbe;
    const actor = state.entities.find(entity => entity.id === id)!;
    return {
      actor: {id, type: actor.type, x: actor.x, y: actor.y},
      trees: r.ensureTerrain(state.map).decor.filter(item => item.kind === 'tree').map(tree => ({
        x: tree.x, y: tree.y, variant: tree.variant, opacity: r.decorationOpacity(tree),
        nearActor: Math.hypot(tree.x - actor.x, tree.y - actor.y) < 1,
      })),
      readable: r.readableActors.some(item => item.value.id === id),
    };
  }, id);
}

async function stopFollowingWithNativePan(page: Page) {
  const point = await clearGround(page);
  if (await page.evaluate(() => navigator.maxTouchPoints > 0)) {
    // Chromium's native touch input path, not page-dispatched PointerEvents.
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

async function comparisonScreenshots(page: Page, theme: Theme) {
  if (test.info().project.name === 'desktop') return;
  await expect(page.locator('#toast'), 'Transient feedback must retire before the paired captures').not.toHaveClass(/\bshow\b/);
  await paintedFrame(page);
  const snapshot = () => page.evaluate(() => ({
    camera: {...window.__FRONTIER__.renderer.camera},
    state: JSON.stringify(window.__FRONTIER__.state),
    profile: JSON.stringify(window.__FRONTIER__.profile),
    selection: document.querySelector('#selection-info strong')?.textContent,
  }));
  const before = await snapshot();
  try {
    await page.evaluate(() => {
      const r = window.__FRONTIER__.renderer as unknown as RendererProbe;
      r.__qaRestoreFoliage = r.decorationOpacity;
      r.decorationOpacity = () => 1;
    });
    await paintedFrame(page);
    const path = test.info().outputPath(`${theme}-controlled-desert-fixture-pre-fix-tree-opacity-1.png`);
    await page.screenshot({path, scale: 'css'});
    await test.info().attach('Controlled fixture: pre-fix opaque-tree rendering, not natural gameplay', {path, contentType: 'image/png'});
  } finally {
    await page.evaluate(() => {
      const r = window.__FRONTIER__.renderer as unknown as RendererProbe;
      if (r.__qaRestoreFoliage) r.decorationOpacity = r.__qaRestoreFoliage;
      delete r.__qaRestoreFoliage;
    });
    await paintedFrame(page);
  }
  const path = test.info().outputPath(`${theme}-controlled-desert-fixture-local-foliage-fade.png`);
  await page.screenshot({path, scale: 'css'});
  await test.info().attach('Controlled fixture: final local foliage fade, same scene and camera', {path, contentType: 'image/png'});
  expect(await snapshot(), 'The screenshot pair preserves camera, selection, paused fixture state and profile').toEqual(before);
}

for (const theme of ['christmas', 'mythic'] as const) {
  test(`${theme} controlled desert foliage permits native Ranger and troop body selection and Move`, async ({page}) => {
    test.setTimeout(60_000);
    const fixture = await prepare(page, theme), ranger = fixture.actors[0];
    const initial = await page.evaluate(() => JSON.stringify({state: window.__FRONTIER__.state, profile: window.__FRONTIER__.profile}));
    const unselected = await opacityReport(page, ranger.id);
    expect(unselected.readable).toBe(true);
    expect(unselected.trees.filter(tree => tree.nearActor && tree.opacity < 1).length).toBeGreaterThanOrEqual(2);
    expect(unselected.trees.some(tree => !tree.nearActor && tree.opacity === 1)).toBe(true);
    const contacts = [];
    const contact = await bodyContact(page, ranger.id);
    await tap(page, contact);
    await expect(page.locator('#selection-info')).toContainText('Ranger');
    await stopFollowingWithNativePan(page);
    await centerActor(page, ranger.id);
    await expect(page.locator('#selection-info')).toContainText('Ranger');
    const selected = await opacityReport(page, ranger.id);
    expect(selected.trees).toEqual(unselected.trees);
    expect(await page.evaluate(() => JSON.stringify({state: window.__FRONTIER__.state, profile: window.__FRONTIER__.profile}))).toEqual(initial);
    contacts.push({type: 'ranger', ...contact});
    await comparisonScreenshots(page, theme);

    for (const actor of fixture.actors.slice(1)) {
      await centerActor(page, actor.id);
      const point = await bodyContact(page, actor.id), report = await opacityReport(page, actor.id);
      expect(report.trees.some(tree => tree.nearActor && tree.opacity < 1)).toBe(true);
      await tap(page, point);
      await expect(page.locator('#selection-info')).toContainText(actor.type[0].toUpperCase() + actor.type.slice(1));
      contacts.push({type: actor.type, ...point});
    }
    expect(await page.evaluate(() => JSON.stringify({state: window.__FRONTIER__.state, profile: window.__FRONTIER__.profile}))).toEqual(initial);
    // Actual input and simulation movement, after the explicitly injected fixture.
    const mover = fixture.actors[1];
    await centerActor(page, mover.id); await tap(page, await bodyContact(page, mover.id));
    const start = await page.evaluate(id => {
      const entity = window.__FRONTIER__.state.entities.find(entity => entity.id === id)!;
      return {x: entity.x, y: entity.y};
    }, mover.id);
    await action(page, 'order-move').click();
    const destination = await clearGround(page); await tap(page, destination);
    await expect.poll(() => page.evaluate(() => window.__FRONTIER__.state.pendingCommands.at(-1))).toMatchObject({type: 'move', entityIds: [mover.id]});
    await resume(page);
    await expect.poll(() => page.evaluate(({id, start}) => {
      const entity = window.__FRONTIER__.state.entities.find(entity => entity.id === id)!;
      return Math.hypot(entity.x - start.x, entity.y - start.y);
    }, {id: mover.id, start}), {timeout: 10_000}).toBeGreaterThan(.5);
    await pause(page);
    const moved = await page.evaluate(id => {
      const entity = window.__FRONTIER__.state.entities.find(entity => entity.id === id)!;
      return {x: entity.x, y: entity.y, order: entity.order, time: window.__FRONTIER__.state.time};
    }, mover.id);
    await test.info().attach('Controlled foliage fixture native-input evidence', {contentType: 'application/json', body: JSON.stringify({
      kind: 'Controlled test fixture, not natural gameplay', theme, biome: 'desert',
      project: test.info().project.name, unselected, selected, contacts, start, destination, moved,
      comparison: 'Pre-fix decorative tree opacity 1 versus final renderer; same controlled forest tiles and production-generated decor/assets',
    }, null, 2)});
  });

  test(`${theme} foliage stays local, respects fog and restores after overlap in bounded render fixtures`, async ({page}) => {
    test.setTimeout(60_000);
    const fixture = await prepare(page, theme);
    const evidence = await page.evaluate(async ({theme, id}) => {
      const live = window.__FRONTIER__, original = live.renderer as unknown as RendererProbe;
      const liveBefore = JSON.stringify({state: live.state, profile: live.profile});
      const canvas = document.createElement('canvas'), r = new original.constructor(canvas);
      r.resize(innerWidth, innerHeight, devicePixelRatio);
      if (!await r.setVisualTheme(theme)) throw new Error(`Could not load ${theme} fixture artwork`);
      const base = structuredClone(live.state), sourceActor = base.entities.find(entity => entity.id === id)!;
      const results = [];
      const modes = [
        {biome: 'desert', quality: 'high', reducedMotion: false, zoom: .85},
        {biome: 'desert', quality: 'low', reducedMotion: true, zoom: 1.25},
        {biome: 'grasslands', quality: 'high', reducedMotion: true, zoom: 1},
        {biome: 'snow', quality: 'low', reducedMotion: false, zoom: 1},
      ] as const;
      for (const mode of modes) {
        const state = structuredClone(base);
        state.map.biome = mode.biome;
        state.map.tiles.fill('grass'); state.map.tiles[12 * state.map.width + 13] = 'forest';
        state.map.tiles[14 * state.map.width + 12] = 'forest'; // nearby opaque context
        const actor = structuredClone(sourceActor); state.entities = [actor];
        state.events = [];
        state.fog.explored[0].fill(1); state.fog.visible[0].fill(1);
        const decor = r.ensureTerrain(state.map).decor.filter(item => item.kind === 'tree');
        const tree = decor.find(item => Math.floor(item.x) === 13 && Math.floor(item.y) === 12 && item.size > .7)!;
        r.centerOn(tree.x, tree.y); r.camera.zoom = mode.zoom;
        const options: RenderOptions = {quality: mode.quality, reducedMotion: mode.reducedMotion, time: state.time, reveal: false};
        const variants = mode.biome === 'desert'
          ? ['unselected', 'selected', 'visible-enemy', 'hidden-enemy', 'dead', 'respawning', 'in-front', 'off-axis', 'moved-away']
          : ['unselected', 'moved-away'];
        for (const variant of variants) {
          Object.assign(actor, sourceActor, {x: tree.x - .13, y: tree.y - .1});
          state.fog.visible[0].fill(1);
          if (variant === 'visible-enemy' || variant === 'hidden-enemy') actor.team = 1;
          if (variant === 'hidden-enemy') state.fog.visible[0].fill(0);
          if (variant === 'dead') actor.hp = 0;
          if (variant === 'respawning') actor.respawnAt = state.time + 20;
          if (variant === 'in-front') { actor.x = tree.x + .35; actor.y = tree.y + .35; }
          if (variant === 'off-axis') { actor.x = tree.x + 1.3; actor.y = tree.y - 1.6; }
          if (variant === 'moved-away') { actor.x = tree.x - 4; actor.y = tree.y - 4; }
          r.visualPositions.clear();
          r.combat.reset();
          const selection = variant === 'selected' ? [actor.id] : [];
          const stateBefore = JSON.stringify(state);
          r.render(state, selection, options);
          const opacities = decor.map(decoration => ({x: decoration.x, y: decoration.y, opacity: r.decorationOpacity(decoration)}));
          const expectedFade = ['unselected', 'selected', 'visible-enemy'].includes(variant);
          const faded = opacities.filter(tree => tree.opacity < 1);
          if (expectedFade && !faded.length) throw new Error(`${mode.biome}/${variant}: actor remains behind opaque foliage`);
          if (!expectedFade && faded.length) throw new Error(`${mode.biome}/${variant}: unrelated or invisible actor faded foliage`);
          if (!opacities.some(tree => tree.opacity === 1)) throw new Error(`${mode.biome}/${variant}: nearby foliage lost its depth context`);
          if (faded.some(tree => tree.opacity < 0 || tree.opacity > .32)) throw new Error(`${variant}: unsafe tree alpha`);
          const readable = r.readableActors.some(item => item.value.id === actor.id);
          if (['hidden-enemy', 'dead', 'respawning'].includes(variant) && readable) throw new Error(`${variant}: invisible actor reached readability inputs`);
          const ground = r.worldToScreen(actor.x, actor.y);
          if (variant === 'hidden-enemy' && r.pick(state, ground.x, ground.y - 20 * mode.zoom)?.id === actor.id) throw new Error('Hidden enemy became pickable');
          let pixels: {samples: number; beforeError: number; afterError: number; improvement: number} | undefined;
          if (mode.biome === 'desert' && variant === 'unselected') {
            const hit = r.entityHits.get(actor.id)!;
            const bitmap = document.createElement('canvas'); bitmap.width = hit.frame.w; bitmap.height = hit.frame.h;
            const c = bitmap.getContext('2d', {willReadFrequently: true})!;
            c.drawImage(hit.image, hit.frame.x, hit.frame.y, hit.frame.w, hit.frame.h, 0, 0, bitmap.width, bitmap.height);
            const alpha = c.getImageData(0, 0, bitmap.width, bitmap.height).data;
            const points: Point[] = [];
            for (let y = 0; y < bitmap.height; y += Math.max(1, Math.floor(bitmap.height / 45))) for (let x = 0; x < bitmap.width; x += Math.max(1, Math.floor(bitmap.width / 35))) {
              if (alpha[(y * bitmap.width + x) * 4 + 3] < 200) continue;
              const p = new DOMPoint(hit.bounds.x + (x + .5) / bitmap.width * hit.bounds.width, hit.bounds.y + (y + .5) / bitmap.height * hit.bounds.height).matrixTransform(hit.matrix);
              if (p.x > 0 && p.x < innerWidth && p.y > 0 && p.y < innerHeight) points.push({x: p.x, y: p.y});
            }
            if (!points.length) throw new Error('No opaque body pixels in the controlled comparison');
            const left = Math.floor(Math.min(...points.map(point => point.x)) * r.dpr);
            const top = Math.floor(Math.min(...points.map(point => point.y)) * r.dpr);
            const width = Math.ceil(Math.max(...points.map(point => point.x)) * r.dpr) - left + 1;
            const height = Math.ceil(Math.max(...points.map(point => point.y)) * r.dpr) - top + 1;
            const read = () => {
              const data = r.context.getImageData(left, top, width, height).data;
              return points.map(point => {
                const index = ((Math.floor(point.y * r.dpr) - top) * width + Math.floor(point.x * r.dpr) - left) * 4;
                return [data[index], data[index + 1], data[index + 2]];
              });
            };
            const opacity = r.decorationOpacity;
            try {
              const after = read();
              r.decorationOpacity = () => 1; r.render(state, selection, options); const before = read();
              r.decorationOpacity = decoration => decoration.kind === 'tree' ? 0 : opacity.call(r, decoration);
              r.render(state, selection, options); const reference = read();
              let beforeError = 0, afterError = 0;
              points.forEach((_, index) => { for (let channel = 0; channel < 3; channel++) {
                beforeError += Math.abs(before[index][channel] - reference[index][channel]);
                afterError += Math.abs(after[index][channel] - reference[index][channel]);
              }});
              pixels = {samples: points.length, beforeError, afterError, improvement: 1 - afterError / beforeError};
              if (points.length < 30 || beforeError < 500 || afterError >= beforeError * .7) throw new Error(`Body pixels did not become readable: ${JSON.stringify(pixels)}`);
            } finally { r.decorationOpacity = opacity; r.render(state, selection, options); }
          }
          if (JSON.stringify(state) !== stateBefore) throw new Error('Rendering mutated its controlled fixture state');
          results.push({mode, variant, opacities, readable, pixels});
        }
      }
      const activeFrameEdges = [];
      if (theme === 'mythic') {
        const state = structuredClone(base), actor = structuredClone(sourceActor);
        state.map.biome = 'desert'; state.map.tiles.fill('grass');
        state.map.tiles[12 * state.map.width + 13] = 'forest';
        state.entities = [actor]; state.events = [];
        state.fog.visible[0].fill(1); state.fog.explored[0].fill(1);
        const tree = r.ensureTerrain(state.map).decor.find(item => item.kind === 'tree' && item.size > .7)!;
        const treeSprite = r.decorationSprite(tree, state.map.biome);
        const treePixels = treeSprite.getContext('2d')!.getImageData(0, 0, treeSprite.width, treeSprite.height).data;
        let treeLeft = Infinity, treeRight = -Infinity;
        for (let y = 0; y < treeSprite.height; y++) for (let x = 0; x < treeSprite.width; x++) {
          if (treePixels[(y * treeSprite.width + x) * 4 + 3] < 128) continue;
          treeLeft = Math.min(treeLeft, (x - 50) * tree.size);
          treeRight = Math.max(treeRight, (x + 1 - 50) * tree.size);
        }
        r.centerOn(tree.x, tree.y); r.camera.zoom = 1;
        const options: RenderOptions = {time: state.time, reveal: false, reducedMotion: false, quality: 'high'};
        // Four known authored poses, at most 36 offsets each. This checks only
        // one actor against one generated crown, not a map-wide pair scan.
        for (const pose of [
          {type: 'cavalry', heading: 6, walk: 3, halfWidth: 25.5},
          {type: 'archer', heading: 12, walk: 0, halfWidth: 19},
          {type: 'spearman', heading: 3, walk: 3, halfWidth: 19},
          {type: 'swordsman', heading: 0, walk: 2, halfWidth: 19},
        ] as const) {
          const screenAngle = pose.heading * Math.PI / 8 - Math.PI / 2;
          Object.assign(actor, sourceActor, {kind: 'unit', type: pose.type, x: tree.x, y: tree.y,
            facing: Math.atan2(Math.sin(screenAngle) - Math.cos(screenAngle) / 2, Math.sin(screenAngle) + Math.cos(screenAngle) / 2)});
          r.visualPositions.clear(); r.combat.reset(); r.render(state, [], options);
          const directional = r.directionalFor(pose.type), definition = directional.data!.actors[pose.type];
          const expectedFrame = directional.data!.frames[definition.directions[pose.heading].walk[pose.walk]];
          // Controlled presentation memory selects a real authored walking frame.
          // It does not pretend that this isolated renderer fixture walked there.
          r.combat.locomotion.set(actor.id, {x: actor.x, y: actor.y, time: state.time,
            distance: (pose.walk + .25) * definition.walkFrameMs * 2.3 / 1000, speed: 0, moving: true});
          r.render(state, [], options);
          const hit = r.entityHits.get(actor.id)!;
          if (hit.frame.x !== expectedFrame.x || hit.frame.y !== expectedFrame.y) throw new Error(`${pose.type}: fixture missed the requested active frame`);
          const bitmap = document.createElement('canvas'); bitmap.width = hit.frame.w; bitmap.height = hit.frame.h;
          const context = bitmap.getContext('2d', {willReadFrequently: true})!;
          context.drawImage(hit.image, hit.frame.x, hit.frame.y, hit.frame.w, hit.frame.h, 0, 0, bitmap.width, bitmap.height);
          const alpha = context.getImageData(0, 0, bitmap.width, bitmap.height).data;
          const ground = r.worldToScreen(actor.x, actor.y), body: Point[] = [];
          for (let y = 0; y < bitmap.height; y += 2) for (let x = 0; x < bitmap.width; x += 2) {
            if (alpha[(y * bitmap.width + x) * 4 + 3] < 200) continue;
            const point = new DOMPoint(hit.bounds.x + (x + .5) / bitmap.width * hit.bounds.width, hit.bounds.y + (y + .5) / bitmap.height * hit.bounds.height).matrixTransform(hit.matrix);
            if (Math.abs(point.x - ground.x) > pose.halfWidth + 2) body.push({x: point.x - ground.x, y: point.y - ground.y});
          }
          let contact: {dx: number; dy: number; bodyPixel: Point} | undefined;
          for (const dx of [-70, -66, -62, -58, -54, -50, 50, 54, 58, 62, 66, 70]) {
            if (!(dx + pose.halfWidth < treeLeft - 1 || dx - pose.halfWidth > treeRight + 1)) continue;
            for (const dy of [-3, -7, -11]) {
              const bodyPixel = body.find(point => {
                const x = Math.floor((dx + point.x) / tree.size + 50), y = Math.floor((dy + point.y) / tree.size + 99);
                return x >= 0 && y >= 0 && x < treeSprite.width && y < treeSprite.height && treePixels[(y * treeSprite.width + x) * 4 + 3] >= 200;
              });
              if (bodyPixel) { contact = {dx, dy, bodyPixel}; break; }
            }
            if (contact) break;
          }
          if (!contact) continue;
          actor.x = tree.x + contact.dx / 72 + contact.dy / 36;
          actor.y = tree.y - contact.dx / 72 + contact.dy / 36;
          r.visualPositions.clear();
          const before = JSON.stringify(state); r.render(state, [], options);
          if (r.decorationOpacity(tree) >= 1) throw new Error(`${pose.type}: an opaque active-frame edge outside the old nominal body box is still covered`);
          if (JSON.stringify(state) !== before) throw new Error('Active-frame rendering mutated its controlled state');
          activeFrameEdges.push({actor: pose.type, heading: pose.heading, walk: pose.walk, contact, opacity: r.decorationOpacity(tree), nominalBodyAndGroundHorizontallyClear: true});
        }
        if (!activeFrameEdges.length) throw new Error('No authored active-frame edge fixture intersects the generated rounded crown');
      }
      if (JSON.stringify({state: live.state, profile: live.profile}) !== liveBefore) throw new Error('Isolated render fixtures mutated the paused live fixture');
      return {kind: 'Controlled renderer fixtures, not natural gameplay', theme, results, activeFrameEdges};
    }, {theme, id: fixture.actors[0].id});
    await test.info().attach('Bounded foliage geometry, fog and body-pixel evidence', {body: JSON.stringify(evidence, null, 2), contentType: 'application/json'});
    expect(evidence.results).toHaveLength(22);
  });
}
