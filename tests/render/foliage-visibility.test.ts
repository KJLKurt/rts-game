import { afterEach, describe, expect, it, vi } from 'vitest';
import { Battlefield } from '../../src/render/Battlefield';
import { FOLIAGE_ALPHA_BUDGET, foliageMask, foliageOpacities, foliageSilhouette, type FoliageActor, type FoliageTree } from '../../src/render/foliage-visibility';
import { createGame, spawnEntity } from '../../src/sim/engine';
import { readFileSync } from 'node:fs';
import type { DirectionalData } from '../../src/render/DirectionalAtlas';

function pixels(rectangles: [number, number, number, number, number?][]) {
 const rgba = new Uint8ClampedArray(100 * 110 * 4);
 for (const [left, top, width, height, alpha = 255] of rectangles)
  for (let y = top; y < top + height; y++) for (let x = left; x < left + width; x++) rgba[(y * 100 + x) * 4 + 3] = alpha;
 return rgba;
}
const rgba = pixels([[30, 29, 40, 55], [47, 84, 6, 15], [25, 99, 50, 8, 60]]);
const mask = foliageMask(100, 110, rgba);
const actor = (overrides: Partial<FoliageActor> = {}): FoliageActor => ({ x: 0, y: -8, order: 10, width: 36, height: 45, groundRadius: 19, ...overrides });
const tree = (overrides: Partial<FoliageTree> = {}): FoliageTree => ({ x: 0, y: 0, order: 11, size: 1, mask, ...overrides });
afterEach(() => vi.unstubAllGlobals());

describe('foreground foliage readability', () => {
 it('fades painted foreground overlap, preserving trees behind or beside actors', () => {
  const result=foliageOpacities([tree(), tree({ order: 9 }), tree({ order: 10 }), tree({ x: 100 })], [actor()]);
  expect(result[0]).toBeCloseTo(FOLIAGE_ALPHA_BUDGET);expect(result.slice(1)).toEqual([1,1,1]);
 });
 it.each([.5, .75, 1.03])('tracks the scaled canopy and actor footprint at size %s', size => {
  for (const [x, y] of [[0, -8], [-15, -6], [15, -24]]) {
   const result = foliageOpacities([tree({ size })], [actor({ x: x * size, y: y * size, width: 36 * size, height: 45 * size, groundRadius: 19 * size })]);
   expect(result[0]).toBeCloseTo(FOLIAGE_ALPHA_BUDGET);
  }
 });
 it('does not fade transparent sprite corners, low-alpha shadows, or empty masks', () => {
  const narrowTop = foliageMask(100, 110, pixels([[49, 29, 2, 25], [25, 79, 50, 5]]));
  expect(foliageOpacities([tree({ mask: narrowTop })], [actor({ x: 20, y: -55, height: 5, width: 10, groundRadius: 0 })])).toEqual([1]);
  const shadow = foliageMask(100, 110, pixels([[25, 25, 50, 75, 60]]));
  expect(foliageOpacities([tree({ mask: shadow }), tree({ mask: foliageMask(100, 110, pixels([])) })], [actor()])).toEqual([1, 1]);
 });
 it('protects extended pose pixels outside nominal bodies while excluding transparent actor padding', () => {
  const silhouette = [{ x: 55, y: -36, width: 6, height: 12 }];
  const limb = foliageMask(100, 110, pixels([[48, 66, 5, 8]]));
  expect(foliageOpacities([tree({ x: 58, mask: limb })], [actor({ y: 0, silhouette, groundRadius: 0 })])[0]).toBeCloseTo(FOLIAGE_ALPHA_BUDGET);
  expect(foliageOpacities([tree({ mask: limb })], [actor({ y: 0, silhouette, groundRadius: 0 })])).toEqual([1]);
  const raised = [{ x: -3, y: -81, width: 6, height: 5 }];
  expect(foliageOpacities([tree({ y: -45, mask: limb })], [actor({ y: 0, silhouette: raised, groundRadius: 0 })])[0]).toBeCloseTo(FOLIAGE_ALPHA_BUDGET);
 });
 it('compresses real alpha into bounded spans, including an odd final row and column', () => {
  const rgba = new Uint8ClampedArray(5 * 3 * 4);
  rgba[(2 * 5 + 4) * 4 + 3] = 255;
  expect(foliageSilhouette(5, 3, rgba, { x: -10, y: -6, width: 10, height: 6 })).toEqual([{ x: -2, y: -2, width: 2, height: 2 }]);
 });
 it('protects a ground marker when the actor body itself is clear of a trunk', () => {
  const trunk = foliageMask(100, 110, pixels([[47, 85, 6, 14]]));
  const beside = actor({ x: 20, y: -5, width: 10, height: 10, groundRadius: 25 });
  expect(foliageOpacities([tree({ mask: trunk })], [beside])[0]).toBeCloseTo(FOLIAGE_ALPHA_BUDGET);
  expect(foliageOpacities([tree({ mask: trunk })], [{ ...beside, groundRadius: 0 }])).toEqual([1]);
 });
 it.each([1, 3, 8, 20])('caps cumulative opacity for %s overlapping trees', count => {
  const result = foliageOpacities(Array.from({ length: count }, (_, index) => tree({ order: 11 + index })), [actor()]);
  expect(result.every(value => value > 0 && value < 1)).toBe(true);
  expect(1 - result.reduce((transmission, alpha) => transmission * (1 - alpha), 1)).toBeCloseTo(FOLIAGE_ALPHA_BUDGET, 12);
 });
 it('uses the lower opacity when actors share a tree and preserves distant forest', () => {
  const trees = [tree(), tree({ x: 35 }), tree({ x: 1000 })];
  const actors = [actor({ x: -10, width: 10, groundRadius: 0 }), actor({ x: 18, width: 12, groundRadius: 0 })];
  const result = foliageOpacities(trees, actors);
  expect(result[0]).toBeCloseTo(1 - Math.sqrt(1 - FOLIAGE_ALPHA_BUDGET));
  expect(result[1]).toBeCloseTo(result[0]);
  expect(result[2]).toBe(1);
 });
 it('handles 600 spatially separated actors and repeated camera-independent geometry', () => {
  const actors = Array.from({ length: 600 }, (_, index) => actor({ x: index * 180 }));
  const trees = Array.from({ length: 600 }, (_, index) => tree({ x: index * 180 }));
  expect(foliageOpacities(trees, actors).every(alpha => Math.abs(alpha - FOLIAGE_ALPHA_BUDGET) < 1e-12)).toBe(true);
  expect(foliageOpacities([tree()], [])).toEqual([1]);
 });
});

function rendererFixture() {
 const readback = vi.fn((_x = 0, _y = 0, width = 100, height = 110) => ({ data: width === 100 && height === 110 ? rgba : new Uint8ClampedArray(width * height * 4).fill(255) }));
 const context = new Proxy({ globalAlpha: 1 }, {
  get(target, key) {
   if (key === 'getImageData') return readback;
   if (key === 'createRadialGradient') return () => ({ addColorStop() {} });
   if (key in target) return target[key as keyof typeof target];
   return () => {};
  },
  set(target, key, value) { Reflect.set(target, key, value); return true; },
 });
 const canvas = () => ({ width: 800, height: 600, style: {}, getContext: () => context }) as unknown as HTMLCanvasElement;
 vi.stubGlobal('document', { createElement: canvas, baseURI: 'https://example.test/' });
 vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })));
 const view = new Battlefield(canvas());
 view.resize(800, 600, 1); view.centerOn(10, 10);
 const state = createGame({ mapSize: 'tiny' });
 state.entities = []; state.map.nodes = []; state.events = [];
 state.fog.visible[0].fill(1); state.fog.explored[0].fill(1);
 const decor = [
  { x: 10.5, y: 10.5, kind: 'tree' as const, variant: 1, size: 1 },
  { x: 10.8, y: 10.8, kind: 'tree' as const, variant: 1, size: .75 },
  { x: 10.5, y: 10.5, kind: 'rock' as const, variant: 1, size: 1 },
  { x: 10.5, y: 10.5, kind: 'ruin' as const, variant: 1, size: 1 },
 ];
 const internal = view as unknown as {
  ensureTerrain: () => unknown; treeOpacities: Map<object, number>; decorationOpacity: (d: object) => number;
  visualPositions: Map<string, { x: number; y: number }>; frameTime: number;
  drawEntity: () => void; drawDecoration: () => void; drawFog: () => void; drawTroopSummaries: () => void;
 };
 internal.ensureTerrain = () => ({ canvas: canvas(), ox: 0, oy: 0, width: 800, height: 600, decor, water: [] });
 internal.drawEntity = vi.fn(); internal.drawDecoration = vi.fn(); internal.drawFog = vi.fn(); internal.drawTroopSummaries = vi.fn();
 return { state, view, internal, readback, decor };
}

describe('Battlefield foliage integration', () => {
 it.each([
  ['ranger', 'commander', 'ranger-NNW-attack-1'],
  ['cavalry', 'unit', 'cavalry-ESE-attack-2'],
  ['spearman', 'unit', 'spearman-E-attack-2'],
  ['swordsman', 'unit', 'swordsman-WSW-attack-2'],
  ['archer', 'unit', 'archer-N-attack-1'],
 ] as const)('shares the shipped %s active-frame ground pivot and body scale with painting', (type, kind, frameName) => {
  const { state, view } = rendererFixture();
  const data = JSON.parse(readFileSync(new URL(`../../public/assets/render/themes/mythic-toon/${type}-directional.json`, import.meta.url), 'utf8')) as DirectionalData;
  const e = spawnEntity(state, 0, kind, type, 10, 10);
  const internals = view as unknown as {
   directionalAtlas: { image: object; data: DirectionalData; frame: () => string };
   mobileArt: (entity: typeof e, pose: object, moving: boolean, travel: number, options: object) => { bounds: { x: number; y: number; width: number; height: number }; frame: object; image: object };
  };
  const image = {};
  internals.directionalAtlas = { image, data, frame: () => frameName };
  const art = internals.mobileArt(e, { age: .1, anticipation: 0, direction: { x: 1, y: 0 } }, false, 0, {});
  const source = data.frames[frameName], scale = (kind === 'commander' ? 59 : type === 'cavalry' ? 48 : 45) / source.bodyHeight;
  expect(art.bounds).toEqual({ x: -source.groundPivot.x * scale, y: -source.groundPivot.y * scale, width: source.w * scale, height: source.h * scale });
  expect(art.frame).toBe(source); expect(art.image).toBe(image);
 });
 it('reuses one alpha read per tree sprite across sizes and frames and leaves rocks/ruins opaque', () => {
  const { state, view, internal, readback, decor } = rendererFixture();
  spawnEntity(state, 0, 'commander', 'ranger', 10, 10);
  for (const zoom of [.42, 1, 2.4]) { view.camera.zoom = zoom; view.render(state, [], { reducedMotion: true }); }
  expect(readback).toHaveBeenCalledTimes(1);
  expect(internal.treeOpacities.size).toBe(2);
  expect(internal.decorationOpacity(decor[2])).toBe(1);
  expect(internal.decorationOpacity(decor[3])).toBe(1);
 });
 it('caches authored pixels by source frame across positions, zoom and time, and skips open ground', () => {
  const { state, view, internal, readback } = rendererFixture();
  const ranger = spawnEntity(state, 0, 'commander', 'ranger', 10, 10);
  view.atlas.ready = true; view.atlas.image = {} as HTMLImageElement;
  view.atlas.frames.ranger = { x: 0, y: 0, w: 100, h: 110, anchorX: .5, anchorY: .9 };
  for (const zoom of [.42, 1, 2.4]) {
   ranger.x += .01; view.camera.zoom = zoom; view.render(state, [], { time: zoom * 100, reducedMotion: true });
  }
  expect(readback).toHaveBeenCalledTimes(2); // One tree source and one actor source.
  const terrain = internal.ensureTerrain() as { decor: object[] };
  terrain.decor = []; internal.ensureTerrain = () => terrain;
  view.atlas.frames.ranger = { x: 100, y: 0, w: 100, h: 110, anchorX: .5, anchorY: .9 };
  view.render(state, [], { reducedMotion: true });
  expect(readback).toHaveBeenCalledTimes(2);
  expect(internal.treeOpacities.size).toBe(0);
 });
 it('caches a conservative tree footprint if readback is unavailable rather than retrying every frame', () => {
  const { state, view, internal, readback } = rendererFixture();
  spawnEntity(state, 0, 'commander', 'ranger', 10, 10);
  readback.mockImplementation(() => { throw new Error('Canvas readback unavailable'); });
  view.render(state, [], { reducedMotion: true }); view.render(state, [], { reducedMotion: true });
  expect(readback).toHaveBeenCalledTimes(1);
  expect(internal.treeOpacities.size).toBeGreaterThan(0);
 });
 it('protects unselected visible enemies but never responds to hidden, dead, respawning or building entities', () => {
  const { state, view, internal } = rendererFixture();
  const enemy = spawnEntity(state, 1, 'unit', 'swordsman', 10, 10);
  view.render(state, [], { reducedMotion: true });
  expect(internal.treeOpacities.size).toBeGreaterThan(0);
  state.fog.visible[0].fill(0);
  view.render(state, [], { reducedMotion: true });
  expect(internal.treeOpacities.size).toBe(0);
  state.fog.visible[0].fill(1); enemy.hp = 0;
  view.render(state, [], { reducedMotion: true });
  expect(internal.treeOpacities.size).toBe(0);
  enemy.hp = enemy.maxHp; enemy.respawnAt = state.time + 10;
  view.render(state, [], { reducedMotion: true });
  expect(internal.treeOpacities.size).toBe(0);
  enemy.respawnAt = null; enemy.kind = 'building'; enemy.type = 'tower';
  view.render(state, [], { reducedMotion: true });
  expect(internal.treeOpacities.size).toBe(0);
 });
 it('uses interpolated painted positions and does not change simulation or picking targets', () => {
  const { state, view, internal } = rendererFixture();
  const ranger = spawnEntity(state, 0, 'commander', 'ranger', 10, 10);
  ranger.x = 11; ranger.y = 9;
  internal.visualPositions.set(ranger.id, { x: 10, y: 10 });
  internal.frameTime = performance.now();
  const before = JSON.stringify(state);
  view.render(state, [ranger.id], { reducedMotion: true });
  expect(internal.treeOpacities.size).toBeGreaterThan(0);
  expect(JSON.stringify(state)).toBe(before);
  const point = view.worldToScreen(10, 10);
  expect(view.pick(state, point.x, point.y - 20)?.id).toBe(ranger.id);
 });
});
