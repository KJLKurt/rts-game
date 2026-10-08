import type { Locator, Page } from "@playwright/test";
import type { ExpeditionRun } from "../../src/ui/campaigns/expedition";
import type { ProfileV2 } from "../../src/ui/progression/profile";
import { test, expect, action, home, expectWithinViewport } from "./helpers";

// Every case uses Playwright's fresh, isolated browser context. No earned profile
// or existing player save is imported. Surrender itself always uses the visible
// mouse/touch controls; controlled interruption/storage fixtures are labeled below.
const confirmation = (page: Page) =>
  page.getByRole("dialog", { name: "Surrender this battle?", exact: true });
const defeat = (page: Page) =>
  page.getByRole("dialog", { name: "The banner will rise again.", exact: true });

async function press(page: Page, target: Locator) {
  await target.scrollIntoViewIfNeeded();
  if (await page.evaluate(() => navigator.maxTouchPoints > 0)) await target.tap();
  else await target.click();
}

async function skirmish(page: Page) {
  await home(page);
  await press(page, action(page, "skirmish"));
  await page.getByLabel("Map seed", { exact: true }).fill("QA-SURRENDER-NATIVE");
  await page.locator('select[name="mapSize"]').selectOption("small");
  await page.locator('select[name="difficulty"]').selectOption("easy");
  await press(page, action(page, "launch"));
  await expect.poll(() => page.evaluate(() => window.__FRONTIER__.playing)).toBe(true);
  const briefing = page.getByRole("button", { name: "Start battle", exact: true });
  if (await briefing.count()) await press(page, briefing);
  if (await action(page, "dismiss-tips").isVisible()) await press(page, action(page, "dismiss-tips"));
}

async function pauseBattle(page: Page) {
  if (!await page.evaluate(() => window.__FRONTIER__.state.paused))
    await press(page, action(page, "pause").first());
  await expect.poll(() => page.evaluate(() => window.__FRONTIER__.state.paused)).toBe(true);
}

async function openSurrender(page: Page) {
  await press(page, action(page, "pause-menu"));
  await press(page, page.getByRole("button", { name: "Surrender battle", exact: true }));
  await expect(confirmation(page)).toBeVisible();
}

async function readBattle(page: Page) {
  return page.evaluate(() => {
    const f = window.__FRONTIER__ as typeof window.__FRONTIER__ & {
      readonly matchId: string;
      readonly profile: ProfileV2;
      readonly expedition: ExpeditionRun | null;
      readonly campaignSession: { campaignId: string; missionId: string; matchId: string } | null;
    };
    const s = f.state;
    return {
      matchId: f.matchId, profile: f.profile, expedition: f.expedition,
      campaign: f.campaignSession, seed: s.settings.seed,
      time: s.time, tick: s.tick, paused: s.paused, winner: s.winner,
      reason: s.victoryReason, queue: s.pendingCommands,
      pauses: s.players[0].stats.pauses, defeated: s.players[0].defeated,
      surrenderCommands: s.commandLog.filter(entry => entry.command.type === "surrender"),
    };
  });
}

function expectNoRewards(before: ProfileV2, after: ProfileV2) {
  expect(after.wins).toBe(before.wins);
  expect(after.campaign).toBe(before.campaign);
  expect(after.campaignProgress).toEqual(before.campaignProgress);
  expect(after.completedMissions).toEqual(before.completedMissions);
  expect(after.expedition).toBe(before.expedition);
  expect(after.choices).toEqual(before.choices);
  expect(after.unlocked).toEqual(before.unlocked);
  // Played statistics may advance numeric progress; surrender cannot unlock it.
  expect(Object.keys(after.achievements)).toEqual(Object.keys(before.achievements));
  for (const [id, record] of Object.entries(before.achievements)) {
    expect(after.achievements[id].unlocked, id).toBe(record.unlocked);
    expect(after.achievements[id].unlockedAt, id).toBe(record.unlockedAt);
  }
  expect(after.fastestVictory).toBe(before.fastestVictory);
}

async function expectSavedDefeat(page: Page, before: Awaited<ReturnType<typeof readBattle>>) {
  await expect(defeat(page)).toBeVisible();
  await expect(page.locator(".result-reason")).toHaveText("You surrendered.");
  await expect(page.locator("#result-save-status")).toHaveText("Result saved on this device.");
  const after = await readBattle(page);
  expect(after.matchId).toBe(before.matchId);
  expect(after.time).toBe(before.time);
  expect(after.tick).toBe(before.tick);
  expect(after.reason).toBe("You surrendered.");
  expect(after.winner).not.toBeNull();
  expect(after.winner).not.toBe(0);
  expect(after.queue).toEqual([]);
  expect(after.defeated).toBe(before.defeated); // Surrender does not destroy the Keep.
  expect(after.surrenderCommands).toEqual([{ tick: before.tick, command: { type: "surrender", team: 0 } }]);
  expect(after.profile.games).toBe(before.profile.games + 1);
  expect(after.profile.history.filter(record => record.id === before.matchId)).toHaveLength(1);
  expect(after.profile.recordedMatchIds.filter(id => id === before.matchId)).toHaveLength(1);
  expect(after.profile.history[0]).toMatchObject({ id: before.matchId, victory: false, reason: "You surrendered." });
  expectNoRewards(before.profile, after.profile);
  await expect(page.locator(".new-achievements")).toHaveCount(0);
  await expect(defeat(page)).not.toContainText("Reward:");
  return after;
}

test("native confirmation fits, cancels repeatedly, survives interruption and preserves Save & leave", async ({ page }) => {
  await skirmish(page);
  await pauseBattle(page);
  await press(page, action(page, "select-army"));
  await press(page, action(page, "hold"));
  await openSurrender(page);

  // Capture only these two small phone PNGs, before continuing the longer flow.
  // CSS scale avoids the emulated phone's 2.625x device-pixel artifact inflation.
  if (test.info().project.name.startsWith("phone-"))
    await page.screenshot({ path: test.info().outputPath(`surrender-confirmation-${test.info().project.name}.png`), scale: "css", animations: "disabled" });
  await expectWithinViewport(page, '.dialog[aria-label="Surrender this battle?"]');
  await expect(confirmation(page)).toContainText("This ends the current battle and records a defeat. You won’t earn rewards.");
  await expect(confirmation(page)).toContainText("Use Save & leave if you want to continue this battle later.");
  for (const name of ["Cancel", "Confirm surrender"]) {
    const button = confirmation(page).getByRole("button", { name, exact: true });
    const rect = (await button.boundingBox())!;
    const viewport = page.viewportSize()!;
    expect(rect.width).toBeGreaterThanOrEqual(44);
    expect(rect.height).toBeGreaterThanOrEqual(44);
    expect(rect.x).toBeGreaterThanOrEqual(0);
    expect(rect.y).toBeGreaterThanOrEqual(0);
    expect(rect.x + rect.width).toBeLessThanOrEqual(viewport.width);
    expect(rect.y + rect.height).toBeLessThanOrEqual(viewport.height);
    const dialogRect = (await confirmation(page).boundingBox())!;
    expect(rect.y + rect.height).toBeLessThanOrEqual(dialogRect.y + dialogRect.height - 4);
    expect(await button.evaluate(node => {
      const box = node.getBoundingClientRect();
      return document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)?.closest("button") === node;
    })).toBe(true);
  }
  const before = await readBattle(page);
  expect(before.queue).toHaveLength(1);
  for (let attempt = 0; attempt < 2; attempt++) {
    await press(page, confirmation(page).getByRole("button", { name: "Cancel", exact: true }));
    await expect(confirmation(page)).toHaveCount(0);
    await expect(page.getByRole("dialog", { name: "Take a breath", exact: true })).toBeVisible();
    expect(await readBattle(page)).toEqual(before);
    await press(page, page.getByRole("button", { name: "Surrender battle", exact: true }));
  }
  await press(page, confirmation(page).getByRole("button", { name: "Close dialog", exact: true }));
  await expect(confirmation(page)).toHaveCount(0);
  expect(await readBattle(page)).toEqual(before);
  await openSurrender(page);

  test.info().annotations.push({ type: "controlled-fixture", description: "Browser blur/focus lifecycle injection only. Battle, queued Hold, cancellation, recovery and saving use native controls." });
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect(page.getByRole("dialog", { name: "Battle suspended", exact: true })).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await press(page, action(page, "resume-app"));
  await expect(confirmation(page)).toBeVisible();
  expect(await readBattle(page)).toEqual(before);
  await press(page, confirmation(page).getByRole("button", { name: "Cancel", exact: true }));
  await press(page, page.getByRole("button", { name: "Save & leave", exact: true }));
  await expect(action(page, "continue")).toBeVisible();
  await page.reload();
  await press(page, action(page, "continue"));
  await expect.poll(() => page.evaluate(() => window.__FRONTIER__.playing)).toBe(true);
  expect(await readBattle(page)).toEqual(before);
  await expect(defeat(page)).toHaveCount(0);
  await expect(confirmation(page)).toHaveCount(0);
});

test("native confirmed surrender is immediate, records one loss and Try again starts cleanly", async ({ page }) => {
  await skirmish(page);
  await pauseBattle(page);
  await press(page, action(page, "hold"));
  await openSurrender(page);
  const before = await readBattle(page);
  expect(before.queue).toHaveLength(1);
  await press(page, confirmation(page).getByRole("button", { name: "Confirm surrender", exact: true }));
  const result = await expectSavedDefeat(page, before);
  await press(page, page.getByRole("button", { name: "Try again", exact: true }));
  await expect(defeat(page)).toHaveCount(0);
  const retry = await readBattle(page);
  expect(retry.matchId).not.toBe(before.matchId);
  expect(retry.seed).toBe(before.seed);
  expect(retry.winner).toBeNull();
  expect(retry.reason).not.toBe("You surrendered.");
  expect(retry.defeated).toBe(false);
  expect(retry.queue).toEqual([]);
  expect(retry.surrenderCommands).toEqual([]);
  expect(retry.profile).toEqual(result.profile);
  await press(page, action(page, "pause-menu"));
  await press(page, action(page, "save-leave"));
  await expect(action(page, "continue")).toBeVisible();
  await page.reload();
  expect((await readBattle(page)).profile).toEqual(result.profile);
});

test("native campaign surrender keeps its chapter unfinished and grants no rewards", async ({ page }) => {
  await home(page);
  await press(page, action(page, "campaign"));
  await press(page, page.locator('[data-action="choose-campaign"][data-id="rise-of-the-frontier"]'));
  await expect(action(page, "mission").nth(1)).toBeDisabled();
  await press(page, action(page, "mission").first());
  await press(page, action(page, "begin-mission"));
  await openSurrender(page);
  await expect(confirmation(page)).toContainText("This attempt won’t complete the chapter or unlock rewards. You can try again from the result screen.");
  const before = await readBattle(page);
  await press(page, confirmation(page).getByRole("button", { name: "Confirm surrender", exact: true }));
  const result = await expectSavedDefeat(page, before);
  await expect(action(page, "next-mission")).toHaveCount(0);
  await press(page, page.getByRole("button", { name: "Try again", exact: true }));
  await expect(action(page, "begin-mission")).toBeVisible();
  const retry = await readBattle(page);
  expect(retry.matchId).not.toBe(before.matchId);
  expect(retry.campaign?.missionId).toBe("outpost");
  expect(retry.seed).toBe(before.seed);
  expect(retry.time).toBe(0);
  expect(retry.winner).toBeNull();
  await press(page, action(page, "begin-mission"));
  await press(page, action(page, "pause-menu"));
  await press(page, action(page, "save-leave"));
  await expect(action(page, "continue")).toBeVisible();
  await page.reload();
  expect((await readBattle(page)).profile).toEqual(result.profile);
  await press(page, action(page, "campaign"));
  await press(page, page.locator('[data-action="choose-campaign"][data-id="rise-of-the-frontier"]'));
  await expect(action(page, "mission").first()).toBeEnabled();
  await expect(action(page, "mission").nth(1)).toBeDisabled();
});

test("native expedition surrender warns that the run ends, preserves Cancel and records a defeated route", async ({ page }) => {
  await home(page);
  await press(page, action(page, "expedition"));
  await press(page, page.locator('[data-action="expedition-start"][data-id="balanced"]'));
  await press(page, page.locator('[data-action="expedition-node"][data-id="foothold"]'));
  await press(page, action(page, "begin-briefing"));
  await openSurrender(page);
  await expect(confirmation(page)).toContainText("This also ends your expedition run. Your journal and earlier rewards are kept, but you will need to start a new expedition.");
  if (test.info().project.name.startsWith("phone-"))
    await page.screenshot({path:test.info().outputPath(`surrender-expedition-${test.info().project.name}.png`), scale:"css", animations:"disabled"});
  const dialogRect = (await confirmation(page).boundingBox())!;
  for (const name of ["Cancel", "Confirm surrender"]) {
    const button = confirmation(page).getByRole("button", {name, exact:true});
    const rect = (await button.boundingBox())!;
    expect(rect.y + rect.height).toBeLessThanOrEqual(dialogRect.y + dialogRect.height - 4);
    expect(rect.height).toBeGreaterThanOrEqual(44);
  }

  const before = await readBattle(page);
  expect(before.expedition?.phase).toBe("battle");
  await press(page, confirmation(page).getByRole("button", { name: "Cancel", exact: true }));
  expect(await readBattle(page)).toEqual(before);
  await press(page, page.getByRole("button", { name: "Surrender battle", exact: true }));
  await press(page, confirmation(page).getByRole("button", { name: "Confirm surrender", exact: true }));
  const result = await expectSavedDefeat(page, before);
  expect(result.expedition).toEqual({
    ...before.expedition, phase: "defeated", activeNode: null, route: [],
    journal: [...before.expedition!.journal, { nodeId: "foothold", victory: false }],
  });
  await expect(page.getByRole("button", { name: "Try again", exact: true })).toHaveCount(0);
  await press(page, page.getByRole("button", { name: "View expedition result", exact: true }));
  await expect(action(page, "expedition-new")).toBeVisible();
  await expect(action(page, "expedition-node")).toHaveCount(0);
  await expect(action(page, "expedition-resume")).toHaveCount(0);
  await page.reload();
  await press(page, action(page, "expedition"));
  await expect(action(page, "expedition-new")).toBeVisible();
  const restored = await readBattle(page);
  expect(restored.expedition).toEqual(result.expedition);
  expect(restored.profile).toEqual(result.profile);
});

test("controlled profile failure recovers a native surrender after reload and commits the loss once", async ({ page }) => {
  test.info().annotations.push({ type: "controlled-fixture", description: "Only profile Storage.setItem is denied until explicitly restored. No winner, battle state, saved game or profile result is injected." });
  await page.addInitScript(() => {
    const fixture = window as Window & { __SURRENDER_BLOCK_PROFILE__?: boolean };
    fixture.__SURRENDER_BLOCK_PROFILE__ = true;
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (fixture.__SURRENDER_BLOCK_PROFILE__ && key === "frontier-command:rts-game:v1:profile")
        throw new DOMException("Controlled surrender profile fixture", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  await skirmish(page);
  await openSurrender(page);
  const before = await readBattle(page);
  await press(page, confirmation(page).getByRole("button", { name: "Confirm surrender", exact: true }));
  await expect(defeat(page)).toBeVisible();
  await expect(page.locator(".result-reason")).toHaveText("You surrendered.");
  await expect(page.locator("#result-save-status")).toContainText("finished battle is saved");
  await press(page, page.getByRole("button", { name: "Try again", exact: true }));
  await expect(defeat(page)).toBeVisible();
  expect((await readBattle(page)).matchId).toBe(before.matchId);
  expect((await readBattle(page)).profile).toEqual(before.profile);

  await page.reload();
  await press(page, action(page, "continue"));
  await expect(defeat(page)).toBeVisible();
  await expect(page.locator(".result-reason")).toHaveText("You surrendered.");
  await expect(page.locator("#result-save-status")).toContainText("finished battle is saved");
  for (let attempt = 0; attempt < 2; attempt++) {
    await press(page, action(page, "result-save"));
    await expect(page.locator("#result-save-status")).toContainText("finished battle is saved");
    expect((await readBattle(page)).profile).toEqual(before.profile);
  }
  await page.evaluate(() => {
    (window as Window & { __SURRENDER_BLOCK_PROFILE__?: boolean }).__SURRENDER_BLOCK_PROFILE__ = false;
  });
  await press(page, action(page, "result-save"));
  const result = await expectSavedDefeat(page, before);
  await expect(action(page, "result-save")).toBeHidden();
  await press(page, action(page, "result-home"));
  await expect(action(page, "continue")).toHaveCount(0);
  await page.reload();
  expect((await readBattle(page)).profile).toEqual(result.profile);
  await expect(action(page, "continue")).toHaveCount(0);
});

test("controlled delayed Save & leave cannot dismiss a newer surrender result during failure and recovery", async ({ page }) => {
  test.info().annotations.push({ type: "controlled-fixture", description: "One real IndexedDB open success is withheld, then released. Profile writes are denied until recovery. All menu, surrender and retry actions use native controls; no game result or profile is injected." });
  await skirmish(page);
  await press(page, action(page, "pause-menu"));
  await press(page, action(page, "save"));
  await expect(page.locator("#toast")).toContainText("Battle saved on this device.");
  await page.evaluate(() => {
    const fixture = window as Window & {
      __SURRENDER_RELEASE_OPEN__?: () => void;
      __SURRENDER_RESTORE_STORAGE__?: () => void;
      __SURRENDER_BLOCK_PROFILE__?: boolean;
    };
    const originalOpen = indexedDB.open.bind(indexedDB);
    const originalSet = Storage.prototype.setItem;
    let delayNextOpen = true;
    fixture.__SURRENDER_BLOCK_PROFILE__ = true;
    indexedDB.open = (name, version) => {
      const request = originalOpen(name, version);
      if (delayNextOpen) {
        delayNextOpen = false;
        // Intercept delivery, not the database operation: the original request
        // already has its genuine successful result when the app resumes it.
        request.addEventListener("success", event => {
          event.stopImmediatePropagation();
          fixture.__SURRENDER_RELEASE_OPEN__ = () => {
            delete fixture.__SURRENDER_RELEASE_OPEN__;
            request.dispatchEvent(new Event("success"));
          };
        }, { once: true });
      }
      return request;
    };
    Storage.prototype.setItem = function (key, value) {
      if (fixture.__SURRENDER_BLOCK_PROFILE__ && key === "frontier-command:rts-game:v1:profile")
        throw new DOMException("Controlled delayed surrender profile fixture", "QuotaExceededError");
      return originalSet.call(this, key, value);
    };
    fixture.__SURRENDER_RESTORE_STORAGE__ = () => {
      fixture.__SURRENDER_BLOCK_PROFILE__ = false;
      indexedDB.open = originalOpen;
      Storage.prototype.setItem = originalSet;
    };
  });
  await press(page, action(page, "save-leave"));
  await expect.poll(() => page.evaluate(() =>
    typeof (window as Window & { __SURRENDER_RELEASE_OPEN__?: () => void }).__SURRENDER_RELEASE_OPEN__,
  )).toBe("function");
  await press(page, page.getByRole("button", { name: "Surrender battle", exact: true }));
  const before = await readBattle(page);
  await press(page, confirmation(page).getByRole("button", { name: "Confirm surrender", exact: true }));
  await expect(defeat(page)).toBeVisible();
  await expect(page.locator("#result-save-status")).toHaveText("Saving your result…");
  await page.evaluate(() => {
    (window as Window & { __SURRENDER_RELEASE_OPEN__?: () => void }).__SURRENDER_RELEASE_OPEN__!();
  });
  await expect(page.locator("#result-save-status")).toContainText("finished battle is saved");
  await expect(defeat(page)).toBeVisible();
  await expect(action(page, "skirmish")).toHaveCount(0);
  expect((await readBattle(page)).matchId).toBe(before.matchId);
  expect((await readBattle(page)).profile).toEqual(before.profile);
  await page.evaluate(() => {
    (window as Window & { __SURRENDER_RESTORE_STORAGE__?: () => void }).__SURRENDER_RESTORE_STORAGE__!();
  });
  await press(page, action(page, "result-save"));
  const result = await expectSavedDefeat(page, before);
  await expect(defeat(page).getByRole("button", { name: "Close dialog", exact: true })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(defeat(page)).toBeVisible();
  await press(page, action(page, "result-home"));
  await expect(action(page, "skirmish")).toBeVisible();
  await expect(action(page, "continue")).toHaveCount(0);
  await page.reload();
  expect((await readBattle(page)).profile).toEqual(result.profile);
});
