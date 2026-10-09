import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { clearLearningCommanderOverlap } from "../src/ui/guide-clearance";

function node(x: number, y: number, width: number, height: number, classes: string[] = []) {
  const names = new Set(classes);
  const rect = { x, y, width, height, left: x, top: y, right: x + width, bottom: y + height };
  return {
    textContent: "Learning guide",
    rect,
    classList: {
      contains: (name: string) => names.has(name),
      toggle: (name: string, force: boolean) => force ? names.add(name) : names.delete(name),
    },
    getBoundingClientRect: () => rect,
  };
}
function fixture() {
  // Approximate the demonstrated 1184 × 760 layout, in viewport coordinates.
  const guide = node(24, 88, 280, 204, ["learning-guide"]);
  const strip = node(26, 256, 220, 44, ["recovering"]);
  vi.stubGlobal("getComputedStyle", () => ({ display: "block", visibility: "visible" }));
  const measure = (learning = true) => clearLearningCommanderOverlap(guide as unknown as HTMLElement, strip as unknown as HTMLElement, learning);
  return { guide, strip, measure, hidden: () => strip.classList.contains("learning-guide-overlap") };
}
afterEach(() => vi.unstubAllGlobals());
describe("learning guide and duplicate commander clearance", () => {
  it("keeps the higher-specificity lesson action rule at the shared 44px touch minimum", () => {
    const css = readFileSync(new URL("../src/style.css", import.meta.url), "utf8");
    const rule = css.match(/\.battle-hint\.learning-guide > \.lesson-action\s*\{([^}]+)\}/)?.[1];
    expect(rule).toBeDefined();
    expect(rule).toMatch(/min-height:\s*44px\s*;/);
  });
  it("suppresses a colliding strip without removing its measurable geometry or other classes", () => {
    const { strip, measure, hidden } = fixture();
    const bounds = { ...strip.rect };
    for (let i = 0; i < 10; i++) {
      measure();
      expect(hidden()).toBe(true);
      expect(strip.getBoundingClientRect()).toEqual(bounds);
      expect(strip.classList.contains("recovering")).toBe(true);
    }
  });
  it("restores the strip at the exact no-overlap threshold and responds to deck or guide growth", () => {
    const { guide, strip, measure, hidden } = fixture();
    measure(); expect(hidden()).toBe(true);
    strip.rect.top = guide.rect.bottom;
    strip.rect.bottom = strip.rect.top + strip.rect.height;
    measure(); expect(hidden()).toBe(false);
    strip.rect.top -= .01;
    measure(); expect(hidden()).toBe(true);
    guide.rect.bottom = strip.rect.top; // Minimized guide.
    measure(); expect(hidden()).toBe(false);
    guide.rect.bottom += 50; // Larger text.
    measure(); expect(hidden()).toBe(true);
    strip.rect.left = guide.rect.right; // Landscape/width transition.
    measure(); expect(hidden()).toBe(false);
  });
  it("never changes ordinary HUD visibility and clears stale suppression after practice", () => {
    const { guide, strip, measure, hidden } = fixture();
    measure(); expect(hidden()).toBe(true);
    measure(false); expect(hidden()).toBe(false);
    guide.classList.toggle("learning-guide", false);
    measure(); expect(hidden()).toBe(false);
    clearLearningCommanderOverlap(null, strip as unknown as HTMLElement, true);
    expect(hidden()).toBe(false);
  });
  it.each(["empty", "display-none", "visibility-hidden", "zero-guide", "zero-strip"])("ignores a %s layout", mode => {
    const { guide, strip, measure, hidden } = fixture();
    measure(); expect(hidden()).toBe(true);
    if (mode === "empty") guide.textContent = "";
    if (mode === "zero-guide") guide.rect.height = 0;
    if (mode === "zero-strip") strip.rect.width = 0;
    vi.stubGlobal("getComputedStyle", () => ({ display: mode === "display-none" ? "none" : "block", visibility: mode === "visibility-hidden" ? "hidden" : "visible" }));
    measure(); expect(hidden()).toBe(false);
  });
});
