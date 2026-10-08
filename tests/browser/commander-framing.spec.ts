import {test, expect, action, launch, pause, tap} from './helpers';
import type {Page, BrowserContext} from '@playwright/test';

async function settings(page:Page, theme:string, scale='1') {
  await action(page,'pause-menu').click();await action(page,'settings').click();
  await page.getByLabel('Visual theme',{exact:true}).selectOption(theme);
  await expect(page.locator('#theme-status')).toHaveText('Artwork ready.');
  await page.getByLabel('Interface text size',{exact:true}).selectOption(scale);
  await page.getByRole('dialog',{name:'Settings',exact:true}).getByRole('button',{name:'Done',exact:true}).click();
}
async function maximumZoom(page:Page,context:BrowserContext,isMobile:boolean) {
  if(!isMobile)for(let i=0;i<6;i++)await action(page,'zoom-in').first().click();
  else {
    const start=await page.evaluate(()=>{
      for(let y=150;y<innerHeight-75;y+=12)for(let x=85;x<innerWidth-85;x+=12)
        if([x-70,x+70,x-22,x+22].every(px=>document.elementFromPoint(px,y)?.id==='world'))return{x,y};
      throw Error('No clear two-finger zoom region');
    });
    const cdp=await context.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:start.x-22,y:start.y},{x:start.x+22,y:start.y}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:start.x-70,y:start.y},{x:start.x+70,y:start.y}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
  }
  expect(await page.evaluate(()=>window.__FRONTIER__.renderer.camera.zoom)).toBe(2.4);
}
async function exposedCommander(page:Page) {
  return page.evaluate(()=>{
    const f=window.__FRONTIER__,r=f.renderer,e=f.state.entities.find(e=>e.team===0&&e.kind==='commander'&&e.hp>0)!;
    const hits=(r as unknown as {entityHits:Map<string,{image:HTMLImageElement;frame:{x:number;y:number;w:number;h:number};bounds:{x:number;y:number;width:number;height:number};matrix:DOMMatrix}>}).entityHits;
    const hit=hits.get(e.id)!;if(!hit)throw Error('Commander must have an actual painted sprite');
    const bitmap=document.createElement('canvas');bitmap.width=hit.frame.w;bitmap.height=hit.frame.h;
    const c=bitmap.getContext('2d',{willReadFrequently:true})!;
    c.drawImage(hit.image,hit.frame.x,hit.frame.y,hit.frame.w,hit.frame.h,0,0,bitmap.width,bitmap.height);
    const alpha=c.getImageData(0,0,bitmap.width,bitmap.height).data;
    let opaque=0,covered=0;let native:{x:number;y:number}|undefined;let nativeScore=Infinity;
    for(let y=0;y<bitmap.height;y+=3)for(let x=0;x<bitmap.width;x+=3){
      if(alpha[(y*bitmap.width+x)*4+3]<100)continue;
      const p=new DOMPoint(hit.bounds.x+(x+.5)/bitmap.width*hit.bounds.width,hit.bounds.y+(y+.5)/bitmap.height*hit.bounds.height).matrixTransform(hit.matrix);
      opaque++;if(document.elementFromPoint(p.x,p.y)?.id!=='world')covered++;
      else if(x%18===0&&y%18===0&&[-2,0,2].every(dx=>[-2,0,2].every(dy=>(r.pick(f.state,p.x+dx,p.y+dy) as {id?:string}|undefined)?.id===e.id))){
        const score=Math.hypot(x/bitmap.width-.5,y/bitmap.height-.55);
        if(score<nativeScore){nativeScore=score;native={x:p.x,y:p.y};}
      }
    }
    const ground=r.worldToScreen(e.x,e.y),z=r.camera.zoom;
    const health=[-20,0,20].map(x=>({x:ground.x+x*z,y:ground.y-82*z}));
    return{id:e.id,commanderType:e.type,opaque,covered,native,ground,zoom:z,healthExposed:health.every(p=>document.elementFromPoint(p.x,p.y)?.id==='world'),collapsed:document.querySelector('.command-deck')!.classList.contains('collapsed'),stateTime:f.state.time};
  });
}

test('maximum-zoom Focus exposes every commander body and health bar above the existing HUD',async({page,context,isMobile})=>{
  test.setTimeout(180_000);
  const proofs=[];
  for(const commander of ['ranger','warlord','engineer']) {
    await launch(page,{difficulty:'easy',commander});await pause(page);
    for(const theme of ['christmas','mythic']) {
      await settings(page,theme);
      for(const requestedCollapsed of [false,true]) {
        // Begin the native pinch with the deck minimized; then reproduce the
        // requested expanded/collapsed state before the actual Focus press.
        if(!await page.locator('.command-deck').evaluate(el=>el.classList.contains('collapsed')))await action(page,'toggle-deck').click();
        await maximumZoom(page,context,isMobile);
        if(!requestedCollapsed)await action(page,'toggle-deck').click();
        const before=await page.evaluate(()=>JSON.stringify(window.__FRONTIER__.state));
        await action(page,'focus').first().click();
        await expect.poll(async()=>{const p=await exposedCommander(page);return p.covered===0&&p.healthExposed;}).toBe(true);
        const proof=await exposedCommander(page);expect(proof.opaque).toBeGreaterThan(50);expect(proof.native).toBeDefined();
        await action(page,'select-army').click();await tap(page,proof.native!);
        await expect.poll(()=>page.locator('#selection-info').innerText()).toContain(commander==='ranger'?'Ranger':commander==='warlord'?'Warlord':'Engineer');
        expect(await page.evaluate(()=>JSON.stringify(window.__FRONTIER__.state))).toBe(before);
        const name=`${commander}-${theme}-${requestedCollapsed?'collapsed':'expanded'}`;
        await page.screenshot({path:test.info().outputPath(`${name}-native-focused.png`)});
        proofs.push({commander,theme,requestedCollapsed,requestedZoom:2.4,...proof,nativeBodySelection:true,simulationUnchanged:true});
      }
    }
  }
  await test.info().attach('commander-framing-proof',{body:JSON.stringify(proofs,null,2),contentType:'application/json'});
});

test('large-text framing survives native held Focus and real commander movement',async({page,context,isMobile})=>{
  test.setTimeout(90_000);await launch(page,{difficulty:'easy'});await pause(page);
  const proofs=[];
  for(const theme of ['christmas','mythic']) {
    await settings(page,theme,'1.3');
    if(!await page.locator('.command-deck').evaluate(el=>el.classList.contains('collapsed')))await action(page,'toggle-deck').click();
    await maximumZoom(page,context,isMobile);await action(page,'toggle-deck').click();
    const control=action(page,'focus').first(),handle=await control.elementHandle(),rect=(await control.boundingBox())!;
    if(isMobile){const cdp=await context.newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:rect.x+rect.width/2,y:rect.y+rect.height/2}]});await page.waitForTimeout(260);expect(await handle!.evaluate(el=>el.isConnected)).toBe(true);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();}
    else {await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);await page.mouse.down();await page.waitForTimeout(260);expect(await handle!.evaluate(el=>el.isConnected)).toBe(true);await page.mouse.up();}
    await expect.poll(async()=>{const p=await exposedCommander(page);return p.covered===0&&p.healthExposed;}).toBe(true);
    const before=await page.evaluate(()=>{const c=window.__FRONTIER__.state.entities.find(e=>e.team===0&&e.kind==='commander')!;return{x:c.x,y:c.y,time:window.__FRONTIER__.state.time};});
    await action(page,'pause').click();
    if(isMobile){const box=(await page.locator('#joystick').boundingBox())!,center={x:box.x+box.width/2,y:box.y+box.height/2};const cdp=await context.newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[center]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:center.x+24,y:center.y}]});await page.waitForTimeout(650);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();}
    else {await page.keyboard.down('d');await page.waitForTimeout(650);await page.keyboard.up('d');}
    await action(page,'pause').click();
    const after=await page.evaluate(()=>{const c=window.__FRONTIER__.state.entities.find(e=>e.team===0&&e.kind==='commander')!;return{x:c.x,y:c.y,time:window.__FRONTIER__.state.time};});
    expect(after.time).toBeGreaterThan(before.time);expect(Math.hypot(after.x-before.x,after.y-before.y)).toBeGreaterThan(.1);
    await expect.poll(async()=>{const p=await exposedCommander(page);return p.covered===0&&p.healthExposed;}).toBe(true);
    let last:{x:number;y:number}|undefined;
    await expect.poll(async()=>{const p=(await exposedCommander(page)).ground,stable=last!==undefined&&Math.hypot(p.x-last.x,p.y-last.y)<.12;last=p;return stable;}).toBe(true);
    const proof=await exposedCommander(page);expect(proof.native).toBeDefined();
    const pausedBeforeSelection=await page.evaluate(()=>JSON.stringify(window.__FRONTIER__.state));
    await tap(page,proof.native!);
    await expect(page.locator('#selection-info')).toContainText(proof.commanderType==='ranger'?'Ranger':proof.commanderType==='warlord'?'Warlord':'Engineer');
    expect(await page.evaluate(()=>JSON.stringify(window.__FRONTIER__.state))).toBe(pausedBeforeSelection);
    await page.screenshot({path:test.info().outputPath(`${theme}-large-text-native-follow.png`)});
    proofs.push({theme,textScale:1.3,heldFocusNodeRetained:true,actualNativeMovement:true,before,after,...proof});
  }
  await test.info().attach('large-text-follow-proof',{body:JSON.stringify(proofs,null,2),contentType:'application/json'});
});

test('default-zoom Focus exposes commanders and health with native field guide content retained',async({page})=>{
  test.setTimeout(180_000);const proofs=[];
  for(const commander of ['ranger','warlord','engineer']){
    await launch(page,{difficulty:'easy',commander,keepTips:true});await pause(page);
    await expect(page.locator('#battle-hint')).toContainText('COMMANDER’S FIELD GUIDE');
    expect(await page.evaluate(()=>window.__FRONTIER__.renderer.camera.zoom)).toBeLessThanOrEqual(1.35);
    for(const theme of ['christmas','mythic']){
      await settings(page,theme);
      for(const requestedCollapsed of [false,true]){
        if(await page.locator('.command-deck').evaluate(e=>e.classList.contains('collapsed'))!==requestedCollapsed)await action(page,'toggle-deck').click();
        const before=await page.evaluate(()=>JSON.stringify(window.__FRONTIER__.state));
        await action(page,'focus').first().click();
        await expect.poll(async()=>{const p=await exposedCommander(page);return p.covered===0&&p.healthExposed;}).toBe(true);
        await action(page,'select-army').click();
        await expect.poll(async()=>!!(await exposedCommander(page)).native).toBe(true);
        const point=(await exposedCommander(page)).native!;await tap(page,point);
        await expect(page.locator('#selection-info')).toContainText(commander==='ranger'?'Ranger':commander==='warlord'?'Warlord':'Engineer');
        expect(await page.evaluate(()=>JSON.stringify(window.__FRONTIER__.state))).toBe(before);
        const proof=await exposedCommander(page);expect(proof.covered).toBe(0);expect(proof.healthExposed).toBe(true);
        await page.screenshot({path:test.info().outputPath(`default-${commander}-${theme}-${requestedCollapsed?'collapsed':'expanded'}-guide-Focus.png`)});
        proofs.push({commander,theme,requestedCollapsed,fieldGuideContentRetained:true,fieldGuideVisible:await page.locator('#battle-hint').isVisible(),...proof,nativeBodySelection:true,simulationUnchanged:true});
      }
    }
  }
  await test.info().attach('default-guide-framing-proof',{body:JSON.stringify(proofs,null,2),contentType:'application/json'});
});

