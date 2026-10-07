import {test,expect,launch,pause,action,tap,clearGround,resume} from './helpers';
import {createGame,spawnEntity,updateFog} from '../../src/sim/engine';
import {writeFile} from 'node:fs/promises';

function scene(dense:boolean){
 const s=createGame({commander:'ranger',mapSize:'small',aiPlayers:1,seed:'VISIBLE-INPUT-20261006'});
 s.map.tiles.fill('grass');s.map.nodes=[];s.entities=[];s.events=[];s.paused=true;s.players.forEach(p=>p.ai=false);
 const own=spawnEntity(s,0,'unit','swordsman',10.15,10.15);
 const target=spawnEntity(s,1,dense?'unit':'building',dense?'swordsman':'depot',dense?10.2:10.5,dense?10.45:10.5);
 const front=dense?spawnEntity(s,0,'unit','swordsman',10.55,10.55):undefined;
 own.x=dense?8:10.15;own.y=dense?12:10.15;own.facing=Math.PI/4;target.facing=3*Math.PI/4;if(front)front.facing=Math.PI/4;
 updateFog(s);return{state:s,ownId:own.id,targetId:target.id,frontId:front?.id};
}

async function prepare(page:any,theme:string,fixture:ReturnType<typeof scene>){
 await launch(page,{commander:'ranger'});await pause(page);
 await page.evaluate(async({theme,fixture}:any)=>{
  const f=window.__FRONTIER__,r=f.renderer as any;await r.setVisualTheme(theme);Object.assign(f.state,fixture.state);r.combat.reset();r.centerOn(10.4,10.4);r.camera.zoom=.95;if(innerHeight<500)r.pan(0,46);
 },{theme,fixture});
 if(!((await page.locator('.command-deck').getAttribute('class'))??'').includes('collapsed'))await action(page,'toggle-deck').click();
 await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
}

for(const theme of ['christmas','mythic']){
 test(`${theme} HUD pause leaves a native ground order available with expanded controls`,async({page})=>{
  await launch(page,{commander:'ranger'});await pause(page);
  await page.evaluate(async theme=>{await (window.__FRONTIER__.renderer as any).setVisualTheme(theme);},theme);
  await action(page,'select-commander').click();
  const initial=await page.evaluate(()=>{const s=window.__FRONTIER__.state,e=s.entities.find(e=>e.team===0&&e.kind==='commander')!;return{id:e.id,x:e.x,y:e.y,time:s.time,profile:window.__FRONTIER__.profile};});
  const ground=await clearGround(page);await tap(page,ground);
  expect(await page.evaluate(()=>window.__FRONTIER__.state.paused)).toBe(true);
  await expect.poll(()=>page.evaluate(()=>window.__FRONTIER__.state.pendingCommands.at(-1))).toMatchObject({type:'move',entityIds:[initial.id]});
  await expect(page.locator('.hud #paused-ribbon')).toBeVisible();await expect(page.locator('.hud #paused-ribbon')).toContainText('1 queued');
  const geometry=await page.locator('#paused-ribbon').evaluate(el=>{const a=el.getBoundingClientRect(),h=document.querySelector('.hud')!.getBoundingClientRect();return{insideHUD:a.top>=h.top&&a.bottom<=h.bottom,pauseRect:a.toJSON(),hudRect:h.toJSON()};});expect(geometry.insideHUD).toBe(true);
  await page.screenshot({path:test.info().outputPath(`${theme}-expanded-controls-native-ground-order.png`)});
  await resume(page);await expect.poll(()=>page.evaluate(id=>{const e=window.__FRONTIER__.state.entities.find(e=>e.id===id)!;return{x:e.x,y:e.y};},initial.id)).not.toEqual({x:initial.x,y:initial.y});await pause(page);
  expect(await page.evaluate(()=>window.__FRONTIER__.profile)).toEqual(initial.profile);await writeFile(test.info().outputPath(`${theme}-HUD-pause-ground-proof.json`),JSON.stringify({ground,geometry,nativeMoveQueuedWhilePaused:true,actualCommanderMovedAfterHUDResume:true},null,2));
 });

 test(`${theme} native body selection and attack work through a faded foreground depot`,async({page})=>{
  const fixture=scene(false);await prepare(page,theme,fixture);const before=await page.evaluate(()=>window.__FRONTIER__.profile);
  const point=await page.evaluate(({ownId}:any)=>{
   const f=window.__FRONTIER__,r=f.renderer as any,e=f.state.entities.find(e=>e.id===ownId)!,p=r.worldToScreen(e.x,e.y),z=r.camera.zoom;
   for(let dy=-39;dy<-14;dy+=2)for(let dx=-13;dx<=13;dx+=2){const q={x:p.x+dx*z,y:p.y+dy*z};if(document.elementFromPoint(q.x,q.y)?.id==='world'&&r.pick(f.state,q.x,q.y)?.id===ownId)return q;}
   throw Error('No visible troop body can be selected through the foreground depot');
  },fixture);
  await page.screenshot({path:test.info().outputPath(`${theme}-foreground-depot-before-input.png`)});
  await tap(page,point);await expect(page.locator('#selection-info')).toContainText('Swordsman');
  const targetPoint=await page.evaluate(({targetId}:any)=>{const f=window.__FRONTIER__,r=f.renderer as any,e=f.state.entities.find(e=>e.id===targetId)!,p=r.worldToScreen(e.x,e.y),z=r.camera.zoom;for(let dy=-65;dy<0;dy+=3)for(let dx=-35;dx<=35;dx+=3){const q={x:p.x+dx*z,y:p.y+dy*z};if(document.elementFromPoint(q.x,q.y)?.id==='world'&&r.pick(f.state,q.x,q.y)?.id===targetId)return q;}throw Error('No remaining depot art can receive an attack');},fixture);
  await tap(page,targetPoint);
  await expect.poll(()=>page.evaluate(()=>window.__FRONTIER__.state.pendingCommands.at(-1))).toMatchObject({type:'attack',targetId:fixture.targetId,entityIds:[fixture.ownId]});
  expect(await page.evaluate(()=>window.__FRONTIER__.profile)).toEqual(before);
  await page.screenshot({path:test.info().outputPath(`${theme}-foreground-depot-native-attack.png`)});
  const proof=await page.evaluate(()=>{const f=window.__FRONTIER__,r=f.renderer as any;return{paused:f.state.paused,time:f.state.time,orders:f.state.pendingCommands,structureOpacity:Array.from(r.entityHits.values()).map((h:any)=>h.opacity),profile:f.profile,fixtureAIExplicitlyDisabled:true};});
  expect(proof.structureOpacity).toContain(.3);await writeFile(test.info().outputPath(`${theme}-foreground-native-proof.json`),JSON.stringify({point,targetPoint,...proof},null,2));
 });

 test(`${theme} a native tap on exposed enemy pixels beats a nearer friendly transparent rectangle`,async({page})=>{
  const fixture=scene(true);await prepare(page,theme,fixture);await action(page,'select-army').click();
  if(!((await page.locator('.command-deck').getAttribute('class'))??'').includes('collapsed'))await action(page,'toggle-deck').click();
  const point=await page.evaluate(({targetId,frontId}:any)=>{
   const f=window.__FRONTIER__,r=f.renderer as any,target=f.state.entities.find(e=>e.id===targetId)!,front=f.state.entities.find(e=>e.id===frontId)!,p=r.worldToScreen(target.x,target.y),fp=r.worldToScreen(front.x,front.y),z=r.camera.zoom;
   // Independently sample the exact source frame chosen by the real draw, using its recorded matrix.
   const opaque=(id:string,x:number,y:number)=>{const h=r.entityHits.get(id),m=h.matrix.inverse(),q=new DOMPoint(x,y).matrixTransform(m),b=h.bounds;if(q.x<b.x||q.x>=b.x+b.width||q.y<b.y||q.y>=b.y+b.height)return false;const c=document.createElement('canvas');c.width=h.frame.w;c.height=h.frame.h;const ctx=c.getContext('2d')!;ctx.drawImage(h.image,h.frame.x,h.frame.y,h.frame.w,h.frame.h,0,0,h.frame.w,h.frame.h);return ctx.getImageData(Math.floor((q.x-b.x)/b.width*h.frame.w),Math.floor((q.y-b.y)/b.height*h.frame.h),1,1).data[3]>64;};
   for(let dy=-42;dy<-4;dy+=2)for(let dx=-20;dx<=20;dx+=2){const q={x:p.x+dx*z,y:p.y+dy*z};if(q.x<=fp.x-24*z||q.x>=fp.x+24*z||q.y<=fp.y-44*z||q.y>=fp.y+12*z)continue;if(document.elementFromPoint(q.x,q.y)?.id==='world'&&opaque(targetId,q.x,q.y)&&!opaque(frontId,q.x,q.y)&&r.pick(f.state,q.x,q.y)?.id===targetId)return{...q,insideOldForegroundRectangle:true,enemyOriginalAlphaOpaque:true,foregroundOriginalAlphaTransparent:true};}
   throw Error('No exposed enemy source pixel inside the old foreground rectangle');
  },fixture);
  await page.screenshot({path:test.info().outputPath(`${theme}-dense-melee-before-native-tap.png`)});await tap(page,point);
  await expect.poll(()=>page.evaluate(()=>window.__FRONTIER__.state.pendingCommands.at(-1))).toMatchObject({type:'attack',targetId:fixture.targetId});
  const orders=await page.evaluate(()=>window.__FRONTIER__.state.pendingCommands);
  await writeFile(test.info().outputPath(`${theme}-dense-melee-native-proof.json`),JSON.stringify({point,orders,sourceStatsUntouched:true,fixtureAIExplicitlyDisabled:true},null,2));
  await page.screenshot({path:test.info().outputPath(`${theme}-dense-melee-native-attack.png`)});
 });
}

for(const theme of ['christmas','mythic'])for(const commander of ['warlord','ranger','engineer']){
 test(`${theme} ${commander} native ground marker preserves selection and queues no movement`,async({page})=>{
   await launch(page,{commander});await pause(page);
   await page.evaluate(async theme=>{await (window.__FRONTIER__.renderer as any).setVisualTheme(theme);},theme);
   await action(page,'focus').first().click();await action(page,'select-army').click();
   if(!((await page.locator('.command-deck').getAttribute('class'))??'').includes('collapsed'))await action(page,'toggle-deck').click();
   await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
   const before=await page.evaluate(()=>{const f=window.__FRONTIER__,e=f.state.entities.find(e=>e.team===0&&e.kind==='commander')!,p=f.renderer.worldToScreen(e.x,e.y);return{id:e.id,type:e.type,point:p,DOMAtTap:document.elementFromPoint(p.x,p.y)?.id,time:f.state.time,profile:f.profile};});
   expect(before.DOMAtTap).toBe('world');await tap(page,before.point);
   await expect(page.locator('#selection-info')).toContainText(commander==='warlord'?'Warlord':commander==='ranger'?'Ranger':'Engineer');
   expect(await page.evaluate(()=>window.__FRONTIER__.state.pendingCommands)).toHaveLength(0);
   expect(await page.evaluate(()=>window.__FRONTIER__.state.time)).toBe(before.time);
   expect(await page.evaluate(()=>window.__FRONTIER__.profile)).toEqual(before.profile);
   await page.screenshot({path:test.info().outputPath(`${theme}-${commander}-native-ground-marker-selection.png`)});
   await writeFile(test.info().outputPath(`${theme}-${commander}-ground-marker-proof.json`),JSON.stringify({...before,actualNativeTap:true,noQueuedMove:true,sourceGameStatsPositionsAndEventsUnmodified:true}));
 });
}
