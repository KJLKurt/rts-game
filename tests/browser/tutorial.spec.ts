import {test,expect,launch,action,pause,commander} from './helpers';
import type {Page} from '@playwright/test';

async function expectPausedGuideReadable(page:Page){
 const guide=page.locator('#battle-hint'),ribbon=page.locator('#paused-ribbon');
 expect(await page.evaluate(()=>window.__FRONTIER__.state.paused)).toBe(true);
 const viewport=page.viewportSize()!;
 if(viewport.width>=600&&viewport.height<=550){
  // Short landscape intentionally hides the field guide; its pause status must remain available.
  await expect(guide).toBeHidden();await expect(ribbon).toBeVisible();
 }else{
  await expect(guide).toBeVisible();await expect(guide.locator('p')).toBeVisible();
  await expect(ribbon,'The lower-priority pause ribbon must not cover populated guide instructions').toBeHidden();
  const instructions=await guide.locator('p').evaluate(el=>{
   const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
   return{left:r.left,top:r.top,right:r.right,bottom:r.bottom,hitGuide:hit?.closest('#battle-hint')?.id};
  });
  expect(instructions.left).toBeGreaterThanOrEqual(0);expect(instructions.top).toBeGreaterThanOrEqual(0);
  expect(instructions.right).toBeLessThanOrEqual(viewport.width);expect(instructions.bottom).toBeLessThanOrEqual(viewport.height);
  expect(instructions.hitGuide).toBe('battle-hint');
 }
}

test('guide stage survives real save/reload/continue, stays readable while paused, and resets for a new battle',async({page})=>{
 await launch(page,{difficulty:'easy',keepTips:true});
 const guide=page.locator('#battle-hint'),stage=guide.locator('span');
 await expect(stage).toHaveText('COMMANDER’S FIELD GUIDE · 1/4');
 const origin=await commander(page);
 await action(page,'march-relic').click();
 await expect.poll(async()=>{const hero=await commander(page);return Math.hypot(hero.x-origin.x,hero.y-origin.y);}).toBeGreaterThan(3.5);
 await pause(page);
 // UI-only capture-milestone fixture avoids a long battle. The march above was
 // real input; no tutorial field is directly set and no save record is replaced.
 await page.evaluate(()=>{
  const s=window.__FRONTIER__.state;
  const gold=s.map.nodes.find(n=>n.kind==='gold'&&n.owner!==0)!;
  const wood=s.map.nodes.find(n=>n.kind==='wood'&&n.owner===0)!;
  gold.owner=0;gold.captureTeam=null;gold.captureProgress=0;wood.owner=0;
  s.players[0].stats.captures=Math.max(1,s.players[0].stats.captures);
 });
 await expect(stage).toHaveText('COMMANDER’S FIELD GUIDE · 3/4');
 await expect(guide.locator('b')).toHaveText('Raise your army');
 await expect(guide.locator('p')).toHaveText('Tap Recruit below, then Swordsman. New soldiers join your commander.');
 await expectPausedGuideReadable(page);
 const frozen=await page.evaluate(()=>({seed:window.__FRONTIER__.state.settings.seed,time:window.__FRONTIER__.state.time}));
 await action(page,'pause-menu').click();await action(page,'save-leave').click();
 await expect(action(page,'continue')).toBeVisible();await expect(page.getByRole('dialog')).toHaveCount(0);
 await page.reload();await action(page,'continue').click();await expect.poll(()=>page.evaluate(()=>window.__FRONTIER__.playing)).toBe(true);
 expect(await page.evaluate(()=>({seed:window.__FRONTIER__.state.settings.seed,time:window.__FRONTIER__.state.time}))).toEqual(frozen);
 await expect(stage).toHaveText('COMMANDER’S FIELD GUIDE · 3/4');
 await expect(guide.locator('b')).toHaveText('Raise your army');
 await expect(guide.locator('p')).toHaveText('Tap Recruit below, then Swordsman. New soldiers join your commander.');
 await expectPausedGuideReadable(page);
 await action(page,'pause-menu').click();await action(page,'save-leave').click();await expect(action(page,'continue')).toBeVisible();
 await action(page,'skirmish').click();await action(page,'launch').click();
 await expect(stage).toHaveText('COMMANDER’S FIELD GUIDE · 1/4');await expect(guide.locator('b')).toHaveText('Step into the frontier');
});
