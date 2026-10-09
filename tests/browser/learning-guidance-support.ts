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
    const minimap = rect(document.querySelector(".minimap-wrap")!), objective = rect(document.querySelector("#objective")!);
    const intersects = (a: typeof g, b: typeof g) => a.width > 0 && a.height > 0 && b.width > 0 && b.height > 0 &&
      a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    const clip = { left: g.left + guide.clientLeft, top: g.top + guide.clientTop,
      right: g.left + guide.clientLeft + guide.clientWidth, bottom: g.top + guide.clientTop + guide.clientHeight };
    const overlap = !!g.width && !!g.height && !!c.width && !!c.height &&
      g.left < c.right && g.right > c.left && g.top < c.bottom && g.bottom > c.top;
    const button = guide.querySelector<HTMLElement>('[data-action="learning-help"]');
    const b = button?.getBoundingClientRect();
    const describeHit = (node: Element | null) => node ? {
      tag: node.tagName, id: node.id, className: node.getAttribute("class"),
      action: node.getAttribute("data-action"), buttonAction: node.closest("button")?.getAttribute("data-action"),
    } : null;
    const guideActionHitPoints = b ? [b.left + 2, b.left + b.width / 2, b.right - 2]
      .flatMap(x => [b.top + 2, b.top + b.height / 2, b.bottom - 2].map(y => ({
        x, y, hitsButton: document.elementFromPoint(x, y)?.closest("button") === button,
        hitsGuide: document.elementFromPoint(x, y) === guide,
        hit: describeHit(document.elementFromPoint(x, y)),
        stack: document.elementsFromPoint(x, y).slice(0, 5).map(describeHit),
      }))) : [];
    const buttonStyle = button ? getComputedStyle(button) : undefined;
    // Rounded corners are intentionally outside a rectangular button's painted
    // hit shape. Keep the near-edge midpoint and center probes, but put corner
    // probes inside the computed curve. The entire unrounded bounding box must
    // still fit in the clip, and native activation still enforces a 44px target.
    const radii = buttonStyle ? [buttonStyle.borderTopLeftRadius, buttonStyle.borderTopRightRadius,
      buttonStyle.borderBottomLeftRadius, buttonStyle.borderBottomRightRadius] : [];
    // Current lesson buttons use circular pixel radii. Fail closed if a future
    // style changes that contract instead of guessing percent/elliptical units.
    const guideActionRadiusSupported = radii.length === 4 && radii.every(value => /^\d+(?:\.\d+)?px$/.test(value));
    const radius = guideActionRadiusSupported ? Math.max(...radii.map(value => parseFloat(value))) : 0;
    const legacyMissesAreRoundedBackground = guideActionHitPoints.every((point, index) => point.hitsButton ||
      radius > 0 && [0, 2, 6, 8].includes(index) && point.hitsGuide);
    const insetX = b ? Math.min(b.width / 2, Math.max(2, radius + 1)) : 0;
    const insetY = b ? Math.min(b.height / 2, Math.max(2, radius + 1)) : 0;
    const guideActionPaintedHitPoints = b ? [
      ["center", b.left + b.width / 2, b.top + b.height / 2],
      ["left-edge", b.left + 2, b.top + b.height / 2], ["right-edge", b.right - 2, b.top + b.height / 2],
      ["top-edge", b.left + b.width / 2, b.top + 2], ["bottom-edge", b.left + b.width / 2, b.bottom - 2],
      ["top-left", b.left + insetX, b.top + insetY], ["top-right", b.right - insetX, b.top + insetY],
      ["bottom-left", b.left + insetX, b.bottom - insetY], ["bottom-right", b.right - insetX, b.bottom - insetY],
    ].map(([name, x, y]) => ({ name, x: Number(x), y: Number(y),
      hitsButton: document.elementFromPoint(Number(x), Number(y))?.closest("button") === button,
      hit: describeHit(document.elementFromPoint(Number(x), Number(y))),
    })) : [];
    return {
      guide: g, strip: c, overlap, suppressed: strip.classList.contains("learning-guide-overlap"),
      visibility: style.visibility, display: style.display,
      guideActionHit: b ? document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2)?.closest("button") === button : null,
      guideActionRect: button ? rect(button) : null,
      guideActionContainment: b ? { left: b.left >= clip.left, right: b.right <= clip.right, top: b.top >= clip.top, bottom: b.bottom <= clip.bottom } : null,
      guideActionBoxContained: b ? b.left >= clip.left && b.right <= clip.right && b.top >= clip.top && b.bottom <= clip.bottom : null,
      guideActionHitPoints, // Retain all nine original near-corner samples as diagnostic history.
      guideActionPaintedHitPoints, guideActionRadiusSupported, legacyMissesAreRoundedBackground,
      guideActionStyle: buttonStyle ? { borderTopLeftRadius: buttonStyle.borderTopLeftRadius,
        borderTopRightRadius: buttonStyle.borderTopRightRadius, borderBottomLeftRadius: buttonStyle.borderBottomLeftRadius,
        borderBottomRightRadius: buttonStyle.borderBottomRightRadius, fontSize: buttonStyle.fontSize,
        lineHeight: buttonStyle.lineHeight, pointerEvents: buttonStyle.pointerEvents, overflow: buttonStyle.overflow,
        transform: buttonStyle.transform, visibility: buttonStyle.visibility, display: buttonStyle.display } : null,
      legacyGuideActionFullyVisible: b ? b.left >= clip.left && b.right <= clip.right && b.top >= clip.top && b.bottom <= clip.bottom &&
        guideActionHitPoints.every(point => point.hitsButton) : null,
      guideActionFullyVisible: b ? b.left >= clip.left && b.right <= clip.right && b.top >= clip.top && b.bottom <= clip.bottom &&
        guideActionRadiusSupported && legacyMissesAreRoundedBackground && guideActionPaintedHitPoints.length === 9 &&
        guideActionPaintedHitPoints.every(point => point.hitsButton) : null,
      guideClip: clip, minimap, objective, guideMinimapOverlap: intersects(g, minimap), guideObjectiveOverlap: intersects(g, objective),
      shortLayoutAdjusted: guide.dataset.learningMinimapAdjusted === "true",
      deck,
      guideDeckOverlapArea: Math.max(0, Math.min(g.right, deck.right) - Math.max(g.left, deck.left)) *
        Math.max(0, Math.min(g.bottom, deck.bottom) - Math.max(g.top, deck.top)),
      guideScroll: { clientHeight: guide.clientHeight, scrollHeight: guide.scrollHeight, scrollTop: guide.scrollTop,
        contentViewportHeight: guide.clientHeight - parseFloat(getComputedStyle(guide).paddingTop) - parseFloat(getComputedStyle(guide).paddingBottom) },
      collapsed: document.querySelector(".command-deck")!.classList.contains("collapsed"),
      viewport: { width: innerWidth, height: innerHeight },
    };
  });
}

/** Prove readable text by exposing every non-space character through native
 * wheel scrolling and testing the actual painted element at its range center.
 * Geometry alone, or one green CTA center, is not a readability assertion. */
async function verifyShortGuideReading(page: Page, name: string) {
  const guide = page.locator("#battle-hint");
  const sample = () => guide.evaluate(node => {
    const g = node.getBoundingClientRect();
    const clip = { left: g.left + node.clientLeft, right: g.left + node.clientLeft + node.clientWidth,
      top: g.top + node.clientTop, bottom: g.top + node.clientTop + node.clientHeight };
    const characters: { id: string; text: string; readable: boolean }[] = [];
    for (const [part, element] of [...node.querySelectorAll(":scope > span, :scope > b, :scope > p")].entries()) {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      let textNode: Node | null, textIndex = 0;
      while ((textNode = walker.nextNode())) {
        for (let offset = 0; offset < (textNode.textContent?.length ?? 0); offset++) {
          const text = textNode.textContent![offset];
          if (!text.trim()) continue;
          const range = document.createRange();
          range.setStart(textNode, offset); range.setEnd(textNode, offset + 1);
          const r = range.getBoundingClientRect();
          const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
          characters.push({ id: `${part}:${textIndex}:${offset}`, text, readable: r.width > 0 && r.height > 0 &&
            r.left >= clip.left && r.right <= clip.right && r.top >= clip.top && r.bottom <= clip.bottom &&
            !!hit && element.contains(hit) });
        }
        textIndex++;
      }
    }
    return { scrollTop: node.scrollTop, scrollHeight: node.scrollHeight, clientHeight: node.clientHeight, characters };
  });
  const initial = await sample(), box = (await guide.boundingBox())!;
  // Use actual input, never assign scrollTop or substitute a DOM click.
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -initial.scrollHeight);
  await expect.poll(() => guide.evaluate(node => node.scrollTop)).toBe(0);
  const seen = new Set<string>(), samples: Awaited<ReturnType<typeof sample>>[] = [];
  let current = await sample();
  await page.screenshot({ path: test.info().outputPath(`${name}-readable-top.png`) });
  const step = Math.max(1, Math.floor(current.clientHeight / 2));
  const maxSamples = Math.ceil(current.scrollHeight / step) + 2;
  for (let index = 0; index < maxSamples; index++) {
    samples.push(current);
    current.characters.filter(character => character.readable).forEach(character => seen.add(character.id));
    if (current.scrollTop + current.clientHeight >= current.scrollHeight - 1) break;
    const next = Math.min(current.scrollHeight - current.clientHeight, current.scrollTop + step);
    await page.mouse.wheel(0, step);
    await expect.poll(() => guide.evaluate(node => node.scrollTop)).toBeGreaterThanOrEqual(next - 1);
    current = await sample();
  }
  const geometry = await learningClearanceGeometry(page);
  const stable = await guide.evaluate(async node => {
    const samples = [], start = performance.now();
    while (performance.now() - start < 1100) {
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      const r = node.getBoundingClientRect();
      samples.push({ left: r.left, top: r.top, width: r.width, height: r.height, scrollTop: node.scrollTop });
    }
    return samples;
  });
  const missing = current.characters.filter(character => !seen.has(character.id));
  const proof = { nativeWheel: true, readableCharacters: seen.size, totalCharacters: current.characters.length, missing,
    samples, geometry, stable, stableMilliseconds: 1100 };
  await test.info().attach(`${name}-native-scroll-reading`, { body: JSON.stringify(proof, null, 2), contentType: "application/json" });
  await page.screenshot({ path: test.info().outputPath(`${name}-readable-bottom-before-cta.png`) });
  expect(missing, "Every lesson label, title and instruction character must be exposed and unobscured while scrolling").toEqual([]);
  expect(seen.size).toBeGreaterThan(0);
  const identity = (value: typeof initial) => value.characters.map(({ id, text }) => ({ id, text }));
  expect(samples.every(value => JSON.stringify(identity(value)) === JSON.stringify(identity(initial))),
    "Scrolling must not replace or drop any lesson text").toBe(true);
  expect(geometry.guideMinimapOverlap).toBe(false);
  expect(geometry.guideObjectiveOverlap).toBe(false);
  expect(geometry.guideDeckOverlapArea).toBe(0);
  expect(geometry.guideScroll.contentViewportHeight).toBeGreaterThanOrEqual(44);
  expect(geometry.guideActionFullyVisible, "The full 44px target must fit inside the guide's real clipped viewport").toBe(true);
  expect(stable[0]).toEqual({ left: geometry.guide.left, top: geometry.guide.top, width: geometry.guide.width,
    height: geometry.guide.height, scrollTop: geometry.guideScroll.scrollTop });
  expect(stable.every(value => JSON.stringify(value) === JSON.stringify(stable[0]))).toBe(true);
  return { nativeWheel: true, readableCharacters: seen.size, scrollPositions: samples.length,
    scrollNeeded: initial.scrollHeight > initial.clientHeight, stableMilliseconds: 1100, fullCTAVisible: true };
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
    { width: 1184, height: 500 }, { width: 1184, height: 501 }, { width: 1184, height: 550 },
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
        const boundaryName = `${label}-${scale}-${size.width}x${size.height}-${collapsed ? "collapsed" : "expanded"}-before-cta`;
        if (size.width === 1184 && [500, 501, 550].includes(size.height)) {
          const boundary = await learningClearanceGeometry(page);
          const name = boundaryName;
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
        const reading = size.width === 1184 && [501, 550].includes(size.height)
          ? await verifyShortGuideReading(page, boundaryName) : undefined;
        let minimizedMapReading;
        if (size.width === 1184 && size.height === 501) {
          await pressLearningControl(page, action(page, "toggle-minimap"));
          await expect(page.locator(".minimap-wrap")).toHaveClass(/collapsed/);
          const mapReading = await verifyShortGuideReading(page, `${boundaryName}-minimap-collapsed`);
          await pressLearningControl(page, action(page, "learning-help"));
          if (label === "paid-training") await expect(page.locator('#deck-content [data-action="recruit"]')).toHaveCount(1);
          else await expect(page.getByRole("button", { name: "Expand guide", exact: true })).toBeVisible();
          expect(await page.evaluate(() => JSON.stringify(window.__FRONTIER__.state))).toBe(snapshot);
          minimizedMapReading = { ...mapReading, nativeGuideAction: true, wholePausedGameUnchanged: true };
          if (await page.locator(".command-deck").evaluate(node => node.classList.contains("collapsed")) !== collapsed)
            await pressLearningControl(page, action(page, "toggle-deck"));
          await expandGuide(page);
          await pressLearningControl(page, action(page, "toggle-minimap"));
          await expect(page.locator(".minimap-wrap")).not.toHaveClass(/collapsed/);
          await action(page, "learning-help").scrollIntoViewIfNeeded();
        }
        if (size.width <= 600 || size.height <= 500 || size.height > 550) {
          expect(await page.locator("#battle-hint").evaluate(node => ({
            adjusted: node.dataset.learningMinimapAdjusted, left: node.style.left, width: node.style.width,
          })), "The short-desktop correction must leave the existing narrow, <=500 and taller layouts untouched")
            .toEqual({ adjusted: undefined, left: "", width: "" });
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
        proofs.push({ scale, label, ...before, reading, minimizedMapReading, stablePaintSamples: stable.length, nativeGuideAction: true, wholePausedGameUnchanged: true,
          wholeGuideReadability: reading ? "every lesson text character exposed by native scrolling; full CTA hit-tested" :
            before.guideDeckOverlapArea > 0 ? "pending obstruction review" : "no deck intersection; full readability not asserted" });
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
