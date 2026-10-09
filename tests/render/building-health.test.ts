import {afterEach, describe, expect, it, vi} from 'vitest';
import {buildingHealthY} from '../../src/render/building-health';
import {Battlefield, type RenderOptions} from '../../src/render/Battlefield';
import {CombatFeedback} from '../../src/render/CombatFeedback';
import {SpriteAtlas, type AtlasFrame} from '../../src/render/SpriteAtlas';
import {createGame, spawnEntity} from '../../src/sim/engine';
import type {BuildingId, Entity, GameState} from '../../src/sim/types';

const buildings: readonly (BuildingId | 'turret')[] = ['keep', 'house', 'barracks', 'range', 'stable', 'workshop', 'tower', 'depot', 'blacksmith', 'turret'];
const widthFor = (type: Entity['type']) => type === 'keep' ? 132 : type === 'tower' ? 66 : type === 'house' ? 87 : 103;
const oldY = (type: Entity['type']) => type === 'keep' ? -133 : type === 'tower' ? -107 : -98;
const frame: AtlasFrame = {x: 2, y: 3, w: 180, h: 118, anchorX: .5, anchorY: .94};
function atlasFixture() {
  const atlas = new SpriteAtlas();
  atlas.ready = true; atlas.image = {src: 'space-ready.png'} as HTMLImageElement;
  atlas.frames = Object.fromEntries(buildings.filter(type => type !== 'turret').map(type => [type, {...frame}]));
  return atlas;
}
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('theme-specific building health anchors', () => {
  it.each(buildings)('attaches the ready Space %s health and queue bars to its actual sprite bounds', type => {
    const atlas = atlasFixture(), bounds = atlas.bounds(type === 'turret' ? 'tower' : type, widthFor(type))!;
    const before = JSON.stringify(bounds), y = buildingHealthY('space', type, bounds);
    expect(y).toBe(bounds.y - 20);
    expect(bounds.y - (y + 3 + 1)).toBeCloseTo(16, 10);
    expect(bounds.y - (y + 7 + 2.5 + 1)).toBeCloseTo(9.5, 10);
    expect(JSON.stringify(bounds)).toBe(before);
  });
  it.each(['christmas', 'mythic', 'halloween'] as const)('preserves every established %s building and turret coordinate', theme => {
    const atlas = atlasFixture();
    for (const type of buildings) {
      const bounds = atlas.bounds(type === 'turret' ? 'tower' : type, widthFor(type));
      expect(buildingHealthY(theme, type, bounds)).toBe(oldY(type));
      expect(buildingHealthY(theme, type)).toBe(oldY(type));
    }
  });
  it.each(['not-ready', 'missing-image', 'missing-frame'] as const)('retains established Space coordinates for %s artwork', unavailable => {
    for (const type of buildings) {
      const atlas = atlasFixture(), frameName = type === 'turret' ? 'tower' : type;
      if (unavailable === 'not-ready') atlas.ready = false;
      else if (unavailable === 'missing-image') atlas.image = null;
      else delete atlas.frames[frameName];
      const bounds = atlas.bounds(frameName, widthFor(type));
      expect(bounds).toBeUndefined(); expect(buildingHealthY('space', type, bounds)).toBe(oldY(type));
    }
  });
  it('does not send malformed vertical bounds to the canvas', () => {
    expect(buildingHealthY('space', 'keep', {x: 0, y: NaN, width: 132, height: 90})).toBe(-133);
  });
  it.each(buildings)('the actual renderer uses the %s footprint for both hit recording and Space bars', type => {
    vi.stubGlobal('Path2D', class { constructor(_path?: string) {} });
    const state = createGame({mapSize: 'tiny'}), entity = spawnEntity(state, 0, 'building', type, 10, 10);
    entity.queue = [{type: 'unit', id: 'swordsman', remaining: 6, total: 12}];
    const before = JSON.stringify(state), atlas = atlasFixture(), record = vi.fn(), bar = vi.fn();
    const draw = vi.spyOn(atlas, 'draw').mockReturnValue(true);
    const view = Object.assign(Object.create(Battlefield.prototype), {
      visualTheme: 'space', atlas, combat: new CombatFeedback(), recordEntityHit: record, bar,
    }) as {drawEntity(c: CanvasRenderingContext2D, e: Entity, selected: boolean, time: number, state: GameState, options: RenderOptions): void};
    const context = new Proxy({globalAlpha: 1} as Record<string, unknown>, {
      get: (target, key: string) => target[key] ?? (() => undefined),
    }) as unknown as CanvasRenderingContext2D;
    view.drawEntity(context, entity, true, 0, state, {reducedMotion: true});
    const frameName = type === 'turret' ? 'tower' : type, width = widthFor(type), bounds = atlas.bounds(frameName, width)!;
    expect(draw).toHaveBeenCalledTimes(1); expect(draw.mock.calls[0][0]).toBe(context);
    expect(draw.mock.calls[0].slice(1)).toEqual([frameName, width]);
    expect(record).toHaveBeenCalledTimes(1);
    expect(record.mock.calls[0][0]).toBe(context); expect(record.mock.calls[0][1]).toBe(entity);
    expect(record.mock.calls[0][2]).toBe(atlas.image); expect(record.mock.calls[0][3]).toBe(atlas.frames[frameName]);
    expect(record.mock.calls[0].slice(4)).toEqual([bounds, 1]);
    expect(bar.mock.calls.map(([, x, y, width, height]) => ({x, y, width, height}))).toEqual([
      {x: 0, y: bounds.y - 20, width: 57, height: 3},
      {x: 0, y: bounds.y - 13, width: 57, height: 2.5},
    ]);
    expect(JSON.stringify(state)).toBe(before);
  });
});
