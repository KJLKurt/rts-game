import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { Battlefield } from "../../src/render/Battlefield";
import {
  SpriteAtlas,
  spriteBounds,
  type AtlasData,
} from "../../src/render/SpriteAtlas";
import { nodeVisual } from "../../src/render/nodeVisual";
import { createGame, spawnEntity } from "../../src/sim/engine";
import type { ResourceNode } from "../../src/sim/types";
const artwork = JSON.parse(
  readFileSync(
    new URL("../../public/assets/render/frontier-atlas.json", import.meta.url),
    "utf8",
  ),
) as AtlasData;
const context = new Proxy({}, { get: () => () => {}, set: () => true });
function canvas() {
  return {
    width: 800,
    height: 600,
    style: {},
    getContext: () => context,
  } as unknown as HTMLCanvasElement;
}
function node(
  id: string,
  kind: ResourceNode["kind"] = "relic",
  x = 10.5,
  y = 10.5,
): ResourceNode {
  return {
    id,
    kind,
    x,
    y,
    owner: null,
    captureTeam: null,
    captureProgress: 0,
    radius: 2.2,
    income: 0,
    amount: 1000,
    maxAmount: 1000,
  };
}
function setup(nodes: ResourceNode[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: false })),
  );
  vi.stubGlobal("document", {
    createElement: () => canvas(),
    baseURI: "https://example.test/rts-game/",
  });
  const state = createGame({ mapSize: "tiny" });
  state.entities = [];
  state.map.nodes = nodes;
  state.fog.visible[0].fill(1);
  state.fog.explored[0].fill(1);
  const view = new Battlefield(canvas());
  view.resize(800, 600, 1);
  view.centerOn(10.5, 10.5);
  view.atlas.frames = artwork.frames;
  view.atlas.image = {} as HTMLImageElement;
  view.atlas.ready = true;
  return { state, view };
}
function upperPoint(view: Battlefield, n: ResourceNode, fraction = 0.12) {
  const art = nodeVisual(n),
    bounds = view.atlas.bounds(art.frame, art.width, art.height)!,
    p = view.worldToScreen(n.x, n.y);
  return {
    x: p.x + (bounds.x + bounds.width * 0.5) * view.camera.zoom,
    y: p.y + (bounds.y + bounds.height * fraction) * view.camera.zoom,
  };
}
afterEach(() => vi.unstubAllGlobals());
describe("pivot-aware resource and relic touch picking", () => {
  it("captures a tap on the relic star above the old ground-radius target at multiple zooms", () => {
    const relic = node("star"),
      { view, state } = setup([relic]);
    for (const zoom of [0.55, 1, 1.7]) {
      view.camera.zoom = zoom;
      const p = upperPoint(view, relic, 0.12),
        oldGround = view.screenToWorld(p.x, p.y);
      expect(
        Math.hypot(oldGround.x - relic.x, oldGround.y - relic.y),
      ).toBeGreaterThan(relic.radius);
      expect(view.pick(state, p.x, p.y)?.id).toBe("star");
    }
  });
  it.each(["gold", "wood"] as const)(
    "picks the upper %s artwork beyond the ground circle",
    (kind) => {
      const resource = node(kind, kind),
        { view, state } = setup([resource]),
        p = upperPoint(view, resource),
        ground = view.screenToWorld(p.x, p.y);
      expect(
        Math.hypot(ground.x - resource.x, ground.y - resource.y),
      ).toBeGreaterThan(resource.radius);
      expect(view.pick(state, p.x, p.y)?.id).toBe(kind);
    },
  );
  it("chooses the frontmost node silhouette instead of map array order", () => {
    const rear = node("rear", "relic", 10, 10),
      front = node("front"),
      { view, state } = setup([rear, front]);
    const p = view.worldToScreen(front.x, front.y);
    expect(view.pick(state, p.x, p.y - 65)?.id).toBe("front");
  });
  it("resolves a node/entity overlap using the same depth as painting", () => {
    const relic = node("front-node"),
      { view, state } = setup([relic]);
    const rear = spawnEntity(state, 0, "unit", "swordsman", 10, 10);
    rear.x = 10;
    rear.y = 10;
    const p = view.worldToScreen(relic.x, relic.y);
    expect(view.pick(state, p.x, p.y - 40)?.id).toBe(relic.id);
    rear.x = 11;
    rear.y = 11;
    expect(view.pick(state, p.x, p.y - 15)?.id).toBe(rear.id);
  });
  it("chooses the nearest visual center when node silhouettes have equal depth", () => {
    const left = node("left", "relic", 10, 11),
      right = node("right", "relic", 11, 10),
      { view, state } = setup([left, right]);
    expect(view.pick(state, 404, 250)?.id).toBe("right");
  });
  it("keeps a generous ground fallback outside the art silhouette", () => {
    const relic = node("ground"),
      { view, state } = setup([relic]),
      p = view.worldToScreen(relic.x, relic.y);
    expect(view.pick(state, p.x + 85, p.y)?.id).toBe(relic.id);
  });
  it("uses nearest distance rather than array order for overlapping ground fallbacks", () => {
    const farther = node("farther", "relic", 10, 10),
      closer = node("closer", "relic", 10.8, 10.8),
      { view, state } = setup([farther, closer]),
      p = view.worldToScreen(11.4, 11.4);
    expect(view.pick(state, p.x, p.y)?.id).toBe("closer");
  });
  it("does not make unexplored nodes tappable just because relic minimap coordinates are public", () => {
    const relic = node("hidden"),
      { view, state } = setup([relic]);
    state.fog.visible[0].fill(0);
    state.fog.explored[0].fill(0);
    const p = upperPoint(view, relic),
      ground = view.worldToScreen(relic.x, relic.y);
    expect(view.pick(state, p.x, p.y)).toBeUndefined();
    expect(view.pick(state, ground.x, ground.y)).toBeUndefined();
  });
  it("allows last-known explored nodes but does not let a hidden enemy steal their tap", () => {
    const relic = node("known"),
      { view, state } = setup([relic]);
    const enemy = spawnEntity(state, 1, "unit", "swordsman", 11, 11);
    enemy.x = 11;
    enemy.y = 11;
    state.fog.visible[0].fill(0);
    const p = view.worldToScreen(relic.x, relic.y);
    expect(view.pick(state, p.x, p.y - 15)?.id).toBe(relic.id);
  });
  it("preserves upper-node selection while the optional art is absent", () => {
    const relic = node("fallback"),
      { view, state } = setup([relic]);
    view.atlas.ready = false;
    const p = view.worldToScreen(relic.x, relic.y);
    expect(view.pick(state, p.x, p.y - 68)?.id).toBe(relic.id);
  });
});
describe("shared atlas pivot and alpha footprints", () => {
  it("uses exactly the same geometry for normalized and pixel anchors", () => {
    const normalized = spriteBounds(
      { x: 0, y: 0, w: 160, h: 160, anchorX: 0.5, anchorY: 0.9 },
      80,
    );
    expect(
      spriteBounds(
        { x: 0, y: 0, w: 160, h: 160, anchorX: 80, anchorY: 144 },
        80,
      ),
    ).toEqual(normalized);
    expect(normalized).toEqual({ x: -40, y: -72, width: 80, height: 80 });
  });
  it("ignores transparent upper corners, includes opaque art and adds a small touch tolerance", () => {
    const rgba = new Uint8ClampedArray(40 * 40 * 4);
    for (let y = 7; y <= 13; y++)
      for (let x = 19; x <= 21; x++) rgba[(y * 40 + x) * 4 + 3] = 255;
    const readback = vi.fn(() => ({ data: rgba }));
    vi.stubGlobal("document", {
      createElement: () => ({
        width: 0,
        height: 0,
        getContext: () => ({ drawImage() {}, getImageData: readback }),
      }),
    });
    const atlas = new SpriteAtlas();
    atlas.frames = {
      test: { x: 0, y: 0, w: 160, h: 160, anchorX: 0.5, anchorY: 0.9 },
    };
    atlas.image = { naturalWidth: 160, naturalHeight: 160 } as HTMLImageElement;
    atlas.ready = true;
    expect(atlas.hitTest("test", 80, undefined, 0, -52)).toBe(true);
    expect(atlas.hitTest("test", 80, undefined, 30, -60)).toBe(false);
    expect(atlas.hitTest("test", 80, undefined, 7, -52)).toBe(false);
    expect(atlas.hitTest("test", 80, undefined, 7, -52, 8)).toBe(true);
    expect(readback).toHaveBeenCalledTimes(1);
  });
});
