import { test, expect, launch, action, pause, tap } from "./helpers";

test("dense troop counts include only visible on-screen living units and preserve native selection", async ({ page }) => {
  await page.addInitScript(() => {
    const original = CanvasRenderingContext2D.prototype.fillText;
    (window as any).__TROOP_LABELS__ = [];
    CanvasRenderingContext2D.prototype.fillText = function(text, ...args) {
      if (text.includes("visible troops")) {
        const labels = (window as any).__TROOP_LABELS__ as string[];
        if (!labels.includes(text)) labels.push(text);
      }
      return original.call(this, text, ...args);
    };
  });
  await launch(page, { difficulty: "easy" }); await pause(page);
  if (!await page.locator(".command-deck").evaluate(el => el.classList.contains("collapsed"))) await action(page, "toggle-deck").click();
  const before = await page.evaluate(() => {
    // Controlled renderer fixture, never an earned match or gameplay outcome.
    // Keep the actual commander/buildings and use normal native controls after setup.
    const f=window.__FRONTIER__,s=f.state,c=s.entities.find(e=>e.team===0&&e.kind==="commander")!;
    const template=s.entities.find(e=>e.team===0&&e.kind==="unit")!;
    s.entities=s.entities.filter(e=>e.kind!=="unit");
    for(let i=0;i<12;i++)s.entities.push({...structuredClone(template),id:`visible-${i}`,x:c.x+2+(i%4)*.08,y:c.y+2+Math.floor(i/4)*.08,order:{type:"idle"}});
    const hiddenPoint={x:c.x+4,y:c.y+4};
    for(let i=0;i<12;i++)s.entities.push({...structuredClone(template),id:`hidden-${i}`,team:1,x:hiddenPoint.x,y:hiddenPoint.y,order:{type:"idle"}});
    s.fog.visible[0][Math.floor(hiddenPoint.y)*s.map.width+Math.floor(hiddenPoint.x)]=0;
    for(let i=0;i<8;i++)s.entities.push({...structuredClone(template),id:`offscreen-${i}`,x:31,y:31,order:{type:"idle"}});
    for(let i=0;i<6;i++)s.entities.push({...structuredClone(template),id:`dead-${i}`,hp:0,x:c.x+2,y:c.y+2});
    for(let i=0;i<6;i++)s.entities.push({...structuredClone(template),id:`recovering-${i}`,respawnAt:10000,x:c.x+2,y:c.y+2});
    const visible=s.entities.find(e=>e.id==="visible-0")!;
    s.fog.visible[0][Math.floor(visible.y)*s.map.width+Math.floor(visible.x)]=1;
    (window as any).__TROOP_LABELS__=[];
    return JSON.stringify(s);
  });
  await expect.poll(() => page.evaluate(() => (window as any).__TROOP_LABELS__)).toEqual(["You · 12 visible troops"]);
  await page.screenshot({ path: test.info().outputPath("dense-visible-troop-summary.png") });
  expect(await page.evaluate(() => JSON.stringify(window.__FRONTIER__.state))).toBe(before);
  await action(page,"select-army").click();
  await expect(page.locator("#selection-info")).toContainText("units selected");
  await action(page,"select-commander").click();
  const point=await page.evaluate(()=>{
    const f=window.__FRONTIER__,c=f.state.entities.find(e=>e.team===0&&e.kind==="commander")!,p=f.renderer.worldToScreen(c.x,c.y);
    return {...p,hit:document.elementFromPoint(p.x,p.y)?.id};
  });
  expect(point.hit).toBe("world");await tap(page,point);
  await expect(page.locator("#selection-info")).toContainText("Warlord");
  expect(await page.evaluate(()=>window.__FRONTIER__.state.pendingCommands)).toHaveLength(0);
  await test.info().attach("dense-render-fixture",{body:JSON.stringify({controlledPresentationFixture:true,visible:12,hidden:12,offscreen:8,dead:6,recovering:6,renderDidNotChangeSimulation:true,nativeSelectionPreserved:true}),contentType:"application/json"});
});

test("dense troop badges remain outside visible HUD controls through panel changes and rotation", async ({page}) => {
  await page.addInitScript(() => {
    const round = CanvasRenderingContext2D.prototype.roundRect;
    const text = CanvasRenderingContext2D.prototype.fillText;
    let last: {x:number;y:number;w:number;h:number} | undefined;
    (window as any).__BADGE_PAINTS__=[];
    CanvasRenderingContext2D.prototype.roundRect=function(x,y,w,h,...args) {
      last={x,y,w,h};return round.call(this,x,y,w,h,...args);
    };
    CanvasRenderingContext2D.prototype.fillText=function(value,...args) {
      if(value.includes('visible troops')&&last) {
        const paints=(window as any).__BADGE_PAINTS__;
        paints.push({text:value,...last,at:performance.now()});
        if(paints.length>120)paints.splice(0,paints.length-120);
      }
      return text.call(this,value,...args);
    };
  });
  await launch(page,{difficulty:'normal',commander:'ranger'});await pause(page);
  if(await page.locator('.command-deck').evaluate(el=>el.classList.contains('collapsed')))await action(page,'toggle-deck').click();
  await action(page,'panel-research').click();
  const before=await page.evaluate(()=>{
    // Presentation-only density fixture. No earned outcome or balance claim.
    const f=window.__FRONTIER__,s=f.state,r=f.renderer as any;
    const strip=document.querySelector('#commander-strip')!.getBoundingClientRect();
    const deck=document.querySelector('.command-deck')!.getBoundingClientRect();
    const point=r.screenToWorld(innerWidth*.48,Math.min(deck.top-30,strip.height?strip.top+96:innerHeight*.55));
    const templates=new Map(s.entities.filter(e=>e.team===0&&e.kind==='unit').map(e=>[e.type,e]));
    s.entities=s.entities.filter(e=>e.kind!=='unit');
    const types=['archer','archer','archer','archer','archer','archer','archer','archer','archer','archer','archer','archer','archer','archer','archer','archer','archer','spearman','spearman','spearman','swordsman'] as const;
    types.forEach((type,i)=>{
      const e={...structuredClone(templates.get(type)!),id:`badge-fixture-${i}`,x:point.x+(i%5)*.07,y:point.y+Math.floor(i/5)*.07,order:{type:'idle' as const}};
      s.entities.push(e);s.fog.visible[0][Math.floor(e.y)*s.map.width+Math.floor(e.x)]=1;
    });
    (window as any).__BADGE_PAINTS__=[];return JSON.stringify(s);
  });
  const check=async(name:string)=>{
    const since=await page.evaluate(()=>performance.now());
    await expect.poll(()=>page.evaluate(since=>{
      const latest=new Map<string,any>();for(const p of (window as any).__BADGE_PAINTS__??[])if(p.at>since&&performance.now()-p.at<250)latest.set(p.text,p);
      const controls=[...document.querySelectorAll('.hud,.objective-bar,.battle-hint,.minimap-wrap,.map-controls,.commander-strip,#joystick,.ability-dock,.command-deck,.paused-ribbon,.placement-toolbar,#toast.show,#update')].filter(el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)>0&&r.width>0&&r.height>0;}).map(el=>({selector:el.id||el.className,rect:el.getBoundingClientRect().toJSON()}));
      const badges=[...latest.values()];return {count:badges.length,clear:badges.every(p=>p.x>=7&&p.y>=7&&p.x+p.w<=innerWidth-7&&p.y+p.h<=innerHeight-7&&controls.every(({rect:r})=>p.x+p.w<=r.left-3||p.x>=r.right+3||p.y+p.h<=r.top-3||p.y>=r.bottom+3))};
    },since),`Readable, unobscured troop badge: ${name}`).toEqual({count:1,clear:true});
    expect(await page.evaluate(()=>JSON.stringify(window.__FRONTIER__.state))).toBe(before);
    const geometry=await page.evaluate(()=>({viewport:{width:innerWidth,height:innerHeight},paints:(window as any).__BADGE_PAINTS__.slice(-3)}));
    await test.info().attach(name,{body:JSON.stringify({presentationFixture:true,simulationUnchanged:true,...geometry}),contentType:'application/json'});
    await page.screenshot({path:test.info().outputPath(`${name}.png`)});
  };
  await check('expanded-research');
  await action(page,'toggle-deck').click();await check('collapsed-deck');
  await action(page,'toggle-minimap').click();await check('collapsed-map');
  const viewport=page.viewportSize()!;await page.setViewportSize({width:viewport.height,height:viewport.width});await check('rotated-controls');
  await action(page,'pause-menu').click();await action(page,'settings').click();await page.locator('#ui-scale').selectOption('1.3');await page.getByRole('button',{name:'Done',exact:true}).click();await check('largest-interface');
  await action(page,'select-army').click();await expect(page.locator('#selection-info')).toContainText('units selected');
  await action(page,'select-commander').click();await expect(page.locator('#selection-info')).toContainText('Ranger');
  expect(await page.evaluate(()=>window.__FRONTIER__.state.pendingCommands)).toHaveLength(0);
});
