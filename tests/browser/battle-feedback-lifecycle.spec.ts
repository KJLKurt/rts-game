import {test,expect,action,home,launch,pause} from './helpers';
import type {Page,Locator} from '@playwright/test';
import {readFileSync} from 'node:fs';

// This is the unedited profile/route actually earned in the native N14 session.
// The only storage mapping is the owned localhost origin. Terminal fixtures below
// exercise presentation transitions, never campaign balance or earned acceptance.
test.use({storageState: async({baseURL},use)=>{
  const checkpoint=JSON.parse(readFileSync(new URL('./fixtures/native-earned-seven-games-checkpoint.json',import.meta.url),'utf8'));
  const origin=new URL(baseURL!).origin;
  await use({...checkpoint,origins:checkpoint.origins.map((saved:any)=>({...saved,origin}))});
}});
async function press(page:Page,button:Locator){
  await button.scrollIntoViewIfNeeded();
  if(await page.evaluate(()=>navigator.maxTouchPoints>0))await button.tap();
  else await button.click();
}
const snapshot=(page:Page)=>page.evaluate(()=>{
  const f=window.__FRONTIER__ as any;
  return JSON.parse(JSON.stringify({game:f.state,profile:f.profile,campaign:f.campaignSession,route:f.expedition,matchId:f.matchId}));
});
async function ownedHome(page:Page){
  await home(page);
  await expect.poll(()=>page.evaluate(()=>window.__FRONTIER__.profile.games)).toBe(7);
  expect(await page.evaluate(()=>window.__FRONTIER__.profile.wins)).toBe(3);
}
async function terminalFeedbackFixture(page:Page,text:string){
  await page.evaluate(text=>{
    const s=window.__FRONTIER__.state;
    s.players[0].defeated=true;s.winner=1;s.victoryReason='QA presentation fixture: keep lost';
    s.events.push({id:s.nextEventId++,type:'alert',team:0,time:s.time,x:0,y:0,text});
  },text);
  await expect(page.locator('#result-save-status')).toHaveText('Result saved on this device.');
  await expect(page.locator('#toast')).toHaveText(text);
  await expect(page.locator('#toast')).toHaveClass(/show/);
}
async function retiredToast(page:Page){
  await expect(page.locator('#toast')).toHaveText('');
  await expect(page.locator('#toast')).not.toHaveClass(/show/);
}
async function evidence(page:Page,name:string,value:unknown){
  await test.info().attach(name,{body:JSON.stringify({terminalFixturesArePresentationOnly:true,value}),contentType:'application/json'});
  await page.screenshot({path:test.info().outputPath(name+'.png')});
}

test('Ironwatch retry retires prior defeat feedback and preserves fresh paused orders',async({page})=>{
  await ownedHome(page);await press(page,action(page,'campaign'));
  await press(page,page.locator('[data-action="choose-campaign"][data-id="rise-of-the-frontier"]'));
  const mission=page.locator('[data-action="mission"][data-id="3"]');await expect(mission).toBeEnabled();
  await press(page,mission);await press(page,action(page,'begin-mission'));await pause(page);
  await terminalFeedbackFixture(page,'Your Command Keep has fallen!');
  const before=await snapshot(page);await evidence(page,'previous-Ironwatch-result',before);
  await press(page,action(page,'retry'));await press(page,action(page,'begin-mission'));await pause(page);
  const after=await snapshot(page);await evidence(page,'native-Ironwatch-retry-paused',after);
  await retiredToast(page);
  expect(after.profile).toEqual(before.profile);expect(after.route).toEqual(before.route);
  expect(after.matchId).not.toBe(before.matchId);expect(after.campaign.missionId).toBe('ironwatch');
  expect(after.game.settings.difficulty).toBe('hard');expect(after.game.settings.seed).toBe('IRONWATCH-04');
  expect(after.game.time).toBeLessThan(2);expect(after.game.winner).toBeNull();
  expect(Math.floor(after.game.players[0].gold)).toBe(500);expect(Math.floor(after.game.players[0].wood)).toBe(500);
  await press(page,action(page,'panel-army'));
  await press(page,page.locator('[data-action="recruit"][data-id="swordsman"]'));
  await expect(page.locator('#toast')).toHaveClass(/show/);await expect(page.locator('#toast')).toContainText('queued');
  const fresh=await page.locator('#toast').textContent(),queued=await snapshot(page);
  await press(page,action(page,'pause-menu'));await press(page,action(page,'close-dialog').first());
  await expect(page.locator('#toast')).toHaveText(fresh!);await expect(page.locator('#toast')).toHaveClass(/show/);
  expect(await snapshot(page)).toEqual(queued);
});

test('Forager result route retires targeting feedback without changing committed profile or route',async({page})=>{
  await ownedHome(page);await press(page,action(page,'expedition'));
  await press(page,action(page,'expedition-new'));
  await press(page,page.locator('[data-action="expedition-start"][data-id="forager"]'));
  const node=page.locator('[data-action="expedition-node"][data-id="foothold"]');await expect(node).toBeVisible();
  await press(page,node);await expect.poll(()=>page.evaluate(()=>window.__FRONTIER__.playing)).toBe(true);
  await press(page,action(page,'begin-briefing'));await pause(page);
  await terminalFeedbackFixture(page,'Choose Attack, then tap this enemy.');
  const before=await snapshot(page);await evidence(page,'previous-Forager-result',before);
  await press(page,action(page,'result-expedition'));
  const after=await snapshot(page);await evidence(page,'native-Forager-result-route',after);
  await retiredToast(page);expect(after.profile).toEqual(before.profile);expect(after.route).toEqual(before.route);
  expect(await page.evaluate(()=>window.__FRONTIER__.playing)).toBe(false);
  await press(page,action(page,'expedition-save'));
  await expect(page.locator('#toast')).toHaveText('Expedition route saved on this device.');
  await expect(page.locator('#toast')).toHaveClass(/show/);
  expect((await snapshot(page)).profile).toEqual(before.profile);expect((await snapshot(page)).route).toEqual(before.route);
});

test('fresh battle and route saves survive their current dialogs and menus until normal expiry',async({page})=>{
  await launch(page,{difficulty:'easy'});await pause(page);
  await expect.poll(()=>page.evaluate(()=>window.__FRONTIER__.profile.games)).toBe(7);
  await press(page,action(page,'pause-menu'));await press(page,action(page,'save'));
  await expect(page.locator('#toast')).toHaveText('Battle saved on this device.');await expect(page.locator('#toast')).toHaveClass(/show/);
  const saved=await snapshot(page);
  await press(page,action(page,'close-dialog').first());await press(page,action(page,'pause-menu'));
  await expect(page.locator('#toast')).toHaveText('Battle saved on this device.');await expect(page.locator('#toast')).toHaveClass(/show/);
  expect(await snapshot(page)).toEqual(saved);
  await press(page,action(page,'save-leave'));await expect(action(page,'expedition')).toBeVisible();await retiredToast(page);
  await press(page,action(page,'expedition'));await press(page,action(page,'expedition-save'));
  await expect(page.locator('#toast')).toHaveText('Expedition route saved on this device.');
  const route=await snapshot(page);await press(page,action(page,'home'));await press(page,action(page,'settings'));await press(page,action(page,'close-dialog').first());
  await expect(page.locator('#toast')).toHaveText('Expedition route saved on this device.');await expect(page.locator('#toast')).toHaveClass(/show/);
  expect((await snapshot(page)).profile).toEqual(route.profile);expect((await snapshot(page)).route).toEqual(route.route);
  await evidence(page,'fresh-route-feedback-preserved',route);
  await expect(page.locator('#toast')).toHaveText('',{timeout:5000});await retiredToast(page);
});
