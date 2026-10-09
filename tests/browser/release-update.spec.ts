import {test,expect,home,launch,action,pause,resume,clearGround,tap} from './helpers';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';

test('a previous production cache upgrades to the identified build without losing paid queued orders',async({page,request})=>{
  test.setTimeout(100_000);
  test.skip(!process.env.FRONTIER_PREVIOUS_DIST || !!process.env.FRONTIER_TEST_URL,'Needs an isolated local host serving a saved previous dist via the test-only previous/release endpoints.');
  const lifecycle:unknown[]=[];
  const record=(event:string,detail:unknown)=>lifecycle.push({at:new Date().toISOString(),event,detail});
  const workerSnapshot=()=>page.evaluate(async()=>{
    const describe=(worker:ServiceWorker|null)=>worker?{scriptURL:worker.scriptURL,state:worker.state}:null;
    const registrations=await navigator.serviceWorker.getRegistrations();
    return{url:location.href,controller:describe(navigator.serviceWorker.controller),registrations:registrations.map(registration=>({scope:registration.scope,installing:describe(registration.installing),waiting:describe(registration.waiting),active:describe(registration.active)})),caches:await caches.keys(),runtime:document.querySelector('script[src]')?.getAttribute('src')??null};
  });
  await page.exposeFunction('__recordUpdateLifecycle',(detail:unknown)=>record('browser-lifecycle',detail));
  await page.addInitScript(()=>{
    const emit=(event:string,worker:ServiceWorker|null=null)=>{
      const detail={event,url:location.href,time:performance.now(),controller:navigator.serviceWorker.controller?.scriptURL??null,worker:worker?{scriptURL:worker.scriptURL,state:worker.state}:null};
      void (window as unknown as {__recordUpdateLifecycle:(value:unknown)=>Promise<void>}).__recordUpdateLifecycle(detail).catch(()=>undefined);
    };
    navigator.serviceWorker.addEventListener('controllerchange',()=>emit('controllerchange',navigator.serviceWorker.controller));
    window.addEventListener('pagehide',()=>emit('pagehide'));
    window.addEventListener('load',()=>emit('load'));
    const seen=new WeakSet<ServiceWorker>();
    const watch=(registration:ServiceWorkerRegistration)=>{
      for(const worker of [registration.installing,registration.waiting,registration.active])if(worker&&!seen.has(worker)){
        seen.add(worker);emit('worker-observed',worker);
        worker.addEventListener('statechange',()=>emit('worker-statechange',worker));
      }
    };
    const registrations=new WeakSet<ServiceWorkerRegistration>();
    const observe=(registration:ServiceWorkerRegistration)=>{
      if(!registrations.has(registration)){registrations.add(registration);registration.addEventListener('updatefound',()=>{emit('updatefound');watch(registration);});}
      watch(registration);
    };
    window.addEventListener('DOMContentLoaded',()=>{void navigator.serviceWorker.getRegistration().then(registration=>{if(registration)observe(registration);});});
    void navigator.serviceWorker.ready.then(registration=>{emit('ready',registration.active);observe(registration);});
  });
  page.on('framenavigated',frame=>{if(frame===page.mainFrame())record('navigation',frame.url());});
  page.on('console',message=>{if(['warning','error'].includes(message.type()))record('console',{type:message.type(),text:message.text()});});
  page.on('requestfailed',request=>record('request-failed',{url:request.url(),failure:request.failure()}));
  try {
    const previousDist=resolve(process.env.FRONTIER_PREVIOUS_DIST!);
    const previousWorker=await readFile(resolve(previousDist,'sw.js'),'utf8');
    const expectedCache=previousWorker.match(/const CACHE=['"]([^'"]+)['"]/)?.[1];
    const assetDeclaration=previousWorker.match(/const ASSETS=(\[.*?\]);/)?.[1];
    expect(expectedCache,'The previous build declares its exact cache identity').toBeTruthy();
    expect(assetDeclaration,'The previous build declares its complete precache').toBeTruthy();
    const expectedAssets=JSON.parse(assetDeclaration!) as string[];
    expect(expectedAssets.length).toBeGreaterThan(0);
    expect(expectedAssets.every(asset=>asset.startsWith('/rts-game/'))).toBe(true);
    const expectedBytes=await Promise.all(expectedAssets.map(async asset=>{
      const bytes=await readFile(resolve(previousDist,asset.slice('/rts-game/'.length)));
      return{path:asset,size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
    }));
    expect((await request.post('/__qa/previous')).ok()).toBe(true);
    await home(page);
    const oldRuntime=await page.locator('script[src]').first().getAttribute('src');
    record('initial-home',await workerSnapshot());
    // Establish an installed previous-cache returning client before any battle.
    // This single ordinary reload is unconditional setup, never an update retry.
    // First-load claim observations remain evidence, not a claimed bootstrap fix.
    await expect.poll(async()=>{
      const snapshot=await workerSnapshot();record('previous-activation-poll',snapshot);
      return snapshot.registrations.find(registration=>registration.scope===new URL('./',page.url()).href)?.active?.state;
    }).toBe('activated');
    const cachedPrevious=await page.evaluate(async name=>{
      const names=(await caches.keys()).filter(key=>key.startsWith('frontier-command-rts-game-'));
      if(!names.includes(name))return{names,urls:[],bytes:[]};
      const cache=await caches.open(name),requests=await cache.keys();
      const bytes=await Promise.all(requests.map(async request=>{
        const response=await cache.match(request);
        if(!response||!response.ok)throw new Error(`Missing successful cached response: ${request.url}`);
        const buffer=await response.arrayBuffer();
        const digest=await crypto.subtle.digest('SHA-256',buffer);
        return{path:new URL(request.url).pathname,size:buffer.byteLength,sha256:Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('')};
      }));
      return{names,urls:requests.map(request=>request.url).sort(),bytes:bytes.sort((a,b)=>a.path.localeCompare(b.path))};
    },expectedCache!);
    record('previous-precache',cachedPrevious);
    expect(cachedPrevious.names).toEqual([expectedCache]);
    expect(cachedPrevious.urls).toEqual(expectedAssets.map(asset=>new URL(asset,page.url()).href).sort());
    expect(cachedPrevious.bytes).toEqual(expectedBytes.sort((a,b)=>a.path.localeCompare(b.path)));
    record('before-ordinary-reload',await workerSnapshot());
    const returningResponse=await page.reload();
    expect(returningResponse?.fromServiceWorker(),'The returning document is served by the real previous worker').toBe(true);
    await expect(action(page,'skirmish')).toBeVisible();
    await expect.poll(()=>page.evaluate(()=>navigator.serviceWorker.controller?.state)).toBe('activated');
    expect(await page.evaluate(()=>navigator.serviceWorker.controller?.scriptURL)).toBe(new URL('sw.js',page.url()).href);
    expect(await page.locator('script[src]').first().getAttribute('src')).toBe(oldRuntime);
    expect(await page.evaluate(async()=>(await caches.keys()).filter(name=>name.startsWith('frontier-command-rts-game-')))).toEqual([expectedCache]);
    record('returning-previous-client',await workerSnapshot());
    await launch(page);await pause(page);
    await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
    await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);
    expect(await page.locator('script[src]').first().getAttribute('src')).toBe(oldRuntime);
    record('controlled-previous-battle',await workerSnapshot());
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
    // Continue beyond restored equality: the same paid jobs and planned House
    // must execute exactly once through native Resume, not merely deserialize.
    const housePlan=before.orders.find(c=>c.type==='build');
    if(!housePlan||housePlan.type!=='build')throw new Error('Expected one paid-state House plan.');
    const workBefore=await page.evaluate(()=>{const s=window.__FRONTIER__.state;return{created:s.players[0].stats.unitsCreated,stats:{...s.players[0].stats},houses:s.entities.filter(e=>e.team===0&&e.type==='house').map(e=>e.id)};});
    const queueIds=before.production.flatMap(b=>b.queue).map(q=>q.queueId);
    expect(queueIds).toHaveLength(3);expect(new Set(queueIds).size).toBe(3);expect(queueIds.every(Boolean)).toBe(true);
    await resume(page);
    await expect.poll(()=>page.evaluate(({queueIds,plan})=>{const s=window.__FRONTIER__.state;return{paidJobsRemaining:s.entities.filter(e=>e.team===0).flatMap(e=>e.queue).filter(q=>queueIds.includes(q.queueId)).length,completedHouses:s.entities.filter(e=>e.team===0&&e.type==='house'&&e.x===plan.x&&e.y===plan.y&&e.buildProgress>=1).length};},{queueIds,plan:housePlan}),{timeout:50_000,intervals:[100]}).toEqual({paidJobsRemaining:0,completedHouses:1});
    await pause(page);
    const completed=await snapshot();
    const workAfter=await page.evaluate(()=>{const s=window.__FRONTIER__.state;return{created:s.players[0].stats.unitsCreated,stats:{...s.players[0].stats},houses:s.entities.filter(e=>e.team===0&&e.type==='house').map(e=>e.id)};});
    expect(workAfter.created-workBefore.created).toBe(3);
    expect(workAfter.houses).toHaveLength(workBefore.houses.length+1);
    expect(completed.orders).toEqual([]);
    expect(completed.gold-before.gold-(workAfter.stats.goldCollected-workBefore.stats.goldCollected)).toBeCloseTo(0,6);
    expect(completed.wood-before.wood-(workAfter.stats.woodCollected-workBefore.stats.woodCollected)).toBeCloseTo(-65,6);
    await action(page,'pause-menu').click();await action(page,'save-leave').click();
    await expect(action(page,'continue')).toBeVisible();await page.reload();await action(page,'continue').click();
    await expect.poll(()=>page.evaluate(()=>window.__FRONTIER__.playing)).toBe(true);
    await expect.poll(snapshot).toEqual(completed);
    const reloaded=await snapshot();
    await resume(page);await pause(page);
    expect(await page.evaluate(()=>window.__FRONTIER__.state.players[0].stats.unitsCreated)).toBe(workAfter.created);
    expect(await page.evaluate(()=>window.__FRONTIER__.state.entities.filter(e=>e.team===0&&e.type==='house').map(e=>e.id))).toEqual(workAfter.houses);
    await writeFile(test.info().outputPath('previous-cache-production-completed-once.json'),JSON.stringify({oldRuntime,newRuntime,buildId:id,housePlan,queueIds,before,workBefore,completed,workAfter,reloaded,afterRepeatedResume:await snapshot()},null,2));
    await page.screenshot({path:test.info().outputPath('previous-cache-production-completed-once.png')});
  } finally {
    try {
      try{record('final-observation',await workerSnapshot());}catch(error){record('final-observation-unavailable',String(error));}
      await writeFile(test.info().outputPath('previous-cache-bootstrap-lifecycle.json'),JSON.stringify({setup:'One ordinary reload after exact previous precache verification, before battle; first-load claim is observed, not repaired or accepted by this test.',lifecycle},null,2));
    } finally {await request.post('/__qa/release');}
  }
});
