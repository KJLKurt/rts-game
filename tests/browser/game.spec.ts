import {getUnitCost} from '../../src/sim';
import {snapConstruction} from '../../src/sim/construction';
import {plannedBuildResult} from '../../src/ui/placement';
import {test,expect,action,home,launch,commander,tap,clearGround,pause,resume,expectWithinViewport,acknowledgeFirstBriefing,setSlider} from './helpers';

test('home navigation, dismissals, and repeated setup preserve choices',async({page})=>{
 await home(page);
 await expect(page.getByRole('heading',{name:/FRONTIER COMMAND/})).toBeVisible();
 await action(page,'help').click();await expect(page.getByRole('dialog')).toHaveAccessibleName('Command the frontier');
 await action(page,'close-dialog').first().click();await expect(page.getByRole('dialog')).toHaveCount(0);
 await action(page,'skirmish').click();await page.getByLabel('Map seed',{exact:true}).fill('PERSIST-SETUP');
 await page.locator('select[name="biome"]').selectOption('snow');
 await page.locator('[data-action="choose-commander"][data-id="ranger"]').click();
 await expect(page.getByLabel('Map seed',{exact:true})).toHaveValue('PERSIST-SETUP');
 await expect(page.locator('select[name="biome"]')).toHaveValue('snow');
 await expect(page.locator('[data-id="ranger"].commander-card')).toHaveClass(/chosen/);
 await action(page,'home').click();await action(page,'record').click();
 await expect(page.locator('.achievement-grid').first().locator('.achievement')).toHaveCount(30);
 await action(page,'home').click();await action(page,'expedition').click();
 await expect(page.locator('[data-action="expedition-start"][data-id="balanced"]')).toBeVisible();
});

test('skirmish launches at the repository path with configured values',async({page})=>{
 await launch(page,{commander:'engineer'});
 expect(new URL(page.url()).pathname).toBe('/rts-game/');
 const s=await page.evaluate(()=>{const s=window.__FRONTIER__.state;return{seed:s.settings.seed,commander:s.settings.commander,players:s.players.length,map:s.map.validation.valid};});
 expect(s).toEqual({seed:'QA-FRONTIER-2026',commander:'engineer',players:2,map:true});
 await expect(page.getByRole('button',{name:'Runic Turret',exact:true})).toBeVisible();
 await page.screenshot({path:test.info().outputPath('battlefield.png')});
});

test('real battlefield tap selects and moves the commander',async({page})=>{
 await launch(page);await action(page,'select-commander').click();const before=await commander(page);
 await action(page,'order-move').click();await tap(page,await clearGround(page));
 await expect.poll(async()=>{const c=await commander(page);return Math.hypot(c.x-before.x,c.y-before.y);}).toBeGreaterThan(.5);
 await action(page,'select-army').click();
 await expect(page.locator('#selection-info')).toContainText('5 units selected');
 await action(page,'hold').click();
 await expect.poll(()=>page.evaluate(()=>window.__FRONTIER__.state.entities.filter(e=>e.team===0&&e.kind!=='building').every(e=>e.order.type==='hold'))).toBe(true);
});

test('desktop keyboard movement and space pause work',async({page,isMobile})=>{
 test.skip(isMobile,'Keyboard test is desktop-specific.');await launch(page);const before=await commander(page);
 await page.keyboard.down('d');try{await expect.poll(async()=>{const c=await commander(page);return Math.hypot(c.x-before.x,c.y-before.y);}).toBeGreaterThan(.4);}finally{await page.keyboard.up('d');}
 await page.keyboard.press('Space');await expect.poll(()=>page.evaluate(()=>window.__FRONTIER__.state.paused)).toBe(true);
 await page.keyboard.press('Space');await expect.poll(()=>page.evaluate(()=>window.__FRONTIER__.state.paused)).toBe(false);
});

test('phone thumbstick works in either orientation and cancels on interruption',async({page,isMobile,context})=>{
 test.skip(!isMobile,'Touch joystick is phone-specific.');await launch(page);
 await expect(page.locator('#joystick')).toBeVisible();await expectWithinViewport(page,'#joystick');
 const box=(await page.locator('#joystick').boundingBox())!;const x=box.x+box.width/2,y=box.y+box.height/2;
 const before=await commander(page);const cdp=await context.newCDPSession(page);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x+29,y}]});
 try{await expect.poll(async()=>{const c=await commander(page);return Math.hypot(c.x-before.x,c.y-before.y);}).toBeGreaterThan(.4);}finally{await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});}
 await expect(page.locator('.joystick-stick')).not.toHaveAttribute('style',/translate\([^0]/);
 await pause(page);const frozen=await commander(page);await page.waitForTimeout(350);expect(await commander(page)).toEqual(frozen);
});

test('recruitment charges once and produces a soldier',async({page})=>{
 await launch(page);await pause(page);
 const snapshot=await page.evaluate(()=>window.__FRONTIER__.state),before=snapshot.players[0],price=getUnitCost(snapshot,0,'swordsman');
 await expect(page.locator('.command-deck')).toHaveClass(/collapsed/);
 await action(page,'panel-army').click();await expect(page.locator('.command-deck')).not.toHaveClass(/collapsed/);
 const recruit=page.getByRole('button',{name:'Recruit Swordsman',exact:true});await expect(recruit).toBeVisible();await recruit.click();
 await expect.poll(()=>page.evaluate(()=>window.__FRONTIER__.state.pendingCommands.filter(c=>c.type==='recruit').length)).toBe(1);
 expect(await page.evaluate(()=>({gold:window.__FRONTIER__.state.players[0].gold,wood:window.__FRONTIER__.state.players[0].wood}))).toEqual({gold:before.gold,wood:before.wood});
 await resume(page);
 await expect.poll(()=>page.evaluate(()=>window.__FRONTIER__.state.entities.filter(e=>e.team===0).flatMap(e=>e.queue).filter(q=>q.id==='swordsman').length)).toBe(1);
 // Exercise actual production time rather than replacing recruitment with a debug command.
 await expect.poll(()=>page.evaluate(()=>window.__FRONTIER__.state.players[0].stats.unitsCreated),{timeout:15_000}).toBe(before.stats.unitsCreated+1);
 const after=await page.evaluate(()=>window.__FRONTIER__.state.players[0]);
 // Real income continues while training; subtract its recorded deltas to isolate the one purchase.
 expect(before.gold+(after.stats.goldCollected-before.stats.goldCollected)-after.gold).toBeCloseTo(price.gold,6);
 expect(before.wood+(after.stats.woodCollected-before.stats.woodCollected)-after.wood).toBeCloseTo(price.wood,6);
});

test('tactical pause freezes simulation and queues move, build, and research',async({page})=>{
 await launch(page);await pause(page);
 const time=await page.evaluate(()=>window.__FRONTIER__.state.time);const before=await commander(page);
 await action(page,'order-move').click();await tap(page,await clearGround(page));
 await action(page,'panel-build').click();await page.getByRole('button',{name:'Build House',exact:true}).click();
 const stocks=await page.evaluate(()=>({gold:window.__FRONTIER__.state.players[0].gold,wood:window.__FRONTIER__.state.players[0].wood}));
 await tap(page,await clearGround(page,true));
 expect(await page.evaluate(()=>window.__FRONTIER__.state.pendingCommands.map(c=>c.type))).toEqual(['move']);
 expect(await page.evaluate(()=>window.__FRONTIER__.state.entities.some(e=>e.team===0&&e.type==='house'))).toBe(false);
 expect(await page.evaluate(()=>({gold:window.__FRONTIER__.state.players[0].gold,wood:window.__FRONTIER__.state.players[0].wood}))).toEqual(stocks);
 await expect(action(page,'confirm-placement')).toBeEnabled();await action(page,'confirm-placement').click();
 await expect(page.getByRole('status')).toContainText('House planned. Resume to build.');
 expect(await page.evaluate(()=>window.__FRONTIER__.state.entities.some(e=>e.team===0&&e.type==='house'))).toBe(false);
 await action(page,'panel-research').click();await page.locator('[data-action="research"][data-id="economy"]').click();
 await expect.poll(()=>page.evaluate(()=>window.__FRONTIER__.state.pendingCommands.map(c=>c.type))).toEqual(['move','build','research']);
 await page.waitForTimeout(400);expect(await page.evaluate(()=>window.__FRONTIER__.state.time)).toBe(time);
 expect(await commander(page)).toEqual(before);
 await resume(page);
 await expect.poll(()=>page.evaluate(()=>window.__FRONTIER__.state.pendingCommands.length)).toBe(0);
 await expect.poll(()=>page.evaluate(()=>window.__FRONTIER__.state.entities.some(e=>e.team===0&&e.type==='house'))).toBe(true);
 await expect.poll(async()=>{const c=await commander(page);return Math.hypot(c.x-before.x,c.y-before.y);}).toBeGreaterThan(.3);
});

test('cancel build, reopen build, and cancel again does not spend resources',async({page})=>{
 await launch(page);await pause(page);
 const before=await page.evaluate(()=>({gold:window.__FRONTIER__.state.players[0].gold,wood:window.__FRONTIER__.state.players[0].wood}));
 for(const container of ['#placement-controls','#placement-controls']){
  await action(page,'panel-build').click();
  await page.getByRole('button',{name:'Build House',exact:true}).click();await expect(page.locator('#selection-info')).toContainText('Place House');
  await page.locator(`${container} [data-action="cancel-build"]`).click();await expect(page.locator('#selection-info')).not.toContainText('Place House');
  await expect(page.locator('#placement-controls')).toBeEmpty();await expect(page.locator('body')).not.toHaveClass(/placing-building/);
  expect(await page.evaluate(()=>({gold:window.__FRONTIER__.state.players[0].gold,wood:window.__FRONTIER__.state.players[0].wood}))).toEqual(before);
  expect(await page.evaluate(()=>window.__FRONTIER__.state.pendingCommands.length)).toBe(0);
 }
 expect(await page.evaluate(()=>({gold:window.__FRONTIER__.state.players[0].gold,wood:window.__FRONTIER__.state.players[0].wood}))).toEqual(before);
 expect(await page.evaluate(()=>window.__FRONTIER__.state.pendingCommands.length)).toBe(0);
});

test('manual save, leave, refresh, and repeated continue retain queued orders',async({page})=>{
 await launch(page);await pause(page);await action(page,'order-move').click();await tap(page,await clearGround(page));
 const expected=await page.evaluate(()=>{const s=window.__FRONTIER__.state;return{seed:s.settings.seed,time:s.time,pending:s.pendingCommands};});
 await action(page,'pause-menu').click();await action(page,'save-leave').click();await expect(action(page,'continue')).toBeVisible();
 for(let i=0;i<2;i++){
  await page.reload();await action(page,'continue').click();
  await expect.poll(()=>page.evaluate(()=>window.__FRONTIER__.playing)).toBe(true);
  const restored=await page.evaluate(()=>{const s=window.__FRONTIER__.state;return{seed:s.settings.seed,time:s.time,pending:s.pendingCommands};});
  expect(restored).toEqual(expected);await expect(page.locator('#paused-ribbon')).toBeVisible();
  if(i===0){await action(page,'pause-menu').click();await action(page,'save-leave').click();}
 }
 await resume(page);await expect.poll(()=>page.evaluate(()=>window.__FRONTIER__.state.pendingCommands.length)).toBe(0);
});

test('campaign briefing, pause, save, and continue keep mission identity',async({page})=>{
 await home(page);await action(page,'campaign').click();
 const story=page.locator('[data-action="choose-campaign"][data-id="rise-of-the-frontier"]');if(await story.count())await story.click();
 await expect(page.locator('[data-action="mission"]')).toHaveCount(5);
 await expect(page.locator('.mission-card').nth(1)).toBeDisabled();await page.locator('.mission-card').first().click();
 await expect(page.getByRole('dialog')).toBeVisible();
 const frozen=await page.evaluate(()=>{const s=window.__FRONTIER__.state;return{time:s.time,tick:s.tick,entities:s.entities};});
 await page.waitForTimeout(500);
 expect(await page.evaluate(()=>{const s=window.__FRONTIER__.state;return{time:s.time,tick:s.tick,entities:s.entities};})).toEqual(frozen);
 await action(page,'begin-mission').click();await expect(page.getByRole('dialog')).toHaveCount(0);
 await expect.poll(()=>page.evaluate(()=>window.__FRONTIER__.state.time)).toBeGreaterThan(frozen.time);
 const seed=await page.evaluate(()=>window.__FRONTIER__.state.settings.seed);
 await action(page,'pause-menu').click();await action(page,'save-leave').click();await page.reload();await action(page,'continue').click();
 await expect.poll(()=>page.evaluate(()=>window.__FRONTIER__.state.settings.seed)).toBe(seed);
 expect(await page.evaluate(()=>window.__FRONTIER__.state.triggers.length)).toBeGreaterThan(0);
});

test('settings persist through refresh and reopening dialogs',async({page})=>{
 await home(page);await action(page,'settings').click();
 await setSlider(page,'#master-slider',.4);await page.locator('#mute-audio').check();
 await setSlider(page,'#music-slider',.1);await setSlider(page,'#sfx-slider',.2);await page.locator('#reduced-motion').check();
 await action(page,'close-dialog').last().click();await page.reload();await action(page,'settings').click();
 await expect(page.locator('#master-slider')).toHaveValue('0.4');await expect(page.locator('#mute-audio')).toBeChecked();
 await expect(page.locator('#music-slider')).toHaveValue('0.1');await expect(page.locator('#sfx-slider')).toHaveValue('0.2');await expect(page.locator('#reduced-motion')).toBeChecked();
 await action(page,'close-dialog').first().click();await expect(action(page,'skirmish')).toBeVisible();
});

test('battle controls fit the viewport and survive rotation',async({page,isMobile})=>{
 const expectAbilityClearance=async()=>{
  const geometry=await page.evaluate(()=>({abilityBottom:document.querySelector('.ability-dock')!.getBoundingClientRect().bottom,deckTop:document.querySelector('.command-deck')!.getBoundingClientRect().top}));
  expect(geometry.abilityBottom,'Abilities must sit entirely above the command deck').toBeLessThan(geometry.deckTop);
 };
 const expectLayoutViewport=async()=>{
  // Let resize handlers and one subsequent layout frame settle, then require
  // actual CSS viewport dimensions, not just Playwright's requested dimensions.
  await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
  const requested=page.viewportSize()!;
  await expect.poll(()=>page.evaluate(()=>({width:innerWidth,height:innerHeight,clientWidth:document.documentElement.clientWidth,clientHeight:document.documentElement.clientHeight}))).toEqual({width:requested.width,height:requested.height,clientWidth:requested.width,clientHeight:requested.height});
 };
 await launch(page);await expectLayoutViewport();await expectAbilityClearance();
 await expect(action(page,'select-commander')).toHaveAccessibleName('Commander');
 await expect(action(page,'select-army')).toHaveAccessibleName('Army');
 await expect(action(page,'hold')).toHaveAccessibleName('Hold');
 for(const selector of ['.hud','.command-deck','.ability-dock','.minimap-wrap'])await expectWithinViewport(page,selector);
 const noOverflow=await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);expect(noOverflow).toBe(true);
 if(isMobile){
  const current=page.viewportSize()!;await page.setViewportSize({width:current.height,height:current.width});
  await expectLayoutViewport();await expectAbilityClearance();
  for(const selector of ['.hud','.command-deck','.ability-dock','.minimap-wrap','#joystick'])await expectWithinViewport(page,selector);
  await expect(page.locator('#joystick')).toBeVisible();
 }
 await action(page,'pause-menu').click();await expectLayoutViewport();await expectWithinViewport(page,'.dialog');
 await action(page,'resume-dialog').click();await expect(page.getByRole('dialog')).toHaveCount(0);await expectLayoutViewport();await expectAbilityClearance();
});

test('Brutal menu and background interruption really suspend the fight',async({page})=>{
 await launch(page,{difficulty:'brutal'});await action(page,'pause-menu').click();
 await expect(page.getByRole('dialog')).toBeVisible();
 const time=await page.evaluate(()=>window.__FRONTIER__.state.time);await page.waitForTimeout(400);
 expect(await page.evaluate(()=>window.__FRONTIER__.state.time)).toBe(time);
 await action(page,'resume-dialog').click();await expect.poll(()=>page.evaluate(()=>window.__FRONTIER__.state.time)).toBeGreaterThan(time);
});

test('a corrupted save gives a recoverable error without breaking menus',async({page})=>{
 await home(page);
 // Fixture corrupts only the save under test, never gameplay to simulate success.
 await page.evaluate(async()=>{
  await new Promise<void>((resolve,reject)=>{const r=indexedDB.open('frontier-command-rts-game',1);r.onsuccess=()=>{
   const db=r.result,tx=db.transaction('records','readwrite');tx.objectStore('records').put({version:1,game:'{"version":999}'},'battle');tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);
  };r.onerror=()=>reject(r.error);});
 });
 await page.reload();await action(page,'continue').click();await expect(page.getByRole('status')).toContainText(/save.*could not be loaded/i);
 await expect(action(page,'skirmish')).toBeVisible();await action(page,'skirmish').click();await expect(action(page,'launch')).toBeVisible();
});

test('delayed IndexedDB startup never hides the menu or replaces a newly started match',async({page})=>{
 await page.addInitScript(()=>{
  const database=indexedDB;const originalOpen=database.open.bind(database);
  const deferred:(()=>void)[]=[];let held=true;
  (window as any).__QA_RELEASE_DB__=()=>{held=false;for(const callback of deferred.splice(0))callback();};
  Object.defineProperty(database,'open',{configurable:true,value:(name:string,version?:number)=>{
   const request=version===undefined?originalOpen(name):originalOpen(name,version);
   return new Proxy(request,{
    get(target,key){const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;},
    set(target,key,value){
     if(key==='onsuccess'){
      target.onsuccess=event=>{const invoke=()=>value?.call(target,event);if(held)deferred.push(invoke);else invoke();};return true;
     }
     return Reflect.set(target,key,value,target);
    },
   });
  }});
 });
 await home(page);await action(page,'skirmish').click();await page.getByLabel('Map seed',{exact:true}).fill('START-WITH-DELAYED-STORAGE');
 await action(page,'launch').click();await expect(page.locator('.hud')).toBeVisible();
 await acknowledgeFirstBriefing(page);
 await page.evaluate(()=>{(window as any).__QA_RELEASE_DB__();});
 // Waiting for an actual save also drains startup's delayed database work.
 await page.evaluate(()=>window.__FRONTIER__.save());
 await expect(page.locator('.hud')).toBeVisible();
 expect(await page.evaluate(()=>window.__FRONTIER__.playing)).toBe(true);
 expect(await page.evaluate(()=>window.__FRONTIER__.state.settings.seed)).toBe('START-WITH-DELAYED-STORAGE');
});

test('Escape cancels placement and dismisses a battle dialog without a stuck overlay',async({page,isMobile})=>{
 test.skip(isMobile,'Desktop keyboard dismissal.');await launch(page);await pause(page);
 await action(page,'panel-build').click();await page.getByRole('button',{name:'Build House',exact:true}).click();
 await page.keyboard.press('Escape');await expect(page.locator('#selection-info')).not.toContainText('Place House');
 await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toBeVisible();
 await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
 await expect(page.locator('.modal-backdrop')).toHaveCount(0);await resume(page);
 await expect.poll(()=>page.evaluate(()=>window.__FRONTIER__.state.paused)).toBe(false);
});

test('Escape dismisses home help and settings dialogs repeatedly',async({page,isMobile})=>{
 test.skip(isMobile,'Desktop keyboard dismissal.');await home(page);
 for(const name of ['help','settings','help']){
  await action(page,name).click();await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(action(page,'skirmish')).toBeVisible();
 }
});

test('first skirmish briefing freezes the battle until Start battle is acknowledged',async({page})=>{
 await home(page);await action(page,'skirmish').click();await page.locator('select[name="difficulty"]').selectOption('easy');
 await action(page,'launch').click();
 const briefing=page.getByRole('dialog',{name:'Your first frontier',exact:true});await expect(briefing).toBeVisible();
 await expect(briefing).toContainText('first minute consolidating their own side');
 const before=await page.evaluate(()=>{const s=window.__FRONTIER__.state;return{time:s.time,tick:s.tick,positions:s.entities.map(e=>[e.id,e.x,e.y,e.hp]),unitsLost:s.players[0].stats.unitsLost};});
 await page.waitForTimeout(900);
 expect(await page.evaluate(()=>{const s=window.__FRONTIER__.state;return{time:s.time,tick:s.tick,positions:s.entities.map(e=>[e.id,e.x,e.y,e.hp]),unitsLost:s.players[0].stats.unitsLost};})).toEqual(before);
 await page.getByRole('button',{name:'Start battle',exact:true}).click();await expect(briefing).toHaveCount(0);
 await expect.poll(()=>page.evaluate(()=>window.__FRONTIER__.state.time)).toBeGreaterThan(before.time);
 await action(page,'pause-menu').click();await action(page,'save-leave').click();
 await action(page,'skirmish').click();await action(page,'launch').click();
 await expect(page.getByRole('dialog',{name:'Your first frontier',exact:true})).toHaveCount(0);
});

test('ability buttons preserve their DOM identity while idle, cooling down, and becoming ready',async({page})=>{
 await launch(page,{difficulty:'easy',commander:'ranger'});
 const button=page.getByRole('button',{name:'Windstep',exact:true});const handle=await button.elementHandle();expect(handle).not.toBeNull();
 await page.waitForTimeout(700);expect(await handle!.evaluate(node=>node.isConnected)).toBe(true);
 await button.click();await expect(button).toBeDisabled();
 const cooldown=await page.evaluate(()=>window.__FRONTIER__.state.entities.find(e=>e.team===0&&e.kind==='commander')!.abilityCooldowns.dodge);
 expect(cooldown).toBeGreaterThan(0);
 await expect.poll(()=>page.evaluate(()=>window.__FRONTIER__.state.entities.find(e=>e.team===0&&e.kind==='commander')!.abilityCooldowns.dodge)).toBeLessThan(cooldown-.4);
 expect(await handle!.evaluate(node=>node.isConnected)).toBe(true);
 expect(await handle!.evaluate(node=>node===document.querySelector('[data-action="ability"][data-id="dodge"]'))).toBe(true);
 await expect(button).toBeEnabled({timeout:10_000});expect(await handle!.evaluate(node=>node.isConnected)).toBe(true);
 await expect(button.locator('b')).toHaveText('Windstep');await handle!.dispose();
});

test('the field guide stays on movement when the first recruit finishes before movement or capture',async({page})=>{
 await launch(page,{difficulty:'easy',keepTips:true});await expect(page.locator('#battle-hint')).toContainText('FIELD GUIDE · 1/4');
 const created=await page.evaluate(()=>window.__FRONTIER__.state.players[0].stats.unitsCreated);
 await action(page,'panel-army').click();await expect(page.locator('.command-deck')).not.toHaveClass(/collapsed/);
 await expect(page.getByRole('button',{name:'Recruit Swordsman',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Recruit Swordsman',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.__FRONTIER__.state.players[0].stats.unitsCreated),{timeout:15_000}).toBe(created+1);
 await expect(page.locator('#battle-hint')).toContainText('FIELD GUIDE · 1/4');
 await expect(page.locator('#battle-hint')).toContainText('Step into the frontier');
 expect(await page.evaluate(()=>window.__FRONTIER__.state.players[0].stats.captures)).toBe(0);
});

test('Archery Range completion updates the visible Recruit panel without reopening it',async({page})=>{
 await launch(page,{difficulty:'easy'});
 await action(page,'panel-army').click();await expect(page.locator('.command-deck')).not.toHaveClass(/collapsed/);
 const archer=page.getByRole('button',{name:'Recruit Archer',exact:true});await expect(archer).toHaveClass(/unavailable/);await expect(archer).toContainText('Needs Archery Range');
 await action(page,'panel-orders').click();await action(page,'speed').click();await action(page,'speed').click();
 await action(page,'panel-build').click();await page.getByRole('button',{name:'Build Archery Range',exact:true}).click();
 await tap(page,await clearGround(page,'range'));
 expect(await page.evaluate(()=>window.__FRONTIER__.state.entities.some(e=>e.team===0&&e.type==='range'))).toBe(false);
 await expect(action(page,'confirm-placement')).toBeEnabled();await action(page,'confirm-placement').click();
 await expect(page.getByRole('status')).toContainText('Archery Range under construction');
 await action(page,'panel-army').click();await expect(archer).toHaveClass(/unavailable/);
 await expect.poll(()=>page.evaluate(()=>window.__FRONTIER__.state.entities.some(e=>e.team===0&&e.type==='range'&&e.buildProgress>=1)),{timeout:18_000}).toBe(true);
 await expect(archer).not.toHaveClass(/unavailable/);await expect(archer).not.toContainText('Needs Archery Range');
 await archer.click();await expect.poll(()=>page.evaluate(()=>window.__FRONTIER__.state.entities.some(e=>e.team===0&&e.type==='range'&&e.queue.some(q=>q.type==='unit'&&q.id==='archer')))).toBe(true);
});

test('commander focus keeps the hero on an unobscured part of the battlefield',async({page})=>{
 await launch(page,{difficulty:'easy'});await action(page,'select-commander').click();
 const placement=await page.evaluate(()=>{const f=window.__FRONTIER__,c=f.state.entities.find(e=>e.team===0&&e.kind==='commander')!,p=f.renderer.worldToScreen(c.x,c.y),bodyY=p.y-59*f.renderer.camera.zoom/2;return{...p,bodyY,bodyTopElement:document.elementFromPoint(p.x,bodyY)?.id,feetTopElement:document.elementFromPoint(p.x,p.y)?.id,width:innerWidth,height:innerHeight};});
 expect(placement.x).toBeGreaterThan(20);expect(placement.x).toBeLessThan(placement.width-20);
 expect(placement.y).toBeGreaterThan(90);expect(placement.y).toBeLessThan(placement.height-100);expect(placement.feetTopElement).toBe('world');
 expect(placement.bodyY).toBeGreaterThan(0);expect(placement.bodyTopElement,'Visible commander body must not sit behind HUD or objective overlays').toBe('world');
});

test('March to relic queues one whole-army capture and keeps objective information public and readable',async({page})=>{
 await launch(page,{difficulty:'easy'});await pause(page);
 const march=page.getByRole('button',{name:'March to relic',exact:true});
 await expect(march).toBeVisible();await expectWithinViewport(page,'[data-action="march-relic"]');
 const before=await page.evaluate(()=>{
  const {state:s,renderer:r}=window.__FRONTIER__,hero=s.entities.find(e=>e.team===0&&e.kind==='commander'&&e.hp>0)!;
  const relics=s.map.nodes.filter(n=>n.kind==='relic'),targets=relics.filter(n=>n.owner!==0);
  const nearest=targets.sort((a,b)=>Math.hypot(a.x-hero.x,a.y-hero.y)-Math.hypot(b.x-hero.x,b.y-hero.y))[0];
  const troops=s.entities.filter(e=>e.team===0&&e.kind!=='building'&&e.hp>0);
  const hidden=s.entities.filter(e=>e.team!==0&&e.hp>0&&!s.fog.visible[0][Math.floor(e.y)*s.map.width+Math.floor(e.x)]);
  return{time:s.time,troopIds:troops.map(e=>e.id),positions:troops.map(e=>({id:e.id,x:e.x,y:e.y})),nearestId:nearest.id,nearestName:`Relic (${nearest.x.toFixed(1)}, ${nearest.y.toFixed(1)})`,owned:relics.filter(n=>n.owner===0).length,total:relics.length,visible:s.fog.visible[0],explored:s.fog.explored[0],hiddenIds:hidden.map(e=>e.id),hiddenPickable:hidden.some(e=>{const p=r.worldToScreen(e.x,e.y);return(r.pick(s,p.x,p.y) as {id?:string}|undefined)?.id===e.id;})};
 });
 expect(before.hiddenIds.length).toBeGreaterThan(0);expect(before.hiddenPickable).toBe(false);expect(before.owned).toBe(0);
 const income=page.locator('.objective-income');await expect(income).toBeVisible();
 await expect(income).toHaveText(`${before.owned} / ${before.total} relics controlled · +0.0 points / sec`);
 await expectWithinViewport(page,'.objective-income');
 const textLayout=await income.evaluate(el=>({width:el.clientWidth,scrollWidth:el.scrollWidth,fontSize:parseFloat(getComputedStyle(el).fontSize)}));
 expect(textLayout.scrollWidth).toBeLessThanOrEqual(textLayout.width+1);expect(textLayout.fontSize).toBeGreaterThanOrEqual(8);
 await march.click();await expect(page.getByRole('status')).toContainText(`${before.nearestName} march queued; engages nearby enemies.`);
 await expect(page.locator('#selection-info')).toContainText(`${before.troopIds.length} units selected`);
 expect(await page.evaluate(()=>window.__FRONTIER__.state.pendingCommands)).toEqual([{type:'capture',team:0,entityIds:before.troopIds,nodeId:before.nearestId}]);
 const queued=await page.evaluate(()=>{
  const {state:s,renderer:r}=window.__FRONTIER__;
  return{time:s.time,visible:s.fog.visible[0],explored:s.fog.explored[0],hiddenPickable:s.entities.filter(e=>e.team!==0&&e.hp>0&&!s.fog.visible[0][Math.floor(e.y)*s.map.width+Math.floor(e.x)]).some(e=>{const p=r.worldToScreen(e.x,e.y);return(r.pick(s,p.x,p.y) as {id?:string}|undefined)?.id===e.id;})};
 });
 expect(queued.time).toBe(before.time);expect(queued.visible).toEqual(before.visible);expect(queued.explored).toEqual(before.explored);expect(queued.hiddenPickable).toBe(false);
 await resume(page);await expect.poll(()=>page.evaluate(()=>window.__FRONTIER__.state.pendingCommands.length)).toBe(0);
 await expect.poll(()=>page.evaluate(positions=>positions.filter(before=>{const now=window.__FRONTIER__.state.entities.find(e=>e.id===before.id);return now&&Math.hypot(now.x-before.x,now.y-before.y)>.25;}).length,before.positions)).toBe(before.troopIds.length);
});

test('Save & leave persists its newer snapshot while the startup save completion is delayed',async({page})=>{
 await page.addInitScript(()=>{
  // The real IndexedDB put/commit still happens. Delay only the first battle
  // transaction's oncomplete notification to keep launch's save promise open.
  const nativePut=IDBObjectStore.prototype.put;
  const oncomplete=Object.getOwnPropertyDescriptor(IDBTransaction.prototype,'oncomplete');
  if(!oncomplete?.set)throw new Error('IndexedDB oncomplete descriptor unavailable for save-race fixture.');
  const gate={armed:false,committed:false,released:false,error:null as string|null,transaction:null as IDBTransaction|null,initial:null as null|{seed:string;time:number;pending:unknown[]},release:():void=>{throw new Error('First save has not committed yet.');}};
  (window as any).__QA_FIRST_SAVE_GATE__=gate;
  // Storage installs oncomplete before reading the prior envelope and calling
  // put. Intercept assignment up front; select the one held transaction at put.
  Object.defineProperty(IDBTransaction.prototype,'oncomplete',{
   ...oncomplete,
   set(callback:((event:Event)=>unknown)|null){
    const tx=this as IDBTransaction;
    oncomplete.set!.call(tx,callback?(event:Event)=>{
     if(tx!==gate.transaction)return callback.call(tx,event);
     gate.committed=true;
     gate.release=()=>{
      if(gate.released)throw new Error('First save completion already released.');
      gate.released=true;callback.call(tx,event);
     };
    }:null);
   },
  });
  IDBObjectStore.prototype.put=function(this:IDBObjectStore,value:unknown,key?:IDBValidKey){
   const request=key===undefined?nativePut.call(this,value):nativePut.call(this,value,key);
   const tx=this.transaction;
   if(!gate.armed&&key==='battle'&&this.name==='records'&&tx.mode==='readwrite'&&tx.db.name==='frontier-command-rts-game'){
    // Current persistence writes ordering metadata around the battle snapshot.
    const record=value as {__frontierRecord?:unknown;value?:{game?:unknown}};
    if(record?.__frontierRecord!==1||typeof record.value?.game!=='string'){
     gate.error='Expected the current __frontierRecord:1 battle envelope with value.game.';
     return request;
    }
    const game=JSON.parse(record.value.game);
    gate.armed=true;
    gate.transaction=tx;
    gate.initial={seed:game.settings.seed,time:game.time,pending:game.pendingCommands};
   }
   return request;
  };
 });
 await launch(page,{difficulty:'easy'});
 await expect.poll(()=>page.evaluate(()=>{
  const gate=(window as any).__QA_FIRST_SAVE_GATE__;
  if(gate.error)throw new Error(gate.error);
  return gate.committed;
 })).toBe(true);
 const initial=await page.evaluate(()=>(window as any).__QA_FIRST_SAVE_GATE__.initial as {seed:string;time:number;pending:unknown[]});
 expect(initial.time).toBe(0);expect(initial.pending).toEqual([]);
 await expect.poll(()=>page.evaluate(()=>window.__FRONTIER__.state.time)).toBeGreaterThanOrEqual(initial.time+1);
 await pause(page);await action(page,'hold').click();
 const later=await page.evaluate(()=>{const s=window.__FRONTIER__.state;return{seed:s.settings.seed,time:s.time,pending:s.pendingCommands};});
 expect(later.seed).toBe(initial.seed);expect(later.time).toBeGreaterThan(initial.time);expect(later.pending).toHaveLength(1);
 expect(later.pending[0].type).toBe('hold');
 await action(page,'pause-menu').click();await action(page,'save-leave').click();
 // Both old and fixed implementations are genuinely waiting on the first
 // completion here; the later requested snapshot is what distinguishes them.
 await expect(page.getByRole('dialog',{name:'Take a breath',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>(window as any).__QA_FIRST_SAVE_GATE__.released)).toBe(false);
 await page.evaluate(()=>{(window as any).__QA_FIRST_SAVE_GATE__.release();});
 await expect(action(page,'continue')).toBeVisible();
 await page.reload();await action(page,'continue').click();
 await expect.poll(()=>page.evaluate(()=>window.__FRONTIER__.playing)).toBe(true);
 expect(await page.evaluate(()=>{const s=window.__FRONTIER__.state;return{seed:s.settings.seed,time:s.time,pending:s.pendingCommands};})).toEqual(later);
 await expect(page.locator('#paused-ribbon')).toBeVisible();
});


test('paused construction rejects an invalid site immediately and rejects overlap with a queued house',async({page})=>{
 await launch(page,{difficulty:'easy'});await pause(page);await action(page,'panel-build').click();
 // The card is intentionally hidden after choosing a preview, but retains its selected state.
 const house=page.locator('#deck-content [data-action="build"][data-id="house"]');await house.click();
 // Read-only fixture selection: use a visible snapped site rejected by the real construction rules.
 // Commander-footprint reachability remains an independent, deliberately non-xfailed test below.
 const fixture=await page.evaluate(()=>{
  const {state,renderer}=window.__FRONTIER__,candidates:{screen:{x:number;y:number};world:{x:number;y:number}}[]=[];
  for(let y=1.5;y<state.map.height-1;y+=.5)for(let x=1.5;x<state.map.width-1;x+=.5){
   const screen=renderer.worldToScreen(x,y);
   if(screen.x<20||screen.x>innerWidth-20||screen.y<120||screen.y>innerHeight-30)continue;
   if(document.elementFromPoint(screen.x,screen.y)?.id==='world')candidates.push({screen,world:{x,y}});
  }
  return{state,candidates};
 });
 const invalid=fixture.candidates.map(candidate=>{
  const world=snapConstruction(candidate.world);return{...candidate,world,check:plannedBuildResult(fixture.state,0,'house',world.x,world.y)};
 }).find(candidate=>!candidate.check.ok);
 expect(invalid,'At least one canonically invalid snapped site must be reachable on the canvas').toBeDefined();
 const resources={gold:fixture.state.players[0].gold,wood:fixture.state.players[0].wood};
 await tap(page,invalid!.screen);
 await expect(page.locator('#placement-controls small[role=status]')).toContainText(invalid!.check.error!);
 await expect(action(page,'confirm-placement')).toBeDisabled();
 expect(await page.evaluate(()=>window.__FRONTIER__.state.pendingCommands)).toEqual([]);
 expect(await page.evaluate(()=>({gold:window.__FRONTIER__.state.players[0].gold,wood:window.__FRONTIER__.state.players[0].wood}))).toEqual(resources);
 await expect(page.locator('#selection-info')).toContainText('Place House');await expect(house).toHaveClass(/selected/);
 // Keep the same placement session and choose a canonically legal, visible site.
 const legal=await clearGround(page,true);await tap(page,legal);
 await expect(action(page,'confirm-placement')).toBeEnabled();
 expect(await page.evaluate(()=>window.__FRONTIER__.state.pendingCommands)).toEqual([]);
 expect(await page.evaluate(()=>({gold:window.__FRONTIER__.state.players[0].gold,wood:window.__FRONTIER__.state.players[0].wood}))).toEqual(resources);
 await action(page,'confirm-placement').click();await expect(page.getByRole('status')).toHaveText('House planned. Resume to build.');
 const first=await page.evaluate(()=>window.__FRONTIER__.state.pendingCommands);expect(first).toHaveLength(1);expect(first[0]).toMatchObject({type:'build',team:0,building:'house'});
 if(first[0].type!=='build')throw new Error('Expected the single confirmed house construction command.');
 const placed=first[0];
 expect(snapConstruction(placed)).toEqual({x:placed.x,y:placed.y});
 await action(page,'panel-build').click();await house.click();
 const overlap=await page.evaluate(point=>{const screen=window.__FRONTIER__.renderer.worldToScreen(point.x,point.y);return{screen,hit:document.elementFromPoint(screen.x,screen.y)?.id};},{x:placed.x,y:placed.y});
 expect(overlap.hit,'The confirmed house site must remain reachable for a repeated placement').toBe('world');
 await tap(page,overlap.screen);
 await expect(page.locator('#placement-controls small[role=status]')).toContainText('Too close to your queued House. Pick another spot.');
 await expect(action(page,'confirm-placement')).toBeDisabled();
 expect(await page.evaluate(()=>window.__FRONTIER__.state.pendingCommands)).toEqual(first);
 expect(await page.evaluate(()=>({gold:window.__FRONTIER__.state.players[0].gold,wood:window.__FRONTIER__.state.players[0].wood}))).toEqual(resources);
 expect(await page.evaluate(()=>window.__FRONTIER__.state.entities.filter(e=>e.team===0&&e.type==='house').length)).toBe(0);
 await expect(page.locator('#selection-info')).toContainText('Place House');await expect(house).toHaveClass(/selected/);
 await page.locator('#placement-controls [data-action="cancel-build"]').click();await resume(page);
 await expect.poll(()=>page.evaluate(()=>window.__FRONTIER__.state.entities.filter(e=>e.team===0&&e.type==='house').length)).toBe(1);
});

test('landscape placement keeps the commander footprint on unobscured canvas',async({page})=>{
 const viewport=page.viewportSize()!;
 test.skip(viewport.height>=500||viewport.width<=viewport.height,'This preserves the unresolved short-landscape geometry gate.');
 await launch(page,{difficulty:'easy'});await pause(page);await action(page,'panel-build').click();
 await page.getByRole('button',{name:'Build House',exact:true}).click();
 // Do not weaken, force-click, or mark this expected-to-fail. The earlier QA failed this exact hit test.
 const geometry=await page.evaluate(()=>{
  const f=window.__FRONTIER__,c=f.state.entities.find(e=>e.team===0&&e.kind==='commander')!,screen=f.renderer.worldToScreen(c.x,c.y);
  const top=document.elementFromPoint(screen.x,screen.y);
  return{screen,topElement:top?.id,topTag:top?.tagName,topClass:top?.getAttribute('class'),topHTML:top?.outerHTML.slice(0,1500),
   overlays:['.placement-toolbar','.command-deck','.hud','.objective-bar'].map(selector=>({selector,rect:document.querySelector(selector)?.getBoundingClientRect().toJSON()}))};
 });
 await test.info().attach('landscape-placement-hit-test',{body:JSON.stringify(geometry,null,2),contentType:'application/json'});
 expect(geometry.topElement,'Commander footprint must not be covered when placement opens; inspect the attached covering element and rectangles').toBe('world');
});
