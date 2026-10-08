import { action, expect, home, launch, pause, resume, tap, test } from './helpers';

const breach = (page: import('@playwright/test').Page) => page.getByRole('button', {name:'Breach Charge', exact:true});
async function nativeBreach(page: import('@playwright/test').Page) {
  const r = await breach(page).boundingBox(); expect(r).not.toBeNull();
  await tap(page, {x:r!.x+r!.width/2,y:r!.y+r!.height/2});
}

test('Engineer siege button explains missing structures without spending cooldown or a paused order', async ({page}) => {
  await launch(page, {commander:'engineer',difficulty:'easy'}); await pause(page);
  await expect(breach(page)).toContainText('Buildings only');
  await nativeBreach(page);
  await page.keyboard.press("c");
  await expect(page.locator('#toast')).toContainText(/visible.*building|structure/i);
  expect(await page.evaluate(() => {
    const s=window.__FRONTIER__.state,c=s.entities.find(e=>e.team===0&&e.kind==='commander')!;
    return {queued:s.pendingCommands.length,cooldown:c.abilityCooldowns.breach??0};
  })).toEqual({queued:0,cooldown:0});
  await expect(page.getByRole('button',{name:'Runic Turret',exact:true})).toBeEnabled();
  await expect(page.getByRole('button',{name:'Field Repair',exact:true})).toBeEnabled();
});

for (const input of ['native','keyboard'] as const) test(`${input} Breach queues once, survives save reload, then strikes the intended structure`, async ({page}) => {
  await launch(page, {commander:'engineer',difficulty:'easy'}); await pause(page);
  // Controlled mechanic fixture, not natural campaign/progression evidence.
  await page.evaluate(() => {
    const s=window.__FRONTIER__.state,c=s.entities.find(e=>e.team===0&&e.kind==='commander')!;
    s.players.forEach(p=>p.ai=false);
    s.entities.forEach(e=>e.damage=0);
    const template=s.entities.find(e=>e.kind==='building'&&e.team===1)!;
    s.entities.push({...structuredClone(template),id:'qa-breach-structure',type:'house',x:c.x+5.5,y:c.y,hp:1000,maxHp:1000,damage:0,range:0,radius:.5,queue:[]});
    s.fog.visible[0].fill(1);
  });
  await expect(breach(page)).toContainText('Breach Charge');
  for(const key of ['Control+c','Meta+c','Alt+c']) await page.keyboard.press(key);
  expect(await page.evaluate(()=>window.__FRONTIER__.state.pendingCommands.length)).toBe(0);
  if(input==='native') await nativeBreach(page); else await page.keyboard.press('c');
  await expect(breach(page)).toBeDisabled(); await expect(breach(page)).toContainText('Queued');
  expect(await page.evaluate(()=>({queued:window.__FRONTIER__.state.pendingCommands.filter(c=>c.type==='ability'&&c.ability==='breach').length,hp:window.__FRONTIER__.state.entities.find(e=>e.id==='qa-breach-structure')!.hp}))).toEqual({queued:1,hp:1000});
  await action(page,'pause-menu').click();await action(page,'save-leave').click();await page.reload();await action(page,'continue').click();
  await expect(breach(page)).toBeDisabled(); await expect(breach(page)).toContainText('Queued');
  await resume(page);
  await expect.poll(()=>page.evaluate(()=>window.__FRONTIER__.state.events.some(e=>e.type==='hit'&&e.entityId==='qa-breach-structure'&&e.value===180))).toBe(true);
  await pause(page);
  expect(await page.evaluate(()=>window.__FRONTIER__.state.entities.find(e=>e.id==='qa-breach-structure')!.hp)).toBe(820);
  await expect(breach(page)).toBeDisabled();
  await page.screenshot({path:test.info().outputPath('engineer-breach-after-restored-cast.png')});
});

test('all three Engineer controls remain distinct native targets with large text and expanded panels',async({page})=>{
  await home(page); await action(page,'settings').click();
  await page.getByLabel("Interface text size",{exact:true}).selectOption("1.3");
  await action(page,'close-dialog').click();
  await launch(page,{commander:'engineer',difficulty:'easy'});await pause(page);
  const viewport=page.viewportSize()!;
  const widths=viewport.width<600 ? [360,390,430] : [viewport.width];
  for(const width of widths) {
  await page.setViewportSize({width,height:viewport.height});
  for(let cycle=0;cycle<2;cycle++) {
    await action(page,'toggle-deck').click();
    for(const id of ['turret','repair','breach']) {
      const control=page.locator(`[data-action="ability"][data-id="${id}"]`);
      const proof=await control.evaluate(el=>{const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest<HTMLElement>('[data-action]');return {width:r.width,height:r.height,left:r.left,top:r.top,right:r.right,bottom:r.bottom,viewportWidth:innerWidth,viewportHeight:innerHeight,id:hit?.dataset.id,action:hit?.dataset.action};});
      expect(proof.width).toBeGreaterThanOrEqual(44);expect(proof.height).toBeGreaterThanOrEqual(44);expect(proof.left).toBeGreaterThanOrEqual(0);expect(proof.top).toBeGreaterThanOrEqual(0);expect(proof.right).toBeLessThanOrEqual(proof.viewportWidth);expect(proof.bottom).toBeLessThanOrEqual(proof.viewportHeight);expect(proof).toMatchObject({id,action:'ability'});
    }
  }
  await nativeBreach(page);await expect(breach(page)).toBeEnabled();
  await page.screenshot({path:test.info().outputPath(`engineer-three-ability-${width}px.png`)});
  }
  await page.setViewportSize(viewport);
});

test('native Attack targeting directs Breach to a farther structure instead of the nearest one',async({page})=>{
  await launch(page,{commander:'engineer',difficulty:'easy'});await pause(page);
  await action(page,'select-commander').click();
  await action(page,'order-attack').click();
  const target=await page.evaluate(()=>{
    const {state:s,renderer:r}=window.__FRONTIER__,c=s.entities.find(e=>e.team===0&&e.kind==='commander')!;
    s.players.forEach(p=>p.ai=false);s.entities.forEach(e=>e.damage=0);
    const candidates=Array.from({length:16},(_,i)=>({x:c.x+Math.cos(i*Math.PI/8)*5.5,y:c.y+Math.sin(i*Math.PI/8)*5.5}));
    const world=candidates.find(p=>{
      const screen=r.worldToScreen(p.x,p.y);
      return p.x>1&&p.y>1&&p.x<s.map.width-1&&p.y<s.map.height-1&&screen.x>30&&screen.x<innerWidth-30&&screen.y>100&&screen.y<innerHeight-50
        &&[-22,0,22].every(dx=>[-22,0,22].every(dy=>document.elementFromPoint(screen.x+dx,screen.y+dy)?.id==='world'))
        &&s.entities.every(e=>Math.hypot(e.x-p.x,e.y-p.y)>e.radius+1);
    });
    if(!world)throw new Error('Fixture cannot place a clear native building target.');
    const template=s.entities.find(e=>e.kind==='building'&&e.team===1)!;
    s.entities.push({...structuredClone(template),id:'qa-explicit-breach',type:'house',...world,hp:1000,maxHp:1000,damage:0,range:0,radius:.5,queue:[]});
    s.entities.push({...structuredClone(template),id:'qa-nearer-breach',type:'house',x:c.x-(world.x-c.x)*.55,y:c.y-(world.y-c.y)*.55,hp:1000,maxHp:1000,damage:0,range:0,radius:.5,queue:[]});
    s.fog.visible[0].fill(1);
    return {world,screen:r.worldToScreen(world.x,world.y)};
  });
  let painted: {x:number;y:number}|null=null;
  await expect.poll(async()=>{
    painted=await page.evaluate(()=>{
      const {state:s,renderer:r}=window.__FRONTIER__,entity=s.entities.find(e=>e.id==='qa-explicit-breach')!,center=r.worldToScreen(entity.x,entity.y);
      for(let dy=-40;dy<=0;dy+=5)for(let dx=-20;dx<=20;dx+=5){
        const p={x:center.x+dx,y:center.y+dy};
        if((r.pick(s,p.x,p.y) as {id?:string}|null)?.id!==entity.id)continue;
        if([-22,0,22].every(x=>[-22,0,22].every(y=>document.elementFromPoint(p.x+x,p.y+y)?.id==='world')))return p;
      }
      return null;
    });return !!painted;
  }).toBe(true);
  await tap(page,painted!);
  await expect.poll(()=>page.evaluate(()=>window.__FRONTIER__.state.pendingCommands.some(c=>c.type==='attack'&&c.targetId==='qa-explicit-breach'))).toBe(true);
  await nativeBreach(page);
  const queued=await page.evaluate(()=>window.__FRONTIER__.state.pendingCommands.find(c=>c.type==='ability'&&c.ability==='breach'));
  expect(queued).toMatchObject({type:'ability',ability:'breach',x:target.world.x,y:target.world.y});
});
