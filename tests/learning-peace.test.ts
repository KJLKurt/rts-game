import { describe, expect, it } from "vitest";
import {
  areAllied,
  areHostile,
  createGame,
  getCommander,
  isWalkable,
  issueCommand,
  restoreGame,
  serializeGame,
  spawnEntity,
  stepGame,
  updateFog,
  type GameState,
} from "../src/sim";

const practice = () =>
  createGame({
    learning: true,
    seed: "FIRST-SETTLEMENT",
    mapSize: "tiny",
    difficulty: "easy",
    aiPlayers: 1,
    commander: "warlord",
    faction: "ironhold",
    duration: 18,
    mode: "domination",
    startingGold: 180,
    startingWood: 160,
    populationCap: 40,
  });
function expectUndamaged(state: GameState) {
  expect(state.players.every((player) => player.stats.damageDealt === 0)).toBe(
    true,
  );
  expect(state.players[0].stats.unitsLost).toBe(0);
  expect(state.players[0].stats.commanderDeaths).toBe(0);
  for (const entity of state.entities.filter(
    (e) => e.team === 0 && e.buildProgress >= 1,
  ))
    expect(entity.hp, `${entity.type} health at ${state.time}s`).toBe(
      entity.maxHp,
    );
  expect(state.winner).toBeNull();
}
function advanceSafely(state: GameState, seconds: number) {
  for (let tick = 0; tick < seconds * 10; tick++) {
    stepGame(state, 0.1);
    expectUndamaged(state);
  }
}

describe("peaceful practice throughout the battlefield", () => {
  it("starts without rival forts or troops, including multi-spawn layouts", () => {
    for (const aiPlayers of [1, 3, 5]) {
      const state = createGame({
        learning: true,
        seed: "PRACTICE-NO-HOSTILES",
        mapSize: "small",
        aiPlayers,
      });
      expect(state.entities.every((entity) => entity.team === 0)).toBe(true);
      expect(state.entities.map((entity) => entity.type).sort()).toEqual([
        "keep",
        "warlord",
      ]);
      expect(state.players.every((player) => !player.ai)).toBe(true);
      expect(
        state.players
          .slice(1)
          .every((player) => player.stats.buildingsCreated === 0),
      ).toBe(true);
    }
  });

  it("captures every gold, timber and relic site and visits former rival territory without a single hit", () => {
    const state = practice(),
      commander = getCommander(state)!;
    for (const node of state.map.nodes) {
      expect(
        issueCommand(state, {
          type: "capture",
          team: 0,
          entityIds: [commander.id],
          nodeId: node.id,
        }).ok,
      ).toBe(true);
      for (let tick = 0; tick < 1200 && node.owner !== 0; tick++) {
        stepGame(state, 0.1);
        expectUndamaged(state);
      }
      expect(
        node.owner,
        `${node.kind} at ${node.x},${node.y} remains capturable`,
      ).toBe(0);
    }
    for (const spawn of state.map.spawns.slice(1)) {
      expect(
        issueCommand(state, {
          type: "move",
          team: 0,
          entityIds: [commander.id],
          ...spawn,
        }).ok,
      ).toBe(true);
      advanceSafely(state, 35);
      expect(
        Math.hypot(commander.x - spawn.x, commander.y - spawn.y),
      ).toBeLessThan(0.5);
      expect(
        issueCommand(state, {
          type: "hold",
          team: 0,
          entityIds: [commander.id],
        }).ok,
      ).toBe(true);
      advanceSafely(state, 20);
    }
    expect(state.map.nodes.every((node) => node.owner === 0)).toBe(true);
  });

  it("makes old practice checkpoints with rival keeps non-hostile across the entire walkable map", () => {
    const original = practice();
    const fort = spawnEntity(
      original,
      1,
      "building",
      "keep",
      original.map.spawns[1].x,
      original.map.spawns[1].y,
    );
    expect(
      issueCommand(original, { type: "recruit", team: 0, unit: "swordsman" })
        .ok,
    ).toBe(true);
    const keep = original.entities.find(
      (entity) => entity.team === 0 && entity.type === "keep",
    )!;
    const savedQueue = structuredClone(keep.queue);
    const restored = restoreGame(serializeGame(original)),
      commander = getCommander(restored)!;
    expect(
      restored.entities.find((entity) => entity.id === keep.id)!.queue,
    ).toEqual(savedQueue);
    expect(
      restored.entities.find((entity) => entity.id === fort.id),
    ).toBeDefined();
    expect(areHostile(restored, 0, 1)).toBe(false);
    expect(areHostile(restored, 1, 0)).toBe(false);
    expect(areAllied(restored, 0, 1)).toBe(false); // Peace does not merge ownership or income.
    for (let y = 1.5; y < restored.map.height; y += 2)
      for (let x = 1.5; x < restored.map.width; x += 2) {
        if (
          !isWalkable(restored.map, x, y) ||
          restored.entities.some(
            (entity) =>
              entity.kind === "building" &&
              Math.hypot(entity.x - x, entity.y - y) < entity.radius + 0.5,
          )
        )
          continue;
        // Position fixtures exercise every district, including the full old keep firing radius.
        commander.x = x;
        commander.y = y;
        issueCommand(restored, {
          type: "hold",
          team: 0,
          entityIds: [commander.id],
        });
        updateFog(restored);
        advanceSafely(restored, 1.1);
      }
    expect(
      issueCommand(restored, {
        type: "attack",
        team: 0,
        entityIds: [commander.id],
        targetId: fort.id,
      }).ok,
    ).toBe(false);
    expect(
      restoreGame(serializeGame(restored)).entities.find(
        (entity) => entity.id === commander.id,
      )!.hp,
    ).toBe(commander.maxHp);
  });

  it("keeps ordinary battle fortifications hostile and damaging even with AI planning off", () => {
    const state = createGame({
      seed: "FIRST-SETTLEMENT",
      mapSize: "tiny",
      aiPlayers: 1,
    });
    state.players.forEach((player) => {
      player.ai = false;
    });
    state.entities = state.entities.filter(
      (entity) =>
        entity.type === "keep" ||
        (entity.team === 0 && entity.kind === "commander"),
    );
    const commander = getCommander(state)!,
      fort = state.entities.find(
        (entity) => entity.team === 1 && entity.type === "keep",
      )!;
    commander.x = fort.x - 4;
    commander.y = fort.y;
    issueCommand(state, { type: "hold", team: 0, entityIds: [commander.id] });
    updateFog(state);
    expect(areHostile(state, 1, 0)).toBe(true);
    stepGame(state, 2);
    expect(commander.hp).toBeLessThan(commander.maxHp);
    expect(state.players[1].stats.damageDealt).toBeGreaterThan(0);
  });
});
