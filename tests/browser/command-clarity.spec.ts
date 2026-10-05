import {test,expect,action,home,launch,pause,commander} from './helpers';

test('supply credit is recorded before raid warnings and disabled tips suppress the guide',async({page})=>{
 await launch(page,{difficulty:'easy',keepTips:true});
 const origin=await commander(page);await action(page,'march-relic').click();
 await expect.poll(async()=>{const hero=await commander(page);return Math.hypot(hero.x-origin.x,hero.y-origin.y);}).toBeGreaterThan(3.5);
 await pause(page);await action(page,'pause-menu').click();await action(page,'settings').click();await page.locator('#show-tips').uncheck();await page.getByRole('button',{name:'Done',exact:true}).click();
 // Explicit capture/raid fixture: isolate visibility from persistent lesson credit.
 await page.evaluate(()=>{
  const s=window.__FRONTIER__.state,node=s.map.nodes.find(n=>n.kind==='gold'&&n.owner!==0)!;
  node.owner=0;s.players[0].stats.captures++;
  s.events.push({id:s.nextEventId++,type:'capture',team:0,time:s.time,x:node.x,y:node.y,subtype:'gold'});
  s.entities.find(e=>e.team===0&&e.type==='keep')!.lastHitAt=s.time;
 });
 await expect(page.locator('#battle-hint')).toHaveAttribute('role','alert');
 await action(page,'pause-menu').click();await action(page,'save-leave').click();await expect(action(page,'continue')).toBeVisible();
 await page.reload();await action(page,'continue').click();
 await page.evaluate(()=>{const s=window.__FRONTIER__.state;s.events=[];for(const e of s.entities)e.lastHitAt=-100;});
 await action(page,'pause-menu').click();await action(page,'settings').click();await page.locator('#show-tips').check();
 await page.getByRole('button',{name:'Done',exact:true}).click();
 await expect(page.locator('#battle-hint > span')).toHaveText('COMMANDER’S FIELD GUIDE · 3/4');
 await expect(page.locator('#battle-hint p')).toContainText('position when training finishes');
});

test('relic plus starting deposits does not earn the supply lesson',async({page})=>{
 await launch(page,{difficulty:'easy',keepTips:true});const origin=await commander(page);
 await action(page,'march-relic').click();await expect.poll(async()=>{const h=await commander(page);return Math.hypot(h.x-origin.x,h.y-origin.y);}).toBeGreaterThan(3.5);await pause(page);
 await page.evaluate(()=>{const s=window.__FRONTIER__.state,n=s.map.nodes.find(n=>n.kind==='relic')!;n.owner=0;s.players[0].stats.captures++;s.events.push({id:s.nextEventId++,type:'capture',team:0,time:s.time,x:n.x,y:n.y,subtype:'relic'});});
 await expect(page.locator('#battle-hint > span')).toHaveText('COMMANDER’S FIELD GUIDE · 2/4');
 await expect(page.locator('#battle-hint b')).toHaveText('Claim fresh supplies');
});

test('Rally current producers here snapshots the producer destination and capture names its target',async({page})=>{
 await launch(page,{difficulty:'easy'});await pause(page);await action(page,'panel-orders').click();
 const before=await commander(page);await page.getByRole('button',{name:'Rally current producers here',exact:true}).click();
 const planned=await page.evaluate(()=>window.__FRONTIER__.state.pendingCommands.filter(c=>c.type==='rally'));
 expect(planned.length).toBeGreaterThan(0);for(const order of planned)expect(order).toMatchObject({x:before.x,y:before.y});
 await action(page,'panel-army').click();await expect(page.locator('[data-action="recruit"][data-id="swordsman"] .recruit-producer')).toContainText(`fixed rally (${before.x.toFixed(1)}, ${before.y.toFixed(1)})`);
 await action(page,'march-relic').click();
 const target=await page.evaluate(()=>{const command=window.__FRONTIER__.state.pendingCommands.filter(c=>c.type==='capture').at(-1)!;const node=window.__FRONTIER__.state.map.nodes.find(n=>n.id===command.nodeId)!;return`Relic (${node.x.toFixed(1)}, ${node.y.toFixed(1)})`;});
 await expect(page.locator('#selection-info .current-order')).toContainText(`Capture / defend ${target}`);
 await expect(page.locator('#selection-info .current-order')).toContainText('engages nearby enemies');
 await expect(page.getByRole('status')).toContainText(target);
});

test('the first expedition teaches expansion and safe rally even with field tips disabled',async({page})=>{
 await home(page);await action(page,'settings').click();await page.locator('#show-tips').uncheck();await page.getByRole('button',{name:'Done',exact:true}).click();
 await action(page,'expedition').click();await page.locator('[data-action="expedition-start"][data-id="balanced"]').click();await page.locator('[data-action="expedition-node"][data-id="foothold"]').click();
 await expect(page.locator('.expedition-opening')).toContainText('capture another gold mine and timber camp');
 await expect(page.locator('.expedition-opening')).toContainText('set a safe rally point');
 await expect(page.locator('.expedition-opening')).toContainText('tap a particular relic');
 await expect(action(page,'begin-briefing')).toBeVisible();
});
