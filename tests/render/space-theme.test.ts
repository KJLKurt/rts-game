import {createHash} from 'node:crypto';
import {readFileSync, readdirSync} from 'node:fs';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {AnimationAtlas} from '../../src/render/AnimationAtlas';
import {Battlefield} from '../../src/render/Battlefield';
import {buildingHealthY} from '../../src/render/building-health';
import {DirectionalAtlas} from '../../src/render/DirectionalAtlas';
import {SpriteAtlas, spriteBounds, type AtlasFrame} from '../../src/render/SpriteAtlas';
import {normalizeVisualTheme, VISUAL_THEMES} from '../../src/render/visualThemes';

const atlasPath = 'public/assets/render/themes/space-toon/atlas.json';
const readAtlas = () => JSON.parse(readFileSync(atlasPath, 'utf8')) as {
  width: number; height: number; image: string; frames: Record<string, AtlasFrame>;
};
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

/** Asset-loading fixture only. Each successful load really installs its own
 * frame/image identities, so preservation assertions cannot pass on empty mocks. */
function rendererFixture() {
  const context = {} as CanvasRenderingContext2D;
  vi.stubGlobal('document', {createElement: () => ({getContext: () => context})});
  vi.spyOn(AnimationAtlas.prototype, 'load').mockResolvedValue(true);
  vi.spyOn(DirectionalAtlas.prototype, 'load').mockResolvedValue(true);
  const load = vi.spyOn(SpriteAtlas.prototype, 'load').mockImplementation(async function(this: SpriteAtlas, url: string) {
    this.image = {src: url, naturalWidth: 1200, naturalHeight: 1200} as HTMLImageElement;
    this.frames = {ranger: {x: 4, y: 4, w: 120, h: 160, anchorX: .5, anchorY: .96}};
    this.ready = true;
    return true;
  });
  return {view: new Battlefield({getContext: () => context} as unknown as HTMLCanvasElement), load};
}

describe('complete Space theme contracts', () => {
  it('registers Space as a complete static set and normalizes saved choices without path injection', () => {
    expect(Object.keys(VISUAL_THEMES).sort()).toEqual(['christmas', 'halloween', 'mythic', 'space']);
    expect(VISUAL_THEMES.space).toMatchObject({
      atlas: 'assets/render/themes/space-toon/atlas.json', attackAtlas: null,
      directionalAtlas: null, additionalDirectionalAtlases: [],
    });
    expect(normalizeVisualTheme('space')).toBe('space');
    for (const value of ['Space', 'space/../mythic', '__proto__', {}, null]) {
      expect(normalizeVisualTheme(value)).toBe('christmas');
    }
  });

  it('keeps the actual decoded RGBA atlas within 6 MiB and agrees with PNG dimensions', () => {
    const data = readAtlas(), png = readFileSync('public/assets/render/themes/space-toon/' + data.image);
    expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect(png.toString('ascii', 12, 16)).toBe('IHDR');
    const width = png.readUInt32BE(16), height = png.readUInt32BE(20);
    expect([width, height]).toEqual([data.width, data.height]);
    expect([png[24], png[25]]).toEqual([8, 6]); // Eight-bit RGBA, not compressed file size.
    expect(width * height * 4).toBeLessThanOrEqual(6 * 1024 * 1024);
    // The generic visual-themes suite already checks every shipped ID, frame
    // rectangle and pivot. Assert the semantic count here without copying it.
    expect(Object.keys(data.frames)).toHaveLength(36);
  });

  it('keeps runtime widths and attaches bars above the actual packed Space frames', () => {
    const frames = readAtlas().frames;
    for (const type of ['keep', 'house', 'barracks', 'range', 'stable', 'workshop', 'tower', 'depot', 'blacksmith'] as const) {
      const width = type === 'keep' ? 132 : type === 'tower' ? 66 : type === 'house' ? 87 : 103;
      const bounds = spriteBounds(frames[type], width), y = buildingHealthY('space', type, bounds);
      expect(bounds.width).toBe(width); expect(bounds.height).toBeGreaterThan(0);
      expect(y).toBe(bounds.y - 20);
      expect(y + 3 + 1).toBeLessThan(bounds.y);
      expect(y + 7 + 2.5 + 1).toBeLessThan(bounds.y);
    }
    // Visible Tower height/width and every actual-alpha clearance are graded by
    // the production gallery; transparent frame padding is not body geometry.
  });

  it('keeps all previously shipped Christmas, Mythic and Halloween asset bytes unchanged', () => {
    const paths = [
      ...readdirSync('public/assets/render').filter(name => name.startsWith('frontier-')).map(name => 'assets/render/' + name),
      ...['mythic', 'halloween'].flatMap(theme => readdirSync(`public/assets/render/themes/${theme}-toon`)
        .map(name => `assets/render/themes/${theme}-toon/${name}`)),
      ...readdirSync('public/assets/audio').filter(name => /\.(?:ogg|mp3|json)$/.test(name)).map(name => 'assets/audio/' + name),
      ...['mythic', 'halloween'].flatMap(theme => readdirSync(`public/assets/audio/${theme}`)
        .map(name => `assets/audio/${theme}/${name}`)),
    ].sort();
    const digest = createHash('sha256').update(paths.map(path =>
      path + ':' + createHash('sha256').update(readFileSync('public/' + path)).digest('hex')).join('\n')).digest('hex');
    // Frozen from exact published b8029a43 before Space integration.
    expect(paths).toHaveLength(58);
    expect(digest).toBe('0f30e1173e6acc368e1b51041108aa2f569fefe0a26e51797fa13e1e6e77bc38');
  });

  it('leaves the previous complete atlas intact when a Space load fails', async () => {
    const {view, load} = rendererFixture();
    expect(await view.setVisualTheme('mythic')).toBe(true);
    const before = {atlas: view.atlas, frames: view.atlas.frames, image: view.atlas.image};
    load.mockResolvedValueOnce(false);
    expect(await view.setVisualTheme('space')).toBe(false);
    expect(view.visualTheme).toBe('mythic');
    expect(view.atlas).toBe(before.atlas);
    expect(view.atlas.frames).toBe(before.frames);
    expect(view.atlas.image).toBe(before.image);
  });

  it('rejects a fully loaded but superseded Space set before committing the latest complete set', async () => {
    const {view, load} = rendererFixture();
    expect(await view.setVisualTheme('mythic')).toBe(true);
    const before = view.atlas;
    const install = load.getMockImplementation()!;
    let release!: () => void;
    load.mockImplementationOnce(async function(this: SpriteAtlas, url: string) {
      await install.call(this, url);
      await new Promise<void>(resolve => { release = resolve; });
      return true;
    });
    const obsolete = view.setVisualTheme('space');
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    expect(view.atlas).toBe(before);
    const latest = view.setVisualTheme('christmas');
    expect(view.atlas).toBe(before);
    release();
    expect(await obsolete).toBe(false);
    expect(await latest).toBe(true);
    expect(view.visualTheme).toBe('christmas');
    expect(view.atlas).not.toBe(before);
    expect(view.atlas.image?.src).toContain('frontier-atlas.json');
    expect(await view.setVisualTheme('space')).toBe(true);
    expect(view.visualTheme).toBe('space');
    expect(view.atlas.image?.src).toContain('space-toon/atlas.json');
  });
});
