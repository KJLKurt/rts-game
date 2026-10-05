import { test, expect, action, home } from "./helpers";

test("a full profile store preserves a finished campaign, retries after reload, and rewards once", async ({
  page,
}) => {
  await page.addInitScript(() => {
    (window as any).__BLOCK_PROFILE__ = true;
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (
        (window as any).__BLOCK_PROFILE__ &&
        key === "frontier-command:rts-game:v1:profile"
      )
        throw new DOMException("Profile storage full", "QuotaExceededError");
      return set.call(this, key, value);
    };
  });
  await home(page);
  await action(page, "campaign").click();
  await page
    .locator('[data-action="choose-campaign"][data-id="rise-of-the-frontier"]')
    .click();
  await action(page, "mission").first().click();
  await action(page, "begin-mission").click();
  // Completed-state fixture isolates result durability; it does not claim gameplay balance.
  await page.evaluate(() => {
    const state = window.__FRONTIER__.state;
    state.winner = 0;
    state.victoryReason = "Storage recovery fixture";
  });
  await expect(page.locator("#result-save-status")).toContainText(
    "finished battle is saved",
  );
  expect(await page.evaluate(() => window.__FRONTIER__.profile.games)).toBe(0);
  await action(page, "next-mission").click();
  await expect(page.locator(".result-dialog")).toBeVisible();
  expect(
    await page.evaluate(
      () => (window.__FRONTIER__ as any).campaignSession.missionId,
    ),
  ).toBe("outpost");

  await page.reload();
  await action(page, "continue").click();
  await expect(page.locator("#result-save-status")).toContainText(
    "finished battle is saved",
  );
  expect(await page.evaluate(() => window.__FRONTIER__.profile.games)).toBe(0);
  await page.evaluate(() => {
    (window as any).__BLOCK_PROFILE__ = false;
  });
  await action(page, "result-save").click();
  await expect(page.locator("#result-save-status")).toContainText(
    "Result saved on this device",
  );
  expect(await page.evaluate(() => window.__FRONTIER__.profile.games)).toBe(1);
  expect(await page.evaluate(() => window.__FRONTIER__.profile.campaign)).toBe(
    1,
  );
  await action(page, "result-home").click();
  await page.reload();
  expect(await page.evaluate(() => window.__FRONTIER__.profile.games)).toBe(1);
  await expect(action(page, "continue")).toHaveCount(0);
  await action(page, "campaign").click();
  await page
    .locator('[data-action="choose-campaign"][data-id="rise-of-the-frontier"]')
    .click();
  await expect(action(page, "mission").nth(1)).toBeEnabled();
});

test("blocked storage keeps the result open until a durable retry succeeds", async ({
  page,
}) => {
  await home(page);
  await page.evaluate(() =>
    window.__FRONTIER__.start({
      seed: "ALL-STORAGE-BLOCKED",
      mapSize: "small",
    }),
  );
  const briefing = page.getByRole("button", {
    name: "Start battle",
    exact: true,
  });
  if (await briefing.count()) await briefing.click();
  await page.evaluate(async () => {
    await window.__FRONTIER__.save();
  });
  await page.evaluate(() => {
    const originalOpen = indexedDB.open.bind(indexedDB);
    const originalSet = Storage.prototype.setItem;
    (window as any).__RESTORE_STORAGE__ = () => {
      indexedDB.open = originalOpen;
      Storage.prototype.setItem = originalSet;
    };
    indexedDB.open = () => {
      throw new Error("Storage blocked");
    };
    Storage.prototype.setItem = () => {
      throw new DOMException("Full", "QuotaExceededError");
    };
    const state = window.__FRONTIER__.state;
    state.winner = 0;
    state.victoryReason = "Storage failure fixture";
  });
  await expect(page.locator("#result-save-status")).toContainText(
    "Keep this page open",
  );
  await expect(action(page, "result-save")).toBeVisible();
  await action(page, "result-home").click();
  await expect(page.locator(".result-dialog")).toBeVisible();
  expect(await page.evaluate(() => window.__FRONTIER__.profile.games)).toBe(0);
  await page.evaluate(() => {
    (window as any).__RESTORE_STORAGE__();
  });
  await action(page, "result-save").click();
  await expect(page.locator("#result-save-status")).toContainText(
    "Result saved on this device",
  );
  await expect(action(page, "result-save")).toBeHidden();
  expect(await page.evaluate(() => window.__FRONTIER__.profile.games)).toBe(1);
});

test("expedition Resume recovers a newer finished checkpoint after profile failure", async ({
  page,
}) => {
  await page.addInitScript(() => {
    (window as any).__BLOCK_PROFILE__ = true;
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (
        (window as any).__BLOCK_PROFILE__ &&
        key === "frontier-command:rts-game:v1:profile"
      )
        throw new DOMException("Profile storage full", "QuotaExceededError");
      return set.call(this, key, value);
    };
  });
  await home(page);
  await action(page, "expedition").click();
  await page
    .locator('[data-action="expedition-start"][data-id="balanced"]')
    .click();
  await page
    .locator('[data-action="expedition-node"][data-id="foothold"]')
    .click();
  await action(page, "begin-briefing").click();
  await page.evaluate(async () => {
    await window.__FRONTIER__.save();
  });
  await page.evaluate(() => {
    window.__FRONTIER__.state.winner = 0;
    window.__FRONTIER__.state.victoryReason = "Expedition persistence fixture";
  });
  await expect(page.locator("#result-save-status")).toContainText(
    "finished battle is saved",
  );
  await page.reload();
  await action(page, "expedition").click();
  await action(page, "expedition-resume").click();
  await expect(page.locator("#result-save-status")).toContainText(
    "finished battle is saved",
  );
  await page.evaluate(() => {
    (window as any).__BLOCK_PROFILE__ = false;
  });
  await action(page, "result-save").click();
  await expect(page.locator("#result-save-status")).toContainText(
    "Result saved on this device",
  );
  expect(await page.evaluate(() => window.__FRONTIER__.profile.games)).toBe(1);
  await action(page, "result-expedition").click();
  await expect(
    page.locator('[data-action="expedition-node"][data-id="haven"]'),
  ).toBeVisible();
});
