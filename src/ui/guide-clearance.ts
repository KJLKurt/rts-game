type GuideRect = Pick<DOMRect, "left" | "top" | "right" | "bottom" | "width" | "height">;
type ShortGuideViewport = { width: number; height: number; textScale: number; learning: boolean };
const shortDesktop = ({ width, height }: ShortGuideViewport) => width > 600 && height > 500 && height <= 550;
const intersects = (a: GuideRect, b: GuideRect) => a.width > 0 && a.height > 0 && b.width > 0 && b.height > 0 &&
  a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

/** Resolve the observed 501–550px breakpoint mismatch only. The <=500px guide
 * already has its own readable lane; ordinary and taller layouts stay intact. */
export function shortLearningGuideLayout(
  guide: GuideRect,
  objective: GuideRect | undefined,
  minimap: GuideRect,
  deckTop: number | undefined,
  viewport: ShortGuideViewport,
  minimumHeight: number,
): { left: number; top: number; width: number; maxHeight: number } | undefined {
  if (!viewport.learning || !shortDesktop(viewport)) return;
  let top = guide.top;
  let height = guide.height;
  // Account for the existing objective clearance before checking the map lane.
  if (objective && guide.right > objective.left && guide.left < objective.right &&
      guide.top < objective.bottom + 8 && guide.bottom > objective.top) {
    top = Math.ceil(objective.bottom + 8);
    const space = Math.min(viewport.height - 8, deckTop ?? viewport.height - 8) - top - 8;
    if (space >= 44) height = Math.min(height, space);
  }
  // DOMRect coordinates are prototype getters, so spreading a browser's
  // rectangle would lose the dimensions that make this collision test work.
  if (!intersects({ left: guide.left, right: guide.right, width: guide.width,
    height, top, bottom: top + height }, minimap)) return;
  const left = Math.ceil(minimap.right + 8);
  if (left + guide.width > viewport.width - 8) return;
  // Moving sideways can enter the objective's horizontal lane.
  if (objective && left < objective.right && left + guide.width > objective.left &&
      top < objective.bottom + 8 && top + guide.height > objective.top) top = Math.ceil(objective.bottom + 8);
  const maxHeight = Math.floor(Math.min(viewport.height - 8, deckTop ?? viewport.height - 8) - top - 8);
  if (maxHeight < minimumHeight) return;
  return { left, top, width: guide.width, maxHeight };
}

const learningGuideProperties = ["left", "width", "top", "max-height", "overflow-y"];
function resetShortLearningGuide(guide: HTMLElement) {
  learningGuideProperties.forEach(name => guide.style.removeProperty(name));
  delete guide.dataset.learningMinimapKey;
  delete guide.dataset.learningMinimapAdjusted;
  delete guide.dataset.clearanceKey; // Let the original objective-only path remeasure after leaving this regime.
}

/** Cache on external layout inputs, never the relocated guide rectangle. This
 * avoids oscillation and leaves an actively scrolled guide alone between updates. */
export function positionShortLearningGuide(
  guide: HTMLElement | null,
  objective: HTMLElement | null,
  minimap: HTMLElement | null,
  deck: HTMLElement | null,
  viewport: ShortGuideViewport,
): boolean {
  if (!guide) return false;
  const visibleRect = (node: HTMLElement | null) => {
    if (!node) return;
    const style = getComputedStyle(node), rect = node.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0 ? rect : undefined;
  };
  const map = viewport.learning && shortDesktop(viewport) ? visibleRect(minimap) : undefined;
  const guideStyle = getComputedStyle(guide);
  if (!map || !guide.textContent || !guide.classList.contains("learning-guide") ||
      guideStyle.display === "none" || guideStyle.visibility === "hidden") {
    if (guide.dataset.learningMinimapKey !== undefined) resetShortLearningGuide(guide);
    return false;
  }
  const o = visibleRect(objective), d = visibleRect(deck);
  const boxKey = (r: GuideRect | undefined) => r ? [r.left, r.top, r.width, r.height].join(",") : "none";
  const key = [viewport.width, viewport.height, viewport.textScale, boxKey(map), boxKey(o), boxKey(d), guide.className, guide.textContent].join("/");
  if (guide.dataset.learningMinimapKey === key) return guide.dataset.learningMinimapAdjusted === "true";
  const scrollTop = guide.scrollTop;
  resetShortLearningGuide(guide);
  const natural = guide.getBoundingClientRect();
  // max-height is border-box. Reserve real space for a complete target plus
  // the measured padding/borders, rather than mistaking 44px of panel for a
  // 44px usable scrollport. Larger text can increase a button's actual height.
  const paddingAndBorders = [guideStyle.paddingTop, guideStyle.paddingBottom,
    guideStyle.borderTopWidth, guideStyle.borderBottomWidth]
    .reduce((sum, value) => sum + (parseFloat(value) || 0), 0);
  const targetHeight = Math.max(44, ...[...guide.querySelectorAll("button")]
    .map(button => button.getBoundingClientRect().height));
  const layout = shortLearningGuideLayout(natural, o, map, d?.top, viewport,
    Math.ceil(targetHeight + paddingAndBorders));
  guide.dataset.learningMinimapKey = key;
  guide.dataset.learningMinimapAdjusted = String(!!layout);
  if (!layout) return false;
  guide.style.left = `${layout.left}px`;
  guide.style.width = `${layout.width}px`;
  guide.style.top = `${layout.top}px`;
  guide.style.maxHeight = `${layout.maxHeight}px`;
  guide.style.overflowY = "auto";
  guide.scrollTop = scrollTop;
  return true;
}

/** Hide only the duplicate floating commander control when the learning guide
 * occupies its space. Visibility keeps its normal geometry available on the
 * next measurement, so hiding it cannot make it reappear and flicker. */
export function clearLearningCommanderOverlap(
  guide: HTMLElement | null,
  strip: HTMLElement | null,
  learning: boolean,
): void {
  if (!strip) return;
  let overlaps = false;
  if (learning && guide?.textContent && guide.classList.contains("learning-guide")) {
    const style = getComputedStyle(guide);
    const g = guide.getBoundingClientRect(), c = strip.getBoundingClientRect();
    overlaps = style.display !== "none" && style.visibility !== "hidden" &&
      g.width > 0 && g.height > 0 && c.width > 0 && c.height > 0 &&
      g.left < c.right && g.right > c.left && g.top < c.bottom && g.bottom > c.top;
  }
  strip.classList.toggle("learning-guide-overlap", overlaps);
}
