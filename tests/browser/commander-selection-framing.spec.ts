import {test, expect, action, launch, pause, tap} from './helpers';
import type {Page} from '@playwright/test';

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

for (const commander of ['ranger','warlord','engineer']) {
  test(`Select Commander reveals ${commander} at default zoom with expanded recruitment and field guide`, async ({page}) => {
    test.setTimeout(90000);
    await launch(page,{difficulty:'normal',commander,keepTips:true});
    await pause(page);
    const proofs=[];
    for(const theme of ['christmas','mythic']) {
      await action(page,'pause-menu').click(); await action(page,'settings').click();
      await page.getByLabel('Visual theme',{exact:true}).selectOption(theme);
      await expect(page.locator('#theme-status')).toHaveText('Artwork ready.');
      await page.getByRole('dialog',{name:'Settings',exact:true}).getByRole('button',{name:'Done',exact:true}).click();
      await expect(page.locator('#battle-hint')).toContainText('COMMANDER’S FIELD GUIDE');
      await action(page,'panel-army').click();
      if(await page.locator('.command-deck').evaluate(e=>e.classList.contains('collapsed')))await action(page,'toggle-deck').click();
      // Start selection from the existing default zoom. No injected progress,
      // camera position, state, funds, commander location or outcome.
      expect(await page.evaluate(()=>window.__FRONTIER__.renderer.camera.zoom)).toBeLessThanOrEqual(1.35);
      const before=await page.evaluate(()=>JSON.stringify({state:window.__FRONTIER__.state,profile:window.__FRONTIER__.profile}));
      await action(page,'select-army').click();
      await action(page,'select-commander').click();
      await page.waitForTimeout(150);
      await test.info().attach(`${theme}-selection-before-assertion`,{body:JSON.stringify(await exposedCommander(page),null,2),contentType:'application/json'});
      await expect.poll(async()=>{const p=await exposedCommander(page);return p.covered===0&&p.healthExposed;}).toBe(true);
      const proof=await exposedCommander(page);
      expect(proof.opaque).toBeGreaterThan(50); expect(proof.native).toBeDefined();
      await action(page,'select-army').click(); await tap(page,proof.native!);
      await expect(page.locator('#selection-info')).toContainText(commander==='ranger'?'Ranger':commander==='warlord'?'Warlord':'Engineer');
      expect(await page.evaluate(()=>JSON.stringify({state:window.__FRONTIER__.state,profile:window.__FRONTIER__.profile}))).toBe(before);
      await expect(page.locator('#battle-hint')).toContainText('COMMANDER’S FIELD GUIDE');
      await page.screenshot({path:test.info().outputPath(`${commander}-${theme}-native-selection.png`)});
      proofs.push({theme,requestedExpanded:true,...proof,nativeBodySelection:true,wholeGameProfileExact:true,fieldGuideContentRetained:true});
    }
    await test.info().attach('native-commander-selection-proof',{body:JSON.stringify(proofs,null,2),contentType:'application/json'});
  });
}
