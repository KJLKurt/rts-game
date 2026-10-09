import type { GameMap, Point } from "../sim";
import { validateWorkshopStructure } from "./workshop";
export interface EditorHistorySnapshot {
  version: 1;
  undo: GameMap[];
  redo: GameMap[];
  /** Older drafts omit these flags and retain their original full-map behavior. */
  undoNames?: boolean[];
  redoNames?: boolean[];
}

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
  private undoNames: boolean[] = [];
  private redoNames: boolean[] = [];
  record(before: GameMap, after: GameMap) {
    if (JSON.stringify(before) === JSON.stringify(after)) return;
    this.undoMaps.push(structuredClone(before));
    this.undoNames.push(before.name !== after.name);
    if (this.undoMaps.length > 24) {
      this.undoMaps.shift();
      this.undoNames.shift();
    }
    this.redoMaps = [];
    this.redoNames = [];
  }
  undo(current: GameMap): GameMap | undefined {
    const previous = this.undoMaps.pop();
    const changesName = this.undoNames.pop();
    if (previous) {
      this.redoMaps.push(structuredClone(current));
      this.redoNames.push(changesName ?? true);
      if (!changesName) previous.name = current.name;
    }
    return previous;
  }
  redo(current: GameMap): GameMap | undefined {
    const next = this.redoMaps.pop();
    const changesName = this.redoNames.pop();
    if (next) {
      this.undoMaps.push(structuredClone(current));
      this.undoNames.push(changesName ?? true);
      if (!changesName) next.name = current.name;
    }
    return next;
  }
  export(): EditorHistorySnapshot {
    return {
      version: 1,
      undo: structuredClone(this.undoMaps),
      redo: structuredClone(this.redoMaps),
      undoNames: [...this.undoNames],
      redoNames: [...this.redoNames],
    };
  }
  resume(input: unknown) {
    const data = input as EditorHistorySnapshot;
    if (
      !data ||
      data.version !== 1 ||
      !Array.isArray(data.undo) ||
      !Array.isArray(data.redo) ||
      ["undo", "redo"].some((side) => {
        const maps = data[side as "undo" | "redo"];
        const flags = data[`${side}Names` as "undoNames" | "redoNames"];
        return (
          flags !== undefined &&
          (!Array.isArray(flags) ||
            flags.length !== maps.length ||
            flags.some((flag) => typeof flag !== "boolean"))
        );
      }) ||
      data.undo.length + data.redo.length > 24 ||
      [...data.undo, ...data.redo].some(
        (map) => validateWorkshopStructure(map).length,
      )
    )
      throw new Error("The workshop undo history is invalid.");
    this.undoMaps = structuredClone(data.undo);
    this.redoMaps = structuredClone(data.redo);
    this.undoNames = data.undoNames
      ? [...data.undoNames]
      : data.undo.map(() => true);
    this.redoNames = data.redoNames
      ? [...data.redoNames]
      : data.redo.map(() => true);
  }
  get canUndo() {
    return this.undoMaps.length > 0;
  }
  get canRedo() {
    return this.redoMaps.length > 0;
  }
}
