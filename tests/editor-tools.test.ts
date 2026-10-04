import { describe, expect, it } from "vitest";
import { createGame } from "../src/sim";
import { EditorHistory, strokeTiles } from "../src/ui/editor-tools";
describe("paint strokes and map history", () => {
  it("fills all crossed tiles from sparse horizontal, diagonal, and reverse gestures", () => {
    expect(strokeTiles({ x: 2.2, y: 3.4 }, { x: 8.9, y: 3.7 }, 20, 20)).toEqual(
      Array.from({ length: 7 }, (_, i) => ({ x: i + 2, y: 3 })),
    );
    expect(strokeTiles({ x: 7, y: 7 }, { x: 2, y: 2 }, 20, 20)).toHaveLength(6);
    expect(strokeTiles({ x: -3, y: 1 }, { x: 2, y: 1 }, 20, 20)).toEqual([
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ]);
  });
  it("undoes and redoes a complete stroke and discards the redo branch after a new edit", () => {
    const before = createGame({ mapSize: "tiny" }).map,
      after = structuredClone(before),
      history = new EditorHistory();
    after.tiles[300] = "water";
    history.record(before, after);
    const undo = history.undo(after)!;
    expect(undo).toEqual(before);
    expect(history.redo(undo)).toEqual(after);
    history.undo(after);
    const another = structuredClone(before);
    another.tiles[301] = "rock";
    history.record(before, another);
    expect(history.canRedo).toBe(false);
  });
});
