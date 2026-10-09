import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BUILDINGS, createGame, issueCommand, restoreGame, serializeGame, spawnEntity, stepGame } from "../src/sim";
import { rallyCurrentProducers } from "../src/ui/mass-rally";
import type { BuildingId, GameState } from "../src/sim/types";

// Exercise the exact production action without starting the browser-only app.
const mainSource = readFileSync(new URL("../src/main.ts", import.meta.url), "utf8");
const actionSource = mainSource.match(/case "rally-all": \{([\s\S]*?)\n      break;\n    \}/)![1];
function invokeRally(state: GameState, effects?: { tone?: string; untilResume?: boolean; refreshes: number }) {
  const messages: string[] = [];
  const action = new Function("state", "commander", "issueCommand", "toast", "rallyCurrentProducers", "updateHUD", actionSource);
  action(state, () => state.entities.find(e => e.team === 0 && e.kind === "commander" && e.hp > 0), issueCommand, (message: string, tone?: string, options?: { untilResume?: boolean }) => {
    messages.push(message);
    if (effects) { effects.tone = tone; effects.untilResume = options?.untilResume; }
  }, rallyCurrentProducers, () => { if (effects) effects.refreshes++; });
  return messages.join(" ");
}
function fixture(pending: number | null = null) {
  const state = createGame({ seed: "MASS-RALLY-BOUNDARY", difficulty: "normal", startingGold: 2000, startingWood: 2000 });
  state.players.forEach(player => player.ai = false);
  const hero = state.entities.find(e => e.team === 0 && e.kind === "commander")!;
  const producers = state.entities.filter(e => e.team === 0 && e.kind === "building" && BUILDINGS[e.type as BuildingId]?.recruits.length);
  if (pending !== null) {
    expect(issueCommand(state, { type: "pause", team: 0, paused: true }).ok).toBe(true);
    for (let i = 0; i < pending; i++) expect(issueCommand(state, { type: "hold", team: 0, entityIds: [hero.id] }).ok).toBe(true);
  }
  return { state, hero, producers };
}

describe("mass rally truthful boundary feedback", () => {
  it("queues only current completed producers at zero pending orders", () => {
    const { state, producers } = fixture(0);
    const house = spawnEntity(state, 0, "building", "house", 8, 8);
    const message = invokeRally(state);
    expect(state.pendingCommands.map(command => command.type === "rally" ? command.buildingId : "other")).toEqual(producers.map(producer => producer.id));
    expect(house.rally).toBeNull();
    expect(message).toContain("queued");
    expect(message).toContain("Resume");
  });
  it("reports queued rather than already changed at zero pending orders", () => {
    const { state, producers } = fixture(0);
    const message = invokeRally(state);
    expect(producers.every(producer => !producer.rally)).toBe(true);
    expect(message).toContain("queued");
    expect(message).toContain("Resume");
  });
  it("reports partial acceptance at 59 pending orders", () => {
    const { state } = fixture(59);
    const message = invokeRally(state);
    expect(state.pendingCommands).toHaveLength(60);
    expect(message).toContain("1 of 2");
    expect(message).toContain("Tactical queue is full.");
  });
  it("reports total rejection at 60 pending orders", () => {
    const { state } = fixture(60);
    const before = JSON.stringify(state);
    const message = invokeRally(state);
    expect(JSON.stringify(state)).toBe(before);
    expect(message).toContain("No rally orders queued");
    expect(message).toContain("Tactical queue is full.");
  });
  it("ignores dead and incomplete producers", () => {
    const { state, producers } = fixture();
    const incomplete = spawnEntity(state, 0, "building", "range", 8, 8, false);
    const dead = spawnEntity(state, 0, "building", "stable", 12, 12); dead.hp = 0;
    invokeRally(state);
    expect(producers.every(producer => !!producer.rally)).toBe(true);
    expect(incomplete.rally).toBeNull();
    expect(dead.rally).toBeNull();
  });
  it("reports no eligible producers without inventing success", () => {
    const { state } = fixture();
    state.entities = state.entities.filter(e => e.team !== 0 || e.kind !== "building");
    expect(invokeRally(state)).toContain("No completed production buildings");
  });
  it("retains the recovering commander fallback without issuing orders", () => {
    const { state, hero } = fixture(0); hero.hp = 0;
    const before = JSON.stringify(state);
    expect(invokeRally(state)).toContain("Your commander is recovering");
    expect(JSON.stringify(state)).toBe(before);
  });
});


describe("mass rally command and continuation contract", () => {
  it("sets all five producer types, leaving every other building, enemy and troop unchanged", () => {
    const { state, hero, producers } = fixture();
    for (const type of ["range", "stable", "workshop"] as const)
      producers.push(spawnEntity(state, 0, "building", type, 10, 10));
    const excluded = ["house", "tower", "depot", "blacksmith", "turret"].map(type =>
      spawnEntity(state, 0, "building", type as BuildingId | "turret", 15, 15));
    const incomplete = spawnEntity(state, 0, "building", "range", 20, 20, false);
    const dead = spawnEntity(state, 0, "building", "range", 25, 25); dead.hp = 0;
    const others = [...excluded, incomplete, dead, ...state.entities.filter(e => e.team !== 0 || e.kind !== "building")];
    const before = others.map(e => structuredClone(e));
    const playerBefore = structuredClone(state.players);
    const point = { x: hero.x, y: hero.y };
    const result = rallyCurrentProducers(state);
    expect(result).toEqual({
      accepted: 5, total: 5, queued: false, warning: false,
      message: "Rally set for 5 current producers at this fixed position. New buildings need their own rally point; it will not follow your commander.",
    });
    expect(producers.map(producer => producer.rally)).toEqual(producers.map(() => point));
    expect(others).toEqual(before);
    expect(state.players).toEqual(playerBefore);
    expect(state.commandLog.map(entry => entry.command)).toEqual(producers.map(producer => ({ type: "rally", team: 0, buildingId: producer.id, ...point })));
    expect(state.pendingCommands).toEqual([]);
  });

  it("does not spend the last queue slot on a nonproducer listed ahead of recruitment buildings", () => {
    const { state, producers } = fixture(59);
    const house = spawnEntity(state, 0, "building", "house", 10, 10);
    state.entities = [house, ...state.entities.filter(entity => entity !== house)];
    const result = rallyCurrentProducers(state);
    expect(result).toMatchObject({ accepted: 1, total: 2, queued: true, warning: true });
    expect(state.pendingCommands[59]).toMatchObject({ type: "rally", buildingId: producers[0].id });
    expect(house.rally).toBeNull();
  });

  it.each([0, 58, 59, 60])("preserves accepted and rejected destinations through save and Resume from %i pending orders", pending => {
    const { state, hero, producers } = fixture(pending);
    const previous = { x: 2, y: 2 };
    producers.forEach(producer => producer.rally = { ...previous });
    const point = { x: hero.x, y: hero.y };
    const expectedAccepted = Math.min(producers.length, 60 - pending);
    const result = rallyCurrentProducers(state);
    expect(result).toMatchObject({ accepted: expectedAccepted, total: 2, queued: expectedAccepted > 0, warning: expectedAccepted < 2 });
    expect(state.pendingCommands).toHaveLength(pending + expectedAccepted);
    expect(producers.map(producer => producer.rally)).toEqual([previous, previous]);
    const saved = serializeGame(state);
    const restored = restoreGame(saved);
    expect(serializeGame(restored)).toBe(saved);
    restored.entities.find(entity => entity.id === hero.id)!.x += 3;
    expect(issueCommand(restored, { type: "pause", team: 0, paused: false }).ok).toBe(true);
    expect(restored.pendingCommands).toEqual([]);
    expect(restored.entities.filter(entity => producers.some(producer => producer.id === entity.id)).map(entity => entity.rally))
      .toEqual(producers.map((_, index) => index < expectedAccepted ? point : previous));
    const resumedSave = serializeGame(restored);
    expect(serializeGame(restoreGame(resumedSave))).toBe(resumedSave);
  });

  it("preserves an immediate rally through save and produces attack-moving recruits at the saved fixed point", () => {
    const { state, hero, producers } = fixture();
    // Keep the destination beyond the spawn exit, so arrival cannot finish the order in this tick.
    hero.x = producers[0].x + 9; hero.y = producers[0].y + 3;
    const point = { x: hero.x, y: hero.y };
    rallyCurrentProducers(state);
    const saved = serializeGame(state);
    const restored = restoreGame(saved);
    expect(serializeGame(restored)).toBe(saved);
    restored.entities.find(entity => entity.id === hero.id)!.x += 3;
    const producer = restored.entities.find(entity => entity.id === producers[0].id)!;
    const oldIds = new Set(restored.entities.map(entity => entity.id));
    expect(issueCommand(restored, { type: "recruit", team: 0, unit: "swordsman", buildingId: producer.id }).ok).toBe(true);
    producer.queue[0].remaining = 0.05;
    stepGame(restored, 0.1);
    const recruit = restored.entities.find(entity => entity.team === 0 && !oldIds.has(entity.id))!;
    expect(recruit.order).toMatchObject({ type: "attackMove", ...point });
    expect(producer.rally).toEqual(point);
  });

  it("does not apply existing rally orders to a producer constructed later", () => {
    const { state } = fixture(0);
    rallyCurrentProducers(state);
    const later = spawnEntity(state, 0, "building", "range", 10, 10);
    expect(issueCommand(state, { type: "pause", team: 0, paused: false }).ok).toBe(true);
    expect(later.rally).toBeNull();
  });

  it("reports a repeated click at the cap without changing accepted orders or their saved point", () => {
    const { state, hero } = fixture(58);
    const first = rallyCurrentProducers(state);
    expect(first).toMatchObject({ accepted: 2, queued: true, warning: false });
    hero.x += 3;
    const before = serializeGame(state);
    const second = rallyCurrentProducers(state);
    expect(second).toEqual({ accepted: 0, total: 2, queued: false, warning: true,
      message: "No rally orders queued. Tactical queue is full. Existing rally points are unchanged." });
    expect(serializeGame(state)).toBe(before);
  });

  it("permits a later deliberate immediate rally to take a new commander snapshot", () => {
    const { state, hero, producers } = fixture();
    expect(rallyCurrentProducers(state).accepted).toBe(2);
    hero.x += 3;
    expect(rallyCurrentProducers(state).accepted).toBe(2);
    expect(producers.map(producer => producer.rally)).toEqual(producers.map(() => ({ x: hero.x, y: hero.y })));
  });

  it("uses singular copy when exactly one current producer remains", () => {
    const { state, producers } = fixture(59);
    producers[1].buildProgress = 0.5;
    expect(rallyCurrentProducers(state)).toEqual({ accepted: 1, total: 1, queued: true, warning: false,
      message: "Rally queued for 1 current producer. Resume to apply this fixed point. New buildings need their own rally point; it will not follow your commander." });
  });

  it.each(["dead", "missing"])("does not use another team's commander when the owned commander is %s", status => {
    const { state, hero } = fixture(0);
    if (status === "dead") hero.hp = 0;
    else state.entities = state.entities.filter(entity => entity !== hero);
    const before = JSON.stringify(state);
    expect(rallyCurrentProducers(state)).toMatchObject({ accepted: 0, queued: false, warning: true,
      message: "Your commander is recovering. Set a building rally point in Details." });
    expect(JSON.stringify(state)).toBe(before);
  });

  it.each([false, true])("propagates engine rejection after battle end while paused=%s", paused => {
    const { state } = fixture(paused ? 0 : null);
    state.winner = 1;
    const before = JSON.stringify(state);
    const result = rallyCurrentProducers(state);
    expect(result).toMatchObject({ accepted: 0, total: 2, queued: false, warning: true });
    expect(result.message).toContain("The battle has ended.");
    expect(result.message).toContain("Existing rally points are unchanged.");
    expect(JSON.stringify(state)).toBe(before);
  });

  it("propagates inactive-player rejection instead of inventing success", () => {
    const { state } = fixture();
    state.players[0].defeated = true;
    const before = JSON.stringify(state);
    expect(rallyCurrentProducers(state)).toMatchObject({ accepted: 0, total: 2, queued: false, warning: true,
      message: "No rally points changed. Player is not active. Existing rally points are unchanged." });
    expect(JSON.stringify(state)).toBe(before);
  });

  it.each([0, 59, 60])("wires truthful feedback and HUD refresh to the actual action at %i pending orders", pending => {
    const { state } = fixture(pending);
    const effects = { refreshes: 0 } as { tone?: string; untilResume?: boolean; refreshes: number };
    const message = invokeRally(state, effects);
    expect(effects).toEqual({ tone: pending ? "warning" : "", untilResume: true, refreshes: 1 });
    expect(message).toContain(pending === 60 ? "No rally orders queued." : "Resume to apply this fixed point.");
  });
});
