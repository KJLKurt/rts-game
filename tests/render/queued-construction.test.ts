import { afterEach, describe, expect, it, vi } from "vitest";
import { Battlefield, type RenderOptions } from "../../src/render/Battlefield";
import { drawPlannedConstructionMarkers, plannedConstructionMarkers, QUEUED_CONSTRUCTION_STYLE } from "../../src/render/queued-construction";
import { TILE_H, TILE_W, type Ctx } from "../../src/render/art";
import { createGame, spawnEntity } from "../../src/sim/engine";
import type { PlannedConstruction } from "../../src/ui/queued-construction";

const plan = (extra: Partial<PlannedConstruction> = {}): PlannedConstruction => ({ building: "house", name: "House", x: 10, y: 10, size: 1, ordinal: 1, ...extra });
const geometryView = (zoom = 1) => ({ zoom, width: 800, height: 600, project: (x: number, y: number) => ({ x, y }), visible: () => true, measureLabel: (text: string) => text.length * 6 });

function recordingContext() {
  const calls: { kind: string; text?: string; color?: unknown; width?: unknown; dash?: number[] }[] = [];
  let dash: number[] = [];
  const fields: Record<string, unknown> = {
    measureText: (text: string) => ({ width: text.length * 6 }),
    createRadialGradient: () => ({ addColorStop() {} }),
    setLineDash: (value: number[]) => { dash = [...value]; },
    stroke: () => calls.push({ kind: "stroke", color: fields.strokeStyle, width: fields.lineWidth, dash: [...dash] }),
    strokeText: (text: string) => calls.push({ kind: "strokeText", text, color: fields.strokeStyle }),
    fillText: (text: string) => calls.push({ kind: "fillText", text, color: fields.fillStyle }),
    drawImage: () => calls.push({ kind: "image" }),
    fill: () => calls.push({ kind: "fill" }),
  };
  const context = new Proxy(fields, {
    get(target, key) { return key in target ? target[String(key)] : () => {}; },
    set(target, key, value) { target[String(key)] = value; return true; },
  }) as unknown as Ctx;
  return { context, calls, fields };
}

function battlefield() {
  const record = recordingContext();
  const canvas = { width: 800, height: 600, style: {}, getContext: () => record.context } as unknown as HTMLCanvasElement;
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false })));
  vi.stubGlobal("document", { createElement: () => canvas, baseURI: "https://example.test/rts-game/" });
  const view = new Battlefield(canvas);
  view.resize(800, 600, 1);
  view.centerOn(10, 10);
  const state = createGame({ mapSize: "tiny" });
  state.entities = [];
  state.events = [];
  state.map.nodes = [];
  state.fog.visible.forEach(field => field.fill(1));
  state.fog.explored.forEach(field => field.fill(1));
  // Keep the real render pipeline, visibility and picking; isolate unrelated terrain/sprite art.
  const internals = view as unknown as {
    ensureTerrain: () => unknown;
    drawEntity: () => void;
    drawOrder: () => void;
    drawFog: () => void;
    drawPlacement: () => void;
    drawTroopSummaries: () => void;
    entityHits: Map<string, unknown>;
  };
  internals.ensureTerrain = () => ({ canvas, ox: 0, oy: 0, width: 800, height: 600, water: [], decor: [] });
  internals.drawEntity = () => record.calls.push({ kind: "entity" });
  internals.drawOrder = () => record.calls.push({ kind: "order" });
  internals.drawFog = () => record.calls.push({ kind: "fog" });
  internals.drawPlacement = () => record.calls.push({ kind: "active-placement" });
  internals.drawTroopSummaries = () => {};
  return { ...record, view, state, internals };
}

afterEach(() => vi.unstubAllGlobals());

describe("queued construction ground geometry", () => {
  it.each([.42, 2.4])("keeps world footprint dimensions and readable CSS-pixel strokes at %s zoom", zoom => {
    const [marker] = plannedConstructionMarkers([plan({ x: 400, y: 200, size: 1.4 })], geometryView(zoom));
    expect(marker.rx).toBeCloseTo(1.4 * TILE_W * zoom);
    expect(marker.ry).toBeCloseTo(1.4 * TILE_H * zoom);
    expect(marker.label?.h).toBe(16);
    expect(marker.label?.text).toBe("Queued House");
    const { context, calls, fields } = recordingContext();
    drawPlannedConstructionMarkers(context, [marker]);
    expect(calls.filter(c => c.kind === "stroke")).toEqual([
      { kind: "stroke", color: "#182a30", width: 4, dash: [6, 5] },
      { kind: "stroke", color: "#edc36b", width: 2, dash: [6, 5] },
    ]);
    expect(fields.font).toBe(QUEUED_CONSTRUCTION_STYLE.font);
    expect(fields.lineDashOffset).toBe(0);
    expect(calls.some(c => c.kind === "image" || c.kind === "fill")).toBe(false);
    expect(calls.findIndex(c => c.kind === "strokeText")).toBeLessThan(calls.findIndex(c => c.kind === "fillText"));
  });

  it("culls hidden/offscreen plans but keeps a footprint intersecting the viewport", () => {
    const plans = [plan({ x: 200, y: 200 }), plan({ x: 400, y: 200 }), plan({ x: -200, y: 200 }), plan({ x: -50, y: 200 })];
    const markers = plannedConstructionMarkers(plans, { ...geometryView(), visible: x => x !== 400 });
    expect(markers.map(marker => marker.x)).toEqual([200, -50]);
    expect(markers[1].label).toBeUndefined();
  });

  it("retains adjacent footprints while omitting labels that overlap each other or HUD controls", () => {
    const plans = [plan({ x: 400, y: 200 }), plan({ x: 410, y: 200, ordinal: 2 }), plan({ x: 400, y: 350, ordinal: 3 })];
    const markers = plannedConstructionMarkers(plans, { ...geometryView(), obstacles: [{ x: 340, y: 385, w: 120, h: 30 }] });
    expect(markers).toHaveLength(3);
    expect(markers[0].label?.text).toBe("Queued House");
    expect(markers[1].label).toBeUndefined();
    expect(markers[2].label).toBeUndefined();
  });

  it("does not modify plans or obstacles and ignores malformed geometry", () => {
    const plans = Object.freeze([Object.freeze(plan({ x: 300, y: 200 })), Object.freeze(plan({ size: NaN })), Object.freeze(plan({ x: Infinity })), Object.freeze(plan({ size: 0 }))]);
    const obstacles = Object.freeze([Object.freeze({ x: 0, y: 0, w: 40, h: 40 })]);
    const before = JSON.stringify({ plans, obstacles });
    const markers = plannedConstructionMarkers(plans, { ...geometryView(), obstacles });
    expect(markers).toHaveLength(1);
    expect(JSON.stringify({ plans, obstacles })).toBe(before);
    expect(plannedConstructionMarkers(plans, geometryView(0))).toEqual([]);
  });
});

describe("queued construction render isolation", () => {
  it.each([{ quality: "high", reducedMotion: false }, { quality: "low", reducedMotion: true }] as const)("paints plans below orders, actual actors, fog and the active ghost with %j", options => {
    const { view, state, calls } = battlefield();
    const soldier = spawnEntity(state, 0, "unit", "swordsman", 10, 10);
    spawnEntity(state, 0, "building", "house", 10, 10);
    const plans = Object.freeze([Object.freeze(plan())]);
    const before = JSON.stringify(state);
    const camera = { ...view.camera };
    view.render(state, [soldier.id], { ...options, plannedConstruction: plans, placement: { type: "house", x: 15, y: 15, valid: true } });
    const footprint = calls.findIndex(call => call.kind === "stroke" && call.color === QUEUED_CONSTRUCTION_STYLE.color);
    const label = calls.findIndex(call => call.kind === "fillText" && call.text === "Queued House");
    const entity = calls.findIndex(call => call.kind === "entity");
    const order = calls.findIndex(call => call.kind === "order");
    expect(footprint).toBeGreaterThan(-1);
    expect(label).toBeGreaterThan(footprint);
    expect(label).toBeLessThan(order);
    expect(order).toBeLessThan(entity);
    expect(calls.filter(call => call.kind === "entity")).toHaveLength(2);
    expect(calls.findIndex(call => call.kind === "fog")).toBeGreaterThan(entity);
    expect(calls.findIndex(call => call.kind === "active-placement")).toBeGreaterThan(entity);
    expect(view.camera).toEqual(camera);
    expect(JSON.stringify(state)).toBe(before);
  });

  it("uses the viewing team's current visibility and honors reveal without leaking explored-only plans", () => {
    const { view, state, calls } = battlefield();
    state.fog.visible[0].fill(0);
    const render = (options: RenderOptions) => {
      calls.length = 0;
      view.render(state, [], { plannedConstruction: [plan()], ...options });
      return calls.some(call => call.color === QUEUED_CONSTRUCTION_STYLE.color);
    };
    expect(render({ team: 0 })).toBe(false);
    expect(render({ team: 1 })).toBe(true);
    expect(render({ team: 0, reveal: true })).toBe(true);
  });

  it("never creates hit records or changes picking, selection, entities or queued commands", () => {
    const { view, state, internals } = battlefield();
    const point = view.worldToScreen(10, 10);
    state.pendingCommands = [{ type: "build", team: 0, building: "house", x: 10, y: 10 }];
    const before = JSON.stringify(state);
    const selection = new Set(["planned-house"]);
    view.render(state, selection, { plannedConstruction: [plan()] });
    expect(view.pick(state, point.x, point.y)).toBeUndefined();
    expect(view.pick(state, point.x, point.y + 48)).toBeUndefined();
    expect(internals.entityHits.size).toBe(0);
    expect([...selection]).toEqual(["planned-house"]);
    expect(JSON.stringify(state)).toBe(before);
    const soldier = spawnEntity(state, 0, "unit", "swordsman", 10, 10);
    soldier.x = 10; soldier.y = 10;
    view.render(state, [], { plannedConstruction: [plan()] });
    expect(view.pick(state, point.x, point.y)?.id).toBe(soldier.id);
    view.render(state, [], {});
    expect(view.pick(state, point.x, point.y)?.id).toBe(soldier.id);
  });
});
