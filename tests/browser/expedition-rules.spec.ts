import type { Locator, Page } from "@playwright/test";
import {
  createExpedition,
  finishExpeditionBattle,
  visitExpeditionNode,
  type ExpeditionRun,
} from "../../src/ui/campaigns/expedition";
import { expeditionCheckpoint } from "../../src/ui/campaigns/session";
import { action, expect, home, test } from "./helpers";

type Theme = "christmas" | "mythic";
const easyRule = "Easy difficulty · Unlimited tactical pauses";
const normalRule = "Normal difficulty · Unlimited tactical pauses";
const hardRule = "Hard difficulty · 3 tactical pauses per battle";
const nodeButton = (page: Page, id: string) =>
  page.locator(`[data-action="expedition-node"][data-id="${id}"]`);
const nodeCard = (page: Page, id: string) =>
  page.locator(".route-choice").filter({ has: nodeButton(page, id) });

async function press(page: Page, target: Locator) {
  await target.scrollIntoViewIfNeeded();
  if (await page.evaluate(() => navigator.maxTouchPoints > 0)) await target.tap();
  else await target.click();
}

async function chooseTheme(page: Page, theme: Theme) {
  await home(page);
  await press(page, action(page, "settings"));
  await page.getByLabel("Visual theme", { exact: true }).selectOption(theme);
  await expect.poll(() => page.evaluate(() =>
    (window.__FRONTIER__.renderer as typeof window.__FRONTIER__.renderer & { visualTheme: string }).visualTheme,
  )).toBe(theme);
  await press(page, page.getByRole("button", { name: "Done", exact: true }));
}

const readRoute = (page: Page) => page.evaluate(() =>
  (window.__FRONTIER__ as typeof window.__FRONTIER__ & { readonly expedition: ExpeditionRun | null }).expedition,
);

async function visibleRule(page: Page, rules: Locator, expected: string) {
  await rules.scrollIntoViewIfNeeded();
  await expect(rules).toHaveText(expected);
  await expect(rules).toBeVisible();
  const rect = (await rules.boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(rect.x).toBeGreaterThanOrEqual(0);
  expect(rect.x + rect.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(rect.y).toBeGreaterThanOrEqual(0);
  expect(rect.y + rect.height).toBeLessThanOrEqual(viewport.height + 1);
}

async function saveRouteReload(page: Page) {
  const before = await readRoute(page);
  await press(page, action(page, "expedition-save"));
  await expect(page.locator("#toast")).toHaveText("Expedition route saved on this device.");
  await page.reload();
  await press(page, action(page, "expedition"));
  await expect.poll(() => readRoute(page)).toEqual(before);
  return before!;
}

async function beginAndLeave(page: Page) {
  await press(page, action(page, "begin-briefing"));
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await press(page, action(page, "pause-menu"));
  await press(page, page.getByRole("button", { name: "Save & leave", exact: true }));
  await expect(action(page, "expedition")).toBeVisible();
}

async function checkBriefing(page: Page, title: string, rule: string, difficulty: string) {
  const briefing = page.getByRole("dialog", { name: title, exact: true });
  await expect(briefing).toBeVisible();
  await visibleRule(page, briefing.locator(".expedition-rules"), rule);
  expect(await page.evaluate(() => ({
    difficulty: window.__FRONTIER__.state.settings.difficulty,
    time: window.__FRONTIER__.state.time,
    pauses: window.__FRONTIER__.state.players[0].stats.pauses,
  }))).toEqual({ difficulty, time: 0, pauses: 0 });
}

// This checkpoint is a controlled presentation fixture in Playwright's isolated
// context. It does not claim an earned victory or change the ordinary browser.
// All choices, preparation, saves and resumes after installation use native UI.
async function installRouteFixture(page: Page, run: ExpeditionRun) {
  await page.evaluate(async (checkpoint) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("frontier-command-rts-game", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("records");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("records", "readwrite");
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
        const records = tx.objectStore("records");
        records.put({ __frontierRecord: 1, writtenAt: Date.now(), value: checkpoint }, "expedition");
        records.delete("battle");
      });
      for (const key of ["battle", "expedition"])
        localStorage.removeItem(`frontier-command:rts-game:v1:${key}`);
    } finally {
      db.close();
    }
  }, expeditionCheckpoint(run, null));
  await page.reload();
  await press(page, action(page, "expedition"));
  await expect.poll(() => readRoute(page)).toEqual(run);
}

for (const theme of ["mythic", "christmas"] as const) {
  test.describe(`expedition rules · ${theme}`, () => {
    test("native opening card, briefing and restored Continue disclose Easy", async ({ page }) => {
      await chooseTheme(page, theme);
      const profile = await page.evaluate(() => window.__FRONTIER__.profile);
      await press(page, action(page, "expedition"));
      await press(page, page.locator('[data-action="expedition-start"][data-id="balanced"]'));
      await visibleRule(page, nodeCard(page, "foothold").locator(".expedition-rules"), easyRule);
      const route = await saveRouteReload(page);
      await visibleRule(page, nodeCard(page, "foothold").locator(".expedition-rules"), easyRule);
      expect(await readRoute(page)).toEqual(route);
      await press(page, nodeButton(page, "foothold"));
      await checkBriefing(page, "The Old Crossing", easyRule, "easy");
      const active = await readRoute(page);
      await beginAndLeave(page);
      await page.reload();
      await press(page, action(page, "expedition"));
      await visibleRule(page, page.locator(".expedition-rules"), easyRule);
      await expect(action(page, "expedition-resume")).toBeVisible();
      expect(await readRoute(page)).toEqual(active);
      expect(await page.evaluate(() => window.__FRONTIER__.profile)).toEqual(profile);
      await press(page, action(page, "expedition-resume"));
      await expect.poll(() => page.evaluate(() => window.__FRONTIER__.playing)).toBe(true);
      expect(await page.evaluate(() => window.__FRONTIER__.state.settings.difficulty)).toBe("easy");
    });

    test("controlled later route keeps nonbattle stops clear and discloses Normal and Hard before launch", async ({ page }) => {
      test.info().annotations.push({
        type: "controlled-fixture",
        description: "Isolated route checkpoint after the opening; no earned-victory claim. Native choices, cards, briefings and save/reload. The same route is restored between alternative battle selections.",
      });
      await chooseTheme(page, theme);
      const profile = await page.evaluate(() => window.__FRONTIER__.profile);
      const afterOpening = finishExpeditionBattle(
        visitExpeditionNode(createExpedition("QA-EXPEDITION-RULES"), "foothold"), true,
      );
      await installRouteFixture(page, afterOpening);
      for (const id of ["haven", "caravan", "crossroads"]) {
        await expect(nodeCard(page, id).locator(".expedition-rules")).toHaveCount(0);
        await expect(nodeCard(page, id)).not.toContainText(/difficulty|tactical pauses/i);
      }
      await press(page, nodeButton(page, "haven"));
      await expect(page.locator(".expedition-rules")).toHaveCount(0);
      await press(page, page.locator('[data-action="expedition-choice"][data-id="timber"]'));
      await expect(nodeButton(page, "woodland")).toBeVisible();
      const route = await saveRouteReload(page);
      const encounters = [
        { id: "woodland", title: "Whisperwood Pass", difficulty: "normal", rule: normalRule },
        { id: "redoubt", title: "Sunscar Redoubt", difficulty: "hard", rule: hardRule },
      ];
      for (const [index, encounter] of encounters.entries()) {
        if (index) await installRouteFixture(page, route);
        for (const option of encounters)
          await visibleRule(page, nodeCard(page, option.id).locator(".expedition-rules"), option.rule);
        expect(await readRoute(page)).toEqual(route);
        await press(page, nodeButton(page, encounter.id));
        await checkBriefing(page, encounter.title, encounter.rule, encounter.difficulty);
        if (encounter.difficulty === "hard") {
          await page.screenshot({
            path: test.info().outputPath(`expedition-rules-${theme}-${test.info().project.name}.png`),
            scale: "css", animations: "disabled",
          });
        }
        await beginAndLeave(page);
        expect(await page.evaluate(() => window.__FRONTIER__.profile)).toEqual(profile);
      }
    });
  });
}
