import { test, expect, action, launch, pause, tap, clearGround } from './helpers';

test('an explicitly opened panel retains card identity through the next HUD tick and held pointer',async({page,context,isMobile})=>{
  await launch(page,{difficulty:'easy'});await pause(page);
  await action(page,'select-commander').click();await action(page,'order-move').click();
  await tap(page,await clearGround(page));
  await expect.poll(()=>page.evaluate(()=>window.__FRONTIER__.state.pendingCommands.length)).toBe(1);
  await expect.poll(()=>page.evaluate(()=>(window.__FRONTIER__.renderer as unknown as {atlas:{ready:boolean}}).atlas.ready)).toBe(true);
  await action(page,'panel-build').click();
  const house=page.locator('#deck-content [data-action="build"][data-id="house"]');
  const original=await house.elementHandle();
  await page.waitForTimeout(300); // Longer than the220ms HUD cadence, with paused state stable.
  expect(await original!.evaluate(el=>el.isConnected&&el===document.querySelector('#deck-content [data-action="build"][data-id="house"]'))).toBe(true);
  const rect=(await house.boundingBox())!,x=rect.x+rect.width/2,y=rect.y+rect.height/2;
  if(isMobile){
    const cdp=await context.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
    try {
      await page.waitForTimeout(300);
      expect(await original!.evaluate(el=>el.isConnected)).toBe(true);
    } finally {await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
  } else {
    await page.mouse.move(x,y);await page.mouse.down();
    try {await page.waitForTimeout(300);expect(await original!.evaluate(el=>el.isConnected)).toBe(true);}
    finally {await page.mouse.up();}
  }
  await expect(page.locator('body')).toHaveClass(/placing-building/);
  await expect(page.locator('#placement-controls')).toContainText('Place House');
  await expect(page.locator('#toast')).toContainText('Drag the House preview');
  expect(await page.evaluate(()=>window.__FRONTIER__.state.pendingCommands.map(command=>command.type))).toEqual(['move']);
});

test('a real affordability change still invalidates the deck after signature synchronization',async({page})=>{
  await launch(page,{difficulty:'easy'});await pause(page);await action(page,'panel-army').click();
  const soldier=page.locator('[data-action="recruit"][data-id="swordsman"]'),original=await soldier.elementHandle();
  await expect(soldier).not.toHaveClass(/funds-low/);
  // Explicit state fixture exercises a real, required signature change while time is paused.
  await page.evaluate(()=>{const player=window.__FRONTIER__.state.players[0];player.gold=0;player.wood=0;});
  await expect(soldier).toHaveClass(/funds-low/);
  expect(await original!.evaluate(el=>el.isConnected)).toBe(false);
});
