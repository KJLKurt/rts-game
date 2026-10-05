import {test,expect,home,launch,action,pause,resume,clearGround,tap} from './helpers';
import {writeFile} from 'node:fs/promises';

test('a previous production cache upgrades to the identified build without losing paid queued orders',async({page,request})=>{
  test.skip(!process.env.FRONTIER_PREVIOUS_DIST || !!process.env.FRONTIER_TEST_URL,'Needs an isolated local host serving a saved previous dist via the test-only previous/release endpoints.');
  try {
    expect((await request.post('/__qa/previous')).ok()).toBe(true);
    await home(page);
    const oldRuntime=await page.locator('script[src]').first().getAttribute('src');
    await launch(page);await pause(page);
    await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
    await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);
    const oldCaches=await page.evaluate(async()=>(await caches.keys()).filter(n=>n.startsWith('frontier-command-rts-game-')));
    await action(page,'panel-army').click();await page.getByRole('button',{name:'Queue 3 at a time',exact:true}).click();
    const fundsBefore=await page.evaluate(()=>window.__FRONTIER__.state.players[0].gold);
    await resume(page);
    await page.getByRole('button',{name:'Recruit Swordsman',exact:true}).click();
    await expect.poll(()=>page.evaluate(()=>window.__FRONTIER__.state.entities.filter(e=>e.team===0).flatMap(e=>e.queue).filter(q=>q.type==='unit'&&q.id==='swordsman'&&q.paidCost?.gold===45).length)).toBe(3);
    await pause(page);
    expect(await page.evaluate(()=>window.__FRONTIER__.state.players[0].gold)).toBeLessThan(fundsBefore-100);
    await action(page,'panel-build').click();await page.getByRole('button',{name:'Build House',exact:true}).click();
    await tap(page,await clearGround(page,'house'));await action(page,'confirm-placement').click();
    const snapshot=()=>page.evaluate(()=>{const f=window.__FRONTIER__,s=f.state;return{seed:s.settings.seed,time:s.time,paused:s.paused,gold:s.players[0].gold,wood:s.players[0].wood,population:s.players[0].population,production:s.entities.filter(e=>e.team===0&&e.kind==='building').map(e=>({id:e.id,type:e.type,queue:e.queue})),orders:s.pendingCommands,profile:f.profile};});
    const before=await snapshot();expect(before.orders.map(c=>c.type)).toContain('build');
    expect(before.production.flatMap(e=>e.queue).filter(q=>q.type==='unit'&&q.id==='swordsman')).toHaveLength(3);
    expect((await request.post('/__qa/release')).ok()).toBe(true);
    await page.evaluate(async()=>{await (await navigator.serviceWorker.getRegistration())!.update();});
    await expect(page.locator('#apply-update')).toBeVisible();
    await expect.poll(snapshot).toEqual(before);
    await Promise.all([page.waitForEvent('load'),page.locator('#apply-update').click()]);
    const identifier=page.locator('footer [data-build-id]');await expect(identifier).toBeVisible();
    const id=await identifier.getAttribute('data-build-id');expect(id).toMatch(/^fc-[0-9a-f]{12}$/);
    if(process.env.FRONTIER_EXPECT_BUILD_ID)expect(id).toBe(process.env.FRONTIER_EXPECT_BUILD_ID);
    const newRuntime=await page.locator('script[src]').first().getAttribute('src');
    expect(newRuntime).not.toBe(oldRuntime);
    await action(page,'continue').click();await expect.poll(()=>page.evaluate(()=>window.__FRONTIER__.playing)).toBe(true);
    await expect.poll(snapshot).toEqual(before);
    await expect(page.locator('#apply-update')).toHaveCount(0);
    await expect.poll(()=>page.evaluate(async()=>(await caches.keys()).filter(n=>n.startsWith('frontier-command-rts-game-')))).not.toEqual(oldCaches);
    const cachesNow=await page.evaluate(async()=>(await caches.keys()).filter(n=>n.startsWith('frontier-command-rts-game-')));
    expect(cachesNow).toHaveLength(1);expect(cachesNow.some(n=>oldCaches.includes(n))).toBe(false);
    await writeFile(test.info().outputPath('previous-cache-upgrade.json'),JSON.stringify({oldRuntime,newRuntime,buildId:id,oldCaches,cachesNow,before,after:await snapshot()},null,2));
    await page.screenshot({path:test.info().outputPath('previous-cache-queued-battle-resumed.png')});
  } finally {await request.post('/__qa/release');}
});
