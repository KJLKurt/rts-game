import { describe, expect, it, vi } from "vitest";
import {
  BUILDING_UPGRADES,
  PRODUCTION_QUEUE_LIMIT,
  createGame,
  getUnitCost,
  issueCommand,
  nextBuildingUpgrade,
  populationBreakdown,
  projectPendingCommands,
  spawnEntity,
  technologyCost,
} from "../src/sim";
import type { Entity, GameState } from "../src/sim";
import { buildingInspectionAvailability } from "../src/ui/inspection-availability";
import {
  inspectionAvailabilitySignature,
  inspectionHTML,
} from "../src/ui/inspection";

const game = (populationCap = 40) =>
  createGame({ startingGold: 2000, startingWood: 2000, populationCap });
const building = (state: GameState, type = "barracks") =>
  state.entities.find((entity) => entity.team === 0 && entity.type === type)!;
const train = (state: GameState, producer = building(state)) =>
  buildingInspectionAvailability(state, producer).recruits.swordsman!;
const button = (html: string, action: string, id: string) => {
  const match = html.match(
    new RegExp(`<button data-action="${action}" data-id="${id}"[^>]*>`),
  );
  expect(match).not.toBeNull();
  return match![0];
};
const fillQueue = (producer: Entity, count = PRODUCTION_QUEUE_LIMIT) => {
  producer.queue = Array.from({ length: count }, (_, index) => ({
    type: "unit",
    id: "swordsman",
    queueId: `fixture-${index}`,
    total: 10,
    remaining: 10,
  }));
};

describe("building inspector availability", () => {
  it.each([
    [44, 10, "Requires 45 gold total."],
    [45, 9, "Requires 10 wood total."],
    [44, 9, "Requires 45 gold and 10 wood total."],
  ])(
    "explains a single unit's resource requirement at %s gold and %s wood",
    (gold, wood, reason) => {
      const state = game(),
        producer = building(state);
      Object.assign(state.players[0], { gold, wood });
      expect(train(state)).toEqual({ available: false, reason });
      const html = inspectionHTML(state, [producer.id], null, "train");
      expect(html).toContain(
        `<small class="availability-reason">${reason}</small>`,
      );
      expect(button(html, "recruit", "swordsman")).toContain("disabled");
      expect(button(html, "recruit", "swordsman")).toContain(reason);
    },
  );

  it("uses faction-adjusted prices and enables Train for exactly one unit", () => {
    const state = game();
    state.players[0].faction = "wildborn";
    Object.assign(state.players[0], getUnitCost(state, 0, "swordsman"));
    expect(train(state)).toEqual({ available: true, reason: "" });
    expect(
      button(
        inspectionHTML(state, [building(state).id]),
        "recruit",
        "swordsman",
      ),
    ).not.toContain("disabled");
    state.players[0].gold -= 1;
    expect(train(state).reason).toBe("Requires 41 gold total.");
  });

  it.each([40, 12])(
    "counts fielded and queued troops, distinguishing the match ceiling %s",
    (ceiling) => {
      const state = game(ceiling),
        producer = building(state);
      expect(
        issueCommand(state, {
          type: "recruit",
          team: 0,
          unit: "swordsman",
          count: 8,
          buildingId: producer.id,
        }).ok,
      ).toBe(true);
      // The readout uses actual live units and reserved jobs, even with a stale player counter.
      state.players[0].population = 0;
      expect(populationBreakdown(state)).toMatchObject({
        fielded: 4,
        reserved: 8,
        capacity: 12,
      });
      expect(train(state).available).toBe(false);
      expect(train(state).reason).toContain("Needs 1 free population.");
      if (ceiling === 12) {
        expect(train(state).reason).toContain(
          "Match ceiling 12 reached; Houses cannot raise it.",
        );
        expect(train(state).reason).not.toContain("Build or upgrade");
      } else {
        expect(train(state).reason).toContain("Build or upgrade a House");
      }
      const signature = inspectionAvailabilitySignature(state, [producer.id]);
      expect(
        issueCommand(state, {
          type: "cancelProduction",
          team: 0,
          buildingId: producer.id,
          queueId: producer.queue[0].queueId!,
        }).ok,
      ).toBe(true);
      expect(train(state).available).toBe(true);
      expect(inspectionAvailabilitySignature(state, [producer.id])).not.toBe(
        signature,
      );
    },
  );

  it("checks the selected producer's full queue rather than an idle alternative", () => {
    const state = game(),
      producer = building(state),
      idle = building(state, "keep");
    fillQueue(producer);
    expect(idle.queue).toHaveLength(0);
    expect(train(state).reason).toBe(
      "Production queue full (12/12). Wait or cancel a job.",
    );
    const html = inspectionHTML(state, [producer.id]);
    expect(button(html, "recruit", "swordsman")).toContain("disabled");
    expect(
      buildingInspectionAvailability(state, producer).upgrade.reason,
    ).toContain("Production queue full");
    fillQueue(idle);
    expect(
      buildingInspectionAvailability(state, idle).research.economy!.reason,
    ).toContain("Production queue full");
    expect(
      button(inspectionHTML(state, [idle.id]), "research", "economy"),
    ).toContain("disabled");
  });

  it("requires enough free slots for multi-population units, not merely a non-full cap", () => {
    const state = game(),
      producer = building(state),
      stable = spawnEntity(state, 0, "building", "stable", 8, 8);
    expect(
      issueCommand(state, {
        type: "recruit",
        team: 0,
        unit: "swordsman",
        count: 7,
        buildingId: producer.id,
      }).ok,
    ).toBe(true);
    const blocked = inspectionAvailabilitySignature(state, [stable.id]);
    expect(
      buildingInspectionAvailability(state, stable).recruits.cavalry!.reason,
    ).toContain("Needs 2 free population.");
    expect(train(state).available).toBe(true);
    expect(
      issueCommand(state, {
        type: "cancelProduction",
        team: 0,
        buildingId: producer.id,
        queueId: producer.queue[0].queueId!,
      }).ok,
    ).toBe(true);
    expect(
      buildingInspectionAvailability(state, stable).recruits.cavalry!.available,
    ).toBe(true);
    expect(inspectionAvailabilitySignature(state, [stable.id])).not.toBe(
      blocked,
    );
  });

  it("uses next-level research prices and names the limiting resources", () => {
    const state = game(),
      smith = spawnEntity(state, 0, "building", "blacksmith", 8, 8);
    state.players[0].research.steel = 1;
    expect(technologyCost(state, 0, "steel")).toEqual({ gold: 240, wood: 120 });
    state.players[0].gold = 239;
    expect(
      buildingInspectionAvailability(state, smith).research.steel!.reason,
    ).toBe("Requires 240 gold total.");
    state.players[0].gold = 240;
    state.players[0].wood = 119;
    expect(
      buildingInspectionAvailability(state, smith).research.steel!.reason,
    ).toBe("Requires 120 wood total.");
    state.players[0].wood = 120;
    expect(
      buildingInspectionAvailability(state, smith).research.steel!.available,
    ).toBe(true);
  });

  it("disables research already queued at another producer, and completed research", () => {
    const state = game(),
      keep = building(state, "keep"),
      other = spawnEntity(state, 0, "building", "keep", 8, 8);
    expect(
      issueCommand(state, {
        type: "research",
        team: 0,
        technology: "economy",
        buildingId: other.id,
      }).ok,
    ).toBe(true);
    expect(
      buildingInspectionAvailability(state, keep).research.economy!,
    ).toEqual({
      available: false,
      reason: "Research is already queued for your army.",
    });
    expect(inspectionHTML(state, [keep.id])).toContain(">Queued</button>");
    expect(
      button(inspectionHTML(state, [keep.id]), "research", "economy"),
    ).toContain("disabled");
    other.queue = [];
    state.players[0].research.economy = 2;
    expect(
      buildingInspectionAvailability(state, keep).research.economy!.reason,
    ).toBe("Research is complete.");
    expect(inspectionHTML(state, [keep.id])).toContain(">Complete</button>");
    expect(
      button(inspectionHTML(state, [keep.id]), "research", "economy"),
    ).toContain("disabled");
  });

  it("uses the next upgrade's price and disables queued or maximum-level upgrades", () => {
    const state = game(),
      producer = building(state),
      price = nextBuildingUpgrade(producer)!.cost;
    state.players[0].gold = price.gold - 1;
    expect(buildingInspectionAvailability(state, producer).upgrade.reason).toBe(
      `Requires ${price.gold} gold total.`,
    );
    state.players[0].gold = price.gold;
    state.players[0].wood = price.wood - 1;
    expect(buildingInspectionAvailability(state, producer).upgrade.reason).toBe(
      `Requires ${price.wood} wood total.`,
    );
    state.players[0].wood = price.wood;
    expect(
      buildingInspectionAvailability(state, producer).upgrade.available,
    ).toBe(true);
    expect(
      issueCommand(state, {
        type: "upgradeBuilding",
        team: 0,
        buildingId: producer.id,
      }).ok,
    ).toBe(true);
    expect(buildingInspectionAvailability(state, producer).upgrade.reason).toBe(
      "Building upgrade is already queued.",
    );
    expect(
      button(
        inspectionHTML(state, [producer.id]),
        "upgrade-building",
        producer.id,
      ),
    ).toContain("disabled");
    producer.queue = [];
    producer.buildingLevel = 1 + BUILDING_UPGRADES.barracks.length;
    expect(
      buildingInspectionAvailability(state, producer).upgrade.reason,
    ).toContain("maximum level");
    expect(inspectionHTML(state, [producer.id])).not.toContain(
      'data-action="upgrade-building"',
    );
  });

  it("keeps construction and learning restrictions intact", () => {
    const state = game(),
      producer = building(state, "keep");
    producer.buildProgress = 0.5;
    const view = buildingInspectionAvailability(state, producer);
    expect(view.recruits.swordsman!.reason).toBe("Finish construction first.");
    expect(view.research.economy!.reason).toBe("Finish construction first.");
    expect(view.upgrade.reason).toBe("Finish construction first.");
    const html = inspectionHTML(state, [producer.id]);
    for (const [action, id] of [
      ["recruit", "swordsman"],
      ["research", "economy"],
      ["upgrade-building", producer.id],
    ]) {
      expect(button(html, action, id)).toContain("disabled");
    }
    const lesson = inspectionHTML(state, [producer.id], 3);
    expect(lesson).not.toContain('data-action="recruit"');
    expect(lesson).not.toContain('data-action="research"');
    expect(lesson).not.toContain('data-action="upgrade-building"');
    expect(lesson).toContain("Building upgrades open later in the guide.");
    const house = spawnEntity(state, 0, "building", "house", 8, 8);
    expect(inspectionHTML(state, [house.id], 5)).not.toContain(
      'data-action="upgrade-building"',
    );
    expect(
      button(
        inspectionHTML(state, [house.id], 6),
        "upgrade-building",
        house.id,
      ),
    ).not.toContain("disabled");
  });

  it("uses reserved funds from the supplied planning snapshot and re-enables after a refund", () => {
    const state = game(),
      producer = building(state);
    Object.assign(state.players[0], getUnitCost(state, 0, "swordsman"));
    expect(
      issueCommand(state, { type: "pause", team: 0, paused: true }).ok,
    ).toBe(true);
    expect(
      issueCommand(state, {
        type: "recruit",
        team: 0,
        unit: "swordsman",
        buildingId: producer.id,
      }).ok,
    ).toBe(true);
    const planned = projectPendingCommands(state),
      plannedProducer = building(planned);
    expect(train(state).available).toBe(true);
    expect(train(planned).reason).toBe("Requires 45 gold and 10 wood total.");
    expect(
      button(inspectionHTML(planned, [producer.id]), "recruit", "swordsman"),
    ).toContain("disabled");
    expect(
      issueCommand(planned, {
        type: "cancelProduction",
        team: 0,
        buildingId: plannedProducer.id,
        queueId: plannedProducer.queue[0].queueId!,
      }).ok,
    ).toBe(true);
    expect(train(planned).available).toBe(true);
    expect(
      button(inspectionHTML(planned, [producer.id]), "recruit", "swordsman"),
    ).not.toContain("disabled");
  });

  it("reflects planned population, research and upgrade reservations", () => {
    const state = game(),
      producer = building(state),
      keep = building(state, "keep");
    expect(
      issueCommand(state, { type: "pause", team: 0, paused: true }).ok,
    ).toBe(true);
    expect(
      issueCommand(state, {
        type: "recruit",
        team: 0,
        unit: "swordsman",
        count: 8,
        buildingId: producer.id,
      }).ok,
    ).toBe(true);
    expect(
      issueCommand(state, {
        type: "research",
        team: 0,
        technology: "economy",
        buildingId: keep.id,
      }).ok,
    ).toBe(true);
    expect(
      issueCommand(state, {
        type: "upgradeBuilding",
        team: 0,
        buildingId: producer.id,
      }).ok,
    ).toBe(true);
    const planned = projectPendingCommands(state);
    expect(train(planned).reason).toContain("Needs 1 free population.");
    expect(
      buildingInspectionAvailability(planned, building(planned, "keep"))
        .research.economy!.reason,
    ).toContain("already queued");
    expect(
      buildingInspectionAvailability(planned, building(planned)).upgrade.reason,
    ).toContain("already queued");
    expect(state.players[0].gold).toBe(2000);
    expect(producer.queue).toHaveLength(0);
  });
});

describe("inspector availability invalidation", () => {
  it("changes at single-unit affordability thresholds, not ordinary income ticks", () => {
    const state = game(),
      producer = building(state),
      selection = [producer.id];
    state.players[0].gold = 40;
    const before = inspectionAvailabilitySignature(state, selection);
    state.players[0].gold += 0.25;
    state.players[0].wood += 0.25;
    expect(inspectionAvailabilitySignature(state, selection)).toBe(before);
    state.players[0].gold = 45;
    const affordable = inspectionAvailabilitySignature(state, selection);
    expect(affordable).not.toBe(before);
    state.players[0].gold += 0.25;
    expect(inspectionAvailabilitySignature(state, selection)).toBe(affordable);
    state.players[0].gold = 44.99;
    expect(inspectionAvailabilitySignature(state, selection)).toBe(before);
  });

  it("ignores health, construction progress and job timers until their availability changes", () => {
    const state = game(),
      producer = building(state),
      selection = [producer.id];
    producer.buildProgress = 0.2;
    const unfinished = inspectionAvailabilitySignature(state, selection);
    producer.buildProgress = 0.9;
    producer.hp -= 10;
    expect(inspectionAvailabilitySignature(state, selection)).toBe(unfinished);
    producer.buildProgress = 1;
    expect(inspectionAvailabilitySignature(state, selection)).not.toBe(
      unfinished,
    );
    fillQueue(producer);
    const full = inspectionAvailabilitySignature(state, selection);
    producer.queue[0].remaining -= 0.1;
    expect(inspectionAvailabilitySignature(state, selection)).toBe(full);
    producer.queue.pop();
    expect(inspectionAvailabilitySignature(state, selection)).not.toBe(full);
  });

  it("changes for research and upgrade statuses, including work at another producer", () => {
    const state = game(),
      keep = building(state, "keep"),
      other = spawnEntity(state, 0, "building", "keep", 8, 8),
      selection = [keep.id];
    const available = inspectionAvailabilitySignature(state, selection);
    expect(
      issueCommand(state, {
        type: "research",
        team: 0,
        technology: "economy",
        buildingId: other.id,
      }).ok,
    ).toBe(true);
    const queued = inspectionAvailabilitySignature(state, selection);
    expect(queued).not.toBe(available);
    other.queue = [];
    state.players[0].research.economy = 2;
    const completed = inspectionAvailabilitySignature(state, selection);
    expect(completed).not.toBe(queued);
    expect(
      issueCommand(state, {
        type: "upgradeBuilding",
        team: 0,
        buildingId: keep.id,
      }).ok,
    ).toBe(true);
    const upgradeQueued = inspectionAvailabilitySignature(state, selection);
    expect(upgradeQueued).not.toBe(completed);
    keep.queue = [];
    keep.buildingLevel = 1 + BUILDING_UPGRADES.keep.length;
    expect(inspectionAvailabilitySignature(state, selection)).not.toBe(
      upgradeQueued,
    );
  });

  it("does not clone, simulate, or mutate the supplied state and selection", () => {
    const state = game(),
      producer = building(state),
      selection = [producer.id];
    issueCommand(state, { type: "pause", team: 0, paused: true });
    issueCommand(state, {
      type: "recruit",
      team: 0,
      unit: "swordsman",
      buildingId: producer.id,
    });
    const planned = projectPendingCommands(state),
      before = JSON.stringify(planned),
      original = JSON.stringify(state);
    const clone = vi.spyOn(globalThis, "structuredClone");
    try {
      buildingInspectionAvailability(planned, building(planned));
      inspectionAvailabilitySignature(planned, selection);
      inspectionHTML(planned, selection);
      expect(clone).not.toHaveBeenCalled();
      expect(JSON.stringify(planned)).toBe(before);
      expect(JSON.stringify(state)).toBe(original);
      expect(selection).toEqual([producer.id]);
      expect(inspectionAvailabilitySignature(planned, [])).toBe("");
      expect(
        inspectionAvailabilitySignature(planned, [
          producer.id,
          building(planned, "keep").id,
        ]),
      ).toBe("");
    } finally {
      clone.mockRestore();
    }
  });
});

describe("live tactical queue context", () => {
  it("blocks projected inspector actions at the actual 60-order limit and re-enables below it", () => {
    const state = game();
    const hero = state.entities.find(
      (entity) => entity.team === 0 && entity.kind === "commander",
    )!;
    const keep = building(state, "keep");
    issueCommand(state, { type: "pause", team: 0, paused: true });
    for (let i = 0; i < 60; i++)
      expect(
        issueCommand(state, { type: "hold", team: 0, entityIds: [hero.id] }).ok,
      ).toBe(true);
    expect(
      issueCommand(state, {
        type: "recruit",
        team: 0,
        unit: "swordsman",
        buildingId: keep.id,
      }),
    ).toMatchObject({ ok: false, error: "Tactical queue is full." });
    const planned = projectPendingCommands(state);
    expect(planned.paused).toBe(false);
    expect(planned.pendingCommands).toHaveLength(0);
    const view = buildingInspectionAvailability(
      planned,
      building(planned, "keep"),
      true,
    );
    for (const status of [
      view.recruits.swordsman!,
      view.research.economy!,
      view.upgrade,
    ]) {
      expect(status.available).toBe(false);
      expect(status.reason).toContain("Tactical queue full (60/60)");
    }
    expect(
      inspectionHTML(planned, [keep.id], undefined, "train", true),
    ).toContain("Tactical queue full (60/60)");
    expect(inspectionAvailabilitySignature(planned, [keep.id], true)).not.toBe(
      inspectionAvailabilitySignature(planned, [keep.id], false),
    );
    state.pendingCommands.pop();
    const below = projectPendingCommands(state);
    expect(
      buildingInspectionAvailability(below, building(below, "keep"), false)
        .recruits.swordsman!.available,
    ).toBe(true);
    expect(
      issueCommand(state, {
        type: "recruit",
        team: 0,
        unit: "swordsman",
        buildingId: keep.id,
      }).ok,
    ).toBe(true);
  });
});
