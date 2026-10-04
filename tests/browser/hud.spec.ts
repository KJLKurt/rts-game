import {getEconomyRates} from '../../src/sim/economy';
import {test,expect,home,launch,action,pause,expectWithinViewport} from './helpers';

/** These are HUD fixtures, not assertions that a real battle earned these stocks or dealt damage. */
test('income stays per game-second and four-digit stock HUD fits desktop, landscape, and a short phone',async({page,isMobile})=>{
 if(isMobile&&page.viewportSize()!.width<page.viewportSize()!.height)await page.setViewportSize({width:390,height:667});
 await launch(page,{difficulty:'easy'});await pause(page);
 // Stock-size fixture only. Deposits, ownership, economy calculation and UI rendering remain real.
 await page.evaluate(()=>{const player=window.__FRONTIER__.state.players[0];player.gold=9876;player.wood=8765;});
 const snapshot=await page.evaluate(()=>window.__FRONTIER__.state),rates=getEconomyRates(snapshot);
 const expected=[{id:'gold',name:'Gold',stock:9876,rate:rates.goldPerSecond},{id:'wood',name:'Wood',stock:8765,rate:rates.woodPerSecond}];
 for(const resource of expected){
  const amount=page.locator(`#${resource.id}`),income=amount.locator('.resource-income');
  await expect(amount).toHaveText(`${resource.stock}+${resource.rate.toFixed(1)}/s`);
  await expect(income).toBeVisible();
  await expect(amount.locator('..')).toHaveAttribute('aria-label',`${resource.name}: ${resource.stock}. Income: ${resource.rate.toFixed(1)} per game second`);
  await expectWithinViewport(page,`#${resource.id}`);
  const layout=await income.evaluate(el=>({width:el.clientWidth,scrollWidth:el.scrollWidth,fontSize:parseFloat(getComputedStyle(el).fontSize)}));
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.width);expect(layout.fontSize).toBeGreaterThanOrEqual(9);
 }
 for(const selector of ['.hud','.resources','#match-time','.pause-button'])await expectWithinViewport(page,selector);
 const geometry=await page.evaluate(()=>{
  const slots=[...document.querySelectorAll('.resources>span')].map(el=>{const r=el.getBoundingClientRect();return{left:r.left,right:r.right};});
  const resources=document.querySelector('.resources')!.getBoundingClientRect(),clock=document.querySelector('#match-time')!.getBoundingClientRect();
  return{slots,resourceRight:resources.right,clockLeft:clock.left,innerWidth,clientWidth:document.documentElement.clientWidth};
 });
 for(let i=1;i<geometry.slots.length;i++)expect(geometry.slots[i-1].right).toBeLessThanOrEqual(geometry.slots[i].left);
 expect(geometry.resourceRight).toBeLessThanOrEqual(geometry.clockLeft);
 expect(geometry.innerWidth).toBe(page.viewportSize()!.width);expect(geometry.clientWidth).toBe(page.viewportSize()!.width);
 await action(page,'panel-orders').click();await action(page,'speed').click();await action(page,'speed').click();await expect(action(page,'speed')).toHaveAccessibleName('2× speed');
 for(const resource of expected)await expect(page.locator(`#${resource.id} .resource-income`)).toHaveText(`+${resource.rate.toFixed(1)}/s`);
 expect(await page.evaluate(()=>window.__FRONTIER__.state.time)).toBe(snapshot.time);
});

test('recent building-damage UI fixture warns with tips off after 200s, freezes expiry, and View only focuses',async({page})=>{
 // Disable tips through the real settings UI, including landscape where the guide is CSS-hidden.
 await home(page);await action(page,'settings').click();await page.locator('#show-tips').uncheck();await action(page,'close-dialog').first().click();
 await launch(page,{difficulty:'easy'});await pause(page);await action(page,'select-army').click();await action(page,'hold').click();
 await expect(page.locator('#battle-hint.critical')).toHaveCount(0);
 // Damage/time fixture: no enemy is spawned or instructed, and no claim is made about battle balance.
 const keep=await page.evaluate(()=>{
  const s=window.__FRONTIER__.state;s.time=205;s.tick=2050;s.accumulator=0;
  const building=s.entities.find(e=>e.team===0&&e.type==='keep')!;building.hp-=100;building.lastHitAt=s.time;
  return{id:building.id,x:building.x,y:building.y};
 });
 const warning=page.locator('#battle-hint.critical');
 const keepView=page.getByRole('button',{name:'Keep under attack · View',exact:true});
 await expect(warning).toHaveAttribute('role','alert');await expect(keepView).toBeVisible();await expectWithinViewport(page,'#battle-hint.critical');
 const selection=await page.locator('#selection-info').innerText();
 const before=await page.evaluate(()=>{const f=window.__FRONTIER__,s=f.state;return{time:s.time,camera:{...f.renderer.camera},pending:s.pendingCommands,log:s.commandLog,orders:s.entities.filter(e=>e.team===0).map(e=>({id:e.id,order:e.order}))};});
 await keepView.click();
 const focused=await page.evaluate(id=>{const f=window.__FRONTIER__,s=f.state,b=s.entities.find(e=>e.id===id)!;return{camera:{...f.renderer.camera},screen:f.renderer.worldToScreen(b.x,b.y),pending:s.pendingCommands,log:s.commandLog,orders:s.entities.filter(e=>e.team===0).map(e=>({id:e.id,order:e.order}))};},keep.id);
 expect(focused.camera).not.toEqual(before.camera);expect(focused.screen.x).toBeCloseTo(page.viewportSize()!.width/2,5);
 expect(focused.screen.y).toBeGreaterThan(0);expect(focused.screen.y).toBeLessThan(page.viewportSize()!.height);
 expect(focused.pending).toEqual(before.pending);expect(focused.log).toEqual(before.log);expect(focused.orders).toEqual(before.orders);
 await expect(page.locator('#selection-info')).toHaveText(selection,{useInnerText:true});
 // The real alert lifetime is six game-seconds. More wall time must not expire it while paused.
 await page.waitForTimeout(6500);expect(await page.evaluate(()=>window.__FRONTIER__.state.time)).toBe(before.time);await expect(keepView).toBeVisible();
 // Move only this fixture's game clock past expiry; simulation remains paused.
 await page.evaluate(()=>{const s=window.__FRONTIER__.state;s.time=211.1;s.tick=2111;s.accumulator=0;});
 await expect(page.locator('#battle-hint.critical')).toHaveCount(0);await expect(page.locator('#battle-hint')).toBeEmpty();
 // Non-Keep structures get their real building name and the same non-commanding View behavior.
 await page.evaluate(()=>{const s=window.__FRONTIER__.state,b=s.entities.find(e=>e.team===0&&e.type==='barracks')!;b.hp-=50;b.lastHitAt=s.time;});
 const barracksView=page.getByRole('button',{name:'Barracks under attack · View',exact:true});await expect(barracksView).toBeVisible();await barracksView.click();
 await expect(page.locator('#selection-info')).toHaveText(selection,{useInnerText:true});
 expect(await page.evaluate(()=>({pending:window.__FRONTIER__.state.pendingCommands,log:window.__FRONTIER__.state.commandLog}))).toEqual({pending:before.pending,log:before.log});
});
