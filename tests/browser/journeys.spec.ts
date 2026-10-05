import { test, expect, action, home, pause } from "./helpers";
import type { Page } from "@playwright/test";
const value = (page: Page) =>
  page.evaluate(() => {
    const f = window.__FRONTIER__ as any;
    return {
      matchId: f.matchId,
      campaign: f.campaignSession,
      expedition: f.expedition,
      audio: f.audioState,
      profile: f.profile,
      seed: f.state.settings.seed,
      time: f.state.time,
    };
  });
async function story(page: Page, id = "rise-of-the-frontier") {
  await action(page, "campaign").click();
  await page
    .locator(`[data-action="choose-campaign"][data-id="${id}"]`)
    .click();
}
// Result fixtures exercise UI/persistence, not campaign balance. Real objective
// predicates and command-driven siege are covered by simulation tests.
async function resultFixture(page: Page, win = true) {
  await page.evaluate((win) => {
    const s = window.__FRONTIER__.state;
    s.winner = win ? 0 : 1;
    s.victoryReason = win
      ? "QA fixture: objectives complete"
      : "QA fixture: keep lost";
    if (!win) s.players[0].defeated = true;
  }, win);
  await expect(page.locator(".result-dialog")).toBeVisible();
  await expect(page.locator("#result-save-status")).toHaveText("Result saved on this device.");
}
async function beginBalancedExpedition(page: Page) {
  await page
    .locator('[data-action="expedition-start"][data-id="balanced"]')
    .click();
  // The action commits its checkpoint before publishing the new route. A click
  // finishing does not mean that asynchronous storage/navigation has completed.
  await expect(page.locator('[data-action="expedition-node"][data-id="foothold"]')).toBeVisible();
  await expect.poll(async () => {
    const run = (await value(page)).expedition;
    return run && {phase:run.phase,activeNode:run.activeNode,route:run.route,crowns:run.crowns,bonuses:run.bonuses,journal:run.journal};
  }).toEqual({phase:"route",activeNode:null,route:["foothold"],crowns:40,bonuses:{gold:0,wood:0,damage:0,health:0},journal:[]});
}
async function expeditionStart(page: Page) {
  await action(page, "expedition").click();
  await beginBalancedExpedition(page);
  await page
    .locator('[data-action="expedition-node"][data-id="foothold"]')
    .click();
  await action(page, "begin-briefing").click();
}
async function stop(page: Page, id: string, choice?: string) {
  await page
    .locator(`[data-action="expedition-node"][data-id="${id}"]`)
    .click();
  if (choice) {
    await page
      .locator(`[data-action="expedition-choice"][data-id="${choice}"]`)
      .click();
    await expect(action(page, "expedition-choice")).toHaveCount(0);
    await expect(page.getByRole("heading", {name:"Choose your next stop",exact:true})).toBeVisible();
    await expect.poll(async () => {
      const run = (await value(page)).expedition;
      return run && {phase:run.phase,activeNode:run.activeNode,last:run.journal.at(-1)};
    }).toEqual({phase:"route",activeNode:null,last:{nodeId:id,choiceId:choice}});
  } else {
    await action(page, "begin-briefing").click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect.poll(async () => {
      const run = (await value(page)).expedition;
      return run && {phase:run.phase,activeNode:run.activeNode};
    }).toEqual({phase:"battle",activeNode:id});
  }
}
test("two authored campaign menus, live objectives and save/continue retain chapter identity", async ({
  page,
}) => {
  await home(page);
  await action(page, "campaign").click();
  await expect(action(page, "choose-campaign")).toHaveCount(2);
  await page
    .locator('[data-action="choose-campaign"][data-id="ember-road"]')
    .click();
  await expect(action(page, "mission")).toHaveCount(3);
  await action(page, "home").click();
  await story(page);
  await expect(action(page, "mission")).toHaveCount(5);
  await expect(action(page, "mission").nth(1)).toBeDisabled();
  await action(page, "mission").first().click();
  await expect(page.locator(".mission-objectives li")).toHaveCount(5);
  const initial = await value(page);
  expect(initial.campaign.missionId).toBe("outpost");
  await action(page, "begin-mission").click();
  await action(page, "mission-objectives").click();
  await expect(page.locator(".mission-objective")).toHaveCount(5);
  await action(page, "close-dialog").first().click();
  await action(page, "pause-menu").click();
  await action(page, "save-leave").click();
  await page.reload();
  await action(page, "continue").click();
  const resumed = await value(page);
  expect(resumed.matchId).toBe(initial.matchId);
  expect(resumed.campaign).toEqual(initial.campaign);
  await expect(action(page, "mission-objectives")).toBeVisible();
  expect(
    await page.evaluate(
      () => window.__FRONTIER__.state.settings.scriptedVictory,
    ),
  ).toBe(true);
});
test("chapter result fixture unlocks next mission once and persists record and cosmetic title", async ({
  page,
}) => {
  await home(page);
  await story(page);
  await action(page, "mission").first().click();
  await action(page, "begin-mission").click();
  const initial = await value(page);
  await resultFixture(page);
  let current = await value(page);
  expect(current.profile.games).toBe(1);
  expect(current.profile.completedMissions["rise-of-the-frontier"]).toEqual([
    "outpost",
  ]);
  expect(current.profile.history[0].id).toBe(initial.matchId);
  expect(current.profile.achievements["first-victory"].unlockedAt).toBeTruthy();
  await expect(action(page, "next-mission")).toBeVisible();
  await action(page, "result-record").click();
  await page
    .locator('[data-action="profile-banner"][data-id="banner-founder"]')
    .click();
  await expect(page.locator(".profile-title")).toHaveText(
    "Founder of the Frontier",
  );
  await page.reload();
  await action(page, "record").click();
  current = await value(page);
  expect(current.profile.games).toBe(1);
  expect(current.profile.history).toHaveLength(1);
  expect(current.profile.selectedBanner).toBe("banner-founder");
  await page
    .locator('[data-action="record-category"][data-id="stories"]')
    .click();
  await expect(
    page.locator(".achievement-grid").first().locator(".achievement"),
  ).toHaveCount(3);
  await action(page, "home").click();
  await story(page);
  await expect(action(page, "mission").nth(1)).toBeEnabled();
});
test("chapter defeat retries original authored mission with a fresh stable match ID", async ({
  page,
}) => {
  await home(page);
  await story(page);
  await action(page, "mission").first().click();
  await action(page, "begin-mission").click();
  const before = await value(page);
  await resultFixture(page, false);
  await action(page, "retry").click();
  await expect(action(page, "begin-mission")).toBeVisible();
  const after = await value(page);
  expect(after.matchId).not.toBe(before.matchId);
  expect(after.seed).toBe(before.seed);
  expect(after.campaign.missionId).toBe("outpost");
  expect(after.profile.campaign).toBe(0);
  expect(after.time).toBe(0);
});
test("expedition keeps its own battle checkpoint when ordinary Continue is replaced", async ({
  page,
}) => {
  await home(page);
  await expeditionStart(page);
  await pause(page);
  await action(page, "pause-menu").click();
  await action(page, "save-leave").click();
  const expected = await value(page);
  await action(page, "skirmish").click();
  await action(page, "launch").click();
  const first = page.getByRole("button", { name: "Start battle", exact: true });
  if (await first.count()) await first.click();
  await action(page, "pause-menu").click();
  await action(page, "save-leave").click();
  await page.reload();
  await action(page, "expedition").click();
  await action(page, "expedition-resume").click();
  const resumed = await value(page);
  expect(resumed.matchId).toBe(expected.matchId);
  expect(resumed.seed).toBe(expected.seed);
  expect(resumed.time).toBe(expected.time);
  expect(resumed.expedition).toEqual(expected.expedition);
});
test("branching expedition UI supports shop choices, reload, completion, defeat and fresh replay", async ({
  page,
}) => {
  await home(page);
  await expeditionStart(page);
  await resultFixture(page);
  await action(page, "result-expedition").click();
  await expect(action(page, "expedition-node")).toHaveCount(3);
  await stop(page, "caravan", "steel");
  let run = (await value(page)).expedition;
  expect(run.crowns).toBe(60);
  expect(run.bonuses.damage).toBeCloseTo(0.12);
  await page.reload();
  await action(page, "expedition").click();
  await expect(page.locator(".expedition-summary")).toBeVisible();
  await expect.poll(async () => (await value(page)).expedition).toEqual(run);
  await stop(page, "redoubt");
  await resultFixture(page);
  await action(page, "result-expedition").click();
  await stop(page, "relic", "oak");
  await stop(page, "ice-road");
  await resultFixture(page);
  await action(page, "result-expedition").click();
  await stop(page, "last-shop", "arsenal");
  await stop(page, "citadel");
  const armies = await page.evaluate(() =>
    window.__FRONTIER__.state.players.map((p) => ({
      gold: p.gold,
      wood: p.wood,
    })),
  );
  expect(armies[1]).toEqual(armies[2]);
  await resultFixture(page);
  await action(page, "result-expedition").click();
  const finished = await value(page);
  expect(finished.expedition.phase).toBe("completed");
  expect(finished.expedition.victories).toBe(4);
  expect(finished.profile.expedition).toBe(1);
  await action(page, "expedition-new").click();
  await expect(page.locator(".expedition-intro")).toBeVisible();
  await expect.poll(async () => (await value(page)).expedition).toBeNull();
  await beginBalancedExpedition(page);
  run = (await value(page)).expedition;
  expect(run.crowns).toBe(40);
  expect(run.bonuses).toEqual({ gold: 0, wood: 0, damage: 0, health: 0 });
  await stop(page, "foothold");
  await resultFixture(page, false);
  await action(page, "result-expedition").click();
  expect((await value(page)).expedition.phase).toBe("defeated");
  expect((await value(page)).profile.expedition).toBe(1);
});
test("menu audio stays gesture gated and all six states are reachable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    (window as any).__audioCreations = 0;
    const Native = window.AudioContext;
    window.AudioContext = class extends Native {
      constructor(options?: AudioContextOptions) {
        super(options);
        (window as any).__audioCreations++;
      }
    };
  });
  await home(page);
  expect(await page.evaluate(() => (window as any).__audioCreations)).toBe(0);
  expect((await value(page)).audio).toBe("menu");
  await action(page, "skirmish").click();
  expect(await page.evaluate(() => (window as any).__audioCreations)).toBe(1);
  await action(page, "launch").click();
  const first = page.getByRole("button", { name: "Start battle", exact: true });
  if (await first.count()) await first.click();
  expect((await value(page)).audio).toBe("exploration");
  for (const [count, expected] of [
    [1, "tension"],
    [6, "combat"],
  ] as const) {
    await page.evaluate((count) => {
      const s = window.__FRONTIER__.state;
      for (let i = 0; i < count; i++)
        s.events.push({
          id: s.nextEventId++,
          type: "hit",
          time: s.time,
          team: 0,
          targetTeam: 1,
          x: 0,
          y: 0,
        });
    }, count);
    await expect.poll(async () => (await value(page)).audio).toBe(expected);
  }
  await resultFixture(page);
  expect((await value(page)).audio).toBe("victory");
  await action(page, "result-home").click();
  expect((await value(page)).audio).toBe("menu");
  await action(page, "skirmish").click();
  await action(page, "launch").click();
  await resultFixture(page, false);
  expect((await value(page)).audio).toBe("defeat");
  expect(await page.evaluate(() => (window as any).__audioCreations)).toBe(1);
});
