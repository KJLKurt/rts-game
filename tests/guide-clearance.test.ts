import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { clearLearningCommanderOverlap, positionShortLearningGuide, shortLearningGuideLayout } from "../src/ui/guide-clearance";

function node(x: number, y: number, width: number, height: number, classes: string[] = []) {
  const names = new Set(classes);
  const rect = { x, y, width, height, left: x, top: y, right: x + width, bottom: y + height };
  const style: Record<string, any> = {
    removeProperty: vi.fn((name: string) => { delete style[name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())]; }),
  };
  return {
    textContent: "Learning guide",
    rect,
    style,
    dataset: {} as Record<string, string>,
    scrollTop: 0,
    targetHeight: 44,
    get className() { return [...names].join(" "); },
    classList: {
      contains: (name: string) => names.has(name),
      toggle: (name: string, force: boolean) => force ? names.add(name) : names.delete(name),
    },
    querySelectorAll() { return [{ getBoundingClientRect: () => ({ height: this.targetHeight }) }]; },
    getBoundingClientRect: vi.fn(() => {
      if (!style.left && !style.top && !style.width && !style.maxHeight) return rect;
      const left = style.left ? parseFloat(style.left) : rect.left, top = style.top ? parseFloat(style.top) : rect.top;
      const width = style.width ? parseFloat(style.width) : rect.width;
      const height = style.maxHeight ? Math.min(rect.height, parseFloat(style.maxHeight)) : rect.height;
      return { x: left, y: top, left, top, width, height, right: left + width, bottom: top + height };
    }),
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

const shortViewport = { width: 1184, height: 501, textScale: 1, learning: true };
function shortFixture() {
  const guide = node(20, 87, 280, 207.171875, ["learning-guide"]);
  const minimap = node(10, 40, 164, 166);
  const objective = node(392, 55, 400, 28);
  const deck = node(190, 220.140625, 984, 280.859375);
  vi.stubGlobal("getComputedStyle", (element: typeof guide) => ({
    display: element.style.display || "block", visibility: element.style.visibility || "visible",
    paddingTop: "12px", paddingBottom: "12px", borderTopWidth: "1px", borderBottomWidth: "1px",
  }));
  const measure = (viewport = shortViewport) => positionShortLearningGuide(
    guide as unknown as HTMLElement, objective as unknown as HTMLElement,
    minimap as unknown as HTMLElement, deck as unknown as HTMLElement, viewport,
  );
  return { guide, minimap, objective, deck, measure };
}
describe("measured 501–550px learning/minimap clearance", () => {
  it("places the measured 501px expanded guide beside the map, above the deck", () => {
    const { guide, minimap, objective, deck, measure } = shortFixture();
    expect(measure()).toBe(true);
    expect(guide.style).toMatchObject({ left: "182px", top: "91px", width: "280px", maxHeight: "121px", overflowY: "auto" });
    const g = guide.getBoundingClientRect();
    expect(g.left).toBeGreaterThanOrEqual(minimap.rect.right + 8);
    expect(g.top).toBeGreaterThanOrEqual(objective.rect.bottom);
    expect(g.bottom).toBeLessThanOrEqual(deck.rect.top - 8);
    expect(g.height - 24 - 2).toBeGreaterThanOrEqual(44);
  });
  it("uses native DOMRect prototype getters instead of enumerable spread fields", () => {
    const { guide, minimap, objective, deck } = shortFixture();
    const nativeLike = Object.create(Object.fromEntries(Object.entries(guide.rect).map(([name, value]) =>
      [name, undefined])));
    for (const [name, value] of Object.entries(guide.rect)) Object.defineProperty(Object.getPrototypeOf(nativeLike), name, { get: () => value });
    expect(Object.keys(nativeLike)).toEqual([]);
    expect(shortLearningGuideLayout(nativeLike, objective.rect, minimap.rect, deck.rect.top, shortViewport, 70))
      .toEqual({ left: 182, top: 91, width: 280, maxHeight: 121 });
  });
  it("tracks collapsed deck/map geometry without guessing their CSS sizes", () => {
    const { guide, minimap, deck, measure } = shortFixture();
    minimap.rect.top = 174.5; minimap.rect.bottom = 340.5;
    minimap.rect.right = 177.25; minimap.rect.width = 167.25;
    deck.rect.top = 355.40625;
    expect(measure()).toBe(true);
    expect(guide.style).toMatchObject({ left: "186px", maxHeight: "256px" });
  });
  it("reserves measured padding, borders and actual large-text target height", () => {
    const { guide, deck, measure } = shortFixture();
    guide.targetHeight = 58;
    deck.rect.top = 182.9; // floor(182.9 - 91 - 8) = 83, one pixel too short.
    expect(measure({ ...shortViewport, textScale: 1.3 })).toBe(false);
    expect(guide.style.left).toBeUndefined();
    deck.rect.top = 183;
    expect(measure({ ...shortViewport, textScale: 1.3 })).toBe(true);
    expect(parseFloat(guide.style.maxHeight) - 24 - 2).toBe(58);
  });
  it("does not confuse a 44px panel with a usable 44px target", () => {
    const { guide, deck, measure } = shortFixture();
    deck.rect.top = 143;
    expect(measure()).toBe(false);
    expect(guide.style.maxHeight).toBeUndefined();
    deck.rect.top = 169;
    expect(measure()).toBe(true);
    expect(guide.style.maxHeight).toBe("70px");
  });
  it("keeps relocated geometry and user scroll stable across repeated HUD cycles", () => {
    const { guide, measure } = shortFixture();
    expect(measure()).toBe(true);
    guide.scrollTop = 62;
    const g = guide.getBoundingClientRect(), reads = guide.getBoundingClientRect.mock.calls.length;
    const resets = guide.style.removeProperty.mock.calls.length;
    for (let frame = 0; frame < 40; frame++) {
      expect(measure()).toBe(true);
      expect(guide.scrollTop).toBe(62);
    }
    expect(guide.getBoundingClientRect.mock.calls.length).toBe(reads);
    expect(guide.style.removeProperty.mock.calls.length).toBe(resets);
    expect(guide.getBoundingClientRect()).toEqual(g);
  });
  it("remeasures from natural geometry and preserves scroll when external inputs change", () => {
    const { guide, deck, minimap, objective, measure } = shortFixture();
    measure(); guide.scrollTop = 31;
    deck.rect.top += 10;
    expect(measure()).toBe(true); expect(guide.style.maxHeight).toBe("131px");
    minimap.rect.right += 10; minimap.rect.width += 10;
    expect(measure()).toBe(true); expect(guide.style.left).toBe("192px");
    objective.rect.bottom = 102; objective.rect.height = 47;
    expect(measure()).toBe(true); expect(guide.style.top).toBe("110px");
    guide.textContent = "Another lesson with longer guidance";
    expect(measure({ ...shortViewport, textScale: 1.3 })).toBe(true);
    expect(guide.scrollTop).toBe(31);
  });
  it("clears an objective entered by the sideways move and stays unchanged if it already clears the map", () => {
    const { guide, minimap, objective, deck } = shortFixture();
    objective.rect.bottom = 110; objective.rect.height = 55;
    expect(shortLearningGuideLayout(guide.rect, objective.rect, minimap.rect, deck.rect.top, shortViewport, 70))
      .toEqual({ left: 182, top: 118, width: 280, maxHeight: 94 });
    objective.rect.left = 0; objective.rect.bottom = 100;
    // The original objective path clips to y212; a map below it is already clear.
    expect(shortLearningGuideLayout(guide.rect, objective.rect, node(10, 230, 164, 166).rect, deck.rect.top, shortViewport, 70)).toBeUndefined();
    objective.rect.left = 0; objective.rect.bottom = minimap.rect.bottom;
    expect(shortLearningGuideLayout(guide.rect, objective.rect, minimap.rect, deck.rect.top, shortViewport, 70)).toBeUndefined();
  });
  it.each([
    { ...shortViewport, learning: false }, { ...shortViewport, width: 600 },
    { ...shortViewport, height: 500 }, { ...shortViewport, height: 551 },
    { ...shortViewport, width: 390, height: 844 }, { ...shortViewport, height: 900 },
  ])("removes only its own overrides outside scope: %j", viewport => {
    const { guide, measure } = shortFixture();
    measure(); guide.style.color = "gold";
    guide.dataset.clearanceKey = "old-objective";
    expect(measure(viewport)).toBe(false);
    for (const name of ["left", "width", "top", "maxHeight", "overflowY"]) expect(guide.style[name]).toBeUndefined();
    expect(guide.style.color).toBe("gold");
    expect(guide.dataset.learningMinimapKey).toBeUndefined();
    expect(guide.dataset.clearanceKey).toBeUndefined();
  });
  it.each([501, 550])("includes the exact %dpx height boundary and 601px width", height => {
    const { measure } = shortFixture();
    expect(measure({ ...shortViewport, width: 601, height })).toBe(true);
  });
  it.each(["empty", "ordinary", "hidden-guide", "hidden-map", "removed-map-overlap"])("resets for %s without a false positive", mode => {
    const { guide, minimap, measure } = shortFixture();
    measure();
    if (mode === "empty") guide.textContent = "";
    if (mode === "ordinary") guide.classList.toggle("learning-guide", false);
    if (mode === "hidden-guide") guide.style.visibility = "hidden";
    if (mode === "hidden-map") minimap.style.display = "none";
    if (mode === "removed-map-overlap") { minimap.rect.left = 300; minimap.rect.right = 464; }
    expect(measure()).toBe(false);
    expect(guide.style.left).toBeUndefined();
    expect(guide.style.maxHeight).toBeUndefined();
  });
  it("leaves untouched in-scope but noncolliding, zero-size and no-room layouts alone", () => {
    const { guide, minimap, objective, deck } = shortFixture();
    for (const map of [node(300, 87, 164, 166).rect, node(10, guide.rect.bottom, 164, 166).rect, node(10, 40, 0, 166).rect])
      expect(shortLearningGuideLayout(guide.rect, objective.rect, map, deck.rect.top, shortViewport, 70)).toBeUndefined();
    expect(shortLearningGuideLayout(node(20, 87, 0, 200).rect, objective.rect, minimap.rect, deck.rect.top, shortViewport, 70)).toBeUndefined();
    expect(shortLearningGuideLayout(guide.rect, objective.rect, node(10, 40, 350, 166).rect, deck.rect.top,
      { ...shortViewport, width: 601 }, 70)).toBeUndefined();
    expect(positionShortLearningGuide(null, null, null, null, shortViewport)).toBe(false);
  });
});
