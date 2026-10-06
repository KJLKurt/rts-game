import {test,expect,action,home} from './helpers';

test('both owned actor textures load from the scoped offline cache with unchanged progression',async({page,context})=>{
 await home(page);const profile=await page.evaluate(()=>window.__FRONTIER__.profile);
 await action(page,'settings').click();await page.getByLabel('Visual theme',{exact:true}).selectOption('mythic');
 await expect.poll(()=>page.evaluate(()=>(window.__FRONTIER__.renderer as any).visualTheme)).toBe('mythic');
 await page.getByRole('button',{name:'Done',exact:true}).click();
 await page.waitForFunction(async()=>navigator.serviceWorker.controller&&(await caches.keys()).some(k=>k.startsWith('frontier-command-rts-game-')));
 const cached=await page.evaluate(async()=>{const name=(await caches.keys()).find(k=>k.startsWith('frontier-command-rts-game-'))!;return(await(await caches.open(name)).keys()).map(r=>new URL(r.url).pathname);});
 for(const actor of ['ranger','swordsman'])for(const ext of ['json','png'])expect(cached).toContain(`/rts-game/assets/render/themes/mythic-toon/${actor}-directional.${ext}`);
 await context.setOffline(true);await page.reload();
 await expect.poll(()=>page.evaluate(()=>(window.__FRONTIER__.renderer as any).visualTheme)).toBe('mythic');
 const loaded=await page.evaluate(()=>{const r=window.__FRONTIER__.renderer as any;return ['ranger','swordsman'].map(actor=>{const a=r.directionalFor(actor);return{actor,headingCount:a.data.actors[actor].directions.length,frameCount:Object.keys(a.data.frames).length,image:a.image.src,width:a.image.naturalWidth};});});
 for(const actor of loaded){expect(actor.headingCount).toBe(16);expect(actor.frameCount).toBe(144);expect(actor.width).toBeGreaterThan(0);expect(actor.image).toContain(actor.actor+'-directional.png');}
 expect(await page.evaluate(()=>window.__FRONTIER__.profile)).toEqual(profile);
});

test('a missing additional Swordsman texture keeps the working set and supports a native retry',async({browser})=>{
 const use=test.info().project.use;const context=await browser.newContext({serviceWorkers:'block',viewport:use.viewport,hasTouch:use.hasTouch,isMobile:use.isMobile}),page=await context.newPage();const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.route('**/swordsman-directional.png',route=>route.abort());await home(page);const profile=await page.evaluate(()=>window.__FRONTIER__.profile);
  await action(page,'settings').click();await page.getByLabel('Visual theme',{exact:true}).selectOption('mythic');
  await expect(page.getByLabel('Visual theme',{exact:true})).toBeEnabled();await expect(page.getByLabel('Visual theme',{exact:true})).toHaveValue('christmas');await expect(page.locator('#theme-status')).toContainText('current set');
  expect(await page.evaluate(()=>(window.__FRONTIER__.renderer as any).visualTheme)).toBe('christmas');
  await page.unroute('**/swordsman-directional.png');await page.getByLabel('Visual theme',{exact:true}).selectOption('mythic');
  await expect.poll(()=>page.evaluate(()=>(window.__FRONTIER__.renderer as any).visualTheme)).toBe('mythic');
  expect(await page.evaluate(()=>window.__FRONTIER__.profile)).toEqual(profile);expect(errors).toEqual([]);
 }finally{await context.close();}
});
