import {test,expect,home,launch,action,pause} from './helpers';

test.describe.configure({mode:'serial'});
async function ready(page:import('@playwright/test').Page){
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
 await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);
}

test('production manifest, icons, worker and precache remain within repository scope',async({page,request})=>{
 await home(page);await ready(page);
 const manifestURL=await page.locator('link[rel="manifest"]').getAttribute('href');expect(manifestURL).toBeTruthy();
 const manifest=(await (await request.get(new URL(manifestURL!,page.url()).href)).json());
 expect(manifest.start_url).toBe('/rts-game/');expect(manifest.scope).toBe('/rts-game/');expect(manifest.display).toBe('standalone');
 for(const icon of manifest.icons){const response=await request.get(new URL(icon.src,new URL(manifestURL!,page.url())).href);expect(response.ok()).toBe(true);expect((await response.body()).length).toBeGreaterThan(100);}
 const info=await page.evaluate(async()=>{
  const registration=await navigator.serviceWorker.getRegistration();const names=await caches.keys();
  const owned=names.filter(n=>n.startsWith('frontier-command-rts-game-'));
  const urls=(await Promise.all(owned.map(async n=>(await (await caches.open(n)).keys()).map(r=>new URL(r.url).pathname)))).flat();
  return{scope:registration?.scope,worker:registration?.active?.scriptURL,urls};
 });
 expect(new URL(info.scope!).pathname).toBe('/rts-game/');expect(new URL(info.worker!).pathname).toBe('/rts-game/sw.js');
 expect(info.urls.length).toBeGreaterThan(5);expect(info.urls.every(p=>p.startsWith('/rts-game/'))).toBe(true);
 expect(info.urls.some(p=>/\.map$/.test(p))).toBe(false);
});

test('after install, offline reload supports saved battle, new game, campaign, and editor',async({page,context})=>{
 await launch(page);await pause(page);await action(page,'pause-menu').click();await action(page,'save-leave').click();await ready(page);
 await context.setOffline(true);await page.reload();await expect(action(page,'continue')).toBeVisible();
 await action(page,'continue').click();await expect(page.locator('.hud')).toBeVisible();
 await action(page,'pause-menu').click();await action(page,'save-leave').click();
 await action(page,'campaign').click();
 const story=page.locator('[data-action="choose-campaign"][data-id="rise-of-the-frontier"]');if(await story.count())await story.click();
 await page.locator('[data-action="mission"]').first().click();await action(page,'begin-mission').click();await expect(page.locator('.hud')).toBeVisible();
 await action(page,'pause-menu').click();await action(page,'save-leave').click();
 await action(page,'editor').click();await action(page,'new-editor').click();await expect(page.locator('.editor-header')).toBeVisible();
 await action(page,'save-map').click();await expect(page.getByRole('status')).toContainText(/Workshop saved/);
 await action(page,'exit-editor').click();await action(page,'home').click();await action(page,'skirmish').click();await action(page,'launch').click();await expect(page.locator('.hud')).toBeVisible();
});

test('an update waits for consent, saves the battle, then restarts safely',async({page,request})=>{
 test.skip(!!process.env.FRONTIER_TEST_URL,'External hosts do not expose the test-only release endpoint. Run local production QA for update lifecycle.');
 await launch(page);await pause(page);await ready(page);
 const before=await page.evaluate(()=>({seed:window.__FRONTIER__.state.settings.seed,time:window.__FRONTIER__.state.time}));
 const oldWorker=await page.evaluate(()=>navigator.serviceWorker.controller?.scriptURL);
 await request.post('/__qa/release');
 await page.evaluate(async()=>{const registration=await navigator.serviceWorker.getRegistration();await registration!.update();});
 await expect(page.locator('#apply-update')).toBeVisible();
 await page.waitForTimeout(400);expect(await page.evaluate(()=>window.__FRONTIER__.playing)).toBe(true);
 expect(await page.evaluate(()=>window.__FRONTIER__.state.time)).toBe(before.time);
 await Promise.all([page.waitForEvent('load'),page.locator('#apply-update').click()]);
 await expect(action(page,'continue')).toBeVisible();await action(page,'continue').click();
 await expect.poll(()=>page.evaluate(()=>window.__FRONTIER__.playing)).toBe(true);
 expect(await page.evaluate(()=>({seed:window.__FRONTIER__.state.settings.seed,time:window.__FRONTIER__.state.time}))).toEqual(before);
 expect(await page.evaluate(()=>navigator.serviceWorker.controller?.scriptURL)).toBe(oldWorker);
 await expect(page.locator('#apply-update')).toHaveCount(0);
});

test('an update waits for a finished result commit and reloads its command record once',async({page,request})=>{
 test.skip(!!process.env.FRONTIER_TEST_URL,'Needs the local test-only release endpoint.');
 await launch(page);await pause(page);await ready(page);
 await request.post('/__qa/release');
 await page.evaluate(async()=>{const registration=await navigator.serviceWorker.getRegistration();await registration!.update();});
 await expect(page.locator('#apply-update')).toBeVisible();
 await page.evaluate(()=>{
  const originalOpen=indexedDB.open.bind(indexedDB),deferred:(()=>void)[]=[];let held=true;
  (window as any).__RELEASE_RESULT_DB__=()=>{held=false;for(const callback of deferred.splice(0))callback();};
  indexedDB.open=((name:string,version?:number)=>{
   const request=version===undefined?originalOpen(name):originalOpen(name,version);
   return new Proxy(request,{
    get(target,key){const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;},
    set(target,key,value){if(key==='onsuccess'){target.onsuccess=event=>{const invoke=()=>value?.call(target,event);if(held)deferred.push(invoke);else invoke();};return true;}return Reflect.set(target,key,value,target);},
   });
  }) as typeof indexedDB.open;
  const state=window.__FRONTIER__.state;state.winner=0;state.victoryReason='Result/update durability fixture';
 });
 await expect(page.locator('.result-dialog')).toBeVisible();
 await page.locator('#apply-update').click();
 await page.waitForTimeout(300);
 await expect(page.locator('#result-save-status')).toContainText('Saving your result');
 expect(await page.evaluate(()=>window.__FRONTIER__.profile.games)).toBe(0);
 await Promise.all([page.waitForEvent('load'),page.evaluate(()=>{(window as any).__RELEASE_RESULT_DB__();})]);
 await expect(action(page,'skirmish')).toBeVisible();
 expect(await page.evaluate(()=>window.__FRONTIER__.profile.games)).toBe(1);
 await expect(action(page,'continue')).toHaveCount(0);
 await expect(page.locator('#apply-update')).toHaveCount(0);
});

test('an update already saving rejects native surrender and restores the unfinished battle',async({page,request})=>{
 test.skip(!!process.env.FRONTIER_TEST_URL,'Needs the local test-only release endpoint.');
 test.info().annotations.push({type:'controlled-fixture',description:'IndexedDB success delivery is held during the real update save. Battle setup, surrender attempt, update consent and Continue use native controls; no battle, result or profile data is injected.'});
 await launch(page,{difficulty:'easy'});await pause(page);await ready(page);
 await action(page,'pause-menu').click();await action(page,'save').click();
 await expect(page.locator('#toast')).toContainText('Battle saved on this device.');
 await page.getByRole('button',{name:'Surrender battle',exact:true}).click();
 const confirmation=page.getByRole('dialog',{name:'Surrender this battle?',exact:true});
 await expect(confirmation).toBeVisible();
 const snapshot=()=>page.evaluate(()=>{
  const f=window.__FRONTIER__ as typeof window.__FRONTIER__ & {readonly matchId:string},s=f.state;
  return {matchId:f.matchId,seed:s.settings.seed,tick:s.tick,time:s.time,paused:s.paused,
   winner:s.winner,reason:s.victoryReason,defeated:s.players[0].defeated,
   gold:s.players[0].gold,wood:s.players[0].wood,stats:s.players[0].stats,
   queue:s.pendingCommands,commands:s.commandLog,profile:f.profile};
 });
 const before=await snapshot();expect(before.winner).toBeNull();
 expect(before.commands.some(entry=>entry.command.type==='surrender')).toBe(false);
 const oldCaches=await page.evaluate(async()=>(await caches.keys()).filter(name=>name.startsWith('frontier-command-rts-game-')));
 expect(oldCaches.length).toBeGreaterThan(0);
 expect((await request.post('/__qa/release')).ok()).toBe(true);
 await page.evaluate(async()=>{await (await navigator.serviceWorker.getRegistration())!.update();});
 await expect(page.locator('#apply-update')).toBeVisible();
 await expect.poll(()=>page.evaluate(async()=>(await navigator.serviceWorker.getRegistration())?.waiting?.state)).toBe('installed');
 await page.evaluate(()=>{
  const fixture=window as Window & {__PWA_SURRENDER_DB_WAITING__?:number;__RELEASE_PWA_SURRENDER_DB__?:()=>void};
  const originalOpen=indexedDB.open.bind(indexedDB),deferred:(()=>void)[]=[];let held=true;
  fixture.__PWA_SURRENDER_DB_WAITING__=0;
  fixture.__RELEASE_PWA_SURRENDER_DB__=()=>{
   held=false;indexedDB.open=originalOpen;
   for(const callback of deferred.splice(0))callback();
   fixture.__PWA_SURRENDER_DB_WAITING__=0;
  };
  indexedDB.open=((name:string,version?:number)=>{
   const request=version===undefined?originalOpen(name):originalOpen(name,version);
   return new Proxy(request,{
    get(target,key){const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;},
    set(target,key,value){
     if(key==='onsuccess'){
      target.onsuccess=event=>{
       const invoke=()=>value?.call(target,event);
       if(held){deferred.push(invoke);fixture.__PWA_SURRENDER_DB_WAITING__=deferred.length;}
       else invoke();
      };
      return true;
     }
     return Reflect.set(target,key,value,target);
    },
   });
  }) as typeof indexedDB.open;
 });
 await page.getByRole('button',{name:'Update & restart',exact:true}).click();
 await expect(page.locator('#apply-update')).toBeDisabled();
 await expect(page.locator('#apply-update')).toHaveText('Saving & restarting…');
 await expect.poll(()=>page.evaluate(()=>(window as Window & {__PWA_SURRENDER_DB_WAITING__?:number}).__PWA_SURRENDER_DB_WAITING__)).toBeGreaterThan(0);
 await confirmation.getByRole('button',{name:'Confirm surrender',exact:true}).click();
 await expect(confirmation).toBeVisible();
 await expect(page.locator('.result-dialog')).toHaveCount(0);
 expect(await snapshot()).toEqual(before);
 await expect.poll(()=>page.evaluate(async()=>(await navigator.serviceWorker.getRegistration())?.waiting?.state)).toBe('installed');
 await Promise.all([
  page.waitForEvent('load'),
  page.evaluate(()=>{(window as Window & {__RELEASE_PWA_SURRENDER_DB__?:()=>void}).__RELEASE_PWA_SURRENDER_DB__!();}),
 ]);
 await expect(action(page,'continue')).toBeVisible();await ready(page);
 expect(await page.evaluate(()=>window.__FRONTIER__.profile)).toEqual(before.profile);
 await expect(page.locator('#apply-update')).toHaveCount(0);
 await action(page,'continue').click();
 await expect.poll(()=>page.evaluate(()=>window.__FRONTIER__.playing)).toBe(true);
 expect(await snapshot()).toEqual(before);
 await expect(page.locator('.result-dialog')).toHaveCount(0);
 await expect(confirmation).toHaveCount(0);
 await expect.poll(()=>page.evaluate(async()=>(await caches.keys()).filter(name=>name.startsWith('frontier-command-rts-game-')))).not.toEqual(oldCaches);
});
