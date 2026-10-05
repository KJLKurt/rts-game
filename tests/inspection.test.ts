import { describe, expect, it } from "vitest";
import {
  createGame,
  issueCommand,
  projectPendingCommands,
  spawnEntity,
} from "../src/sim";
import {
  capacityGainText,
  constructionProgressText,
  economyHTML,
  inspectionHTML,
  productionHTML,
  recruitProducer,
  trainingSeconds,
} from "../src/ui/inspection";
const game = () =>
  createGame({ startingGold: 2000, startingWood: 2000, populationCap: 40 });
describe("accurate production and capacity presentation", () => {
  it("uses the selected producer and combines Logistics with its building upgrade", () => {
    const state = game();
    const producer = state.entities.find(
      (e) => e.team === 0 && e.type === "barracks",
    )!;
    producer.buildingLevel = 2;
    state.players[0].research.logistics = 1;
    expect(recruitProducer(state, "swordsman", producer.id)).toBe(producer);
    expect(trainingSeconds(state, "swordsman", producer)).toBeCloseTo(
      8.5 / 1.15,
    );
    expect(inspectionHTML(state, [producer.id])).toContain("1 population · 8s");
    issueCommand(state, {
      type: "recruit",
      team: 0,
      unit: "swordsman",
      buildingId: producer.id,
    });
    expect(producer.queue[0].total / 1.15).toBe(
      trainingSeconds(state, "swordsman", producer),
    );
  });
  it("preserves selected-producer routing even when that building is unfinished", () => {
    const state = game();
    const producer = state.entities.find(
      (e) => e.team === 0 && e.type === "barracks",
    )!;
    producer.buildProgress = 0.5;
    expect(recruitProducer(state, "swordsman", producer.id)).toBeUndefined();
    expect(recruitProducer(state, "swordsman")?.type).toBe("keep");
  });
  it("makes exact refunds visible and gives production jobs stable keys", () => {
    const state = game();
    const producer = recruitProducer(state, "swordsman")!;
    issueCommand(state, {
      type: "recruit",
      team: 0,
      unit: "swordsman",
      count: 3,
    });
    producer.queue[0].remaining = 5;
    const html = productionHTML(state);
    expect(html).toContain(
      'class="refund-amount">Cancel refund: 22 gold · 5 wood',
    );
    expect(html).toContain(`data-live-key="${producer.queue[2].queueId}"`);
  });
  it("discloses clipped and exhausted capacity without promising impossible gains", () => {
    const state = game();
    state.players[0].populationCap = 38;
    expect(capacityGainText(state, 8)).toBe(
      "+2 capacity now (match ceiling 40)",
    );
    state.players[0].populationCap = 40;
    expect(capacityGainText(state, 4)).toContain("no additional capacity");
    const house = spawnEntity(state, 0, "building", "house", 8, 8);
    state.players[0].populationCap = 40;
    expect(inspectionHTML(state, [house.id])).toContain(
      "no additional capacity. +25% durability",
    );
  });
  it("does not recommend houses when the match ceiling blocks recruitment", () => {
    const state = createGame({
      startingGold: 2000,
      startingWood: 2000,
      populationCap: 12,
    });
    expect(
      issueCommand(state, {
        type: "recruit",
        team: 0,
        unit: "swordsman",
        count: 8,
      }).ok,
    ).toBe(true);
    const result = issueCommand(state, {
      type: "recruit",
      team: 0,
      unit: "swordsman",
    });
    expect(result.error).toContain(
      "Match ceiling 12 reached. Houses cannot raise it.",
    );
    expect(result.error).toContain("0 available");
  });
  it("renders reserved population and spendable resources from a planning snapshot", () => {
    const state = game();
    issueCommand(state, { type: "pause", team: 0, paused: true });
    issueCommand(state, {
      type: "recruit",
      team: 0,
      unit: "swordsman",
      count: 3,
    });
    const html = economyHTML(projectPendingCommands(state));
    expect(html).toContain("1865 Gold");
    expect(html).toContain("<b>3</b> in training");
  });
  it("reports changing construction progress in whole display units", () => {
    const state = game();
    const house = spawnEntity(state, 0, "building", "house", 8, 8, false);
    house.buildProgress = 0.5;
    expect(constructionProgressText(house)).toBe(
      "Under construction · 50% · 6s remaining",
    );
  });
});
