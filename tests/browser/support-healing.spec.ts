import type {Locator, Page} from '@playwright/test';
import type {Battlefield} from '../../src/render/Battlefield';
import type {GameEvent} from '../../src/sim/types';
import {createGame, issueCommand, spawnEntity, updateFog} from '../../src/sim';
import {action, expect, home, test} from './helpers';

type Theme = 'mythic' | 'christmas';
type Encounter = ReturnType<typeof controlledEncounter>;
type Observation = {
  time: number; tick: number; paused: boolean; winner: number | null;
  victim: {hp: number; maxHp: number; respawnAt: number | null} | null;
  woundedHp: number; menderCooldown: number; liveTroops: number;
  losses: number; kills: number; commanderDeaths: number;
  events: GameEvent[]; profile: string;
};
type Probe = {
  firstFrame: Observation | null; latest: Observation | null;
  deaths: GameEvent[]; heals: GameEvent[]; spawns: GameEvent[];
  deathTime: number | null; scheduledRespawn: number | null;
  lastDeadTime: number | null; earlyRevival: boolean;
  firstAliveAfterDeath: {time: number; hp: number; maxHp: number; respawnAt: number | null} | null;
};
type ProbedRenderer = Battlefield & {__qaSupport: Probe};

// Controlled regression fixtures in fresh Playwright contexts, not naturally
// earned battles. Only setup writes state. Combat, pauses, selection and saves
// use native controls; the render probe reads observations without ticking or
// changing the simulation. Three cases x two themes x three device projects.
// Screenshot budget: troop aftermath and commander recovery HUD, one each per
// theme/project. All three cases attach JSON; no broad visual baseline matrix.
function controlledEncounter(commander = false, woundedAlly = true) {
  const state = createGame({seed: 'QA-MENDER-LIVING-TARGET', mapSize: 'medium',
    faction: 'ironhold', commander: 'warlord', difficulty: 'easy', aiPlayers: 1,
    neutralCamps: 0, gameSpeed: 1});
  state.players.forEach(player => { player.ai = false; });
  state.map.tiles.fill('grass');
  state.entities = state.entities.filter(entity => entity.kind === 'building');
  state.entities.forEach(entity => { entity.damage = 0; });
  // Insertion order reproduces the stale spatial-index bug: attacker first,
  // casualty second, living ally third, Mender last.
  const attacker = spawnEntity(state, 1, 'unit', 'swordsman', 24, 24);
  const victim = commander
    ? spawnEntity(state, 0, 'commander', 'warlord', 25, 24)
    : spawnEntity(state, 0, 'unit', 'archer', 25, 24);
  const wounded = spawnEntity(state, 0, 'unit', 'swordsman', 26, 25);
  const mender = spawnEntity(state, 0, 'unit', 'support', 27, 24);
  const hero = commander ? victim : spawnEntity(state, 0, 'commander', 'warlord', 26, 26);
  attacker.damage = 100; attacker.speed = 0; attacker.attackPeriod = 1000;
  victim.hp = 1; wounded.hp = woundedAlly ? 30 : wounded.maxHp;
  for (const entity of [victim, wounded, mender, hero]) {
    entity.damage = 0; entity.order = {type: 'hold'};
  }
  updateFog(state);
  expect(issueCommand(state, {type: 'attack', team: 1, entityIds: [attacker.id], targetId: victim.id}).ok).toBe(true);
  state.events = []; state.paused = true;
  return {state, victimId: victim.id, woundedId: wounded.id, menderId: mender.id,
    commander, woundedAlly, woundedMaxHp: wounded.maxHp,
    initialLosses: state.players[0].stats.unitsLost,
    initialKills: state.players[1].stats.kills,
    initialCommanderDeaths: state.players[0].stats.commanderDeaths};
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
    const frontier = window.__FRONTIER__, renderer = frontier.renderer as unknown as ProbedRenderer;
    const probe: Probe = previous ?? {firstFrame: null, latest: null, deaths: [], heals: [], spawns: [],
      deathTime: null, scheduledRespawn: null, lastDeadTime: null, earlyRevival: false, firstAliveAfterDeath: null};
    renderer.__qaSupport = probe;
    const render = renderer.render;
    renderer.render = function(state, selection, options) {
      // Capture the first advanced render frame instead of racing native Pause
      // against a heal. Event timestamps identify the actual simulation tick.
      const victim = state.entities.find(entity => entity.id === fixture.victimId);
      const observation: Observation = {
        time: state.time, tick: state.tick, paused: state.paused, winner: state.winner,
        victim: victim ? {hp: victim.hp, maxHp: victim.maxHp, respawnAt: victim.respawnAt} : null,
        woundedHp: state.entities.find(entity => entity.id === fixture.woundedId)!.hp,
        menderCooldown: state.entities.find(entity => entity.id === fixture.menderId)!.attackCooldown,
        liveTroops: state.entities.filter(entity => entity.team === 0 && entity.kind === 'unit' && entity.hp > 0).length,
        losses: state.players[0].stats.unitsLost, kills: state.players[1].stats.kills,
        commanderDeaths: state.players[0].stats.commanderDeaths,
        events: structuredClone(state.events), profile: JSON.stringify(frontier.profile),
      };
      probe.latest = observation;
      if (!probe.firstFrame && state.tick > 0) probe.firstFrame = observation;
      for (const event of state.events) {
        if (event.type === 'death' && event.entityId === fixture.victimId && !probe.deaths.some(item => item.id === event.id)) {
          probe.deaths.push({...event}); probe.deathTime ??= event.time;
          probe.scheduledRespawn ??= victim?.respawnAt ?? null;
        }
        if (event.type === 'heal' && !probe.heals.some(item => item.id === event.id)) probe.heals.push({...event});
        if (event.type === 'spawn' && event.entityId === fixture.victimId && !probe.spawns.some(item => item.id === event.id)) probe.spawns.push({...event});
      }
      if (probe.deathTime !== null) {
        if (!victim || victim.hp <= 0) probe.lastDeadTime = state.time;
        else {
          probe.firstAliveAfterDeath ??= {time: state.time, hp: victim.hp, maxHp: victim.maxHp, respawnAt: victim.respawnAt};
          if (probe.scheduledRespawn === null || state.time < probe.scheduledRespawn - 1e-9) probe.earlyRevival = true;
        }
      }
      return render.call(this, state, selection, options);
    };
  }, {fixture, previous});
}

const readProbe = (page: Page) => page.evaluate(() =>
  (window.__FRONTIER__.renderer as unknown as ProbedRenderer).__qaSupport);
const profile = (page: Page) => page.evaluate(() => JSON.stringify(window.__FRONTIER__.profile));

async function prepare(page: Page, theme: Theme, fixture: Encounter) {
  await home(page);
  await press(page, action(page, 'settings'));
  await page.getByLabel('Visual theme', {exact: true}).selectOption(theme);
  await expect.poll(() => page.evaluate(() =>
    (window.__FRONTIER__.renderer as unknown as Battlefield).visualTheme)).toBe(theme);
  await press(page, page.getByRole('button', {name: 'Done', exact: true}));
  await press(page, action(page, 'skirmish'));
  await page.getByLabel('Map seed', {exact: true}).fill('QA-MENDER-LIVING-TARGET');
  await page.locator('select[name="difficulty"]').selectOption('easy');
  await press(page, action(page, 'launch'));
  await expect.poll(() => page.evaluate(() => window.__FRONTIER__.playing)).toBe(true);
  const briefing = page.getByRole('button', {name: 'Start battle', exact: true});
  if (await briefing.count()) await press(page, briefing);
  if (await action(page, 'dismiss-tips').isVisible()) await press(page, action(page, 'dismiss-tips'));
  await setPaused(page, true);
  const initialProfile = await profile(page);
  await page.evaluate(fixture => {
    const frontier = window.__FRONTIER__, renderer = frontier.renderer as unknown as Battlefield;
    Object.assign(frontier.state, fixture.state);
    renderer.invalidateTerrain();
  }, fixture);
  await installProbe(page, fixture);
  await press(page, action(page, 'select-commander'));
  if (!await page.locator('.command-deck').evaluate(element => element.classList.contains('collapsed'))) {
    await press(page, action(page, 'toggle-deck'));
  }
  await expect(action(page, 'pause').locator('.pause-label')).toHaveText('Resume');
  return initialProfile;
}

async function beginEncounter(page: Page) {
  await setPaused(page, false);
  await expect.poll(async () => (await readProbe(page)).firstFrame !== null).toBe(true);
  await setPaused(page, true);
  await expect.poll(async () => (await readProbe(page)).latest?.paused).toBe(true);
  const first = (await readProbe(page)).firstFrame!;
  const death = first.events.find(event => event.type === 'death')!;
  expect(death, 'Native Resume must cause a real lethal encounter').toBeDefined();
  expect(death.time).toBeCloseTo(.1, 6);
  expect(first.time, 'Observe the initial heal before the next cooldown expires').toBeLessThan(death.time + 1.5);
  return first;
}

function expectAccounting(observation: Observation, fixture: Encounter, initialProfile: string) {
  expect(observation.losses).toBe(fixture.initialLosses + (fixture.commander ? 0 : 1));
  expect(observation.kills).toBe(fixture.initialKills + (fixture.commander ? 0 : 1));
  expect(observation.commanderDeaths).toBe(fixture.initialCommanderDeaths + (fixture.commander ? 1 : 0));
  expect(observation.liveTroops).toBe(2);
  expect(observation.winner).toBeNull();
  expect(observation.profile, 'A casualty must not grant profile rewards').toBe(initialProfile);
}

async function extraTicks(page: Page) {
  const start = await page.evaluate(() => window.__FRONTIER__.state.time);
  await setPaused(page, false);
  await expect.poll(() => page.evaluate(() => window.__FRONTIER__.state.time), {intervals: [100]})
    .toBeGreaterThanOrEqual(start + 2);
  await setPaused(page, true);
  await expect.poll(async () => (await readProbe(page)).latest?.paused).toBe(true);
}

async function evidence(page: Page, theme: Theme, name: string, screenshot = false) {
  const probe = await readProbe(page);
  await test.info().attach(`${theme}-${name}.json`, {contentType: 'application/json',
    body: JSON.stringify({controlledRegressionFixture: true, naturalGameplayEvidence: false,
      project: test.info().project.name, theme, viewport: page.viewportSize(),
      nativeInput: await page.evaluate(() => navigator.maxTouchPoints > 0 ? 'touch' : 'mouse'), probe}, null, 2)});
  if (screenshot) {
    const path = test.info().outputPath(`${theme}-${name}-controlled.png`);
    await page.screenshot({path, scale: 'css'});
    await test.info().attach(`${theme}-${name}`, {path, contentType: 'image/png'});
  }
}

for (const theme of ['mythic', 'christmas'] as const) {
  test(`${theme}: controlled lethal troop encounter heals the living ally and counts one loss`, async ({page}) => {
    const fixture = controlledEncounter(), initialProfile = await prepare(page, theme, fixture);
    const first = await beginEncounter(page);
    expect(first.victim).toBeNull();
    expect(first.events.filter(event => event.type === 'death' && event.entityId === fixture.victimId)).toHaveLength(1);
    expect(first.events.filter(event => event.type === 'heal').map(event => event.value)).toEqual([16]);
    expect(first.woundedHp).toBe(46);
    expect(first.menderCooldown).toBeCloseTo(1.5 - (first.time - .1), 6);
    expectAccounting(first, fixture, initialProfile);
    await extraTicks(page);
    const later = await readProbe(page);
    expect(later.deaths).toHaveLength(1); expect(later.earlyRevival).toBe(false);
    expect(later.latest!.victim).toBeNull(); expectAccounting(later.latest!, fixture, initialProfile);
    await press(page, action(page, 'select-army'));
    await expect(page.locator('#selection-info')).toContainText('3 units selected');
    expect(await profile(page)).toBe(initialProfile);
    await evidence(page, theme, 'troop-living-ally', true);
  });

  test(`${theme}: controlled dead-only target spends no Mender healing cooldown`, async ({page}) => {
    const fixture = controlledEncounter(false, false), initialProfile = await prepare(page, theme, fixture);
    const first = await beginEncounter(page);
    expect(first.victim).toBeNull(); expect(first.woundedHp).toBe(fixture.woundedMaxHp);
    expect(first.menderCooldown).toBe(0);
    expect(first.events.filter(event => event.type === 'heal')).toHaveLength(0);
    expectAccounting(first, fixture, initialProfile);
    await extraTicks(page);
    const later = await readProbe(page);
    expect(later.deaths).toHaveLength(1); expect(later.heals).toHaveLength(0);
    expect(later.earlyRevival).toBe(false); expect(later.latest!.victim).toBeNull();
    expect(later.latest!.menderCooldown).toBe(0); expectAccounting(later.latest!, fixture, initialProfile);
    expect(await profile(page)).toBe(initialProfile);
    await evidence(page, theme, 'dead-only-cooldown');
  });

  test(`${theme}: controlled commander death survives native save and reload until its 24-second respawn`, async ({page}) => {
    test.setTimeout(75_000);
    const fixture = controlledEncounter(true), initialProfile = await prepare(page, theme, fixture);
    const first = await beginEncounter(page);
    expect(first.victim?.hp).toBe(0); expect(first.woundedHp).toBe(46);
    expect(first.menderCooldown).toBeCloseTo(1.5 - (first.time - .1), 6);
    expectAccounting(first, fixture, initialProfile);
    const deadline = first.victim!.respawnAt!;
    expect(deadline - first.events.find(event => event.type === 'death')!.time).toBeCloseTo(24, 6);
    await expect(page.locator('#commander-strip .respawning')).toContainText('Commander recovering');
    await expect(page.locator('#commander-strip [data-action="focus"]')).toHaveCount(0);
    await extraTicks(page);
    const beforeSave = await readProbe(page);
    expect(beforeSave.deaths).toHaveLength(1); expect(beforeSave.earlyRevival).toBe(false);
    expect(beforeSave.latest!.victim?.hp).toBe(0);
    await evidence(page, theme, 'commander-recovering', true);
    await press(page, action(page, 'pause-menu'));
    await press(page, action(page, 'save-leave'));
    await expect(action(page, 'continue')).toBeVisible();
    await page.reload();
    await expect(action(page, 'continue')).toBeVisible();
    await press(page, action(page, 'continue'));
    await expect(page.locator('#commander-strip .respawning')).toContainText('Commander recovering');
    await expect.poll(() => page.evaluate(() => window.__FRONTIER__.state.paused)).toBe(true);
    expect(await page.evaluate(() => window.__FRONTIER__.state.settings.gameSpeed)).toBe(1);
    expect(await page.evaluate(id => {
      const state = window.__FRONTIER__.state, victim = state.entities.find(entity => entity.id === id)!;
      return {time: state.time, hp: victim.hp, respawnAt: victim.respawnAt};
    }, fixture.victimId)).toEqual({time: beforeSave.latest!.time, hp: 0, respawnAt: deadline});
    expect(await profile(page)).toBe(initialProfile);
    await installProbe(page, fixture, beforeSave);
    await setPaused(page, false);
    await expect.poll(async () => (await readProbe(page)).firstAliveAfterDeath !== null,
      {timeout: 45_000, intervals: [100]}).toBe(true);
    await setPaused(page, true);
    await expect.poll(async () => (await readProbe(page)).latest?.paused).toBe(true);
    const recovered = await readProbe(page);
    expect(recovered.earlyRevival).toBe(false); expect(recovered.deaths).toHaveLength(1);
    expect(recovered.spawns).toHaveLength(1);
    expect(recovered.spawns[0].time).toBeCloseTo(deadline, 6);
    expect(recovered.lastDeadTime).toBeLessThan(deadline);
    expect(recovered.lastDeadTime).toBeGreaterThanOrEqual(deadline - .2);
    expect(recovered.firstAliveAfterDeath!.time).toBeGreaterThanOrEqual(deadline);
    expect(recovered.firstAliveAfterDeath).toMatchObject({
      hp: first.victim!.maxHp, maxHp: first.victim!.maxHp, respawnAt: null});
    expectAccounting(recovered.latest!, fixture, initialProfile);
    await expect(page.locator('#commander-strip .respawning')).toHaveCount(0);
    await press(page, action(page, 'select-commander'));
    await expect(page.locator('#selection-info')).toContainText('Warlord');
    await expect(page.locator('#selection-info [role="meter"]')).toHaveAttribute('aria-valuenow', String(Math.ceil(first.victim!.maxHp)));
    expect(await profile(page)).toBe(initialProfile);
    await evidence(page, theme, 'commander-restored-and-respawned');
  });
}
