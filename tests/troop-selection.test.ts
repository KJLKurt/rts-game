import { describe, expect, it } from "vitest";
import {
  createGame,
  issueCommand,
  restoreGame,
  serializeGame,
  spawnEntity,
  stepGame,
  UNITS,
  type Entity,
  type GameCommand,
  type GameState,
} from "../src/sim";
import { troopPickerHTML } from "../src/ui/troop-picker";
import {
  pruneTroopSelection,
  selectableTroops,
  setTroopTypeSelection,
  toggleTroop,
  troopSelectionGroups,
} from "../src/ui/troop-selection";

function fixture() {
  const state = createGame({
    seed: "EXACT-TROOP-SELECTION",
    mapSize: "tiny",
    aiPlayers: 2,
    startingGold: 2000,
    startingWood: 2000,
  });
  state.players.forEach((player) => (player.ai = false));
  state.players[0].alliance = 0;
  state.players[1].alliance = 0;
  state.players[2].alliance = 2;
  const hero = state.entities.find(
    (entity) => entity.team === 0 && entity.kind === "commander",
  )!;
  const keep = state.entities.find(
    (entity) => entity.team === 0 && entity.type === "keep",
  )!;
  const archers = [
    state.entities.find(
      (entity) => entity.team === 0 && entity.type === "archer",
    )!,
    ...Array.from({ length: 2 }, () =>
      spawnEntity(state, 0, "unit", "archer", hero.x, hero.y),
    ),
  ];
  const support = spawnEntity(state, 0, "unit", "support", hero.x, hero.y);
  const siege = spawnEntity(state, 0, "unit", "siege", hero.x, hero.y);
  const ally = state.entities.find(
    (entity) => entity.team === 1 && entity.kind === "unit",
  )!;
  const enemy = state.entities.find(
    (entity) => entity.team === 2 && entity.kind === "unit",
  )!;
  return { state, hero, keep, archers, support, siege, ally, enemy };
}

const idsOf = (entities: Entity[]) => entities.map((entity) => entity.id);
const ordersOf = (state: GameState, ids: string[]) =>
  state.entities
    .filter((entity) => ids.includes(entity.id))
    .map((entity) => [entity.id, structuredClone(entity.order)]);

describe("exact, player-owned troop selection", () => {
  it("excludes buildings, enemies, allied ownership, dead troops and recovering commanders", () => {
    const { state, hero, keep, archers, support, ally, enemy } = fixture();
    archers[0].hp = 0;
    archers[1].hp = -1;
    hero.respawnAt = state.time + 10;
    expect(hero.hp).toBeGreaterThan(0); // Recovery is excluded even before HP catches up.
    const selected = idsOf(selectableTroops(state));
    for (const entity of [hero, keep, archers[0], archers[1], ally, enemy])
      expect(selected).not.toContain(entity.id);
    expect(selected).toContain(archers[2].id);
    expect(selected).toContain(support.id);
    expect(
      selectableTroops(state, 1).every((entity) => entity.team === 1),
    ).toBe(true);
    expect(selectableTroops(state, 99)).toEqual([]);
  });

  it("orders Commander, unit content order, then natural entity IDs independent of state order", () => {
    const { state, hero, archers } = fixture();
    archers[0].id = "e1000";
    archers[1].id = "e200";
    archers[2].id = "e30";
    const expected = idsOf(selectableTroops(state));
    state.entities.reverse();
    expect(idsOf(selectableTroops(state))).toEqual(expected);
    expect(expected[0]).toBe(hero.id);
    expect(
      selectableTroops(state)
        .filter((entity) => entity.type === "archer")
        .map((entity) => entity.id),
    ).toEqual(["e30", "e200", "e1000"]);
    const actualTypes = troopSelectionGroups(state, []).map(
      (group) => group.typeKey,
    );
    expect(actualTypes).toEqual([
      hero.type,
      ...Object.keys(UNITS).filter((type) =>
        state.entities.some(
          (entity) => entity.team === 0 && entity.type === type,
        ),
      ),
    ]);
  });

  it("prunes stale and duplicate IDs and keeps only the requested exact membership", () => {
    const { state, hero, keep, archers, ally, enemy } = fixture();
    const original = [
      archers[2].id,
      "missing",
      hero.id,
      hero.id,
      keep.id,
      ally.id,
      enemy.id,
    ];
    expect(pruneTroopSelection(state, original)).toEqual([
      hero.id,
      archers[2].id,
    ]);
    expect(original).toHaveLength(7);
    expect(pruneTroopSelection(state, new Set([archers[1].id]))).toEqual([
      archers[1].id,
    ]);
    expect(pruneTroopSelection(state, [])).toEqual([]);
  });

  it("toggles one living troop without admitting invalid targets or retaining stale IDs", () => {
    const { state, hero, keep, archers, ally } = fixture();
    const initial = [hero.id, "missing"];
    const added = toggleTroop(state, initial, archers[1].id);
    expect(added).toEqual([hero.id, archers[1].id]);
    expect(toggleTroop(state, added, hero.id)).toEqual([archers[1].id]);
    expect(toggleTroop(state, [hero.id], hero.id)).toEqual([]);
    for (const invalid of ["missing", keep.id, ally.id])
      expect(toggleTroop(state, initial, invalid)).toEqual([hero.id]);
    expect(initial).toEqual([hero.id, "missing"]);
  });

  it("sets or clears a whole current type while preserving selections of other types", () => {
    const { state, hero, archers, support } = fixture();
    const original = [hero.id, archers[1].id, support.id, "stale"];
    const allArchers = setTroopTypeSelection(state, original, "archer", true);
    expect(allArchers).toEqual([hero.id, ...idsOf(archers), support.id]);
    expect(setTroopTypeSelection(state, allArchers, "archer", false)).toEqual([
      hero.id,
      support.id,
    ]);
    expect(setTroopTypeSelection(state, original, "unknown", true)).toEqual([
      hero.id,
      archers[1].id,
      support.id,
    ]);
    expect(setTroopTypeSelection(state, original, hero.type, false)).toEqual([
      archers[1].id,
      support.id,
    ]);
    expect(original).toEqual([hero.id, archers[1].id, support.id, "stale"]);
  });

  it("reports native checkbox checked/mixed states and exact counts per group", () => {
    const { state, hero, archers, support } = fixture();
    const groups = troopSelectionGroups(state, [
      hero.id,
      archers[1].id,
      archers[1].id,
      "stale",
    ]);
    expect(groups.find((group) => group.typeKey === hero.type)).toMatchObject({
      total: 1,
      selectedCount: 1,
      checked: true,
      indeterminate: false,
    });
    expect(groups.find((group) => group.typeKey === "archer")).toMatchObject({
      total: 3,
      selectedCount: 1,
      checked: false,
      indeterminate: true,
    });
    expect(
      groups.find((group) => group.typeKey === support.type),
    ).toMatchObject({ selectedCount: 0, checked: false, indeterminate: false });
    expect(
      troopSelectionGroups(state, idsOf(archers)).find(
        (group) => group.typeKey === "archer",
      ),
    ).toMatchObject({ selectedCount: 3, checked: true, indeterminate: false });
  });

  it("never changes source entities, source order, selection iterables or serialized game fields", () => {
    const { state, hero, archers } = fixture();
    const before = serializeGame(state);
    const original = Object.freeze([hero.id, archers[0].id, "stale"]);
    for (const entity of state.entities) Object.freeze(entity);
    Object.freeze(state.entities);
    Object.freeze(state);
    selectableTroops(state);
    pruneTroopSelection(state, original);
    toggleTroop(state, original, archers[1].id);
    setTroopTypeSelection(state, original, "archer", true);
    troopSelectionGroups(state, original);
    troopPickerHTML(state, original);
    expect(serializeGame(state)).toBe(before);
    expect(original).toEqual([hero.id, archers[0].id, "stale"]);
  });

  it("does not add a future recruit when an all-of-type snapshot is applied later", () => {
    const { state, keep, archers } = fixture();
    const selected = setTroopTypeSelection(state, [], "archer", true);
    const futureArcher = spawnEntity(
      state,
      0,
      "unit",
      "archer",
      keep.x + 2,
      keep.y,
    );
    expect(pruneTroopSelection(state, selected)).toEqual(idsOf(archers));
    expect(
      troopSelectionGroups(state, selected).find(
        (group) => group.typeKey === "archer",
      ),
    ).toMatchObject({
      total: 4,
      selectedCount: 3,
      checked: false,
      indeterminate: true,
    });
    expect(pruneTroopSelection(state, selected)).not.toContain(futureArcher.id);
    archers[1].hp = 0;
    expect(pruneTroopSelection(state, selected)).toEqual([
      archers[0].id,
      archers[2].id,
    ]);
  });
});

describe("accessible troop picker markup", () => {
  it("uses native checkboxes, exact IDs, per-unit names/HP and bounded-body/footer hooks", () => {
    const { state, hero, archers } = fixture();
    archers[0].hp = 31.1;
    const html = troopPickerHTML(state, [hero.id, archers[0].id]);
    expect(html).toContain('type="checkbox" data-troop-type="archer"');
    expect(html).toContain(
      `type="checkbox" data-troop-id="${archers[0].id}" checked`,
    );
    expect(html).toContain("Archer 1</span>");
    expect(html).toContain(`32 / ${Math.ceil(archers[0].maxHp)} HP`);
    expect(html).toContain(
      'id="troop-selection-count" role="status" aria-live="polite"',
    );
    expect(html).toContain(
      `2 of ${selectableTroops(state).length} troops selected`,
    );
    expect(html).toContain('data-troop-type-count="archer">1 / 3 selected');
    expect(html).toContain('<details class="troop-individuals">');
    expect(html).toContain('class="troop-picker-body"');
    expect(html).toContain('<footer class="troop-picker-footer">');
    for (const action of [
      "troop-select-all",
      "troop-select-none",
      "troop-select-apply",
      "close-dialog",
    ])
      expect(html).toContain(`data-action="${action}"`);
  });

  it("escapes IDs in attributes and supports an empty roster", () => {
    const { state, archers } = fixture();
    archers[0].id = 'troop"<script>&';
    const html = troopPickerHTML(state, [archers[0].id]);
    expect(html).toContain(
      'data-troop-id="troop&quot;&lt;script&gt;&amp;" checked',
    );
    expect(html).not.toContain("<script>");
    state.entities = state.entities.filter(
      (entity) => entity.kind === "building",
    );
    const empty = troopPickerHTML(state, [archers[0].id]);
    expect(empty).toContain("0 of 0 troops selected");
    expect(empty).toContain("No troops are available");
  });
});

describe("selected subsets retain existing simulation command semantics", () => {
  it.each(["move", "attackMove", "attack", "hold"] as const)(
    "%s affects only the exact selected IDs and survives save/restore",
    (type) => {
      const { state, hero, archers, enemy } = fixture();
      const selected = pruneTroopSelection(state, [hero.id, archers[1].id]);
      const otherIds = state.entities
        .filter((entity) => !selected.includes(entity.id))
        .map((entity) => entity.id);
      const before = ordersOf(state, otherIds);
      state.fog.visible[0].fill(1);
      const command: GameCommand =
        type === "attack"
          ? { type, team: 0, entityIds: selected, targetId: enemy.id }
          : type === "hold"
            ? { type, team: 0, entityIds: selected }
            : {
                type,
                team: 0,
                entityIds: selected,
                x: hero.x + 3,
                y: hero.y + 2,
              };
      expect(issueCommand(state, command).ok).toBe(true);
      for (const id of selected)
        expect(
          state.entities.find((entity) => entity.id === id)!.order.type,
        ).toBe(type);
      expect(ordersOf(state, otherIds)).toEqual(before);
      const restored = restoreGame(serializeGame(state));
      expect(ordersOf(restored, selected)).toEqual(ordersOf(state, selected));
      expect(ordersOf(restored, otherIds)).toEqual(before);
    },
  );

  it("a paused exact-ID order excludes later recruitment and retains its saved snapshot", () => {
    const { state, hero, keep } = fixture();
    const selected = idsOf(selectableTroops(state));
    const priorIds = new Set(state.entities.map((entity) => entity.id));
    expect(
      issueCommand(state, {
        type: "recruit",
        team: 0,
        unit: "swordsman",
        buildingId: keep.id,
      }).ok,
    ).toBe(true);
    keep.queue[0].remaining = 0.1;
    expect(
      issueCommand(state, { type: "pause", team: 0, paused: true }).ok,
    ).toBe(true);
    expect(
      issueCommand(state, {
        type: "move",
        team: 0,
        entityIds: selected,
        x: hero.x + 4,
        y: hero.y + 1,
      }).ok,
    ).toBe(true);
    const restored = restoreGame(serializeGame(state));
    expect(restored.pendingCommands).toMatchObject([
      { type: "move", entityIds: selected },
    ]);
    expect(
      issueCommand(restored, { type: "pause", team: 0, paused: false }).ok,
    ).toBe(true);
    stepGame(restored, 0.1);
    const recruit = restored.entities.find(
      (entity) => entity.team === 0 && !priorIds.has(entity.id),
    )!;
    expect(recruit).toBeDefined();
    expect(pruneTroopSelection(restored, selected)).not.toContain(recruit.id);
    const recruitOrder = structuredClone(recruit.order);
    expect(
      issueCommand(restored, {
        type: "hold",
        team: 0,
        entityIds: pruneTroopSelection(restored, selected),
      }).ok,
    ).toBe(true);
    expect(recruit.order).toEqual(recruitOrder);
    expect(
      restored.entities.find((entity) => entity.id === hero.id)!.order.type,
    ).toBe("hold");
  });
});
