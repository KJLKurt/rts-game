import { describe, expect, it } from "vitest";
import { createGame, getCommander, issueCommand, restoreGame, serializeGame, stepGame } from "../src/sim";
import { findLearningHouseSite, houseHasRoom, learningHouseGuidance } from "../src/ui/learning-placement";
import { hasNeighboringHouses } from "../src/ui/learning";
import { plannedBuildResult } from "../src/ui/placement";
import fixture from "./fixtures/practice-isolated-houses.json";

describe("Practice House placement and saved isolated-site recovery", () => {
  it("explains the exact earned two-House save and finds a legal neighbor without changing it", () => {
    const state = restoreGame(fixture.battle.game), before = serializeGame(state);
    expect(hasNeighboringHouses(state)).toBe(false);
    expect(houseHasRoom(state, { x: 2.5, y: 16.5 })).toBe(false);
    expect(learningHouseGuidance(state)).toContain("too far apart");
    expect(learningHouseGuidance(state)).toContain("one more");
    const point = findLearningHouseSite(state, getCommander(state)!)!;
    expect(point).toBeDefined();
    expect(plannedBuildResult(state, 0, "house", point.x, point.y).ok).toBe(true);
    expect(Math.hypot(point.x - 9, point.y - 13.5)).toBeGreaterThanOrEqual(2.25);
    expect(Math.hypot(point.x - 9, point.y - 13.5)).toBeLessThanOrEqual(3);
    expect(serializeGame(state)).toBe(before);
  });
  it("warns about the legal (2.5,16.5) first site and explains starting a new pair", () => {
    // Detached geometry counterfactual of the earned map: remove the two Houses
    // to inspect the original site's legality. This is not an earned save.
    const state = restoreGame(fixture.battle.game);
    state.entities = state.entities.filter(e => e.type !== "house");
    state.navigationVersion++;
    state.paused = false;
    state.players[0].wood = 200;
    const point = { x: 2.5, y: 16.5 };
    expect(plannedBuildResult(state, 0, "house", point.x, point.y).ok).toBe(true);
    expect(houseHasRoom(state, point)).toBe(false);
    expect(issueCommand(state, { type: "build", team: 0, building: "house", ...point }).ok).toBe(true);
    expect(learningHouseGuidance(state)).toContain("no room for a neighbor");
    expect(learningHouseGuidance(state)).toContain("two more Houses");
    const suggested = findLearningHouseSite(state, getCommander(state)!)!;
    expect(suggested).toBeDefined();
    expect(houseHasRoom(state, suggested)).toBe(true);
    expect(state.entities.filter(e => e.type === "house")).toHaveLength(1);
  });
  it("suggests a fresh pair that passes unchanged construction and lesson rules", () => {
    const state = createGame({ learning: true });
    const first = findLearningHouseSite(state, getCommander(state)!)!;
    expect(first).toBeDefined();
    expect(houseHasRoom(state, first)).toBe(true);
    expect(issueCommand(state, { type: "build", team: 0, building: "house", ...first }).ok).toBe(true);
    stepGame(state, 13);
    const second = findLearningHouseSite(state, getCommander(state)!)!;
    expect(second).toBeDefined();
    expect(issueCommand(state, { type: "build", team: 0, building: "house", ...second }).ok).toBe(true);
    stepGame(state, 13);
    expect(state.entities.filter(e => e.type === "house")).toHaveLength(2);
    expect(hasNeighboringHouses(state)).toBe(true);
  });
  it("does not mistake low funds for missing future room or permit an unaffordable build", () => {
    const state = createGame({ learning: true });
    const point = findLearningHouseSite(state, getCommander(state)!)!;
    state.players[0].wood = 0;
    const before = serializeGame(state);
    expect(houseHasRoom(state, point)).toBe(true);
    expect(findLearningHouseSite(state, getCommander(state)!)).toBeUndefined();
    expect(plannedBuildResult(state, 0, "house", point.x, point.y).ok).toBe(false);
    expect(serializeGame(state)).toBe(before);
  });
  it("accounts for queued footprints and asks to resume an already planned pair", () => {
    const state = createGame({ learning: true });
    issueCommand(state, { type: "pause", team: 0, paused: true });
    const first = findLearningHouseSite(state, getCommander(state)!)!;
    issueCommand(state, { type: "build", team: 0, building: "house", ...first });
    const second = findLearningHouseSite(state, getCommander(state)!)!;
    expect(second).toBeDefined();
    issueCommand(state, { type: "build", team: 0, building: "house", ...second });
    const before = serializeGame(state);
    expect(learningHouseGuidance(state)).toContain("resume if paused");
    expect(serializeGame(state)).toBe(before);
    expect(plannedBuildResult(state, 0, "house", first.x, first.y).ok).toBe(false);
    expect(hasNeighboringHouses(state)).toBe(false);
    issueCommand(state, { type: "pause", team: 0, paused: false });
    stepGame(state, 13);
    expect(hasNeighboringHouses(state)).toBe(true);
  });
});
