import { describe, expect, it } from "vitest";
import {
  placementFeedback,
  resourceCostHTML,
  selectionHealthHTML,
  selectionName,
} from "../src/ui/battle-readouts";

describe("truthful battlefield readouts", () => {
  it("labels wood-only prices as wood without inventing a gold charge", () => {
    const html = resourceCostHTML({ gold: 0, wood: 65 });
    expect(html).toContain('data-resource="wood"');
    expect(html).toContain(">65<");
    expect(html).toContain(">wood<");
    expect(html).not.toContain('data-resource="gold"');
  });
  it("keeps explicit resource labels for mixed and free prices", () => {
    const html = resourceCostHTML({ gold: 45, wood: 10 });
    expect(html).toContain(">gold<");
    expect(html).toContain(">wood<");
    expect(html.indexOf('data-resource="gold"')).toBeLessThan(
      html.indexOf('data-resource="wood"'),
    );
    expect(resourceCostHTML({ gold: 0, wood: 0 })).toContain(
      "No resource cost",
    );
  });
  it("identifies the temporary turret instead of calling it a commander", () => {
    expect(selectionName({ kind: "building", type: "turret" })).toBe(
      "Runic Turret",
    );
    expect(selectionName({ kind: "commander", type: "ranger" })).toBe("Ranger");
    expect(selectionName({ kind: "building", type: "keep" })).toBe(
      "Command Keep",
    );
  });
  it("shows current bounded health and an explicit paid queue count", () => {
    const html = selectionHealthHTML(
      { kind: "commander", type: "ranger", hp: 125, maxHp: 250 },
      2,
    );
    expect(html).toMatch(/^<small class="selection-vitals">/);
    expect(html).toContain('role="meter"');
    expect(html).toContain('aria-valuenow="125"');
    expect(html).toContain("width:50.00%");
    expect(html).toContain("125 / 250 health · 2 queued");
    expect(
      selectionHealthHTML({ kind: "unit", type: "archer", hp: -1, maxHp: 100 }),
    ).toContain("width:0.00%");
    expect(
      selectionHealthHTML({
        kind: "unit",
        type: "archer",
        hp: 120,
        maxHp: 100,
      }),
    ).toContain("width:100.00%");
  });
  it("normalizes blocked punctuation without changing the engine reason", () => {
    for (const error of [
      "Too close to another building.",
      "Too close to another building.. ",
      "Too close to another building",
    ]) {
      expect(placementFeedback({ ok: false, error })).toEqual({
        state: "blocked",
        icon: "close",
        text: "Too close to another building. Nothing spent yet.",
      });
    }
  });
  it("distinguishes a valid site, unplaced preview and legal teaching caution", () => {
    expect(placementFeedback(null).state).toBe("unplaced");
    expect(placementFeedback({ ok: true }).text).toBe(
      "Valid location · Confirm to spend.",
    );
    expect(placementFeedback({ ok: true }, true).state).toBe("warning");
  });
});
