import {test,expect,action,home,launch,pause,tap} from './helpers';
import type {Page,Locator} from '@playwright/test';

async function press(page:Page,node:Locator) {
  await node.scrollIntoViewIfNeeded();
  expect(await node.evaluate(n=>{const r=n.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('button')===n;})).toBe(true);
  const r=(await node.boundingBox())!;await tap(page,{x:r.x+r.width/2,y:r.y+r.height/2});
}
async function settings(page:Page,theme:string) {
  await press(page,action(page,'pause-menu'));await press(page,action(page,'settings'));
  await page.getByLabel('Visual theme',{exact:true}).selectOption(theme);
  await expect(page.locator('#theme-status')).toHaveText('Artwork ready.');
  await page.getByLabel('Interface text size',{exact:true}).selectOption('1.3');
  await page.getByLabel('Commander’s field guide',{exact:true}).check();
  await press(page,page.getByRole('dialog',{name:'Settings',exact:true}).getByRole('button',{name:'Done',exact:true}));
}
async function geometry(page:Page) {
  return page.evaluate(()=>{
    const rect=(n:Element)=>{const r=n.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height};};
    const visible=(n:Element)=>{const s=getComputedStyle(n),r=rect(n);return s.display!=='none'&&s.visibility!=='hidden'&&r.w>0&&r.h>0;};
    const guide=document.querySelector<HTMLElement>('#battle-hint')!,objective=document.querySelector('#objective')!;
    const controls=['.hud','.objective-bar','.minimap-wrap','.map-controls','.commander-strip','#joystick','.ability-dock','.command-deck'].flatMap(selector=>[...document.querySelectorAll(selector)].filter(visible).map((n,index)=>({selector,index,...rect(n)})));
    return{guide:visible(guide)?{...rect(guide),text:guide.textContent,scrollHeight:guide.scrollHeight,clientHeight:guide.clientHeight}:null,objective:rect(objective),controls,state:JSON.stringify(window.__FRONTIER__.state)};
  });
}
function assertClear(g:Awaited<ReturnType<typeof geometry>>) {
  if(!g.guide)return;
  const a=g.guide,b=g.objective;
  expect(Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y))).toBe(0);
}
test('native large-text guides expose objectives and retain their scrolling and dismissal controls',async({page})=>{
  test.setTimeout(180_000);const proofs=[];
  for(const theme of ['christmas','mythic'])for(const learning of [false,true]){
    if(learning){await home(page);await press(page,action(page,'learn'));await press(page,page.getByRole('dialog',{name:'Your first settlement',exact:true}).getByRole('button',{name:'Start learning',exact:true}));}
    else await launch(page,{difficulty:'easy',keepTips:true});
    await pause(page);await settings(page,theme);
    const before=await geometry(page);assertClear(before);
    await page.screenshot({path:test.info().outputPath(`${theme}-${learning?'learning':'ordinary'}-guide-objective-clearance.png`)});
    if(learning){
      await expect(page.locator('#battle-hint')).toBeVisible();
      await press(page,page.getByRole('button',{name:'Minimize guide',exact:true}));
      const minimized=await geometry(page);assertClear(minimized);expect(minimized.controls).toEqual(before.controls);expect(minimized.state).toBe(before.state);
      await press(page,page.getByRole('button',{name:'Expand guide',exact:true}));
      await expect(page.locator('#battle-hint')).toContainText('Move your commander');
    }else if(before.guide)await press(page,action(page,'dismiss-tips'));
    const after=await geometry(page);assertClear(after);expect(after.state).toBe(before.state);
    if(!learning&&before.guide&&await page.evaluate(()=>innerWidth<=600)){
      // Preserved native baseline (fc-aaa2403baf66): dismissing ordinary tips
      // intentionally reclaims the map-controls position from y286 to y140.
      expect(before.controls.find(r=>r.selector==='.map-controls')!.y).toBe(286);
      expect(after.controls.find(r=>r.selector==='.map-controls')!.y).toBe(140);
      expect(after.controls.filter(r=>r.selector!=='.map-controls')).toEqual(before.controls.filter(r=>r.selector!=='.map-controls'));
      expect(after.guide).toBeNull();await press(page,action(page,'focus').first());
      expect((await geometry(page)).state).toBe(before.state);
    }else expect(after.controls).toEqual(before.controls);
    await page.screenshot({path:test.info().outputPath(`${theme}-${learning?'learning':'ordinary'}-guide-native-controls.png`)});
    proofs.push({theme,learning,textScale:1.3,before,after,nativeInput:true,fixedControlsAndEstablishedDismissalTransitionPreserved:true,wholePausedGameUnchanged:true});
  }
  await test.info().attach('native-guide-clearance-proof',{body:JSON.stringify(proofs,null,2),contentType:'application/json'});
});
