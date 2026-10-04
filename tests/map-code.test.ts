import { describe, it, expect } from "vitest";
import { encodeMapCode, decodeMapCode } from "../src/ui/map-code";
import { DEFAULT_SETTINGS, generateMap } from "../src/sim";
describe("portable map codes", () => {
  it("round-trips every generator input and produces the exact same map", () => {
    for (const version of [3, 4] as const) {
      const original = {
        ...DEFAULT_SETTINGS,
        mapGenerationVersion: version,
        seed: "Kurt & frontier | 🌲",
        biome: "forest" as const,
        duration: 12,
      };
      const restored = {
        ...DEFAULT_SETTINGS,
        ...decodeMapCode(encodeMapCode(original, version)),
      };
      expect(generateMap(restored)).toEqual(generateMap(original));
    }
  });
  it("rejects unknown versions, content, nonfinite inputs and prototype keys", () => {
    const code = encodeMapCode(DEFAULT_SETTINGS, 4);
    expect(() => decodeMapCode(code.replace("FC4", "FC99"))).toThrow();
    expect(() =>
      decodeMapCode(code.replace("|grasslands|", "|__proto__|")),
    ).toThrow();
    expect(() => decodeMapCode(code.replace("|18|", "|NaN|"))).toThrow();
    expect(() => decodeMapCode("FC4|")).toThrow();
  });
});
