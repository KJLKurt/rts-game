import { test, expect, action, home, tap, resume, pause } from "./helpers";
import type { Page } from "@playwright/test";
import stageThree from "../fixtures/practice-stage-three-storage.json" with { type: "json" };
import isolatedPair from "../fixtures/practice-two-houses-storage.json" with { type: "json" };
import { canBuild } from "../../src/sim";

async function expandGuide(page: Page) {
  const expand = page.getByRole("button", { name: "Expand guide", exact: true });
  if (await expand.count()) await expand.click();
}
async function lesson(page: Page, number: number) {
  await expect(page.locator("#battle-hint > span")).toContainText(`${number}/8`, { timeout: 45_000 });
}
async function focusPoint(page: Page, point: { x: number; y: number }) {
  const size = await page.evaluate(() => ({ width: window.__FRONTIER__.state.map.width, height: window.__FRONTIER__.state.map.height }));
  const rect = (await page.locator("#minimap").boundingBox())!;
  const mapPoint = { x: rect.x + rect.width * point.x / size.width, y: rect.y + rect.height * point.y / size.height };
  expect(await page.evaluate(p => document.elementFromPoint(p.x, p.y)?.id, mapPoint)).toBe("minimap");
  await tap(page, mapPoint);
  await expect.poll(() => page.evaluate(p => Math.hypot(window.__FRONTIER__.renderer.camera.x - p.x, window.__FRONTIER__.renderer.camera.y - p.y), point)).toBeLessThan(.1);
  const screen = await page.evaluate(p => window.__FRONTIER__.renderer.worldToScreen(p.x, p.y), point);
  expect(await page.evaluate(p => document.elementFromPoint(p.x, p.y)?.id, screen)).toBe("world");
  await tap(page, screen);
  const capture=action(page,"capture-resource");if(await capture.isVisible())await capture.click();
}
async function restoreOwnedSave(page: Page, storage: typeof isolatedPair) {
  // Replay a preserved, owned native-input save through the browser's storage
  // facility. Every gameplay action after Continue uses mouse/touch and controls.
  const url = new URL(test.info().project.use.baseURL!);
  const mapped = structuredClone(storage);
  for (const origin of mapped.origins) origin.origin = url.origin;
  await page.context().setStorageState(mapped);
  await home(page);
  await action(page, "continue").click();
  await expect.poll(() => page.evaluate(() => window.__FRONTIER__.playing)).toBe(true);
  expect(await page.evaluate(() => window.__FRONTIER__.profile.games)).toBe(1);
}
async function confirmAndFinishHouse(page: Page, nextLesson: number) {
  await action(page, "confirm-placement").click();
  await resume(page);
  if (nextLesson === 7) await lesson(page, 7);
  else await expect.poll(() => page.evaluate(() => window.__FRONTIER__.state.entities.filter(e => e.team === 0 && e.type === "house" && e.buildProgress >= 1).length), { timeout: 20_000 }).toBe(nextLesson);
  await pause(page);
}
async function finishAndReload(page: Page) {
  await expandGuide(page);
  await action(page, "learning-help").click();
  const house = await page.evaluate(() => { const e = window.__FRONTIER__.state.entities.find(e => e.team === 0 && e.type === "house" && e.hp > 0)!; return { x: e.x, y: e.y }; });
  await focusPoint(page, house);
  await action(page, "upgrade-building").click();
  await resume(page);
  await lesson(page, 8);
  await action(page, "select-army").click();
  await expandGuide(page);
  await action(page, "learning-help").click();
  const relic = await page.evaluate(() => { const s = window.__FRONTIER__.state, spawn = s.map.spawns[0]; const n = s.map.nodes.filter(n => n.kind === "relic").sort((a, b) => Math.hypot(a.x-spawn.x,a.y-spawn.y)-Math.hypot(b.x-spawn.x,b.y-spawn.y))[0]; return { x: n.x, y: n.y }; });
  await focusPoint(page, relic);
  await expect(page.getByRole("dialog", { name: "Your settlement is ready", exact: true })).toBeVisible({ timeout: 45_000 });
  await page.screenshot({ path: test.info().outputPath("practice-recovered-complete.png") });
  await page.getByRole("button", { name: "Keep practicing", exact: true }).click();
  await pause(page);
  await action(page, "pause-menu").click();
  const state = await page.evaluate(() => JSON.stringify(window.__FRONTIER__.state));
  await action(page, "save-leave").click();
  await expect(action(page, "continue")).toBeVisible();
  await page.reload();
  await action(page, "continue").click();
  await expect(page.getByRole("dialog", { name: "Your settlement is ready", exact: true })).toBeVisible();
  expect(await page.evaluate(() => JSON.stringify(window.__FRONTIER__.state))).toBe(state);
  expect(await page.evaluate(() => window.__FRONTIER__.profile.games)).toBe(1);
  const final = await page.evaluate(() => ({ time: window.__FRONTIER__.state.time, stats: window.__FRONTIER__.state.players[0].stats, houses: window.__FRONTIER__.state.entities.filter(e => e.team === 0 && e.type === "house").map(e => ({ id: e.id, x: e.x, y: e.y, level: e.buildingLevel })) }));
  expect(final.stats.unitsLost).toBe(0); expect(final.stats.commanderDeaths).toBe(0);
  await test.info().attach("owned-practice-recovery", { body: JSON.stringify({ fixtureReplay: true, gameplayInputOnly: true, completionReloadByteExact: true, ...final }), contentType: "application/json" });
  await page.screenshot({ path: test.info().outputPath("practice-recovered-reload.png") });
}

test("saved distant Houses explain one extra neighbor, preserve both Houses, complete and reload", async ({ page }) => {
  test.setTimeout(140_000);
  await restoreOwnedSave(page, isolatedPair);
  await lesson(page, 6);
  const before = await page.evaluate(() => ({ time: window.__FRONTIER__.state.time, houses: window.__FRONTIER__.state.entities.filter(e => e.type === "house").map(e => ({ id: e.id, x: e.x, y: e.y })) }));
  expect(before.time).toBe(94.7);
  expect(before.houses.map(e => [e.x,e.y])).toEqual([[2.5,16.5],[9,13.5]]);
  await expandGuide(page);
  await expect(page.locator("#battle-hint p")).toContainText("one more");
  await page.screenshot({ path: test.info().outputPath("saved-house-recovery-guidance.png") });
  await action(page, "learning-help").click();
  await expect(page.locator(".placement-toolbar small[role=status]")).toContainText("Valid location");
  const siteButton = action(page, "learning-house-site"), rect = (await siteButton.boundingBox())!;
  expect(rect.height).toBeGreaterThanOrEqual(44); expect(rect.width).toBeGreaterThanOrEqual(44);
  expect(await siteButton.evaluate(el => { const r=el.getBoundingClientRect(); return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest("button") === el; })).toBe(true);
  await confirmAndFinishHouse(page, 7);
  const after = await page.evaluate(() => window.__FRONTIER__.state.entities.filter(e => e.type === "house").map(e => ({ id: e.id, x: e.x, y: e.y })));
  expect(after).toHaveLength(3);
  expect(after.slice(0,2)).toEqual(before.houses);
  await finishAndReload(page);
});

test("native legal edge House warns before building and offers an explained new pair", async ({ page }) => {
  test.setTimeout(160_000);
  await restoreOwnedSave(page, stageThree);
  await lesson(page, 3);
  await expandGuide(page); await action(page, "learning-help").click();
  const wood = await page.evaluate(() => { const n=window.__FRONTIER__.state.map.nodes.find(n=>n.kind==="wood")!; return {x:n.x,y:n.y}; });
  await focusPoint(page, wood); await resume(page); await lesson(page, 4);
  await expandGuide(page); await action(page, "learning-help").click();
  const keep = await page.evaluate(() => { const e=window.__FRONTIER__.state.entities.find(e=>e.team===0&&e.type==="keep")!; return {x:e.x,y:e.y}; });
  await focusPoint(page, keep); await lesson(page, 5);
  await action(page, "panel-army").click();
  await page.getByRole("button", { name: "Queue 3 at a time", exact: true }).click();
  await page.getByRole("button", { name: "Recruit Swordsman", exact: true }).click();
  await lesson(page, 6); await pause(page);
  await action(page, "panel-build").click(); await page.getByRole("button", { name: "Build House", exact: true }).click();
  const state = await page.evaluate(() => window.__FRONTIER__.state);
  expect(canBuild(state, 0, "house", 2.5, 16.5).ok).toBe(true);
  await focusPoint(page, {x:2.5,y:16.5});
  await expect(page.locator(".placement-toolbar small[role=status]")).toContainText("no room for a neighbor");
  await expect(action(page, "confirm-placement")).toBeEnabled(); // Valid manual sites remain valid.
  await page.screenshot({ path: test.info().outputPath("exact-edge-house-warning.png") });
  await confirmAndFinishHouse(page, 1); await lesson(page, 6);
  await expandGuide(page); await expect(page.locator("#battle-hint p")).toContainText("two more Houses");
  await action(page, "learning-help").click();
  await expect(page.locator(".placement-toolbar small[role=status]")).toContainText("Valid location");
  await confirmAndFinishHouse(page, 2); await lesson(page, 6);
  await action(page, "panel-build").click(); await page.getByRole("button", { name: "Build House", exact: true }).click();
  await confirmAndFinishHouse(page, 7);
  expect(await page.evaluate(() => window.__FRONTIER__.state.entities.filter(e=>e.team===0&&e.type==="house").map(e=>[e.x,e.y]))).toContainEqual([2.5,16.5]);
  await finishAndReload(page);
});
