import {test as base, expect, type Page} from '@playwright/test';
import type {GameState, GameCommand, GameSettings, Point} from '../../src/sim/types';

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
export async function launch(page:Page,options:{difficulty?:string;commander?:string}={}){
 await home(page);await action(page,'skirmish').click();
 await page.getByLabel('Map seed',{exact:true}).fill('QA-FRONTIER-2026');
 await page.locator('select[name="mapSize"]').selectOption('small');
 await page.locator('select[name="difficulty"]').selectOption(options.difficulty||'normal');
 if(options.commander)await page.locator(`[data-action="choose-commander"][data-id="${options.commander}"]`).click();
 await action(page,'launch').click();
 await expect.poll(()=>page.evaluate(()=>window.__FRONTIER__.playing)).toBe(true);
 await expect(page.locator('.hud')).toBeVisible();
 const dismiss=action(page,'dismiss-tips');if(await dismiss.count())await dismiss.click();
}
export async function commander(page:Page){return page.evaluate(()=>{
 const c=window.__FRONTIER__.state.entities.find(e=>e.team===0&&e.kind==='commander')!;
 return {id:c.id,x:c.x,y:c.y,order:c.order};
});}
export async function tap(page:Page,point:Point){
 const touch=await page.evaluate(()=>navigator.maxTouchPoints>0);
 if(touch)await page.touchscreen.tap(point.x,point.y);else await page.mouse.click(point.x,point.y);
}
/** Read geometry to choose an unobstructed screen target, then use actual input. */
export async function clearGround(page:Page,build=false):Promise<Point>{
 return page.evaluate(build=>{
  const {state:s,renderer:r}=window.__FRONTIER__;
  const c=s.entities.find(e=>e.team===0&&e.kind==='commander')!;
  const okay=(x:number,y:number)=>{
   const tile=s.map.tiles[Math.floor(y)*s.map.width+Math.floor(x)];
   return x>1&&y>1&&x<s.map.width-1&&y<s.map.height-1&&!['water','rock',...(build?['forest','marsh']:[])].includes(tile);
  };
  const candidates:Point[]=[];
  for(let y=Math.max(2,Math.floor(c.y-8));y<Math.min(s.map.height-2,c.y+8);y++)for(let x=Math.max(2,Math.floor(c.x-8));x<Math.min(s.map.width-2,c.x+8);x++){
   const p={x:x+.5,y:y+.5};const distance=Math.hypot(c.x-p.x,c.y-p.y);
   if(distance<3||distance>7||!okay(p.x,p.y))continue;
   if(build){
    let good=true;for(let dy=-1;dy<=1;dy+=.6)for(let dx=-1;dx<=1;dx+=.6)if(!okay(p.x+dx,p.y+dy))good=false;
    if(!good||s.entities.some(e=>e.kind==='building'&&e.hp>0&&Math.hypot(e.x-p.x,e.y-p.y)<e.radius+1.5)||s.map.nodes.some(n=>Math.hypot(n.x-p.x,n.y-p.y)<2.5))continue;
   }
   const screen=r.worldToScreen(p.x,p.y);
   if(screen.x<20||screen.y<120||screen.x>innerWidth-20||screen.y>innerHeight-30)continue;
   if(document.elementFromPoint(screen.x,screen.y)?.id!=='world'||r.pick(s,screen.x,screen.y))continue;
   candidates.push(screen);
  }
  if(!candidates.length)throw new Error('Fixture could not find unobscured clear ground.');
  return candidates[0];
 },build);
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
