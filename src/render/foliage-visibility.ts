/** Render-only, unzoomed isometric pixel geometry. No simulation or picking state. */
export interface FoliageRect { x: number; y: number; width: number; height: number; }
export interface FoliageMask {
 width: number;
 height: number;
 bounds: FoliageRect;
 /** Summed opaque pixels; absent only when canvas readback is unavailable. */
 integral?: Uint16Array;
}
export interface FoliageActor { x: number; y: number; order: number; width: number; height: number; groundRadius: number; silhouette?: readonly FoliageRect[]; }
export interface FoliageTree { x: number; y: number; order: number; size: number; mask: FoliageMask; }

// A stack of faded trees must leave at least 68% of the actor's painted color.
export const FOLIAGE_ALPHA_BUDGET = .32;
const CELL_SIZE = 96;

/** Build once from the cached 100 × 110 decoration sprite. Ignore its soft shadow. */
export function foliageMask(width: number, height: number, rgba: Uint8ClampedArray): FoliageMask {
 const integral = new Uint16Array((width + 1) * (height + 1));
 let left = width, top = height, right = 0, bottom = 0;
 for (let y = 0; y < height; y++) {
  let row = 0;
  for (let x = 0; x < width; x++) {
   if (rgba[(y * width + x) * 4 + 3] >= 128) {
    row++;
    left = Math.min(left, x); top = Math.min(top, y);
    right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1);
   }
   integral[(y + 1) * (width + 1) + x + 1] = integral[y * (width + 1) + x + 1] + row;
  }
 }
 return { width, height, integral, bounds: { x: left, y: top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) } };
}

function intersects(a: FoliageRect, b: FoliageRect): boolean {
 return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}
function treeBounds(tree: FoliageTree): FoliageRect {
 const b = tree.mask.bounds;
 return { x: tree.x + (b.x - 50) * tree.size, y: tree.y + (b.y - 99) * tree.size, width: b.width * tree.size, height: b.height * tree.size };
}
function actorBounds(actor: FoliageActor): FoliageRect {
 const radius = Math.max(actor.width / 2, actor.groundRadius), bottom = 2 + actor.groundRadius * .48;
 let left = -radius, right = radius, top = -actor.height, lower = bottom;
 for (const rect of actor.silhouette ?? []) {
  left = Math.min(left, rect.x); right = Math.max(right, rect.x + rect.width);
  top = Math.min(top, rect.y); lower = Math.max(lower, rect.y + rect.height);
 }
 return { x: actor.x + left, y: actor.y + top, width: right - left, height: lower - top };
}

function opaqueOverlap(tree: FoliageTree, x: number, y: number, width: number, height: number): boolean {
 const mask = tree.mask, bounds = mask.bounds;
 const lx = (x - tree.x) / tree.size + 50, ly = (y - tree.y) / tree.size + 99, lw = width / tree.size, lh = height / tree.size;
 if (lx >= bounds.x + bounds.width || lx + lw <= bounds.x || ly >= bounds.y + bounds.height || ly + lh <= bounds.y) return false;
 if (!mask.integral) return true;
 const left = Math.max(0, Math.floor(lx)), top = Math.max(0, Math.floor(ly));
 const right = Math.min(mask.width, Math.ceil(lx + lw)), bottom = Math.min(mask.height, Math.ceil(ly + lh));
 const stride = mask.width + 1, data = mask.integral;
 return right > left && bottom > top && data[bottom * stride + right] - data[top * stride + right] - data[bottom * stride + left] + data[top * stride + left] > 0;
}

/** Compact body/ground footprints exclude labels and empty upper sprite corners. */
function obscuresActor(tree: FoliageTree, actor: FoliageActor): boolean {
 const { x, y, width: w, height: h, groundRadius: r } = actor;
 // Three inscribed bands follow the painted ellipse, rather than its empty box corners.
 const ry = r * .48;
 if (r > 0 && (opaqueOverlap(tree, x - r * .6, y + 2 - ry * .8, r * 1.2, ry * .4) ||
     opaqueOverlap(tree, x - r * .91, y + 2 - ry * .4, r * 1.82, ry * .8) ||
     opaqueOverlap(tree, x - r * .6, y + 2 + ry * .4, r * 1.2, ry * .4))) return true;
 if (actor.silhouette) {
  for (const rect of actor.silhouette) if (opaqueOverlap(tree, x + rect.x, y + rect.y, rect.width, rect.height)) return true;
 } else {
  // Head, torso/weapons, and feet cover procedural fallbacks without a center-point blind spot.
  if (opaqueOverlap(tree, x - w * .22, y - h, w * .44, h * .25) ||
      opaqueOverlap(tree, x - w * .5, y - h * .75, w, h * .6) ||
      opaqueOverlap(tree, x - w * .3, y - h * .15, w * .6, h * .15 + 2)) return true;
 }
 return false;
}

/** Compact two-pixel alpha spans, cached per source frame by the renderer. */
export function foliageSilhouette(width: number, height: number, rgba: Uint8ClampedArray, bounds: FoliageRect): FoliageRect[] {
 const spans: FoliageRect[] = [];
 for (let y = 0; y < height; y += 2) {
  let start = -1;
  for (let x = 0; x <= width; x += 2) {
   let opaque = false;
   if (x < width) for (let dy = 0; dy < 2 && y + dy < height; dy++) for (let dx = 0; dx < 2 && x + dx < width; dx++)
    if (rgba[((y + dy) * width + x + dx) * 4 + 3] >= 128) opaque = true;
   if (opaque && start < 0) start = x;
   if (!opaque && start >= 0) {
    spans.push({ x: bounds.x + start / width * bounds.width, y: bounds.y + y / height * bounds.height, width: (Math.min(x, width) - start) / width * bounds.width, height: Math.min(2, height - y) / height * bounds.height });
    start = -1;
   }
  }
  // Odd raster widths have no even end sentinel.
  if (start >= 0) spans.push({ x: bounds.x + start / width * bounds.width, y: bounds.y + y / height * bounds.height, width: (width - start) / width * bounds.width, height: Math.min(2, height - y) / height * bounds.height });
 }
 return spans;
}

/** Spatially filter actual opaque-tree overlap, then share an alpha budget across its layers. */
export function foliageOpacities(trees: readonly FoliageTree[], actors: readonly FoliageActor[]): number[] {
 const opacity = trees.map(() => 1);
 if (!actors.length || !trees.length) return opacity;
 const cells = new Map<string, number[]>(), bounds = actors.map(actorBounds);
 const visitCells = (rect: FoliageRect, visit: (key: string) => void) => {
  for (let y = Math.floor(rect.y / CELL_SIZE); y <= Math.floor((rect.y + rect.height) / CELL_SIZE); y++)
   for (let x = Math.floor(rect.x / CELL_SIZE); x <= Math.floor((rect.x + rect.width) / CELL_SIZE); x++) visit(`${x},${y}`);
 };
 bounds.forEach((rect, index) => visitCells(rect, key => {
  const cell = cells.get(key);
  if (cell) cell.push(index); else cells.set(key, [index]);
 }));
 const overlapCounts = new Uint32Array(actors.length), overlaps: number[][] = [];
 trees.forEach(tree => {
  const matches: number[] = [], seen = new Set<number>(), rect = treeBounds(tree);
  overlaps.push(matches);
  if (!rect.width || !rect.height || tree.size <= 0) return;
  visitCells(rect, key => {
   for (const index of cells.get(key) ?? []) {
    if (seen.has(index)) continue;
    seen.add(index);
    const actor = actors[index];
    if (actor.order >= tree.order || !intersects(rect, bounds[index]) || !obscuresActor(tree, actor)) continue;
    matches.push(index); overlapCounts[index]++;
   }
  });
 });
 const actorOpacity = Array.from(overlapCounts, count => count ? 1 - Math.pow(1 - FOLIAGE_ALPHA_BUDGET, 1 / count) : 1);
 overlaps.forEach((matches, index) => {
  for (const actor of matches) opacity[index] = Math.min(opacity[index], actorOpacity[actor]);
 });
 return opacity;
}
