import {
  test,
  expect,
  launch,
  action,
  pause,
  clearGround,
  tap,
} from "./helpers";
test("live production preserves queue scroll, Cancel identity and keyboard focus", async ({
  page,
}) => {
  await launch(page, { difficulty: "easy" });
  await page.evaluate(() => {
    const state = window.__FRONTIER__.state;
    state.players.forEach((p) => (p.ai = false));
    state.players[0].gold = state.players[0].wood = 2000;
  });
  await action(page, "panel-army").click();
  await action(page, "recruit-batch").filter({ hasText: "5" }).click();
  await page
    .getByRole("button", { name: "Recruit Swordsman", exact: true })
    .click();
  const cancel = action(page, "cancel-production").nth(4);
  await expect(cancel).toBeVisible();
  const handle = await cancel.elementHandle();
  const id = await cancel.getAttribute("data-id");
  await cancel.focus();
  await page
    .locator(".producer ol")
    .evaluate((node) => (node.scrollLeft = node.scrollWidth));
  const scroll = await page
    .locator(".producer ol")
    .evaluate((node) => node.scrollLeft);
  expect(scroll).toBeGreaterThan(0);
  await page.waitForTimeout(1300);
  expect(
    await handle!.evaluate(
      (node) => node.isConnected && node === document.activeElement,
    ),
  ).toBe(true);
  expect(
    await page.locator(".producer ol").evaluate((node) => node.scrollLeft),
  ).toBeCloseTo(scroll, 0);
  await expect(page.locator(".refund-amount").nth(4)).toContainText("45 gold");
  await page.keyboard.press("Enter");
  await expect
    .poll(() =>
      page.evaluate(
        (queueId) =>
          window.__FRONTIER__.state.entities.some((e) =>
            e.queue.some((q) => q.queueId === queueId),
          ),
        id!.split("|")[1],
      ),
    )
    .toBe(false);
});
test("planned economy includes reserved recruitment and Army cancels rally targeting", async ({
  page,
}) => {
  await launch(page, { difficulty: "easy" });
  await pause(page);
  await action(page, "panel-army").click();
  await action(page, "recruit-batch").filter({ hasText: "3" }).click();
  await page
    .getByRole("button", { name: "Recruit Swordsman", exact: true })
    .click();
  const availableGold = await page
    .locator("#gold")
    .evaluate((node) => node.firstChild!.textContent);
  await action(page, "economy").first().click();
  await expect(page.getByRole("dialog")).toContainText(`${availableGold} Gold`);
  await expect(page.getByRole("dialog")).toContainText("3 in training");
  await action(page, "close-dialog").last().click();
  await action(page, "inspect-building").first().click();
  await action(page, "set-rally").click();
  await action(page, "select-army").click();
  // Finish the camera's panel-collapse adjustment through its real focus control
  // before reading a ground coordinate. The move assertion still verifies cancel.
  await page.locator('.map-controls [data-action="focus"]').click();
  await action(page, "order-move").click();await tap(page, await clearGround(page));
  expect(
    await page.evaluate(
      () => window.__FRONTIER__.state.pendingCommands.at(-1)?.type,
    ),
  ).toBe("move");
});
test("keyboard Build and Recruit shortcuts expand the minimized panel", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "Desktop keyboard path");
  await launch(page, { difficulty: "easy" });
  await expect(page.locator(".command-deck")).toHaveClass(/collapsed/);
  await page.keyboard.press("b");
  await expect(
    page.getByRole("button", { name: "Build House", exact: true }),
  ).toBeVisible();
  await action(page, "toggle-deck").click();
  await page.keyboard.press("r");
  await expect(
    page.getByRole("button", { name: "Recruit Swordsman", exact: true }),
  ).toBeVisible();
});
test("selected construction updates its countdown and health without reopening Details", async ({
  page,
}) => {
  await launch(page, { difficulty: "easy" });
  await action(page, "panel-build").click();
  await page.getByRole("button", { name: "Build House", exact: true }).click();
  await action(page, "confirm-placement").click();
  const id = await page.evaluate(
    () =>
      window.__FRONTIER__.state.entities.find(
        (e) => e.team === 0 && e.type === "house",
      )!.id,
  );
  // Fixture selects a real building through the app's delegated inspection handler; canvas picking is separate QA.
  await page.evaluate((id) => {
    const button = document.createElement("button");
    button.dataset.action = "inspect-building";
    button.dataset.id = id;
    document.querySelector("#app")!.append(button);
    button.click();
    button.remove();
  }, id);
  const progress = page.locator("[data-construction-progress]");
  const before = await progress.textContent();
  const health = await page.locator("[data-inspect-health]").textContent();
  await expect.poll(() => progress.textContent()).not.toBe(before);
  await expect
    .poll(() => page.locator("[data-inspect-health]").textContent())
    .not.toBe(health);
});
