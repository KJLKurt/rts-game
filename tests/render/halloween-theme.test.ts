import {createHash} from 'node:crypto';
import {readFileSync, readdirSync} from 'node:fs';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {AnimationAtlas} from '../../src/render/AnimationAtlas';
import {Battlefield} from '../../src/render/Battlefield';
import {DirectionalAtlas} from '../../src/render/DirectionalAtlas';
import {SpriteAtlas, spriteBounds, type AtlasFrame} from '../../src/render/SpriteAtlas';
import {normalizeVisualTheme, VISUAL_THEMES} from '../../src/render/visualThemes';

const atlasPath = 'public/assets/render/themes/halloween-toon/atlas.json';
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

describe('complete Halloween theme contracts', () => {
  it('registers Halloween as a complete static set and normalizes saved choices without path injection', () => {
    expect(Object.keys(VISUAL_THEMES).sort()).toEqual(['christmas', 'halloween', 'mythic']);
    expect(VISUAL_THEMES.halloween).toMatchObject({
      atlas: 'assets/render/themes/halloween-toon/atlas.json', attackAtlas: null,
      directionalAtlas: null, additionalDirectionalAtlases: [],
    });
    expect(normalizeVisualTheme('halloween')).toBe('halloween');
    for (const value of ['Halloween', 'halloween/../mythic', '__proto__', {}, null]) {
      expect(normalizeVisualTheme(value)).toBe('christmas');
    }
  });

  it('keeps the actual decoded RGBA atlas within 6 MiB and agrees with PNG dimensions', () => {
    const data = readAtlas(), png = readFileSync('public/assets/render/themes/halloween-toon/' + data.image);
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

  it('fits tower and blacksmith below fixed health bars through atlas framing at unchanged runtime widths', () => {
    const frames = readAtlas().frames, bounds = spriteBounds(frames.tower, 66);
    expect(bounds.width).toBe(66);
    expect(bounds.height).toBeLessThanOrEqual(102);
    // Battlefield's tower bar border spans y=-108..-103. A frame beginning
    // below it is a conservative guarantee; browser evidence grades actual alpha.
    expect(bounds.y).toBeGreaterThan(-103);
    expect(bounds.y + bounds.height).toBeGreaterThan(0);
    const blacksmith = spriteBounds(frames.blacksmith, 103);
    expect(blacksmith.width).toBe(103); expect(blacksmith.height).toBeLessThanOrEqual(98);
    expect(blacksmith.y).toBeGreaterThan(-94); // Generic structure bar border ends at -94.
  });

  it('keeps previously shipped Christmas and Mythic asset bytes unchanged', () => {
    const paths = [
      ...readdirSync('public/assets/render').filter(name => name.startsWith('frontier-')).map(name => 'assets/render/' + name),
      ...readdirSync('public/assets/render/themes/mythic-toon').map(name => 'assets/render/themes/mythic-toon/' + name),
      ...readdirSync('public/assets/audio').filter(name => /\.(?:ogg|mp3|json)$/.test(name)).map(name => 'assets/audio/' + name),
      ...readdirSync('public/assets/audio/mythic').map(name => 'assets/audio/mythic/' + name),
    ].sort();
    const digest = createHash('sha256').update(paths.map(path =>
      path + ':' + createHash('sha256').update(readFileSync('public/' + path)).digest('hex')).join('\n')).digest('hex');
    // Frozen from the authorized release 32f1d4e before Halloween authoring.
    expect(paths).toHaveLength(43);
    expect(digest).toBe('8024a7e863de76a7c668f937fe60af948b12507ed33e3eeafd11ac07eadd58c9');
  });

  it('leaves the previous complete atlas intact when a Halloween load fails', async () => {
    const {view, load} = rendererFixture();
    expect(await view.setVisualTheme('mythic')).toBe(true);
    const before = {atlas: view.atlas, frames: view.atlas.frames, image: view.atlas.image};
    load.mockResolvedValueOnce(false);
    expect(await view.setVisualTheme('halloween')).toBe(false);
    expect(view.visualTheme).toBe('mythic');
    expect(view.atlas).toBe(before.atlas);
    expect(view.atlas.frames).toBe(before.frames);
    expect(view.atlas.image).toBe(before.image);
  });

  it('rejects a fully loaded but superseded Halloween set before committing the latest complete set', async () => {
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
    const obsolete = view.setVisualTheme('halloween');
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
    expect(await view.setVisualTheme('halloween')).toBe(true);
    expect(view.visualTheme).toBe('halloween');
    expect(view.atlas.image?.src).toContain('halloween-toon/atlas.json');
  });
});
