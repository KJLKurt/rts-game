import { describe, expect, it } from "vitest";
import { createGame, getCommander, spawnEntity } from "../../src/sim/engine";
import { CombatFeedback } from "../../src/render/CombatFeedback";
import type { GameEvent, GameState } from "../../src/sim/types";
function scene() {
  const state = createGame({ mode: "rush", seed: "COMBAT-VIEW-TEST" });
  state.events = [];
  state.time = 10;
  const view = new CombatFeedback();
  return { state, view, hero: getCommander(state)! };
}
function add(
  state: GameState,
  type: GameEvent["type"],
  entityId: string,
  id = 1,
  extra: Partial<GameEvent> = {},
) {
  const entity = state.entities.find((e) => e.id === entityId)!;
  const event: GameEvent = {
    id,
    type,
    entityId,
    time: state.time,
    x: entity.x,
    y: entity.y,
    team: entity.team,
    subtype: entity.type,
    ...extra,
  };
  state.events.push(event);
  return event;
}
const visible = () => true;
describe("bounded event-synchronized combat presentation", () => {
  it("does not animate a release merely because a cooldown is high", () => {
    const { state, view, hero } = scene();
    hero.attackCooldown = hero.attackPeriod;
    view.update(state, 100, visible);
    expect(view.pose(hero, state.entities, state.time).release).toBe(0);
    expect(view.attacks.size).toBe(0);
  });
  it("synchronizes release and recovery to actual attack events and caps interpolation", () => {
    const { state, view, hero } = scene();
    add(state, "attack", hero.id, 1, { targetX: hero.x + 1, targetY: hero.y });
    view.update(state, 100, visible);
    view.update(state, 100.065, visible);
    expect(view.pose(hero, state.entities, state.time).release).toBeCloseTo(1);
    view.update(state, 102, visible);
    expect(view.time).toBeCloseTo(10.1);
    state.time = 10.3;
    view.update(state, 102, visible);
    expect(
      view.pose(hero, state.entities, state.time).recovery,
    ).toBeGreaterThan(0);
    expect(view.pose(hero, state.entities, state.time).release).toBe(0);
  });
  it("freezes the combat presentation clock during tactical pause", () => {
    const { state, view, hero } = scene();
    add(state, "attack", hero.id);
    state.paused = true;
    view.update(state, 100, visible);
    view.update(state, 101, visible);
    expect(view.time).toBe(state.time);
  });
  it("anticipates only when a real target is in weapon range near the end of cooldown", () => {
    const { state, view, hero } = scene();
    const enemy = spawnEntity(
      state,
      1,
      "unit",
      "swordsman",
      hero.x + 1,
      hero.y,
    );
    hero.targetId = enemy.id;
    hero.attackCooldown = 0.1;
    view.update(state, 100, visible);
    expect(
      view.pose(hero, state.entities, state.time).anticipation,
    ).toBeGreaterThan(0);
    enemy.x += 20;
    expect(view.pose(hero, state.entities, state.time).anticipation).toBe(0);
  });
  it("does not replay a hidden event when its location later becomes visible", () => {
    const { state, view, hero } = scene();
    add(state, "attack", hero.id);
    view.update(state, 100, () => false);
    view.update(state, 100.01, visible);
    expect(view.attacks.size).toBe(0);
  });
  it("preserves a seen casualty silhouette after the simulation removes it, then expires it", () => {
    const { state, view } = scene();
    const soldier = state.entities.find((e) => e.kind === "unit")!;
    soldier.facing = 1.2;
    view.update(state, 100, visible);
    add(state, "death", soldier.id, 100);
    state.entities = state.entities.filter((e) => e.id !== soldier.id);
    view.update(state, 100.01, visible);
    expect(view.casualties.get(soldier.id)?.facing).toBe(1.2);
    state.time += 1.5;
    view.update(state, 102, visible);
    expect(view.casualties.size).toBe(0);
  });
  it("bounds casualties even for a burst of hundreds of visible death events", () => {
    const { state, view, hero } = scene();
    for (let id = 1; id <= 400; id++)
      state.events.push({
        id,
        type: "death",
        entityId: `lost-${id}`,
        x: hero.x,
        y: hero.y,
        time: 10,
        team: 1,
        subtype: "swordsman",
      });
    view.update(state, 100, visible);
    expect(view.casualties.size).toBe(256);
  });
  it("records hits independently and never mutates game data", () => {
    const { state, view, hero } = scene();
    add(state, "hit", hero.id, 1, { value: 17 });
    const snapshot = JSON.stringify(state);
    view.update(state, 100, visible);
    expect(view.hitStrength(hero.id)).toBe(1);
    view.pose(hero, state.entities, state.time);
    expect(JSON.stringify(state)).toBe(snapshot);
    state.time += 0.3;
    view.update(state, 101, visible);
    expect(view.hitStrength(hero.id)).toBe(0);
  });
  it("resets transient feedback when switching matches or rewinding a save", () => {
    const { state, view, hero } = scene();
    add(state, "attack", hero.id);
    view.update(state, 100, visible);
    expect(view.attacks.size).toBe(1);
    state.time = 0;
    state.events = [];
    view.update(state, 101, visible);
    expect(view.attacks.size).toBe(0);
    expect(view.casualties.size).toBe(0);
  });
});

describe("observed locomotion", () => {
  it("uses actual displacement, not a stale path or an attack order", () => {
    const { state, view, hero } = scene();
    hero.path = [{ x: hero.x + 5, y: hero.y }];
    hero.order = { type: "move", x: hero.x + 5, y: hero.y };
    view.update(state, 100, visible);
    state.time += 0.1;
    view.update(state, 100.1, visible);
    expect(view.locomotion.get(hero.id)?.moving).toBe(false);
    hero.x += 0.25;
    state.time += 0.1;
    view.update(state, 100.2, visible);
    expect(view.locomotion.get(hero.id)?.moving).toBe(true);
    expect(view.locomotion.get(hero.id)?.distance).toBeCloseTo(0.25);
    state.time += 0.1;
    view.update(state, 100.3, visible);
    expect(view.locomotion.get(hero.id)?.moving).toBe(false);
  });
  it("does not turn a teleport into a sprint animation", () => {
    const { state, view, hero } = scene();
    view.update(state, 100, visible);
    hero.x += 10;
    state.time += 0.1;
    view.update(state, 100.1, visible);
    expect(view.locomotion.get(hero.id)?.moving).toBe(false);
    expect(view.locomotion.get(hero.id)?.distance).toBe(0);
  });
});
