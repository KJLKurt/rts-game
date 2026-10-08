import {test,expect,action,launch,pause,tap,clearGround,home} from './helpers';
import type {Page,BrowserContext} from '@playwright/test';
import {writeFile} from 'node:fs/promises';

async function drag(page:Page,context:BrowserContext,p:{x:number;y:number}) {
 const cameraBefore=await page.evaluate(()=>({...window.__FRONTIER__.renderer.camera}));
 await page.evaluate(()=>{(window as any).__APPROVED_DRAG_EVENTS__=[];for(const name of ['pointerdown','pointermove','pointerup','pointercancel'])document.addEventListener(name,event=>{const e=event as PointerEvent,t=e.target as HTMLElement;(window as any).__APPROVED_DRAG_EVENTS__.push({type:e.type,target:t?.id,tag:t?.tagName,action:t?.closest('[data-action]')?.getAttribute('data-action'),x:e.clientX,y:e.clientY});},true);});
 if(await page.evaluate(()=>navigator.maxTouchPoints>0)) {
  const cdp=await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p]});
  for(let i=1;i<=5;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:p.x+8*i,y:p.y+4*i}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
  await cdp.detach();
 } else {await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(p.x+40,p.y+20,{steps:5});await page.mouse.up();}
 await writeFile(test.info().outputPath('native-drag-pointer-observation.json'),JSON.stringify({point:p,cameraBefore,cameraAfter:await page.evaluate(()=>({...window.__FRONTIER__.renderer.camera})),events:await page.evaluate(()=>(window as any).__APPROVED_DRAG_EVENTS__)},null,2));
}
async function focusWorld(page:Page,p:{x:number;y:number}) {
 const size=await page.evaluate(()=>({w:window.__FRONTIER__.state.map.width,h:window.__FRONTIER__.state.map.height}));
 const box=(await page.locator('#minimap').boundingBox())!;
 const mapPoint={x:box.x+p.x/size.w*box.width,y:box.y+p.y/size.h*box.height};
 expect(await page.evaluate(p=>document.elementFromPoint(p.x,p.y)?.id,mapPoint)).toBe('minimap');
 await tap(page,mapPoint);
 await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
 return page.evaluate(p=>{const q=window.__FRONTIER__.renderer.worldToScreen(p.x,p.y);if(document.elementFromPoint(q.x,q.y)?.id!=='world')throw Error('Native target must be uncovered');return q;},p);
}
async function pickOwnBuilding(page:Page,type:string) {
 const entity=await page.evaluate(type=>window.__FRONTIER__.state.entities.find(e=>e.team===0&&e.kind==='building'&&e.type===type&&e.hp>0)!,type);
 await focusWorld(page,entity);
 const point=await page.evaluate(id=>{const f=window.__FRONTIER__,e=f.state.entities.find(e=>e.id===id)!,g=f.renderer.worldToScreen(e.x,e.y);for(let y=g.y-100;y<g.y+8;y+=3)for(let x=g.x-80;x<g.x+80;x+=3)if([[0,0],[-2,0],[2,0],[0,-2],[0,2]].every(([dx,dy])=>document.elementFromPoint(x+dx,y+dy)?.id==='world'&&(f.renderer.pick(f.state,x+dx,y+dy) as any)?.id===id))return{x,y};throw Error('No native building body');},entity.id);
 await tap(page,point);return entity;
}

test('battlefield readouts distinguish costs, live health and unavailable building actions',async({page})=>{
 await launch(page,{difficulty:'easy'});await pause(page);await action(page,'select-commander').click();
 const meter=page.locator('#selection-info [role=meter]');
 const move=action(page,'order-move'),moveNode=await move.elementHandle();
 // Explicit health-readout fixture; this does not claim naturally received damage.
 const hp=await page.evaluate(()=>{const c=window.__FRONTIER__.state.entities.find(e=>e.team===0&&e.kind==='commander')!;c.hp=c.maxHp/2;return Math.ceil(c.hp);});
 await expect(meter).toHaveAttribute('aria-valuenow',String(hp));
 await expect(meter.locator('i')).toHaveAttribute('style','width:50.00%');
 expect(await moveNode!.evaluate(el=>el.isConnected)).toBe(true);
 const pop=await page.evaluate(()=>{const p=window.__FRONTIER__.state.players[0];return `${p.population}/${p.populationCap}`;});
 await expect(page.locator('#population')).toContainText(pop);
 const colors=await page.evaluate(()=>['gold','wood','population'].map(r=>getComputedStyle(document.querySelector(`.hud [data-resource="${r}"] > .icon`)!).color));
 expect(new Set(colors).size).toBe(3);
 await action(page,'panel-build').click();
 const house=page.getByRole('button',{name:'Build House',exact:true});
 await expect(house.locator('.cost [data-resource=gold]')).toHaveCount(0);
 await expect(house.locator('.cost [data-resource=wood]')).toContainText('65');
 await expect(house.locator('.resource-name')).toHaveText('wood');
 await house.click();await expect(page.locator('.placement-toolbar .cost')).toContainText('wood');
 await action(page,'cancel-build').click();await expect(page.locator('#toast')).not.toContainText('Drag the House preview');
 await pickOwnBuilding(page,'keep');
 const train=page.locator('#deck-content [data-action=recruit][data-id=swordsman]');
 await expect(train).toBeEnabled();
 // Explicit balance fixtures verify presentation thresholds; purchases still use native controls below.
 await page.evaluate(()=>{const p=window.__FRONTIER__.state.players[0];p.gold=0;p.wood=0;});
 await expect(train).toBeDisabled();
 await expect(train.locator('..')).toContainText('Requires 45 gold and 10 wood total.');
 const blockedNode=await train.elementHandle();
 await page.evaluate(()=>{const p=window.__FRONTIER__.state.players[0];p.gold=1;p.wood=1;});
 await page.waitForTimeout(300);
 expect(await blockedNode!.evaluate(el=>el.isConnected)).toBe(true);
 await page.locator('[data-action=inspect-tab][data-id=upgrades]').click();
 const research=page.locator('#deck-content [data-action=research][data-id=economy]');
 await expect(research).toBeDisabled();await expect(action(page,'upgrade-building')).toBeDisabled();
 await page.screenshot({path:test.info().outputPath('readable-blocked-building-decisions.png')});
 await page.evaluate(()=>{const p=window.__FRONTIER__.state.players[0];p.gold=2000;p.wood=2000;});
 await expect(research).toBeEnabled();await expect(action(page,'upgrade-building')).toBeEnabled();
 // Explicit full tactical-queue fixture checks live metadata separate from its projected snapshot.
 await page.evaluate(()=>{const s=window.__FRONTIER__.state,id=s.entities.find(e=>e.team===0&&e.kind==='commander')!.id;s.pendingCommands=Array.from({length:60},()=>({type:'hold',team:0,entityIds:[id]}));});
 await expect(research).toBeDisabled();await expect(action(page,'upgrade-building')).toBeDisabled();
 await expect(research.locator('..')).toContainText('Tactical queue full (60/60)');
 await page.evaluate(()=>{window.__FRONTIER__.state.pendingCommands=[];});
 await expect(research).toBeEnabled();
 await page.locator('[data-action=inspect-tab][data-id=train]').click();
 await train.click();
 expect(await page.evaluate(()=>window.__FRONTIER__.state.pendingCommands.filter(c=>c.type==='recruit').length)).toBe(1);
 await expect(page.locator('#compact-production')).toContainText('1 queued');
 await expect(page.locator('#selection-info')).toContainText('1 queued');
 await page.screenshot({path:test.info().outputPath('readable-paid-building-decisions.png')});
});

test('approved explicit commands keep neutral taps, panning, invalid Attack and Cancel from ordering troops',async({page,context,isMobile})=>{
 await launch(page,{difficulty:'easy'});await pause(page);
 await tap(page,await clearGround(page));
 await expect(page.locator('#selection-info')).toContainText('Select a unit');
 await expect(action(page,'order-move')).toBeDisabled();
 expect(await page.evaluate(()=>window.__FRONTIER__.state.pendingCommands)).toEqual([]);
 await action(page,'select-commander').click();await action(page,'order-move').click();
 await expect(page.locator('.target-toolbar')).toContainText('Move · tap a destination');
 const toast=page.locator('#toast.show');await expect(toast).toBeVisible();
 const feedback=await toast.boundingBox(),hud=(await page.locator('.hud').boundingBox())!;
 expect(feedback!.y,'Transient order feedback must remain below the full measured HUD').toBeGreaterThanOrEqual(hud.y+hud.height+7);

 const ground=await clearGround(page),before=await page.evaluate(()=>({...window.__FRONTIER__.renderer.camera}));
 await drag(page,context,ground);
 expect(await page.evaluate(()=>({...window.__FRONTIER__.renderer.camera}))).not.toEqual(before);
 expect(await page.evaluate(()=>window.__FRONTIER__.state.pendingCommands)).toEqual([]);
 await expect(action(page,'cancel-order')).toBeVisible();
 if(isMobile) {
  const cdp=await context.newCDPSession(page),p=await clearGround(page);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:p.x-12,y:p.y},{x:p.x+12,y:p.y}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:p.x-24,y:p.y},{x:p.x+24,y:p.y}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
  expect(await page.evaluate(()=>window.__FRONTIER__.state.pendingCommands)).toEqual([]);
 }
 await tap(page,await clearGround(page));
 expect(await page.evaluate(()=>window.__FRONTIER__.state.pendingCommands.map(c=>c.type))).toEqual(['move']);
 await expect(page.locator('#target-controls')).toBeEmpty();
 await action(page,'order-attack').click();await tap(page,await clearGround(page));
 await expect(page.locator('.target-toolbar')).toContainText('Choose an enemy');
 expect(await page.evaluate(()=>window.__FRONTIER__.state.pendingCommands.map(c=>c.type))).toEqual(['move']);
 await action(page,'cancel-order').click();await expect(page.locator('#target-controls')).toBeEmpty();
 await action(page,'hold').click();expect(await page.evaluate(()=>window.__FRONTIER__.state.pendingCommands.map(c=>c.type))).toEqual(['move','hold']);
 await page.screenshot({path:test.info().outputPath('explicit-native-orders-paused.png')});
});

test('approved building tabs, paid production, compact queue and saved paused orders use native controls',async({page})=>{
 await launch(page,{difficulty:'easy'});await pause(page);const keep=await pickOwnBuilding(page,'keep');
 await expect(page.locator('[data-action=inspect-tab][data-id=train]')).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:'Train Swordsman here',exact:true}).dblclick();
 expect(await page.evaluate(()=>window.__FRONTIER__.state.pendingCommands.filter(c=>c.type==='recruit').length)).toBe(2);
 await page.locator('[data-action=inspect-tab][data-id=upgrades]').click();
 await expect(page.locator('.inspect-section').filter({has:action(page,'upgrade-building')})).toBeVisible();
 await action(page,'toggle-deck').click();await expect(page.locator('#compact-production')).toContainText('2 queued');
 const before=await page.evaluate(()=>structuredClone(window.__FRONTIER__.state));
 await action(page,'pause-menu').click();await action(page,'save-leave').click();await expect(action(page,'continue')).toBeVisible();await page.reload();await action(page,'continue').click();
 await expect.poll(()=>page.evaluate(()=>window.__FRONTIER__.playing && window.__FRONTIER__.state.paused)).toBe(true);
 expect(await page.evaluate(()=>structuredClone(window.__FRONTIER__.state))).toEqual(before);
 await writeFile(test.info().outputPath('native-paid-queue-save-proof.json'),JSON.stringify({keep:keep.id,before,after:await page.evaluate(()=>window.__FRONTIER__.state),wholeStateExact:true},null,2));
 await page.screenshot({path:test.info().outputPath('compact-queue-restored.png')});
});

test('approved placement pans independently, explains blocked terrain, spends only on Confirm and revalidates funds',async({page,context})=>{
 await launch(page,{difficulty:'easy'});await pause(page);
 const before=await page.evaluate(()=>({gold:window.__FRONTIER__.state.players[0].gold,wood:window.__FRONTIER__.state.players[0].wood,pending:window.__FRONTIER__.state.pendingCommands}));
 await action(page,'panel-build').click();await page.getByRole('button',{name:'Build House',exact:true}).click();
 await action(page,'placement-pan').click();const c=await page.evaluate(()=>({...window.__FRONTIER__.renderer.camera}));
 const panStart=await page.evaluate(()=>{const hud=document.querySelector('.hud')!.getBoundingClientRect(),footer=document.querySelector('.placement-toolbar')!.getBoundingClientRect(),points=[];for(let y=hud.bottom+60;y<footer.top-40;y+=20)for(let x=40;x<innerWidth-80;x+=20){let clear=true;for(let i=0;i<=5;i++)for(const [dx,dy] of [[0,0],[-12,-12],[12,-12],[-12,12],[12,12]])if(document.elementFromPoint(x+8*i+dx,y+4*i+dy)?.id!=='world')clear=false;if(clear)points.push({x,y,d:Math.hypot(x-innerWidth/2,y-innerHeight/2)});}points.sort((a,b)=>a.d-b.d);if(!points.length)throw Error('No uncovered native Pan corridor');return points[0];});
 await drag(page,context,panStart);
 await expect.poll(()=>page.evaluate(()=>({...window.__FRONTIER__.renderer.camera}))).not.toEqual(c);
 expect(await page.evaluate(()=>({gold:window.__FRONTIER__.state.players[0].gold,wood:window.__FRONTIER__.state.players[0].wood,pending:window.__FRONTIER__.state.pendingCommands}))).toEqual(before);
 await action(page,'placement-place').click();await expect(action(page,'placement-place')).toHaveAttribute('aria-pressed','true');
 const keep=await page.evaluate(()=>window.__FRONTIER__.state.entities.find(e=>e.team===0&&e.type==='keep')!);await tap(page,await focusWorld(page,keep));
 await expect(action(page,'confirm-placement')).toBeDisabled();await expect(page.locator('.placement-toolbar [role=status]')).toContainText('Nothing spent yet');
 await expect(page.locator('.placement-status')).toHaveAttribute('data-placement-state','blocked');
 expect(await page.locator('.placement-status').textContent()).not.toContain('..');
 await page.screenshot({path:test.info().outputPath('blocked-placement-reason.png')});
 await tap(page,await clearGround(page,'house'));await expect(action(page,'confirm-placement')).toBeEnabled();
 await expect(page.locator('.placement-status')).toHaveAttribute('data-placement-state','valid');
 // Explicit balance-change fixture isolates revalidation while a preview is open.
 await page.evaluate(()=>{window.__FRONTIER__.state.players[0].wood=0;});
 await expect(action(page,'confirm-placement')).toBeDisabled();await expect(page.locator('.placement-toolbar [role=status]')).toContainText('wood');
 await page.locator('#placement-controls [data-action=cancel-build]').click();expect(await page.evaluate(()=>window.__FRONTIER__.state.pendingCommands)).toEqual([]);
 await page.evaluate(wood=>{window.__FRONTIER__.state.players[0].wood=wood;},before.wood);
 await action(page,'panel-build').click();await page.getByRole('button',{name:'Build House',exact:true}).click();
 await tap(page,await clearGround(page,'house'));await action(page,'confirm-placement').click();
 expect(await page.evaluate(()=>window.__FRONTIER__.state.pendingCommands.filter(c=>c.type==='build').length)).toBe(1);
 await page.screenshot({path:test.info().outputPath('one-confirmed-paused-build.png')});
});

test('approved phone sheets keep logical targets, resource values and map space at three widths and enlarged text',async({page,isMobile})=>{
 test.skip(!isMobile || page.viewportSize()!.width>600,'Portrait phone matrix only');test.setTimeout(90_000);
 await launch(page,{difficulty:'easy'});await pause(page);const proofs=[];
 const originalFunds=await page.evaluate(()=>({gold:window.__FRONTIER__.state.players[0].gold,wood:window.__FRONTIER__.state.players[0].wood}));
 for(const [w,h] of [[360,800],[390,844],[430,932]]) {
  await page.setViewportSize({width:w,height:h});
  await action(page,'pause-menu').click();await action(page,'settings').click();await page.getByLabel('Interface text size',{exact:true}).selectOption('1.3');await page.getByRole('button',{name:'Done',exact:true}).click();
  for(const panel of ['panel-army','panel-build','panel-research','placement','inspect-train','inspect-upgrades']) {
   if(panel==='placement') {await action(page,'panel-build').click();await page.getByRole('button',{name:'Build House',exact:true}).click();}
   else if(panel.startsWith('inspect-')) {if(panel==='inspect-train') {if(!(await page.locator('#selection-info').textContent())?.includes('Command Keep'))await pickOwnBuilding(page,'keep');else await action(page,'panel-inspect').click();}await expect(page.locator('#selection-info')).toContainText('Command Keep');await page.locator(`[data-action=inspect-tab][data-id=${panel==='inspect-train'?'train':'upgrades'}]`).click();await page.evaluate(()=>{const p=window.__FRONTIER__.state.players[0];p.gold=0;p.wood=0;});await expect(page.locator('.inspect-section:not([hidden]) .availability-reason').first()).toBeVisible();}
   else await action(page,panel).click();
   const proof=await page.evaluate(()=>{
    const hud=document.querySelector('.hud')!.getBoundingClientRect(),deck=document.querySelector('.command-deck')!.getBoundingClientRect();
    const controls=[...document.querySelectorAll('#screen button')].map(e=>{const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;let clipped=false;for(let p=e.parentElement;p;p=p.parentElement){const s=getComputedStyle(p),b=p.getBoundingClientRect();if(/auto|scroll|hidden|clip/.test(s.overflowY)&&!(y>=b.top&&y<=b.bottom))clipped=true;}return{action:(e as HTMLElement).dataset.action,w:r.width,h:r.height,left:r.left,right:r.right,top:r.top,bottom:r.bottom,clipped,receivesInput:e.contains(document.elementFromPoint(x,y))};}).filter(r=>r.w>0&&r.h>0&&r.top>=0&&r.bottom<=innerHeight&&!r.clipped);
    return{hud:hud.toJSON(),deck:deck.toJSON(),controls,width:innerWidth,height:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth};
   });
   expect(proof.overflow).toBe(false);expect(proof.deck.height).toBeLessThanOrEqual(h*.46);
   for(const control of proof.controls){expect(control.w,control.action).toBeGreaterThanOrEqual(43.99);expect(control.h,control.action).toBeGreaterThanOrEqual(43.99);expect(control.left).toBeGreaterThanOrEqual(0);expect(control.right).toBeLessThanOrEqual(w);expect(control.receivesInput,`${control.action} must receive its tap`).toBe(true);}
   await expect(page.locator('#gold .resource-income')).toBeVisible();await expect(page.locator('#wood .resource-income')).toBeVisible();
   await page.screenshot({path:test.info().outputPath(`${w}-large-text-${panel}.png`)});proofs.push({panel,...proof});
   if(panel==='placement')await page.locator('#placement-controls [data-action=cancel-build]').click();
   if(panel.startsWith('inspect-'))await page.evaluate(funds=>{Object.assign(window.__FRONTIER__.state.players[0],funds);},originalFunds);
  }
 }
 await writeFile(test.info().outputPath('three-phone-logical-target-proof.json'),JSON.stringify(proofs,null,2));
});

test('approved targeting cancels when its selected commander is lost without submitting an order',async({page})=>{
 await launch(page,{difficulty:'easy'});await pause(page);await action(page,'select-commander').click();await action(page,'order-attack').click();
 // Explicit entity-loss fixture isolates UI recovery; this is not a natural combat outcome.
 await page.evaluate(()=>{window.__FRONTIER__.state.entities.find(e=>e.team===0&&e.kind==='commander')!.hp=0;});
 await expect(page.locator('#target-controls')).toBeEmpty();await expect(action(page,'order-move')).toBeDisabled();
 expect(await page.evaluate(()=>window.__FRONTIER__.state.pendingCommands)).toEqual([]);
 await expect(page.locator('#toast')).toContainText('no longer available');
});

test('approved guide Skip persists without earned completion and Replay restores the actual lesson',async({page})=>{
 await home(page);await action(page,'learn').click();await action(page,'begin-briefing').click();await pause(page);
 await action(page,'skip-guide').click();await expect(action(page,'replay-guide')).toBeVisible();
 await expect(page.getByRole('dialog',{name:'Your settlement is ready'})).toHaveCount(0);
 expect(await page.evaluate(()=>window.__FRONTIER__.profile.games)).toBe(0);
 await action(page,'panel-army').click();await expect(page.getByRole('button',{name:'Recruit Swordsman',exact:true})).toBeVisible();
 await action(page,'pause-menu').click();await action(page,'save-leave').click();await expect(action(page,'continue')).toBeVisible();await page.reload();await action(page,'continue').click();
 await expect(action(page,'replay-guide')).toBeVisible();await expect(page.getByRole('dialog',{name:'Your settlement is ready'})).toHaveCount(0);
 await action(page,'replay-guide').click();await expect(page.locator('#battle-hint > span')).toHaveText('LEARN TO COMMAND · 1/8');
 expect(await page.evaluate(()=>window.__FRONTIER__.profile.games)).toBe(0);
});

test('approved editor touch cancellation and pinch discard an unfinished stroke while a completed stroke remains one Undo',async({page,context,isMobile})=>{
 test.skip(!isMobile,'Touch cancellation matrix');await home(page);await action(page,'editor').click();await action(page,'new-editor').click();
 await action(page,'brush-road').click();await action(page,'toggle-editor-tools').click();
 const original=await page.evaluate(()=>structuredClone(window.__FRONTIER__.state.map.tiles));
 const point=await page.evaluate(()=>{for(let y=140;y<innerHeight-140;y+=20)for(let x=180;x<innerWidth-80;x+=20)if(document.elementFromPoint(x,y)?.id==='world'&&document.elementFromPoint(x+40,y+10)?.id==='world')return{x,y};throw Error('No native paint canvas');});
 const cdp=await context.newCDPSession(page);
 for(const cancel of ['cancel','pinch']) {
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:point.x+20,y:point.y+10}]});
  if(cancel==='cancel')await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
  else {await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:point.x+20,y:point.y+10},{x:point.x+50,y:point.y+10}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:point.x+10,y:point.y+10},{x:point.x+65,y:point.y+10}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
  expect(await page.evaluate(()=>window.__FRONTIER__.state.map.tiles)).toEqual(original);
 }
 await drag(page,context,point);expect(await page.evaluate(()=>window.__FRONTIER__.state.map.tiles)).not.toEqual(original);
 await action(page,'toggle-editor-tools').click();await action(page,'editor-undo').click();expect(await page.evaluate(()=>window.__FRONTIER__.state.map.tiles)).toEqual(original);
 await cdp.detach();await page.screenshot({path:test.info().outputPath('native-editor-cancel-pinch-one-undo.png')});
});
