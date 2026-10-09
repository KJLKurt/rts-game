import { describe, expect, it } from "vitest";
import { createGame, restoreGame, serializeGame } from "../src/sim";
import { validateScaleSettings } from "../src/sim/scales";
import {
  defaultMapRules,
  validateMapPlayerSlots,
  validateMapRules,
  validateMapScenario,
  validateScenarioGeometry,
} from "../src/sim/scenarios";
import type { GameMap, ResourceNode } from "../src/sim/types";
import {
  createWorkshopPreview,
  createWorkshopTest,
  ensureWorkshopMap,
  eraseWorkshopObjects,
  exportWorkshopMap,
  importWorkshopMap,
  placeWorkshopCamp,
  placeWorkshopEntity,
  placeWorkshopNode,
  placeWorkshopObject,
  readWorkshopSettings,
  removeWorkshopObject,
  renderWorkshopPalette,
  renderWorkshopSettings,
  resizeWorkshopMap,
  setWorkshopBiome,
  setWorkshopSlotCount,
  updateWorkshopRules,
  updateWorkshopSlot,
  validateWorkshopMap,
  validateWorkshopStructure,
  WorkshopLibrary,
  WorkshopTestSession,
  type WorkshopMap,
  type WorkshopStore,
  type WorkshopView,
} from "../src/ui/workshop";

function fixture(): WorkshopMap {
  const width = 32,
    height = 32,
    tiles: GameMap["tiles"] = Array(1024).fill("grass");
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (x === 0 || y === 0 || x === 31 || y === 31)
        tiles[y * width + x] = "rock";
  const node = (
    id: string,
    kind: ResourceNode["kind"],
    x: number,
    y: number,
    owner: number | null,
  ): ResourceNode => ({
    id,
    kind,
    x,
    y,
    owner,
    captureTeam: null,
    captureProgress: 0,
    radius: 2.2,
    income: kind === "relic" ? 0 : 2,
    amount: kind === "relic" ? 0 : 2000,
    maxAmount: kind === "relic" ? 0 : 2000,
  });
  return ensureWorkshopMap({
    version: 4,
    seed: "WORKSHOP-TEST",
    biome: "grasslands",
    width,
    height,
    tiles,
    spawns: [
      { x: 6.5, y: 16.5 },
      { x: 25.5, y: 16.5 },
    ],
    nodes: [
      node("gold-0", "gold", 6.5, 11.5, 0),
      node("wood-0", "wood", 6.5, 21.5, 0),
      node("gold-1", "gold", 25.5, 11.5, 1),
      node("wood-1", "wood", 25.5, 21.5, 1),
      node("expansion", "gold", 16.5, 11.5, null),
      node("objective", "relic", 16.5, 16.5, null),
    ],
    validation: {
      valid: true,
      errors: [],
      warnings: [],
      reachablePercent: 1,
      fairness: 1,
    },
  });
}
const camp = {
  x: 17.5,
  y: 25.5,
  unit: "spearman" as const,
  count: 3,
  radius: 2,
  rewardGold: 100,
  rewardWood: 50,
};
const view: WorkshopView = {
  camera: { x: 320, y: 400, zoom: 0.75 },
  mode: "pan",
  brush: "unit:archer",
  brushSize: 3,
  team: 1,
};

describe("workshop schema and safety", () => {
  it.each([90, 91, 120, 180])(
    "accepts a %i-minute workshop target for validation and launch",
    (duration) => {
      const map = updateWorkshopRules(fixture(), { duration });
      expect(validateWorkshopMap(map).errors).toEqual([]);
      expect(createWorkshopTest(map).duration).toBe(duration);
    },
  );
  it("upgrades legacy maps with independent scenario defaults without changing the source", () => {
    const legacy = createGame({ mapSize: "tiny" }).map,
      original = structuredClone(legacy);
    const map = ensureWorkshopMap(legacy, {
      duration: 40,
      faction: "arcanists",
    });
    expect(map.scenario!.rules.duration).toBe(40);
    expect(map.scenario!.slots[0].faction).toBe("arcanists");
    expect(map.scenario!.slots[1].controller).toBe("ai");
    expect(legacy).toEqual(original);
    expect(validateWorkshopMap(map).errors).toEqual([]);
  });
  it("preserves an unfinished safe draft through import and reports actionable play errors", () => {
    const map = updateWorkshopRules(fixture(), { startingForces: "authored" }),
      imported = importWorkshopMap(exportWorkshopMap(map));
    expect(imported).toEqual(map);
    expect(validateWorkshopMap(imported).errors).toEqual(
      expect.arrayContaining([
        "Player 1 needs exactly one Command Keep with authored starting forces.",
        "Player 2 needs exactly one Command Keep with authored starting forces.",
      ]),
    );
  });
  it("rejects hostile maps and mismatched entity types without invoking accessors", () => {
    expect(() => importWorkshopMap('{"__proto__":{"polluted":true}}')).toThrow(
      /forbidden/,
    );
    const map = fixture();
    map.scenario!.startingEntities.push({
      id: "bad",
      kind: "unit",
      type: "house",
      team: 0,
      x: 12.5,
      y: 24.5,
    } as never);
    expect(validateWorkshopStructure(map).join()).toMatch(/types/);
    let invoked = false;
    Object.defineProperty(map, "scenario", {
      enumerable: true,
      get() {
        invoked = true;
        throw new Error("Must not run");
      },
    });
    expect(validateWorkshopStructure(map)).toEqual([
      "Data accessors are not supported.",
    ]);
    expect(invoked).toBe(false);
  });
  it("checks rules limits and keeps alliance identities separate from player control", () => {
    const slots = fixture().scenario!.slots;
    slots[1].alliance = 0;
    expect(validateMapPlayerSlots(slots)).toContain(
      "Assign at least two opposing alliances before testing.",
    );
    expect(validateMapPlayerSlots(slots, false)).toEqual([]);
    slots[1].controller = "human";
    expect(validateMapPlayerSlots(slots).join()).toMatch(/Only player 1/);
    expect(
      validateMapRules({
        ...defaultMapRules(),
        duration: 180,
        populationCap: 200,
        gameSpeed: 2,
        incomeRate: 3,
      }),
    ).toEqual([]);
    expect(
      validateMapRules({
        ...defaultMapRules(),
        duration: 181,
        populationCap: 200.5,
        gameSpeed: 0,
        startingGold: -1,
      }),
    ).toHaveLength(4);
  });
  it("rejects duplicate camps, excessive counts, and unsupported scenario fields", () => {
    const scenario = placeWorkshopCamp(fixture(), camp).scenario!;
    scenario.camps.push({ ...scenario.camps[0] });
    expect(validateMapScenario(scenario, 32, 32, 2, false).join()).toMatch(
      /unique IDs/,
    );
    scenario.camps.pop();
    scenario.camps[0].count = 13;
    expect(validateMapScenario(scenario, 32, 32, 2, false).join()).toMatch(
      /1–12/,
    );
    expect(
      validateMapScenario(
        { ...scenario, script: "alert(1)" },
        32,
        32,
        2,
        false,
      ).join(),
    ).toMatch(/declarative/);
  });
});

describe("workshop duration context", () => {
  describe.each([3, 4, 5] as const)("map version %i", (version) => {
    it.each([4, 90, 91, 120, 180])(
      "preserves a %i-minute target through JSON, launch, save and test return",
      (duration) => {
        const source = fixture();
        source.version = version;
        const map = updateWorkshopRules(source, { duration }),
          original = structuredClone(map),
          imported = importWorkshopMap(exportWorkshopMap(map)),
          session = new WorkshopTestSession(),
          settings = session.begin(imported, view);
        expect(imported).toEqual(map);
        expect(settings).toMatchObject({
          duration,
          mapGenerationVersion: version,
          matchScale: "custom",
          customMap: { version, scenario: { rules: { duration } } },
        });
        expect(validateScaleSettings(settings)).toEqual([]);
        const state = createGame(settings),
          restored = restoreGame(serializeGame(state));
        expect(restored.settings.duration).toBe(duration);
        expect(restored.settings.mapGenerationVersion).toBe(version);
        expect(restored.map.scenario!.rules.duration).toBe(duration);
        expect(serializeGame(restored)).toBe(serializeGame(state));
        // Rebuild launch settings from persisted authored data, not a prior setup.
        const reconstructed = createWorkshopTest(
          importWorkshopMap(exportWorkshopMap(restored.map)),
        );
        expect(reconstructed.duration).toBe(duration);
        expect(createGame(reconstructed).settings.duration).toBe(duration);
        state.map.scenario!.rules.duration = 18;
        (settings.customMap as WorkshopMap).scenario!.rules.duration = 18;
        const resumed = new WorkshopTestSession();
        resumed.resume(JSON.parse(JSON.stringify(session.export())));
        expect(resumed.restore()).toEqual({ version: 1, map, view });
        expect(map).toEqual(original);
      },
    );
  });
  it.each([3, 181])(
    "rejects an out-of-range %i-minute authored target",
    (duration) => {
      const map = fixture();
      expect(() => updateWorkshopRules(map, { duration })).toThrow(
        "Match duration must be between 4 and 180 minutes.",
      );
      map.scenario!.rules.duration = duration;
      expect(validateWorkshopMap(map).errors).toContain(
        "Match duration must be between 4 and 180 minutes.",
      );
      expect(() => createWorkshopTest(map)).toThrow(/4 and 180/);
      expect(() => importWorkshopMap(JSON.stringify(map))).toThrow(/4 and 180/);
    },
  );
  it.each([NaN, Infinity, -Infinity])(
    "rejects a nonfinite authored target (%s)",
    (duration) => {
      const map = fixture();
      map.scenario!.rules.duration = duration;
      expect(validateWorkshopStructure(map)).not.toEqual([]);
      expect(() => createWorkshopTest(map)).toThrow();
    },
  );
  it.each([undefined, 3, 4] as const)(
    "retains the 90-minute generated-map limit for version %s",
    (mapGenerationVersion) => {
      expect(
        validateScaleSettings({ mapGenerationVersion, duration: 90 }),
      ).toEqual([]);
      expect(
        createGame({ mapGenerationVersion, duration: 90 }).settings.duration,
      ).toBe(90);
      for (const duration of [91, 120, 180]) {
        expect(
          validateScaleSettings({ mapGenerationVersion, duration }),
        ).toEqual(["Targets longer than 90 minutes require generator v5."]);
        expect(() => createGame({ mapGenerationVersion, duration })).toThrow(
          "Targets longer than 90 minutes require generator v5.",
        );
      }
    },
  );
  it("retains v5 generated targets and shared bounds without a custom map", () => {
    expect(
      createGame({ mapGenerationVersion: 5, duration: 180 }).settings.duration,
    ).toBe(180);
    for (const duration of [3, 181])
      expect(
        validateScaleSettings({ mapGenerationVersion: 5, duration }),
      ).toContain("duration must be between 4 and 180.");
  });
  it("still rejects an over-budget long map and missing authored keeps", () => {
    const overBudget = updateWorkshopRules(setWorkshopSlotCount(fixture(), 4), {
      duration: 180,
      populationCap: 200,
    });
    expect(validateWorkshopMap(overBudget).errors.join()).toMatch(/600 total/);
    expect(() => createWorkshopTest(overBudget)).toThrow(/600 total/);
    const missingKeeps = updateWorkshopRules(fixture(), {
      duration: 180,
      startingForces: "authored",
    });
    expect(validateWorkshopMap(missingKeeps).errors).toEqual([
      "Player 1 needs exactly one Command Keep with authored starting forces.",
      "Player 2 needs exactly one Command Keep with authored starting forces.",
    ]);
    expect(() => createWorkshopTest(missingKeeps)).toThrow(/Command Keep/);
  });
});

describe("dimensions, biome, players, and rules", () => {
  it("grows a rectangular map and translates every object without retaining an interior border wall", () => {
    let map = fixture();
    map.tiles[8 * map.width + 8] = "water";
    map = placeWorkshopEntity(map, {
      kind: "building",
      type: "house",
      team: 0,
      x: 12,
      y: 24,
      buildingLevel: 2,
    });
    map = placeWorkshopCamp(map, camp);
    const resized = resizeWorkshopMap(map, 40, 36);
    expect(resized.spawns[0]).toEqual({ x: 10.5, y: 18.5 });
    expect(resized.nodes[0].x).toBe(map.nodes[0].x + 4);
    expect(resized.scenario!.startingEntities[0]).toMatchObject({
      x: 16,
      y: 26,
      buildingLevel: 2,
    });
    expect(resized.scenario!.camps[0]).toMatchObject({ x: 21.5, y: 27.5 });
    expect(resized.tiles[10 * 40 + 12]).toBe("water");
    expect(resized.tiles[10 * 40 + 4]).toBe("grass");
    expect(resized.tiles[0]).toBe("rock");
    expect(resized.tiles).toHaveLength(1440);
    expect(map.width).toBe(32);
    expect(resized.validation.errors).toEqual([]);
  });
  it("rejects a destructive shrink atomically and supports the maximum size", () => {
    const map = fixture(),
      before = structuredClone(map);
    expect(() => resizeWorkshopMap(map, 16, 16)).toThrow(/cut off/);
    expect(map).toEqual(before);
    expect(resizeWorkshopMap(map, 160, 160).tiles).toHaveLength(25600);
    expect(() => resizeWorkshopMap(map, 161, 32)).toThrow(/16 to 160/);
  });
  it("changes biome ground while preserving painted roads, water, and woods", () => {
    const map = fixture();
    map.tiles[100] = "forest";
    map.tiles[101] = "water";
    map.tiles[102] = "road";
    const desert = setWorkshopBiome(map, "desert");
    expect(desert.tiles[103]).toBe("sand");
    expect(desert.tiles.slice(100, 103)).toEqual(["forest", "water", "road"]);
    expect(setWorkshopBiome(desert, "snow").tiles[103]).toBe("snow");
    expect(setWorkshopBiome(map, "snow", false).tiles[103]).toBe("grass");
  });
  it("adds slots without relocating retained spawns and refuses to remove owned content", () => {
    const original = fixture(),
      map = setWorkshopSlotCount(original, 4);
    expect(map.spawns.slice(0, 2)).toEqual(original.spawns);
    expect(map.scenario!.slots.map((slot) => slot.alliance)).toEqual([
      0, 1, 2, 3,
    ]);
    const owned = placeWorkshopNode(
      map,
      "wood",
      { x: 10.5, y: 5.5 },
      { owner: 3 },
    );
    expect(() => setWorkshopSlotCount(owned, 2)).toThrow(/Reassign/);
    expect(setWorkshopSlotCount(map, 2).spawns).toEqual(original.spawns);
    expect(() => updateWorkshopSlot(map, 3, { controller: "human" })).toThrow(
      /Only player 1/,
    );
  });
  it("round-trips player choices, closed slots, victory rules, and complete economy settings", () => {
    let map = setWorkshopSlotCount(fixture(), 3);
    map = updateWorkshopSlot(map, 2, {
      controller: "closed",
      name: "Reserve",
      difficulty: "brutal",
      alliance: 0,
    });
    map = updateWorkshopRules(map, {
      mode: "conquest",
      duration: 120,
      populationCap: 160,
      startingGold: 999,
      scoreTarget: 9000,
      gameSpeed: 1.5,
      incomeRate: 2,
    });
    expect(importWorkshopMap(exportWorkshopMap(map))).toEqual(map);
  });
});

describe("placed scenario content and routes", () => {
  it("does not require playable terrain or supplies for a closed reserve slot", () => {
    const map = updateWorkshopSlot(setWorkshopSlotCount(fixture(), 3), 2, {
      controller: "closed",
    });
    map.spawns[2] = { x: 3.5, y: 3.5 };
    map.tiles[3 * map.width + 3] = "water";
    expect(validateWorkshopMap(map).errors).toEqual([]);
    expect(createWorkshopTest(map).slots![2].controller).toBe("closed");
  });
  it("round-trips building levels, units, camps, objectives, owners and stable IDs", () => {
    let map = placeWorkshopEntity(fixture(), {
      kind: "building",
      type: "house",
      team: 0,
      x: 12.23,
      y: 24.14,
      buildingLevel: 3,
    });
    map = placeWorkshopObject(
      map,
      "unit:archer",
      { x: 10.3, y: 26.2 },
      { team: 1 },
    );
    map = placeWorkshopCamp(map, camp);
    map = placeWorkshopNode(map, "relic", { x: 20.5, y: 5.5 }, { owner: 1 });
    expect(map.scenario!.startingEntities[0]).toMatchObject({
      x: 12,
      y: 24,
      buildingLevel: 3,
    });
    expect(map.scenario!.startingEntities[1]).toMatchObject({
      kind: "unit",
      type: "archer",
      team: 1,
      x: 10.5,
      y: 26.5,
    });
    expect(map.nodes.at(-1)).toMatchObject({
      kind: "relic",
      owner: 1,
      amount: 0,
      income: 0,
    });
    expect(importWorkshopMap(exportWorkshopMap(map))).toEqual(map);
    expect(validateWorkshopMap(map).errors).toEqual([]);
    const entity = map.scenario!.startingEntities[0];
    map = placeWorkshopEntity(map, { ...entity, x: 12, y: 27 });
    expect(map.scenario!.startingEntities).toHaveLength(2);
    expect(map.scenario!.startingEntities[0].id).toBe(entity.id);
  });
  it("blocks invalid terrain, overlapping buildings, blocked camps and extra standard commanders", () => {
    const map = fixture();
    map.tiles[24 * map.width + 12] = "water";
    expect(() =>
      placeWorkshopEntity(map, {
        kind: "building",
        type: "house",
        team: 0,
        x: 12,
        y: 24,
      }),
    ).toThrow(/footprint/);
    expect(() =>
      placeWorkshopEntity(fixture(), {
        kind: "building",
        type: "house",
        team: 0,
        x: 6.5,
        y: 16.5,
      }),
    ).toThrow(/gap/);
    expect(() =>
      placeWorkshopEntity(fixture(), {
        kind: "commander",
        type: "ranger",
        team: 0,
        x: 12.5,
        y: 24.5,
      }),
    ).toThrow(/Standard forces/);
    expect(() =>
      placeWorkshopCamp(fixture(), { ...camp, x: 1.5, y: 1.5 }),
    ).toThrow(/inside the map/);
    expect(() => placeWorkshopNode(map, "gold", { x: 12.5, y: 24.5 })).toThrow(
      /walkable/,
    );
  });
  it("supports complete authored starts and requires at most one commander per player", () => {
    let map = updateWorkshopRules(fixture(), { startingForces: "authored" });
    for (let team = 0; team < 2; team++) {
      map = placeWorkshopEntity(map, {
        kind: "building",
        type: "keep",
        team,
        ...map.spawns[team],
      });
      map = placeWorkshopEntity(map, {
        kind: "commander",
        type: team === 0 ? "warlord" : "ranger",
        team,
        x: map.spawns[team].x,
        y: map.spawns[team].y - 3,
      });
    }
    expect(validateWorkshopMap(map).errors).toEqual([]);
    expect(() =>
      placeWorkshopEntity(map, {
        kind: "commander",
        type: "engineer",
        team: 0,
        x: 12.5,
        y: 24.5,
      }),
    ).toThrow(/only one commander/);
  });
  it("detects collectively sealed routes even when each building footprint fits", () => {
    const map = fixture();
    for (let y = 1; y < map.height - 1; y++)
      for (let x = 12; x <= 14; x++)
        map.tiles[y * map.width + x] = y >= 6 && y <= 8 ? "grass" : "rock";
    map.scenario!.startingEntities.push({
      id: "blocked-crossing",
      kind: "building",
      type: "house",
      team: 0,
      x: 13.5,
      y: 7.5,
    });
    expect(validateScenarioGeometry(map).join()).toMatch(
      /block access|clear a route|open route/i,
    );
  });
  it("uses actual cavalry, siege and commander radii for building and camp clearance", () => {
    const map = updateWorkshopRules(fixture(), { startingForces: "authored" });
    map.scenario!.startingEntities.push({
      id: "house",
      kind: "building",
      type: "house",
      team: 0,
      x: 12.1,
      y: 24.5,
    });
    for (const type of ["cavalry", "siege"] as const) {
      const candidate = structuredClone(map);
      candidate.scenario!.startingEntities.push({
        id: "troop",
        kind: "unit",
        type,
        team: 0,
        x: 13.5,
        y: 24.5,
      });
      expect(validateScenarioGeometry(candidate).join()).toMatch(
        /troop: move this unit outside/,
      );
    }
    const commander = structuredClone(map);
    commander.scenario!.startingEntities.push({
      id: "commander",
      kind: "commander",
      type: "ranger",
      team: 0,
      x: 13.5,
      y: 24.5,
    });
    expect(validateScenarioGeometry(commander).join()).toMatch(
      /commander: move this unit outside/,
    );
    map.scenario!.camps.push({
      id: "siege-camp",
      x: 14.5,
      y: 24.5,
      unit: "siege",
      count: 5,
      radius: 1,
      rewardGold: 0,
      rewardWood: 0,
    });
    expect(validateScenarioGeometry(map).join()).toMatch(
      /siege-camp: clear enough walkable ground/,
    );
    map.scenario!.camps[0].unit = "spearman";
    expect(validateScenarioGeometry(map)).toEqual([]);
  });
  it("erases objects without changing terrain or unrelated content", () => {
    let map = placeWorkshopEntity(fixture(), {
      kind: "unit",
      type: "archer",
      team: 0,
      x: 12.5,
      y: 24.5,
    });
    map = placeWorkshopCamp(map, camp);
    const erased = eraseWorkshopObjects(map, { x: 12.5, y: 24.5 });
    expect(erased.scenario!.startingEntities).toHaveLength(0);
    expect(erased.scenario!.camps).toHaveLength(1);
    expect(erased.tiles).toEqual(map.tiles);
    expect(
      removeWorkshopObject(erased, erased.scenario!.camps[0].id).scenario!
        .camps,
    ).toEqual([]);
  });
});

describe("named library and test-return lifecycle", () => {
  function store(): WorkshopStore & { data: Record<string, unknown> } {
    const data: Record<string, unknown> = {};
    return {
      data,
      async load(key) {
        return data[key] === undefined ? null : structuredClone(data[key]);
      },
      async save(key, value) {
        data[key] = structuredClone(value);
      },
    };
  }
  it.each([4, 90, 91, 120, 180])(
    "reopens and launches a saved %i-minute map from a fresh library",
    async (duration) => {
      const backing = store(),
        library = new WorkshopLibrary(backing),
        map = updateWorkshopRules(fixture(), { duration }),
        saved = await library.save(map, `Duration ${duration}`),
        reloaded = await new WorkshopLibrary(backing).load(saved.id);
      expect(reloaded).toEqual(saved);
      expect(reloaded.map.scenario!.rules.duration).toBe(duration);
      expect(validateWorkshopMap(reloaded.map).errors).toEqual([]);
      expect(
        createGame(createWorkshopTest(reloaded.map)).settings.duration,
      ).toBe(duration);
    },
  );
  it("saves independent maps, overwrites by ID, and clones without changing the original", async () => {
    const backing = store(),
      library = new WorkshopLibrary(
        backing,
        () => new Date("2026-10-04T12:00:00Z"),
      );
    const first = await library.save(fixture(), "My frontier"),
      second = await library.clone(first.id, "Second frontier");
    expect(second.id).not.toBe(first.id);
    second.map.tiles[100] = "water";
    await library.save(second.map, "Second frontier edited", second.id);
    expect((await library.load(first.id)).map.tiles[100]).toBe("grass");
    expect((await library.load(second.id)).map.tiles[100]).toBe("water");
    expect(await library.list()).toHaveLength(2);
    expect((await new WorkshopLibrary(backing).load(first.id)).map).toEqual(
      first.map,
    );
  });
  it("serializes overlapping saves and snapshots before asynchronous work", async () => {
    const library = new WorkshopLibrary(
        store(),
        () => new Date("2026-10-04T12:00:00Z"),
      ),
      map = fixture();
    const first = library.save(map, "First"),
      second = library.save(map, "Second");
    map.tiles[100] = "water";
    const entries = await Promise.all([first, second]);
    expect(new Set(entries.map((entry) => entry.id)).size).toBe(2);
    expect(entries.every((entry) => entry.map.tiles[100] === "grass")).toBe(
      true,
    );
    expect(await library.list()).toHaveLength(2);
  });
  it("surfaces storage failures and permits recovery on the next save", async () => {
    const backing = store();
    let failed = false;
    const library = new WorkshopLibrary({
      load: backing.load,
      async save(key, value) {
        if (!failed) {
          failed = true;
          throw new Error("Storage quota reached");
        }
        await backing.save(key, value);
      },
    });
    await expect(library.save(fixture(), "First")).rejects.toThrow(/quota/);
    await expect(library.save(fixture(), "Recovered")).resolves.toMatchObject({
      name: "Recovered",
    });
    expect(await library.list()).toHaveLength(1);
  });
  it("isolates battle changes and restores the entire draft and camera after repeated returns", () => {
    const map = placeWorkshopCamp(fixture(), camp),
      session = new WorkshopTestSession(),
      tested = session.begin(map, view);
    tested.customMap!.tiles[100] = "water";
    (tested.customMap as WorkshopMap).scenario!.camps.length = 0;
    expect(session.restore()).toEqual({ version: 1, map, view });
    const returned = session.restore()!;
    returned.map.nodes.length = 0;
    expect(session.restore()!.map.nodes).toHaveLength(map.nodes.length);
    const resumed = new WorkshopTestSession();
    resumed.resume(session.export());
    expect(resumed.restore()).toEqual({ version: 1, map, view });
    session.clear();
    expect(session.active).toBe(false);
    expect(session.restore()).toBeNull();
  });
  it("preserves a previous bookmark if a new test or imported return state is invalid", () => {
    const session = new WorkshopTestSession(),
      map = fixture();
    session.begin(map, view);
    expect(() =>
      session.begin(
        updateWorkshopRules(map, { startingForces: "authored" }),
        view,
      ),
    ).toThrow(/Command Keep/);
    expect(session.restore()!.map).toEqual(map);
    expect(() =>
      session.resume({
        ...session.export(),
        view: { ...view, camera: { ...view.camera, zoom: 100 } },
      }),
    ).toThrow(/camera/);
    expect(session.restore()!.map).toEqual(map);
  });
  it("opens incomplete drafts as paused previews with authored levels and neutral guards", () => {
    let map = updateWorkshopRules(fixture(), { startingForces: "authored" });
    map = placeWorkshopEntity(map, {
      id: "my-house",
      kind: "building",
      type: "house",
      team: 0,
      x: 12,
      y: 24,
      buildingLevel: 3,
    });
    map = placeWorkshopCamp(map, camp);
    const preview = createWorkshopPreview(map);
    expect(preview.paused).toBe(true);
    expect(preview.map.validation.valid).toBe(false);
    expect(
      preview.entities.find((entity) => entity.id === "my-house"),
    ).toMatchObject({ x: 12, y: 24, buildingLevel: 3 });
    expect(preview.entities.filter((entity) => entity.campId)).toHaveLength(3);
    expect(preview.players.at(-1)!.neutral).toBe(true);
    expect(
      preview.entities.filter((entity) => entity.type === "keep"),
    ).toHaveLength(0);
    expect(preview.events).toEqual([]);
    expect(map.scenario!.startingEntities).toHaveLength(1);
  });
  it("does not inherit previous campaign, Rush, or setup settings into a test", () => {
    const options = createWorkshopTest(fixture());
    expect(options).toMatchObject({
      learning: false,
      scriptedVictory: false,
      neutralCamps: 0,
      preset: "balanced",
      matchScale: "custom",
      mode: "domination",
    });
    expect(options.modifiers).toBeUndefined();
    expect(options.slots).toEqual(fixture().scenario!.slots);
    expect(createGame(options).map.scenario!.slots).toEqual(
      fixture().scenario!.slots,
    );
  });
  it("keeps a saved camp editable after its whole patrol area is painted with water", () => {
    const map = placeWorkshopCamp(fixture(), camp);
    for (let y = 22; y <= 28; y++)
      for (let x = 14; x <= 20; x++) map.tiles[y * map.width + x] = "water";
    expect(validateWorkshopStructure(map)).toEqual([]);
    expect(() => createWorkshopTest(map)).toThrow(/camp/);
    const preview = createWorkshopPreview(
      importWorkshopMap(exportWorkshopMap(map)),
    );
    expect(preview.paused).toBe(true);
    expect(preview.entities.filter((entity) => entity.campId)).toHaveLength(3);
    expect(
      preview.entities
        .filter((entity) => entity.campId)
        .every(
          (entity) =>
            Math.hypot(entity.x - camp.x, entity.y - camp.y) <= camp.radius,
        ),
    ).toBe(true);
    expect(preview.map.validation.errors.join()).toMatch(
      /camp center needs walkable terrain/,
    );
    expect(preview.map.tiles).toEqual(map.tiles);
  });
  it("validates total active army budget before a test starts", () => {
    const map = updateWorkshopRules(setWorkshopSlotCount(fixture(), 4), {
      populationCap: 200,
    });
    expect(validateWorkshopMap(map).errors.join()).toMatch(/600/);
    expect(() => createWorkshopTest(map)).toThrow(/600/);
  });
  it("rejects troops above a player ceiling while retaining the editable draft", () => {
    const map = updateWorkshopRules(fixture(), { populationCap: 12 });
    for (let index = 0; index < 4; index++)
      map.scenario!.startingEntities.push({
        id: `siege-${index}`,
        kind: "unit",
        type: "siege",
        team: 0,
        x: 10.5 + index,
        y: 27.5,
      });
    expect(validateWorkshopStructure(map)).toEqual([]);
    expect(validateWorkshopMap(map).errors.join()).toMatch(
      /16 population.*12 army ceiling/,
    );
    expect(
      importWorkshopMap(exportWorkshopMap(map)).scenario!.startingEntities,
    ).toHaveLength(4);
  });
});

describe("workshop settings and palette integration", () => {
  function form(map: WorkshopMap) {
    const data = new FormData(),
      values = {
        "map-name": map.name!,
        width: map.width,
        height: map.height,
        biome: map.biome,
        "slot-count": map.spawns.length,
        ...map.scenario!.rules,
        scoreTarget: "",
        gameSpeed: 1,
        incomeRate: 1,
      };
    for (const [key, value] of Object.entries(values))
      data.set(key, String(value));
    map.scenario!.slots.forEach((slot, index) =>
      Object.entries(slot).forEach(([key, value]) =>
        data.set(`slot-${index}-${key}`, String(value)),
      ),
    );
    return data;
  }
  it.each([4, 90, 91, 120, 180])(
    "applies and validates the form's %i-minute target without changing the draft",
    (duration) => {
      const map = fixture(),
        original = structuredClone(map),
        data = form(map);
      data.set("duration", String(duration));
      const updated = readWorkshopSettings(data, map);
      expect(updated.scenario!.rules.duration).toBe(duration);
      expect(validateWorkshopMap(updated).errors).toEqual([]);
      expect(map).toEqual(original);
    },
  );
  it.each([3, 181])(
    "rejects an out-of-range %i-minute form without changing the draft",
    (duration) => {
      const map = fixture(),
        original = structuredClone(map),
        data = form(map);
      data.set("duration", String(duration));
      expect(() => readWorkshopSettings(data, map)).toThrow(/4 and 180/);
      expect(map).toEqual(original);
    },
  );
  it("applies a complete settings form atomically with numeric parsing and player choices", () => {
    const map = fixture(),
      data = form(map);
    data.set("map-name", "Snow stronghold");
    data.set("width", "48");
    data.set("height", "40");
    data.set("biome", "snow");
    data.set("mode", "conquest");
    data.set("duration", "90");
    data.set("slot-1-name", "The North");
    data.set("slot-1-difficulty", "hard");
    const result = readWorkshopSettings(data, map);
    expect(result).toMatchObject({
      name: "Snow stronghold",
      width: 48,
      height: 40,
      biome: "snow",
    });
    expect(result.scenario!.rules).toMatchObject({
      mode: "conquest",
      duration: 90,
      gameSpeed: 1,
    });
    expect(result.scenario!.slots[1]).toMatchObject({
      name: "The North",
      difficulty: "hard",
    });
    expect(map.width).toBe(32);
    data.set("startingGold", "NaN");
    expect(() => readWorkshopSettings(data, map)).toThrow(/number/);
    expect(map.width).toBe(32);
  });
  it("escapes map and player strings and exposes all owned placement controls", () => {
    const map = fixture();
    map.name = '<img src=x onerror="alert(1)">';
    map.scenario!.slots[0].name = "<script>bad</script>";
    const html = renderWorkshopSettings(map),
      palette = renderWorkshopPalette(map);
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;img");
    expect(html).toContain('name="scoreTarget"');
    expect(palette).toContain('data-id="building:house"');
    expect(palette).toContain('data-id="camp"');
    expect(palette).toContain('data-id="spawn:1"');
    expect(palette).not.toContain('data-id="building:keep"');
    expect(
      renderWorkshopPalette(
        updateWorkshopRules(map, { startingForces: "authored" }),
      ),
    ).toContain('data-id="commander:warlord"');
  });
});
