import type { GameMap, Point } from "../sim";

/** Includes every crossed grid cell, even when touch events arrive far apart. */
export function strokeTiles(
  from: Point,
  to: Point,
  width: number,
  height: number,
): Point[] {
  let x = Math.floor(from.x),
    y = Math.floor(from.y);
  const endX = Math.floor(to.x),
    endY = Math.floor(to.y),
    dx = Math.abs(endX - x),
    sx = x < endX ? 1 : -1,
    dy = -Math.abs(endY - y),
    sy = y < endY ? 1 : -1;
  let error = dx + dy;
  const tiles: Point[] = [];
  for (let count = 0; count < width + height + 2; count++) {
    if (x >= 0 && y >= 0 && x < width && y < height) tiles.push({ x, y });
    if (x === endX && y === endY) break;
    const twice = 2 * error;
    if (twice >= dy) {
      error += dy;
      x += sx;
    }
    if (twice <= dx) {
      error += dx;
      y += sy;
    }
  }
  return tiles;
}
export class EditorHistory {
  private undoMaps: GameMap[] = [];
  private redoMaps: GameMap[] = [];
  record(before: GameMap, after: GameMap) {
    if (JSON.stringify(before) === JSON.stringify(after)) return;
    this.undoMaps.push(structuredClone(before));
    if (this.undoMaps.length > 24) this.undoMaps.shift();
    this.redoMaps = [];
  }
  undo(current: GameMap): GameMap | undefined {
    const previous = this.undoMaps.pop();
    if (previous) this.redoMaps.push(structuredClone(current));
    return previous;
  }
  redo(current: GameMap): GameMap | undefined {
    const next = this.redoMaps.pop();
    if (next) this.undoMaps.push(structuredClone(current));
    return next;
  }
  get canUndo() {
    return this.undoMaps.length > 0;
  }
  get canRedo() {
    return this.redoMaps.length > 0;
  }
}
