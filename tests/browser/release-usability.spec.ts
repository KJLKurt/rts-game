import {test,expect,home,launch,action,pause,resume,tap,clearGround} from './helpers';

test('visible build identifier agrees in the menu and Credits and survives saved battle reload',async({page})=>{
  await home(page);
  const footer=page.locator('footer [data-build-id]');
  await expect(footer).toBeVisible();
  const id=await footer.getAttribute('data-build-id');
  expect(id).toMatch(/^fc-[0-9a-f]{12}$/);
  await expect(footer).toHaveText(`Build ${id}`);
  await page.screenshot({path:test.info().outputPath('menu-build-id.png'),fullPage:true});
  expect(await footer.evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(11);
  await action(page,'about').click();
  await expect(page.getByRole('dialog',{name:'Credits / About'}).locator('[data-build-id]')).toHaveAttribute('data-build-id',id!);
  await page.screenshot({path:test.info().outputPath('credits-build-id.png')});
  await action(page,'close-dialog').first().click();
  await launch(page);await pause(page);
  const before=await page.evaluate(()=>({seed:window.__FRONTIER__.state.settings.seed,time:window.__FRONTIER__.state.time}));
  await action(page,'pause-menu').click();await action(page,'save-leave').click();
  await expect(action(page,'continue')).toBeVisible();
  await page.reload();await expect(footer).toHaveAttribute('data-build-id',id!);
  await action(page,'continue').click();
  await expect.poll(()=>page.evaluate(()=>window.__FRONTIER__.playing)).toBe(true);
  await expect.poll(()=>page.evaluate(()=>({seed:window.__FRONTIER__.state.settings.seed,time:window.__FRONTIER__.state.time}))).toEqual(before);
  expect(await page.locator('body').evaluate(el=>el.scrollWidth<=innerWidth+1)).toBe(true);
});

test('expanded Recruit queues leave every minimap quadrant clickable without changing the army selection',async({page})=>{
  await launch(page);await pause(page);
  const mapToggle=action(page,'toggle-minimap');
  if(await mapToggle.getAttribute('aria-expanded')==='false')await mapToggle.click();
  await action(page,'panel-army').click();await action(page,'recruit-batch').filter({hasText:'3'}).click();
  await action(page,'recruit').filter({hasText:'Swordsman'}).click();
  await expect(page.locator('.production-list')).toBeVisible();
  await expect(page.locator('.command-deck')).not.toHaveClass(/collapsed/);
  await action(page,'select-army').click();
  const selection=await page.locator('#selection-info').innerText();
  const samples=[[.05,.05],[.95,.05],[.05,.5],[.05,.95],[.95,.95],[.5,.5]];
  for(const [x,y] of samples){
    await expect.poll(()=>page.locator('#minimap').evaluate((el,{x,y})=>{const r=el.getBoundingClientRect();return document.elementFromPoint(r.left+r.width*x,r.top+r.height*y)===el;},{x,y})).toBe(true);
  }
  const r=(await page.locator('#minimap').boundingBox())!;
  await tap(page,{x:r.x+r.width*.05,y:r.y+r.height*.5});
  await expect.poll(()=>page.evaluate(()=>Math.abs(window.__FRONTIER__.renderer.camera.x-window.__FRONTIER__.state.map.width*.05)<.1)).toBe(true);
  await expect.poll(()=>page.locator('#selection-info').innerText()).toBe(selection);
  await page.screenshot({path:test.info().outputPath('expanded-recruit-uncovered-map.png')});
});

test('rally wording identifies current producers and a later range retains its own destination',async({page})=>{
  await launch(page);await pause(page);await action(page,'panel-orders').click();
  await expect(action(page,'rally-all')).toHaveText('Rally current producers here');
  await expect(page.locator('.deck-tip')).toContainText('New buildings need their own rally point');
  await action(page,'rally-all').click();
  await expect(page.locator('[role="status"]').filter({hasText:'Current buildings now send recruits'})).toBeVisible();
  const result=await page.evaluate(()=>({ids:window.__FRONTIER__.state.entities.filter(e=>e.team===0&&e.kind==='building').map(e=>e.id),orders:window.__FRONTIER__.state.pendingCommands.filter(c=>c.type==='rally')}));
  expect(result.orders.map(c=>c.type==='rally'?c.buildingId:null).sort()).toEqual(result.ids.sort());
  await action(page,'panel-build').click();await action(page,'build').filter({hasText:'Archery Range'}).click();
  const ground=await clearGround(page,'range');await tap(page,ground);await action(page,'confirm-placement').click();
  await resume(page);
  await page.waitForFunction(()=>window.__FRONTIER__.state.entities.some(e=>e.team===0&&e.type==='range'&&e.buildProgress===1));
  await pause(page);
  await action(page,'panel-army').click();
  await expect(page.locator('[data-action="recruit"][data-id="archer"] .recruit-producer')).toContainText('commander’s position at completion');
});
