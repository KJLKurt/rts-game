import {test,expect,launch,action,pause,resume,clearGround,tap,commander} from './helpers';
import {createGame,spawnEntity,issueCommand,stepGame} from '../../src/sim';

test('native Keep distance gives a player ranged force the shared spacing behavior',async({page})=>{
 test.setTimeout(50_000);
 await launch(page,{commander:'ranger'});await pause(page);
 // Explicit controlled arena; outcomes here are not campaign wins or paid recruitment.
 const fixture=createGame({seed:'BROWSER-SPACING-COUNTER',mapSize:'medium',aiPlayers:2,faction:'wildborn',commander:'ranger',difficulty:'normal',scriptedVictory:true});
 fixture.players.forEach(p=>p.ai=false);fixture.map.tiles.fill('grass');fixture.navigationVersion++;
 fixture.entities=fixture.entities.filter(e=>e.kind==='building');fixture.entities.forEach(e=>{e.damage=0;e.range=0;});
 const ours=[],theirs=[];
 for(let i=0;i<15;i++)ours.push(spawnEntity(fixture,0,'unit','archer',20.5,27.5+(i%9-4)*.62));
 for(let i=0;i<10;i++)theirs.push(spawnEntity(fixture,2,'unit','swordsman',30.5,27.5+(i%9-4)*.62));
 issueCommand(fixture,{type:'attackMove',team:2,entityIds:theirs.map(e=>e.id),x:20.5,y:27.5});stepGame(fixture,.1);fixture.paused=true;
 await page.evaluate(fixture=>{const f=window.__FRONTIER__;Object.assign(f.state,fixture);const r=f.renderer as any;r.camera.zoom=.6;r.centerOn(25.5,27.5);},fixture);
 await action(page,'select-army').click();await action(page,'panel-orders').click();
 const stance=action(page,'ranged-spacing');await expect(stance).toHaveText('Keep distance: off');await expect(stance).toHaveAttribute('aria-pressed','false');
 const before=await page.evaluate(()=>{const s=window.__FRONTIER__.state;return{gold:s.players[0].gold,wood:s.players[0].wood,stats:s.entities.filter(e=>e.team===0&&e.kind==='unit').map(e=>({id:e.id,hp:e.hp,maxHp:e.maxHp,damage:e.damage,speed:e.speed,range:e.range}))};});
 await stance.click();await expect(stance).toHaveText('Keep distance: on');await expect(stance).toHaveAttribute('aria-pressed','true');await expect(page.locator('.ranged-spacing-status')).toHaveText('Keep distance on');
 expect(await page.evaluate(()=>window.__FRONTIER__.state.pendingCommands)).toEqual([{type:'rangedSpacing',team:0,enabled:true}]);
 await action(page,'order-attackMove').click();
 if(!await page.locator('.command-deck').evaluate(el=>el.classList.contains('collapsed')))await action(page,'toggle-deck').click();
 // Focus the same exact combat destination using native minimap input before tapping.
 // The compact command toolbar legitimately covers the old fixed screen coordinate.
 if(await page.locator('.minimap-wrap').evaluate(el=>el.classList.contains('collapsed')))await action(page,'toggle-minimap').click();
 const mini=(await page.locator('#minimap').boundingBox())!,size=await page.evaluate(()=>({w:window.__FRONTIER__.state.map.width,h:window.__FRONTIER__.state.map.height}));
 const focusPoint={x:mini.x+31/size.w*mini.width,y:mini.y+27.5/size.h*mini.height};
 expect(await page.evaluate(p=>document.elementFromPoint(p.x,p.y)?.id,focusPoint)).toBe('minimap');
 await tap(page,focusPoint);await action(page,'toggle-minimap').click();
 await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
 expect(await page.evaluate(()=>window.__FRONTIER__.state.pendingCommands.map(c=>c.type))).toEqual(['rangedSpacing']);
 const point=await page.evaluate(()=>{const p=window.__FRONTIER__.renderer.worldToScreen(31,27.5);return{...p,hit:document.elementFromPoint(p.x,p.y)?.id};});
 expect(point.hit).toBe('world');await tap(page,point);
 expect(await page.evaluate(()=>window.__FRONTIER__.state.pendingCommands.map(c=>c.type))).toEqual(['rangedSpacing','attackMove']);
 expect(await page.evaluate(()=>{const s=window.__FRONTIER__.state;return{gold:s.players[0].gold,wood:s.players[0].wood,stats:s.entities.filter(e=>e.team===0&&e.kind==='unit').map(e=>({id:e.id,hp:e.hp,maxHp:e.maxHp,damage:e.damage,speed:e.speed,range:e.range}))};})).toEqual(before);
 await resume(page);
 await expect.poll(()=>page.evaluate(()=>window.__FRONTIER__.state.entities.filter(e=>e.team===0&&e.skirmishAnchor).length),{timeout:12_000}).toBeGreaterThan(0);
 await page.screenshot({path:test.info().outputPath('player-ranged-spacing-active.png')});
 await expect.poll(()=>page.evaluate(()=>window.__FRONTIER__.state.entities.filter(e=>e.team===2&&e.kind==='unit'&&e.hp>0).length),{timeout:25_000}).toBe(0);
 await pause(page);const result=await page.evaluate(()=>{const s=window.__FRONTIER__.state;return{time:s.time,friendlySurvivors:s.entities.filter(e=>e.team===0&&e.kind==='unit'&&e.hp>0).length,rangedSpacing:s.players[0].rangedSpacing,ai:s.players[0].ai,winner:s.winner};});
 expect(result.friendlySurvivors).toBeGreaterThan(0);expect(result.rangedSpacing).toBe(true);expect(result.ai).toBe(false);expect(result.winner).toBeNull();
 await page.screenshot({path:test.info().outputPath('controlled-player-counter-complete.png')});await test.info().attach('controlled-counter-result',{body:JSON.stringify({presentationAndCombatFixture:true,naturalWin:false,nativeSpacingAndAttackMove:true,before,result}),contentType:'application/json'});
});

test('queued ranged stance saves exactly and includes future troops without changing currency',async({page})=>{
 await launch(page,{commander:'ranger'});await pause(page);await action(page,'panel-orders').click();
 await action(page,'ranged-spacing').click();await expect(action(page,'ranged-spacing')).toHaveAttribute('aria-pressed','true');
 await action(page,'select-commander').click();await expect(page.locator('.ranged-spacing-status')).toHaveText('Keep distance on');
 const before=await page.evaluate(()=>JSON.stringify(window.__FRONTIER__.state));
 await action(page,'pause-menu').click();await action(page,'save-leave').click();await expect(action(page,'continue')).toBeVisible();await page.reload();await action(page,'continue').click();
 await expect.poll(()=>page.evaluate(()=>window.__FRONTIER__.playing)).toBe(true);expect(await page.evaluate(()=>JSON.stringify(window.__FRONTIER__.state))).toBe(before);
 await action(page,'panel-orders').click();await expect(action(page,'ranged-spacing')).toHaveText('Keep distance: on');
 await resume(page);await expect.poll(()=>page.evaluate(()=>window.__FRONTIER__.state.players[0].rangedSpacing)).toBe(true);await pause(page);
 await action(page,'ranged-spacing').click();await expect(action(page,'ranged-spacing')).toHaveText('Keep distance: off');
 expect(await page.evaluate(()=>window.__FRONTIER__.state.players[0].rangedSpacing)).toBe(true);await resume(page);await expect.poll(()=>page.evaluate(()=>window.__FRONTIER__.state.players[0].rangedSpacing)).toBe(false);
});

test('ranged stance is visible at large text while native Move and Hold retain priority',async({page,isMobile})=>{
 await launch(page,{commander:'ranger'});await pause(page);await action(page,'panel-orders').click();await action(page,'ranged-spacing').click();
 await action(page,'select-commander').click();await action(page,'hold').click();await expect(page.locator('.current-order')).toContainText('Hold: stay here');await expect(page.locator('.ranged-spacing-status')).toHaveText('Hold: spacing off');
 await action(page,'pause-menu').click();await action(page,'settings').click();await page.locator('#ui-scale').selectOption('1.3');await page.getByRole('button',{name:'Done',exact:true}).click();
 await expect(action(page,'ranged-spacing')).toHaveText('Keep distance: on');await expect(page.locator('.deck-tip')).toContainText('Move, Hold and direct commander control take priority');
 const box=await action(page,'ranged-spacing').boundingBox();expect(box!.height).toBeGreaterThanOrEqual(44);expect(box!.width).toBeGreaterThanOrEqual(44);
 expect(await page.locator('.ranged-spacing-status').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
 if(isMobile){
  const joystick=(await page.locator('#joystick').boundingBox())!,hud=(await page.locator('.hud').boundingBox())!;
  expect(joystick.y).toBeGreaterThanOrEqual(hud.y+hud.height);
  expect(await page.locator('.selection-info strong').evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));})).toBe(true);
 }
 await action(page,'ranged-spacing').scrollIntoViewIfNeeded();await page.screenshot({path:test.info().outputPath('stance-control-130-text.png')});
 await action(page,'order-move').click();if(!await page.locator('.command-deck').evaluate(el=>el.classList.contains('collapsed')))await action(page,'toggle-deck').click();
 const origin=await commander(page);await action(page,'order-move').click();await tap(page,await clearGround(page));await expect(page.locator('.current-order')).toContainText('Move to');await expect(page.locator('.ranged-spacing-status')).toHaveText('Move: spacing off');
 await resume(page);await expect.poll(async()=>{const hero=await commander(page);return Math.hypot(hero.x-origin.x,hero.y-origin.y);}).toBeGreaterThan(1.2);
 expect(await page.evaluate(()=>window.__FRONTIER__.state.entities.find(e=>e.team===0&&e.kind==='commander')!.skirmishAnchor)).toBeUndefined();
 if(isMobile){
  const before=await commander(page),b=(await page.locator('#joystick').boundingBox())!,cdp=await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x+b.width/2+29,y:b.y+b.height/2}]});
  try{
   await expect.poll(async()=>{const c=await commander(page);return Math.hypot(c.x-before.x,c.y-before.y);}).toBeGreaterThan(.4);
   expect(await page.evaluate(()=>{const c=window.__FRONTIER__.state.entities.find(e=>e.team===0&&e.kind==='commander')!;return !!c.directControl&&!c.skirmishAnchor;})).toBe(true);
  }finally{await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});}
 }
});
