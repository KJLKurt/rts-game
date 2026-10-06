import {afterEach, describe, expect, it, vi} from 'vitest';
import {Battlefield} from '../../src/render/Battlefield';
import {SpriteAtlas} from '../../src/render/SpriteAtlas';
import {AnimationAtlas} from '../../src/render/AnimationAtlas';
import {DirectionalAtlas, type DirectionalData} from '../../src/render/DirectionalAtlas';
import {VISUAL_THEMES, normalizeVisualTheme} from '../../src/render/visualThemes';
import {readFileSync} from 'node:fs';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function fixture() {
  const context = {} as CanvasRenderingContext2D;
  vi.stubGlobal('document', {createElement: () => ({getContext: () => context})});
  vi.spyOn(AnimationAtlas.prototype, 'load').mockResolvedValue(true);
  vi.spyOn(DirectionalAtlas.prototype, 'load').mockResolvedValue(true);
  const load = vi.spyOn(SpriteAtlas.prototype, 'load').mockImplementation(async function(this:SpriteAtlas,url:string) {
    this.image = {src: url, naturalWidth: 1254, naturalHeight: 1254} as HTMLImageElement;
    this.frames = {ranger: {x: 0, y: 0, w: 100, h: 100}};
    this.ready = true;
    return true;
  });
  const view = new Battlefield({getContext: () => context} as unknown as HTMLCanvasElement);
  return {view, load};
}

describe('complete visual sets and atomic switching', () => {
  it('accepts shipped choices and recovers obsolete or malicious saved values', () => {
    expect(normalizeVisualTheme('mythic')).toBe('mythic');
    for (const value of [null, '../other-app', 'unshipped-pack', '__proto__', 2])
      expect(normalizeVisualTheme(value)).toBe('christmas');
  });
  it('each shipped static set contains all 36 semantic frames with valid image bounds and pivots', () => {
    const old = JSON.parse(readFileSync('public/' + VISUAL_THEMES.christmas.atlas, 'utf8'));
    for (const theme of Object.values(VISUAL_THEMES)) {
      const data = JSON.parse(readFileSync('public/' + theme.atlas, 'utf8'));
      expect(Object.keys(data.frames).sort()).toEqual(Object.keys(old.frames).sort());
      for (const f of Object.values(data.frames) as Array<{x:number;y:number;w:number;h:number;anchorX:number;anchorY:number}>) {
        expect(f.x).toBeGreaterThanOrEqual(0); expect(f.y).toBeGreaterThanOrEqual(0);
        expect(f.w).toBeGreaterThan(0); expect(f.h).toBeGreaterThan(0);
        expect(f.x + f.w).toBeLessThanOrEqual(data.width);
        expect(f.y + f.h).toBeLessThanOrEqual(data.height);
        expect(f.anchorX).toBeGreaterThanOrEqual(0); expect(f.anchorX).toBeLessThanOrEqual(1);
        expect(f.anchorY).toBeGreaterThanOrEqual(0); expect(f.anchorY).toBeLessThanOrEqual(1);
      }
    }
  });
  it('commits a complete new atlas and retains the active atlas on failure', async () => {
    const {view, load} = fixture();
    await view.setVisualTheme('christmas');
    const original = view.atlas;
    expect(await view.setVisualTheme('mythic')).toBe(true);
    expect(view.visualTheme).toBe('mythic');
    expect(view.atlas).not.toBe(original);
    expect(view.atlas.image?.src).toContain(VISUAL_THEMES.mythic.atlas);
    const working = view.atlas;
    load.mockResolvedValueOnce(false);
    expect(await view.setVisualTheme('christmas')).toBe(false);
    expect(view.visualTheme).toBe('mythic');
    expect(view.atlas).toBe(working);
  });
  it('a slow superseded selection cannot replace the latest choice', async () => {
    const {view, load} = fixture();
    await view.setVisualTheme('christmas');
    const original = view.atlas;
    let finish!: (value:boolean) => void;
    load.mockImplementationOnce(() => new Promise(resolve => {finish = resolve;}));
    const oldRequest = view.setVisualTheme('mythic');
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
    const latest = view.setVisualTheme('christmas');
    finish(true);
    expect(await oldRequest).toBe(false);
    expect(await latest).toBe(true);
    expect(view.atlas).toBe(original);
    expect(view.visualTheme).toBe('christmas');
  });
  it('a failed required directional pack retains the complete old set', async () => {
    const {view} = fixture();
    await view.setVisualTheme('christmas');const original=view.atlas;
    vi.spyOn(DirectionalAtlas.prototype,'load').mockResolvedValue(false);
    expect(await view.setVisualTheme('mythic')).toBe(false);
    expect(view.atlas).toBe(original);expect(view.visualTheme).toBe('christmas');
  });
  it('a failed additional actor pack rejects the whole theme without replacing its working textures', async () => {
    const {view} = fixture();
    await view.setVisualTheme('christmas');
    const original = view.atlas;
    const load = vi.spyOn(DirectionalAtlas.prototype, 'load').mockImplementation(async url => !url.endsWith('swordsman-directional.json'));
    expect(await view.setVisualTheme('mythic')).toBe(false);
    expect(load.mock.calls.map(([url])=>url)).toEqual(expect.arrayContaining([
      expect.stringContaining('ranger-directional.json'),
      expect.stringContaining('swordsman-directional.json'),
    ]));
    expect(view.atlas).toBe(original);expect(view.visualTheme).toBe('christmas');
  });
  it('routes each actor to its owned texture and releases additional textures on a complete theme switch', async () => {
    const {view} = fixture();
    vi.spyOn(DirectionalAtlas.prototype, 'load').mockImplementation(async function(this:DirectionalAtlas,url:string) {
      const actor=url.endsWith('swordsman-directional.json')?'swordsman':'ranger';
      this.data={actors:{[actor]:{}}} as DirectionalData;
      this.image={src:url} as HTMLImageElement;
      return true;
    });
    expect(await view.setVisualTheme('mythic')).toBe(true);
    const internals=view as unknown as {directionalAtlas:DirectionalAtlas;additionalDirectionalAtlases:DirectionalAtlas[];directionalFor(actor:string):DirectionalAtlas};
    const ranger=internals.directionalFor('ranger'),swordsman=internals.directionalFor('swordsman');
    expect(ranger.image?.src).toContain('ranger-directional.json');
    expect(swordsman.image?.src).toContain('swordsman-directional.json');
    expect(swordsman).not.toBe(ranger);expect(internals.additionalDirectionalAtlases).toHaveLength(1);
    expect(internals.directionalFor('engineer')).toBe(ranger);
    expect(await view.setVisualTheme('christmas')).toBe(true);
    expect(internals.additionalDirectionalAtlases).toHaveLength(0);
    expect(internals.directionalFor('swordsman')).not.toBe(swordsman);
  });
});
