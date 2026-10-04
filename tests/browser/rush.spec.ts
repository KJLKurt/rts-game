import {test,expect,action,home,commander,tap,clearGround,pause,resume,expectWithinViewport} from './helpers';
import type {Page} from '@playwright/test';

async function enterRush(page:Page){
 await home(page);await action(page,'rush').click();await expect(page.getByRole('dialog',{name:'Rush Arena',exact:true})).toBeVisible();
 await page.locator('[data-action="rush-commander"][data-id="engineer"]').click();
 await expect(page.locator('[data-action="rush-commander"][data-id="engineer"]')).toHaveClass(/chosen/);
 await action(page,'launch-rush').click();await expect.poll(()=>page.evaluate(()=>window.__FRONTIER__.playing&&!!window.__FRONTIER__.state.rush)).toBe(true);
}

test('Rush setup can be cancelled and restarted, then real movement and waves work',async({page})=>{
 await home(page);await action(page,'rush').click();await action(page,'close-dialog').click();await expect(page.getByRole('dialog')).toHaveCount(0);
 await enterRush(page);await expect(page.locator('#objective')).toContainText('RUSH ARENA');
 await expect(page.locator('.deck-tabs')).toBeHidden();await expect(page.locator('.resources [title="Gold"]')).toBeHidden();
 await expect(page.locator('#population')).toHaveText(/\d+\s+squad/);await expect(page.locator('#population')).not.toContainText('/0');
 const arena=await page.evaluate(()=>{const s=window.__FRONTIER__.state;return{mode:s.settings.mode,commander:s.settings.commander,buildings:s.entities.filter(e=>e.kind==='building').length,nodes:s.map.nodes.length};});
 expect(arena).toEqual({mode:'rush',commander:'engineer',buildings:0,nodes:0});
 const before=await commander(page);await tap(page,await clearGround(page));
 await expect.poll(async()=>{const c=await commander(page);return Math.hypot(c.x-before.x,c.y-before.y);}).toBeGreaterThan(.5);
 await expect.poll(()=>page.evaluate(()=>window.__FRONTIER__.state.rush!.wave),{timeout:10_000}).toBeGreaterThanOrEqual(1);
 await expect.poll(()=>page.evaluate(()=>window.__FRONTIER__.state.entities.some(e=>e.team===1&&e.hp>0))).toBe(true);
 await page.getByRole('button',{name:'Runic Turret',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.__FRONTIER__.state.entities.some(e=>e.team===0&&e.type==='turret'))).toBe(true);
 for(const selector of ['.hud','.command-deck','.ability-dock'])await expectWithinViewport(page,selector);
 await page.screenshot({path:test.info().outputPath('rush-arena.png')});
});

test('Rush upgrade offers survive dismissal and are claimed once through the UI',async({page})=>{
 await enterRush(page);await pause(page);
 // Timing fixture only: use the actual simulation's next-upgrade event, without a 45s wait.
 await page.evaluate(()=>{const s=window.__FRONTIER__.state;s.rush!.nextUpgradeAt=s.time+.1;});
 await resume(page);await action(page,'rush-upgrade').click();
 const choices=page.locator('[data-action="choose-rush-upgrade"]');await expect(choices).toHaveCount(3);
 const offered=await choices.evaluateAll(buttons=>buttons.map(b=>(b as HTMLElement).dataset.id));
 const frozen=await page.evaluate(()=>window.__FRONTIER__.state.time);await page.waitForTimeout(350);
 expect(await page.evaluate(()=>window.__FRONTIER__.state.time)).toBe(frozen);
 await action(page,'close-dialog').click();await action(page,'rush-upgrade').click();
 expect(await choices.evaluateAll(buttons=>buttons.map(b=>(b as HTMLElement).dataset.id))).toEqual(offered);
 await choices.first().click();await expect(page.getByRole('dialog')).toHaveCount(0);
 await expect.poll(()=>page.evaluate(()=>window.__FRONTIER__.state.rush!.upgrades)).toEqual([offered[0]]);
 expect(await page.evaluate(()=>window.__FRONTIER__.state.rush!.upgradeAvailable)).toBe(0);
 await expect(action(page,'rush-upgrade')).toHaveCount(0);
});

test('Rush save, reload, and continue retain run state and presentation',async({page})=>{
 await enterRush(page);await pause(page);
 const before=await page.evaluate(()=>{const s=window.__FRONTIER__.state;return{seed:s.settings.seed,time:s.time,rush:s.rush};});
 await action(page,'pause-menu').click();await action(page,'save-leave').click();await page.reload();await action(page,'continue').click();
 await expect.poll(()=>page.evaluate(()=>window.__FRONTIER__.playing)).toBe(true);
 expect(await page.evaluate(()=>{const s=window.__FRONTIER__.state;return{seed:s.settings.seed,time:s.time,rush:s.rush};})).toEqual(before);
 await expect(page.locator('body')).toHaveClass(/rush-mode/);await expect(page.locator('.deck-tabs')).toBeHidden();
 await expect(page.locator('#objective')).toContainText('RUSH ARENA');await expect(page.locator('#population')).toHaveText(/\d+\s+squad/);await resume(page);
 await expect.poll(()=>page.evaluate(()=>window.__FRONTIER__.state.time)).toBeGreaterThan(before.time);
});

test('finished runs cannot be re-saved and counted twice; rematch starts a new run',async({page})=>{
 await enterRush(page);await pause(page);
 const games=await page.evaluate(()=>window.__FRONTIER__.profile.games);
 // Terminal-state fixture exercises the real end-of-run transition, not survival balance.
 await page.evaluate(()=>{const s=window.__FRONTIER__.state;s.rush!.surviveUntil=s.time+.1;});
 await resume(page);await expect(page.getByRole('dialog')).toHaveAccessibleName('The frontier is yours.');
 await expect.poll(()=>page.evaluate(()=>window.__FRONTIER__.profile.games)).toBe(games+1);
 // The save API must ignore a completed game (e.g. backgrounding or applying an update).
 await page.evaluate(()=>window.__FRONTIER__.save());await action(page,'result-home').click();await page.reload();
 await expect(action(page,'skirmish')).toBeVisible();await expect(action(page,'continue')).toHaveCount(0);
 expect(await page.evaluate(()=>window.__FRONTIER__.profile.games)).toBe(games+1);
 await action(page,'rush').click();await action(page,'launch-rush').click();
 await expect.poll(()=>page.evaluate(()=>window.__FRONTIER__.state.winner)).toBeNull();
 expect(await page.evaluate(()=>window.__FRONTIER__.state.rush!.surviveUntil)).toBe(240);
});
