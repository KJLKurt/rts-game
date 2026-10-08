import {action,clearGround,expect,launch,pause,resume,tap,test} from './helpers';
import type {Locator,Page} from '@playwright/test';

async function native(page:Page,control:Locator) {
  await control.scrollIntoViewIfNeeded(); const r=await control.boundingBox();expect(r).not.toBeNull();
  await tap(page,{x:r!.x+r!.width/2,y:r!.y+r!.height/2});
}
async function picker(page:Page) {
  await action(page,'panel-orders').click();await action(page,'choose-troops').click();
  await expect(page.getByRole('dialog',{name:'Choose troops',exact:true})).toBeVisible();
}
const typeRow=(page:Page,type:string)=>page.locator(`[data-troop-type="${type}"]`).locator('..');
async function fixture(page:Page) {
  await launch(page,{commander:'ranger',difficulty:'easy'});await pause(page);
  // Explicit mechanic fixture: one extra Archer allows individual subset checks.
  return page.evaluate(()=>{
    const s=window.__FRONTIER__.state;s.players.forEach(p=>p.ai=false);
    const archer=s.entities.find(e=>e.team===0&&e.type==='archer')!,spear=s.entities.find(e=>e.team===0&&e.type==='spearman')!,hero=s.entities.find(e=>e.team===0&&e.kind==='commander')!;
    const extra={...structuredClone(archer),id:'qa-extra-archer',x:archer.x+.8,hp:Math.min(75,archer.maxHp)};
    s.entities.push(extra);s.players[0].population+=1;
    return{archer:archer.id,extra:extra.id,spear:spear.id,hero:hero.id};
  });
}

test('native troop sheet selects an arbitrary subset and preserves separate queued orders through reload',async({page})=>{
  const ids=await fixture(page);await picker(page);
  const before=await page.evaluate(()=>({tick:window.__FRONTIER__.state.tick,pauses:window.__FRONTIER__.state.players[0].stats.pauses,pending:window.__FRONTIER__.state.pendingCommands}));
  await native(page,action(page,'troop-select-none'));await native(page,typeRow(page,'archer'));
  const group=page.locator('[data-troop-group="archer"]');await native(page,group.locator('summary'));
  await native(page,page.locator(`[data-troop-id="${ids.extra}"]`).locator('..'));
  expect(await page.locator('[data-troop-type="archer"]').evaluate((el:HTMLInputElement)=>el.indeterminate)).toBe(true);
  await native(page,typeRow(page,'spearman'));
  await expect(page.locator('#troop-selection-count')).toHaveText('2 selected');
  await native(page,action(page,'troop-select-apply'));
  expect(await page.evaluate(()=>({tick:window.__FRONTIER__.state.tick,pauses:window.__FRONTIER__.state.players[0].stats.pauses,pending:window.__FRONTIER__.state.pendingCommands}))).toEqual(before);
  await expect(page.locator('#selection-info')).toContainText('2 units selected');
  await action(page,'hold').click();
  let commands=await page.evaluate(()=>window.__FRONTIER__.state.pendingCommands);
  expect(commands).toHaveLength(1);expect(commands[0]).toMatchObject({type:'hold',entityIds:[ids.spear,ids.archer]});
  await picker(page);await native(page,action(page,'troop-select-none'));await native(page,typeRow(page,'ranger'));await native(page,action(page,'troop-select-apply'));
  await action(page,'order-move').click();await tap(page,await clearGround(page));
  commands=await page.evaluate(()=>window.__FRONTIER__.state.pendingCommands);
  expect(commands).toHaveLength(2);expect(commands[1]).toMatchObject({type:'move',entityIds:[ids.hero]});
  expect(commands[0]).toMatchObject({type:'hold',entityIds:[ids.spear,ids.archer]});
  await action(page,'pause-menu').click();await action(page,'save-leave').click();await expect(action(page,'continue')).toBeVisible();await page.reload();await action(page,'continue').click();await expect(page.locator('.hud')).toBeVisible();
  expect(await page.evaluate(()=>window.__FRONTIER__.state.pendingCommands)).toEqual(commands);
  await picker(page);await expect(page.locator('[data-troop-type="ranger"]')).toBeChecked();await expect(page.locator('[data-troop-type="archer"]')).not.toBeChecked();
  await page.screenshot({path:test.info().outputPath('subset-restored-command-snapshot.png')});
});

test('Cancel and Escape discard troop drafts while Apply cancels only an unsubmitted target',async({page})=>{
  const ids=await fixture(page);await action(page,'order-move').click();await picker(page);
  await native(page,action(page,'troop-select-all'));await native(page,page.getByRole('button',{name:'Cancel',exact:true}));
  await expect(action(page,'order-move')).toHaveAttribute('aria-pressed','true');
  await expect(action(page,'choose-troops')).toBeFocused();
  await picker(page);await expect(page.locator('[data-troop-type="ranger"]')).toBeChecked();await expect(page.locator('[data-troop-type="archer"]')).not.toBeChecked();await native(page,action(page,'troop-select-none'));await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog',{name:'Choose troops',exact:true})).toHaveCount(0);await expect(action(page,'order-move')).toHaveAttribute('aria-pressed','true');
  await expect(action(page,'choose-troops')).toBeFocused();
  await picker(page);await expect(page.locator('[data-troop-type="ranger"]')).toBeChecked();await expect(page.locator('[data-troop-type="archer"]')).not.toBeChecked();await native(page,action(page,'troop-select-none'));await native(page,typeRow(page,'archer'));await native(page,action(page,'troop-select-apply'));
  await expect(action(page,'order-move')).toHaveAttribute('aria-pressed','false');
  expect(await page.evaluate(()=>window.__FRONTIER__.state.pendingCommands)).toEqual([]);
  await action(page,'hold').click();const command=await page.evaluate(()=>window.__FRONTIER__.state.pendingCommands.at(-1));
  expect(command).toMatchObject({type:'hold',entityIds:[ids.archer,ids.extra]});
});

test('scrolling and cancelling the troop sheet never replaces an active movement order',async({page})=>{
  const ids=await fixture(page);await action(page,'order-move').click();await tap(page,await clearGround(page));await resume(page);await pause(page);
  const before=await page.evaluate(id=>({order:window.__FRONTIER__.state.entities.find(e=>e.id===id)!.order,log:window.__FRONTIER__.state.commandLog,pending:window.__FRONTIER__.state.pendingCommands}),ids.hero);
  expect(before.order.type).toBe('move');await picker(page);
  await page.keyboard.press('ArrowDown');await page.keyboard.press('s');await page.keyboard.press('ArrowUp');
  await native(page,page.getByRole('button',{name:'Cancel',exact:true}));
  expect(await page.evaluate(id=>({order:window.__FRONTIER__.state.entities.find(e=>e.id===id)!.order,log:window.__FRONTIER__.state.commandLog,pending:window.__FRONTIER__.state.pendingCommands}),ids.hero)).toEqual(before);
});

test('the live troop sheet freezes safely and preserves its draft through explicit interruption recovery',async({page})=>{
  await launch(page,{commander:'ranger',difficulty:'brutal'});
  await expect.poll(()=>page.evaluate(()=>window.__FRONTIER__.state.time)).toBeGreaterThan(0);
  await picker(page);const before=await page.evaluate(()=>({time:window.__FRONTIER__.state.time,paused:window.__FRONTIER__.state.paused,pauses:window.__FRONTIER__.state.players[0].stats.pauses,pending:window.__FRONTIER__.state.pendingCommands}));
  expect(before.paused).toBe(false);await native(page,action(page,'troop-select-none'));
  await page.waitForTimeout(250);
  expect(await page.evaluate(()=>window.__FRONTIER__.state.time)).toBe(before.time);
  // Browser-lifecycle fixture, not a physical-device backgrounding claim.
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await expect(page.getByRole('dialog',{name:'Battle suspended',exact:true})).toBeVisible();
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await action(page,'resume-app').click();
  await expect(page.getByRole('dialog',{name:'Choose troops',exact:true})).toBeVisible();await expect(page.locator('#troop-selection-count')).toHaveText('0 selected');
  expect(await page.evaluate(()=>({time:window.__FRONTIER__.state.time,paused:window.__FRONTIER__.state.paused,pauses:window.__FRONTIER__.state.players[0].stats.pauses,pending:window.__FRONTIER__.state.pendingCommands}))).toEqual(before);
  await native(page,page.getByRole('button',{name:'Cancel',exact:true}));await expect(action(page,'choose-troops')).toBeFocused();
  await expect.poll(()=>page.evaluate(()=>window.__FRONTIER__.state.time)).toBeGreaterThan(before.time);
});

test('troop sheet fits narrow and large-text viewports with native targets, scrolling and keyboard focus',async({page})=>{
  await fixture(page);await action(page,'pause-menu').click();await action(page,'settings').click();await page.getByLabel('Interface text size',{exact:true}).selectOption('1.3');await page.getByRole('button',{name:'Done',exact:true}).click();
  const viewport=page.viewportSize()!,widths=viewport.width<600?[320,360,390]:[viewport.width];
  for(const width of widths){
    await page.setViewportSize({width,height:viewport.height});await picker(page);
    const root=page.getByRole('dialog',{name:'Choose troops',exact:true});
    const geometry=await root.evaluate(el=>{const r=el.getBoundingClientRect();return{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:innerWidth,height:innerHeight,overflow:el.scrollWidth-el.clientWidth};});
    expect(geometry.left).toBeGreaterThanOrEqual(0);expect(geometry.top).toBeGreaterThanOrEqual(0);expect(geometry.right).toBeLessThanOrEqual(geometry.width);expect(geometry.bottom).toBeLessThanOrEqual(geometry.height);expect(geometry.overflow).toBeLessThanOrEqual(1);
    for(const control of await root.locator('.troop-type-row,summary,.troop-picker-footer button').all()){
      await control.scrollIntoViewIfNeeded();const r=await control.boundingBox();expect(r!.height).toBeGreaterThanOrEqual(44);
    }
    const closedSummary=page.locator('[data-troop-group="ranger"] summary');await closedSummary.focus();await page.keyboard.press('Tab');await expect(page.locator('[data-troop-type="swordsman"]')).toBeFocused();await page.keyboard.press('Shift+Tab');await expect(closedSummary).toBeFocused();
    await native(page,page.locator('[data-troop-group="archer"] summary'));
    await native(page,page.locator('[data-troop-group="archer"] .troop-unit-row').first());
    const close=page.getByRole('button',{name:'Close dialog',exact:true}),apply=action(page,'troop-select-apply');
    await apply.focus();await page.keyboard.press('Tab');await expect(close).toBeFocused();await page.keyboard.press('Shift+Tab');await expect(apply).toBeFocused();
    await page.screenshot({path:test.info().outputPath(`troop-sheet-${width}px-large-text.png`)});
    await native(page,apply);await expect(root).toHaveCount(0);await expect(action(page,'choose-troops')).toBeFocused();
  }
  await page.setViewportSize(viewport);
});

async function paintedUnit(page:Page,id:string){
  return page.evaluate(id=>{
    const {state:s,renderer:r}=window.__FRONTIER__,entity=s.entities.find(e=>e.id===id)!,center=r.worldToScreen(entity.x,entity.y);
    for(let dy=-18;dy>=-75;dy-=4)for(let dx=-28;dx<=28;dx+=4){
      const p={x:center.x+dx,y:center.y+dy};
      if([-2,0,2].every(x=>[-2,0,2].every(y=>(r.pick(s,p.x+x,p.y+y) as {id?:string}|null)?.id===id))&&document.elementFromPoint(p.x,p.y)?.id==='world')return p;
    }
    throw new Error(`Fixture found no exposed painted body for ${id}.`);
  },id);
}
test('desktop Shift-click toggles troops and keeps ordinary clicks and armed Move precedence',async({page})=>{
  test.skip(await page.evaluate(()=>navigator.maxTouchPoints>0),'Shift-click is the desktop mouse affordance; touch uses the troop sheet.');
  const ids=await fixture(page);await picker(page);await native(page,action(page,'troop-select-none'));await native(page,action(page,'troop-select-apply'));
  if(await action(page,'toggle-deck').getAttribute('aria-expanded')==='true')await action(page,'toggle-deck').click();
  const shiftTap=async(id:string)=>{const p=await paintedUnit(page,id);await page.keyboard.down('Shift');try{await page.mouse.click(p.x,p.y);}finally{await page.keyboard.up('Shift');}};
  await shiftTap(ids.archer);await expect(page.locator('#selection-info')).toContainText('Archer');
  await shiftTap(ids.spear);await expect(page.locator('#selection-info')).toContainText('2 units selected');
  await shiftTap(ids.archer);await expect(page.locator('#selection-info')).toContainText('Spearman');
  await tap(page,await paintedUnit(page,ids.archer));await expect(page.locator('#selection-info')).toContainText('Archer');
  const ground=await clearGround(page);await page.keyboard.down('Shift');await page.mouse.click(ground.x,ground.y);await page.keyboard.up('Shift');await expect(page.locator('#selection-info')).toContainText('Archer');
  await action(page,'order-move').click();await shiftTap(ids.spear);
  const command=await page.evaluate(()=>window.__FRONTIER__.state.pendingCommands.at(-1));expect(command).toMatchObject({type:'move',entityIds:[ids.archer]});
});
