import { describe, expect, it } from "vitest";
import {
  chooseExpeditionReward,
  createExpedition,
  expeditionBattle,
  finishExpeditionBattle,
  restoreExpedition,
  saveExpedition,
  visitExpeditionNode,
  type ExpeditionRun,
} from "../src/ui/campaigns/expedition";
import {
  expeditionBattleRulesHTML,
  expeditionHTML,
} from "../src/ui/campaigns/view";
import { createProfile } from "../src/ui/progression/profile";

function routeTo(nodeId: string): ExpeditionRun {
  let run = createExpedition("DISCLOSURE", { loadout: "forager" });
  for (const [node, choice] of [
    ["foothold", ""],
    ["haven", "timber"],
    ["woodland", ""],
    ["relic", "oak"],
    ["ice-road", ""],
    ["last-village", "smiths"],
    ["citadel", ""],
  ]) {
    if (run.route.includes(nodeId)) return run;
    run = visitExpeditionNode(run, node);
    run = choice
      ? chooseExpeditionReward(run, choice)
      : finishExpeditionBattle(run, true);
  }
  throw new Error(`No fixture route to ${nodeId}`);
}

function routeCard(html: string, nodeId: string): string {
  const card = html
    .match(/<article\b[\s\S]*?<\/article>/g)
    ?.find((article) => article.includes(`data-id="${nodeId}"`));
  expect(card).toBeDefined();
  return card!;
}

const encounters = [
  ["foothold", "easy", "Easy difficulty · Unlimited tactical pauses"],
  ["woodland", "normal", "Normal difficulty · Unlimited tactical pauses"],
  ["redoubt", "hard", "Hard difficulty · 3 tactical pauses per battle"],
  ["ice-road", "normal", "Normal difficulty · Unlimited tactical pauses"],
  ["iron-gate", "hard", "Hard difficulty · 3 tactical pauses per battle"],
  ["citadel", "hard", "Hard difficulty · 3 tactical pauses per battle"],
] as const;

describe("expedition battle rule disclosure", () => {
  it.each(encounters)(
    "shows %s's authored %s rule before preparation and on Continue encounter",
    (nodeId, difficulty, rule) => {
      const profile = createProfile();
      const route = routeTo(nodeId);
      const card = routeCard(expeditionHTML(route, profile), nodeId);
      const active = visitExpeditionNode(route, nodeId);
      const battle = expeditionBattle(active);
      const rulesHTML = expeditionBattleRulesHTML(battle);
      const continued = expeditionHTML(active, profile);

      expect(battle.settings.difficulty).toBe(difficulty);
      expect(rulesHTML).toBe(
        `<p class="mission-rules expedition-rules">${rule}</p>`,
      );
      expect(card).toContain(rulesHTML);
      expect(card.indexOf(rulesHTML)).toBeLessThan(
        card.indexOf('data-action="expedition-node"'),
      );
      expect(continued).toContain(rulesHTML);
      expect(continued.indexOf(rulesHTML)).toBeLessThan(
        continued.indexOf('data-action="expedition-resume"'),
      );
    },
  );

  it.each([
    "haven",
    "caravan",
    "crossroads",
    "relic",
    "refugees",
    "last-village",
    "last-shop",
  ])("keeps the nonbattle stop %s free of combat difficulty and pause rules", (nodeId) => {
    const profile = createProfile();
    const route = routeTo(nodeId);
    const card = routeCard(expeditionHTML(route, profile), nodeId);
    const choice = expeditionHTML(visitExpeditionNode(route, nodeId), profile);
    for (const html of [card, choice]) {
      expect(html).not.toContain("expedition-rules");
      expect(html).not.toMatch(/difficulty|tactical pauses/i);
    }
  });

  it.each(encounters)(
    "repeats %s disclosure after save/restore without changing the route, rewards, or profile",
    (nodeId) => {
      const profile = createProfile();
      const profileBefore = structuredClone(profile);
      const route = routeTo(nodeId);
      const active = visitExpeditionNode(route, nodeId);
      for (const run of [route, active]) {
        const before = structuredClone(run);
        const saved = saveExpedition(run);
        const savedBefore = structuredClone(saved);
        const html = expeditionHTML(run, profile);
        expect(expeditionHTML(run, profile)).toBe(html);
        const restored = restoreExpedition(JSON.parse(JSON.stringify(saved)));
        expect(restored).toEqual(before);
        expect(expeditionHTML(restored, profile)).toBe(html);
        expect(run).toEqual(before);
        expect(saved).toEqual(savedBefore);
        expect(saveExpedition(run)).toEqual(saved);
      }
      expect(profile).toEqual(profileBefore);
    },
  );

  it("preserves an ended Forager run and its restart actions", () => {
    const profile = createProfile();
    const ended = finishExpeditionBattle(
      visitExpeditionNode(routeTo("foothold"), "foothold"),
      false,
    );
    const before = structuredClone(ended);
    const restored = restoreExpedition(saveExpedition(ended));
    const html = expeditionHTML(ended, profile);
    expect(html).toContain("The expedition has ended");
    expect(html).toContain('data-action="expedition-new"');
    expect(html).toContain('data-action="learn"');
    expect(html).not.toContain("expedition-rules");
    expect(html).not.toContain('data-action="expedition-resume"');
    expect(expeditionHTML(restored, profile)).toBe(html);
    expect(ended).toEqual(before);
    expect(ended.loadout).toBe("forager");
  });
});
