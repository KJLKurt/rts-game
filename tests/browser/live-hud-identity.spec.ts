import {test,expect,action,home,launch,pause} from './helpers';
import type {Page,BrowserContext,Locator} from '@playwright/test';

async function chapter(page:Page) {
  await home(page);await action(page,'campaign').click();
  await page.locator('[data-action="choose-campaign"][data-id="rise-of-the-frontier"]').click();
  await action(page,'mission').first().click();await action(page,'begin-mission').click();await pause(page);
}
async function heldClick(page:Page,context:BrowserContext,control:Locator,isMobile:boolean,delay:number,during?:()=>Promise<void>) {
  const original=await control.elementHandle(),box=(await control.boundingBox())!;
  const x=box.x+box.width/2,y=box.y+box.height/2;
  expect(await control.evaluate(el=>{const r=el.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('[data-action]')===el;})).toBe(true);
  if(isMobile) {
    const cdp=await context.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
    try {await during?.();await page.waitForTimeout(delay);expect(await original!.evaluate(el=>el.isConnected)).toBe(true);}
    finally {await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
  } else {
    await page.mouse.move(x,y);await page.mouse.down();
    try {await during?.();await page.waitForTimeout(delay);expect(await original!.evaluate(el=>el.isConnected)).toBe(true);}
    finally {await page.mouse.up();}
  }
}

test('chapter objectives retain one DOM control across HUD ticks and native held clicks',async({page,context,isMobile})=>{
  await chapter(page);
  const control=action(page,'mission-objectives'),original=await control.elementHandle();
  await page.waitForTimeout(600); // Several genuine HUD updates; no simulation progress fixture.
  expect(await original!.evaluate(el=>el.isConnected&&el===document.querySelector('[data-action="mission-objectives"]'))).toBe(true);
  for(const milliseconds of [108,226,149,320]) {
    await heldClick(page,context,control,isMobile,milliseconds);
    await expect(page.getByRole('dialog',{name:'The Outpost',exact:true})).toBeVisible();
    await expect(page.locator('.mission-objective')).toHaveCount(5);
    await page.getByRole('button',{name:'Close dialog',exact:true}).click();
    expect(await original!.evaluate(el=>el.isConnected)).toBe(true);
  }
});

test('real chapter progress updates the pressed button label without replacing its node',async({page,context,isMobile})=>{
  await chapter(page);
  // Starting deposits already satisfy two objectives. Hold back one of those
  // fixtures, then restore it during the press to exercise a genuine count change.
  await page.evaluate(()=>{window.__FRONTIER__.state.map.nodes.find(node=>node.kind==='gold'&&node.owner===0)!.owner=null;});
  const control=action(page,'mission-objectives');await expect(control).toContainText('1 / 5');
  await heldClick(page,context,control,isMobile,80,async()=>{
    // Explicit objective-readout fixture, not a claim that gameplay captured the deposit.
    await page.evaluate(()=>{window.__FRONTIER__.state.map.nodes.find(node=>node.kind==='gold')!.owner=0;});
    await expect(control).toContainText('2 / 5');
  });
  await expect(page.getByRole('dialog',{name:'The Outpost',exact:true})).toBeVisible();
  await expect(page.locator('.mission-objective.complete')).toHaveCount(2);
});

test('commander health updates retain focus and the native Focus commander control',async({page,context,isMobile})=>{
  test.skip((page.viewportSize()?.height??900)<500,'The separate commander strip intentionally hides in short landscape.');
  await launch(page,{difficulty:'easy'});await pause(page);
  const control=page.locator('#commander-strip [data-action="focus"]'),original=await control.elementHandle();
  await control.focus();
  const health=await page.evaluate(()=>{const c=window.__FRONTIER__.state.entities.find(e=>e.team===0&&e.kind==='commander')!;c.hp-=7;return Math.ceil(c.hp);});
  await expect(control.locator('small')).toHaveText(String(health));
  expect(await original!.evaluate(el=>el.isConnected&&el===document.activeElement)).toBe(true);
  await heldClick(page,context,control,isMobile,300);
  expect(await original!.evaluate(el=>el.isConnected)).toBe(true);
});

test('Rush status changes preserve the upgrade button even when the deck signature changes',async({page,context,isMobile})=>{
  await home(page);await action(page,'rush').click();await action(page,'launch-rush').click();await pause(page);
  await action(page,'toggle-deck').click();
  // Explicit ready-offer fixture; selection still runs through the real UI.
  await page.evaluate(()=>{const r=window.__FRONTIER__.state.rush!;r.upgradeAvailable=1;r.offeredUpgrades=['blade','bulwark','fleet'];});
  const control=action(page,'rush-upgrade');await expect(control).toBeVisible();
  const original=await control.elementHandle();
  await page.evaluate(()=>{const s=window.__FRONTIER__.state;s.rush!.nextWaveAt+=7;s.players[0].maxPopulation+=1;});
  await page.waitForTimeout(300);
  expect(await original!.evaluate(el=>el.isConnected)).toBe(true);
  await heldClick(page,context,control,isMobile,300);
  await expect(action(page,'choose-rush-upgrade')).toHaveCount(3);
});
