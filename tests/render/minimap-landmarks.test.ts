import { describe, it, expect } from "vitest";
import { createGame } from "../../src/sim/engine";
import { renderMinimap } from "../../src/render/Battlefield";
import type { ResourceNode } from "../../src/sim/types";

describe("public relic minimap landmarks", () => {
  it("shows unknown relic locations neutrally without exposing hidden resource sites or enemy troops", () => {
    const state = createGame({ mapSize: "tiny" }),
      enemy = state.entities.find((e) => e.team === 1)!;
    state.entities = [enemy];
    state.events = [];
    const node = (
      id: string,
      kind: ResourceNode["kind"],
      x: number,
      owner: number | null,
    ): ResourceNode => ({
      id,
      kind,
      x,
      y: 5.5,
      owner,
      captureTeam: null,
      captureProgress: 0,
      radius: 2,
      income: 0,
      amount: 0,
      maxAmount: 0,
    });
    state.map.nodes = [
      node("unknown-relic", "relic", 5.5, 1),
      node("own-relic", "relic", 10.5, 0),
      node("visible-rival", "relic", 15.5, 1),
      node("hidden-gold", "gold", 20.5, 1),
    ];
    state.fog.visible[0].fill(0);
    state.fog.explored[0].fill(0);
    state.fog.visible[0][5 * state.map.width + 15] = 1;
    const rings: { x: number; stroke: string }[] = [];
    let lastX = 0;
    const fields: Record<string, unknown> = {
      strokeStyle: "",
      fillStyle: "",
      ellipse(x: number) {
        lastX = x;
      },
      stroke() {
        rings.push({ x: lastX, stroke: String(fields.strokeStyle) });
      },
    };
    const context = new Proxy(fields, {
      get(target, key) {
        return key in target ? target[String(key)] : () => {};
      },
      set(target, key, value) {
        target[String(key)] = value;
        return true;
      },
    });
    const canvas = {
      width: 160,
      height: 120,
      getContext: () => context,
    } as unknown as HTMLCanvasElement;
    renderMinimap(canvas, state);
    // Each relic contributes a ring plus its central diamond. No hidden gold or unit is drawn.
    const outlines = rings.filter((r) =>
      ["#f6d481", "#67d6ff", "#ff8e70"].includes(r.stroke),
    );
    expect(outlines).toEqual([
      { x: 5.5 * 5, stroke: "#f6d481" },
      { x: 10.5 * 5, stroke: "#67d6ff" },
      { x: 15.5 * 5, stroke: "#ff8e70" },
    ]);
    expect(rings.every((r) => r.x !== 20.5 * 5)).toBe(true);
  });
});
