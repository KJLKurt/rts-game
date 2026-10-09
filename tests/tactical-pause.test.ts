import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../src/sim/content";
import { STORY_CAMPAIGNS } from "../src/ui/campaigns/authored";
import { missionBriefingHTML, missionCardsHTML } from "../src/ui/campaigns/view";
import { createProfile } from "../src/ui/progression/profile";
import { tacticalPausePresentation, tacticalPauseRule } from "../src/ui/tactical-pause";

describe("tactical pause disclosure", () => {
  it.each([
    ["easy", "Easy difficulty · Unlimited tactical pauses"],
    ["normal", "Normal difficulty · Unlimited tactical pauses"],
    ["hard", "Hard difficulty · 3 tactical pauses per battle"],
    ["brutal", "Brutal difficulty · Tactical pause disabled"],
  ] as const)("describes the %s rule before battle", (difficulty, text) => {
    expect(tacticalPauseRule(difficulty)).toBe(text);
  });

  it.each([0, 1, 2])("shows the unspent Hard budget after %i pauses", (used) => {
    expect(tacticalPausePresentation("hard", false, used)).toEqual({
      state: "available",
      label: "Pause",
      budget: `${3 - used}/3 left`,
      accessibleLabel: `Tactical pause. ${3 - used} of 3 tactical pauses remaining.`,
      disabled: false,
    });
  });

  it.each([3, 4])("explains an exhausted Hard budget of %i spent pauses", (used) => {
    expect(tacticalPausePresentation("hard", false, used)).toEqual({
      state: "exhausted",
      label: "No pauses",
      budget: "0/3 left",
      accessibleLabel: "No pauses. All three tactical pauses have been used.",
      disabled: true,
    });
  });

  it.each([1, 2, 3])("keeps Resume available during Hard pause %i", (used) => {
    expect(tacticalPausePresentation("hard", true, used)).toEqual({
      state: "paused",
      label: "Resume",
      budget: `${3 - used}/3 left`,
      accessibleLabel: `Resume battle. ${3 - used} of 3 tactical pauses remaining.`,
      disabled: false,
    });
  });

  it("explains Brutal and still permits resuming a paused saved battle", () => {
    expect(tacticalPausePresentation("brutal", false, 0)).toEqual({
      state: "disabled",
      label: "Pause off",
      budget: "Brutal",
      accessibleLabel: "Pause off. Tactical pause is disabled on Brutal.",
      disabled: true,
    });
    expect(tacticalPausePresentation("brutal", true, 0)).toMatchObject({
      state: "paused",
      label: "Resume",
      accessibleLabel: "Resume battle. Tactical pause is disabled on Brutal.",
      disabled: false,
    });
  });

  it.each(["easy", "normal"] as const)("never invents a limited budget on %s", (difficulty) => {
    expect(tacticalPausePresentation(difficulty, false, 7)).toMatchObject({
      state: "available",
      label: "Pause",
      budget: "Unlimited",
      accessibleLabel: "Tactical pause. Unlimited tactical pauses.",
      disabled: false,
    });
    expect(tacticalPausePresentation(difficulty, true, 7)).toMatchObject({
      state: "paused", label: "Resume", budget: "Unlimited", disabled: false,
    });
  });

  it("discloses every chapter's actual rule in its card and at the start of its briefing", () => {
    for (const campaign of STORY_CAMPAIGNS) {
      const cards = missionCardsHTML(campaign, createProfile()).split('data-action="mission"').slice(1);
      for (const [index, mission] of campaign.missions.entries()) {
        const rule = tacticalPauseRule(mission.settings.difficulty ?? DEFAULT_SETTINGS.difficulty);
        expect(cards[index]).toContain(`<p class="mission-rules">${rule}</p>`);
        const briefing = missionBriefingHTML(mission);
        expect(briefing).toContain(`<p class="mission-rules">${rule}</p>`);
        expect(briefing.indexOf('class="mission-rules"')).toBeLessThan(briefing.indexOf('class="story"'));
      }
    }
  });

  it("uses the game default when a chapter does not override difficulty", () => {
    const mission = structuredClone(STORY_CAMPAIGNS[0].missions[0]);
    delete mission.settings.difficulty;
    expect(missionBriefingHTML(mission)).toContain(tacticalPauseRule(DEFAULT_SETTINGS.difficulty));
  });
});
