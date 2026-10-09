import type { BrowserContext, Locator, Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { test, expect, action, home, clearGround, tap } from "./helpers";

// These cases run only in Playwright's fresh, isolated contexts. All interactions
// use native mouse/touch or keyboard input. __FRONTIER__ is read-only here: no
// debug commands, pause-counter edits, forced clicks, or synthetic victories.
type Theme = "christmas" | "mythic";
const checkpoint: Awaited<ReturnType<BrowserContext["storageState"]>> = JSON.parse(
  readFileSync(new URL("./fixtures/native-earned-seven-games-checkpoint.json", import.meta.url), "utf8"),
);
const pauseControl = (page: Page) => action(page, "pause");

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

async function skirmish(page: Page, difficulty: "normal" | "hard" | "brutal") {
  await press(page, action(page, "skirmish"));
  await page.getByLabel("Map seed", { exact: true }).fill("QA-NATIVE-PAUSE-BUDGET");
  await page.locator('select[name="mapSize"]').selectOption("small");
  await page.locator('select[name="difficulty"]').selectOption(difficulty);
  await press(page, action(page, "launch"));
  await expect.poll(() => page.evaluate(() => window.__FRONTIER__.playing)).toBe(true);
  const briefing = page.getByRole("button", { name: "Start battle", exact: true });
  if (await briefing.count()) await press(page, briefing);
  if (await action(page, "dismiss-tips").isVisible()) await press(page, action(page, "dismiss-tips"));
  await expect.poll(() => page.evaluate(() => window.__FRONTIER__.state.paused)).toBe(false);
  expect((await readPause(page)).pauses).toBe(0);
}

async function readPause(page: Page) {
  return page.evaluate(() => {
    const f = window.__FRONTIER__ as typeof window.__FRONTIER__ & { readonly matchId: string };
    const s = f.state;
    return {
      matchId: f.matchId, difficulty: s.settings.difficulty, seed: s.settings.seed,
      paused: s.paused, pauses: s.players[0].stats.pauses, time: s.time, tick: s.tick,
      pendingCommands: s.pendingCommands,
    };
  });
}

async function expectPause(page: Page, paused: boolean, pauses: number) {
  await expect.poll(async () => {
    const state = await readPause(page);
    return { paused: state.paused, pauses: state.pauses };
  }).toEqual({ paused, pauses });
}

async function expectHUD(
  page: Page,
  label: string,
  budget: string,
  state: "available" | "paused" | "exhausted" | "disabled",
) {
  const control = pauseControl(page);
  await expect(control).toBeVisible();
  await expect(control).toHaveAttribute("data-pause-state", state);
  await expect(control.locator(".pause-label")).toHaveText(label);
  await expect(control.locator(".pause-budget")).toHaveText(budget);
  if (state === "exhausted" || state === "disabled") await expect(control).toBeDisabled();
  else await expect(control).toBeEnabled();
  const rect = (await control.boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(rect.width).toBeGreaterThanOrEqual(44);
  expect(rect.height).toBeGreaterThanOrEqual(44);
  expect(rect.x).toBeGreaterThanOrEqual(0);
  expect(rect.y).toBeGreaterThanOrEqual(0);
  expect(rect.x + rect.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(rect.y + rect.height).toBeLessThanOrEqual(viewport.height + 1);
  for (const selector of [".pause-label", ".pause-budget"]) {
    const text = control.locator(selector);
    await expect(text).toBeVisible();
    const box = (await text.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(rect.x - 1);
    expect(box.y).toBeGreaterThanOrEqual(rect.y - 1);
    expect(box.x + box.width).toBeLessThanOrEqual(rect.x + rect.width + 1);
    expect(box.y + box.height).toBeLessThanOrEqual(rect.y + rect.height + 1);
    expect(await text.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
  }
  const resources = (await page.locator(".hud .resources").boundingBox())!;
  const overlaps = Math.min(rect.x + rect.width, resources.x + resources.width) > Math.max(rect.x, resources.x)
    && Math.min(rect.y + rect.height, resources.y + resources.height) > Math.max(rect.y, resources.y);
  expect(overlaps, "Pause disclosure must not cover the resource controls").toBe(false);
}

async function phoneScreenshot(page: Page, theme: Theme, name: string, hudOnly = true) {
  if (!test.info().project.name.startsWith("phone-")) return;
  const viewport = page.viewportSize()!;
  await page.screenshot({
    path: test.info().outputPath(`pause-budget-${theme}-${name}-${test.info().project.name}.png`),
    scale: "css", animations: "disabled",
    ...(hudOnly ? { clip: { x: 0, y: 0, width: viewport.width, height: Math.min(220, viewport.height) } } : {}),
  });
}

async function saveLeaveReload(page: Page) {
  const before = await readPause(page);
  const profile = await page.evaluate(() => window.__FRONTIER__.profile);
  await press(page, action(page, "pause-menu"));
  await press(page, page.getByRole("button", { name: "Save & leave", exact: true }));
  await expect(action(page, "continue")).toBeVisible();
  await page.reload();
  await press(page, action(page, "continue"));
  await expect.poll(() => page.evaluate(() => window.__FRONTIER__.playing)).toBe(true);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await readPause(page)).toEqual(before);
  expect(await page.evaluate(() => window.__FRONTIER__.profile)).toEqual(profile);
}

async function expectRejectedPause(page: Page, used: number, error: string) {
  const control = pauseControl(page);
  await expect(control).toBeDisabled();
  const rect = (await control.boundingBox())!;
  const point = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  expect(await control.evaluate((node, point) =>
    document.elementFromPoint(point.x, point.y)?.closest("button") === node, point,
  )).toBe(true);
  const before = await readPause(page);
  // A real hit on the disabled control documents native rejection without force.
  await tap(page, point);
  await expectPause(page, false, used);
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // Native ground input releases button focus, so Space exercises the global
  // shortcut rather than activating a focused button. Touch projects use the
  // same supported hardware-keyboard path in addition to native touch above.
  await tap(page, await clearGround(page));
  expect(await page.evaluate(() => !!document.activeElement?.closest("button"))).toBe(false);
  await page.keyboard.press("Space");
  await expect(page.locator("#toast")).toHaveText(error);
  await expect(page.locator("#toast")).toHaveClass(/show/);
  await expectPause(page, false, used);
  await expect.poll(() => page.evaluate(() => window.__FRONTIER__.state.time)).toBeGreaterThan(before.time);
}

async function returnThroughMenu(page: Page, used: number) {
  await press(page, action(page, "pause-menu"));
  await expect(page.getByRole("dialog", { name: "Take a breath", exact: true })).toBeVisible();
  expect((await readPause(page)).pauses).toBe(used);
  await press(page, page.getByRole("button", { name: "Return to battle", exact: true }));
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expectPause(page, false, used);
}

for (const theme of ["christmas", "mythic"] as const) {
  test.describe(`pause budget · ${theme}`, () => {
    test("native Normal remains unlimited through a fourth pause and menu Resume", async ({ page }) => {
      await chooseTheme(page, theme);
      await skirmish(page, "normal");
      await expectHUD(page, "Pause", "Unlimited", "available");
      await expect(pauseControl(page)).toHaveAttribute("aria-label", /unlimited/i);
      for (let used = 1; used <= 4; used++) {
        await press(page, pauseControl(page));
        await expectPause(page, true, used);
        await expectHUD(page, "Resume", "Unlimited", "paused");
        if (used === 4) await returnThroughMenu(page, used);
        else await press(page, pauseControl(page));
        await expectPause(page, false, used);
        await expectHUD(page, "Pause", "Unlimited", "available");
      }
    });

    test("native Hard counts down, restores its third pause and rejects a fourth", async ({ page }) => {
      await chooseTheme(page, theme);
      await skirmish(page, "hard");
      await expectHUD(page, "Pause", "3/3 left", "available");
      for (let used = 1; used <= 3; used++) {
        await press(page, pauseControl(page));
        await expectPause(page, true, used);
        await expectHUD(page, "Resume", `${3 - used}/3 left`, "paused");
        await expect(pauseControl(page)).toHaveAttribute("aria-label", /resume/i);
        if (used < 3) {
          await press(page, pauseControl(page));
          await expectPause(page, false, used);
          await expectHUD(page, "Pause", `${3 - used}/3 left`, "available");
          if (used === 1) await phoneScreenshot(page, theme, "remaining");
        }
      }
      await press(page, action(page, "select-commander"));
      await press(page, action(page, "hold"));
      expect((await readPause(page)).pendingCommands).toEqual([
        expect.objectContaining({ type: "hold", team: 0 }),
      ]);
      await phoneScreenshot(page, theme, "third-paused");
      const thirdPause = await readPause(page);
      await saveLeaveReload(page);
      expect(await readPause(page)).toEqual(thirdPause);
      await expectHUD(page, "Resume", "0/3 left", "paused");
      await press(page, pauseControl(page));
      await expectPause(page, false, 3);
      expect((await readPause(page)).pendingCommands).toEqual([]);
      await expectHUD(page, "No pauses", "0/3 left", "exhausted");
      await expect(pauseControl(page)).toHaveAttribute("aria-label", /all three|no tactical pauses|no pauses/i);
      await expect(pauseControl(page)).toHaveAttribute("title", /used|remaining/i);
      await phoneScreenshot(page, theme, "exhausted");
      await expectRejectedPause(page, 3, "All three tactical pauses have been used.");
      await returnThroughMenu(page, 3);
      await expectHUD(page, "No pauses", "0/3 left", "exhausted");
    });

    test("native Brutal shows its disabled reason and rejects touch or mouse plus Space", async ({ page }) => {
      await chooseTheme(page, theme);
      await skirmish(page, "brutal");
      await expectHUD(page, "Pause off", "Brutal", "disabled");
      await expect(pauseControl(page)).toHaveAttribute("aria-label", /disabled.*Brutal/i);
      await expect(pauseControl(page)).toHaveAttribute("title", /disabled.*Brutal/i);
      await expectRejectedPause(page, 0, "Tactical pause is disabled on Brutal.");
      await returnThroughMenu(page, 0);
      await expectHUD(page, "Pause off", "Brutal", "disabled");
    });

    test.describe("controlled earned-profile campaign fixture", () => {
      // Reuse the repository's untouched, previously earned checkpoint. Only
      // its origin is remapped for this isolated browser; no campaign outcome
      // is fabricated and this case makes no new earned-progression claim.
      test.use({ storageState: async ({ baseURL }, use) => {
        const origin = new URL(baseURL!).origin;
        await use({ ...checkpoint, origins: checkpoint.origins.map(saved => ({ ...saved, origin })) });
      } });

      test("native chapter cards and briefings disclose Easy, Normal and Ironwatch Hard before launch", async ({ page }) => {
        test.info().annotations.push({
          type: "controlled-fixture",
          description: "Unedited native-earned-seven-games checkpoint, remapped to this fresh context's origin; native campaign navigation only.",
        });
        await chooseTheme(page, theme);
        const profile = await page.evaluate(() => window.__FRONTIER__.profile);
        expect(profile).toMatchObject({ games: 7, wins: 3 });
        const chapters = [
          { index: 0, title: "The Outpost", difficulty: "easy", rules: /Easy difficulty · Unlimited tactical pauses\.?$/ },
          { index: 1, title: "Hold the Line", difficulty: "normal", rules: /Normal difficulty · Unlimited tactical pauses\.?$/ },
          { index: 3, title: "Siege of Ironwatch", difficulty: "hard", rules: /Hard difficulty · 3 tactical pauses per battle\.?$/ },
        ];
        for (const chapter of chapters) {
          await press(page, action(page, "campaign"));
          await press(page, page.locator('[data-action="choose-campaign"][data-id="rise-of-the-frontier"]'));
          for (const expected of chapters) {
            const card = page.locator(`[data-action="mission"][data-id="${expected.index}"]`);
            await expect(card).toBeEnabled();
            await expect(card.locator(".mission-rules")).toHaveText(expected.rules);
          }
          const card = page.locator(`[data-action="mission"][data-id="${chapter.index}"]`);
          await card.locator(".mission-rules").scrollIntoViewIfNeeded();
          await expect(card.locator(".mission-rules")).toBeVisible();
          expect(await page.evaluate(() => window.__FRONTIER__.playing)).toBe(false);
          await press(page, card);
          const briefing = page.getByRole("dialog", { name: chapter.title, exact: true });
          await expect(briefing).toBeVisible();
          const rules = briefing.locator(".mission-rules");
          await rules.scrollIntoViewIfNeeded();
          await expect(rules).toHaveText(chapter.rules);
          await expect(rules).toBeVisible();
          const rect = (await rules.boundingBox())!;
          const viewport = page.viewportSize()!;
          expect(rect.x).toBeGreaterThanOrEqual(0);
          expect(rect.x + rect.width).toBeLessThanOrEqual(viewport.width + 1);
          expect(rect.y).toBeGreaterThanOrEqual(0);
          expect(rect.y + rect.height).toBeLessThanOrEqual(viewport.height + 1);
          const before = await readPause(page);
          expect(before).toMatchObject({ difficulty: chapter.difficulty, pauses: 0, time: 0, tick: 0 });
          if (chapter.difficulty === "hard") await phoneScreenshot(page, theme, "ironwatch-briefing", false);
          await press(page, action(page, "begin-mission"));
          await expect(briefing).toHaveCount(0);
          await expectPause(page, false, 0);
          await expectHUD(page, "Pause", chapter.difficulty === "hard" ? "3/3 left" : "Unlimited", "available");
          await press(page, action(page, "pause-menu"));
          expect((await readPause(page)).pauses).toBe(0);
          await press(page, page.getByRole("button", { name: "Save & leave", exact: true }));
          await expect(action(page, "campaign")).toBeVisible();
          expect(await page.evaluate(() => window.__FRONTIER__.profile)).toEqual(profile);
        }
      });
    });
  });
}
