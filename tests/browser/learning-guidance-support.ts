import type { Locator, Page } from "@playwright/test";
import { action, expect, tap, test } from "./helpers";

/** Native input only: first prove the requested control owns its center. */
export async function pressLearningControl(page: Page, control: Locator) {
  await control.scrollIntoViewIfNeeded();
  await expect.poll(() => control.evaluate(node => {
    const r = node.getBoundingClientRect();
    return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest("button") === node;
  })).toBe(true);
  const r = (await control.boundingBox())!;
  expect(r.width).toBeGreaterThanOrEqual(44);
  expect(r.height).toBeGreaterThanOrEqual(44);
  await tap(page, { x: r.x + r.width / 2, y: r.y + r.height / 2 });
}

async function expandGuide(page: Page) {
  const expand = page.getByRole("button", { name: "Expand guide", exact: true });
  if (await expand.count()) await pressLearningControl(page, expand);
}

async function textSize(page: Page, scale: string) {
  await pressLearningControl(page, action(page, "pause-menu"));
  await pressLearningControl(page, action(page, "settings"));
  await page.getByLabel("Interface text size", { exact: true }).selectOption(scale);
  await pressLearningControl(page, page.getByRole("dialog", { name: "Settings", exact: true }).getByRole("button", { name: "Done", exact: true }));
}

export async function learningClearanceGeometry(page: Page) {
  return page.evaluate(() => {
    const guide = document.querySelector<HTMLElement>("#battle-hint")!;
    const strip = document.querySelector<HTMLElement>(".commander-strip")!;
    const rect = (node: Element) => {
      const r = node.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height, left: r.left, right: r.right, top: r.top, bottom: r.bottom };
    };
    const g = rect(guide), c = rect(strip), deck = rect(document.querySelector(".command-deck")!), style = getComputedStyle(strip);
    const overlap = !!g.width && !!g.height && !!c.width && !!c.height &&
      g.left < c.right && g.right > c.left && g.top < c.bottom && g.bottom > c.top;
    const button = guide.querySelector<HTMLElement>('[data-action="learning-help"]');
    const b = button?.getBoundingClientRect();
    return {
      guide: g, strip: c, overlap, suppressed: strip.classList.contains("learning-guide-overlap"),
      visibility: style.visibility, display: style.display,
      guideActionHit: b ? document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2)?.closest("button") === button : null,
      deck,
      guideDeckOverlapArea: Math.max(0, Math.min(g.right, deck.right) - Math.max(g.left, deck.left)) *
        Math.max(0, Math.min(g.bottom, deck.bottom) - Math.max(g.top, deck.top)),
      guideScroll: { clientHeight: guide.clientHeight, scrollHeight: guide.scrollHeight },
      collapsed: document.querySelector(".command-deck")!.classList.contains("collapsed"),
      viewport: { width: innerWidth, height: innerHeight },
    };
  });
}

/** Called while actual paid training/upgrade queues are paused. No injected
 * game, queue, layout, camera, progress or outcome; settings and resize are real. */
export async function verifyLearningQueueClearance(page: Page, label: string, resize = false) {
  expect(await page.evaluate(() => window.__FRONTIER__.state.paused)).toBe(true);
  const snapshot = await page.evaluate(() => JSON.stringify(window.__FRONTIER__.state));
  expect(await page.evaluate(() => window.__FRONTIER__.state.entities.some(e => e.team === 0 && e.queue.some(q => !!q.paidCost)))).toBe(true);
  const original = page.viewportSize()!;
  const originalCollapsed = await page.locator(".command-deck").evaluate(node => node.classList.contains("collapsed"));
  const sizes = [original];
  if (resize && test.info().project.name === "desktop") sizes.push(
    { width: 1184, height: 760 }, { width: 1184, height: 900 },
    { width: 600, height: 760 }, { width: 601, height: 760 },
    { width: 1184, height: 500 }, { width: 1184, height: 501 },
  );
  const proofs = [];
  for (const scale of ["1", "1.3"]) {
    await page.setViewportSize(original);
    await textSize(page, scale);
    for (const size of sizes) {
      await page.setViewportSize(size);
      for (const collapsed of [false, true]) {
        if (await page.locator(".command-deck").evaluate(node => node.classList.contains("collapsed")) !== collapsed)
          await pressLearningControl(page, action(page, "toggle-deck"));
        await expandGuide(page);
        await action(page, "learning-help").scrollIntoViewIfNeeded();
        if (size.width === 1184 && [500, 501].includes(size.height)) {
          const boundary = await learningClearanceGeometry(page);
          const name = `${label}-${scale}-${size.width}x${size.height}-${collapsed ? "collapsed" : "expanded"}-before-cta`;
          // Retain boundary evidence even if the following center-hit assertion
          // fails. A green CTA never certifies the rest of an intersecting guide.
          await test.info().attach(`${name}-geometry`, { body: JSON.stringify({ ...boundary,
            wholeGuideReadability: boundary.guideDeckOverlapArea > 0 ? "pending obstruction review" : "no deck intersection; full readability not asserted",
          }, null, 2), contentType: "application/json" });
          await page.screenshot({ path: test.info().outputPath(`${name}.png`) });
          if (boundary.guideDeckOverlapArea > 0) test.info().annotations.push({
            type: "whole-guide-review-pending",
            description: `${name}: guide/deck intersection ${boundary.guideDeckOverlapArea}px²; review screenshot before accepting whole-guide readability.`,
          });
        }
        await expect.poll(async () => {
          const p = await learningClearanceGeometry(page);
          return p.suppressed === p.overlap && (!p.overlap || p.visibility === "hidden") && p.guideActionHit;
        }).toBe(true);
        const before = await learningClearanceGeometry(page);
        // Multiple paint/HUD cycles must not alternate hidden and visible.
        const stable = await page.locator(".commander-strip").evaluate(async strip => {
          const samples = [];
          for (let frame = 0; frame < 20; frame++) {
            await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
            const r = strip.getBoundingClientRect();
            samples.push({ hidden: strip.classList.contains("learning-guide-overlap"), visibility: getComputedStyle(strip).visibility, width: r.width, height: r.height });
          }
          return samples;
        });
        expect(stable.every(p => p.hidden === before.suppressed && p.visibility === before.visibility && p.width === before.strip.width && p.height === before.strip.height)).toBe(true);
        if (before.suppressed) {
          expect(before.strip.width).toBeGreaterThan(0);
          expect(before.strip.height).toBeGreaterThan(0);
        }
        // The duplicate's suppression must not cost access to the normal
        // Commander control, guide CTA, deck toggle, or queued-game state.
        expect(await action(page, "select-commander").evaluate(node => {
          const r = node.getBoundingClientRect();
          return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest("button") === node;
        })).toBe(true);
        if (size.width === original.width && size.height === original.height || size.width === 1184 && size.height === 760)
          await page.screenshot({ path: test.info().outputPath(`${label}-${scale}-${size.width}x${size.height}-${collapsed ? "collapsed" : "expanded"}.png`) });
        await pressLearningControl(page, action(page, "learning-help"));
        if (label === "paid-training") await expect(page.locator('#deck-content [data-action="recruit"]')).toHaveCount(1);
        else await expect(page.getByRole("button", { name: "Expand guide", exact: true })).toBeVisible();
        expect(await page.evaluate(() => JSON.stringify(window.__FRONTIER__.state))).toBe(snapshot);
        proofs.push({ scale, label, ...before, stablePaintSamples: stable.length, nativeGuideAction: true, wholePausedGameUnchanged: true,
          wholeGuideReadability: before.guideDeckOverlapArea > 0 ? "pending obstruction review" : "no deck intersection; full readability not asserted" });
      }
    }
  }
  await page.setViewportSize(original);
  await textSize(page, "1");
  if (await page.locator(".command-deck").evaluate(node => node.classList.contains("collapsed")) !== originalCollapsed)
    await pressLearningControl(page, action(page, "toggle-deck"));
  await expandGuide(page);
  expect(await page.evaluate(() => JSON.stringify(window.__FRONTIER__.state))).toBe(snapshot);
  await test.info().attach(`${label}-learning-guide-clearance`, { body: JSON.stringify(proofs, null, 2), contentType: "application/json" });
}
