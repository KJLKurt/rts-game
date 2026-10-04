import { describe, expect, it } from "vitest";
import { Battlefield } from "../../src/render/Battlefield";

describe("responsive battlefield backing buffer", () => {
  it("leaves display sizing in CSS when rotating from landscape to portrait", () => {
    const canvas = { width: 0, height: 0, style: {} };
    const view = {
      canvas,
      width: 0,
      height: 0,
      dpr: 1,
    } as unknown as Battlefield;
    Battlefield.prototype.resize.call(view, 844, 390, 2);
    expect(canvas).toMatchObject({
      width: 1688,
      height: 780,
      style: { width: "100%", height: "100%" },
    });
    Battlefield.prototype.resize.call(view, 390, 844, 2);
    expect(canvas).toMatchObject({
      width: 780,
      height: 1688,
      style: { width: "100%", height: "100%" },
    });
    expect(view.width).toBe(390);
    expect(view.height).toBe(844);
  });
});
