import { test, expect, action, home, tap, clearGround, pause } from "./helpers";
import type { Page } from "@playwright/test";

async function lesson(page: Page, number: number) {
  await expect(page.locator("#battle-hint > span")).toHaveText(
    `LEARN TO COMMAND · ${number}/8`,
    { timeout: 45_000 },
  );
}
async function expandGuide(page: Page) {
  const expand = page.getByRole("button", {
    name: "Expand guide",
    exact: true,
  });
  if (await expand.count()) await expand.click();
}
async function collapseDeck(page: Page) {
  const deck = page.locator(".command-deck");
  if (!(await deck.getAttribute("class"))?.includes("collapsed"))
    await action(page, "toggle-deck").click();
}
async function pointAtLessonTarget(
  page: Page,
  kind: "gold" | "wood" | "relic" | "keep" | "house",
) {
  await collapseDeck(page);
  await expandGuide(page);
  const help = action(page, "learning-help");
  await help.scrollIntoViewIfNeeded();
  expect(await help.evaluate((button) => {
    const rect = button.getBoundingClientRect();
    return document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
      ?.closest('[data-action="learning-help"]') === button;
  }), "Lesson action must receive taps above the short-screen joystick").toBe(true);
  await help.click();
  const minimize = page.getByRole("button", {
    name: "Minimize guide",
    exact: true,
  });
  if (await minimize.count()) await minimize.click();
  const point = await page.evaluate((kind) => {
    const { state, renderer } = window.__FRONTIER__;
    const spawn = state.map.spawns[0];
    const target =
      kind === "keep" || kind === "house"
        ? state.entities.find(
            (e) => e.team === 0 && e.type === kind && e.hp > 0,
          )!
        : state.map.nodes
            .filter((n) => n.kind === kind)
            .sort(
              (a, b) =>
                Math.hypot(a.x - spawn.x, a.y - spawn.y) -
                Math.hypot(b.x - spawn.x, b.y - spawn.y),
            )[0];
    const point = renderer.worldToScreen(target.x, target.y);
    return { ...point, hit: document.elementFromPoint(point.x, point.y)?.id };
  }, kind);
  expect(point.hit, `${kind} target must be on uncovered canvas`).toBe("world");
  await tap(page, point);
}
async function startLearning(page: Page) {
  await action(page, "learn").click();
  await expect(
    page.getByRole("dialog", { name: "Your first settlement", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Start learning", exact: true })
    .click();
  await lesson(page, 1);
  await expect(page.locator("#battle-hint")).toBeVisible();
  await expect(page.locator("#objective")).toContainText("Peaceful practice");
}
async function speedPractice(page: Page) {
  await action(page, "panel-orders").click();
  await action(page, "speed").click();
  await action(page, "speed").click();
  await expect(action(page, "speed")).toContainText("2×");
  await collapseDeck(page);
}
async function moveCommander(page: Page) {
  await page
    .getByRole("button", { name: "Minimize guide", exact: true })
    .click();
  await tap(page, await clearGround(page));
  await lesson(page, 2);
}

test("all eight peaceful lessons use real input, teach neighboring houses, and launch the named Outpost", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await home(page);
  // A previous campaign selection must not redirect the completion button.
  await action(page, "campaign").click();
  await page
    .locator('[data-action="choose-campaign"][data-id="ember-road"]')
    .click();
  await expect(
    page.getByRole("heading", { name: "The Ember Road", exact: true }),
  ).toBeVisible();
  await action(page, "home").click();
  await startLearning(page);
  for (const [panel, text] of [
    ["army", "Recruit opens"],
    ["build", "Build opens"],
    ["research", "Research opens"],
  ]) {
    await action(page, `panel-${panel}`).click();
    await expect(page.locator("#deck-content")).toContainText(text);
    await expect(
      page.locator(
        '#deck-content [data-action="recruit"], #deck-content [data-action="build"], #deck-content [data-action="research"]',
      ),
    ).toHaveCount(0);
  }
  await speedPractice(page);
  await moveCommander(page);
  await pointAtLessonTarget(page, "gold");
  await lesson(page, 3);
  await pointAtLessonTarget(page, "wood");
  await lesson(page, 4);
  await pointAtLessonTarget(page, "keep");
  await lesson(page, 5);
  await expect(page.locator('.inspection [data-action="recruit"]')).toHaveCount(
    1,
  );
  await expect(
    page.locator(
      '.inspection [data-action="research"], .inspection [data-action="upgrade-building"]',
    ),
  ).toHaveCount(0);
  await action(page, "panel-army").click();
  await expect(
    page.locator('.action-cards [data-action="recruit"]'),
  ).toHaveCount(1);
  await page
    .getByRole("button", { name: "Queue 3 at a time", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Recruit Swordsman", exact: true })
    .click();
  await expect(action(page, "cancel-production")).toHaveCount(3);
  await lesson(page, 6);
  const capacity = await page.evaluate(
    () => window.__FRONTIER__.state.players[0].populationCap,
  );
  await action(page, "panel-build").click();
  await expect(page.locator('.action-cards [data-action="build"]')).toHaveCount(
    1,
  );
  await page.getByRole("button", { name: "Build House", exact: true }).click();
  await expect(page.locator(".placement-toolbar small")).toContainText("Ready");
  await action(page, "confirm-placement").click();
  await expect
    .poll(
      () =>
        page.evaluate(() => window.__FRONTIER__.state.players[0].populationCap),
      { timeout: 20_000 },
    )
    .toBe(capacity + 8);
  await lesson(page, 6); // One house is insufficient.
  await action(page, "panel-build").click();
  await page.getByRole("button", { name: "Build House", exact: true }).click();
  await action(page, "confirm-placement").click(); // The real preview suggests its neighbor.
  await lesson(page, 7);
  const homes = await page.evaluate(() =>
    window.__FRONTIER__.state.entities.filter(
      (e) => e.team === 0 && e.type === "house",
    ),
  );
  expect(homes).toHaveLength(2);
  expect(
    Math.hypot(homes[0].x - homes[1].x, homes[0].y - homes[1].y),
  ).toBeGreaterThanOrEqual(2.25);
  expect(
    Math.hypot(homes[0].x - homes[1].x, homes[0].y - homes[1].y),
  ).toBeLessThanOrEqual(3);
  expect(
    await page.evaluate(
      () => window.__FRONTIER__.state.players[0].populationCap,
    ),
  ).toBe(capacity + 16);
  await pointAtLessonTarget(page, "house");
  await expect(page.locator(".inspection")).toContainText(
    "Houses do not produce workers",
  );
  await action(page, "upgrade-building").click();
  await lesson(page, 8);
  expect(
    await page.evaluate(
      () => window.__FRONTIER__.state.players[0].populationCap,
    ),
  ).toBe(capacity + 20);
  await action(page, "select-army").click();
  await pointAtLessonTarget(page, "relic");
  await expect(
    page.getByRole("dialog", { name: "Your settlement is ready", exact: true }),
  ).toBeVisible({ timeout: 45_000 });
  expect(
    await page.evaluate(() => ({
      winner: window.__FRONTIER__.state.winner,
      losses: window.__FRONTIER__.state.players[0].stats.unitsLost,
      commanderDeaths: window.__FRONTIER__.state.players[0].stats.commanderDeaths,
      damage: window.__FRONTIER__.state.players.reduce(
        (total, player) => total + player.stats.damageDealt,
        0,
      ),
      wounded: window.__FRONTIER__.state.entities.filter(
        // Completed construction can finish ~2e-13 HP below maximum. Only
        // structures get this tiny numerical allowance; combatants stay exact.
        (entity) => entity.team === 0 && entity.hp < entity.maxHp - (entity.kind === "building" ? 1e-6 : 0),
      ).length,
    })),
  ).toEqual({ winner: null, losses: 0, commanderDeaths: 0, damage: 0, wounded: 0 });
  await page.getByRole("button", { name: "Keep practicing", exact: true }).click();
  await pause(page);
  await action(page, "pause-menu").click();
  const completed = await page.evaluate(() => JSON.stringify(window.__FRONTIER__.state));
  await action(page, "save-leave").click();
  await expect(action(page, "continue")).toBeVisible();
  await page.reload();
  await action(page, "continue").click();
  await expect(page.getByRole("dialog", { name: "Your settlement is ready", exact: true })).toBeVisible();
  expect(await page.evaluate(() => JSON.stringify(window.__FRONTIER__.state))).toBe(completed);
  await expect(page.getByRole("dialog", { name: "Your settlement is ready", exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Play The Outpost", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "The Outpost", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => window.__FRONTIER__.state.settings.seed),
  ).toBe("OUTPOST-01");
  expect(
    await page.evaluate(() => window.__FRONTIER__.state.settings.learning),
  ).not.toBe(true);
  const outpostBriefing = page.getByRole("dialog", { name: "The Outpost", exact: true });
  await outpostBriefing.locator('[data-action="begin-mission"]').click();
  await expect(outpostBriefing).toHaveCount(0);
  await action(page, "panel-build").click();
  await expect(page.locator('.action-cards [data-action="build"]')).toHaveCount(
    8,
  );
  await action(page, "panel-army").click();
  await expect(
    page.locator('.action-cards [data-action="recruit"]'),
  ).toHaveCount(6);
  await action(page, "panel-research").click();
  await expect(
    page.locator('#deck-content [data-action="research"]'),
  ).toHaveCount(6);
});

test("peaceful practice saves its real milestone and keeps the guide available after reload", async ({
  page,
}) => {
  await home(page);
  await startLearning(page);
  await moveCommander(page);
  await action(page, "pause-menu").click();
  await action(page, "save-leave").click();
  await expect(action(page, "continue")).toBeVisible();
  await page.reload();
  await action(page, "continue").click();
  await lesson(page, 2);
  await expandGuide(page);
  await expect(page.locator("#battle-hint p")).toContainText(
    "mine gathers gold automatically",
  );
  await expect(action(page, "learning-help")).toBeVisible();
  await action(page, "panel-build").click();
  await expect(page.locator("#deck-content")).toContainText("Build opens");
  await expect(page.locator('.action-cards [data-action="build"]')).toHaveCount(
    0,
  );
});
