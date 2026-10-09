import type { Page } from "@playwright/test";
import { getCommander, isWalkable, issueCommand, restoreGame, serializeGame, stepGame, type Point } from "../../src/sim";
import { action, expect, home, tap, test } from "./helpers";
import { pressLearningControl } from "./learning-guidance-support";

async function movementPoint(page: Page, origin: Point, short: boolean) {
  // Read-only geometry plus canonical simulation checks choose a reachable
  // test destination. Gameplay is performed only by the native canvas tap.
  const fixture = await page.evaluate(({ origin, short }) => {
    const { state, renderer } = window.__FRONTIER__;
    const hero = state.entities.find(e => e.team === 0 && e.kind === "commander")!;
    const targets = short ? [{ x: origin.x + 1, y: origin.y - 1.7 }] : [];
    for (const radius of short ? [1.85, 1.6] : [4, 5, 6]) {
      for (let i = 0; i < 32; i++) targets.push({ x: origin.x + Math.cos(i * Math.PI / 16) * radius, y: origin.y + Math.sin(i * Math.PI / 16) * radius });
    }
    const margin = navigator.maxTouchPoints ? 20 : 2;
    const candidates = targets.map(world => ({ world, screen: renderer.worldToScreen(world.x, world.y) }))
      .filter(({ screen: p }) => [-margin, 0, margin].every(dx => [-margin, 0, margin].every(dy => document.elementFromPoint(p.x + dx, p.y + dy)?.id === "world")));
    return { state, hero: hero.id, candidates };
  }, { origin, short });
  for (const candidate of fixture.candidates) {
    if (!isWalkable(fixture.state.map, candidate.world.x, candidate.world.y)) continue;
    const probe = restoreGame(serializeGame(fixture.state));
    if (!issueCommand(probe, { type: "move", team: 0, entityIds: [fixture.hero], ...candidate.world }).ok) continue;
    let maxDistance = 0;
    for (let tick = 0; tick < 80; tick++) {
      stepGame(probe, .1);
      const hero = getCommander(probe)!;
      maxDistance = Math.max(maxDistance, Math.hypot(hero.x - origin.x, hero.y - origin.y));
    }
    const hero = getCommander(probe)!;
    const distance = Math.hypot(hero.x - origin.x, hero.y - origin.y);
    if (hero.order.type === "idle" && (short ? distance > .5 && maxDistance <= 2 : distance > 2.5))
      return { ...candidate, expectedDistance: distance, maxDistance };
  }
  throw Error(`No reachable uncovered ${short ? "short" : "qualifying"} native-movement destination.`);
}

test("first lesson explains a native short walk and advances only after a farther deliberate move", async ({ page }) => {
  await home(page);
  await pressLearningControl(page, action(page, "learn"));
  await pressLearningControl(page, page.getByRole("button", { name: "Start learning", exact: true }));
  await expect(page.locator("#battle-hint p")).toContainText("at least 3 tiles from your starting spot");
  const origin = await page.evaluate(() => {
    const c = window.__FRONTIER__.state.entities.find(e => e.team === 0 && e.kind === "commander")!;
    return { x: c.x, y: c.y };
  });
  await pressLearningControl(page, action(page, "learning-help"));
  await pressLearningControl(page, action(page, "order-move"));
  const short = await movementPoint(page, origin, true);
  await tap(page, short.screen);
  await expect.poll(() => page.evaluate(origin => {
    const hero = window.__FRONTIER__.state.entities.find(e => e.team === 0 && e.kind === "commander")!;
    return hero.order.type === "idle" && Math.hypot(hero.x - origin.x, hero.y - origin.y) > .5;
  }, origin)).toBe(true);
  await expect(page.locator("#battle-hint > b")).toHaveText("Move farther to continue");
  await expect(page.locator("#battle-hint p")).toHaveCount(0); // Feedback also survives the normal collapsed guide.
  await page.screenshot({ path: test.info().outputPath("native-short-walk-collapsed-feedback.png") });
  await pressLearningControl(page, page.getByRole("button", { name: "Expand guide", exact: true }));
  await expect(page.locator("#battle-hint > span")).toHaveText("LEARN TO COMMAND · 1/8");
  await expect(page.locator("#battle-hint p")).toContainText("That move was too short.");
  await expect(page.locator("#battle-hint p")).toContainText("at least 3 tiles from your starting spot");
  const stopped = await page.evaluate(() => {
    const c = window.__FRONTIER__.state.entities.find(e => e.team === 0 && e.kind === "commander")!;
    return { x: c.x, y: c.y };
  });
  expect(Math.hypot(stopped.x - origin.x, stopped.y - origin.y)).toBeLessThanOrEqual(2);
  await page.screenshot({ path: test.info().outputPath("native-short-walk-feedback.png") });
  await pressLearningControl(page, page.getByRole("button", { name: "Minimize guide", exact: true }));
  await pressLearningControl(page, action(page, "order-move"));
  const farther = await movementPoint(page, origin, false);
  await tap(page, farther.screen);
  await expect(page.locator("#battle-hint > span")).toHaveText("LEARN TO COMMAND · 2/8");
  expect(await page.evaluate(origin => {
    const c = window.__FRONTIER__.state.entities.find(e => e.team === 0 && e.kind === "commander")!;
    return Math.hypot(c.x - origin.x, c.y - origin.y);
  }, origin)).toBeGreaterThan(2);
  await test.info().attach("native-short-then-qualifying-move", { body: JSON.stringify({ origin, short, stopped, farther, nativeInputOnly: true }), contentType: "application/json" });
});
