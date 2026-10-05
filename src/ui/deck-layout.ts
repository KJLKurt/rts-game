/** Observe actual deck growth (status text, queues, font scaling), not every frame. */
export function observeControlDeck(deck: Element, measure: () => void): () => void {
  measure();
  if (typeof ResizeObserver === 'undefined') return () => {};
  let stopped = false, width = -1, height = -1;
  const observer = new ResizeObserver(entries => {
    if (stopped) return;
    const entry = entries.find(value => value.target === deck);
    if (!entry) return;
    const next = entry.contentRect;
    if (next.width === width && next.height === height) return;
    width = next.width; height = next.height;
    measure();
  });
  observer.observe(deck);
  return () => { stopped = true; observer.disconnect(); };
}

/** Feet stay in the clear playfield; include the real landscape placement bar. */
export function battlefieldCenterY(bounds: {
  height: number;
  landscape: boolean;
  hudBottom?: number;
  objectiveBottom?: number;
  deckTop?: number;
  placementTop?: number;
}): number {
  if (bounds.hudBottom === undefined || bounds.deckTop === undefined) return bounds.height / 2;
  if (!bounds.landscape) return (bounds.hudBottom + bounds.deckTop) / 2;
  const top = Math.max(bounds.hudBottom, bounds.objectiveBottom ?? bounds.hudBottom);
  const bottom = Math.min(bounds.deckTop, bounds.placementTop ?? bounds.deckTop);
  return Math.min(bottom - 12, (top + bottom) / 2 + 24);
}
