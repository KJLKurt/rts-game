import {test,expect,launch,action,pause,home} from './helpers';

/** Presentation-only fixture reproducing an observed real campaign Keep loss. */
test('a Keep-loss result uses the local perspective and a real retry starts cleanly',async({page})=>{
 await launch(page,{difficulty:'easy'});await pause(page);
 // This is not a gameplay win/loss or campaign progression test. The completed
 // result state isolates wording while buttons, storage and restart stay real.
 await page.evaluate(()=>{
  const s=window.__FRONTIER__.state;
  s.players[0].defeated=true;s.winner=1;s.victoryReason='All enemy Command Keeps destroyed';
 });
 const result=page.getByRole('dialog',{name:'The banner will rise again.',exact:true});
 await expect(result).toBeVisible();await expect(page.locator('.result-reason')).toHaveText('Your Command Keep has fallen.');
 await action(page,'retry').click();await expect(result).toHaveCount(0);
 await expect.poll(()=>page.evaluate(()=>({winner:window.__FRONTIER__.state.winner,defeated:window.__FRONTIER__.state.players[0].defeated}))).toEqual({winner:null,defeated:false});
 await expect(page.locator('.hud')).toBeVisible();
});

test('the terminal chapter refresh displays completed objectives and final capacity before the saved result',async({page})=>{
 await home(page);await action(page,'campaign').click();await page.locator('[data-action="choose-campaign"][data-id="rise-of-the-frontier"]').click();await action(page,'mission').first().click();await action(page,'begin-mission').click();await pause(page);
 await expect(action(page,'mission-objectives')).toContainText('2 / 5');await expect(page.locator('#population')).toContainText('/12');
 // Explicit terminal readout fixture, independent of natural victory/balance QA.
 await page.evaluate(()=>{
  const s=window.__FRONTIER__.state,unit=s.entities.find(e=>e.team===0&&e.kind==='unit')!,keep=s.entities.find(e=>e.team===0&&e.type==='keep')!;
  for(let i=0;i<2;i++)s.entities.push({...structuredClone(unit),id:`e${s.nextId++}`});
  s.entities.push({...structuredClone(keep),id:`e${s.nextId++}`,type:'house',hp:420,maxHp:420,radius:1,buildProgress:1,queue:[],x:keep.x+3,y:keep.y+3});
  s.map.nodes.find(n=>n.kind==='relic')!.owner=0;s.players[0].population=6;s.players[0].populationCap=20;
  s.winner=0;s.victoryReason='Terminal HUD readout fixture';
 });
 await expect(page.locator('.result-dialog')).toBeVisible();await expect(action(page,'mission-objectives')).toContainText('5 / 5');await expect(page.locator('#population')).toContainText('/20');
 await expect(page.locator('#result-save-status')).toHaveText('Result saved on this device.');
 await expect(action(page,'result-save')).toBeHidden();
 expect(await page.evaluate(()=>window.__FRONTIER__.profile.games)).toBe(1);
 await page.screenshot({path:test.info().outputPath('terminal-chapter-HUD.png')});
 await page.reload();await expect(action(page,'skirmish')).toBeVisible();expect(await page.evaluate(()=>window.__FRONTIER__.profile.games)).toBe(1);
});

test('HUD updates after a result preserve practice progress and do not write tutorial preferences',async({page})=>{
 await home(page);await action(page,'learn').click();await page.getByRole('button',{name:'Start learning',exact:true}).click();await pause(page);
 const guide=page.locator('#battle-hint > span');await expect(guide).toHaveText('LEARN TO COMMAND · 1/8');
 await page.evaluate(()=>{
  const native=Storage.prototype.setItem;(window as any).__QA_PREFERENCE_WRITES__=0;
  Storage.prototype.setItem=function(key,value){if(key==='frontier-command:rts-game:v1:preferences')(window as any).__QA_PREFERENCE_WRITES__++;return native.call(this,key,value);};
  window.__FRONTIER__.state.winner=0;window.__FRONTIER__.state.victoryReason='Result tutorial guard fixture';
 });
 await expect(page.locator('.result-dialog')).toBeVisible();
 const gold=await page.evaluate(()=>{
  const s=window.__FRONTIER__.state,h=s.entities.find(e=>e.team===0&&e.kind==='commander')!;
  h.x+=4;s.commandLog.push({tick:s.tick,command:{type:'move',team:0,x:h.x,y:h.y}});for(const n of s.map.nodes)n.owner=0;
  s.players[0].gold+=7;return Math.floor(s.players[0].gold);
 });
 // The changed gold label proves a subsequent real HUD tick ran, without sleeping.
 await expect(page.locator('#gold')).toContainText(String(gold));await expect(guide).toHaveText('LEARN TO COMMAND · 1/8');
 expect(await page.evaluate(()=>(window as any).__QA_PREFERENCE_WRITES__)).toBe(0);
 await expect(page.locator('#result-save-status')).toHaveText('Result saved on this device.');
 expect(await page.evaluate(()=>window.__FRONTIER__.profile.games)).toBe(1);
});
