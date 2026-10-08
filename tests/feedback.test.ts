import { describe, expect, it } from "vitest";
import { armySelectionFeedback, feedbackHasExpired, troopSelectionFeedback } from "../src/ui/feedback";

describe("feedback context lifetime", () => {
  const queued = { battleMatchId: "current", untilResume: true };
  const ordinary = { battleMatchId: "current", untilResume: false };
  it("keeps queued and restored guidance while the same battle remains paused", () => {
    expect(feedbackHasExpired(queued, { battleMatchId: "current", paused: true })).toBe(false);
  });
  it("retires pause-dependent guidance immediately on Resume", () => {
    expect(feedbackHasExpired(queued, { battleMatchId: "current", paused: false })).toBe(true);
  });
  it("preserves unrelated success and error announcements on Resume", () => {
    expect(feedbackHasExpired(ordinary, { battleMatchId: "current", paused: false })).toBe(false);
  });
  it.each(["next", null])("retires battle feedback when leaving its match for %s", (battleMatchId) => {
    expect(feedbackHasExpired(queued, { battleMatchId, paused: true })).toBe(true);
    expect(feedbackHasExpired(ordinary, { battleMatchId, paused: false })).toBe(true);
  });
  it("does not retire unscoped menu successes or absent feedback", () => {
    expect(feedbackHasExpired({ battleMatchId: null, untilResume: false }, { battleMatchId: "next", paused: false })).toBe(false);
    expect(feedbackHasExpired(null, { battleMatchId: "next", paused: false })).toBe(false);
  });
});

describe("selection feedback grammar", () => {
  it.each([
    [0, "Selection cleared."],
    [1, "1 troop selected. Choose Move, Attack, or Hold."],
    [3, "3 troops selected. Choose Move, Attack, or Hold."],
  ] as const)("formats %i selected troops", (count, expected) => {
    expect(troopSelectionFeedback(count)).toBe(expected);
  });
  it.each([
    [0, "No troops available. Recruit reinforcements or wait for your commander to recover."],
    [1, "1 unit ready. Choose Move, Attack, or Hold."],
    [3, "3 units ready. Choose Move, Attack, or Hold."],
  ] as const)("formats an army of %i", (count, expected) => {
    expect(armySelectionFeedback(count)).toBe(expected);
  });
});
