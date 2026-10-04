import { describe, it, expect } from "vitest";
import {
  animationFrame,
  validAnimationData,
  type AnimatedActor,
  type AnimationData,
} from "../../src/render/AnimationAtlas";
const actor: AnimatedActor = {
  referenceBodyHeight: 140,
  suggestedHeight: 59,
  walkFrameMs: 120,
  attackFrameMs: [90, 130, 90, 180],
  impactFrame: 2,
  walk: ["w0", "w1", "w2", "w3"],
  attack: ["a0", "a1", "a2", "a3"],
};
const idle = { attackAge: Infinity, anticipation: 0, moving: false, travel: 0 };
describe("optional authored frame selection", () => {
  it("shows release at the actual event, never delayed anticipation after damage", () => {
    expect(animationFrame(actor, { ...idle, attackAge: 0 })).toBe("a2");
    expect(animationFrame(actor, { ...idle, attackAge: 0.1 })).toBe("a3");
    expect(animationFrame(actor, { ...idle, attackAge: 0.3 })).toBeUndefined();
  });
  it("uses the two anticipation images only before the actual release", () => {
    expect(animationFrame(actor, { ...idle, anticipation: 0.1 })).toBe("a0");
    expect(animationFrame(actor, { ...idle, anticipation: 0.8 })).toBe("a1");
  });
  it("selects walking frames by observed ground travel and preserves idle fallback", () => {
    expect(animationFrame(actor, idle)).toBeUndefined();
    expect(
      animationFrame(actor, { ...idle, moving: true, travel: 2.3 * 0.12 }),
    ).toBe("w1");
    expect(
      animationFrame(actor, { ...idle, moving: true, travel: 2.3 * 0.48 }),
    ).toBe("w0");
  });
  it("rejects a manifest containing an out-of-bounds source rectangle", () => {
    const data: AnimationData = {
      version: 1,
      image: "atlas.png",
      width: 100,
      height: 100,
      actors: { unit: actor },
      frames: Object.fromEntries(
        [...actor.walk, ...actor.attack].map((id) => [
          id,
          { x: 0, y: 0, w: 100, h: 100, groundPivot: { x: 50, y: 95 } },
        ]),
      ),
    };
    expect(validAnimationData(data)).toBe(true);
    data.frames.a2.x = 1;
    expect(validAnimationData(data)).toBe(false);
  });
});

import { readFileSync } from "node:fs";
import { afterEach, vi } from "vitest";
import { AnimationAtlas } from "../../src/render/AnimationAtlas";
const production = JSON.parse(
  readFileSync(
    new URL(
      "../../public/assets/render/frontier-combat-animation.json",
      import.meta.url,
    ),
    "utf8",
  ),
) as AnimationData;
afterEach(() => vi.unstubAllGlobals());
function readyAtlas() {
  const atlas = new AnimationAtlas();
  atlas.data = production;
  atlas.image = {} as HTMLImageElement;
  return atlas;
}
describe("attack-only production trial", () => {
  it("references exactly12 approved attack frames and no walk clips", () => {
    expect(validAnimationData(production)).toBe(true);
    expect(Object.keys(production.actors).sort()).toEqual([
      "archer",
      "swordsman",
      "warlord",
    ]);
    expect(Object.keys(production.frames)).toHaveLength(12);
    for (const actor of Object.values(production.actors)) {
      expect(actor.walk).toEqual([]);
      expect(actor.attack).toHaveLength(4);
      expect(
        animationFrame(actor, { ...idle, moving: true, travel: 20 }),
      ).toBeUndefined();
    }
  });
  it("uses the corrected body scales and keeps every frame ground pivot at the origin", () => {
    const atlas = readyAtlas(),
      drawImage = vi.fn(),
      context = { drawImage } as unknown as CanvasRenderingContext2D;
    expect(production.actors.warlord.suggestedHeight).toBe(55);
    expect(production.actors.swordsman.suggestedHeight).toBe(44);
    expect(production.actors.archer.suggestedHeight).toBe(36);
    for (const [actorId, definition] of Object.entries(production.actors))
      for (const id of definition.attack) {
        expect(atlas.draw(context, actorId, id)).toBe(true);
        const call = drawImage.mock.calls.at(-1)!;
        const frame = production.frames[id],
          scale = definition.suggestedHeight / definition.referenceBodyHeight;
        expect(call[7]).toBeCloseTo(frame.w * scale);
        expect(call[8]).toBeCloseTo(frame.h * scale);
        expect(call[5] + frame.groundPivot.x * scale).toBeCloseTo(0);
        expect(call[6] + frame.groundPivot.y * scale).toBeCloseTo(0);
      }
  });
  it("moves from anticipation to actual-event release, recovery and original idle fallback", () => {
    const atlas = readyAtlas();
    for (const name of Object.keys(production.actors)) {
      expect(atlas.attackFrame(name, Infinity, 0.1)).toBe(`${name}-attack-0`);
      expect(atlas.attackFrame(name, Infinity, 0.9)).toBe(`${name}-attack-1`);
      expect(atlas.attackFrame(name, 0, 0)).toBe(`${name}-attack-2`);
      expect(atlas.attackFrame(name, 0.15, 0)).toBe(`${name}-attack-3`);
      expect(atlas.attackFrame(name, 0.7, 0)).toBeUndefined();
      expect(atlas.attackFrame(name, 0, 0)).toBe(`${name}-attack-2`);
    }
  });
  it("keeps original static sprites under reduced motion and for unsupported actors", () => {
    const atlas = readyAtlas();
    expect(atlas.attackFrame("warlord", 0, 0, true)).toBeUndefined();
    expect(atlas.attackFrame("ranger", 0, 0)).toBeUndefined();
    expect(atlas.attackFrame("cavalry", Infinity, 0)).toBeUndefined();
  });
  it("cannot draw unaccepted walk frames or a different actor’s pose", () => {
    const atlas = readyAtlas(),
      drawImage = vi.fn(),
      context = { drawImage } as unknown as CanvasRenderingContext2D;
    expect(atlas.draw(context, "warlord", "warlord-walk-0")).toBe(false);
    expect(atlas.draw(context, "archer", "warlord-attack-2")).toBe(false);
    expect(drawImage).not.toHaveBeenCalled();
  });
  it("safely falls back when the optional manifest is absent", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false })),
    );
    const atlas = new AnimationAtlas();
    expect(await atlas.load("/missing.json")).toBe(false);
    expect(atlas.attackFrame("warlord", 0, 0)).toBeUndefined();
  });
  it("safely falls back if the optional PNG fails to decode", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => production })),
    );
    vi.stubGlobal("document", {
      baseURI: "https://example.test/frontier-command/",
    });
    vi.stubGlobal(
      "Image",
      class {
        src = "";
        async decode() {
          throw new Error("offline image missing");
        }
      },
    );
    const atlas = new AnimationAtlas();
    expect(
      await atlas.load("assets/render/frontier-combat-animation.json"),
    ).toBe(false);
    expect(atlas.data).toBeNull();
    expect(atlas.attackFrame("archer", 0, 0)).toBeUndefined();
  });
  it("rejects an incompatible optional manifest without constructing an image", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ version: 99 }) })),
    );
    const image = vi.fn();
    vi.stubGlobal("Image", image);
    const atlas = new AnimationAtlas();
    expect(await atlas.load("/invalid.json")).toBe(false);
    expect(image).not.toHaveBeenCalled();
  });
});
