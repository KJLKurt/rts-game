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
