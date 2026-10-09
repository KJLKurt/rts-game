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
