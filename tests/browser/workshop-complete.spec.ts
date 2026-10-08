import {
  test,
  expect,
  home,
  action,
  acknowledgeFirstBriefing,
} from "./helpers";
import type { Page } from "@playwright/test";
async function openWorkshop(page: Page) {
  await home(page);
  await action(page, "editor").click();
  await action(page, "new-editor").click();
  await expect(page.locator(".editor-header")).toBeVisible();
}

test("workshop dimensions, named copies, test-return and reload preserve draft and history", async ({
  page,
}) => {
  await openWorkshop(page);
  const original = await page.evaluate(() =>
    structuredClone(window.__FRONTIER__.state.map),
  );
  await action(page, "workshop-settings").click();
  const form = page.locator("#workshop-settings-form");
  await form.locator('[name="map-name"]').fill("Round trip frontier");
  await form.locator('[name="width"]').fill("48");
  await form.locator('[name="height"]').fill("40");
  await form.locator('[name="biome"]').selectOption("desert");
  await form.locator('[name="startingGold"]').fill("500");
  await form.locator('[name="gameSpeed"]').fill("0.5");
  await form
    .getByRole("button", { name: "Apply settings", exact: true })
    .click();
  await expect(form).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => window.__FRONTIER__.state.map.width))
    .toBe(48);
  await action(page, "save-map").click();
  await expect(page.getByRole("status")).toContainText("Workshop saved");
  await action(page, "editor-pan").click();
  const before = await page.evaluate(() => ({
    map: structuredClone(window.__FRONTIER__.state.map),
    camera: { ...window.__FRONTIER__.renderer.camera },
    games: window.__FRONTIER__.profile.games,
  }));
  await action(page, "test-map").click();
  await expect(page.locator(".hud")).toBeVisible();
  await acknowledgeFirstBriefing(page);
  expect(
    await page.evaluate(() => window.__FRONTIER__.state.settings.gameSpeed),
  ).toBe(0.5);
  expect(
    await page.evaluate(() => window.__FRONTIER__.state.players[0].gold),
  ).toBeGreaterThanOrEqual(500);
  await page
    .locator('.workshop-test-return [data-action="return-to-editor"]')
    .click();
  expect(await page.evaluate(() => window.__FRONTIER__.state.map)).toEqual(
    before.map,
  );
  expect(
    await page.evaluate(() => window.__FRONTIER__.renderer.camera),
  ).toEqual(before.camera);
  expect(await page.evaluate(() => window.__FRONTIER__.profile.games)).toBe(
    before.games,
  );
  await expect(action(page, "editor-pan")).toHaveClass(/active/);
  await action(page, "editor-undo").click();
  expect(await page.evaluate(() => window.__FRONTIER__.state.map.width)).toBe(
    original.width,
  );
  await action(page, "editor-redo").click();
  expect(await page.evaluate(() => window.__FRONTIER__.state.map.width)).toBe(
    48,
  );
  await action(page, "clone-current-map").click();
  await expect(page.getByRole("status")).toContainText("separate named copy");
  await action(page, "exit-editor").click();
  await expect(page.locator(".workshop-library-entry")).toHaveCount(2);
  await action(page, "resume-editor").click();
  await expect(page.locator("#editor-map-name")).toHaveValue(
    "Round trip frontier copy",
  );
  await action(page, "exit-editor").click();
  await page.reload();
  await action(page, "editor").click();
  await action(page, "resume-editor").click();
  await action(page, "editor-undo").click();
  expect(await page.evaluate(() => window.__FRONTIER__.state.map.width)).toBe(
    original.width,
  );
});

test("invalid workshop settings are atomic, Pan does not paint, and held brush is one undo", async ({
  page,
}) => {
  await openWorkshop(page);
  const original = await page.evaluate(() =>
    structuredClone(window.__FRONTIER__.state.map),
  );
  await action(page, "workshop-settings").click();
  const form = page.locator("#workshop-settings-form");
  await form.locator('[name="width"]').fill("16");
  await form.locator('[name="height"]').fill("16");
  await form
    .getByRole("button", { name: "Apply settings", exact: true })
    .click();
  await expect(page.locator("#workshop-settings-error")).toContainText(
    "cut off",
  );
  expect(await page.evaluate(() => window.__FRONTIER__.state.map)).toEqual(
    original,
  );
  await form.getByRole("button", { name: "Cancel", exact: true }).click();
  await action(page, "editor-pan").click();
  await action(page, "toggle-editor-tools").click();
  const viewport = page.viewportSize()!,
    x = viewport.width * 0.6,
    y = viewport.height * 0.55;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 40, y + 15, { steps: 5 });
  await page.mouse.up();
  expect(await page.evaluate(() => window.__FRONTIER__.state.map)).toEqual(
    original,
  );
  await action(page, "center-editor").click();
  await action(page, "toggle-editor-tools").click();
  await action(page, "brush-road").click();
  await page.locator("#brush-size").selectOption("3");
  await action(page, "toggle-editor-tools").click();
  const points = await page.evaluate(() => {
    const { renderer: r, state: s } = window.__FRONTIER__,
      y = s.map.height / 2;
    return [
      r.worldToScreen(s.map.width / 2 - 3, y),
      r.worldToScreen(s.map.width / 2 + 3, y),
    ];
  });
  await page.mouse.move(points[0].x, points[0].y);
  await page.mouse.down();
  await page.mouse.move(points[1].x, points[1].y, { steps: 2 });
  await page.mouse.up();
  expect(
    await page.evaluate(() => window.__FRONTIER__.state.map.tiles),
  ).not.toEqual(original.tiles);
  await action(page, "toggle-editor-tools").click();
  await action(page, "editor-undo").click();
  expect(
    await page.evaluate(() => window.__FRONTIER__.state.map.tiles),
  ).toEqual(original.tiles);
});

test("complete skirmish preset, slots, preview and playback match the displayed setup", async ({
  page,
}) => {
  await home(page);
  await action(page, "skirmish").click();
  await page.locator('[data-action="choose-scale"][data-id="epic"]').click();
  await expect(page.locator('[name="mapSize"]')).toHaveValue("giant");
  await expect(page.locator('[name="populationCap"]')).toHaveValue("150");
  await expect(page.locator(".setup-slot")).toHaveCount(4);
  await page.locator('.setup-advanced > summary').click();
  await page.locator('[name="slot-1-controller"]').selectOption("closed");
  await page.locator('[name="slot-2-alliance"]').selectOption("0");
  await page.locator('[name="gameSpeed"]').fill("0.5");
  await page.locator('[name="gameSpeed"]').blur();
  await expect(page.locator("#setup-summary")).toContainText(
    "3 commanders in 2 opposing alliances",
  );
  await expect(page.locator("#setup-summary")).toContainText(
    "Large-army warning",
  );
  await action(page, "preview-setup").click();
  await expect(page.locator("#setup-minimap")).toBeVisible();
  await page
    .getByRole("button", { name: "Back to settings", exact: true })
    .click();
  await action(page, "launch").click();
  await expect(page.locator(".hud")).toBeVisible();
  await acknowledgeFirstBriefing(page);
  expect(
    await page.evaluate(() => ({
      w: window.__FRONTIER__.state.map.width,
      speed: window.__FRONTIER__.state.settings.gameSpeed,
      slots: window.__FRONTIER__.state.settings.slots?.map((s) => [
        s.controller,
        s.alliance,
      ]),
    })),
  ).toEqual({
    w: 120,
    speed: 0.5,
    slots: [
      ["human", 0],
      ["closed", 1],
      ["ai", 0],
      ["ai", 3],
    ],
  });
  await expect(page.locator("#match-time")).toContainText("0.5×");
});
