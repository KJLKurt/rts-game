import { test, expect, action, home, launch, pause, acknowledgeFirstBriefing } from './helpers';

test('Credits/About is reachable, honest about provenance, keyboard dismissible and text-scalable', async ({page}) => {
  await home(page);
  await action(page,'about').click();
  const dialog=page.getByRole('dialog',{name:'Credits / About'});
  await expect(dialog).toContainText('v0.1.0');
  await expect(dialog).toContainText('license has not been independently verified');
  await expect(dialog.locator('.soundtrack-credits li')).toHaveCount(18);
  const before=await dialog.locator('.about-version').evaluate(el=>parseFloat(getComputedStyle(el).fontSize));
  await page.screenshot({path:test.info().outputPath('credits-about.png')});
  await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
  await action(page,'settings').click();
  await page.getByLabel('Interface text size',{exact:true}).selectOption('1.3');
  const settings=page.getByRole('dialog',{name:'Settings',exact:true});
  await settings.getByRole('button',{name:'Done',exact:true}).click();await expect(settings).toHaveCount(0);
  await action(page,'about').click();
  const after=await dialog.locator('.about-version').evaluate(el=>parseFloat(getComputedStyle(el).fontSize));
  expect(after).toBeGreaterThan(before*1.25);
  expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
});

test('Research shows construction dependencies, sequential levels and pending orders', async ({page}) => {
  await launch(page);await pause(page);
  await action(page,'panel-research').click();
  await expect(page.locator('.research-node')).toHaveCount(6);
  expect(await page.locator('.research-tree').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
  await expect(page.locator('.research-path')).toContainText(['Barracks','Archery Range','Command Keep']);
  const steel=page.locator('[data-action="research"][data-id="steel"]');
  await expect(steel).toBeDisabled();await expect(steel).toContainText('Requires completed Blacksmith');
  const economy=page.locator('[data-action="research"][data-id="economy"]');
  await expect(economy).toBeEnabled();await economy.click();
  await expect(economy).toBeDisabled();await expect(economy).toContainText('Level 1 in research queue');
  await expect.poll(()=>page.evaluate(()=>window.__FRONTIER__.state.pendingCommands.filter(c=>c.type==='research').length)).toBe(1);
  await page.screenshot({path:test.info().outputPath('research-progression.png')});
});

test('HUD disclosure targets meet 44px and announce current population / expanded state', async ({page}) => {
  await launch(page);await pause(page);
  for(const selector of ['.minimap-toggle','.deck-toggle']) {
    const bounds=await page.locator(selector).boundingBox();
    expect(bounds!.width).toBeGreaterThanOrEqual(44);expect(bounds!.height).toBeGreaterThanOrEqual(44);
  }
  const map=action(page,'toggle-minimap');
  const expanded=await map.getAttribute('aria-expanded');
  await map.click();await expect(map).toHaveAttribute('aria-expanded',String(expanded!=='true'));
  await map.click();await expect(map).toHaveAttribute('aria-expanded',expanded!);
  const pop=page.locator('#population').locator('..');
  await expect(pop).toHaveAccessibleName(/Population: \d+ of \d+ capacity\. Match maximum: \d+/);
});

test('Faction legend explains three distinct material sets independently of team identity', async ({page}) => {
  await home(page);await action(page,'skirmish').click();
  await expect(page.locator('.faction-identity')).toHaveCount(3);
  await page.locator('.faction-legend').scrollIntoViewIfNeeded();
  await expect(page.locator('.faction-key')).toContainText('cross, diamond, circle, square, triangle and saltire');
  await page.screenshot({path:test.info().outputPath('faction-legend.png')});
});

// Deliberately labeled visual fixtures: fresh equal-team matches isolate faction overlays.
for(const faction of ['ironhold','wildborn','arcanists'] as const) test(`visual fixture: ${faction} crest and material overlays`, async ({page}) => {
  await home(page);
  await page.evaluate(faction=>window.__FRONTIER__.start({faction,seed:'FACTION-VISUAL',mapSize:'tiny',difficulty:'easy',startingGold:1000,startingWood:1000}),faction);
  await acknowledgeFirstBriefing(page);await pause(page);
  const dismiss=action(page,'dismiss-tips');if(await dismiss.isVisible())await dismiss.click();
  await expect.poll(()=>page.evaluate(()=>window.__FRONTIER__.state.players[0].faction)).toBe(faction);
  await page.screenshot({path:test.info().outputPath(`faction-${faction}.png`)});
});
