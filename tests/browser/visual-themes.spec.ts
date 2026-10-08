import {test,expect,action,home,launch,pause,clearGround,tap,resume} from './helpers';

async function choose(page:import('@playwright/test').Page,id:string){
 await action(page,'settings').click();
 await page.getByLabel('Visual theme',{exact:true}).selectOption(id);
 await expect.poll(()=>page.evaluate(()=>(window.__FRONTIER__.renderer as any).visualTheme)).toBe(id);
 await page.getByRole('button',{name:'Done',exact:true}).click();
}
test('native theme selection updates portraits and persists with unchanged progression',async({page})=>{
 await home(page);const profile=await page.evaluate(()=>window.__FRONTIER__.profile);
 await choose(page,'mythic');await action(page,'skirmish').click();
 await expect(page.locator('[data-portrait=ranger]')).toBeVisible();
 expect(await page.evaluate(()=>(window.__FRONTIER__.renderer as any).atlas.image.src)).toContain('/themes/mythic-toon/atlas.png');
 await page.screenshot({path:test.info().outputPath('mythic-portraits.png')});
 await page.reload();await expect(action(page,'settings')).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>(window.__FRONTIER__.renderer as any).visualTheme)).toBe('mythic');
 expect(await page.evaluate(()=>window.__FRONTIER__.profile)).toEqual(profile);
});
test('artwork switching preserves paused battle, orders, selection and resources',async({page})=>{
 await launch(page,{commander:'ranger'});await pause(page);
 await action(page,'panel-army').click();
 const before=await page.evaluate(()=>JSON.stringify(window.__FRONTIER__.state));
 await action(page,'pause-menu').click();await choose(page,'mythic');
 expect(await page.evaluate(()=>JSON.stringify(window.__FRONTIER__.state))).toBe(before);
 await expect(page.getByRole('dialog')).toHaveCount(0);
 expect(await page.evaluate(()=>(window.__FRONTIER__.renderer as any).directionalAtlas.data.actors.ranger.directions.length)).toBe(16);
 await expect(page.locator('.sprite-icon').first()).toBeVisible();
 expect(await page.evaluate(()=>Array.from(document.querySelectorAll('.sprite-icon')).every(e=>getComputedStyle(e).backgroundImage.includes('mythic-toon')))).toBe(true);
 await page.screenshot({path:test.info().outputPath('mythic-live-paused.png')});
});
test('both complete sets and directional art work after offline reload at the production subpath',async({page,context})=>{
 await home(page);await choose(page,'mythic');
 await page.waitForFunction(async()=>navigator.serviceWorker.controller && (await caches.keys()).some(k=>k.startsWith('frontier-command-rts-game-')));
 const cached=await page.evaluate(async()=>{const names=await caches.keys();const c=await caches.open(names.find(n=>n.startsWith('frontier-command-rts-game-'))!);return (await c.keys()).map(r=>new URL(r.url).pathname);});
 expect(cached).toContain('/rts-game/assets/render/themes/mythic-toon/ranger-directional.png');
 expect(cached).toContain('/rts-game/assets/render/themes/mythic-toon/atlas.png');
 const profile=await page.evaluate(()=>window.__FRONTIER__.profile);
 await context.setOffline(true);await page.reload();await expect(action(page,'settings')).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>(window.__FRONTIER__.renderer as any).visualTheme)).toBe('mythic');
 await choose(page,'christmas');await choose(page,'mythic');
 expect(await page.evaluate(()=>window.__FRONTIER__.profile)).toEqual(profile);
 expect(await page.evaluate(()=>(window.__FRONTIER__.renderer as any).directionalAtlas.image.naturalWidth)).toBeGreaterThan(0);
});
test('a missing required directional image retains the working theme and reports recovery',async({browser})=>{
 const use=test.info().project.use;
 const context=await browser.newContext({serviceWorkers:'block',viewport:use.viewport,hasTouch:use.hasTouch,isMobile:use.isMobile}),page=await context.newPage();
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.route('**/ranger-directional.png',r=>r.abort());
  await home(page);await action(page,'settings').click();
  await page.getByLabel('Visual theme',{exact:true}).selectOption('mythic');
  await expect(page.getByLabel('Visual theme',{exact:true})).toBeEnabled();
  await expect(page.getByLabel('Visual theme',{exact:true})).toHaveValue('christmas');
  expect(await page.evaluate(()=>(window.__FRONTIER__.renderer as any).visualTheme)).toBe('christmas');
  await expect(page.locator('#theme-status')).toContainText('current set');
  expect(errors).toEqual([]);
 }finally{await context.close();}
});
test('native commander movement uses several authored walk phases and reduced motion keeps heading',async({page})=>{
 await home(page);await choose(page,'mythic');
 await launch(page,{commander:'ranger'});await pause(page);
 await page.evaluate(()=>{
  const r=window.__FRONTIER__.renderer as any,a=r.directionalAtlas,draw=a.draw.bind(a);r.qaWalkFrames=[];
  a.draw=(c:any,actor:string,id:string,height:number)=>{if(actor==='ranger')r.qaWalkFrames.push(id);return draw(c,actor,id,height);};
 });
 await action(page,'order-move').click();const ground=await clearGround(page);await tap(page,ground);await resume(page);
 await expect.poll(()=>page.evaluate(()=>new Set((window.__FRONTIER__.renderer as any).qaWalkFrames.filter((id:string)=>id.includes('-walk-'))).size),{timeout:10000}).toBeGreaterThanOrEqual(3);
 await pause(page);await action(page,'pause-menu').click();await action(page,'settings').click();
 await page.getByLabel('Reduced motion and effects').check();await page.getByRole('button',{name:'Done',exact:true}).click();
 await expect(page.getByRole('dialog')).toHaveCount(0);
 await page.evaluate(()=>{(window.__FRONTIER__.renderer as any).qaWalkFrames=[];});
 await page.waitForTimeout(300);
 expect(await page.evaluate(()=>(window.__FRONTIER__.renderer as any).qaWalkFrames.length)).toBeGreaterThan(0);
 expect(await page.evaluate(()=>(window.__FRONTIER__.renderer as any).qaWalkFrames.every((id:string)=>id.endsWith('-idle')))).toBe(true);
 await page.screenshot({path:test.info().outputPath('mythic-ranger-native-movement.png')});
});
