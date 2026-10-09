import type {Locator, Page} from '@playwright/test';
import type {Battlefield} from '../../src/render/Battlefield';
import type {GameEvent} from '../../src/sim/types';
import {COMMANDERS, createGame, spawnEntity, updateFog} from '../../src/sim';
import {action, expect, home, test} from './helpers';

type Theme = 'mythic' | 'christmas';
type Encounter = ReturnType<typeof controlledEncounter>;
type Probe = {deaths: GameEvent[]; spawns: GameEvent[]; abilities: GameEvent[]};
type ProbedRenderer = Battlefield & {__qaRecovery: Probe};
type Rect = {x: number; y: number; width: number; height: number};

// Controlled regression fixtures in fresh Playwright contexts, not naturally
// earned battles or physical-phone evidence. State is written only at setup;
// real combat, pause, save/reload and respawn drive every subsequent transition.
// Two cases x two themes x three projects = 12 identities. Only the save case
// takes a screenshot: six screenshots total, with compact JSON in every case.
function controlledEncounter(repeated = false) {
  const state = createGame({seed: 'QA-RECOVERY-DISCLOSURE', mapSize: 'medium',
    faction: 'ironhold', commander: 'warlord', difficulty: 'easy', aiPlayers: 1,
    neutralCamps: 0, gameSpeed: 1});
  state.players.forEach(player => { player.ai = false; });
  state.map.tiles.fill('grass');
  state.entities = state.entities.filter(entity => entity.kind === 'building');
  state.entities.forEach(entity => { entity.damage = 0; });
  // Place the encounter at the real respawn point. A stationary attacker with
  // a 28-second attack period permits two unmodified death/respawn cycles and
  // leaves four game seconds to inspect the first recovered state.
  const spawn = state.map.spawns[0];
  const dx = state.map.width / 2 + .5 - spawn.x, dy = state.map.height / 2 + .5 - spawn.y;
  const distance = Math.hypot(dx, dy), x = spawn.x + dx / distance * 3, y = spawn.y + dy / distance * 3;
  const attacker = spawnEntity(state, 1, 'unit', 'swordsman', x + dx / distance * 1.5, y + dy / distance * 1.5);
  const commander = spawnEntity(state, 0, 'commander', 'warlord', x, y);
  attacker.damage = 10_000; attacker.speed = 0; attacker.attackPeriod = repeated ? 28 : 1000;
  attacker.order = {type: 'hold'};
  commander.hp = 1; commander.damage = 0; commander.order = {type: 'hold'};
  updateFog(state);
  state.events = []; state.paused = true;
  return {state, commanderId: commander.id, repeated};
}

async function press(page: Page, target: Locator) {
  await target.scrollIntoViewIfNeeded();
  if (await page.evaluate(() => navigator.maxTouchPoints > 0)) await target.tap();
  else await target.click();
}

async function setPaused(page: Page, paused: boolean) {
  if (await page.evaluate(() => window.__FRONTIER__.state.paused) !== paused) {
    await press(page, action(page, 'pause'));
  }
  await expect.poll(() => page.evaluate(() => window.__FRONTIER__.state.paused)).toBe(paused);
}

async function installProbe(page: Page, fixture: Encounter, previous?: Probe) {
  await page.evaluate(({fixture, previous}) => {
    const renderer = window.__FRONTIER__.renderer as unknown as ProbedRenderer;
    const probe: Probe = previous ?? {deaths: [], spawns: [], abilities: []};
    renderer.__qaRecovery = probe;
    const render = renderer.render;
    renderer.render = function(state, selection, options) {
      for (const event of state.events) {
        if (event.entityId !== fixture.commanderId) continue;
        const records = event.type === 'death' ? probe.deaths : event.type === 'spawn' ? probe.spawns
          : event.type === 'ability' ? probe.abilities : null;
        if (records && !records.some(item => item.id === event.id)) records.push({...event});
      }
      return render.call(this, state, selection, options);
    };
  }, {fixture, previous});
}

const readProbe = (page: Page) => page.evaluate(() =>
  (window.__FRONTIER__.renderer as unknown as ProbedRenderer).__qaRecovery);

async function snapshot(page: Page, fixture: Encounter) {
  return page.evaluate(id => {
    const frontier = window.__FRONTIER__, state = frontier.state;
    const commander = state.entities.find(entity => entity.id === id)!;
    return {time: state.time, paused: state.paused, gameSpeed: state.settings.gameSpeed,
      hp: commander.hp, maxHp: commander.maxHp, respawnAt: commander.respawnAt,
      cooldowns: {...commander.abilityCooldowns}, order: structuredClone(commander.order),
      pendingCommands: structuredClone(state.pendingCommands), winner: state.winner,
      commanderDeaths: state.players[0].stats.commanderDeaths,
      profile: JSON.stringify(frontier.profile)};
  }, fixture.commanderId);
}

async function prepare(page: Page, theme: Theme, fixture: Encounter) {
  await home(page);
  await press(page, action(page, 'settings'));
  await page.getByLabel('Visual theme', {exact: true}).selectOption(theme);
  await expect.poll(() => page.evaluate(() =>
    (window.__FRONTIER__.renderer as unknown as Battlefield).visualTheme)).toBe(theme);
  await press(page, page.getByRole('button', {name: 'Done', exact: true}));
  await press(page, action(page, 'skirmish'));
  await page.getByLabel('Map seed', {exact: true}).fill('QA-RECOVERY-DISCLOSURE');
  await page.locator('select[name="difficulty"]').selectOption('easy');
  await press(page, action(page, 'launch'));
  await expect.poll(() => page.evaluate(() => window.__FRONTIER__.playing)).toBe(true);
  const briefing = page.getByRole('button', {name: 'Start battle', exact: true});
  if (await briefing.count()) await press(page, briefing);
  if (await action(page, 'dismiss-tips').isVisible()) await press(page, action(page, 'dismiss-tips'));
  await setPaused(page, true);
  await page.evaluate(fixture => {
    const frontier = window.__FRONTIER__;
    Object.assign(frontier.state, fixture.state);
    (frontier.renderer as unknown as Battlefield).invalidateTerrain();
  }, fixture);
  await installProbe(page, fixture);
  await press(page, action(page, 'select-commander'));
  await expect(page.locator('#abilities [data-action="ability"]')).toHaveCount(2);
  return snapshot(page, fixture);
}

async function reachDeath(page: Page, fixture: Encounter, count: number) {
  await setPaused(page, false);
  await expect.poll(async () => (await readProbe(page)).deaths.length,
    {timeout: 12_000, intervals: [100]}).toBe(count);
  await setPaused(page, true);
  const state = await snapshot(page, fixture), death = (await readProbe(page)).deaths[count - 1];
  expect(state.hp).toBe(0);
  expect(state.respawnAt! - death.time).toBeCloseTo(24, 6);
  expect(state.commanderDeaths).toBe(fixture.state.players[0].stats.commanderDeaths + count);
  return state;
}

async function expectRecovery(page: Page, fixture: Encounter) {
  const state = await snapshot(page, fixture);
  expect(state.hp).toBe(0); expect(state.respawnAt).not.toBeNull();
  const strip = page.locator('#commander-strip');
  await expect(strip).toHaveClass(/\brecovering\b/);
  await expect(strip).toBeVisible();
  await expect(strip.locator('.respawning strong')).toHaveText('Commander recovering');
  const remaining = Math.ceil(Math.max(0, state.respawnAt! - state.time));
  await expect(strip.getByRole('timer')).toHaveText(`${remaining}s`);
  await expect(strip.getByRole('timer')).toHaveAttribute('aria-label', `${remaining} game seconds until commander returns`);
  await expect(strip.locator('.respawning small')).toHaveText(state.paused
    ? 'Paused · abilities unavailable' : 'Abilities unavailable');
  for (const ability of COMMANDERS.warlord.abilities) {
    const button = page.getByRole('button', {name: ability.name, exact: true});
    await expect(button).toBeDisabled();
    await expect(button).toHaveAttribute('aria-label', ability.name);
    await expect(button.locator('b')).toHaveText('Recovering');
    await expect(button).toHaveAttribute('title', /Commander recovering at the keep\./);
    await expect(button).toHaveAttribute('aria-description', /Commander recovering at the keep\./);
    expect(await button.getAttribute('title')).toBe(await button.getAttribute('aria-description'));
  }
  return {...state, remaining};
}

async function expectDisabledInputsInert(page: Page, fixture: Encounter) {
  const before = await snapshot(page, fixture);
  expect(before.paused).toBe(true);
  for (const ability of COMMANDERS.warlord.abilities) {
    const button = page.getByRole('button', {name: ability.name, exact: true});
    await expect(button).toBeDisabled();
    const box = await button.boundingBox(); expect(box).not.toBeNull();
    const point = {x: box!.x + box!.width / 2, y: box!.y + box!.height / 2};
    expect(await page.evaluate(({point, id}) =>
      document.elementFromPoint(point.x, point.y)?.closest('button')?.dataset.id === id,
    {point, id: ability.id})).toBe(true);
    // Coordinate input deliberately reaches the disabled native button without
    // force-clicking, invoking its handler, or removing its disabled state.
    if (await page.evaluate(() => navigator.maxTouchPoints > 0)) await page.touchscreen.tap(point.x, point.y);
    else await page.mouse.click(point.x, point.y);
    await page.keyboard.press(ability.key);
  }
  const after = await snapshot(page, fixture);
  expect(after.pendingCommands, 'Disabled buttons and shortcuts must queue no orders').toEqual(before.pendingCommands);
  expect(after.cooldowns).toEqual(before.cooldowns);
  expect(after.order).toEqual(before.order);
  expect((await readProbe(page)).abilities).toHaveLength(0);
}

async function recoveryGeometry(page: Page) {
  const geometry = await page.evaluate(() => {
    const rect = (element: Element): Rect => {
      const {x, y, width, height} = element.getBoundingClientRect(); return {x, y, width, height};
    };
    const strip = document.querySelector('#commander-strip')!;
    const obstacleSelectors = ['.hud', '.objective-bar', '.minimap-wrap', '.map-controls', '#joystick', '#abilities', '.command-deck'];
    const obstacles = obstacleSelectors.flatMap(selector => {
      const element = document.querySelector(selector);
      if (!element) return [];
      const style = getComputedStyle(element), box = rect(element);
      return style.display === 'none' || style.visibility === 'hidden' || box.width === 0 || box.height === 0
        ? [] : [{selector, ...box}];
    });
    const copy = [...strip.querySelectorAll('.respawning strong,[role="timer"],.respawning small')]
      .map(element => ({text: element.textContent, ...rect(element)}));
    return {strip: rect(strip), copy, obstacles,
      ordinaryBattle: !document.body.matches('.placing-building,.targeting-order,.learning-guide-visible'),
      landscape: innerWidth > 600 && innerHeight <= 500};
  });
  expect(geometry.ordinaryBattle).toBe(true);
  const viewport = page.viewportSize()!, strip = geometry.strip;
  expect(strip.width).toBeGreaterThan(0); expect(strip.height).toBeGreaterThan(0);
  expect(strip.x).toBeGreaterThanOrEqual(0); expect(strip.y).toBeGreaterThanOrEqual(0);
  expect(strip.x + strip.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(strip.y + strip.height).toBeLessThanOrEqual(viewport.height + 1);
  const overlap = (a: Rect, b: Rect) => Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x))
    * Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  for (const copy of geometry.copy) {
    expect(copy.x, copy.text ?? '').toBeGreaterThanOrEqual(strip.x - 1);
    expect(copy.y, copy.text ?? '').toBeGreaterThanOrEqual(strip.y - 1);
    expect(copy.x + copy.width, copy.text ?? '').toBeLessThanOrEqual(strip.x + strip.width + 1);
    expect(copy.y + copy.height, copy.text ?? '').toBeLessThanOrEqual(strip.y + strip.height + 1);
  }
  for (let i = 0; i < geometry.copy.length; i++) for (let j = i + 1; j < geometry.copy.length; j++) {
    expect(overlap(geometry.copy[i], geometry.copy[j]), 'Recovery heading, timer and explanation must not overlap').toBeLessThanOrEqual(1);
  }
  if (geometry.landscape) for (const obstacle of geometry.obstacles) {
    expect(overlap(strip, obstacle), `Recovery status overlaps ${obstacle.selector} in ordinary landscape`).toBeLessThanOrEqual(1);
  }
  return geometry;
}

async function reachRecovered(page: Page, fixture: Encounter, count: number) {
  await setPaused(page, false);
  await expect.poll(async () => (await readProbe(page)).spawns.length,
    {timeout: 40_000, intervals: [100]}).toBe(count);
  await setPaused(page, true);
  const state = await snapshot(page, fixture), probe = await readProbe(page);
  expect(state.hp).toBe(state.maxHp); expect(state.respawnAt).toBeNull();
  expect(probe.spawns[count - 1].time - probe.deaths[count - 1].time).toBeCloseTo(24, 6);
  await expect(page.locator('#commander-strip')).not.toHaveClass(/\brecovering\b/);
  await expect(page.locator('#commander-strip .respawning')).toHaveCount(0);
  await expect(page.locator('#commander-strip [role="timer"]')).toHaveCount(0);
  for (const ability of COMMANDERS.warlord.abilities) {
    const button = page.getByRole('button', {name: ability.name, exact: true});
    await expect(button).toBeEnabled();
    await expect(button).toHaveAttribute('aria-label', ability.name);
    await expect(button.locator('b')).toHaveText(ability.name);
    await expect(button).not.toHaveAttribute('title', /recover|countdown|unavailable/i);
    await expect(button).not.toHaveAttribute('aria-description', /recover|countdown|unavailable/i);
  }
  expect(state.winner).toBeNull();
  return state;
}

async function evidence(page: Page, theme: Theme, name: string, observations: unknown, screenshot = false) {
  const screenshots: string[] = [];
  if (screenshot) {
    const path = test.info().outputPath(`${theme}-${name}-controlled.png`);
    await page.screenshot({path, scale: 'css'});
    await test.info().attach(`${theme}-${name}`, {path, contentType: 'image/png'});
    screenshots.push(path);
  }
  await test.info().attach(`${theme}-${name}.json`, {contentType: 'application/json',
    body: JSON.stringify({controlledRegressionFixture: true, naturalGameplayEvidence: false,
      physicalPhoneEvidence: false, project: test.info().project.name, theme,
      viewport: page.viewportSize(), nativeInput: await page.evaluate(() => navigator.maxTouchPoints > 0 ? 'touch' : 'mouse'),
      timeUnit: 'game seconds', screenshots, observations, probe: await readProbe(page)}, null, 2)});
}

async function useRecoveredAbility(page: Page, fixture: Encounter) {
  const rally = page.getByRole('button', {name: 'Rally', exact: true});
  await expect(rally).toBeEnabled();
  await press(page, rally);
  await expect.poll(async () => (await snapshot(page, fixture)).pendingCommands)
    .toEqual([expect.objectContaining({type: 'ability', team: 0, ability: 'rally'})]);
  await expect(rally.locator('b')).toHaveText('Queued');
  await setPaused(page, false);
  await expect.poll(async () => (await readProbe(page)).abilities.some(event => event.subtype === 'rally'),
    {intervals: [100]}).toBe(true);
  await setPaused(page, true);
  const used = await snapshot(page, fixture);
  expect(used.pendingCommands).toHaveLength(0);
  expect(used.cooldowns.rally).toBeGreaterThan(0);
  expect(used.hp).toBeGreaterThan(0);
  await expect(rally).toHaveAttribute('aria-label', 'Rally');
  await expect(rally).not.toHaveAttribute('aria-description', /recover|unavailable/i);
  return used;
}

for (const theme of ['mythic', 'christmas'] as const) {
  test(`${theme}: recovery disclosure freezes on pause and survives native save and reload`, async ({page}) => {
    test.setTimeout(75_000);
    const fixture = controlledEncounter(), initial = await prepare(page, theme, fixture);
    await reachDeath(page, fixture, 1);
    const paused = await expectRecovery(page, fixture);
    await expectDisabledInputsInert(page, fixture);
    const expanded = await recoveryGeometry(page);
    // This wall-time interval tests pause only. Remaining recovery is always
    // derived from simulation time, never from elapsed wall-clock seconds.
    await page.waitForTimeout(1200);
    const frozen = await expectRecovery(page, fixture);
    expect(frozen.time).toBe(paused.time); expect(frozen.remaining).toBe(paused.remaining);
    await press(page, action(page, 'toggle-deck'));
    const collapsed = await recoveryGeometry(page);
    await press(page, action(page, 'toggle-deck'));
    await setPaused(page, false);
    await expect(page.locator('#commander-strip .respawning small')).toHaveText('Abilities unavailable');
    await expect.poll(async () => (await snapshot(page, fixture)).time, {intervals: [100]})
      .toBeGreaterThanOrEqual(paused.time + 1.2);
    await setPaused(page, true);
    const beforeSave = await expectRecovery(page, fixture);
    expect(beforeSave.remaining).toBeLessThan(paused.remaining);
    const probe = await readProbe(page);
    await press(page, action(page, 'pause-menu'));
    await press(page, action(page, 'save-leave'));
    await expect(action(page, 'continue')).toBeVisible();
    await page.reload();
    await expect(action(page, 'continue')).toBeVisible();
    await press(page, action(page, 'continue'));
    await expect.poll(() => page.evaluate(() => window.__FRONTIER__.state.paused)).toBe(true);
    await installProbe(page, fixture, probe);
    const restored = await expectRecovery(page, fixture);
    expect(restored).toEqual(beforeSave);
    expect(restored.gameSpeed).toBe(1); expect(restored.profile).toBe(initial.profile);
    await expectDisabledInputsInert(page, fixture);
    const restoredGeometry = await recoveryGeometry(page);
    await evidence(page, theme, 'recovery-save-reload', {paused, frozen, beforeSave, restored,
      geometry: {expanded, collapsed, restored: restoredGeometry}}, true);
    const recovered = await reachRecovered(page, fixture, 1);
    expect(recovered.profile).toBe(initial.profile);
    const usedAbility = await useRecoveredAbility(page, fixture);
    await evidence(page, theme, 'recovery-save-respawn', {recovered, usedAbility});
  });

  test(`${theme}: repeated native death and respawn clears and renews recovery reasons`, async ({page}) => {
    test.setTimeout(100_000);
    const fixture = controlledEncounter(true), initial = await prepare(page, theme, fixture);
    const observations = [];
    for (const count of [1, 2]) {
      await reachDeath(page, fixture, count);
      const recovering = await expectRecovery(page, fixture);
      await expectDisabledInputsInert(page, fixture);
      const recovered = await reachRecovered(page, fixture, count);
      expect(recovered.profile).toBe(initial.profile);
      observations.push({cycle: count, recovering, recovered});
    }
    expect((await readProbe(page)).deaths).toHaveLength(2);
    expect((await readProbe(page)).spawns).toHaveLength(2);
    const usedAbility = await useRecoveredAbility(page, fixture);
    await evidence(page, theme, 'recovery-repeated-cycles', {observations, usedAbility});
  });
}
