import {test as base, expect, type Page} from '@playwright/test';
import type {GameState, GameCommand, GameSettings, Point, BuildingId} from '../../src/sim/types';
import {BUILDINGS, canBuild} from '../../src/sim';

declare global {
 interface Window {
  __FRONTIER__: {
   readonly state: GameState; readonly playing: boolean;
   readonly profile: {games: number; wins: number; campaign: number; unlocked: string[]};
   command(command: GameCommand): boolean; save(): Promise<unknown>;
   start(options?: Partial<GameSettings>): void;
   renderer: {worldToScreen(x: number,y: number): Point; pick(state: GameState,x: number,y: number): unknown; camera: Point & {zoom: number}};
  };
 }
}
export const test=base.extend<{runtimeErrors: string[]}>({
 runtimeErrors: [async({page},use)=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await use(errors);
  expect(errors,'No uncaught browser errors').toEqual([]);
  await expect(page.locator('.fatal-error')).toHaveCount(0);
 },{auto:true}],
});
export {expect};
export const action=(page:Page,name:string)=>page.locator(`[data-action="${name}"]`);
export async function home(page:Page){await page.goto('./');await expect(action(page,'skirmish')).toBeVisible();}
export async function acknowledgeFirstBriefing(page:Page){
 const start=page.getByRole('button',{name:'Start battle',exact:true});
 if(await start.count()){await start.click();await expect(page.getByRole('dialog',{name:'Your first frontier',exact:true})).toHaveCount(0);}
}
export async function launch(page:Page,options:{difficulty?:string;commander?:string;keepTips?:boolean}={}){
 await home(page);await action(page,'skirmish').click();
 await page.getByLabel('Map seed',{exact:true}).fill('QA-FRONTIER-2026');
 await page.locator('select[name="mapSize"]').selectOption('small');
 await page.locator('select[name="difficulty"]').selectOption(options.difficulty||'normal');
 if(options.commander)await page.locator(`[data-action="choose-commander"][data-id="${options.commander}"]`).click();
 await action(page,'launch').click();
 await expect.poll(()=>page.evaluate(()=>window.__FRONTIER__.playing)).toBe(true);
 await expect(page.locator('.hud')).toBeVisible();
 await acknowledgeFirstBriefing(page);
 const dismiss=action(page,'dismiss-tips');if(!options.keepTips&&await dismiss.isVisible())await dismiss.click();
}
export async function commander(page:Page){return page.evaluate(()=>{
 const c=window.__FRONTIER__.state.entities.find(e=>e.team===0&&e.kind==='commander')!;
 return {id:c.id,x:c.x,y:c.y,order:c.order};
});}
export async function tap(page:Page,point:Point){
 const touch=await page.evaluate(()=>navigator.maxTouchPoints>0);
 if(touch)await page.touchscreen.tap(point.x,point.y);else await page.mouse.click(point.x,point.y);
}
/** Read geometry/state, validate build sites with the real engine, then use actual input. */
export async function clearGround(page:Page,build:false|true|BuildingId=false):Promise<Point>{
 const building=build===true?'house':build||null;
 const size=building?BUILDINGS[building].size:0;
 const fixture=await page.evaluate(({building,size})=>{
  const {state:s,renderer:r}=window.__FRONTIER__;
  const c=s.entities.find(e=>e.team===0&&e.kind==='commander')!;
  const okay=(x:number,y:number)=>{
   const tile=s.map.tiles[Math.floor(y)*s.map.width+Math.floor(x)];
   return x>1&&y>1&&x<s.map.width-1&&y<s.map.height-1&&!['water','rock',...(building?['forest','marsh']:[])].includes(tile);
  };
  const candidates:{screen:Point;world:Point}[]=[];
  for(let y=Math.max(2,Math.floor(c.y-8));y<Math.min(s.map.height-2,c.y+8);y++)for(let x=Math.max(2,Math.floor(c.x-8));x<Math.min(s.map.width-2,c.x+8);x++){
   const p={x:x+.5,y:y+.5};const distance=Math.hypot(c.x-p.x,c.y-p.y);
   if(distance<3||distance>7||!okay(p.x,p.y))continue;
   if(building){
    let good=true;for(let dy=-size;dy<=size;dy+=.6)for(let dx=-size;dx<=size;dx+=.6)if(!okay(p.x+dx,p.y+dy))good=false;
    if(!good)continue;
   }
   const screen=r.worldToScreen(p.x,p.y);
   if(screen.x<20||screen.y<120||screen.x>innerWidth-20||screen.y>innerHeight-30)continue;
   if(document.elementFromPoint(screen.x,screen.y)?.id!=='world'||r.pick(s,screen.x,screen.y))continue;
   // A center-point hit test alone is insufficient for native touch: Chromium
   // can target a nearby button even when that exact pixel belongs to canvas.
   // Keep the fixture's contact region clear of UI instead of weakening native
   // input or changing the gameplay assertion. Desktop keeps pixel precision.
   const clearance=navigator.maxTouchPoints>0?20:0;
   if(clearance && [-clearance,0,clearance].some(dx=>
     [-clearance,0,clearance].some(dy=>document.elementFromPoint(screen.x+dx,screen.y+dy)?.id!=='world')))continue;
   candidates.push({screen,world:p});
  }
  return{candidates,state:building?s:null};
 },{building,size});
 if(!fixture.candidates.length)throw new Error('Fixture could not find unobscured clear ground.');
 if(!building)return fixture.candidates[0].screen;
 // No approximate rule copy: canonical canBuild covers building/unit clearance,
 // terrain, prerequisites, funds, territorial reach, and preserved access routes.
 // This checks a read-only snapshot; placement itself remains a real canvas tap.
 const legal=fixture.candidates.find(candidate=>canBuild(fixture.state!,0,building,candidate.world.x,candidate.world.y).ok);
 if(!legal){
  const reasons=[...new Set(fixture.candidates.map(candidate=>canBuild(fixture.state!,0,building,candidate.world.x,candidate.world.y).error))];
  throw new Error(`Fixture found no legal unobscured ${building} site: ${reasons.join('; ')}`);
 }
 return legal.screen;
}
export async function pause(page:Page){
 if(!await page.evaluate(()=>window.__FRONTIER__.state.paused))await action(page,'pause').first().click();
 await expect.poll(()=>page.evaluate(()=>window.__FRONTIER__.state.paused)).toBe(true);
}
export async function resume(page:Page){
 if(await page.evaluate(()=>window.__FRONTIER__.state.paused))await action(page,'pause').first().click();
 await expect.poll(()=>page.evaluate(()=>window.__FRONTIER__.state.paused)).toBe(false);
}
export async function expectWithinViewport(page:Page,selector:string){
 const rect=await page.locator(selector).first().boundingBox();expect(rect,selector).not.toBeNull();
 const viewport=page.viewportSize()!;
 expect(rect!.x,selector).toBeGreaterThanOrEqual(-1);expect(rect!.y,selector).toBeGreaterThanOrEqual(-1);
 expect(rect!.x+rect!.width,selector).toBeLessThanOrEqual(viewport.width+1);
 expect(rect!.y+rect!.height,selector).toBeLessThanOrEqual(viewport.height+1);
}

/** Native range controls do not support Playwright fill; use their actual keyboard interaction. */
export async function setSlider(page:Page,selector:string,value:number){
 const slider=page.locator(selector);const {min,step}=await slider.evaluate((node:HTMLInputElement)=>({min:Number(node.min||0),step:Number(node.step||1)}));
 const steps=Math.round((value-min)/step);await slider.press('Home');
 for(let i=0;i<steps;i++)await slider.press('ArrowRight');
 await expect(slider).toHaveValue(String(value));
}
