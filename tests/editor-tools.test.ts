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

it("restores independent undo and redo history after a draft reload", () => {
  const before = createGame({ mapSize: "tiny" }).map,
    after = structuredClone(before),
    history = new EditorHistory();
  after.tiles[300] = before.tiles[300] === "water" ? "grass" : "water";
  history.record(before, after);
  const undone = history.undo(after)!,
    snapshot = history.export(),
    restored = new EditorHistory();
  restored.resume(snapshot);
  snapshot.redo[0].tiles[300] = "rock";
  expect(restored.redo(undone)).toEqual(after);
  expect(restored.undo(after)).toEqual(before);
});
it("rejects corrupt or excessive history without replacing existing edits", () => {
  const before = createGame({ mapSize: "tiny" }).map,
    after = structuredClone(before),
    history = new EditorHistory();
  after.tiles[300] = "road";
  after.tiles[301] = "road";
  history.record(before, after);
  for (const bad of [
    null,
    { version: 2, undo: [], redo: [] },
    { version: 1, undo: [{}], redo: [] },
    { version: 1, undo: Array(25).fill(before), redo: [] },
  ])
    expect(() => history.resume(bad)).toThrow("undo history");
  expect(history.undo(after)).toEqual(before);
});

it("preserves later inline names across terrain undo, redo, and draft reload", () => {
  const before = createGame({ mapSize: "tiny" }).map;
  before.name = "Original";
  const after = structuredClone(before),
    history = new EditorHistory();
  after.tiles[300] = before.tiles[300] === "water" ? "grass" : "water";
  history.record(before, after);
  after.name = "My frontier";
  const undone = history.undo(after)!;
  expect(undone.tiles).toEqual(before.tiles);
  expect(undone.name).toBe("My frontier");
  const resumed = new EditorHistory();
  resumed.resume(history.export());
  undone.name = "Another name";
  const redone = resumed.redo(undone)!;
  expect(redone.tiles).toEqual(after.tiles);
  expect(redone.name).toBe("Another name");
  expect(resumed.undo(redone)!.name).toBe("Another name");
});

it("keeps explicit settings renames transactional alongside terrain history", () => {
  const before = createGame({ mapSize: "tiny" }).map;
  before.name = "Original";
  const settings = structuredClone(before),
    history = new EditorHistory();
  settings.name = "Settings name";
  history.record(before, settings);
  const painted = structuredClone(settings);
  painted.tiles[300] = settings.tiles[300] === "water" ? "grass" : "water";
  history.record(settings, painted);
  painted.name = "Inline name";
  const undoPaint = history.undo(painted)!;
  expect(undoPaint.name).toBe("Inline name");
  const undoSettings = history.undo(undoPaint)!;
  expect(undoSettings.name).toBe("Original");
  const redoSettings = history.redo(undoSettings)!;
  expect(redoSettings.name).toBe("Inline name");
  expect(history.redo(redoSettings)!.tiles).toEqual(painted.tiles);
});

it("retains old snapshot behavior and rejects malformed name flags atomically", () => {
  const before = createGame({ mapSize: "tiny" }).map;
  before.name = "Original";
  const current = structuredClone(before);
  current.name = "Updated";
  const history = new EditorHistory();
  history.resume({ version: 1, undo: [before], redo: [] });
  for (const flags of [[], ["false"], [false, true]]) {
    expect(() =>
      history.resume({
        version: 1,
        undo: [before],
        redo: [],
        undoNames: flags,
      }),
    ).toThrow("undo history");
  }
  expect(history.undo(current)!.name).toBe("Original");
});

it("keeps name flags aligned when the history limit drops older transactions", () => {
  const history = new EditorHistory();
  let map = createGame({ mapSize: "tiny" }).map;
  map.name = "Start";
  for (let index = 0; index < 30; index++) {
    const next = structuredClone(map);
    if (index % 2) next.name = `Name ${index}`;
    else next.tiles[index] = next.tiles[index] === "water" ? "grass" : "water";
    history.record(map, next);
    map = next;
  }
  const snapshot = history.export();
  expect(snapshot.undo).toHaveLength(24);
  expect(snapshot.undoNames).toHaveLength(24);
  const restored = new EditorHistory();
  restored.resume(snapshot);
  const final = structuredClone(map);
  while (restored.canUndo) map = restored.undo(map)!;
  while (restored.canRedo) map = restored.redo(map)!;
  expect(map).toEqual(final);
});
