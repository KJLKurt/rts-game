import { afterEach, describe, expect, it, vi } from 'vitest';
import { actorIndicators, MAX_SELECTED_INDICATORS, type ActorIndicator, type IndicatorActor } from '../../src/render/actor-indicators';
import { Battlefield, type RenderOptions } from '../../src/render/Battlefield';
import { createGame, spawnEntity } from '../../src/sim/engine';
import type { Entity, GameState } from '../../src/sim/types';

const game = () => {
 const state = createGame({ mapSize: 'tiny' });
 state.entities = []; state.map.nodes = []; state.events = [];
 return state;
};
const troop = (state: GameState, team = 0) => spawnEntity(state, team, 'unit', 'swordsman', 10, 10);
const actor = (entity: Entity, x = 400, y = 300): IndicatorActor => ({ entity, x, y });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('bounded selected actor indicators', () => {
 it('identifies the exact selected individual among identical troops and preserves own commander identity', () => {
  const state = game(), troops = Array.from({ length: 20 }, () => troop(state));
  const commander = spawnEntity(state, 0, 'commander', 'ranger', 10, 10);
  const enemyCommander = spawnEntity(state, 1, 'commander', 'ranger', 10, 10);
  troops[3].hp /= 2;
  const plans = actorIndicators([...troops, commander, enemyCommander].map(e => actor(e)), new Set([troops[12].id]), 0, 1);
  expect(plans.map(p => p.id)).toEqual([commander.id, troops[12].id]);
  expect(plans.every(p => p.health)).toBe(true);
  expect(plans.map(p => p.commander)).toEqual([true, false]);
  expect(actorIndicators(state.entities.map(e => actor(e)), new Set(), 0, 1).map(p => p.id)).toEqual([commander.id]);
 });
 it('promotes small-subset rings without multiplying health bars, and retains the commander for large selections', () => {
  const state = game(), troops = Array.from({ length: MAX_SELECTED_INDICATORS + 1 }, () => troop(state));
  const commander = spawnEntity(state, 0, 'commander', 'ranger', 10, 10), actors = state.entities.map(e => actor(e));
  const subset = actorIndicators(actors, new Set(troops.slice(0, 3).map(e => e.id)), 0, 1);
  expect(subset.map(p => p.id)).toEqual([...troops.slice(0, 3).map(e => e.id), commander.id]);
  expect(subset.filter(p => p.health).map(p => p.id)).toEqual([commander.id]);
  const all = actorIndicators(actors, new Set(troops.map(e => e.id)), 0, 1);
  expect(all.map(p => p.id)).toEqual([commander.id]);
 });
 it('does not duplicate a selected commander or promote buildings, dead or respawning actors', () => {
  const state = game(), commander = spawnEntity(state, 0, 'commander', 'ranger', 10, 10);
  const dead = troop(state); dead.hp = 0;
  const respawning = troop(state); respawning.respawnAt = 10;
  spawnEntity(state, 0, 'building', 'tower', 10, 10);
  const plans = actorIndicators(state.entities.map(e => actor(e)), new Set(state.entities.map(e => e.id)), 0, 1);
  expect(plans).toHaveLength(1); expect(plans[0]).toMatchObject({ id: commander.id, selected: true, commander: true });
 });
 it.each([.42, 1, 2.4])('keeps readable finite geometry at zoom %s without changing position or state', zoom => {
  const state = game(), selected = troop(state), commander = spawnEntity(state, 0, 'commander', 'ranger', 10, 10);
  const actors = [actor(selected, 123, 456), actor(commander, 123, 456 + 24 * zoom)], before = JSON.stringify(actors);
  const plans = actorIndicators(actors, new Set([selected.id]), 0, zoom);
  expect(plans[1]).toMatchObject({ id: selected.id, x: 123, y: 456 });
  for (const plan of plans) { expect(plan.stroke).toBeGreaterThanOrEqual(1.2); expect(plan.health!.width).toBeGreaterThanOrEqual(24); expect(plan.health!.height).toBeGreaterThanOrEqual(3); }
  expect(plans[0].health!.y).toBe(plans[1].health!.y - Math.max(18, 20 * zoom));
  expect(JSON.stringify(actors)).toBe(before);
 });
 it('bounds the added work for a 600-troop selection and keeps a single actor selectable within it', () => {
  const state = game(), troops = Array.from({ length: 600 }, () => troop(state));
  const commander = spawnEntity(state, 0, 'commander', 'ranger', 10, 10), actors = state.entities.map(e => actor(e));
  expect(actorIndicators(actors, new Set(troops.map(e => e.id)), 0, 1).map(p => p.id)).toEqual([commander.id]);
  expect(actorIndicators(actors, new Set([troops[599].id]), 0, 1).map(p => p.id)).toEqual([commander.id, troops[599].id]);
  expect(actorIndicators(actors, new Set(troops.slice(0, 12).map(e => e.id)), 0, 1)).toHaveLength(13);
 });
});

function rendererFixture() {
 const context = new Proxy({ globalAlpha: 1 }, {
  get(target, key) {
   if (key === 'createRadialGradient') return () => ({ addColorStop() {} });
   if (key in target) return target[key as keyof typeof target];
   return () => {};
  },
  set(target, key, value) { Reflect.set(target, key, value); return true; },
 });
 const canvas = () => ({ width: 800, height: 600, style: {}, getContext: () => context }) as unknown as HTMLCanvasElement;
 vi.stubGlobal('document', { createElement: canvas, baseURI: 'https://example.test/' });
 vi.stubGlobal('Path2D', class {});
 vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })));
 const view = new Battlefield(canvas()); view.resize(800, 600, 1); view.centerOn(10, 10);
 const state = game(); state.fog.visible[0].fill(1); state.fog.explored[0].fill(1);
 const internal = view as unknown as {
  ensureTerrain: () => unknown; drawFog: () => void; drawTroopSummaries: () => void;
  visualPositions: Map<string, { x: number; y: number }>; frameTime: number;
  drawEntity: (c: unknown, e: Entity, selected: boolean, t: number, state: GameState, options: RenderOptions, opacity?: number, marker?: ActorIndicator) => void;
  planActorIndicators: (...args: unknown[]) => ActorIndicator[];
  drawActorIndicators: (c: unknown, indicators: readonly ActorIndicator[], options: RenderOptions) => void;
  bar: (...args: unknown[]) => void;
 };
 internal.ensureTerrain = () => ({ canvas: canvas(), ox: 0, oy: 0, width: 800, height: 600, decor: [], water: [] });
 internal.drawFog = vi.fn(); internal.drawTroopSummaries = vi.fn();
 return { view, state, internal };
}

describe('Battlefield priority indicator integration', () => {
 it('paints indicators once after all bodies and before fog, without exposing hidden, dead or respawning actors', () => {
  const { view, state, internal } = rendererFixture(), commander = spawnEntity(state, 0, 'commander', 'ranger', 10, 10), selected = troop(state);
  const hidden = troop(state, 1), dead = troop(state), respawning = troop(state); dead.hp = 0; respawning.respawnAt = 10;
  state.fog.visible[0].fill(0);
  const order: string[] = [], bodies = vi.spyOn(internal, 'drawEntity').mockImplementation((_c, e) => { order.push(e.id); });
  const indicators = vi.spyOn(internal, 'drawActorIndicators').mockImplementation(() => { order.push('indicators'); });
  internal.drawFog = () => { order.push('fog'); };
  view.render(state, [selected.id, hidden.id, dead.id, respawning.id], { reducedMotion: true });
  expect(bodies).toHaveBeenCalledTimes(2); expect(indicators).toHaveBeenCalledTimes(1);
  expect(indicators.mock.calls[0][1].map(p => p.id)).toEqual([commander.id, selected.id]);
  expect(order.slice(-2)).toEqual(['indicators', 'fog']);
  view.render(state, [hidden.id], { reveal: true, reducedMotion: true });
  expect(indicators.mock.calls[1][1].map(p => p.id)).toEqual([commander.id, hidden.id]);
 });
 it.each(['low', 'high'] as const)('tracks interpolated positions and preserves simulation and picking in %s quality', quality => {
  const { view, state, internal } = rendererFixture(), selected = troop(state);
  selected.x = 11; selected.y = 9;
  internal.visualPositions.set(selected.id, { x: 10, y: 10 });
  vi.spyOn(performance, 'now').mockReturnValue(1000); internal.frameTime = 1000;
  const before = JSON.stringify(state), indicators = vi.spyOn(internal, 'drawActorIndicators');
  view.render(state, [selected.id], { reducedMotion: true, quality });
  expect(indicators.mock.calls[0][1][0]).toMatchObject({ id: selected.id, ...view.worldToScreen(10, 10) });
  expect(JSON.stringify(state)).toBe(before);
  const point = view.worldToScreen(10, 10); expect(view.pick(state, point.x, point.y - 20)?.id).toBe(selected.id);
 });
 it('moves health bars once and restores the complete original actor path when test instrumentation disables planning', () => {
  const { view, state, internal } = rendererFixture(), commander = spawnEntity(state, 0, 'commander', 'ranger', 10, 10), selected = troop(state), damaged = troop(state);
  damaged.hp /= 2;
  const bars = vi.spyOn(internal, 'bar'), bodies = vi.spyOn(internal, 'drawEntity');
  view.render(state, [selected.id], { reducedMotion: true, showHealth: true });
  expect(bars).toHaveBeenCalledTimes(3);
  expect(bodies.mock.calls.find(call => call[1].id === selected.id)?.[7]?.health).toBeDefined();
  expect(bodies.mock.calls.find(call => call[1].id === commander.id)?.[7]?.commander).toBe(true);
  bars.mockClear(); bodies.mockClear();
  vi.spyOn(internal, 'planActorIndicators').mockReturnValue([]);
  view.render(state, [selected.id], { reducedMotion: true, showHealth: true });
  expect(bars).toHaveBeenCalledTimes(3);
  expect(bodies.mock.calls.every(call => call[7] === undefined)).toBe(true);
 });
});
