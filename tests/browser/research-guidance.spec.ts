import { writeFile } from 'node:fs/promises';
import type { Locator, Page } from '@playwright/test';
import { getUnitCost, populationBreakdown, UNITS } from '../../src/sim';
import type { GameState, UnitId } from '../../src/sim/types';
import { action, expect, test as base } from './helpers';

// Bounded scripted acceptance: two themes × the three existing desktop/phone
// projects = six identities. Fresh browser contexts, native controls only, and
// no injected storage, game state, commands, camera, production, or clock.
// Source-assisted reads observe real state and layout; they do not advance play.
// Evidence plan: phones only, three CSS-scale disk PNGs per identity (guidance,
// paid waiting queue, completed research), twelve total, plus six small JSONs.
type Theme = 'christmas' | 'mythic';
type RendererProbe = Window['__FRONTIER__']['renderer'] & {
  visualTheme: string;
  atlas: { ready: boolean; image: HTMLImageElement | null };
};
const node = (page: Page, id: 'steel' | 'veterancy') =>
  page.locator(`#deck-content [data-action="research"][data-id="${id}"]`);
const producer = (page: Page, id: string) =>
  page.locator(`#production-strip .producer[data-live-key="${id}"]`);
const masteryPrice = { gold: 200, wood: 80 };
type ResearchReceipt = {
  identity: string;
  project: string;
  stages: { name: string; evidence: unknown }[];
  result?: unknown;
  finalObservation?: unknown;
  finalObservationError?: string;
  outcome?: unknown;
};

/** Compact evidence remains available even if a later native action/assertion fails. */
function observation(state: GameState) {
  const player = state.players[0];
  return {
    time: state.time, paused: state.paused, pace: state.settings.gameSpeed,
    resources: { gold: player.gold, wood: player.wood },
    research: player.research, stats: player.stats, population: populationBreakdown(state),
    commander: state.entities.filter(e => e.team === 0 && e.kind === 'commander')
      .map(e => ({ id: e.id, hp: e.hp, maxHp: e.maxHp, respawnAt: e.respawnAt })),
    troops: state.entities.filter(e => e.team === 0 && e.kind === 'unit' && e.hp > 0)
      .map(e => ({ id: e.id, type: e.type, population: UNITS[e.type as UnitId].population })),
    producers: state.entities.filter(e => e.team === 0 && e.queue.length)
      .map(e => ({ id: e.id, type: e.type, jobs: e.queue })),
  };
}
const test = base.extend<{ researchReceipt: ResearchReceipt }>({
  researchReceipt: [async ({ page }, use, info) => {
    const receipt: ResearchReceipt = { identity: info.title, project: info.project.name, stages: [] };
    try {
      await use(receipt);
    } finally {
      receipt.outcome = { status: info.status, expectedStatus: info.expectedStatus, errors: info.errors.map(error => error.message) };
      try {
        if (!page.isClosed()) {
          const final = await page.evaluate(() => window.__FRONTIER__?.state ? structuredClone(window.__FRONTIER__.state) : null);
          if (final) receipt.finalObservation = observation(final);
        }
      } catch (error) {
        receipt.finalObservationError = error instanceof Error ? error.message : String(error);
      }
      const path = info.outputPath(`research-${info.project.name}-receipt.json`);
      await writeFile(path, JSON.stringify(receipt, null, 2));
      await info.attach('research-guidance-receipt', { path, contentType: 'application/json' });
    }
  }, { auto: true }],
});
test.use({ actionTimeout: 8_000 });

async function press(page: Page, control: Locator) {
  await control.scrollIntoViewIfNeeded();
  if (test.info().project.use.hasTouch) await control.tap();
  else await control.click();
}
async function snapshot(page: Page): Promise<GameState> {
  return page.evaluate(() => structuredClone(window.__FRONTIER__.state));
}
async function account(page: Page) {
  return page.evaluate(() => ({
    profile: structuredClone(window.__FRONTIER__.profile),
    // Read the real persisted flag; Settings writes all default preferences.
    learningComplete: JSON.parse(localStorage.getItem('frontier-command:rts-game:v1:preferences')!).learningComplete as boolean,
  }));
}
async function setPaused(page: Page, paused: boolean) {
  if ((await snapshot(page)).paused !== paused) await press(page, action(page, 'pause'));
  await expect.poll(() => page.evaluate(() => window.__FRONTIER__.state.paused)).toBe(paused);
}
async function setPace(page: Page, pace: .5 | 2) {
  await press(page, action(page, 'panel-orders'));
  // The actual five-value speed control cycles .5, .75, 1, 1.5, 2.
  for (let i = 0; i < 5 && ((await snapshot(page)).settings.gameSpeed ?? 1) !== pace; i++) {
    await press(page, action(page, 'speed'));
  }
  expect((await snapshot(page)).settings.gameSpeed).toBe(pace);
  await expect(action(page, 'speed')).toHaveText(`${pace}× speed`);
}
function spend(before: GameState, after: GameState) {
  const a = before.players[0], b = after.players[0];
  return {
    gold: a.gold + b.stats.goldCollected - a.stats.goldCollected - b.gold,
    wood: a.wood + b.stats.woodCollected - a.stats.woodCollected - b.wood,
  };
}
function expectSpend(before: GameState, after: GameState, cost: typeof masteryPrice) {
  const paid = spend(before, after);
  expect(paid.gold, 'Gold spent, after subtracting genuine earned-income deltas').toBeCloseTo(cost.gold, 6);
  expect(paid.wood, 'Wood spent, after subtracting genuine earned-income deltas').toBeCloseTo(cost.wood, 6);
}
async function exactPrice(control: Locator, gold: number, wood: number) {
  await expect(control.locator('.resource-price[data-resource="gold"] .resource-amount')).toHaveText(String(gold));
  await expect(control.locator('.resource-price[data-resource="wood"] .resource-amount')).toHaveText(String(wood));
  await expect(control.locator('.resource-price[data-resource="gold"] .resource-name')).toHaveText('gold');
  await expect(control.locator('.resource-price[data-resource="wood"] .resource-name')).toHaveText('wood');
}

/** Check visible text, including overflow ancestors and native hit visibility. */
async function readable(page: Page, text: Locator) {
  await text.scrollIntoViewIfNeeded();
  await expect(text).toBeVisible();
  const box = await text.evaluate(element => {
    const rect = element.getBoundingClientRect(), clipped: string[] = [];
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent), bounds = parent.getBoundingClientRect();
      const left = bounds.left + parent.clientLeft, top = bounds.top + parent.clientTop;
      if (/(auto|scroll|hidden|clip)/.test(style.overflowX) && (rect.left < left - 1 || rect.right > left + parent.clientWidth + 1)) clipped.push(`${parent.className}:x`);
      if (/(auto|scroll|hidden|clip)/.test(style.overflowY) && (rect.top < top - 1 || rect.bottom > top + parent.clientHeight + 1)) clipped.push(`${parent.className}:y`);
    }
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return {
      clipped, overflow: element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1,
      clear: !!hit && (element.contains(hit) || hit.contains(element)),
      left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom,
    };
  });
  expect(box.clipped, 'Guidance must fit its visible scroll container').toEqual([]);
  expect(box.overflow, 'Guidance must not be ellipsized or cut off').toBe(false);
  expect(box.clear, 'Guidance must not be covered by another control').toBe(true);
  expect(box.left).toBeGreaterThanOrEqual(-1); expect(box.top).toBeGreaterThanOrEqual(-1);
  expect(box.right).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
  expect(box.bottom).toBeLessThanOrEqual(page.viewportSize()!.height + 1);
  return box;
}
async function frame(page: Page, theme: Theme, stage: 'guidance' | 'queued' | 'completed') {
  if (!test.info().project.name.startsWith('phone-')) return;
  await page.evaluate(() => document.fonts.ready);
  await expect.poll(() => page.evaluate(() => {
    const renderer = window.__FRONTIER__.renderer as RendererProbe;
    return renderer.atlas.ready && !!renderer.atlas.image?.complete && renderer.atlas.image.naturalWidth > 0;
  })).toBe(true);
  await page.screenshot({ path: test.info().outputPath(`research-${theme}-${stage}-${test.info().project.name}.png`), scale: 'css', animations: 'disabled' });
}
async function startBattle(page: Page, theme: Theme) {
  await page.goto('./');
  await expect(action(page, 'learn')).toHaveText('Learn to command · start here');
  await press(page, action(page, 'settings'));
  await page.getByLabel('Visual theme', { exact: true }).selectOption(theme);
  await expect.poll(() => page.evaluate(() => (window.__FRONTIER__.renderer as RendererProbe).visualTheme)).toBe(theme);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('frontier-command:rts-game:v1:preferences') ?? 'null')?.learningComplete)).toBe(false);
  await press(page, page.getByRole('button', { name: 'Done', exact: true }));
  const initialAccount = await account(page);
  expect(initialAccount.learningComplete).toBe(false);
  await press(page, action(page, 'skirmish'));
  await page.getByLabel('Map seed', { exact: true }).fill('QA-FRONTIER-2026');
  await page.locator('select[name="mapSize"]').selectOption('small');
  await page.locator('select[name="difficulty"]').selectOption('easy');
  await press(page, page.locator('.setup-advanced > summary'));
  await page.getByLabel('Starting gold per player', { exact: true }).fill('300');
  await press(page, action(page, 'launch'));
  await expect(page.getByRole('dialog', { name: 'Your first frontier', exact: true })).toBeVisible();
  await press(page, page.getByRole('button', { name: 'Start battle', exact: true }));
  await expect(page.locator('.hud')).toBeVisible();
  await setPaused(page, true);
  // Short landscape deliberately hides the optional field guide and its close
  // control. Match the normal launcher: dismiss only a genuinely visible tip.
  if (await action(page, 'dismiss-tips').isVisible()) await press(page, action(page, 'dismiss-tips'));
  const state = await snapshot(page);
  expect(state.settings).toMatchObject({ difficulty: 'easy', startingGold: 300, startingWood: 260, mapSize: 'small' });
  expect(state.settings.learning).not.toBe(true);
  expect(state.players[0].research).toEqual({});
  expect(state.pendingCommands).toEqual([]);
  expect(await account(page)).toEqual(initialAccount);
  await setPace(page, .5);
  return initialAccount;
}
async function saveLeaveReload(page: Page, initialAccount: Awaited<ReturnType<typeof account>>) {
  const before = await snapshot(page);
  expect(before.paused).toBe(true);
  await press(page, action(page, 'pause-menu'));
  await press(page, page.getByRole('button', { name: 'Save & leave', exact: true }));
  await expect(action(page, 'continue')).toBeVisible();
  await expect(action(page, 'learn')).toHaveText('Learn to command · start here');
  expect(await account(page)).toEqual(initialAccount);
  await page.reload();
  await expect(action(page, 'learn')).toHaveText('Learn to command · start here');
  await press(page, action(page, 'continue'));
  await expect(page.locator('.hud')).toBeVisible();
  expect(await snapshot(page), 'Paused game, paid jobs, time, resources, research and command log survive normal save/reload').toEqual(before);
  expect(await account(page), 'Research does not complete the eight lessons or change the profile').toEqual(initialAccount);
  return before;
}

for (const theme of ['christmas', 'mythic'] as const) {
  test(`research guidance · ${theme} · paid Keep queue completes and survives save reload`, async ({ page, researchReceipt }) => {
    test.setTimeout(120_000);
    const record = (name: string, evidence: unknown) => researchReceipt.stages.push({ name, evidence });
    test.info().annotations.push({
      type: 'scripted-native-acceptance',
      description: 'Fresh normal Easy skirmish. Visible Advanced setup sets 300 starting gold (wood stays 260) to fund one Swordsman and Commander Mastery. Ordinary 0.5× pace bounds the live queue step; 2× completes it. Read-only source-assisted state/layout assertions; no injected fixture, commands, storage, clock or camera. The fresh learning-completion flag remains false; this is not an eight-lesson replay.',
    });
    const initialAccount = await startBattle(page, theme);
    const baseline = await snapshot(page), keep = baseline.entities.find(e => e.team === 0 && e.type === 'keep')!;
    const hero = baseline.entities.find(e => e.team === 0 && e.kind === 'commander')!;
    const population = populationBreakdown(baseline), swordPrice = getUnitCost(baseline, 0, 'swordsman');
    record('native-setup-observed', { ...observation(baseline), account: initialAccount });
    // In this actual starting force, every soldier costs one population. Verify
    // that premise before using unit-only unitsLost to account for later combat.
    const startingTroops = baseline.entities.filter(e => e.team === 0 && e.kind === 'unit' && e.hp > 0);
    expect(startingTroops.map(e => e.type).sort()).toEqual(['archer', 'spearman', 'swordsman', 'swordsman']);
    expect(startingTroops.every(e => UNITS[e.type as UnitId].population === 1)).toBe(true);
    expect(UNITS.swordsman.population).toBe(1);
    expect(keep.queue).toEqual([]);

    await press(page, action(page, 'panel-research'));
    const intro = page.locator('.research-intro'), footnote = page.locator('.research-footnote');
    await expect(intro).toContainText('Research lasts for this battle.');
    await expect(intro).toContainText('Separate technologies do not require one another.');
    await expect(intro).toContainText('To choose the production queue, select a matching building first.');
    await expect(footnote).toContainText('With no matching selection, the first completed source is used.');
    await expect(footnote).toContainText('Each next level costs the base price × its level.');
    await expect(footnote).toContainText('Jobs share their building’s production queue; upgrade that building to shorten research time.');
    await expect(footnote).toContainText('Effects begin when the job finishes.');
    const guidanceBox = await readable(page, intro);
    await frame(page, theme, 'guidance');
    await readable(page, footnote);
    const blacksmith = page.getByRole('region', { name: 'Blacksmith research', exact: true });
    await expect(blacksmith.locator('[data-prerequisite-state="missing"]')).toContainText('Blacksmith');
    await expect(blacksmith.locator('[data-prerequisite-state="missing"] small')).toHaveText('Not built');
    await expect(node(page, 'steel')).toBeDisabled();
    await expect(node(page, 'steel').locator('.research-status')).toHaveText('Requires completed Blacksmith');
    await exactPrice(node(page, 'steel'), 120, 60);
    await readable(page, node(page, 'steel').locator('.research-status'));
    await expect(node(page, 'veterancy')).toBeEnabled();
    await expect(node(page, 'veterancy')).toHaveAccessibleName('Commander Mastery. 0 of 1 levels complete. Research level 1. +25% commander health and 20% faster ability cooldowns.');
    await exactPrice(node(page, 'veterancy'), masteryPrice.gold, masteryPrice.wood);
    expect(await snapshot(page)).toEqual(baseline);
    record('guidance-prerequisites-prices-verified', { guidanceBox, unchangedPausedState: true });

    // The visible default destination is the first completed Keep. A real paid
    // recruit exposes its producer button, which explicitly selects that Keep.
    await press(page, action(page, 'panel-army'));
    const swordsman = page.getByRole('button', { name: 'Recruit Swordsman', exact: true });
    await expect(swordsman.locator('.recruit-producer')).toContainText('Command Keep:');
    await press(page, page.getByRole('button', { name: 'Queue 1 at a time', exact: true }));
    await setPaused(page, false);
    await press(page, swordsman);
    await setPaused(page, true);
    const recruited = await snapshot(page), soldier = recruited.entities.find(e => e.id === keep.id)!.queue[0];
    record('paid-swordsman-observed', observation(recruited));
    expect(soldier).toMatchObject({ type: 'unit', id: 'swordsman', total: 10, paidCost: swordPrice });
    expect(soldier.remaining).toBeGreaterThan(0);
    expect(recruited.pendingCommands).toEqual([]);
    expectSpend(baseline, recruited, swordPrice);
    expect(populationBreakdown(recruited)).toEqual({ ...population, reserved: population.reserved + 1 });
    await press(page, producer(page, keep.id).getByRole('button', { name: 'Command Keep · 1/12', exact: true }));
    await expect(page.locator('#selection-info strong')).toHaveText('Command Keep');
    await expect(page.locator('.inspect-heading h3')).toHaveText('Command Keep');
    await press(page, action(page, 'panel-research'));
    await expect(node(page, 'veterancy').locator('.research-price')).toContainText('40s after queued jobs');
    await exactPrice(node(page, 'veterancy'), masteryPrice.gold, masteryPrice.wood);
    await node(page, 'veterancy').scrollIntoViewIfNeeded();
    await setPaused(page, false);
    await press(page, node(page, 'veterancy'));
    await expect(page.locator('#toast')).toHaveText('Commander Mastery queued for research');
    await setPaused(page, true);

    const queued = await snapshot(page), queue = queued.entities.find(e => e.id === keep.id)!.queue;
    record('paid-research-queue-observed', { ...observation(queued), researchSpend: spend(recruited, queued) });
    expect(queue).toHaveLength(2);
    expect(queue[0]).toMatchObject({ queueId: soldier.queueId, type: 'unit', id: 'swordsman' });
    expect(queue[0].remaining).toBeGreaterThan(0);
    expect(queue[1]).toMatchObject({ type: 'research', id: 'veterancy', total: 40, remaining: 40, paidCost: masteryPrice });
    expect(queued.pendingCommands).toEqual([]);
    expect(queued.entities.filter(e => e.team === 0 && e.id !== keep.id).flatMap(e => e.queue)).toEqual([]);
    expect(queued.commandLog.filter(entry => entry.command.type === 'research' && entry.command.team === 0)).toEqual([
      expect.objectContaining({ command: { type: 'research', team: 0, technology: 'veterancy', buildingId: keep.id } }),
    ]);
    expectSpend(recruited, queued, masteryPrice);
    expect(populationBreakdown(queued)).toEqual(populationBreakdown(recruited));
    expect(queued.players[0].population).toBe(baseline.players[0].population + 1);
    expect(queued.players[0].research.veterancy ?? 0).toBe(0);
    expect(queued.entities.find(e => e.id === hero.id)!.maxHp).toBe(hero.maxHp);
    await expect(node(page, 'veterancy')).toBeDisabled();
    await expect(node(page, 'veterancy')).toHaveClass(/\bqueued\b/);
    await expect(node(page, 'veterancy').locator('.research-status')).toHaveText('Level 1 in research queue');
    const queueHeading = page.locator('#production-strip .production-list > h4 small');
    await expect(queueHeading).toHaveText('Paid jobs · Troops reserve population');
    const queueHeadingBox = await readable(page, queueHeading);
    // Short landscape cannot fit the header, producer, rally line and full job
    // row together. Capture the changed header; inspect waiting text separately.
    await frame(page, theme, 'queued');
    const waiting = producer(page, keep.id).locator('li').nth(1);
    await expect(waiting.locator('.job-number')).toHaveText('2');
    await expect(waiting.locator('b')).toHaveText('Commander Mastery');
    await expect(waiting.locator('div > small').first()).toHaveText('40s · waiting');
    await expect(waiting.locator('progress')).toHaveCount(0);
    await expect(waiting.locator('.refund-amount')).toHaveText('Cancel refund: 200 gold · 80 wood');
    const waitingBox = await readable(page, waiting.locator('div > small').first());
    record('waiting-guidance-verified', { queueHeadingBox, waitingBox, researchHasNoProgressBar: true });

    // Use the stable data attribute: HUD aria-label becomes "Gold: ... Income:"
    // after launch, so the initial "Gold and income sources" name is stale.
    const gold = page.locator('.hud [data-action="economy"][data-resource="gold"]');
    await expect(gold).toHaveAccessibleName(/^Gold: \d+\. Income: /);
    await press(page, gold);
    const economy = page.getByRole('dialog', { name: 'Your economy and army', exact: true });
    await expect(economy.locator('.population-breakdown > span').filter({ hasText: 'in training' }).locator('b')).toHaveText('1');
    await press(page, economy.getByRole('button', { name: 'Back to battle', exact: true }));
    expect(await snapshot(page), 'Native inspection while paused cannot advance or charge either job').toEqual(queued);
    await saveLeaveReload(page, initialAccount);
    record('queued-save-reload-verified', { exactState: true, profileAndLearningFlagUnchanged: true });

    await setPace(page, 2);
    await press(page, action(page, 'panel-research'));
    await expect(node(page, 'veterancy').locator('.research-status')).toHaveText('Level 1 in research queue');
    await node(page, 'veterancy').scrollIntoViewIfNeeded();
    await setPaused(page, false);
    await expect.poll(() => page.evaluate(() => window.__FRONTIER__.state.players[0].research.veterancy ?? 0), {
      timeout: 35_000, intervals: [100, 250, 500],
    }).toBe(1);
    await expect(page.locator('#toast')).toHaveText('Commander Mastery complete');
    await setPaused(page, true);
    const completed = await snapshot(page), upgradedHero = completed.entities.find(e => e.id === hero.id)!;
    record('completed-research-observed', observation(completed));
    expect(completed.entities.find(e => e.id === keep.id)!.queue).toEqual([]);
    const created = completed.players[0].stats.unitsCreated - baseline.players[0].stats.unitsCreated;
    const lost = completed.players[0].stats.unitsLost - baseline.players[0].stats.unitsLost;
    expect(created, 'The paid Swordsman really finishes training').toBe(1);
    expect(lost).toBeGreaterThanOrEqual(0);
    expect(lost).toBeLessThanOrEqual(startingTroops.length + created);
    expect(populationBreakdown(completed), 'Fielded population accounts for real combat losses; only troop jobs reserve population').toEqual({
      ...population, fielded: population.fielded + created - lost,
    });
    expect(upgradedHero.maxHp, 'The advertised health effect starts only at real research completion').toBeCloseTo(hero.maxHp * 1.25, 6);
    expectSpend(baseline, completed, { gold: swordPrice.gold + masteryPrice.gold, wood: swordPrice.wood + masteryPrice.wood });
    await expect(node(page, 'veterancy')).toBeDisabled();
    await expect(node(page, 'veterancy')).toHaveClass(/\bcompleted\b/);
    await expect(node(page, 'veterancy').locator('.research-levels > small')).toHaveText('1/1');
    await expect(node(page, 'veterancy').locator('.research-status')).toHaveText('Complete');
    await expect(node(page, 'veterancy').locator('.research-price')).toHaveText('All levels learned');
    await expect(node(page, 'veterancy').locator('.resource-price')).toHaveCount(0);
    await readable(page, node(page, 'veterancy').locator('.research-status'));
    await frame(page, theme, 'completed');
    if (upgradedHero.hp > 0) {
      await press(page, action(page, 'select-commander'));
      // Focusing a commander may collapse the deck; the visible Details tab
      // explicitly reopens it before inspecting the actual post-research HP.
      await press(page, action(page, 'panel-inspect'));
      await expect(page.locator('.command-deck')).not.toHaveClass(/\bcollapsed\b/);
      await expect(page.locator('[data-inspect-health]')).toHaveText(`${Math.ceil(upgradedHero.hp)} / ${Math.ceil(upgradedHero.maxHp)}`);
    } else {
      // Combat may kill the commander without undoing the researched max HP.
      // Verify the real recovery presentation instead of assuming survival or
      // selecting a nonexistent living actor; the state effect above is strict.
      expect(upgradedHero.respawnAt).not.toBeNull();
      await expect(page.locator('#commander-strip .respawning strong')).toHaveText('Commander recovering');
      await expect(page.locator('#commander-strip .respawning small')).toHaveText('Paused · abilities unavailable');
    }
    record('completion-effect-and-ui-verified', {
      level: completed.players[0].research.veterancy, previousMaxHp: hero.maxHp,
      hp: upgradedHero.hp, maxHp: upgradedHero.maxHp, respawnAt: upgradedHero.respawnAt,
      created, lost, totalSpend: spend(baseline, completed),
    });
    await saveLeaveReload(page, initialAccount);
    await press(page, action(page, 'panel-research'));
    await expect(node(page, 'veterancy')).toHaveAccessibleName('Commander Mastery. 1 of 1 levels complete. Complete. +25% commander health and 20% faster ability cooldowns.');
    expect((await snapshot(page)).entities.find(e => e.id === hero.id)!.maxHp).toBe(upgradedHero.maxHp);
    expect(await account(page)).toEqual(initialAccount);
    record('completed-save-reload-verified', { exactState: true, profileAndLearningFlagUnchanged: true });

    researchReceipt.result = {
      scenario: 'Native Easy skirmish, Advanced starting gold 300, default wood 260; 0.5× queue then 2× completion',
      theme, project: test.info().project.name, input: test.info().project.use.hasTouch ? 'locator.tap' : 'locator.click',
      readOnlySourceAssisted: true, selectedKeepId: keep.id,
      queuedJobs: queue.map(job => ({ id: job.id, type: job.type, remaining: job.remaining, paidCost: job.paidCost })),
      researchSpend: spend(recruited, queued), totalSpend: spend(baseline, completed),
      population: { before: population, queued: populationBreakdown(queued), completed: populationBreakdown(completed) },
      unitAccounting: { created, lost, allObservedTroopTypesUseOnePopulation: true },
      completion: { level: completed.players[0].research.veterancy, previousMaxHp: hero.maxHp, maxHp: upgradedHero.maxHp },
      nativePauseSaveReload: { queuedStateExact: true, completedStateExact: true },
      learningComplete: initialAccount.learningComplete, profileUnchanged: true,
      geometry: { guidanceBox, queueHeadingBox, waitingBox },
    };
  });
}
