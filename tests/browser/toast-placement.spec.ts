import {test,expect,action,home,launch,pause,tap} from './helpers';
import type {Page} from '@playwright/test';

async function press(page:Page,name:string) {
  const node=action(page,name).first();await node.scrollIntoViewIfNeeded();
  const r=await node.boundingBox();expect(r).toBeTruthy();
  expect(await node.evaluate(n=>{const r=n.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('button')===n;})).toBe(true);
  await tap(page,{x:r!.x+r!.width/2,y:r!.y+r!.height/2});
}
async function settings(page:Page,theme:string) {
  await press(page,'pause-menu');await press(page,'settings');
  await page.getByLabel('Visual theme',{exact:true}).selectOption(theme);
  await expect(page.locator('#theme-status')).toHaveText('Artwork ready.');
  await page.getByLabel('Interface text size',{exact:true}).selectOption('1.3');
  const done=page.getByRole('dialog',{name:'Settings',exact:true}).getByRole('button',{name:'Done',exact:true});
  await done.scrollIntoViewIfNeeded();const r=(await done.boundingBox())!;await tap(page,{x:r.x+r.width/2,y:r.y+r.height/2});
}
async function geometry(page:Page) {
  return page.evaluate(()=>{
    const rect=(n:Element)=>{const r=n.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height};};
    const visible=(n:Element)=>{const s=getComputedStyle(n),r=rect(n);return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)>0&&r.w>0&&r.h>0;};
    const selectors=['.hud','.objective-bar','.battle-hint','.minimap-wrap','.map-controls','.commander-strip','#joystick','.ability-dock','.command-deck'];
    const controls=selectors.flatMap(selector=>[...document.querySelectorAll(selector)].filter(visible).map((n,index)=>({selector,index,...rect(n)})));
    const buttons=[...document.querySelectorAll<HTMLButtonElement>('.hud button,.map-controls button,.commander-strip button,.ability-dock button,.command-deck button,.battle-hint button')].flatMap((n,index)=>{
      if(!visible(n))return[];const r=rect(n),x=r.x+r.w/2,y=r.y+r.h/2;
      if(x<0||y<0||x>=innerWidth||y>=innerHeight||document.elementFromPoint(x,y)?.closest('button')!==n)return[];
      return[{index,action:n.dataset.action,label:n.getAttribute('aria-label'),...r,nativeCenterExposed:true}];
    });
    const t=document.querySelector<HTMLElement>('#toast')!;
    return{controls,buttons,toast:{...rect(t),text:t.textContent,positionKey:t.dataset.positionKey,fullyFits:t.scrollHeight<=t.clientHeight+1&&t.scrollWidth<=t.clientWidth+1},state:JSON.stringify(window.__FRONTIER__.state)};
  });
}
function assertClear(g:Awaited<ReturnType<typeof geometry>>) {
  expect(g.toast.positionKey).toBeTruthy();expect(g.toast.fullyFits).toBe(true);
  for(const r of g.controls){
    const overlap=Math.max(0,Math.min(g.toast.x+g.toast.w,r.x+r.w)-Math.max(g.toast.x,r.x))*Math.max(0,Math.min(g.toast.y+g.toast.h,r.y+r.h)-Math.max(g.toast.y,r.y));
    expect(overlap,`Message must clear ${r.selector}`).toBe(0);
  }
}
test('native large-text messages clear existing objectives and guides without moving control hit targets',async({page})=>{
  test.setTimeout(180_000);const proofs=[];
  for(const theme of ['christmas','mythic'])for(const learning of [false,true]){
    if(learning){
      await home(page);await press(page,'learn');
      const start=page.getByRole('dialog',{name:'Your first settlement',exact:true}).getByRole('button',{name:'Start learning',exact:true});
      await start.scrollIntoViewIfNeeded();const r=(await start.boundingBox())!;await tap(page,{x:r.x+r.width/2,y:r.y+r.height/2});
      await expect(page.locator('#battle-hint')).toBeVisible();
    }else await launch(page,{difficulty:'easy',keepTips:true});
    await pause(page);await settings(page,theme);
    for(const message of learning?['short']:['short','long']){
      if(message==='long')await press(page,'panel-orders');
      await press(page,message==='short'?'select-army':'ranged-spacing');
      await expect(page.locator('#toast.show')).toBeVisible();
      await expect.poll(()=>page.locator('#toast').evaluate(n=>Number(getComputedStyle(n).opacity))).toBe(1);
      const before=await geometry(page);assertClear(before);
      expect(before.toast.text?.length).toBeGreaterThan(message==='long'?80:30);
      await page.screenshot({path:test.info().outputPath(`${theme}-${learning?'learning':'battle'}-${message}-native-toast.png`)});
      await page.waitForTimeout(500);const during=await geometry(page);assertClear(during);
      expect(during.controls).toEqual(before.controls);expect(during.buttons).toEqual(before.buttons);
      expect(during.toast).toEqual(before.toast);expect(during.state).toBe(before.state);
      await expect(page.locator('#toast')).not.toHaveClass(/show/,{timeout:5000});
      const after=await geometry(page);expect(after.controls).toEqual(before.controls);expect(after.buttons).toEqual(before.buttons);expect(after.state).toBe(before.state);
      proofs.push({theme,learning,message,textScale:1.3,before,during,after,nativeInput:true,controlsStableThroughMessageExpiry:true,wholePausedGameUnchangedAfterMessageAction:true});
    }
  }
  await test.info().attach('native-toast-position-proof',{body:JSON.stringify(proofs,null,2),contentType:'application/json'});
});
