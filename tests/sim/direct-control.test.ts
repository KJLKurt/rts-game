import { describe, expect, it } from "vitest";
import {
  createGame,
  getCommander,
  issueCommand,
  stepGame,
  serializeGame,
  restoreGame,
} from "../../src/sim";
const game = () => {
  const s = createGame({
    seed: "direct-steering",
    mapSize: "tiny",
    learning: true,
  });
  s.map.tiles.fill("grass");
  const e = getCommander(s)!;
  e.x = 14;
  e.y = 14;
  return { s, e };
};
describe("deterministic direct commander controls", () => {
  it("moves in the requested direction without constructing a path and stops on release", () => {
    const { s, e } = game();
    const start = e.x;
    issueCommand(s, { type: "steer", team: 0, dx: 1, dy: 0 });
    stepGame(s, 0.2);
    expect(e.x).toBeGreaterThan(start + 0.4);
    expect(e.y).toBe(14);
    expect(e.path).toEqual([]);
    issueCommand(s, { type: "steer", team: 0, dx: 0, dy: 0 });
    const released = { x: e.x, y: e.y };
    stepGame(s, 2);
    expect(e.x).toBeCloseTo(released.x);
    expect(e.y).toBeCloseTo(released.y);
    expect(e.order.type).toBe("idle");
    expect(e.guardAnchor).toEqual(released);
  });
  it("normalizes diagonals and slides along blocked terrain instead of pathing around it", () => {
    const { s, e } = game();
    e.x = 14.8;
    e.y = 14.2;
    for (let y = 10; y < 20; y++) s.map.tiles[y * s.map.width + 15] = "rock";
    issueCommand(s, { type: "steer", team: 0, dx: 1, dy: 1 });
    stepGame(s, 0.4);
    expect(e.x).toBeLessThan(15);
    expect(e.y).toBeGreaterThan(14.7);
    expect(e.path).toEqual([]);
  });
  it("clears a held control on pause release, loss of updates, and save restore", () => {
    const { s, e } = game();
    issueCommand(s, { type: "steer", team: 0, dx: 1, dy: 0 });
    issueCommand(s, { type: "pause", team: 0, paused: true });
    issueCommand(s, { type: "steer", team: 0, dx: 0, dy: 0 });
    expect(e.directControl).toBeUndefined();
    expect(s.pendingCommands).toHaveLength(0);
    issueCommand(s, { type: "pause", team: 0, paused: false });
    issueCommand(s, { type: "steer", team: 0, dx: 1, dy: 0 });
    const restored = restoreGame(serializeGame(s));
    expect(getCommander(restored)!.directControl).toBeUndefined();
    expect(getCommander(restored)!.order.type).toBe("idle");
    stepGame(s, 1);
    const x = e.x;
    stepGame(s, 1);
    expect(e.x).toBe(x);
    expect(e.directControl).toBeUndefined();
  });
  it("preserves normal pathfinding tap orders as a separate command", () => {
    const { s, e } = game();
    issueCommand(s, { type: "steer", team: 0, dx: 1, dy: 0 });
    issueCommand(s, { type: "move", team: 0, entityIds: [e.id], x: 18, y: 14 });
    expect(e.directControl).toBeUndefined();
    stepGame(s, 1);
    expect(e.x).toBeGreaterThan(16);
    expect(e.order.type).toBe("move");
  });
});
