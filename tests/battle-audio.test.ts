import { beforeEach, describe, expect, it } from "vitest";
import { battleSound, restoredEventCursor } from "../src/platform/battle-audio";
import {
  createGame,
  restoreGame,
  serializeGame,
  spawnEntity,
  stepGame,
} from "../src/sim";
import type { GameEvent, GameState } from "../src/sim/types";

function event(overrides: Partial<GameEvent>): GameEvent {
  return {
    id: 1,
    time: 0,
    type: "attack",
    team: 0,
    x: 8.75,
    y: 9.25,
    ...overrides,
  };
}

function game(): GameState {
  const state = createGame({ seed: "battle-audio", neutralCamps: 0 });
  state.players.forEach((player) => (player.ai = false));
  return state;
}

describe("battle event sound mapping", () => {
  let state: GameState;

  beforeEach(() => {
    state = game();
    state.fog.visible[0].fill(0);
  });

  it("plays construction completion only for the player's completed building", () => {
    expect(
      battleSound(event({ type: "build", subtype: "complete" }), state),
    ).toBe("complete");
    for (const subtype of ["house", "barracks", undefined]) {
      expect(battleSound(event({ type: "build", subtype }), state)).toBeNull();
    }
    state.fog.visible[0].fill(1);
    expect(
      battleSound(
        event({ type: "build", subtype: "complete", team: 1 }),
        state,
      ),
    ).toBeNull();
  });

  it("maps an attack release to melee independently of its subtype", () => {
    for (const subtype of [
      "swordsman",
      "spearman",
      "cavalry",
      "warlord",
      "archer",
      undefined,
    ]) {
      expect(battleSound(event({ type: "attack", subtype }), state)).toBe(
        "melee",
      );
    }
  });

  it.each(["archer", "ranger"])(
    "maps a %s projectile release to an arrow",
    (subtype) => {
      expect(battleSound(event({ type: "projectile", subtype }), state)).toBe(
        "arrow",
      );
    },
  );

  it.each([
    "siege",
    "tower",
    "keep",
    "turret",
    "engineer",
    "support",
    undefined,
  ])("does not apply bow audio to a %s projectile", (subtype) => {
    expect(
      battleSound(event({ type: "projectile", subtype }), state),
    ).toBeNull();
  });

  it.each([
    { type: "attack", subtype: "swordsman", sound: "melee" },
    { type: "projectile", subtype: "archer", sound: "arrow" },
    { type: "projectile", subtype: "ranger", sound: "arrow" },
  ] as const)(
    "gates foreign $subtype releases on current source-tile visibility",
    ({ type, subtype, sound }) => {
      const release = event({
        type,
        subtype,
        team: 1,
        targetTeam: 0,
        targetX: 12,
        targetY: 12,
      });
      state.fog.explored[0].fill(1);
      state.fog.visible[0][12 * state.map.width + 12] = 1;
      expect(
        battleSound(release, state),
        "a visible target and explored source do not reveal a hidden release",
      ).toBeNull();
      state.fog.visible[0][9 * state.map.width + 8] = 1;
      expect(
        battleSound(release, state),
        "fractional coordinates select the source's containing tile",
      ).toBe(sound);
      state.fog.visible[0][9 * state.map.width + 8] = 0;
      expect(
        battleSound(release, state),
        "losing source visibility silences future releases",
      ).toBeNull();
    },
  );

  it("rejects foreign releases outside every map edge even when flattened indexes alias visible tiles", () => {
    state.fog.visible[0].fill(1);
    const positions = [
      { x: -0.01, y: 9 },
      { x: state.map.width, y: 9 },
      { x: 8, y: -0.01 },
      { x: 8, y: state.map.height },
    ];
    for (const position of positions) {
      for (const type of ["attack", "projectile"] as const) {
        expect(
          battleSound(
            event({ ...position, type, subtype: "archer", team: 1 }),
            state,
          ),
        ).toBeNull();
      }
    }
  });

  it("silences foreign releases when the player's visibility grid is unavailable", () => {
    state.fog.visible = [];
    expect(battleSound(event({ team: 1 }), state)).toBeNull();
    expect(
      battleSound(
        event({ type: "projectile", subtype: "ranger", team: 1 }),
        state,
      ),
    ).toBeNull();
    expect(battleSound(event({}), state)).toBe("melee");
  });

  it.each([
    ["capture", "capture"],
    ["alert", "alert"],
    ["death", "destroy"],
    ["research", "research"],
  ] as const)(
    "preserves player-only %s feedback regardless of fog",
    (type, sound) => {
      expect(battleSound(event({ type }), state)).toBe(sound);
      state.fog.visible[0].fill(1);
      expect(
        battleSound(event({ type, team: 1, targetTeam: 0 }), state),
      ).toBeNull();
    },
  );

  it("preserves hit feedback for either outgoing or incoming player damage", () => {
    expect(
      battleSound(event({ type: "hit", team: 0, targetTeam: 1 }), state),
    ).toBe("hit");
    expect(
      battleSound(event({ type: "hit", team: 1, targetTeam: 0 }), state),
    ).toBe("hit");
    expect(
      battleSound(event({ type: "hit", team: 0 }), state),
      "older player hits lack targetTeam",
    ).toBe("hit");
    state.fog.visible[0].fill(1);
    expect(
      battleSound(event({ type: "hit", team: 1, targetTeam: 2 }), state),
    ).toBeNull();
    expect(battleSound(event({ type: "hit", team: 1 }), state)).toBeNull();
  });

  it("leaves other event kinds silent", () => {
    for (const type of [
      "spawn",
      "ability",
      "heal",
      "victory",
      "dialogue",
    ] as const) {
      expect(battleSound(event({ type, subtype: "archer" }), state)).toBeNull();
    }
  });
});

describe("simulation events and audio cursors", () => {
  it("emits one audible completion after a real construction finishes", () => {
    const state = game();
    const spawn = state.map.spawns[0];
    const house = spawnEntity(
      state,
      0,
      "building",
      "house",
      spawn.x + 5,
      spawn.y,
      false,
    );
    const started = state.events.find((entry) => entry.entityId === house.id)!;
    expect(started).toMatchObject({ type: "build", subtype: "house" });
    expect(battleSound(started, state)).toBeNull();
    stepGame(state, house.buildTime - 0.1);
    expect(house.buildProgress).toBeLessThan(1);
    expect(
      state.events.filter(
        (entry) => entry.entityId === house.id && entry.subtype === "complete",
      ),
    ).toHaveLength(0);
    stepGame(state, 0.2);
    expect(house.buildProgress).toBe(1);
    const completions = state.events.filter(
      (entry) => entry.entityId === house.id && entry.subtype === "complete",
    );
    expect(completions).toHaveLength(1);
    expect(battleSound(completions[0], state)).toBe("complete");
    stepGame(state, 1);
    expect(
      state.events.filter(
        (entry) => entry.entityId === house.id && entry.subtype === "complete",
      ),
    ).toEqual(completions);
  });

  it("consumes saved events while admitting the first new event after restore", () => {
    const state = game();
    const spawn = state.map.spawns[0];
    const house = spawnEntity(
      state,
      0,
      "building",
      "house",
      spawn.x + 5,
      spawn.y,
      false,
    );
    house.buildProgress = 1 - 0.05 / house.buildTime;
    const restored = restoreGame(serializeGame(state));
    const cursor = restoredEventCursor(restored);
    const savedEvents = [...restored.events];
    expect(savedEvents.length).toBeGreaterThan(0);
    expect(savedEvents.every((entry) => entry.id <= cursor)).toBe(true);
    expect(restored.events.filter((entry) => entry.id > cursor)).toEqual([]);
    const firstFutureId = restored.nextEventId;
    stepGame(restored, 0.1);
    const future = restored.events.filter((entry) => entry.id > cursor);
    expect(future).toHaveLength(1);
    expect(future[0]).toMatchObject({
      id: firstFutureId,
      type: "build",
      subtype: "complete",
      entityId: house.id,
    });
    expect(battleSound(future[0], restored)).toBe("complete");
    expect(restored.events.filter((entry) => entry.id <= cursor)).toEqual(
      savedEvents,
    );
  });

  it("admits event one when a save has no prior events", () => {
    const cursor = restoredEventCursor({ nextEventId: 1 });
    expect(cursor).toBe(0);
    expect(event({ id: 1 }).id).toBeGreaterThan(cursor);
  });
});
